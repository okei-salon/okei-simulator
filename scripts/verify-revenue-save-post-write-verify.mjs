#!/usr/bin/env node
/**
 * Post-write Cloud verify — ref.set SUCCESS + server read lag (Safari/mobile path).
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

async function runCase(page, label, evaluateFn) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubPersistThenCloudConfirm === 'function' &&
      typeof hubFetchCloudDocForSaveVerify === 'function',
    null,
    { timeout: 60000 }
  );
  return page.evaluate(evaluateFn);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage();
  const lagCase = await runCase(desktop, 'lag', async () => {
    var dateKey = typeof todayKey === 'function' ? todayKey() : '2026-09-29';
    var cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
      orcaOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      revenue: { revenueLog: {}, salesLog: {} },
      settings: { revenueLog: {}, salesLog: {} }
    };
    var readCount = 0;
    window.__VERIFY_READS__ = 0;
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    hubIsAnyOrgSimActive = function () { return false; };
    hubFirebaseReady = true;
    hubFirebaseUid = 'verify-lag-uid';
    hubCloudSaveInFlight = false;
    hubRevenueInputSaveDepth = 0;
    hubAllowAutomaticCloudWrites('verify-lag');
    hubClearLocalDirtyForCloud('verify-lag');
    hubClearCloudSaveTimerAndQueue('verify-lag');
    hubClearPendingCloudWrite();
    window.hubFetchCloudWriteGate = function () { return Promise.resolve({ suspended: false }); };
    window.hubFetchCloudDoc = function (opts) {
      window.__VERIFY_READS__ += 1;
      readCount += 1;
      if (readCount <= 2) {
        return Promise.resolve(JSON.parse(JSON.stringify(cloudPayload)));
      }
      var copy = JSON.parse(JSON.stringify(cloudPayload));
      copy.revenue.revenueLog[dateKey] = {
        ramAccounts: { r1: { todayRevenue: 88, revision: 9000 } },
        ram: 88,
        total: 88
      };
      copy.updatedAt = Date.now();
      return Promise.resolve(copy);
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
    settings.revenueLog = settings.revenueLog || {};
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 88, revision: 9000 } },
      ram: 88,
      total: 88
    };
    hubLocalUpdatedAt = Date.now();
    var result = await hubPersistThenCloudConfirm(function () {
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 88, revision: 9000 } },
          ram: 88,
          total: 88
        });
      }
      if (typeof hubFlushRevenueSaveLocalPersist === 'function') hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog && settings.revenueLog[dateKey]);
    }, typeof hubRevenueSaveMeta === 'function' ? hubRevenueSaveMeta('ram', dateKey) : { projectKey: 'ram', dateKey: dateKey });
    return {
      ok: result.ok,
      status: result.status,
      verifySoft: !!result.verifySoft,
      pending: hubSyncPendingWrites || 0,
      reads: window.__VERIFY_READS__ || 0,
      dirty: hubHasLocalDirtyChanges()
    };
  });

  assert('LAG: cloud save ok', lagCase.ok === true, JSON.stringify(lagCase));
  assert('LAG: status synced', lagCase.status === 'synced', lagCase.status);
  assert('LAG: pending 0', lagCase.pending === 0, 'pending=' + lagCase.pending);
  assert('LAG: dirty false', lagCase.dirty === false, 'dirty=' + lagCase.dirty);
  assert('LAG: multiple verify reads', lagCase.reads >= 2, 'reads=' + lagCase.reads);

  const softCase = await runCase(desktop, 'strict-no-ram-write', async () => {
    var dateKey = typeof todayKey === 'function' ? todayKey() : '2026-09-29';
    var pushedAt = Date.now();
    var cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
      orcaOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      revenue: { revenueLog: {}, salesLog: {} },
      settings: { revenueLog: {}, salesLog: {} }
    };
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    hubIsAnyOrgSimActive = function () { return false; };
    hubFirebaseReady = true;
    hubFirebaseUid = 'verify-soft-uid';
    hubCloudSaveInFlight = false;
    hubRevenueInputSaveDepth = 0;
    hubAllowAutomaticCloudWrites('verify-soft');
    hubClearLocalDirtyForCloud('verify-soft');
    hubClearCloudSaveTimerAndQueue('verify-soft');
    hubClearPendingCloudWrite();
    window.hubFetchCloudWriteGate = function () { return Promise.resolve({ suspended: false }); };
    window.hubFetchCloudDoc = function () {
      var stale = JSON.parse(JSON.stringify(cloudPayload));
      stale.updatedAt = pushedAt;
      return Promise.resolve(stale);
    };
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          cloudPayload.updatedAt = (payload && payload.updatedAt) || pushedAt;
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };
    settings.revenueLog = settings.revenueLog || {};
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 77, revision: 9000 } },
      ram: 77,
      total: 77
    };
    hubLocalUpdatedAt = pushedAt;
    var result = await hubPersistThenCloudConfirm(function () {
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 77, revision: 9000 } },
          ram: 77,
          total: 77
        });
      }
      if (typeof hubFlushRevenueSaveLocalPersist === 'function') hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog && settings.revenueLog[dateKey]);
    }, typeof hubRevenueSaveMeta === 'function' ? hubRevenueSaveMeta('ram', dateKey) : { projectKey: 'ram', dateKey: dateKey });
    return {
      ok: result.ok,
      status: result.status,
      message: result.message,
      strictVerifyFail: !!result.strictVerifyFail
    };
  });

  assert('STRICT: updatedAt-only ref.set fails', softCase.ok === false, JSON.stringify(softCase));
  assert('STRICT: status verify-failed', softCase.status === 'verify-failed', softCase.status);
  assert('STRICT: RAM verify message', String(softCase.message || '').indexOf('RAM') >= 0, softCase.message);
  assert('STRICT: strictVerifyFail set', softCase.strictVerifyFail === true, '');

  const iphone = await browser.newContext({ ...devices['iPhone 13'] });
  const iphonePage = await iphone.newPage();
  const mobileCase = await runCase(iphonePage, 'iphone', async () => {
    var dateKey = typeof todayKey === 'function' ? todayKey() : '2026-09-29';
    var cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
      orcaOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      revenue: { revenueLog: {}, salesLog: {} },
      settings: { revenueLog: {}, salesLog: {} }
    };
    var reads = 0;
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    hubIsAnyOrgSimActive = function () { return false; };
    hubFirebaseReady = true;
    hubFirebaseUid = 'verify-iphone-uid';
    hubCloudSaveInFlight = false;
    hubRevenueInputSaveDepth = 0;
    hubAllowAutomaticCloudWrites('verify-iphone');
    hubClearLocalDirtyForCloud('verify-iphone');
    hubClearCloudSaveTimerAndQueue('verify-iphone');
    hubClearPendingCloudWrite();
    window.hubFetchCloudWriteGate = function () { return Promise.resolve({ suspended: false }); };
    window.hubFetchCloudDoc = function () {
      reads += 1;
      if (reads <= 3) return Promise.resolve(JSON.parse(JSON.stringify(cloudPayload)));
      var copy = JSON.parse(JSON.stringify(cloudPayload));
      copy.revenue.revenueLog[dateKey] = {
        ramAccounts: { r1: { todayRevenue: 66, revision: 9000 } },
        ram: 66,
        total: 66
      };
      copy.updatedAt = Date.now();
      return Promise.resolve(copy);
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
    settings.revenueLog = settings.revenueLog || {};
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 66, revision: 9000 } },
      ram: 66,
      total: 66
    };
    hubLocalUpdatedAt = Date.now();
    var panelBefore = document.getElementById('hubRevenueSaveDiagnosticPanel');
    if (panelBefore) panelBefore.classList.add('hidden');
    hubIsAdminUser = function () { return true; };
    try { localStorage.removeItem('hubRevenueSaveDiag'); } catch (e) {}
    var result = await hubPersistThenCloudConfirm(function () {
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 66, revision: 9000 } },
          ram: 66,
          total: 66
        });
      }
      if (typeof hubFlushRevenueSaveLocalPersist === 'function') hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog && settings.revenueLog[dateKey]);
    }, typeof hubRevenueSaveMeta === 'function' ? hubRevenueSaveMeta('ram', dateKey) : { projectKey: 'ram', dateKey: dateKey });
    var entry = settings.revenueLog && settings.revenueLog[dateKey];
    var panel = document.getElementById('hubRevenueSaveDiagnosticPanel');
    return {
      ok: result.ok,
      pending: hubSyncPendingWrites || 0,
      homeRam: entry ? Number(entry.ram) || 0 : 0,
      panelHidden: !panel || panel.classList.contains('hidden'),
      modalHidden: !(typeof modalBg !== 'undefined' && modalBg && modalBg.style.display !== 'none')
    };
  });

  assert('IPHONE: save ok with lagging reads', mobileCase.ok === true, JSON.stringify(mobileCase));
  assert('IPHONE: pending 0', mobileCase.pending === 0, 'pending=' + mobileCase.pending);
  assert('IPHONE: revenueLog ram preserved', mobileCase.homeRam === 66, 'ram=' + mobileCase.homeRam);
  assert('IPHONE: diagnostic panel hidden without diag mode', mobileCase.panelHidden === true, '');

  await browser.close();
  console.log('\n' + passed + '/' + (passed + failed) + ' PASS');
  process.exit(failed ? 1 : 0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
