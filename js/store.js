window.escapeHtml = function(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

window.CAT_COLORS = {
  '饮食': '#7a2340',
  '购物': '#8a6aaa',
  '房租': '#4a7a9a',
  '工作': '#4a8a62',
  '娱乐': '#a0844e',
  '交通': '#9a6a3a',
  '宠物': '#8a4a60',
  '社交': '#3a8a7a'
};

window.renderPie = function(records, size) {
  var exps = records.filter(function(r) { return r.type === 'expense'; });
  if (exps.length === 0) return '';
  var catT = {};
  exps.forEach(function(r) { catT[r.category] = (catT[r.category] || 0) + r.amount; });
  var data = Object.keys(catT).map(function(c) {
    return { label: c, value: catT[c], color: CAT_COLORS[c] || '#d1d5db' };
  }).sort(function(a, b) { return b.value - a.value; });
  var total = data.reduce(function(s, d) { return s + d.value; }, 0);
  if (total === 0) return '';
  var cx = size / 2, cy = size / 2, R = size * 0.38;
  var sa = -Math.PI / 2, paths = '';
  data.forEach(function(d) {
    var ang = (d.value / total) * 2 * Math.PI;
    if (ang < 0.005) return;
    var ea = sa + ang;
    if (data.length === 1) {
      paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + d.color + '"/>';
    } else {
      var la = ang > Math.PI ? 1 : 0;
      paths += '<path d="M' + cx + ',' + cy + ' L' + (cx + R * Math.cos(sa)).toFixed(1) + ',' + (cy + R * Math.sin(sa)).toFixed(1) +
        ' A' + R + ',' + R + ' 0 ' + la + ',1 ' + (cx + R * Math.cos(ea)).toFixed(1) + ',' + (cy + R * Math.sin(ea)).toFixed(1) + ' Z" fill="' + d.color + '"/>';
    }
    sa = ea;
  });
  var legend = data.map(function(d) {
    var pct = Math.round(d.value / total * 100);
    return '<div class="pie-item"><span class="pie-dot" style="background:' + d.color + '"></span>' +
      '<span class="pie-name">' + d.label + '</span><span class="pie-val">' + pct + '% &yen;' + d.value.toFixed(0) + '</span></div>';
  }).join('');
  return '<div class="pie-wrap">' +
    '<svg class="pie-svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' + paths + '</svg>' +
    '<div class="pie-legend">' + legend + '</div></div>';
};

/* ══════════ Firebase Setup ══════════ */
var _docRef = null;

function _syncUI(text, cls) {
  var el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'sync-status' + (cls ? ' ' + cls : '');
}

if (typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp({
      apiKey: "AIzaSyAC3CrP33NTWso3V1pLC4ytAmESX7QY9iE",
      authDomain: "daily-life-tracker-54ce8.firebaseapp.com",
      projectId: "daily-life-tracker-54ce8",
      storageBucket: "daily-life-tracker-54ce8.firebasestorage.app",
      messagingSenderId: "856154387721",
      appId: "1:856154387721:web:7accb66d5f5941e6facfd8"
    });
    var _db = firebase.firestore();
    _docRef = _db.collection('sync').doc('data');
    _db.enablePersistence().catch(function() {});
  } catch (e) {
    _syncUI('连接失败', 'err');
  }
} else {
  setTimeout(function() { _syncUI('离线模式（Firebase 未加载）', 'err'); }, 500);
}

