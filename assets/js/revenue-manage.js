/* OUKEI HUB Revenue Management — Ver2.0.1 */

var rmView = { y: new Date().getFullYear(), m: new Date().getMonth() };
var rmFilter = 'all';
var rmExpandedAccounts = {};
var rmDailyTableBound = false;

var RM_ACCOUNT_DETAIL_DEFS = {
  ram: [
    { key: 'operation', label: '運用' },
    { key: 'todayRevenue', label: '本日収益' }
  ],
  orca: [
    { key: 'yesterdayAiProfit', label: '昨日AI利益' },
    { key: 'todayAffiliateProfit', label: '本日AF収益' },
    { key: 'total', label: '合計' }
  ],
  eni: [
    { key: 'operationAmount', label: '運用額' },
    { key: 'usdtBalance', label: 'USDT残高' },
    { key: 'withdrawalAmount', label: '出金額' },
    { key: 'totalPerformance', label: '総実績' },
    { key: 'dailyProfit', label: '本日の利益' },
    { key: 'dailySales', label: '本日売上' }
  ]
};

var RM_PROJECTS = [
  { key: 'ram', name: 'RAM' },
  { key: 'orca', name: 'ORCA' },
  { key: 'cary', name: 'Cary Pact' },
  { key: 'genesis', name: 'Genesis' },
  { key: 'other', name: 'その他' }
];

function rmGetManageProjectSource() {
  if (typeof pmGetManageProjectList === 'function') {
    let list = pmGetManageProjectList();
    if (list.length) return list;
  }
  return RM_PROJECTS.filter(function (p) { return p.key !== 'other'; });
}

function rmGetActiveProjects() {
  let list = rmGetManageProjectSource();
  if (typeof pdFilterProjectsWithData === 'function') {
    return pdFilterProjectsWithData(list);
  }
  return list;
}

function rmSyncProjectFilterOptions() {
  let sel = document.getElementById('rmProjectFilter');
  if (!sel) return;
  let active = rmGetActiveProjects();
  let activeKeys = active.map(function (p) { return p.key; });
  if (rmFilter !== 'all' && activeKeys.indexOf(rmFilter) < 0) rmFilter = 'all';
  sel.innerHTML = '<option value="all">すべてのプロジェクト</option>' +
    active.map(function (p) {
      return '<option value="' + rmEscapeAttr(p.key) + '">' + rmEscape(p.name) + '</option>';
    }).join('');
  sel.value = rmFilter;
}

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
    { id: 'demo_ram_1', username: 'Project A-1' },
    { id: 'demo_ram_2', username: 'Project A-2' },
    { id: 'demo_ram_3', username: 'Project A-3' }
  ],
  orca: [
    { id: 'demo_orca_1', username: 'Project B-1' },
    { id: 'demo_orca_2', username: 'Project B-2' }
  ],
  cary: [
    { id: 'demo_cary_1', username: 'OUKEI-1' },
    { id: 'demo_cary_2', username: 'OUKEI-2' },
    { id: 'demo_cary_3', username: 'OUKEI-3' }
  ],
  genesis: [
    { id: 'demo_genesis_1', username: 'Demo G-1' },
    { id: 'demo_genesis_2', username: 'Demo G-2' },
    { id: 'demo_genesis_3', username: 'Demo G-3' }
  ],
  other: [
    { id: 'demo_other_1', username: 'Demo X-1' },
    { id: 'demo_other_2', username: 'Demo X-2' },
    { id: 'demo_other_3', username: 'Demo X-3' }
  ]
};

var RM_DEMO_ACCOUNT_TREE = {
  ram: [
    { id: 'demo_ram_1', name: 'Project A-1', parentId: null, depth: 0 },
    { id: 'demo_ram_2', name: 'Project A-2', parentId: 'demo_ram_1', depth: 1 },
    { id: 'demo_ram_3', name: 'Project B-1', parentId: null, depth: 0 },
    { id: 'demo_ram_4', name: 'Project B-2', parentId: 'demo_ram_3', depth: 1 },
    { id: 'demo_ram_5', name: 'OUKEI-1', parentId: null, depth: 0 },
    { id: 'demo_ram_6', name: 'OUKEI-2', parentId: 'demo_ram_5', depth: 1 }
  ],
  orca: [
    { id: 'demo_orca_1', name: 'Project B-1', parentId: null, depth: 0 },
    { id: 'demo_orca_2', name: 'Project B-2', parentId: 'demo_orca_1', depth: 1 },
    { id: 'demo_orca_3', name: 'OUKEI-1', parentId: null, depth: 0 },
    { id: 'demo_orca_4', name: 'OUKEI-2', parentId: 'demo_orca_3', depth: 1 }
  ],
  cary: [
    { id: 'demo_cary_1', name: 'OUKEI-1', parentId: null, depth: 0 },
    { id: 'demo_cary_2', name: 'OUKEI-2', parentId: 'demo_cary_1', depth: 1 },
    { id: 'demo_cary_3', name: 'Demo C-1', parentId: null, depth: 0 }
  ],
  genesis: [
    { id: 'demo_genesis_1', name: 'Demo G-1', parentId: null, depth: 0 },
    { id: 'demo_genesis_2', name: 'Demo G-2', parentId: 'demo_genesis_1', depth: 1 },
    { id: 'demo_genesis_3', name: 'Demo G-3', parentId: null, depth: 0 }
  ],
  other: [
    { id: 'demo_other_1', name: 'Demo X-1', parentId: null, depth: 0 },
    { id: 'demo_other_2', name: 'Demo X-2', parentId: 'demo_other_1', depth: 1 },
    { id: 'demo_other_3', name: 'Demo X-3', parentId: null, depth: 0 }
  ]
};

function rmGetLiveRamAccountTree() {
  if (typeof aimBuildOrgAccountTree === 'function') {
    let tree = aimBuildOrgAccountTree('ram');
    if (tree.length) return tree;
  }
  if (typeof getRamAllRootAccounts !== 'function') return [];
  return getRamAllRootAccounts().map(function (acc) {
    return {
      id: acc.id,
      name: acc.username,
      parentId: null,
      depth: 0
    };
  });
}

function rmGetLiveOrcaAccountTree() {
  // 実績入力レジストリ順を正とする（組織図は親子情報の補完のみ）。
  if (typeof getOrcaInputAccounts === 'function') {
    let inputs = getOrcaInputAccounts();
    if (inputs.length) {
      let orgById = {};
      if (typeof aimBuildOrgAccountTree === 'function') {
        aimBuildOrgAccountTree('orca').forEach(function (node) {
          if (node && node.id) orgById[node.id] = node;
        });
      }
      return inputs.map(function (acc) {
        let org = orgById[acc.id];
        return {
          id: acc.id,
          name: acc.username,
          parentId: org ? (org.parentId || null) : null,
          depth: org ? (org.depth || 0) : 0,
          sortOrder: org && org.sortOrder != null ? org.sortOrder : undefined
        };
      });
    }
  }
  if (typeof aimBuildOrgAccountTree === 'function') {
    let tree = aimBuildOrgAccountTree('orca');
    if (tree.length) return tree;
  }
  return [];
}

function rmEmptyMark() {
  return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
}

function rmIsDemoMode() {
  return typeof pdIsDemoMode === 'function' && pdIsDemoMode();
}

function rmFormatStatAmount(amount, label) {
  if (!amount && (!label || label === '—')) return rmEmptyMark();
  return rmMoney(amount);
}

function rmGetProjectAccountRows(projectKey) {
  let live = [];
  let demo = [];
  if (projectKey === 'ram') {
    live = rmGetLiveRamAccountTree();
    if (RM_DEMO_ACCOUNT_TREE.ram) demo = RM_DEMO_ACCOUNT_TREE.ram.slice();
  } else if (projectKey === 'orca') {
    live = rmGetLiveOrcaAccountTree();
    if (RM_DEMO_ACCOUNT_TREE.orca) demo = RM_DEMO_ACCOUNT_TREE.orca.slice();
  } else if (projectKey === 'eni') {
    if (typeof getEniInputAccounts === 'function') {
      live = getEniInputAccounts().map(function (acc) {
        return { id: acc.id, name: acc.username, parentId: null, depth: 0 };
      });
    }
  } else if (projectKey === 'cary') {
    if (typeof getCaryInputAccounts === 'function') {
      live = getCaryInputAccounts().map(function (acc) {
        return { id: acc.id, name: acc.username, parentId: null, depth: 0 };
      });
    }
    if (RM_DEMO_ACCOUNT_TREE.cary) demo = RM_DEMO_ACCOUNT_TREE.cary.slice();
  } else if (projectKey === 'genesis' || projectKey === 'other') {
    if (RM_DEMO_ACCOUNT_TREE[projectKey]) demo = RM_DEMO_ACCOUNT_TREE[projectKey].slice();
  }
  if (typeof pfResolveManageAccounts === 'function') {
    return pfResolveManageAccounts(projectKey, live, demo);
  }
  let accounts = live.length ? live : (rmIsDemoMode() ? demo : []);
  accounts = pfFilterManageAccounts(projectKey, accounts, { useDemoBypass: rmIsDemoMode() && !live.length });
  accounts = pfApplyManageAccountLabels(projectKey, accounts);
  return pfAnnotateAccountSeries(accounts, projectKey);
}

