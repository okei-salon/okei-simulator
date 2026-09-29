/* OUKEI HUB Revenue Save Failure Diagnostics — read-only observation UI (admin only) */
var HUB_REVENUE_SAVE_DIAG_JS_BUILD = 'Ver2.0.64/Build20260929-v004';

var hubRevenueSaveDiagnosticContext = null;
var hubRevenueSaveLastFailureDiagnostic = null;

function hubIsRevenueSaveDiagnosticModeEnabled() {
  try {
    if (typeof location !== 'undefined' && /(?:^|[?&])hub_rev_diag=1(?:&|$)/.test(location.search || '')) {
      return true;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hubRevenueSaveDiag') === '1') {
      return true;
    }
  } catch (e) {}
  return false;
}

function hubShouldShowRevenueSaveFailureDiagnostic() {
  return typeof hubIsAdminUser === 'function' && hubIsAdminUser() &&
    hubIsRevenueSaveDiagnosticModeEnabled();
}

function hubTraceHasRefSet(trace, state) {
  return (trace || []).some(function (e) {
    return e && e.step === 'ref.set' && e.state === state;
  });
}

function hubTraceFindLast(trace) {
  if (!trace || !trace.length) return null;
  return trace[trace.length - 1];
}

/**
 * Pure classification from snapshot evidence.
 * Returns { code, label, insufficientEvidence, reasons[] }.
 */
function hubClassifyRevenueSaveFailure(snapshot) {
  snapshot = snapshot || {};
  var trace = snapshot.traceTail || [];
  var reasons = [];
  var status = snapshot.internalFailureStatus || '';
  var hasRefEnter = hubTraceHasRefSet(trace, 'ENTER');
  var hasRefSuccess = hubTraceHasRefSet(trace, 'SUCCESS');
  var hasRefReject = hubTraceHasRefSet(trace, 'REJECT');
  var hasReturnedFalse = trace.some(function (e) {
    return e && e.step === 'hubRunRevenueCloudSaveOnce' && e.state === 'ABORT' &&
      e.detail && e.detail.reason === 'returned-false';
  });
  var pushAbort = trace.filter(function (e) {
    return e && e.step === 'hubPushCloudDoc' && e.state === 'ABORT';
  });
  var verifyFail = trace.some(function (e) {
    return e && (e.step === 'cloudDateVerify' || e.step === 'verifyFn') && e.state === 'ABORT';
  });
  var verifySuccess = trace.some(function (e) {
    return e && (e.step === 'cloudDateVerify' || e.step === 'verifyFn') && e.state === 'SUCCESS';
  });
  var reachedVerify = trace.some(function (e) {
    return e && (e.step === 'cloudDateVerify' || e.step === 'verifyFn');
  });
  var destructiveBlocked = !!(snapshot.destructiveGuard && snapshot.destructiveGuard.blocked);
  var writeGateSuspended = !!(snapshot.writeGate && snapshot.writeGate.suspended === true);

  if (hasRefSuccess && (verifyFail || status === 'verify-failed')) {
    reasons.push('ref.set SUCCESS 後に verify ABORT または status=verify-failed');
    return {
      code: 'C',
      label: 'ref.set成功後のpost-write verify失敗',
      insufficientEvidence: false,
      reasons: reasons
    };
  }

  if (hasRefReject) reasons.push('trace: ref.set REJECT');
  if (pushAbort.length) reasons.push('trace: hubPushCloudDoc ABORT x' + pushAbort.length);
  if (destructiveBlocked) reasons.push('destructiveGuard.blocked=true');
  if (writeGateSuspended) reasons.push('writeGate.suspended=true');
  if (status === 'write-gate' || status === 'offline' || status === 'local-only') {
    reasons.push('internalFailureStatus=' + status);
  }

  if (hasRefReject || pushAbort.length || destructiveBlocked || writeGateSuspended ||
      status === 'write-gate' || status === 'offline' || status === 'local-only') {
    if (hasReturnedFalse && !hasRefEnter && !hasRefSuccess && !hasRefReject &&
        !pushAbort.length && !destructiveBlocked && !writeGateSuspended &&
        status !== 'write-gate' && status !== 'offline' && status !== 'local-only') {
      /* fall through to A */
    } else {
      return {
        code: 'B',
        label: 'guard / writeGate / auth / rules / network 等（ref.set未実行またはreject）',
        insufficientEvidence: false,
        reasons: reasons
      };
    }
  }

  if (hasReturnedFalse && !hasRefEnter && !hasRefSuccess) {
    if (snapshot.inFlight === true) reasons.push('snapshot.inFlight=true');
    reasons.push('trace: hubRunRevenueCloudSaveOnce returned-false');
    return {
      code: 'A',
      label: 'Cloud SAVE returned-false（ref.set未実行）',
      insufficientEvidence: false,
      reasons: reasons
    };
  }

  if (status === 'cloud-write-failed' && !hasRefEnter && !hasRefSuccess) {
    reasons.push('status=cloud-write-failed かつ ref.set未到達');
    if (snapshot.inFlight === true) reasons.push('snapshot.inFlight=true');
    return {
      code: 'A',
      label: 'Cloud WRITE失敗（ref.set未到達）',
      insufficientEvidence: snapshot.inFlight !== true && !hasReturnedFalse,
      reasons: reasons
    };
  }

  if (reachedVerify && verifyFail) {
    return {
      code: 'C',
      label: 'post-write verify失敗',
      insufficientEvidence: !hasRefSuccess,
      reasons: reasons.concat(['verify ABORT（ref.set SUCCESS 未確認）'])
    };
  }

  return {
    code: 'D',
    label: '判定材料不足',
    insufficientEvidence: true,
    reasons: reasons.concat(['trace/status から A/B/C を一意に特定できません'])
  };
}

