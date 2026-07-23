/* OUKEI HUB Local Storage + Cloud Save Hooks — Ver2.0.8 */

var HUB_STORAGE_KEY = 'oukei_hub_v15_data';
var HUB_STORAGE_LEGACY_KEY = 'okei_v14_data';
var HUB_DEMO_MODE_KEY = 'oukei_home_demo_mode';
var HUB_UID_KEY = 'oukei_hub_v15_uid';
var hubLocalUpdatedAt = 0;
var hubActiveUid = '';

function hubCreateDefaultSettings() {
  return {
    currencyMode: 'both',
    yenRate: 155,
    useRAM: false,
    useORCA: false,
    useCARY: false,
    ochanDialect: 'standard',
    ochanMonthlyGoal: 0,
    lastLogin: new Date().toLocaleString(),
    lastUpdate: '-',
    customProjects: [],
    activityDays: 0,
    lastActivityDate: '',
    revenueLog: {},
    salesLog: {},
    manageDisplayAccounts: {},
    performanceInputHiddenAccounts: {},
    removedRamOrgAccountIds: [],
    removedOrcaOrgAccountIds: [],
    removedOrcaOrgAccountIdTimes: {},
    removedEniOrgAccountIds: [],
    ramInputAccounts: []
  };
}

function hubUnionStringIds() {
  let out = [];
  for (let i = 0; i < arguments.length; i++) {
    let list = arguments[i];
    if (!Array.isArray(list)) continue;
    list.forEach(function (id) {
      if (id && out.indexOf(id) < 0) out.push(id);
    });
  }
  return out;
}

function hubGetRemovedOrcaOrgAccountIds(settings) {
  return settings && Array.isArray(settings.removedOrcaOrgAccountIds)
    ? settings.removedOrcaOrgAccountIds
    : [];
}

function hubGetRemovedRamOrgAccountIds(settings) {
  return settings && Array.isArray(settings.removedRamOrgAccountIds)
    ? settings.removedRamOrgAccountIds
    : [];
}

function hubGetRemovedEniOrgAccountIds(settings) {
  return settings && Array.isArray(settings.removedEniOrgAccountIds)
    ? settings.removedEniOrgAccountIds
    : [];
}

/**
 * 組織図メンバーを ID ユニオンでマージする。
 * クラウド enrich 時に「ローカルだけにある新規ノード」を落とさないための共通処理。
 */
function hubUnionOrgCharts(cloudChart, localChart, preferLocal, emptyFactory) {
  let empty = typeof emptyFactory === 'function' ? emptyFactory() : {
    members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1
  };
  let cloud = cloudChart && typeof cloudChart === 'object' ? cloudChart : empty;
  let local = localChart && typeof localChart === 'object' ? localChart : empty;
  let members = hubMergeArrayEntriesById(
    Array.isArray(cloud.members) ? cloud.members : [],
    Array.isArray(local.members) ? local.members : [],
    !!preferLocal
  ).map(function (m) {
    try { return JSON.parse(JSON.stringify(m)); } catch (e) { return m; }
  });
  let byId = {};
  members.forEach(function (m) {
    if (m && m.id) byId[m.id] = m;
  });
  let rootIds = [];
  let seenRoot = {};
  function pushRoot(id) {
    if (!id || seenRoot[id] || !byId[id]) return;
    seenRoot[id] = true;
    rootIds.push(id);
  }
  let preferRoots = preferLocal
    ? (Array.isArray(local.rootAccountIds) ? local.rootAccountIds : [])
    : (Array.isArray(cloud.rootAccountIds) ? cloud.rootAccountIds : []);
  let otherRoots = preferLocal
    ? (Array.isArray(cloud.rootAccountIds) ? cloud.rootAccountIds : [])
    : (Array.isArray(local.rootAccountIds) ? local.rootAccountIds : []);
  preferRoots.forEach(pushRoot);
  otherRoots.forEach(pushRoot);
  members.forEach(function (m) {
    if (m && !m.parent) pushRoot(m.id);
  });
  let rootId = preferLocal ? (local.rootId || '') : (cloud.rootId || '');
  if (!rootId || !byId[rootId]) rootId = rootIds[0] || '';
  let scenarios = preferLocal
    ? (Array.isArray(local.scenarios) ? local.scenarios : cloud.scenarios)
    : (Array.isArray(cloud.scenarios) ? cloud.scenarios : local.scenarios);
  let zoom = preferLocal
    ? (typeof local.zoom === 'number' ? local.zoom : cloud.zoom)
    : (typeof cloud.zoom === 'number' ? cloud.zoom : local.zoom);
  return {
    members: members,
    currentData: JSON.parse(JSON.stringify(members)),
    scenarios: Array.isArray(scenarios) ? scenarios : [],
    rootId: rootId || '',
    rootAccountIds: rootIds,
    zoom: typeof zoom === 'number' ? zoom : 1
  };
}

function hubEnsureOrcaRemovedTimes(settings) {
  if (!settings) return {};
  if (!settings.removedOrcaOrgAccountIdTimes || typeof settings.removedOrcaOrgAccountIdTimes !== 'object') {
    settings.removedOrcaOrgAccountIdTimes = {};
  }
  return settings.removedOrcaOrgAccountIdTimes;
}

function hubRecordRemovedOrcaOrgAccountIds(settings, ids) {
  if (!settings || !ids || !ids.length) return;
  settings.removedOrcaOrgAccountIds = hubUnionStringIds(settings.removedOrcaOrgAccountIds, ids);
  let times = hubEnsureOrcaRemovedTimes(settings);
  let now = Date.now();
  ids.forEach(function (id) {
    if (!id) return;
    times[id] = now;
  });
}

function hubClearRemovedOrcaOrgAccountIds(settings, ids) {
  if (!settings || !ids || !ids.length) return;
  let drop = {};
  ids.forEach(function (id) { if (id) drop[id] = true; });
  if (Array.isArray(settings.removedOrcaOrgAccountIds)) {
    settings.removedOrcaOrgAccountIds = settings.removedOrcaOrgAccountIds.filter(function (id) {
      return !drop[id];
    });
  }
  let times = hubEnsureOrcaRemovedTimes(settings);
  ids.forEach(function (id) {
    if (id && Object.prototype.hasOwnProperty.call(times, id)) delete times[id];
  });
}

/**
 * ORCA tombstones are timestamp-aware so stale LocalStorage deletions cannot
 * wipe a cloud restore / cloud-live account. RAM/ENI keep plain union.
 *
 * Rule: if cloud has a live orcaInputAccount and does NOT tombstone it,
 * a local-only tombstone wins only when its recorded time is newer than
 * cloud.updatedAt (genuine delete after cloud write). Missing times (=0)
 * are treated as stale and lose to cloud-live.
 */
function hubMergeOrcaRemovedIds(localSettings, cloudSettings, localUpdatedAt, cloudUpdatedAt) {
  let local = localSettings || {};
  let cloud = cloudSettings || {};
  let localRem = Array.isArray(local.removedOrcaOrgAccountIds) ? local.removedOrcaOrgAccountIds : [];
  let cloudRem = Array.isArray(cloud.removedOrcaOrgAccountIds) ? cloud.removedOrcaOrgAccountIds : [];
  let localTimes = local.removedOrcaOrgAccountIdTimes && typeof local.removedOrcaOrgAccountIdTimes === 'object'
    ? local.removedOrcaOrgAccountIdTimes
    : {};
  let cloudTimes = cloud.removedOrcaOrgAccountIdTimes && typeof cloud.removedOrcaOrgAccountIdTimes === 'object'
    ? cloud.removedOrcaOrgAccountIdTimes
    : {};
  let cloudRemSet = {};
  cloudRem.forEach(function (id) { if (id) cloudRemSet[id] = true; });
  let localRemSet = {};
  localRem.forEach(function (id) { if (id) localRemSet[id] = true; });
  let cloudLive = {};
  (Array.isArray(cloud.orcaInputAccounts) ? cloud.orcaInputAccounts : []).forEach(function (acc) {
    if (acc && acc.id && !cloudRemSet[acc.id]) cloudLive[acc.id] = true;
  });

  let outIds = [];
  let outTimes = {};
  hubUnionStringIds(cloudRem, localRem).forEach(function (id) {
    if (!id) return;
    let liveOnCloud = !!cloudLive[id];
    if (liveOnCloud) {
      let localT = Number(localTimes[id]) || 0;
      if (localRemSet[id] && localT > (cloudUpdatedAt || 0)) {
        outIds.push(id);
        outTimes[id] = localT;
      }
      return;
    }
    outIds.push(id);
    outTimes[id] = Math.max(Number(localTimes[id]) || 0, Number(cloudTimes[id]) || 0);
  });
  return { ids: outIds, times: outTimes };
}

