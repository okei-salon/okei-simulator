/* OUKEI HUB Revenue Management — Ver1.8.1 */

var rmView = { y: new Date().getFullYear(), m: new Date().getMonth() };
var rmFilter = 'all';

var RM_PROJECTS = [
  { key: 'ram', name: 'RAM', iconKey: 'ram' },
  { key: 'orca', name: 'ORCA', iconKey: 'orca' },
  { key: 'cary', name: 'Cary Pact', iconKey: 'cary' },
  { key: 'genesis', name: 'GENESIS', iconKey: 'genesis' },
  { key: 'other', name: 'その他', iconKey: 'custom' }
];

var RM_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

var RM_DEMO_STATS = {
  ram: { bestDayAmount: 523, bestDayLabel: '2026/06/18', bestMonthAmount: 12480, bestMonthLabel: '2026年6月' },
  orca: { bestDayAmount: 412, bestDayLabel: '2026/06/15', bestMonthAmount: 9850, bestMonthLabel: '2026年6月' },
  cary: { bestDayAmount: 318, bestDayLabel: '2026/06/22', bestMonthAmount: 7620, bestMonthLabel: '2026年6月' },
  genesis: { bestDayAmount: 285, bestDayLabel: '2026/06/10', bestMonthAmount: 6420, bestMonthLabel: '2026年6月' },
  other: { bestDayAmount: 156, bestDayLabel: '2026/06/05', bestMonthAmount: 3890, bestMonthLabel: '2026年6月' }
};

var RM_CHART_X_DAYS = [1, 5, 10, 15, 20, 25, 30];

var RM_DEMO_CHART_CURRENT = { 1: 95, 5: 142, 10: 182, 15: 232, 20: 316, 25: 382, 30: 427 };
var RM_DEMO_CHART_PREV = { 1: 80, 5: 120, 10: 150, 15: 190, 20: 260, 25: 330, 30: 390 };

var RM_DEMO_PROJECT_RATIOS = {
  ram: 0.38,
  orca: 0.24,
  cary: 0.19,
  genesis: 0.12,
  other: 0.07
};

var RM_DEMO_ACCOUNTS = {
  ram: [
    { id: 'demo_ram_1', username: '甲斐1' },
    { id: 'demo_ram_2', username: '甲斐2' },
    { id: 'demo_ram_3', username: '甲斐3' }
  ],
  orca: [
    { id: 'demo_orca_1', username: '甲斐①' },
    { id: 'demo_orca_2', username: '甲斐②' }
  ],
  cary: [
    { id: 'demo_cary_1', username: '甲斐A' },
    { id: 'demo_cary_2', username: '甲斐B' }
  ]
};

function rmExpandAnchorSeries(anchors, daysInMonth) {
  let pts = Object.keys(anchors).map(function (k) {
    return { d: Number(k), v: anchors[k] };
  }).sort(function (a, b) { return a.d - b.d; });
  let out = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (d <= pts[0].d) {
      out.push(pts[0].v);
      continue;
    }
    if (d >= pts[pts.length - 1].d) {
      out.push(pts[pts.length - 1].v);
      continue;
    }
    let lo = pts[0];
    let hi = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i++) {
      if (d >= pts[i].d && d <= pts[i + 1].d) {
        lo = pts[i];
        hi = pts[i + 1];
        break;
      }
    }
    let t = (d - lo.d) / (hi.d - lo.d);
    out.push(Math.round(lo.v + (hi.v - lo.v) * t));
  }
  return out;
}

function rmGetDemoChartCurrentSeries(days) {
  return rmExpandAnchorSeries(RM_DEMO_CHART_CURRENT, days || 30);
}

function rmGetDemoChartPrevSeries(days) {
  return rmExpandAnchorSeries(RM_DEMO_CHART_PREV, days || 30);
}

