/* OUKEI HUB BITSYNC Principal — NFT購入額 / 運用額（累積・履歴） */

function bitsyncEnsureInputAccounts() {
  if (typeof settings === 'undefined' || !settings || typeof settings !== 'object') {
    throw new Error('settings が初期化されていません');
  }
  if (!Array.isArray(settings.bitsyncInputAccounts)) settings.bitsyncInputAccounts = [];
}

function bitsyncNormalizeRecord(record) {
  if (!record || typeof record !== 'object') return null;
  let amount = Number(record.amount) || 0;
  if (amount <= 0) return null;
  let dateKey = String(record.dateKey || '').trim();
  if (!dateKey && typeof todayKey === 'function') dateKey = todayKey();
  if (!dateKey) return null;
  let type = record.type === 'initial' ? 'initial' : 'additional';
  return { dateKey: dateKey, amount: amount, type: type };
}

function bitsyncNormalizeAccount(acc) {
  if (!acc || !acc.id) return acc;
  if (!Array.isArray(acc.nftPurchaseRecords)) acc.nftPurchaseRecords = [];
  if (!Array.isArray(acc.operatingRecords)) acc.operatingRecords = [];
  acc.nftPurchaseRecords = acc.nftPurchaseRecords
    .map(bitsyncNormalizeRecord)
    .filter(Boolean)
    .sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  acc.operatingRecords = acc.operatingRecords
    .map(bitsyncNormalizeRecord)
    .filter(Boolean)
    .sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  if (acc.startDate == null || acc.startDate === '') acc.startDate = '';
  return acc;
}

function bitsyncGetRawAccount(accountId) {
  bitsyncEnsureInputAccounts();
  return settings.bitsyncInputAccounts.find(function (a) { return a && a.id === accountId; }) || null;
}