function hubFilterOrgChartByRemovedIds(chart, removedIds) {
  let base = chart && typeof chart === 'object' ? chart : {};
  let removed = {};
  (removedIds || []).forEach(function (id) { removed[id] = true; });
  if (!Object.keys(removed).length) return base;
  let members = Array.isArray(base.members) ? base.members.filter(function (m) {
    return m && m.id && !removed[m.id];
  }) : [];
  let rootAccountIds = Array.isArray(base.rootAccountIds)
    ? base.rootAccountIds.filter(function (id) { return id && !removed[id]; })
    : [];
  let rootId = base.rootId && !removed[base.rootId] ? base.rootId : (rootAccountIds[0] || '');
  return Object.assign({}, base, {
    members: members,
    currentData: JSON.parse(JSON.stringify(members)),
    rootAccountIds: rootAccountIds,
    rootId: rootId
  });
}

function hubMergeOrcaInputAccounts(cloudAccounts, localAccounts, removedIds, preferLocal) {
  let merged = hubMergeArrayEntriesById(cloudAccounts || [], localAccounts || [], preferLocal);
  let removed = {};
  (removedIds || []).forEach(function (id) {
    if (id) removed[id] = true;
  });
  if (!Object.keys(removed).length) return merged;
  return merged.filter(function (acc) {
    return acc && acc.id && !removed[acc.id];
  });
}

function hubCollectRemovedAccountIds(settings) {
  return hubUnionStringIds(
    settings && settings.removedOrcaOrgAccountIds,
    settings && settings.removedRamOrgAccountIds,
    settings && settings.removedEniOrgAccountIds
  );
}

function hubFilterInputAccountsByRemoved(list, removedMap) {
  if (!Array.isArray(list) || !removedMap || !Object.keys(removedMap).length) return list || [];
  return list.filter(function (acc) {
    return acc && acc.id && !removedMap[acc.id];
  });
}

function hubStripRemovedAccountsFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  let removedIds = hubCollectRemovedAccountIds(settings);
  if (!removedIds.length) return settings;
  let removed = {};
  removedIds.forEach(function (id) { removed[id] = true; });

  settings.orcaInputAccounts = hubFilterInputAccountsByRemoved(settings.orcaInputAccounts, removed);
  settings.ramInputAccounts = hubFilterInputAccountsByRemoved(settings.ramInputAccounts, removed);
  settings.eniInputAccounts = hubFilterInputAccountsByRemoved(settings.eniInputAccounts, removed);
  settings.caryInputAccounts = hubFilterInputAccountsByRemoved(settings.caryInputAccounts, removed);

  if (settings.investmentHistory && typeof settings.investmentHistory === 'object') {
    Object.keys(settings.investmentHistory).forEach(function (id) {
      if (removed[id]) delete settings.investmentHistory[id];
    });
  }

  function stripRevenueEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    ['ramAccounts', 'orcaAccounts', 'eniAccounts', 'caryAccounts', 'accounts'].forEach(function (key) {
      if (!entry[key] || typeof entry[key] !== 'object') return;
      Object.keys(entry[key]).forEach(function (id) {
        if (removed[id]) delete entry[key][id];
      });
    });
    return entry;
  }

  if (settings.revenueLog && typeof settings.revenueLog === 'object') {
    Object.keys(settings.revenueLog).forEach(function (dateKey) {
      let entry = stripRevenueEntry(settings.revenueLog[dateKey]);
      if (typeof pdRecalculateRevenueEntry === 'function') {
        entry = pdRecalculateRevenueEntry(entry, dateKey);
      }
      let has =
        (entry.ramAccounts && Object.keys(entry.ramAccounts).length) ||
        (entry.orcaAccounts && Object.keys(entry.orcaAccounts).length) ||
        (entry.eniAccounts && Object.keys(entry.eniAccounts).length) ||
        (entry.caryAccounts && Object.keys(entry.caryAccounts).length) ||
        (entry.accounts && Object.keys(entry.accounts).length);
      if (!has) delete settings.revenueLog[dateKey];
      else settings.revenueLog[dateKey] = entry;
    });
  }

  if (settings.salesLog && typeof settings.salesLog === 'object') {
    Object.keys(settings.salesLog).forEach(function (dateKey) {
      let entry = settings.salesLog[dateKey];
      if (!entry || !entry.accounts) return;
      Object.keys(entry.accounts).forEach(function (id) {
        if (removed[id]) delete entry.accounts[id];
      });
      if (typeof pdRecalculateSalesEntry === 'function') {
        entry = pdRecalculateSalesEntry(entry);
      }
      if (!entry.accounts || !Object.keys(entry.accounts).length) delete settings.salesLog[dateKey];
      else settings.salesLog[dateKey] = entry;
    });
  }

  if (settings.portfolioOperating && Array.isArray(settings.portfolioOperating.entries)) {
    settings.portfolioOperating.entries = settings.portfolioOperating.entries.filter(function (e) {
      return !(e && e.accountId && removed[e.accountId]);
    });
  }
  if (settings.portfolioProfit && Array.isArray(settings.portfolioProfit.entries)) {
    settings.portfolioProfit.entries = settings.portfolioProfit.entries.filter(function (e) {
      return !(e && e.accountId && removed[e.accountId]);
    });
  }

  if (settings.manageDisplayAccounts && typeof settings.manageDisplayAccounts === 'object') {
    Object.keys(settings.manageDisplayAccounts).forEach(function (pk) {
      let bucket = settings.manageDisplayAccounts[pk];
      if (!bucket) return;
      if (Array.isArray(bucket.orgAdded)) {
        bucket.orgAdded = bucket.orgAdded.filter(function (id) { return !removed[id]; });
      }
      if (Array.isArray(bucket.removed)) {
        bucket.removed = bucket.removed.filter(function (id) { return !removed[id]; });
      }
      if (bucket.labels && typeof bucket.labels === 'object') {
        Object.keys(bucket.labels).forEach(function (id) {
          if (removed[id]) delete bucket.labels[id];
        });
      }
    });
  }

  if (settings.performanceInputHiddenAccounts && typeof settings.performanceInputHiddenAccounts === 'object') {
    Object.keys(settings.performanceInputHiddenAccounts).forEach(function (pk) {
      if (!Array.isArray(settings.performanceInputHiddenAccounts[pk])) return;
      settings.performanceInputHiddenAccounts[pk] =
        settings.performanceInputHiddenAccounts[pk].filter(function (id) { return !removed[id]; });
    });
  }

  return settings;
}

function hubCreateEmptyEniOrgChart() {
  return {
    members: [],
    currentData: [],
    scenarios: [],
    rootId: '',
    rootAccountIds: [],
    zoom: 1
  };
}

function hubCreateEmptyOrcaOrgChart() {
  return {
    members: [],
    currentData: [],
    scenarios: [],
    rootId: '',
    rootAccountIds: [],
    zoom: 1
  };
}

function hubCreateEmptyData() {
  return {
    members: [],
    currentData: [],
    settings: hubCreateDefaultSettings(),
    scenarios: [],
    rootId: '',
    rootAccountIds: [],
    orcaOrgChart: hubCreateEmptyOrcaOrgChart(),
    eniOrgChart: hubCreateEmptyEniOrgChart(),
    updatedAt: 0
  };
}