function hubBuildRevenueSaveFailureSnapshot(result, err, meta) {
  meta = meta || hubRevenueSaveDiagnosticContext || {};
  var trace = (result && result.trace) ||
    (typeof hubRevenueSaveTraceLog !== 'undefined' ? hubRevenueSaveTraceLog.slice(-25) : []);
  var last = hubTraceFindLast(trace);
  var authUid = null;
  try {
    if (typeof hubGetFirebaseAuth === 'function') {
      var user = hubGetFirebaseAuth() && hubGetFirebaseAuth().currentUser;
      authUid = user ? user.uid : null;
    }
  } catch (e) {}
  var errMsg = null;
  if (err && err.message) errMsg = String(err.message);
  else if (result && result.errorMessage) errMsg = String(result.errorMessage);

  return {
    timestamp: new Date().toISOString(),
    project: meta.project || meta.projectKey || null,
    account: meta.account || meta.accountId || null,
    accountName: meta.accountName || null,
    dateKey: meta.dateKey || null,
    traceTail: trace,
    lastStep: last ? last.step : null,
    lastState: last ? last.state : null,
    lastDetail: last ? last.detail : null,
    inFlight: typeof hubCloudSaveInFlight !== 'undefined' ? !!hubCloudSaveInFlight : null,
    pendingWrites: typeof hubSyncPendingWrites !== 'undefined' ? hubSyncPendingWrites : null,
    dirty: typeof hubHasLocalDirtyChanges === 'function' ? hubHasLocalDirtyChanges() : null,
    explicitOnly: typeof hubIsCloudWriteExplicitOnly === 'function' ? hubIsCloudWriteExplicitOnly() : null,
    suspendDepth: typeof hubCloudWriteSuspendDepth !== 'undefined' ? hubCloudWriteSuspendDepth : null,
    operatorDepth: typeof hubCloudWriteOperatorActiveDepth !== 'undefined' ? hubCloudWriteOperatorActiveDepth : null,
    restoreInProgress: typeof hubCloudWriteOperatorRestoreInProgress !== 'undefined'
      ? !!hubCloudWriteOperatorRestoreInProgress : null,
    automaticBlocked: typeof hubAreAutomaticCloudWritesBlocked === 'function'
      ? hubAreAutomaticCloudWritesBlocked() : null,
    hardSuspended: typeof hubIsCloudWriteHardSuspended === 'function' ? hubIsCloudWriteHardSuspended() : null,
    firebaseReady: typeof hubFirebaseReady !== 'undefined' ? !!hubFirebaseReady : null,
    authUidPresent: !!authUid,
    authUid: authUid,
    storageUid: typeof hubActiveUid !== 'undefined' ? (hubActiveUid || null) : null,
    cloudWriteEnabled: typeof hubIsCloudWriteEnabled === 'function' ? hubIsCloudWriteEnabled() : null,
    versionWriteAllowed: typeof hubIsVersionWriteAllowed === 'function' ? hubIsVersionWriteAllowed() : null,
    writeGate: null,
    destructiveGuard: null,
    refSetEnter: hubTraceHasRefSet(trace, 'ENTER'),
    refSetSuccess: hubTraceHasRefSet(trace, 'SUCCESS'),
    refSetReject: hubTraceHasRefSet(trace, 'REJECT'),
    postWriteVerifyReached: trace.some(function (e) {
      return e && (e.step === 'cloudDateVerify' || e.step === 'verifyFn' || e.step === 'hubPullCloudData');
    }),
    verifySuccess: trace.some(function (e) {
      return e && (e.step === 'cloudDateVerify' || e.step === 'verifyFn') && e.state === 'SUCCESS';
    }),
    verifyFailed: trace.some(function (e) {
      return e && (e.step === 'cloudDateVerify' || e.step === 'verifyFn') && e.state === 'ABORT';
    }),
    internalFailureStatus: result && result.status ? result.status : null,
    userMessage: result && result.message ? result.message : null,
    errorMessage: errMsg,
    jsBuild: typeof hubGetLoadedJsBuildInfo === 'function' ? hubGetLoadedJsBuildInfo() : null,
    classification: null
  };
}

