window.Goals = (function() {
  var showArchived = false;

  function _dlHtml(dl, cls) {
    if (!dl) return '';
    return '<span class="' + cls + '">' + escapeHtml(dl) + '</span>';
  }

  function _daysBetween(a, b) {
    var d1 = new Date(a), d2 = new Date(b);
    return Math.round((d2 - d1) / 86400000);
  }

  function _startDate(g) {
    if (g.startDate) return g.startDate;
    if (g.createdAt) return g.createdAt.slice(0, 10);
    return '';
  }

  function _renderActiveGoal(g) {
    var total = g.subGoals.length;
    var done = g.subGoals.filter(function(s) { return s.completed; }).length;
    var pct = total === 0 ? 0 : Math.round(done / total * 100);

    var subsHtml = g.subGoals.map(function(s) {
      return '<div class="sub-item' + (s.completed ? ' done' : '') + '">' +
        '<div class="sub-check" onclick="Goals.toggleSub(\'' + g.id + '\',\'' + s.id + '\')">' + (s.completed ? '&#10003;' : '') + '</div>' +
        '<span class="sub-title">' + escapeHtml(s.title) + '</span>' +
        _dlHtml(s.deadline, 'sub-deadline') +
        '<div class="sub-actions">' +
          '<button class="btn-icon small" onclick="Goals.showEditSub(\'' + g.id + '\',\'' + s.id + '\')">编辑</button>' +
          '<button class="btn-icon small danger" onclick="Goals.removeSub(\'' + g.id + '\',\'' + s.id + '\')">删除</button>' +
        '</div></div>';
    }).join('');

    return '<div class="card goal-card">' +
      '<div class="goal-head"><div>' +
        '<h3>' + escapeHtml(g.title) + '</h3>' +
        _dlHtml(g.deadline, 'goal-deadline') +
        '<div class="goal-prog">' + done + '/' + total + ' (' + pct + '%)</div></div>' +
        '<div class="goal-head-actions">' +
          '<button class="btn-icon" onclick="Goals.markComplete(\'' + g.id + '\')">标记完成</button>' +
          '<button class="btn-icon" onclick="Goals.showEditGoal(\'' + g.id + '\')">编辑</button>' +
          '<button class="btn-icon danger" onclick="Goals.removeGoal(\'' + g.id + '\')">删除</button>' +
        '</div></div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="sub-list">' + subsHtml +
        '<button class="btn-add-sub" onclick="Goals.showAddSub(\'' + g.id + '\')">+ 添加小目标</button>' +
      '</div></div>';
  }

  function _renderArchivedGoal(g) {
    var total = g.subGoals.length;
    var done = g.subGoals.filter(function(s) { return s.completed; }).length;
    var start = _startDate(g);
    var end = g.completedAt || '';
    var daysText = '';
    if (start && end) {
      var days = _daysBetween(start, end);
      daysText = start + ' — ' + end + '，用时 ' + days + ' 天';
    }

    var subsHtml = g.subGoals.map(function(s) {
      return '<div class="sub-item' + (s.completed ? ' done' : '') + '">' +
        '<div class="sub-check">' + (s.completed ? '&#10003;' : '') + '</div>' +
        '<span class="sub-title">' + escapeHtml(s.title) + '</span>' +
        _dlHtml(s.deadline, 'sub-deadline') +
        '</div>';
    }).join('');

    return '<div class="card goal-card archived">' +
      '<div class="goal-head"><div>' +
        '<h3>' + escapeHtml(g.title) + '</h3>' +
        (daysText ? '<div class="goal-duration">' + daysText + '</div>' : '') +
        (g.deadline ? '<div class="goal-deadline">截止: ' + escapeHtml(g.deadline) + '</div>' : '') +
        '<div class="goal-prog">' + done + '/' + total + ' 已完成</div></div>' +
        '<div class="goal-head-actions">' +
          '<button class="btn-icon" onclick="Goals.restore(\'' + g.id + '\')">恢复</button>' +
        '</div></div>' +
      (subsHtml ? '<div class="sub-list">' + subsHtml + '</div>' : '') +
      '</div>';
  }

  function render() {
    var all = Store.getGoals();
    var active = all.filter(function(g) { return !g.archived; });
    var archived = all.filter(function(g) { return g.archived; });

    var activeHtml = '';
    if (active.length === 0) {
      activeHtml = '<p class="empty">暂无进行中的目标</p>';
    } else {
      activeHtml = active.map(_renderActiveGoal).join('');
    }

    var archivedSection = '';
    if (archived.length > 0) {
      archivedSection = '<div class="archive-toggle" onclick="Goals.toggleArchived()">' +
        (showArchived ? '收起已完成目标 (' + archived.length + ')' : '查看已完成目标 (' + archived.length + ')') +
        '</div>';
      if (showArchived) {
        archivedSection += '<div class="archived-list">' + archived.map(_renderArchivedGoal).join('') + '</div>';
      }
    }

    return '<div class="page-header"><h2>总计划</h2>' +
      '<button class="btn btn-primary" onclick="Goals.showAddGoal()">添加目标</button></div>' +
      '<div>' + activeHtml + '</div>' +
      archivedSection +
      '<div class="page-foot">每个大目标，都从一个小目标开始</div>';
  }

  function bind() {}

  function markComplete(id) {
    var g = Store.getGoals().find(function(x) { return x.id === id; });
    if (!g) return;
    if (!confirm('确认把「' + g.title + '」标记为已完成吗？\n\n完成后会进入已完成目标，不会删除，之后可以恢复。')) return;
    Store.updateGoal(id, { archived: true, completedAt: Store.today() });
    App.refresh();
  }

  function restore(id) {
    Store.updateGoal(id, { archived: false, completedAt: '' });
    App.refresh();
  }

  function toggleArchived() {
    showArchived = !showArchived;
    App.refresh();
  }

  function showAddGoal() {
    Modal.show(
      '<h3>添加大目标</h3><form id="goal-form">' +
      '<div class="form-group"><label>目标名称</label><input type="text" name="title" required placeholder="例如：投简历实习"></div>' +
      '<div class="form-group"><label>截止时间</label><input type="text" name="deadline" placeholder="例如：6月底、下周五、不急（可不填）"></div>' +
      '<div class="form-group"><label>开始时间</label><input type="text" name="startDate" placeholder="可不填，默认用创建日期"></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('goal-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.addGoal(fd.get('title'), fd.get('deadline') || '');
      var goals = Store.getGoals();
      var newest = goals[goals.length - 1];
      if (newest && fd.get('startDate')) {
        Store.updateGoal(newest.id, { startDate: fd.get('startDate') });
      }
      Modal.hide(); App.refresh();
    };
  }

  function showEditGoal(id) {
    var g = Store.getGoals().find(function(x) { return x.id === id; });
    if (!g) return;
    Modal.show(
      '<h3>编辑大目标</h3><form id="goal-form">' +
      '<div class="form-group"><label>目标名称</label><input type="text" name="title" value="' + escapeHtml(g.title) + '" required></div>' +
      '<div class="form-group"><label>截止时间</label><input type="text" name="deadline" value="' + escapeHtml(g.deadline || '') + '" placeholder="可不填"></div>' +
      '<div class="form-group"><label>开始时间</label><input type="text" name="startDate" value="' + escapeHtml(g.startDate || '') + '" placeholder="可不填，默认用创建日期"></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('goal-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.updateGoal(id, { title: fd.get('title'), deadline: fd.get('deadline') || '', startDate: fd.get('startDate') || '' });
      Modal.hide(); App.refresh();
    };
  }

  function removeGoal(id) { Store.deleteGoal(id); App.refresh(); }

  function showAddSub(goalId) {
    Modal.show(
      '<h3>添加小目标</h3><form id="sub-form">' +
      '<div class="form-group"><label>小目标</label><input type="text" name="title" required placeholder="例如：修改通用简历"></div>' +
      '<div class="form-group"><label>截止时间</label><input type="text" name="deadline" placeholder="例如：本周三、月底前（可不填）"></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('sub-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.addSubGoal(goalId, fd.get('title'), fd.get('deadline') || '');
      Modal.hide(); App.refresh();
    };
  }

  function showEditSub(goalId, subId) {
    var g = Store.getGoals().find(function(x) { return x.id === goalId; });
    if (!g) return;
    var s = g.subGoals.find(function(x) { return x.id === subId; });
    if (!s) return;
    Modal.show(
      '<h3>编辑小目标</h3><form id="sub-form">' +
      '<div class="form-group"><label>小目标</label><input type="text" name="title" value="' + escapeHtml(s.title) + '" required></div>' +
      '<div class="form-group"><label>截止时间</label><input type="text" name="deadline" value="' + escapeHtml(s.deadline || '') + '" placeholder="可不填"></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('sub-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.updateSubGoal(goalId, subId, { title: fd.get('title'), deadline: fd.get('deadline') || '' });
      Modal.hide(); App.refresh();
    };
  }

  function toggleSub(goalId, subId) {
    var g = Store.getGoals().find(function(x) { return x.id === goalId; });
    if (!g) return;
    var s = g.subGoals.find(function(x) { return x.id === subId; });
    if (s) { Store.updateSubGoal(goalId, subId, { completed: !s.completed }); App.refresh(); }
  }

  function removeSub(goalId, subId) { Store.deleteSubGoal(goalId, subId); App.refresh(); }

  return {
    render: render, bind: bind,
    showAddGoal: showAddGoal, showEditGoal: showEditGoal, removeGoal: removeGoal,
    showAddSub: showAddSub, showEditSub: showEditSub, toggleSub: toggleSub, removeSub: removeSub,
    markComplete: markComplete, restore: restore, toggleArchived: toggleArchived
  };
})();
