/* OUKEI HUB Firebase Sync — Ver2.0.5
 * Google 認証後に LocalStorage / Firestore を同期
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

function hubFirebaseConfigValid() {
  let cfg = typeof HUB_FIREBASE_CONFIG !== 'undefined' ? HUB_FIREBASE_CONFIG : null;
  return !!(cfg && cfg.apiKey && cfg.projectId && cfg.appId);
}

function hubSetSyncStatus(state, message) {
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
  if (hubFirebaseReady || typeof firebase === 'undefined') return false;
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
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(null);
  return ref.get().then(function (snap) {
    if (!snap.exists) return null;
    return snap.data();
  });
}

function hubPushCloudDoc(force) {
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
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  hubLastPushedHash = '';
  return ref.delete().catch(function () { return false; });
}

function hubRunCloudSave(force) {
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline');
    return Promise.resolve(false);
  }
  if (hubCloudSaveInFlight) {
    hubCloudSaveQueued = true;
    return Promise.resolve(false);
  }
  hubCloudSaveInFlight = true;
  return hubPushCloudDoc(force).catch(function () {
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
  if (!cloudDoc) return false;
  let unpacked = hubUnpackFirestorePayload(cloudDoc);
  let cloudUpdatedAt = unpacked.updatedAt || 0;
  let localTs = typeof localUpdatedAt === 'number' ? localUpdatedAt : 0;
  if (cloudUpdatedAt > localTs) {
    hubApplyData(unpacked);
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
    if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
    if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
    if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
    if (typeof ensureRevenueLog === 'function') ensureRevenueLog();
    hubSaveToStorage({ localOnly: true });
    hubLastPushedHash = hubComputeContentHash(unpacked);
    if (typeof render === 'function') render();
    return true;
  }
  if (localTs > cloudUpdatedAt) {
    return 'push';
  }
  hubLastPushedHash = hubComputeContentHash(unpacked);
  return false;
}

function hubSyncHubData() {
  if (!hubFirebaseReady || !hubFirebaseUid) {
    hubSetSyncStatus('offline', 'オフライン');
    return Promise.resolve(false);
  }

  hubSetSyncStatus('syncing');
  let local = hubLoadFromStorage();
  let localUpdatedAt = (local.data && local.data.updatedAt) || 0;

  return hubFetchCloudDoc().then(function (cloudDoc) {
    let result = hubApplyCloudDataIfNewer(cloudDoc, localUpdatedAt);
    if (result === 'push') {
      return hubRunCloudSave(true);
    }
    if (result === true) {
      hubSetSyncStatus('done');
      return true;
    }
    if (!cloudDoc && !local.isNew) {
      return hubRunCloudSave(true);
    }
    hubSetSyncStatus('done');
    return true;
  }).catch(function () {
    hubSetSyncStatus('offline', 'オフライン');
    return false;
  });
}

function hubBindFirebaseConnectivity() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', function () {
    if (hubFirebaseReady && hubFirebaseUid) hubRunCloudSave(false);
  });
  window.addEventListener('offline', function () {
    if (hubSyncState !== 'syncing') hubSetSyncStatus('offline', 'オフライン');
  });
}

if (typeof window !== 'undefined') {
  window.hubScheduleCloudSave = hubScheduleCloudSave;
  window.hubSaveNow = function () {
    hubSaveToStorage({ immediate: true });
  };
  window.hubSyncHubData = hubSyncHubData;
  window.hubDeleteCloudData = hubDeleteCloudData;
  window.hubSetSyncStatus = hubSetSyncStatus;
  window.hubInitFirebaseServices = hubInitFirebaseServices;
  window.hubFirebaseConfigValid = hubFirebaseConfigValid;
  window.hubGetFirebaseAuth = hubGetFirebaseAuth;
  window.hubProfileDocRef = hubProfileDocRef;
  window.hubSetCurrentUid = hubSetCurrentUid;
  hubBindFirebaseConnectivity();
}