/* 開発用サンプル（自動読み込み禁止・ボタンからのみ） */
var HUB_DEV_ORG_SEED = {
  rootId: 'm1',
  rootAccountIds: ['m1'],
  currentData: [
    { id: 'm1', parent: null, name: '甲斐', username: 'kai', rank: 3, investment: 1200, manualVolume: 5705100, open: true },
    { id: 'm2', parent: 'm1', name: '京谷さん', username: 'kyotani', rank: 4, investment: 2400, manualVolume: 5421700, open: false },
    { id: 'm5', parent: 'm1', name: '肥田さん', username: 'hida', rank: 1, investment: 300, manualVolume: 278900, open: true },
    { id: 'm6', parent: 'm5', name: '大仁さん', username: 'ooni', rank: 2, investment: 600, manualVolume: 275400, open: true },
    { id: 'm7', parent: 'm6', name: '大仁2さん', username: 'ooni2', rank: 1, investment: 300, manualVolume: 231800, open: true },
    { id: 'm8', parent: 'm7', name: '武田さん', username: 'takeda', rank: 2, investment: 600, manualVolume: 224300, open: false },
    { id: 'm9', parent: 'm8', name: '虎白さん', username: 'kohaku', rank: 2, investment: 600, manualVolume: 131100, open: false },
    { id: 'm10', parent: 'm5', name: '肥田2さん', username: 'hida2', rank: 0, investment: 1000, manualVolume: 1900, open: false },
    { id: 'm11', parent: 'm1', name: '甲斐3さん', username: 'kai3', rank: 0, investment: 300, manualVolume: 0, open: false }
  ],
  members: [],
  settings: hubCreateDefaultSettings(),
  scenarios: []
};

HUB_DEV_ORG_SEED.members = JSON.parse(JSON.stringify(HUB_DEV_ORG_SEED.currentData));

function hubSetActiveUid(uid) {
  hubActiveUid = uid || '';
}

function hubStorageKeyForUid(uid) {
  return uid ? HUB_STORAGE_KEY + ':' + uid : HUB_STORAGE_KEY;
}

function hubBindStorageToUid(uid) {
  if (typeof localStorage === 'undefined') {
    hubSetActiveUid(uid);
    return hubLoadFromStorage();
  }
  let prevUid = localStorage.getItem(HUB_UID_KEY) || '';
  if (prevUid && uid && prevUid !== uid) {
    hubApplyData(hubCreateEmptyData());
  }
  if (uid) localStorage.setItem(HUB_UID_KEY, uid);
  hubSetActiveUid(uid);
  let result = hubLoadFromStorage();
  hubApplyData(result.data);
  return result;
}

function hubClearStorageForLogout() {
  // UID別データは削除しない（再ログイン・ユーザー切替で復元するため）。
  // メモリ上のデータと「現在UID」だけ切る。共有キーは他ユーザー汚染防止で除去。
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HUB_STORAGE_KEY);
      localStorage.removeItem(HUB_STORAGE_LEGACY_KEY);
      localStorage.removeItem(HUB_UID_KEY);
    }
  } catch (e) {}
  hubSetActiveUid('');
  hubLocalUpdatedAt = 0;
  hubApplyData(hubCreateEmptyData());
}

function hubResolveStorageKey() {
  if (hubActiveUid) return hubStorageKeyForUid(hubActiveUid);
  return HUB_STORAGE_KEY;
}

function hubRamOrgChartHasMembers(chart) {
  return !!(chart && Array.isArray(chart.members) && chart.members.length > 0);
}

function hubRamOrgChartScore(chart) {
  let members = chart && Array.isArray(chart.members) ? chart.members : [];
  let withParent = members.filter(function (m) { return m && m.parent; }).length;
  let totalInv = members.reduce(function (s, m) { return s + (Number(m && m.investment) || 0); }, 0);
  return {
    members: members.length,
    withParent: withParent,
    roots: members.filter(function (m) { return m && !m.parent; }).length,
    totalInv: totalInv
  };
}

function hubPickRicherRamOrgChart(a, b) {
  let left = a && typeof a === 'object' ? a : hubPackRamOrgFromData(hubCreateEmptyData());
  let right = b && typeof b === 'object' ? b : hubPackRamOrgFromData(hubCreateEmptyData());
  let sa = hubRamOrgChartScore(left);
  let sb = hubRamOrgChartScore(right);
  if (sb.withParent !== sa.withParent) return sb.withParent > sa.withParent ? right : left;
  if (sb.members !== sa.members) return sb.members > sa.members ? right : left;
  if (sb.totalInv !== sa.totalInv) return sb.totalInv > sa.totalInv ? right : left;
  return hubRamOrgChartHasMembers(right) ? right : left;
}

function hubPackRamOrgFromData(data) {
  data = data || {};
  return {
    members: Array.isArray(data.members) ? data.members : [],
    currentData: Array.isArray(data.currentData) ? data.currentData : [],
    scenarios: Array.isArray(data.scenarios) ? data.scenarios : [],
    rootId: typeof data.rootId === 'string' ? data.rootId : '',
    rootAccountIds: Array.isArray(data.rootAccountIds) ? data.rootAccountIds : []
  };
}

function hubPackRamOrgChart() {
  return hubPackRamOrgFromData({
    members: typeof members !== 'undefined' ? members : [],
    currentData: typeof currentData !== 'undefined' ? currentData : [],
    scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
    rootId: typeof rootId !== 'undefined' ? rootId : '',
    rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : []
  });
}

function hubMergeRamOrgCharts(incoming, preserved, settings, preferLocal) {
  let removedIds = hubGetRemovedRamOrgAccountIds(settings);
  let inc = hubFilterOrgChartByRemovedIds(hubPackRamOrgFromData(incoming || {}), removedIds);
  let pre = hubFilterOrgChartByRemovedIds(hubPackRamOrgFromData(preserved || {}), removedIds);
  let emptyRam = function () {
    return hubPackRamOrgFromData(hubCreateEmptyData());
  };
  // 件数比較で片側を捨てると、追加直後のクラウド enrich で新規ノードが消える
  return hubFilterOrgChartByRemovedIds(
    hubUnionOrgCharts(inc, pre, preferLocal, emptyRam),
    removedIds
  );
}

function hubEniOrgChartScore(chart) {
  let members = chart && Array.isArray(chart.members) ? chart.members : [];
  let withParent = members.filter(function (m) { return m && m.parent; }).length;
  return {
    members: members.length,
    withParent: withParent
  };
}

function hubPickRicherEniOrgChart(a, b) {
  // 互換: より「リッチ」な側を優先しつつ、欠けている ID はユニオンで残す
  let left = a && typeof a === 'object' ? a : hubCreateEmptyEniOrgChart();
  let right = b && typeof b === 'object' ? b : hubCreateEmptyEniOrgChart();
  let sa = hubEniOrgChartScore(left);
  let sb = hubEniOrgChartScore(right);
  let preferRight = false;
  if (sb.withParent !== sa.withParent) preferRight = sb.withParent > sa.withParent;
  else if (sb.members !== sa.members) preferRight = sb.members > sa.members;
  else preferRight = hubEniOrgChartHasMembers(right);
  return hubUnionOrgCharts(left, right, preferRight, hubCreateEmptyEniOrgChart);
}

function hubMergeArrayEntriesById(cloudEntries, localEntries, preferLocal) {
  let map = {};
  (cloudEntries || []).forEach(function (entry) {
    if (entry && entry.id != null) map[entry.id] = entry;
  });
  (localEntries || []).forEach(function (entry) {
    if (!entry || entry.id == null) return;
    if (!map[entry.id]) {
      map[entry.id] = entry;
      return;
    }
    map[entry.id] = preferLocal ? entry : map[entry.id];
  });
  return Object.keys(map).map(function (id) { return map[id]; });
}

function hubMergeKeyedObjects(cloudObj, localObj, preferLocal) {
  let out = Object.assign({}, cloudObj || {});
  Object.keys(localObj || {}).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = localObj[key];
      return;
    }
    if (preferLocal) out[key] = localObj[key];
  });
  return out;
}

function hubMergeAccountMapById(cloudMap, localMap, preferLocal, removedSet) {
  let out = {};
  let ids = {};
  Object.keys(cloudMap || {}).forEach(function (id) { ids[id] = true; });
  Object.keys(localMap || {}).forEach(function (id) { ids[id] = true; });
  Object.keys(ids).forEach(function (id) {
    if (removedSet && removedSet[id]) return;
    let c = cloudMap && cloudMap[id];
    let l = localMap && localMap[id];
    if (c && l) out[id] = preferLocal ? l : c;
    else if (c) out[id] = c;
    else if (l) out[id] = l;
  });
  return out;
}

