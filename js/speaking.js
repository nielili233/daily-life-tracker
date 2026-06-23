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

  /* ══════════ Render: Staircase (side-view) ══════════ */
  function _renderStaircase() {
    if (!_data || !_data.settings) return '';
    var total = _data.settings.totalSteps;
    var cur = _data.currentStep;

    // dimensions
    var stepW = window.innerWidth <= 600 ? 36 : 52;
    var stepH = 22;
    var gap = window.innerWidth <= 600 ? 4 : 6;

    var containerW = (stepW + gap) * total + 40;
    var containerH = stepH * total + 60;

    var html = '<div class="spk-staircase">';
    html += '<div class="spk-staircase-scroll" style="width:' + containerW + 'px;height:' + containerH + 'px">';

    for (var i = 1; i <= total; i++) {
      // determine status
      var status = 'future';
      var dateForStep = '';
      for (var date in _data.history) {
        if (_data.history[date].step === i) {
          status = _data.history[date].status;
          dateForStep = date;
          break;
        }
      }

      var left = (i - 1) * (stepW + gap);
      var bottom = (i - 1) * stepH;
      var isCurrent = (i === cur);

      // step block
      html += '<div class="spk-stair spk-stair-' + status + (isCurrent ? ' spk-stair-current' : '') + '" ' +
        'style="left:' + left + 'px;bottom:' + bottom + 'px;width:' + stepW + 'px;height:' + stepH + 'px" ' +
        'title="' + (dateForStep || '第' + i + '格') + '">' +
        '<span class="spk-stair-num">' + i + '</span></div>';

      // character on current step
      if (isCurrent) {
        html += '<div class="spk-character" style="left:' + (left + stepW / 2 - 14) + 'px;bottom:' + (bottom + stepH + 2) + 'px">' +
          '<svg viewBox="0 0 28 44" width="28" height="44">' +
            '<circle cx="14" cy="7" r="6" fill="var(--wine)" stroke="#ede4d8" stroke-width="1.5"/>' +
            '<ellipse cx="14" cy="8.5" rx="2.5" ry="1" fill="#ede4d8" opacity="0.6"/>' +
            '<rect x="8" y="14" width="12" height="14" rx="4" fill="var(--wine)"/>' +
            '<rect x="10" y="14" width="8" height="5" rx="2" fill="#ede4d8" opacity="0.25"/>' +
            '<line x1="10" y1="28" x2="7" y2="40" stroke="var(--wine)" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="18" y1="28" x2="21" y2="40" stroke="var(--wine)" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line x1="8" y1="18" x2="3" y2="26" stroke="var(--wine)" stroke-width="2" stroke-linecap="round"/>' +
            '<line x1="20" y1="18" x2="25" y2="14" stroke="var(--wine)" stroke-width="2" stroke-linecap="round"/>' +
            '<circle cx="25" cy="13" r="2" fill="#e8c840"/>' +
          '</svg></div>';
      }
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
      '<div class="form-actions">' +
        '<button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
        '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('spk-settings-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      _data.settings.routeName = fd.get('routeName') || _data.settings.routeName;
      _data.settings.totalSteps = parseInt(fd.get('totalSteps')) || 30;
      _data.settings.practiceStandard = fd.get('practiceStandard') || _data.settings.practiceStandard;
      _data.settings.reminderTime = fd.get('reminderTime') || '20:00';
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
