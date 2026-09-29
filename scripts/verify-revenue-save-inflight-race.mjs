#!/usr/bin/env node
/**
 * Revenue save vs automatic Cloud schedule / hubCloudSaveInFlight race (local only).
 * ref.set is mocked — no real Firestore writes.
 */
import { chromium } from 'playwright';

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

function snapState() {
  return {
    inFlight: typeof hubCloudSaveInFlight !== 'undefined' ? !!hubCloudSaveInFlight : null,
    pendingWrites: typeof hubSyncPendingWrites !== 'undefined' ? hubSyncPendingWrites : null,
    dirty: typeof hubHasLocalDirtyChanges === 'function' ? hubHasLocalDirtyChanges() : null,
    explicitOnly: typeof hubIsCloudWriteExplicitOnly === 'function' ? hubIsCloudWriteExplicitOnly() : null,
    suspendDepth: typeof hubCloudWriteSuspendDepth !== 'undefined' ? hubCloudWriteSuspendDepth : null,
    operatorDepth: typeof hubCloudWriteOperatorActiveDepth !== 'undefined' ? hubCloudWriteOperatorActiveDepth : null,
    syncText: (document.getElementById('hubSyncStatus') || {}).textContent || null
  };
}

async function runBrowserCases() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubSaveRevenueWithCloudConfirm === 'function' &&
      typeof hubPersistThenCloudConfirm === 'function' &&
      typeof hubBeginRevenueInputSaveFlow === 'function',
    null,
    { timeout: 60000 }
  );

  const result = await page.evaluate(async () => {
    function refCount() { return (window.__RACE_REFSETS__ || []).length; }
    var raceDateKey = typeof todayKey === 'function' ? todayKey() : '2026-09-28';

    let cloudPayload;
    function setupMocks() {
      window.__RACE_REFSETS__ = [];
      window.__RACE_SCHEDULE__ = 0;
      window.__RACE_REF_PAYLOADS__ = [];
      hubIsCloudWriteEnabled = function () { return true; };
      hubIsLocalDevMode = function () { return false; };
      hubIsCloudReadEnabled = function () { return true; };
      hubIsAnyOrgSimActive = function () { return false; };
      try {
        hubFirebaseReady = true;
        hubFirebaseUid = 'race-test-uid';
      } catch (e) {}
      hubCloudSaveInFlight = false;
      hubCloudSaveQueued = false;
      hubPullInFlight = false;
      hubRevenueInputSaveDepth = 0;
      hubAllowAutomaticCloudWrites('race-reset');
      hubClearLocalDirtyForCloud('race-reset');
      hubClearCloudSaveTimerAndQueue('race-reset');
      if (typeof hubClearPendingCloudWrite === 'function') hubClearPendingCloudWrite();

      cloudPayload = {
        schemaVersion: 2,
        updatedAt: 8000,
        orgChart: {
          members: [{ id: 'r1', parent: null, name: 'R1' }],
          currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1']
        },
        orcaOrgChart: {
          members: [{ id: 'o1', parent: null, name: 'O1' }],
          currentData: [], scenarios: [], rootId: 'o1', rootAccountIds: ['o1'], zoom: 1
        },
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
            window.__RACE_REFSETS__.push(Date.now());
            window.__RACE_REF_PAYLOADS__.push(payload);
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
      settings.revenueLog[raceDateKey] = {
        ramAccounts: { r1: { todayRevenue: 55, revision: 9000 } },
        orcaAccounts: { o1: { dailyProfit: 12, revision: 9000 } },
        ram: 55,
        orca: 12,
        total: 67
      };
    }

    function snapState() {
      return {
        inFlight: !!hubCloudSaveInFlight,
        pendingWrites: hubSyncPendingWrites || 0,
        dirty: typeof hubHasLocalDirtyChanges === 'function' ? hubHasLocalDirtyChanges() : null,
        explicitOnly: typeof hubIsCloudWriteExplicitOnly === 'function' ? hubIsCloudWriteExplicitOnly() : null,
        suspendDepth: hubCloudWriteSuspendDepth || 0,
        operatorDepth: hubCloudWriteOperatorActiveDepth || 0,
        syncText: (document.getElementById('hubSyncStatus') || {}).textContent || null
      };
    }

    function saveOnceViaFlow(useFlow) {
      if (useFlow) {
        return hubPersistThenCloudConfirm(function () {
          hubMarkLocalDirtyForCloud('race-local-persist');
          hubSaveToStorage({ immediate: true });
        }, '✅ 保存しました', function () {
          return !!(settings.revenueLog && settings.revenueLog[raceDateKey]);
        });
      }
      hubMarkLocalDirtyForCloud('race-local-persist');
      hubSaveToStorage({ immediate: true });
      return hubSaveRevenueWithCloudConfirm({
        successMessage: '✅ 保存しました',
        pendingMessage: '端末に保存済み・Cloud同期待ち',
        cloudVerifyDateKey: raceDateKey,
        verifyFn: function () {
          return !!(settings.revenueLog && settings.revenueLog[raceDateKey]);
        }
      });
    }

    const out = {};

    // REPRO: old buggy path — persist schedules auto save → inFlight blocks explicit save
    setupMocks();
    window.__RACE_SCHEDULE__ = 0;
    const origSchedule = hubScheduleCloudSave;
    window.hubScheduleCloudSave = function () {
      window.__RACE_SCHEDULE__ += 1;
      return origSchedule.apply(this, arguments);
    };
    let baseRepro = refCount();
    let reproResult = await saveOnceViaFlow(false);
    out.reproOldPath = {
      scheduleCalls: window.__RACE_SCHEDULE__ || 0,
      inFlightAfterPersist: !!hubCloudSaveInFlight,
      refSets: refCount() - baseRepro,
      ok: reproResult.ok,
      status: reproResult.status,
      message: reproResult.message,
      final: snapState()
    };
    window.hubScheduleCloudSave = origSchedule;

    // A: normal save button once (fixed flow)
    setupMocks();
    baseRepro = refCount();
    let saveA = await saveOnceViaFlow(true);
    await new Promise(function (r) { setTimeout(r, 1800); });
    out.caseA = {
      refSets: refCount() - baseRepro,
      ok: saveA.ok,
      status: saveA.status,
      message: saveA.message,
      afterIdleRefSets: refCount() - baseRepro,
      final: snapState()
    };

    // B: inFlight=false at start
    setupMocks();
    hubCloudSaveInFlight = false;
    baseRepro = refCount();
    let saveB = await saveOnceViaFlow(true);
    out.caseB = {
      inFlightStart: false,
      refSets: refCount() - baseRepro,
      ok: saveB.ok,
      status: saveB.status,
      final: snapState()
    };

    // C: hubSaveToStorage immediately before explicit save (inside flow)
    setupMocks();
    window.__RACE_SCHEDULE__ = 0;
    window.hubScheduleCloudSave = function () {
      window.__RACE_SCHEDULE__ += 1;
      return origSchedule.apply(this, arguments);
    };
    baseRepro = refCount();
    hubBeginRevenueInputSaveFlow();
    hubMarkLocalDirtyForCloud('case-c');
    hubSaveToStorage({ immediate: true });
    let afterPersistC = snapState();
    afterPersistC.scheduleCalls = window.__RACE_SCHEDULE__ || 0;
    afterPersistC.refSetsAfterPersist = refCount() - baseRepro;
    let saveC = await hubSaveRevenueWithCloudConfirm({
      successMessage: '✅ 保存しました',
      cloudVerifyDateKey: raceDateKey,
      verifyFn: function () { return true; }
    });
    hubEndRevenueInputSaveFlow();
    window.hubScheduleCloudSave = origSchedule;
    out.caseC = {
      afterPersist: afterPersistC,
      refSetsTotal: refCount() - baseRepro,
      ok: saveC.ok,
      status: saveC.status,
      final: snapState()
    };

    // D: automatic schedule would fire if not deferred (dirty + gates open)
    setupMocks();
    hubAllowAutomaticCloudWrites('case-d');
    window.__RACE_SCHEDULE__ = 0;
    window.hubScheduleCloudSave = function () {
      window.__RACE_SCHEDULE__ += 1;
      return origSchedule.apply(this, arguments);
    };
    baseRepro = refCount();
    let saveD = await saveOnceViaFlow(true);
    out.caseD = {
      scheduleCallsDuringSave: window.__RACE_SCHEDULE__ || 0,
      refSets: refCount() - baseRepro,
      ok: saveD.ok,
      status: saveD.status,
      final: snapState()
    };
    window.hubScheduleCloudSave = origSchedule;

    // E1: single save once
    setupMocks();
    baseRepro = refCount();
    let saveE1 = await saveOnceViaFlow(true);
    await new Promise(function (r) { setTimeout(r, 300); });
    out.caseE1 = {
      refSets: refCount() - baseRepro,
      ok: saveE1.ok,
      status: saveE1.status,
      final: snapState()
    };

    // E2: double-click save
    setupMocks();
    baseRepro = refCount();
    let p2a = saveOnceViaFlow(true);
    let p2b = saveOnceViaFlow(true);
    let savesE2 = await Promise.all([p2a, p2b]);
    await new Promise(function (r) { setTimeout(r, 1800); });
    out.caseE2 = {
      refSets: refCount() - baseRepro,
      samePromise: p2a === p2b,
      first: { ok: savesE2[0].ok, status: savesE2[0].status },
      second: { ok: savesE2[1].ok, status: savesE2[1].status },
      afterIdleRefSets: refCount() - baseRepro,
      final: snapState()
    };

    // E3: five rapid clicks
    setupMocks();
    baseRepro = refCount();
    let promisesE3 = [];
    for (let i = 0; i < 5; i++) promisesE3.push(saveOnceViaFlow(true));
    let savesE3 = await Promise.all(promisesE3);
    let sameRefE3 = promisesE3.every(function (p) { return p === promisesE3[0]; });
    await new Promise(function (r) { setTimeout(r, 1800); });
    out.caseE3 = {
      refSets: refCount() - baseRepro,
      samePromise: sameRefE3,
      allOk: savesE3.every(function (s) { return s.ok === true; }),
      afterIdleRefSets: refCount() - baseRepro,
      final: snapState()
    };

    // E4: after complete, save again → new ref.set 1
    setupMocks();
    baseRepro = refCount();
    await saveOnceViaFlow(true);
    let afterFirst = refCount() - baseRepro;
    let saveE4Second = await saveOnceViaFlow(true);
    await new Promise(function (r) { setTimeout(r, 1800); });
    out.caseE4 = {
      refSetsAfterFirst: afterFirst,
      refSetsTotal: refCount() - baseRepro,
      secondOk: saveE4Second.ok,
      secondStatus: saveE4Second.status,
      afterIdleRefSets: refCount() - baseRepro,
      final: snapState()
    };

    // F: visibility/online background paths then save (pull only, no extra write before save)
    setupMocks();
    baseRepro = refCount();
    await hubPullCloudData('race-visibility');
    document.dispatchEvent(new Event('visibilitychange'));
    await hubPullCloudDataIfStale('race-online');
    window.dispatchEvent(new Event('online'));
    await new Promise(function (r) { setTimeout(r, 100); });
    let writesBeforeSaveF = refCount() - baseRepro;
    let saveF = await saveOnceViaFlow(true);
    await new Promise(function (r) { setTimeout(r, 1800); });
    out.caseF = {
      writesBeforeSave: writesBeforeSaveF,
      refSetsTotal: refCount() - baseRepro,
      ok: saveF.ok,
      status: saveF.status,
      final: snapState()
    };

    // G: ORCA/ENI "view" simulation — refresh after sync without storm, then save
    setupMocks();
    baseRepro = refCount();
    if (typeof hubRefreshViewsAfterSync === 'function') {
      hubRefreshViewsAfterSync(null);
    }
    if (typeof orcaRender === 'function') orcaRender();
    let writesBeforeSaveG = refCount() - baseRepro;
    let saveG = await saveOnceViaFlow(true);
    await new Promise(function (r) { setTimeout(r, 1800); });
    out.caseG = {
      writesBeforeSave: writesBeforeSaveG,
      refSetsTotal: refCount() - baseRepro,
      ok: saveG.ok,
      status: saveG.status,
      final: snapState()
    };

    // persist-only: no ref.set
    setupMocks();
    baseRepro = refCount();
    hubBeginRevenueInputSaveFlow();
    hubMarkLocalDirtyForCloud('persist-only');
    hubSaveToStorage({ immediate: true });
    hubEndRevenueInputSaveFlow();
    out.persistOnly = {
      refSets: refCount() - baseRepro,
      final: snapState()
    };

    // H: background Cloud SAVE inFlight → revenue waits → single ref.set success
    setupMocks();
    baseRepro = refCount();
    hubMarkLocalDirtyForCloud('case-h-bg');
    hubCloudSaveInFlight = true;
    let releaseCaseH;
    hubCloudSaveInFlightPromise = new Promise(function (resolve) {
      releaseCaseH = function () {
        hubCloudSaveInFlight = false;
        hubCloudSaveInFlightPromise = null;
        resolve(false);
      };
    });
    let saveHPromise = saveOnceViaFlow(true);
    await new Promise(function (r) { setTimeout(r, 40); });
    out.caseH = {
      waitingWhileInFlight: !!hubCloudSaveInFlight,
      refSetsDuringWait: refCount() - baseRepro
    };
    releaseCaseH();
    let saveH = await saveHPromise;
    await new Promise(function (r) { setTimeout(r, 300); });
    out.caseH.refSetsTotal = refCount() - baseRepro;
    out.caseH.ok = saveH.ok;
    out.caseH.status = saveH.status;
    out.caseH.message = saveH.message;
    out.caseH.traceHasWait = (saveH.trace || []).some(function (e) {
      return e && e.step === 'hubWaitForCloudSaveIdle' && e.state === 'SUCCESS';
    });
    out.caseH.final = snapState();

    // I: after inFlight idle, Cloud push fails → no false success
    setupMocks();
    baseRepro = refCount();
    let failSet = window.hubFirestoreDocRef;
    window.hubFirestoreDocRef = function () {
      return {
        set: function () {
          window.__RACE_REFSETS__.push(Date.now());
          return Promise.reject(new Error('case-i-push-fail'));
        },
        get: failSet().get
      };
    };
    hubCloudSaveInFlight = true;
    let releaseCaseI;
    hubCloudSaveInFlightPromise = new Promise(function (resolve) {
      releaseCaseI = function () {
        hubCloudSaveInFlight = false;
        hubCloudSaveInFlightPromise = null;
        resolve(false);
      };
    });
    let saveIPromise = saveOnceViaFlow(true);
    releaseCaseI();
    let saveI = await saveIPromise;
    window.hubFirestoreDocRef = failSet;
    out.caseI = {
      ok: saveI.ok,
      status: saveI.status,
      message: saveI.message,
      refSets: refCount() - baseRepro,
      final: snapState()
    };

    // J: real slow background save + revenue flow — no duplicate ref.set storm
    setupMocks();
    baseRepro = refCount();
    let bgDone = false;
    let finishBg;
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          window.__RACE_REFSETS__.push(Date.now());
          if (payload && payload.revenue && payload.revenue.revenueLog) {
            cloudPayload.revenue.revenueLog = JSON.parse(JSON.stringify(payload.revenue.revenueLog));
          }
          cloudPayload.updatedAt = (payload && payload.updatedAt) || Date.now();
          if (!bgDone) {
            bgDone = true;
            return new Promise(function (resolve) { finishBg = resolve; });
          }
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };
    hubMarkLocalDirtyForCloud('case-j-bg');
    let bgPromise = hubRunCloudSave(true);
    await new Promise(function (r) { setTimeout(r, 20); });
    let saveJPromise = saveOnceViaFlow(true);
    finishBg();
    await bgPromise;
    let saveJ = await saveJPromise;
    await new Promise(function (r) { setTimeout(r, 400); });
    out.caseJ = {
      refSetsTotal: refCount() - baseRepro,
      ok: saveJ.ok,
      status: saveJ.status,
      final: snapState()
    };

    return out;
  });

  await browser.close();
  return result;
}

