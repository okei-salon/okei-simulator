#!/usr/bin/env node
/**
 * Pre-deploy final check: idle / read-only / single-save / org render / dirty / writeGate.
 * localhost only — no real Firestore writes (mocked ref.set counter).
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.OUKEI_BASE_URL || 'http://127.0.0.1:5050';
const IDLE_MS = Number(process.env.OUKEI_IDLE_MS || 180000);

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS ' + msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const refSetLogs = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (
      t.includes('ref.set about to write') ||
      t.includes('[hubCloudSave] pre-write') ||
      t.includes('hubRunCloudSave') ||
      t.includes('hubScheduleCloudSave')
    ) {
      refSetLogs.push({ at: Date.now(), text: t.slice(0, 120) });
    }
  });

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubPullCloudData === 'function' && typeof hubHasLocalDirtyChanges === 'function',
    null,
    { timeout: 60000 }
  );

  const setup = await page.evaluate(() => {
    window.__FINAL_REFSETS__ = [];
    window.__FINAL_SCHEDULE__ = 0;
    window.__FINAL_RUNSAVE__ = 0;

    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    try { hubFirebaseReady = true; hubFirebaseUid = 'final-idle-test'; } catch (e) {}
    hubAllowAutomaticCloudWrites('final-test');
    hubClearLocalDirtyForCloud('final-reset');
    hubClearCloudSaveTimerAndQueue('final-reset');

    const cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [] },
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

    window.__FINAL_GATE__ = { suspended: false };
    window.hubFetchCloudWriteGate = function () {
      return Promise.resolve(window.__FINAL_GATE__);
    };
    window.hubFetchCloudDoc = function () {
      return Promise.resolve(cloudPayload);
    };
    window.hubFirestoreDocRef = function () {
      return {
        set: function () {
          window.__FINAL_REFSETS__.push(Date.now());
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };

    const origSchedule = hubScheduleCloudSave;
    window.hubScheduleCloudSave = function () {
      window.__FINAL_SCHEDULE__ += 1;
      return origSchedule.apply(this, arguments);
    };
    const origRun = hubRunCloudSave;
    window.hubRunCloudSave = function (force) {
      window.__FINAL_RUNSAVE__ += 1;
      return origRun.call(this, force);
    };

    return {
      hasOrcaRender: typeof orcaRender === 'function',
      hasEniRender: typeof eniRender === 'function'
    };
  });

  // Phase 1: READ / sync refresh only
  const readOnly = await page.evaluate(async () => {
    function n() { return (window.__FINAL_REFSETS__ || []).length; }
    await hubPullCloudData('final-read');
    const afterPull = n();
    if (typeof hubRefreshViewsAfterSync === 'function') hubRefreshViewsAfterSync(null);
    const afterRefresh = n();
    await hubSyncHubData();
    const afterSync = n();
    document.dispatchEvent(new Event('visibilitychange'));
    await hubPullCloudDataIfStale('final-vis');
    const afterVis = n();
    return {
      afterPull,
      afterRefresh,
      afterSync,
      afterVis,
      dirty: hubHasLocalDirtyChanges()
    };
  });

  assert(readOnly.afterPull === 0, 'read-only: pull → 0 ref.set');
  assert(readOnly.afterRefresh === 0, 'read-only: sync refresh → 0 ref.set');
  assert(readOnly.afterSync === 0, 'read-only: hubSyncHubData clean → 0 ref.set');
  assert(readOnly.afterVis === 0, 'read-only: visibility pull → 0 ref.set');
  assert(readOnly.dirty === false, 'dirty: pull/merge does not mark dirty');

  // Phase 2: ORCA/ENI syncRefresh render
  if (setup.hasOrcaRender) {
    const orca = await page.evaluate(() => {
      const before = (window.__FINAL_REFSETS__ || []).length;
      const beforeDirty = hubHasLocalDirtyChanges();
      if (typeof orcaRender === 'function') orcaRender({ syncRefresh: true });
      return {
        refSets: (window.__FINAL_REFSETS__ || []).length - before,
        dirty: hubHasLocalDirtyChanges(),
        dirtyChanged: hubHasLocalDirtyChanges() !== beforeDirty
      };
    });
    assert(orca.refSets === 0, 'ORCA syncRefresh render → 0 ref.set');
    assert(orca.dirty === false, 'ORCA syncRefresh render → not dirty');
  }

  if (setup.hasEniRender) {
    const eni = await page.evaluate(() => {
      const before = (window.__FINAL_REFSETS__ || []).length;
      if (typeof eniRender === 'function') eniRender({ syncRefresh: true });
      return (window.__FINAL_REFSETS__ || []).length - before;
    });
    assert(eni === 0, 'ENI syncRefresh render → 0 ref.set');
  }

  // Phase 3: single user save → 1 write, idle 1.8s no more
  const saveOnce = await page.evaluate(async () => {
    hubClearLocalDirtyForCloud('before-save');
    const base = (window.__FINAL_REFSETS__ || []).length;
    hubMarkLocalDirtyForCloud('user-save');
    const dirtyBeforeSave = hubHasLocalDirtyChanges();
    await hubRunCloudSave(true);
    const afterSave = (window.__FINAL_REFSETS__ || []).length - base;
    await new Promise((r) => setTimeout(r, 1900));
    const afterIdle = (window.__FINAL_REFSETS__ || []).length - base;
    return {
      afterSave,
      afterIdle,
      dirtyBeforeSave,
      dirtyAfterSuccess: hubHasLocalDirtyChanges()
    };
  });
  assert(saveOnce.dirtyBeforeSave === true, 'dirty marked before user save');
  assert(saveOnce.afterSave === 1, 'one user save → exactly 1 ref.set');
  assert(saveOnce.afterIdle === 1, 'after 1.9s idle → still 1 ref.set (no storm)');
  assert(saveOnce.dirtyAfterSuccess === false, 'dirty cleared after successful Cloud WRITE');

  // Phase 4: localOnly does not mark dirty
  const localOnly = await page.evaluate(() => {
    hubClearLocalDirtyForCloud('localonly-test');
    const before = (window.__FINAL_REFSETS__ || []).length;
    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
    return {
      dirty: hubHasLocalDirtyChanges(),
      refDelta: (window.__FINAL_REFSETS__ || []).length - before
    };
  });
  assert(localOnly.dirty === false, 'localOnly:true → not dirty');
  assert(localOnly.refDelta === 0, 'localOnly:true → 0 ref.set');

  // Phase 5: remote writeGate suspended blocks WRITE, READ allowed
  const gate = await page.evaluate(async () => {
    window.__FINAL_GATE__ = { suspended: true, reason: 'test-gate' };
    hubClearLocalDirtyForCloud('gate-test');
    hubMarkLocalDirtyForCloud('gate-test');
    const base = (window.__FINAL_REFSETS__ || []).length;
    const pullOk = await hubPullCloudData('gate-read');
    const afterPull = (window.__FINAL_REFSETS__ || []).length - base;
    const written = await hubRunCloudSave(true);
    const afterWrite = (window.__FINAL_REFSETS__ || []).length - base;
    window.__FINAL_GATE__ = { suspended: false };
    return { pullOk: !!pullOk, afterPull, written: !!written, afterWrite };
  });
  assert(gate.pullOk === true, 'writeGate suspended → READ still works');
  assert(gate.afterPull === 0, 'writeGate suspended → pull → 0 ref.set');
  assert(gate.written === false, 'writeGate suspended → hubRunCloudSave returns false');
  assert(gate.afterWrite === 0, 'writeGate suspended → 0 ref.set');

  // Phase 6: idle 3 minutes with periodic sync triggers
  const idleStartRefSets = await page.evaluate(() => {
    hubClearLocalDirtyForCloud('idle-start');
    hubClearCloudSaveTimerAndQueue('idle-start');
    window.__FINAL_REFSETS__ = [];
    window.__FINAL_SCHEDULE__ = 0;
    window.__FINAL_RUNSAVE__ = 0;
    window.__FINAL_GATE__ = { suspended: false };
    return 0;
  });

  const idleSec = Math.round(IDLE_MS / 1000);
  console.log(`\n… idle ${idleSec}s (simulated background sync triggers) …`);
  const tickMs = 15000;
  const ticks = Math.ceil(IDLE_MS / tickMs);
  for (let i = 0; i < ticks; i++) {
    await page.evaluate(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
      if (typeof hubPullCloudDataIfStale === 'function') {
        await hubPullCloudDataIfStale('idle-tick-' + Date.now());
      }
      if (typeof hubSyncHubData === 'function') {
        await hubSyncHubData();
      }
    });
    if (i < ticks - 1) await page.waitForTimeout(tickMs);
  }
  await page.waitForTimeout(IDLE_MS % tickMs || 0);

  const idleResult = await page.evaluate(() => ({
    refSets: (window.__FINAL_REFSETS__ || []).length,
    schedule: window.__FINAL_SCHEDULE__ || 0,
    runSave: window.__FINAL_RUNSAVE__ || 0,
    dirty: hubHasLocalDirtyChanges()
  }));

  await browser.close();

  assert(idleResult.refSets === 0, `idle ${idleSec}s + sync triggers → 0 ref.set (got ${idleResult.refSets})`);
  assert(idleResult.dirty === false, `idle ${idleSec}s → remains not dirty`);

  console.log('\n=== FINAL METRICS ===');
  console.log(JSON.stringify({
    idleSeconds: idleSec,
    idleRefSets: idleResult.refSets,
    idleScheduleCalls: idleResult.schedule,
    idleRunSaveCalls: idleResult.runSave,
    oneSaveRefSets: saveOnce.afterSave,
    afterIdleRefSets: saveOnce.afterIdle,
    readOnlyRefSets: readOnly.afterVis,
    consoleNoiseLines: refSetLogs.length
  }, null, 2));

  console.log('\nALL FINAL CHECKS PASSED');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