function hubEnrichRevenueSaveFailureSnapshot(snapshot) {
  snapshot = snapshot || {};
  var tasks = [];

  if (typeof hubFetchCloudWriteGate === 'function') {
    tasks.push(hubFetchCloudWriteGate(true).then(function (gate) {
      snapshot.writeGate = gate ? {
        suspended: gate.suspended === true,
        reason: gate.reason || null,
        updatedAt: gate.updatedAt || null,
        updatedByUid: gate.updatedByUid || null,
        expiresAt: gate.expiresAt || null
      } : null;
    }).catch(function (err) {
      snapshot.writeGate = { readError: String(err && err.message || err) };
    }));
  }

  if (typeof hubFetchCloudDoc === 'function' &&
      typeof hubPackFirestorePayload === 'function' &&
      typeof hubGuardDestructiveHubPayloadBeforePush === 'function') {
    tasks.push(hubFetchCloudDoc().then(function (cloudDoc) {
      if (!cloudDoc) {
        snapshot.destructiveGuard = { skipped: true, reason: 'cloud-doc-null' };
        return;
      }
      var payload = hubPackFirestorePayload(Date.now());
      var dest = hubGuardDestructiveHubPayloadBeforePush(payload, cloudDoc, 'failure-diagnostic-readonly');
      snapshot.destructiveGuard = {
        blocked: !!dest.blocked,
        action: dest.action || null,
        writeAllowed: !!dest.writeAllowed,
        droppedCount: dest.droppedIds ? dest.droppedIds.length : 0,
        reducedRevCount: dest.reducedRevIds ? dest.reducedRevIds.length : 0,
        droppedAccountIds: (dest.droppedIds || []).slice(0, 20)
      };
    }).catch(function (err) {
      snapshot.destructiveGuard = { readError: String(err && err.message || err) };
    }));
  }

  return Promise.all(tasks).then(function () {
    snapshot.classification = hubClassifyRevenueSaveFailure(snapshot);
    return snapshot;
  });
}

function hubFormatRevenueSaveFailureDiagnosticText(snapshot) {
  return JSON.stringify(snapshot, null, 2);
}

