window.Goals = (function() {

  function _dlHtml(dl, cls) {
    if (!dl) return '';
    return '<span class="' + cls + '">' + escapeHtml(dl) + '</span>';
  }

  function render() {
    var goals = Store.getGoals();

    var listHtml = '';
    if (goals.length === 0) {
      listHtml = '<p class="empty">暂无目标</p>';
    } else {
      listHtml = goals.map(function(g) {
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
              '<button class="btn-icon" onclick="Goals.showEditGoal(\'' + g.id + '\')">编辑</button>' +
              '<button class="btn-icon danger" onclick="Goals.removeGoal(\'' + g.id + '\')">删除</button>' +
            '</div></div>' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="sub-list">' + subsHtml +
            '<button class="btn-add-sub" onclick="Goals.showAddSub(\'' + g.id + '\')">+ 添加小目标</button>' +
          '</div></div>';
      }).join('');
    }

    return '<div class="page-header"><h2>总计划</h2>' +
      '<button class="btn btn-primary" onclick="Goals.showAddGoal()">添加目标</button></div>' +
      '<div>' + listHtml + '</div>' +
      '<div class="page-foot">每个大目标，都从一个小目标开始</div>';
  }

  function bind() {}

  function showAddGoal() {
    Modal.show(
      '<h3>添加大目标</h3><form id="goal-form">' +
      '<div class="form-group"><label>目标名称</label><input type="text" name="title" required placeholder="例如：投简历实习"></div>' +
      '<div class="form-group"><label>截止时间</label><input type="text" name="deadline" placeholder="例如：6月底、下周五、不急（可不填）"></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('goal-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.addGoal(fd.get('title'), fd.get('deadline') || '');
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
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('goal-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.updateGoal(id, { title: fd.get('title'), deadline: fd.get('deadline') || '' });
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
    showAddSub: showAddSub, showEditSub: showEditSub, toggleSub: toggleSub, removeSub: removeSub
  };
})();
