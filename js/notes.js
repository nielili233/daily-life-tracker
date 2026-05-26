window.Notes = (function() {
  var filterMode = 'date';
  var currentDate = Store.today();

  function _renderNote(n) {
    return '<div class="card note-card">' +
      '<div class="note-date">' + n.date + '</div>' +
      '<div class="note-content">' + escapeHtml(n.content) + '</div>' +
      '<div class="note-actions">' +
        '<button class="btn-icon" onclick="Notes.showEdit(\'' + n.id + '\')">编辑</button>' +
        '<button class="btn-icon danger" onclick="Notes.remove(\'' + n.id + '\')">删除</button>' +
      '</div></div>';
  }

  function render() {
    var notes = filterMode === 'all' ? Store.getNotes() : Store.getNotes(currentDate);

    var dateInput = '';
    if (filterMode === 'date') {
      dateInput = '<input type="date" id="notes-date" value="' + currentDate + '" class="date-input">';
    }

    var listHtml = '';
    if (notes.length === 0) {
      listHtml = '<p class="empty">暂无便签</p>';
    } else if (filterMode === 'all') {
      var groups = {};
      notes.forEach(function(n) {
        if (!groups[n.date]) groups[n.date] = [];
        groups[n.date].push(n);
      });
      var sortedDates = Object.keys(groups).sort(function(a, b) { return b.localeCompare(a); });
      listHtml = sortedDates.map(function(date) {
        return '<div class="date-group"><div class="date-group-head">' + date + '</div>' +
          groups[date].map(_renderNote).join('') + '</div>';
      }).join('');
    } else {
      listHtml = notes.map(_renderNote).join('');
    }

    return '<div class="page-header"><h2>便签</h2>' +
      '<button class="btn btn-primary" onclick="Notes.showAdd()">添加</button></div>' +
      '<div class="filter-bar"><div class="filter-tabs">' +
        '<button class="filter-tab' + (filterMode === 'date' ? ' active' : '') + '" onclick="Notes.setFilter(\'date\')">按日期</button>' +
        '<button class="filter-tab' + (filterMode === 'all' ? ' active' : '') + '" onclick="Notes.setFilter(\'all\')">全部</button>' +
      '</div>' + dateInput + '</div>' +
      '<div>' + listHtml + '</div>' +
      '<div class="page-foot">随手记下来的，都是值得留住的</div>';
  }

  function bind() {
    var el = document.getElementById('notes-date');
    if (el) el.addEventListener('change', function(e) { currentDate = e.target.value; App.refresh(); });
  }

  function setFilter(mode) { filterMode = mode; App.refresh(); }

  function showAdd() {
    Modal.show(
      '<h3>添加便签</h3><form id="note-form">' +
      '<div class="form-group"><label>日期</label><input type="date" name="date" value="' + Store.today() + '" required></div>' +
      '<div class="form-group"><label>内容</label><textarea name="content" required placeholder="想法、学到的东西、碎碎念..."></textarea></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('note-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.addNote({ date: fd.get('date'), content: fd.get('content') });
      Modal.hide(); App.refresh();
    };
  }

  function showEdit(id) {
    var n = Store.getNoteById(id);
    if (!n) return;
    Modal.show(
      '<h3>编辑便签</h3><form id="note-form">' +
      '<div class="form-group"><label>日期</label><input type="date" name="date" value="' + n.date + '" required></div>' +
      '<div class="form-group"><label>内容</label><textarea name="content" required>' + escapeHtml(n.content) + '</textarea></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>'
    );
    document.getElementById('note-form').onsubmit = function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      Store.updateNote(id, { date: fd.get('date'), content: fd.get('content') });
      Modal.hide(); App.refresh();
    };
  }

  function remove(id) { Store.deleteNote(id); App.refresh(); }

  return { render: render, bind: bind, setFilter: setFilter, showAdd: showAdd, showEdit: showEdit, remove: remove };
})();
