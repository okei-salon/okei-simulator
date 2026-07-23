/* OUKEI HUB Sales Management — Ver2.0.8 */

/*
 * settings.salesLog[dateKey] structure (future Excel / 実績入力):
 * {
 *   accounts: {
 *     [accountId]: {
 *       projectKey: 'ram',
 *       todaySales: 10000,
 *       totalSales: 1000000
 *     }
 *   },
 *   ram: 15000, orca: 13000, cary: ..., genesis: ..., other: ..., total: ...
 * }
 * Aggregation: accounts whose parent is also in the same project list are excluded
 * from project/grand totals to prevent double counting (parent team sales include children).
 */

var smView = { y: new Date().getFullYear(), m: new Date().getMonth() };
var smFilter = 'all';
var smDailyTableBound = false;

var SM_PROJECTS = [
  { key: 'ram', name: 'RAM' },
  { key: 'orca', name: 'ORCA' },
  { key: 'cary', name: 'Cary Pact' },
  { key: 'genesis', name: 'Genesis' },
  { key: 'other', name: 'その他' }
];

function smGetManageProjectSource() {
  if (typeof pmGetManageProjectList === 'function') {
    let list = pmGetManageProjectList();
    if (list.length) return list;
  }
  return SM_PROJECTS.filter(function (p) { return p.key !== 'other'; });
}

function smGetActiveProjects() {
  let list = smGetManageProjectSource();
  if (typeof pdFilterProjectsWithData === 'function') {
    return pdFilterProjectsWithData(list);
  }
  return list;
}

function smSyncProjectFilterOptions() {
  let sel = document.getElementById('smProjectFilter');
  if (!sel) return;
  let active = smGetActiveProjects();
  let activeKeys = active.map(function (p) { return p.key; });
  if (smFilter !== 'all' && activeKeys.indexOf(smFilter) < 0) smFilter = 'all';
  sel.innerHTML = '<option value="all">すべてのプロジェクト</option>' +
    active.map(function (p) {
      return '<option value="' + smEscapeAttr(p.key) + '">' + smEscape(p.name) + '</option>';
    }).join('');
  sel.value = smFilter;
}

var SM_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

var SM_DEMO_STATS = {
  ram: { bestDayAmount: 2180, bestDayLabel: '2026/06/18', bestMonthAmount: 52400, bestMonthLabel: '2026年6月', totalSalesAmount: 7400000, totalSalesLabel: '2026/06/18' },
  orca: { bestDayAmount: 1720, bestDayLabel: '2026/06/15', bestMonthAmount: 41200, bestMonthLabel: '2026年6月', totalSalesAmount: 1500000, totalSalesLabel: '2026/06/15' },
  cary: { bestDayAmount: 1340, bestDayLabel: '2026/06/22', bestMonthAmount: 31800, bestMonthLabel: '2026年6月' },
  genesis: { bestDayAmount: 980, bestDayLabel: '2026/06/10', bestMonthAmount: 26800, bestMonthLabel: '2026年6月' },
  other: { bestDayAmount: 620, bestDayLabel: '2026/06/05', bestMonthAmount: 16200, bestMonthLabel: '2026年6月' }
};

var SM_CHART_X_DAYS = [1, 5, 10, 15, 20, 25, 30];

var SM_DEMO_CHART_CURRENT = { 1: 420, 5: 580, 10: 720, 15: 890, 20: 1120, 25: 1380, 30: 1560 };
var SM_DEMO_CHART_PREV = { 1: 360, 5: 510, 10: 640, 15: 780, 20: 980, 25: 1210, 30: 1390 };

var SM_DEMO_PROJECT_RATIOS = {
  ram: 0.38,
  orca: 0.24,
  cary: 0.19,
  genesis: 0.12,
  other: 0.07
};

