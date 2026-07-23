/* OUKEI HUB Portfolio UI — Ver2.0.6 */

var PF_COLORS = {
  ram: '#f97316',
  orca: '#3b82f6',
  eni: '#a3e635',
  cary: '#a855f7',
  genesis: '#eab308',
  other: '#64748b'
};

var PF_STANDARD_PROJECTS = [
  { key: 'ram', name: 'RAM' },
  { key: 'orca', name: 'ORCA' },
  { key: 'cary', name: 'Cary Pact' },
  { key: 'genesis', name: 'Genesis' }
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
  { key: 'ram', name: 'Project A', color: PF_COLORS.ram, pct: 45.2 },
  { key: 'orca', name: 'Project B', color: PF_COLORS.orca, pct: 22.6 },
  { key: 'cary', name: 'OUKEI', color: PF_COLORS.cary, pct: 18.8 },
  { key: 'genesis', name: 'Sample G', color: PF_COLORS.genesis, pct: 9.5 },
  { key: 'other', name: 'その他', color: PF_COLORS.other, pct: 3.8 }
];

var PF_MOCK_STACKED = [
  { label: '1月', total: 9200, ram: 4160, orca: 2080, cary: 1730, genesis: 880, eni: 0, other: 350 },
  { label: '2月', total: 9800, ram: 4430, orca: 2210, cary: 1840, genesis: 940, eni: 0, other: 380 },
  { label: '3月', total: 10500, ram: 4750, orca: 2370, cary: 1970, genesis: 1000, eni: 0, other: 410 },
  { label: '4月', total: 11200, ram: 5060, orca: 2530, cary: 2100, genesis: 1070, eni: 0, other: 440 },
  { label: '5月', total: 11900, ram: 5380, orca: 2690, cary: 2230, genesis: 1140, eni: 0, other: 460 },
  { label: '6月', total: 12840, ram: 5800, orca: 2900, cary: 2410, genesis: 1220, eni: 0, other: 510 }
];

var PF_STACK_ORDER = ['ram', 'orca', 'cary', 'genesis', 'eni', 'other'];

var pfGoalEditSnapshot = '';
var pfOperatingEditId = null;
var pfOperatingFormMode = 'project';
var pfProfitEditId = null;
var pfProfitFormAllocation = 'flat';

function pfGetProjectColor(key) {
  if (typeof pjGetChartColor === 'function') return pjGetChartColor(key);
  return PF_COLORS[key] || PF_COLORS.other;
}

function pfRecoveryScaleMax(rate) {
  let r = Math.max(0, Number(rate) || 0);
  if (r < 100) return 100;
  return (Math.floor(r / 100) + 1) * 100;
}

function pfRecoveryFillPct(rate) {
  let r = Math.max(0, Number(rate) || 0);
  let max = pfRecoveryScaleMax(r);
  return Math.max(0, Math.min(100, (r / max) * 100));
}

function pfRecoveryMarkLeft(rate) {
  let max = pfRecoveryScaleMax(rate);
  if (max <= 100) return null;
  return (100 / max) * 100;
}

