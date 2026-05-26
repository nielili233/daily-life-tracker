window.Schedule = (function() {
  var currentDate = Store.today();

  function _goalLabel(s) {
    var parts = [];
    if (s.goalText) parts.push(s.goalText);
    if (s.subGoalText) parts.push(s.subGoalText);
    if (parts.length === 0) return '';
    return '<span class="sch-goal-tag">' + escapeHtml(parts.join(' / ')) + '</span>';
  }

  function render() {
    var items = Store.getSchedules(currentDate);
    var isToday = currentDate === Store.today();

    var listHtml = '';
    if (items.length === 0) {
      listHtml = '<p class="empty">暂无安排</p>';
    } else {
      listHtml = items.map(function(s) {
        var timeHtml = s.time ? '<div class="sch-time">' + escapeHtml(s.time) + '</div>' : '';
        return '<div class="card sch-item' + (s.completed ? ' done' : '') + '">' +
          '<div class="sch-check" onclick="Schedule.toggle(\'' + s.id + '\')">' + (s.completed ? '&#10003;' : '') + '</div>' +
          timeHtml +
          '<div class="sch-title">' + escapeHtml(s.title) + _goalLabel(s) + '</div>' +
          '<div class="sch-actions">' +
            '<button class="btn-icon" onclick="Schedule.showEdit(\'' + s.id + '\')">编辑</button>' +
            '<button class="btn-icon danger" onclick="Schedule.remove(\'' + s.id + '\')">删除</button>' +
          '</div></div>';
      }).join('');
    }

    return '<div class="page-header"><h2>' + (isToday ? '今日安排' : currentDate + ' 安排') + '</h2>' +
      '<div class="header-actions">' +
        '<input type="date" id="sch-date" value="' + currentDate + '" class="date-input">' +
        '<button class="btn btn-primary" onclick="Schedule.showAdd()">添加</button>' +
      '</div></div>' +
      '<div>' + listHtml + '</div>' +
      '<div class="page-foot">把想做的事写下来，一件一件完成</div>';
  }

  function bind() {
    var el = document.getElementById('sch-date');
    if (el) el.addEventListener('change', function(e) { currentDate = e.target.value; App.refresh(); });
  }

  function _formHtml(title, v) {
    v = v || {};
    return '<h3>' + title + '</h3><form id="sch-form">' +
      '<div class="form-group"><label>时间</label>' +
        '<input type="text" name="time" value="' + escapeHtml(v.time || '') + '" placeholder="上午、9点左右、睡前...（可不填）"></div>' +
      '<div class="form-group"><label>事项</label>' +
        '<input type="text" name="title" value="' + escapeHtml(v.title || '') + '" required placeholder="要做什么"></div>' +
      '<div class="form-group"><label>大目标</label>' +
        '<input type="text" name="goalText" value="' + escapeHtml(v.goalText || '') + '" placeholder="可不填"></div>' +
      '<div class="form-group"><label>小目标</label>' +
        '<input type="text" name="subGoalText" value="' + escapeHtml(v.subGoalText || '') + '" placeholder="可不填"></div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
        '<button type="submit" class="btn btn-primary">保存</button></div></form>';
  }

  function _readForm(e) {
    var fd = new FormData(e.target);
    return {
      time: fd.get('time') || '',
      title: fd.get('title'),
      goalText: fd.get('goalText') || '',
      subGoalText: fd.get('subGoalText') || ''
    };
  }

  function showAdd() {
    Modal.show(_formHtml('添加安排'));
    document.getElementById('sch-form').onsubmit = function(e) {
      e.preventDefault();
      var data = _readForm(e);
      data.date = currentDate;
      Store.addSchedule(data);
      Modal.hide(); App.refresh();
    };
  }

  function showEdit(id) {
    var s = Store.getScheduleById(id);
    if (!s) return;
    Modal.show(_formHtml('编辑安排', s));
    document.getElementById('sch-form').onsubmit = function(e) {
      e.preventDefault();
      Store.updateSchedule(id, _readForm(e));
      Modal.hide(); App.refresh();
    };
  }

  function toggle(id) {
    var s = Store.getScheduleById(id);
    if (s) { Store.updateSchedule(id, { completed: !s.completed }); App.refresh(); }
  }

  function remove(id) { Store.deleteSchedule(id); App.refresh(); }

  return { render: render, bind: bind, showAdd: showAdd, showEdit: showEdit, toggle: toggle, remove: remove };
})();