var SM_DEMO_SALES_ACCOUNTS = {
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

function smExpandAnchorSeries(anchors, daysInMonth) {
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

function smGetDemoChartCurrentSeries(days) {
  return smExpandAnchorSeries(SM_DEMO_CHART_CURRENT, days || 30);
}

function smGetDemoChartPrevSeries(days) {
  return smExpandAnchorSeries(SM_DEMO_CHART_PREV, days || 30);
}

function smGetDemoChartSummary() {
  let curVals = smGetDemoChartCurrentSeries(30);
  let prevVals = smGetDemoChartPrevSeries(30);
  let curTotal = curVals.reduce(function (s, v) { return s + v; }, 0);
  let prevTotal = prevVals.reduce(function (s, v) { return s + v; }, 0);
  let pct = prevTotal ? Math.round(((curTotal - prevTotal) / prevTotal) * 1000) / 10 : 0;
  return { currentTotal: curTotal, prevTotal: prevTotal, pctChange: pct };
}

function smSalesDateKey(y, m, d) {
  if (typeof revenueDateKey === 'function') return revenueDateKey(y, m, d);
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function getSalesEntry(dateKey) {
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  if (typeof settings !== 'undefined' && settings.salesLog && settings.salesLog[dateKey]) {
    return settings.salesLog[dateKey];
  }
  return null;
}

function smGetPerformanceEntry(y, m, d) {
  let key = smSalesDateKey(y, m, d);
  if (typeof pdGetSalesEntryRaw === 'function') {
    let raw = pdGetSalesEntryRaw(key);
    if (raw) return raw;
  }
  return getSalesEntry(key);
}

function getSalesAccountEntry(dateKey, accountId) {
  let entry = getSalesEntry(dateKey);
  if (!entry || !entry.accounts) return null;
  return entry.accounts[accountId] || null;
}

function smEscape(text) {
  return typeof escapeHtml === 'function' ? escapeHtml(text) : String(text);
}

function smEscapeAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function smIsMobileView() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(max-width: 900px)').matches;
}

function smMoneyFull(n) {
  if (typeof money === 'function') return money(n || 0);
  return '$' + Math.round((Number(n) || 0) * 100) / 100;
}

function smFormatCompactSales(n) {
  n = Math.round((Number(n) || 0) * 100) / 100;
  if (n < 10000) {
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  if (n < 1000000) {
    let k = n / 1000;
    if (k >= 100) return Math.round(k) + 'K';
    let rounded = Math.round(k * 10) / 10;
    return (rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1)) + 'K';
  }
  return (Math.round((n / 1000000) * 100) / 100).toFixed(2) + 'M';
}

function smMoney(n, opts) {
  n = Number(n) || 0;
  if (opts && opts.forceFull) return smMoneyFull(n);
  if (smIsMobileView()) return smFormatCompactSales(n);
  return smMoneyFull(n);
}

function smFormatMonthLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function smInitViewFromReference() {
  if (typeof getHomeReferenceDate === 'function') {
    let ref = getHomeReferenceDate();
    smView.y = ref.getFullYear();
    smView.m = ref.getMonth();
  }
}

function smGetFilterLabel() {
  if (smFilter === 'all') return 'すべてのプロジェクト';
  let p = SM_PROJECTS.find(function (x) { return x.key === smFilter; });
  return p ? p.name : 'すべてのプロジェクト';
}

function smGetScopeSuffix() {
  return smFilter === 'all' ? '（すべてのプロジェクト合計）' : '（' + smGetFilterLabel() + '）';
}

function smAccountSeed(accountId) {
  let seed = 0;
  for (let i = 0; i < accountId.length; i++) seed += accountId.charCodeAt(i);
  return seed;
}

function smGetLiveRamAccountTree() {
  if (typeof aimBuildOrgAccountTree === 'function') {
    let tree = aimBuildOrgAccountTree('ram');
    if (tree.length) return tree;
  }
  if (typeof getRamInputAccounts !== 'function' || typeof members === 'undefined') return [];
  let roots = getRamInputAccounts();
  if (!roots.length) return [];
  let out = [];
  let seen = {};

  function addMember(id, depth) {
    if (seen[id]) return;
    seen[id] = true;
    let m = members.find(function (x) { return x.id === id; });
    if (!m) return;
    let name = typeof displayName === 'function' ? displayName(m) : (m.name || m.username || '未入力');
    out.push({ id: id, name: name, parentId: m.parent || null, depth: depth });
    let kids = typeof aimGetSortedOrgChildren === 'function'
      ? aimGetSortedOrgChildren('ram', id)
      : members.filter(function (x) { return x.parent === id; });
    kids.forEach(function (child) { addMember(child.id, depth + 1); });
  }

  roots.forEach(function (r) { addMember(r.id, 0); });
  return out;
}

function smGetLiveOrcaAccountTree() {
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

function smGetLiveEniAccounts() {
  if (typeof getEniInputAccounts !== 'function') return [];
  return getEniInputAccounts().map(function (acc) {
    return { id: acc.id, name: acc.username, parentId: null, depth: 0 };
  });
}

function smGetLiveOrcaAccounts() {
  return smGetLiveOrcaAccountTree();
}

function smGetLiveCaryAccounts() {
  if (typeof getCaryInputAccounts !== 'function') return [];
  return getCaryInputAccounts().map(function (acc) {
    return { id: acc.id, name: acc.username, parentId: null, depth: 0 };
  });
}

function smEmptyMark() {
  return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
}

function smIsDemoMode() {
  return typeof pdIsDemoMode === 'function' && pdIsDemoMode();
}

function smFormatStatAmount(amount, label) {
  if ((amount == null || amount === '') && (!label || label === '—')) return smEmptyMark();
  return smMoney(amount, { forceFull: !smIsMobileView() });
}

function smGetProjectAccounts(projectKey) {
  let live = [];
  if (projectKey === 'ram') live = smGetLiveRamAccountTree();
  else if (projectKey === 'orca') live = smGetLiveOrcaAccountTree();
  else if (projectKey === 'eni') live = smGetLiveEniAccounts();
  else if (projectKey === 'cary') live = smGetLiveCaryAccounts();
  let demo = SM_DEMO_SALES_ACCOUNTS[projectKey] ? SM_DEMO_SALES_ACCOUNTS[projectKey].slice() : [];
  if (typeof pfResolveManageAccounts === 'function') {
    return pfResolveManageAccounts(projectKey, live, demo);
  }
  let accounts = live.length ? live : (smIsDemoMode() ? demo : []);
  accounts = pfFilterManageAccounts(projectKey, accounts, { useDemoBypass: smIsDemoMode() && !live.length });
  accounts = pfApplyManageAccountLabels(projectKey, accounts);
  return pfAnnotateAccountSeries(accounts, projectKey);
}

function smBuildParentMap(accounts) {
  let map = {};
  accounts.forEach(function (acc) {
    map[acc.id] = acc.parentId || null;
  });
  return map;
}

function smHasAncestorInSet(accountId, idSet, parentMap) {
  let cur = parentMap[accountId];
  while (cur) {
    if (idSet.has(cur)) return true;
    cur = parentMap[cur];
  }
  return false;
}

function smGetAggregationAccountIds(accounts) {
  let idSet = new Set(accounts.map(function (a) { return a.id; }));
  let parentMap = smBuildParentMap(accounts);
  return accounts
    .filter(function (acc) { return !smHasAncestorInSet(acc.id, idSet, parentMap); })
    .map(function (acc) { return acc.id; });
}

function smGetDemoAccountDaySales(accountId, projectKey, d) {
  let seed = smAccountSeed(accountId);
  if (projectKey === 'ram') {
    if (accountId === 'demo_ram_2') return 3000 + (d % 3) * 100;
    if (accountId === 'demo_ram_1') return 10000 + (d % 4) * 200;
    if (accountId === 'demo_ram_3') return 5200 + (d % 5) * 80;
    if (accountId === 'demo_ram_4') return 2800 + (d % 4) * 90;
    if (accountId === 'demo_ram_5') return 7600 + (d % 5) * 140;
    if (accountId === 'demo_ram_6') return 2100 + (d % 3) * 80;
    return 4500 + (seed % 4) * 120 + (d % 3) * 60;
  }
  if (projectKey === 'orca') {
    if (accountId === 'demo_orca_1') return 9200 + (d % 4) * 180;
    if (accountId === 'demo_orca_2') return 3400 + (d % 3) * 120;
    if (accountId === 'demo_orca_3') return 5100 + (d % 5) * 95;
    if (accountId === 'demo_orca_4') return 2600 + (d % 4) * 85;
    return 6800 + (seed % 5) * 200 + (d % 4) * 90;
  }
  if (projectKey === 'cary') {
    if (accountId === 'demo_cary_1') return 6200 + (d % 5) * 110;
    if (accountId === 'demo_cary_2') return 1800 + (d % 4) * 90;
    if (accountId === 'demo_cary_3') return 4300 + (d % 4) * 100;
    return 4000 + (seed % 3) * 100;
  }
  if (projectKey === 'genesis') {
    if (accountId === 'demo_genesis_1') return 5400 + (d % 5) * 120;
    if (accountId === 'demo_genesis_2') return 1900 + (d % 4) * 80;
    if (accountId === 'demo_genesis_3') return 3600 + (d % 4) * 95;
    return 4200 + (seed % 4) * 110;
  }
  if (projectKey === 'other') {
    if (accountId === 'demo_other_1') return 2800 + (d % 4) * 70;
    if (accountId === 'demo_other_2') return 1200 + (d % 3) * 60;
    if (accountId === 'demo_other_3') return 2100 + (d % 4) * 55;
    return 1800 + (seed % 3) * 80;
  }
  return 8000 + (seed % 5) * 420 + Math.round(Math.sin((d + seed) * 0.65) * 380) + (d % 4) * 120;
}

function smGetSalesReferenceDate() {
  return typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
}

function smIsFutureSalesDay(y, m, d) {
  let ref = smGetSalesReferenceDate();
  if (y > ref.getFullYear()) return true;
  if (y === ref.getFullYear() && m > ref.getMonth()) return true;
  if (y === ref.getFullYear() && m === ref.getMonth() && d > ref.getDate()) return true;
  return false;
}

function smDayHasSalesEntry(y, m, d) {
  let entry = smGetPerformanceEntry(y, m, d);
  if (!entry) return false;
  if (entry.accounts && Object.keys(entry.accounts).length) {
    return Object.keys(entry.accounts).some(function (id) {
      let ae = entry.accounts[id];
      if (!ae) return false;
      if (ae.todaySales != null && ae.todaySales !== '') return true;
      if (ae.totalSales != null && ae.totalSales !== '') return true;
      return false;
    });
  }
  if (entry.total != null && entry.total !== '') return true;
  return ['ram', 'orca', 'cary', 'genesis', 'other'].some(function (pk) {
    return entry[pk] != null && entry[pk] !== '';
  });
}

function smGetAccountDaySalesFromLog(accountId, projectKey, y, m, d) {
  if (smIsFutureSalesDay(y, m, d)) return null;
  if (!smDayHasSalesEntry(y, m, d)) return null;
  let entry = smGetPerformanceEntry(y, m, d);
  if (!entry || !entry.accounts) return null;
  if (projectKey === 'ram' && typeof pdFindRamSalesAccountEntry === 'function') {
    let found = pdFindRamSalesAccountEntry(entry, accountId);
    if (found && found.ae.todaySales != null) return Number(found.ae.todaySales) || 0;
  }
  if (!entry.accounts[accountId]) return null;
  let ae = entry.accounts[accountId];
  if (ae.projectKey && ae.projectKey !== projectKey) return null;
  if (ae.todaySales != null) return Number(ae.todaySales) || 0;
  return null;
}

function smGetAccountDaySales(accountId, projectKey, y, m, d) {
  if (smIsFutureSalesDay(y, m, d)) return null;
  let fromLog = smGetAccountDaySalesFromLog(accountId, projectKey, y, m, d);
  if (fromLog !== null) return fromLog;
  return smIsDemoMode() ? smGetDemoAccountDaySales(accountId, projectKey, d) : null;
}

function smGetProjectDayAmountDeduped(projectKey, y, m, d) {
  if (smIsFutureSalesDay(y, m, d)) return null;
  if (!smDayHasSalesEntry(y, m, d)) return null;
  let entry = smGetPerformanceEntry(y, m, d);
  let accounts = smGetProjectAccounts(projectKey);
  if (accounts.length) {
    let aggIds = smGetAggregationAccountIds(accounts);
    let sum = 0;
    let hasAny = false;
    aggIds.forEach(function (id) {
      let v = smGetAccountDaySalesFromLog(id, projectKey, y, m, d);
      if (v !== null && v !== undefined) {
        hasAny = true;
        sum += v;
      }
    });
    if (hasAny) return Math.round(sum * 100) / 100;
  }
  if (entry && entry[projectKey] != null) {
    return Math.round(Number(entry[projectKey]) * 100) / 100;
  }

  if (!accounts.length) {
    return smIsDemoMode()
      ? smGetDemoProjectDayAmountFallback(projectKey, d, new Date(y, m + 1, 0).getDate())
      : null;
  }

  return null;
}

function smGetDemoProjectDayAmountFallback(projectKey, d, daysInMonth) {
  let total = smGetDemoChartCurrentSeries(daysInMonth)[d - 1] || 0;
  let known = ['ram', 'orca', 'cary', 'genesis'];
  if (projectKey === 'other') {
    let sumKnown = known.reduce(function (s, k) {
      return s + smGetDemoProjectDayAmountFallback(k, d, daysInMonth);
    }, 0);
    return Math.max(0, Math.round((total - sumKnown) * 100) / 100);
  }
  let ratio = SM_DEMO_PROJECT_RATIOS[projectKey] || 0;
  return Math.round(total * ratio * 100) / 100;
}

function smGetDemoDayTotal(d, daysInMonth) {
  return smGetActiveProjects().reduce(function (sum, p) {
    return sum + smGetProjectDayAmountDeduped(p.key, smView.y, smView.m, d);
  }, 0);
}

function smGetDemoProjectDayAmount(projectKey, d, daysInMonth) {
  return smGetProjectDayAmountDeduped(projectKey, smView.y, smView.m, d);
}

function smOpenSalesEntryModal(projectKey, accountId, accountName, dateKey, amount) {
  pfRegisterManageDisplayFromEntry(projectKey, accountId);
  let projLabel = pfGetProjectLabel(projectKey, SM_PROJECTS);
  let dateVal = dateKey || pfFormatIsoDate(smView.y, smView.m, 1);
  let salesVal = '';
  if (typeof pdGetSalesEntryRaw === 'function') {
    let entry = pdGetSalesEntryRaw(dateVal);
    if (entry && entry.accounts && entry.accounts[accountId] && entry.accounts[accountId].todaySales != null) {
      salesVal = entry.accounts[accountId].todaySales;
    }
  }
  if (salesVal === '' && amount) salesVal = amount;
  if (salesVal === '' && smIsDemoMode()) {
    salesVal = accountId === 'demo_ram_2' ? 3000 : 10000;
  }
  let body =
    '<input type="hidden" id="smEntryProjectKey" value="' + pfEscapeAttr(projectKey) + '">' +
    '<input type="hidden" id="smEntryAccountId" value="' + pfEscapeAttr(accountId) + '">' +
    pfEntryDateField('日付', 'smEntryDate', dateVal) +
    pfEntryReadonlyField('プロジェクト', projLabel) +
    pfEntryReadonlyField('アカウント', accountName || accountId) +
    pfEntryNumberField('売上（$）', 'smEntrySales', salesVal);
  pfOpenEntryModal('売上入力', body, 'smSaveSalesEntry');
}

function smSaveSalesEntry() {
  let dateEl = document.getElementById('smEntryDate');
  let projectKeyEl = document.getElementById('smEntryProjectKey');
  let accountIdEl = document.getElementById('smEntryAccountId');
  let salesEl = document.getElementById('smEntrySales');
  if (!projectKeyEl || !accountIdEl) return;

  let projectKey = projectKeyEl.value;
  let accountId = accountIdEl.value;
  let dateKey = dateEl && dateEl.value
    ? dateEl.value
    : (typeof todayKey === 'function' ? todayKey() : '');

  pfRegisterManageDisplayFromEntry(projectKey, accountId);

  if (typeof pdSaveSalesAccountEntry === 'function') {
    pdSaveSalesAccountEntry(dateKey, projectKey, accountId, Number(salesEl && salesEl.value) || 0);
  }

  pfCloseEntryModal();
  if (typeof showToast === 'function') {
    showToast('✅ 売上を保存しました');
  }
}

function smSaveSalesEntryDummy() {
  smSaveSalesEntry();
}

function smGetRowDayAmount(row, y, m, d) {
  if (row.isAccount) {
    return smGetAccountDaySales(row.key, row.projectKey, y, m, d);
  }
  if (row.isTotal) {
    if (smFilter === 'all') {
      let sum = 0;
      let hasAny = false;
      smGetActiveProjects().forEach(function (p) {
        let v = smGetProjectDayAmountDeduped(p.key, y, m, d);
        if (v !== null && v !== undefined) {
          hasAny = true;
          sum += v;
        }
      });
      return hasAny ? Math.round(sum * 100) / 100 : null;
    }
    return smGetProjectDayAmountDeduped(smFilter, y, m, d);
  }
  return smGetProjectDayAmountDeduped(row.key, y, m, d);
}

function smGetTableRows() {
  if (smFilter === 'all') {
    return smGetActiveProjects().map(function (p) {
      return { key: p.key, name: p.name, projectKey: p.key, isProject: true, isTotal: false };
    }).concat([{ key: 'total', name: '合計', isTotal: true }]);
  }

  let accounts = smGetProjectAccounts(smFilter);
  if (!accounts.length) {
    return [{ key: 'empty', name: '（表示アカウントなし）', projectKey: smFilter, isEmpty: true }];
  }
  return accounts.map(function (acc) {
    return {
      key: acc.id,
      name: acc.name,
      projectKey: smFilter,
      isAccount: true,
      depth: acc.depth || 0,
      parentId: acc.parentId,
      seriesIndex: acc.seriesIndex || 0
    };
  }).concat([{ key: 'total', name: '合計', isTotal: true }]);
}

function smSumRowMonth(row, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  let hasAny = false;
  for (let d = 1; d <= days; d++) {
    let v = smGetRowDayAmount(row, y, m, d);
    if (v !== null && v !== undefined) {
      hasAny = true;
      sum += v;
    }
  }
  return hasAny ? Math.round(sum * 100) / 100 : null;
}

function smSumAccountMonth(accountId, projectKey, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  let hasAny = false;
  for (let d = 1; d <= days; d++) {
    let v = smGetAccountDaySales(accountId, projectKey, y, m, d);
    if (v !== null && v !== undefined) {
      hasAny = true;
      sum += v;
    }
  }
  return hasAny ? Math.round(sum * 100) / 100 : null;
}

function smGetFilteredDayTotal(y, m, d) {
  if (smFilter === 'all') {
    let sum = 0;
    let hasAny = false;
    smGetActiveProjects().forEach(function (p) {
      let v = smGetProjectDayAmountDeduped(p.key, y, m, d);
      if (v !== null && v !== undefined) {
        hasAny = true;
        sum += v;
      }
    });
    return hasAny ? Math.round(sum * 100) / 100 : null;
  }
  return smGetProjectDayAmountDeduped(smFilter, y, m, d);
}

function smCollectDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    vals.push(smGetFilteredDayTotal(y, m, d));
  }
  return vals;
}

function smChartLastDataDay(y, m) {
  let ref = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  if (y < ref.getFullYear() || (y === ref.getFullYear() && m < ref.getMonth())) return daysInMonth;
  if (y === ref.getFullYear() && m === ref.getMonth()) return ref.getDate();
  return 0;
}

function smCollectChartSeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let lastDay = smChartLastDataDay(y, m);
  let raw = smCollectDailySeries(y, m);
  let useDemo = !smHasChartData(raw) && smIsDemoMode();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    if (d > lastDay) {
      vals.push(null);
      continue;
    }
    if (useDemo) {
      vals.push(smGetDemoDayTotal(d, days));
      continue;
    }
    vals.push(smGetFilteredDayTotal(y, m, d));
  }
  return vals;
}

