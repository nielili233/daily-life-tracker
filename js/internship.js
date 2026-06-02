window.Internship = (function() {
  var editMode = false;
  var PLATFORMS = ['实习僧', 'Boss直聘', '智联招聘', '前程无忧'];

  function render() {
    var rows = Store.getInternshipTargets();
    var done = Store.getInternshipDone();
    var td = Store.today();

    var colTotals = [0, 0, 0, 0];
    var grand = 0, doneCount = 0, cellCount = 0;

    var bodyHtml = rows.map(function(r, ri) {
      var rowSum = 0, rowDone = 0;
      var cells = r.vals.map(function(v, ci) {
        v = Number(v) || 0;
        rowSum += v;
        colTotals[ci] += v;
        cellCount++;
        var isDone = !!done.cells[ri + '-' + ci];
        if (isDone) { doneCount++; rowDone++; }
        if (editMode) {
          return '<td class="intern-cell edit">' +
            '<input type="number" min="0" value="' + v + '" ' +
            'onchange="Internship.editVal(' + ri + ',' + ci + ',this.value)"></td>';
        }
        return '<td class="intern-cell' + (isDone ? ' done' : '') + '" ' +
          'onclick="Internship.toggle(' + ri + ',' + ci + ')">' + v + '</td>';
      }).join('');
      grand += rowSum;
      var rowAllDone = r.vals.length > 0 && rowDone === r.vals.length;
      return '<tr>' +
        '<td class="intern-dir">' + escapeHtml(r.dir) + '</td>' +
        cells +
        '<td class="intern-total' + (rowAllDone ? ' done' : '') + '">' + rowSum + '</td>' +
        '</tr>';
    }).join('');

    var headHtml = '<tr><th class="intern-dir">简历方向</th>' +
      PLATFORMS.map(function(p) { return '<th>' + p + '</th>'; }).join('') +
      '<th>每日合计</th></tr>';

    var footHtml = '<tr class="intern-foot">' +
      '<td class="intern-dir">平台合计</td>' +
      colTotals.map(function(t) { return '<td>' + t + '</td>'; }).join('') +
      '<td class="intern-grand">' + grand + '</td>' +
      '</tr>';

    var pct = cellCount === 0 ? 0 : Math.round(doneCount / cellCount * 100);

    return '<div class="page-header"><div><h2>找实习 · 每日投递计划</h2>' +
        '<div class="subtitle">' + td + ' · 今日完成 ' + doneCount + '/' + cellCount + ' 项 (' + pct + '%)</div></div>' +
        '<div class="header-actions">' +
          '<button class="btn' + (editMode ? ' btn-primary' : '') + '" onclick="Internship.toggleEdit()">' +
            (editMode ? '完成编辑' : '改数字') + '</button>' +
          (editMode ? '' : '<button class="btn" onclick="Internship.resetToday()">重置今日</button>') +
        '</div>' +
      '</div>' +
      '<div class="card intern-card">' +
        '<div class="intern-scroll"><table class="intern-table">' +
          '<thead>' + headHtml + '</thead>' +
          '<tbody>' + bodyHtml + '</tbody>' +
          '<tfoot>' + footHtml + '</tfoot>' +
        '</table></div>' +
      '</div>' +
      '<div class="page-foot">' +
        (editMode
          ? '改完点「完成编辑」保存 · 合计会自动重算'
          : '点一下数字 = 当天投完，会变成酒红 · 每天零点自动清空，第二天重新开始') +
      '</div>';
  }

  function bind() {}

  function toggle(ri, ci) {
    if (editMode) return;
    Store.toggleInternshipCell(ri, ci);
    App.refresh();
  }

  function editVal(ri, ci, val) {
    Store.setInternshipVal(ri, ci, val);
  }

  function toggleEdit() {
    editMode = !editMode;
    App.refresh();
  }

  function resetToday() {
    if (!confirm('确认清空今天所有完成标记吗？\n\n（只清掉今天的打勾，目标数字不变）')) return;
    Store.resetInternshipDone();
    App.refresh();
  }

  return {
    render: render, bind: bind,
    toggle: toggle, editVal: editVal, toggleEdit: toggleEdit, resetToday: resetToday
  };
})();