function hubRemovedIdSet(ids) {
  let out = {};
  (ids || []).forEach(function (id) { if (id) out[id] = true; });
  return out;
}

/** Keep ORCA revenue slices from cloud even when preferLocal replaced the day entry. */
function hubMergeOrcaRevenueLogs(cloudLog, localLog, preferLocal, removedIds) {
  let cloudObj = cloudLog && typeof cloudLog === 'object' ? cloudLog : {};
  let localObj = localLog && typeof localLog === 'object' ? localLog : {};
  let removed = hubRemovedIdSet(removedIds);
  let dates = {};
  Object.keys(cloudObj).forEach(function (dk) { dates[dk] = true; });
  Object.keys(localObj).forEach(function (dk) { dates[dk] = true; });
  let out = {};
  Object.keys(dates).forEach(function (dk) {
    let c = cloudObj[dk];
    let l = localObj[dk];
    let base;
    if (c && l) base = preferLocal ? Object.assign({}, c, l) : Object.assign({}, l, c);
    else base = Object.assign({}, c || l || {});

    base.orcaAccounts = hubMergeAccountMapById(
      c && c.orcaAccounts,
      l && l.orcaAccounts,
      preferLocal,
      removed
    );

    // Keep non-ORCA account rows on the preferLocal side; only backfill ORCA rows from cloud.
    let preferredAccounts = preferLocal
      ? Object.assign({}, (l && l.accounts) || {})
      : Object.assign({}, (c && c.accounts) || {});
    if (!preferLocal) {
      Object.keys((l && l.accounts) || {}).forEach(function (id) {
        if (!preferredAccounts[id]) preferredAccounts[id] = l.accounts[id];
      });
    } else {
      Object.keys((c && c.accounts) || {}).forEach(function (id) {
        let ae = c.accounts[id];
        if (!ae || ae.projectKey !== 'orca' || removed[id]) return;
        if (!preferredAccounts[id]) preferredAccounts[id] = ae;
      });
    }
    Object.keys(preferredAccounts).forEach(function (id) {
      if (removed[id]) delete preferredAccounts[id];
    });
    if (Object.keys(preferredAccounts).length || (c && c.accounts) || (l && l.accounts)) {
      base.accounts = preferredAccounts;
    }

    if (typeof pdRecalculateRevenueEntry === 'function') {
      base = pdRecalculateRevenueEntry(base, dk);
    } else if (base.orcaAccounts && Object.keys(base.orcaAccounts).length) {
      let sum = 0;
      Object.keys(base.orcaAccounts).forEach(function (id) {
        let ae = base.orcaAccounts[id] || {};
        if (ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null) {
          sum += Number(ae.yesterdayAiProfit || 0) + Number(ae.todayAffiliateProfit || 0);
        } else if (ae.todayRevenue != null) {
          sum += Number(ae.todayRevenue || 0);
        } else if (ae.revenueUsd != null) {
          sum += Number(ae.revenueUsd || 0);
        }
      });
      base.orca = Math.round(sum * 10000) / 10000;
    }
    out[dk] = base;
  });
  return out;
}

function hubMergeOrcaSalesLogs(cloudLog, localLog, preferLocal, removedIds) {
  let cloudObj = cloudLog && typeof cloudLog === 'object' ? cloudLog : {};
  let localObj = localLog && typeof localLog === 'object' ? localLog : {};
  let removed = hubRemovedIdSet(removedIds);
  let dates = {};
  Object.keys(cloudObj).forEach(function (dk) { dates[dk] = true; });
  Object.keys(localObj).forEach(function (dk) { dates[dk] = true; });
  let out = {};
  Object.keys(dates).forEach(function (dk) {
    let c = cloudObj[dk];
    let l = localObj[dk];
    let base;
    if (c && l) base = preferLocal ? Object.assign({}, c, l) : Object.assign({}, l, c);
    else base = Object.assign({}, c || l || {});

    let preferredAccounts = preferLocal
      ? Object.assign({}, (l && l.accounts) || {})
      : Object.assign({}, (c && c.accounts) || {});
    if (!preferLocal) {
      Object.keys((l && l.accounts) || {}).forEach(function (id) {
        if (!preferredAccounts[id]) preferredAccounts[id] = l.accounts[id];
      });
    } else {
      Object.keys((c && c.accounts) || {}).forEach(function (id) {
        let ae = c.accounts[id];
        if (!ae || ae.projectKey !== 'orca' || removed[id]) return;
        if (!preferredAccounts[id]) preferredAccounts[id] = ae;
      });
    }
    // ORCA rows present on both sides: preferLocal chooses
    Object.keys((c && c.accounts) || {}).forEach(function (id) {
      let ce = c.accounts[id];
      let le = l && l.accounts && l.accounts[id];
      if (!ce || ce.projectKey !== 'orca' || removed[id]) return;
      if (ce && le) preferredAccounts[id] = preferLocal ? le : ce;
    });
    Object.keys(preferredAccounts).forEach(function (id) {
      if (removed[id]) delete preferredAccounts[id];
    });
    base.accounts = preferredAccounts;

    if (typeof pdRecalculateSalesEntry === 'function') {
      base = pdRecalculateSalesEntry(base);
    }
    out[dk] = base;
  });
  return out;
}

function hubMergeOrcaInvestmentHistory(cloudInv, localInv, preferLocal, removedIds) {
  let cloudObj = cloudInv && typeof cloudInv === 'object' ? cloudInv : {};
  let localObj = localInv && typeof localInv === 'object' ? localInv : {};
  let removed = hubRemovedIdSet(removedIds);
  let out = hubMergeKeyedObjects(cloudObj, localObj, preferLocal);
  Object.keys(cloudObj).forEach(function (id) {
    if (removed[id]) return;
    let entry = cloudObj[id];
    let isOrca = entry && (entry.projectKey === 'orca' || String(id).indexOf('orca_') === 0);
    if (!isOrca) return;
    if (!out[id]) out[id] = entry;
  });
  Object.keys(out).forEach(function (id) {
    if (removed[id]) delete out[id];
  });
  return out;
}

function hubMergePortfolioGoal(cloudGoal, localGoal, preferLocal) {
  let c = cloudGoal && typeof cloudGoal === 'object' ? cloudGoal : {};
  let l = localGoal && typeof localGoal === 'object' ? localGoal : {};
  let merged = Object.assign({}, c, l);
  if (c.rates || l.rates) merged.rates = Object.assign({}, c.rates || {}, l.rates || {});
  if (preferLocal) {
    if (l.savedAt) merged.savedAt = l.savedAt;
    if (typeof l.amountYen === 'number') merged.amountYen = l.amountYen;
  } else {
    if (c.savedAt) merged.savedAt = c.savedAt;
    if (typeof c.amountYen === 'number') merged.amountYen = c.amountYen;
  }
  return merged;
}

function hubMergePortfolioOperating(cloudVal, localVal, preferLocal) {
  let c = cloudVal && typeof cloudVal === 'object' ? cloudVal : { displayMode: 'project', entries: [] };
  let l = localVal && typeof localVal === 'object' ? localVal : { displayMode: 'project', entries: [] };
  return {
    displayMode: preferLocal ? (l.displayMode || c.displayMode || 'project') : (c.displayMode || l.displayMode || 'project'),
    entries: hubMergeArrayEntriesById(c.entries, l.entries, preferLocal)
  };
}

function hubMergePortfolioProfit(cloudVal, localVal, preferLocal) {
  let c = cloudVal && typeof cloudVal === 'object' ? cloudVal : { entries: [] };
  let l = localVal && typeof localVal === 'object' ? localVal : { entries: [] };
  return {
    entries: hubMergeArrayEntriesById(c.entries, l.entries, preferLocal)
  };
}

