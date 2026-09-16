/**
 * Verify safe RAM-only localOnly restore:
 * - members → 148 from RESTORED_SUCCESS
 * - ORCA / ENI / revenueLog / scenarios / non-RAM settings unchanged
 * - Firestore / hubPushCloudDoc writes = 0 even if orcaRender/hubSaveToStorage fire
 * - visibility / schedule / sync paths blocked while suspended
 *
 * Does NOT touch production. localhost only.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SUCCESS_HUB = path.join(ROOT, 'merge-input', 'OUKEI_HUB_SAFARI_RAM_RESTORED_SUCCESS_20260915.hub');
const BASE_URL = process.env.OUKEI_BASE_URL || 'http://127.0.0.1:5050';

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS ' + msg);
}

function stripRamSettings(settings) {
  const o = JSON.parse(JSON.stringify(settings || {}));
  delete o.ramInputAccounts;
  delete o.removedRamOrgAccountIds;
  delete o.ramRestoredProtectIds;
  delete o.ramRestoredAt;
  return o;
}

async function main() {
  assert(fs.existsSync(SUCCESS_HUB), 'SUCCESS hub file present');
  const success = JSON.parse(fs.readFileSync(SUCCESS_HUB, 'utf8'));
  assert((success.members || []).length === 148, 'success hub members == 148');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const firestoreWriteLogs = [];
  const gateBlockLogs = [];

  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[hubOrcaPushGuard] ref.set') || t.includes('ref.set about to write')) {
      firestoreWriteLogs.push(t);
    }
    if (t.includes('[hubCloudWriteGate] block')) gateBlockLogs.push(t);
  });

  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof hubPackLocalData === 'function' && typeof hubSaveToStorage === 'function', null, {
    timeout: 60000
  });

  // Instrument cloud paths + fake firebase readiness
  await page.evaluate(() => {
    window.__TEST_FIRESTORE_WRITES__ = [];
    window.__TEST_PUSH_CALLS__ = [];
    window.__TEST_SCHEDULE_CALLS__ = [];

    // Force "cloud enabled" so a buggy path would actually try to write
    window.hubIsCloudWriteEnabled = function () { return true; };
    window.hubIsLocalDevMode = function () { return false; };
    if (typeof hubFirebaseReady !== 'undefined') {
      try { hubFirebaseReady = true; } catch (e) {}
    }
    if (typeof hubFirebaseUid !== 'undefined') {
      try { hubFirebaseUid = 'test-uid-ram-localonly'; } catch (e) {}
    }
    try { localStorage.setItem('oukei_hub_v15_uid', 'test-uid-ram-localonly'); } catch (e) {}

    // Wrap schedule / push / sync at function level after gate exists
    const wrap = (name, arr) => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      // Also wrap bare global if same
      const bare = typeof eval(name) === 'function' ? null : null;
      void bare;
    };
    void wrap;

    // Spy ref.set via replacing hubPushCloudDoc after capturing original through gate
    if (typeof hubPushCloudDoc === 'function') {
      const origPush = hubPushCloudDoc;
      window.hubPushCloudDoc = function () {
        window.__TEST_PUSH_CALLS__.push({ at: Date.now(), args: [].slice.call(arguments), suspended: hubIsCloudWriteSuspended && hubIsCloudWriteSuspended() });
        return origPush.apply(this, arguments);
      };
      // Rebind global lexical? cannot. Test will call through hubRunCloudSave which uses lexical hubPushCloudDoc.
    }

    // Patch hubFirestoreDocRef to a fake that records set()
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          window.__TEST_FIRESTORE_WRITES__.push({
            at: Date.now(),
            members: payload && payload.orgChart && payload.orgChart.members
              ? payload.orgChart.members.length
              : null,
            schemaVersion: payload && payload.schemaVersion
          });
          return Promise.resolve();
        },
        get: function () {
          return Promise.resolve({ exists: false, data: function () { return null; } });
        }
      };
    };

    if (typeof hubFetchCloudDoc === 'function') {
      window.hubFetchCloudDoc = function () {
        return Promise.resolve(null);
      };
    }
  });

  // Seed a "production-like" corrupted small RAM + distinct non-RAM markers
  const seedResult = await page.evaluate((successHub) => {
    const uid = 'test-uid-ram-localonly';
    const key = 'oukei_hub_v15_data:' + uid;
    localStorage.setItem('oukei_hub_v15_uid', uid);

    const marker = {
      orcaMarker: 'KEEP_ORCA_' + Date.now(),
      eniMarker: 'KEEP_ENI_' + Date.now(),
      revenueMarkerDay: '2099-01-01',
      scenarioName: 'KEEP_SCENARIO_' + Date.now()
    };

    const base = {
      members: [
        { id: 'm1', parent: null, name: 'kai', username: 'kai', investment: 1200, open: true },
        { id: 'only_corrupt', parent: 'm1', name: 'corrupt', username: 'corrupt', investment: 1, open: true }
      ],
      currentData: [],
      rootId: 'm1',
      rootAccountIds: ['m1'],
      scenarios: [{ id: 'sc_keep', name: marker.scenarioName, members: [] }],
      settings: Object.assign(
        typeof hubCreateDefaultSettings === 'function' ? hubCreateDefaultSettings() : {},
        {
          ramInputAccounts: [{ id: 'm1', name: 'kai' }],
          removedRamOrgAccountIds: ['ghost'],
          revenueLog: {
            '2099-01-01': { accounts: {}, note: marker.revenueMarkerDay }
          },
          useRAM: true,
          useORCA: true,
          currencyMode: 'USD'
        }
      ),
      orcaOrgChart: {
        members: [{ id: 'orca_keep', parent: null, name: marker.orcaMarker, username: 'orca_keep', open: true }],
        currentData: [],
        scenarios: [],
        rootId: 'orca_keep',
        rootAccountIds: ['orca_keep'],
        zoom: 1
      },
      eniOrgChart: {
        members: [{ id: 'eni_keep', parent: null, name: marker.eniMarker, username: 'eni_keep', open: true }],
        currentData: [],
        scenarios: [],
        rootId: 'eni_keep',
        rootAccountIds: ['eni_keep'],
        zoom: 1
      },
      updatedAt: Date.now() - 99999
    };
    base.currentData = JSON.parse(JSON.stringify(base.members));

    localStorage.setItem(key, JSON.stringify(base));
    if (typeof hubBindStorageToUid === 'function') hubBindStorageToUid(uid);
    else if (typeof hubApplyData === 'function') hubApplyData(base, { skipMerge: true });

    // Snapshot non-RAM before restore
    const packed = typeof hubPackLocalData === 'function' ? hubPackLocalData() : base;
    return {
      key,
      marker,
      before: {
        members: (packed.members || []).length,
        orca: packed.orcaOrgChart,
        eni: packed.eniOrgChart,
        scenarios: packed.scenarios,
        revenueLog: packed.settings && packed.settings.revenueLog,
        settingsNonRam: (function (s) {
          const o = JSON.parse(JSON.stringify(s || {}));
          delete o.ramInputAccounts;
          delete o.removedRamOrgAccountIds;
          delete o.ramRestoredProtectIds;
          delete o.ramRestoredAt;
          return o;
        })(packed.settings)
      },
      hasGate: typeof hubSuspendCloudWrites === 'function',
      successMembers: (successHub.members || []).length
    };
  }, success);

  assert(seedResult.hasGate, 'hubSuspendCloudWrites gate present');
  assert(seedResult.before.members === 2, 'seed members == 2');

  // Perform surgical restore with keepCloudSuspended
  const restoreResult = await page.evaluate((successHub) => {
    const beforePack = hubPackLocalData();
    const beforeNonRam = {
      orca: JSON.parse(JSON.stringify(beforePack.orcaOrgChart || null)),
      eni: JSON.parse(JSON.stringify(beforePack.eniOrgChart || null)),
      scenarios: JSON.parse(JSON.stringify(beforePack.scenarios || null)),
      revenueLog: JSON.parse(JSON.stringify((beforePack.settings && beforePack.settings.revenueLog) || {})),
      settingsNonRam: (function (s) {
        const o = JSON.parse(JSON.stringify(s || {}));
        delete o.ramInputAccounts;
        delete o.removedRamOrgAccountIds;
        delete o.ramRestoredProtectIds;
        delete o.ramRestoredAt;
        return o;
      })(beforePack.settings)
    };

    hubSuspendCloudWrites('verify-ram-localonly');
    const result = hubRestoreRamOrgChartFromBackup(successHub, {
      localOnly: true,
      keepCloudSuspended: true,
      render: false
    });

    const afterRestore = hubPackLocalData();
    const nonRamAfterRestore = {
      orcaSame: JSON.stringify(afterRestore.orcaOrgChart || null) === JSON.stringify(beforeNonRam.orca),
      eniSame: JSON.stringify(afterRestore.eniOrgChart || null) === JSON.stringify(beforeNonRam.eni),
      scenariosSame: JSON.stringify(afterRestore.scenarios || null) === JSON.stringify(beforeNonRam.scenarios),
      revenueSame: JSON.stringify((afterRestore.settings && afterRestore.settings.revenueLog) || {}) ===
        JSON.stringify(beforeNonRam.revenueLog),
      settingsNonRamSame: JSON.stringify((function (s) {
        const o = JSON.parse(JSON.stringify(s || {}));
        delete o.ramInputAccounts;
        delete o.removedRamOrgAccountIds;
        delete o.ramRestoredProtectIds;
        delete o.ramRestoredAt;
        return o;
      })(afterRestore.settings)) === JSON.stringify(beforeNonRam.settingsNonRam)
    };

    // Attack paths that caused production storm — must not write Firestore
    window.__TEST_FIRESTORE_WRITES__ = [];
    if (typeof orcaRender === 'function') orcaRender();
    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ immediate: true });
    if (typeof hubScheduleCloudSave === 'function') hubScheduleCloudSave(true);
    if (typeof hubRunCloudSave === 'function') hubRunCloudSave(true);
    if (typeof hubPushCloudDoc === 'function') {
      // Call lexical path via hubRunCloudSave already; also try window export
      hubPushCloudDoc(true, null, 'verify-attack');
    }
    if (typeof hubSyncHubData === 'function') hubSyncHubData();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));

    return new Promise((resolve) => {
      setTimeout(() => {
        const after = hubPackLocalData();
        const lsKey = hubResolveStorageKey();
        const ls = JSON.parse(localStorage.getItem(lsKey) || '{}');
        resolve({
          result,
          suspended: hubIsCloudWriteSuspended(),
          afterMembers: (after.members || []).length,
          lsMembers: (ls.members || []).length,
          roots: (after.rootAccountIds || []).length,
          inputs: ((after.settings && after.settings.ramInputAccounts) || []).length,
          protect: ((after.settings && after.settings.ramRestoredProtectIds) || []).length,
          firestoreWrites: window.__TEST_FIRESTORE_WRITES__ || [],
          nonRam: nonRamAfterRestore,
          // After orcaRender, ORCA live object may gain computed fields; file overwrite must still be absent
          orcaIdStillKeep: ((after.orcaOrgChart && after.orcaOrgChart.members) || [])
            .some(function (m) { return m && m.id === 'orca_keep'; }),
          eniIdStillKeep: ((after.eniOrgChart && after.eniOrgChart.members) || [])
            .some(function (m) { return m && m.id === 'eni_keep'; })
        });
      }, 2000);
    });
  }, success);

  assert(restoreResult.result && restoreResult.result.ok, 'restore ok');
  assert(restoreResult.suspended === true, 'should remain cloud-suspended');
  assert(restoreResult.afterMembers === 148, 'RAM members 148 in memory');
  assert(restoreResult.lsMembers === 148, 'RAM members 148 in LS');
  assert(restoreResult.roots === 8, 'roots 8');
  assert(restoreResult.inputs === 8, 'inputs 8');
  assert(restoreResult.protect === 148, 'protect 148');
  assert(restoreResult.nonRam.orcaSame, 'ORCA unchanged by restore');
  assert(restoreResult.nonRam.eniSame, 'ENI unchanged by restore');
  assert(restoreResult.nonRam.scenariosSame, 'scenarios unchanged by restore');
  assert(restoreResult.nonRam.revenueSame, 'revenueLog unchanged by restore');
  assert(restoreResult.nonRam.settingsNonRamSame, 'non-RAM settings unchanged by restore');
  assert(restoreResult.orcaIdStillKeep, 'ORCA keep id survived attack renders');
  assert(restoreResult.eniIdStillKeep, 'ENI keep id survived attack renders');
  assert(restoreResult.firestoreWrites.length === 0, 'firestore writes == 0');
  assert(firestoreWriteLogs.length === 0, 'ref.set logs == 0');
  assert(gateBlockLogs.length > 0, 'cloud gate emitted block logs');

  // Resume and clear gates so teardown is clean
  await page.evaluate(() => {
    while (typeof hubIsCloudWriteSuspended === 'function' && hubIsCloudWriteSuspended()) {
      hubResumeCloudWrites('verify-cleanup', { allowAutomatic: true });
    }
    if (typeof hubAllowAutomaticCloudWrites === 'function') {
      hubAllowAutomaticCloudWrites('verify-cleanup');
    }
  });

  console.log(JSON.stringify({
    ok: true,
    members: restoreResult.afterMembers,
    nonRam: restoreResult.nonRam,
    firestoreWrites: restoreResult.firestoreWrites.length,
    refSetLogs: firestoreWriteLogs.length,
    gateBlockLogs: gateBlockLogs.length
  }, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
