/* OUKEI HUB Local Storage + Cloud Save Hooks — Ver2.0.5 */

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
    useRAM: true,
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
    performanceInputHiddenAccounts: {}
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
  try {
    if (typeof localStorage !== 'undefined') {
      if (hubActiveUid) localStorage.removeItem(hubStorageKeyForUid(hubActiveUid));
      localStorage.removeItem(HUB_STORAGE_KEY);
      localStorage.removeItem(HUB_STORAGE_LEGACY_KEY);
      localStorage.removeItem(HUB_DEMO_MODE_KEY);
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
  let normalized = {
    members: Array.isArray(raw.members) ? raw.members : base.members,
    currentData: Array.isArray(raw.currentData) ? raw.currentData : base.currentData,
    settings: settings,
    scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : base.scenarios,
    rootId: typeof raw.rootId === 'string' ? raw.rootId : base.rootId,
    rootAccountIds: Array.isArray(raw.rootAccountIds) ? raw.rootAccountIds : base.rootAccountIds,
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
    manageAccounts: manageAccounts,
    revenue: {
      revenueLog: revenueLog,
      salesLog: salesLog
    },
    settings: settingsCopy,
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

function hubApplyData(data) {
  let normalized = hubNormalizeLoadedData(data);
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
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  if (typeof pfEnsurePerformanceInputHiddenAccounts === 'function') pfEnsurePerformanceInputHiddenAccounts();
  if (typeof pfMigrateDisplaySettingsCompat === 'function') pfMigrateDisplaySettingsCompat();
}

function hubLoadFromStorage() {
  if (typeof localStorage === 'undefined') {
    return { data: hubCreateEmptyData(), isNew: true };
  }
  try {
    let key = hubResolveStorageKey();
    let raw = localStorage.getItem(key);
    if (!raw && hubActiveUid) {
      raw = localStorage.getItem(HUB_STORAGE_KEY) || localStorage.getItem(HUB_STORAGE_LEGACY_KEY);
    }
    if (!raw) return { data: hubCreateEmptyData(), isNew: true };
    return { data: hubNormalizeLoadedData(JSON.parse(raw)), isNew: false };
  } catch (e) {
    return { data: hubCreateEmptyData(), isNew: true };
  }
}

function hubSaveToStorage(options) {
  options = options || {};
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    let now = Date.now();
    hubLocalUpdatedAt = now;
    localStorage.setItem(hubResolveStorageKey(), JSON.stringify(Object.assign(hubPackLocalData(), { updatedAt: now })));
    if (!options.localOnly && typeof hubScheduleCloudSave === 'function') {
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
  if (typeof hubDeleteCloudData === 'function') hubDeleteCloudData();
  if (typeof render === 'function') render();
  if (typeof showPage === 'function') showPage('home');
  if (typeof showToast === 'function') showToast('✅ 端末のデータを削除しました');
}

if (typeof window !== 'undefined') {
  window.HUB_STORAGE_KEY = HUB_STORAGE_KEY;
  window.hubCreateEmptyData = hubCreateEmptyData;
  window.hubApplyData = hubApplyData;
  window.hubLoadFromStorage = hubLoadFromStorage;
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
