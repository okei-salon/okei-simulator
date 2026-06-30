/* OUKEI HUB Portfolio UI — Ver1.8.1 */

var PF_COLORS = {
  ram: '#f97316',
  orca: '#06b6d4',
  cary: '#a855f7',
  genesis: '#eab308',
  other: '#64748b'
};

var PF_STANDARD_PROJECTS = [
  { key: 'ram', name: 'RAM' },
  { key: 'orca', name: 'ORCA' },
  { key: 'cary', name: 'Cary Pact' },
  { key: 'genesis', name: 'GENESIS' }
];

var PF_MOCK_PROJECTS = {
  ram: {
    start: '2024/01/20', operatingUsd: 40000, profitUsd: 189600,
    recovery: 158.0, recoveryDate: '2026/12', status: '運用中', statusCls: 'active'
  },
  orca: {
    start: '2024/04/15', operatingUsd: 20000, profitUsd: 92340,
    recovery: 153.9, recoveryDate: '2027/03', status: '運用中', statusCls: 'active'
  },
  cary: {
    start: '2024/03/10', operatingUsd: 10000, profitUsd: 68250,
    recovery: 136.5, recoveryDate: '2026/04', status: '運用中', statusCls: 'active'
  },
  genesis: {
    start: '2023/11/20', operatingUsd: 45000, profitUsd: 12300,
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

var pfGoalEditSnapshot = '';

function pfRecoveryFillPct(rate) {
  return Math.max(0, Math.min(100, (rate / 200) * 100));
}

function pfEscape(text) {
  return typeof escapeHtml === 'function' ? escapeHtml(text) : String(text);
}

function pfDefaultInclusionRate(key) {
  return key === 'cary' ? 0 : 100;
}

function pfGetYenRate() {
  if (typeof pmGetFxRate === 'function') return pmGetFxRate();
  return Number(typeof settings !== 'undefined' && settings ? settings.yenRate : 0) || 155;
}

function pfFormatOperatingUsd(amount) {
  return Math.round(amount || 0).toLocaleString() + 'ドル';
}

function pfFormatYen(amount) {
  return '¥' + Math.round(amount || 0).toLocaleString();
}

function pfFormatYenPlain(amount) {
  return Math.round(amount || 0).toLocaleString() + '円';
}

function pfMoneyUsd(amount) {
  return typeof money === 'function' ? money(amount) : ('$' + Math.round(amount || 0).toLocaleString());
}

function pfYenRef(amountUsd) {
  return typeof yen === 'function' ? yen(amountUsd) : pfFormatYenPlain((amountUsd || 0) * pfGetYenRate());
}

function pfGetProjectMock(key) {
  return PF_MOCK_PROJECTS[key] || {
    start: '—', operatingUsd: 0, profitUsd: 0, recovery: 0,
    recoveryDate: '—', status: '運用中', statusCls: 'active'
  };
}

function pfGetAllPortfolioProjects() {
  if (typeof pmGetRegisteredProjects === 'function') {
    return pmGetRegisteredProjects().map(function (p) {
      return { key: p.key, name: p.name };
    });
  }
  return PF_STANDARD_PROJECTS.slice();
}

function pfEnsurePortfolioGoalSettings() {
  if (typeof settings === 'undefined') return;
  if (!settings.portfolioGoal || typeof settings.portfolioGoal !== 'object') {
    settings.portfolioGoal = {};
  }
  if (typeof settings.portfolioGoal.amountYen !== 'number') {
    settings.portfolioGoal.amountYen = 100000000;
  }
  if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
}

function pfGoalSettingsHasSaved() {
  pfEnsurePortfolioGoalSettings();
  return !!settings.portfolioGoal.savedAt;
}

function pfGetInclusionRate(key) {
  if (typeof pmGetInclusionRate === 'function') return pmGetInclusionRate(key);
  return pfDefaultInclusionRate(key);
}

function pfGetDefaultGoalState() {
  return { amountYen: 100000000 };
}

function pfGetSavedGoalState() {
  pfEnsurePortfolioGoalSettings();
  return {
    amountYen: Number(settings.portfolioGoal.amountYen) || 0
  };
}

function pfSerializeGoalState(state) {
  return JSON.stringify(state);
}

function pfGetEnabledOperatingRows() {
  let list = typeof getEnabledHomeProjects === 'function'
    ? getEnabledHomeProjects()
    : [{ key: 'ram', name: 'RAM' }, { key: 'orca', name: 'ORCA' }, { key: 'cary', name: 'Cary Pact' }];
  return list.map(function (p) {
    let mock = pfGetProjectMock(p.key);
    return {
      key: p.key,
      name: p.name,
      operatingUsd: mock.operatingUsd
    };
  });
}

function pfGetEnabledProjectRows() {
  let list = typeof getEnabledHomeProjects === 'function'
    ? getEnabledHomeProjects()
    : [{ key: 'ram', name: 'RAM' }, { key: 'orca', name: 'ORCA' }, { key: 'cary', name: 'Cary Pact' }];
  return list.map(function (p) {
    let mock = pfGetProjectMock(p.key);
    return {
      key: p.key,
      name: p.name,
      start: typeof pmGetStartDate === 'function' ? pmGetStartDate(p.key) : mock.start,
      operatingUsd: mock.operatingUsd,
      operating: pfMoneyUsd(mock.operatingUsd),
      profit: pfMoneyUsd(mock.profitUsd),
      profitUsd: mock.profitUsd,
      recovery: mock.recovery,
      fill: pfRecoveryFillPct(mock.recovery),
      recoveryDate: mock.recoveryDate,
      status: mock.status,
      statusCls: mock.statusCls
    };
  });
}

function pfSumEnabledOperatingUsd() {
  return pfGetEnabledOperatingRows().reduce(function (sum, row) {
    return sum + row.operatingUsd;
  }, 0);
}

function pfSumEnabledProfitUsd() {
  return pfGetEnabledProjectRows().reduce(function (sum, row) {
    return sum + row.profitUsd;
  }, 0);
}

function pfCalcCurrentValuationUsd() {
  return pfGetAllPortfolioProjects().reduce(function (sum, p) {
    let mock = pfGetProjectMock(p.key);
    let rate = pfGetInclusionRate(p.key) / 100;
    return sum + (mock.operatingUsd * rate) + mock.profitUsd;
  }, 0);
}

function pfCalcCurrentValuationYen() {
  return pfCalcCurrentValuationUsd() * pfGetYenRate();
}

function pfCalcGoalProgress() {
  pfEnsurePortfolioGoalSettings();
  let goalYen = Number(settings.portfolioGoal.amountYen) || 0;
  let currentYen = pfCalcCurrentValuationYen();
  let pct = goalYen > 0 ? Math.max(0, Math.min(999.9, (currentYen / goalYen) * 100)) : 0;
  let remain = Math.max(0, goalYen - currentYen);
  return {
    goalYen: goalYen,
    currentYen: currentYen,
    pct: Math.round(pct * 10) / 10,
    remain: remain
  };
}

function pfPersistSettings() {
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    localStorage.setItem('oukei_hub_v15_data', JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : 'm1',
      rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : []
    }));
  } catch (e) {}
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

  pfEnsurePortfolioGoalSettings();

  let operatingTotal = pfSumEnabledOperatingUsd();
  let profitTotal = pfSumEnabledProfitUsd();
  let recoveryPct = operatingTotal > 0
    ? (Math.round((profitTotal / operatingTotal) * 1000) / 10)
    : 0;
  let profitRatio = operatingTotal > 0
    ? (Math.round((profitTotal / operatingTotal) * 1000) / 10) + '%'
    : '0%';
  let goal = pfCalcGoalProgress();
  let monthly = PF_MOCK_SUMMARY_DATA.monthly;
  let daily = PF_MOCK_SUMMARY_DATA.daily;

  function cardHtml(opts) {
    let attrs = 'class="pfSummaryCard pfSummaryCard--' + opts.accent + (opts.clickable ? ' isClickable' : '') + '"';
    if (opts.click) attrs += ' role="button" tabindex="0" onclick="' + opts.click + '" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){' + opts.click + ';event.preventDefault()}"';
    let foot = '';
    if (opts.trend) {
      foot += '<div class="pfSummaryTrend pfSummaryTrend--up">' +
        opts.trendLabel + ' <b>' + opts.trend + '</b>' +
        (opts.trendArrow !== false ? ' <span class="pfTrendArrow" aria-hidden="true">↗</span>' : '') +
        '</div>';
    }
    return '<article ' + attrs + '>' +
      '<div class="pfSummaryCardGlow"></div>' +
      pfSummaryIcon(opts.icon) +
      '<div class="pfSummaryLabel">' + opts.label + '</div>' +
      '<div class="pfSummaryValue">' + opts.value + '</div>' +
      (opts.sub ? '<div class="pfSummarySub">' + opts.sub + '</div>' : '') +
      foot + '</article>';
  }

  el.innerHTML =
    cardHtml({
      accent: 'invest', icon: 'wallet', label: '運用額',
      value: pfMoneyUsd(operatingTotal), sub: pfYenRef(operatingTotal),
      clickable: true, click: 'pfOpenOperatingBreakdown()'
    }) +
    cardHtml({
      accent: 'profit', icon: 'coins', label: '総利益',
      value: pfMoneyUsd(profitTotal), sub: pfYenRef(profitTotal),
      trend: profitRatio, trendLabel: '運用額比', trendArrow: false
    }) +
    cardHtml({
      accent: 'recovery', icon: 'chart', label: '回収率',
      value: recoveryPct + '%', sub: '総利益 ÷ 運用額'
    }) +
    cardHtml({
      accent: 'monthly', icon: 'calendar', label: '月間収益',
      value: monthly.value, sub: monthly.sub,
      trend: monthly.trend, trendLabel: '前月比'
    }) +
    cardHtml({
      accent: 'daily', icon: 'clock', label: '日間収益',
      value: daily.value, sub: daily.sub,
      trend: daily.trend, trendLabel: '前日比'
    }) +
    '<article class="pfSummaryCard pfSummaryCard--goal isClickable" role="button" tabindex="0" onclick="pfOpenGoalSettings()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){pfOpenGoalSettings();event.preventDefault()}">' +
    '<div class="pfSummaryCardGlow"></div>' +
    pfSummaryIcon('target') +
    '<div class="pfSummaryLabel">資産目標</div>' +
    '<div class="pfSummaryValue pfSummaryValue--goal">' + pfFormatYen(goal.goalYen) + '</div>' +
    '<div class="pfGoalMeta"><span>達成率</span><b>' + goal.pct + '%</b></div>' +
    '<div class="pfGoalBar"><div class="pfGoalBarFill" style="width:' + Math.min(100, goal.pct) + '%"></div></div>' +
    '<div class="pfGoalRemain">あと ' + pfFormatYen(goal.remain) + '</div></article>';
}

