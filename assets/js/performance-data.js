/* OUKEI HUB Performance Data — Ver2.0.2
 * Single Source of Truth for revenue & sales actuals.
 * Storage: settings.revenueLog[dateKey], settings.salesLog[dateKey]
 *           settings.investmentHistory[accountId] — 投資履歴（運用額の一元管理）
 * Excel import writes through pdImportRamExcelMonth() → revenueLog + salesLog
 */

function pdIsDemoMode() {
  return typeof isHomeDemoActive === 'function' && isHomeDemoActive();
}

function pdEmptyMark() {
  return '－';
}

var hubViewMonth = {
  y: new Date().getFullYear(),
  m: new Date().getMonth(),
  _inited: false
};

function hubEnsureViewMonth() {
  if (hubViewMonth._inited) return;
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  hubViewMonth.y = ref.getFullYear();
  hubViewMonth.m = ref.getMonth();
  hubViewMonth._inited = true;
  hubSyncLegacyViews();
}

function hubGetViewMonth() {
  hubEnsureViewMonth();
  return { y: hubViewMonth.y, m: hubViewMonth.m };
}

function hubSetViewMonth(y, m) {
  hubViewMonth.y = y;
  hubViewMonth.m = m;
  hubViewMonth._inited = true;
  hubSyncLegacyViews();
}

function hubResetViewMonth() {
  hubViewMonth._inited = false;
  hubEnsureViewMonth();
}

function hubSyncLegacyViews() {
  if (typeof homeCalView !== 'undefined') {
    homeCalView.y = hubViewMonth.y;
    homeCalView.m = hubViewMonth.m;
  }
  if (typeof rmView !== 'undefined') {
    rmView.y = hubViewMonth.y;
    rmView.m = hubViewMonth.m;
  }
  if (typeof smView !== 'undefined') {
    smView.y = hubViewMonth.y;
    smView.m = hubViewMonth.m;
  }
}

function hubFormatMonthLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function hubUpdateMonthLabels() {
  let label = hubFormatMonthLabel(hubViewMonth.y, hubViewMonth.m);
  ['rmMonthLabel', 'smMonthLabel', 'pfMonthLabel'].forEach(function (id) {
    let el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

function hubRefreshMonthViews() {
  hubUpdateMonthLabels();
  if (typeof renderHomeCalendar === 'function') renderHomeCalendar();
  if (typeof renderHomeMonthlyLineChart === 'function') renderHomeMonthlyLineChart();
  if (typeof updateHomeMonthlyProjects === 'function') {
    updateHomeMonthlyProjects(typeof allOrgSummary === 'function' ? allOrgSummary() : null);
  }
  if (typeof updateHomeMonthlySummary === 'function') {
    updateHomeMonthlySummary(typeof allOrgSummary === 'function' ? allOrgSummary() : null);
  }
  if (typeof rmUpdateHeaderMeta === 'function' &&
      (typeof revenueManagePage === 'undefined' || !revenueManagePage.classList.contains('hidden'))) {
    rmUpdateHeaderMeta();
    if (typeof rmRenderAllPanels === 'function') rmRenderAllPanels();
  }
  if (typeof smUpdateHeaderMeta === 'function' &&
      (typeof salesManagePage === 'undefined' || !salesManagePage.classList.contains('hidden'))) {
    smUpdateHeaderMeta();
    if (typeof smRenderAllPanels === 'function') smRenderAllPanels();
  }
  if (typeof renderPortfolio === 'function') renderPortfolio();
}

function hubPrevMonth() {
  hubEnsureViewMonth();
  hubViewMonth.m -= 1;
  if (hubViewMonth.m < 0) {
    hubViewMonth.m = 11;
    hubViewMonth.y -= 1;
  }
  hubSyncLegacyViews();
  hubRefreshMonthViews();
}

function hubNextMonth() {
  hubEnsureViewMonth();
  hubViewMonth.m += 1;
  if (hubViewMonth.m > 11) {
    hubViewMonth.m = 0;
    hubViewMonth.y += 1;
  }
  hubSyncLegacyViews();
  hubRefreshMonthViews();
}

var hubPickerYear = null;

function hubOpenMonthPicker(ev) {
  hubEnsureViewMonth();
  hubPickerYear = hubViewMonth.y;
  hubRenderMonthPickerGrid();
  let bg = document.getElementById('hubMonthPickerBackdrop');
  if (bg) bg.classList.remove('hidden');
  if (ev && ev.stopPropagation) ev.stopPropagation();
}

function hubCloseMonthPicker() {
  let bg = document.getElementById('hubMonthPickerBackdrop');
  if (bg) bg.classList.add('hidden');
}

function hubRenderMonthPickerGrid() {
  let grid = document.getElementById('hubMonthPickerGrid');
  let yearLabel = document.getElementById('hubPickerYearLabel');
  if (!grid || hubPickerYear == null) return;
  if (yearLabel) yearLabel.textContent = hubPickerYear + '年';
  grid.innerHTML = '';
  for (let m = 0; m < 12; m++) {
    let btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hubMonthPickerMonth' +
      (hubPickerYear === hubViewMonth.y && m === hubViewMonth.m ? ' isActive' : '');
    btn.textContent = (m + 1) + '月';
    btn.setAttribute('onclick', 'hubPickMonth(' + m + ')');
    grid.appendChild(btn);
  }
}

function hubPickMonth(m) {
  if (hubPickerYear == null) return;
  hubSetViewMonth(hubPickerYear, m);
  hubCloseMonthPicker();
  hubRefreshMonthViews();
}

function hubPickerPrevYear() {
  if (hubPickerYear == null) hubPickerYear = hubViewMonth.y;
  hubPickerYear -= 1;
  hubRenderMonthPickerGrid();
}

function hubPickerNextYear() {
  if (hubPickerYear == null) hubPickerYear = hubViewMonth.y;
  hubPickerYear += 1;
  hubRenderMonthPickerGrid();
}

function pdProjectHasActualData(projectKey) {
  if (pdIsDemoMode()) {
    if (projectKey === 'ram' || projectKey === 'orca') return true;
    if (projectKey === 'cary' && typeof HOME_DEMO_MONTHLY !== 'undefined') {
      return Number(HOME_DEMO_MONTHLY.cary) > 0;
    }
    return false;
  }
  ensurePerformanceLogs();
  if (pdListRevenueDateKeys().some(function (dateKey) {
    let entry = pdGetRevenueEntry(dateKey);
    return entry && pdProjectDayHasRevenue(entry, projectKey, dateKey);
  })) return true;
  if (Object.keys(settings.salesLog || {}).some(function (dateKey) {
    let entry = settings.salesLog[dateKey];
    if (!entry) return false;
    if (Number(entry[projectKey]) > 0) return true;
    if (!entry.accounts) return false;
    return Object.keys(entry.accounts).some(function (id) {
      let ae = entry.accounts[id];
      return (ae.projectKey || 'other') === projectKey &&
        ae.todaySales != null && ae.todaySales !== '';
    });
  })) return true;
  return false;
}

function pdFilterProjectsWithData(projects) {
  return (projects || []).filter(function (p) {
    return pdProjectHasActualData(p.key);
  });
}

function pdHasAnyManageProjectData() {
  return PD_PROJECT_KEYS.some(function (key) {
    return pdProjectHasActualData(key);
  });
}

function pdHasAccountRevenueInEntry(entry, projectKey, accountId) {
  if (!entry) return false;
  if (projectKey === 'ram' && entry.ramAccounts && entry.ramAccounts[accountId]) {
    let ae = entry.ramAccounts[accountId];
    return ae.todayRevenue != null && ae.todayRevenue !== '';
  }
  if (projectKey === 'orca' && entry.orcaAccounts && entry.orcaAccounts[accountId]) {
    let ae = entry.orcaAccounts[accountId];
    if (ae.todayRevenue != null) return true;
    return ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null;
  }
  if (projectKey === 'cary' && entry.caryAccounts && entry.caryAccounts[accountId]) {
    return entry.caryAccounts[accountId].todayReward != null;
  }
  if (entry.accounts && entry.accounts[accountId]) {
    let ae = entry.accounts[accountId];
    if (ae.projectKey && ae.projectKey !== projectKey) return false;
    return ae.todayRevenue != null;
  }
  return false;
}

function pdCollectRevenueAccountIds(projectKey) {
  ensurePerformanceLogs();
  let ids = {};
  Object.keys(settings.revenueLog).forEach(function (key) {
    let entry = settings.revenueLog[key];
    if (!entry) return;
    if (projectKey === 'ram' && entry.ramAccounts) {
      Object.keys(entry.ramAccounts).forEach(function (id) {
        if (pdHasAccountRevenueInEntry(entry, projectKey, id)) ids[id] = true;
      });
    }
    if (projectKey === 'orca' && entry.orcaAccounts) {
      Object.keys(entry.orcaAccounts).forEach(function (id) {
        if (pdHasAccountRevenueInEntry(entry, projectKey, id)) ids[id] = true;
      });
    }
    if (projectKey === 'cary' && entry.caryAccounts) {
      Object.keys(entry.caryAccounts).forEach(function (id) {
        if (pdHasAccountRevenueInEntry(entry, projectKey, id)) ids[id] = true;
      });
    }
    if (entry.accounts) {
      Object.keys(entry.accounts).forEach(function (id) {
        let ae = entry.accounts[id];
        let pk = ae.projectKey || 'other';
        if (pk === projectKey && pdHasAccountRevenueInEntry(entry, projectKey, id)) ids[id] = true;
      });
    }
  });
  return Object.keys(ids);
}

function pdCollectSalesAccountIds(projectKey) {
  ensurePerformanceLogs();
  let ids = {};
  Object.keys(settings.salesLog).forEach(function (key) {
    let entry = settings.salesLog[key];
    if (!entry || !entry.accounts) return;
    Object.keys(entry.accounts).forEach(function (id) {
      let ae = entry.accounts[id];
      let pk = ae.projectKey || 'other';
      if (pk !== projectKey) return;
      if (ae.todaySales != null) ids[id] = true;
    });
  });
  return Object.keys(ids);
}

var PD_PROJECT_KEYS = ['ram', 'orca', 'cary', 'genesis', 'other'];
var PD_SCHEMA_VERSION = 1;

function ensurePerformanceLogs() {
  if (typeof settings === 'undefined') return;
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') {
    settings.revenueLog = {};
  }
  if (!settings.salesLog || typeof settings.salesLog !== 'object') {
    settings.salesLog = {};
  }
  if (!settings.investmentHistory || typeof settings.investmentHistory !== 'object') {
    settings.investmentHistory = {};
  }
  if (!settings.performanceMeta || typeof settings.performanceMeta !== 'object') {
    settings.performanceMeta = { schemaVersion: PD_SCHEMA_VERSION };
  }
}

function pdEnsureInvestmentHistory() {
  ensurePerformanceLogs();
  if (!settings.investmentHistory || typeof settings.investmentHistory !== 'object') {
    settings.investmentHistory = {};
  }
}

function pdGetInvestmentAccount(accountId, projectKey) {
  pdEnsureInvestmentHistory();
  if (!settings.investmentHistory[accountId]) {
    settings.investmentHistory[accountId] = { projectKey: projectKey, records: [] };
  }
  let acc = settings.investmentHistory[accountId];
  if (!acc.projectKey) acc.projectKey = projectKey;
  if (!Array.isArray(acc.records)) acc.records = [];
  return acc;
}

function pdGetLegacyBaseInvestment(accountId, projectKey) {
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    let m = members.find(function (x) { return x.id === accountId; });
    if (m) return Number(m.investment) || 0;
  }
  if (projectKey === 'orca' && typeof settings !== 'undefined' && Array.isArray(settings.orcaInputAccounts)) {
    let o = settings.orcaInputAccounts.find(function (x) { return x.id === accountId; });
    if (o) return Number(o.investment) || 0;
  }
  if (projectKey === 'cary' && typeof settings !== 'undefined' && Array.isArray(settings.caryInputAccounts)) {
    let c = settings.caryInputAccounts.find(function (x) { return x.id === accountId; });
    if (c) return Number(c.investment) || 0;
  }
  return 0;
}

function pdFindEarliestRevenueDateKey(accountId, projectKey) {
  ensurePerformanceLogs();
  let earliest = null;
  Object.keys(settings.revenueLog).sort().forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry) return;
    let has = false;
    if (projectKey === 'ram' && entry.ramAccounts && entry.ramAccounts[accountId]) has = true;
    if (projectKey === 'orca' && entry.orcaAccounts && entry.orcaAccounts[accountId]) has = true;
    if (projectKey === 'cary' && entry.caryAccounts && entry.caryAccounts[accountId]) has = true;
    if (has && !earliest) earliest = dateKey;
  });
  return earliest;
}