function hubMergeHubSettings(localSettings, cloudSettings, localUpdatedAt, cloudUpdatedAt) {
  let local = Object.assign(hubCreateDefaultSettings(), localSettings || {});
  let cloud = Object.assign(hubCreateDefaultSettings(), cloudSettings || {});
  let preferLocal = (localUpdatedAt || 0) >= (cloudUpdatedAt || 0);
  let merged = Object.assign({}, cloud, local);
  merged.portfolioGoal = hubMergePortfolioGoal(cloud.portfolioGoal, local.portfolioGoal, preferLocal);
  merged.portfolioOperating = hubMergePortfolioOperating(cloud.portfolioOperating, local.portfolioOperating, preferLocal);
  merged.portfolioProfit = hubMergePortfolioProfit(cloud.portfolioProfit, local.portfolioProfit, preferLocal);
  let orcaRemoved = hubMergeOrcaRemovedIds(local, cloud, localUpdatedAt, cloudUpdatedAt);
  merged.removedOrcaOrgAccountIds = orcaRemoved.ids;
  merged.removedOrcaOrgAccountIdTimes = orcaRemoved.times;
  merged.revenueLog = hubMergeOrcaRevenueLogs(
    cloud.revenueLog,
    local.revenueLog,
    preferLocal,
    merged.removedOrcaOrgAccountIds
  );
  merged.salesLog = hubMergeOrcaSalesLogs(
    cloud.salesLog,
    local.salesLog,
    preferLocal,
    merged.removedOrcaOrgAccountIds
  );
  merged.investmentHistory = hubMergeOrcaInvestmentHistory(
    cloud.investmentHistory,
    local.investmentHistory,
    preferLocal,
    merged.removedOrcaOrgAccountIds
  );
  merged.manageDisplayAccounts = hubMergeKeyedObjects(cloud.manageDisplayAccounts, local.manageDisplayAccounts, preferLocal);
  merged.performanceInputHiddenAccounts = hubMergeKeyedObjects(
    cloud.performanceInputHiddenAccounts,
    local.performanceInputHiddenAccounts,
    preferLocal
  );
  if (cloud.projectMaster || local.projectMaster) {
    merged.projectMaster = preferLocal
      ? Object.assign({}, cloud.projectMaster || {}, local.projectMaster || {})
      : Object.assign({}, local.projectMaster || {}, cloud.projectMaster || {});
  }
  merged.removedRamOrgAccountIds = hubUnionStringIds(
    cloud.removedRamOrgAccountIds,
    local.removedRamOrgAccountIds
  );
  merged.removedEniOrgAccountIds = hubUnionStringIds(
    cloud.removedEniOrgAccountIds,
    local.removedEniOrgAccountIds
  );
  merged.orcaInputAccounts = hubMergeOrcaInputAccounts(
    cloud.orcaInputAccounts,
    local.orcaInputAccounts,
    merged.removedOrcaOrgAccountIds,
    preferLocal
  );
  let removedRamMap = {};
  merged.removedRamOrgAccountIds.forEach(function (id) { removedRamMap[id] = true; });
  let removedEniMap = {};
  merged.removedEniOrgAccountIds.forEach(function (id) { removedEniMap[id] = true; });
  merged.ramInputAccounts = hubFilterInputAccountsByRemoved(
    hubMergeArrayEntriesById(cloud.ramInputAccounts, local.ramInputAccounts, preferLocal),
    removedRamMap
  );
  merged.eniInputAccounts = hubFilterInputAccountsByRemoved(
    hubMergeArrayEntriesById(cloud.eniInputAccounts, local.eniInputAccounts, preferLocal),
    removedEniMap
  );
  merged.caryInputAccounts = hubMergeArrayEntriesById(cloud.caryInputAccounts, local.caryInputAccounts, preferLocal);
  return hubStripRemovedAccountsFromSettings(merged);
}

function hubMergeHubDocuments(localData, cloudData) {
  let local = hubNormalizeLoadedData(localData || hubCreateEmptyData());
  let cloud = hubNormalizeLoadedData(cloudData || hubCreateEmptyData());
  let preferLocal = (local.updatedAt || 0) >= (cloud.updatedAt || 0);
  let mergedSettings = hubMergeHubSettings(local.settings, cloud.settings, local.updatedAt, cloud.updatedAt);
  let mergedRam = hubMergeRamOrgCharts(
    hubPackRamOrgFromData(cloud),
    hubPackRamOrgFromData(local),
    mergedSettings,
    preferLocal
  );
  let mergedOrca = hubMergeOrcaOrgCharts(
    cloud.orcaOrgChart,
    local.orcaOrgChart,
    mergedSettings,
    preferLocal
  );
  let mergedEni = hubMergeEniOrgCharts(
    cloud.eniOrgChart,
    local.eniOrgChart,
    preferLocal,
    mergedSettings
  );
  return {
    members: mergedRam.members,
    currentData: mergedRam.currentData,
    scenarios: mergedRam.scenarios,
    rootId: mergedRam.rootId,
    rootAccountIds: mergedRam.rootAccountIds,
    settings: mergedSettings,
    orcaOrgChart: mergedOrca,
    eniOrgChart: mergedEni,
    updatedAt: Math.max(local.updatedAt || 0, cloud.updatedAt || 0)
  };
}

function hubOrcaOrgChartHasMembers(chart) {
  return !!(chart && Array.isArray(chart.members) && chart.members.length > 0);
}

function hubOrcaOrgChartScore(chart) {
  let members = chart && Array.isArray(chart.members) ? chart.members : [];
  let withParent = members.filter(function (m) { return m && m.parent; }).length;
  return {
    members: members.length,
    withParent: withParent,
    roots: members.filter(function (m) { return m && !m.parent; }).length
  };
}

function hubOrcaOrgChartIsShallow(chart, settings) {
  if (!hubOrcaOrgChartHasMembers(chart)) return true;
  let score = hubOrcaOrgChartScore(chart);
  if (score.withParent > 0) return false;
  let inputCount = settings && Array.isArray(settings.orcaInputAccounts) ? settings.orcaInputAccounts.length : 0;
  if (!inputCount) return score.members <= 2;
  return score.members <= inputCount && score.roots <= inputCount;
}

function hubPickRicherOrcaOrgChart(a, b) {
  let left = a && typeof a === 'object' ? a : hubCreateEmptyOrcaOrgChart();
  let right = b && typeof b === 'object' ? b : hubCreateEmptyOrcaOrgChart();
  let sa = hubOrcaOrgChartScore(left);
  let sb = hubOrcaOrgChartScore(right);
  if (sb.withParent !== sa.withParent) return sb.withParent > sa.withParent ? right : left;
  if (sb.members !== sa.members) return sb.members > sa.members ? right : left;
  return hubOrcaOrgChartHasMembers(right) ? right : left;
}

function hubCreateOrcaMemberFromInputAccount(acc) {
  let username = String(acc.username || acc.name || '未入力').replace(/^@/, '');
  let name = acc.name || username || '未入力';
  return {
    id: acc.id,
    parent: null,
    name: name,
    username: username,
    rank: Number(acc.rank) || 0,
    investment: Number(acc.investment) || 0,
    aiAgent: acc.aiAgent || '不明',
    personalSales: Number(acc.personalSales) || 0,
    groupSales: Number(acc.groupSales) || 0,
    open: true,
    bvMode: 'MANUAL',
    bvPrompted: false
  };
}

