/* OUKEI HUB Firebase Sync — Ver2.0.9
 * Google 認証後に LocalStorage / Firestore を同期
 * 組織図・ポートフォリオはフィールド単位でマージして端末間の上書きを防ぐ
 */
var HUB_FIREBASE_JS_BUILD = 'Ver2.0.60/Build20260928-v005';

var hubFirebaseApp = null;
var hubFirebaseAuth = null;
var hubFirebaseDb = null;
var hubFirebaseUid = '';
var hubCloudSaveTimer = null;
var hubCloudSaveDelayMs = 1500;
var hubCloudSaveInFlight = false;
/** Resolves when the current hubRunCloudSave push finishes (success or failure). */
var hubCloudSaveInFlightPromise = null;
var hubCloudSaveQueued = false;
var hubLastPushedHash = '';
var hubFirebaseReady = false;
var hubSyncState = 'offline';
var hubSyncInFlight = false;
var hubPullInFlight = false;
var hubLastPullAt = 0;
var hubPullMinIntervalMs = 2500;
var hubSyncPendingWrites = 0;
var hubLastCloudUpdatedAt = 0;
/** Nested suspend depth: while > 0, automatic Firestore push / sync write paths run blocked. */
var hubCloudWriteSuspendDepth = 0;
/** Active operator restore session depth (accounting). */
var hubCloudWriteOperatorActiveDepth = 0;
/** True only while a restore function try-block is executing synchronously. */
var hubCloudWriteOperatorRestoreInProgress = false;
/** Last revenue-save pipeline trace (console / diagnostics). */
var hubRevenueSaveTraceLog = [];
/**
 * When true (typically after resume from a restore session), automatic
 * schedule/sync/save paths must not write. Only hubRunExplicitCloudSaveOnce() may write.
 */
var hubCloudWriteExplicitOnly = false;
/** One-shot bypass for hubRunExplicitCloudSaveOnce while explicit-only is armed. */
var hubCloudWriteExplicitBypass = false;
/** True after explicit user edit; cleared only on successful Cloud WRITE. */
var hubLocalDirtyForCloud = false;
/** While > 0: sync/merge/render must not schedule Cloud WRITE or mark dirty. */
var hubCloudWriteSuppressDepth = 0;
/** While > 0: revenue-input save button flow — local persist only; cloud confirm writes once. */
var hubRevenueInputSaveDepth = 0;

function hubHasLocalDirtyChanges() {
  return !!hubLocalDirtyForCloud;
}

function hubMarkLocalDirtyForCloud(reason) {
  if (hubCloudWriteSuppressDepth > 0) return;
  hubLocalDirtyForCloud = true;
  try {
    console.log('[hubCloudDirty] mark', { reason: reason || '' });
  } catch (e) {}
}

function hubClearLocalDirtyForCloud(reason) {
  hubLocalDirtyForCloud = false;
  try {
    console.log('[hubCloudDirty] clear', { reason: reason || '' });
  } catch (e) {}
}

function hubBeginCloudWriteSuppress(reason) {
  hubCloudWriteSuppressDepth += 1;
  try {
    console.log('[hubCloudWriteSuppress] begin', {
      depth: hubCloudWriteSuppressDepth,
      reason: reason || ''
    });
  } catch (e) {}
}

function hubEndCloudWriteSuppress(reason) {
  if (hubCloudWriteSuppressDepth > 0) hubCloudWriteSuppressDepth -= 1;
  try {
    console.log('[hubCloudWriteSuppress] end', {
      depth: hubCloudWriteSuppressDepth,
      reason: reason || ''
    });
  } catch (e) {}
}

function hubIsCloudWriteScheduleAllowed() {
  if (hubCloudWriteSuppressDepth > 0) return false;
  if (typeof hubIsRevenueInputSaveUiLocked === 'function' && hubIsRevenueInputSaveUiLocked()) {
    return false;
  }
  if (hubIsRevenueInputSaveFlowActive()) return false;
  if (typeof hubAreAutomaticCloudWritesBlocked === 'function' && hubAreAutomaticCloudWritesBlocked()) {
    return false;
  }
  return hubHasLocalDirtyChanges();
}

function hubIsRevenueInputSaveFlowActive() {
  return hubRevenueInputSaveDepth > 0;
}

/** Begin revenue-input save: defer automatic Cloud schedule until cloud confirm finishes. */
function hubBeginRevenueInputSaveFlow() {
  hubRevenueInputSaveDepth += 1;
  hubClearCloudSaveTimerAndQueue('revenue-input-save-begin');
  try {
    console.log('[hubRevenueSave] begin local-only persist phase', {
      depth: hubRevenueInputSaveDepth
    });
  } catch (e) {}
  return hubRevenueInputSaveDepth;
}

function hubEndRevenueInputSaveFlow() {
  if (hubRevenueInputSaveDepth > 0) hubRevenueInputSaveDepth -= 1;
  try {
    console.log('[hubRevenueSave] end revenue-input save flow', {
      depth: hubRevenueInputSaveDepth
    });
  } catch (e) {}
  return hubRevenueInputSaveDepth;
}

function hubIsCloudWriteSuspended() {
  return hubCloudWriteSuspendDepth > 0;
}

function hubIsCloudWriteHardSuspended() {
  return !!hubCloudWriteOperatorRestoreInProgress;
}

function hubShouldTraceRevenueRefSet() {
  if (typeof hubIsRevenueInputSaveFlowActive === 'function' && hubIsRevenueInputSaveFlowActive()) {
    return true;
  }
  if (!hubRevenueSaveTraceLog || !hubRevenueSaveTraceLog.length) return false;
  for (let i = hubRevenueSaveTraceLog.length - 1; i >= 0; i--) {
    let entry = hubRevenueSaveTraceLog[i];
    if (!entry) continue;
    if (entry.step === 'hubSaveRevenueWithCloudConfirm' && entry.state === 'ENTER') return true;
    if (entry.step === 'hubSaveRevenueWithCloudConfirm' &&
        (entry.state === 'SUCCESS' || entry.state === 'ABORT')) {
      return false;
    }
  }
  return false;
}

function hubRevenueSaveTrace(step, state, detail) {
  let entry = {
    at: new Date().toISOString(),
    step: step,
    state: state,
    detail: detail || null
  };
  try {
    entry.diagnostics = hubCollectRevenueSaveDiagnostics('trace');
  } catch (e) {}
  hubRevenueSaveTraceLog.push(entry);
  if (hubRevenueSaveTraceLog.length > 100) hubRevenueSaveTraceLog.shift();
  try {
    console.log('[hubRevenueSaveTrace]', step, state, detail || '');
  } catch (e2) {}
  return entry;
}

/** Revenue-save wall-clock marks (console / diagnostics only). */
var hubRevenueSaveTiming = null;

function hubRevenueSaveTimingReset() {
  hubRevenueSaveTiming = { startMs: Date.now(), marks: {} };
}

function hubRevenueSaveMark(label, detail) {
  if (!label) return;
  if (!hubRevenueSaveTiming) hubRevenueSaveTimingReset();
  let elapsed = Date.now() - hubRevenueSaveTiming.startMs;
  hubRevenueSaveTiming.marks[label] = elapsed;
  if (detail && typeof detail === 'object') {
    hubRevenueSaveTiming.marks[label + '__detail'] = detail;
  }
  try {
    console.log('[hubRevenueSaveTiming]', label, elapsed + 'ms', detail || '');
  } catch (e) {}
}

function hubFlushRevenueSaveLocalPersist() {
  if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('LOCAL_PERSIST_START');
  if (typeof pdFlushDeferredPersist === 'function') {
    pdFlushDeferredPersist();
  } else if (typeof hubSaveToStorage === 'function') {
    hubSaveToStorage({ localOnly: true, immediate: true });
  }
  if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('LOCAL_PERSIST_DONE');
}

function hubRunDeferredRevenueDashboardRefresh() {
  if (typeof pdNotifyPerformanceChanged === 'function' &&
      pdNotifyPerformanceChanged._deferred) {
    pdNotifyPerformanceChanged({ force: true });
  }
}

function hubRevenueSaveTimingReport() {
  if (!hubRevenueSaveTiming) return null;
  let marks = hubRevenueSaveTiming.marks || {};
  let report = {
    marks: Object.assign({}, marks),
    totalMs: marks.UI_DONE || marks.VERIFY_DONE || marks.PRE_CLOUD_DONE ||
      (Date.now() - hubRevenueSaveTiming.startMs)
  };
  try {
    console.log('[hubRevenueSaveTiming] report', report);
  } catch (e) {}
  return report;
}

/** Revenue explicit save: one Cloud READ before write on happy path (retry keeps double-read). */
function hubPushCloudDocUsesSinglePreWriteFetch(force) {
  return !!force &&
    typeof hubIsRevenueInputSaveFlowActive === 'function' &&
    hubIsRevenueInputSaveFlowActive();
}

function hubGetLoadedJsBuildInfo() {
  return {
    hubFirebase: typeof HUB_FIREBASE_JS_BUILD !== 'undefined' ? HUB_FIREBASE_JS_BUILD : null,
    hubStorage: typeof HUB_STORAGE_JS_BUILD !== 'undefined' ? HUB_STORAGE_JS_BUILD : null,
    home: typeof HUB_HOME_JS_BUILD !== 'undefined' ? HUB_HOME_JS_BUILD : null,
    hasHardSuspendApi: typeof hubIsCloudWriteHardSuspended === 'function',
    hasStaleReleaseApi: typeof hubReleaseStaleCloudWriteSuspendForExplicitSave === 'function',
    hasRestoreInProgressFlag: typeof hubCloudWriteOperatorRestoreInProgress !== 'undefined'
  };
}

function hubIsCloudWriteExplicitOnly() {
  return !!hubCloudWriteExplicitOnly;
}

/** True when automatic Firestore writes must not run. */
function hubAreAutomaticCloudWritesBlocked() {
  if (hubCloudWriteExplicitBypass) return false;
  return hubIsCloudWriteSuspended() || hubIsCloudWriteExplicitOnly();
}

/**
 * Clear leaked suspend depth from finished restore/console sessions.
 * Does not run while an operator restore session is active.
 */
function hubReleaseStaleCloudWriteSuspendForExplicitSave(reason) {
  if (hubCloudWriteOperatorRestoreInProgress) return false;
  if (!hubCloudWriteOperatorRestoreInProgress && hubCloudWriteOperatorActiveDepth > 0) {
    try {
      console.log('[hubCloudWriteGate] clear leaked operator depth for explicit user save', {
        reason: reason || '',
        wasOperatorDepth: hubCloudWriteOperatorActiveDepth,
        wasSuspendDepth: hubCloudWriteSuspendDepth
      });
    } catch (e) {}
    hubCloudWriteOperatorActiveDepth = 0;
    hubCloudWriteSuspendDepth = 0;
    hubCloudWriteExplicitOnly = true;
    hubClearCloudSaveTimerAndQueue('leaked-operator-clear:' + (reason || ''));
    return true;
  }
  if (hubCloudWriteSuspendDepth <= 0) return false;
  try {
    console.log('[hubCloudWriteGate] clear stale suspend for explicit user save', {
      reason: reason || '',
      wasDepth: hubCloudWriteSuspendDepth,
      explicitOnly: hubCloudWriteExplicitOnly
    });
  } catch (e) {}
  hubCloudWriteSuspendDepth = 0;
  return true;
}

