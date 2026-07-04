/* OUKEI HUB Local Storage — Ver2.0.5
 * 端末ごとに独立したデータ管理（Firebase / ログインなし）
 */

var HUB_STORAGE_KEY = 'oukei_hub_v15_data';
var HUB_STORAGE_LEGACY_KEY = 'okei_v14_data';

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
    salesLog: {}
  };
}

function hubCreateEmptyData() {
  return {
    members: [],
    currentData: [],
    settings: hubCreateDefaultSettings(),
    scenarios: [],
    rootId: '',
    rootAccountIds: []
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

function hubNormalizeLoadedData(raw) {
  let base = hubCreateEmptyData();
  if (!raw || typeof raw !== 'object') return base;
  let settings = Object.assign(hubCreateDefaultSettings(), raw.settings || {});
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
  if (!settings.salesLog || typeof settings.salesLog !== 'object') settings.salesLog = {};
  return {
    members: Array.isArray(raw.members) ? raw.members : base.members,
    currentData: Array.isArray(raw.currentData) ? raw.currentData : base.currentData,
    settings: settings,
    scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : base.scenarios,
    rootId: typeof raw.rootId === 'string' ? raw.rootId : base.rootId,
    rootAccountIds: Array.isArray(raw.rootAccountIds) ? raw.rootAccountIds : base.rootAccountIds
  };
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
}

function hubLoadFromStorage() {
  if (typeof localStorage === 'undefined') {
    return { data: hubCreateEmptyData(), isNew: true };
  }
  try {
    let raw = localStorage.getItem(HUB_STORAGE_KEY) || localStorage.getItem(HUB_STORAGE_LEGACY_KEY);
    if (!raw) return { data: hubCreateEmptyData(), isNew: true };
    return { data: hubNormalizeLoadedData(JSON.parse(raw)), isNew: false };
  } catch (e) {
    return { data: hubCreateEmptyData(), isNew: true };
  }
}

function hubSaveToStorage() {
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : '',
      rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : []
    }));
  } catch (e) {}
}

function hubInitStorage() {
  let result = hubLoadFromStorage();
  hubApplyData(result.data);
  if (result.isNew) hubSaveToStorage();
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
  hubSaveToStorage();
  if (typeof render === 'function') render();
  if (typeof showToast === 'function') showToast('✅ サンプル組織図を読み込みました');
}

if (typeof window !== 'undefined') {
  window.HUB_STORAGE_KEY = HUB_STORAGE_KEY;
  window.hubCreateEmptyData = hubCreateEmptyData;
  window.hubApplyData = hubApplyData;
  window.hubLoadFromStorage = hubLoadFromStorage;
  window.hubSaveToStorage = hubSaveToStorage;
  window.hubInitStorage = hubInitStorage;
  window.hubLoadDevOrgSeed = hubLoadDevOrgSeed;
}