function smBuildChartLineSegments(vals, plotX, plotY) {
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

function smGetDemoDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    vals.push(smGetDemoDayTotal(d, days));
  }
  return vals;
}

function smHasChartData(vals) {
  return vals.some(function (v) { return v !== null && v !== undefined; });
}

function smResolveDailySeries(y, m) {
  let vals = smCollectDailySeries(y, m);
  if (smHasChartData(vals)) {
    return vals.map(function (v) { return v == null ? 0 : v; });
  }
  if (smIsDemoMode()) return smGetDemoDailySeries(y, m);
  let days = new Date(y, m + 1, 0).getDate();
  let empty = [];
  for (let i = 0; i < days; i++) empty.push(0);
  return empty;
}

function smCalcPrevMonth(y, m) {
  let pm = m - 1;
  let py = y;
  if (pm < 0) { pm = 11; py -= 1; }
  return { y: py, m: pm };
}

function smOpenSalesEntryPlaceholder(projectKey, accountId, accountName) {
  smOpenSalesEntryModal(projectKey, accountId, accountName);
}

function smCanEditAmountCell(dr, row) {
  if (smFilter === 'all' || row.isEmpty || row.isTotal) return false;
  return dr.type === 'accountRow';
}

function smRenderAmountCell(dr, row, y, m, d, amt, wdCls) {
  let empty = amt === null || amt === undefined;
  let displayAmt = empty ? smEmptyMark() : smMoney(amt);
  let fullAmt = empty ? smEmptyMark() : smMoneyFull(amt);
  if (!smCanEditAmountCell(dr, row)) {
    if (empty) return '<td class="' + wdCls + ' isEmpty">' + smEmptyMark() + '</td>';
    return '<td class="' + wdCls + ' smAmountCell"' +
      (smIsMobileView() && !empty ? ' title="' + smEscapeAttr(fullAmt) + '"' : '') +
      '>' + displayAmt + '</td>';
  }
  let dateKey = pfFormatIsoDate(y, m, d);
  let label = displayAmt;
  let cell = pfRenderEditableAmountCell(empty ? null : amt, label, {
    projectKey: row.projectKey,
    accountId: row.key,
    accountName: row.name,
    dateKey: dateKey
  });
  let titleAttr = smIsMobileView() && !empty ? ' title="' + smEscapeAttr(fullAmt) + '"' : '';
  return '<td class="' + wdCls + ' pfEditableCell smAmountCell' + (empty ? ' isEmpty' : '') + '"' +
    titleAttr + '>' + cell + '</td>';
}

