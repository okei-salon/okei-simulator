/* OUKEI HUB Sales Management — Ver1.8.7 */

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
  { key: 'ram', name: 'RAM', iconKey: 'ram' },
  { key: 'orca', name: 'ORCA', iconKey: 'orca' },
  { key: 'cary', name: 'Cary Pact', iconKey: 'cary' },
  { key: 'genesis', name: 'GENESIS', iconKey: 'genesis' },
  { key: 'other', name: 'その他', iconKey: 'custom' }
];

var SM_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

var SM_DEMO_STATS = {
  ram: { bestDayAmount: 2180, bestDayLabel: '2026/06/18', bestMonthAmount: 52400, bestMonthLabel: '2026年6月' },
  orca: { bestDayAmount: 1720, bestDayLabel: '2026/06/15', bestMonthAmount: 41200, bestMonthLabel: '2026年6月' },
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
    { id: 'demo_ram_1', name: '甲斐1', parentId: null, depth: 0 },
    { id: 'demo_ram_2', name: '甲斐2', parentId: 'demo_ram_1', depth: 1 },
    { id: 'demo_ram_3', name: '山森1', parentId: null, depth: 0 },
    { id: 'demo_ram_4', name: '山森2', parentId: 'demo_ram_3', depth: 1 },
    { id: 'demo_ram_5', name: '旺慶', parentId: null, depth: 0 },
    { id: 'demo_ram_6', name: '旺慶2', parentId: 'demo_ram_5', depth: 1 }
  ],
  orca: [
    { id: 'demo_orca_1', name: '甲斐①', parentId: null, depth: 0 },
    { id: 'demo_orca_2', name: '甲斐②', parentId: 'demo_orca_1', depth: 1 },
    { id: 'demo_orca_3', name: '山森1', parentId: null, depth: 0 },
    { id: 'demo_orca_4', name: '山森2', parentId: 'demo_orca_3', depth: 1 }
  ],
  cary: [
    { id: 'demo_cary_1', name: '甲斐A', parentId: null, depth: 0 },
    { id: 'demo_cary_2', name: '甲斐B', parentId: 'demo_cary_1', depth: 1 },
    { id: 'demo_cary_3', name: '山森C', parentId: null, depth: 0 }
  ],
  genesis: [
    { id: 'demo_genesis_1', name: 'GENESIS-A', parentId: null, depth: 0 },
    { id: 'demo_genesis_2', name: 'GENESIS-B', parentId: 'demo_genesis_1', depth: 1 },
    { id: 'demo_genesis_3', name: 'GENESIS-C', parentId: null, depth: 0 }
  ],
  other: [
    { id: 'demo_other_1', name: '副業A', parentId: null, depth: 0 },
    { id: 'demo_other_2', name: '副業B', parentId: 'demo_other_1', depth: 1 },
    { id: 'demo_other_3', name: 'その他C', parentId: null, depth: 0 }
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
  if (typeof settings !== 'undefined' && settings.salesLog && settings.salesLog[dateKey]) {
    return settings.salesLog[dateKey];
  }
  return null;
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

function smMoney(n) {
  if (typeof money === 'function') return money(n || 0);
  return '$' + Math.round((Number(n) || 0) * 100) / 100;
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
    members.filter(function (x) { return x.parent === id; }).forEach(function (child) {
      addMember(child.id, depth + 1);
    });
  }

  roots.forEach(function (r) { addMember(r.id, 0); });
  return out;
}

function smGetLiveOrcaAccounts() {
  if (typeof getOrcaInputAccounts !== 'function') return [];
  return getOrcaInputAccounts().map(function (acc) {
    return { id: acc.id, name: acc.username, parentId: null, depth: 0 };
  });
}

function smGetLiveCaryAccounts() {
  if (typeof getCaryInputAccounts !== 'function') return [];
  return getCaryInputAccounts().map(function (acc) {
    return { id: acc.id, name: acc.username, parentId: null, depth: 0 };
  });
}