function rmCalcRamOperationAmount(accountId, ae, dateKey) {
  if (ae && ae.operationSource === 'import' && ae.operationRevenue != null && ae.operationRevenue !== '') {
    return Number(ae.operationRevenue) || 0;
  }
  if (typeof pdGetRamOperationRevenue === 'function') {
    return pdGetRamOperationRevenue(ae, accountId, dateKey);
  }
  if (ae && ae.operationRevenue != null && ae.operationRevenue !== '') {
    return Number(ae.operationRevenue) || 0;
  }
  if (typeof members === 'undefined' || typeof calcRamOperatingProfit !== 'function') return null;
  let m = members.find(function (x) { return x.id === accountId; });
  if (!m) return null;
  let inv = typeof pdGetOperatingUsdAsOf === 'function' && dateKey
    ? pdGetOperatingUsdAsOf(accountId, 'ram', dateKey)
    : (typeof calcRamEffectiveInvestment === 'function'
      ? calcRamEffectiveInvestment(m.investment, ae ? ae.addInvestment : 0)
      : (Number(m.investment) || 0));
  return calcRamOperatingProfit(inv);
}

function rmReadStoredEntryValues(projectKey, accountId, dateKey) {
  let op = null;
  let rev = null;
  let entry = typeof pdGetRevenueEntryRaw === 'function' ? pdGetRevenueEntryRaw(dateKey) : null;
  if (!entry) {
    if (projectKey === 'ram') op = rmCalcRamOperationAmount(accountId, null, dateKey);
    return { operationRevenue: op, todayRevenue: rev };
  }
  if (projectKey === 'ram' && entry.ramAccounts) {
    let found = typeof pdFindRamAccountEntry === 'function'
      ? pdFindRamAccountEntry(entry, accountId)
      : null;
    if (!found && entry.ramAccounts[accountId]) {
      found = { ae: entry.ramAccounts[accountId], storageId: accountId };
    }
    if (found) {
      let ae = found.ae;
      let storageId = found.storageId;
      if (ae.todayRevenue != null) rev = Number(ae.todayRevenue) || 0;
      op = rmCalcRamOperationAmount(storageId, ae, dateKey);
    }
  } else if (projectKey === 'orca' && entry.orcaAccounts && entry.orcaAccounts[accountId]) {
    let ae = entry.orcaAccounts[accountId];
    if (ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null) {
      return {
        yesterdayAiProfit: Number(ae.yesterdayAiProfit) || 0,
        todayAffiliateProfit: Number(ae.todayAffiliateProfit) || 0,
        total: typeof calcOrcaAccountTotal === 'function'
          ? calcOrcaAccountTotal(ae)
          : (Number(ae.yesterdayAiProfit) || 0) + (Number(ae.todayAffiliateProfit) || 0)
      };
    }
    if (ae.todayRevenue != null) {
      return { yesterdayAiProfit: null, todayAffiliateProfit: null, total: Number(ae.todayRevenue) || 0 };
    }
  } else if (projectKey === 'eni' && entry.eniAccounts && entry.eniAccounts[accountId]) {
    let ae = entry.eniAccounts[accountId];
    return {
      operationAmount: ae.operationAmount != null ? Number(ae.operationAmount) : null,
      usdtBalance: ae.usdtBalance != null ? Number(ae.usdtBalance) : null,
      withdrawalAmount: ae.withdrawalAmount != null ? Number(ae.withdrawalAmount) : null,
      totalPerformance: ae.totalPerformance != null ? Number(ae.totalPerformance) : null,
      dailyProfit: ae.dailyProfit != null ? Number(ae.dailyProfit) : null,
      dailySales: ae.dailySales != null ? Number(ae.dailySales) : null,
      // legacy fallbacks
      todayRevenue: ae.todayRevenue != null ? Number(ae.todayRevenue) : null,
      referralProfit: ae.referralProfit != null ? Number(ae.referralProfit) : null,
      titleProfit: ae.titleProfit != null ? Number(ae.titleProfit) : null,
      note: ae.note || '',
      total: typeof pdEniAccountRevenueTotal === 'function' ? pdEniAccountRevenueTotal(ae) : 0
    };
  } else if (entry.accounts && entry.accounts[accountId]) {
    let ae = entry.accounts[accountId];
    if (!ae.projectKey || ae.projectKey === projectKey) {
      if (ae.todayRevenue != null) rev = Number(ae.todayRevenue) || 0;
      if (ae.operationRevenue != null) op = Number(ae.operationRevenue) || 0;
    }
  }
  return { operationRevenue: op, todayRevenue: rev };
}

function rmOpenRevenueEntryModal(projectKey, accountId, accountName, dateKey, amount) {
  pfRegisterManageDisplayFromEntry(projectKey, accountId);
  let dateVal = dateKey || pfFormatIsoDate(rmView.y, rmView.m, 1);
  if (projectKey === 'orca') {
    rmOpenOrcaRevenueEntryModal(accountId, accountName, dateVal);
    return;
  }
  if (projectKey === 'eni') {
    rmOpenEniRevenueEntryModal(accountId, accountName, dateVal);
    return;
  }
  let projLabel = pfGetProjectLabel(projectKey, RM_PROJECTS);
  let stored = rmReadStoredEntryValues(projectKey, accountId, dateVal);
  let opVal = stored.operationRevenue != null ? stored.operationRevenue : '';
  let revVal = stored.todayRevenue != null ? stored.todayRevenue : (amount || '');
  if (rmIsDemoMode() && revVal === '' && !stored.todayRevenue) {
    revVal = 128;
    if (opVal === '') opVal = 120;
  }
  let body =
    '<input type="hidden" id="rmEntryProjectKey" value="' + pfEscapeAttr(projectKey) + '">' +
    '<input type="hidden" id="rmEntryAccountId" value="' + pfEscapeAttr(accountId) + '">' +
    pfEntryDateField('日付', 'rmEntryDate', dateVal) +
    pfEntryReadonlyField('プロジェクト', projLabel) +
    pfEntryReadonlyField('アカウント', accountName || accountId) +
    pfEntryNumberField('運用（$）', 'rmEntryOperation', opVal,
      '投資額 × 日利で算出される本日の運用配当です。') +
    pfEntryNumberField('本日収益（$）', 'rmEntryRevenue', revVal,
      '実績入力した本日収益をそのまま記録します。');
  pfOpenEntryModal('実績入力', body, 'rmSaveRevenueEntry');
}

function rmOpenOrcaRevenueEntryModal(accountId, accountName, dateVal) {
  let stored = rmReadStoredEntryValues('orca', accountId, dateVal);
  let yesterdayVal = stored.yesterdayAiProfit != null ? stored.yesterdayAiProfit : '';
  let affVal = stored.todayAffiliateProfit != null ? stored.todayAffiliateProfit : '';
  let totalVal = stored.total != null
    ? stored.total
    : (typeof calcOrcaAccountTotal === 'function'
      ? calcOrcaAccountTotal({ yesterdayAiProfit: yesterdayVal, todayAffiliateProfit: affVal })
      : 0);
  let body =
    '<input type="hidden" id="rmEntryProjectKey" value="orca">' +
    '<input type="hidden" id="rmEntryAccountId" value="' + pfEscapeAttr(accountId) + '">' +
    pfEntryDateField('日付', 'rmEntryDate', dateVal) +
    pfEntryReadonlyField('プロジェクト', 'ORCA') +
    pfEntryReadonlyField('アカウント', accountName || accountId) +
    pfEntryNumberField('昨日AI利益（$）', 'rmEntryYesterdayAi', yesterdayVal,
      '実績入力した昨日AI利益をそのまま記録します。') +
    pfEntryNumberField('本日AF収益（$）', 'rmEntryTodayAff', affVal,
      '実績入力した本日AF収益をそのまま記録します。') +
    '<label class="pfEntryLabel">本日のORCA合計（$）</label>' +
    '<input type="text" id="rmEntryOrcaTotal" class="pfEntryInput pfEntryInput--readonly" value="' +
    String(typeof money === 'function' ? money(totalVal) : ('$' + totalVal)).replace(/"/g, '&quot;') +
    '" readonly>';
  pfOpenEntryModal('実績入力', body, 'rmSaveOrcaRevenueEntry');
  ['rmEntryYesterdayAi', 'rmEntryTodayAff'].forEach(function (id) {
    let el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', rmUpdateOrcaEntryModalTotal);
    }
  });
}