var PF_MOCK_SUMMARY_DATA = {
  monthly: { value: '$12,840', sub: '(¥1,999,200)', trend: '+8.2%' },
  daily: { value: '$428', sub: '(¥66,730)', trend: '+5.1%' }
};

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
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">運用額</span><span class="pfProjectMetricVal">' + row.operating + '</span></div>' +
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
  let rows = pfGetEnabledProjectRows();
  el.style.setProperty('--pf-cols', String(Math.max(rows.length, 1)));
  if (!rows.length) {
    el.innerHTML = '<div class="pfEmptyCard"><p>表示ONのプロジェクトがありません。</p></div>';
    el.classList.add('isEmpty');
    return;
  }
  el.classList.remove('isEmpty');
  el.innerHTML = rows.map(pfRenderProjectCard).join('');
}

function pfOpenOperatingBreakdown() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  let rows = pfGetEnabledOperatingRows();
  let total = rows.reduce(function (sum, row) { return sum + row.operatingUsd; }, 0);
  let body = rows.map(function (row) {
    return '<div class="pfBreakdownBlock">' +
      '<div class="pfBreakdownName">' + pfEscape(row.name) + '</div>' +
      '<div class="pfBreakdownRow"><span>運用額</span><b>' + pfFormatOperatingUsd(row.operatingUsd) + '</b></div>' +
      '</div>';
  }).join('');
  body += '<div class="pfBreakdownTotal">' +
    '<span>合計</span><b>' + pfFormatOperatingUsd(total) + '</b></div>';
  modalTitle.textContent = '運用額の内訳';
  modalContent.innerHTML = body;
  modalBg.style.display = 'flex';
}

