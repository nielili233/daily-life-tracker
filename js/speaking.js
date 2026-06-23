window.Speaking = (function() {

  /* ══════════ IndexedDB for audio blobs ══════════ */
  var DB_NAME = 'dlt_speaking_audio';
  var DB_STORE = 'audio';
  var _db = null;

  function _openDB() {
    return new Promise(function(resolve, reject) {
      if (_db) return resolve(_db);
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = function(e) { _db = e.target.result; resolve(_db); };
      req.onerror = function() { reject(req.error); };
    });
  }

  function _idbPut(key, blob) {
    return _openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(blob, key);
        tx.oncomplete = resolve;
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function _idbGet(key) {
    return _openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(DB_STORE, 'readonly');
        var req = tx.objectStore(DB_STORE).get(key);
        req.onsuccess = function() { resolve(req.result || null); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  /* ══════════ Date helpers ══════════ */
  function _today() { return Store.today(); }

  function _dateDiff(a, b) {
    var da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }

  function _addDays(ds, n) {
    var d = new Date(ds + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return Store.formatDate(d);
  }

  /* ══════════ Daily rollback check ══════════ */
  function _checkRollback(data) {
    if (!data || !data.history || !data.settings) return data;
    var td = _today();
    var last = data.lastPracticeDate;
    if (!last) return data; // never practiced, nothing to rollback

    var gap = _dateDiff(last, td);
    if (gap <= 0) return data; // already practiced today

    var changed = false;
    if (gap === 1) {
      // yesterday missed
      var yesterday = _addDays(td, -1);
      if (!data.history[yesterday]) {
        data.history[yesterday] = { step: data.currentStep, status: 'missed' };
        data.currentStep = Math.max(0, data.currentStep - 1);
        changed = true;
      }
    } else if (gap >= 2) {
      // multiple days missed
      for (var i = 1; i < gap; i++) {
        var missDate = _addDays(last, i);
        if (!data.history[missDate]) {
          data.history[missDate] = { step: data.currentStep, status: 'missed' };
          data.currentStep = Math.max(0, data.currentStep - 1);
          changed = true;
        }
      }
    }

    if (changed) Store.setSpeaking(data);
    return data;
  }

  /* ══════════ State ══════════ */
  var _data = null;
  var _recording = false;
  var _mediaRecorder = null;
  var _audioChunks = [];
  var _audioBlob = null;
  var _audioUrl = null;
  var _timerInterval = null;
  var _timerSeconds = 0;
  var _settingsOpen = false;

  function _load() {
    _data = Store.getSpeaking();
    _data = _checkRollback(_data);
    return _data;
  }

  function _save() { Store.setSpeaking(_data); }

  /* ══════════ Stats ══════════ */
  function _calcStreak() {
    if (!_data || !_data.history) return 0;
    var td = _today();
    var streak = 0;
    var d = td;
    while (true) {
      var prev = _addDays(d, -1);
      var h = _data.history[prev];
      if (h && (h.status === 'done' || h.status === 'streak' || h.status === 'resumed')) {
        streak++;
        d = prev;
      } else {
        break;
      }
    }
    // check if today already done
    if (_data.history[td] && (_data.history[td].status === 'done' || _data.history[td].status === 'streak' || _data.history[td].status === 'resumed')) {
      streak++;
    }
    return streak;
  }

  function _totalDone() {
    if (!_data || !_data.history) return 0;
    var count = 0;
    for (var k in _data.history) {
      var s = _data.history[k].status;
      if (s === 'done' || s === 'streak' || s === 'resumed') count++;
    }
    return count;
  }

  /* ══════════ Render: Staircase ══════════ */
  function _renderStaircase() {
    if (!_data || !_data.settings) return '';
    var total = _data.settings.totalSteps;
    var cur = _data.currentStep;
    var cols = window.innerWidth <= 600 ? 3 : 5;
    var rows = Math.ceil(total / cols);
    var milestones = _data.settings.milestones || {};

    var html = '<div class="spk-staircase">';
    html += '<div class="spk-staircase-scroll">';

    for (var r = 0; r < rows; r++) {
      html += '<div class="spk-stair-row">';
      for (var c = 0; c < cols; c++) {
        var idx;
        if (r % 2 === 0) {
          idx = r * cols + c + 1; // L→R
        } else {
          idx = r * cols + (cols - 1 - c) + 1; // R→L
        }
        if (idx > total) { html += '<div class="spk-step spk-step-empty"></div>'; continue; }

        var status = 'future';
        var dateForStep = '';
        for (var date in _data.history) {
          if (_data.history[date].step === idx) {
            status = _data.history[date].status;
            dateForStep = date;
            break;
          }
        }
        // step that is current but no history entry = step 0
        if (idx === 0) status = 'future';

        var isCurrent = (idx === cur);
        var isMilestone = milestones[String(idx)];
        var cls = 'spk-step spk-step-' + status;
        if (isCurrent) cls += ' spk-step-current';
        if (isMilestone) cls += ' spk-step-milestone';

        var title = idx;
        if (isMilestone) title = '🏆';

        html += '<div class="' + cls + '" data-step="' + idx + '" title="' + (dateForStep || '第' + idx + '格') + '">' +
          '<span class="spk-step-num">' + title + '</span>';

        if (isCurrent) {
          html += '<div class="spk-character">' +
            '<div class="spk-char-head"></div>' +
            '<div class="spk-char-body"></div>' +
            '</div>';
        }

        if (isMilestone) {
          html += '<div class="spk-milestone-badge">' + escapeHtml(milestones[String(idx)]) + '</div>';
        }

        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  /* ══════════ Render: Practice area ══════════ */
  function _renderPractice() {
    var td = _today();
    var todayDone = _data.history[td] && (_data.history[td].status === 'done' || _data.history[td].status === 'streak' || _data.history[td].status === 'resumed');

    var html = '<div class="spk-practice">';
    html += '<div class="spk-standard">' + escapeHtml(_data.settings.practiceStandard) + '</div>';

    if (todayDone) {
      html += '<div class="spk-done-msg">✅ 今天已完成练习！明天继续加油</div>';
      // show replay of today's audio
      html += '<div class="spk-audio-replay">' +
        '<button class="btn" onclick="Speaking.playToday()">▶ 播放今天的录音</button>' +
        '</div>';
    } else if (_recording) {
      html += '<div class="spk-recording">' +
        '<div class="spk-timer">' + _formatTime(_timerSeconds) + '</div>' +
        '<div class="spk-rec-dot"></div> 录音中...' +
        '<div class="spk-rec-actions">' +
          '<button class="btn btn-primary" onclick="Speaking.stopRecord()">停止录音</button>' +
        '</div>' +
        '</div>';
    } else if (_audioBlob) {
      html += '<div class="spk-preview">' +
        '<audio controls src="' + _audioUrl + '" class="spk-audio-player"></audio>' +
        '<div class="spk-preview-actions">' +
          '<button class="btn" onclick="Speaking.discardAudio()">重新录</button>' +
          '<button class="btn btn-primary" onclick="Speaking.submitAudio()">✓ 提交练习</button>' +
        '</div>' +
        '</div>';
    } else {
      html += '<div class="spk-actions">' +
        '<button class="btn btn-primary spk-btn-record" onclick="Speaking.startRecord()">🎤 开始录音</button>' +
        '<span class="spk-or">或</span>' +
        '<label class="btn spk-btn-upload">📁 上传语音<input type="file" accept="audio/*" onchange="Speaking.handleUpload(event)" style="display:none"></label>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  function _formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /* ══════════ Render: Milestones ══════════ */
  function _renderMilestones() {
    var ms = _data.settings.milestones || {};
    var keys = Object.keys(ms).sort(function(a, b) { return parseInt(a) - parseInt(b); });
    if (keys.length === 0) return '';

    var html = '<div class="spk-milestones"><div class="spk-section-title">🏆 里程碑</div>';
    keys.forEach(function(k) {
      var reached = _data.currentStep >= parseInt(k);
      html += '<div class="spk-ms-item' + (reached ? ' spk-ms-reached' : '') + '">' +
        '<span class="spk-ms-step">第 ' + k + ' 格</span>' +
        '<span class="spk-ms-text">' + escapeHtml(ms[k]) + '</span>' +
        (reached ? '<span class="spk-ms-check">✓</span>' : '') +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ══════════ Render: History ══════════ */
  function _renderHistory() {
    var dates = Object.keys(_data.history).sort(function(a, b) { return b.localeCompare(a); });
    if (dates.length === 0) return '';

    var show = dates.slice(0, 14); // last 14 entries
    var html = '<div class="spk-history"><div class="spk-section-title">📋 最近练习</div>';
    html += '<div class="spk-history-list">';
    show.forEach(function(d) {
      var h = _data.history[d];
      var icon = h.status === 'done' ? '✅' : h.status === 'missed' ? '❌' : h.status === 'resumed' ? '🔄' : '🔥';
      html += '<div class="spk-hist-item spk-hist-' + h.status + '">' +
        '<span class="spk-hist-date">' + d.slice(5) + '</span>' +
        '<span class="spk-hist-icon">' + icon + '</span>' +
        '<span class="spk-hist-step">第 ' + h.step + ' 格</span>' +
        '</div>';
    });
    html += '</div></div>';
    return html;
  }

  /* ══════════ Render: Settings Modal ══════════ */
  function showSettings() {
    var s = _data.settings;
    var ms = s.milestones || {};
    Modal.show(
      '<h3>练习设置</h3><form id="spk-settings-form">' +
      '<div class="form-group"><label>路线名称</label>' +
        '<input type="text" name="routeName" value="' + escapeHtml(s.routeName) + '"></div>' +
      '<div class="form-group"><label>总台阶数</label>' +
        '<input type="number" name="totalSteps" min="5" max="365" value="' + s.totalSteps + '"></div>' +
      '<div class="form-group"><label>每日练习标准</label>' +
        '<input type="text" name="practiceStandard" value="' + escapeHtml(s.practiceStandard) + '"></div>' +
      '<div class="form-group"><label>提醒时间</label>' +
        '<input type="time" name="reminderTime" value="' + s.reminderTime + '"></div>' +
      '<div class="form-group"><label>第 7 格鼓励语</label>' +
        '<input type="text" name="ms7" value="' + escapeHtml(ms['7'] || '') + '" placeholder="可不填"></div>' +
      '<div class="form-group"><label>第 15 格鼓励语</label>' +
        '<input type="text" name="ms15" value="' + escapeHtml(ms['15'] || '') + '" placeholder="可不填"></div>' +
      '<div class="form-group"><label>第 30 格鼓励语</label>' +
        '<input type="text" name="ms30" value="' + escapeHtml(ms['30'] || '') + '" placeholder="可不填"></div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
        '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('spk-settings-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var milestones = {};
      var m7 = fd.get('ms7'); if (m7) milestones['7'] = m7;
      var m15 = fd.get('ms15'); if (m15) milestones['15'] = m15;
      var m30 = fd.get('ms30'); if (m30) milestones['30'] = m30;
      // keep custom milestones
      var oldMs = _data.settings.milestones || {};
      for (var k in oldMs) { if (!milestones[k] && k !== '7' && k !== '15' && k !== '30') milestones[k] = oldMs[k]; }

      _data.settings.routeName = fd.get('routeName') || _data.settings.routeName;
      _data.settings.totalSteps = parseInt(fd.get('totalSteps')) || 30;
      _data.settings.practiceStandard = fd.get('practiceStandard') || _data.settings.practiceStandard;
      _data.settings.reminderTime = fd.get('reminderTime') || '20:00';
      _data.settings.milestones = milestones;
      // clamp currentStep
      if (_data.currentStep >= _data.settings.totalSteps) _data.currentStep = _data.settings.totalSteps;
      _save();
      Modal.hide();
      App.refresh();
    };
  }

  /* ══════════ Audio recording ══════════ */
  function startRecord() {
    _audioBlob = null;
    _audioUrl = null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('你的浏览器不支持录音，请使用"上传语音"功能');
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      var options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      _mediaRecorder = new MediaRecorder(stream, options);
      _audioChunks = [];
      _timerSeconds = 0;

      _mediaRecorder.ondataavailable = function(e) {
        if (e.data.size > 0) _audioChunks.push(e.data);
      };

      _mediaRecorder.onstop = function() {
        stream.getTracks().forEach(function(t) { t.stop(); });
        _audioBlob = new Blob(_audioChunks, { type: _mediaRecorder.mimeType || 'audio/webm' });
        _audioUrl = URL.createObjectURL(_audioBlob);
        _recording = false;
        clearInterval(_timerInterval);
        App.refresh();
      };

      // collect data every second for safety
      _mediaRecorder.start(1000);
      _recording = true;

      _timerInterval = setInterval(function() {
        _timerSeconds++;
        var el = document.querySelector('.spk-timer');
        if (el) el.textContent = _formatTime(_timerSeconds);
        // auto-stop at 5 minutes
        if (_timerSeconds >= 300) stopRecord();
      }, 1000);

      App.refresh();
    }).catch(function() {
      alert('无法访问麦克风，请检查权限或使用"上传语音"');
    });
  }

  function stopRecord() {
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
      _mediaRecorder.stop();
    }
  }

  function handleUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      alert('请上传音频文件');
      return;
    }
    _audioBlob = file;
    _audioUrl = URL.createObjectURL(file);
    App.refresh();
  }

  function discardAudio() {
    if (_audioUrl) URL.revokeObjectURL(_audioUrl);
    _audioBlob = null;
    _audioUrl = null;
    App.refresh();
  }

  function submitAudio() {
    if (!_audioBlob) return;

    var td = _today();
    var last = _data.lastPracticeDate;
    var gap = last ? _dateDiff(last, td) : 999;

    // determine status
    var status;
    if (gap <= 0) {
      status = 'done'; // same day (shouldn't happen, but safe)
    } else if (gap === 1) {
      // consecutive
      var streak = _calcStreak();
      status = streak >= 3 ? 'streak' : 'done';
    } else if (!last) {
      status = 'done'; // first time ever
    } else {
      status = 'resumed'; // came back after break
    }

    _data.currentStep = Math.min(_data.currentStep + 1, _data.settings.totalSteps);
    _data.history[td] = { step: _data.currentStep, status: status };
    _data.lastPracticeDate = td;
    _save();

    // save audio to IndexedDB
    _idbPut(td, _audioBlob).catch(function() {});

    _audioBlob = null;
    _audioUrl = null;
    App.refresh();
  }

  function playToday() {
    var td = _today();
    _idbGet(td).then(function(blob) {
      if (blob) {
        var url = URL.createObjectURL(blob);
        var audio = new Audio(url);
        audio.play();
        audio.onended = function() { URL.revokeObjectURL(url); };
      } else {
        alert('未找到今天的录音');
      }
    });
  }

  /* ══════════ Main render ══════════ */
  function render() {
    _load();
    var s = _data.settings;
    var streak = _calcStreak();
    var totalDone = _totalDone();
    var pct = s.totalSteps === 0 ? 0 : Math.round(_data.currentStep / s.totalSteps * 100);

    var html = '<div class="page-header"><h2>' + escapeHtml(s.routeName) + '</h2>' +
      '<div class="header-actions">' +
        '<button class="btn" onclick="Speaking.showSettings()">⚙ 设置</button>' +
      '</div></div>';

    // stats bar
    html += '<div class="spk-stats">' +
      '<div class="spk-stat">' +
        (streak > 0 ? '<span class="spk-fire">🔥</span> 连续 <strong>' + streak + '</strong> 天' : '开始你的第一天！') +
      '</div>' +
      '<div class="spk-stat">当前第 <strong>' + _data.currentStep + '</strong> / ' + s.totalSteps + ' 格</div>' +
      '<div class="spk-stat">累计完成 <strong>' + totalDone + '</strong> 天</div>' +
      '</div>';

    // progress bar
    html += '<div class="spk-progress"><div class="spk-progress-bar"><div class="spk-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="spk-progress-pct">' + pct + '%</span></div>';

    // staircase
    html += _renderStaircase();

    // practice area
    html += _renderPractice();

    // milestones
    html += _renderMilestones();

    // history
    html += _renderHistory();

    html += '<div class="page-foot">每天一小步，口语大进步</div>';

    return html;
  }

  function bind() {}

  return {
    render: render, bind: bind,
    showSettings: showSettings,
    startRecord: startRecord, stopRecord: stopRecord,
    handleUpload: handleUpload, discardAudio: discardAudio, submitAudio: submitAudio,
    playToday: playToday
  };
})();
