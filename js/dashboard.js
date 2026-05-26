window.Dashboard = (function() {

  function render() {
    var td = Store.today();
    var schs = Store.getSchedules(td);
    var done = schs.filter(function(s) { return s.completed; }).length;
    var total = schs.length;
    var pct = total === 0 ? 0 : Math.round(done / total * 100);

    var wr = Store.getWeekRange(td);
    var weekRecs = Store.getFinances(wr.start, wr.end);
    var weekExp = weekRecs.filter(function(f) { return f.type === 'expense'; }).reduce(function(s, f) { return s + f.amount; }, 0);

    var mr = Store.getMonthRange(td);
    var monthRecs = Store.getFinances(mr.start, mr.end);
    var monthExp = monthRecs.filter(function(f) { return f.type === 'expense'; }).reduce(function(s, f) { return s + f.amount; }, 0);

    var goals = Store.getGoals().filter(function(g) {
      return g.subGoals.length === 0 || g.subGoals.some(function(s) { return !s.completed; });
    });

    var goalsHtml = '';
    if (goals.length === 0) {
      goalsHtml = '<p class="empty">暂无目标</p>';
    } else {
      goalsHtml = goals.map(function(g) {
        var t = g.subGoals.length;
        var d = g.subGoals.filter(function(s) { return s.completed; }).length;
        var p = t === 0 ? 0 : Math.round(d / t * 100);
        var dlHtml = g.deadline ? '<span class="goal-dl">' + escapeHtml(g.deadline) + '</span>' : '';
        return '<div class="goal-row">' +
          '<div class="goal-row-head"><span>' + escapeHtml(g.title) + dlHtml + '</span><span class="goal-pct">' + p + '%</span></div>' +
          '<div class="progress-bar sm"><div class="progress-fill" style="width:' + p + '%"></div></div>' +
          '</div>';
      }).join('');
    }

    var todayRecs = Store.getFinances(td, td);
    var todayPie = renderPie(todayRecs, 120);
    var monthPie = renderPie(monthRecs, 120);

    var pieRow = '';
    if (todayPie || monthPie) {
      pieRow = '<div class="dash-grid" style="margin-top:14px">';
      if (todayPie) pieRow += '<div class="card dash-card" style="grid-column:span 1"><div class="label">今日支出分布</div>' + todayPie + '</div>';
      if (monthPie) pieRow += '<div class="card dash-card" style="grid-column:span ' + (todayPie ? '2' : '3') + '"><div class="label">本月支出分布</div>' + monthPie + '</div>';
      pieRow += '</div>';
    }

    return '<div class="page-header"><div><h2>首页</h2><div class="subtitle">' + td + '</div></div></div>' +
      '<div class="dash-grid">' +
        '<div class="card dash-card"><div class="label">今日计划完成</div>' +
          '<div><span class="big">' + pct + '%</span><span class="sub">' + done + '/' + total + ' 项</span></div>' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>' +
        '<div class="card dash-card"><div class="label">本周总支出</div>' +
          '<div><span class="big expense">&yen;' + weekExp.toFixed(2) + '</span></div></div>' +
        '<div class="card dash-card"><div class="label">本月总支出</div>' +
          '<div><span class="big expense">&yen;' + monthExp.toFixed(2) + '</span></div></div>' +
        '<div class="card dash-card full"><div class="label">正在推进的目标</div>' + goalsHtml + '</div>' +
      '</div>' + pieRow +
      '<div class="page-foot">记录每一天，让生活更有节奏</div>';
  }

  function bind() {}

  return { render: render, bind: bind };
})();
