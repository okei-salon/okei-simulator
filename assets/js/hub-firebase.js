/* OUKEI HUB Firebase Sync — Ver2.0.9
 * Google 認証後に LocalStorage / Firestore を同期
 * 組織図・ポートフォリオはフィールド単位でマージして端末間の上書きを防ぐ
 */

var hubFirebaseApp = null;
var hubFirebaseAuth = null;
var hubFirebaseDb = null;
var hubFirebaseUid = '';
var hubCloudSaveTimer = null;
var hubCloudSaveDelayMs = 1500;
var hubCloudSaveInFlight = false;
var hubCloudSaveQueued = false;
var hubLastPushedHash = '';
var hubFirebaseReady = false;
var hubSyncState = 'offline';
var hubSyncInFlight = false;

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

function hubSetSyncStatus(state, message) {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return;
  }
  hubSyncState = state || 'offline';
  let el = document.getElementById('hubSyncStatus');
  if (!el) return;
  el.classList.remove('is-syncing', 'is-done', 'is-offline');
  if (state === 'syncing') {
    el.classList.add('is-syncing');
    el.textContent = message || '同期中…';
  } else if (state === 'done') {
    el.classList.add('is-done');
    el.textContent = message || '同期完了';
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

function hubInitFirebaseServices() {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return false;
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

function hubFetchCloudDoc() {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) {
    return Promise.resolve(null);
  }
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(null);
  return ref.get().then(function (snap) {
    if (!snap.exists) return null;
    return snap.data();
  });
}

function hubPushCloudDoc(force) {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let payload = hubPackFirestorePayload(Date.now());
  let hash = hubComputeContentHash(hubUnpackFirestorePayload(payload));
  if (!force && hash === hubLastPushedHash) {
    hubSetSyncStatus('done');
    return Promise.resolve(false);
  }
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  hubSetSyncStatus('syncing');
  return ref.set(payload).then(function () {
    hubLastPushedHash = hash;
    hubSetSyncStatus('done');
    return true;
  });
}

function hubDeleteCloudData() {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  hubLastPushedHash = '';
  return ref.delete().catch(function () { return false; });
}

function hubRefreshViewsAfterSync() {
  if (typeof render === 'function') render();
  if (typeof orcaRender === 'function' &&
      typeof orcaOrgPage !== 'undefined' &&
      orcaOrgPage &&
      !orcaOrgPage.classList.contains('hidden')) {
    orcaRender();
  }
  if (typeof renderPortfolio === 'function') renderPortfolio();
}

function hubApplyMergedHubData(merged, cloudHash) {
  if (!merged || typeof hubApplyData !== 'function') return false;
  let beforeHash = typeof hubComputeContentHash === 'function'
    ? hubComputeContentHash(hubPackLocalData())
    : '';
  hubApplyData(merged, { skipMerge: true });
  if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  if (typeof ensureRevenueLog === 'function') ensureRevenueLog();
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
  let afterHash = typeof hubComputeContentHash === 'function'
    ? hubComputeContentHash(hubPackLocalData())
    : '';
  hubLastPushedHash = cloudHash || hubLastPushedHash;
  if (beforeHash !== afterHash) hubRefreshViewsAfterSync();
  return beforeHash !== afterHash;
}

function hubEnrichLocalFromCloud(cloudDoc) {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) {
    return false;
  }
  if (!cloudDoc || typeof hubMergeHubDocuments !== 'function') return false;
  let local = typeof hubLoadFromStorage === 'function' ? hubLoadFromStorage() : { data: hubCreateEmptyData() };
  let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
  let merged = hubMergeHubDocuments(local.data, cloudUnpacked);
  return hubApplyMergedHubData(merged, hubComputeContentHash(cloudUnpacked));
}

function hubEnrichLocalOrcaFromCloud(cloudDoc) {
  return hubEnrichLocalFromCloud(cloudDoc);
}

function hubRunCloudSave(force) {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) {
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline');
    return Promise.resolve(false);
  }
  if (hubCloudSaveInFlight) {
    hubCloudSaveQueued = true;
    return Promise.resolve(false);
  }
  hubCloudSaveInFlight = true;
  return hubFetchCloudDoc().then(function (cloudDoc) {
    if (cloudDoc) hubEnrichLocalFromCloud(cloudDoc);
    return hubPushCloudDoc(force);
  }).catch(function () {
    hubSetSyncStatus('offline');
    return false;
  }).finally(function () {
    hubCloudSaveInFlight = false;
    if (hubCloudSaveQueued) {
      hubCloudSaveQueued = false;
      hubRunCloudSave(false);
    }
  });
}

function hubScheduleCloudSave(immediate) {
  if (typeof hubIsCloudWriteEnabled === 'function' && !hubIsCloudWriteEnabled()) return;
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
    hubRunCloudSave(false);
  }, hubCloudSaveDelayMs);
}

function hubApplyCloudDataIfNewer(cloudDoc, localUpdatedAt) {
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

function hubSyncHubData() {
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) {
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
    return Promise.resolve(false);
  }
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline', 'オフライン');
    return Promise.resolve(false);
  }
  if (hubSyncInFlight) return Promise.resolve(false);
  hubSyncInFlight = true;

  hubSetSyncStatus('syncing');
  let local = hubLoadFromStorage();

  return hubFetchCloudDoc().then(function (cloudDoc) {
    if (!cloudDoc) {
      if (!local.isNew) return hubRunCloudSave(true);
      hubSetSyncStatus('done');
      return true;
    }

    let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
    let merged = hubMergeHubDocuments(local.data, cloudUnpacked);
    let mergedHash = hubComputeContentHash(merged);
    let cloudHash = hubComputeContentHash(cloudUnpacked);
    hubApplyMergedHubData(merged, cloudHash);

    if (mergedHash !== cloudHash) {
      return hubRunCloudSave(true);
    }
    hubSetSyncStatus('done');
    return true;
  }).catch(function () {
    hubSetSyncStatus('offline', 'オフライン');
    return false;
  }).finally(function () {
    hubSyncInFlight = false;
  });
}

function hubBindFirebaseConnectivity() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', function () {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return;
    if (hubFirebaseReady && hubFirebaseUid) hubSyncHubData();
  });
  window.addEventListener('offline', function () {
    if (hubSyncState !== 'syncing') hubSetSyncStatus('offline', 'オフライン');
  });
  document.addEventListener('visibilitychange', function () {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return;
    if (document.visibilityState === 'visible' && hubFirebaseReady && hubFirebaseUid) {
      hubSyncHubData();
    }
  });
  window.addEventListener('pageshow', function (e) {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return;
    if (e.persisted && hubFirebaseReady && hubFirebaseUid) hubSyncHubData();
  });
}

if (typeof window !== 'undefined') {
  window.hubScheduleCloudSave = hubScheduleCloudSave;
  window.hubSaveNow = function () {
    hubSaveToStorage({ immediate: true });
  };
  window.hubSyncHubData = hubSyncHubData;
  window.hubFetchCloudDoc = hubFetchCloudDoc;
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