function bitsyncSumRecords(records) {
  if (!Array.isArray(records) || !records.length) return 0;
  let total = records.reduce(function (sum, r) {
    return sum + (Number(r && r.amount) || 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

function bitsyncGetNftPurchaseTotal(accountId) {
  let acc = bitsyncGetRawAccount(accountId);
  if (!acc) return 0;
  bitsyncNormalizeAccount(acc);
  return bitsyncSumRecords(acc.nftPurchaseRecords);
}

function bitsyncGetOperatingPrincipalTotal(accountId) {
  let acc = bitsyncGetRawAccount(accountId);
  if (!acc) return 0;
  bitsyncNormalizeAccount(acc);
  return bitsyncSumRecords(acc.operatingRecords);
}

function bitsyncGetTotalInvestment(accountId) {
  return Math.round((bitsyncGetNftPurchaseTotal(accountId) + bitsyncGetOperatingPrincipalTotal(accountId)) * 100) / 100;
}

function bitsyncGetProjectNftPurchaseTotal() {
  bitsyncEnsureInputAccounts();
  return Math.round(settings.bitsyncInputAccounts.reduce(function (sum, acc) {
    if (!acc || !acc.id) return sum;
    return sum + bitsyncGetNftPurchaseTotal(acc.id);
  }, 0) * 100) / 100;
}

function bitsyncGetProjectOperatingPrincipalTotal() {
  bitsyncEnsureInputAccounts();
  return Math.round(settings.bitsyncInputAccounts.reduce(function (sum, acc) {
    if (!acc || !acc.id) return sum;
    return sum + bitsyncGetOperatingPrincipalTotal(acc.id);
  }, 0) * 100) / 100;
}

function bitsyncGetProjectTotalInvestment() {
  return Math.round((bitsyncGetProjectNftPurchaseTotal() + bitsyncGetProjectOperatingPrincipalTotal()) * 100) / 100;
}

function bitsyncPushRecord(records, dateKey, amount, type) {
  amount = Number(amount) || 0;
  if (amount <= 0) return false;
  dateKey = String(dateKey || '').trim();
  if (!dateKey && typeof todayKey === 'function') dateKey = todayKey();
  if (!dateKey) return false;
  type = type === 'initial' ? 'initial' : 'additional';
  records.push({ dateKey: dateKey, amount: amount, type: type });
  return true;
}

function bitsyncAddNftPurchase(accountId, dateKey, amount, type) {
  let acc = bitsyncGetRawAccount(accountId);
  if (!acc) return false;
  bitsyncNormalizeAccount(acc);
  if (!bitsyncPushRecord(acc.nftPurchaseRecords, dateKey, amount, type)) return false;
  acc.nftPurchaseRecords.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  return true;
}

function bitsyncAddOperatingPrincipal(accountId, dateKey, amount, type) {
  let acc = bitsyncGetRawAccount(accountId);
  if (!acc) return false;
  bitsyncNormalizeAccount(acc);
  if (!bitsyncPushRecord(acc.operatingRecords, dateKey, amount, type)) return false;
  acc.operatingRecords.sort(function (a, b) { return a.dateKey.localeCompare(b.dateKey); });
  return true;
}

function bitsyncCollectOperationRewardHistory() {
  if (typeof settings === 'undefined' || !settings.revenueLog) return [];
  let out = [];
  Object.keys(settings.revenueLog).sort().forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry || !entry.bitsyncAccounts) return;
    let dayTotal = 0;
    Object.keys(entry.bitsyncAccounts).forEach(function (id) {
      let ae = entry.bitsyncAccounts[id];
      if (!ae) return;
      dayTotal += Number(ae.operationReward) || 0;
    });
    if (dayTotal > 0) out.push({ dateKey: dateKey, amount: dayTotal });
  });
  return out;
}

function bitsyncPredictMonthlyYield(viewY, viewM) {
  let history = bitsyncCollectOperationRewardHistory();
  if (history.length < 3) return '—';
  let recent = history.slice(-14);
  let sum = recent.reduce(function (s, row) { return s + row.amount; }, 0);
  let avgDaily = sum / recent.length;
  if (!avgDaily || avgDaily <= 0) return '—';
  let daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  let projected = Math.round(avgDaily * daysInMonth * 100) / 100;
  let totalInvest = bitsyncGetProjectTotalInvestment();
  if (totalInvest <= 0) return '—';
  if (typeof pfFormatPredictedMonthlyYield === 'function') {
    return pfFormatPredictedMonthlyYield(projected, totalInvest, viewY, viewM);
  }
  let pct = Math.round((projected / totalInvest) * 1000) / 10;
  return pct + '%';
}

function bitsyncCalcRecoveryPct(profitUsd, totalInvestment) {
  profitUsd = Number(profitUsd) || 0;
  totalInvestment = Number(totalInvestment) || 0;
  if (totalInvestment <= 0) return null;
  return Math.round((profitUsd / totalInvestment) * 1000) / 10;
}

function bitsyncAccumulateAccountProfit(ae, totals) {
  if (!ae) return false;
  if (typeof pdIsBitsyncAccountEntryPresent === 'function' &&
      !pdIsBitsyncAccountEntryPresent(ae)) return false;
  totals.nftSaleProfit += Number(ae.nftSaleReward) || 0;
  totals.personalOperationProfit += Number(ae.operationReward) || 0;
  totals.groupOperationProfit += Number(ae.profitBonus) || 0;
  return true;
}

function bitsyncRoundProfitBreakdown(totals) {
  totals.nftSaleProfit = Math.round(totals.nftSaleProfit * 100) / 100;
  totals.personalOperationProfit = Math.round(totals.personalOperationProfit * 100) / 100;
  totals.groupOperationProfit = Math.round(totals.groupOperationProfit * 100) / 100;
  totals.operationProfit = Math.round((totals.personalOperationProfit + totals.groupOperationProfit) * 100) / 100;
  totals.totalProfit = Math.round((totals.nftSaleProfit + totals.personalOperationProfit + totals.groupOperationProfit) * 100) / 100;
  return totals;
}

function bitsyncEmptyProfitBreakdown() {
  return {
    nftSaleProfit: 0,
    personalOperationProfit: 0,
    groupOperationProfit: 0,
    operationProfit: 0,
    totalProfit: 0,
    hasData: false
  };
}

function bitsyncSumAllTimeProfitBreakdown() {
  if (typeof settings === 'undefined' || !settings.revenueLog) {
    return bitsyncEmptyProfitBreakdown();
  }
  let totals = bitsyncEmptyProfitBreakdown();
  Object.keys(settings.revenueLog).forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry || !entry.bitsyncAccounts) return;
    Object.keys(entry.bitsyncAccounts).forEach(function (id) {
      if (bitsyncAccumulateAccountProfit(entry.bitsyncAccounts[id], totals)) totals.hasData = true;
    });
  });
  return bitsyncRoundProfitBreakdown(totals);
}