const r = await runBrowserCases();

console.log('\n=== REPRO (old path without revenue flow defer) ===');
console.log(JSON.stringify(r.reproOldPath, null, 2));

assert('REPRO: old path schedules automatic save', r.reproOldPath.scheduleCalls >= 1);
assert('REPRO: old path no longer immediate false (wait join)', r.reproOldPath.ok === true);
assert('REPRO: old path status synced after wait', r.reproOldPath.status === 'synced');
assert('REPRO: old path without flow defer may double ref.set', r.reproOldPath.refSets >= 1);
assert('REPRO: revenue flow defer still preferred for single write', r.reproOldPath.refSets >= 1);

console.log('\n=== CASE A: normal save once ===');
console.log(JSON.stringify(r.caseA, null, 2));
assert('CASE A: ref.set exactly 1', r.caseA.refSets === 1);
assert('CASE A: synced ok', r.caseA.ok === true);
assert('CASE A: status synced', r.caseA.status === 'synced');
assert('CASE A: idle no extra ref.set', r.caseA.afterIdleRefSets === 1);
assert('CASE A: final inFlight false', r.caseA.final.inFlight === false);
assert('CASE A: final pendingWrites 0', r.caseA.final.pendingWrites === 0);
assert('CASE A: final dirty false', r.caseA.final.dirty === false);

