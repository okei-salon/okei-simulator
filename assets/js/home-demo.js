/* ============================================================
 * ホーム画面デモモード（完成形体験版・説明会用）
 *
 * ON/OFF: ホーム画面上部のトグル
 * 保存: localStorage「oukei_home_demo_mode」のみ（本番データとは分離）
 * 本番の settings.revenueLog / oukei_hub_v15_data には書き込みません。
 * ============================================================ */
var HOME_DEMO_STORAGE_KEY = 'oukei_home_demo_mode';

function hubDemoModeStorageKey() {
  var uid = '';
  if (typeof hubGetActiveAuthUid === 'function') uid = hubGetActiveAuthUid() || '';
  else if (typeof hubActiveUid !== 'undefined' && hubActiveUid) uid = String(hubActiveUid);
  return uid ? HOME_DEMO_STORAGE_KEY + ':' + uid : HOME_DEMO_STORAGE_KEY;
}

var HOME_DEMO_YEAR = 2026;
var HOME_DEMO_MONTH = 5; /* 0-indexed: 6月 */
var HOME_DEMO_DAY = 30;

var HOME_DEMO_MONTHLY = {
  total: 4120,
  ram: 3240,
  orca: 720,
  cary: 160
};

var HOME_DEMO_DAILY_TOTALS = [
  95, 108, 126, 118, 142, 158, 149, 173, 165, 182,
  205, 198, 226, 241, 232, 258, 276, 265, 289, 315,
  304, 338, 356, 344, 382, 401, 392, 427, 415, 448
];

var HOME_DEMO_RAM_ACCOUNTS = [
  { id: 'demo_ram_a', username: 'Project A', investment: 40000 },
  { id: 'demo_ram_b', username: 'Project B', investment: 12000 }
];

var HOME_DEMO_ORCA_ACCOUNTS = [
  { id: 'demo_orca_1', username: 'Demo ①', investment: 5000 },
  { id: 'demo_orca_2', username: 'Demo ②', investment: 3000 }
];

var HOME_DEMO_CARY_ACCOUNTS = [
  { id: 'demo_cary_a', username: 'Demo A', investment: 2000 },
  { id: 'demo_cary_b', username: 'Demo B', investment: 1500 }
];

var HOME_DEMO_TODAY_ACCOUNTS = {
  ramAccounts: {
    demo_ram_a: { todayRevenue: 6, addInvestment: 0 },
    demo_ram_b: { todayRevenue: 4, addInvestment: 0 }
  },
  orcaAccounts: {
    demo_orca_1: { yesterdayAiProfit: 8, todayAffiliateProfit: 2 },
    demo_orca_2: { yesterdayAiProfit: 2, todayAffiliateProfit: 1 }
  },
  caryAccounts: {
    demo_cary_a: { todayReward: 3 },
    demo_cary_b: { todayReward: 3 }
  }
};

var HOME_DEMO_LOG = (function () {
  var log = {};
  var ramR = HOME_DEMO_MONTHLY.ram / HOME_DEMO_MONTHLY.total;
  var orcaR = HOME_DEMO_MONTHLY.orca / HOME_DEMO_MONTHLY.total;
  var caryR = HOME_DEMO_MONTHLY.cary / HOME_DEMO_MONTHLY.total;
  HOME_DEMO_DAILY_TOTALS.forEach(function (total, i) {
    var d = i + 1;
    var key = HOME_DEMO_YEAR + '-06-' + String(d).padStart(2, '0');
    var ram = Math.round(total * ramR * 100) / 100;
    var orca = Math.round(total * orcaR * 100) / 100;
    var cary = Math.round(total * caryR * 100) / 100;
    log[key] = {
      total: total,
      ram: ram,
      orca: orca,
      cary: cary,
      genesis: 0,
      savedAt: 'demo'
    };
  });
  return log;
})();

var HOME_DEMO_MODE = false;

function buildHomeDemoTodayEntry() {
  var ram = 10;
  var orca = 11;
  var cary = 6;
  return {
    total: ram + orca + cary,
    ram: ram,
    orca: orca,
    cary: cary,
    genesis: 0,
    ramAccounts: JSON.parse(JSON.stringify(HOME_DEMO_TODAY_ACCOUNTS.ramAccounts)),
    orcaAccounts: JSON.parse(JSON.stringify(HOME_DEMO_TODAY_ACCOUNTS.orcaAccounts)),
    caryAccounts: JSON.parse(JSON.stringify(HOME_DEMO_TODAY_ACCOUNTS.caryAccounts)),
    savedAt: 'demo'
  };
}

function loadHomeDemoMode() {
  if (typeof hubCanShowDevUi === 'function' && !hubCanShowDevUi()) return false;
  try {
    return localStorage.getItem(hubDemoModeStorageKey()) === '1';
  } catch (e) {
    return false;
  }
}

function persistHomeDemoMode(on) {
  try {
    localStorage.setItem(hubDemoModeStorageKey(), on ? '1' : '0');
  } catch (e) {}
}

function isHomeDemoActive() {
  if (typeof hubCanShowDevUi === 'function' && !hubCanShowDevUi()) return false;
  return !!HOME_DEMO_MODE;
}

function getHomeDemoReferenceDate() {
  if (!isHomeDemoActive()) return null;
  return new Date(HOME_DEMO_YEAR, HOME_DEMO_MONTH, HOME_DEMO_DAY);
}

function getHomeDemoTodayKey() {
  if (!isHomeDemoActive()) return null;
  return HOME_DEMO_YEAR + '-06-' + String(HOME_DEMO_DAY).padStart(2, '0');
}

function getHomeDemoYesterdayKey() {
  if (!isHomeDemoActive()) return null;
  return HOME_DEMO_YEAR + '-06-' + String(HOME_DEMO_DAY - 1).padStart(2, '0');
}