function pfOpenGoalSettings() {
  let goalPage = document.getElementById('pfGoalSettingsPage');
  let portfolio = document.getElementById('portfolioPage');
  if (!goalPage || !portfolio) return;
  portfolio.classList.add('hidden');
  goalPage.classList.remove('hidden');
  if (typeof setPageLocation === 'function') setPageLocation('資産目標設定');
  pfRenderGoalSettingsForm();
}

function pfCloseGoalSettings() {
  let goalPage = document.getElementById('pfGoalSettingsPage');
  let portfolio = document.getElementById('portfolioPage');
  if (!goalPage || !portfolio) return;
  goalPage.classList.add('hidden');
  portfolio.classList.remove('hidden');
  if (typeof setPageLocation === 'function') setPageLocation('ポートフォリオ');
  pfHideGoalOverwriteConfirm();
  renderPortfolio();
}

function pfReadGoalFormState() {
  let amountInput = document.getElementById('pfGoalAmountInput');
  return {
    amountYen: Number(amountInput && amountInput.value) || 0
  };
}

function pfIsGoalFormDirty() {
  let current = pfSerializeGoalState(pfReadGoalFormState());
  if (!pfGoalSettingsHasSaved()) {
    return current !== pfSerializeGoalState(pfGetDefaultGoalState());
  }
  return current !== pfGoalEditSnapshot;
}