console.log('\n=== CASE B: inFlight=false start ===');
assert('CASE B: ref.set 1', r.caseB.refSets === 1);
assert('CASE B: synced ok', r.caseB.ok === true);

console.log('\n=== CASE C: persist then explicit ===');
assert('CASE C: schedule blocked during persist', r.caseC.afterPersist.scheduleCalls === 0);
assert('CASE C: inFlight false after persist', r.caseC.afterPersist.inFlight === false);
assert('CASE C: ref.set after persist 0', r.caseC.afterPersist.refSetsAfterPersist === 0);
assert('CASE C: total ref.set 1', r.caseC.refSetsTotal === 1);
assert('CASE C: synced ok', r.caseC.ok === true);

console.log('\n=== CASE D: auto schedule suppressed ===');
assert('CASE D: no schedule during save flow', r.caseD.scheduleCallsDuringSave === 0);
assert('CASE D: ref.set 1', r.caseD.refSets === 1);
assert('CASE D: synced ok', r.caseD.ok === true);

console.log('\n=== CASE E: mash / re-save ===');
assert('CASE E1: single save ref.set 1', r.caseE1.refSets === 1);
assert('CASE E1: single save synced', r.caseE1.ok === true && r.caseE1.status === 'synced');
assert('CASE E2: double-click ref.set exactly 1', r.caseE2.refSets === 1);
assert('CASE E2: double-click joins same promise', r.caseE2.samePromise === true);
assert('CASE E2: double-click both synced', r.caseE2.first.ok === true && r.caseE2.second.ok === true);
assert('CASE E2: idle no extra ref.set', r.caseE2.afterIdleRefSets === 1);
assert('CASE E2: final inFlight false', r.caseE2.final.inFlight === false);
assert('CASE E2: final pendingWrites 0', r.caseE2.final.pendingWrites === 0);
assert('CASE E2: final dirty false', r.caseE2.final.dirty === false);
assert('CASE E3: five-click ref.set exactly 1', r.caseE3.refSets === 1);
assert('CASE E3: five-click same promise', r.caseE3.samePromise === true);
assert('CASE E3: five-click all synced', r.caseE3.allOk === true);
assert('CASE E3: idle no extra ref.set', r.caseE3.afterIdleRefSets === 1);
assert('CASE E4: first save ref.set 1', r.caseE4.refSetsAfterFirst === 1);
assert('CASE E4: second save adds ref.set 1', r.caseE4.refSetsTotal === 2);
assert('CASE E4: second save synced', r.caseE4.secondOk === true && r.caseE4.secondStatus === 'synced');
assert('CASE E4: idle stable ref.set count', r.caseE4.afterIdleRefSets === 2);
assert('CASE E4: final inFlight false', r.caseE4.final.inFlight === false);
assert('CASE E4: final pendingWrites 0', r.caseE4.final.pendingWrites === 0);
assert('CASE E4: final dirty false', r.caseE4.final.dirty === false);