function hubBeginOperatorCloudWriteSession(reason) {
  hubCloudWriteOperatorActiveDepth += 1;
  hubCloudWriteOperatorRestoreInProgress = true;
  hubSuspendCloudWrites(reason || 'operator-session');
  try {
    console.log('[hubCloudWriteGate] operator session begin', {
      reason: reason || '',
      operatorDepth: hubCloudWriteOperatorActiveDepth,
      suspendDepth: hubCloudWriteSuspendDepth
    });
  } catch (e) {}
  return hubCloudWriteOperatorActiveDepth;
}

function hubEndOperatorCloudWriteSession(reason, opts) {
  opts = opts || {};
  if (hubCloudWriteOperatorActiveDepth > 0) hubCloudWriteOperatorActiveDepth -= 1;
  if (hubCloudWriteOperatorActiveDepth <= 0) {
    hubCloudWriteOperatorActiveDepth = 0;
    hubCloudWriteOperatorRestoreInProgress = false;
  }
  hubResumeCloudWrites(reason || 'operator-session-end', opts);
  if (hubCloudWriteOperatorActiveDepth === 0 && hubCloudWriteSuspendDepth > 0) {
    try {
      console.log('[hubCloudWriteGate] force-clear leaked suspend after operator session', {
        reason: reason || '',
        wasDepth: hubCloudWriteSuspendDepth
      });
    } catch (e) {}
    hubCloudWriteSuspendDepth = 0;
  }
  try {
    console.log('[hubCloudWriteGate] operator session end', {
      reason: reason || '',
      operatorDepth: hubCloudWriteOperatorActiveDepth,
      suspendDepth: hubCloudWriteSuspendDepth,
      explicitOnly: hubCloudWriteExplicitOnly
    });
  } catch (e) {}
  return hubCloudWriteOperatorActiveDepth;
}

function hubCollectRevenueSaveDiagnostics(savePath) {
  return {
    jsBuild: typeof HUB_FIREBASE_JS_BUILD !== 'undefined' ? HUB_FIREBASE_JS_BUILD : null,
    explicitOnly: hubIsCloudWriteExplicitOnly(),
    suspendDepth: hubCloudWriteSuspendDepth,
    operatorActiveDepth: hubCloudWriteOperatorActiveDepth,
    restoreInProgress: !!hubCloudWriteOperatorRestoreInProgress,
    automaticBlocked: hubAreAutomaticCloudWritesBlocked(),
    hardSuspended: hubIsCloudWriteHardSuspended(),
    firebaseReady: !!hubFirebaseReady,
    firebaseUid: hubFirebaseUid || '',
    versionWriteAllowed: typeof hubIsVersionWriteAllowed === 'function'
      ? hubIsVersionWriteAllowed()
      : null,
    cloudWriteEnabled: typeof hubIsCloudWriteEnabled === 'function'
      ? hubIsCloudWriteEnabled()
      : null,
    dirty: hubHasLocalDirtyChanges(),
    pendingWrites: hubSyncPendingWrites,
    savePath: savePath || ''
  };
}

function hubFetchCloudDocForSaveVerify(dateKey, attempt) {
  attempt = attempt || 0;
  return hubFetchCloudDoc({ server: true }).then(function (doc) {
    if (hubCloudHasRevenueDay(doc, dateKey) || attempt >= 2) {
      return { doc: doc, attempt: attempt, hasDay: hubCloudHasRevenueDay(doc, dateKey) };
    }
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(hubFetchCloudDocForSaveVerify(dateKey, attempt + 1));
      }, 400);
    });
  });
}

function hubLogRevenueSaveDiagnostics(phase, savePath, extra) {
  try {
    console.log('[hubRevenueSave]', phase, Object.assign(
      hubCollectRevenueSaveDiagnostics(savePath),
      extra || {}
    ));
  } catch (e) {}
}

function hubClearCloudSaveTimerAndQueue(reason) {
  if (hubCloudSaveTimer) {
    clearTimeout(hubCloudSaveTimer);
    hubCloudSaveTimer = null;
  }
  hubCloudSaveQueued = false;
  try {
    console.log('[hubCloudWriteGate] clear timer/queue', { reason: reason || '' });
  } catch (e) {}
}

/**
 * Suspend all cloud write / sync-push paths (timer, queue, visibility sync, ref.set).
 * Does not rely on window.* monkey-patches. Safe to nest.
 */
function hubSuspendCloudWrites(reason) {
  hubCloudWriteSuspendDepth += 1;
  hubClearCloudSaveTimerAndQueue('suspend:' + (reason || ''));
  try {
    console.log('[hubCloudWriteGate] suspend', {
      depth: hubCloudWriteSuspendDepth,
      explicitOnly: hubCloudWriteExplicitOnly,
      reason: reason || ''
    });
  } catch (e) {}
  return hubCloudWriteSuspendDepth;
}

/**
 * End one suspend level. Does NOT write to Firestore.
 * @param {string} [reason]
 * @param {{explicitOnly?: boolean, allowAutomatic?: boolean}} [opts]
 *   - explicitOnly:true (default when leaving suspend) → auto paths stay blocked until
 *     hubRunExplicitCloudSaveOnce() or hubAllowAutomaticCloudWrites()
 *   - allowAutomatic:true → return to normal automatic sync (use carefully)
 */
function hubResumeCloudWrites(reason, opts) {
  opts = opts || {};
  if (hubCloudWriteSuspendDepth > 0) hubCloudWriteSuspendDepth -= 1;
  // Never flush stale saves on resume.
  hubClearCloudSaveTimerAndQueue('resume:' + (reason || ''));
  if (hubCloudWriteSuspendDepth === 0) {
    if (opts.allowAutomatic === true) {
      hubCloudWriteExplicitOnly = false;
    } else if (opts.explicitOnly === false) {
      hubCloudWriteExplicitOnly = false;
    } else {
      // Default: resume does not re-enable automatic cloud writes.
      hubCloudWriteExplicitOnly = true;
    }
  }
  try {
    console.log('[hubCloudWriteGate] resume', {
      depth: hubCloudWriteSuspendDepth,
      explicitOnly: hubCloudWriteExplicitOnly,
      reason: reason || ''
    });
  } catch (e) {}
  return hubCloudWriteSuspendDepth;
}

function hubAllowAutomaticCloudWrites(reason) {
  hubCloudWriteExplicitOnly = false;
  hubCloudWriteExplicitBypass = false;
  hubClearCloudSaveTimerAndQueue('allow-automatic:' + (reason || ''));
  try {
    console.log('[hubCloudWriteGate] allow automatic', { reason: reason || '' });
  } catch (e) {}
}

function hubArmCloudWriteExplicitOnly(reason) {
  hubCloudWriteExplicitOnly = true;
  hubClearCloudSaveTimerAndQueue('arm-explicit:' + (reason || ''));
  try {
    console.log('[hubCloudWriteGate] arm explicit-only', { reason: reason || '' });
  } catch (e) {}
}

/**
 * Single intentional Firestore push. Safe to call after resume(explicitOnly).
 * Does not leave queued/timer saves behind.
 */
function hubRunExplicitCloudSaveOnce(reason) {
  hubReleaseStaleCloudWriteSuspendForExplicitSave('explicit-once:' + (reason || ''));
  if (hubIsCloudWriteHardSuspended()) {
    try {
      console.log('[hubCloudWriteGate] explicit save blocked during operator session', reason || '');
    } catch (e) {}
    return Promise.resolve(false);
  }
  hubClearCloudSaveTimerAndQueue('before-explicit:' + (reason || ''));
  hubCloudWriteExplicitBypass = true;
  return hubRunCloudSave(true).then(function (ok) {
    hubCloudWriteExplicitBypass = false;
    hubClearCloudSaveTimerAndQueue('after-explicit:' + (reason || ''));
    // Stay in explicit-only until operator clears it (prevents follow-on auto sync).
    hubCloudWriteExplicitOnly = true;
    try {
      console.log('[hubCloudWriteGate] explicit save finished', {
        ok: !!ok,
        reason: reason || '',
        explicitOnly: hubCloudWriteExplicitOnly
      });
    } catch (e) {}
    return ok;
  }).catch(function (err) {
    hubCloudWriteExplicitBypass = false;
    hubCloudWriteExplicitOnly = true;
    hubClearCloudSaveTimerAndQueue('explicit-error:' + (reason || ''));
    throw err;
  });
}

function hubFirebaseConfigValid() {
  let cfg = typeof HUB_FIREBASE_CONFIG !== 'undefined' ? HUB_FIREBASE_CONFIG : null;
  if (!cfg) return false;
  return !!(
    cfg.apiKey &&
    cfg.authDomain &&
    cfg.projectId &&
    cfg.storageBucket &&
    cfg.messagingSenderId &&
    cfg.appId
  );
}

function hubEnsureFirebaseServices() {
  if (hubFirebaseReady) return true;
  return hubInitFirebaseServices();
}

function hubFormatSyncDebugTitle() {
  let localUa = typeof hubLocalUpdatedAt !== 'undefined' ? Number(hubLocalUpdatedAt) || 0 : 0;
  let parts = [
    'Cloud updatedAt: ' + (hubLastCloudUpdatedAt || '—'),
    'Local updatedAt: ' + (localUa || '—'),
    'dirty: ' + (hubHasLocalDirtyChanges() ? 'yes' : 'no'),
    'pending writes: ' + (hubSyncPendingWrites || 0)
  ];
  return parts.join('\n');
}

function hubMarkPendingCloudWrite() {
  hubSyncPendingWrites += 1;
  hubSetSyncStatus('pending', 'Cloud同期待ち');
}

function hubClearPendingCloudWrite() {
  if (hubSyncPendingWrites > 0) hubSyncPendingWrites -= 1;
  if (hubSyncPendingWrites <= 0) {
    hubSyncPendingWrites = 0;
    hubSetSyncStatus('done', 'Cloud同期済み');
  }
}

function hubSetSyncStatus(state, message) {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return;
  }
  hubSyncState = state || 'offline';
  let el = document.getElementById('hubSyncStatus');
  if (!el) return;
  el.classList.remove('is-syncing', 'is-done', 'is-offline', 'is-pending', 'is-failed');
  el.title = hubFormatSyncDebugTitle();
  if (state === 'syncing') {
    el.classList.add('is-syncing');
    el.textContent = message || '同期中…';
  } else if (state === 'done') {
    el.classList.add('is-done');
    el.textContent = message || 'Cloud同期済み';
  } else if (state === 'pending') {
    el.classList.add('is-pending');
    el.textContent = message || 'Cloud同期待ち';
  } else if (state === 'failed') {
    el.classList.add('is-failed');
    el.textContent = message || '同期失敗';
  } else {
    el.classList.add('is-offline');
    el.textContent = message || 'オフライン';
  }
}