function hubEnsureOrcaRootsOnChart(chart, settings) {
  let base = hubCreateEmptyOrcaOrgChart();
  let merged = Object.assign(base, chart && typeof chart === 'object' ? chart : {});
  let members = Array.isArray(merged.members) ? merged.members.map(function (m) {
    return JSON.parse(JSON.stringify(m));
  }) : [];
  let byId = {};
  members.forEach(function (m) {
    if (m && m.id) byId[m.id] = m;
  });
  let rootAccountIds = Array.isArray(merged.rootAccountIds) ? merged.rootAccountIds.slice() : [];
  (settings && settings.orcaInputAccounts ? settings.orcaInputAccounts : []).forEach(function (acc) {
    if (!acc || !acc.id) return;
    if (hubGetRemovedOrcaOrgAccountIds(settings).indexOf(acc.id) >= 0) return;
    if (!byId[acc.id]) return;
    let m = byId[acc.id];
      m.username = String(acc.username || acc.name || m.username || '未入力').replace(/^@/, '');
      m.name = acc.name || m.name || m.username || '未入力';
      m.investment = Number(acc.investment) || Number(m.investment) || 0;
    if (acc.aiAgent) m.aiAgent = acc.aiAgent;
    if (rootAccountIds.indexOf(acc.id) < 0) rootAccountIds.push(acc.id);
  });
  rootAccountIds = rootAccountIds.filter(function (id) { return !!byId[id]; });
  if (!rootAccountIds.length) {
    rootAccountIds = members.filter(function (m) { return m && !m.parent; }).map(function (m) { return m.id; });
  }
  merged.members = members;
  merged.currentData = JSON.parse(JSON.stringify(members));
  merged.rootAccountIds = rootAccountIds;
  if (!merged.rootId || !byId[merged.rootId]) merged.rootId = rootAccountIds[0] || '';
  if (!Array.isArray(merged.scenarios)) merged.scenarios = [];
  if (typeof merged.zoom !== 'number') merged.zoom = 1;
  return merged;
}

function hubExtractRawEniOrgChart(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.eniOrgChart && typeof raw.eniOrgChart === 'object') return raw.eniOrgChart;
  if (raw.settings && raw.settings.eniOrgChart && typeof raw.settings.eniOrgChart === 'object') {
    return raw.settings.eniOrgChart;
  }
  if (Array.isArray(raw.eniMembers)) {
    return {
      members: raw.eniMembers,
      currentData: Array.isArray(raw.eniCurrentData) ? raw.eniCurrentData : raw.eniMembers,
      scenarios: Array.isArray(raw.eniScenarios) ? raw.eniScenarios : [],
      rootId: typeof raw.eniRootId === 'string' ? raw.eniRootId : '',
      rootAccountIds: Array.isArray(raw.eniRootAccountIds) ? raw.eniRootAccountIds : [],
      zoom: typeof raw.eniZoom === 'number' ? raw.eniZoom : 1
    };
  }
  return null;
}

function hubEniOrgChartHasMembers(chart) {
  return !!(chart && Array.isArray(chart.members) && chart.members.length);
}

function hubMergeEniOrgCharts(incoming, preserved, preferLocal, settings) {
  let removedIds = hubGetRemovedEniOrgAccountIds(settings);
  let inc = hubFilterOrgChartByRemovedIds(incoming, removedIds);
  let pre = hubFilterOrgChartByRemovedIds(preserved, removedIds);
  if (arguments.length >= 3 && typeof preferLocal === 'boolean') {
    return hubFilterOrgChartByRemovedIds(
      hubUnionOrgCharts(inc, pre, preferLocal, hubCreateEmptyEniOrgChart),
      removedIds
    );
  }
  return hubFilterOrgChartByRemovedIds(hubPickRicherEniOrgChart(inc, pre), removedIds);
}

function hubResolveEniOrgChart(rawChart, preservedChart) {
  return hubMergeEniOrgCharts(rawChart, preservedChart);
}

function hubExtractRawOrcaOrgChart(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.orcaOrgChart && typeof raw.orcaOrgChart === 'object') return raw.orcaOrgChart;
  if (raw.settings && raw.settings.orcaOrgChart && typeof raw.settings.orcaOrgChart === 'object') {
    return raw.settings.orcaOrgChart;
  }
  if (raw.projectData && raw.projectData.orca && raw.projectData.orca.orgChart) {
    return raw.projectData.orca.orgChart;
  }
  if (Array.isArray(raw.orcaMembers)) {
    return {
      members: raw.orcaMembers,
      currentData: Array.isArray(raw.orcaCurrentData) ? raw.orcaCurrentData : raw.orcaMembers,
      scenarios: Array.isArray(raw.orcaScenarios) ? raw.orcaScenarios : [],
      rootId: typeof raw.orcaRootId === 'string' ? raw.orcaRootId : '',
      rootAccountIds: Array.isArray(raw.orcaRootAccountIds) ? raw.orcaRootAccountIds : [],
      zoom: typeof raw.orcaZoom === 'number' ? raw.orcaZoom : 1
    };
  }
  return null;
}

function hubMergeOrcaOrgCharts(incoming, preserved, settings, preferLocal) {
  let removedIds = hubGetRemovedOrcaOrgAccountIds(settings);
  let inc = hubFilterOrgChartByRemovedIds(incoming, removedIds);
  let pre = hubFilterOrgChartByRemovedIds(preserved, removedIds);
  // 件数の少ない側を丸ごと採用すると、追加直後のクラウド enrich で新規ノードが消える
  let united = hubUnionOrgCharts(inc, pre, !!preferLocal, hubCreateEmptyOrcaOrgChart);
  return hubEnsureOrcaRootsOnChart(united, settings);
}

function hubRebuildOrcaOrgFromSettings(settings) {
  let base = hubCreateEmptyOrcaOrgChart();
  let accounts = settings && Array.isArray(settings.orcaInputAccounts) ? settings.orcaInputAccounts : [];
  if (!accounts.length) return base;
  let members = [];
  let rootAccountIds = [];
  accounts.forEach(function (acc) {
    if (!acc || !acc.id) return;
    let username = String(acc.username || acc.name || '未入力').replace(/^@/, '');
    let name = acc.name || username || '未入力';
    members.push({
      id: acc.id,
      parent: null,
      name: name,
      username: username,
      rank: Number(acc.rank) || 0,
      investment: Number(acc.investment) || 0,
      aiAgent: acc.aiAgent || '不明',
      personalSales: Number(acc.personalSales) || 0,
      groupSales: Number(acc.groupSales) || 0,
      open: true,
      bvMode: 'MANUAL',
      bvPrompted: false
    });
    rootAccountIds.push(acc.id);
  });
  if (!members.length) return base;
  let cloned = JSON.parse(JSON.stringify(members));
  return {
    members: members,
    currentData: cloned,
    scenarios: [],
    rootId: rootAccountIds[0] || '',
    rootAccountIds: rootAccountIds,
    zoom: 1
  };
}

function hubResolveOrcaOrgChart(rawChart, settings, preservedChart, preferLocal) {
  return hubMergeOrcaOrgCharts(rawChart, preservedChart, settings, preferLocal);
}

function hubNormalizeLoadedData(raw) {
  let base = hubCreateEmptyData();
  if (!raw || typeof raw !== 'object') return base;
  let settings = Object.assign(hubCreateDefaultSettings(), raw.settings || {});
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
  if (!settings.salesLog || typeof settings.salesLog !== 'object') settings.salesLog = {};
  if (!settings.manageDisplayAccounts || typeof settings.manageDisplayAccounts !== 'object') {
    settings.manageDisplayAccounts = {};
  }
  if (!settings.performanceInputHiddenAccounts || typeof settings.performanceInputHiddenAccounts !== 'object') {
    settings.performanceInputHiddenAccounts = {};
  }
  if (!Array.isArray(settings.orcaInputAccounts)) settings.orcaInputAccounts = [];
  if (!Array.isArray(settings.eniInputAccounts)) settings.eniInputAccounts = [];
  if (!Array.isArray(settings.ramInputAccounts)) settings.ramInputAccounts = [];
  if (!settings.removedOrcaOrgAccountIdTimes || typeof settings.removedOrcaOrgAccountIdTimes !== 'object') {
    settings.removedOrcaOrgAccountIdTimes = {};
  }
  if (typeof hubRepairOrcaInputAccounts === 'function') hubRepairOrcaInputAccounts(settings);
  let normalized = {
    members: Array.isArray(raw.members) ? raw.members : base.members,
    currentData: Array.isArray(raw.currentData) ? raw.currentData : base.currentData,
    settings: settings,
    scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : base.scenarios,
    rootId: typeof raw.rootId === 'string' ? raw.rootId : base.rootId,
    rootAccountIds: Array.isArray(raw.rootAccountIds) ? raw.rootAccountIds : base.rootAccountIds,
    orcaOrgChart: hubResolveOrcaOrgChart(hubExtractRawOrcaOrgChart(raw), settings),
    eniOrgChart: hubResolveEniOrgChart(hubExtractRawEniOrgChart(raw)),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
  };
  return normalized;
}

