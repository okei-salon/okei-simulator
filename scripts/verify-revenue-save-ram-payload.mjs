#!/usr/bin/env node
/**
 * Revenue save — RAM payload pin, strict Cloud verify, pull guard (mocked ref.set).
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
      typeof hubCaptureRevenueSaveSnapshotFromMeta === 'function' &&
      typeof hubPinRevenueSaveSnapshotToPayload === 'function',
    null,
    { timeout: 60000 }
  );
  return page.evaluate(async ({ setup, run }) => {
    if (setup) eval(setup);
    return eval('(' + run + ')()');
  }, { setup: setupCode, run: runCode });
}

function baseMocks(dateKey) {
  return `
    var dateKey = ${JSON.stringify(dateKey)};
    var cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
      orcaOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      revenue: {
        revenueLog: {
          [dateKey]: {
            orca: 110.99,
            bitsync: 60.01,
            total: 171,
            ram: 0,
            ramAccounts: {},
            orcaAccounts: { o1: { yesterdayAiProfit: 1, todayAffiliateProfit: 2, revision: 8000 } },
            bitsyncAccounts: { b1: { nftSaleReward: 60, total: 60.01, revision: 8000 } }
          }
        },
        salesLog: {}
      },
      settings: { revenueLog: {}, salesLog: {} }
    };
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    hubIsAnyOrgSimActive = function () { return false; };
    hubFirebaseReady = true;
    hubFirebaseUid = 'verify-ram-payload-uid';
    hubCloudSaveInFlight = false;
    hubRevenueInputSaveDepth = 0;
    hubAllowAutomaticCloudWrites('verify-ram-payload');
    hubClearLocalDirtyForCloud('verify-ram-payload');
    hubClearCloudSaveTimerAndQueue('verify-ram-payload');
    hubClearPendingCloudWrite();
    hubClearRevenueSavePendingSnapshot();
    window.__PAYLOAD_REFSETS__ = [];
    window.__PULL_DURING_SAVE__ = 0;
    window.hubFetchCloudWriteGate = function () { return Promise.resolve({ suspended: false }); };
    window.hubFetchCloudDoc = function () {
      return Promise.resolve(JSON.parse(JSON.stringify(cloudPayload)));
    };
    window.hubPullCloudData = function () {
      window.__PULL_DURING_SAVE__ += 1;
      return Promise.resolve(false);
    };
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          window.__PAYLOAD_REFSETS__.push(JSON.parse(JSON.stringify(payload)));
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
  `;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const dateKey = '2026-09-29';
  const iphone = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await iphone.newPage();

  const singleRam = await runCase(page, baseMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 42.5, revision: 9000 } },
      ram: 42.5,
      orca: 110.99,
      bitsync: 60.01,
      total: 213.5
    };
    hubLocalUpdatedAt = Date.now();
    var result = await hubPersistThenCloudConfirm(function () {
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 42.5, revision: 9000 } },
          ram: 42.5
        });
      }
      if (typeof hubFlushRevenueSaveLocalPersist === 'function') hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog[dateKey] && settings.revenueLog[dateKey].ramAccounts.r1);
    }, hubRevenueSaveMeta('ram', dateKey));
    var payload = (window.__PAYLOAD_REFSETS__ || [])[0];
    var day = payload && payload.revenue && payload.revenue.revenueLog
      ? payload.revenue.revenueLog[dateKey] : null;
    var payloadTotal = day && typeof pdSumProjectDayRevenue === 'function'
      ? Number(pdSumProjectDayRevenue(day, 'ram', dateKey)) || 0
      : Number(day && day.ram) || 0;
    var expectedTotal = typeof pdSumProjectDayRevenue === 'function'
      ? Number(pdSumProjectDayRevenue(settings.revenueLog[dateKey], 'ram', dateKey)) || 0
      : 42.5;
    return {
      ok: result.ok,
      verifySoft: !!result.verifySoft,
      payloadRamIds: day && day.ramAccounts ? Object.keys(day.ramAccounts) : [],
      payloadRamTotal: payloadTotal,
      expectedTotal: expectedTotal,
      pullDuring: window.__PULL_DURING_SAVE__ || 0
    };
  }`);

  assert('RAM-1: save ok with strict verify', singleRam.ok === true, JSON.stringify(singleRam));
  assert('RAM-1: no soft verify flag', singleRam.verifySoft !== true, JSON.stringify(singleRam));
  assert('RAM-1: ramAccounts in ref.set payload', singleRam.payloadRamIds.indexOf('r1') >= 0, JSON.stringify(singleRam));
  assert('RAM-1: ram total in payload', singleRam.payloadRamTotal === singleRam.expectedTotal,
    'payload=' + singleRam.payloadRamTotal + ' expected=' + singleRam.expectedTotal);

  const multiRam = await runCase(page, baseMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      ramAccounts: {
        r1: { todayRevenue: 10, revision: 9001 },
        r2: { todayRevenue: 20, revision: 9002 }
      },
      ram: 30,
      total: 201
    };
    hubLocalUpdatedAt = Date.now();
    var result = await hubPersistThenCloudConfirm(function () {
      pdMergeRevenueEntry(dateKey, {
        ramAccounts: {
          r1: { todayRevenue: 10, revision: 9001 },
          r2: { todayRevenue: 20, revision: 9002 }
        },
        ram: 30
      });
      hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return Object.keys(settings.revenueLog[dateKey].ramAccounts).length === 2;
    }, hubRevenueSaveMeta('ram', dateKey));
    var payload = window.__PAYLOAD_REFSETS__[0];
    var day = payload.revenue.revenueLog[dateKey];
    var payloadTotal = typeof pdSumProjectDayRevenue === 'function'
      ? Number(pdSumProjectDayRevenue(day, 'ram', dateKey)) || 0
      : Number(day.ram) || 0;
    var expectedTotal = typeof pdSumProjectDayRevenue === 'function'
      ? Number(pdSumProjectDayRevenue(settings.revenueLog[dateKey], 'ram', dateKey)) || 0
      : 30;
    return {
      ok: result.ok,
      count: day && day.ramAccounts ? Object.keys(day.ramAccounts).length : 0,
      total: payloadTotal,
      expectedTotal: expectedTotal
    };
  }`);

  assert('RAM-MULTI: save ok', multiRam.ok === true, JSON.stringify(multiRam));
  assert('RAM-MULTI: two accounts in payload', multiRam.count === 2, 'count=' + multiRam.count);
  assert('RAM-MULTI: total matches snapshot', multiRam.total === multiRam.expectedTotal,
    'total=' + multiRam.total + ' expected=' + multiRam.expectedTotal);

  const updatedAtOnlyFail = await runCase(page, baseMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 55, revision: 9000 } },
      ram: 55,
      total: 226
    };
    hubLocalUpdatedAt = Date.now();
    var origRef = window.hubFirestoreDocRef;
    window.hubFirestoreDocRef = function () {
      return {
        set: function (payload) {
          cloudPayload.updatedAt = (payload && payload.updatedAt) || Date.now();
          return Promise.resolve();
        },
        get: function () { return origRef().get(); }
      };
    };
    var result = await hubPersistThenCloudConfirm(function () {
      pdMergeRevenueEntry(dateKey, {
        ramAccounts: { r1: { todayRevenue: 55, revision: 9000 } },
        ram: 55
      });
      hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog[dateKey].ramAccounts.r1);
    }, hubRevenueSaveMeta('ram', dateKey));
    return {
      ok: result.ok,
      status: result.status,
      message: result.message,
      strictVerifyFail: !!result.strictVerifyFail
    };
  }`);

  assert('STRICT: updatedAt-only write fails verify', updatedAtOnlyFail.ok === false, JSON.stringify(updatedAtOnlyFail));
  assert('STRICT: status verify-failed', updatedAtOnlyFail.status === 'verify-failed', updatedAtOnlyFail.status);
  assert('STRICT: RAM error message', String(updatedAtOnlyFail.message || '').indexOf('RAM') >= 0, updatedAtOnlyFail.message);
  assert('STRICT: strictVerifyFail flag', updatedAtOnlyFail.strictVerifyFail === true, '');

  const pinBlocksMissing = await runCase(page, baseMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 33, revision: 9000 } },
      ram: 33
    };
    var snap = hubCaptureRevenueSaveSnapshotFromMeta(hubRevenueSaveMeta('ram', dateKey));
    var badPayload = {
      revenue: {
        revenueLog: {
          [dateKey]: { ram: 0, ramAccounts: {}, orca: 110.99, total: 171 }
        }
      }
    };
    var matches = hubPayloadMatchesRevenueSnapshot(badPayload, snap);
    var goodPayload = { revenue: { revenueLog: {} } };
    hubPinRevenueSaveSnapshotToPayload(goodPayload, snap);
    var pinnedDay = goodPayload.revenue.revenueLog[dateKey];
    var pinnedIds = pinnedDay && pinnedDay.ramAccounts ? Object.keys(pinnedDay.ramAccounts) : [];
    return {
      matchesBad: matches,
      pinnedIds: pinnedIds,
      pinnedRevenue: pinnedDay && pinnedDay.ramAccounts && pinnedDay.ramAccounts.r1
        ? pinnedDay.ramAccounts.r1.todayRevenue
        : null,
      accountCount: snap.accountCount
    };
  }`);

  assert('PIN: empty ramAccounts payload fails snapshot match', pinBlocksMissing.matchesBad === false, JSON.stringify(pinBlocksMissing));
  assert('PIN: pinned payload includes ram account', pinBlocksMissing.pinnedIds.indexOf('r1') >= 0, JSON.stringify(pinBlocksMissing));
  assert('PIN: pinned todayRevenue preserved', Number(pinBlocksMissing.pinnedRevenue) === 33,
    'todayRevenue=' + pinBlocksMissing.pinnedRevenue);
  assert('PIN: snapshot captured account count', pinBlocksMissing.accountCount === 1, 'count=' + pinBlocksMissing.accountCount);

  const orcaCase = await runCase(page, baseMocks(dateKey), `async function() {
    settings.revenueLog[dateKey] = {
      orcaAccounts: { o2: { yesterdayAiProfit: 3, todayAffiliateProfit: 4, revision: 9100 } },
      orca: 7,
      total: 7
    };
    hubLocalUpdatedAt = Date.now();
    var result = await hubPersistThenCloudConfirm(function () {
      pdMergeRevenueEntry(dateKey, {
        orcaAccounts: { o2: { yesterdayAiProfit: 3, todayAffiliateProfit: 4, revision: 9100 } },
        orca: 7
      });
      hubFlushRevenueSaveLocalPersist();
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog[dateKey].orcaAccounts.o2);
    }, hubRevenueSaveMeta('orca', dateKey));
    var day = window.__PAYLOAD_REFSETS__[0].revenue.revenueLog[dateKey];
    return {
      ok: result.ok,
      orcaIds: day && day.orcaAccounts ? Object.keys(day.orcaAccounts) : []
    };
  }`);

  assert('ORCA: strict save ok', orcaCase.ok === true, JSON.stringify(orcaCase));
  assert('ORCA: orcaAccounts in payload', orcaCase.orcaIds.indexOf('o2') >= 0, JSON.stringify(orcaCase));

  await browser.close();
  console.log('\n' + passed + '/' + (passed + failed) + ' PASS');
  process.exit(failed ? 1 : 0);
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