function rmUpdateOrcaEntryModalTotal() {
  let yesterdayEl = document.getElementById('rmEntryYesterdayAi');
  let affEl = document.getElementById('rmEntryTodayAff');
  let totalEl = document.getElementById('rmEntryOrcaTotal');
  let total = typeof calcOrcaAccountTotal === 'function'
    ? calcOrcaAccountTotal({
      yesterdayAiProfit: yesterdayEl && yesterdayEl.value !== '' ? Number(yesterdayEl.value) || 0 : 0,
      todayAffiliateProfit: affEl && affEl.value !== '' ? Number(affEl.value) || 0 : 0
    })
    : 0;
  if (totalEl) {
    totalEl.value = typeof money === 'function' ? money(total) : ('$' + total);
  }
}

function rmSaveOrcaRevenueEntry() {
  let dateEl = document.getElementById('rmEntryDate');
  let accountIdEl = document.getElementById('rmEntryAccountId');
  let yesterdayEl = document.getElementById('rmEntryYesterdayAi');
  let affEl = document.getElementById('rmEntryTodayAff');
  if (!accountIdEl) return;

  let accountId = accountIdEl.value;
  let dateKey = dateEl && dateEl.value
    ? dateEl.value
    : (typeof todayKey === 'function' ? todayKey() : '');

  pfRegisterManageDisplayFromEntry('orca', accountId);

  if (typeof pdSaveRevenueAccountEntry === 'function') {
    pdSaveRevenueAccountEntry(dateKey, 'orca', accountId, {
      yesterdayAiProfit: Number(yesterdayEl && yesterdayEl.value) || 0,
      todayAffiliateProfit: Number(affEl && affEl.value) || 0
    });
  }

  pfCloseEntryModal();
  if (typeof showToast === 'function') {
    showToast('✅ 実績を保存しました');
  }
}