function hubEnsureRevenueSaveDiagnosticStyles() {
  if (document.getElementById('hubRevenueSaveDiagnosticStyles')) return;
  var style = document.createElement('style');
  style.id = 'hubRevenueSaveDiagnosticStyles';
  style.textContent =
    '#hubRevenueSaveDiagnosticPanel{position:fixed;right:12px;bottom:12px;z-index:250;width:min(520px,calc(100vw - 24px));' +
    'max-height:min(70vh,560px);display:flex;flex-direction:column;background:#0b182b;border:1px solid #fbbf24;' +
    'border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.45);color:#eef7ff;font-size:11px;line-height:1.45}' +
    '#hubRevenueSaveDiagnosticPanel.hidden{display:none!important}' +
    '.hubRevDiagHead{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(251,191,36,.35)}' +
    '.hubRevDiagTitle{font-weight:900;font-size:13px;color:#fde68a;margin:0}' +
    '.hubRevDiagBtns{display:flex;gap:6px;flex-wrap:wrap}' +
    '.hubRevDiagBtns button{font-size:11px;padding:6px 10px;border-radius:8px;background:#132842;border:1px solid #355777;color:#fff;font-weight:700}' +
    '.hubRevDiagSummary{padding:8px 12px;background:rgba(251,191,36,.08);border-bottom:1px solid rgba(251,191,36,.2)}' +
    '.hubRevDiagBody{margin:0;padding:10px 12px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#cbd5e1}';
  document.head.appendChild(style);
}

function hubEnsureRevenueSaveDiagnosticPanel() {
  hubEnsureRevenueSaveDiagnosticStyles();
  var panel = document.getElementById('hubRevenueSaveDiagnosticPanel');
  if (panel) return panel;
  panel = document.createElement('div');
  panel.id = 'hubRevenueSaveDiagnosticPanel';
  panel.className = 'hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '保存診断');
  panel.innerHTML =
    '<div class="hubRevDiagHead">' +
    '<h3 class="hubRevDiagTitle">保存診断</h3>' +
    '<div class="hubRevDiagBtns">' +
    '<button type="button" id="hubRevDiagCopyBtn">診断結果をコピー</button>' +
    '<button type="button" id="hubRevDiagCloseBtn">閉じる</button>' +
    '</div></div>' +
    '<div class="hubRevDiagSummary" id="hubRevDiagSummary"></div>' +
    '<pre class="hubRevDiagBody" id="hubRevDiagBody"></pre>';
  document.body.appendChild(panel);
  var closeBtn = document.getElementById('hubRevDiagCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      panel.classList.add('hidden');
    });
  }
  var copyBtn = document.getElementById('hubRevDiagCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = panel.dataset.copyText || '';
      function done(ok) {
        if (typeof showToast === 'function') {
          showToast(ok ? '✅ 診断結果をコピーしました' : '⚠️ コピーに失敗しました');
        }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }).catch(function () { done(false); });
        return;
      }
      try {
        var area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        done(true);
      } catch (e) {
        done(false);
      }
    });
  }
  return panel;
}

function hubRenderRevenueSaveFailureDiagnostic(snapshot) {
  if (!hubShouldShowRevenueSaveFailureDiagnostic()) return;
  var panel = hubEnsureRevenueSaveDiagnosticPanel();
  var summaryEl = document.getElementById('hubRevDiagSummary');
  var bodyEl = document.getElementById('hubRevDiagBody');
  var cls = snapshot.classification || {};
  var codeLabel = cls.code ? ('分類 ' + cls.code + ': ' + cls.label) : '分類: 未取得';
  if (cls.insufficientEvidence) codeLabel += '（判定材料不足）';
  var summaryLines = [
    codeLabel,
    'status: ' + (snapshot.internalFailureStatus || '—'),
    'inFlight: ' + snapshot.inFlight + ' | pending: ' + snapshot.pendingWrites + ' | dirty: ' + snapshot.dirty,
    'ref.set ENTER/SUCCESS/REJECT: ' + snapshot.refSetEnter + ' / ' + snapshot.refSetSuccess + ' / ' + snapshot.refSetReject,
    'verify reached / failed: ' + snapshot.postWriteVerifyReached + ' / ' + snapshot.verifyFailed
  ];
  if (summaryEl) summaryEl.textContent = summaryLines.join('\n');
  var text = hubFormatRevenueSaveFailureDiagnosticText(snapshot);
  if (bodyEl) bodyEl.textContent = text;
  panel.dataset.copyText = text;
  panel.classList.remove('hidden');
}

