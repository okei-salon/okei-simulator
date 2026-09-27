#!/usr/bin/env node
/**
 * Multi-device sync regression (merge LWW + READ/WRITE gate separation + save UX).
 * No real Firestore writes.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.OUKEI_BASE_URL || 'http://127.0.0.1:5050';

function loadStorageApi() {
  const code = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');
  const pdStub = `
    function pdRecalculateRevenueEntry(entry, dateKey) {
      entry = entry || {};
      if (entry.ramAccounts) {
        let sum = 0;
        Object.keys(entry.ramAccounts).forEach(function (id) {
          sum += Number(entry.ramAccounts[id].todayRevenue || 0);
        });
        entry.ram = Math.round(sum * 100) / 100;
      }
      if (entry.orcaAccounts) {
        let sum = 0;
        Object.keys(entry.orcaAccounts).forEach(function (id) {
          let ae = entry.orcaAccounts[id];
          sum += Number(ae.yesterdayAiProfit || 0) + Number(ae.todayAffiliateProfit || 0);
        });
        entry.orca = Math.round(sum * 100) / 100;
      }
      entry.total = (Number(entry.ram) || 0) + (Number(entry.orca) || 0) +
        (Number(entry.eni) || 0) + (Number(entry.matrix) || 0) + (Number(entry.bitsync) || 0);
      return entry;
    }
    function pdRecalculateSalesEntry(entry) { return entry || {}; }
  `;
  const wrapped = pdStub + '\n' + code + '\n;return { hubMergeHubDocuments, hubMergeOrcaRevenueLogs, hubAccountEntryRevisionMs, hubPickNewerEntry, hubCreateEmptyData, hubCreateDefaultSettings };';
  return new Function(wrapped)();
}

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

const api = loadStorageApi();
const {
  hubMergeHubDocuments,
  hubMergeOrcaRevenueLogs,
  hubAccountEntryRevisionMs,
  hubPickNewerEntry,
  hubCreateEmptyData,
  hubCreateDefaultSettings
} = api;

const DATE_A = '2026-09-27';
const DATE_B = '2026-09-26';
const ACC_RAM = 'ram_acc_1';
const ACC_ORCA = 'orca_acc_1';

function makeClient(data) {
  let d = hubCreateEmptyData();
  d.updatedAt = data.updatedAt || 1000;
  d.settings = hubCreateDefaultSettings();
  Object.assign(d.settings, data.settings || {});
  return d;
}

// CASE A: Client B stale local pulls Client A's new 9/27 RAM day
(function caseA() {
  const clientA = makeClient({
    updatedAt: 5000,
    settings: {
      revenueLog: {
        [DATE_A]: {
          ramAccounts: { [ACC_RAM]: { todayRevenue: 50, revision: 5000 } },
          ram: 50,
          total: 50
        }
      }
    }
  });
  const clientB = makeClient({
    updatedAt: 1000,
    settings: {
      revenueLog: {
        [DATE_B]: {
          ramAccounts: { [ACC_RAM]: { todayRevenue: 30, revision: 1000 } },
          ram: 30,
          total: 30
        }
      }
    }
  });
  const mergedOnB = hubMergeHubDocuments(clientB, clientA);
  const dayA = mergedOnB.settings.revenueLog[DATE_A];
  assert('CASE A: stale client B gets 9/27 RAM from cloud', !!(dayA && dayA.ramAccounts && dayA.ramAccounts[ACC_RAM]));
  assert('CASE A: client B keeps 9/26 local day', !!(mergedOnB.settings.revenueLog[DATE_B]));
})();

// CASE B: reload merge — same as A semantics
(function caseB() {
  const cloud = makeClient({
    updatedAt: 8000,
    settings: {
      revenueLog: {
        [DATE_A]: {
          ramAccounts: { [ACC_RAM]: { todayRevenue: 77, revision: 8000 } },
          ram: 77,
          total: 77
        }
      }
    }
  });
  const local = makeClient({ updatedAt: 2000, settings: { revenueLog: {} } });
  const merged = hubMergeHubDocuments(local, cloud);
  assert('CASE B: reload client gets 9/27 update', Number((merged.settings.revenueLog[DATE_A] || {}).ram) === 77);
})();

// CASE C: RAM + ORCA on different clients both preserved
(function caseC() {
  const ramClient = makeClient({
    updatedAt: 6000,
    settings: {
      revenueLog: {
        [DATE_A]: {
          ramAccounts: { [ACC_RAM]: { todayRevenue: 40, revision: 6000 } },
          ram: 40,
          total: 40
        }
      }
    }
  });
  const orcaClient = makeClient({
    updatedAt: 6000,
    settings: {
      revenueLog: {
        [DATE_A]: {
          orcaAccounts: { [ACC_ORCA]: { yesterdayAiProfit: 5, todayAffiliateProfit: 3, revision: 6000 } },
          orca: 8,
          total: 8
        }
      }
    }
  });
  let merged = hubMergeHubDocuments(ramClient, orcaClient);
  merged = hubMergeHubDocuments(orcaClient, ramClient);
  const day = merged.settings.revenueLog[DATE_A] || {};
  assert('CASE C: RAM preserved after cross-project sync', !!(day.ramAccounts && day.ramAccounts[ACC_RAM]));
  assert('CASE C: ORCA preserved after cross-project sync', !!(day.orcaAccounts && day.orcaAccounts[ACC_ORCA]));
})();

// CASE D: same account/date 100 then 120 → 120 not 220
(function caseD() {
  const rev100 = { todayRevenue: 100, revision: 1000 };
  const rev120 = { todayRevenue: 120, revision: 2000 };
  assert('CASE D: LWW picks newer 120', hubPickNewerEntry(rev100, rev120).todayRevenue === 120);
  const logs = hubMergeOrcaRevenueLogs(
    { [DATE_A]: { ramAccounts: { [ACC_RAM]: rev100 }, ram: 100 } },
    { [DATE_A]: { ramAccounts: { [ACC_RAM]: rev120 }, ram: 120 } },
    false,
    {}
  );
  const total = Number((logs[DATE_A].ramAccounts[ACC_RAM] || {}).todayRevenue);
  assert('CASE D: merged revenue is 120 not 220', total === 120, 'got ' + total);
  const recalc = logs[DATE_A];
  assert('CASE D: day total recalculated to 120', Number(recalc.ram) === 120, 'ram=' + recalc.ram);
})();

// Same-day re-input: replace not accumulate
(function sameDayReinput() {
  const existing = { ramAccounts: { [ACC_RAM]: { todayRevenue: 80, revision: 3000 } }, ram: 80 };
  const updated = { ramAccounts: { [ACC_RAM]: { todayRevenue: 95, revision: 4000 } } };
  const logs = hubMergeOrcaRevenueLogs(
    { [DATE_A]: existing },
    { [DATE_A]: Object.assign({}, existing, updated) },
    false,
    {}
  );
  const ram = Number(logs[DATE_A].ram);
  assert('same-day re-input: total is 95 not 175', ram === 95, 'ram=' + ram);
})();

assert('revision helper prefers revision field', hubAccountEntryRevisionMs({ revision: 9999, savedAt: 'old' }) === 9999);

async function browserGateTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof hubPullCloudData === 'function' && typeof hubSaveRevenueWithCloudConfirm === 'function', null, { timeout: 60000 });

  const result = await page.evaluate(async () => {
    window.__SYNC_TEST_REFSETS__ = [];
    window.__SYNC_TEST_PULLS__ = 0;
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    try { hubFirebaseReady = true; hubFirebaseUid = 'multi-sync-test'; } catch (e) {}

    const cloudPayload = {
      schemaVersion: 2,
      updatedAt: 9000,
      revenue: {
        revenueLog: {
          '2026-09-27': {
            ramAccounts: { ram1: { todayRevenue: 99, revision: 9000 } },
            ram: 99,
            total: 99
          }
        },
        salesLog: {}
      },
      org: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [] },
      settings: {}
    };

    window.hubFirestoreDocRef = function () {
      return {
        set: function () {
          window.__SYNC_TEST_REFSETS__.push(Date.now());
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };

    let pullCount = 0;
    const origFetch = hubFetchCloudDoc;
    window.hubFetchCloudDoc = function () {
      pullCount += 1;
      window.__SYNC_TEST_PULLS__ = pullCount;
      return Promise.resolve(cloudPayload);
    };

    hubSuspendCloudWrites('case-e');
    const pullWhileGate = await hubPullCloudData('case-e-gate');
    const writesDuringGate = (window.__SYNC_TEST_REFSETS__ || []).length;
    const pullsDuringGate = window.__SYNC_TEST_PULLS__ || 0;

    hubResumeCloudWrites('case-e-resume', { allowAutomatic: true });
    hubAllowAutomaticCloudWrites('case-f');

    window.hubRunCloudSave = function () { return Promise.resolve(false); };
    const saveFail = await hubSaveRevenueWithCloudConfirm({
      successMessage: '✅ 保存しました',
      pendingMessage: '端末に保存済み・Cloud同期待ち',
      verifyFn: function () { return true; }
    });

    return {
      pullWhileGate: !!pullWhileGate,
      writesDuringGate,
      pullsDuringGate,
      saveFailOk: saveFail && saveFail.ok === false,
      saveFailMessage: saveFail && saveFail.message,
      saveFailNotSuccessToast: saveFail && saveFail.message !== '✅ 保存しました'
    };
  });

  await browser.close();
  return result;
}

const gateResult = await browserGateTests();
assert('CASE E: Cloud READ succeeds while WRITE gate suspended', gateResult.pullWhileGate === true);
assert('CASE E: no ref.set while WRITE gate suspended', gateResult.writesDuringGate === 0);
assert('CASE E: hubFetchCloudDoc called during pull', gateResult.pullsDuringGate >= 1);
assert('CASE F: cloud write failure not reported as full success', gateResult.saveFailOk === true);
assert('CASE F: pending message shown on write failure', (gateResult.saveFailMessage || '').indexOf('Cloud同期待ち') >= 0);
assert('CASE F: success toast not used on failure', gateResult.saveFailNotSuccessToast === true);

async function browserReadWriteSeparationTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubPullCloudData === 'function' && typeof hubHasLocalDirtyChanges === 'function',
    null,
    { timeout: 60000 }
  );

  const result = await page.evaluate(async () => {
    window.__STORM_REFSETS__ = [];
    window.__STORM_SCHEDULE__ = 0;
    window.__STORM_RUNSAVE__ = 0;

    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    try { hubFirebaseReady = true; hubFirebaseUid = 'storm-test-uid'; } catch (e) {}
    hubAllowAutomaticCloudWrites('storm-test');
    hubClearLocalDirtyForCloud('storm-reset');
    hubClearCloudSaveTimerAndQueue('storm-reset');

    const cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [] },
      revenue: {
        revenueLog: {
          '2026-09-26': {
            ramAccounts: { ram1: { todayRevenue: 50, revision: 8000 } },
            ram: 50,
            total: 50
          }
        },
        salesLog: {}
      },
      settings: { revenueLog: {}, salesLog: {} }
    };

    window.hubFetchCloudWriteGate = function () {
      return Promise.resolve({ suspended: false });
    };
    window.hubFetchCloudDoc = function () {
      return Promise.resolve(cloudPayload);
    };
    window.hubFirestoreDocRef = function () {
      return {
        set: function () {
          window.__STORM_REFSETS__.push(Date.now());
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };

    const origSchedule = hubScheduleCloudSave;
    window.hubScheduleCloudSave = function () {
      window.__STORM_SCHEDULE__ += 1;
      return origSchedule.apply(this, arguments);
    };
    const origRun = hubRunCloudSave;
    window.hubRunCloudSave = function (force) {
      window.__STORM_RUNSAVE__ += 1;
      return origRun.call(this, force);
    };

    function refCount() { return (window.__STORM_REFSETS__ || []).length; }

    await hubPullCloudData('storm-read-only');
    const afterPull = refCount();

    if (typeof hubRefreshViewsAfterSync === 'function') hubRefreshViewsAfterSync(null);
    const afterRefresh = refCount();

    await hubSyncHubData();
    const afterSyncClean = refCount();

    document.dispatchEvent(new Event('visibilitychange'));
    await hubPullCloudDataIfStale('storm-visibility');
    const afterVisibility = refCount();

    window.dispatchEvent(new Event('online'));
    await new Promise(function (r) { setTimeout(r, 100); });
    const afterOnline = refCount();

    hubMarkLocalDirtyForCloud('storm-user-save');
    await hubRunCloudSave(true);
    const afterOneSave = refCount();

    await new Promise(function (r) { setTimeout(r, 1800); });
    const afterIdle = refCount();

    // Mac→Cloud→iPhone pull: cloud has 9/27, local stale
    hubClearLocalDirtyForCloud('storm-device-b');
    cloudPayload.revenue.revenueLog['2026-09-27'] = {
      ramAccounts: { ram1: { todayRevenue: 77, revision: 9000 } },
      ram: 77,
      total: 77
    };
    cloudPayload.updatedAt = 9000;
    await hubPullCloudData('storm-iphone-pull');
    const localHas927 = !!(settings.revenueLog && settings.revenueLog['2026-09-27']);
    const afterIphonePullWrites = refCount();

    return {
      afterPull,
      afterRefresh,
      afterSyncClean,
      afterVisibility,
      afterOnline,
      afterOneSave,
      afterIdle,
      afterIphonePullWrites,
      localHas927,
      scheduleCalls: window.__STORM_SCHEDULE__ || 0,
      runSaveCalls: window.__STORM_RUNSAVE__ || 0,
      dirtyAfterPull: hubHasLocalDirtyChanges()
    };
  });

  await browser.close();
  return result;
}

const stormResult = await browserReadWriteSeparationTests();
assert('CASE G: Cloud READ only → 0 ref.set', stormResult.afterPull === 0);
assert('CASE G: sync refresh render → 0 ref.set', stormResult.afterRefresh === 0);
assert('CASE H: hubSyncHubData while clean → 0 ref.set', stormResult.afterSyncClean === 0);
assert('CASE I: visibility pull while clean → 0 ref.set', stormResult.afterVisibility === 0);
assert('CASE I: online while clean → 0 ref.set', stormResult.afterOnline === 0);
assert('CASE J: one dirty save → exactly 1 ref.set', stormResult.afterOneSave === 1);
assert('CASE K: idle 1.8s → no extra ref.set', stormResult.afterIdle === stormResult.afterOneSave);
assert('CASE L: iPhone pull gets 9/27 without WRITE', stormResult.localHas927 === true);
assert('CASE L: iPhone pull → 0 additional ref.set', stormResult.afterIphonePullWrites === stormResult.afterIdle);
assert('CASE M: pull/merge does not mark dirty', stormResult.dirtyAfterPull === false);

async function browserExplicitRevenueSaveGateTests() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubSaveRevenueWithCloudConfirm === 'function' &&
      typeof hubRunExplicitCloudSaveOnce === 'function',
    null,
    { timeout: 60000 }
  );

  const result = await page.evaluate(async () => {
    let cloudPayload;
    function setupMocks() {
      window.__REV_SAVE_REFSETS__ = [];
      hubIsCloudWriteEnabled = function () { return true; };
      hubIsLocalDevMode = function () { return false; };
      hubIsCloudReadEnabled = function () { return true; };
      try { hubFirebaseReady = true; hubFirebaseUid = 'rev-save-test'; } catch (e) {}
      hubCloudWriteSuspendDepth = 0;
      hubCloudSaveInFlight = false;
      hubPullInFlight = false;
      hubAllowAutomaticCloudWrites('rev-save-test-reset');
      hubClearLocalDirtyForCloud('rev-save-test-reset');
      hubClearCloudSaveTimerAndQueue('rev-save-test-reset');

      cloudPayload = {
        schemaVersion: 2,
        updatedAt: 8000,
        orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
        orcaOrgChart: { members: [{ id: 'o1', parent: null, name: 'O1' }], currentData: [], scenarios: [], rootId: 'o1', rootAccountIds: ['o1'], zoom: 1 },
        eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
        revenue: {
          revenueLog: {
            '2026-09-26': {
              ramAccounts: { r1: { todayRevenue: 40, revision: 8000 } },
              ram: 40,
              total: 40
            }
          },
          salesLog: {}
        },
        settings: { revenueLog: {}, salesLog: {} }
      };

      window.hubFetchCloudWriteGate = function () {
        return Promise.resolve({ suspended: false });
      };
      window.hubFetchCloudDoc = function () {
        return Promise.resolve(cloudPayload);
      };
      window.hubFirestoreDocRef = function () {
        return {
          set: function (payload) {
            window.__REV_SAVE_REFSETS__.push(Date.now());
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

      if (!settings.revenueLog) settings.revenueLog = {};
      settings.revenueLog['2026-09-27'] = {
        ramAccounts: { r1: { todayRevenue: 55, revision: 9000 } },
        orcaAccounts: { o1: { dailyProfit: 12, revision: 9000 } },
        ram: 55,
        orca: 12,
        total: 67
      };
      return cloudPayload;
    }

    function refCount() { return (window.__REV_SAVE_REFSETS__ || []).length; }

    const out = {};

    // A: automatic gate open + manual save → 1 ref.set
    setupMocks();
    hubAllowAutomaticCloudWrites('case-a');
    let baseA = refCount();
    let saveA = await hubSaveRevenueWithCloudConfirm({
      successMessage: '✅ 保存しました',
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    out.caseA = { refSets: refCount() - baseA, ok: saveA.ok, status: saveA.status };

    // B: explicitOnly + manual save → explicit path, 1 ref.set
    setupMocks();
    hubArmCloudWriteExplicitOnly('case-b');
    let baseB = refCount();
    let saveB = await hubSaveRevenueWithCloudConfirm({
      successMessage: '✅ 保存しました',
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    out.caseB = {
      refSets: refCount() - baseB,
      ok: saveB.ok,
      explicitOnlyAfter: hubIsCloudWriteExplicitOnly()
    };

    // C: hard suspend + manual save → 0 ref.set, pending
    setupMocks();
    hubSuspendCloudWrites('case-c');
    let baseC = refCount();
    let saveC = await hubSaveRevenueWithCloudConfirm({
      pendingMessage: '端末に保存済み・Cloud同期待ち',
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    out.caseC = { refSets: refCount() - baseC, ok: saveC.ok, message: saveC.message };

    // H/I: 9/27 on cloud after save; second device pull
    setupMocks();
    hubAllowAutomaticCloudWrites('case-h');
    await hubSaveRevenueWithCloudConfirm({
      successMessage: '✅ 保存しました',
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    let cloudHas927 = !!(cloudPayload.revenue &&
      cloudPayload.revenue.revenueLog &&
      cloudPayload.revenue.revenueLog['2026-09-27']);
    hubClearLocalDirtyForCloud('case-i-device-b');
    delete settings.revenueLog['2026-09-27'];
    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ skipCloud: true });
    let pullWritesBefore = refCount();
    await hubPullCloudData('case-i-pull');
    out.caseHI = {
      cloudHas927: cloudHas927,
      local927AfterPull: !!(settings.revenueLog && settings.revenueLog['2026-09-27']),
      pullExtraWrites: refCount() - pullWritesBefore
    };

    // J: same-day re-save → no double-count on total
    setupMocks();
    hubAllowAutomaticCloudWrites('case-j');
    let saveJ1 = await hubSaveRevenueWithCloudConfirm({
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    let totalAfterFirst = (settings.revenueLog['2026-09-27'] || {}).total;
    let writesBeforeResave = refCount();
    let saveJ2 = await hubSaveRevenueWithCloudConfirm({
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    out.caseJ = {
      firstOk: saveJ1.ok,
      secondOk: saveJ2.ok,
      totalAfterFirst: totalAfterFirst,
      totalAfterResave: (settings.revenueLog['2026-09-27'] || {}).total,
      resaveRefSets: refCount() - writesBeforeResave
    };

    // K: destructive guard blocks naked wipe payload (unit-style in browser)
    setupMocks();
    hubAllowAutomaticCloudWrites('case-k');
    cloudPayload.revenue.revenueLog['2026-08-01'] = {
      ramAccounts: { orphan_cloud_only: { todayRevenue: 99, revision: 7000 } },
      ram: 99,
      total: 99
    };
    let wipePayload = hubPackFirestorePayload(Date.now());
    wipePayload.revenue = { revenueLog: {}, salesLog: {} };
    let guardK = hubGuardDestructiveHubPayloadBeforePush(wipePayload, cloudPayload, 'case-k');
    let baseK = refCount();
    let pushedK = guardK.blocked ? false : await hubRunCloudSave(true);
    out.caseK = {
      refSets: refCount() - baseK,
      pushed: !!pushedK,
      guardBlocked: !!(guardK && guardK.blocked)
    };

    return out;
  });

  await browser.close();
  return result;
}

const revGateResult = await browserExplicitRevenueSaveGateTests();
assert('CASE N-A: gate open + revenue save → 1 ref.set', revGateResult.caseA.refSets === 1);
assert('CASE N-A: gate open + revenue save → synced ok', revGateResult.caseA.ok === true);
assert('CASE N-B: explicitOnly + revenue save → 1 ref.set', revGateResult.caseB.refSets === 1);
assert('CASE N-B: explicitOnly + revenue save → ok', revGateResult.caseB.ok === true);
assert('CASE N-B: explicitOnly remains after explicit save', revGateResult.caseB.explicitOnlyAfter === true);
assert('CASE N-C: hard suspend + revenue save → 0 ref.set', revGateResult.caseC.refSets === 0);
assert('CASE N-C: hard suspend + revenue save → pending', revGateResult.caseC.ok === false);
assert('CASE N-C: hard suspend pending message', (revGateResult.caseC.message || '').indexOf('Cloud同期待ち') >= 0);
assert('CASE N-H: revenue save creates Cloud 9/27', revGateResult.caseHI.cloudHas927 === true);
assert('CASE N-I: other device pull gets 9/27', revGateResult.caseHI.local927AfterPull === true);
assert('CASE N-I: pull after save → 0 extra ref.set', revGateResult.caseHI.pullExtraWrites === 0);
assert('CASE N-J: first save ok', revGateResult.caseJ.firstOk === true);
assert('CASE N-J: same-day re-save no double total', revGateResult.caseJ.totalAfterFirst === revGateResult.caseJ.totalAfterResave);
assert('CASE N-J: re-save still 1 ref.set', revGateResult.caseJ.resaveRefSets === 1);
assert('CASE N-J: second save ok', revGateResult.caseJ.secondOk === true);
assert('CASE N-K: destructive guard blocks wipe payload', revGateResult.caseK.guardBlocked === true);
assert('CASE N-K: destructive guard returns false', revGateResult.caseK.pushed === false);

console.log('\n' + passed + '/' + (passed + failed) + ' PASS');
process.exit(failed ? 1 : 0);