function hubPackLocalData() {
  return {
    members: typeof members !== 'undefined' ? members : [],
    currentData: typeof currentData !== 'undefined' ? currentData : [],
    settings: typeof settings !== 'undefined' ? settings : hubCreateDefaultSettings(),
    scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
    rootId: typeof rootId !== 'undefined' ? rootId : '',
    rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : [],
    orcaOrgChart: typeof orcaPackOrgChart === 'function' ? orcaPackOrgChart() : hubCreateEmptyOrcaOrgChart(),
    eniOrgChart: typeof eniPackOrgChart === 'function' ? eniPackOrgChart() : hubCreateEmptyEniOrgChart(),
    updatedAt: hubLocalUpdatedAt
  };
}

function hubPackFirestorePayload(updatedAt) {
  let local = hubPackLocalData();
  let settingsCopy = Object.assign({}, local.settings);
  let manageAccounts = settingsCopy.manageDisplayAccounts || {};
  let revenueLog = settingsCopy.revenueLog || {};
  let salesLog = settingsCopy.salesLog || {};
  delete settingsCopy.manageDisplayAccounts;
  delete settingsCopy.revenueLog;
  delete settingsCopy.salesLog;
  return {
    orgChart: {
      members: local.members,
      currentData: local.currentData,
      rootId: local.rootId,
      rootAccountIds: local.rootAccountIds,
      scenarios: local.scenarios
    },
    orcaOrgChart: local.orcaOrgChart || hubCreateEmptyOrcaOrgChart(),
    eniOrgChart: local.eniOrgChart || hubCreateEmptyEniOrgChart(),
    manageAccounts: manageAccounts,
    revenue: {
      revenueLog: revenueLog,
      salesLog: salesLog
    },
    settings: settingsCopy,
    schemaVersion: (typeof hubGetEmbeddedSchemaVersion === 'function'
      ? hubGetEmbeddedSchemaVersion()
      : (typeof HUB_SCHEMA_VERSION === 'number' ? Number(HUB_SCHEMA_VERSION) : 0)),
    updatedAt: typeof updatedAt === 'number' ? updatedAt : Date.now()
  };
}

function hubUnpackFirestorePayload(doc) {
  if (!doc || typeof doc !== 'object') return hubCreateEmptyData();
  let org = doc.orgChart || {};
  let mergedSettings = Object.assign(hubCreateDefaultSettings(), doc.settings || {});
  mergedSettings.manageDisplayAccounts = doc.manageAccounts || {};
  mergedSettings.revenueLog = (doc.revenue && doc.revenue.revenueLog) || {};
  mergedSettings.salesLog = (doc.revenue && doc.revenue.salesLog) || {};
  return hubNormalizeLoadedData({
    members: org.members,
    currentData: org.currentData,
    rootId: org.rootId,
    rootAccountIds: org.rootAccountIds,
    scenarios: org.scenarios,
    orcaOrgChart: doc.orcaOrgChart || hubCreateEmptyOrcaOrgChart(),
    eniOrgChart: doc.eniOrgChart || hubCreateEmptyEniOrgChart(),
    settings: mergedSettings,
    updatedAt: typeof doc.updatedAt === 'number' ? doc.updatedAt : 0
  });
}

function hubStableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(function (item) { return hubStableStringify(item); }).join(',') + ']';
  }
  return '{' + Object.keys(value).sort().map(function (key) {
    return JSON.stringify(key) + ':' + hubStableStringify(value[key]);
  }).join(',') + '}';
}

function hubComputeContentHash(data) {
  let payload = data || hubPackLocalData();
  let copy = JSON.parse(JSON.stringify(payload));
  delete copy.updatedAt;
  let str = hubStableStringify(copy);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function hubApplyData(data, opts) {
  opts = opts || {};
  let preferLocal = !!opts.preferLocal;
  let preservedRam = hubPackRamOrgChart();
  let preservedOrca = typeof orcaPackOrgChart === 'function' ? orcaPackOrgChart() : null;
  let preservedEni = typeof eniPackOrgChart === 'function' ? eniPackOrgChart() : null;
  let normalized = hubNormalizeLoadedData(data);
  if (!opts.skipMerge) {
    let mergedRam = hubMergeRamOrgCharts(
      hubPackRamOrgFromData(normalized),
      preservedRam,
      normalized.settings,
      preferLocal
    );
    normalized.members = mergedRam.members;
    normalized.currentData = mergedRam.currentData;
    normalized.scenarios = mergedRam.scenarios;
    normalized.rootId = mergedRam.rootId;
    normalized.rootAccountIds = mergedRam.rootAccountIds;
    normalized.orcaOrgChart = hubMergeOrcaOrgCharts(
      hubExtractRawOrcaOrgChart(data) || normalized.orcaOrgChart,
      preservedOrca,
      normalized.settings,
      preferLocal
    );
    normalized.eniOrgChart = hubMergeEniOrgCharts(
      hubExtractRawEniOrgChart(data) || normalized.eniOrgChart,
      preservedEni
    );
  }
  if (typeof clone === 'function') {
    members = clone(normalized.members);
    currentData = clone(normalized.currentData);
    settings = Object.assign(hubCreateDefaultSettings(), clone(normalized.settings));
    scenarios = clone(normalized.scenarios);
    rootAccountIds = clone(normalized.rootAccountIds);
  } else {
    members = JSON.parse(JSON.stringify(normalized.members));
    currentData = JSON.parse(JSON.stringify(normalized.currentData));
    settings = Object.assign(hubCreateDefaultSettings(), JSON.parse(JSON.stringify(normalized.settings)));
    scenarios = JSON.parse(JSON.stringify(normalized.scenarios));
    rootAccountIds = JSON.parse(JSON.stringify(normalized.rootAccountIds));
  }
  rootId = normalized.rootId || '';
  focusId = rootId || focusId || '';
  simMode = false;
  hubLocalUpdatedAt = normalized.updatedAt || 0;
  if (Array.isArray(members)) {
    members.forEach(function (m) {
      if (m && m.open == null) m.open = true;
    });
    if (typeof hubOrgRepairMassCollapsedOpens === 'function') {
      hubOrgRepairMassCollapsedOpens(members, 'ram-apply');
    }
  }
  if (Array.isArray(currentData)) {
    currentData.forEach(function (m) {
      if (m && m.open == null) m.open = true;
    });
    if (typeof hubOrgRepairMassCollapsedOpens === 'function') {
      hubOrgRepairMassCollapsedOpens(currentData, 'ram-current-apply');
    }
  }
  if (typeof orcaApplyOrgChart === 'function') orcaApplyOrgChart(normalized.orcaOrgChart);
  if (typeof eniApplyOrgChart === 'function') eniApplyOrgChart(normalized.eniOrgChart);
  if (typeof orcaSyncAllPersonalSales === 'function') orcaSyncAllPersonalSales();
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  if (typeof pfEnsurePerformanceInputHiddenAccounts === 'function') pfEnsurePerformanceInputHiddenAccounts();
  if (typeof pfMigrateDisplaySettingsCompat === 'function') pfMigrateDisplaySettingsCompat();
  if (typeof aimInitAccountInputManagement === 'function') aimInitAccountInputManagement();
  else if (typeof aimMigrateOrgMemberMeta === 'function') {
    ['ram', 'orca', 'eni'].forEach(function (pk) { aimMigrateOrgMemberMeta(pk); });
  }
}

function hubLoadFromStorage() {
  if (typeof localStorage === 'undefined') {
    return { data: hubCreateEmptyData(), isNew: true };
  }
  try {
    let key = hubResolveStorageKey();
    let raw = localStorage.getItem(key);
    // ログイン中UIDがある場合、共有キーへフォールバックしない（他ユーザー／端末汚染防止）
    // 管理者のみ：旧共有キーにデータが残っている場合は1回だけUIDキーへ移行
    if (!raw && hubActiveUid) {
      if (typeof hubIsAdminUid === 'function' && hubIsAdminUid(hubActiveUid)) {
        let shared = localStorage.getItem(HUB_STORAGE_KEY);
        if (shared) {
          try {
            localStorage.setItem(key, shared);
            raw = shared;
          } catch (migrateErr) {}
        }
      }
    }
    if (!raw) return { data: hubCreateEmptyData(), isNew: true };
    return { data: hubNormalizeLoadedData(JSON.parse(raw)), isNew: false };
  } catch (e) {
    return { data: hubCreateEmptyData(), isNew: true };
  }
}

function hubIsEffectivelyEmptyHubData(data) {
  if (!data || typeof data !== 'object') return true;
  let members = Array.isArray(data.members) ? data.members : [];
  let orca = data.orcaOrgChart && Array.isArray(data.orcaOrgChart.members) ? data.orcaOrgChart.members : [];
  let eni = data.eniOrgChart && Array.isArray(data.eniOrgChart.members) ? data.eniOrgChart.members : [];
  let settingsObj = data.settings || {};
  let ramIn = Array.isArray(settingsObj.ramInputAccounts) ? settingsObj.ramInputAccounts : [];
  let orcaIn = Array.isArray(settingsObj.orcaInputAccounts) ? settingsObj.orcaInputAccounts : [];
  let eniIn = Array.isArray(settingsObj.eniInputAccounts) ? settingsObj.eniInputAccounts : [];
  let rev = settingsObj.revenueLog && typeof settingsObj.revenueLog === 'object'
    ? Object.keys(settingsObj.revenueLog).length : 0;
  let sales = settingsObj.salesLog && typeof settingsObj.salesLog === 'object'
    ? Object.keys(settingsObj.salesLog).length : 0;
  let pm = settingsObj.projectMaster && settingsObj.projectMaster.projects
    ? settingsObj.projectMaster.projects : {};
  let registered = Object.keys(pm).filter(function (k) { return pm[k] && pm[k].registered; }).length;
  return !members.length && !orca.length && !eni.length &&
    !ramIn.length && !orcaIn.length && !eniIn.length &&
    !rev && !sales && !registered;
}

function hubSaveToStorage(options) {
  options = options || {};
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    let now = Date.now();
    hubLocalUpdatedAt = now;
    localStorage.setItem(hubResolveStorageKey(), JSON.stringify(Object.assign(hubPackLocalData(), { updatedAt: now })));
    let cloudWriteOk = !options.localOnly &&
      (typeof hubIsCloudWriteEnabled !== 'function' || hubIsCloudWriteEnabled());
    if (cloudWriteOk && typeof hubScheduleCloudSave === 'function') {
      hubScheduleCloudSave(options.immediate === true);
    }
  } catch (e) {}
}