function pdMigrateLegacyInvestment(accountId, projectKey) {
  pdEnsureInvestmentHistory();
  let acc = settings.investmentHistory[accountId];
  if (acc && acc.records && acc.records.length) return;

  let records = [];
  let base = pdGetLegacyBaseInvestment(accountId, projectKey);
  let initialDate = pdFindEarliestRevenueDateKey(accountId, projectKey);
  if (!initialDate && typeof todayKey === 'function') initialDate = todayKey();
  if (base > 0 && initialDate) {
    records.push({ dateKey: initialDate, amount: base, type: 'initial' });
  }

  ensurePerformanceLogs();
  Object.keys(settings.revenueLog).sort().forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry) return;
    let add = 0;
    if (projectKey === 'ram' && entry.ramAccounts && entry.ramAccounts[accountId]) {
      add = Number(entry.ramAccounts[accountId].addInvestment) || 0;
    }
    if (add > 0) {
      records.push({ dateKey: dateKey, amount: add, type: 'additional' });
    }
  });

  if (!records.length) return;
  let store = pdGetInvestmentAccount(accountId, projectKey);
  store.records = records.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
}

function pdAddInvestmentRecord(accountId, projectKey, dateKey, amount, type) {
  amount = Number(amount) || 0;
  if (!accountId || !projectKey || !dateKey || amount <= 0) return;
  let acc = pdGetInvestmentAccount(accountId, projectKey);
  acc.records = acc.records.filter(function (r) {
    return !(r.dateKey === dateKey && r.type === type);
  });
  acc.records.push({ dateKey: dateKey, amount: amount, type: type });
  acc.records.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  pdPersist();
}

function pdRemoveInvestmentRecord(accountId, projectKey, dateKey, type) {
  if (!accountId || !projectKey || !dateKey) return;
  pdEnsureInvestmentHistory();
  let acc = settings.investmentHistory[accountId];
  if (!acc || !acc.records) return;
  let before = acc.records.length;
  acc.records = acc.records.filter(function (r) {
    return !(r.dateKey === dateKey && r.type === type);
  });
  if (acc.records.length !== before) pdPersist();
}

function pdGetOperatingUsdAsOf(accountId, projectKey, dateKey) {
  if (!accountId || !projectKey || !dateKey) return 0;
  pdMigrateLegacyInvestment(accountId, projectKey);
  pdEnsureInvestmentHistory();
  let acc = settings.investmentHistory[accountId];
  if (!acc || !acc.records) return 0;
  return pdRound(acc.records
    .filter(function (r) { return r.dateKey <= dateKey; })
    .reduce(function (sum, r) { return sum + (Number(r.amount) || 0); }, 0));
}