function rmOpenEniRevenueEntryModal(accountId, accountName, dateVal) {
  let stored = rmReadStoredEntryValues('eni', accountId, dateVal);
  let opVal = stored.operationAmount != null ? stored.operationAmount : '';
  let usdtVal = stored.usdtBalance != null ? stored.usdtBalance : '';
  let withdrawVal = stored.withdrawalAmount != null ? stored.withdrawalAmount : '';
  let totalPerfVal = stored.totalPerformance != null ? stored.totalPerformance : '';
  let prev = typeof pdGetEniPreviousAccountEntry === 'function'
    ? pdGetEniPreviousAccountEntry(accountId, dateVal)
    : null;
  let prevUsdt = prev ? (Number(prev.entry.usdtBalance) || 0) : 0;
  let prevTotal = prev && prev.entry.totalPerformance != null
    ? (Number(prev.entry.totalPerformance) || 0)
    : 0;
  let calc = typeof pdCalcEniDailyMetrics === 'function' && usdtVal !== '' && totalPerfVal !== ''
    ? pdCalcEniDailyMetrics(accountId, dateVal, {
      usdtBalance: usdtVal,
      withdrawalAmount: withdrawVal === '' ? 0 : withdrawVal,
      totalPerformance: totalPerfVal
    })
    : { dailyProfit: stored.dailyProfit, dailySales: stored.dailySales };

  let body =
    '<input type="hidden" id="rmEntryProjectKey" value="eni">' +
    '<input type="hidden" id="rmEntryAccountId" value="' + pfEscapeAttr(accountId) + '">' +
    pfEntryDateField('日付', 'rmEntryDate', dateVal) +
    pfEntryReadonlyField('プロジェクト', 'ENI') +
    pfEntryReadonlyField('アカウント', accountName || accountId) +
    pfEntryNumberField('現在の運用額（USDT）', 'rmEntryEniOperation', opVal,
      'ENIでステーキング中の金額です。') +
    pfEntryNumberField('本日のUSDT残高', 'rmEntryEniUsdt', usdtVal,
      '前回: ' + (prev ? (prevUsdt + ' USDT') : '0 USDT（初回）')) +
    pfEntryNumberField('本日の出金額（USDT）', 'rmEntryEniWithdraw', withdrawVal,
      '出金した日のみ。未入力は0です。') +
    pfEntryNumberField('総実績', 'rmEntryEniTotalPerf', totalPerfVal,
      '前回: ' + (prev ? String(prevTotal) : '0（初回）')) +
    '<label class="pfEntryLabel">本日の利益（自動）</label>' +
    '<input type="text" id="rmEntryEniDailyProfit" class="pfEntryInput pfEntryInput--readonly" value="' +
    String(calc.dailyProfit != null ? calc.dailyProfit : '—').replace(/"/g, '&quot;') +
    '" readonly>' +
    '<label class="pfEntryLabel">本日売上（自動）</label>' +
    '<input type="text" id="rmEntryEniDailySales" class="pfEntryInput pfEntryInput--readonly" value="' +
    String(calc.dailySales != null ? calc.dailySales : '—').replace(/"/g, '&quot;') +
    '" readonly>';
  pfOpenEntryModal('実績入力', body, 'rmSaveEniRevenueEntry');
  ['rmEntryEniUsdt', 'rmEntryEniWithdraw', 'rmEntryEniTotalPerf', 'rmEntryDate'].forEach(function (id) {
    let el = document.getElementById(id);
    if (el) el.addEventListener('input', rmUpdateEniEntryModalDerived);
    if (el) el.addEventListener('change', rmUpdateEniEntryModalDerived);
  });
}

function rmUpdateEniEntryModalDerived() {
  let accountIdEl = document.getElementById('rmEntryAccountId');
  let dateEl = document.getElementById('rmEntryDate');
  let usdtEl = document.getElementById('rmEntryEniUsdt');
  let withdrawEl = document.getElementById('rmEntryEniWithdraw');
  let totalEl = document.getElementById('rmEntryEniTotalPerf');
  let profitEl = document.getElementById('rmEntryEniDailyProfit');
  let salesEl = document.getElementById('rmEntryEniDailySales');
  if (!accountIdEl || !profitEl || !salesEl) return;
  let accountId = accountIdEl.value;
  let dateKey = dateEl && dateEl.value
    ? dateEl.value
    : (typeof todayKey === 'function' ? todayKey() : '');
  let usdt = rmReadEntryNumber(usdtEl);
  let totalPerf = rmReadEntryNumber(totalEl);
  let withdraw = rmReadEntryNumber(withdrawEl);
  if (withdraw == null) withdraw = 0;
  if (usdt == null || totalPerf == null || typeof pdCalcEniDailyMetrics !== 'function') {
    profitEl.value = '—';
    salesEl.value = '—';
    return;
  }
  let calc = pdCalcEniDailyMetrics(accountId, dateKey, {
    usdtBalance: usdt,
    withdrawalAmount: withdraw,
    totalPerformance: totalPerf
  });
  profitEl.value = String(calc.dailyProfit) + ' USDT';
  salesEl.value = String(calc.dailySales);
}

function rmSaveEniRevenueEntry() {
  let dateEl = document.getElementById('rmEntryDate');
  let accountIdEl = document.getElementById('rmEntryAccountId');
  let opEl = document.getElementById('rmEntryEniOperation');
  let usdtEl = document.getElementById('rmEntryEniUsdt');
  let withdrawEl = document.getElementById('rmEntryEniWithdraw');
  let totalEl = document.getElementById('rmEntryEniTotalPerf');
  if (!accountIdEl) return;

  let accountId = accountIdEl.value;
  let dateKey = dateEl && dateEl.value
    ? dateEl.value
    : (typeof todayKey === 'function' ? todayKey() : '');

  let usdt = rmReadEntryNumber(usdtEl);
  let totalPerf = rmReadEntryNumber(totalEl);
  let withdraw = rmReadEntryNumber(withdrawEl);
  let op = rmReadEntryNumber(opEl);
  if (withdraw == null) withdraw = 0;

  if (usdt == null || usdt < 0 || totalPerf == null || totalPerf < 0) {
    alert('USDT残高と総実績は0以上の数値で入力してください。');
    return;
  }
  if (op != null && op < 0) {
    alert('現在の運用額は0以上の数値で入力してください。');
    return;
  }
  if (withdraw < 0) {
    alert('出金額は0以上の数値で入力してください。');
    return;
  }

  let raw = {
    operationAmount: op != null ? op : 0,
    usdtBalance: usdt,
    withdrawalAmount: withdraw,
    totalPerformance: totalPerf
  };
  let calc = typeof pdCalcEniDailyMetrics === 'function'
    ? pdCalcEniDailyMetrics(accountId, dateKey, raw)
    : { isFirst: true, prevTotalPerformance: 0, prevUsdtBalance: 0 };
  let warnings = [];
  if (!calc.isFirst && raw.totalPerformance < calc.prevTotalPerformance) {
    warnings.push('本日の総実績が前回の総実績を下回っています。入力内容をご確認ください。');
  }
  if (!calc.isFirst && raw.usdtBalance < calc.prevUsdtBalance) {
    warnings.push('USDT残高が前回より減少しています。出金額の入力漏れがないか確認してください。');
  }
  if (warnings.length && !confirm(warnings.join('\n\n') + '\n\n内容を確認のうえ保存しますか？')) {
    return;
  }

  pfRegisterManageDisplayFromEntry('eni', accountId);

  if (typeof pdSaveEniPerformanceEntry === 'function') {
    pdSaveEniPerformanceEntry(dateKey, accountId, raw);
  } else if (typeof pdSaveRevenueAccountEntry === 'function') {
    pdSaveRevenueAccountEntry(dateKey, 'eni', accountId, raw);
  }

  pfCloseEntryModal();
  if (typeof showToast === 'function') {
    showToast('✅ 実績を保存しました');
  }
}

function rmReadEntryNumber(el) {
  if (!el || el.value === '') return null;
  let n = Number(el.value);
  return isNaN(n) ? null : n;
}

function rmSaveRevenueEntry() {
  let dateEl = document.getElementById('rmEntryDate');
  let projectKeyEl = document.getElementById('rmEntryProjectKey');
  let accountIdEl = document.getElementById('rmEntryAccountId');
  let opEl = document.getElementById('rmEntryOperation');
  let revEl = document.getElementById('rmEntryRevenue');
  if (!projectKeyEl || !accountIdEl) return;

  let projectKey = projectKeyEl.value;
  let accountId = accountIdEl.value;
  let dateKey = dateEl && dateEl.value
    ? dateEl.value
    : (typeof todayKey === 'function' ? todayKey() : '');

  pfRegisterManageDisplayFromEntry(projectKey, accountId);

  if (typeof pdSaveRevenueAccountEntry === 'function') {
    let opValue = rmReadEntryNumber(opEl);
    let revValue = rmReadEntryNumber(revEl);
    pdSaveRevenueAccountEntry(dateKey, projectKey, accountId, {
      todayRevenue: revValue != null ? revValue : 0,
      operationRevenue: opValue
    });
  }

  pfCloseEntryModal();
  if (typeof showToast === 'function') {
    showToast('✅ 実績を保存しました');
  }
}

function rmSaveRevenueEntryDummy() {
  rmSaveRevenueEntry();
}

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

function rmAccountDemoSeed(accountId) {
  let seed = 0;
  for (let i = 0; i < accountId.length; i++) seed += accountId.charCodeAt(i);
  return seed;
}

function rmGetDemoRamBreakdown(accountId, d) {
  let seed = rmAccountDemoSeed(accountId);
  let operation = 1.2 + (seed % 4) * 0.3;
  let todayRevenue = 90 + (seed % 5) * 8 + ((d % 5) + Math.floor(d / 7)) % 4;
  return { operation: Math.round(operation * 100) / 100, todayRevenue: todayRevenue };
}

function rmGetDemoOrcaBreakdown(accountId, d) {
  let seed = rmAccountDemoSeed(accountId);
  let yesterdayAiProfit = Math.round((7 + (seed % 4) * 0.55 + (d % 3) * 0.12) * 100) / 100;
  let todayAffiliateProfit = Math.round((2 + (seed % 5) * 0.28 + (d % 4) * 0.08) * 100) / 100;
  let total = Math.round((yesterdayAiProfit + todayAffiliateProfit) * 100) / 100;
  return { yesterdayAiProfit: yesterdayAiProfit, todayAffiliateProfit: todayAffiliateProfit, total: total };
}

function rmGetDemoAccountBreakdown(projectKey, accountId, d) {
  if (projectKey === 'ram') return rmGetDemoRamBreakdown(accountId, d);
  if (projectKey === 'orca') return rmGetDemoOrcaBreakdown(accountId, d);
  return { operation: null, todayRevenue: null, yesterdayAiProfit: null, todayAffiliateProfit: null, total: null };
}

function rmGetDemoAccountTotal(projectKey, accountId, d) {
  let bd = rmGetDemoAccountBreakdown(projectKey, accountId, d);
  if (projectKey === 'orca') {
    if (bd.total == null) return null;
    return bd.total;
  }
  if (bd.operation == null && bd.todayRevenue == null) return null;
  return Math.round(((Number(bd.operation) || 0) + (Number(bd.todayRevenue) || 0)) * 100) / 100;
}

function rmGetDemoAccountDayAmount(projectKey, accountId, d, daysInMonth) {
  if (projectKey === 'ram' || projectKey === 'orca') {
    return rmGetDemoAccountTotal(projectKey, accountId, d);
  }
  let accounts = rmGetDemoAccountsForProject(projectKey);
  if (!accounts.length && RM_DEMO_ACCOUNT_TREE[projectKey]) {
    accounts = RM_DEMO_ACCOUNT_TREE[projectKey].map(function (a) {
      return { id: a.id, username: a.name };
    });
  }
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

function rmGetPerformanceEntry(y, m, d) {
  if (typeof revenueDateKey !== 'function') return null;
  let key = revenueDateKey(y, m, d);
  if (typeof pdGetRevenueEntryRaw === 'function') {
    let raw = pdGetRevenueEntryRaw(key);
    if (raw) return raw;
  }
  if (typeof getRevenueEntry === 'function') return getRevenueEntry(key);
  return null;
}

function rmGetRowDayAmountFromLog(row, y, m, d) {
  if (typeof revenueDateKey !== 'function') return null;
  let dateKey = revenueDateKey(y, m, d);
  let entry = rmGetPerformanceEntry(y, m, d);
  if (!entry) return null;

  if (row.isTotal) {
    if (rmFilter === 'all') return Number(entry.total) || 0;
    return rmGetProjectDayAmount(entry, rmFilter, dateKey);
  }

  if (row.isAccount || row.isProject) {
    if (row.isProject) return rmGetProjectDayAmount(entry, row.key, dateKey);
    let accounts = rmGetProjectAccountRows(row.projectKey);
    return rmGetAccountDayAmount(entry, row.projectKey, { id: row.key, name: row.name }, accounts, dateKey);
  }

  return rmGetProjectDayAmount(entry, row.key, dateKey);
}

function rmEscape(text) {
  return typeof escapeHtml === 'function' ? escapeHtml(text) : String(text);
}

function rmEscapeAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  if (projectKey === 'ram' && typeof getRamAllRootAccounts === 'function') return getRamAllRootAccounts();
  if (projectKey === 'ram' && typeof getRamInputAccounts === 'function') return getRamInputAccounts();
  if (projectKey === 'orca' && typeof getOrcaInputAccounts === 'function') return getOrcaInputAccounts();
  if (projectKey === 'eni' && typeof getEniInputAccounts === 'function') return getEniInputAccounts();
  if (projectKey === 'cary' && typeof getCaryInputAccounts === 'function') return getCaryInputAccounts();
  if (projectKey === 'genesis' || projectKey === 'other') return [];
  return [];
}

function rmGetProjectDayAmount(entry, projectKey, dateKey) {
  if (!entry) return 0;
  if (typeof pdSumProjectDayRevenue === 'function' && dateKey) {
    return pdSumProjectDayRevenue(entry, projectKey, dateKey);
  }
  if (projectKey === 'other') {
    let known = ['ram', 'orca', 'cary', 'genesis'];
    let sumKnown = known.reduce(function (s, k) { return s + (Number(entry[k]) || 0); }, 0);
    let total = Number(entry.total) || 0;
    return Math.max(0, Math.round((total - sumKnown) * 100) / 100);
  }
  return Math.round((Number(entry[projectKey]) || 0) * 100) / 100;
}

function rmGetAccountDirectAmount(entry, projectKey, accountId, dateKey) {
  if (!entry) return null;
  if (projectKey === 'ram') {
    let found = typeof pdFindRamAccountEntry === 'function'
      ? pdFindRamAccountEntry(entry, accountId)
      : null;
    if (!found && entry.ramAccounts && entry.ramAccounts[accountId]) {
      found = { ae: entry.ramAccounts[accountId], storageId: accountId };
    }
    if (!found) return null;
    let ae = found.ae;
    let storageId = found.storageId;
    if (ae.todayRevenue == null || ae.todayRevenue === '') return null;
    if (typeof pdRamAccountRevenueTotal === 'function' && dateKey) {
      return pdRamAccountRevenueTotal(ae, storageId, dateKey);
    }
    let op = typeof pdCalcDailyOperation === 'function' && dateKey
      ? pdCalcDailyOperation(storageId, 'ram', dateKey) : 0;
    return Math.round((op + (Number(ae.todayRevenue) || 0)) * 100) / 100;
  }
  if (projectKey === 'orca' && typeof getOrcaAccountEntry === 'function') {
    let ae = getOrcaAccountEntry(entry, accountId);
    if (!ae) return null;
    if (typeof calcOrcaAccountTotal === 'function') return calcOrcaAccountTotal(ae);
    if (typeof pdOrcaAccountRevenueTotal === 'function') return pdOrcaAccountRevenueTotal(ae);
    return null;
  }
  if (projectKey === 'eni') {
    let ae = typeof getEniAccountEntry === 'function'
      ? getEniAccountEntry(entry, accountId)
      : (entry.eniAccounts && entry.eniAccounts[accountId]);
    if (!ae) return null;
    if (typeof pdEniAccountRevenueTotal === 'function') return pdEniAccountRevenueTotal(ae);
    if (typeof eniAccountRevenueTotal === 'function') return eniAccountRevenueTotal(ae);
    return Math.round((
      (Number(ae.todayRevenue) || 0) +
      (Number(ae.referralProfit) || 0) +
      (Number(ae.titleProfit) || 0)
    ) * 100) / 100;
  }
  if (projectKey === 'cary' && typeof getCaryAccountEntry === 'function') {
    let ae = getCaryAccountEntry(entry, accountId);
    return ae ? ae.todayReward : null;
  }
  if (entry.accounts && entry.accounts[accountId]) {
    let ae = entry.accounts[accountId];
    if (ae.projectKey && ae.projectKey !== projectKey) return null;
    if (ae.todayRevenue != null) return Number(ae.todayRevenue) || 0;
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

function rmGetAccountDayAmount(entry, projectKey, account, accounts, dateKey) {
  if (!entry) return null;
  let direct = rmGetAccountDirectAmount(entry, projectKey, account.id, dateKey);
  if (direct !== null && direct !== undefined) return direct;
  if (rmIsDemoMode()) {
    let projectAmt = rmGetProjectDayAmount(entry, projectKey);
    return rmSplitAmountAcrossAccounts(projectAmt, accounts, account.id);
  }
  return null;
}

function rmGetRowDayAmount(row, y, m, d) {
  let entry = rmGetPerformanceEntry(y, m, d);
  let dateKey = typeof revenueDateKey === 'function' ? revenueDateKey(y, m, d) : null;

  if (row.isAccount && rmSupportsAccountDetail(row.projectKey)) {
    if (!entry) {
      if (!rmIsDemoMode()) return null;
      return rmGetDemoAccountTotal(row.projectKey, row.key, d);
    }
    let direct = rmGetAccountDirectAmount(entry, row.projectKey, row.key, dateKey);
    if (direct === null || direct === undefined) {
      if (!rmIsDemoMode()) return null;
      return rmGetDemoAccountTotal(row.projectKey, row.key, d);
    }
    return direct;
  }

  if (entry) {
    try {
      return rmGetRowDayAmountFromLog(row, y, m, d);
    } catch (e) {}
  }
  return rmIsDemoMode() ? rmGetDemoRowDayAmount(row, y, m, d) : null;
}

function rmGetTableRows() {
  if (rmFilter === 'all') {
    return rmGetActiveProjects().map(function (p) {
      return { key: p.key, name: p.name, projectKey: p.key, isTotal: false };
    }).concat([{ key: 'total', name: '合計', isTotal: true }]);
  }

  let accounts = rmGetProjectAccountRows(rmFilter);
  if (!accounts.length) {
    return [{ key: 'empty', name: '（表示アカウントなし）', projectKey: rmFilter, isEmpty: true }];
  }
  return accounts.map(function (acc) {
    return {
      key: acc.id,
      name: acc.name,
      projectKey: rmFilter,
      isAccount: true,
      depth: acc.depth || 0,
      parentId: acc.parentId,
      seriesIndex: acc.seriesIndex || 0
    };
  }).concat([{ key: 'total', name: '合計', isTotal: true }]);
}

function rmSupportsAccountDetail(projectKey) {
  return projectKey === 'ram' || projectKey === 'orca' || projectKey === 'eni';
}

function rmAccountExpandKey(projectKey, accountId) {
  return projectKey + ':' + accountId;
}

function rmIsAccountExpanded(projectKey, accountId) {
  return !!rmExpandedAccounts[rmAccountExpandKey(projectKey, accountId)];
}

function rmToggleAccountDetail(projectKey, accountId) {
  let key = rmAccountExpandKey(projectKey, accountId);
  rmExpandedAccounts[key] = !rmExpandedAccounts[key];
  rmRenderDailyTable();
}

function rmBindDailyTableEvents() {
  if (rmDailyTableBound) return;
  let table = document.getElementById('rmDailyTable');
  if (!table) return;
  rmDailyTableBound = true;
  table.addEventListener('click', function (e) {
    let expandBtn = e.target.closest('.rmExpandBtn');
    if (expandBtn) {
      e.preventDefault();
      e.stopPropagation();
      let projectKey = expandBtn.getAttribute('data-project');
      let accountId = expandBtn.getAttribute('data-account');
      if (projectKey && accountId) rmToggleAccountDetail(projectKey, accountId);
      return;
    }
  });
  pfBindEditableAmountClicks(table, function (meta) {
    rmOpenRevenueEntryModal(meta.projectKey, meta.accountId, meta.accountName, meta.dateKey, meta.amount);
  });
  pfBindManageAccountContextMenu(table, function () {
    rmRenderAllPanels();
    rmUpdateHeaderMeta();
  });
}

function rmCanEditAmountCell(dr, row) {
  if (rmFilter === 'all' || row.isEmpty || row.isTotal) return false;
  if (dr.type === 'accountHead' || dr.type === 'accountFlat') return true;
  if (dr.type === 'accountDetail') {
    if ((row.projectKey === 'orca') && dr.detailKey === 'total') return false;
    return true;
  }
  return false;
}

function rmRenderAmountCell(dr, row, y, m, d, amt, wdCls) {
  let empty = amt === null || amt === undefined;
  if (!rmCanEditAmountCell(dr, row)) {
    if (empty) return '<td class="' + wdCls + ' isEmpty">' + rmEmptyMark() + '</td>';
    return '<td class="' + wdCls + '">' + rmMoney(amt) + '</td>';
  }
  let dateKey = pfFormatIsoDate(y, m, d);
  let label = empty ? rmEmptyMark() : rmMoney(amt);
  let cell = pfRenderEditableAmountCell(empty ? null : amt, label, {
    projectKey: row.projectKey,
    accountId: row.key,
    accountName: row.name,
    dateKey: dateKey
  });
  return '<td class="' + wdCls + ' pfEditableCell' + (empty ? ' isEmpty' : '') + '">' + cell + '</td>';
}

function rmGetAccountBreakdown(projectKey, accountId, y, m, d) {
  let empty = {
    operation: null,
    todayRevenue: null,
    yesterdayAiProfit: null,
    todayAffiliateProfit: null,
    operationAmount: null,
    referralProfit: null,
    titleProfit: null,
    total: null
  };
  try {
    if (typeof revenueDateKey === 'function') {
      let dateKey = revenueDateKey(y, m, d);
      let entry = typeof pdGetRevenueEntryRaw === 'function'
        ? pdGetRevenueEntryRaw(dateKey)
        : (typeof getRevenueEntry === 'function' ? getRevenueEntry(dateKey) : null);
      if (projectKey === 'ram' && entry && entry.ramAccounts) {
        let found = typeof pdFindRamAccountEntry === 'function'
          ? pdFindRamAccountEntry(entry, accountId)
          : null;
        if (!found && entry.ramAccounts[accountId]) {
          found = { ae: entry.ramAccounts[accountId], storageId: accountId };
        }
        if (found) {
          let ae = found.ae;
          let todayRevenue = ae.todayRevenue != null ? Number(ae.todayRevenue) : null;
          let operation = rmCalcRamOperationAmount(found.storageId, ae, dateKey);
          if (todayRevenue != null || operation != null) {
            return { operation: operation, todayRevenue: todayRevenue };
          }
        }
      }
      if (projectKey === 'orca' && entry && entry.orcaAccounts && entry.orcaAccounts[accountId]) {
        let ae = entry.orcaAccounts[accountId];
        if (ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null) {
          let yesterdayAiProfit = ae.yesterdayAiProfit != null ? Number(ae.yesterdayAiProfit) : null;
          let todayAffiliateProfit = ae.todayAffiliateProfit != null ? Number(ae.todayAffiliateProfit) : null;
          let total = typeof calcOrcaAccountTotal === 'function'
            ? calcOrcaAccountTotal(ae)
            : Math.round(((Number(yesterdayAiProfit) || 0) + (Number(todayAffiliateProfit) || 0)) * 100) / 100;
          return { yesterdayAiProfit: yesterdayAiProfit, todayAffiliateProfit: todayAffiliateProfit, total: total };
        }
        if (ae.todayRevenue != null) {
          return { yesterdayAiProfit: null, todayAffiliateProfit: null, total: Number(ae.todayRevenue) || 0 };
        }
      }
      if (projectKey === 'eni' && entry && entry.eniAccounts && entry.eniAccounts[accountId]) {
        let ae = typeof getEniAccountEntry === 'function'
          ? getEniAccountEntry(entry, accountId)
          : entry.eniAccounts[accountId];
        if (ae) {
          return {
            operationAmount: ae.operationAmount != null ? Number(ae.operationAmount) : null,
            usdtBalance: ae.usdtBalance != null ? Number(ae.usdtBalance) : null,
            withdrawalAmount: ae.withdrawalAmount != null ? Number(ae.withdrawalAmount) : null,
            totalPerformance: ae.totalPerformance != null ? Number(ae.totalPerformance) : null,
            dailyProfit: ae.dailyProfit != null ? Number(ae.dailyProfit)
              : (typeof pdEniAccountRevenueTotal === 'function' ? pdEniAccountRevenueTotal(ae) : null),
            dailySales: ae.dailySales != null ? Number(ae.dailySales) : null
          };
        }
      }
    }
  } catch (e) {}

  if (rmIsDemoMode()) {
    return rmGetDemoAccountBreakdown(projectKey, accountId, d);
  }
  return empty;
}

function rmGetAccountDetailDayAmount(projectKey, accountId, detailKey, y, m, d) {
  let breakdown = rmGetAccountBreakdown(projectKey, accountId, y, m, d);
  if (breakdown[detailKey] == null) return null;
  return breakdown[detailKey];
}

function rmSumAccountDetailMonth(projectKey, accountId, detailKey, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  let hasAny = false;
  for (let d = 1; d <= days; d++) {
    let v = rmGetAccountDetailDayAmount(projectKey, accountId, detailKey, y, m, d);
    if (v !== null && v !== undefined) {
      hasAny = true;
      sum += v;
    }
  }
  return hasAny ? Math.round(sum * 100) / 100 : null;
}

function rmBuildTableDisplayRows() {
  let rows = rmGetTableRows();
  let out = [];
  rows.forEach(function (row) {
    if (row.isAccount && rmFilter !== 'all' && rmSupportsAccountDetail(row.projectKey)) {
      let expanded = rmIsAccountExpanded(row.projectKey, row.key);
      out.push({ type: 'accountHead', row: row, expanded: expanded });
      if (expanded) {
        (RM_ACCOUNT_DETAIL_DEFS[row.projectKey] || []).forEach(function (line) {
          out.push({
            type: 'accountDetail',
            row: row,
            detailKey: line.key,
            label: line.label
          });
        });
      }
    } else if (row.isAccount && rmFilter !== 'all') {
      out.push({ type: 'accountFlat', row: row });
    } else {
      out.push({ type: 'normal', row: row });
    }
  });
  return out;
}

function rmSumRowMonth(row, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  let hasAny = false;
  for (let d = 1; d <= days; d++) {
    let v = rmGetRowDayAmount(row, y, m, d);
    if (v !== null && v !== undefined) {
      hasAny = true;
      sum += v;
    }
  }
  return hasAny ? Math.round(sum * 100) / 100 : null;
}

function rmGetFilteredDayTotal(y, m, d) {
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let entry = rmGetPerformanceEntry(y, m, d);
  let dateKey = typeof revenueDateKey === 'function' ? revenueDateKey(y, m, d) : null;
  if (rmFilter === 'all') {
    if (entry && dateKey) {
      let sum = 0;
      let hasAny = false;
      rmGetActiveProjects().forEach(function (p) {
        let v = rmGetProjectDayAmount(entry, p.key, dateKey);
        if (v !== null && v !== undefined) {
          hasAny = true;
          sum += v;
        }
      });
      if (hasAny) return Math.round(sum * 100) / 100;
    }
    return rmIsDemoMode() ? rmGetDemoDayTotal(d, daysInMonth) : null;
  }
  if (entry && dateKey) {
    if (typeof pdProjectDayHasRevenue === 'function') {
      if (pdProjectDayHasRevenue(entry, rmFilter, dateKey)) {
        return rmGetProjectDayAmount(entry, rmFilter, dateKey);
      }
    } else if (Number(entry[rmFilter]) > 0) {
      return rmGetProjectDayAmount(entry, rmFilter, dateKey);
    }
  }
  let accounts = rmGetProjectAccountRows(rmFilter);
  if (entry && accounts.length) {
    let sum = 0;
    let hasAny = false;
    accounts.forEach(function (acc) {
      let v = rmGetAccountDayAmount(entry, rmFilter, acc, accounts, dateKey);
      if (v !== null && v !== undefined) {
        hasAny = true;
        sum += v;
      }
    });
    if (hasAny) return Math.round(sum * 100) / 100;
  }
  if (rmIsDemoMode()) {
    if (accounts.length) {
      return accounts.reduce(function (sum, acc) {
        return sum + rmGetDemoAccountDayAmount(rmFilter, acc.id, d, daysInMonth);
      }, 0);
    }
    return rmGetDemoProjectDayAmount(rmFilter, d, daysInMonth);
  }
  return null;
}

function rmHasChartData(vals) {
  return vals.some(function (v) { return v !== null && v !== undefined && v > 0; });
}

function rmResolveDailySeries(y, m) {
  let vals = rmCollectDailySeries(y, m);
  if (rmHasChartData(vals)) {
    return vals.map(function (v) { return v == null ? 0 : v; });
  }
  if (rmIsDemoMode()) {
    let days = new Date(y, m + 1, 0).getDate();
    if (rmFilter === 'all') return rmGetDemoChartCurrentSeries(days);
    let out = [];
    for (let d = 1; d <= days; d++) {
      out.push(rmGetFilteredDayTotal(y, m, d) || 0);
    }
    return out;
  }
  let days = new Date(y, m + 1, 0).getDate();
  let empty = [];
  for (let i = 0; i < days; i++) empty.push(0);
  return empty;
}

function rmCollectDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    vals.push(rmGetFilteredDayTotal(y, m, d));
  }
  return vals;
}

function rmChartLastDataDay(y, m) {
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  if (y < ref.getFullYear() || (y === ref.getFullYear() && m < ref.getMonth())) return daysInMonth;
  if (y === ref.getFullYear() && m === ref.getMonth()) return ref.getDate();
  return 0;
}

function rmCollectChartSeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let lastDay = rmChartLastDataDay(y, m);
  let raw = rmCollectDailySeries(y, m);
  let useDemo = !rmHasChartData(raw) && rmIsDemoMode();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    if (d > lastDay) {
      vals.push(null);
      continue;
    }
    if (useDemo) {
      if (rmFilter === 'all') {
        vals.push(rmGetDemoDayTotal(d, days));
      } else {
        vals.push(rmGetFilteredDayTotal(y, m, d));
      }
      continue;
    }
    vals.push(rmGetFilteredDayTotal(y, m, d));
  }
  return vals;
}