function hubSetCurrentUid(uid) {
  hubFirebaseUid = uid || '';
  if (typeof hubSetActiveUid === 'function') hubSetActiveUid(uid || '');
}

function hubFirestoreDocRef() {
  if (!hubFirebaseDb || !hubFirebaseUid) return null;
  return hubFirebaseDb.collection('users').doc(hubFirebaseUid).collection('hubData').doc('main');
}

function hubProfileDocRef() {
  if (!hubFirebaseDb || !hubFirebaseUid) return null;
  return hubFirebaseDb.collection('users').doc(hubFirebaseUid).collection('profile').doc('main');
}

/** Cloud-side maintenance gate (source of truth across clients). */
function hubWriteGateDocRef() {
  if (!hubFirebaseDb || !hubFirebaseUid) return null;
  return hubFirebaseDb.collection('users').doc(hubFirebaseUid).collection('control').doc('writeGate');
}

var hubCloudWriteGateCache = null;
var hubCloudWriteGateCacheAt = 0;
var hubCloudWriteGateCacheMs = 5000;
/** Last cloud hubData.updatedAt observed via fetch (stale-client guard). */
var hubLastSeenCloudUpdatedAt = 0;
/** Explicit full hub reset (rare); allows destructive account wipe in guard. */
var hubExplicitHubDataResetPending = false;
var hubExplicitHubDataResetAt = 0;
var hubExplicitHubDataResetReason = '';

function hubMarkExplicitHubDataReset(reason) {
  hubExplicitHubDataResetPending = true;
  hubExplicitHubDataResetAt = Date.now();
  hubExplicitHubDataResetReason = reason || '';
}

function hubClearExplicitHubDataReset() {
  hubExplicitHubDataResetPending = false;
  hubExplicitHubDataResetAt = 0;
  hubExplicitHubDataResetReason = '';
}

function hubIsCloudWriteGateDocSuspended(gate) {
  if (!gate || gate.suspended !== true) return false;
  let exp = Number(gate.expiresAt) || 0;
  if (exp > 0 && Date.now() > exp) return false;
  return true;
}

function hubFetchCloudWriteGate(force) {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) {
    return Promise.resolve(null);
  }
  if (!force && hubCloudWriteGateCache &&
      (Date.now() - hubCloudWriteGateCacheAt) < hubCloudWriteGateCacheMs) {
    return Promise.resolve(hubCloudWriteGateCache);
  }
  let ref = hubWriteGateDocRef();
  if (!ref) return Promise.resolve(null);
  return ref.get().then(function (snap) {
    let data = snap && snap.exists ? (snap.data() || null) : null;
    hubCloudWriteGateCache = data;
    hubCloudWriteGateCacheAt = Date.now();
    return data;
  }).catch(function () {
    return hubCloudWriteGateCache;
  });
}

/**
 * Operator helper: suspend automatic cloud hubData writes for all clients.
 * Writes control/writeGate only (not hubData). Do not call during read-only recovery.
 */
function hubSetCloudWriteGateSuspended(suspended, reason, expiresAt) {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    return Promise.resolve(false);
  }
  let ref = hubWriteGateDocRef();
  if (!ref) return Promise.resolve(false);
  let payload = {
    suspended: !!suspended,
    reason: reason || '',
    updatedAt: Date.now(),
    updatedByUid: hubFirebaseUid || ''
  };
  if (expiresAt != null) payload.expiresAt = Number(expiresAt) || 0;
  return ref.set(payload, { merge: true }).then(function () {
    hubCloudWriteGateCache = Object.assign({}, hubCloudWriteGateCache || {}, payload);
    hubCloudWriteGateCacheAt = Date.now();
    try {
      console.log('[hubCloudWriteGate] remote gate set', payload);
    } catch (e) {}
    return true;
  });
}

function hubInitFirebaseServices() {
  if (hubFirebaseReady) return true;
  if (typeof firebase === 'undefined') return false;
  if (!hubFirebaseConfigValid()) return false;
  try {
    if (!firebase.apps.length) {
      hubFirebaseApp = firebase.initializeApp(HUB_FIREBASE_CONFIG);
    } else {
      hubFirebaseApp = firebase.app();
    }
    hubFirebaseAuth = firebase.auth();
    hubFirebaseDb = firebase.firestore();
    hubFirebaseReady = true;
    return true;
  } catch (e) {
    hubFirebaseReady = false;
    return false;
  }
}

function hubGetFirebaseAuth() {
  return hubFirebaseAuth;
}

function hubFetchCloudDoc(opts) {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) {
    return Promise.resolve(null);
  }
  opts = opts || {};
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(null);
  let getOpts = opts.server ? { source: 'server' } : undefined;
  return ref.get(getOpts).then(function (snap) {
    if (!snap.exists) return null;
    let data = snap.data();
    let ua = data && typeof data === 'object' ? (Number(data.updatedAt) || 0) : 0;
    if (ua > 0) hubLastSeenCloudUpdatedAt = ua;
    return data;
  });
}

/** Session flag: real ORCA account/project delete may empty cloud ORCA. */
var hubExplicitOrcaDeletePending = false;
var hubExplicitOrcaDeleteIds = null;
var hubExplicitOrcaDeleteAt = 0;

function hubMarkExplicitOrcaDelete(ids) {
  hubExplicitOrcaDeletePending = true;
  hubExplicitOrcaDeleteAt = Date.now();
  hubExplicitOrcaDeleteIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
}

function hubClearExplicitOrcaDelete() {
  hubExplicitOrcaDeletePending = false;
  hubExplicitOrcaDeleteIds = null;
  hubExplicitOrcaDeleteAt = 0;
}

function hubCloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hubCountOrcaInFirestorePayload(payload) {
  let settings = (payload && payload.settings) || {};
  let accounts = Array.isArray(settings.orcaInputAccounts) ? settings.orcaInputAccounts.length : 0;
  let revenueDays = 0;
  let salesDays = 0;
  let investmentIds = 0;
  let revenueLog = (payload && payload.revenue && payload.revenue.revenueLog) || {};
  Object.keys(revenueLog).forEach(function (dk) {
    let oa = revenueLog[dk] && revenueLog[dk].orcaAccounts;
    if (oa && Object.keys(oa).length) revenueDays += 1;
  });
  let salesLog = (payload && payload.revenue && payload.revenue.salesLog) || {};
  Object.keys(salesLog).forEach(function (dk) {
    let acc = salesLog[dk] && salesLog[dk].accounts;
    if (!acc) return;
    let hit = Object.keys(acc).some(function (id) {
      return acc[id] && acc[id].projectKey === 'orca';
    });
    if (hit) salesDays += 1;
  });
  let inv = settings.investmentHistory || {};
  Object.keys(inv).forEach(function (id) {
    let entry = inv[id];
    if (entry && (entry.projectKey === 'orca' || String(id).indexOf('orca_') === 0)) {
      investmentIds += 1;
    }
  });
  return {
    accounts: accounts,
    revenueDays: revenueDays,
    salesDays: salesDays,
    investmentIds: investmentIds,
    total: accounts + revenueDays + salesDays + investmentIds
  };
}

function hubIsOrcaFirestorePayloadEmpty(counts) {
  return !counts || (
    counts.accounts === 0 &&
    counts.revenueDays === 0 &&
    counts.salesDays === 0 &&
    counts.investmentIds === 0
  );
}

function hubCloudHasLiveOrca(cloudDoc) {
  return !hubIsOrcaFirestorePayloadEmpty(hubCountOrcaInFirestorePayload(cloudDoc || {}));
}

/**
 * Allow emptying cloud ORCA only for explicit delete (session flag) or
 * fresh per-id tombstone times newer than cloud.updatedAt for every cloud-live account.
 */
function hubAllowExplicitOrcaEmptyWipe(payload, cloudDoc) {
  if (hubExplicitOrcaDeletePending) return true;
  if (!cloudDoc) return true;
  let cloudSettings = cloudDoc.settings || {};
  let cloudAccounts = Array.isArray(cloudSettings.orcaInputAccounts) ? cloudSettings.orcaInputAccounts : [];
  if (!cloudAccounts.length) {
    return !hubCloudHasLiveOrca(cloudDoc);
  }
  let removed = (payload && payload.settings && payload.settings.removedOrcaOrgAccountIds) || [];
  let times = (payload && payload.settings && payload.settings.removedOrcaOrgAccountIdTimes) || {};
  let cloudUpdatedAt = Number(cloudDoc.updatedAt) || 0;
  return cloudAccounts.every(function (acc) {
    if (!acc || !acc.id) return true;
    let t = Number(times[acc.id]) || 0;
    return removed.indexOf(acc.id) >= 0 && t > cloudUpdatedAt;
  });
}

function hubPreserveCloudOrcaIntoPayload(payload, cloudDoc) {
  if (!payload || !cloudDoc) return payload;
  let out = payload;
  let cloudSettings = cloudDoc.settings || {};
  out.settings = out.settings || {};
  out.settings.orcaInputAccounts = hubCloneJson(cloudSettings.orcaInputAccounts || []);

  let liveIds = {};
  (out.settings.orcaInputAccounts || []).forEach(function (acc) {
    if (acc && acc.id) liveIds[acc.id] = true;
  });
  if (Array.isArray(out.settings.removedOrcaOrgAccountIds)) {
    out.settings.removedOrcaOrgAccountIds = out.settings.removedOrcaOrgAccountIds.filter(function (id) {
      return !liveIds[id];
    });
  }
  if (out.settings.removedOrcaOrgAccountIdTimes && typeof out.settings.removedOrcaOrgAccountIdTimes === 'object') {
    Object.keys(liveIds).forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(out.settings.removedOrcaOrgAccountIdTimes, id)) {
        delete out.settings.removedOrcaOrgAccountIdTimes[id];
      }
    });
  }

  out.settings.investmentHistory = out.settings.investmentHistory || {};
  let cloudInv = cloudSettings.investmentHistory || {};
  Object.keys(cloudInv).forEach(function (id) {
    let entry = cloudInv[id];
    if (!entry) return;
    if (entry.projectKey === 'orca' || String(id).indexOf('orca_') === 0) {
      out.settings.investmentHistory[id] = hubCloneJson(entry);
    }
  });

  out.revenue = out.revenue || { revenueLog: {}, salesLog: {} };
  out.revenue.revenueLog = out.revenue.revenueLog || {};
  out.revenue.salesLog = out.revenue.salesLog || {};
  let cloudRev = (cloudDoc.revenue && cloudDoc.revenue.revenueLog) || {};
  Object.keys(cloudRev).forEach(function (dk) {
    let cEntry = cloudRev[dk];
    if (!cEntry || !cEntry.orcaAccounts || !Object.keys(cEntry.orcaAccounts).length) return;
    let pEntry = out.revenue.revenueLog[dk];
    if (!pEntry || typeof pEntry !== 'object') {
      pEntry = {};
      out.revenue.revenueLog[dk] = pEntry;
    }
    pEntry.orcaAccounts = hubCloneJson(cEntry.orcaAccounts);
    if (cEntry.orca != null) pEntry.orca = cEntry.orca;
    pEntry.accounts = pEntry.accounts || {};
    Object.keys(cEntry.accounts || {}).forEach(function (id) {
      let ae = cEntry.accounts[id];
      if (ae && ae.projectKey === 'orca') pEntry.accounts[id] = hubCloneJson(ae);
    });
  });
  let cloudSales = (cloudDoc.revenue && cloudDoc.revenue.salesLog) || {};
  Object.keys(cloudSales).forEach(function (dk) {
    let cEntry = cloudSales[dk];
    if (!cEntry || !cEntry.accounts) return;
    let orcaRows = {};
    Object.keys(cEntry.accounts).forEach(function (id) {
      let ae = cEntry.accounts[id];
      if (ae && ae.projectKey === 'orca') orcaRows[id] = hubCloneJson(ae);
    });
    if (!Object.keys(orcaRows).length) return;
    let pEntry = out.revenue.salesLog[dk];
    if (!pEntry || typeof pEntry !== 'object') {
      pEntry = { accounts: {} };
      out.revenue.salesLog[dk] = pEntry;
    }
    pEntry.accounts = pEntry.accounts || {};
    Object.keys(orcaRows).forEach(function (id) {
      pEntry.accounts[id] = orcaRows[id];
    });
  });
  return out;
}