function pfRenderGoalSettingsForm() {
  pfEnsurePortfolioGoalSettings();
  pfGoalEditSnapshot = pfSerializeGoalState(pfGetSavedGoalState());

  let amountInput = document.getElementById('pfGoalAmountInput');
  if (amountInput) {
    amountInput.value = pfGoalSettingsHasSaved()
      ? settings.portfolioGoal.amountYen
      : pfGetDefaultGoalState().amountYen;
  }

  pfHideGoalOverwriteConfirm();
  pfUpdateGoalSaveUi();
}

function pfOnGoalFormInput() {
  pfHideGoalOverwriteConfirm();
  pfUpdateGoalSaveUi();
}

function pfUpdateGoalSaveUi() {
  let saveBtn = document.getElementById('pfGoalSaveBtn');
  if (saveBtn) saveBtn.classList.remove('hidden');
}

function pfHideGoalOverwriteConfirm() {
  let confirm = document.getElementById('pfGoalOverwriteConfirm');
  let saveBtn = document.getElementById('pfGoalSaveBtn');
  if (confirm) confirm.classList.add('hidden');
  if (saveBtn) saveBtn.classList.remove('hidden');
}

function pfShowGoalOverwriteConfirm() {
  let confirm = document.getElementById('pfGoalOverwriteConfirm');
  let saveBtn = document.getElementById('pfGoalSaveBtn');
  if (confirm) confirm.classList.remove('hidden');
  if (saveBtn) saveBtn.classList.add('hidden');
}

function pfTrySaveGoalSettings() {
  if (pfGoalSettingsHasSaved()) {
    if (!pfIsGoalFormDirty()) {
      if (typeof showToast === 'function') showToast('変更はありません');
      return;
    }
    pfShowGoalOverwriteConfirm();
    return;
  }
  pfCommitGoalSettings();
}

function pfCancelGoalOverwrite() {
  pfHideGoalOverwriteConfirm();
}

function pfConfirmGoalOverwrite() {
  pfCommitGoalSettings();
}

function pfCommitGoalSettings() {
  pfEnsurePortfolioGoalSettings();
  let state = pfReadGoalFormState();
  settings.portfolioGoal.amountYen = Math.max(0, Math.round(state.amountYen));
  settings.portfolioGoal.savedAt = new Date().toLocaleString();
  settings.lastUpdate = settings.portfolioGoal.savedAt;
  pfGoalEditSnapshot = pfSerializeGoalState(state);
  pfPersistSettings();
  pfHideGoalOverwriteConfirm();
  if (typeof showToast === 'function') showToast('✅ 資産目標を保存しました');
  pfRenderGoalSettingsForm();
  renderPortfolio();
}

function pfRenderAllocation() {
  let el = document.getElementById('pfAllocationChart');
  if (!el) return;
  let operatingTotal = pfSumEnabledOperatingUsd();
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
    '<div class="pfDonutCenter"><span>運用額</span><b>' + pfMoneyUsd(operatingTotal) + '</b><small>(' + pfYenRef(operatingTotal) + ')</small></div></div>' +
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
    PF_STACK_ORDER.forEach(function (key) {
      let val = month[key] || 0;
      if (val <= 0) return;
      let h = axisMax > 0 ? (val / axisMax) * chartH : 0;
      segments.push('<div class="pfStackSeg pfStackSeg--' + key + '" style="height:' + h.toFixed(1) + 'px;background:' + PF_COLORS[key] + '"></div>');
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

  let legend = PF_STACK_ORDER.filter(function () { return true; }).map(function (key) {
    let names = { ram: 'RAM', orca: 'ORCA', cary: 'Cary Pact', genesis: 'GENESIS', other: 'その他' };
    return '<span class="pfStackLegendItem"><i style="background:' + PF_COLORS[key] + '"></i>' + names[key] + '</span>';
  }).join('');

  el.innerHTML =
    '<div class="pfStackChart">' +
    '<div class="pfStackYAxis">' + yTicks + '</div>' +
    '<div class="pfStackCols">' + cols + '</div></div>' +
    '<div class="pfStackLegend">' + legend + '</div>';
}

function pfSyncMainTabs(active) {
  document.querySelectorAll('[data-pf-main-tab]').forEach(function (btn) {
    let on = btn.getAttribute('data-pf-main-tab') === active;
    btn.classList.toggle('isActive', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function renderPortfolio() {
  if (typeof portfolioPage !== 'undefined' && portfolioPage.classList.contains('hidden')) return;
  pfSyncMainTabs('portfolio');
  pfEnsurePortfolioGoalSettings();
  pfRenderSummaryCards();
  pfRenderProjectCards();
  pfRenderAllocation();
  pfRenderStackedBars();
}