function smBindDailyTableEvents() {
  if (smDailyTableBound) return;
  let table = document.getElementById('smDailyTable');
  if (!table) return;
  smDailyTableBound = true;
  pfBindEditableAmountClicks(table, function (meta) {
    smOpenSalesEntryModal(meta.projectKey, meta.accountId, meta.accountName, meta.dateKey, meta.amount);
  });
}

function smRenderProjectIcon(projectKey, extraClass) {
  if (typeof pjRenderProjectIcon === 'function') return pjRenderProjectIcon(projectKey, extraClass);
  if (typeof renderProjectIcon === 'function') return renderProjectIcon(projectKey, extraClass);
  return '';
}

function smRenderAccountRowLabel(row) {
  return pfRenderAccountLabel(smEscape(row.name), row.seriesIndex || 0);
}

function smBuildTableDisplayRows() {
  let rows = smGetTableRows();
  let out = [];
  rows.forEach(function (row) {
    if (row.isAccount && smFilter !== 'all') {
      out.push({ type: 'accountRow', row: row });
    } else {
      out.push({ type: 'normal', row: row });
    }
  });
  return out;
}

function smRenderDailyTable() {
  let table = document.getElementById('smDailyTable');
  if (!table) return;

  try {
    let y = smView.y;
    let m = smView.m;
    let days = new Date(y, m + 1, 0).getDate();
    let displayRows = smBuildTableDisplayRows();

    let head = '<thead><tr><th class="rmStickyCol">項目</th>';
    for (let d = 1; d <= days; d++) {
      let wd = new Date(y, m, d).getDay();
      let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');
      head += '<th class="' + cls.trim() + '">' + d + '(' + SM_WEEKDAYS[wd] + ')</th>';
    }
    head += '<th class="rmMonthTotalCol">月間合計<br><span style="font-size:10px;font-weight:700;color:#7f97b3">(USD)</span></th></tr></thead>';

    let body = '<tbody>' + displayRows.map(function (dr) {
      let row = dr.row;
      let trCls = '';
      let label = '';
      let cells = '';
      let showAmounts = true;

      if (dr.type === 'accountRow') {
        trCls = ' class="rmDetailRow smSalesAccountRow"';
        label = smRenderAccountRowLabel(row);
      } else if (row.isTotal) {
        trCls = ' class="rmTotalRow"';
        label = '<span class="rmRowLabel"><b>' + smEscape(row.name) + '</b></span>';
      } else {
        label = '<span class="rmRowLabel">' + (row.projectKey ? smRenderProjectIcon(row.projectKey, 'rmRowIcon') : '') + smEscape(row.name) + '</span>';
      }

      for (let d = 1; d <= days; d++) {
        let wd = new Date(y, m, d).getDay();
        let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');

        if (row.isEmpty) {
          cells += '<td class="' + cls.trim() + ' isEmpty">' + smEmptyMark() + '</td>';
          continue;
        }

        let amt = smGetRowDayAmount(row, y, m, d);
        cells += smRenderAmountCell(dr, row, y, m, d, amt, cls.trim());
      }

      if (row.isEmpty) {
        cells += '<td class="rmMonthTotalCol isEmpty">' + smEmptyMark() + '</td>';
      } else {
        let monthSum = smSumRowMonth(row, y, m);
        if (monthSum === null || monthSum === undefined) {
          cells += '<td class="rmMonthTotalCol isEmpty">' + smEmptyMark() + '</td>';
        } else if (smCanEditAmountCell(dr, row) && monthSum) {
          cells += '<td class="rmMonthTotalCol pfEditableCell">' +
            pfRenderEditableAmountCell(monthSum, smMoney(monthSum), {
              projectKey: row.projectKey,
              accountId: row.key,
              accountName: row.name,
              dateKey: pfFormatIsoDate(y, m, 1)
            }) + '</td>';
        } else {
          cells += '<td class="rmMonthTotalCol">' + smMoney(monthSum) + '</td>';
        }
      }

      return '<tr' + trCls + '><td class="rmStickyCol">' + label + '</td>' + cells + '</tr>';
    }).join('') + '</tbody>';

    table.innerHTML = head + body;
    smBindDailyTableEvents();
  } catch (e) {
    table.innerHTML = '<tbody><tr><td class="rmStickyCol">項目</td><td>読込中...</td></tr></tbody>';
  }
}

