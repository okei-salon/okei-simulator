#!/usr/bin/env node
/**
 * Revenue save failure diagnostics — classification + admin-only UI (local, no Firestore writes).
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

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => typeof hubClassifyRevenueSaveFailure === 'function' &&
      typeof hubPresentRevenueSaveFailureDiagnostic === 'function',
    null,
    { timeout: 60000 }
  );

  const unit = await page.evaluate(() => {
    function mkTrace(rows) {
      return rows.map(function (r) {
        return { step: r[0], state: r[1], detail: r[2] || null };
      });
    }
    const out = {};

    out.caseA = hubClassifyRevenueSaveFailure({
      internalFailureStatus: 'cloud-write-failed',
      inFlight: true,
      traceTail: mkTrace([
        ['hubSaveRevenueWithCloudConfirm', 'ENTER', null],
        ['hubRunRevenueCloudSaveOnce', 'ABORT', { reason: 'returned-false' }]
      ])
    });

    out.caseBDestructive = hubClassifyRevenueSaveFailure({
      internalFailureStatus: 'cloud-write-failed',
      traceTail: mkTrace([
        ['hubPushCloudDoc', 'ABORT', { reason: 'destructive-guard' }]
      ]),
      destructiveGuard: { blocked: true, action: 'block_destructive_account_drop' }
    });

    out.caseBReject = hubClassifyRevenueSaveFailure({
      internalFailureStatus: 'cloud-write-failed',
      traceTail: mkTrace([
        ['ref.set', 'ENTER', null],
        ['ref.set', 'REJECT', { message: 'permission-denied' }]
      ])
    });

    out.caseC = hubClassifyRevenueSaveFailure({
      internalFailureStatus: 'verify-failed',
      traceTail: mkTrace([
        ['ref.set', 'ENTER', null],
        ['ref.set', 'SUCCESS', { updatedAt: 1 }],
        ['cloudDateVerify', 'ABORT', { reason: 'cloud-day-missing' }]
      ])
    });

    out.caseD = hubClassifyRevenueSaveFailure({
      internalFailureStatus: 'error',
      traceTail: mkTrace([
        ['hubSaveRevenueWithCloudConfirm', 'ABORT', { status: 'error' }]
      ])
    });

    return out;
  });

  assert('CASE A: classify inFlight returned-false', unit.caseA.code === 'A');
  assert('CASE B destructive: classify B', unit.caseBDestructive.code === 'B');
  assert('CASE B reject: classify B', unit.caseBReject.code === 'B');
  assert('CASE C: classify verify-failed after ref.set SUCCESS', unit.caseC.code === 'C');
  assert('CASE D: insufficient evidence', unit.caseD.code === 'D' && unit.caseD.insufficientEvidence === true);

  const ui = await page.evaluate(async () => {
    window.__RACE_REFSETS__ = [];
    hubIsCloudWriteEnabled = function () { return true; };
    hubIsLocalDevMode = function () { return false; };
    hubIsCloudReadEnabled = function () { return true; };
    hubIsAnyOrgSimActive = function () { return false; };
    hubFirebaseReady = true;
    hubFirebaseUid = 'diag-test-uid';
    hubCloudSaveInFlight = false;
    hubAllowAutomaticCloudWrites('diag-ui');
    hubClearLocalDirtyForCloud('diag-ui');

    var cloudPayload = {
      schemaVersion: 2,
      updatedAt: 8000,
      orgChart: { members: [{ id: 'r1', parent: null, name: 'R1' }], currentData: [], scenarios: [], rootId: 'r1', rootAccountIds: ['r1'] },
      orcaOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      eniOrgChart: { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 },
      revenue: { revenueLog: {}, salesLog: {} },
      settings: { revenueLog: {}, salesLog: {} }
    };

    window.hubFetchCloudWriteGate = function () { return Promise.resolve({ suspended: false }); };
    window.hubFetchCloudDoc = function () {
      return Promise.resolve(cloudPayload);
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
        get: function (opts) {
          return Promise.resolve({ exists: true, data: function () { return cloudPayload; } });
        }
      };
    };

    hubIsAdminUser = function () { return true; };
    settings.revenueLog = settings.revenueLog || {};
    settings.revenueLog['2026-09-27'] = {
      ramAccounts: { r1: { todayRevenue: 10, revision: 9000 } },
      ram: 10,
      total: 10
    };

    var panelBefore = document.getElementById('hubRevenueSaveDiagnosticPanel');
    if (panelBefore) panelBefore.classList.add('hidden');

    var okResult = await hubSaveRevenueWithCloudConfirm({
      successMessage: '✅ 保存しました',
      cloudVerifyDateKey: '2026-09-27',
      verifyFn: function () { return true; }
    });
    var panelAfterSuccess = document.getElementById('hubRevenueSaveDiagnosticPanel');
    var successPanelHidden = !panelAfterSuccess || panelAfterSuccess.classList.contains('hidden');

    hubCloudSaveInFlight = true;
    hubRevenueSaveTraceLog = [
      { step: 'hubSaveRevenueWithCloudConfirm', state: 'ENTER', detail: null },
      { step: 'hubRunRevenueCloudSaveOnce', state: 'ABORT', detail: { reason: 'returned-false' } },
      { step: 'hubSaveRevenueWithCloudConfirm', state: 'ABORT', detail: { status: 'cloud-write-failed' } }
    ];
    var failResult = {
      ok: false,
      status: 'cloud-write-failed',
      message: '端末に保存済み・Cloud同期待ち',
      trace: hubRevenueSaveTraceLog.slice()
    };
    await hubPresentRevenueSaveFailureDiagnostic(failResult, null, { project: 'RAM', dateKey: '2026-09-27' });
    var panel = document.getElementById('hubRevenueSaveDiagnosticPanel');
    var panelVisible = !!(panel && !panel.classList.contains('hidden'));
    var copyText = panel ? (panel.dataset.copyText || '') : '';
    var lastDiag = hubRevenueSyncDebug();

    hubIsAdminUser = function () { return false; };
    if (panel) panel.classList.add('hidden');
    await hubPresentRevenueSaveFailureDiagnostic(failResult, null, { project: 'RAM' });
    var panelHiddenForUser = !!(panel && panel.classList.contains('hidden'));

    return {
      successOk: okResult.ok,
      successPanelHidden: successPanelHidden,
      failPanelVisibleAdmin: panelVisible,
      failCopyHasClassification: copyText.indexOf('classification') >= 0,
      failClassificationCode: lastDiag && lastDiag.classification ? lastDiag.classification.code : null,
      hiddenForNonAdmin: panelHiddenForUser
    };
  });

  assert('UI: success save ok', ui.successOk === true);
  assert('UI: success does not show diagnostic panel', ui.successPanelHidden === true);
  assert('UI: failure shows panel for admin', ui.failPanelVisibleAdmin === true);
  assert('UI: copy text includes classification', ui.failCopyHasClassification === true);
  assert('UI: failure classified A', ui.failClassificationCode === 'A');
  assert('UI: non-admin does not see panel', ui.hiddenForNonAdmin === true);

  await browser.close();
}

await run();
console.log('\n' + passed + '/' + (passed + failed) + ' PASS');
process.exit(failed ? 1 : 0);