function pdGetAdditionalInvestmentForDate(accountId, projectKey, dateKey) {
  pdMigrateLegacyInvestment(accountId, projectKey);
  pdEnsureInvestmentHistory();
  let acc = settings.investmentHistory[accountId];
  if (!acc || !acc.records) return 0;
  let rec = acc.records.find(function (r) {
    return r.dateKey === dateKey && r.type === 'additional';
  });
  return rec ? Number(rec.amount) || 0 : 0;
}

function pdGetInvestmentHistoryRecords(accountId, projectKey) {
  pdMigrateLegacyInvestment(accountId, projectKey);
  pdEnsureInvestmentHistory();
  let acc = settings.investmentHistory[accountId];
  if (!acc || !acc.records) return [];
  return acc.records.slice().sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
}

function pdCalcDailyOperation(accountId, projectKey, dateKey) {
  if (!accountId || !projectKey || !dateKey) return 0;
  if (projectKey === 'ram') {
    let operatingUsd = pdGetOperatingUsdAsOf(accountId, projectKey, dateKey);
    if (operatingUsd <= 0) return 0;
    if (typeof calcRamOperatingProfit === 'function') {
      return pdRound(calcRamOperatingProfit(operatingUsd));
    }
    return 0;
  }
  return 0;
}

function pdGetProjectAccountIds(projectKey) {
  if (projectKey === 'ram' && typeof getRamInputAccounts === 'function') {
    return getRamInputAccounts().map(function (a) { return a.id; });
  }
  if (projectKey === 'orca' && typeof getOrcaInputAccounts === 'function') {
    return getOrcaInputAccounts().map(function (a) { return a.id; });
  }
  if (projectKey === 'cary' && typeof getCaryInputAccounts === 'function') {
    return getCaryInputAccounts().map(function (a) { return a.id; });
  }
  return [];
}

function pdGetProjectOperatingUsd(projectKey, dateKey) {
  dateKey = dateKey || (typeof todayKey === 'function' ? todayKey() : '');
  let total = 0;
  pdGetProjectAccountIds(projectKey).forEach(function (id) {
    total += pdGetOperatingUsdAsOf(id, projectKey, dateKey);
  });
  return pdRound(total);
}

function pdSyncRamSaveInvestments(ramAccounts, dateKey) {
  if (!ramAccounts || !dateKey) return;
  Object.keys(ramAccounts).forEach(function (id) {
    let add = Number(ramAccounts[id].addInvestment) || 0;
    if (add > 0) {
      pdAddInvestmentRecord(id, 'ram', dateKey, add, 'additional');
    } else {
      pdRemoveInvestmentRecord(id, 'ram', dateKey, 'additional');
    }
  });
}

function pdGetRamOperationRevenue(ae, accountId, dateKey) {
  if (ae && ae.operationSource === 'import' && ae.operationRevenue != null && ae.operationRevenue !== '') {
    return pdRound(Number(ae.operationRevenue) || 0);
  }
  if (ae && ae.operationRevenue != null && ae.operationRevenue !== '' && ae.operationSource === 'manual') {
    return pdRound(Number(ae.operationRevenue) || 0);
  }
  return pdCalcDailyOperation(accountId, 'ram', dateKey);
}

function pdRamAccountRevenueTotal(ae, accountId, dateKey) {
  if (!ae || ae.todayRevenue == null || ae.todayRevenue === '') return 0;
  let rev = Number(ae.todayRevenue) || 0;
  let op = pdGetRamOperationRevenue(ae, accountId, dateKey);
  return pdRound(op + rev);
}

function pdPreviewRamAccountRevenueTotal(accountId, todayRevenue, addInvestment, dateKey) {
  let rev = Number(todayRevenue) || 0;
  let base = pdGetOperatingUsdAsOf(accountId, 'ram', dateKey);
  let storedAdd = pdGetAdditionalInvestmentForDate(accountId, 'ram', dateKey);
  let pendingAdd = addInvestment != null ? Number(addInvestment) || 0 : storedAdd;
  let operating = base - storedAdd + pendingAdd;
  let op = typeof calcRamOperatingProfit === 'function' ? calcRamOperatingProfit(operating) : 0;
  return pdRound(op + rev);
}

function pdOrcaAccountRevenueTotal(a) {
  if (!a) return 0;
  if (a.yesterdayAiProfit != null || a.todayAffiliateProfit != null) {
    return pdRoundOrca((Number(a.yesterdayAiProfit) || 0) + (Number(a.todayAffiliateProfit) || 0));
  }
  if (a.todayRevenue != null) return pdRound(Number(a.todayRevenue) || 0);
  if (typeof calcOrcaAccountTotal === 'function') return pdRound(calcOrcaAccountTotal(a));
  return 0;
}

function pdCreatePerformanceSnapshot() {
  ensurePerformanceLogs();
  return {
    createdAt: new Date().toLocaleString(),
    revenueLog: JSON.parse(JSON.stringify(settings.revenueLog || {})),
    salesLog: JSON.parse(JSON.stringify(settings.salesLog || {})),
    investmentHistory: JSON.parse(JSON.stringify(settings.investmentHistory || {})),
    excelImportMonths: JSON.parse(JSON.stringify(settings.excelImportMonths || {}))
  };
}

function pdRestorePerformanceSnapshot(snapshot) {
  if (!snapshot) return false;
  ensurePerformanceLogs();
  settings.revenueLog = JSON.parse(JSON.stringify(snapshot.revenueLog || {}));
  settings.salesLog = JSON.parse(JSON.stringify(snapshot.salesLog || {}));
  settings.investmentHistory = JSON.parse(JSON.stringify(snapshot.investmentHistory || {}));
  settings.excelImportMonths = JSON.parse(JSON.stringify(snapshot.excelImportMonths || {}));
  settings.lastUpdate = new Date().toLocaleString();
  if (typeof markActivity === 'function') markActivity();
  pdPersist();
  pdNotifyPerformanceChanged({ type: 'restore' });
  return true;
}

function pdSumProjectDayRevenue(entry, projectKey, dateKey) {
  if (!entry) return 0;
  if (projectKey === 'other') {
    let known = ['ram', 'orca', 'cary', 'genesis'];
    let sumKnown = known.reduce(function (s, k) { return s + (Number(entry[k]) || 0); }, 0);
    let total = Number(entry.total) || 0;
    return pdRound(Math.max(0, total - sumKnown));
  }
  if (projectKey === 'ram' && entry.ramAccounts) {
    let sum = 0;
    let hasAny = false;
    Object.keys(entry.ramAccounts).forEach(function (id) {
      let ae = entry.ramAccounts[id];
      if (!ae || ae.todayRevenue == null || ae.todayRevenue === '') return;
      hasAny = true;
      sum += pdRamAccountRevenueTotal(ae, id, dateKey);
    });
    if (hasAny) return pdRound(sum);
  }
  if (projectKey === 'orca' && entry.orcaAccounts) {
    let sum = 0;
    let hasAny = false;
    Object.keys(entry.orcaAccounts).forEach(function (id) {
      let ae = entry.orcaAccounts[id];
      if (!ae) return;
      let v = pdOrcaAccountRevenueTotal(ae);
      if (v > 0 || ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null || ae.todayRevenue != null) {
        hasAny = true;
        sum += v;
      }
    });
    if (hasAny) return pdRound(sum);
  }
  if (projectKey === 'cary' && entry.caryAccounts) {
    let sum = 0;
    let hasAny = false;
    Object.keys(entry.caryAccounts).forEach(function (id) {
      let ae = entry.caryAccounts[id];
      if (!ae) return;
      if (ae.todayReward != null || ae.operationRevenue != null) {
        hasAny = true;
        sum += pdRound((Number(ae.operationRevenue) || 0) + (Number(ae.todayReward) || 0));
      }
    });
    if (hasAny) return pdRound(sum);
  }
  return pdRound(Number(entry[projectKey]) || 0);
}