function rmBuildChartLineSegments(vals, plotX, plotY) {
  let segments = [];
  let current = [];
  vals.forEach(function (v, i) {
    if (v === null || v === undefined) {
      if (current.length >= 2) segments.push(current.slice());
      current = [];
      return;
    }
    current.push(plotX(i).toFixed(1) + ',' + plotY(v).toFixed(1));
  });
  if (current.length >= 2) segments.push(current);
  return segments;
}

function rmMonthTotalFromSeries(vals) {
  return Math.round(vals.reduce(function (s, v) { return s + v; }, 0) * 100) / 100;
}

function rmMonthTotalFromChartSeries(vals) {
  let sum = 0;
  let hasAny = false;
  vals.forEach(function (v) {
    if (v !== null && v !== undefined) {
      hasAny = true;
      sum += v;
    }
  });
  return hasAny ? Math.round(sum * 100) / 100 : 0;
}

function rmMonthTotalFromChartSeriesThroughDay(vals, throughDay) {
  if (!throughDay) return 0;
  let sum = 0;
  let hasAny = false;
  for (let i = 0; i < throughDay; i++) {
    let v = vals[i];
    if (v !== null && v !== undefined) {
      hasAny = true;
      sum += v;
    }
  }
  return hasAny ? Math.round(sum * 100) / 100 : 0;
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

function rmRenderProjectIcon(projectKey, extraClass) {
  if (typeof pjRenderProjectIcon === 'function') return pjRenderProjectIcon(projectKey, extraClass);
  if (typeof renderProjectIcon === 'function') return renderProjectIcon(projectKey, extraClass);
  return '';
}

function rmRenderAccountHeadLabel(row, expanded) {
  let toggle = expanded ? '▼' : '▶';
  let btn = '<button type="button" class="rmExpandBtn" data-project="' + rmEscapeAttr(row.projectKey) + '" data-account="' + rmEscapeAttr(row.key) + '" aria-expanded="' + expanded + '" aria-label="' + (expanded ? '詳細を閉じる' : '詳細を表示') + '">' + toggle + '</button>';
  let menu = expanded && typeof pfRenderAccountMenuBtn === 'function'
    ? pfRenderAccountMenuBtn(row.projectKey, row.key, row.name)
    : '';
  return '<span class="rmRowLabel rmAccountHeadLabel">' + btn +
    pfRenderSeriesMarker(row.seriesIndex || 0) +
    '<span class="pfAccountLabelText">' + rmEscape(row.name) + '</span>' +
    menu + '</span>';
}

function rmRenderAccountFlatLabel(row) {
  return pfRenderAccountLabel(rmEscape(row.name), row.seriesIndex || 0);
}

function rmRenderDetailLabel(label) {
  return '<span class="rmRowLabel rmRowLabel--detail">' + rmEscape(label) + '</span>';
}

function rmRenderDailyTable() {
  let table = document.getElementById('rmDailyTable');
  if (!table) return;

  try {
  let y = rmView.y;
  let m = rmView.m;
  let days = new Date(y, m + 1, 0).getDate();
  let displayRows = rmBuildTableDisplayRows();

  let head = '<thead><tr><th class="rmStickyCol">項目</th>';
  for (let d = 1; d <= days; d++) {
    let wd = new Date(y, m, d).getDay();
    let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');
    head += '<th class="' + cls.trim() + '">' + d + '(' + RM_WEEKDAYS[wd] + ')</th>';
  }
  head += '<th class="rmMonthTotalCol">月間合計<br><span style="font-size:10px;font-weight:700;color:#7f97b3">(USD)</span></th></tr></thead>';

  let body = '<tbody>' + displayRows.map(function (dr) {
    let row = dr.row;
    let trCls = '';
    let label = '';
    let cells = '';
    let monthSum = 0;
    let showAmounts = true;

    if (dr.type === 'accountHead') {
      trCls = ' class="rmAccountHeadRow' + (dr.expanded ? ' isExpanded' : '') + '"';
      label = rmRenderAccountHeadLabel(row, dr.expanded);
      showAmounts = !dr.expanded;
    } else if (dr.type === 'accountFlat') {
      trCls = ' class="rmDetailRow smSalesAccountRow"';
      label = rmRenderAccountFlatLabel(row);
    } else if (dr.type === 'accountDetail') {
      trCls = ' class="rmDetailRow"';
      label = rmRenderDetailLabel(dr.label);
    } else if (row.isTotal) {
      trCls = ' class="rmTotalRow"';
      label = '<span class="rmRowLabel"><b>' + rmEscape(row.name) + '</b></span>';
    } else {
      label = '<span class="rmRowLabel">' + (row.projectKey ? rmRenderProjectIcon(row.projectKey, 'rmRowIcon') : '') + rmEscape(row.name) + '</span>';
    }

    for (let d = 1; d <= days; d++) {
      let wd = new Date(y, m, d).getDay();
      let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');

      if (row.isEmpty || !showAmounts) {
        cells += '<td class="' + cls.trim() + ' isEmpty">' + rmEmptyMark() + '</td>';
        continue;
      }

      let amt = 0;
      if (dr.type === 'accountDetail') {
        amt = rmGetAccountDetailDayAmount(row.projectKey, row.key, dr.detailKey, y, m, d);
      } else {
        amt = rmGetRowDayAmount(row, y, m, d);
      }
      cells += rmRenderAmountCell(dr, row, y, m, d, amt, cls.trim());
    }

    if (row.isEmpty || !showAmounts) {
      cells += '<td class="rmMonthTotalCol isEmpty">' + rmEmptyMark() + '</td>';
    } else if (dr.type === 'accountDetail') {
      monthSum = rmSumAccountDetailMonth(row.projectKey, row.key, dr.detailKey, y, m);
      if (monthSum === null || monthSum === undefined) {
        cells += '<td class="rmMonthTotalCol isEmpty">' + rmEmptyMark() + '</td>';
      } else {
        cells += '<td class="rmMonthTotalCol">' + rmMoney(monthSum) + '</td>';
      }
    } else {
      monthSum = rmSumRowMonth(row, y, m);
      if (monthSum === null || monthSum === undefined) {
        cells += '<td class="rmMonthTotalCol isEmpty">' + rmEmptyMark() + '</td>';
      } else if (rmCanEditAmountCell(dr, row) && monthSum) {
        cells += '<td class="rmMonthTotalCol pfEditableCell">' +
          pfRenderEditableAmountCell(monthSum, rmMoney(monthSum), {
            projectKey: row.projectKey,
            accountId: row.key,
            accountName: row.name,
            dateKey: pfFormatIsoDate(y, m, 1)
          }) + '</td>';
      } else {
        cells += '<td class="rmMonthTotalCol">' + rmMoney(monthSum) + '</td>';
      }
    }

    return '<tr' + trCls + '><td class="rmStickyCol">' + label + '</td>' + cells + '</tr>';
  }).join('') + '</tbody>';

  table.innerHTML = head + body;
  rmBindDailyTableEvents();
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
  let curVals = rmCollectChartSeries(y, m);
  let prevVals = rmCollectChartSeries(prev.y, prev.m);
  let numeric = curVals.concat(prevVals).filter(function (v) { return v != null; });
  let dataMax = numeric.length ? Math.max.apply(null, numeric) : 1;
  let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(dataMax) : Math.max(dataMax, 450);
  let cc = {
    current: typeof pjGetScopeChartColor === 'function' ? pjGetScopeChartColor(rmFilter) : '#60a5fa',
    prev: '#64748b',
    label: '#7f97b3',
    grid: 'rgba(80,110,150,.25)',
    dotStroke: '#0b182b'
  };

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

  function lineDots(vals, fill, stroke) {
    return vals.map(function (v, i) {
      if (v === null || v === undefined) return '';
      return '<circle cx="' + plotX(i).toFixed(1) + '" cy="' + plotY(v).toFixed(1) + '" r="3.2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"></circle>';
    }).join('');
  }

  let prevSegments = rmBuildChartLineSegments(prevVals, plotX, plotY);
  let curSegments = rmBuildChartLineSegments(curVals, plotX, plotY);
  let prevLines = prevSegments.map(function (seg) {
    return '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + cc.prev + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4"></polyline>';
  }).join('');
  let curLines = curSegments.map(function (seg) {
    return '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + cc.current + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>';
  }).join('');

  let ticks = typeof chartAxisTicks === 'function' ? chartAxisTicks(axisMax, 5) : [0, axisMax / 2, axisMax];
  let grid = ticks.map(function (t) {
    let yPos = plotY(t);
    let label = typeof formatAxisDollar === 'function' ? formatAxisDollar(t) : rmMoney(t);
    return '<line x1="' + padLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padRight) + '" y2="' + yPos.toFixed(1) + '" stroke="' + cc.grid + '" stroke-width="1"></line>' +
      '<text x="' + (padLeft - 6) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end" fill="' + cc.label + '" font-size="10" font-weight="700">' + label + '</text>';
  }).join('');

  let xSvg = RM_CHART_X_DAYS.filter(function (d) { return d <= days; }).map(function (d) {
    let x = plotX(d - 1);
    return '<text x="' + x.toFixed(1) + '" y="' + (h - 3) + '" text-anchor="middle" fill="' + cc.label + '" font-size="10" font-weight="700">' + d + '日</text>';
  }).join('');

  el.setAttribute('data-rm-scope', rmFilter === 'all' ? 'all' : rmFilter);

  el.innerHTML =
    '<div class="rmCompareChartInner">' +
    '<svg class="rmCompareSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    grid + xSvg + prevLines + lineDots(prevVals, cc.prev, cc.dotStroke) +
    curLines + lineDots(curVals, cc.current, cc.dotStroke) +
    '</svg>' +
    '<div class="rmCompareLegend">' +
    '<span class="rmCompareLegendItem"><i class="isCurrent" style="background:' + cc.current + '"></i>今月（' + rmFormatMonthLabel(y, m) + '）</span>' +
    '<span class="rmCompareLegendItem"><i class="isPrev"></i>前月（' + rmFormatMonthLabel(prev.y, prev.m) + '）</span>' +
    '</div></div>';
  } catch (e) {}
}

