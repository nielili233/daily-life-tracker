window.Finance = (function() {
  var CATS = ['饮食', '健康', '护肤', '房租', '工作', '娱乐', '交通', '宠物', '社交', '学习', '服饰', '生活用品', '其他'];
  var METHODS = ['现金', '支付宝', '微信', '银行卡', '信用卡'];
  var MODES = { daily: '每日', weekly: '每周', monthly: '每月', all: '全部', custom: '自定义' };

  var filterMode = 'daily';
  var filterDate = Store.today();
  var customStart = Store.today();
  var customEnd = Store.today();

  function getRange() {
    switch (filterMode) {
      case 'daily': return { start: filterDate, end: filterDate };
      case 'weekly': return Store.getWeekRange(filterDate);
      case 'monthly': return Store.getMonthRange(filterDate);
      case 'all': return { start: null, end: null };
      case 'custom': return { start: customStart, end: customEnd };
    }
  }

  function render() {
    var range = getRange();
    var records = Store.getFinances(range.start, range.end);
    var totalIn = 0, totalOut = 0;
    records.forEach(function(r) { if (r.type === 'income') totalIn += r.amount; else totalOut += r.amount; });
    var bal = totalIn - totalOut;

    var dateInput = '';
    if (filterMode !== 'all' && filterMode !== 'custom') {
      dateInput = '<input type="date" id="fin-date" value="' + filterDate + '" class="date-input">';
    }
    if (filterMode === 'custom') {
      dateInput = '<div class="custom-range"><input type="date" id="fin-start" value="' + customStart + '" class="date-input">' +
        '<span>至</span><input type="date" id="fin-end" value="' + customEnd + '" class="date-input"></div>';
    }

    var tabs = Object.keys(MODES).map(function(m) {
      return '<button class="filter-tab' + (filterMode === m ? ' active' : '') + '" onclick="Finance.setFilter(\'' + m + '\')">' + MODES[m] + '</button>';
    }).join('');

    var pieHtml = renderPie(records, 150);

    var listHtml = '';
    if (records.length === 0) {
      listHtml = '<p class="empty">暂无记录</p>';
    } else {
      listHtml = records.map(function(r) {
        var sign = r.type === 'income' ? '+' : '-';
        return '<div class="card fin-item">' +
          '<div class="fin-dot ' + r.type + '">' + sign + '</div>' +
          '<div class="fin-info"><div class="fin-cat">' + r.category + '</div>' +
            '<div class="fin-meta">' + r.date + ' &middot; ' + r.paymentMethod + (r.note ? ' &middot; ' + escapeHtml(r.note) : '') + '</div></div>' +
          '<div class="fin-amt ' + r.type + '">' + sign + '&yen;' + r.amount.toFixed(2) + '</div>' +
          '<div class="fin-actions">' +
            '<button class="btn-icon" onclick="Finance.showEdit(\'' + r.id + '\')">编辑</button>' +
            '<button class="btn-icon danger" onclick="Finance.remove(\'' + r.id + '\')">删除</button>' +
          '</div></div>';
      }).join('');
    }

    return '<div class="page-header"><h2>收支记录</h2>' +
      '<button class="btn btn-primary" onclick="Finance.showAdd()">添加</button></div>' +
      '<div class="filter-bar"><div class="filter-tabs">' + tabs + '</div>' + dateInput + '</div>' +
      '<div class="sum-cards">' +
        '<div class="sum-card income"><div class="sum-label">总收入</div><div class="sum-val">&yen;' + totalIn.toFixed(2) + '</div></div>' +
        '<div class="sum-card expense"><div class="sum-label">总支出</div><div class="sum-val">&yen;' + totalOut.toFixed(2) + '</div></div>' +
        '<div class="sum-card ' + (bal >= 0 ? 'pos' : 'neg') + '"><div class="sum-label">结余</div><div class="sum-val">&yen;' + bal.toFixed(2) + '</div></div>' +
      '</div>' +
      pieHtml +
      '<div>' + listHtml + '</div>' +
      '<div class="page-foot">清楚每一笔，心里才踏实</div>';
  }

  function bind() {
    var d = document.getElementById('fin-date');
    if (d) d.addEventListener('change', function(e) { filterDate = e.target.value; App.refresh(); });
    var s = document.getElementById('fin-start');
    if (s) s.addEventListener('change', function(e) { customStart = e.target.value; App.refresh(); });
    var ed = document.getElementById('fin-end');
    if (ed) ed.addEventListener('change', function(e) { customEnd = e.target.value; App.refresh(); });
  }

  function setFilter(mode) { filterMode = mode; App.refresh(); }

  function _catOpts(sel) { return CATS.map(function(c) { return '<option value="' + c + '"' + (c === sel ? ' selected' : '') + '>' + c + '</option>'; }).join(''); }
  function _methodOpts(sel) { return METHODS.map(function(m) { return '<option value="' + m + '"' + (m === sel ? ' selected' : '') + '>' + m + '</option>'; }).join(''); }

  function _form(title, v) {
    v = v || {};
    return '<h3>' + title + '</h3><form id="fin-form">' +
      '<div class="form-group"><label>类型</label><div class="radio-group">' +
        '<label><input type="radio" name="type" value="expense"' + (v.type !== 'income' ? ' checked' : '') + '> 支出</label>' +
        '<label><input type="radio" name="type" value="income"' + (v.type === 'income' ? ' checked' : '') + '> 收入</label></div></div>' +
      '<div class="form-group"><label>日期</label><input type="date" name="date" value="' + (v.date || Store.today()) + '" required></div>' +
      '<div class="form-group"><label>金额</label><input type="number" name="amount" step="0.01" min="0.01" value="' + (v.amount || '') + '" required placeholder="0.00"></div>' +
      '<div class="form-group"><label>分类</label><select name="category" required>' + _catOpts(v.category) + '</select></div>' +
      '<div class="form-group"><label>支付方式</label><select name="paymentMethod" required>' + _methodOpts(v.paymentMethod) + '</select></div>' +
      '<div class="form-group"><label>备注</label><input type="text" name="note" value="' + escapeHtml(v.note || '') + '" placeholder="可选"></div>' +
      '<div class="form-actions"><button type="button" class="btn" onclick="Modal.hide()">取消</button>' +
      '<button type="submit" class="btn btn-primary">保存</button></div></form>';
  }

  function _read(e) {
    var fd = new FormData(e.target);
    return { date: fd.get('date'), amount: parseFloat(fd.get('amount')), type: fd.get('type'), category: fd.get('category'), paymentMethod: fd.get('paymentMethod'), note: fd.get('note') || '' };
  }

  function showAdd() {
    Modal.show(_form('添加记录'));
    document.getElementById('fin-form').onsubmit = function(e) { e.preventDefault(); Store.addFinance(_read(e)); Modal.hide(); App.refresh(); };
  }

  function showEdit(id) {
    var r = Store.getFinanceById(id);
    if (!r) return;
    Modal.show(_form('编辑记录', r));
    document.getElementById('fin-form').onsubmit = function(e) { e.preventDefault(); Store.updateFinance(id, _read(e)); Modal.hide(); App.refresh(); };
  }

  function remove(id) { Store.deleteFinance(id); App.refresh(); }

  return { render: render, bind: bind, setFilter: setFilter, showAdd: showAdd, showEdit: showEdit, remove: remove };
})();