function pdProjectDayHasRevenue(entry, projectKey, dateKey) {
  if (!entry) return false;
  if (projectKey === 'ram' && entry.ramAccounts) {
    return Object.keys(entry.ramAccounts).some(function (id) {
      let ae = entry.ramAccounts[id];
      return ae && ae.todayRevenue != null && ae.todayRevenue !== '';
    });
  }
  if (projectKey === 'orca' && entry.orcaAccounts) {
    return Object.keys(entry.orcaAccounts).some(function (id) {
      let ae = entry.orcaAccounts[id];
      return ae && (ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null || ae.todayRevenue != null);
    });
  }
  if (projectKey === 'cary' && entry.caryAccounts) {
    return Object.keys(entry.caryAccounts).some(function (id) {
      let ae = entry.caryAccounts[id];
      return ae && (ae.todayReward != null || ae.operationRevenue != null);
    });
  }
  if (projectKey === 'other') {
    return pdSumProjectDayRevenue(entry, projectKey, dateKey) > 0;
  }
  return Number(entry[projectKey]) > 0;
}

function pdGetExcelImportMonthKey(year, month) {
  return year + '-' + String(month + 1).padStart(2, '0');
}

function pdFormatExcelImportMonthLabel(year, month) {
  let rYear = year - 2018;
  return 'R' + rYear + '.' + (month + 1) + '月';
}

function pdDetectImportedRamMonth(year, month) {
  ensurePerformanceLogs();
  let daysInMonth = new Date(year, month + 1, 0).getDate();
  let importDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    let dateKey = typeof revenueDateKey === 'function'
      ? revenueDateKey(year, month, d)
      : year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let entry = settings.revenueLog[dateKey];
    if (!entry || !entry.ramAccounts) continue;
    let dayImported = Object.keys(entry.ramAccounts).some(function (id) {
      let ae = entry.ramAccounts[id];
      return ae && ae.operationSource === 'import';
    });
    if (dayImported) importDays += 1;
  }
  let threshold = Math.max(10, Math.floor(daysInMonth * 0.5));
  return importDays >= threshold;
}

function pdDetectImportedRamSalesMonth(year, month) {
  ensurePerformanceLogs();
  let daysInMonth = new Date(year, month + 1, 0).getDate();
  let importDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    let dateKey = typeof revenueDateKey === 'function'
      ? revenueDateKey(year, month, d)
      : year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let entry = settings.salesLog[dateKey];
    if (!entry || !entry.accounts) continue;
    let dayImported = Object.keys(entry.accounts).some(function (id) {
      let ae = entry.accounts[id];
      return ae && ae.projectKey === 'ram' && ae.salesSource === 'import';
    });
    if (dayImported) importDays += 1;
  }
  let threshold = Math.max(10, Math.floor(daysInMonth * 0.5));
  return importDays >= threshold;
}

function pdIsExcelMonthFullyImported(year, month, hasSalesData) {
  let revenueDone = pdDetectImportedRamMonth(year, month);
  if (!revenueDone) return false;
  if (hasSalesData === false) return true;
  return pdDetectImportedRamSalesMonth(year, month);
}

function pdGetExcelMonthImportStatus(year, month, hasSalesData) {
  return {
    revenueDone: pdDetectImportedRamMonth(year, month),
    salesDone: hasSalesData === false ? true : pdDetectImportedRamSalesMonth(year, month)
  };
}

function pdIsExcelMonthImported(year, month) {
  return pdDetectImportedRamMonth(year, month);
}

function pdMarkExcelMonthImported(year, month, meta) {
  ensurePerformanceLogs();
  settings.excelImportMonths = settings.excelImportMonths || {};
  let key = pdGetExcelImportMonthKey(year, month);
  settings.excelImportMonths[key] = Object.assign({
    importedAt: new Date().toLocaleString(),
    sheetName: '',
    recordCount: 0
  }, meta || {});
  pdPersist();
}

function pdListExcelImportedMonthKeys() {
  ensurePerformanceLogs();
  settings.excelImportMonths = settings.excelImportMonths || {};
  let keys = Object.keys(settings.excelImportMonths);
  if (typeof pdListRevenueDateKeys === 'function') {
    pdListRevenueDateKeys().forEach(function (dateKey) {
      let parts = dateKey.split('-');
      if (parts.length !== 3) return;
      let y = Number(parts[0]);
      let mo = Number(parts[1]) - 1;
      if (pdDetectImportedRamMonth(y, mo)) {
        let mk = pdGetExcelImportMonthKey(y, mo);
        if (keys.indexOf(mk) === -1) keys.push(mk);
      }
    });
  }
  return keys.sort();
}

function pdImportRamRevenueRecords(records) {
  if (!records || !records.length) return { imported: 0, dates: 0 };
  ensurePerformanceLogs();
  let byDate = {};
  records.forEach(function (rec) {
    if (!rec || !rec.dateKey || !rec.accountId) return;
    if (!byDate[rec.dateKey]) byDate[rec.dateKey] = [];
    byDate[rec.dateKey].push(rec);
  });
  let imported = 0;
  Object.keys(byDate).sort().forEach(function (dateKey) {
    let entry = pdGetRevenueEntryRaw(dateKey) || {};
    entry.ramAccounts = entry.ramAccounts || {};
    byDate[dateKey].forEach(function (rec) {
      let prev = entry.ramAccounts[rec.accountId] || {};
      entry.ramAccounts[rec.accountId] = {
        todayRevenue: pdRound(rec.todayRevenue),
        operationRevenue: pdRound(rec.operationRevenue),
        operationSource: 'import',
        addInvestment: Number(prev.addInvestment) || 0
      };
      imported += 1;
    });
    entry = pdRecalculateRevenueEntry(entry, dateKey);
    pdWriteRevenueEntry(dateKey, entry);
  });
  pdNotifyPerformanceChanged({ type: 'import', count: imported });
  return { imported: imported, dates: Object.keys(byDate).length };
}

function pdImportRamSalesRecords(records) {
  if (!records || !records.length) return { imported: 0, dates: 0 };
  ensurePerformanceLogs();
  let byDate = {};
  records.forEach(function (rec) {
    if (!rec || !rec.dateKey || !rec.accountId) return;
    if (!byDate[rec.dateKey]) byDate[rec.dateKey] = [];
    byDate[rec.dateKey].push(rec);
  });
  let imported = 0;
  Object.keys(byDate).sort().forEach(function (dateKey) {
    let entry = pdGetSalesEntryRaw(dateKey) || {};
    entry.accounts = entry.accounts || {};
    byDate[dateKey].forEach(function (rec) {
      entry.accounts[rec.accountId] = {
        projectKey: 'ram',
        todaySales: pdRound(rec.todaySales),
        totalSales: rec.totalSales != null ? pdRound(rec.totalSales) : null,
        salesSource: 'import'
      };
      imported += 1;
    });
    entry = pdRecalculateSalesEntry(entry);
    pdWriteSalesEntry(dateKey, entry);
  });
  pdNotifyPerformanceChanged({ type: 'import-sales', count: imported });
  return { imported: imported, dates: Object.keys(byDate).length };
}

