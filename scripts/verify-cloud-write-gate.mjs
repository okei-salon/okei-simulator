/**
 * Cloud write gate verification (no RAM restore, no real Firestore).
 * - suspend: all auto paths blocked (ref.set never reached)
 * - resume: does not flush queue / does not write; leaves explicit-only
 * - after resume, schedule/sync/orcaRender still blocked until explicit once
 */
import { chromium } from 'playwright';

const BASE_URL = process.env.OUKEI_BASE_URL || 'http://127.0.0.1:5050';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS ' + msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const refSetLogs = [];
  const gateLogs = [];

  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[hubOrcaPushGuard] ref.set about to write')) refSetLogs.push(t);
    if (t.includes('[hubCloudWriteGate]')) gateLogs.push(t);
  });

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof hubSuspendCloudWrites === 'function' && typeof hubRunCloudSave === 'function', null, {
    timeout: 60000
  });

  const result = await page.evaluate(async () => {
    window.__GATE_REFSETS__ = [];
    window.hubIsCloudWriteEnabled = function () { return true; };
    window.hubIsLocalDevMode = function () { return false; };
    try { hubFirebaseReady = true; } catch (e) {}
    try { hubFirebaseUid = 'gate-test-uid'; } catch (e) {}

    // Fake doc ref: any set() is a failure for this test
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          window.__GATE_REFSETS__.push({ at: Date.now(), keys: payload && Object.keys(payload || {}) });
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: false, data: function () { return null; } });
        },
        delete: function () {
          window.__GATE_REFSETS__.push({ at: Date.now(), delete: true });
          return Promise.resolve();
        }
      };
    };
    window.hubFetchCloudDoc = function () { return Promise.resolve(null); };

    function attack(label) {
      if (typeof hubScheduleCloudSave === 'function') hubScheduleCloudSave(true);
      if (typeof hubScheduleCloudSave === 'function') hubScheduleCloudSave(false);
      if (typeof hubRunCloudSave === 'function') hubRunCloudSave(true);
      if (typeof hubPushCloudDoc === 'function') hubPushCloudDoc(true, null, 'gate-attack:' + label);
      if (typeof hubSyncHubData === 'function') hubSyncHubData();
      if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ immediate: true });
      if (typeof hubSaveNow === 'function') hubSaveNow();
      if (typeof orcaRender === 'function') orcaRender();
      if (typeof render === 'function') render();
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    }

    // Seed timer/queue then suspend must clear them
    hubCloudSaveQueued = true;
    hubCloudSaveTimer = setTimeout(function () {}, 60000);
    hubSuspendCloudWrites('gate-verify');
    const afterSuspend = {
      suspended: hubIsCloudWriteSuspended(),
      queued: !!hubCloudSaveQueued,
      timer: !!hubCloudSaveTimer,
      blocked: hubAreAutomaticCloudWritesBlocked()
    };
    attack('while-suspended');
    await new Promise((r) => setTimeout(r, 1800));
    const writesDuringSuspend = (window.__GATE_REFSETS__ || []).length;

    // Resume alone: must not write; must arm explicit-only and clear queue
    hubCloudSaveQueued = true;
    hubResumeCloudWrites('gate-verify-resume');
    const afterResume = {
      suspended: hubIsCloudWriteSuspended(),
      explicitOnly: hubIsCloudWriteExplicitOnly(),
      blocked: hubAreAutomaticCloudWritesBlocked(),
      queued: !!hubCloudSaveQueued,
      timer: !!hubCloudSaveTimer,
      writes: (window.__GATE_REFSETS__ || []).length
    };
    attack('after-resume-explicit-only');
    await new Promise((r) => setTimeout(r, 1800));
    const writesAfterResumeAttack = (window.__GATE_REFSETS__ || []).length;

    return {
      afterSuspend,
      writesDuringSuspend,
      afterResume,
      writesAfterResumeAttack,
      hasExplicitApi: typeof hubRunExplicitCloudSaveOnce === 'function'
    };
  });

  assert(result.afterSuspend.suspended === true, 'suspend depth active');
  assert(result.afterSuspend.queued === false, 'suspend clears queued save');
  assert(result.afterSuspend.timer === false, 'suspend clears cloud timer');
  assert(result.afterSuspend.blocked === true, 'automatic writes blocked while suspended');
  assert(result.writesDuringSuspend === 0, 'no ref.set while suspended');
  assert(result.afterResume.suspended === false, 'resume clears suspend depth');
  assert(result.afterResume.explicitOnly === true, 'resume arms explicit-only by default');
  assert(result.afterResume.blocked === true, 'explicit-only still blocks automatic writes');
  assert(result.afterResume.queued === false, 'resume clears queued save');
  assert(result.afterResume.writes === 0, 'resume itself does not write');
  assert(result.writesAfterResumeAttack === 0, 'no ref.set after resume auto-path attacks');
  assert(refSetLogs.length === 0, 'no hubOrcaPushGuard ref.set logs');
  assert(result.hasExplicitApi === true, 'hubRunExplicitCloudSaveOnce exported');
  assert(gateLogs.length > 0, 'gate emitted block/suspend logs');

  // Cleanup explicit-only so browser teardown does not matter
  await page.evaluate(() => {
    if (typeof hubAllowAutomaticCloudWrites === 'function') hubAllowAutomaticCloudWrites('gate-verify-cleanup');
  });

  console.log(JSON.stringify({
    ok: true,
    writesDuringSuspend: result.writesDuringSuspend,
    writesAfterResumeAttack: result.writesAfterResumeAttack,
    refSetLogs: refSetLogs.length,
    gateLogs: gateLogs.length
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