function hubPresentRevenueSaveFailureDiagnostic(result, err, meta) {
  if (!result || result.ok) return Promise.resolve(null);
  if (!hubShouldShowRevenueSaveFailureDiagnostic()) return Promise.resolve(null);
  var msg = result.message || '';
  if (msg.indexOf('Cloud同期待ち') < 0 && result.status !== 'cloud-write-failed' &&
      result.status !== 'verify-failed' && result.status !== 'write-gate' &&
      result.status !== 'offline' && result.status !== 'local-only' && result.status !== 'error') {
    return Promise.resolve(null);
  }
  var snapshot = hubBuildRevenueSaveFailureSnapshot(result, err, meta);
  return hubEnrichRevenueSaveFailureSnapshot(snapshot).then(function (enriched) {
    hubRevenueSaveLastFailureDiagnostic = enriched;
    hubRenderRevenueSaveFailureDiagnostic(enriched);
    return enriched;
  }).catch(function (enrichErr) {
    snapshot.classification = hubClassifyRevenueSaveFailure(snapshot);
    snapshot.enrichError = String(enrichErr && enrichErr.message || enrichErr);
    hubRevenueSaveLastFailureDiagnostic = snapshot;
    hubRenderRevenueSaveFailureDiagnostic(snapshot);
    return snapshot;
  });
}

function hubRevenueSyncDebug() {
  return hubRevenueSaveLastFailureDiagnostic;
}

function hubGuessRevenueSaveContextFromUi() {
  var ctx = { dateKey: typeof todayKey === 'function' ? todayKey() : null };
  try {
    if (typeof eniOrgPage !== 'undefined' && eniOrgPage && !eniOrgPage.classList.contains('hidden')) {
      ctx.projectKey = 'eni';
    } else if (typeof orcaOrgPage !== 'undefined' && orcaOrgPage && !orcaOrgPage.classList.contains('hidden')) {
      ctx.projectKey = 'orca';
    } else if (document.getElementById('matrixRevenuePage') &&
      !document.getElementById('matrixRevenuePage').classList.contains('hidden')) {
      ctx.projectKey = 'matrix';
    } else if (document.getElementById('bitsyncRevenuePage') &&
      !document.getElementById('bitsyncRevenuePage').classList.contains('hidden')) {
      ctx.projectKey = 'bitsync';
    } else {
      ctx.projectKey = 'ram';
    }
  } catch (e) {}
  return ctx;
}

if (typeof window !== 'undefined') {
  window.hubClassifyRevenueSaveFailure = hubClassifyRevenueSaveFailure;
  window.hubBuildRevenueSaveFailureSnapshot = hubBuildRevenueSaveFailureSnapshot;
  window.hubEnrichRevenueSaveFailureSnapshot = hubEnrichRevenueSaveFailureSnapshot;
  window.hubPresentRevenueSaveFailureDiagnostic = hubPresentRevenueSaveFailureDiagnostic;
  window.hubRevenueSyncDebug = hubRevenueSyncDebug;
  window.hubRevenueSaveLastFailureDiagnostic = hubRevenueSaveLastFailureDiagnostic;
  window.hubGuessRevenueSaveContextFromUi = hubGuessRevenueSaveContextFromUi;
  window.hubIsRevenueSaveDiagnosticModeEnabled = hubIsRevenueSaveDiagnosticModeEnabled;
  window.hubShouldShowRevenueSaveFailureDiagnostic = hubShouldShowRevenueSaveFailureDiagnostic;
  window.HUB_REVENUE_SAVE_DIAG_JS_BUILD = HUB_REVENUE_SAVE_DIAG_JS_BUILD;
}