/* ══════════ Store ══════════ */
window.Store = (function() {
  var KEYS = { schedules: 'dlt_schedules', finances: 'dlt_finances', goals: 'dlt_goals', notes: 'dlt_notes' };

  function _get(k) { return JSON.parse(localStorage.getItem(k) || '[]'); }

  function _set(k, d) {
    localStorage.setItem(k, JSON.stringify(d));
    if (_docRef) _pushToCloud();
  }

  var _pushTimer = null;
  function _pushToCloud() {
    clearTimeout(_pushTimer);
    _pushTimer = setTimeout(function() {
      _docRef.set({
        schedules: _get(KEYS.schedules),
        finances: _get(KEYS.finances),
        goals: _get(KEYS.goals),
        notes: _get(KEYS.notes)
      }).then(function() {
        _syncUI('已同步 ✓', 'ok');
      }).catch(function() {
        _syncUI('同步失败', 'err');
      });
    }, 500);
  }

  if (_docRef) {
    _docRef.onSnapshot(function(snap) {
      _syncUI('已同步 ✓', 'ok');
      if (!snap.exists) {
        var hasLocal = localStorage.getItem(KEYS.schedules) || localStorage.getItem(KEYS.finances) ||
          localStorage.getItem(KEYS.goals) || localStorage.getItem(KEYS.notes);
        if (hasLocal) _pushToCloud();
        return;
      }
      var data = snap.data();
      var changed = false;
      ['schedules', 'finances', 'goals', 'notes'].forEach(function(k) {
        var remote = JSON.stringify(data[k] || []);
        if (localStorage.getItem(KEYS[k]) !== remote) {
          localStorage.setItem(KEYS[k], remote);
          changed = true;
        }
      });
      if (changed && window.App && App.current) App.refresh();
    }, function(err) {
      _syncUI('同步失败: ' + err.code, 'err');
    });
  }

  function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function formatDate(d) {
    if (typeof d === 'string') d = new Date(d + 'T00:00:00');
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function getWeekRange(ds) {
    var d = new Date(ds + 'T00:00:00'), day = d.getDay(), diff = day === 0 ? 6 : day - 1;
    var mon = new Date(d); mon.setDate(d.getDate() - diff);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: formatDate(mon), end: formatDate(sun) };
  }
  function getMonthRange(ds) {
    var d = new Date(ds + 'T00:00:00');
    return { start: formatDate(new Date(d.getFullYear(), d.getMonth(), 1)), end: formatDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }

  function getSchedules(date) { return _get(KEYS.schedules).filter(function(s) { return s.date === date; }); }
  function getScheduleById(id) { return _get(KEYS.schedules).find(function(s) { return s.id === id; }); }
  function addSchedule(item) { var all = _get(KEYS.schedules); all.push(Object.assign({}, item, { id: genId(), completed: false })); _set(KEYS.schedules, all); }
  function updateSchedule(id, u) { var all = _get(KEYS.schedules); var i = all.findIndex(function(s) { return s.id === id; }); if (i >= 0) { Object.assign(all[i], u); _set(KEYS.schedules, all); } }
  function deleteSchedule(id) { _set(KEYS.schedules, _get(KEYS.schedules).filter(function(s) { return s.id !== id; })); }

  function getFinances(st, en) {
    var all = _get(KEYS.finances);
    if (!st && !en) return all.sort(function(a, b) { return b.date.localeCompare(a.date); });
    return all.filter(function(f) { return (!st || f.date >= st) && (!en || f.date <= en); }).sort(function(a, b) { return b.date.localeCompare(a.date); });
  }
  function getFinanceById(id) { return _get(KEYS.finances).find(function(f) { return f.id === id; }); }
  function addFinance(item) { var all = _get(KEYS.finances); all.push(Object.assign({}, item, { id: genId() })); _set(KEYS.finances, all); }
  function updateFinance(id, u) { var all = _get(KEYS.finances); var i = all.findIndex(function(f) { return f.id === id; }); if (i >= 0) { Object.assign(all[i], u); _set(KEYS.finances, all); } }
  function deleteFinance(id) { _set(KEYS.finances, _get(KEYS.finances).filter(function(f) { return f.id !== id; })); }

  function getGoals() { return _get(KEYS.goals); }
  function addGoal(title, deadline) { var all = _get(KEYS.goals); all.push({ id: genId(), title: title, deadline: deadline || '', subGoals: [], createdAt: new Date().toISOString() }); _set(KEYS.goals, all); }
  function updateGoal(id, u) { var all = _get(KEYS.goals); var i = all.findIndex(function(g) { return g.id === id; }); if (i >= 0) { Object.assign(all[i], u); _set(KEYS.goals, all); } }
  function deleteGoal(id) { _set(KEYS.goals, _get(KEYS.goals).filter(function(g) { return g.id !== id; })); }
  function addSubGoal(gid, title, deadline) {
    var all = _get(KEYS.goals), g = all.find(function(x) { return x.id === gid; });
    if (g) { g.subGoals.push({ id: genId(), title: title, deadline: deadline || '', completed: false }); _set(KEYS.goals, all); }
  }
  function updateSubGoal(gid, sid, u) {
    var all = _get(KEYS.goals), g = all.find(function(x) { return x.id === gid; });
    if (g) { var s = g.subGoals.find(function(x) { return x.id === sid; }); if (s) { Object.assign(s, u); _set(KEYS.goals, all); } }
  }
  function deleteSubGoal(gid, sid) {
    var all = _get(KEYS.goals), g = all.find(function(x) { return x.id === gid; });
    if (g) { g.subGoals = g.subGoals.filter(function(x) { return x.id !== sid; }); _set(KEYS.goals, all); }
  }

  function getNotes(date) {
    var all = _get(KEYS.notes);
    if (!date) return all.sort(function(a, b) { return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt); });
    return all.filter(function(n) { return n.date === date; }).sort(function(a, b) { return b.createdAt.localeCompare(a.createdAt); });
  }
  function getNoteById(id) { return _get(KEYS.notes).find(function(n) { return n.id === id; }); }
  function addNote(item) { var all = _get(KEYS.notes); all.push(Object.assign({}, item, { id: genId(), createdAt: new Date().toISOString() })); _set(KEYS.notes, all); }
  function updateNote(id, u) { var all = _get(KEYS.notes); var i = all.findIndex(function(n) { return n.id === id; }); if (i >= 0) { Object.assign(all[i], u); _set(KEYS.notes, all); } }
  function deleteNote(id) { _set(KEYS.notes, _get(KEYS.notes).filter(function(n) { return n.id !== id; })); }

  return {
    today: today, formatDate: formatDate, getWeekRange: getWeekRange, getMonthRange: getMonthRange,
    getSchedules: getSchedules, getScheduleById: getScheduleById, addSchedule: addSchedule, updateSchedule: updateSchedule, deleteSchedule: deleteSchedule,
    getFinances: getFinances, getFinanceById: getFinanceById, addFinance: addFinance, updateFinance: updateFinance, deleteFinance: deleteFinance,
    getGoals: getGoals, addGoal: addGoal, updateGoal: updateGoal, deleteGoal: deleteGoal, addSubGoal: addSubGoal, updateSubGoal: updateSubGoal, deleteSubGoal: deleteSubGoal,
    getNotes: getNotes, getNoteById: getNoteById, addNote: addNote, updateNote: updateNote, deleteNote: deleteNote
  };
})();
