/* OUKEI HUB Portfolio UI — Ver1.7.7 (visual mock, data later) */

var PF_COLORS = {
  ram: '#f97316',
  orca: '#06b6d4',
  cary: '#a855f7',
  genesis: '#eab308',
  other: '#64748b'
};

var PF_MOCK_SUMMARY = {
  investment: {
    label: '総投資額', icon: 'wallet', value: '$265,300', sub: '(¥41,380,680)', accent: 'invest'
  },
  profit: {
    label: '総利益', icon: 'coins', value: '$147,480', sub: '(¥22,982,220)',
    trend: '55.6%', trendLabel: '投資額比', trendArrow: false, accent: 'profit'
  },
  recovery: {
    label: '回収率', icon: 'chart', value: '55.6%', sub: '総利益 ÷ 総投資', accent: 'recovery'
  },
  monthly: {
    label: '月間収益', icon: 'calendar', value: '$12,840', sub: '(¥1,999,200)',
    trend: '+8.2%', trendLabel: '前月比', accent: 'monthly'
  },
  daily: {
    label: '日間収益', icon: 'clock', value: '$428', sub: '(¥66,730)',
    trend: '+5.1%', trendLabel: '前日比', accent: 'daily'
  },
  goal: {
    label: '資産目標', icon: 'target', value: '¥100,000,000', pct: 38.2,
    remain: 'あと ¥61,800,000', accent: 'goal'
  }
};

var PF_MOCK_PROJECTS = {
  ram: {
    start: '2024/01/20', investment: '$120,000', profit: '$189,600',
    recovery: 158.0, recoveryDate: '2026/12', status: '運用中', statusCls: 'active'
  },
  orca: {
    start: '2024/04/15', investment: '$60,000', profit: '$92,340',
    recovery: 153.9, recoveryDate: '2027/03', status: '運用中', statusCls: 'active'
  },
  cary: {
    start: '2024/03/10', investment: '$50,000', profit: '$68,250',
    recovery: 136.5, recoveryDate: '2026/04', status: '運用中', statusCls: 'active'
  },
  genesis: {
    start: '2023/11/20', investment: '$45,000', profit: '$12,300',
    recovery: 27.3, recoveryDate: '—', status: '停止中', statusCls: 'stopped'
  }
};

var PF_MOCK_ALLOC = [
  { key: 'ram', name: 'RAM', color: PF_COLORS.ram, pct: 45.2 },
  { key: 'orca', name: 'ORCA', color: PF_COLORS.orca, pct: 22.6 },
  { key: 'cary', name: 'Cary Pact', color: PF_COLORS.cary, pct: 18.8 },
  { key: 'genesis', name: 'GENESIS', color: PF_COLORS.genesis, pct: 9.5 },
  { key: 'other', name: 'その他', color: PF_COLORS.other, pct: 3.8 }
];

var PF_MOCK_STACKED = [
  { label: '1月', total: 9200, ram: 4160, orca: 2080, cary: 1730, genesis: 880, other: 350 },
  { label: '2月', total: 9800, ram: 4430, orca: 2210, cary: 1840, genesis: 940, other: 380 },
  { label: '3月', total: 10500, ram: 4750, orca: 2370, cary: 1970, genesis: 1000, other: 410 },
  { label: '4月', total: 11200, ram: 5060, orca: 2530, cary: 2100, genesis: 1070, other: 440 },
  { label: '5月', total: 11900, ram: 5380, orca: 2690, cary: 2230, genesis: 1140, other: 460 },
  { label: '6月', total: 12840, ram: 5800, orca: 2900, cary: 2410, genesis: 1220, other: 510 }
];

var PF_STACK_ORDER = ['ram', 'orca', 'cary', 'genesis', 'other'];

function pfRecoveryFillPct(rate) {
  return Math.max(0, Math.min(100, (rate / 200) * 100));
}

function pfEscape(text) {
  return typeof escapeHtml === 'function' ? escapeHtml(text) : String(text);
}

function pfSummaryIcon(type) {
  var icons = {
    wallet: '<svg viewBox="0 0 24 24"><path d="M4 8h16v10H4z"/><path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M17 13h2"/></svg>',
    coins: '<svg viewBox="0 0 24 24"><ellipse cx="9" cy="8" rx="6" ry="3"/><path d="M3 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8"/><path d="M3 12v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16V9"/><path d="M12 16V7"/><path d="M16 16v-5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>'
  };
  return '<span class="pfSummaryIcon pfSummaryIcon--' + type + '">' + (icons[type] || icons.chart) + '</span>';
}