function hubStripExplicitOrcaIdsFromPayload(payload, ids) {
  if (!payload || !ids || !ids.length) return payload;
  let drop = {};
  ids.forEach(function (id) { if (id) drop[id] = true; });
  let settings = payload.settings || {};
  if (Array.isArray(settings.orcaInputAccounts)) {
    settings.orcaInputAccounts = settings.orcaInputAccounts.filter(function (a) {
      return !(a && a.id && drop[a.id]);
    });
  }
  if (!Array.isArray(settings.removedOrcaOrgAccountIds)) settings.removedOrcaOrgAccountIds = [];
  ids.forEach(function (id) {
    if (id && settings.removedOrcaOrgAccountIds.indexOf(id) < 0) {
      settings.removedOrcaOrgAccountIds.push(id);
    }
  });
  settings.removedOrcaOrgAccountIdTimes = settings.removedOrcaOrgAccountIdTimes || {};
  let now = Date.now();
  ids.forEach(function (id) {
    if (!id) return;
    if (!settings.removedOrcaOrgAccountIdTimes[id]) settings.removedOrcaOrgAccountIdTimes[id] = now;
  });
  if (settings.investmentHistory && typeof settings.investmentHistory === 'object') {
    Object.keys(drop).forEach(function (id) { delete settings.investmentHistory[id]; });
  }
  let revenueLog = payload.revenue && payload.revenue.revenueLog;
  if (revenueLog) {
    Object.keys(revenueLog).forEach(function (dk) {
      let entry = revenueLog[dk];
      if (!entry) return;
      if (entry.orcaAccounts) {
        Object.keys(drop).forEach(function (id) { delete entry.orcaAccounts[id]; });
      }
      if (entry.accounts) {
        Object.keys(drop).forEach(function (id) {
          if (entry.accounts[id] && entry.accounts[id].projectKey === 'orca') delete entry.accounts[id];
        });
      }
    });
  }
  let salesLog = payload.revenue && payload.revenue.salesLog;
  if (salesLog) {
    Object.keys(salesLog).forEach(function (dk) {
      let entry = salesLog[dk];
      if (!entry || !entry.accounts) return;
      Object.keys(drop).forEach(function (id) {
        if (entry.accounts[id] && entry.accounts[id].projectKey === 'orca') delete entry.accounts[id];
      });
    });
  }
  return payload;
}

/**
 * Final ORCA safety gate before Firestore set().
 * Blocks destructive empty ORCA overwrites unless explicit delete is allowed.
 */
function hubGuardOrcaPayloadBeforePush(payload, cloudDoc, callerHint) {
  let cloudCounts = hubCountOrcaInFirestorePayload(cloudDoc || {});
  let payloadCountsBefore = hubCountOrcaInFirestorePayload(payload || {});
  let freshTombstoneAll = hubAllowExplicitOrcaEmptyWipe(payload, cloudDoc) && !hubExplicitOrcaDeletePending;
  let wouldDestroy =
    hubCloudHasLiveOrca(cloudDoc) &&
    hubIsOrcaFirestorePayloadEmpty(payloadCountsBefore);
  let finalPayload = payload;
  let action = 'allow';
  let blocked = false;

  if (wouldDestroy) {
    if (hubExplicitOrcaDeletePending) {
      // Keep unrelated cloud ORCA; remove only explicitly deleted ids.
      finalPayload = hubPreserveCloudOrcaIntoPayload(hubCloneJson(payload), cloudDoc);
      finalPayload = hubStripExplicitOrcaIdsFromPayload(
        finalPayload,
        hubExplicitOrcaDeleteIds && hubExplicitOrcaDeleteIds.length
          ? hubExplicitOrcaDeleteIds
          : []
      );
      action = 'allow_explicit_orca_delete';
      blocked = false;
    } else if (freshTombstoneAll) {
      // All cloud-live accounts have fresh local tombstone times → full empty OK.
      action = 'allow_explicit_orca_delete';
      blocked = false;
    } else {
      finalPayload = hubPreserveCloudOrcaIntoPayload(payload, cloudDoc);
      action = 'block_preserve_cloud_orca';
      blocked = true;
    }
  }

  let payloadCountsAfter = hubCountOrcaInFirestorePayload(finalPayload || {});
  let caller = callerHint || '';
  try {
    let stack = new Error().stack || '';
    let lines = String(stack).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    caller = caller || lines.slice(0, 6).join(' | ');
  } catch (e) {}

  let log = {
    tag: '[hubOrcaPushGuard]',
    caller: caller,
    cloudOrca: cloudCounts,
    payloadOrcaBefore: payloadCountsBefore,
    payloadOrcaAfter: payloadCountsAfter,
    explicitOrcaDelete: !!hubExplicitOrcaDeletePending,
    explicitOrcaDeleteIds: hubExplicitOrcaDeleteIds,
    explicitOrcaDeleteAt: hubExplicitOrcaDeleteAt,
    explicitAllowed: !!(hubExplicitOrcaDeletePending || freshTombstoneAll),
    wouldDestroy: !!wouldDestroy,
    action: action,
    writeAllowed: true,
    orcaEmptyWipeBlocked: blocked
  };
  try {
    console.log(log.tag, log);
  } catch (e) {}

  return {
    payload: finalPayload,
    blocked: blocked,
    action: action,
    log: log,
    cloudCounts: cloudCounts,
    payloadCounts: payloadCountsAfter
  };
}

/**
 * Collect account IDs present in hubData revenue/sales account maps.
 * Returns { byBucket: { ramAccounts: {id: days}, ... }, allIds: {id: true}, revDaysById, salesDaysById }
 */
function hubCollectHubPayloadAccountStats(payload) {
  let byBucket = {
    ramAccounts: {},
    orcaAccounts: {},
    eniAccounts: {},
    caryAccounts: {},
    accounts: {}
  };
  let revDaysById = {};
  let salesDaysById = {};
  let allIds = {};
  let revenueLog = (payload && payload.revenue && payload.revenue.revenueLog) || {};
  Object.keys(revenueLog).forEach(function (dk) {
    let entry = revenueLog[dk];
    if (!entry || typeof entry !== 'object') return;
    Object.keys(byBucket).forEach(function (bucket) {
      let map = entry[bucket];
      if (!map || typeof map !== 'object') return;
      Object.keys(map).forEach(function (id) {
        if (!id) return;
        byBucket[bucket][id] = (byBucket[bucket][id] || 0) + 1;
        revDaysById[id] = (revDaysById[id] || 0) + 1;
        allIds[id] = true;
      });
    });
  });
  let salesLog = (payload && payload.revenue && payload.revenue.salesLog) || {};
  Object.keys(salesLog).forEach(function (dk) {
    let entry = salesLog[dk];
    let map = entry && entry.accounts;
    if (!map || typeof map !== 'object') return;
    Object.keys(map).forEach(function (id) {
      if (!id) return;
      salesDaysById[id] = (salesDaysById[id] || 0) + 1;
      allIds[id] = true;
      byBucket.accounts[id] = byBucket.accounts[id] || 0;
    });
  });
  return {
    byBucket: byBucket,
    allIds: allIds,
    revDaysById: revDaysById,
    salesDaysById: salesDaysById
  };
}

function hubTombstoneAllowsAccountDrop(payload, accountId, cloudUpdatedAt) {
  if (!accountId || !payload) return false;
  let settings = payload.settings || {};
  let removed = [];
  if (Array.isArray(settings.removedOrcaOrgAccountIds)) {
    removed = removed.concat(settings.removedOrcaOrgAccountIds);
  }
  if (Array.isArray(settings.removedRamOrgAccountIds)) {
    removed = removed.concat(settings.removedRamOrgAccountIds);
  }
  if (Array.isArray(settings.removedEniOrgAccountIds)) {
    removed = removed.concat(settings.removedEniOrgAccountIds);
  }
  if (removed.indexOf(accountId) < 0) return false;
  let times = Object.assign(
    {},
    settings.removedOrcaOrgAccountIdTimes || {},
    settings.removedRamOrgAccountIdTimes || {},
    settings.removedEniOrgAccountIdTimes || {}
  );
  let t = Number(times[accountId]) || 0;
  // Fresh tombstone (newer than cloud) OR listed without times (legacy RAM/ENI lists).
  if (!t) return true;
  return t > (Number(cloudUpdatedAt) || 0);
}

/**
 * Abort automatic writes that would drop cloud account rows (e.g. kai2 wipe)
 * without explicit tombstone / explicit hub reset.
 */
