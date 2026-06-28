/* OUKEI HUB Home UI — Ver1.5.8.32 */
let homeCalView = { y: new Date().getFullYear(), m: new Date().getMonth() };

function ensureRevenueLog() {
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
}

function revenueDateKey(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function todayKey() {
  if (typeof getHomeDemoTodayKey === 'function') {
    let k = getHomeDemoTodayKey();
    if (k) return k;
  }
  let t = getHomeReferenceDate();
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function yesterdayKey() {
  if (typeof getHomeDemoYesterdayKey === 'function') {
    let k = getHomeDemoYesterdayKey();
    if (k) return k;
  }
  let t = getHomeReferenceDate();
  t.setDate(t.getDate() - 1);
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatCalLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function getEnabledHomeProjects() {
  if (typeof getHomeDemoEnabledProjects === 'function') {
    let demo = getHomeDemoEnabledProjects();
    if (demo) return demo;
  }
  let list = [];
  if (settings.useRAM !== false) list.push({ key: 'ram', name: 'RAM', dot: 'ram' });
  if (settings.useORCA) list.push({ key: 'orca', name: 'ORCA', dot: 'orca' });
  if (settings.useCARY) list.push({ key: 'cary', name: 'Cary Pact', dot: 'cary' });
  return list.length ? list : [{ key: 'ram', name: 'RAM', dot: 'ram' }];
}

function defaultRevenueEntry() {
  let s = allOrgSummary();
  return {
    total: s.daily,
    ram: s.daily,
    orca: 0,
    genesis: 0,
    cary: 0,
    savedAt: new Date().toLocaleString()
  };
}

function getHomeReferenceDate() {
  if (typeof getHomeDemoReferenceDate === 'function') {
    let d = getHomeDemoReferenceDate();
    if (d) return d;
  }
  return new Date();
}

function getRevenueEntry(key) {
  if (typeof getHomeDemoRevenueEntry === 'function') {
    let demo = getHomeDemoRevenueEntry(key);
    if (demo !== undefined) return demo;
  }
  ensureRevenueLog();
  return settings.revenueLog[key] || null;
}

function saveRevenueEntry(key, entry) {
  if (typeof isHomeDemoActive === 'function' && isHomeDemoActive()) return;
  ensureRevenueLog();
  settings.revenueLog[key] = entry;
  settings.lastUpdate = new Date().toLocaleString();
  markActivity();
}

function calcInputStreak() {
  ensureRevenueLog();
  let streak = 0;
  let d = new Date();
  let today = todayKey();
  if (!getRevenueEntry(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    let key = revenueDateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (!getRevenueEntry(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcMonthInputDetail() {
  ensureRevenueLog();
  let now = getHomeReferenceDate();
  let y = now.getFullYear();
  let m = now.getMonth();
  let elapsed = now.getDate();
  let filled = 0;
  for (let d = 1; d <= elapsed; d++) {
    if (getRevenueEntry(revenueDateKey(y, m, d))) filled++;
  }
  let rate = elapsed ? Math.round((filled / elapsed) * 100) : 0;
  return { filled: filled, elapsed: elapsed, rate: rate };
}

function calcMonthInputRate() {
  return calcMonthInputDetail().rate;
}

function renderProjectGrid(containerId, projects, getAmount, totalHint) {
  let el = document.getElementById(containerId);
  if (!el) return;
  let n = Math.max(projects.length, 1);
  el.style.setProperty('--proj-cols', n);
  el.setAttribute('data-count', n);
  let amounts = projects.map(function (p) { return getAmount(p); });
  let total = typeof totalHint === 'number' ? totalHint : amounts.reduce(function (s, v) { return s + v; }, 0);
  el.innerHTML = projects.map(function (p, i) {
    let amt = amounts[i];
    let pct = total > 0 ? Math.round((amt / total) * 1000) / 10 : 0;
    return '<div class="homeProjCard homeProjCard--' + p.dot + '">' +
      '<div class="homeProjCardTop"><span class="homeProjCardDot"></span><span class="homeProjCardName">' + p.name + '</span></div>' +
      '<span class="homeProjCardAmt">' + money(amt) + '</span>' +
      '<span class="homeProjCardPct">' + pct + '%</span>' +
      '<div class="homeProjCardBar"><div class="homeProjCardBarFill" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }).join('');
}

function updateHomeInputStats() {
  let streakEl = document.getElementById('homeInputStreak');
  let rateEl = document.getElementById('homeInputRate');
  let detailEl = document.getElementById('homeInputRateDetail');
  let ringEl = document.getElementById('homeInputRateRing');
  let detail = calcMonthInputDetail();
  if (streakEl) streakEl.textContent = calcInputStreak() + '日';
  if (rateEl) rateEl.textContent = detail.rate + '%';
  if (detailEl) detailEl.textContent = detail.filled + ' / ' + detail.elapsed + '日';
  if (ringEl) {
    let c = 2 * Math.PI * 47;
    ringEl.setAttribute('stroke-dasharray', c.toFixed(2));
    ringEl.setAttribute('stroke-dashoffset', (c * (1 - detail.rate / 100)).toFixed(2));
  }
}

function sumMonthRevenueLog(y, m) {
  ensureRevenueLog();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let out = { total: 0, hasLog: false };
  for (let d = 1; d <= daysInMonth; d++) {
    let entry = getRevenueEntry(revenueDateKey(y, m, d));
    if (!entry) continue;
    out.hasLog = true;
    out.total += entry.total || 0;
    Object.keys(entry).forEach(function (k) {
      if (k === 'total' || k === 'savedAt') return;
      out[k] = (out[k] || 0) + (Number(entry[k]) || 0);
    });
  }
  return out;
}

function projectAmountFromEntry(entry, proj) {
  if (!entry) return 0;
  return entry[proj.key] || 0;
}

function fallbackProjectAmount(proj, sAll, mode) {
  if (proj.key === 'ram') return mode === 'monthly' ? sAll.monthly : sAll.daily;
  return 0;
}

function formatCalDayAmount(entry) {
  if (!entry) return '–';
  return money(entry.total || 0);
}

function renderHomeCalendar() {
  if (typeof homeCalendar === 'undefined') return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let first = new Date(y, m, 1);
  let start = first.getDay();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let today = getHomeReferenceDate();
  let weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  let cells = weekdays.map(function (w, i) {
    let cls = 'homeCalDayLabel' + (i === 0 ? ' isSun' : i === 6 ? ' isSat' : '');
    return '<div class="' + cls + '">' + w + '</div>';
  }).join('');

  for (let i = 0; i < start; i++) cells += '<div class="homeCalDay homeCalDay--blank"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    let key = revenueDateKey(y, m, d);
    let entry = getRevenueEntry(key);
    let isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    let cls = ['homeCalDay'];
    if (isToday) cls.push('isToday');
    if (entry) cls.push('isFilled');
    else cls.push('isEmpty');
    let amtCls = entry ? 'homeCalDayAmt' : 'homeCalDayAmt isDash';
    cells += '<button type="button" class="' + cls.join(' ') + '" onclick="showRevenueDayDetail(\'' + key + '\')" aria-label="' + (m + 1) + '月' + d + '日 ' + formatCalDayAmount(entry) + '">' +
      '<span class="homeCalDayNum">' + d + '</span>' +
      '<span class="' + amtCls + '">' + formatCalDayAmount(entry) + '</span></button>';
  }

  homeCalendar.innerHTML =
    '<div class="homeCalShell">' +
    '<div class="homeCalHead">' +
    '<button type="button" class="homeCalNavBtn" onclick="homeCalPrevMonth()" aria-label="前の月">‹</button>' +
    '<div class="homeCalTitle">' + formatCalLabel(y, m) + '</div>' +
    '<button type="button" class="homeCalNavBtn" onclick="homeCalNextMonth()" aria-label="次の月">›</button>' +
    '</div>' +
    '<div class="homeCalGrid">' + cells + '</div>' +
    '<div class="homeCalLegend">' +
    '<span class="homeCalLegendItem"><i class="homeCalLegendMark isToday"></i>今日</span>' +
    '<span class="homeCalLegendItem"><i class="homeCalLegendMark isFilled"></i>入力済み</span>' +
    '<span class="homeCalLegendItem"><i class="homeCalLegendMark isEmpty"></i>未入力</span>' +
    '</div></div>';
}

function homeCalPrevMonth() {
  homeCalView.m--;
  if (homeCalView.m < 0) { homeCalView.m = 11; homeCalView.y--; }
  renderHomeCalendar();
  renderHomeMonthlyLineChart();
  updateHomeMonthlyProjects(typeof allOrgSummary === 'function' ? allOrgSummary() : null);
}

function homeCalNextMonth() {
  homeCalView.m++;
  if (homeCalView.m > 11) { homeCalView.m = 0; homeCalView.y++; }
  renderHomeCalendar();
  renderHomeMonthlyLineChart();
  updateHomeMonthlyProjects(typeof allOrgSummary === 'function' ? allOrgSummary() : null);
}

function formatAxisDollar(n) {
  n = Math.round(n * 100) / 100;
  if (n >= 1000) return '$' + Math.round(n).toLocaleString();
  if (Number.isInteger(n)) return '$' + n;
  return '$' + n.toFixed(1);
}

function niceChartAxisMax(rawMax) {
  if (rawMax <= 0) return 20;
  let padded = rawMax * 1.08;
  let mag = Math.pow(10, Math.floor(Math.log10(padded)));
  let norm = padded / mag;
  let nice = 10;
  if (norm <= 1) nice = 1;
  else if (norm <= 1.2) nice = 1.2;
  else if (norm <= 1.5) nice = 1.5;
  else if (norm <= 2) nice = 2;
  else if (norm <= 2.5) nice = 2.5;
  else if (norm <= 3) nice = 3;
  else if (norm <= 4) nice = 4;
  else if (norm <= 5) nice = 5;
  else if (norm <= 6) nice = 6;
  else if (norm <= 8) nice = 8;
  return nice * mag;
}

function chartAxisTicks(axisMax, steps) {
  steps = steps || 5;
  let ticks = [];
  for (let i = 0; i < steps; i++) ticks.push((axisMax / (steps - 1)) * i);
  return ticks;
}

function chartXLabels(daysInMonth, monthNum) {
  let marks = [1];
  [5, 10, 15, 20, 25, 30].forEach(function (d) {
    if (d <= daysInMonth && d !== 1) marks.push(d);
  });
  if (marks[marks.length - 1] !== daysInMonth) marks.push(daysInMonth);
  return marks.map(function (d) { return { d: d, label: monthNum + '/' + d }; });
}

var HOME_PROJECT_REGISTRY = [
  { key: 'ram', name: 'RAM', cls: 'ram' },
  { key: 'orca', name: 'ORCA', cls: 'orca' },
  { key: 'genesis', name: 'Genesis', cls: 'genesis' },
  { key: 'cary', name: 'Cary Pact', cls: 'cary' }
];

function getHomeProjectRegistry() {
  let list = HOME_PROJECT_REGISTRY.slice();
  (settings.customProjects || []).forEach(function (p) {
    let key = String(p.key || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || list.some(function (x) { return x.key === key; })) return;
    list.push({ key: key, name: p.name || key, cls: 'custom' });
  });
  return list;
}

function getHomeMonthlyRevenueContext(sAll) {
  if (!sAll && typeof allOrgSummary === 'function') sAll = allOrgSummary();
  if (!sAll) return null;
  let y = homeCalView.y;
  let m = homeCalView.m;
  if (typeof getHomeDemoMonthlyOverride === 'function') {
    let demo = getHomeDemoMonthlyOverride(y, m, sAll);
    if (demo) return demo;
  }
  let monthLog = sumMonthRevenueLog(y, m);
  let total = monthLog.hasLog ? monthLog.total : sAll.monthly;
  return { sAll: sAll, monthLog: monthLog, total: total };
}

function getHomeMonthlyProjectRows(ctx) {
  if (!ctx) return [];
  let registry = getHomeProjectRegistry();

  if (ctx.monthLog.hasLog) {
    Object.keys(ctx.monthLog).forEach(function (k) {
      if (k === 'total' || k === 'hasLog') return;
      if (registry.some(function (p) { return p.key === k; })) return;
      if ((ctx.monthLog[k] || 0) <= 0) return;
      registry.push({
        key: k,
        name: k.charAt(0).toUpperCase() + k.slice(1),
        cls: 'custom'
      });
    });
  }

  let entry = ctx.monthLog.hasLog ? ctx.monthLog : null;
  return registry.map(function (p) {
    let amt = entry ? (entry[p.key] || 0) : fallbackProjectAmount(p, ctx.sAll, 'monthly');
    let pct = ctx.total > 0 ? Math.round((amt / ctx.total) * 1000) / 10 : 0;
    return { proj: p, amt: amt, pct: pct };
  }).filter(function (row) { return row.amt > 0; });
}

function updateHomeMonthlySummary(sAll) {
  let ctx = getHomeMonthlyRevenueContext(sAll);
  if (!ctx) return;
  let monthlyEl = document.getElementById('homeMonthly');
  let yenEl = document.getElementById('homeMonthlyYen');
  if (monthlyEl) monthlyEl.textContent = money(ctx.total);
  if (yenEl) yenEl.textContent = yen(ctx.total);
}

function bindMonthlyChartTooltip(container, points, monthNum) {
  let tip = container.querySelector('.homeMonthlyChartTip');
  let svg = container.querySelector('.homeMonthlyChartSvg');
  if (!tip || !svg) return;

  function positionTip(node) {
    let cx = Number(node.getAttribute('cx'));
    let cy = Number(node.getAttribute('cy'));
    let vb = svg.viewBox.baseVal;
    let px = (cx / vb.width) * svg.clientWidth;
    let ratio = cx / vb.width;
    let left;
    if (ratio > 0.82) left = px - tip.offsetWidth + 6;
    else if (ratio < 0.18) left = px - 6;
    else left = px - tip.offsetWidth / 2;
    left = Math.max(4, Math.min(left, svg.clientWidth - tip.offsetWidth - 4));
    let top = ((cy / vb.height) * svg.clientHeight) - tip.offsetHeight - 12;
    tip.style.left = left + 'px';
    tip.style.top = Math.max(4, top) + 'px';
  }

  function showTip(node, p) {
    if (!p) return;
    tip.innerHTML =
      '<span class="homeMonthlyChartTipDate">' + monthNum + '/' + p.d + '</span>' +
      '<span class="homeMonthlyChartTipAmt">' + money(p.val) + '</span>';
    tip.classList.add('isVisible');
    positionTip(node);
    container.querySelectorAll('.homeMonthlyChartDot').forEach(function (d) { d.classList.remove('isActive'); });
    let dot = node.parentNode ? node.parentNode.querySelector('.homeMonthlyChartDot') : null;
    if (dot) dot.classList.add('isActive');
  }

  function hideTip() {
    tip.classList.remove('isVisible');
    container.querySelectorAll('.homeMonthlyChartDot').forEach(function (d) { d.classList.remove('isActive'); });
  }

  container.querySelectorAll('.homeMonthlyChartHit').forEach(function (node) {
    node.addEventListener('mouseenter', function () {
      showTip(node, points[Number(node.getAttribute('data-idx'))]);
    });
    node.addEventListener('mouseleave', hideTip);
  });

  let todayIdx = points.findIndex(function (p) { return p.isToday; });
  if (todayIdx >= 0) {
    let todayHit = container.querySelector('.homeMonthlyChartHit[data-idx="' + todayIdx + '"]');
    if (todayHit) showTip(todayHit, points[todayIdx]);
  }
}

function monthlyChartPlotX(index, daysInMonth, chartLeft, plotPadLeft, plotW) {
  if (daysInMonth <= 1) return chartLeft + plotPadLeft + plotW / 2;
  return chartLeft + plotPadLeft + (index / (daysInMonth - 1)) * plotW;
}

function renderHomeMonthlyLineChart() {
  let el = document.getElementById('homeMonthlyLineChart');
  if (!el) return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let monthNum = m + 1;
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let today = getHomeReferenceDate();
  let vals = [];
  let dataMax = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    let entry = getRevenueEntry(revenueDateKey(y, m, d));
    let val = entry ? (entry.total || 0) : 0;
    vals.push({ d: d, val: val, isToday: today.getFullYear() === y && today.getMonth() === m && today.getDate() === d });
    if (val > dataMax) dataMax = val;
  }

  let axisMax = niceChartAxisMax(dataMax);
  let ticks = chartAxisTicks(axisMax, 5);
  let xMarks = chartXLabels(daysInMonth, monthNum);

  let w = 400;
  let h = 190;
  let yAxisW = 30;
  let padRight = 24;
  let padBottom = 16;
  let padY = 8;
  let plotPadLeft = 4;
  let plotPadRight = 14;
  let chartLeft = yAxisW;
  let innerW = w - chartLeft - padRight;
  let plotW = innerW - plotPadLeft - plotPadRight;
  let innerH = h - padY - padBottom;
  let plotRight = chartLeft + plotPadLeft + plotW;

  let gridSvg = ticks.map(function (t) {
    let yPos = padY + innerH - (t / axisMax) * innerH;
    return '<line class="homeMonthlyChartGrid" x1="' + chartLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + plotRight.toFixed(1) + '" y2="' + yPos.toFixed(1) + '"></line>' +
      '<text class="homeMonthlyChartYLabel" x="' + (chartLeft - 4) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end">' + formatAxisDollar(t) + '</text>';
  }).join('');

  let xSvg = xMarks.map(function (mark) {
    let x = monthlyChartPlotX(mark.d - 1, daysInMonth, chartLeft, plotPadLeft, plotW);
    let anchor = mark.d === 1 ? 'start' : (mark.d === daysInMonth ? 'end' : 'middle');
    return '<text class="homeMonthlyChartXLabel" x="' + x.toFixed(1) + '" y="' + (h - 4) + '" text-anchor="' + anchor + '">' + mark.label + '</text>';
  }).join('');

  let pts = vals.map(function (v, i) {
    let x = monthlyChartPlotX(i, daysInMonth, chartLeft, plotPadLeft, plotW);
    let yPos = padY + innerH - (v.val / axisMax) * innerH;
    return x.toFixed(1) + ',' + yPos.toFixed(1);
  }).join(' ');

  let fillPts = pts + ' ' + plotRight.toFixed(1) + ',' + (padY + innerH).toFixed(1) + ' ' + (chartLeft + plotPadLeft).toFixed(1) + ',' + (padY + innerH).toFixed(1);

  let dots = vals.map(function (v, i) {
    let x = monthlyChartPlotX(i, daysInMonth, chartLeft, plotPadLeft, plotW);
    let yPos = padY + innerH - (v.val / axisMax) * innerH;
    let xf = x.toFixed(1);
    let yf = yPos.toFixed(1);
    let dotR = v.isToday ? 3 : 1.5;
    let cls = v.isToday ? 'homeMonthlyChartDot isToday' : 'homeMonthlyChartDot';
    return '<g class="homeMonthlyChartPoint">' +
      '<circle class="homeMonthlyChartHit" data-idx="' + i + '" cx="' + xf + '" cy="' + yf + '" r="8"></circle>' +
      '<circle class="' + cls + '" cx="' + xf + '" cy="' + yf + '" r="' + dotR + '"></circle></g>';
  }).join('');

  el.innerHTML =
    '<div class="homeMonthlyChartInner">' +
    '<div class="homeMonthlyChartTip"></div>' +
    '<svg class="homeMonthlyChartSvg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs><linearGradient id="homeMonthlyLineGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="rgba(96,165,250,.24)"/>' +
    '<stop offset="100%" stop-color="rgba(96,165,250,0)"/>' +
    '</linearGradient></defs>' +
    gridSvg + xSvg +
    '<polyline class="homeMonthlyChartFill" points="' + fillPts + '"></polyline>' +
    '<polyline class="homeMonthlyChartLine" points="' + pts + '"></polyline>' +
    dots +
    '</svg></div>';

  bindMonthlyChartTooltip(el, vals, monthNum);
}

function renderHomeMonthlyProjGrid(sAll) {
  let el = document.getElementById('homeMonthlyProjGrid');
  if (!el) return;
  let ctx = getHomeMonthlyRevenueContext(sAll);
  if (!ctx) return;

  let rows = getHomeMonthlyProjectRows(ctx);
  let cols = Math.max(rows.length, 1);
  el.style.setProperty('--monthly-proj-cols', cols);
  el.setAttribute('data-count', rows.length);

  if (!rows.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = rows.map(function (row) {
    let p = row.proj;
    return '<div class="homeMonthlyProjCard homeMonthlyProjCard--' + p.cls + '">' +
      '<div class="homeMonthlyProjCardHead">' +
      '<span class="homeMonthlyProjCardName"><span class="homeMonthlyProjDot"></span>' + p.name + '</span>' +
      '<span class="homeMonthlyProjCardPct">' + row.pct + '%</span></div>' +
      '<span class="homeMonthlyProjCardAmt">' + money(row.amt) + '</span>' +
      '<div class="homeMonthlyProjCardBar"><div class="homeMonthlyProjCardBarFill" style="width:' + row.pct + '%"></div></div>' +
      '</div>';
  }).join('');
}

function updateHomeMonthlyProjects(sAll) {
  updateHomeMonthlySummary(sAll);
  renderHomeMonthlyProjGrid(sAll);
}

function updateHomeTodaySection(sAll) {
  if (!sAll && typeof allOrgSummary === 'function') sAll = allOrgSummary();
  if (!sAll) return;
  let projects = getEnabledHomeProjects();
  let todayEntry = getRevenueEntry(todayKey());
  let yesterdayEntry = getRevenueEntry(yesterdayKey());
  let todayTotal = todayEntry ? (todayEntry.total || 0) : sAll.daily;
  let yesterdayTotal = yesterdayEntry ? (yesterdayEntry.total || 0) : sAll.daily;

  let compareEl = document.getElementById('homeTodayCompare');
  if (compareEl) {
    compareEl.innerHTML =
      '<div class="homeTodayCompareItem"><span class="homeTodayCompareLabel">昨日の収益</span><span class="homeTodayCompareVal">' + money(yesterdayTotal) + '</span></div>' +
      '<div class="homeTodayCompareItem homeTodayCompareItem--today"><span class="homeTodayCompareLabel">本日の収益</span><span class="homeTodayCompareVal">' + money(todayTotal) + '</span></div>';
  }

  renderProjectGrid('homeDailyProjGrid', projects, function (p) {
    if (todayEntry) return projectAmountFromEntry(todayEntry, p);
    return fallbackProjectAmount(p, sAll, 'daily');
  }, todayTotal);
}

function updateHomeDashboard(sAll) {
  updateHomeInputStats();
  renderHomeCalendar();
  renderHomeMonthlyLineChart();
  updateHomeMonthlyProjects(sAll);
  updateHomeTodaySection(sAll);
}

function showRevenueDayDetail(key) {
  let entry = getRevenueEntry(key);
  let parts = key.split('-');
  let label = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
  modalTitle.textContent = label + ' の収益';
  if (!entry) {
    modalContent.innerHTML = '<div class="lineBox"><b>未入力</b><p class="help">この日付の実績はまだ記録されていません。</p></div>';
  } else {
    modalContent.innerHTML =
      '<div class="lineBox"><b>合計</b><div class="amount">' + money(entry.total) + '</div><div class="help">' + yen(entry.total) + '</div></div>' +
      '<div class="homeSummaryList" style="margin-top:10px">' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot ram"></span>RAM</span><b>' + money(entry.ram || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot orca"></span>ORCA</span><b>' + money(entry.orca || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot genesis"></span>Genesis</span><b>' + money(entry.genesis || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot cary"></span>Cary Pact</span><b>' + money(entry.cary || 0) + '</b></div>' +
      '</div>' +
      (entry.savedAt ? '<p class="help" style="margin-top:10px">記録：' + entry.savedAt + '</p>' : '');
  }
  modalBg.style.display = 'flex';
}

function openRevenueInput() {
  let key = todayKey();
  let existing = getRevenueEntry(key);
  let base = existing || defaultRevenueEntry();
  modalTitle.textContent = '実績入力';
  modalContent.innerHTML =
    '<p class="help">今日の収益を記録します（参考シミュレーション用）。</p>' +
    '<label>合計収益（USD）</label>' +
    '<input id="revenueInputTotal" type="number" step="0.01" value="' + (Math.round((base.total || 0) * 100) / 100) + '">' +
    '<label>RAM</label><input id="revenueInputRam" type="number" step="0.01" value="' + (Math.round((base.ram || base.total || 0) * 100) / 100) + '">' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '<button class="btn2" onclick="closeModal()">キャンセル</button>' +
    '<button onclick="saveTodayRevenue()">保存</button></div>';
  modalBg.style.display = 'flex';
  setTimeout(function () { let el = document.getElementById('revenueInputTotal'); if (el) el.focus(); }, 80);
}

function saveTodayRevenue() {
  let total = Number(document.getElementById('revenueInputTotal')?.value) || 0;
  let ram = Number(document.getElementById('revenueInputRam')?.value) || 0;
  saveRevenueEntry(todayKey(), {
    total: total,
    ram: ram,
    orca: 0,
    genesis: 0,
    cary: 0,
    savedAt: new Date().toLocaleString()
  });
  closeModal();
  render();
  showToast('✅ 今日の実績を記録しました');
}

function syncMobileNav(page) {
  let nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  let map = { home: 'home', ram: 'ram', settings: 'settings', accountManage: 'ram' };
  let active = map[page] || '';
  nav.querySelectorAll('[data-nav]').forEach(function (btn) {
    btn.classList.toggle('isActive', btn.getAttribute('data-nav') === active);
  });
}

function openPortfolioNav() {
  alert('ポートフォリオは今後実装予定です');
}

document.addEventListener('DOMContentLoaded', function () {
  let avatar = document.querySelector('.ochanAvatar');
  if (avatar) {
    avatar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showPage('ochanRoom');
      }
    });
  }
});