function getHomeDemoRevenueEntry(key) {
  if (!isHomeDemoActive()) return undefined;
  var todayKey = getHomeDemoTodayKey();
  if (key === todayKey) return buildHomeDemoTodayEntry();
  if (Object.prototype.hasOwnProperty.call(HOME_DEMO_LOG, key)) return HOME_DEMO_LOG[key];
  if (/^2026-06-\d{2}$/.test(key)) return null;
  return undefined;
}

function getHomeDemoMonthlyOverride(y, m, sAll) {
  if (!isHomeDemoActive() || y !== HOME_DEMO_YEAR || m !== HOME_DEMO_MONTH) return null;
  return {
    sAll: sAll,
    monthLog: {
      hasLog: true,
      total: HOME_DEMO_MONTHLY.total,
      ram: HOME_DEMO_MONTHLY.ram,
      orca: HOME_DEMO_MONTHLY.orca,
      cary: HOME_DEMO_MONTHLY.cary,
      genesis: 0
    },
    total: HOME_DEMO_MONTHLY.total
  };
}

function getHomeDemoEnabledProjects() {
  if (!isHomeDemoActive()) return null;
  return [
    { key: 'ram', name: 'Project A' },
    { key: 'orca', name: 'Project B' },
    { key: 'cary', name: 'OUKEI' }
  ];
}

function getHomeDemoRamAccounts() {
  if (!isHomeDemoActive()) return null;
  return HOME_DEMO_RAM_ACCOUNTS.map(function (acc) {
    return {
      id: acc.id,
      username: acc.username,
      investment: acc.investment
    };
  });
}

function getHomeDemoOrcaAccounts() {
  if (!isHomeDemoActive()) return null;
  return HOME_DEMO_ORCA_ACCOUNTS.map(function (acc) {
    return {
      id: acc.id,
      username: acc.username,
      investment: acc.investment
    };
  });
}

function getHomeDemoCaryAccounts() {
  if (!isHomeDemoActive()) return null;
  return HOME_DEMO_CARY_ACCOUNTS.map(function (acc) {
    return {
      id: acc.id,
      username: acc.username,
      investment: acc.investment
    };
  });
}

function removeHomeDemoBanner() {
  var banner = document.getElementById('homeDemoBanner');
  if (banner) banner.remove();
}

function injectHomeDemoBanner() {
  if (!isHomeDemoActive()) {
    removeHomeDemoBanner();
    return;
  }
  if (document.getElementById('homeDemoBanner')) return;
  var card = document.getElementById('homeMonthlyCard');
  if (!card) return;
  var banner = document.createElement('div');
  banner.id = 'homeDemoBanner';
  banner.className = 'homeDemoBanner';
  banner.textContent = 'DEMO — 2026年6月のサンプルデータ表示中（保存データには影響しません）';
  card.insertBefore(banner, card.firstChild);
}

function syncHomeDemoToolbar() {
  var toolbar = document.getElementById('homeDemoToolbar');
  var toggle = document.getElementById('homeDemoToggle');
  if (toggle) toggle.checked = isHomeDemoActive();
  if (toolbar) toolbar.classList.toggle('isActive', isHomeDemoActive());
}

function resetHomeCalViewForMode() {
  if (typeof hubResetViewMonth === 'function') {
    hubResetViewMonth();
    return;
  }
  if (isHomeDemoActive()) {
    homeCalView.y = HOME_DEMO_YEAR;
    homeCalView.m = HOME_DEMO_MONTH;
    return;
  }
  var now = new Date();
  homeCalView.y = now.getFullYear();
  homeCalView.m = now.getMonth();
}

function applyHomeDemoState() {
  HOME_DEMO_MODE = loadHomeDemoMode();
  resetHomeCalViewForMode();
  syncHomeDemoToolbar();
  if (isHomeDemoActive()) injectHomeDemoBanner();
  else removeHomeDemoBanner();
}

function toggleHomeDemoMode(on) {
  if (on && typeof hubCanShowDevUi === 'function' && !hubCanShowDevUi()) {
    HOME_DEMO_MODE = false;
    persistHomeDemoMode(false);
    syncHomeDemoToolbar();
    removeHomeDemoBanner();
    return;
  }
  HOME_DEMO_MODE = !!on;
  persistHomeDemoMode(HOME_DEMO_MODE);
  resetHomeCalViewForMode();
  syncHomeDemoToolbar();
  if (isHomeDemoActive()) injectHomeDemoBanner();
  else removeHomeDemoBanner();
  if (typeof updateHomeDashboard === 'function') {
    updateHomeDashboard(typeof allOrgSummary === 'function' ? allOrgSummary() : null);
  } else if (typeof render === 'function') {
    render();
  }
}

function patchHomeDemoRender() {
  if (typeof renderHome !== 'function' || renderHome.__homeDemoPatched) return;
  var orig = renderHome;
  renderHome = function () {
    if (isHomeDemoActive()) {
      homeCalView.y = HOME_DEMO_YEAR;
      homeCalView.m = HOME_DEMO_MONTH;
    }
    orig.apply(this, arguments);
    syncHomeDemoToolbar();
    if (isHomeDemoActive()) injectHomeDemoBanner();
    else removeHomeDemoBanner();
  };
  renderHome.__homeDemoPatched = true;
}

function initHomeDemo() {
  applyHomeDemoState();
  patchHomeDemoRender();
  if (typeof hubApplyDevUiVisibility === 'function') hubApplyDevUiVisibility();
}

if (typeof window !== 'undefined') {
  window.hubDemoModeStorageKey = hubDemoModeStorageKey;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeDemo);
  } else {
    initHomeDemo();
  }
}