function hubSaveNow() {
  hubSaveToStorage({ immediate: true });
}

function hubInitStorage() {
  let result = hubLoadFromStorage();
  hubApplyData(result.data);
  if (result.isNew) hubSaveToStorage({ localOnly: true });
  return result.isNew;
}

function hubLoadDevOrgSeed() {
  if (typeof hubCanShowDevUi === 'function' && !hubCanShowDevUi()) {
    if (typeof showToast === 'function') showToast('⚠️ 開発用機能は利用できません');
    return;
  }
  if (!confirm('サンプル組織図を読み込みます。現在のデータは上書きされます。よろしいですか？')) return;
  hubApplyData(HUB_DEV_ORG_SEED);
  if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  settings.lastUpdate = new Date().toLocaleString();
  hubSaveNow();
  if (typeof render === 'function') render();
  if (typeof showToast === 'function') showToast('✅ サンプル組織図を読み込みました');
}

function hubClearAllData() {
  let msg =
    'この端末に保存されているデータをすべて削除します。\n\n' +
    '・組織図\n' +
    '・収益・売上の入力\n' +
    '・プロジェクト設定\n' +
    '・その他の端末内データ\n\n' +
    '削除後は空の状態から再スタートします。\n' +
    '元に戻すには、事前のバックアップが必要です。\n\n' +
    '本当に削除しますか？';
  if (!confirm(msg)) return;

  try {
    if (typeof localStorage !== 'undefined') {
      if (hubActiveUid) localStorage.removeItem(hubStorageKeyForUid(hubActiveUid));
      localStorage.removeItem(HUB_STORAGE_KEY);
      localStorage.removeItem(HUB_STORAGE_LEGACY_KEY);
      localStorage.removeItem(HUB_DEMO_MODE_KEY);
    }
  } catch (e) {}

  hubApplyData(hubCreateEmptyData());
  if (typeof undoImportSnapshot !== 'undefined') undoImportSnapshot = null;
  if (typeof autoBackups !== 'undefined') autoBackups = [];
  if (typeof toggleHomeDemoMode === 'function') toggleHomeDemoMode(false);
  else if (typeof HOME_DEMO_MODE !== 'undefined') HOME_DEMO_MODE = false;
  if (typeof hubResetViewMonth === 'function') hubResetViewMonth();
  if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  if (typeof ensureRevenueLog === 'function') ensureRevenueLog();
  settings.lastLogin = new Date().toLocaleString();
  settings.lastUpdate = new Date().toLocaleString();
  hubSaveToStorage({ localOnly: true });
  if ((typeof hubIsCloudWriteEnabled !== 'function' || hubIsCloudWriteEnabled()) &&
    typeof hubDeleteCloudData === 'function') {
    hubDeleteCloudData();
  }
  if (typeof hubApplyDevUiVisibility === 'function') hubApplyDevUiVisibility();
  if (typeof render === 'function') render();
  if (typeof showPage === 'function') showPage('home');
  if (typeof showToast === 'function') showToast('✅ 端末のデータを削除しました');
}

if (typeof window !== 'undefined') {
  window.HUB_STORAGE_KEY = HUB_STORAGE_KEY;
  window.hubCreateEmptyData = hubCreateEmptyData;
  window.hubOrcaOrgChartHasMembers = hubOrcaOrgChartHasMembers;
  window.hubOrcaOrgChartScore = hubOrcaOrgChartScore;
  window.hubOrcaOrgChartIsShallow = hubOrcaOrgChartIsShallow;
  window.hubExtractRawOrcaOrgChart = hubExtractRawOrcaOrgChart;
  window.hubRecordRemovedOrcaOrgAccountIds = hubRecordRemovedOrcaOrgAccountIds;
  window.hubClearRemovedOrcaOrgAccountIds = hubClearRemovedOrcaOrgAccountIds;
  window.hubMergeOrcaRemovedIds = hubMergeOrcaRemovedIds;
  window.hubMergeOrcaOrgCharts = hubMergeOrcaOrgCharts;
  window.hubMergeRamOrgCharts = hubMergeRamOrgCharts;
  window.hubMergeHubDocuments = hubMergeHubDocuments;
  window.hubStripRemovedAccountsFromSettings = hubStripRemovedAccountsFromSettings;
  window.hubMergeOrcaInputAccounts = hubMergeOrcaInputAccounts;
  window.hubPackRamOrgChart = hubPackRamOrgChart;
  window.hubRamOrgChartScore = hubRamOrgChartScore;
  window.hubRebuildOrcaOrgFromSettings = hubRebuildOrcaOrgFromSettings;
  window.hubResolveOrcaOrgChart = hubResolveOrcaOrgChart;
  window.hubApplyData = hubApplyData;
  window.hubLoadFromStorage = hubLoadFromStorage;
  window.hubIsEffectivelyEmptyHubData = hubIsEffectivelyEmptyHubData;
  window.hubResolveStorageKey = hubResolveStorageKey;
  window.hubStorageKeyForUid = hubStorageKeyForUid;
  window.hubPackLocalData = hubPackLocalData;
  window.hubPackFirestorePayload = hubPackFirestorePayload;
  window.hubUnpackFirestorePayload = hubUnpackFirestorePayload;
  window.hubComputeContentHash = hubComputeContentHash;
  window.hubSaveToStorage = hubSaveToStorage;
  window.hubSaveNow = hubSaveNow;
  window.hubInitStorage = hubInitStorage;
  window.hubLoadDevOrgSeed = hubLoadDevOrgSeed;
  window.hubClearAllData = hubClearAllData;
  window.hubSetActiveUid = hubSetActiveUid;
  window.hubBindStorageToUid = hubBindStorageToUid;
  window.hubClearStorageForLogout = hubClearStorageForLogout;
}
