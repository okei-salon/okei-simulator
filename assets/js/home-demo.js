/* ============================================================
 * ホーム画面デモデータ（デザイン確認用）
 *
 * 【OFF にする方法】
 *   1) 下記 HOME_DEMO_MODE を false にする
 *   2) または index.html から home-demo.js の読み込み行を削除
 *
 * 本番の settings.revenueLog には一切書き込みません。
 * ============================================================ */
var HOME_DEMO_MODE = true;

var HOME_DEMO_YEAR = 2026;
var HOME_DEMO_MONTH = 5; /* 0-indexed: 6月 */
var HOME_DEMO_DAY = 30;

var HOME_DEMO_MONTHLY = {
  total: 4120,
  ram: 3240,
  orca: 720,
  genesis: 160
};

var HOME_DEMO_DAILY_TOTALS = [
  95, 108, 126, 118, 142, 158, 149, 173, 165, 182,
  205, 198, 226, 241, 232, 258, 276, 265, 289, 315,
  304, 338, 356, 344, 382, 401, 392, 427, 415, 448
];

var HOME_DEMO_LOG = (function () {
  var log = {};
  var ramR = HOME_DEMO_MONTHLY.ram / HOME_DEMO_MONTHLY.total;
  var orcaR = HOME_DEMO_MONTHLY.orca / HOME_DEMO_MONTHLY.total;
  HOME_DEMO_DAILY_TOTALS.forEach(function (total, i) {
    var d = i + 1;
    var key = HOME_DEMO_YEAR + '-06-' + String(d).padStart(2, '0');
    var ram = Math.round(total * ramR * 100) / 100;
    var orca = Math.round(total * orcaR * 100) / 100;
    var genesis = Math.round((total - ram - orca) * 100) / 100;
    log[key] = { total: total, ram: ram, orca: orca, genesis: genesis, savedAt: 'demo' };
  });
  return log;
})();

function isHomeDemoActive() {
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
      genesis: HOME_DEMO_MONTHLY.genesis
    },
    total: HOME_DEMO_MONTHLY.total
  };
}

function getHomeDemoEnabledProjects() {
  if (!isHomeDemoActive()) return null;
  return [
    { key: 'ram', name: 'RAM', dot: 'ram' },
    { key: 'orca', name: 'ORCA', dot: 'orca' },
    { key: 'genesis', name: 'Genesis', dot: 'genesis' }
  ];
}

function injectHomeDemoBanner() {
  if (!isHomeDemoActive() || document.getElementById('homeDemoBanner')) return;
  var card = document.getElementById('homeMonthlyCard');
  if (!card) return;
  var banner = document.createElement('div');
  banner.id = 'homeDemoBanner';
  banner.className = 'homeDemoBanner';
  banner.textContent = 'DEMO — 2026年6月のサンプルデータ表示中（保存データには影響しません）';
  card.insertBefore(banner, card.firstChild);
}

function initHomeDemo() {
  if (!isHomeDemoActive()) return;
  homeCalView.y = HOME_DEMO_YEAR;
  homeCalView.m = HOME_DEMO_MONTH;
  injectHomeDemoBanner();
  if (typeof updateHomeDashboard === 'function') {
    updateHomeDashboard(typeof allOrgSummary === 'function' ? allOrgSummary() : null);
  }
}

function patchHomeDemoRender() {
  if (!isHomeDemoActive() || typeof renderHome !== 'function' || renderHome.__homeDemoPatched) return;
  var orig = renderHome;
  renderHome = function () {
    homeCalView.y = HOME_DEMO_YEAR;
    homeCalView.m = HOME_DEMO_MONTH;
    orig.apply(this, arguments);
    injectHomeDemoBanner();
  };
  renderHome.__homeDemoPatched = true;
}

if (typeof document !== 'undefined') {
  injectHomeDemoBanner();
}