function hubGuardDestructiveHubPayloadBeforePush(payload, cloudDoc, callerHint) {
  let cloudStats = hubCollectHubPayloadAccountStats(cloudDoc || {});
  let payloadStats = hubCollectHubPayloadAccountStats(payload || {});
  let cloudUpdatedAt = hubCloudUpdatedAt(cloudDoc);
  let droppedIds = [];
  let reducedRevIds = [];
  let reducedSalesIds = [];

  Object.keys(cloudStats.allIds).forEach(function (id) {
    if (payloadStats.allIds[id]) return;
    if (hubTombstoneAllowsAccountDrop(payload, id, cloudUpdatedAt)) return;
    droppedIds.push(id);
  });
  Object.keys(cloudStats.revDaysById).forEach(function (id) {
    let before = cloudStats.revDaysById[id] || 0;
    let after = payloadStats.revDaysById[id] || 0;
    if (before > 0 && after === 0 && !hubTombstoneAllowsAccountDrop(payload, id, cloudUpdatedAt)) {
      if (reducedRevIds.indexOf(id) < 0) reducedRevIds.push(id);
    }
  });
  Object.keys(cloudStats.salesDaysById).forEach(function (id) {
    let before = cloudStats.salesDaysById[id] || 0;
    let after = payloadStats.salesDaysById[id] || 0;
    if (before > 0 && after === 0 && !hubTombstoneAllowsAccountDrop(payload, id, cloudUpdatedAt)) {
      if (reducedSalesIds.indexOf(id) < 0) reducedSalesIds.push(id);
    }
  });

  let destructive = droppedIds.length > 0 || reducedRevIds.length > 0 || reducedSalesIds.length > 0;
  let allowExplicit = !!hubExplicitHubDataResetPending;
  let writeAllowed = !destructive || allowExplicit;
  let action = 'allow';
  if (destructive && allowExplicit) action = 'allow_explicit_hub_reset';
  if (destructive && !allowExplicit) action = 'block_destructive_account_drop';

  let log = {
    tag: '[hubDestructivePushGuard]',
    caller: callerHint || '',
    cloudUpdatedAt: cloudUpdatedAt,
    localUpdatedAt: typeof hubLocalUpdatedAt !== 'undefined' ? hubLocalUpdatedAt : null,
    preferLocal: (typeof hubLocalUpdatedAt !== 'undefined' ? hubLocalUpdatedAt : 0) >= cloudUpdatedAt,
    droppedAccountIds: droppedIds.slice(0, 50),
    droppedAccountIdCount: droppedIds.length,
    reducedRevAccountIds: reducedRevIds.slice(0, 50),
    reducedSalesAccountIds: reducedSalesIds.slice(0, 50),
    explicitHubReset: allowExplicit,
    explicitHubResetReason: hubExplicitHubDataResetReason,
    action: action,
    writeAllowed: writeAllowed
  };
  try {
    console.log(log.tag, log);
  } catch (e) {}

  return {
    writeAllowed: writeAllowed,
    blocked: !writeAllowed,
    action: action,
    log: log,
    droppedIds: droppedIds,
    reducedRevIds: reducedRevIds,
    reducedSalesIds: reducedSalesIds
  };
}

function hubApplyPreservedOrcaPayloadLocally(payload) {
  if (!payload || typeof settings === 'undefined') return;
  let s = payload.settings || {};
  if (Array.isArray(s.orcaInputAccounts)) {
    settings.orcaInputAccounts = hubCloneJson(s.orcaInputAccounts);
  }
  if (Array.isArray(s.removedOrcaOrgAccountIds)) {
    settings.removedOrcaOrgAccountIds = s.removedOrcaOrgAccountIds.slice();
  }
  if (s.removedOrcaOrgAccountIdTimes && typeof s.removedOrcaOrgAccountIdTimes === 'object') {
    settings.removedOrcaOrgAccountIdTimes = hubCloneJson(s.removedOrcaOrgAccountIdTimes);
  }
  if (s.investmentHistory && typeof s.investmentHistory === 'object') {
    settings.investmentHistory = settings.investmentHistory || {};
    Object.keys(s.investmentHistory).forEach(function (id) {
      let entry = s.investmentHistory[id];
      if (entry && (entry.projectKey === 'orca' || String(id).indexOf('orca_') === 0)) {
        settings.investmentHistory[id] = hubCloneJson(entry);
      }
    });
  }
  if (payload.revenue) {
    if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
    if (!settings.salesLog || typeof settings.salesLog !== 'object') settings.salesLog = {};
    let rev = payload.revenue.revenueLog || {};
    Object.keys(rev).forEach(function (dk) {
      let src = rev[dk];
      if (!src || !src.orcaAccounts) return;
      let dst = settings.revenueLog[dk] || {};
      dst.orcaAccounts = hubCloneJson(src.orcaAccounts);
      if (src.orca != null) dst.orca = src.orca;
      dst.accounts = dst.accounts || {};
      Object.keys(src.accounts || {}).forEach(function (id) {
        let ae = src.accounts[id];
        if (ae && ae.projectKey === 'orca') dst.accounts[id] = hubCloneJson(ae);
      });
      settings.revenueLog[dk] = dst;
    });
    let sales = payload.revenue.salesLog || {};
    Object.keys(sales).forEach(function (dk) {
      let src = sales[dk];
      if (!src || !src.accounts) return;
      let dst = settings.salesLog[dk] || { accounts: {} };
      dst.accounts = dst.accounts || {};
      Object.keys(src.accounts).forEach(function (id) {
        let ae = src.accounts[id];
        if (ae && ae.projectKey === 'orca') dst.accounts[id] = hubCloneJson(ae);
      });
      settings.salesLog[dk] = dst;
    });
  }
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
}

function hubCloudUpdatedAt(doc) {
  return doc && typeof doc === 'object' ? (Number(doc.updatedAt) || 0) : 0;
}

function hubCloudDocChanged(prev, next) {
  if (!prev && next) return true;
  if (prev && !next) return true;
  if (!prev && !next) return false;
  if (hubCloudUpdatedAt(prev) !== hubCloudUpdatedAt(next)) return true;
  if (typeof hubComputeContentHash === 'function' &&
      typeof hubUnpackFirestorePayload === 'function') {
    return hubComputeContentHash(hubUnpackFirestorePayload(prev)) !==
      hubComputeContentHash(hubUnpackFirestorePayload(next));
  }
  return false;
}

function hubPushCloudDoc(force, _cloudDocOpt, callerHint) {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return Promise.resolve(false);
  }
  if (callerHint === 'hubRunCloudSave' && hubCloudWriteExplicitBypass) {
    hubRevenueSaveTrace('hubPushCloudDoc', 'ENTER', { caller: callerHint || '', force: !!force });
  }
  if (hubAreAutomaticCloudWritesBlocked()) {
    if (callerHint === 'hubRunCloudSave' && hubCloudWriteExplicitBypass) {
      hubRevenueSaveTrace('hubPushCloudDoc', 'ABORT', { reason: 'automatic-blocked', caller: callerHint || '' });
    }
    try {
      console.log('[hubCloudWriteGate] block hubPushCloudDoc', {
        caller: callerHint || '',
        suspended: hubIsCloudWriteSuspended(),
        explicitOnly: hubIsCloudWriteExplicitOnly(),
        bypass: !!hubCloudWriteExplicitBypass
      });
    } catch (e) {}
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  hubSetSyncStatus('syncing');

  let maxAttempts = 3;

  function buildGuardedPayload(cloudDoc, packOpts) {
    packOpts = packOpts || {};
    let preferLocal =
      (typeof hubLocalUpdatedAt !== 'undefined' ? Number(hubLocalUpdatedAt) || 0 : 0) >=
      hubCloudUpdatedAt(cloudDoc);
    let payload;
    let useInMemoryPack = !!packOpts.packMergedInMemory;
    if (cloudDoc && typeof hubMergeHubDocuments === 'function') {
      let localData = typeof hubPackLocalData === 'function'
        ? hubPackLocalData()
        : hubCreateEmptyData();
      let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
      let merged = hubMergeHubDocuments(localData, cloudUnpacked);
      if (useInMemoryPack && typeof hubPackFirestorePayloadFromData === 'function') {
        payload = hubPackFirestorePayloadFromData(merged, Date.now());
      } else {
        hubApplyMergedHubData(merged, hubComputeContentHash(cloudUnpacked), { skipRefresh: true });
        payload = hubPackFirestorePayload(Date.now());
      }
    } else {
      payload = hubPackFirestorePayload(Date.now());
    }
    let guarded = hubGuardOrcaPayloadBeforePush(
      payload,
      cloudDoc,
      callerHint || 'hubPushCloudDoc'
    );
    payload = guarded.payload;
    if (guarded.blocked || guarded.action === 'allow_explicit_orca_delete') {
      hubApplyPreservedOrcaPayloadLocally(payload);
    }
    let destructive = hubGuardDestructiveHubPayloadBeforePush(
      payload,
      cloudDoc,
      callerHint || 'hubPushCloudDoc'
    );
    try {
      console.log('[hubCloudSave] pre-write', {
        caller: callerHint || 'hubPushCloudDoc',
        localUpdatedAt: typeof hubLocalUpdatedAt !== 'undefined' ? hubLocalUpdatedAt : null,
        cloudUpdatedAt: hubCloudUpdatedAt(cloudDoc),
        lastSeenCloudUpdatedAt: hubLastSeenCloudUpdatedAt,
        preferLocal: preferLocal,
        orcaAction: guarded.action,
        destructiveAction: destructive.action,
        droppedAccountIds: destructive.droppedIds && destructive.droppedIds.slice(0, 20),
        reducedRevAccountIds: destructive.reducedRevIds && destructive.reducedRevIds.slice(0, 20),
        reducedSalesAccountIds: destructive.reducedSalesIds && destructive.reducedSalesIds.slice(0, 20),
        writeAllowed: !!destructive.writeAllowed
      });
    } catch (e) {}
    return {
      payload: payload,
      guarded: guarded,
      destructive: destructive,
      preferLocal: preferLocal
    };
  }

  function writeBuiltPayload(built, n, hash) {
    if (built.destructive && built.destructive.blocked) {
      if (hubCloudWriteExplicitBypass) {
        hubRevenueSaveTrace('hubPushCloudDoc', 'ABORT', {
          reason: 'destructive-guard',
          action: built.destructive.action
        });
      }
      hubSetSyncStatus('pending', 'Cloud同期待ち');
      if (typeof hubMarkPendingCloudWrite === 'function') hubMarkPendingCloudWrite();
      return Promise.resolve(false);
    }

    if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('REF_SET_START');
    if (hubShouldTraceRevenueRefSet()) {
      hubRevenueSaveTrace('ref.set', 'ENTER', {
        caller: callerHint || 'hubPushCloudDoc',
        cloudVerifyDateKey: built.payload && built.payload.updatedAt
      });
    }

    console.log('[hubOrcaPushGuard] ref.set about to write', {
      cloudOrca: built.guarded.cloudCounts,
      payloadOrca: built.guarded.payloadCounts,
      explicitOrcaDelete: !!hubExplicitOrcaDeletePending,
      action: built.guarded.action,
      destructiveAction: built.destructive && built.destructive.action,
      writeAllowed: !(built.destructive && built.destructive.blocked),
      orcaEmptyWipeBlocked: !!built.guarded.blocked,
      schemaVersion: built.payload.schemaVersion,
      rematchAttempts: n,
      caller: (built.guarded.log && built.guarded.log.caller) || callerHint || 'hubPushCloudDoc'
    });

    return ref.set(built.payload).then(function () {
      if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('REF_SET_DONE');
      hubLastPushedHash = hash;
      hubLastSeenCloudUpdatedAt = Number(built.payload.updatedAt) || Date.now();
      hubClearLocalDirtyForCloud('cloud-write-ok');
      if (built.guarded.action === 'allow_explicit_orca_delete') {
        hubClearExplicitOrcaDelete();
      }
      if (built.destructive && built.destructive.action === 'allow_explicit_hub_reset') {
        hubClearExplicitHubDataReset();
      }
      hubSetSyncStatus('done');
      if (hubShouldTraceRevenueRefSet()) {
        hubRevenueSaveTrace('ref.set', 'SUCCESS', {
          updatedAt: built.payload.updatedAt
        });
      }
      return true;
    }).catch(function (err) {
      if (hubShouldTraceRevenueRefSet()) {
        hubRevenueSaveTrace('ref.set', 'REJECT', {
          message: String(err && err.message || err)
        });
      }
      throw err;
    });
  }

  function attempt(n) {
    let packMergedInMemory = hubPushCloudDocUsesSinglePreWriteFetch(force);
    let packOpts = { packMergedInMemory: packMergedInMemory };

    let fetchCloudBundle = hubPushCloudDocUsesSinglePreWriteFetch(force)
      ? Promise.all([
          hubFetchCloudWriteGate(false),
          hubFetchCloudDoc()
        ]).then(function (pair) {
          return { gate: pair[0], cloudAtStart: pair[1] };
        })
      : hubFetchCloudWriteGate(false).then(function (gate) {
          return hubFetchCloudDoc().then(function (cloudAtStart) {
            return { gate: gate, cloudAtStart: cloudAtStart };
          });
        });

    return fetchCloudBundle.then(function (bundle) {
      let gate = bundle.gate;
      let cloudAtStart = bundle.cloudAtStart;
      if (hubIsCloudWriteGateDocSuspended(gate)) {
        try {
          console.log('[hubCloudWriteGate] block hubPushCloudDoc remote suspended', {
            caller: callerHint || '',
            reason: gate && gate.reason,
            expiresAt: gate && gate.expiresAt
          });
        } catch (e) {}
        hubSetSyncStatus('pending', 'Cloud同期待ち');
        if (typeof hubMarkPendingCloudWrite === 'function') hubMarkPendingCloudWrite();
        return false;
      }

      // Fetch latest cloud, merge in-memory for pack (no render / no cloud reschedule).
      return Promise.resolve(cloudAtStart).then(function (cloudAtStart) {
        let built = buildGuardedPayload(cloudAtStart, packOpts);
        if (built.destructive && built.destructive.blocked) {
          hubSetSyncStatus('pending', 'Cloud同期待ち');
          if (typeof hubMarkPendingCloudWrite === 'function') hubMarkPendingCloudWrite();
          return false;
        }
        let hash = (hubPushCloudDocUsesSinglePreWriteFetch(force) && built.payload)
          ? String(built.payload.updatedAt || Date.now())
          : hubComputeContentHash(hubUnpackFirestorePayload(built.payload));
        if (!force && hash === hubLastPushedHash) {
          hubSetSyncStatus('done');
          return false;
        }

        let singlePreWriteFetch =
          packMergedInMemory && n === 0 && built.preferLocal;

        if (singlePreWriteFetch) {
          if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('PRE_CLOUD_DONE');
          return writeBuiltPayload(built, n, hash);
        }

        // Re-fetch immediately before write. If another device/tab updated
        // mid-flight, re-merge and rebuild payload before set().
        return hubFetchCloudDoc().then(function (cloudJustBeforeWrite) {
          let startUa = hubCloudUpdatedAt(cloudAtStart);
          let freshUa = hubCloudUpdatedAt(cloudJustBeforeWrite);
          // Stale client: cloud moved ahead of the doc we merged → rematch.
          if (hubCloudDocChanged(cloudAtStart, cloudJustBeforeWrite) ||
              (freshUa > 0 && freshUa > startUa) ||
              (hubLastSeenCloudUpdatedAt > 0 && freshUa > hubLastSeenCloudUpdatedAt && n === 0)) {
            if (n + 1 < maxAttempts) {
              console.log('[hubCloudSave] cloud changed mid-flight; re-merge and retry', {
                attempt: n + 1,
                prevUpdatedAt: startUa,
                nextUpdatedAt: freshUa,
                caller: callerHint || 'hubPushCloudDoc'
              });
              return attempt(n + 1);
            }
            console.log('[hubCloudSave] cloud changed mid-flight; final rematch before write', {
              prevUpdatedAt: startUa,
              nextUpdatedAt: freshUa,
              caller: callerHint || 'hubPushCloudDoc'
            });
            built = buildGuardedPayload(cloudJustBeforeWrite, packOpts);
            if (built.destructive && built.destructive.blocked) {
              hubSetSyncStatus('pending', 'Cloud同期待ち');
              if (typeof hubMarkPendingCloudWrite === 'function') hubMarkPendingCloudWrite();
              return false;
            }
            hash = hubComputeContentHash(hubUnpackFirestorePayload(built.payload));
          }

          if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('PRE_CLOUD_DONE');
          return writeBuiltPayload(built, n, hash);
        });
      });
    });
  }

  return attempt(0).catch(function (err) {
    hubSetSyncStatus('offline');
    throw err;
  });
}

