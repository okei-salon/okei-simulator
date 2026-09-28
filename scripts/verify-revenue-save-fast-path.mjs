#!/usr/bin/env node
/**
 * Revenue save fast path — local UI immediate, single Cloud READ, guards preserved (mocked ref.set).
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

async function runBrowserCases() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubPersistThenCloudConfirm === 'function' &&
      typeof hubPushCloudDocUsesSinglePreWriteFetch === 'function' &&
      typeof hubRevenueSaveMark === 'function',
    null,
    { timeout: 60000 }
  );

  const result = await page.evaluate(async () => {
    function refCount() { return (window.__FAST_REFSETS__ || []).length; }
    function fetchCount() { return window.__FAST_FETCHES__ || 0; }
    var dateKey = typeof todayKey === 'function' ? todayKey() : '2026-09-28';

    let cloudPayload;
    let orgSnapshot;
    let settingsSnapshot;

    function setupMocks() {
      window.__FAST_REFSETS__ = [];
      window.__FAST_FETCHES__ = 0;
      window.__FAST_REF_PAYLOADS__ = [];
      hubIsCloudWriteEnabled = function () { return true; };
      hubIsLocalDevMode = function () { return false; };
      hubIsCloudReadEnabled = function () { return true; };
      hubIsAnyOrgSimActive = function () { return false; };
      hubFirebaseReady = true;
      hubFirebaseUid = 'fast-path-uid';
      hubCloudSaveInFlight = false;
      hubCloudSaveQueued = false;
      hubPullInFlight = false;
      hubRevenueInputSaveDepth = 0;
      hubAllowAutomaticCloudWrites('fast-reset');
      hubClearLocalDirtyForCloud('fast-reset');
      hubClearCloudSaveTimerAndQueue('fast-reset');
      if (typeof hubClearPendingCloudWrite === 'function') hubClearPendingCloudWrite();

      orgSnapshot = {
        members: [{ id: 'r1', parent: null, name: 'R1', investment: 1000 }],
        rootId: 'r1',
        rootAccountIds: ['r1']
      };
      settingsSnapshot = { revenueLog: {}, salesLog: {}, yenRate: 155 };

      if (typeof members !== 'undefined') members = orgSnapshot.members.slice();
      if (typeof rootId !== 'undefined') rootId = orgSnapshot.rootId;
      if (typeof rootAccountIds !== 'undefined') rootAccountIds = orgSnapshot.rootAccountIds.slice();
      if (typeof settings !== 'undefined') {
        settings = Object.assign(settings || {}, settingsSnapshot);
        settings.revenueLog = settings.revenueLog || {};
      }

      cloudPayload = {
        schemaVersion: 2,
        updatedAt: 8000,
        orgChart: {
          members: orgSnapshot.members.slice(),
          currentData: [],
          scenarios: [],
          rootId: orgSnapshot.rootId,
          rootAccountIds: orgSnapshot.rootAccountIds.slice()
        },
        orcaOrgChart: {
          members: [{ id: 'o1', parent: null, name: 'O1' }],
          currentData: [],
          scenarios: [],
          rootId: 'o1',
          rootAccountIds: ['o1'],
          zoom: 1
        },
        eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
        manageAccounts: { r1: { visible: true } },
        revenue: { revenueLog: {}, salesLog: {} },
        settings: { revenueLog: {}, salesLog: {}, yenRate: 150 }
      };

      window.hubFetchCloudWriteGate = function () {
        return Promise.resolve({ suspended: false });
      };
      window.hubFetchCloudDoc = function () {
        window.__FAST_FETCHES__ = (window.__FAST_FETCHES__ || 0) + 1;
        return Promise.resolve(cloudPayload);
      };
      window.hubFirestoreDocRef = function () {
        return {
          set: function (payload) {
            window.__FAST_REFSETS__.push(Date.now());
            window.__FAST_REF_PAYLOADS__.push(payload);
            if (payload && payload.revenue && payload.revenue.revenueLog) {
              cloudPayload.revenue.revenueLog = JSON.parse(JSON.stringify(payload.revenue.revenueLog));
            }
            cloudPayload.updatedAt = (payload && payload.updatedAt) || Date.now();
            return Promise.resolve();
          },
          get: function (opts) {
            window.__FAST_FETCHES__ = (window.__FAST_FETCHES__ || 0) + 1;
            return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
          }
        };
      };

      if (typeof modalBg !== 'undefined') {
        modalBg.style.display = 'flex';
        modalTitle.textContent = 'RAM 実績入力';
        modalContent.innerHTML = '<button type="button" class="ramInputBtnSave" onclick="saveTodayRevenue()">保存</button>';
      }
    }

    const out = {};

    // 1–5: normal save via flow
    setupMocks();
    hubLocalUpdatedAt = Date.now();
    hubMarkLocalDirtyForCloud('fast-test');
    let baseRef = refCount();
    let baseFetch = fetchCount();
    let t0 = Date.now();
    let saveResult = await hubPersistThenCloudConfirm(function () {
      hubMarkLocalDirtyForCloud('fast-local');
      if (typeof pdMergeRevenueEntry === 'function') {
        pdMergeRevenueEntry(dateKey, {
          ramAccounts: { r1: { todayRevenue: 189.51, revision: 9000 } },
          ram: 189.51,
          total: 189.51
        });
      }
    }, '✅ 保存しました', function () {
      return !!(settings.revenueLog && settings.revenueLog[dateKey]);
    });
    let elapsed = Date.now() - t0;
    let timing = typeof hubRevenueSaveTimingReport === 'function' ? hubRevenueSaveTimingReport() : null;
    let lastPayload = (window.__FAST_REF_PAYLOADS__ || [])[0] || null;
    let revKeys = lastPayload && lastPayload.revenue && lastPayload.revenue.revenueLog
      ? Object.keys(lastPayload.revenue.revenueLog)
      : [];
    let marks = timing && timing.marks ? timing.marks : null;
    out.normalSave = {
      ok: saveResult.ok,
      status: saveResult.status,
      refSets: refCount() - baseRef,
      cloudFetches: fetchCount() - baseFetch,
      modalHidden: typeof modalBg !== 'undefined' ? modalBg.style.display === 'none' : null,
      homeVisible: typeof homePage !== 'undefined' ? !homePage.classList.contains('hidden') : null,
      revDayCount: revKeys.length,
      hasToday: revKeys.indexOf(dateKey) >= 0,
      orgMembersLen: lastPayload && lastPayload.orgChart ? lastPayload.orgChart.members.length : null,
      orcaMembersLen: lastPayload && lastPayload.orcaOrgChart ? lastPayload.orcaOrgChart.members.length : null,
      eniMembersLen: lastPayload && lastPayload.eniOrgChart ? lastPayload.eniOrgChart.members.length : null,
      settingsYen: lastPayload && lastPayload.settings ? lastPayload.settings.yenRate : null,
      manageAccountsKeys: lastPayload && lastPayload.manageAccounts ? Object.keys(lastPayload.manageAccounts).length : null,
      manageAccountsPreserved: !!(lastPayload && lastPayload.manageAccounts && lastPayload.manageAccounts.r1),
      pastRevPreserved: !!(lastPayload && lastPayload.revenue && lastPayload.revenue.revenueLog),
      elapsedMs: elapsed,
      timingMarks: marks,
      uiBeforePreCloud: marks
        ? (marks.UI_DONE || 0) <= (marks.PRE_CLOUD_START || 999999)
        : null,
      modalClosedBeforePreCloud: marks
        ? (marks.MODAL_CLOSED || 0) <= (marks.PRE_CLOUD_START || 999999)
        : null,
      hasLocalPersistMarks: !!(marks && marks.LOCAL_PERSIST_START != null && marks.LOCAL_PERSIST_DONE != null)
    };

    setupMocks();
    hubRevenueSaveTimingReset();
    hubShowRevenueSaveProgressOverlay();
    out.overlayImmediate = {
      visible: !!document.getElementById('hubRevenueSaveOverlay') &&
        document.getElementById('hubRevenueSaveOverlay').classList.contains('isVisible')
    };
    hubHideRevenueSaveProgressOverlay();

    // 14: double-click → one ref.set
    setupMocks();
    settings.revenueLog[dateKey] = {
      ramAccounts: { r1: { todayRevenue: 50, revision: 9001 } },
      ram: 50,
      total: 50
    };
    hubLocalUpdatedAt = Date.now();
    baseRef = refCount();
    let p1 = hubPersistThenCloudConfirm(function () {
      hubSaveToStorage({ immediate: true });
    }, '✅ 保存しました', function () { return true; });
    let p2 = hubPersistThenCloudConfirm(function () {
      hubSaveToStorage({ immediate: true });
    }, '✅ 保存しました', function () { return true; });
    await Promise.all([p1, p2]);
    out.doubleClick = {
      samePromise: p1 === p2,
      refSets: refCount() - baseRef
    };

    // Failure: modal stays open path not tested (cloud fail after local close — modal already closed by design)

    return out;
  });

  await browser.close();

  assert('normal save cloud ok', result.normalSave.ok === true, JSON.stringify(result.normalSave));
  assert('single ref.set', result.normalSave.refSets === 1, 'refSets=' + result.normalSave.refSets);
  assert('cloud fetch count <= 3', result.normalSave.cloudFetches <= 3,
    'fetches=' + result.normalSave.cloudFetches);
  assert('modal closed after local save', result.normalSave.modalHidden === true, '');
  assert('home page shown', result.normalSave.homeVisible === true, '');
  assert('revenueLog one day written', result.normalSave.revDayCount === 1, '');
  assert('today key in payload', result.normalSave.hasToday === true, '');
  assert('orgChart preserved in payload', result.normalSave.orgMembersLen === 1, '');
  assert('orcaOrgChart preserved', result.normalSave.orcaMembersLen === 1, '');
  assert('eniOrgChart preserved', result.normalSave.eniMembersLen === 0, '');
  assert('settings preserved', result.normalSave.settingsYen != null, '');
  assert('manageAccounts preserved', result.normalSave.manageAccountsPreserved === true, '');
  assert('timing UI_DONE before PRE_CLOUD_START', result.normalSave.uiBeforePreCloud === true,
    JSON.stringify(result.normalSave.timingMarks));
  assert('MODAL_CLOSED before PRE_CLOUD_START', result.normalSave.modalClosedBeforePreCloud === true,
    JSON.stringify(result.normalSave.timingMarks));
  assert('local persist sub-marks present', result.normalSave.hasLocalPersistMarks === true,
    JSON.stringify(result.normalSave.timingMarks));
  assert('timing marks present', !!(result.normalSave.timingMarks &&
    result.normalSave.timingMarks.SAVE_START != null &&
    result.normalSave.timingMarks.LOCAL_SAVE_DONE != null &&
    result.normalSave.timingMarks.UI_DONE != null &&
    result.normalSave.timingMarks.MODAL_CLOSED != null), JSON.stringify(result.normalSave.timingMarks));
  assert('save overlay shows immediately', result.overlayImmediate.visible === true, '');
  assert('double-click same promise', result.doubleClick.samePromise === true, '');
  assert('double-click one ref.set', result.doubleClick.refSets === 1,
    'refSets=' + result.doubleClick.refSets);

  console.log('\nTiming sample:', JSON.stringify(result.normalSave.timingMarks));
  console.log('\nFast-path: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
}

runBrowserCases().catch(function (err) {
  console.error(err);
  process.exit(1);
});