function pfRenderSummaryCards() {
  let el = document.getElementById('pfSummaryGrid');
  if (!el) return;
  let s = PF_MOCK_SUMMARY;

  function card(key) {
    let c = s[key];
    let foot = '';
    if (c.trend) {
      foot += '<div class="pfSummaryTrend pfSummaryTrend--up">' +
        c.trendLabel + ' <b>' + c.trend + '</b>' +
        (c.trendArrow !== false ? ' <span class="pfTrendArrow" aria-hidden="true">↗</span>' : '') +
        '</div>';
    }
    return '<article class="pfSummaryCard pfSummaryCard--' + c.accent + '">' +
      '<div class="pfSummaryCardGlow"></div>' +
      pfSummaryIcon(c.icon) +
      '<div class="pfSummaryLabel">' + c.label + '</div>' +
      '<div class="pfSummaryValue">' + c.value + '</div>' +
      (c.sub ? '<div class="pfSummarySub">' + c.sub + '</div>' : '') +
      foot + '</article>';
  }

  el.innerHTML =
    card('investment') + card('profit') + card('recovery') + card('monthly') + card('daily') +
    '<article class="pfSummaryCard pfSummaryCard--goal">' +
    '<div class="pfSummaryCardGlow"></div>' +
    pfSummaryIcon(s.goal.icon) +
    '<div class="pfSummaryLabel">' + s.goal.label + '</div>' +
    '<div class="pfSummaryValue pfSummaryValue--goal">' + s.goal.value + '</div>' +
    '<div class="pfGoalMeta"><span>達成率</span><b>' + s.goal.pct + '%</b></div>' +
    '<div class="pfGoalBar"><div class="pfGoalBarFill" style="width:' + s.goal.pct + '%"></div></div>' +
    '<div class="pfGoalRemain">' + s.goal.remain + '</div></article>';
}

function pfGetMockProjectRows() {
  let list = typeof getEnabledHomeProjects === 'function'
    ? getEnabledHomeProjects()
    : [{ key: 'ram', name: 'RAM' }, { key: 'orca', name: 'ORCA' }, { key: 'cary', name: 'Cary Pact' }];
  return list.map(function (p) {
    let mock = PF_MOCK_PROJECTS[p.key] || {
      start: '—', investment: '$0', profit: '$0', recovery: 0,
      recoveryDate: '—', status: '運用中', statusCls: 'active'
    };
    return {
      key: p.key,
      name: p.name,
      start: mock.start,
      investment: mock.investment,
      profit: mock.profit,
      recovery: mock.recovery,
      fill: pfRecoveryFillPct(mock.recovery),
      recoveryDate: mock.recoveryDate,
      status: mock.status,
      statusCls: mock.statusCls
    };
  });
}

function pfRenderProjectCard(row) {
  let icon = typeof renderHomeProjIcon === 'function'
    ? renderHomeProjIcon(row.key, 'pfProjectCardIcon')
    : '<span class="pfProjectCardIcon"></span>';
  return '<article class="pfProjectCard pfProjectCard--' + row.key + '">' +
    '<div class="pfProjectCardGlow"></div>' +
    '<div class="pfProjectCardTop">' +
    '<div class="pfProjectCardBrand">' + icon +
    '<div><h3 class="pfProjectCardName">' + pfEscape(row.name) + '</h3>' +
    '<p class="pfProjectStart">開始日 ' + pfEscape(row.start) + '</p></div></div>' +
    '<span class="pfStatusBadge pfStatusBadge--' + row.statusCls + '">' + pfEscape(row.status) + '</span></div>' +
    '<div class="pfProjectMetrics">' +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">投資額</span><span class="pfProjectMetricVal">' + row.investment + '</span></div>' +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">累計利益</span><span class="pfProjectMetricVal isProfit">' + row.profit + '</span></div>' +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">回収率</span><span class="pfProjectMetricVal isRecovery">' + row.recovery + '%</span></div>' +
    '</div>' +
    '<div class="pfRecoveryBlock">' +
    '<div class="pfRecoveryLabel"><span>回収率</span><b>' + row.recovery + '%</b></div>' +
    '<div class="pfRecoveryTrack"><div class="pfRecoveryFill" style="width:' + row.fill + '%"></div><i class="pfRecoveryMark"></i></div>' +
    '<div class="pfRecoveryScale"><span>0%</span><span>100%</span><span>200%</span></div></div>' +
    '<div class="pfRecoveryDateRow"><span>回収予定日</span><b>' + pfEscape(row.recoveryDate) + '</b></div>' +
    '</article>';
}