function hubDeleteCloudData() {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    return Promise.resolve(false);
  }
  if (hubAreAutomaticCloudWritesBlocked()) {
    try {
      console.log('[hubCloudWriteGate] block hubDeleteCloudData');
    } catch (e) {}
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  return hubFetchCloudWriteGate(true).then(function (gate) {
    if (hubIsCloudWriteGateDocSuspended(gate)) {
      try {
        console.log('[hubCloudWriteGate] block hubDeleteCloudData remote suspended');
      } catch (e) {}
      return false;
    }
    hubLastPushedHash = '';
    return ref.delete().catch(function () { return false; });
  });
}

function hubRefreshViewsAfterSync(viewState) {
  hubBeginCloudWriteSuppress('refresh-after-sync');
  try {
    if (viewState && typeof hubRestoreOrgChartViewState === 'function') {
      hubRestoreOrgChartViewState(viewState);
    }
    let onOrca = typeof orcaOrgPage !== 'undefined' &&
      orcaOrgPage && !orcaOrgPage.classList.contains('hidden');
    let onEni = typeof eniOrgPage !== 'undefined' &&
      eniOrgPage && !eniOrgPage.classList.contains('hidden');
    // index.html render() → orcaRender/eniRender は syncRefresh なしで Cloud 予約するため、
    // 組織図表示中は syncRefresh 付きの専用 render のみ呼ぶ
    if (onOrca && typeof orcaRender === 'function') {
      orcaRender({ syncRefresh: true });
    } else if (onEni && typeof eniRender === 'function') {
      eniRender({ syncRefresh: true });
    } else if (typeof render === 'function') {
      render();
    }
    if (viewState && typeof hubRestoreOrgChartScrollState === 'function') {
      hubRestoreOrgChartScrollState(viewState);
    }
  } finally {
    hubEndCloudWriteSuppress('refresh-after-sync');
  }
}

function hubApplyMergedHubData(merged, cloudHash, opts) {
  opts = opts || {};
  if (!merged || typeof hubApplyData !== 'function') return false;
  hubBeginCloudWriteSuppress('apply-merged');
  let viewState = typeof hubCaptureOrgChartViewState === 'function'
    ? hubCaptureOrgChartViewState()
    : null;
  let beforeHash = typeof hubComputeContentHash === 'function'
    ? hubComputeContentHash(hubPackLocalData())
    : '';
  try {
    hubApplyData(merged, { skipMerge: true });
    // 同期マージで rootId がメインへ上書きされても、表示中アカウントが残っていれば復元
    if (viewState && typeof hubRestoreOrgChartViewState === 'function') {
      hubRestoreOrgChartViewState(viewState);
    }
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
    if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
    if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
    if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
    if (typeof ensureRevenueLog === 'function') ensureRevenueLog();
    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
  } finally {
    hubEndCloudWriteSuppress('apply-merged');
  }
  let afterHash = typeof hubComputeContentHash === 'function'
    ? hubComputeContentHash(hubPackLocalData())
    : '';
  hubLastPushedHash = cloudHash || hubLastPushedHash;
  if (!opts.skipRefresh && beforeHash !== afterHash) hubRefreshViewsAfterSync(viewState);
  return beforeHash !== afterHash;
}

function hubEnrichLocalFromCloud(cloudDoc) {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) return false;
  if (!cloudDoc || typeof hubMergeHubDocuments !== 'function') return false;
  // 追加直後の enrich ではメモリ上の最新を優先（localStorage 再読込だと競合で新規が落ちる）
  let localData = typeof hubPackLocalData === 'function'
    ? hubPackLocalData()
    : ((typeof hubLoadFromStorage === 'function' ? hubLoadFromStorage() : null) || {}).data;
  if (!localData && typeof hubCreateEmptyData === 'function') localData = hubCreateEmptyData();
  let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
  let merged = hubMergeHubDocuments(localData, cloudUnpacked);
  return hubApplyMergedHubData(merged, hubComputeContentHash(cloudUnpacked));
}

function hubEnrichLocalOrcaFromCloud(cloudDoc) {
  return hubEnrichLocalFromCloud(cloudDoc);
}

function hubRunCloudSave(force) {
  if (hubAreAutomaticCloudWritesBlocked()) {
    hubCloudSaveQueued = false;
    try {
      console.log('[hubCloudWriteGate] block hubRunCloudSave', {
        suspended: hubIsCloudWriteSuspended(),
        explicitOnly: hubIsCloudWriteExplicitOnly(),
        bypass: !!hubCloudWriteExplicitBypass
      });
    } catch (e) {}
    return Promise.resolve(false);
  }
  if (!force && !hubCloudWriteExplicitBypass && !hubHasLocalDirtyChanges()) {
    try {
      console.log('[hubCloudDirty] skip hubRunCloudSave (not dirty)', {});
    } catch (e) {}
    return Promise.resolve(false);
  }
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return Promise.resolve(false);
  }
  // シミュレーション仮データをクラウドへ送らない／enrich で sim を落とさない
  if (typeof hubIsAnyOrgSimActive === 'function' && hubIsAnyOrgSimActive()) {
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline');
    return Promise.resolve(false);
  }
  if (hubCloudSaveInFlight) {
    // Do not queue follow-up saves while explicit-only / restore gates are active.
    if (hubIsCloudWriteExplicitOnly() && !hubCloudWriteExplicitBypass) {
      return Promise.resolve(false);
    }
    if ((force || hubHasLocalDirtyChanges()) && !hubCloudWriteSuppressDepth) {
      hubCloudSaveQueued = true;
    }
    return Promise.resolve(false);
  }
  hubCloudSaveInFlight = true;
  // hubPushCloudDoc always re-fetches cloud, rematches on concurrent updates, then set().
  let savePromise = hubPushCloudDoc(force, null, 'hubRunCloudSave').catch(function () {
    hubSetSyncStatus('offline');
    return false;
  }).finally(function () {
    hubCloudSaveInFlight = false;
    hubCloudSaveInFlightPromise = null;
    if (hubAreAutomaticCloudWritesBlocked()) {
      hubCloudSaveQueued = false;
      return;
    }
    let shouldFollowUp = hubCloudSaveQueued && hubHasLocalDirtyChanges();
    hubCloudSaveQueued = false;
    if (shouldFollowUp) {
      // Revenue cloud confirm will push explicitly after joining any in-flight save.
      if (typeof hubIsRevenueInputSaveFlowActive === 'function' && hubIsRevenueInputSaveFlowActive()) {
        try {
          console.log('[hubRevenueSave] skip automatic follow-up — revenue cloud confirm active');
        } catch (e) {}
      } else {
        hubRunCloudSave(false);
      }
    }
  });
  hubCloudSaveInFlightPromise = savePromise;
  return savePromise;
}

