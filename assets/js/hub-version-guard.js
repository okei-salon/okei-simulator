/* OUKEI HUB Schema Version Guard
 * - Compares embedded HUB_SCHEMA_VERSION to published assets/hub-app-version.json
 * - Blocks cloud writes on mismatch and prompts reload
 * Schema version bumps only when cloud data structure changes.
 */

var hubVersionMismatch = false;
var hubVersionCheckDone = false;
var hubVersionRemote = '';
var hubVersionGuardTimer = null;
var HUB_VERSION_JSON_PATH = 'assets/hub-app-version.json';
var HUB_VERSION_RELOAD_KEY = 'oukei_hub_schema_reload_v1';

function hubGetEmbeddedSchemaVersion() {
  if (typeof HUB_SCHEMA_VERSION === 'number' && isFinite(HUB_SCHEMA_VERSION)) {
    return Number(HUB_SCHEMA_VERSION);
  }
  if (typeof window !== 'undefined' && typeof window.HUB_SCHEMA_VERSION === 'number') {
    return Number(window.HUB_SCHEMA_VERSION);
  }
  return 0;
}

function hubGetEmbeddedAppVersion() {
  return String(hubGetEmbeddedSchemaVersion() || '');
}

function hubHasVersionMismatch() {
  return !!hubVersionMismatch;
}

function hubIsVersionWriteAllowed() {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) return true;
  if (!hubVersionCheckDone) return false;
  return !hubVersionMismatch;
}

function hubSetVersionMismatch(isMismatch, remoteVersion) {
  hubVersionMismatch = !!isMismatch;
  hubVersionRemote = remoteVersion == null ? '' : String(remoteVersion);
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('hub-version-mismatch', hubVersionMismatch);
  }
  hubRenderVersionGuardUi();
  if (hubVersionMismatch && typeof hubSetSyncStatus === 'function') {
    hubSetSyncStatus('offline', hubGetVersionGuardMessage());
  }
}

function hubGetVersionGuardMessage() {
  if (typeof HUB_SCHEMA_VERSION_MESSAGE === 'string' && HUB_SCHEMA_VERSION_MESSAGE) {
    return HUB_SCHEMA_VERSION_MESSAGE;
  }
  if (typeof HUB_APP_VERSION_MESSAGE === 'string' && HUB_APP_VERSION_MESSAGE) {
    return HUB_APP_VERSION_MESSAGE;
  }
  return '最新版へ更新してください';
}

function hubEnsureVersionGuardUi() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById('hubVersionGuard');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'hubVersionGuard';
  el.className = 'hubVersionGuard hidden';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML =
    '<div class="hubVersionGuardCard">' +
    '<h2 class="hubVersionGuardTitle">OUKEI HUB</h2>' +
    '<p class="hubVersionGuardMessage" id="hubVersionGuardMessage"></p>' +
    '<p class="hubVersionGuardMeta" id="hubVersionGuardMeta"></p>' +
    '<button type="button" class="hubVersionGuardBtn" id="hubVersionGuardReloadBtn">最新版を読み込む</button>' +
    '</div>';
  document.body.appendChild(el);
  let btn = document.getElementById('hubVersionGuardReloadBtn');
  if (btn) {
    btn.addEventListener('click', function () {
      hubForceReloadForNewVersion(true);
    });
  }
  return el;
}