function bitsyncDateKeyInMonth(dateKey, viewY, viewM) {
  if (!dateKey) return false;
  let m = String(viewM + 1).padStart(2, '0');
  let prefixDash = viewY + '-' + m + '-';
  let prefixSlash = viewY + '/' + m + '/';
  return String(dateKey).indexOf(prefixDash) === 0 || String(dateKey).indexOf(prefixSlash) === 0;
}

function bitsyncSumMonthProfitBreakdown(viewY, viewM) {
  if (typeof settings === 'undefined' || !settings.revenueLog) {
    return bitsyncEmptyProfitBreakdown();
  }
  let totals = bitsyncEmptyProfitBreakdown();
  Object.keys(settings.revenueLog).forEach(function (dateKey) {
    if (!bitsyncDateKeyInMonth(dateKey, viewY, viewM)) return;
    let entry = settings.revenueLog[dateKey];
    if (!entry || !entry.bitsyncAccounts) return;
    Object.keys(entry.bitsyncAccounts).forEach(function (id) {
      if (bitsyncAccumulateAccountProfit(entry.bitsyncAccounts[id], totals)) totals.hasData = true;
    });
  });
  return bitsyncRoundProfitBreakdown(totals);
}

/** 個人運用月利 = 当月個人運用利益 ÷ 個人運用額 × 100（NFT購入・グループ利益は含めない） */
function bitsyncCalcPersonalMonthlyYield(viewY, viewM) {
  let month = bitsyncSumMonthProfitBreakdown(viewY, viewM);
  let principal = bitsyncGetProjectOperatingPrincipalTotal();
  if (principal <= 0 || !month.hasData) return null;
  return Math.round((month.personalOperationProfit / principal) * 1000) / 10;
}

if (typeof window !== 'undefined') {
  window.bitsyncEnsureInputAccounts = bitsyncEnsureInputAccounts;
  window.bitsyncNormalizeAccount = bitsyncNormalizeAccount;
  window.bitsyncGetNftPurchaseTotal = bitsyncGetNftPurchaseTotal;
  window.bitsyncGetOperatingPrincipalTotal = bitsyncGetOperatingPrincipalTotal;
  window.bitsyncGetTotalInvestment = bitsyncGetTotalInvestment;
  window.bitsyncGetProjectNftPurchaseTotal = bitsyncGetProjectNftPurchaseTotal;
  window.bitsyncGetProjectOperatingPrincipalTotal = bitsyncGetProjectOperatingPrincipalTotal;
  window.bitsyncGetProjectTotalInvestment = bitsyncGetProjectTotalInvestment;
  window.bitsyncAddNftPurchase = bitsyncAddNftPurchase;
  window.bitsyncAddOperatingPrincipal = bitsyncAddOperatingPrincipal;
  window.bitsyncPredictMonthlyYield = bitsyncPredictMonthlyYield;
  window.bitsyncCalcRecoveryPct = bitsyncCalcRecoveryPct;
  window.bitsyncSumAllTimeProfitBreakdown = bitsyncSumAllTimeProfitBreakdown;
  window.bitsyncSumMonthProfitBreakdown = bitsyncSumMonthProfitBreakdown;
  window.bitsyncCalcPersonalMonthlyYield = bitsyncCalcPersonalMonthlyYield;
}