function smGetProjectAccounts(projectKey) {
  let live = [];
  let isDemoSource = false;
  if (projectKey === 'ram') live = smGetLiveRamAccountTree();
  else if (projectKey === 'orca') live = smGetLiveOrcaAccounts();
  else if (projectKey === 'cary') live = smGetLiveCaryAccounts();
  let accounts;
  if (live.length) {
    accounts = live;
  } else if (SM_DEMO_SALES_ACCOUNTS[projectKey]) {
    accounts = SM_DEMO_SALES_ACCOUNTS[projectKey].slice();
    isDemoSource = true;
  } else {
    accounts = [];
  }
  accounts = pfFilterManageAccounts(projectKey, accounts, { useDemoBypass: isDemoSource });
  accounts = pfApplyManageAccountLabels(projectKey, accounts);
  return pfAnnotateAccountSeries(accounts);
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

function smGetAccountDaySalesFromLog(accountId, projectKey, y, m, d) {
  let ae = getSalesAccountEntry(smSalesDateKey(y, m, d), accountId);
  if (!ae) return null;
  if (ae.projectKey && ae.projectKey !== projectKey) return null;
  if (ae.todaySales != null) return Number(ae.todaySales) || 0;
  return null;
}

function smGetAccountDaySales(accountId, projectKey, y, m, d) {
  let fromLog = smGetAccountDaySalesFromLog(accountId, projectKey, y, m, d);
  if (fromLog !== null) return fromLog;
  return smGetDemoAccountDaySales(accountId, projectKey, d);
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

function smGetProjectDayAmountDeduped(projectKey, y, m, d) {
  let entry = getSalesEntry(smSalesDateKey(y, m, d));
  if (entry && entry[projectKey] != null && Number(entry[projectKey]) > 0) {
    return Math.round(Number(entry[projectKey]) * 100) / 100;
  }

  let accounts = smGetProjectAccounts(projectKey);
  if (!accounts.length) {
    return smGetDemoProjectDayAmountFallback(projectKey, d, new Date(y, m + 1, 0).getDate());
  }

  let aggIds = smGetAggregationAccountIds(accounts);
  let sum = aggIds.reduce(function (s, id) {
    return s + smGetAccountDaySales(id, projectKey, y, m, d);
  }, 0);
  return Math.round(sum * 100) / 100;
}

function smGetDemoDayTotal(d, daysInMonth) {
  return SM_PROJECTS.reduce(function (sum, p) {
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
  let demoSales = Number(amount) || 10000;
  if (!amount && accountId === 'demo_ram_2') demoSales = 3000;
  let body =
    '<input type="hidden" id="smEntryProjectKey" value="' + pfEscapeAttr(projectKey) + '">' +
    '<input type="hidden" id="smEntryAccountId" value="' + pfEscapeAttr(accountId) + '">' +
    pfEntryDateField('日付', 'smEntryDate', dateVal) +
    pfEntryReadonlyField('プロジェクト', projLabel) +
    pfEntryReadonlyField('アカウント', accountName || accountId) +
    pfEntryNumberField('売上（$）', 'smEntrySales', demoSales);
  pfOpenEntryModal('売上入力', body, 'smSaveSalesEntryDummy');
}

function smSaveSalesEntryDummy() {
  let accountId = document.getElementById('smEntryAccountId');
  let projectKey = document.getElementById('smEntryProjectKey');
  if (projectKey && accountId) {
    pfRegisterManageDisplayFromEntry(projectKey.value, accountId.value);
  }
  pfEntrySaveDummy('保存は次回バージョンで実装予定です');
}

function smGetRowDayAmount(row, y, m, d) {
  if (row.isAccount) {
    return smGetAccountDaySales(row.key, row.projectKey, y, m, d);
  }
  if (row.isTotal) {
    if (smFilter === 'all') {
      return SM_PROJECTS.reduce(function (sum, p) {
        return sum + smGetProjectDayAmountDeduped(p.key, y, m, d);
      }, 0);
    }
    return smGetProjectDayAmountDeduped(smFilter, y, m, d);
  }
  return smGetProjectDayAmountDeduped(row.key, y, m, d);
}

function smGetTableRows() {
  if (smFilter === 'all') {
    return SM_PROJECTS.map(function (p) {
      return { key: p.key, name: p.name, iconKey: p.iconKey, isProject: true, isTotal: false };
    }).concat([{ key: 'total', name: '合計', iconKey: '', isTotal: true }]);
  }

  let accounts = smGetProjectAccounts(smFilter);
  if (!accounts.length) {
    return [{ key: 'empty', name: '（表示アカウントなし）', iconKey: smFilter, isEmpty: true }];
  }
  return accounts.map(function (acc) {
    return {
      key: acc.id,
      name: acc.name,
      iconKey: smFilter,
      projectKey: smFilter,
      isAccount: true,
      depth: acc.depth || 0,
      parentId: acc.parentId,
      seriesIndex: acc.seriesIndex || 0
    };
  }).concat([{ key: 'total', name: '合計', iconKey: '', isTotal: true }]);
}

function smSumRowMonth(row, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  for (let d = 1; d <= days; d++) {
    sum += smGetRowDayAmount(row, y, m, d);
  }
  return Math.round(sum * 100) / 100;
}

function smSumAccountMonth(accountId, projectKey, y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let sum = 0;
  for (let d = 1; d <= days; d++) {
    sum += smGetAccountDaySales(accountId, projectKey, y, m, d);
  }
  return Math.round(sum * 100) / 100;
}

function smGetFilteredDayTotal(y, m, d) {
  if (smFilter === 'all') {
    return SM_PROJECTS.reduce(function (sum, p) {
      return sum + smGetProjectDayAmountDeduped(p.key, y, m, d);
    }, 0);
  }
  return smGetProjectDayAmountDeduped(smFilter, y, m, d);
}

function smHasChartData(vals) {
  return vals.some(function (v) { return v > 0; });
}

function smGetDemoDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    vals.push(smGetDemoDayTotal(d, days));
  }
  return vals;
}

function smCollectDailySeries(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let vals = [];
  for (let d = 1; d <= days; d++) {
    vals.push(smGetFilteredDayTotal(y, m, d));
  }
  return vals;
}

function smResolveDailySeries(y, m) {
  let vals = smCollectDailySeries(y, m);
  if (smHasChartData(vals)) return vals;
  return smGetDemoDailySeries(y, m);
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
  if (!amt) return '<td class="' + wdCls + ' isEmpty">—</td>';
  if (!smCanEditAmountCell(dr, row)) {
    return '<td class="' + wdCls + '">' + smMoney(amt) + '</td>';
  }
  let dateKey = pfFormatIsoDate(y, m, d);
  let cell = pfRenderEditableAmountCell(amt, smMoney(amt), {
    projectKey: row.projectKey,
    accountId: row.key,
    accountName: row.name,
    dateKey: dateKey
  });
  return '<td class="' + wdCls + ' pfEditableCell">' + cell + '</td>';
}

function smBindDailyTableEvents() {
  if (smDailyTableBound) return;
  let table = document.getElementById('smDailyTable');
  if (!table) return;
  smDailyTableBound = true;
  pfBindEditableAmountClicks(table, function (meta) {
    smOpenSalesEntryModal(meta.projectKey, meta.accountId, meta.accountName, meta.dateKey, meta.amount);
  });
  pfBindManageAccountContextMenu(table, function () {
    smRenderAllPanels();
    smUpdateHeaderMeta();
  });
}

function smRenderProjectIcon(iconKey, extraClass) {
  if (typeof pmRenderProjectIcon === 'function') return pmRenderProjectIcon(iconKey, extraClass);
  if (typeof renderHomeProjIcon === 'function') return renderHomeProjIcon(iconKey, extraClass);
  return '<span class="homeProjIcon homeProjIcon--' + iconKey + ' ' + (extraClass || '') + '"></span>';
}

function smRenderAccountRowLabel(row) {
  return pfRenderManageAccountTrigger(
    row.projectKey,
    row.key,
    row.name,
    pfRenderAccountLabel(smEscape(row.name), row.seriesIndex || 0)
  );
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
        label = '<span class="rmRowLabel">' + (row.iconKey ? smRenderProjectIcon(row.iconKey, 'rmRowIcon') : '') + smEscape(row.name) + '</span>';
      }

      for (let d = 1; d <= days; d++) {
        let wd = new Date(y, m, d).getDay();
        let cls = wd === 0 ? ' isSun' : (wd === 6 ? ' isSat' : '');

        if (!showAmounts) {
          cells += '<td class="' + cls.trim() + ' isEmpty">—</td>';
          continue;
        }

        let amt = smGetRowDayAmount(row, y, m, d);
        cells += smRenderAmountCell(dr, row, y, m, d, amt, cls.trim());
      }

      if (!showAmounts) {
        cells += '<td class="rmMonthTotalCol isEmpty">—</td>';
      } else {
        let monthSum = smSumRowMonth(row, y, m);
        if (smCanEditAmountCell(dr, row) && monthSum) {
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

function smRenderCompareChart() {
  let el = document.getElementById('smCompareChart');
  if (!el) return;

  try {
    let y = smView.y;
    let m = smView.m;
    let prev = smCalcPrevMonth(y, m);
    let days = new Date(y, m + 1, 0).getDate();
    let curVals = smResolveDailySeries(y, m);
    let prevVals = smResolveDailySeries(prev.y, prev.m);
    let dataMax = Math.max.apply(null, curVals.concat(prevVals).concat([1]));
    let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(dataMax) : Math.max(dataMax, 1800);

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
      let label = typeof formatAxisDollar === 'function' ? formatAxisDollar(t) : smMoney(t);
      return '<line x1="' + padLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padRight) + '" y2="' + yPos.toFixed(1) + '" stroke="rgba(80,110,150,.25)" stroke-width="1"></line>' +
        '<text x="' + (padLeft - 6) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end" fill="#7f97b3" font-size="10" font-weight="700">' + label + '</text>';
    }).join('');

    let xSvg = SM_CHART_X_DAYS.filter(function (d) { return d <= days; }).map(function (d) {
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
      '<span class="rmCompareLegendItem"><i class="isCurrent"></i>今月（' + smFormatMonthLabel(y, m) + '）</span>' +
      '<span class="rmCompareLegendItem"><i class="isPrev"></i>前月（' + smFormatMonthLabel(prev.y, prev.m) + '）</span>' +
      '</div></div>';
  } catch (e) {}
}

function smMonthTotalFromSeries(vals) {
  return Math.round(vals.reduce(function (s, v) { return s + v; }, 0) * 100) / 100;
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
    let curVals = smResolveDailySeries(y, m);
    let prevVals = smResolveDailySeries(prev.y, prev.m);
    let curTotal = smMonthTotalFromSeries(curVals);
    let prevTotal = smMonthTotalFromSeries(prevVals);
    let pct = smPctChange(curTotal, prevTotal);
    let pctCls = pct >= 0 ? 'isUp' : 'isDown';
    let arrow = pct >= 0 ? '↗' : '↘';

    el.innerHTML =
      '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">今月合計</span><span class="rmChartSummaryVal">' + smMoney(curTotal) + '</span></div>' +
      '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">前月合計</span><span class="rmChartSummaryVal isPrev">' + smMoney(prevTotal) + '</span></div>' +
      '<div class="rmChartSummaryItem"><span class="rmChartSummaryLabel">前月比</span><span class="rmChartSummaryVal ' + pctCls + '">' + (pct >= 0 ? '+' : '') + pct + '% ' + arrow + '</span></div>';
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
  if (stats.bestDayAmount || stats.bestMonthAmount) return stats;
  return SM_DEMO_STATS[projectKey] || stats;
}

function smGetDemoAccountStats(accountId) {
  let seed = smAccountSeed(accountId);
  let day = 8 + (seed % 20);
  return {
    bestDayAmount: 2800 + (seed % 8) * 320,
    bestDayLabel: '2026/06/' + String(day).padStart(2, '0'),
    bestMonthAmount: 8200 + (seed % 11) * 680,
    bestMonthLabel: '2026年6月'
  };
}

function smGetAccountStats(projectKey, accountId) {
  let bestDay = { amount: 0, dateKey: '' };
  let monthTotals = {};
  let daysInMonth = new Date(smView.y, smView.m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    let amt = smGetAccountDaySales(accountId, projectKey, smView.y, smView.m, d);
    if (amt > bestDay.amount) {
      bestDay = { amount: amt, dateKey: smSalesDateKey(smView.y, smView.m, d) };
    }
  }
  if (bestDay.amount > 0) {
    let p = bestDay.dateKey.split('-');
    return {
      bestDayAmount: bestDay.amount,
      bestDayLabel: p[0] + '/' + p[1] + '/' + p[2],
      bestMonthAmount: smSumAccountMonth(accountId, projectKey, smView.y, smView.m),
      bestMonthLabel: smFormatMonthLabel(smView.y, smView.m)
    };
  }
  return smGetDemoAccountStats(accountId);
}

function smRenderProjectStats() {
  let el = document.getElementById('smProjectStats');
  if (!el) return;

  try {
  if (smFilter === 'all') {
    el.innerHTML =
      '<div class="rmStatTable">' +
      '<div class="rmStatTableHead">' +
      '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">最高日売上</div>' +
      '<div class="rmStatTableCol rmStatTableCol--metric">最高月売上</div>' +
      '</div>' +
      SM_PROJECTS.map(function (p) {
        let stats = smGetProjectStats(p.key);
        return '<div class="rmStatTableRow">' +
          '<div class="rmStatTableCol rmStatTableCol--project">' + smRenderProjectIcon(p.iconKey, 'rmRowIcon') + smEscape(p.name) + '</div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + smMoney(stats.bestDayAmount) + '</span>' +
          '<span class="rmStatDate">' + smEscape(stats.bestDayLabel) + '</span></div>' +
          '<div class="rmStatTableCol rmStatTableCol--metric">' +
          '<span class="rmStatAmt">' + smMoney(stats.bestMonthAmount) + '</span>' +
          '<span class="rmStatDate">' + smEscape(stats.bestMonthLabel) + '</span></div>' +
          '</div>';
      }).join('') +
      '</div>';
    return;
  }

  let accounts = smGetProjectAccounts(smFilter);
  el.innerHTML =
    '<div class="rmStatTable">' +
    '<div class="rmStatTableHead">' +
    '<div class="rmStatTableCol rmStatTableCol--project"></div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高日売上</div>' +
    '<div class="rmStatTableCol rmStatTableCol--metric">最高月売上</div>' +
    '</div>' +
    accounts.map(function (acc) {
      let stats = smGetAccountStats(smFilter, acc.id);
      return '<div class="rmStatTableRow">' +
        '<div class="rmStatTableCol rmStatTableCol--project">' + pfRenderAccountLabel(smEscape(acc.name), acc.seriesIndex || 0) + '</div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + smMoney(stats.bestDayAmount) + '</span>' +
        '<span class="rmStatDate">' + smEscape(stats.bestDayLabel) + '</span></div>' +
        '<div class="rmStatTableCol rmStatTableCol--metric">' +
        '<span class="rmStatAmt">' + smMoney(stats.bestMonthAmount) + '</span>' +
        '<span class="rmStatDate">' + smEscape(stats.bestMonthLabel) + '</span></div>' +
        '</div>';
    }).join('') +
    '</div>';
  } catch (e) {}
}

function smUpdateHeaderMeta() {
  let monthLabel = document.getElementById('smMonthLabel');
  if (monthLabel) monthLabel.textContent = smFormatMonthLabel(smView.y, smView.m);

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
  smRenderAllPanels();
  smUpdateHeaderMeta();
}

function smPrevMonth() {
  smView.m--;
  if (smView.m < 0) { smView.m = 11; smView.y--; }
  renderSalesManage();
}

function smNextMonth() {
  smView.m++;
  if (smView.m > 11) { smView.m = 0; smView.y++; }
  renderSalesManage();
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
  smInitViewFromReference();
  if (typeof pfSyncMainTabs === 'function') pfSyncMainTabs('salesManage');

  let sel = document.getElementById('smProjectFilter');
  if (sel) sel.value = smFilter;

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
  window.smSaveSalesEntryDummy = smSaveSalesEntryDummy;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', smEnsureInit);
  } else {
    smEnsureInit();
  }
}
