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
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  hubSetSyncStatus('syncing');

  let maxAttempts = 3;

  function buildGuardedPayload(cloudDoc) {
    if (cloudDoc) hubEnrichLocalFromCloud(cloudDoc);
    let payload = hubPackFirestorePayload(Date.now());
    let guarded = hubGuardOrcaPayloadBeforePush(
      payload,
      cloudDoc,
      callerHint || 'hubPushCloudDoc'
    );
    payload = guarded.payload;
    if (guarded.blocked || guarded.action === 'allow_explicit_orca_delete') {
      hubApplyPreservedOrcaPayloadLocally(payload);
    }
    return { payload: payload, guarded: guarded };
  }

  function attempt(n) {
    // Always fetch latest cloud, merge into local, then pack.
    return hubFetchCloudDoc().then(function (cloudAtStart) {
      let built = buildGuardedPayload(cloudAtStart);
      let hash = hubComputeContentHash(hubUnpackFirestorePayload(built.payload));
      if (!force && hash === hubLastPushedHash) {
        hubSetSyncStatus('done');
        return false;
      }

      // Re-fetch immediately before write. If another device/tab updated
      // mid-flight, re-merge and rebuild payload before set().
      return hubFetchCloudDoc().then(function (cloudJustBeforeWrite) {
        if (hubCloudDocChanged(cloudAtStart, cloudJustBeforeWrite)) {
          if (n + 1 < maxAttempts) {
            console.log('[hubCloudSave] cloud changed mid-flight; re-merge and retry', {
              attempt: n + 1,
              prevUpdatedAt: hubCloudUpdatedAt(cloudAtStart),
              nextUpdatedAt: hubCloudUpdatedAt(cloudJustBeforeWrite),
              caller: callerHint || 'hubPushCloudDoc'
            });
            return attempt(n + 1);
          }
          // Last attempt: rebuild from the freshest cloud, then write.
          console.log('[hubCloudSave] cloud changed mid-flight; final rematch before write', {
            prevUpdatedAt: hubCloudUpdatedAt(cloudAtStart),
            nextUpdatedAt: hubCloudUpdatedAt(cloudJustBeforeWrite),
            caller: callerHint || 'hubPushCloudDoc'
          });
          built = buildGuardedPayload(cloudJustBeforeWrite);
          hash = hubComputeContentHash(hubUnpackFirestorePayload(built.payload));
        }

        console.log('[hubOrcaPushGuard] ref.set about to write', {
          cloudOrca: built.guarded.cloudCounts,
          payloadOrca: built.guarded.payloadCounts,
          explicitOrcaDelete: !!hubExplicitOrcaDeletePending,
          action: built.guarded.action,
          writeAllowed: true,
          orcaEmptyWipeBlocked: !!built.guarded.blocked,
          schemaVersion: built.payload.schemaVersion,
          rematchAttempts: n,
          caller: (built.guarded.log && built.guarded.log.caller) || callerHint || 'hubPushCloudDoc'
        });

        return ref.set(built.payload).then(function () {
          hubLastPushedHash = hash;
          if (built.guarded.action === 'allow_explicit_orca_delete') {
            hubClearExplicitOrcaDelete();
          }
          hubSetSyncStatus('done');
          return true;
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
  if (!hubFirebaseReady || !hubFirebaseUid) return Promise.resolve(false);
  let ref = hubFirestoreDocRef();
  if (!ref) return Promise.resolve(false);
  hubLastPushedHash = '';
  return ref.delete().catch(function () { return false; });
}

function hubRefreshViewsAfterSync() {
  // render() → renderHome() → updateHomeDashboard() already calls renderPortfolio()
  if (typeof render === 'function') render();
  if (typeof orcaRender === 'function' &&
      typeof orcaOrgPage !== 'undefined' &&
      orcaOrgPage &&
      !orcaOrgPage.classList.contains('hidden')) {
    orcaRender();
  }
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
  if (typeof hubIsCloudReadEnabled === 'function' && !hubIsCloudReadEnabled()) return false;
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
    if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
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
  // hubPushCloudDoc always re-fetches cloud, rematches on concurrent updates, then set().
  return hubPushCloudDoc(force, null, 'hubRunCloudSave').catch(function () {
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

  hubSetSyncStatus('syncing');
  let local = hubLoadFromStorage();

  return hubFetchCloudDoc().then(function (cloudDoc) {
    if (!cloudDoc) {
      // クラウド未作成: 現在UIDの端末データ（空含む）を本人ドキュメントとして初回保存。
      // 共有LocalStorageフォールバックは廃止済みのため、他ユーザーデータは混入しない。
      return hubRunCloudSave(true);
    }

    let cloudUnpacked = hubUnpackFirestorePayload(cloudDoc);
    let localEmpty = typeof hubIsEffectivelyEmptyHubData === 'function'
      ? hubIsEffectivelyEmptyHubData(local.data)
      : !!local.isNew;
    let cloudEmpty = typeof hubIsEffectivelyEmptyHubData === 'function'
      ? hubIsEffectivelyEmptyHubData(cloudUnpacked)
      : false;

    // 新規空ローカル × クラウドに既存データ → クラウドを採用（UID別なので本人データ）
    // ローカルにデータ × クラウド空 → ローカルをプッシュ
    // 両方データあり → 通常マージ
    let merged;
    if (localEmpty && !cloudEmpty) {
      merged = cloudUnpacked;
    } else if (!localEmpty && cloudEmpty) {
      merged = local.data;
    } else {
      merged = hubMergeHubDocuments(local.data, cloudUnpacked);
    }
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
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
      if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
      return;
    }
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
  window.hubPushCloudDoc = hubPushCloudDoc;
  window.hubMarkExplicitOrcaDelete = hubMarkExplicitOrcaDelete;
  window.hubClearExplicitOrcaDelete = hubClearExplicitOrcaDelete;
  window.hubGuardOrcaPayloadBeforePush = hubGuardOrcaPayloadBeforePush;
  window.hubCountOrcaInFirestorePayload = hubCountOrcaInFirestorePayload;
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