/**
 * Wait until no hubRunCloudSave push is in flight (joins tracked promise, polls briefly).
 * Used by revenue explicit save to serialize after background/automatic saves.
 */
function hubWaitForCloudSaveIdle(opts) {
  opts = opts || {};
  let maxRounds = typeof opts.maxRounds === 'number' ? opts.maxRounds : 40;
  let pollMs = typeof opts.pollMs === 'number' ? opts.pollMs : 25;

  function waitOneRound(round) {
    if (!hubCloudSaveInFlight) {
      return Promise.resolve(true);
    }
    if (round >= maxRounds) {
      return Promise.resolve(false);
    }
    let tracked = hubCloudSaveInFlightPromise;
    let waitP = tracked
      ? tracked.catch(function () { return false; })
      : new Promise(function (resolve) { setTimeout(resolve, pollMs); });
    return waitP.then(function () {
      if (hubCloudSaveInFlight) {
        return waitOneRound(round + 1);
      }
      return true;
    });
  }

  return waitOneRound(0);
}

function hubScheduleCloudSave(immediate) {
  if (!hubIsCloudWriteScheduleAllowed()) {
    if (hubCloudWriteSuppressDepth > 0) {
      try {
        console.log('[hubCloudWriteSuppress] block hubScheduleCloudSave', { immediate: !!immediate });
      } catch (e) {}
    } else if (!hubHasLocalDirtyChanges()) {
      try {
        console.log('[hubCloudDirty] skip hubScheduleCloudSave (not dirty)', { immediate: !!immediate });
      } catch (e) {}
    }
    return;
  }
  if (hubAreAutomaticCloudWritesBlocked()) {
    hubClearCloudSaveTimerAndQueue('schedule-blocked');
    try {
      console.log('[hubCloudWriteGate] block hubScheduleCloudSave', {
        immediate: !!immediate,
        suspended: hubIsCloudWriteSuspended(),
        explicitOnly: hubIsCloudWriteExplicitOnly()
      });
    } catch (e) {}
    return;
  }
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) return;
  if (typeof hubIsAnyOrgSimActive === 'function' && hubIsAnyOrgSimActive()) return;
  if (!hubFirebaseReady || !hubFirebaseUid) return;
  if (hubCloudSaveTimer) {
    clearTimeout(hubCloudSaveTimer);
    hubCloudSaveTimer = null;
  }
  if (immediate) {
    hubRunCloudSave(true);
    return;
  }
  hubCloudSaveTimer = setTimeout(function () {
    hubCloudSaveTimer = null;
    if (hubAreAutomaticCloudWritesBlocked()) return;
    hubRunCloudSave(false);
  }, hubCloudSaveDelayMs);
}

function hubApplyCloudDataIfNewer(cloudDoc, localUpdatedAt) {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) return false;
  if (!cloudDoc || typeof hubMergeHubDocuments !== 'function') return false;
  let local = typeof hubLoadFromStorage === 'function' ? hubLoadFromStorage() : { data: hubCreateEmptyData() };
  let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
  let merged = hubMergeHubDocuments(local.data, cloudUnpacked);
  let mergedHash = hubComputeContentHash(merged);
  let cloudHash = hubComputeContentHash(cloudUnpacked);
  let changed = hubApplyMergedHubData(merged, cloudHash);
  if (mergedHash !== cloudHash) return 'push';
  return changed;
}

/**
 * Cloud READ-only pull. Never blocked by write gate.
 * Merges cloud into local cache; does not push.
 */
function hubPullCloudData(reason) {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return Promise.resolve(false);
  }
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) {
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline', 'オフライン');
    return Promise.resolve(false);
  }
  if (hubPullInFlight) return Promise.resolve(false);
  hubPullInFlight = true;
  hubSetSyncStatus('syncing', 'Cloud同期中…');
  let local = hubLoadFromStorage();

  return hubFetchCloudDoc().then(function (cloudDoc) {
    hubLastPullAt = Date.now();
    if (!cloudDoc) {
      hubSetSyncStatus(hubSyncPendingWrites > 0 ? 'pending' : 'done', 'Cloud同期済み');
      return true;
    }
    hubLastCloudUpdatedAt = hubCloudUpdatedAt(cloudDoc);
    let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
    let localEmpty = typeof hubIsEffectivelyEmptyHubData === 'function'
      ? hubIsEffectivelyEmptyHubData(local.data)
      : !!local.isNew;
    let cloudEmpty = typeof hubIsEffectivelyEmptyHubData === 'function'
      ? hubIsEffectivelyEmptyHubData(cloudUnpacked)
      : false;
    let merged;
    if (localEmpty && !cloudEmpty) {
      merged = cloudUnpacked;
    } else {
      merged = hubMergeHubDocuments(local.data, cloudUnpacked);
    }
    let cloudHash = hubComputeContentHash(cloudUnpacked);
    hubApplyMergedHubData(merged, cloudHash);
    try {
      console.log('[hubCloudPull] applied', { reason: reason || '', cloudUpdatedAt: hubLastCloudUpdatedAt });
    } catch (e) {}
    hubSetSyncStatus(hubSyncPendingWrites > 0 ? 'pending' : 'done', 'Cloud同期済み');
    return true;
  }).catch(function (err) {
    try {
      console.log('[hubCloudPull] failed', { reason: reason || '', err: String(err && err.message || err) });
    } catch (e2) {}
    hubSetSyncStatus('failed', '同期失敗');
    return false;
  }).finally(function () {
    hubPullInFlight = false;
  });
}

function hubPullCloudDataIfStale(reason) {
  if (Date.now() - hubLastPullAt < hubPullMinIntervalMs) return Promise.resolve(false);
  return hubPullCloudData(reason);
}

/** Full sync: READ always; WRITE only when user-edited dirty data exists. */
function hubSyncHubData() {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline', 'オフライン');
    return Promise.resolve(false);
  }
  if (hubSyncInFlight) return Promise.resolve(false);
  hubSyncInFlight = true;

  return hubPullCloudData('hubSyncHubData').then(function (pulled) {
    if (hubAreAutomaticCloudWritesBlocked()) {
      try {
        console.log('[hubCloudWriteGate] sync pull-only (writes blocked)', {
          suspended: hubIsCloudWriteSuspended(),
          explicitOnly: hubIsCloudWriteExplicitOnly()
        });
      } catch (e) {}
      return pulled;
    }
    if (!hubHasLocalDirtyChanges()) {
      hubSetSyncStatus(hubSyncPendingWrites > 0 ? 'pending' : 'done', 'Cloud同期済み');
      return pulled;
    }
    return hubRunCloudSave(true).then(function (ok) {
      if (ok && typeof hubClearPendingCloudWrite === 'function') hubClearPendingCloudWrite();
      return ok;
    });
  }).catch(function () {
    hubSetSyncStatus('failed', '同期失敗');
    return false;
  }).finally(function () {
    hubSyncInFlight = false;
  });
}

/**
 * User-initiated revenue save Cloud push.
 * Uses explicit-once path when automatic gate (explicitOnly) is armed; still blocked on hard suspend.
 */
function hubRunRevenueCloudSaveOnce() {
  hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'ENTER', null);
  hubReleaseStaleCloudWriteSuspendForExplicitSave('revenue-save');
  if (hubIsCloudWriteHardSuspended()) {
    hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'ABORT', { reason: 'restore-in-progress' });
    return Promise.resolve(false);
  }

  function runRevenueCloudWrite() {
    if (hubIsCloudWriteExplicitOnly()) {
      hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'ENTER', { path: 'explicit-once' });
      return hubRunExplicitCloudSaveOnce('revenue-save');
    }
    hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'ENTER', { path: 'revenue-force' });
    return hubRunCloudSave(true);
  }

  function beginRevenueCloudWrite() {
    if (!hubCloudSaveInFlight) {
      return runRevenueCloudWrite();
    }
    hubRevenueSaveTrace('hubWaitForCloudSaveIdle', 'ENTER', { reason: 'revenue-save-inflight' });
    return hubWaitForCloudSaveIdle({ reason: 'revenue-save' }).then(function (idleOk) {
      if (!idleOk) {
        hubRevenueSaveTrace('hubWaitForCloudSaveIdle', 'ABORT', { reason: 'timeout' });
        hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'ABORT', { reason: 'wait-idle-timeout' });
        return false;
      }
      hubRevenueSaveTrace('hubWaitForCloudSaveIdle', 'SUCCESS', null);
      return runRevenueCloudWrite();
    });
  }

  return beginRevenueCloudWrite();
}

function hubCloudHasRevenueDay(doc, dateKey) {
  if (!doc || !dateKey) return false;
  if (doc.revenue && doc.revenue.revenueLog && doc.revenue.revenueLog[dateKey]) return true;
  if (typeof hubUnpackFirestorePayload === 'function') {
    let unpacked = hubUnpackFirestorePayload(doc);
    let rev = (unpacked.settings && unpacked.settings.revenueLog) ||
      (unpacked.revenue && unpacked.revenue.revenueLog) || {};
    return !!rev[dateKey];
  }
  return false;
}

/**
 * Revenue save: local → cloud write → re-read → verify → toast message.
 * Returns Promise<{ ok, status, message }>.
 */
