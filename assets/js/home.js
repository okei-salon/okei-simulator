/* OUKEI HUB Home UI — Ver1.5.8.29 */
let homeCalView = { y: new Date().getFullYear(), m: new Date().getMonth() };

function ensureRevenueLog() {
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
}

function revenueDateKey(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function todayKey() {
  let t = new Date();
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function yesterdayKey() {
  let t = new Date();
  t.setDate(t.getDate() - 1);
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatCalLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function getEnabledHomeProjects() {
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

function getRevenueEntry(key) {
  ensureRevenueLog();
  return settings.revenueLog[key] || null;
}

function saveRevenueEntry(key, entry) {
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
  let now = new Date();
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
    let c = 2 * Math.PI * 15;
    ringEl.setAttribute('stroke-dasharray', c.toFixed(2));
    ringEl.setAttribute('stroke-dashoffset', (c * (1 - detail.rate / 100)).toFixed(2));
  }
}

function sumMonthRevenueLog(y, m) {
  ensureRevenueLog();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let out = { total: 0, ram: 0, orca: 0, genesis: 0, cary: 0, hasLog: false };
  for (let d = 1; d <= daysInMonth; d++) {
    let entry = getRevenueEntry(revenueDateKey(y, m, d));
    if (!entry) continue;
    out.hasLog = true;
    out.total += entry.total || 0;
    out.ram += entry.ram || 0;
    out.orca += entry.orca || 0;
    out.genesis += entry.genesis || 0;
    out.cary += entry.cary || 0;
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
  let today = new Date();
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

function bindLineChartTooltip(container, points, monthNum) {
  let tip = container.querySelector('.homeLineChartTip');
  let svg = container.querySelector('.homeLineChartSvg');
  if (!tip || !svg) return;

  function showTip(node, p) {
    if (!p) return;
    tip.textContent = monthNum + '/' + p.d + '  ' + money(p.val);
    tip.classList.add('isVisible');
    let cx = Number(node.getAttribute('cx'));
    let cy = Number(node.getAttribute('cy'));
    let vb = svg.viewBox.baseVal;
    let left = ((cx / vb.width) * svg.clientWidth) - tip.offsetWidth / 2;
    let top = ((cy / vb.height) * svg.clientHeight) - 38;
    tip.style.left = Math.max(4, Math.min(left, svg.clientWidth - tip.offsetWidth - 4)) + 'px';
    tip.style.top = Math.max(2, top) + 'px';
    container.querySelectorAll('.homeLineDot').forEach(function (d) { d.classList.remove('isActive'); });
    let dot = node.parentNode ? node.parentNode.querySelector('.homeLineDot') : null;
    if (dot) dot.classList.add('isActive');
  }

  container.querySelectorAll('.homeLineHit').forEach(function (node) {
    node.addEventListener('mouseenter', function () {
      showTip(node, points[Number(node.getAttribute('data-idx'))]);
    });
    node.addEventListener('mouseleave', function () {
      tip.classList.remove('isVisible');
      container.querySelectorAll('.homeLineDot').forEach(function (d) { d.classList.remove('isActive'); });
    });
  });

  let todayIdx = points.findIndex(function (p) { return p.isToday; });
  if (todayIdx >= 0) {
    let todayHit = container.querySelector('.homeLineHit[data-idx="' + todayIdx + '"]');
    if (todayHit) showTip(todayHit, points[todayIdx]);
  }
}

function renderHomeMonthlyLineChart() {
  let el = document.getElementById('homeMonthlyLineChart');
  if (!el) return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let monthNum = m + 1;
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let today = new Date();
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

  let w = 360;
  let h = 108;
  let yAxisW = 44;
  let padRight = 10;
  let padBottom = 18;
  let padY = 10;
  let chartLeft = yAxisW;
  let innerW = w - chartLeft - padRight;
  let innerH = h - padY - padBottom;

  let gridSvg = ticks.map(function (t) {
    let yPos = padY + innerH - (t / axisMax) * innerH;
    return '<line class="homeLineGrid" x1="' + chartLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padRight) + '" y2="' + yPos.toFixed(1) + '"></line>' +
      '<text class="homeLineYLabel" x="' + (chartLeft - 6) + '" y="' + (yPos + 3).toFixed(1) + '" text-anchor="end">' + formatAxisDollar(t) + '</text>';
  }).join('');

  let xSvg = xMarks.map(function (mark) {
    let x = chartLeft + (daysInMonth <= 1 ? innerW / 2 : ((mark.d - 1) / (daysInMonth - 1)) * innerW);
    return '<text class="homeLineXLabel" x="' + x.toFixed(1) + '" y="' + (h - 4) + '" text-anchor="middle">' + mark.label + '</text>';
  }).join('');

  let pts = vals.map(function (v, i) {
    let x = chartLeft + (daysInMonth <= 1 ? innerW / 2 : (i / (daysInMonth - 1)) * innerW);
    let yPos = padY + innerH - (v.val / axisMax) * innerH;
    return x.toFixed(1) + ',' + yPos.toFixed(1);
  }).join(' ');

  let fillPts = pts + ' ' + (chartLeft + innerW).toFixed(1) + ',' + (padY + innerH).toFixed(1) + ' ' + chartLeft + ',' + (padY + innerH).toFixed(1);

  let dots = vals.map(function (v, i) {
    let x = chartLeft + (daysInMonth <= 1 ? innerW / 2 : (i / (daysInMonth - 1)) * innerW);
    let yPos = padY + innerH - (v.val / axisMax) * innerH;
    let cls = v.isToday ? 'homeLineDot isToday' : 'homeLineDot';
    return '<g class="homeLinePoint">' +
      '<circle class="homeLineHit" data-idx="' + i + '" cx="' + x.toFixed(1) + '" cy="' + yPos.toFixed(1) + '" r="7"></circle>' +
      '<circle class="' + cls + '" cx="' + x.toFixed(1) + '" cy="' + yPos.toFixed(1) + '" r="' + (v.isToday ? '3' : '2') + '"></circle></g>';
  }).join('');

  el.innerHTML =
    '<div class="homeLineChartInner">' +
    '<span class="homeLineChartUnit">単位：USD</span>' +
    '<div class="homeLineChartTip"></div>' +
    '<svg class="homeLineChartSvg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    '<defs><linearGradient id="homeLineGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="rgba(96,165,250,.28)"/><stop offset="100%" stop-color="rgba(96,165,250,0)"/>' +
    '</linearGradient></defs>' +
    gridSvg + xSvg +
    '<polyline class="homeLineChartFill" points="' + fillPts + '"></polyline>' +
    '<polyline class="homeLineChartLine" points="' + pts + '"></polyline>' +
    dots +
    '</svg></div>';

  bindLineChartTooltip(el, vals, monthNum);
}

function updateHomeMonthlyProjects(sAll) {
  if (!sAll && typeof allOrgSummary === 'function') sAll = allOrgSummary();
  if (!sAll) return;
  let projects = getEnabledHomeProjects();
  let now = new Date();
  let monthLog = sumMonthRevenueLog(now.getFullYear(), now.getMonth());
  let monthTotal = monthLog.hasLog ? monthLog.total : sAll.monthly;
  renderProjectGrid('homeMonthlyProjGrid', projects, function (p) {
    if (monthLog.hasLog) return projectAmountFromEntry({ total: monthLog.total, ram: monthLog.ram, orca: monthLog.orca, genesis: monthLog.genesis, cary: monthLog.cary }, p);
    return fallbackProjectAmount(p, sAll, 'monthly');
  }, monthTotal);
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