function rmRenderChartSummary() {
  let el = document.getElementById('rmChartSummary');
  if (!el) return;

  try {
  let y = rmView.y;
  let m = rmView.m;
  let prev = rmCalcPrevMonth(y, m);
  let curVals = rmCollectChartSeries(y, m);
  let prevVals = rmCollectChartSeries(prev.y, prev.m);
  let compareDay = rmChartLastDataDay(y, m);
  let prevDaysInMonth = new Date(prev.y, prev.m + 1, 0).getDate();
  let prevCompareDay = Math.min(compareDay, prevDaysInMonth);
  let curTotal = rmMonthTotalFromChartSeries(curVals);
  let prevTotal = rmMonthTotalFromChartSeries(prevVals);
  let pct = rmPctChange(
    rmMonthTotalFromChartSeriesThroughDay(curVals, compareDay),
    rmMonthTotalFromChartSeriesThroughDay(prevVals, prevCompareDay)
  );
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
    if (typeof pdProjectDayHasRevenue === 'function' && !pdProjectDayHasRevenue(entry, projectKey, key)) return;
    let amt = rmGetProjectDayAmount(entry, projectKey, key);
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
  return rmIsDemoMode() ? (RM_DEMO_STATS[projectKey] || stats) : stats;
}

function rmGetDemoAccountStats(projectKey, accountId) {
  let seed = rmAccountDemoSeed(accountId);
  let day = 10 + (seed % 18);
  return {
    bestDayAmount: 95 + (seed % 7) * 12 + (projectKey === 'orca' ? 0 : 20),
    bestDayLabel: '2026/06/' + String(day).padStart(2, '0'),
    bestMonthAmount: 2800 + (seed % 9) * 420,
    bestMonthLabel: '2026年6月'
  };
}

function rmComputeAccountStats(projectKey, accountId) {
  let bestDay = { amount: 0, dateKey: '' };
  let monthTotals = {};
  rmScanAllDateKeys().forEach(function (key) {
    let parts = key.split('-');
    if (parts.length !== 3) return;
    let y = Number(parts[0]);
    let mo = Number(parts[1]) - 1;
    let d = Number(parts[2]);
    let row = { key: accountId, projectKey: projectKey, isAccount: true, name: '' };
    let amt = rmGetRowDayAmount(row, y, mo, d);
    if (amt === null || amt === undefined) return;
    if (amt > bestDay.amount) bestDay = { amount: amt, dateKey: key };
    let monthKey = parts[0] + '-' + parts[1];
    monthTotals[monthKey] = (monthTotals[monthKey] || 0) + amt;
  });
  let bestMonth = { amount: 0, label: '—' };
  Object.keys(monthTotals).forEach(function (mk) {
    if (monthTotals[mk] > bestMonth.amount) {
      let p = mk.split('-');
      bestMonth = { amount: Math.round(monthTotals[mk] * 100) / 100, label: p[0] + '年' + Number(p[1]) + '月' };
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
    bestMonthLabel: bestMonth.label
  };
}

function rmGetAccountStats(projectKey, accountId) {
  let stats = rmComputeAccountStats(projectKey, accountId);
  if (stats.bestDayAmount || stats.bestMonthAmount) return stats;
  return rmIsDemoMode() ? rmGetDemoAccountStats(projectKey, accountId) : stats;
}

function rmRenderProjectStats() {
  let el = document.getElementById('rmProjectStats');
  if (!el) return;

  try {
  if (rmFilter === 'all') {
    el.innerHTML =
      '<div class="rmStatTable">' +
      '<div class="rmStatTableHead">' +
      '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">最高日収</div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">最高月収</div>' +
      '</div>' +
      rmGetActiveProjects().map(function (p) {
        let stats = rmGetProjectStats(p.key);
        return '<div class="rmStatTableRow">' +
          '<div class="rmStatTableCol rmStatTableCol--project">' + rmRenderProjectIcon(p.key, 'rmRowIcon') + rmEscape(p.name) + '</div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + rmFormatStatAmount(stats.bestDayAmount, stats.bestDayLabel) + '</span>' +
          '<span class="rmStatDate">' + rmEscape(stats.bestDayLabel) + '</span></div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + rmFormatStatAmount(stats.bestMonthAmount, stats.bestMonthLabel) + '</span>' +
          '<span class="rmStatDate">' + rmEscape(stats.bestMonthLabel) + '</span></div>' +
          '</div>';
      }).join('') +
      '</div>';
    return;
  }

  let accounts = rmGetProjectAccountRows(rmFilter);
  el.innerHTML =
    '<div class="rmStatTable">' +
    '<div class="rmStatTableHead">' +
    '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高日収</div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高月収</div>' +
    '</div>' +
    accounts.map(function (acc) {
      let stats = rmGetAccountStats(rmFilter, acc.id);
      return '<div class="rmStatTableRow">' +
        '<div class="rmStatTableCol rmStatTableCol--project">' + pfRenderAccountLabel(rmEscape(acc.name), acc.seriesIndex || 0) + '</div>' +
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
  if (typeof hubUpdateMonthLabels === 'function') hubUpdateMonthLabels();
  else {
    let monthLabel = document.getElementById('rmMonthLabel');
    if (monthLabel) monthLabel.textContent = rmFormatMonthLabel(rmView.y, rmView.m);
  }

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
  if (typeof pjUpdateFilterIcon === 'function') pjUpdateFilterIcon('rmFilterIcon', rmFilter);
  rmExpandedAccounts = {};
  rmRenderAllPanels();
  rmUpdateHeaderMeta();
}

function rmPrevMonth() {
  if (typeof hubPrevMonth === 'function') hubPrevMonth();
}

function rmNextMonth() {
  if (typeof hubNextMonth === 'function') hubNextMonth();
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
  if (typeof hubEnsureViewMonth === 'function') hubEnsureViewMonth();
  if (typeof pfSyncMainTabs === 'function') pfSyncMainTabs('revenueManage');

  rmSyncProjectFilterOptions();
  if (typeof pjUpdateFilterIcon === 'function') pjUpdateFilterIcon('rmFilterIcon', rmFilter);

  rmUpdateHeaderMeta();
  rmRenderAllPanels();
}

function rmEnsureInit() {
  if (typeof revenueManagePage === 'undefined') return;
  rmBindDailyTableEvents();
  renderRevenueManage();
}

if (typeof window !== 'undefined') {
  window.rmToggleAccountDetail = rmToggleAccountDetail;
  window.rmSaveRevenueEntry = rmSaveRevenueEntry;
  window.rmSaveOrcaRevenueEntry = rmSaveOrcaRevenueEntry;
  window.rmSaveEniRevenueEntry = rmSaveEniRevenueEntry;
  window.rmSaveRevenueEntryDummy = rmSaveRevenueEntryDummy;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rmEnsureInit);
  } else {
    rmEnsureInit();
  }
}