function hubRenderVersionGuardUi() {
  if (typeof document === 'undefined') return;
  let el = hubEnsureVersionGuardUi();
  if (!el) return;
  let msg = document.getElementById('hubVersionGuardMessage');
  let meta = document.getElementById('hubVersionGuardMeta');
  if (msg) msg.textContent = hubGetVersionGuardMessage();
  if (meta) {
    meta.textContent = hubVersionMismatch
      ? ('現在 schema: ' + (hubGetEmbeddedSchemaVersion() || '不明') +
        (hubVersionRemote !== '' ? (' ／ 最新 schema: ' + hubVersionRemote) : ''))
      : '';
  }
  if (hubVersionMismatch) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

function hubForceReloadForNewVersion(manual) {
  try {
    if (manual) sessionStorage.removeItem(HUB_VERSION_RELOAD_KEY);
    else sessionStorage.setItem(HUB_VERSION_RELOAD_KEY, String(Date.now()));
  } catch (e) {}
  try {
    let url = new URL(window.location.href);
    url.searchParams.set('_hubv', String(Date.now()));
    window.location.replace(url.toString());
  } catch (e2) {
    window.location.reload();
  }
}

function hubHandleVersionMismatch(remoteVersion) {
  hubSetVersionMismatch(true, remoteVersion);
  let alreadyReloaded = false;
  try {
    alreadyReloaded = !!sessionStorage.getItem(HUB_VERSION_RELOAD_KEY);
  } catch (e) {}
  if (!alreadyReloaded) {
    setTimeout(function () {
      hubForceReloadForNewVersion(false);
    }, 1200);
  }
}

function hubApplyVersionCheckResult(remote) {
  hubVersionCheckDone = true;
  let local = hubGetEmbeddedSchemaVersion();
  let remoteVersion = remote && remote.schemaVersion != null
    ? Number(remote.schemaVersion)
    : NaN;
  if (!local || !isFinite(remoteVersion)) {
    if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
      hubSetVersionMismatch(false, remoteVersion);
      return true;
    }
    hubHandleVersionMismatch(isFinite(remoteVersion) ? remoteVersion : '(取得失敗)');
    return false;
  }
  if (local === remoteVersion) {
    try { sessionStorage.removeItem(HUB_VERSION_RELOAD_KEY); } catch (e) {}
    hubSetVersionMismatch(false, remoteVersion);
    if (typeof hubFirebaseReady !== 'undefined' && hubFirebaseReady &&
        typeof hubFirebaseUid !== 'undefined' && hubFirebaseUid &&
        typeof hubSyncHubData === 'function') {
      try { hubSyncHubData(); } catch (e2) {}
    }
    return true;
  }
  hubHandleVersionMismatch(remoteVersion);
  return false;
}

function hubFetchPublishedAppVersion() {
  let url = HUB_VERSION_JSON_PATH + '?_=' + Date.now();
  return fetch(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Cache-Control': 'no-cache' }
  }).then(function (resp) {
    if (!resp.ok) throw new Error('schema version fetch failed');
    return resp.json();
  });
}

function hubCheckAppVersion() {
  if (typeof hubIsLocalDevMode === 'function' && hubIsLocalDevMode()) {
    hubVersionCheckDone = true;
    hubSetVersionMismatch(false, hubGetEmbeddedSchemaVersion());
    return Promise.resolve(true);
  }
  return hubFetchPublishedAppVersion().then(function (remote) {
    return hubApplyVersionCheckResult(remote);
  }).catch(function () {
    return hubApplyVersionCheckResult(null);
  });
}

function hubBindVersionGuardLifecycle() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') hubCheckAppVersion();
  });
  window.addEventListener('online', function () {
    hubCheckAppVersion();
  });
  if (hubVersionGuardTimer) clearInterval(hubVersionGuardTimer);
  hubVersionGuardTimer = setInterval(function () {
    hubCheckAppVersion();
  }, 5 * 60 * 1000);
}

function hubInitVersionGuard() {
  hubEnsureVersionGuardUi();
  hubBindVersionGuardLifecycle();
  return hubCheckAppVersion();
}

if (typeof window !== 'undefined') {
  window.hubHasVersionMismatch = hubHasVersionMismatch;
  window.hubIsVersionWriteAllowed = hubIsVersionWriteAllowed;
  window.hubCheckAppVersion = hubCheckAppVersion;
  window.hubInitVersionGuard = hubInitVersionGuard;
  window.hubGetEmbeddedAppVersion = hubGetEmbeddedAppVersion;
  window.hubGetEmbeddedSchemaVersion = hubGetEmbeddedSchemaVersion;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      hubInitVersionGuard();
    });
  } else {
    hubInitVersionGuard();
  }
}