function rmGetDemoChartSummary() {
  let curVals = rmGetDemoChartCurrentSeries(30);
  let prevVals = rmGetDemoChartPrevSeries(30);
  let curTotal = curVals.reduce(function (s, v) { return s + v; }, 0);
  let prevTotal = prevVals.reduce(function (s, v) { return s + v; }, 0);
  let pct = prevTotal ? Math.round(((curTotal - prevTotal) / prevTotal) * 1000) / 10 : 0;
  return { currentTotal: curTotal, prevTotal: prevTotal, pctChange: pct };
}

function rmGetDemoDayTotal(d, daysInMonth) {
  let series = rmGetDemoChartCurrentSeries(daysInMonth);
  return series[d - 1] || 0;
}

function rmGetDemoProjectDayAmount(projectKey, d, daysInMonth) {
  let total = rmGetDemoDayTotal(d, daysInMonth);
  let known = ['ram', 'orca', 'cary', 'genesis'];
  if (projectKey === 'other') {
    let sumKnown = known.reduce(function (s, k) {
      return s + rmGetDemoProjectDayAmount(k, d, daysInMonth);
    }, 0);
    return Math.max(0, Math.round((total - sumKnown) * 100) / 100);
  }
  let ratio = RM_DEMO_PROJECT_RATIOS[projectKey] || 0;
  return Math.round(total * ratio * 100) / 100;
}

function rmGetDemoAccountsForProject(projectKey) {
  let live = rmGetAccountsForProject(projectKey);
  if (live.length) return live;
  return RM_DEMO_ACCOUNTS[projectKey] ? RM_DEMO_ACCOUNTS[projectKey].slice() : [];
}

function rmGetDemoAccountDayAmount(projectKey, accountId, d, daysInMonth) {
  let accounts = rmGetDemoAccountsForProject(projectKey);
  let projectAmt = rmGetDemoProjectDayAmount(projectKey, d, daysInMonth);
  return rmSplitAmountAcrossAccounts(projectAmt, accounts, accountId);
}

function rmGetDemoRowDayAmount(row, y, m, d) {
  let daysInMonth = new Date(y, m + 1, 0).getDate();

  if (row.isTotal) {
    if (rmFilter === 'all') return rmGetDemoDayTotal(d, daysInMonth);
    if (rmFilter === 'genesis' || rmFilter === 'other') {
      return rmGetDemoProjectDayAmount(rmFilter, d, daysInMonth);
    }
    let accounts = rmGetDemoAccountsForProject(rmFilter);
    return accounts.reduce(function (sum, acc) {
      return sum + rmGetDemoAccountDayAmount(rmFilter, acc.id, d, daysInMonth);
    }, 0);
  }

  if (row.isProject) {
    return rmGetDemoProjectDayAmount(row.key, d, daysInMonth);
  }

  if (row.isAccount) {
    return rmGetDemoAccountDayAmount(row.projectKey, row.key, d, daysInMonth);
  }

  return rmGetDemoProjectDayAmount(row.key, d, daysInMonth);
}

function rmGetRowDayAmountFromLog(row, y, m, d) {
  if (typeof getRevenueEntry !== 'function' || typeof revenueDateKey !== 'function') return 0;
  let entry = getRevenueEntry(revenueDateKey(y, m, d));

  if (row.isTotal) {
    if (rmFilter === 'all') return entry ? (Number(entry.total) || 0) : 0;
    let accounts = rmGetAccountsForProject(rmFilter);
    return accounts.reduce(function (sum, acc) {
      return sum + rmGetAccountDayAmount(entry, rmFilter, acc, accounts);
    }, 0);
  }

  if (row.isAccount || row.isProject) {
    if (row.isProject) return rmGetProjectDayAmount(entry, row.key);
    let accounts = rmGetAccountsForProject(row.projectKey);
    return rmGetAccountDayAmount(entry, row.projectKey, { id: row.key, username: row.name }, accounts);
  }

  return rmGetProjectDayAmount(entry, row.key);
}

function rmEscape(text) {
  return typeof escapeHtml === 'function' ? escapeHtml(text) : String(text);
}

function rmMoney(n) {
  if (typeof money === 'function') return money(n || 0);
  return '$' + Math.round((n || 0) * 100) / 100;
}

function rmFormatMonthLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function rmInitViewFromReference() {
  if (typeof getHomeReferenceDate === 'function') {
    let ref = getHomeReferenceDate();
    rmView.y = ref.getFullYear();
    rmView.m = ref.getMonth();
  }
}

function rmGetFilterLabel() {
  if (rmFilter === 'all') return 'すべてのプロジェクト';
  let p = RM_PROJECTS.find(function (x) { return x.key === rmFilter; });
  return p ? p.name : 'すべてのプロジェクト';
}

function rmGetScopeSuffix() {
  return rmFilter === 'all' ? '（すべてのプロジェクト合計）' : '（' + rmGetFilterLabel() + '）';
}

function rmGetAccountsForProject(projectKey) {
  if (projectKey === 'ram' && typeof getRamInputAccounts === 'function') return getRamInputAccounts();
  if (projectKey === 'orca' && typeof getOrcaInputAccounts === 'function') return getOrcaInputAccounts();
  if (projectKey === 'cary' && typeof getCaryInputAccounts === 'function') return getCaryInputAccounts();
  if (projectKey === 'genesis' || projectKey === 'other') return [];
  return [];
}

function rmGetProjectDayAmount(entry, projectKey) {
  if (!entry) return 0;
  if (projectKey === 'other') {
    let known = ['ram', 'orca', 'cary', 'genesis'];
    let sumKnown = known.reduce(function (s, k) { return s + (Number(entry[k]) || 0); }, 0);
    let total = Number(entry.total) || 0;
    return Math.max(0, Math.round((total - sumKnown) * 100) / 100);
  }
  return Math.round((Number(entry[projectKey]) || 0) * 100) / 100;
}

function rmGetAccountDirectAmount(entry, projectKey, accountId) {
  if (!entry) return null;
  if (projectKey === 'ram' && typeof getRamAccountEntry === 'function') {
    let ae = getRamAccountEntry(entry, accountId);
    return ae ? ae.todayRevenue : null;
  }
  if (projectKey === 'orca' && typeof getOrcaAccountEntry === 'function') {
    let ae = getOrcaAccountEntry(entry, accountId);
    return ae && typeof calcOrcaAccountTotal === 'function' ? calcOrcaAccountTotal(ae) : null;
  }
  if (projectKey === 'cary' && typeof getCaryAccountEntry === 'function') {
    let ae = getCaryAccountEntry(entry, accountId);
    return ae ? ae.todayReward : null;
  }
  return null;
}

function rmSplitAmountAcrossAccounts(amount, accounts, accountId) {
  if (!amount || !accounts.length) return 0;
  let weights = accounts.map(function (_, i) { return i + 1; });
  let totalW = weights.reduce(function (s, w) { return s + w; }, 0);
  let idx = accounts.findIndex(function (a) { return a.id === accountId; });
  if (idx < 0) return 0;
  return Math.round(amount * weights[idx] / totalW * 100) / 100;
}

function rmGetAccountDayAmount(entry, projectKey, account, accounts) {
  let direct = rmGetAccountDirectAmount(entry, projectKey, account.id);
  if (direct !== null && direct !== undefined) return direct;
  let projectAmt = rmGetProjectDayAmount(entry, projectKey);
  return rmSplitAmountAcrossAccounts(projectAmt, accounts, account.id);
}

function rmGetRowDayAmount(row, y, m, d) {
  let fromLog = 0;
  try {
    fromLog = rmGetRowDayAmountFromLog(row, y, m, d);
  } catch (e) {}
  if (fromLog > 0) return fromLog;
  return rmGetDemoRowDayAmount(row, y, m, d);
}