function pdImportRamExcelMonth(revenueRecords, salesRecords, meta) {
  meta = meta || {};
  let revResult = { imported: 0, dates: 0 };
  let salesResult = { imported: 0, dates: 0 };
  if (!meta.revenueDone && revenueRecords && revenueRecords.length) {
    revResult = pdImportRamRevenueRecords(revenueRecords);
  }
  if (!meta.salesDone && salesRecords && salesRecords.length) {
    salesResult = pdImportRamSalesRecords(salesRecords);
  }
  if (meta.year != null && meta.month != null) {
    let status = pdGetExcelMonthImportStatus(meta.year, meta.month, meta.hasSalesData);
    if (status.revenueDone && status.salesDone) {
      pdMarkExcelMonthImported(meta.year, meta.month, {
        sheetName: meta.sheetName || '',
        salesSheetName: meta.salesSheetName || '',
        layoutPattern: meta.layoutPattern || '',
        revenueCount: revResult.imported,
        salesCount: salesResult.imported,
        recordCount: revResult.imported + salesResult.imported
      });
    }
  }
  return {
    imported: revResult.imported + salesResult.imported,
    revenueImported: revResult.imported,
    salesImported: salesResult.imported,
    dates: Math.max(revResult.dates, salesResult.dates)
  };
}

function pdImportRamRevenueRecordsWithMeta(records, meta) {
  let result = pdImportRamRevenueRecords(records);
  if (meta && meta.year != null && meta.month != null) {
    pdMarkExcelMonthImported(meta.year, meta.month, {
      sheetName: meta.sheetName || '',
      recordCount: result.imported
    });
  }
  return result;
}

function pdImportOrcaRevenueRecords(records) {
  if (!records || !records.length) return { imported: 0, dates: 0 };
  ensurePerformanceLogs();
  let byDate = {};
  records.forEach(function (rec) {
    if (!rec || !rec.dateKey || !rec.accountId) return;
    if (!byDate[rec.dateKey]) byDate[rec.dateKey] = [];
    byDate[rec.dateKey].push(rec);
  });
  let imported = 0;
  Object.keys(byDate).sort().forEach(function (dateKey) {
    let entry = pdGetRevenueEntryRaw(dateKey) || {};
    entry.orcaAccounts = entry.orcaAccounts || {};
    entry.accounts = entry.accounts || {};
    byDate[dateKey].forEach(function (rec) {
      let prev = entry.orcaAccounts[rec.accountId] || {};
      let yesterdayAi = rec.yesterdayAiProfit != null
        ? pdRoundOrca(rec.yesterdayAiProfit)
        : (prev.yesterdayAiProfit != null ? pdRoundOrca(prev.yesterdayAiProfit) : 0);
      let todayAff = rec.todayAffiliateProfit != null
        ? pdRoundOrca(rec.todayAffiliateProfit)
        : (prev.todayAffiliateProfit != null ? pdRoundOrca(prev.todayAffiliateProfit) : 0);
      entry.orcaAccounts[rec.accountId] = {
        yesterdayAiProfit: yesterdayAi,
        todayAffiliateProfit: todayAff,
        importSource: 'orca'
      };
      entry.accounts[rec.accountId] = {
        projectKey: 'orca',
        todayRevenue: pdOrcaAccountRevenueTotal(entry.orcaAccounts[rec.accountId]),
        operationRevenue: 0
      };
      imported += 1;
    });
    entry = pdRecalculateRevenueEntry(entry, dateKey);
    pdWriteRevenueEntry(dateKey, entry);
  });
  pdNotifyPerformanceChanged({ type: 'import-orca', count: imported });
  return { imported: imported, dates: Object.keys(byDate).length };
}

function pdResolveRamAccountIdByExcelKey(excelKey) {
  if (!excelKey) return null;
  let key = String(excelKey).trim();
  if (key.normalize) key = key.normalize('NFKC');
  key = key.replace(/^@/, '').toLowerCase();

  if (typeof settings !== 'undefined' && settings.ramExcelAccountMap) {
    let mapped = settings.ramExcelAccountMap[key] || settings.ramExcelAccountMap[excelKey];
    if (mapped) return mapped;
  }

  function normalizeToken(field) {
    if (!field) return '';
    let s = String(field).trim();
    if (s.normalize) s = s.normalize('NFKC');
    return s.replace(/^@/, '').toLowerCase();
  }

  function matchesExcelKey(m) {
    let tokens = [normalizeToken(m.username), normalizeToken(m.name)];
    if (key === 'kai1') {
      return tokens.some(function (t) {
        return t === 'kai1' || t === '甲斐1' || t === '甲斐' || t === 'kai';
      });
    }
    if (key === 'kai2') {
      return tokens.some(function (t) {
        return t === 'kai2' || t === '甲斐2';
      });
    }
    return tokens.indexOf(key) >= 0;
  }

  if (typeof getRamInputAccounts === 'function') {
    let accounts = getRamInputAccounts();
    for (let i = 0; i < accounts.length; i++) {
      let acc = accounts[i];
      let token = normalizeToken(acc.username);
      if (key === 'kai1' && (token === 'kai1' || token === '甲斐1' || token === '甲斐' || token === 'kai')) {
        return acc.id;
      }
      if (key === 'kai2' && (token === 'kai2' || token === '甲斐2')) {
        return acc.id;
      }
      if (token === key) return acc.id;
    }
  }

  if (typeof getRootIdsForSummary === 'function' && typeof members !== 'undefined') {
    let ids = getRootIdsForSummary();
    for (let i = 0; i < ids.length; i++) {
      let m = members.find(function (x) { return x.id === ids[i]; });
      if (m && matchesExcelKey(m)) return m.id;
    }
  }

  if (typeof members !== 'undefined') {
    for (let j = 0; j < members.length; j++) {
      if (matchesExcelKey(members[j])) return members[j].id;
    }
  }

  return null;
}

function pdGetRevenueEntryRaw(dateKey) {
  ensurePerformanceLogs();
  let entry = settings.revenueLog[dateKey];
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function pdGetSalesEntryRaw(dateKey) {
  ensurePerformanceLogs();
  let entry = settings.salesLog[dateKey];
  return entry ? JSON.parse(JSON.stringify(entry)) : null;
}

function pdGetRevenueEntry(dateKey) {
  if (typeof getRevenueEntry === 'function') return getRevenueEntry(dateKey);
  return pdGetRevenueEntryRaw(dateKey);
}

function pdGetSalesEntry(dateKey) {
  if (typeof getSalesEntry === 'function') return getSalesEntry(dateKey);
  return pdGetSalesEntryRaw(dateKey);
}

function pdPersist() {
  if (typeof persistHubSettings === 'function') {
    persistHubSettings();
    return;
  }
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    localStorage.setItem('oukei_hub_v15_data', JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : '',
      rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : []
    }));
  } catch (e) {}
}