function pfRecoveryScaleHtml(rate) {
  let max = pfRecoveryScaleMax(rate);
  let labels = [];
  for (let i = 0; i <= max; i += 100) labels.push(i + '%');
  return labels.map(function (l) { return '<span>' + l + '</span>'; }).join('');
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

/** Portfolio USD display: < $1,000 → 2 decimals; ≥ $1,000 → truncate (no decimals). */
function pfMoneyUsd(amount) {
  let n = Number(amount) || 0;
  if (Math.abs(n) < 1000) {
    let rounded = Math.round(n * 100) / 100;
    return '$' + rounded.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  let truncated = n >= 0 ? Math.floor(n) : Math.ceil(n);
  return '$' + truncated.toLocaleString();
}

function pfYenRef(amountUsd) {
  return typeof yen === 'function' ? yen(amountUsd) : pfFormatYenPlain((amountUsd || 0) * pfGetYenRate());
}

function pfIsDemoMode() {
  return typeof pdIsDemoMode === 'function' && pdIsDemoMode();
}

function pfEmptyMark() {
  return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
}

function pfDisplayUsd(amount, hasValue) {
  if (!hasValue && !pfIsDemoMode()) return pfEmptyMark();
  return pfMoneyUsd(amount || 0);
}

function pfDisplayPct(pct, hasValue) {
  if (!hasValue && !pfIsDemoMode()) return pfEmptyMark();
  return pct + '%';
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

function pfEnsurePortfolioOperating() {
  if (typeof settings === 'undefined') return;
  if (!settings.portfolioOperating || typeof settings.portfolioOperating !== 'object') {
    settings.portfolioOperating = { displayMode: 'project', entries: [] };
  }
  if (!Array.isArray(settings.portfolioOperating.entries)) {
    settings.portfolioOperating.entries = [];
  }
  if (settings.portfolioOperating.displayMode !== 'project' &&
      settings.portfolioOperating.displayMode !== 'account') {
    settings.portfolioOperating.displayMode = 'project';
  }
}

function pfGenerateOperatingEntryId() {
  return 'po_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function pfGetOperatingAsOfDateKey() {
  if (typeof todayKey === 'function') return todayKey();
  let d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function pfNormalizeOperatingDateKey(val) {
  if (!val) return '';
  return String(val).trim();
}

function pfGetPortfolioOperatingEntries() {
  pfEnsurePortfolioOperating();
  return settings.portfolioOperating.entries.slice();
}

function pfFindPortfolioOperatingEntry(id) {
  if (!id) return null;
  return pfGetPortfolioOperatingEntries().find(function (e) { return e.id === id; }) || null;
}

function pfGetLatestOperatingEntryForProject(projectKey, dateKey, inputMode) {
  pfEnsurePortfolioOperating();
  let best = null;
  settings.portfolioOperating.entries.forEach(function (e) {
    if (e.inputMode !== inputMode || e.projectKey !== projectKey) return;
    if (e.effectiveDate > dateKey) return;
    if (!best || e.effectiveDate > best.effectiveDate) best = e;
  });
  return best;
}

function pfGetLatestOperatingEntryForAccount(accountId, projectKey, dateKey) {
  pfEnsurePortfolioOperating();
  let best = null;
  settings.portfolioOperating.entries.forEach(function (e) {
    if (e.inputMode !== 'account' || e.projectKey !== projectKey || e.accountId !== accountId) return;
    if (e.effectiveDate > dateKey) return;
    if (!best || e.effectiveDate > best.effectiveDate) best = e;
  });
  return best;
}

function pfGetProjectAccounts(projectKey) {
  if (projectKey === 'ram' && typeof getRamInputAccounts === 'function') {
    return getRamInputAccounts().map(function (a) {
      return { id: a.id, name: (a.username || a.id).replace(/^@/, '') };
    });
  }
  if (projectKey === 'orca' && typeof getOrcaInputAccounts === 'function') {
    return getOrcaInputAccounts().map(function (a) {
      return { id: a.id, name: (a.username || a.id).replace(/^@/, '') };
    });
  }
  if (projectKey === 'cary' && typeof getCaryInputAccounts === 'function') {
    return getCaryInputAccounts().map(function (a) {
      return { id: a.id, name: (a.username || a.id).replace(/^@/, '') };
    });
  }
  return [];
}

function pfGetPortfolioViewMonth() {
  let perf = typeof pdGetPortfolioSummary === 'function' ? pdGetPortfolioSummary() : null;
  if (perf && perf.viewYear != null && perf.viewMonth != null) {
    return { y: perf.viewYear, m: perf.viewMonth };
  }
  if (typeof hubGetViewMonth === 'function') {
    let v = hubGetViewMonth();
    if (v) return { y: v.y, m: v.m };
  }
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  return { y: ref.getFullYear(), m: ref.getMonth() };
}

function pfGetYieldProjectionDays(viewY, viewM) {
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  let viewingCurrentMonth = (viewY === ref.getFullYear() && viewM === ref.getMonth());
  let elapsedDays = viewingCurrentMonth ? ref.getDate() : daysInMonth;
  if (elapsedDays < 1) elapsedDays = 1;
  return { elapsedDays: elapsedDays, daysInMonth: daysInMonth };
}

function pfFormatPredictedMonthlyYield(monthlyRevenue, operatingUsd, viewY, viewM) {
  if (!operatingUsd || operatingUsd <= 0) return '--';
  let rev = Number(monthlyRevenue) || 0;
  let ctx = pfGetYieldProjectionDays(viewY, viewM);
  let projected = (rev / ctx.elapsedDays) * ctx.daysInMonth;
  let pct = Math.round((projected / operatingUsd) * 1000) / 10;
  return pct + '%';
}

function pfGetProfitAllocationEndMonth() {
  if (typeof hubGetViewMonth === 'function') {
    let v = hubGetViewMonth();
    if (v) return { y: v.y, m: v.m };
  }
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  return { y: ref.getFullYear(), m: ref.getMonth() };
}

function pfMonthKey(y, m) {
  return y + '-' + String(m + 1).padStart(2, '0');
}

function pfParseMonthKey(key) {
  let parts = String(key || '').split('-');
  if (parts.length !== 2) return null;
  return { y: Number(parts[0]), m: Number(parts[1]) - 1 };
}

function pfIterateMonthRange(startMonthKey, endY, endM) {
  let start = pfParseMonthKey(startMonthKey);
  if (!start) return [];
  let out = [];
  let y = start.y;
  let m = start.m;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ y: y, m: m, key: pfMonthKey(y, m) });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

function pfEnsurePortfolioProfit() {
  if (typeof settings === 'undefined') return;
  if (!settings.portfolioProfit || typeof settings.portfolioProfit !== 'object') {
    settings.portfolioProfit = { entries: [] };
  }
  if (!Array.isArray(settings.portfolioProfit.entries)) {
    settings.portfolioProfit.entries = [];
  }
}

function pfGenerateProfitEntryId() {
  return 'pp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function pfGetPortfolioProfitEntries() {
  pfEnsurePortfolioProfit();
  return settings.portfolioProfit.entries.slice();
}

function pfFindPortfolioProfitEntry(id) {
  if (!id) return null;
  return pfGetPortfolioProfitEntries().find(function (e) { return e.id === id; }) || null;
}

function pfSumPortfolioProfitTotals() {
  return pfGetPortfolioProfitEntries().reduce(function (sum, e) {
    return sum + (Number(e.totalUsd) || 0);
  }, 0);
}

function pfHasPortfolioProfitEntries() {
  return pfGetPortfolioProfitEntries().length > 0;
}

function pfAllocateProfitEntry(entry, endY, endM) {
  let months = pfIterateMonthRange(entry.startMonth, endY, endM);
  let out = {};
  if (!months.length) return out;
  if (entry.allocation === 'manual' && entry.manualMonths) {
    months.forEach(function (mo) {
      out[mo.key] = Math.round((Number(entry.manualMonths[mo.key]) || 0) * 100) / 100;
    });
    return out;
  }
  let total = Number(entry.totalUsd) || 0;
  let n = months.length;
  if (entry.allocation === 'growth') {
    let weightSum = (n * (n + 1)) / 2;
    months.forEach(function (mo, i) {
      out[mo.key] = Math.round((total * (i + 1) / weightSum) * 100) / 100;
    });
    return out;
  }
  let each = Math.round((total / n) * 100) / 100;
  months.forEach(function (mo) {
    out[mo.key] = each;
  });
  return out;
}

function pfGetPortfolioProfitOverlayForMonthKey(monthKey) {
  pfEnsurePortfolioProfit();
  let end = pfGetProfitAllocationEndMonth();
  let overlay = { total: 0 };
  PF_STACK_ORDER.forEach(function (k) { overlay[k] = 0; });
  settings.portfolioProfit.entries.forEach(function (entry) {
    if (!entry || !entry.startMonth) return;
    let dist = pfAllocateProfitEntry(entry, end.y, end.m);
    let amt = dist[monthKey] || 0;
    if (amt <= 0) return;
    let pk = entry.projectKey || 'other';
    if (overlay[pk] == null) overlay[pk] = 0;
    overlay[pk] += amt;
    overlay.total += amt;
  });
  overlay.total = Math.round(overlay.total * 100) / 100;
  return overlay;
}

function pfResolveStackedMonthKeys(endY, endM, count) {
  let keys = [];
  let y = endY;
  let m = endM;
  for (let i = 0; i < count; i++) {
    keys.unshift({ y: y, m: m, key: pfMonthKey(y, m) });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return keys;
}

function pfMergeMonthWithProfitOverlay(monthData, monthKey) {
  let merged = Object.assign({}, monthData);
  let overlay = pfGetPortfolioProfitOverlayForMonthKey(monthKey);
  PF_STACK_ORDER.forEach(function (k) {
    let add = Number(overlay[k]) || 0;
    if (add <= 0) return;
    merged[k] = Math.round(((Number(merged[k]) || 0) + add) * 100) / 100;
  });
  merged.total = Math.round(PF_STACK_ORDER.reduce(function (s, k) {
    return s + (Number(merged[k]) || 0);
  }, 0) * 100) / 100;
  merged.hasLog = merged.hasLog || overlay.total > 0;
  return merged;
}

function pfGetDisplayedTotalProfitUsd() {
  let base = 0;
  if (typeof pdSumAllTimeRevenue === 'function') {
    base = pdSumAllTimeRevenue().total;
  } else {
    base = pfSumEnabledProfitUsd();
  }
  return Math.round((base + pfSumPortfolioProfitTotals()) * 100) / 100;
}

function pfGetLegacyOperatingUsd(projectKey, dateKey) {
  if (typeof pdGetProjectOperatingUsd === 'function') {
    return pdGetProjectOperatingUsd(projectKey, dateKey);
  }
  return 0;
}

function pfGetLegacyAccountOperatingUsd(accountId, projectKey, dateKey) {
  if (typeof pdGetOperatingUsdAsOf === 'function') {
    return pdGetOperatingUsdAsOf(accountId, projectKey, dateKey);
  }
  return 0;
}

function pfResolvePortfolioOperatingUsd(projectKey, dateKey) {
  if (pfIsDemoMode()) return pfGetProjectMock(projectKey).operatingUsd;
  dateKey = dateKey || pfGetOperatingAsOfDateKey();
  pfEnsurePortfolioOperating();
  let mode = settings.portfolioOperating.displayMode || 'project';

  if (mode === 'project') {
    let entry = pfGetLatestOperatingEntryForProject(projectKey, dateKey, 'project');
    if (entry) return Math.max(0, Number(entry.amountUsd) || 0);
    return pfGetLegacyOperatingUsd(projectKey, dateKey);
  }

  let accounts = pfGetProjectAccounts(projectKey);
  if (!accounts.length) {
    let entry = pfGetLatestOperatingEntryForProject(projectKey, dateKey, 'project');
    if (entry) return Math.max(0, Number(entry.amountUsd) || 0);
    return pfGetLegacyOperatingUsd(projectKey, dateKey);
  }
  return accounts.reduce(function (sum, acc) {
    let entry = pfGetLatestOperatingEntryForAccount(acc.id, projectKey, dateKey);
    if (entry) return sum + Math.max(0, Number(entry.amountUsd) || 0);
    return sum + pfGetLegacyAccountOperatingUsd(acc.id, projectKey, dateKey);
  }, 0);
}

function pfSerializeGoalState(state) {
  return JSON.stringify(state);
}

function pfGetLiveOperatingUsd(projectKey) {
  return pfResolvePortfolioOperatingUsd(projectKey, pfGetOperatingAsOfDateKey());
}

function pfGetActiveProjects() {
  let list = typeof getEnabledHomeProjects === 'function'
    ? getEnabledHomeProjects()
    : [];
  if (typeof pdFilterProjectsWithData === 'function') {
    return pdFilterProjectsWithData(list);
  }
  return list;
}

function pfGetEnabledOperatingRows() {
  return pfGetActiveProjects().map(function (p) {
    let mock = pfGetProjectMock(p.key);
    return {
      key: p.key,
      name: p.name,
      operatingUsd: pfIsDemoMode() ? mock.operatingUsd : pfGetLiveOperatingUsd(p.key)
    };
  });
}

function pfGetEnabledProjectRows() {
  let list = pfGetActiveProjects();
  let cumulative = typeof pdSumAllTimeRevenue === 'function' ? pdSumAllTimeRevenue() : null;
  let hasRevenueLog = cumulative && cumulative.total > 0;
  let perf = pfGetPerformanceSummary();
  let viewMonth = perf
    ? { y: perf.viewYear, m: perf.viewMonth }
    : pfGetPortfolioViewMonth();
  let mockMonth = PF_MOCK_STACKED.length ? PF_MOCK_STACKED[PF_MOCK_STACKED.length - 1] : null;
  return list.map(function (p) {
    let mock = pfGetProjectMock(p.key);
    let operatingUsd = pfIsDemoMode() ? mock.operatingUsd : pfGetLiveOperatingUsd(p.key);
    let profitUsd = 0;
    if (pfIsDemoMode()) {
      profitUsd = mock.profitUsd;
    } else {
      profitUsd = pfGetDisplayedProjectProfitUsd(p.key);
    }
    let monthRev = 0;
    if (perf && perf.monthRevenueByProject && perf.monthRevenueByProject[p.key] != null) {
      monthRev = Number(perf.monthRevenueByProject[p.key]) || 0;
    } else if (pfIsDemoMode() && mockMonth) {
      monthRev = Number(mockMonth[p.key]) || 0;
    }
    let monthProfitUsd = monthRev;
    let monthYield = pfFormatPredictedMonthlyYield(monthRev, operatingUsd, viewMonth.y, viewMonth.m);
    let eniAvgDailyProfitUsd = 0;
    let eniCanForecast = false;
    let eniCycleDaysLeft = null;
    let eniCycleTargetDateStr = null;
    let eniCycleAchieved = false;
    // RAM / ORCA / ENI: 月末予測 = 直近14件平均日収 × 当月日数
    if ((p.key === 'ram' || p.key === 'orca' || p.key === 'eni') && !pfIsDemoMode()) {
      if (p.key === 'eni') {
        let eniPace = pfGetEniSharedPaceMetrics(operatingUsd, profitUsd);
        monthProfitUsd = eniPace.predictedMonthProfitUsd;
        monthYield = eniPace.predictedMonthYield;
        eniAvgDailyProfitUsd = eniPace.avgDailyProfitUsd;
        eniCanForecast = !!eniPace.canForecast;
        eniCycleDaysLeft = eniPace.cycleDaysLeft;
        eniCycleTargetDateStr = eniPace.cycleTargetDateStr;
        eniCycleAchieved = !!eniPace.cycleAchieved;
      } else {
        let pace = pfGetProjectSharedPaceMetrics(p.key, operatingUsd, viewMonth.y, viewMonth.m);
        if (pace.canForecast) {
          monthProfitUsd = pace.predictedMonthProfitUsd;
          monthYield = pace.predictedMonthYield;
        }
      }
    }
    let recovery = operatingUsd > 0
      ? Math.round((profitUsd / operatingUsd) * 1000) / 10
      : (pfIsDemoMode() ? mock.recovery : 0);
    return {
      key: p.key,
      name: p.name,
      start: typeof pmGetStartDate === 'function' ? pmGetStartDate(p.key) : mock.start,
      operatingUsd: operatingUsd,
      operating: pfDisplayUsd(operatingUsd, operatingUsd > 0),
      profit: pfDisplayUsd(profitUsd, profitUsd > 0 || hasRevenueLog),
      profitUsd: profitUsd,
      monthProfitUsd: monthProfitUsd,
      monthYield: monthYield,
      eniAvgDailyProfitUsd: eniAvgDailyProfitUsd,
      eniCanForecast: eniCanForecast,
      eniCycleDaysLeft: eniCycleDaysLeft,
      eniCycleTargetDateStr: eniCycleTargetDateStr,
      eniCycleAchieved: eniCycleAchieved,
      recovery: recovery,
      recoveryDisplay: pfDisplayPct(recovery, operatingUsd > 0 && profitUsd > 0),
      fill: pfRecoveryFillPct(recovery),
      recoveryDate: pfIsDemoMode() ? mock.recoveryDate : pfEmptyMark(),
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
  if (pfIsDemoMode()) {
    return pfGetAllPortfolioProjects().reduce(function (sum, p) {
      let mock = pfGetProjectMock(p.key);
      let rate = pfGetInclusionRate(p.key) / 100;
      return sum + (mock.operatingUsd * rate) + mock.profitUsd;
    }, 0);
  }
  let cumulative = typeof pdSumAllTimeRevenue === 'function' ? pdSumAllTimeRevenue() : null;
  return cumulative ? cumulative.total : 0;
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
  if (typeof hubSaveToStorage === 'function') {
    hubSaveToStorage();
    return;
  }
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    let key = typeof hubResolveStorageKey === 'function' ? hubResolveStorageKey() : 'oukei_hub_v15_data';
    localStorage.setItem(key, JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : '',
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

function pfGetPerformanceSummary() {
  if (typeof pdGetPortfolioSummary === 'function') {
    return pdGetPortfolioSummary();
  }
  return null;
}

function pfRenderSummaryCards() {
  let el = document.getElementById('pfSummaryGrid');
  if (!el) return;

  pfEnsurePortfolioGoalSettings();

  let operatingTotal = pfSumEnabledOperatingUsd();
  let profitTotal = pfGetDisplayedTotalProfitUsd();
  let perf = pfGetPerformanceSummary();
  let hasRevenueLog = perf && perf.hasRevenueLog;
  let hasProfitOverlay = pfHasPortfolioProfitEntries();
  if (!hasRevenueLog && !pfIsDemoMode() && !hasProfitOverlay) {
    profitTotal = pfSumEnabledProfitUsd();
  }
  let hasOperating = operatingTotal > 0;
  let hasProfit = profitTotal > 0;
  let profitRatio = hasOperating
    ? (Math.round((profitTotal / operatingTotal) * 1000) / 10) + '%'
    : '0%';
  let goal = pfCalcGoalProgress();

  let viewMonth = perf
    ? { y: perf.viewYear, m: perf.viewMonth }
    : pfGetPortfolioViewMonth();

  let monthly = { value: pfEmptyMark(), sub: '', trend: '', trendPct: null, yieldPct: '--' };
  if (pfIsDemoMode() && !hasRevenueLog) {
    monthly = Object.assign({}, PF_MOCK_SUMMARY_DATA.monthly, {
      trendPct: 8.2,
      trend: typeof pdFormatTrendPct === 'function' ? pdFormatTrendPct(8.2) : '+8.2%',
      yieldPct: pfFormatPredictedMonthlyYield(
        12840,
        operatingTotal > 0 ? operatingTotal : 115000,
        viewMonth.y,
        viewMonth.m
      )
    });
  }
  if (hasRevenueLog) {
    monthly = {
      value: pfDisplayUsd(perf.monthlyRevenue, perf.monthlyRevenue > 0 || hasRevenueLog),
      sub: perf.monthlyRevenue > 0 ? pfYenRef(perf.monthlyRevenue) : pfEmptyMark(),
      trend: perf.monthlyRevenueTrend,
      trendPct: typeof perf.monthlyRevenueTrendPct === 'number' ? perf.monthlyRevenueTrendPct : null,
      yieldPct: pfFormatPredictedMonthlyYield(
        perf.monthlyRevenue,
        operatingTotal,
        perf.viewYear,
        perf.viewMonth
      )
    };
  }

  function cardHtml(opts) {
    let attrs = 'class="pfSummaryCard pfSummaryCard--' + opts.accent + (opts.clickable ? ' isClickable' : '') + '"';
    if (opts.click) attrs += ' role="button" tabindex="0" onclick="' + opts.click + '" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){' + opts.click + ';event.preventDefault()}"';
    let foot = '';
    if (opts.yieldPct) {
      foot += '<div class="pfSummaryYield"><span>予測月利</span><b>' + opts.yieldPct + '</b></div>';
    }
    if (opts.trend != null && opts.trend !== '' && opts.trendArrow !== false) {
      let deltaHtml = typeof pdRenderTrendDeltaHtml === 'function'
        ? pdRenderTrendDeltaHtml(opts.trendPct != null ? opts.trendPct : opts.trend)
        : ('<b>' + opts.trend + '</b>');
      foot += '<div class="pfSummaryTrend">' +
        '<span class="pfSummaryTrendLabel">' + opts.trendLabel + '</span> ' + deltaHtml +
        '</div>';
    } else if (opts.trend && opts.trendArrow === false) {
      foot += '<div class="pfSummaryTrend pfSummaryTrend--neutral">' +
        opts.trendLabel + ' <b>' + opts.trend + '</b></div>';
    }
    return '<article ' + attrs + '>' +
      '<div class="pfSummaryCardGlow"></div>' +
      pfSummaryIcon(opts.icon) +
      '<div class="pfSummaryLabel">' + opts.label + '</div>' +
      '<div class="pfSummaryValue">' + opts.value + '</div>' +
      (opts.sub ? '<div class="pfSummarySub">' + opts.sub + '</div>' : '') +
      foot + '</article>';
  }

  el.className = 'pfSummaryGrid pfSummaryGrid--quad';
  el.innerHTML =
    cardHtml({
      accent: 'invest', icon: 'wallet', label: '運用額',
      value: pfDisplayUsd(operatingTotal, hasOperating), sub: hasOperating ? pfYenRef(operatingTotal) : pfEmptyMark(),
      clickable: true, click: 'pfOpenOperatingSettings()'
    }) +
    cardHtml({
      accent: 'profit', icon: 'coins', label: '総利益',
      value: pfDisplayUsd(profitTotal, hasProfit || hasRevenueLog || hasProfitOverlay),
      sub: (hasProfit || hasRevenueLog || hasProfitOverlay) ? pfYenRef(profitTotal) : pfEmptyMark(),
      trend: hasOperating ? profitRatio : pfEmptyMark(), trendLabel: '運用額比', trendArrow: false,
      clickable: true, click: 'pfOpenProfitSettings()'
    }) +
    cardHtml({
      accent: 'monthly', icon: 'calendar', label: '月間収益',
      value: monthly.value, sub: monthly.sub,
      yieldPct: monthly.yieldPct,
      trend: monthly.trend, trendPct: monthly.trendPct, trendLabel: '前月比'
    }) +
    '<article class="pfSummaryCard pfSummaryCard--goal isClickable" role="button" tabindex="0" onclick="pfOpenGoalSettings()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){pfOpenGoalSettings();event.preventDefault()}">' +
    '<div class="pfSummaryCardGlow"></div>' +
    pfSummaryIcon('target') +
    '<div class="pfSummaryLabel">資産目標</div>' +
    '<div class="pfSummaryValue pfSummaryValue--goal">' + pfFormatYen(goal.goalYen) + '</div>' +
    '<div class="pfGoalMeta"><span>進捗</span><b>' + goal.pct + '%</b></div>' +
    '<div class="pfGoalBar"><div class="pfGoalBarFill" style="width:' + Math.min(100, goal.pct) + '%"></div></div>' +
    '<div class="pfGoalRemain">あと ' + pfFormatYen(goal.remain) + '</div></article>';
}

function pfFormatYieldFromAmount(monthlyAmount, operatingUsd) {
  if (!operatingUsd || operatingUsd <= 0) return '--';
  let pct = Math.round(((Number(monthlyAmount) || 0) / operatingUsd) * 1000) / 10;
  return pct + '%';
}

function pfCalcYieldPctValue(amount, operatingUsd) {
  if (!operatingUsd || operatingUsd <= 0) return null;
  return ((Number(amount) || 0) / operatingUsd) * 100;
}

function pfFormatYieldDisplay(pctValue, hasOperating) {
  if (!hasOperating) return pfEmptyMark();
  if (pctValue == null || isNaN(pctValue)) return '0%';
  return (Math.round(pctValue * 10) / 10) + '%';
}

function pfFormatMonthlyUsd(amount) {
  return pfMoneyUsd(amount);
}

function pfFormatMonthlyUsdRounded(amount) {
  return pfMoneyUsd(amount);
}

function pfGetRamAggregateTotals() {
  if (typeof aggregateTotals !== 'function') return null;
  return aggregateTotals();
}

function pfGetOrcaAggregateTotals() {
  if (typeof orcaAggregateTotals !== 'function') return null;
  return orcaAggregateTotals();
}

function pfScaleProfitSegmentsToTotal(segments, targetTotal) {
  let list = (segments || []).map(function (s) {
    return Object.assign({}, s, { amount: Math.max(0, Number(s.amount) || 0) });
  });
  let sum = list.reduce(function (acc, s) { return acc + s.amount; }, 0);
  let target = Math.max(0, Number(targetTotal) || 0);
  if (!(sum > 0) || !(target > 0)) return list;
  let k = target / sum;
  return list.map(function (s) {
    return Object.assign({}, s, { amount: s.amount * k });
  });
}

function pfGetProjectProfitBreakdown(projectKey, operatingUsd) {
  operatingUsd = Number(operatingUsd) || 0;
  let hasOperating = operatingUsd > 0;
  let viewMonth = pfGetPortfolioViewMonth();
  let pace = (projectKey === 'ram' || projectKey === 'orca' || projectKey === 'eni')
    ? pfGetProjectSharedPaceMetrics(projectKey, operatingUsd, viewMonth.y, viewMonth.m)
    : null;
  let pacedPredicted = pace && pace.canForecast
    ? Math.max(0, Number(pace.predictedMonthProfitUsd) || 0)
    : null;

  if (projectKey === 'ram') {
    let agg = pfGetRamAggregateTotals();
    if (!agg && pacedPredicted == null) return null;
    let personal = Math.max(0, Number(agg && agg.personal) || 0);
    let direct = Math.max(0, Number(agg && agg.direct) || 0);
    let second = Math.max(0, Number(agg && agg.second) || 0);
    let title = Math.max(0, Number(agg && agg.title) || 0);
    let referral = direct + second;
    let orgTotal = personal + referral + title;
    let predicted = pacedPredicted != null
      ? pacedPredicted
      : Math.max(0, Number(agg && agg.total) || orgTotal || 0);
    let chartSegments = pfScaleProfitSegmentsToTotal([
      { key: 'personal', label: '個人運用利益', amount: personal, color: '#fdba74' },
      { key: 'referral', label: '紹介報酬', amount: referral, color: '#fb923c' },
      { key: 'title', label: 'タイトル報酬', amount: title, color: '#f97316' }
    ], predicted);
    let scaledPersonal = chartSegments[0] ? chartSegments[0].amount : personal;
    let scaledOrg = predicted - scaledPersonal;
    return {
      projectKey: 'ram',
      theme: 'ram',
      operatingUsd: operatingUsd,
      hasOperating: hasOperating,
      personal: scaledPersonal,
      personalYield: pfCalcYieldPctValue(scaledPersonal, operatingUsd),
      org: Math.max(0, scaledOrg),
      orgYield: pfCalcYieldPctValue(scaledOrg, operatingUsd),
      predicted: predicted,
      predictedYield: pfCalcYieldPctValue(predicted, operatingUsd),
      pace: pace,
      chartSegments: chartSegments
    };
  }

  if (projectKey === 'orca') {
    let agg = pfGetOrcaAggregateTotals();
    if (!agg && pacedPredicted == null) return null;
    let ai = Math.max(0, Number(agg && agg.personal) || 0);
    let affiliate = Math.max(0, Number(agg && agg.ranking) || 0);
    let predicted = pacedPredicted != null
      ? pacedPredicted
      : Math.max(0, Number(agg && agg.total) || 0);
    let chartSegments = pfScaleProfitSegmentsToTotal([
      { key: 'ai', label: 'AI利益', amount: ai, color: '#67e8f9' },
      { key: 'affiliate', label: 'アフィリエイト利益', amount: affiliate, color: '#06b6d4' }
    ], predicted);
    let scaledAi = chartSegments[0] ? chartSegments[0].amount : ai;
    let scaledAf = chartSegments[1] ? chartSegments[1].amount : affiliate;
    return {
      projectKey: 'orca',
      theme: 'orca',
      operatingUsd: operatingUsd,
      hasOperating: hasOperating,
      ai: scaledAi,
      aiYield: pfCalcYieldPctValue(scaledAi, operatingUsd),
      affiliate: scaledAf,
      affiliateYield: pfCalcYieldPctValue(scaledAf, operatingUsd),
      predicted: predicted,
      predictedYield: pfCalcYieldPctValue(predicted, operatingUsd),
      pace: pace,
      chartSegments: chartSegments
    };
  }

  return null;
}

function pfRenderProfitPieChart(segments, theme, predicted, predictedYield, hasOperating) {
  let positive = (segments || []).filter(function (s) { return (Number(s.amount) || 0) > 0; });
  let total = positive.reduce(function (sum, s) { return sum + (Number(s.amount) || 0); }, 0);
  if (total <= 0) {
    return '<div class="pfProfitPieEmpty">利益データがありません</div>';
  }
  let start = 0;
  let stops = positive.map(function (s) {
    let pct = ((Number(s.amount) || 0) / total) * 100;
    let end = start + pct;
    let stop = s.color + ' ' + start + '% ' + end + '%';
    start = end;
    return stop;
  });
  let legend = positive.map(function (s) {
    let amt = Number(s.amount) || 0;
    let share = Math.round((amt / total) * 1000) / 10;
    return '<div class="pfProfitPieLegendItem">' +
      '<i class="pfProfitPieSwatch" style="background:' + s.color + '"></i>' +
      '<span class="pfProfitPieLegendLabel">' + pfEscape(s.label) + '</span>' +
      '<div class="pfProfitPieLegendValues">' +
      '<span class="pfProfitPieLegendAmt">' + pfFormatMonthlyUsd(amt) + '</span>' +
      '<span class="pfProfitPieLegendPct">' + share + '%</span>' +
      '</div></div>';
  }).join('');
  return '<div class="pfProfitPieBlock pfProfitPieBlock--' + theme + '">' +
    '<div class="pfProfitPieChartWrap">' +
    '<div class="pfProfitPieChart" style="background:conic-gradient(' + stops.join(', ') + ')" aria-hidden="true">' +
    '<div class="pfProfitPieHole">' +
    '<span class="pfProfitPieCenterMain">' + pfMoneyUsd(predicted) + '</span>' +
    '<span class="pfProfitPieCenterSub">' + pfFormatYieldDisplay(predictedYield, hasOperating) + '</span>' +
    '</div></div></div>' +
    '<div class="pfProfitPieLegend">' + legend + '</div></div>';
}

function pfRenderForecastSection(breakdown) {
  let pace = breakdown && breakdown.pace;
  let paceHtml = '';
  if (pace && pace.canForecast) {
    paceHtml =
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">平均日収</span>' +
      '<b class="pfProfitDetailVal">' + pfMoneyUsd(pace.avgDailyProfitUsd) + '</b></div>' +
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">直近入力件数</span>' +
      '<b class="pfProfitDetailVal">' + (Number(pace.paceSampleDays) || 0) + '件</b></div>' +
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">当月日数</span>' +
      '<b class="pfProfitDetailVal">' + (Number(pace.daysInMonth) || 0) + '日</b></div>' +
      '<p class="help" style="margin:6px 0 10px">月末予測 ＝ 平均日収 × 当月日数（直近最大14件の実績入力）</p>';
  }
  return '<section class="pfProfitDetailSection pfProfitDetailSection--forecast">' +
    '<div class="pfProfitDetailSectionTitle">予測</div>' +
    paceHtml +
    '<div class="pfProfitDetailRow pfProfitDetailRow--emph"><span class="pfProfitDetailLabel">月末予測</span>' +
    '<b class="pfProfitDetailVal pfProfitDetailVal--emph">' + pfMoneyUsd(breakdown.predicted) + '</b></div>' +
    '<div class="pfProfitDetailRow pfProfitDetailRow--emph"><span class="pfProfitDetailLabel">予測月利</span>' +
    '<b class="pfProfitDetailVal pfProfitDetailVal--emph">' + pfFormatYieldDisplay(breakdown.predictedYield, breakdown.hasOperating) + '</b></div>' +
    '</section>';
}

function pfRenderProjectProfitDetailBody(breakdown) {
  if (!breakdown) {
    return '<div class="explain">集計データを取得できませんでした。</div>';
  }
  let divider = '<div class="pfProfitDetailDivider"></div>';
  let pie = '<section class="pfProfitDetailSection pfProfitDetailSection--chart">' +
    '<div class="pfProfitDetailSectionTitle">月末予測の内訳</div>' +
    pfRenderProfitPieChart(
      breakdown.chartSegments,
      breakdown.theme,
      breakdown.predicted,
      breakdown.predictedYield,
      breakdown.hasOperating
    ) +
    '</section>';

  if (breakdown.projectKey === 'ram') {
    return '<div class="pfProfitDetail pfProfitDetail--ram">' +
      '<section class="pfProfitDetailSection">' +
      '<div class="pfProfitDetailSectionTitle">個人運用</div>' +
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">個人運用利益</span>' +
      '<b class="pfProfitDetailVal">' + pfFormatMonthlyUsd(breakdown.personal) + '</b></div>' +
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">個人運用月利</span>' +
      '<b class="pfProfitDetailVal">' + pfFormatYieldDisplay(breakdown.personalYield, breakdown.hasOperating) + '</b></div>' +
      '</section>' + divider +
      '<section class="pfProfitDetailSection">' +
      '<div class="pfProfitDetailSectionTitle">組織</div>' +
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">組織利益</span>' +
      '<span class="pfProfitDetailSub">（紹介・タイトル報酬）</span>' +
      '<b class="pfProfitDetailVal">' + pfFormatMonthlyUsd(breakdown.org) + '</b></div>' +
      '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">組織月利</span>' +
      '<b class="pfProfitDetailVal">' + pfFormatYieldDisplay(breakdown.orgYield, breakdown.hasOperating) + '</b></div>' +
      '</section>' + divider +
      pfRenderForecastSection(breakdown) + pie + '</div>';
  }

  return '<div class="pfProfitDetail pfProfitDetail--orca">' +
    '<section class="pfProfitDetailSection">' +
    '<div class="pfProfitDetailSectionTitle">AI運用</div>' +
    '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">AI利益</span>' +
    '<b class="pfProfitDetailVal">' + pfFormatMonthlyUsd(breakdown.ai) + '</b></div>' +
    '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">AI運用月利</span>' +
    '<b class="pfProfitDetailVal">' + pfFormatYieldDisplay(breakdown.aiYield, breakdown.hasOperating) + '</b></div>' +
    '</section>' + divider +
    '<section class="pfProfitDetailSection">' +
    '<div class="pfProfitDetailSectionTitle">アフィリエイト</div>' +
    '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">アフィリエイト利益</span>' +
    '<b class="pfProfitDetailVal">' + pfFormatMonthlyUsd(breakdown.affiliate) + '</b></div>' +
    '<div class="pfProfitDetailRow"><span class="pfProfitDetailLabel">アフィリエイト月利</span>' +
    '<b class="pfProfitDetailVal">' + pfFormatYieldDisplay(breakdown.affiliateYield, breakdown.hasOperating) + '</b></div>' +
    '</section>' + divider +
    pfRenderForecastSection(breakdown) + pie + '</div>';
}

function pfRenderHundredPctReturnHtml(row) {
  let operating = Number(row.operatingUsd) || 0;
  let cumulativeProfit = Number(row.profitUsd) || 0;
  let recovery = Number(row.recovery) || 0;
  let monthProfit = Number(row.monthProfitUsd) || 0;
  let achieved = recovery >= 100 || (operating > 0 && cumulativeProfit >= operating);
  if (achieved) {
    return '<div class="pfHundredReturnRow">' +
      '<span>100%利回りまで</span>' +
      '<b class="pfHundredReturnDone">達成済み ✅</b></div>';
  }
  if (monthProfit <= 0) {
    return '<div class="pfHundredReturnRow">' +
      '<span>100%利回りまで</span>' +
      '<b class="pfHundredReturnUnknown">計算できません</b></div>';
  }
  let remaining = Math.max(0, operating - cumulativeProfit);
  let dailyProfit = monthProfit / 30;
  let daysLeft = Math.max(1, Math.ceil(remaining / dailyProfit));
  let target = new Date();
  target.setDate(target.getDate() + daysLeft);
  let dateStr = target.getFullYear() + '/' +
    String(target.getMonth() + 1).padStart(2, '0') + '/' +
    String(target.getDate()).padStart(2, '0');
  return '<div class="pfHundredReturnRow">' +
    '<span>100%利回りまで</span>' +
    '<b class="pfHundredReturnInline">あと' + daysLeft + '日（' + dateStr + '予定）</b></div>';
}

/** ENI cycle target: 3.5x of operating capital (profit / operating == 3.5 → 100%). */
var PF_ENI_CYCLE_MULTIPLE = 3.5;

function pfEniDateKey(y, m, d) {
  if (typeof revenueDateKey === 'function') return revenueDateKey(y, m, d);
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/** True when the day has ENI profit fields saved (not operationAmount / balance only). */
function pfEniDayHasPaceInput(entry) {
  if (!entry) return false;
  if (entry.eniAccounts) {
    return Object.keys(entry.eniAccounts).some(function (id) {
      let ae = entry.eniAccounts[id];
      if (!ae || typeof ae !== 'object') return false;
      if (ae.dailyProfit != null && ae.dailyProfit !== '') return true;
      if (ae.todayRevenue != null && ae.todayRevenue !== '') return true;
      if (ae.referralProfit != null || ae.titleProfit != null) return true;
      return false;
    });
  }
  return entry.eni != null && entry.eni !== '';
}

function pfEniDayProfitUsd(entry) {
  if (!entry) return 0;
  if (entry.eniAccounts && typeof pdEniAccountRevenueTotal === 'function') {
    let sum = 0;
    Object.keys(entry.eniAccounts).forEach(function (id) {
      sum += pdEniAccountRevenueTotal(entry.eniAccounts[id]);
    });
    return sum;
  }
  return Number(entry.eni) || 0;
}

/**
 * Build target date string: today + daysLeft → YYYY/MM/DD
 */
function pfFormatEniTargetDateStr(fromDate, daysLeft) {
  let targetDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  targetDate.setDate(targetDate.getDate() + daysLeft);
  return targetDate.getFullYear() + '/' +
    String(targetDate.getMonth() + 1).padStart(2, '0') + '/' +
    String(targetDate.getDate()).padStart(2, '0');
}

/** Lookback window for month-end forecast average (performance input days). */
var PF_PACE_LOOKBACK_DAYS = 14;

/**
 * 月末予測（RAM / ORCA / ENI 共通）
 * 平均日収 = 直近最大14件の実績入力の平均（14件未満は全件）
 * 月末予測 = 平均日収 × 当月日数
 */
function pfGetProjectSharedPaceMetrics(projectKey, operatingUsd, viewY, viewM) {
  let op = Number(operatingUsd) || 0;
  let now = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let y = viewY != null ? Number(viewY) : now.getFullYear();
  let m = viewM != null ? Number(viewM) : now.getMonth();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let isCurrentMonth = (y === now.getFullYear() && m === now.getMonth());
  let todayD = isCurrentMonth ? now.getDate() : daysInMonth;
  let remainingDaysInMonth = isCurrentMonth ? Math.max(0, daysInMonth - todayD) : 0;
  let scanEnd = isCurrentMonth ? todayD : daysInMonth;
  let endKey = pfEniDateKey(y, m, scanEnd);

  function dayProfitFor(entry, dateKey) {
    if (!entry) return 0;
    if (projectKey === 'eni') return pfEniDayProfitUsd(entry);
    if (typeof pdSumProjectDayRevenue === 'function') {
      return Number(pdSumProjectDayRevenue(entry, projectKey, dateKey)) || 0;
    }
    return Number(entry[projectKey]) || 0;
  }

  function dayHasInput(entry, dateKey) {
    if (!entry) return false;
    if (projectKey === 'eni') return pfEniDayHasPaceInput(entry);
    if (typeof pdProjectDayHasRevenue === 'function') {
      return pdProjectDayHasRevenue(entry, projectKey, dateKey);
    }
    return dayProfitFor(entry, dateKey) !== 0 || entry[projectKey] != null;
  }

  function roundProject(v) {
    if (typeof pdRoundEni === 'function' && projectKey === 'eni') return pdRoundEni(v);
    if (typeof pdRound === 'function') return pdRound(v);
    return Math.round((Number(v) || 0) * 10000) / 10000;
  }

  // Month-to-date sum (display / compatibility)
  let monthProfit = 0;
  let latestDaily = 0;
  let latestDay = 0;
  let positiveDays = 0;
  for (let d = 1; d <= scanEnd; d++) {
    let dateKey = pfEniDateKey(y, m, d);
    let entry = typeof pdGetRevenueEntry === 'function'
      ? pdGetRevenueEntry(dateKey)
      : (typeof settings !== 'undefined' && settings && settings.revenueLog
        ? settings.revenueLog[dateKey]
        : null);
    if (!dayHasInput(entry, dateKey)) continue;
    let dayProfit = roundProject(dayProfitFor(entry, dateKey));
    monthProfit += dayProfit;
    latestDaily = dayProfit;
    latestDay = d;
    if (Math.abs(dayProfit) > 0) positiveDays += 1;
  }
  monthProfit = roundProject(monthProfit);
  latestDaily = roundProject(latestDaily);

  // Last up-to-14 performance input days (newest first), capped at endKey
  let keys = typeof pdListRevenueDateKeys === 'function'
    ? pdListRevenueDateKeys()
    : (typeof settings !== 'undefined' && settings && settings.revenueLog
      ? Object.keys(settings.revenueLog).sort()
      : []);
  let samples = [];
  for (let i = keys.length - 1; i >= 0 && samples.length < PF_PACE_LOOKBACK_DAYS; i--) {
    let dateKey = keys[i];
    if (dateKey > endKey) continue;
    let entry = typeof pdGetRevenueEntry === 'function'
      ? pdGetRevenueEntry(dateKey)
      : (settings && settings.revenueLog ? settings.revenueLog[dateKey] : null);
    if (!dayHasInput(entry, dateKey)) continue;
    samples.push(roundProject(dayProfitFor(entry, dateKey)));
  }

  let sampleCount = samples.length;
  let sampleSum = samples.reduce(function (acc, v) { return acc + v; }, 0);
  let avgDaily = sampleCount > 0 ? (sampleSum / sampleCount) : 0;
  avgDaily = roundProject(avgDaily);
  let predictedMonth = roundProject(avgDaily * daysInMonth);
  let canForecast = sampleCount > 0;

  return {
    projectKey: projectKey,
    avgDailyProfitUsd: avgDaily,
    latestDailyProfitUsd: latestDaily,
    latestDailyDay: latestDay,
    monthProfitToDateUsd: monthProfit,
    monthInputDays: positiveDays,
    paceSampleDays: sampleCount,
    daysInMonth: daysInMonth,
    remainingDaysInMonth: remainingDaysInMonth,
    predictedMonthProfitUsd: canForecast ? predictedMonth : 0,
    predictedMonthYield: canForecast ? pfFormatYieldFromAmount(predictedMonth, op) : '--',
    canForecast: canForecast,
    year: y,
    month: m
  };
}

/**
 * ENI pace source used by:
 * - 月末予測 / 予測月利（共通着地予想）
 * - 3.5倍までの残り日数 / 到達予定日（avgDaily ベース）
 */
function pfGetEniSharedPaceMetrics(operatingUsd, cumulativeProfitUsd) {
  let op = Number(operatingUsd) || 0;
  let cumulative = Number(cumulativeProfitUsd) || 0;
  let now = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let pace = pfGetProjectSharedPaceMetrics('eni', op, now.getFullYear(), now.getMonth());
  let avgDaily = Number(pace.avgDailyProfitUsd) || 0;

  let empty = {
    avgDailyProfitUsd: 0,
    latestDailyProfitUsd: 0,
    monthProfitToDateUsd: pace.monthProfitToDateUsd || 0,
    monthInputDays: pace.monthInputDays || 0,
    paceSampleDays: pace.paceSampleDays || 0,
    daysInMonth: pace.daysInMonth || 0,
    remainingDaysInMonth: pace.remainingDaysInMonth || 0,
    predictedMonthProfitUsd: 0,
    predictedMonthYield: '--',
    canForecast: false,
    cycleDaysLeft: null,
    cycleTargetDateStr: null,
    cycleAchieved: op > 0 && cumulative >= (op * PF_ENI_CYCLE_MULTIPLE)
  };

  if (!pace.canForecast) return empty;

  let targetProfit = op * PF_ENI_CYCLE_MULTIPLE;
  let cycleAchieved = op > 0 && cumulative >= targetProfit;
  let cycleDaysLeft = null;
  let cycleTargetDateStr = null;
  if (!cycleAchieved && op > 0 && avgDaily > 0) {
    let remainingNeed = Math.max(0, targetProfit - cumulative);
    cycleDaysLeft = Math.max(1, Math.ceil(remainingNeed / avgDaily));
    cycleTargetDateStr = pfFormatEniTargetDateStr(now, cycleDaysLeft);
  }

  return {
    avgDailyProfitUsd: avgDaily,
    latestDailyProfitUsd: pace.latestDailyProfitUsd,
    monthProfitToDateUsd: pace.monthProfitToDateUsd,
    monthInputDays: pace.monthInputDays,
    paceSampleDays: pace.paceSampleDays,
    daysInMonth: pace.daysInMonth,
    remainingDaysInMonth: pace.remainingDaysInMonth,
    predictedMonthProfitUsd: pace.predictedMonthProfitUsd,
    predictedMonthYield: pace.predictedMonthYield,
    canForecast: true,
    cycleDaysLeft: cycleDaysLeft,
    cycleTargetDateStr: cycleTargetDateStr,
    cycleAchieved: cycleAchieved
  };
}

function pfCalcEniCycleProgressPct(operatingUsd, profitUsd) {
  let op = Number(operatingUsd) || 0;
  let profit = Number(profitUsd) || 0;
  if (op <= 0) return null;
  return Math.round(((profit / (op * PF_ENI_CYCLE_MULTIPLE)) * 1000)) / 10;
}

function pfFormatEniProgressPctDisplay(progressPct) {
  if (progressPct == null || !isFinite(progressPct)) return '--';
  return (Math.round(Number(progressPct) * 10) / 10) + '%';
}

function pfRenderEniCycleEtaHtml(row) {
  if (row.eniCycleAchieved) {
    return '<div class="pfHundredReturnRow">' +
      '<span>3.5倍まで</span>' +
      '<b class="pfHundredReturnDone">達成済み ✅</b></div>';
  }
  // Recompute from shared avgDaily (never predictedMonth / 30, never row.monthProfitUsd / 30)
  let avgDaily = Number(row.eniAvgDailyProfitUsd) || 0;
  let op = Number(row.operatingUsd) || 0;
  let cumulative = Number(row.profitUsd) || 0;
  if (!(avgDaily > 0) || op <= 0 || !row.eniCanForecast) {
    return '<div class="pfHundredReturnRow">' +
      '<span>3.5倍まで</span>' +
      '<b class="pfHundredReturnUnknown">計算できません</b></div>';
  }
  let remainingNeed = Math.max(0, (op * PF_ENI_CYCLE_MULTIPLE) - cumulative);
  let daysLeft = Math.max(1, Math.ceil(remainingNeed / avgDaily));
  let dateStr = pfFormatEniTargetDateStr(new Date(), daysLeft);
  return '<div class="pfHundredReturnRow">' +
    '<span>3.5倍まで</span>' +
    '<b class="pfHundredReturnInline">あと' + daysLeft + '日（' + dateStr + '予定）</b></div>';
}

function pfRenderEniCycleBlockHtml(row) {
  let progress = pfCalcEniCycleProgressPct(row.operatingUsd, row.profitUsd);
  let progressDisplay = pfFormatEniProgressPctDisplay(progress);
  let fillPct = progress == null ? 0 : Math.max(0, Math.min(100, progress));
  return '<div class="pfRecoveryBlock pfRecoveryBlock--eniCycle">' +
    '<div class="pfRecoveryLabel"><span>進捗割合</span><b>' + progressDisplay + '</b></div>' +
    '<div class="pfRecoveryTrack"><div class="pfRecoveryFill" style="width:' + fillPct + '%"></div></div>' +
    '<div class="pfRecoveryScale"><span>0%</span><span>100%</span></div></div>' +
    pfRenderEniCycleEtaHtml(row);
}

function pfOpenProjectProfitDetail(projectKey) {
  if (projectKey !== 'ram' && projectKey !== 'orca') return;
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  let rows = pfGetEnabledProjectRows();
  let row = rows.find(function (r) { return r.key === projectKey; });
  let operatingUsd = row ? row.operatingUsd : pfGetLiveOperatingUsd(projectKey);
  let breakdown = pfGetProjectProfitBreakdown(projectKey, operatingUsd);
  let projectName = row ? row.name : (projectKey === 'ram' ? 'RAM' : 'ORCA');
  modalTitle.textContent = projectName + ' — 利益構成・月利詳細';
  modalContent.innerHTML = pfRenderProjectProfitDetailBody(breakdown);
  modalBg.style.display = 'flex';
}

var PF_MOCK_SUMMARY_DATA = {
  monthly: { value: '$12,840', sub: '(¥1,999,200)', trend: '+8.2%' }
};

function pfRenderProjectCard(row) {
  let isDetailCard = row.key === 'ram' || row.key === 'orca';
  let isUnifiedMetrics = isDetailCard || row.key === 'eni';
  let cardClass = 'pfProjectCard pfProjectCard--' + row.key + (isDetailCard ? ' isClickable' : '');
  let cardAttrs = 'class="' + cardClass + '"';
  if (isDetailCard) {
    cardAttrs += ' role="button" tabindex="0" onclick="pfOpenProjectProfitDetail(\'' + row.key + '\')" ' +
      'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){pfOpenProjectProfitDetail(\'' + row.key + '\');event.preventDefault()}"';
  }
  let icon = typeof pjRenderProjectIcon === 'function'
    ? pjRenderProjectIcon(row.key, 'pfProjectCardIcon')
    : (typeof renderHomeProjIcon === 'function'
      ? renderHomeProjIcon(row.key, 'pfProjectCardIcon')
      : '<span class="pfProjectCardIcon"></span>');
  let monthProfitMetric = '';
  if (isUnifiedMetrics) {
    monthProfitMetric = '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">月末予測</span><span class="pfProjectMetricVal isProfit">' +
      pfMoneyUsd(row.monthProfitUsd || 0) + '</span></div>';
  }
  let recoveryMarkLeft = row.key === 'eni' ? null : pfRecoveryMarkLeft(row.recovery);
  let bottomHtml = '';
  if (row.key === 'eni') {
    bottomHtml = pfRenderEniCycleBlockHtml(row);
  } else {
    bottomHtml =
      '<div class="pfRecoveryBlock">' +
      '<div class="pfRecoveryLabel"><span>累計利回り</span><b>' + (row.recoveryDisplay || row.recovery + '%') + '</b></div>' +
      '<div class="pfRecoveryTrack"><div class="pfRecoveryFill" style="width:' + row.fill + '%"></div>' +
      (recoveryMarkLeft != null
        ? '<i class="pfRecoveryMark" style="left:' + recoveryMarkLeft + '%"></i>'
        : '') +
      '</div>' +
      '<div class="pfRecoveryScale">' + pfRecoveryScaleHtml(row.recovery) + '</div></div>' +
      (isDetailCard
        ? pfRenderHundredPctReturnHtml(row)
        : '<div class="pfRecoveryDateRow"><span>回収予定日</span><b>' + pfEscape(row.recoveryDate) + '</b></div>');
  }
  return '<article ' + cardAttrs + ' data-pj-icon-key="' + pfEscape(row.key) + '">' +
    '<div class="pfProjectCardGlow"></div>' +
    '<div class="pfProjectCardTop">' +
    '<div class="pfProjectCardBrand">' + icon +
    '<div><h3 class="pfProjectCardName">' + pfEscape(row.name) + '</h3>' +
    '<p class="pfProjectStart">開始日 ' + pfEscape(row.start) + '</p></div></div>' +
    '<span class="pfStatusBadge pfStatusBadge--' + row.statusCls + '">' + pfEscape(row.status) + '</span></div>' +
    '<div class="pfProjectMetrics' + (isUnifiedMetrics ? ' pfProjectMetrics--detail' : '') + '">' +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">運用額</span><span class="pfProjectMetricVal">' + row.operating + '</span></div>' +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">累計利益</span><span class="pfProjectMetricVal isProfit">' + row.profit + '</span></div>' +
    monthProfitMetric +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">予測月利</span><span class="pfProjectMetricVal isYield">' + pfEscape(row.monthYield || '--') + '</span></div>' +
    '<div class="pfProjectMetric"><span class="pfProjectMetricLabel">累計利回り</span><span class="pfProjectMetricVal isRecovery">' + (row.recoveryDisplay || row.recovery + '%') + '</span></div>' +
    '</div>' +
    bottomHtml +
    (isDetailCard ? '<div class="pfProjectCardHint">タップで利益構成・月利詳細</div>' : '') +
    '</article>';
}

function pfRenderProjectCards() {
  let el = document.getElementById('pfProjectGrid');
  if (!el) return;
  let rows = pfGetEnabledProjectRows();
  el.style.setProperty('--pf-cols', String(
    typeof homeResponsiveGridCols === 'function'
      ? homeResponsiveGridCols(rows.length)
      : Math.min(Math.max(rows.length, 1), 5)
  ));
  el.setAttribute('data-count', rows.length);
  if (!rows.length) {
    if (typeof pjClearHtmlKeepIconsCache === 'function') pjClearHtmlKeepIconsCache(el);
    el.innerHTML = '<div class="pfEmptyCard"><p>表示ONのプロジェクトがありません。</p></div>';
    el.classList.add('isEmpty');
    return;
  }
  el.classList.remove('isEmpty');
  let html = rows.map(pfRenderProjectCard).join('');
  if (typeof pjSetHtmlKeepIcons === 'function') pjSetHtmlKeepIcons(el, html);
  else el.innerHTML = html;
}

function pfGetOperatingAccountLabel(projectKey, accountId) {
  if (!accountId) return '—';
  let acc = pfGetProjectAccounts(projectKey).find(function (a) { return a.id === accountId; });
  return acc ? acc.name : accountId;
}

function pfGetOperatingProjectLabel(projectKey) {
  let p = pfGetAllPortfolioProjects().find(function (x) { return x.key === projectKey; });
  return p ? p.name : projectKey;
}

function pfSetOperatingDisplayMode(mode) {
  pfEnsurePortfolioOperating();
  if (mode !== 'project' && mode !== 'account') return;
  settings.portfolioOperating.displayMode = mode;
  pfPersistSettings();
  pfRenderOperatingSettingsPage();
  if (typeof showToast === 'function') showToast('✅ 集計方法を変更しました');
}

function pfSetOperatingFormMode(mode) {
  if (mode !== 'project' && mode !== 'account') return;
  pfOperatingFormMode = mode;
  pfOperatingEditId = null;
  pfRenderOperatingSettingsPage();
}

function pfReadOperatingFormState() {
  let projectEl = document.getElementById('pfOperatingProject');
  let accountEl = document.getElementById('pfOperatingAccount');
  let amountEl = document.getElementById('pfOperatingAmount');
  let dateEl = document.getElementById('pfOperatingEffectiveDate');
  return {
    inputMode: pfOperatingFormMode,
    projectKey: projectEl ? projectEl.value : '',
    accountId: accountEl ? accountEl.value : '',
    amountUsd: Number(amountEl && amountEl.value) || 0,
    effectiveDate: pfNormalizeOperatingDateKey(dateEl && dateEl.value)
  };
}

function pfValidateOperatingForm(state) {
  if (!state.projectKey) return 'プロジェクトを選択してください。';
  if (state.inputMode === 'account' && !state.accountId) return 'アカウントを選択してください。';
  if (!state.effectiveDate) return '適用日を入力してください。';
  if (state.amountUsd <= 0) return '運用額（USD）を入力してください。';
  return '';
}

function pfCommitOperatingEntry() {
  let state = pfReadOperatingFormState();
  let err = pfValidateOperatingForm(state);
  if (err) {
    alert(err);
    return;
  }
  pfEnsurePortfolioOperating();
  let now = new Date().toLocaleString();
  if (pfOperatingEditId && pfFindPortfolioOperatingEntry(pfOperatingEditId)) {
    settings.portfolioOperating.entries = settings.portfolioOperating.entries.map(function (e) {
      if (e.id !== pfOperatingEditId) return e;
      return Object.assign({}, e, {
        inputMode: state.inputMode,
        projectKey: state.projectKey,
        accountId: state.inputMode === 'account' ? state.accountId : null,
        amountUsd: Math.max(0, Math.round(state.amountUsd * 100) / 100),
        effectiveDate: state.effectiveDate,
        updatedAt: now
      });
    });
  } else {
    settings.portfolioOperating.entries.push({
      id: pfGenerateOperatingEntryId(),
      inputMode: state.inputMode,
      projectKey: state.projectKey,
      accountId: state.inputMode === 'account' ? state.accountId : null,
      amountUsd: Math.max(0, Math.round(state.amountUsd * 100) / 100),
      effectiveDate: state.effectiveDate,
      savedAt: now,
      updatedAt: now
    });
  }
  settings.lastUpdate = now;
  pfOperatingEditId = null;
  pfPersistSettings();
  if (typeof showToast === 'function') showToast('✅ 運用額を保存しました');
  pfRenderOperatingSettingsPage();
  renderPortfolio();
}

function pfEditOperatingEntry(id) {
  let entry = pfFindPortfolioOperatingEntry(id);
  if (!entry) return;
  pfOperatingEditId = entry.id;
  pfOperatingFormMode = entry.inputMode === 'account' ? 'account' : 'project';
  pfRenderOperatingSettingsPage();
}

function pfCancelOperatingEdit() {
  pfOperatingEditId = null;
  pfRenderOperatingSettingsPage();
}

function pfDeleteOperatingEntry(id) {
  let entry = pfFindPortfolioOperatingEntry(id);
  if (!entry) return;
  let label = entry.inputMode === 'account'
    ? pfGetOperatingProjectLabel(entry.projectKey) + ' / ' + pfGetOperatingAccountLabel(entry.projectKey, entry.accountId)
    : pfGetOperatingProjectLabel(entry.projectKey);
  if (!confirm(label + '（' + entry.effectiveDate + '）の履歴を削除しますか？')) return;
  pfEnsurePortfolioOperating();
  settings.portfolioOperating.entries = settings.portfolioOperating.entries.filter(function (e) {
    return e.id !== id;
  });
  if (pfOperatingEditId === id) pfOperatingEditId = null;
  settings.lastUpdate = new Date().toLocaleString();
  pfPersistSettings();
  if (typeof showToast === 'function') showToast('🗑 履歴を削除しました');
  pfRenderOperatingSettingsPage();
  renderPortfolio();
}

function pfRenderOperatingCurrentSummary() {
  let dateKey = pfGetOperatingAsOfDateKey();
  let rows = pfGetEnabledOperatingRows();
  let total = rows.reduce(function (sum, row) { return sum + row.operatingUsd; }, 0);
  let mode = settings.portfolioOperating.displayMode || 'project';
  let modeLabel = mode === 'account' ? 'アカウント別集計' : 'プロジェクト別集計';
  let rowHtml = rows.map(function (row) {
    return '<div class="pfOperatingSummaryRow"><span>' + pfEscape(row.name) + '</span><b>' +
      pfFormatOperatingUsd(row.operatingUsd) + '</b></div>';
  }).join('');
  return '<div class="pfOperatingSummary panel">' +
    '<div class="pfOperatingSummaryTitle">現在の運用額（' + pfEscape(dateKey) + ' 時点）</div>' +
    '<p class="help">集計方法: ' + modeLabel + '。ポートフォリオ専用データを優先し、未入力分のみ組織図・実績入力の値を参照します。</p>' +
    rowHtml +
    '<div class="pfOperatingSummaryTotal"><span>合計</span><b>' + pfFormatOperatingUsd(total) + '</b></div>' +
    '</div>';
}

function pfRenderOperatingSettingsPage() {
  let el = document.getElementById('pfOperatingMain');
  if (!el) return;
  pfEnsurePortfolioOperating();
  let displayMode = settings.portfolioOperating.displayMode || 'project';
  let projects = pfGetAllPortfolioProjects();
  let formProject = projects[0] ? projects[0].key : 'ram';
  let editEntry = pfOperatingEditId ? pfFindPortfolioOperatingEntry(pfOperatingEditId) : null;
  if (editEntry) {
    pfOperatingFormMode = editEntry.inputMode === 'account' ? 'account' : 'project';
    formProject = editEntry.projectKey;
  }
  let accounts = pfGetProjectAccounts(formProject);
  let defaultDate = pfGetOperatingAsOfDateKey();
  let formAmount = editEntry ? editEntry.amountUsd : '';
  let formDate = editEntry ? editEntry.effectiveDate : defaultDate;
  let formAccount = editEntry && editEntry.accountId ? editEntry.accountId : (accounts[0] ? accounts[0].id : '');

  let projectOptions = projects.map(function (p) {
    let sel = p.key === formProject ? ' selected' : '';
    return '<option value="' + pfEscape(p.key) + '"' + sel + '>' + pfEscape(p.name) + '</option>';
  }).join('');

  let accountOptions = accounts.map(function (a) {
    let sel = a.id === formAccount ? ' selected' : '';
    return '<option value="' + pfEscape(a.id) + '"' + sel + '>' + pfEscape(a.name) + '</option>';
  }).join('');

  let history = pfGetPortfolioOperatingEntries().slice().sort(function (a, b) {
    if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? 1 : -1;
    return (b.updatedAt || b.savedAt || '').localeCompare(a.updatedAt || a.savedAt || '');
  });

  let historyRows = history.length ? history.map(function (e) {
    let scope = e.inputMode === 'account'
      ? pfEscape(pfGetOperatingProjectLabel(e.projectKey)) + ' / ' + pfEscape(pfGetOperatingAccountLabel(e.projectKey, e.accountId))
      : pfEscape(pfGetOperatingProjectLabel(e.projectKey));
    let modeBadge = e.inputMode === 'account' ? 'アカウント別' : 'プロジェクト別';
    return '<div class="pfOperatingHistoryRow' + (pfOperatingEditId === e.id ? ' isEditing' : '') + '">' +
      '<div class="pfOperatingHistoryMeta">' +
      '<b>' + pfEscape(e.effectiveDate) + '</b>' +
      '<span>' + scope + '</span>' +
      '<small>' + modeBadge + '</small>' +
      '</div>' +
      '<div class="pfOperatingHistoryVal">' + pfFormatOperatingUsd(e.amountUsd) + '</div>' +
      '<div class="pfOperatingHistoryActions">' +
      '<button type="button" class="btn2" onclick=\'pfEditOperatingEntry(' + JSON.stringify(e.id) + ')\'>編集</button>' +
      '<button type="button" class="btnDanger" onclick=\'pfDeleteOperatingEntry(' + JSON.stringify(e.id) + ')\'>削除</button>' +
      '</div></div>';
  }).join('') : '<p class="help pfOperatingHistoryEmpty">' + pfEmptyMark() + ' 履歴はまだありません。</p>';

  el.innerHTML =
    '<div class="pfOperatingSettingsHead">' +
    '<button type="button" class="btn2 pfOperatingBackBtn" onclick="pfCloseOperatingSettings()">← 戻る</button>' +
    '<h2 class="pfTitle">運用額の設定</h2>' +
    '<p class="help pfOperatingIntro">この画面では、各プロジェクトの管理アプリに表示されている現在の運用額を登録できます。プロジェクト単位でも、アカウント単位でも、お好みの方法で管理できます。</p>' +
    '</div>' +
    pfRenderOperatingCurrentSummary() +
    '<div class="pfOperatingPanel panel">' +
    '<div class="pfOperatingSectionTitle">集計方法（表示用）</div>' +
    '<div class="pfOperatingModeTabs" role="tablist">' +
    '<button type="button" class="pfOperatingModeTab' + (displayMode === 'project' ? ' isActive' : '') +
      '" onclick="pfSetOperatingDisplayMode(\'project\')">プロジェクト単位で入力</button>' +
    '<button type="button" class="pfOperatingModeTab' + (displayMode === 'account' ? ' isActive' : '') +
      '" onclick="pfSetOperatingDisplayMode(\'account\')">アカウント単位で入力</button>' +
    '</div>' +
    '<p class="help">サマリー・資産配分に反映する集計方法です。入力履歴自体は両方の方式で保持されます。</p>' +
    '</div>' +
    '<div class="pfOperatingPanel panel">' +
    '<div class="pfOperatingSectionTitle">' + (editEntry ? '履歴を編集' : '運用額を登録') + '</div>' +
    '<div class="pfOperatingFormMode">' +
    '<span class="help">入力単位</span>' +
    '<div class="pfOperatingModeTabs pfOperatingModeTabs--sub">' +
    '<button type="button" class="pfOperatingModeTab' + (pfOperatingFormMode === 'project' ? ' isActive' : '') +
      '" onclick="pfSetOperatingFormMode(\'project\')">プロジェクト別</button>' +
    '<button type="button" class="pfOperatingModeTab' + (pfOperatingFormMode === 'account' ? ' isActive' : '') +
      '" onclick="pfSetOperatingFormMode(\'account\')">アカウント別</button>' +
    '</div></div>' +
    '<label for="pfOperatingProject">プロジェクト</label>' +
    '<select id="pfOperatingProject" onchange="pfOperatingProjectChanged()">' + projectOptions + '</select>' +
    (pfOperatingFormMode === 'account'
      ? '<label for="pfOperatingAccount">アカウント</label>' +
        '<select id="pfOperatingAccount"' + (accounts.length ? '' : ' disabled') + '>' +
        (accounts.length ? accountOptions : '<option value="">アカウントがありません</option>') +
        '</select>'
      : '') +
    '<label for="pfOperatingAmount">現在の運用額（USD）</label>' +
    '<input id="pfOperatingAmount" type="number" min="0" step="0.01" placeholder="40000" value="' +
      (formAmount !== '' ? pfEscape(String(formAmount)) : '') + '">' +
    '<label for="pfOperatingEffectiveDate">適用日（この日付以降に反映）</label>' +
    '<input id="pfOperatingEffectiveDate" type="date" value="' + pfEscape(formDate) + '">' +
    '<p class="help">同じプロジェクト（またはアカウント）で適用日が異なる履歴を複数登録できます。表示は適用日が新しいものを優先します。</p>' +
    '<div class="pfOperatingFormActions">' +
    (editEntry ? '<button type="button" class="btn2" onclick="pfCancelOperatingEdit()">キャンセル</button>' : '') +
    '<button type="button" onclick="pfCommitOperatingEntry()">' + (editEntry ? '更新する' : '登録する') + '</button>' +
    '</div></div>' +
    '<div class="pfOperatingPanel panel">' +
    '<div class="pfOperatingSectionTitle">入力履歴</div>' +
    '<div class="pfOperatingHistoryList">' + historyRows + '</div>' +
    '</div>';
}

function pfOperatingProjectChanged() {
  pfRenderOperatingSettingsPage();
}

function pfOpenOperatingSettings() {
  let page = document.getElementById('pfOperatingSettingsPage');
  let portfolio = document.getElementById('portfolioPage');
  if (!page || !portfolio) return;
  pfEnsurePortfolioOperating();
  pfOperatingEditId = null;
  pfOperatingFormMode = settings.portfolioOperating.displayMode === 'account' ? 'account' : 'project';
  portfolio.classList.add('hidden');
  page.classList.remove('hidden');
  if (typeof setPageLocation === 'function') setPageLocation('運用額設定');
  pfRenderOperatingSettingsPage();
}

function pfCloseOperatingSettings() {
  let page = document.getElementById('pfOperatingSettingsPage');
  let portfolio = document.getElementById('portfolioPage');
  if (!page || !portfolio) return;
  pfOperatingEditId = null;
  page.classList.add('hidden');
  portfolio.classList.remove('hidden');
  if (typeof setPageLocation === 'function') setPageLocation('ポートフォリオ');
  renderPortfolio();
}

function pfGetDisplayedProjectProfitUsd(projectKey) {
  let profitUsd = 0;
  if (typeof pdSumAllTimeRevenue === 'function') {
    let cumulative = pdSumAllTimeRevenue();
    profitUsd = Number(cumulative.byProject[projectKey]) || 0;
  }
  pfGetPortfolioProfitEntries().forEach(function (entry) {
    if (entry.projectKey !== projectKey) return;
    profitUsd += Number(entry.totalUsd) || 0;
  });
  return Math.round(profitUsd * 100) / 100;
}

function pfDefaultProfitStartMonth(projectKey) {
  if (typeof pmGetStartDate === 'function') {
    let sd = pmGetStartDate(projectKey);
    let m = String(sd || '').match(/(\d{4})[-/.](\d{1,2})/);
    if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
  }
  let end = pfGetProfitAllocationEndMonth();
  return pfMonthKey(end.y, Math.max(0, end.m - 5));
}

function pfFormatAllocationLabel(mode) {
  if (mode === 'growth') return '右肩上がり';
  if (mode === 'manual') return '手動';
  return '平均';
}

function pfRenderProfitManualMonthsSection(startMonth) {
  if (pfProfitFormAllocation !== 'manual') return '';
  let end = pfGetProfitAllocationEndMonth();
  let months = pfIterateMonthRange(startMonth, end.y, end.m);
  if (!months.length) {
    return '<p class="help">開始月を選択してください。</p>';
  }
  let editEntry = pfProfitEditId ? pfFindPortfolioProfitEntry(pfProfitEditId) : null;
  let manual = editEntry && editEntry.manualMonths ? editEntry.manualMonths : {};
  let rows = months.map(function (mo) {
    let val = manual[mo.key] != null ? manual[mo.key] : '';
    return '<div class="pfProfitManualRow">' +
      '<label for="pfProfitManual_' + mo.key + '">' + mo.key + '</label>' +
      '<input id="pfProfitManual_' + mo.key + '" type="number" min="0" step="0.01" data-pf-profit-month="' + mo.key + '" value="' +
      (val !== '' ? pfEscape(String(val)) : '') + '">' +
      '</div>';
  }).join('');
  return '<div class="pfOperatingSectionTitle">月別配分（手動）</div>' +
    '<div class="pfProfitManualGrid">' + rows + '</div>' +
    '<p class="help">各月の利益を個別に入力します。未入力の月は0として扱います。</p>';
}

function pfReadProfitFormState() {
  let projectEl = document.getElementById('pfProfitProject');
  let accountEl = document.getElementById('pfProfitAccount');
  let startEl = document.getElementById('pfProfitStartMonth');
  let totalEl = document.getElementById('pfProfitTotalUsd');
  let manualMonths = {};
  if (pfProfitFormAllocation === 'manual') {
    document.querySelectorAll('[data-pf-profit-month]').forEach(function (input) {
      let key = input.getAttribute('data-pf-profit-month');
      if (!key) return;
      let v = Number(input.value);
      if (v > 0) manualMonths[key] = Math.round(v * 100) / 100;
    });
  }
  let totalUsd = Number(totalEl && totalEl.value) || 0;
  if (pfProfitFormAllocation === 'manual') {
    totalUsd = Object.keys(manualMonths).reduce(function (sum, k) {
      return sum + (Number(manualMonths[k]) || 0);
    }, 0);
    totalUsd = Math.round(totalUsd * 100) / 100;
  }
  return {
    projectKey: projectEl ? projectEl.value : 'ram',
    accountId: accountEl && accountEl.value ? accountEl.value : null,
    startMonth: startEl ? startEl.value : '',
    totalUsd: totalUsd,
    allocation: pfProfitFormAllocation,
    manualMonths: manualMonths
  };
}

function pfCommitProfitEntry() {
  let state = pfReadProfitFormState();
  if (!state.projectKey) {
    alert('プロジェクトを選択してください。');
    return;
  }
  if (!state.startMonth || !/^\d{4}-\d{2}$/.test(state.startMonth)) {
    alert('開始月を正しく入力してください。');
    return;
  }
  if (state.totalUsd <= 0) {
    alert('総利益（USD）を入力してください。');
    return;
  }
  pfEnsurePortfolioProfit();
  let now = new Date().toLocaleString();
  if (pfProfitEditId && pfFindPortfolioProfitEntry(pfProfitEditId)) {
    settings.portfolioProfit.entries = settings.portfolioProfit.entries.map(function (e) {
      if (e.id !== pfProfitEditId) return e;
      return Object.assign({}, e, {
        projectKey: state.projectKey,
        accountId: state.accountId,
        startMonth: state.startMonth,
        totalUsd: state.totalUsd,
        allocation: state.allocation,
        manualMonths: state.allocation === 'manual' ? state.manualMonths : null,
        updatedAt: now
      });
    });
  } else {
    settings.portfolioProfit.entries.push({
      id: pfGenerateProfitEntryId(),
      projectKey: state.projectKey,
      accountId: state.accountId,
      startMonth: state.startMonth,
      totalUsd: state.totalUsd,
      allocation: state.allocation,
      manualMonths: state.allocation === 'manual' ? state.manualMonths : null,
      savedAt: now,
      updatedAt: now
    });
  }
  settings.lastUpdate = now;
  pfProfitEditId = null;
  pfPersistSettings();
  if (typeof showToast === 'function') showToast('✅ 総利益を保存しました');
  pfRenderProfitSettingsPage();
  renderPortfolio();
}

function pfEditProfitEntry(id) {
  let entry = pfFindPortfolioProfitEntry(id);
  if (!entry) return;
  pfProfitEditId = entry.id;
  pfProfitFormAllocation = entry.allocation || 'flat';
  pfRenderProfitSettingsPage();
}

function pfCancelProfitEdit() {
  pfProfitEditId = null;
  pfRenderProfitSettingsPage();
}

function pfDeleteProfitEntry(id) {
  let entry = pfFindPortfolioProfitEntry(id);
  if (!entry) return;
  let label = pfGetOperatingProjectLabel(entry.projectKey);
  if (entry.accountId) {
    label += ' / ' + pfGetOperatingAccountLabel(entry.projectKey, entry.accountId);
  }
  if (!confirm(label + '（' + entry.startMonth + '〜）の総利益登録を削除しますか？')) return;
  pfEnsurePortfolioProfit();
  settings.portfolioProfit.entries = settings.portfolioProfit.entries.filter(function (e) {
    return e.id !== id;
  });
  if (pfProfitEditId === id) pfProfitEditId = null;
  settings.lastUpdate = new Date().toLocaleString();
  pfPersistSettings();
  if (typeof showToast === 'function') showToast('🗑 総利益登録を削除しました');
  pfRenderProfitSettingsPage();
  renderPortfolio();
}

function pfSetProfitAllocation(mode) {
  pfProfitFormAllocation = mode;
  pfRenderProfitSettingsPage();
}

function pfProfitProjectChanged() {
  pfRenderProfitSettingsPage();
}

function pfProfitStartMonthChanged() {
  pfRenderProfitSettingsPage();
}

function pfRenderProfitCurrentSummary() {
  let entries = pfGetPortfolioProfitEntries();
  if (!entries.length) {
    return '<div class="pfOperatingSummary panel">' +
      '<div class="pfOperatingSummaryTitle">登録済みの総利益</div>' +
      '<p class="help">' + pfEmptyMark() + ' まだ登録がありません。収益管理に未登録の過去利益をここで追加できます。</p>' +
      '</div>';
  }
  let byProject = {};
  entries.forEach(function (e) {
    let k = e.projectKey || 'other';
    byProject[k] = (byProject[k] || 0) + (Number(e.totalUsd) || 0);
  });
  let rowHtml = pfGetAllPortfolioProjects().map(function (p) {
    let amt = byProject[p.key] || 0;
    if (amt <= 0) return '';
    return '<div class="pfOperatingSummaryRow"><span>' + pfEscape(p.name) + '</span><b>' +
      pfFormatOperatingUsd(amt) + '</b></div>';
  }).join('');
  let total = pfSumPortfolioProfitTotals();
  return '<div class="pfOperatingSummary panel">' +
    '<div class="pfOperatingSummaryTitle">登録済みの総利益（ポートフォリオ加算分）</div>' +
    '<p class="help">収益管理の累計に加えて表示されます。revenueLog 自体は変更しません。</p>' +
    rowHtml +
    '<div class="pfOperatingSummaryTotal"><span>合計</span><b>' + pfFormatOperatingUsd(total) + '</b></div>' +
    '</div>';
}

function pfRenderProfitSettingsPage() {
  let el = document.getElementById('pfProfitMain');
  if (!el) return;
  pfEnsurePortfolioProfit();
  let projects = pfGetAllPortfolioProjects();
  let formProject = projects[0] ? projects[0].key : 'ram';
  let editEntry = pfProfitEditId ? pfFindPortfolioProfitEntry(pfProfitEditId) : null;
  if (editEntry) {
    formProject = editEntry.projectKey;
    pfProfitFormAllocation = editEntry.allocation || 'flat';
  }
  let accounts = pfGetProjectAccounts(formProject);
  let formStart = editEntry ? editEntry.startMonth : pfDefaultProfitStartMonth(formProject);
  let formTotal = editEntry ? editEntry.totalUsd : '';
  let formAccount = editEntry && editEntry.accountId ? editEntry.accountId : '';

  let projectOptions = projects.map(function (p) {
    let sel = p.key === formProject ? ' selected' : '';
    return '<option value="' + pfEscape(p.key) + '"' + sel + '>' + pfEscape(p.name) + '</option>';
  }).join('');

  let accountOptions = '<option value="">プロジェクト全体</option>' + accounts.map(function (a) {
    let sel = a.id === formAccount ? ' selected' : '';
    return '<option value="' + pfEscape(a.id) + '"' + sel + '>' + pfEscape(a.name) + '</option>';
  }).join('');

  let history = pfGetPortfolioProfitEntries().slice().sort(function (a, b) {
    if (a.startMonth !== b.startMonth) return a.startMonth < b.startMonth ? 1 : -1;
    return (b.updatedAt || b.savedAt || '').localeCompare(a.updatedAt || a.savedAt || '');
  });

  let historyRows = history.length ? history.map(function (e) {
    let scope = pfEscape(pfGetOperatingProjectLabel(e.projectKey));
    if (e.accountId) {
      scope += ' / ' + pfEscape(pfGetOperatingAccountLabel(e.projectKey, e.accountId));
    }
    return '<div class="pfOperatingHistoryRow' + (pfProfitEditId === e.id ? ' isEditing' : '') + '">' +
      '<div class="pfOperatingHistoryMeta">' +
      '<b>' + pfEscape(e.startMonth) + ' 〜</b>' +
      '<span>' + scope + '</span>' +
      '<small>' + pfFormatAllocationLabel(e.allocation) + '</small>' +
      '</div>' +
      '<div class="pfOperatingHistoryVal">' + pfFormatOperatingUsd(e.totalUsd) + '</div>' +
      '<div class="pfOperatingHistoryActions">' +
      '<button type="button" class="btn2" onclick=\'pfEditProfitEntry(' + JSON.stringify(e.id) + ')\'>編集</button>' +
      '<button type="button" class="btnDanger" onclick=\'pfDeleteProfitEntry(' + JSON.stringify(e.id) + ')\'>削除</button>' +
      '</div></div>';
  }).join('') : '<p class="help pfOperatingHistoryEmpty">' + pfEmptyMark() + ' 履歴はまだありません。</p>';

  let alloc = pfProfitFormAllocation;
  el.innerHTML =
    '<div class="pfOperatingSettingsHead">' +
    '<button type="button" class="btn2 pfOperatingBackBtn" onclick="pfCloseProfitSettings()">← 戻る</button>' +
    '<h2 class="pfTitle">総利益の設定</h2>' +
    '<p class="pfSubtitle">収益管理に未登録の過去利益を、プロジェクト単位で追加できます</p>' +
    '<p class="help pfOperatingIntro">収益管理の実績に加えて、ポートフォリオ表示用の総利益を登録します。グラフへの配分は開始月から表示月まで、選択した方式で自動計算されます。</p>' +
    '</div>' +
    pfRenderProfitCurrentSummary() +
    '<div class="pfOperatingPanel panel">' +
    '<div class="pfOperatingSectionTitle">' + (editEntry ? '登録を編集' : '総利益を登録') + '</div>' +
    '<label for="pfProfitProject">プロジェクト</label>' +
    '<select id="pfProfitProject" onchange="pfProfitProjectChanged()">' + projectOptions + '</select>' +
    '<label for="pfProfitAccount">アカウント（任意）</label>' +
    '<select id="pfProfitAccount"' + (accounts.length ? '' : ' disabled') + '>' +
    (accounts.length ? accountOptions : '<option value="">アカウントがありません</option>') +
    '</select>' +
    '<label for="pfProfitStartMonth">開始月（この月から配分）</label>' +
    '<input id="pfProfitStartMonth" type="month" value="' + pfEscape(formStart) + '" onchange="pfProfitStartMonthChanged()">' +
    '<label for="pfProfitTotalUsd">総利益（USD）</label>' +
    '<input id="pfProfitTotalUsd" type="number" min="0" step="0.01" placeholder="5000"' +
    (alloc === 'manual' ? ' readonly' : '') +
    ' value="' + (formTotal !== '' ? pfEscape(String(formTotal)) : '') + '">' +
    (alloc === 'manual' ? '<p class="help">手動配分では、下の月別入力の合計が総利益になります。</p>' : '') +
    '<div class="pfOperatingSectionTitle">配分方式</div>' +
    '<div class="pfOperatingModeTabs pfOperatingModeTabs--sub">' +
    '<button type="button" class="pfOperatingModeTab' + (alloc === 'flat' ? ' isActive' : '') +
      '" onclick="pfSetProfitAllocation(\'flat\')">平均</button>' +
    '<button type="button" class="pfOperatingModeTab' + (alloc === 'growth' ? ' isActive' : '') +
      '" onclick="pfSetProfitAllocation(\'growth\')">右肩上がり</button>' +
    '<button type="button" class="pfOperatingModeTab' + (alloc === 'manual' ? ' isActive' : '') +
      '" onclick="pfSetProfitAllocation(\'manual\')">手動</button>' +
    '</div>' +
    '<p class="help">平均：各月均等 / 右肩上がり：後の月ほど多め / 手動：月ごとに入力</p>' +
    pfRenderProfitManualMonthsSection(formStart) +
    '<div class="pfOperatingFormActions">' +
    (editEntry ? '<button type="button" class="btn2" onclick="pfCancelProfitEdit()">キャンセル</button>' : '') +
    '<button type="button" onclick="pfCommitProfitEntry()">' + (editEntry ? '更新する' : '登録する') + '</button>' +
    '</div></div>' +
    '<div class="pfOperatingPanel panel">' +
    '<div class="pfOperatingSectionTitle">登録履歴</div>' +
    '<div class="pfOperatingHistoryList">' + historyRows + '</div>' +
    '</div>';
}

function pfOpenProfitSettings() {
  let page = document.getElementById('pfProfitSettingsPage');
  let portfolio = document.getElementById('portfolioPage');
  if (!page || !portfolio) return;
  pfEnsurePortfolioProfit();
  pfProfitEditId = null;
  pfProfitFormAllocation = 'flat';
  portfolio.classList.add('hidden');
  page.classList.remove('hidden');
  if (typeof setPageLocation === 'function') setPageLocation('総利益設定');
  pfRenderProfitSettingsPage();
}

function pfCloseProfitSettings() {
  let page = document.getElementById('pfProfitSettingsPage');
  let portfolio = document.getElementById('portfolioPage');
  if (!page || !portfolio) return;
  pfProfitEditId = null;
  page.classList.add('hidden');
  portfolio.classList.remove('hidden');
  if (typeof setPageLocation === 'function') setPageLocation('ポートフォリオ');
  renderPortfolio();
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

function pfBuildAllocationRows() {
  let rows = pfGetEnabledOperatingRows();
  let total = rows.reduce(function (sum, row) { return sum + row.operatingUsd; }, 0);
  if (total <= 0) {
    if (!pfIsDemoMode()) return [];
    rows = pfGetActiveProjects().map(function (p) {
      let mock = pfGetProjectMock(p.key);
      return { key: p.key, name: p.name, operatingUsd: mock.operatingUsd };
    });
    total = rows.reduce(function (sum, row) { return sum + row.operatingUsd; }, 0);
    if (total <= 0) return [];
  }
  return rows
    .filter(function (row) { return row.operatingUsd > 0; })
    .map(function (row) {
      return {
        key: row.key,
        name: row.name,
        color: pfGetProjectColor(row.key),
        pct: Math.round((row.operatingUsd / total) * 1000) / 10
      };
    });
}

function pfFitDonutCenterText(rootEl) {
  if (!rootEl) return;
  let center = rootEl.querySelector('.pfDonutCenter');
  if (!center) return;
  let usdEl = center.querySelector('b');
  let yenEl = center.querySelector('small');
  if (usdEl) usdEl.style.fontSize = '';
  if (yenEl) yenEl.style.fontSize = '';
  let usdSize = 20;
  let yenSize = 10;
  if (usdEl) usdEl.style.fontSize = usdSize + 'px';
  if (yenEl) yenEl.style.fontSize = yenSize + 'px';
  for (let i = 0; i < 24; i++) {
    if (center.scrollHeight <= center.clientHeight + 1 && center.scrollWidth <= center.clientWidth + 1) break;
    if (usdSize > 11) usdSize -= 1;
    if (yenSize > 8) yenSize -= 1;
    if (usdEl) usdEl.style.fontSize = usdSize + 'px';
    if (yenEl) yenEl.style.fontSize = yenSize + 'px';
    if (usdSize <= 11 && yenSize <= 8) break;
  }
}

function pfRenderAllocation() {
  let el = document.getElementById('pfAllocationChart');
  if (!el) return;
  let operatingTotal = pfSumEnabledOperatingUsd();
  let alloc = pfBuildAllocationRows();
  if (!alloc.length) {
    el.innerHTML = '<div class="pfAllocLayout pfAllocLayout--empty"><p class="pfEmptyHint">' + pfEmptyMark() + ' 運用額未入力</p></div>';
    return;
  }
  if (operatingTotal <= 0 && pfIsDemoMode()) {
    operatingTotal = alloc.reduce(function (sum, row) {
      let mock = pfGetProjectMock(row.key);
      return sum + (mock.operatingUsd || 0);
    }, 0);
  }
  let acc = 0;
  let gradient = alloc.map(function (row) {
    let start = acc;
    acc += row.pct;
    return row.color + ' ' + start.toFixed(2) + '% ' + acc.toFixed(2) + '%';
  }).join(', ');
  let legend = alloc.map(function (row) {
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
    '<div class="pfDonutCenter"><span>運用額</span><b>' + pfDisplayUsd(operatingTotal, operatingTotal > 0) + '</b><small>(' + (operatingTotal > 0 ? pfYenRef(operatingTotal) : pfEmptyMark()) + ')</small></div></div>' +
    '<div class="pfLegendList">' + legend + '</div></div>';
  pfFitDonutCenterText(el);
}

var pfStackSelectedIdx = null;

function pfGetStackProjects() {
  let list = typeof getEnabledHomeProjects === 'function'
    ? getEnabledHomeProjects()
    : (typeof pmGetEnabledProjects === 'function'
      ? pmGetEnabledProjects()
      : pfGetAllPortfolioProjects());
  return (list || []).map(function (p) {
    return {
      key: p.key,
      name: p.name,
      cls: typeof homeProjectCls === 'function' ? homeProjectCls(p.key) : (p.key || 'custom')
    };
  });
}

function pfAllocateIntegerPercents(amounts) {
  let values = (amounts || []).map(function (v) { return Math.max(0, Number(v) || 0); });
  let total = values.reduce(function (s, v) { return s + v; }, 0);
  if (!(total > 0) || !values.length) {
    return values.map(function () { return 0; });
  }
  let raw = values.map(function (v) { return (v / total) * 100; });
  let floors = raw.map(function (r) { return Math.floor(r); });
  let remain = 100 - floors.reduce(function (s, n) { return s + n; }, 0);
  let order = raw.map(function (r, i) {
    return { i: i, frac: r - floors[i] };
  }).sort(function (a, b) {
    return b.frac - a.frac;
  });
  for (let k = 0; k < remain; k++) {
    floors[order[k].i] += 1;
  }
  return floors;
}

function pfMonthProjectAmount(month, key) {
  return Math.max(0, Number(month && month[key]) || 0);
}

function pfNormalizeStackedMonthTotals(stacked, projects) {
  return (stacked || []).map(function (month) {
    let sum = (projects || []).reduce(function (s, p) {
      return s + pfMonthProjectAmount(month, p.key);
    }, 0);
    if (!(sum > 0)) {
      sum = PF_STACK_ORDER.reduce(function (s, k) {
        return s + pfMonthProjectAmount(month, k);
      }, 0);
    }
    return Object.assign({}, month, { total: Math.round(sum * 100) / 100 });
  });
}

function pfRenderStackMonthCards(month, projects) {
  let amounts = projects.map(function (p) { return pfMonthProjectAmount(month, p.key); });
  let pcts = pfAllocateIntegerPercents(amounts);
  let cols = typeof homeResponsiveGridCols === 'function'
    ? homeResponsiveGridCols(projects.length)
    : Math.min(Math.max(projects.length, 1), 5);
  if (!projects.length) {
    return '<div class="pfStackMonthEmpty"><p class="pfEmptyHint">' + pfEmptyMark() + ' プロジェクトなし</p></div>';
  }
  let cards = projects.map(function (p, i) {
    let amt = amounts[i] || 0;
    let pct = pcts[i] || 0;
    let icon = typeof renderHomeProjIcon === 'function'
      ? renderHomeProjIcon(p.key, 'homeMonthlyProjIcon')
      : (typeof pjRenderProjectIcon === 'function'
        ? pjRenderProjectIcon(p.key, 'homeMonthlyProjIcon')
        : '');
    let color = pfGetProjectColor(p.key);
    return '<div class="pfMonthProjCard pfMonthProjCard--' + pfEscape(p.cls || 'custom') + '" data-pj-icon-key="' + pfEscape(p.key) + '">' +
      '<div class="pfMonthProjCardTop">' +
      '<span class="pfMonthProjCardName"><span class="pfMonthProjDot">' + icon + '</span>' + pfEscape(p.name) + '</span>' +
      '</div>' +
      '<div class="pfMonthProjCardAmt">' + pfMoneyUsd(amt) + '</div>' +
      '<div class="pfMonthProjCardShare">構成割合 ' + pct + '%</div>' +
      '<div class="pfMonthProjCardBar"><div class="pfMonthProjCardBarFill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '</div>';
  }).join('');
  return '<div class="pfStackMonthHead">' +
    '<span class="pfStackMonthHeadMonth">' + pfEscape(month.label || '') + '</span>' +
    '<span class="pfStackMonthHeadRest">のプロジェクト別収益</span>' +
    '</div>' +
    '<div class="pfStackMonthGrid" style="--pf-month-proj-cols:' + cols + '" data-count="' + projects.length + '">' +
    cards + '</div>';
}

function pfRenderStackedBars() {
  let el = document.getElementById('pfMonthlyChart');
  if (!el) return;

  let view = typeof hubGetViewMonth === 'function' ? hubGetViewMonth() : null;
  let ref = view || (typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date());
  let endY = view ? view.y : ref.getFullYear();
  let endM = view ? view.m : ref.getMonth();
  let stacked = typeof pdGetStackedMonthlyRevenue === 'function'
    ? pdGetStackedMonthlyRevenue(endY, endM, 6)
    : [];
  let hasLog = stacked.some(function (m) { return m.hasLog; });
  let hasPortfolioProfit = pfHasPortfolioProfitEntries();
  if (!hasLog && !pfIsDemoMode() && !hasPortfolioProfit) {
    pfStackSelectedIdx = null;
    el.innerHTML = '<div class="pfStackEmpty"><p class="pfEmptyHint">' + pfEmptyMark() + ' 実績データなし</p></div>';
    return;
  }
  if (!hasLog && pfIsDemoMode()) {
    stacked = PF_MOCK_STACKED;
  }
  if (stacked.length) {
    let monthKeys = pfResolveStackedMonthKeys(endY, endM, stacked.length);
    stacked = stacked.map(function (month, i) {
      return pfMergeMonthWithProfitOverlay(month, monthKeys[i].key);
    });
  }

  let projects = pfGetStackProjects();
  // Keep chart segments working for any enabled project key present on month rows
  stacked = pfNormalizeStackedMonthTotals(stacked, projects);

  if (pfStackSelectedIdx == null || pfStackSelectedIdx < 0 || pfStackSelectedIdx >= stacked.length) {
    pfStackSelectedIdx = Math.max(0, stacked.length - 1);
  }

  let maxTotal = Math.max.apply(null, stacked.map(function (m) { return m.total; }).concat([1]));
  let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(maxTotal) : maxTotal * 1.1;
  let chartH = 168;

  let cols = stacked.map(function (month, monthIdx) {
    let monthTotal = Number(month.total) || 0;
    let segMeta = [];
    projects.forEach(function (p) {
      let val = pfMonthProjectAmount(month, p.key);
      if (val <= 0) return;
      segMeta.push({ project: p, key: p.key, val: val });
    });
    let pcts = pfAllocateIntegerPercents(segMeta.map(function (s) { return s.val; }));
    let segments = segMeta.map(function (s, idx) {
      let h = axisMax > 0 ? (s.val / axisMax) * chartH : 0;
      let pct = pcts[idx] || 0;
      let showPct = pct >= 15;
      let tip =
        '<div class="pfStackSegTip" role="tooltip">' +
        '<div class="pfStackSegTipName">' + pfEscape(s.project.name) + '</div>' +
        '<div class="pfStackSegTipAmt">' + pfMoneyUsd(s.val) + '</div>' +
        '<div class="pfStackSegTipPct">' + pct + '%</div>' +
        '</div>';
      let pctHtml = showPct
        ? '<span class="pfStackSegPct">' + pct + '%</span>'
        : '';
      return '<div class="pfStackSeg pfStackSeg--' + s.key + '"' +
        ' style="height:' + h.toFixed(1) + 'px;background:' + pfGetProjectColor(s.key) + '"' +
        ' tabindex="-1"' +
        ' aria-label="' + pfEscape(s.project.name) + ' ' + pfMoneyUsd(s.val) + ' ' + pct + '%">' +
        pctHtml + tip +
        '</div>';
    }).join('');
    let totalLabel = typeof formatAxisDollar === 'function' ? formatAxisDollar(monthTotal) : ('$' + monthTotal);
    let selectedCls = monthIdx === pfStackSelectedIdx ? ' isSelected' : '';
    return '<div class="pfStackCol' + selectedCls + '" data-month-idx="' + monthIdx + '" role="button" tabindex="0" aria-pressed="' + (monthIdx === pfStackSelectedIdx ? 'true' : 'false') + '">' +
      '<div class="pfStackTotal">' + totalLabel + '</div>' +
      '<div class="pfStackTrack" style="height:' + chartH + 'px">' + segments + '</div>' +
      '<div class="pfStackLabel">' + month.label + '</div></div>';
  }).join('');

  let yTicks = [0, 0.25, 0.5, 0.75, 1].map(function (r) {
    let v = axisMax * r;
    let label = typeof formatAxisDollar === 'function' ? formatAxisDollar(v) : ('$' + Math.round(v));
    return '<span style="bottom:' + (r * 100) + '%">' + label + '</span>';
  }).join('');

  let selectedMonth = stacked[pfStackSelectedIdx] || stacked[stacked.length - 1] || { label: '', total: 0 };
  let cardsHtml = pfRenderStackMonthCards(selectedMonth, projects);

  let html =
    '<div class="pfStackChart">' +
    '<div class="pfStackYAxis">' + yTicks + '</div>' +
    '<div class="pfStackCols">' + cols + '</div></div>' +
    '<div class="pfStackMonthSection">' + cardsHtml + '</div>';

  if (typeof pjSetHtmlKeepIcons === 'function') pjSetHtmlKeepIcons(el, html);
  else el.innerHTML = html;

  pfBindStackedChartInteractions(el);
}

function pfBindStackedChartInteractions(root) {
  if (!root || root._pfStackInteractBound) return;
  root._pfStackInteractBound = true;

  function clearTips() {
    root.querySelectorAll('.pfStackSeg.isTipOpen').forEach(function (seg) {
      seg.classList.remove('isTipOpen');
    });
  }

  root.addEventListener('click', function (e) {
    let seg = e.target.closest ? e.target.closest('.pfStackSeg') : null;
    let col = e.target.closest ? e.target.closest('.pfStackCol') : null;
    if (col && root.contains(col)) {
      let idx = Number(col.getAttribute('data-month-idx'));
      if (!isNaN(idx) && idx !== pfStackSelectedIdx) {
        pfStackSelectedIdx = idx;
        pfRenderStackedBars();
        return;
      }
    }
    if (seg && root.contains(seg)) {
      e.stopPropagation();
      let wasOpen = seg.classList.contains('isTipOpen');
      clearTips();
      if (!wasOpen) seg.classList.add('isTipOpen');
      return;
    }
    clearTips();
  });

  root.addEventListener('keydown', function (e) {
    let col = e.target.closest ? e.target.closest('.pfStackCol') : null;
    if (!col || !root.contains(col)) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    let idx = Number(col.getAttribute('data-month-idx'));
    if (isNaN(idx) || idx === pfStackSelectedIdx) return;
    pfStackSelectedIdx = idx;
    pfRenderStackedBars();
  });

  if (!pfBindStackedChartInteractions._docBound) {
    pfBindStackedChartInteractions._docBound = true;
    document.addEventListener('click', function () {
      document.querySelectorAll('#pfMonthlyChart .pfStackSeg.isTipOpen').forEach(function (seg) {
        seg.classList.remove('isTipOpen');
      });
    });
  }
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
  if (typeof pfOperatingSettingsPage !== 'undefined' && !pfOperatingSettingsPage.classList.contains('hidden')) return;
  if (typeof pfProfitSettingsPage !== 'undefined' && !pfProfitSettingsPage.classList.contains('hidden')) return;
  if (typeof hubEnsureViewMonth === 'function') hubEnsureViewMonth();
  if (typeof hubUpdateMonthLabels === 'function') hubUpdateMonthLabels();
  pfSyncMainTabs('portfolio');
  pfEnsurePortfolioGoalSettings();
  pfRenderSummaryCards();
  pfRenderProjectCards();
  pfRenderAllocation();
  pfRenderStackedBars();
}

window.pfOpenProjectProfitDetail = pfOpenProjectProfitDetail;