function rmGetTableRows() {
  if (rmFilter === 'all') {
    return RM_PROJECTS.map(function (p) {
      return { key: p.key, name: p.name, iconKey: p.iconKey, isTotal: false };
    }).concat([{ key: 'total', name: '合計', iconKey: '', isTotal: true }]);
  }

  let accounts = rmGetDemoAccountsForProject(rmFilter);
  if (!accounts.length) {
    if (rmFilter === 'genesis' || rmFilter === 'other') {
      let p = RM_PROJECTS.find(function (x) { return x.key === rmFilter; });
      return [{
        key: rmFilter,
        name: p ? p.name : rmFilter,
        iconKey: rmFilter,
        isProject: true
      }];
    }
    return [{ key: 'empty', name: '（登録アカウントなし）', iconKey: rmFilter, isEmpty: true }];
  }
  return accounts.map(function (acc) {
    return {
      key: acc.id,
      name: acc.username,
      iconKey: rmFilter,
      projectKey: rmFilter,
      isAccount: true
    };
  }).concat([{ key: 'total', name: '合計', iconKey: '', isTotal: true }]);
}

function rmSumRowMonth(row, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  for (let d = 1; d <= days; d++) {
    sum += rmGetRowDayAmount(row, y, m, d);
  }
  return Math.round(sum * 100) / 100;
}

function rmGetFilteredDayTotal(y, m, d) {
  let entry = typeof getRevenueEntry === 'function' ? getRevenueEntry(revenueDateKey(y, m, d)) : null;
  if (rmFilter === 'all') return entry ? (Number(entry.total) || 0) : 0;
  if (rmFilter === 'genesis' || rmFilter === 'other') return rmGetProjectDayAmount(entry, rmFilter);
  let accounts = rmGetAccountsForProject(rmFilter);
  return accounts.reduce(function (sum, acc) {
    return sum + rmGetAccountDayAmount(entry, rmFilter, acc, accounts);
  }, 0);
}

function rmHasChartData(vals) {
  return vals.some(function (v) { return v > 0; });
}

function rmGetDemoDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  let monthScale = (m === 4) ? 0.87 : 1;
  for (let d = 1; d <= days; d++) {
    let wave = 88 + Math.sin((d + m) * 0.62) * 42 + ((d % 5) * 11);
    if (d % 7 === 0 || d % 7 === 6) wave *= 0.72;
    vals.push(Math.round(wave * monthScale));
  }
  return vals;
}

function rmResolveDailySeries(y, m) {
  let vals = rmCollectDailySeries(y, m);
  if (rmHasChartData(vals)) return vals;
  return rmGetDemoDailySeries(y, m);
}

function rmCollectDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    vals.push(rmGetFilteredDayTotal(y, m, d));
  }
  return vals;
}

function rmMonthTotalFromSeries(vals) {
  return Math.round(vals.reduce(function (s, v) { return s + v; }, 0) * 100) / 100;
}

function rmMonthTotal(y, m) {
  return rmMonthTotalFromSeries(rmResolveDailySeries(y, m));
}

function rmCalcPrevMonth(y, m) {
  let pm = m - 1;
  let py = y;
  if (pm < 0) { pm = 11; py -= 1; }
  return { y: py, m: pm };
}