function pdRound(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function pdRoundOrca(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function pdOrcaAccountTotal(a) {
  return pdOrcaAccountRevenueTotal(a);
}

function pdRecalculateRevenueEntry(entry, dateKey) {
  entry = entry || {};
  dateKey = dateKey || (typeof todayKey === 'function' ? todayKey() : '');
  PD_PROJECT_KEYS.forEach(function (k) { entry[k] = 0; });

  if (entry.ramAccounts) {
    Object.keys(entry.ramAccounts).forEach(function (id) {
      let ae = entry.ramAccounts[id];
      if (ae.todayRevenue == null || ae.todayRevenue === '') return;
      let op = pdGetRamOperationRevenue(ae, id, dateKey);
      ae.operationRevenue = op;
      entry.ram += pdRamAccountRevenueTotal(ae, id, dateKey);
    });
  }
  if (entry.orcaAccounts) {
    Object.keys(entry.orcaAccounts).forEach(function (id) {
      entry.orca += pdOrcaAccountRevenueTotal(entry.orcaAccounts[id]);
    });
  }
  if (entry.caryAccounts) {
    Object.keys(entry.caryAccounts).forEach(function (id) {
      let ae = entry.caryAccounts[id];
      let rev = Number(ae.todayReward) || 0;
      let op = Number(ae.operationRevenue) || 0;
      entry.cary += pdRound(op + rev);
    });
  }
  if (entry.accounts) {
    Object.keys(entry.accounts).forEach(function (id) {
      let a = entry.accounts[id];
      let pk = a.projectKey;
      if (!pk || pk === 'ram' || pk === 'orca' || pk === 'cary') return;
      if (PD_PROJECT_KEYS.indexOf(pk) >= 0) {
        let rev = Number(a.todayRevenue) || 0;
        let op = Number(a.operationRevenue) || 0;
        entry[pk] += pdRound(op + rev);
      }
    });
  }

  PD_PROJECT_KEYS.forEach(function (k) { entry[k] = pdRound(entry[k]); });
  entry.total = pdRound(PD_PROJECT_KEYS.reduce(function (s, k) {
    return s + (Number(entry[k]) || 0);
  }, 0));
  entry.savedAt = new Date().toLocaleString();
  return entry;
}

function pdRecalculateSalesEntry(entry) {
  entry = entry || {};
  PD_PROJECT_KEYS.forEach(function (k) { entry[k] = 0; });
  if (entry.accounts) {
    Object.keys(entry.accounts).forEach(function (id) {
      let a = entry.accounts[id];
      let pk = a.projectKey || 'other';
      if (PD_PROJECT_KEYS.indexOf(pk) < 0) pk = 'other';
      entry[pk] += Number(a.todaySales) || 0;
    });
  }
  PD_PROJECT_KEYS.forEach(function (k) { entry[k] = pdRound(entry[k]); });
  entry.total = pdRound(PD_PROJECT_KEYS.reduce(function (s, k) {
    return s + (Number(entry[k]) || 0);
  }, 0));
  entry.savedAt = new Date().toLocaleString();
  return entry;
}

function pdWriteRevenueEntry(dateKey, entry) {
  if (typeof isHomeDemoActive === 'function' && isHomeDemoActive()) {
    /* Demo mode: home reads use HOME_DEMO_LOG; real log still updated for cross-screen linking tests. */
  }
  ensurePerformanceLogs();
  settings.revenueLog[dateKey] = entry;
  settings.lastUpdate = new Date().toLocaleString();
  if (typeof markActivity === 'function') markActivity();
  pdPersist();
}

function pdWriteSalesEntry(dateKey, entry) {
  ensurePerformanceLogs();
  settings.salesLog[dateKey] = entry;
  settings.lastUpdate = new Date().toLocaleString();
  if (typeof markActivity === 'function') markActivity();
  pdPersist();
}

function pdSaveRevenueAccountEntry(dateKey, projectKey, accountId, data) {
  if (!dateKey || !projectKey || !accountId) return null;
  let entry = pdGetRevenueEntryRaw(dateKey) || {};
  data = data || {};
  let rev = data.todayRevenue != null ? pdRound(data.todayRevenue) : null;
  let op = pdCalcDailyOperation(accountId, projectKey, dateKey);

  entry.accounts = entry.accounts || {};
  entry.accounts[accountId] = {
    projectKey: projectKey,
    todayRevenue: rev,
    operationRevenue: op
  };

  if (projectKey === 'ram') {
    entry.ramAccounts = entry.ramAccounts || {};
    let prev = entry.ramAccounts[accountId] || {};
    let addInvestment = Number(data.addInvestment != null ? data.addInvestment : prev.addInvestment) || 0;
    if (data.addInvestment != null) {
      if (addInvestment > 0) {
        pdAddInvestmentRecord(accountId, projectKey, dateKey, addInvestment, 'additional');
      } else {
        pdRemoveInvestmentRecord(accountId, projectKey, dateKey, 'additional');
      }
    }
    op = pdCalcDailyOperation(accountId, projectKey, dateKey);
    entry.ramAccounts[accountId] = {
      todayRevenue: rev,
      operationRevenue: op,
      addInvestment: addInvestment
    };
  } else if (projectKey === 'orca') {
    entry.orcaAccounts = entry.orcaAccounts || {};
    let yesterdayAi = data.yesterdayAiProfit != null ? pdRound(data.yesterdayAiProfit) : 0;
    let todayAff = data.todayAffiliateProfit != null ? pdRound(data.todayAffiliateProfit) : 0;
    entry.orcaAccounts[accountId] = {
      yesterdayAiProfit: yesterdayAi,
      todayAffiliateProfit: todayAff
    };
    rev = pdOrcaAccountRevenueTotal(entry.orcaAccounts[accountId]);
    entry.accounts[accountId] = {
      projectKey: projectKey,
      todayRevenue: rev,
      operationRevenue: 0
    };
  } else if (projectKey === 'cary') {
    entry.caryAccounts = entry.caryAccounts || {};
    entry.caryAccounts[accountId] = {
      todayReward: rev,
      operationRevenue: data.operationRevenue != null ? pdRound(data.operationRevenue) : op
    };
  }

  entry = pdRecalculateRevenueEntry(entry, dateKey);
  pdWriteRevenueEntry(dateKey, entry);
  pdNotifyPerformanceChanged({ type: 'revenue', dateKey: dateKey, projectKey: projectKey, accountId: accountId });
  return entry;
}

function pdSaveSalesAccountEntry(dateKey, projectKey, accountId, todaySales) {
  if (!dateKey || !projectKey || !accountId) return null;
  let entry = pdGetSalesEntryRaw(dateKey) || {};
  entry.accounts = entry.accounts || {};
  entry.accounts[accountId] = {
    projectKey: projectKey,
    todaySales: pdRound(todaySales)
  };
  entry = pdRecalculateSalesEntry(entry);
  pdWriteSalesEntry(dateKey, entry);
  pdNotifyPerformanceChanged({ type: 'sales', dateKey: dateKey, projectKey: projectKey, accountId: accountId });
  return entry;
}

function pdMergeRevenueEntry(dateKey, patch) {
  let entry = pdGetRevenueEntryRaw(dateKey) || {};
  Object.keys(patch || {}).forEach(function (k) {
    if (k === 'ramAccounts' || k === 'orcaAccounts' || k === 'caryAccounts' || k === 'accounts') {
      entry[k] = Object.assign({}, entry[k] || {}, patch[k]);
    } else {
      entry[k] = patch[k];
    }
  });
  entry = pdRecalculateRevenueEntry(entry, dateKey);
  pdWriteRevenueEntry(dateKey, entry);
  pdNotifyPerformanceChanged({ type: 'revenue', dateKey: dateKey });
  return entry;
}

function pdListRevenueDateKeys() {
  ensurePerformanceLogs();
  return Object.keys(settings.revenueLog).sort();
}

function pdListSalesDateKeys() {
  ensurePerformanceLogs();
  return Object.keys(settings.salesLog).sort();
}

function pdSumMonthRevenue(y, m) {
  ensurePerformanceLogs();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let out = { total: 0, hasLog: false };
  PD_PROJECT_KEYS.forEach(function (k) { out[k] = 0; });
  for (let d = 1; d <= daysInMonth; d++) {
    let key = typeof revenueDateKey === 'function'
      ? revenueDateKey(y, m, d)
      : y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let entry = pdGetRevenueEntry(key);
    if (!entry) continue;
    out.hasLog = true;
    out.total += Number(entry.total) || 0;
    PD_PROJECT_KEYS.forEach(function (k) {
      out[k] += Number(entry[k]) || 0;
    });
  }
  out.total = pdRound(out.total);
  PD_PROJECT_KEYS.forEach(function (k) { out[k] = pdRound(out[k]); });
  return out;
}

function pdSumMonthSales(y, m) {
  ensurePerformanceLogs();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let out = { total: 0, hasLog: false };
  PD_PROJECT_KEYS.forEach(function (k) { out[k] = 0; });
  for (let d = 1; d <= daysInMonth; d++) {
    let key = typeof revenueDateKey === 'function'
      ? revenueDateKey(y, m, d)
      : y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    let entry = pdGetSalesEntry(key);
    if (!entry) continue;
    out.hasLog = true;
    out.total += Number(entry.total) || 0;
    PD_PROJECT_KEYS.forEach(function (k) {
      out[k] += Number(entry[k]) || 0;
    });
  }
  out.total = pdRound(out.total);
  PD_PROJECT_KEYS.forEach(function (k) { out[k] = pdRound(out[k]); });
  return out;
}

function pdSumAllTimeRevenue() {
  let total = 0;
  let byProject = {};
  PD_PROJECT_KEYS.forEach(function (k) { byProject[k] = 0; });
  pdListRevenueDateKeys().forEach(function (key) {
    let entry = pdGetRevenueEntry(key);
    if (!entry) return;
    total += Number(entry.total) || 0;
    PD_PROJECT_KEYS.forEach(function (k) {
      byProject[k] += Number(entry[k]) || 0;
    });
  });
  return {
    total: pdRound(total),
    byProject: PD_PROJECT_KEYS.reduce(function (o, k) {
      o[k] = pdRound(byProject[k]);
      return o;
    }, {})
  };
}

function pdSumAllTimeSales() {
  let total = 0;
  let byProject = {};
  PD_PROJECT_KEYS.forEach(function (k) { byProject[k] = 0; });
  pdListSalesDateKeys().forEach(function (key) {
    let entry = pdGetSalesEntry(key);
    if (!entry) return;
    total += Number(entry.total) || 0;
    PD_PROJECT_KEYS.forEach(function (k) {
      byProject[k] += Number(entry[k]) || 0;
    });
  });
  return {
    total: pdRound(total),
    byProject: PD_PROJECT_KEYS.reduce(function (o, k) {
      o[k] = pdRound(byProject[k]);
      return o;
    }, {})
  };
}

function pdPctChange(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return pdRound(((cur - prev) / prev) * 100);
}

function pdFormatTrendPct(pct) {
  let sign = pct > 0 ? '+' : '';
  return sign + pct + '%';
}

function pdGetPortfolioSummary(viewY, viewM) {
  hubEnsureViewMonth();
  let y = viewY != null ? viewY : hubViewMonth.y;
  let m = viewM != null ? viewM : hubViewMonth.m;
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let refY = ref.getFullYear();
  let refM = ref.getMonth();
  let refD = ref.getDate();
  let monthRev = pdSumMonthRevenue(y, m);
  let pm = m > 0 ? { y: y, m: m - 1 } : { y: y - 1, m: 11 };
  let prevMonthRev = pdSumMonthRevenue(pm.y, pm.m);
  let monthSales = pdSumMonthSales(y, m);
  let prevMonthSales = pdSumMonthSales(pm.y, pm.m);

  let viewingCurrentMonth = (y === refY && m === refM);
  let todayKeyVal = viewingCurrentMonth && typeof todayKey === 'function'
    ? todayKey()
    : (typeof revenueDateKey === 'function' ? revenueDateKey(y, m, refD) : '');
  let yesterdayKeyVal = viewingCurrentMonth && typeof yesterdayKey === 'function' ? yesterdayKey() : '';

  let todayRevEntry = todayKeyVal ? pdGetRevenueEntry(todayKeyVal) : null;
  let yesterdayRevEntry = yesterdayKeyVal ? pdGetRevenueEntry(yesterdayKeyVal) : null;
  let todayRev = todayRevEntry ? (Number(todayRevEntry.total) || 0) : null;
  let yesterdayRev = yesterdayRevEntry ? (Number(yesterdayRevEntry.total) || 0) : null;

  let todaySalesEntry = todayKeyVal ? pdGetSalesEntry(todayKeyVal) : null;
  let yesterdaySalesEntry = yesterdayKeyVal ? pdGetSalesEntry(yesterdayKeyVal) : null;
  let todaySales = todaySalesEntry ? (Number(todaySalesEntry.total) || 0) : null;
  let yesterdaySales = yesterdaySalesEntry ? (Number(yesterdaySalesEntry.total) || 0) : null;

  let cumulativeRev = pdSumAllTimeRevenue();
  let cumulativeSales = pdSumAllTimeSales();

  return {
    hasRevenueLog: monthRev.hasLog || cumulativeRev.total > 0,
    hasSalesLog: monthSales.hasLog || cumulativeSales.total > 0,
    monthlyRevenue: monthRev.total,
    monthlySales: monthSales.total,
    monthlyRevenueTrend: pdFormatTrendPct(pdPctChange(monthRev.total, prevMonthRev.total)),
    monthlySalesTrend: pdFormatTrendPct(pdPctChange(monthSales.total, prevMonthSales.total)),
    dailyRevenue: todayRev,
    dailySales: todaySales,
    dailyRevenueTrend: pdFormatTrendPct(pdPctChange(todayRev || 0, yesterdayRev || 0)),
    dailySalesTrend: pdFormatTrendPct(pdPctChange(todaySales || 0, yesterdaySales || 0)),
    viewingCurrentMonth: viewingCurrentMonth,
    viewYear: y,
    viewMonth: m,
    cumulativeRevenue: cumulativeRev.total,
    cumulativeSales: cumulativeSales.total,
    cumulativeRevenueByProject: cumulativeRev.byProject,
    cumulativeSalesByProject: cumulativeSales.byProject,
    monthRevenueByProject: monthRev,
    monthSalesByProject: monthSales
  };
}

function pdGetStackedMonthlyRevenue(endYear, endMonth, count) {
  count = count || 6;
  let rows = [];
  let y = endYear;
  let m = endMonth;
  for (let i = 0; i < count; i++) {
    let monthData = pdSumMonthRevenue(y, m);
    rows.unshift({
      label: (m + 1) + '月',
      total: monthData.total,
      ram: monthData.ram || 0,
      orca: monthData.orca || 0,
      cary: monthData.cary || 0,
      genesis: monthData.genesis || 0,
      other: monthData.other || 0,
      hasLog: monthData.hasLog
    });
    m -= 1;
    if (m < 0) { m = 11; y -= 1; }
  }
  return rows;
}

function pdRevenueEntryHasData(entry) {
  if (!entry) return false;
  if (entry.total > 0) return true;
  return !!(entry.ramAccounts && Object.keys(entry.ramAccounts).length) ||
    !!(entry.orcaAccounts && Object.keys(entry.orcaAccounts).length) ||
    !!(entry.caryAccounts && Object.keys(entry.caryAccounts).length) ||
    !!(entry.accounts && Object.keys(entry.accounts).length);
}

function pdSalesEntryHasData(entry) {
  if (!entry) return false;
  if (entry.total > 0) return true;
  return !!(entry.accounts && Object.keys(entry.accounts).length);
}

function pdDeleteAccountPerformanceData(projectKey, accountId) {
  if (!projectKey || !accountId) return 0;
  ensurePerformanceLogs();
  let removed = 0;

  Object.keys(settings.revenueLog).forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry) return;
    let touched = false;
    if (projectKey === 'ram' && entry.ramAccounts && entry.ramAccounts[accountId]) {
      delete entry.ramAccounts[accountId];
      touched = true;
    }
    if (projectKey === 'orca' && entry.orcaAccounts && entry.orcaAccounts[accountId]) {
      delete entry.orcaAccounts[accountId];
      touched = true;
    }
    if (projectKey === 'cary' && entry.caryAccounts && entry.caryAccounts[accountId]) {
      delete entry.caryAccounts[accountId];
      touched = true;
    }
    if (entry.accounts && entry.accounts[accountId]) {
      let ae = entry.accounts[accountId];
      if (!ae.projectKey || ae.projectKey === projectKey) {
        delete entry.accounts[accountId];
        touched = true;
      }
    }
    if (!touched) return;
    entry = pdRecalculateRevenueEntry(entry, dateKey);
    if (pdRevenueEntryHasData(entry)) {
      settings.revenueLog[dateKey] = entry;
    } else {
      delete settings.revenueLog[dateKey];
    }
    removed += 1;
  });

  Object.keys(settings.salesLog).forEach(function (dateKey) {
    let entry = settings.salesLog[dateKey];
    if (!entry || !entry.accounts || !entry.accounts[accountId]) return;
    let ae = entry.accounts[accountId];
    if (ae.projectKey && ae.projectKey !== projectKey) return;
    delete entry.accounts[accountId];
    entry = pdRecalculateSalesEntry(entry);
    if (pdSalesEntryHasData(entry)) {
      settings.salesLog[dateKey] = entry;
    } else {
      delete settings.salesLog[dateKey];
    }
    removed += 1;
  });

  if (removed > 0) {
    settings.lastUpdate = new Date().toLocaleString();
    if (typeof markActivity === 'function') markActivity();
    pdPersist();
    pdNotifyPerformanceChanged({ type: 'delete', projectKey: projectKey, accountId: accountId });
  }
  return removed;
}

