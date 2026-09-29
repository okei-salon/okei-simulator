#!/usr/bin/env node
/**
 * Revenue save — immediate home refresh, local/cloud toast order, pull guard (iPhone Safari path).
 * ref.set is mocked — no real Firestore writes.
 */
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.OUKEI_BASE_URL || 'http://127.0.0.1:5050';

let passed = 0;
let failed = 0;

function assert(name, ok, detail) {
  if (ok) {
    passed++;
    console.log('PASS ' + name);
  } else {
    failed++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

async function runCase(page, setupCode, runCode) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubPersistThenCloudConfirm === 'function' &&
      typeof hubFinishUiAfterLocalSave === 'function' &&
      typeof hubShowLocalSaveToast === 'function',
    null,
    { timeout: 60000 }
  );
  return page.evaluate(async ({ setup, run }) => {
    if (setup) eval(setup);
    return eval('(' + run + ')()');
  }, { setup: setupCode, run: runCode });
}

function setupRamSaveMocks(dateKey) {
  return `
    var dateKey = ${JSON.stringify(dateKey)};
    var cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
      orcaOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      revenue: { revenueLog: {}, salesLog: {} },
      settings: { revenueLog: {}, salesLog: {} }
    };
    window.__TOAST_LOG__ = [];
    var origShowToast = showToast;
    showToast = function (msg) {
      window.__TOAST_LOG__.push(String(msg));
      return origShowToast(msg);
    };
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    hubIsAnyOrgSimActive = function () { return false; };
    hubFirebaseReady = true;
    hubFirebaseUid = 'verify-home-toast-uid';
    hubCloudSaveInFlight = false;
    hubRevenueInputSaveDepth = 0;
    hubAllowAutomaticCloudWrites('verify-home-toast');
    hubClearLocalDirtyForCloud('verify-home-toast');
    hubClearCloudSaveTimerAndQueue('verify-home-toast');
    hubClearPendingCloudWrite();
    window.hubFetchCloudWriteGate = function () { return Promise.resolve({ suspended: false }); };
    window.hubFetchCloudDoc = function () {
      return Promise.resolve(JSON.parse(JSON.stringify(cloudPayload)));
    };
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          if (payload && payload.revenue && payload.revenue.revenueLog) {
            cloudPayload.revenue.revenueLog = JSON.parse(JSON.stringify(payload.revenue.revenueLog));
          }
          cloudPayload.updatedAt = (payload && payload.updatedAt) || Date.now();
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };
    if (typeof members !== 'undefined') members = [{ id: 'r1', parent: null, name: 'R1', investment: 1000 }];
    if (typeof rootId !== 'undefined') rootId = 'r1';
    if (typeof settings !== 'undefined') {
      settings = settings || {};
      settings.revenueLog = settings.revenueLog || {};
    }
    if (typeof homePage !== 'undefined' && homePage) homePage.classList.remove('hidden');
    if (typeof modalBg !== 'undefined' && modalBg) modalBg.style.display = 'flex';
  `;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const dateKey = '2026-09-29';

  const iphoneCtx = await browser.newContext({ ...devices['iPhone 13'] });
  const iphonePage = await iphoneCtx.newPage();

  const syncHomeCase = await runCase(iphonePage, setupRamSaveMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 55, revision: 9000 } },
      ram: 55,
      total: 55
    };
    hubLocalUpdatedAt = Date.now();
    hubBeginRevenueInputSaveFlow();
    hubRunRevenueLocalPersistPhase(function () {
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 55, revision: 9000 } },
          ram: 55,
          total: 55
        });
      }
    });
    hubFinishUiAfterLocalSave();
    var entry = typeof getRevenueEntry === 'function' ? getRevenueEntry(dateKey) : (settings.revenueLog && settings.revenueLog[dateKey]);
    var savedRev = entry && entry.ramAccounts && entry.ramAccounts.r1
      ? Number(entry.ramAccounts.r1.todayRevenue) || 0
      : 0;
    var toastEl = document.getElementById('toast');
    var toastText = toastEl ? toastEl.textContent : '';
    return {
      homeVisible: typeof homePage !== 'undefined' && homePage && !homePage.classList.contains('hidden'),
      localRam: savedRev,
      toastHasLocal: toastText.indexOf('保存しました') >= 0,
      modalClosed: !(typeof modalBg !== 'undefined' && modalBg && modalBg.style.display !== 'none')
    };
  }`);

  assert('IPHONE: home visible after local save', syncHomeCase.homeVisible === true, JSON.stringify(syncHomeCase));
  assert('IPHONE: revenueLog account saved after sync refresh', syncHomeCase.localRam === 55,
    'todayRevenue=' + syncHomeCase.localRam);
  assert('IPHONE: local toast shown immediately', syncHomeCase.toastHasLocal === true, JSON.stringify(syncHomeCase));
  assert('IPHONE: modal closed', syncHomeCase.modalClosed === true, '');

  const toastOrderCase = await runCase(iphonePage, setupRamSaveMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 44, revision: 9000 } },
      ram: 44,
      total: 44
    };
    hubLocalUpdatedAt = Date.now();
    var result = await hubPersistThenCloudConfirm(function () {
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 44, revision: 9000 } },
          ram: 44,
          total: 44
        });
      }
      if (typeof hubFlushRevenueSaveLocalPersist === 'function') hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog && settings.revenueLog[dateKey]);
    }, typeof hubRevenueSaveMeta === 'function' ? hubRevenueSaveMeta('ram', dateKey) : { projectKey: 'ram', dateKey: dateKey });
    var log = window.__TOAST_LOG__ || [];
    var firstLocalIdx = log.findIndex(function (m) { return m.indexOf('保存しました') >= 0; });
    var firstCloudIdx = log.findIndex(function (m) { return m.indexOf('Cloud同期済み') >= 0; });
    await new Promise(function (r) { setTimeout(r, 3000); });
    var logAfter = window.__TOAST_LOG__ || [];
    var cloudIdxAfter = logAfter.findIndex(function (m) { return m.indexOf('Cloud同期済み') >= 0; });
    return {
      ok: result.ok,
      firstLocalIdx: firstLocalIdx,
      firstCloudIdx: firstCloudIdx,
      cloudIdxAfter: cloudIdxAfter,
      log: logAfter
    };
  }`);

  assert('TOAST: cloud save ok', toastOrderCase.ok === true, JSON.stringify(toastOrderCase));
  assert('TOAST: local toast before cloud toast', toastOrderCase.firstLocalIdx >= 0 &&
    (toastOrderCase.firstCloudIdx < 0 || toastOrderCase.firstLocalIdx < toastOrderCase.firstCloudIdx),
    JSON.stringify(toastOrderCase.log));
  assert('TOAST: cloud toast deferred', toastOrderCase.cloudIdxAfter >= 0, JSON.stringify(toastOrderCase.log));

  const pullGuardCase = await runCase(iphonePage, setupRamSaveMocks(dateKey), `async function() {
    hubLastPullAt = 0;
    var fetchCalls = 0;
    var origFetch = hubFetchCloudDoc;
    hubFetchCloudDoc = function () {
      fetchCalls += 1;
      return origFetch.apply(this, arguments);
    };
    hubBeginRevenueInputSaveFlow();
    var duringPull = await hubPullCloudData('verify-block');
    var duringFetch = fetchCalls;
    hubEndRevenueInputSaveFlow();
    var afterPull = await hubPullCloudData('verify-after');
    return {
      duringPull: duringPull,
      duringFetch: duringFetch,
      afterPull: afterPull,
      afterFetch: fetchCalls
    };
  }`);

  assert('PULL: blocked during revenue save flow', pullGuardCase.duringPull === false &&
    pullGuardCase.duringFetch === 0, JSON.stringify(pullGuardCase));
  assert('PULL: allowed after revenue save flow', pullGuardCase.afterPull === true &&
    pullGuardCase.afterFetch >= 1, JSON.stringify(pullGuardCase));

  const pushMetaCase = await runCase(iphonePage, '', `async function() {
    var dk = typeof todayKey === 'function' ? todayKey() : ${JSON.stringify(dateKey)};
    var withRam = hubCollectPushRevenueMeta({
      updatedAt: 9001,
      revenue: {
        revenueLog: {}
      }
    });
    withRam = hubCollectPushRevenueMeta({
      updatedAt: 9001,
      revenue: {
        revenueLog: (function () {
          var o = {};
          o[dk] = { ramAccounts: { r1: { todayRevenue: 22 } }, ram: 22, total: 22 };
          return o;
        })()
      }
    });
    var withoutRam = hubCollectPushRevenueMeta({
      updatedAt: 9002,
      revenue: {
        revenueLog: (function () {
          var o = {};
          o[dk] = { orca: 10, orcaAccounts: { o1: { todayRevenue: 10 } } };
          return o;
        })()
      }
    });
    return {
      hasRam: hubPushMetaHasRamForDateKey(withRam, dk),
      lacksRam: hubPushMetaHasRamForDateKey(withoutRam, dk)
    };
  }`);

  assert('PUSH-META: detects RAM in ref.set payload', pushMetaCase.hasRam === true, JSON.stringify(pushMetaCase));
  assert('PUSH-META: rejects payload without RAM for dateKey', pushMetaCase.lacksRam === false,
    JSON.stringify(pushMetaCase));

  await browser.close();
  console.log('\n' + passed + '/' + (passed + failed) + ' PASS');
  process.exit(failed ? 1 : 0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