function rmPctChange(current, prev) {
  if (!prev) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function rmRenderProjectIcon(iconKey, extraClass) {
  if (typeof pmRenderProjectIcon === 'function') return pmRenderProjectIcon(iconKey, extraClass);
  if (typeof renderHomeProjIcon === 'function') return renderHomeProjIcon(iconKey, extraClass);
  return '<span class="homeProjIcon homeProjIcon--' + iconKey + ' ' + (extraClass || '') + '"></span>';
}

function rmRenderDailyTable() {
  let table = document.getElementById('rmDailyTable');
  if (!table) return;

  try {
  let y = rmView.y;
  let m = rmView.m;
  let days = new Date(y, m + 1, 0).getDate();
  let rows = rmGetTableRows();

  let head = '<thead><tr><th class="rmStickyCol">項目</th>';
  for (let d = 1; d <= days; d++) {
    let wd = new Date(y, m, d).getDay();
    let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');
    head += '<th class="' + cls.trim() + '">' + d + '(' + RM_WEEKDAYS[wd] + ')</th>';
  }
  head += '<th class="rmMonthTotalCol">月間合計<br><span style="font-size:10px;font-weight:700;color:#7f97b3">(USD)</span></th></tr></thead>';

  let body = '<tbody>' + rows.map(function (row) {
    let trCls = row.isTotal ? ' class="rmTotalRow"' : '';
    let label = row.isTotal
      ? '<span class="rmRowLabel"><b>' + rmEscape(row.name) + '</b></span>'
      : '<span class="rmRowLabel">' + (row.iconKey ? rmRenderProjectIcon(row.iconKey, 'rmRowIcon') : '') + rmEscape(row.name) + '</span>';

    let cells = '';
    for (let d = 1; d <= days; d++) {
      let wd = new Date(y, m, d).getDay();
      let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');
      if (row.isEmpty) {
        cells += '<td class="' + cls.trim() + ' isEmpty">—</td>';
        continue;
      }
      let amt = rmGetRowDayAmount(row, y, m, d);
      cells += '<td class="' + cls.trim() + (amt ? '' : ' isEmpty') + '">' + (amt ? rmMoney(amt) : '—') + '</td>';
    }

    let monthSum = row.isEmpty ? 0 : rmSumRowMonth(row, y, m);
    cells += '<td class="rmMonthTotalCol">' + (row.isEmpty ? '—' : rmMoney(monthSum)) + '</td>';

    return '<tr' + trCls + '><td class="rmStickyCol">' + label + '</td>' + cells + '</tr>';
  }).join('') + '</tbody>';

  table.innerHTML = head + body;
  } catch (e) {
    table.innerHTML = '<tbody><tr><td class="rmStickyCol">項目</td><td>読込中...</td></tr></tbody>';
  }
}

function rmRenderCompareChart() {
  let el = document.getElementById('rmCompareChart');
  if (!el) return;

  try {
  let y = rmView.y;
  let m = rmView.m;
  let prev = rmCalcPrevMonth(y, m);
  let days = new Date(y, m + 1, 0).getDate();
  let curVals = rmGetDemoChartCurrentSeries(days);
  let prevVals = rmGetDemoChartPrevSeries(days);
  let dataMax = Math.max.apply(null, curVals.concat(prevVals).concat([1]));
  let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(dataMax) : Math.max(dataMax, 450);

  let w = 520;
  let h = 168;
  let padLeft = 42;
  let padRight = 16;
  let padTop = 10;
  let padBottom = 20;
  let plotW = w - padLeft - padRight;
  let plotH = h - padTop - padBottom;

  function plotY(val) {
    return padTop + plotH - (Math.max(0, val) / axisMax) * plotH;
  }

  function plotX(idx) {
    if (days <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (days - 1)) * plotW;
  }

  function linePoints(vals) {
    return vals.map(function (v, i) {
      return plotX(i).toFixed(1) + ',' + plotY(v).toFixed(1);
    }).join(' ');
  }

  function lineDots(vals, fill, stroke) {
    return vals.map(function (v, i) {
      return '<circle cx="' + plotX(i).toFixed(1) + '" cy="' + plotY(v).toFixed(1) + '" r="3.2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"></circle>';
    }).join('');
  }

  let ticks = typeof chartAxisTicks === 'function' ? chartAxisTicks(axisMax, 5) : [0, axisMax / 2, axisMax];
  let grid = ticks.map(function (t) {
    let yPos = plotY(t);
    let label = typeof formatAxisDollar === 'function' ? formatAxisDollar(t) : rmMoney(t);
    return '<line x1="' + padLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padRight) + '" y2="' + yPos.toFixed(1) + '" stroke="rgba(80,110,150,.25)" stroke-width="1"></line>' +
      '<text x="' + (padLeft - 6) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end" fill="#7f97b3" font-size="10" font-weight="700">' + label + '</text>';
  }).join('');

  let xSvg = RM_CHART_X_DAYS.filter(function (d) { return d <= days; }).map(function (d) {
    let x = plotX(d - 1);
    return '<text x="' + x.toFixed(1) + '" y="' + (h - 3) + '" text-anchor="middle" fill="#7f97b3" font-size="10" font-weight="700">' + d + '日</text>';
  }).join('');

  el.innerHTML =
    '<div class="rmCompareChartInner">' +
    '<svg class="rmCompareSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    grid + xSvg +
    '<polyline points="' + linePoints(prevVals) + '" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4"></polyline>' +
    lineDots(prevVals, '#64748b', '#0b182b') +
    '<polyline points="' + linePoints(curVals) + '" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>' +
    lineDots(curVals, '#60a5fa', '#0b182b') +
    '</svg>' +
    '<div class="rmCompareLegend">' +
    '<span class="rmCompareLegendItem"><i class="isCurrent"></i>今月（' + rmFormatMonthLabel(y, m) + '）</span>' +
    '<span class="rmCompareLegendItem"><i class="isPrev"></i>前月（' + rmFormatMonthLabel(prev.y, prev.m) + '）</span>' +
    '</div></div>';
  } catch (e) {}
}