function smEstimateAxisPadLeft(labels) {
  let maxLen = 0;
  (labels || []).forEach(function (label) {
    maxLen = Math.max(maxLen, String(label || '').length);
  });
  return Math.max(52, Math.ceil(maxLen * 6.5) + 10);
}

function smRenderCompareChart() {
  let el = document.getElementById('smCompareChart');
  if (!el) return;

  try {
    let y = smView.y;
    let m = smView.m;
    let prev = smCalcPrevMonth(y, m);
    let days = new Date(y, m + 1, 0).getDate();
    let curVals = smCollectChartSeries(y, m);
    let prevVals = smCollectChartSeries(prev.y, prev.m);
    let numeric = curVals.concat(prevVals).filter(function (v) { return v != null; });
    let dataMax = numeric.length ? Math.max.apply(null, numeric) : 1;
    let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(dataMax) : Math.max(dataMax, 1800);
    let cc = {
      current: typeof pjGetScopeChartColor === 'function' ? pjGetScopeChartColor(smFilter) : '#60a5fa',
      prev: '#64748b',
      label: '#7f97b3',
      grid: 'rgba(80,110,150,.25)',
      dotStroke: '#0b182b'
    };

    let ticks = typeof chartAxisTicks === 'function' ? chartAxisTicks(axisMax, 5) : [0, axisMax / 2, axisMax];
    let tickLabels = ticks.map(function (t) {
      return typeof formatAxisDollar === 'function' ? formatAxisDollar(t) : smMoney(t);
    });
    let padRight = 16;
    let plotW = 462;
    let padLeft = smEstimateAxisPadLeft(tickLabels);
    let w = padLeft + plotW + padRight;
    let h = 168;
    let padTop = 10;
    let padBottom = 20;
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

    let prevSegments = smBuildChartLineSegments(prevVals, plotX, plotY);
    let curSegments = smBuildChartLineSegments(curVals, plotX, plotY);
    let prevLines = prevSegments.map(function (seg) {
      return '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + cc.prev + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4"></polyline>';
    }).join('');
    let curLines = curSegments.map(function (seg) {
      return '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + cc.current + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>';
    }).join('');

    let grid = ticks.map(function (t, idx) {
      let yPos = plotY(t);
      let label = tickLabels[idx];
      return '<line x1="' + padLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padRight) + '" y2="' + yPos.toFixed(1) + '" stroke="' + cc.grid + '" stroke-width="1"></line>' +
        '<text class="rmCompareYLabel" x="' + (padLeft - 8) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end" fill="' + cc.label + '" font-size="10" font-weight="700">' + label + '</text>';
    }).join('');

    let xSvg = SM_CHART_X_DAYS.filter(function (d) { return d <= days; }).map(function (d) {
      let x = plotX(d - 1);
      return '<text x="' + x.toFixed(1) + '" y="' + (h - 3) + '" text-anchor="middle" fill="' + cc.label + '" font-size="10" font-weight="700">' + d + '日</text>';
    }).join('');

    el.setAttribute('data-sm-scope', smFilter === 'all' ? 'all' : smFilter);

    el.innerHTML =
      '<div class="rmCompareChartInner">' +
      '<svg class="rmCompareSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      grid + xSvg + prevLines + lineDots(prevVals, cc.prev, cc.dotStroke) +
      curLines + lineDots(curVals, cc.current, cc.dotStroke) +
      '</svg>' +
      '<div class="rmCompareLegend">' +
      '<span class="rmCompareLegendItem"><i class="isCurrent" style="background:' + cc.current + '"></i>今月（' + smFormatMonthLabel(y, m) + '）</span>' +
      '<span class="rmCompareLegendItem"><i class="isPrev"></i>前月（' + smFormatMonthLabel(prev.y, prev.m) + '）</span>' +
      '</div></div>';
  } catch (e) {}
}

function smMonthTotalFromSeries(vals) {
  return Math.round(vals.reduce(function (s, v) { return s + v; }, 0) * 100) / 100;
}