function pfRenderProjectCards() {
  let el = document.getElementById('pfProjectGrid');
  if (!el) return;
  let rows = pfGetMockProjectRows();
  el.style.setProperty('--pf-cols', String(Math.max(rows.length, 1)));
  if (!rows.length) {
    el.innerHTML = '<div class="pfEmptyCard"><p>表示ONのプロジェクトがありません。</p></div>';
    el.classList.add('isEmpty');
    return;
  }
  el.classList.remove('isEmpty');
  el.innerHTML = rows.map(pfRenderProjectCard).join('');
}

function pfRenderAllocation() {
  let el = document.getElementById('pfAllocationChart');
  if (!el) return;
  let acc = 0;
  let gradient = PF_MOCK_ALLOC.map(function (row) {
    let start = acc;
    acc += row.pct;
    return row.color + ' ' + start.toFixed(2) + '% ' + acc.toFixed(2) + '%';
  }).join(', ');
  let legend = PF_MOCK_ALLOC.map(function (row) {
    return '<div class="pfLegendRow">' +
      '<span class="pfLegendDot" style="background:' + row.color + '"></span>' +
      '<span class="pfLegendName">' + pfEscape(row.name) + '</span>' +
      '<div class="pfLegendBar"><div class="pfLegendBarFill" style="width:' + row.pct + '%;background:' + row.color + '"></div></div>' +
      '<span class="pfLegendVal">' + row.pct + '%</span></div>';
  }).join('');
  el.innerHTML =
    '<div class="pfAllocLayout">' +
    '<div class="pfDonutWrap">' +
    '<div class="pfDonut" style="background:conic-gradient(from -90deg,' + gradient + ')">' +
    '<div class="pfDonutHole"></div></div>' +
    '<div class="pfDonutCenter"><span>総投資額</span><b>$265,300</b><small>(¥41,380,680)</small></div></div>' +
    '<div class="pfLegendList">' + legend + '</div></div>';
}

function pfRenderStackedBars() {
  let el = document.getElementById('pfMonthlyChart');
  if (!el) return;
  let maxTotal = Math.max.apply(null, PF_MOCK_STACKED.map(function (m) { return m.total; }));
  let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(maxTotal) : maxTotal * 1.1;
  let chartH = 168;

  let cols = PF_MOCK_STACKED.map(function (month) {
    let segments = [];
    let offset = 0;
    PF_STACK_ORDER.forEach(function (key) {
      let val = month[key] || 0;
      if (val <= 0) return;
      let h = axisMax > 0 ? (val / axisMax) * chartH : 0;
      segments.push('<div class="pfStackSeg pfStackSeg--' + key + '" style="height:' + h.toFixed(1) + 'px;background:' + PF_COLORS[key] + '"></div>');
      offset += val;
    });
    let totalLabel = typeof formatAxisDollar === 'function' ? formatAxisDollar(month.total) : ('$' + month.total);
    return '<div class="pfStackCol">' +
      '<div class="pfStackTotal">' + totalLabel + '</div>' +
      '<div class="pfStackTrack" style="height:' + chartH + 'px">' + segments.join('') + '</div>' +
      '<div class="pfStackLabel">' + month.label + '</div></div>';
  }).join('');

  let yTicks = [0, 0.25, 0.5, 0.75, 1].map(function (r) {
    let v = axisMax * r;
    let label = typeof formatAxisDollar === 'function' ? formatAxisDollar(v) : ('$' + Math.round(v));
    return '<span style="bottom:' + (r * 100) + '%">' + label + '</span>';
  }).join('');

  let legend = PF_STACK_ORDER.filter(function (k) { return k !== 'other' || true; }).map(function (key) {
    let names = { ram: 'RAM', orca: 'ORCA', cary: 'Cary Pact', genesis: 'GENESIS', other: 'その他' };
    return '<span class="pfStackLegendItem"><i style="background:' + PF_COLORS[key] + '"></i>' + names[key] + '</span>';
  }).join('');

  el.innerHTML =
    '<div class="pfStackChart">' +
    '<div class="pfStackYAxis">' + yTicks + '</div>' +
    '<div class="pfStackCols">' + cols + '</div></div>' +
    '<div class="pfStackLegend">' + legend + '</div>';
}

function renderPortfolio() {
  pfRenderSummaryCards();
  pfRenderProjectCards();
  pfRenderAllocation();
  pfRenderStackedBars();
}