function rmRenderChartSummary() {
  let el = document.getElementById('rmChartSummary');
  if (!el) return;

  try {
  let summary = rmGetDemoChartSummary();
  let curTotal = summary.currentTotal;
  let prevTotal = summary.prevTotal;
  let pct = summary.pctChange;
  let pctCls = pct >= 0 ? 'isUp' : 'isDown';
  let arrow = pct >= 0 ? '↗' : '↘';

  el.innerHTML =
    '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">今月合計</span><span class="rmChartSummaryVal">' + rmMoney(curTotal) + '</span></div>' +
    '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">前月合計</span><span class="rmChartSummaryVal isPrev">' + rmMoney(prevTotal) + '</span></div>' +
    '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">前月比</span><span class="rmChartSummaryVal ' + pctCls + '">' + (pct >= 0 ? '+' : '') + pct + '% ' + arrow + '</span></div>';
  } catch (e) {}
}

function rmScanAllDateKeys() {
  let keys = [];
  if (typeof isHomeDemoActive === 'function' && isHomeDemoActive() && typeof HOME_DEMO_LOG !== 'undefined') {
    keys = Object.keys(HOME_DEMO_LOG);
  }
  if (typeof settings !== 'undefined' && settings.revenueLog) {
    Object.keys(settings.revenueLog).forEach(function (k) {
      if (keys.indexOf(k) === -1) keys.push(k);
    });
  }
  return keys.sort();
}

function rmComputeProjectStats(projectKey) {
  let bestDay = { amount: 0, dateKey: '' };
  let monthTotals = {};

  rmScanAllDateKeys().forEach(function (key) {
    let parts = key.split('-');
    if (parts.length !== 3) return;
    let y = Number(parts[0]);
    let mo = Number(parts[1]) - 1;
    let d = Number(parts[2]);
    let entry = typeof getRevenueEntry === 'function' ? getRevenueEntry(key) : null;
    let amt = rmGetProjectDayAmount(entry, projectKey);
    if (amt > bestDay.amount) {
      bestDay = { amount: amt, dateKey: key };
    }
    let monthKey = y + '-' + String(mo + 1).padStart(2, '0');
    monthTotals[monthKey] = (monthTotals[monthKey] || 0) + amt;
  });

  let bestMonth = { amount: 0, label: '' };
  Object.keys(monthTotals).forEach(function (mk) {
    if (monthTotals[mk] > bestMonth.amount) {
      let p = mk.split('-');
      bestMonth = {
        amount: Math.round(monthTotals[mk] * 100) / 100,
        label: p[0] + '年' + Number(p[1]) + '月'
      };
    }
  });

  let dayLabel = '—';
  if (bestDay.dateKey) {
    let p = bestDay.dateKey.split('-');
    dayLabel = p[0] + '/' + p[1] + '/' + p[2];
  }

  return {
    bestDayAmount: bestDay.amount,
    bestDayLabel: dayLabel,
    bestMonthAmount: bestMonth.amount,
    bestMonthLabel: bestMonth.label || '—'
  };
}