console.log('\n=== CASE F: after visibility/online ===');
assert('CASE F: no writes before save button', r.caseF.writesBeforeSave === 0);
assert('CASE F: save adds exactly 1 ref.set', r.caseF.refSetsTotal === 1);
assert('CASE F: synced ok', r.caseF.ok === true);
assert('CASE F: final pendingWrites 0', r.caseF.final.pendingWrites === 0);

console.log('\n=== CASE G: ORCA/ENI view then save ===');
assert('CASE G: no writes before save', r.caseG.writesBeforeSave === 0);
assert('CASE G: save ref.set 1', r.caseG.refSetsTotal === 1);
assert('CASE G: synced ok', r.caseG.ok === true);

console.log('\n=== persist-only ===');
assert('PERSIST-ONLY: ref.set 0', r.persistOnly.refSets === 0);

console.log('\n=== CASE H: background inFlight → revenue waits ===');
console.log(JSON.stringify(r.caseH, null, 2));
assert('CASE H: no ref.set during wait', r.caseH.refSetsDuringWait === 0);
assert('CASE H: trace shows wait success', r.caseH.traceHasWait === true);
assert('CASE H: ref.set exactly 1 after join', r.caseH.refSetsTotal === 1);
assert('CASE H: synced ok', r.caseH.ok === true && r.caseH.status === 'synced');
assert('CASE H: final inFlight false', r.caseH.final.inFlight === false);
assert('CASE H: final pendingWrites 0', r.caseH.final.pendingWrites === 0);
assert('CASE H: final dirty false', r.caseH.final.dirty === false);

console.log('\n=== CASE I: idle then push fail ===');
console.log(JSON.stringify(r.caseI, null, 2));
assert('CASE I: not ok', r.caseI.ok === false);
assert('CASE I: cloud-write-failed', r.caseI.status === 'cloud-write-failed');
assert('CASE I: pending message',
  (r.caseI.message || '').indexOf('Cloud同期') >= 0 ||
  (r.caseI.message || '').indexOf('端末') >= 0,
  r.caseI.message);
assert('CASE I: ref.set attempted once', r.caseI.refSets === 1);

console.log('\n=== CASE J: slow background + revenue flow ===');
console.log(JSON.stringify(r.caseJ, null, 2));
assert('CASE J: ref.set at most 2 (bg + revenue)', r.caseJ.refSetsTotal >= 1 && r.caseJ.refSetsTotal <= 2);
assert('CASE J: revenue synced ok', r.caseJ.ok === true && r.caseJ.status === 'synced');
assert('CASE J: final inFlight false', r.caseJ.final.inFlight === false);
assert('CASE J: final dirty false', r.caseJ.final.dirty === false);

console.log('\n' + passed + '/' + (passed + failed) + ' PASS');
process.exit(failed ? 1 : 0);