function pdNotifyPerformanceChanged(opts) {
  opts = opts || {};
  if (typeof allOrgSummary === 'function' && typeof updateHomeDashboard === 'function') {
    updateHomeDashboard(allOrgSummary());
  } else if (typeof updateHomeDashboard === 'function') {
    updateHomeDashboard();
  } else if (typeof renderHome === 'function') {
    renderHome();
  }
  if (typeof renderRevenueManage === 'function') {
    if (typeof revenueManagePage === 'undefined' ||
        !revenueManagePage.classList.contains('hidden')) {
      renderRevenueManage();
    }
  }
  if (typeof renderSalesManage === 'function') {
    if (typeof salesManagePage === 'undefined' ||
        !salesManagePage.classList.contains('hidden')) {
      renderSalesManage();
    }
  }
  if (typeof renderPortfolio === 'function') {
    renderPortfolio();
  }
  if (typeof updateOchanMessage === 'function') updateOchanMessage();
  if (typeof render === 'function' && opts.refreshOrg !== false) {
    /* render() also calls renderHome; skip full render to avoid double work unless needed */
  }
}

if (typeof window !== 'undefined') {
  window.ensurePerformanceLogs = ensurePerformanceLogs;
  window.pdIsDemoMode = pdIsDemoMode;
  window.pdEmptyMark = pdEmptyMark;
  window.hubEnsureViewMonth = hubEnsureViewMonth;
  window.hubGetViewMonth = hubGetViewMonth;
  window.hubSetViewMonth = hubSetViewMonth;
  window.hubResetViewMonth = hubResetViewMonth;
  window.hubPrevMonth = hubPrevMonth;
  window.hubNextMonth = hubNextMonth;
  window.hubOpenMonthPicker = hubOpenMonthPicker;
  window.hubCloseMonthPicker = hubCloseMonthPicker;
  window.hubPickMonth = hubPickMonth;
  window.hubPickerPrevYear = hubPickerPrevYear;
  window.hubPickerNextYear = hubPickerNextYear;
  window.hubFormatMonthLabel = hubFormatMonthLabel;
  window.pdProjectHasActualData = pdProjectHasActualData;
  window.pdFilterProjectsWithData = pdFilterProjectsWithData;
  window.pdHasAnyManageProjectData = pdHasAnyManageProjectData;
  window.pdDeleteAccountPerformanceData = pdDeleteAccountPerformanceData;
  window.pdCollectRevenueAccountIds = pdCollectRevenueAccountIds;
  window.pdCollectSalesAccountIds = pdCollectSalesAccountIds;
  window.pdSaveRevenueAccountEntry = pdSaveRevenueAccountEntry;
  window.pdSaveSalesAccountEntry = pdSaveSalesAccountEntry;
  window.pdNotifyPerformanceChanged = pdNotifyPerformanceChanged;
  window.pdGetPortfolioSummary = pdGetPortfolioSummary;
  window.pdGetStackedMonthlyRevenue = pdGetStackedMonthlyRevenue;
  window.pdSumMonthRevenue = pdSumMonthRevenue;
  window.pdSumMonthSales = pdSumMonthSales;
  window.pdSumAllTimeRevenue = pdSumAllTimeRevenue;
  window.pdSumAllTimeSales = pdSumAllTimeSales;
  window.pdGetRevenueEntryRaw = pdGetRevenueEntryRaw;
  window.pdGetSalesEntryRaw = pdGetSalesEntryRaw;
  window.pdGetOperatingUsdAsOf = pdGetOperatingUsdAsOf;
  window.pdGetProjectOperatingUsd = pdGetProjectOperatingUsd;
  window.pdCalcDailyOperation = pdCalcDailyOperation;
  window.pdAddInvestmentRecord = pdAddInvestmentRecord;
  window.pdSyncRamSaveInvestments = pdSyncRamSaveInvestments;
  window.pdGetAdditionalInvestmentForDate = pdGetAdditionalInvestmentForDate;
  window.pdGetInvestmentHistoryRecords = pdGetInvestmentHistoryRecords;
  window.pdRamAccountRevenueTotal = pdRamAccountRevenueTotal;
  window.pdOrcaAccountRevenueTotal = pdOrcaAccountRevenueTotal;
  window.pdPreviewRamAccountRevenueTotal = pdPreviewRamAccountRevenueTotal;
  window.pdGetRamOperationRevenue = pdGetRamOperationRevenue;
  window.pdCreatePerformanceSnapshot = pdCreatePerformanceSnapshot;
  window.pdRestorePerformanceSnapshot = pdRestorePerformanceSnapshot;
  window.pdImportRamRevenueRecords = pdImportRamRevenueRecords;
  window.pdImportRamRevenueRecordsWithMeta = pdImportRamRevenueRecordsWithMeta;
  window.pdImportRamSalesRecords = pdImportRamSalesRecords;
  window.pdImportRamExcelMonth = pdImportRamExcelMonth;
  window.pdImportOrcaRevenueRecords = pdImportOrcaRevenueRecords;
  window.pdResolveRamAccountIdByExcelKey = pdResolveRamAccountIdByExcelKey;
  window.pdSumProjectDayRevenue = pdSumProjectDayRevenue;
  window.pdProjectDayHasRevenue = pdProjectDayHasRevenue;
  window.pdIsExcelMonthImported = pdIsExcelMonthImported;
  window.pdIsExcelMonthFullyImported = pdIsExcelMonthFullyImported;
  window.pdGetExcelMonthImportStatus = pdGetExcelMonthImportStatus;
  window.pdDetectImportedRamSalesMonth = pdDetectImportedRamSalesMonth;
  window.pdMarkExcelMonthImported = pdMarkExcelMonthImported;
  window.pdFormatExcelImportMonthLabel = pdFormatExcelImportMonthLabel;
  window.pdListExcelImportedMonthKeys = pdListExcelImportedMonthKeys;
  window.pdDetectImportedRamMonth = pdDetectImportedRamMonth;
}