function rmGetProjectStats(projectKey) {
  let stats = rmComputeProjectStats(projectKey);
  if (stats.bestDayAmount || stats.bestMonthAmount) return stats;
  return RM_DEMO_STATS[projectKey] || stats;
}

function rmRenderProjectStats() {
  let el = document.getElementById('rmProjectStats');
  if (!el) return;

  try {
  el.innerHTML =
    '<div class="rmStatTable">' +
    '<div class="rmStatTableHead">' +
    '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高日収</div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高月収</div>' +
    '</div>' +
    RM_PROJECTS.map(function (p) {
      let stats = RM_DEMO_STATS[p.key] || { bestDayAmount: 0, bestDayLabel: '—', bestMonthAmount: 0, bestMonthLabel: '—' };
      return '<div class="rmStatTableRow">' +
        '<div class="rmStatTableCol rmStatTableCol--project">' + rmRenderProjectIcon(p.iconKey, 'rmRowIcon') + rmEscape(p.name) + '</div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + rmMoney(stats.bestDayAmount) + '</span>' +
        '<span class="rmStatDate">' + rmEscape(stats.bestDayLabel) + '</span></div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + rmMoney(stats.bestMonthAmount) + '</span>' +
        '<span class="rmStatDate">' + rmEscape(stats.bestMonthLabel) + '</span></div>' +
        '</div>';
    }).join('') +
    '</div>';
  } catch (e) {}
}

function rmUpdateHeaderMeta() {
  let monthLabel = document.getElementById('rmMonthLabel');
  if (monthLabel) monthLabel.textContent = rmFormatMonthLabel(rmView.y, rmView.m);

  let lastUpdate = document.getElementById('rmLastUpdate');
  if (lastUpdate) {
    let txt = (typeof settings !== 'undefined' && settings.lastUpdate && settings.lastUpdate !== '-')
      ? settings.lastUpdate
      : '—';
    lastUpdate.textContent = '最終更新：' + txt;
  }

  let dailyTitle = document.getElementById('rmDailyTitle');
  if (dailyTitle) dailyTitle.textContent = '日別収益一覧' + rmGetScopeSuffix();

  let chartTitle = document.getElementById('rmLineChartTitle');
  if (chartTitle) chartTitle.textContent = '月間収益グラフ' + rmGetScopeSuffix();

  let statsTitle = document.getElementById('rmStatsTitle');
  if (statsTitle) statsTitle.textContent = '過去最高実績' + rmGetScopeSuffix();
}

function rmOnFilterChange() {
  let sel = document.getElementById('rmProjectFilter');
  rmFilter = sel ? sel.value : 'all';
  rmRenderAllPanels();
  rmUpdateHeaderMeta();
}

function rmPrevMonth() {
  rmView.m--;
  if (rmView.m < 0) { rmView.m = 11; rmView.y--; }
  renderRevenueManage();
}

function rmNextMonth() {
  rmView.m++;
  if (rmView.m > 11) { rmView.m = 0; rmView.y++; }
  renderRevenueManage();
}

function rmExportPlaceholder() {
  if (typeof showToast === 'function') showToast('エクスポートは準備中です');
}

function rmRenderBottomPanels() {
  rmRenderCompareChart();
  rmRenderChartSummary();
  rmRenderProjectStats();
}

function rmRenderAllPanels() {
  rmRenderDailyTable();
  rmRenderBottomPanels();
}

function renderRevenueManage() {
  rmInitViewFromReference();
  if (typeof pfSyncMainTabs === 'function') pfSyncMainTabs('revenueManage');

  let sel = document.getElementById('rmProjectFilter');
  if (sel) sel.value = rmFilter;

  rmUpdateHeaderMeta();
  rmRenderAllPanels();
}

function rmEnsureInit() {
  if (typeof revenueManagePage === 'undefined') return;
  renderRevenueManage();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rmEnsureInit);
  } else {
    rmEnsureInit();
  }
}