function hubSaveRevenueWithCloudConfirm(opts) {
  opts = opts || {};
  let successMessage = opts.successMessage || '✅ 保存しました';
  let pendingMessage = opts.pendingMessage || '端末に保存済み・Cloud同期待ち';
  let savePath = 'revenue-save';
  hubRevenueSaveTraceLog = [];
  hubRevenueSaveTrace('hubSaveRevenueWithCloudConfirm', 'ENTER', {
    cloudVerifyDateKey: opts.cloudVerifyDateKey || '',
    jsBuild: typeof HUB_FIREBASE_JS_BUILD !== 'undefined' ? HUB_FIREBASE_JS_BUILD : null
  });
  let staleCleared = hubReleaseStaleCloudWriteSuspendForExplicitSave(savePath + ':pre');
  hubLogRevenueSaveDiagnostics('start', savePath, { staleSuspendCleared: staleCleared });
  hubRevenueSaveTrace('hubReleaseStaleCloudWriteSuspendForExplicitSave', staleCleared ? 'SUCCESS' : 'ENTER', {
    staleCleared: staleCleared
  });

  function fail(status, message, err) {
    let diag = hubCollectRevenueSaveDiagnostics(savePath);
    hubLogRevenueSaveDiagnostics('fail:' + status, savePath, diag);
    hubRevenueSaveTrace('hubSaveRevenueWithCloudConfirm', 'ABORT', {
      status: status,
      diagnostics: diag,
      errorMessage: err ? String(err.message || err) : null
    });
    hubMarkPendingCloudWrite();
    return {
      ok: false,
      status: status,
      message: message,
      diagnostics: diag,
      trace: hubRevenueSaveTraceLog.slice(),
      errorMessage: err ? String(err.message || err) : null
    };
  }

  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
    return Promise.resolve({ ok: true, status: 'local-dev', message: successMessage });
  }
  if (typeof hubIsAnyOrgSimActive === 'function' && hubIsAnyOrgSimActive()) {
    return Promise.resolve({ ok: true, status: 'sim', message: successMessage });
  }

  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    return Promise.resolve(fail('local-only', pendingMessage));
  }
  // True operator restore session: block even user explicit saves.
  if (hubIsCloudWriteHardSuspended()) {
    return Promise.resolve(fail('write-gate', pendingMessage));
  }
  if (!hubFirebaseReady || !hubFirebaseUid) {
    return Promise.resolve(fail('offline', pendingMessage));
  }

  hubMarkLocalDirtyForCloud('revenue-save');
  hubSetSyncStatus('syncing', 'Cloud保存中…');
  let runPath = hubIsCloudWriteExplicitOnly() ? 'explicit-once' : 'automatic-open';
  hubLogRevenueSaveDiagnostics('run', savePath, { runPath: runPath });
  if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('PRE_CLOUD_START');
  return hubRunRevenueCloudSaveOnce().then(function (written) {
    if (!written) {
      hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'ABORT', { reason: 'returned-false' });
      return fail('cloud-write-failed', pendingMessage);
    }
    hubRevenueSaveTrace('hubRunRevenueCloudSaveOnce', 'SUCCESS', null);
    if (typeof opts.verifyFn === 'function' && !opts.verifyFn()) {
      hubRevenueSaveTrace('verifyFn', 'ABORT', { reason: 'local-verify-failed' });
      return fail('verify-failed', pendingMessage);
    }
    hubRevenueSaveTrace('verifyFn', 'SUCCESS', null);
    let cloudDateKey = opts.cloudVerifyDateKey || '';
    function finishCloudSuccess(verifyMeta) {
      hubClearPendingCloudWrite();
      hubClearLocalDirtyForCloud('revenue-save-success');
      hubSetSyncStatus('done', 'Cloud同期済み');
      if (typeof hubRevenueSaveMark === 'function') hubRevenueSaveMark('VERIFY_DONE');
      hubLogRevenueSaveDiagnostics('success', savePath, Object.assign({ runPath: runPath }, verifyMeta || {}));
      hubRevenueSaveTrace('hubSaveRevenueWithCloudConfirm', 'SUCCESS', verifyMeta || null);
      return {
        ok: true,
        status: 'synced',
        message: successMessage,
        trace: hubRevenueSaveTraceLog.slice(),
        timing: typeof hubRevenueSaveTimingReport === 'function' ? hubRevenueSaveTimingReport() : null
      };
    }
    if (cloudDateKey && typeof hubFetchCloudDocForSaveVerify === 'function') {
      hubRevenueSaveTrace('cloudDateVerify', 'ENTER', { cloudDateKey: cloudDateKey });
      return hubFetchCloudDocForSaveVerify(cloudDateKey).then(function (verified) {
        if (!verified.hasDay) {
          hubRevenueSaveTrace('cloudDateVerify', 'ABORT', {
            reason: 'cloud-day-missing',
            attempt: verified.attempt
          });
          return fail('verify-failed', pendingMessage);
        }
        hubRevenueSaveTrace('cloudDateVerify', 'SUCCESS', { attempt: verified.attempt });
        return finishCloudSuccess({ cloudDateKey: cloudDateKey, attempt: verified.attempt });
      });
    }
    return finishCloudSuccess(null);
  }).catch(function (err) {
    hubLogRevenueSaveDiagnostics('error', savePath, { err: String(err && err.message || err) });
    return fail('error', pendingMessage, err);
  });
}

function hubBindFirebaseConnectivity() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', function () {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return;
    if (hubFirebaseReady && hubFirebaseUid) {
      hubPullCloudDataIfStale('online').then(function () {
        if (!hubAreAutomaticCloudWritesBlocked() && hubHasLocalDirtyChanges()) {
          hubRunCloudSave(false);
        }
      });
    }
  });
  window.addEventListener('offline', function () {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
      if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
      return;
    }
    if (hubSyncState !== 'syncing') hubSetSyncStatus('offline', 'オフライン');
  });
  document.addEventListener('visibilitychange', function () {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return;
    if (document.visibilityState === 'visible' && hubFirebaseReady && hubFirebaseUid) {
      hubPullCloudDataIfStale('visibility');
    }
  });
  window.addEventListener('pageshow', function () {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return;
    if (hubFirebaseReady && hubFirebaseUid) hubPullCloudDataIfStale('pageshow');
  });
}

if (typeof window !== 'undefined') {
  window.hubScheduleCloudSave = hubScheduleCloudSave;
  window.hubHasLocalDirtyChanges = hubHasLocalDirtyChanges;
  window.hubMarkLocalDirtyForCloud = hubMarkLocalDirtyForCloud;
  window.hubClearLocalDirtyForCloud = hubClearLocalDirtyForCloud;
  window.hubBeginCloudWriteSuppress = hubBeginCloudWriteSuppress;
  window.hubEndCloudWriteSuppress = hubEndCloudWriteSuppress;
  window.hubIsCloudWriteScheduleAllowed = hubIsCloudWriteScheduleAllowed;
  window.hubIsRevenueInputSaveFlowActive = hubIsRevenueInputSaveFlowActive;
  window.hubBeginRevenueInputSaveFlow = hubBeginRevenueInputSaveFlow;
  window.hubEndRevenueInputSaveFlow = hubEndRevenueInputSaveFlow;
  window.hubIsCloudWriteSuspended = hubIsCloudWriteSuspended;
  window.hubIsCloudWriteHardSuspended = hubIsCloudWriteHardSuspended;
  window.hubIsCloudWriteExplicitOnly = hubIsCloudWriteExplicitOnly;
  window.hubAreAutomaticCloudWritesBlocked = hubAreAutomaticCloudWritesBlocked;
  window.hubReleaseStaleCloudWriteSuspendForExplicitSave = hubReleaseStaleCloudWriteSuspendForExplicitSave;
  window.hubBeginOperatorCloudWriteSession = hubBeginOperatorCloudWriteSession;
  window.hubEndOperatorCloudWriteSession = hubEndOperatorCloudWriteSession;
  window.hubCollectRevenueSaveDiagnostics = hubCollectRevenueSaveDiagnostics;
  window.hubGetLoadedJsBuildInfo = hubGetLoadedJsBuildInfo;
  window.hubRevenueSaveTrace = hubRevenueSaveTrace;
  window.hubRevenueSaveTraceLog = hubRevenueSaveTraceLog;
  window.HUB_FIREBASE_JS_BUILD = HUB_FIREBASE_JS_BUILD;
  window.hubFetchCloudDocForSaveVerify = hubFetchCloudDocForSaveVerify;
  window.hubSuspendCloudWrites = hubSuspendCloudWrites;
  window.hubResumeCloudWrites = hubResumeCloudWrites;
  window.hubAllowAutomaticCloudWrites = hubAllowAutomaticCloudWrites;
  window.hubArmCloudWriteExplicitOnly = hubArmCloudWriteExplicitOnly;
  window.hubRunExplicitCloudSaveOnce = hubRunExplicitCloudSaveOnce;
  window.hubSaveNow = function () {
    hubSaveToStorage({ immediate: true });
  };
  window.hubSyncHubData = hubSyncHubData;
  window.hubPullCloudData = hubPullCloudData;
  window.hubPullCloudDataIfStale = hubPullCloudDataIfStale;
  window.hubSaveRevenueWithCloudConfirm = hubSaveRevenueWithCloudConfirm;
  window.hubRevenueSaveTimingReset = hubRevenueSaveTimingReset;
  window.hubRevenueSaveMark = hubRevenueSaveMark;
  window.hubRevenueSaveTimingReport = hubRevenueSaveTimingReport;
  window.hubPushCloudDocUsesSinglePreWriteFetch = hubPushCloudDocUsesSinglePreWriteFetch;
  window.hubFlushRevenueSaveLocalPersist = hubFlushRevenueSaveLocalPersist;
  window.hubRunDeferredRevenueDashboardRefresh = hubRunDeferredRevenueDashboardRefresh;
  window.hubRunRevenueCloudSaveOnce = hubRunRevenueCloudSaveOnce;
  window.hubWaitForCloudSaveIdle = hubWaitForCloudSaveIdle;
  window.hubCloudHasRevenueDay = hubCloudHasRevenueDay;
  window.hubMarkPendingCloudWrite = hubMarkPendingCloudWrite;
  window.hubClearPendingCloudWrite = hubClearPendingCloudWrite;
  window.hubFetchCloudDoc = hubFetchCloudDoc;
  window.hubPushCloudDoc = hubPushCloudDoc;
  window.hubMarkExplicitOrcaDelete = hubMarkExplicitOrcaDelete;
  window.hubClearExplicitOrcaDelete = hubClearExplicitOrcaDelete;
  window.hubMarkExplicitHubDataReset = hubMarkExplicitHubDataReset;
  window.hubClearExplicitHubDataReset = hubClearExplicitHubDataReset;
  window.hubGuardOrcaPayloadBeforePush = hubGuardOrcaPayloadBeforePush;
  window.hubGuardDestructiveHubPayloadBeforePush = hubGuardDestructiveHubPayloadBeforePush;
  window.hubCollectHubPayloadAccountStats = hubCollectHubPayloadAccountStats;
  window.hubCountOrcaInFirestorePayload = hubCountOrcaInFirestorePayload;
  window.hubFetchCloudWriteGate = hubFetchCloudWriteGate;
  window.hubSetCloudWriteGateSuspended = hubSetCloudWriteGateSuspended;
  window.hubWriteGateDocRef = hubWriteGateDocRef;
  window.hubIsCloudWriteGateDocSuspended = hubIsCloudWriteGateDocSuspended;
  window.hubEnrichLocalFromCloud = hubEnrichLocalFromCloud;
  window.hubEnrichLocalOrcaFromCloud = hubEnrichLocalOrcaFromCloud;
  window.hubDeleteCloudData = hubDeleteCloudData;
  window.hubSetSyncStatus = hubSetSyncStatus;
  window.hubInitFirebaseServices = hubInitFirebaseServices;
  window.hubFirebaseConfigValid = hubFirebaseConfigValid;
  window.hubEnsureFirebaseServices = hubEnsureFirebaseServices;
  window.hubGetFirebaseAuth = hubGetFirebaseAuth;
  window.hubProfileDocRef = hubProfileDocRef;
  window.hubSetCurrentUid = hubSetCurrentUid;
  hubBindFirebaseConnectivity();
}