function smMonthTotalFromChartSeries(vals) {
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

function smMonthTotalFromChartSeriesThroughDay(vals, throughDay) {
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

function smPctChange(current, prev) {
  if (!prev) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function smRenderChartSummary() {
  let el = document.getElementById('smChartSummary');
  if (!el) return;

  try {
    let y = smView.y;
    let m = smView.m;
    let prev = smCalcPrevMonth(y, m);
    let curVals = smCollectChartSeries(y, m);
    let prevVals = smCollectChartSeries(prev.y, prev.m);
    let curTotal = smMonthTotalFromChartSeries(curVals);
    let prevTotal = smMonthTotalFromChartSeries(prevVals);
    let throughDay = typeof pdGetMomThroughDay === 'function'
      ? pdGetMomThroughDay(y, m)
      : (typeof smChartLastDataDay === 'function' ? smChartLastDataDay(y, m) : null);
    let prevThrough = typeof pdGetMomPrevThroughDay === 'function'
      ? pdGetMomPrevThroughDay(throughDay, prev.y, prev.m)
      : (throughDay == null ? null : Math.min(throughDay, new Date(prev.y, prev.m + 1, 0).getDate()));
    let curCompare = throughDay == null
      ? curTotal
      : smMonthTotalFromChartSeriesThroughDay(curVals, throughDay);
    let prevCompare = prevThrough == null
      ? prevTotal
      : smMonthTotalFromChartSeriesThroughDay(prevVals, prevThrough);
    let pct = smPctChange(curCompare, prevCompare);
    let deltaHtml = typeof pdRenderTrendDeltaHtml === 'function'
      ? pdRenderTrendDeltaHtml(pct)
      : ((pct >= 0 ? '+' : '') + pct + '%');

    el.innerHTML =
      '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">今月合計</span><span class="rmChartSummaryVal">' + smMoney(curTotal) + '</span></div>' +
      '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">前月合計</span><span class="rmChartSummaryVal isPrev">' + smMoney(prevTotal) + '</span></div>' +
      '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">前月比</span><span class="rmChartSummaryVal">' + deltaHtml + '</span></div>';
  } catch (e) {}
}

function smScanAllDateKeys() {
  if (typeof settings !== 'undefined' && settings.salesLog) {
    return Object.keys(settings.salesLog).sort();
  }
  return [];
}

function smComputeProjectStats(projectKey) {
  let bestDay = { amount: 0, dateKey: '' };
  let monthTotals = {};

  smScanAllDateKeys().forEach(function (key) {
    let parts = key.split('-');
    if (parts.length !== 3) return;
    let y = Number(parts[0]);
    let mo = Number(parts[1]) - 1;
    let d = Number(parts[2]);
    let amt = smGetProjectDayAmountDeduped(projectKey, y, mo, d);
    if (amt === null || amt === undefined) return;
    if (amt > bestDay.amount) {
      bestDay = { amount: amt, dateKey: key };
    }
    let monthKey = parts[0] + '-' + parts[1];
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

function smGetProjectStats(projectKey) {
  let stats = smComputeProjectStats(projectKey);
  let total = smGetProjectLatestTotalSales(projectKey);
  stats.totalSalesAmount = total.totalSalesAmount;
  stats.totalSalesLabel = total.totalSalesLabel;
  if (stats.bestDayAmount || stats.bestMonthAmount || stats.totalSalesAmount) return stats;
  return smIsDemoMode() ? (SM_DEMO_STATS[projectKey] || stats) : stats;
}

function smProjectSupportsTotalSales(projectKey) {
  return projectKey === 'ram' || projectKey === 'orca';
}

function smGetDemoAccountStats(accountId) {
  let seed = smAccountSeed(accountId);
  let day = 8 + (seed % 20);
  return {
    bestDayAmount: 2800 + (seed % 8) * 320,
    bestDayLabel: '2026/06/' + String(day).padStart(2, '0'),
    bestMonthAmount: 8200 + (seed % 11) * 680,
    bestMonthLabel: '2026年6月',
    totalSalesAmount: 1500000 + (seed % 12) * 500000,
    totalSalesLabel: '2026/06/' + String(day).padStart(2, '0')
  };
}

function smNormalizeOrcaSalesLabel(value) {
  return String(value || '').replace(/^@/, '').trim().toLowerCase();
}

function smGetOrcaSalesLookupIds(accountId, displayName) {
  let ids = [];
  function push(id) {
    if (id && ids.indexOf(id) < 0) ids.push(id);
  }
  push(accountId);
  if (typeof getOrcaInputAccounts !== 'function') return ids;
  let inputs = getOrcaInputAccounts();
  let label = smNormalizeOrcaSalesLabel(displayName);
  if (!label && typeof pfLookupManageAccountName === 'function') {
    label = smNormalizeOrcaSalesLabel(pfLookupManageAccountName('orca', accountId));
  }
  if (label) {
    inputs.forEach(function (acc) {
      let un = smNormalizeOrcaSalesLabel(acc.username || acc.name);
      if (un && un === label) push(acc.id);
    });
  }
  if (typeof settings !== 'undefined' && settings.salesLog && label) {
    let seen = {};
    ids.forEach(function (id) { seen[id] = true; });
    Object.keys(settings.salesLog).forEach(function (dateKey) {
      let entry = settings.salesLog[dateKey];
      if (!entry || !entry.accounts) return;
      Object.keys(entry.accounts).forEach(function (sid) {
        if (seen[sid]) return;
        let ae = entry.accounts[sid];
        if (!ae || (ae.projectKey && ae.projectKey !== 'orca')) return;
        if (ae.totalSales == null || ae.totalSales === '') return;
        let name = smNormalizeOrcaSalesLabel(
          typeof pfLookupManageAccountName === 'function'
            ? pfLookupManageAccountName('orca', sid)
            : ''
        );
        if (!name) {
          let matched = inputs.find(function (acc) { return acc.id === sid; });
          name = smNormalizeOrcaSalesLabel(matched && (matched.username || matched.name));
        }
        if (name && name === label) push(sid);
      });
    });
  }
  return ids;
}

function smGetSalesLogEntry(dateKey) {
  if (typeof pdGetSalesEntryRaw === 'function') {
    let raw = pdGetSalesEntryRaw(dateKey);
    if (raw) return raw;
  }
  return getSalesEntry(dateKey);
}

function smSalesAccountMatchesProject(ae, projectKey) {
  if (!ae) return false;
  if (!ae.projectKey) return true;
  return ae.projectKey === projectKey;
}

function smFormatTotalSalesDateLabel(dateKey) {
  if (!dateKey) return '—';
  let parts = String(dateKey).split('-');
  if (parts.length !== 3) return '—';
  return parts[0] + '/' + parts[1] + '/' + parts[2];
}

function smRoundSalesAmount(value) {
  if (value == null || value === '') return null;
  return typeof pdRound === 'function'
    ? pdRound(value)
    : Math.round(Number(value) * 100) / 100;
}

function smResolveOrcaSalesAccountLabel(accountId, displayName) {
  let label = smNormalizeOrcaSalesLabel(displayName);
  if (label) return label;
  if (typeof pfLookupManageAccountName === 'function') {
    label = smNormalizeOrcaSalesLabel(pfLookupManageAccountName('orca', accountId));
  }
  if (!label && typeof getOrcaInputAccounts === 'function') {
    let matched = getOrcaInputAccounts().find(function (acc) { return acc.id === accountId; });
    label = smNormalizeOrcaSalesLabel(matched && (matched.username || matched.name));
  }
  return label;
}

function smResolveOrcaSalesAccountLabelById(accountId) {
  if (typeof pfLookupManageAccountName === 'function') {
    let fromManage = smNormalizeOrcaSalesLabel(pfLookupManageAccountName('orca', accountId));
    if (fromManage) return fromManage;
  }
  if (typeof getOrcaInputAccounts === 'function') {
    let matched = getOrcaInputAccounts().find(function (acc) { return acc.id === accountId; });
    return smNormalizeOrcaSalesLabel(matched && (matched.username || matched.name));
  }
  return '';
}

function smConsiderLatestTotalSalesCandidate(best, dateKey, amount) {
  if (amount == null || isNaN(amount)) return best;
  if (!best || dateKey > best.totalSalesDateKey) {
    return {
      totalSalesAmount: amount,
      totalSalesLabel: smFormatTotalSalesDateLabel(dateKey),
      totalSalesDateKey: dateKey
    };
  }
  return best;
}

function smScanSalesLogForLatestTotalSales(lookupIds, projectKey, displayName) {
  let ids = lookupIds || [];
  let idSet = {};
  ids.forEach(function (id) { if (id) idSet[id] = true; });
  let keys = smScanAllDateKeys();
  let best = null;
  let orcaLabel = projectKey === 'orca'
    ? smResolveOrcaSalesAccountLabel(ids[0] || '', displayName)
    : '';

  for (let i = keys.length - 1; i >= 0; i--) {
    let dateKey = keys[i];
    let entry = smGetSalesLogEntry(dateKey);
    if (!entry || !entry.accounts) continue;

    ids.forEach(function (lookupId) {
      let ae = entry.accounts[lookupId];
      if (!smSalesAccountMatchesProject(ae, projectKey)) return;
      if (ae.totalSales == null || ae.totalSales === '') return;
      best = smConsiderLatestTotalSalesCandidate(best, dateKey, smRoundSalesAmount(ae.totalSales));
    });

    if (projectKey !== 'orca' || !orcaLabel) continue;

    Object.keys(entry.accounts).forEach(function (sid) {
      if (idSet[sid]) return;
      let ae = entry.accounts[sid];
      if (!smSalesAccountMatchesProject(ae, projectKey)) return;
      if (ae.totalSales == null || ae.totalSales === '') return;
      let name = smResolveOrcaSalesAccountLabelById(sid);
      if (!name || name !== orcaLabel) return;
      best = smConsiderLatestTotalSalesCandidate(best, dateKey, smRoundSalesAmount(ae.totalSales));
    });
  }

  return best;
}

function smGetAccountLatestTotalSales(accountId, projectKey, displayName) {
  if (!smProjectSupportsTotalSales(projectKey) || !accountId) {
    return { totalSalesAmount: null, totalSalesLabel: '—', totalSalesDateKey: '' };
  }
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  if (typeof settings === 'undefined' || !settings.salesLog) {
    return { totalSalesAmount: null, totalSalesLabel: '—', totalSalesDateKey: '' };
  }
  let lookupIds = projectKey === 'orca'
    ? smGetOrcaSalesLookupIds(accountId, displayName)
    : [accountId];
  let best = smScanSalesLogForLatestTotalSales(lookupIds, projectKey, displayName);
  if (best) return best;
  return { totalSalesAmount: null, totalSalesLabel: '—', totalSalesDateKey: '' };
}

function smGetRamPrimaryTotalSalesAccountEntry() {
  if (typeof getRamInputAccounts === 'function') {
    let roots = getRamInputAccounts();
    if (roots.length) {
      let acc = roots[0];
      return {
        id: acc.id,
        name: acc.username || acc.name || acc.id
      };
    }
  }
  let tree = smGetLiveRamAccountTree();
  let accounts = tree.length ? tree : smGetProjectAccounts('ram');
  let aggIds = smGetAggregationAccountIds(accounts);
  if (!aggIds.length) return null;
  let byId = {};
  accounts.forEach(function (acc) { byId[acc.id] = acc; });
  let id = aggIds[0];
  return byId[id] || {
    id: id,
    name: typeof pfLookupManageAccountName === 'function'
      ? pfLookupManageAccountName('ram', id)
      : id
  };
}

function smGetProjectTotalSalesAggregationEntries(projectKey) {
  if (projectKey === 'ram') {
    let primary = smGetRamPrimaryTotalSalesAccountEntry();
    return primary ? [primary] : [];
  }
  if (projectKey === 'orca') {
    if (typeof getOrcaInputAccounts === 'function') {
      let inputs = getOrcaInputAccounts();
      if (inputs.length) {
        return inputs.map(function (acc) {
          return {
            id: acc.id,
            name: acc.username || acc.name || acc.id
          };
        });
      }
    }
    return smGetProjectAccounts('orca');
  }
  return [];
}

function smGetProjectLatestTotalSales(projectKey) {
  if (!smProjectSupportsTotalSales(projectKey)) {
    return { totalSalesAmount: null, totalSalesLabel: '—' };
  }
  if (projectKey === 'ram') {
    let primary = smGetRamPrimaryTotalSalesAccountEntry();
    if (!primary) {
      return { totalSalesAmount: null, totalSalesLabel: '—' };
    }
    let t = smGetAccountLatestTotalSales(primary.id, 'ram', primary.name);
    if (t.totalSalesAmount == null && smIsDemoMode() && SM_DEMO_STATS.ram) {
      return {
        totalSalesAmount: SM_DEMO_STATS.ram.totalSalesAmount,
        totalSalesLabel: SM_DEMO_STATS.ram.totalSalesLabel || '—'
      };
    }
    return {
      totalSalesAmount: t.totalSalesAmount,
      totalSalesLabel: t.totalSalesLabel
    };
  }
  let entries = smGetProjectTotalSalesAggregationEntries(projectKey);
  if (!entries.length) {
    return { totalSalesAmount: null, totalSalesLabel: '—' };
  }
  let sum = 0;
  let hasAny = false;
  let latestDateKey = '';
  entries.forEach(function (acc) {
    let t = smGetAccountLatestTotalSales(acc.id, projectKey, acc.name);
    if (t.totalSalesAmount == null) return;
    hasAny = true;
    sum += t.totalSalesAmount;
    if (t.totalSalesDateKey && t.totalSalesDateKey > latestDateKey) {
      latestDateKey = t.totalSalesDateKey;
    }
  });
  if (!hasAny) {
    if (smIsDemoMode() && SM_DEMO_STATS[projectKey] && SM_DEMO_STATS[projectKey].totalSalesAmount) {
      return {
        totalSalesAmount: SM_DEMO_STATS[projectKey].totalSalesAmount,
        totalSalesLabel: SM_DEMO_STATS[projectKey].totalSalesLabel || '—'
      };
    }
    return { totalSalesAmount: null, totalSalesLabel: '—' };
  }
  let label = '—';
  if (latestDateKey) {
    let parts = latestDateKey.split('-');
    if (parts.length === 3) label = parts[0] + '/' + parts[1] + '/' + parts[2];
  }
  return {
    totalSalesAmount: Math.round(sum * 100) / 100,
    totalSalesLabel: label
  };
}

function smMergeAccountTotalSalesStats(stats, accountId, projectKey, displayName) {
  let total = smGetAccountLatestTotalSales(accountId, projectKey, displayName);
  if (total.totalSalesAmount == null && smIsDemoMode()) {
    let demo = smGetDemoAccountStats(accountId);
    total.totalSalesAmount = demo.totalSalesAmount;
    total.totalSalesLabel = demo.totalSalesLabel;
  }
  stats.totalSalesAmount = total.totalSalesAmount;
  stats.totalSalesLabel = total.totalSalesLabel;
  return stats;
}

function smGetAccountStats(projectKey, accountId, displayName) {
  let bestDay = { amount: 0, dateKey: '' };
  let monthTotals = {};
  let daysInMonth = new Date(smView.y, smView.m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    let amt = smGetAccountDaySales(accountId, projectKey, smView.y, smView.m, d);
    if (amt === null || amt === undefined) continue;
    if (amt > bestDay.amount) {
      bestDay = { amount: amt, dateKey: smSalesDateKey(smView.y, smView.m, d) };
    }
  }
  if (bestDay.amount > 0) {
    let p = bestDay.dateKey.split('-');
    return smMergeAccountTotalSalesStats({
      bestDayAmount: bestDay.amount,
      bestDayLabel: p[0] + '/' + p[1] + '/' + p[2],
      bestMonthAmount: smSumAccountMonth(accountId, projectKey, smView.y, smView.m),
      bestMonthLabel: smFormatMonthLabel(smView.y, smView.m)
    }, accountId, projectKey, displayName);
  }
  if (smIsDemoMode()) return smGetDemoAccountStats(accountId);
  return smMergeAccountTotalSalesStats({
    bestDayAmount: 0,
    bestDayLabel: '—',
    bestMonthAmount: 0,
    bestMonthLabel: '—'
  }, accountId, projectKey, displayName);
}

function smRenderProjectStats() {
  let el = document.getElementById('smProjectStats');
  if (!el) return;

  try {
  if (smFilter === 'all') {
    let html =
      '<div class="rmStatTable">' +
      '<div class="rmStatTableHead">' +
      '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">最高日売上</div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">最高月売上</div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">総売上</div>' +
      '</div>' +
      smGetActiveProjects().map(function (p) {
        let stats = smGetProjectStats(p.key);
        return '<div class="rmStatTableRow" data-pj-icon-key="' + smEscape(p.key) + '">' +
          '<div class="rmStatTableCol rmStatTableCol--project">' + smRenderProjectIcon(p.key, 'rmRowIcon') + smEscape(p.name) + '</div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + smFormatStatAmount(stats.bestDayAmount, stats.bestDayLabel) + '</span>' +
          '<span class="rmStatDate">' + smEscape(stats.bestDayLabel) + '</span></div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + smFormatStatAmount(stats.bestMonthAmount, stats.bestMonthLabel) + '</span>' +
          '<span class="rmStatDate">' + smEscape(stats.bestMonthLabel) + '</span></div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + smFormatStatAmount(stats.totalSalesAmount, stats.totalSalesLabel) + '</span>' +
          '<span class="rmStatDate">' + smEscape(stats.totalSalesLabel) + '</span></div>' +
          '</div>';
      }).join('') +
      '</div>';
    if (typeof pjSetHtmlKeepIcons === 'function') pjSetHtmlKeepIcons(el, html);
    else el.innerHTML = html;
    return;
  }

  let accounts = smGetProjectAccounts(smFilter);
  el.innerHTML =
    '<div class="rmStatTable">' +
    '<div class="rmStatTableHead">' +
    '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高日売上</div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高月売上</div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">総売上</div>' +
    '</div>' +
    accounts.map(function (acc) {
      let stats = smGetAccountStats(smFilter, acc.id, acc.name);
      return '<div class="rmStatTableRow">' +
        '<div class="rmStatTableCol rmStatTableCol--project">' + pfRenderAccountLabel(smEscape(acc.name), acc.seriesIndex || 0) + '</div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + smFormatStatAmount(stats.bestDayAmount, stats.bestDayLabel) + '</span>' +
        '<span class="rmStatDate">' + smEscape(stats.bestDayLabel) + '</span></div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + smFormatStatAmount(stats.bestMonthAmount, stats.bestMonthLabel) + '</span>' +
        '<span class="rmStatDate">' + smEscape(stats.bestMonthLabel) + '</span></div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + smFormatStatAmount(stats.totalSalesAmount, stats.totalSalesLabel) + '</span>' +
        '<span class="rmStatDate">' + smEscape(stats.totalSalesLabel) + '</span></div>' +
        '</div>';
    }).join('') +
    '</div>';
  } catch (e) {}
}

function smUpdateHeaderMeta() {
  if (typeof hubUpdateMonthLabels === 'function') hubUpdateMonthLabels();
  else {
    let monthLabel = document.getElementById('smMonthLabel');
    if (monthLabel) monthLabel.textContent = smFormatMonthLabel(smView.y, smView.m);
  }

  let lastUpdate = document.getElementById('smLastUpdate');
  if (lastUpdate) {
    let txt = (typeof settings !== 'undefined' && settings.lastUpdate && settings.lastUpdate !== '-')
      ? settings.lastUpdate
      : '—';
    lastUpdate.textContent = '最終更新：' + txt;
  }

  let dailyTitle = document.getElementById('smDailyTitle');
  if (dailyTitle) dailyTitle.textContent = '日別売上一覧' + smGetScopeSuffix();

  let chartTitle = document.getElementById('smLineChartTitle');
  if (chartTitle) chartTitle.textContent = '月間売上グラフ' + smGetScopeSuffix();

  let statsTitle = document.getElementById('smStatsTitle');
  if (statsTitle) statsTitle.textContent = '過去最高売上' + smGetScopeSuffix();
}

function smOnFilterChange() {
  let sel = document.getElementById('smProjectFilter');
  smFilter = sel ? sel.value : 'all';
  if (typeof pjUpdateFilterIcon === 'function') pjUpdateFilterIcon('smFilterIcon', smFilter);
  smRenderAllPanels();
  smUpdateHeaderMeta();
}

function smPrevMonth() {
  if (typeof hubPrevMonth === 'function') hubPrevMonth();
}

function smNextMonth() {
  if (typeof hubNextMonth === 'function') hubNextMonth();
}

function smExportPlaceholder() {
  if (typeof showToast === 'function') showToast('エクスポートは準備中です');
}

function smRenderBottomPanels() {
  smRenderCompareChart();
  smRenderChartSummary();
  smRenderProjectStats();
}

function smRenderAllPanels() {
  smRenderDailyTable();
  smRenderBottomPanels();
}

function renderSalesManage() {
  if (typeof hubEnsureViewMonth === 'function') hubEnsureViewMonth();
  if (typeof pfSyncMainTabs === 'function') pfSyncMainTabs('salesManage');

  smSyncProjectFilterOptions();
  if (typeof pjUpdateFilterIcon === 'function') pjUpdateFilterIcon('smFilterIcon', smFilter);

  smUpdateHeaderMeta();
  smRenderAllPanels();
}

function smEnsureInit() {
  if (typeof salesManagePage === 'undefined') return;
  smBindDailyTableEvents();
  renderSalesManage();
}

if (typeof window !== 'undefined') {
  window.smOpenSalesEntryPlaceholder = smOpenSalesEntryPlaceholder;
  window.smSaveSalesEntry = smSaveSalesEntry;
  window.smSaveSalesEntryDummy = smSaveSalesEntryDummy;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', smEnsureInit);
  } else {
    smEnsureInit();
  }
}
