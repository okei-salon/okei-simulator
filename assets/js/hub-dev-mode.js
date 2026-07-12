/* OUKEI HUB Local Dev Safe Mode — localhost / 127.0.0.1 only
 * クラウド読込・書込を完全固定OFF（切替なし）
 */

function hubIsLocalDevHost() {
  if (typeof window === 'undefined' || !window.location) return false;
  let host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function hubIsLocalDevMode() {
  return hubIsLocalDevHost();
}

function hubIsCloudReadEnabled() {
  return !hubIsLocalDevMode();
}

function hubIsCloudWriteEnabled() {
  return !hubIsLocalDevMode();
}

function hubRenderLocalDevStatus() {
  let bar = document.getElementById('hubLocalDevBar');
  let syncEl = document.getElementById('hubSyncStatus');
  if (!hubIsLocalDevMode()) {
    if (bar) bar.classList.add('hidden');
    return;
  }
  if (bar) bar.classList.remove('hidden');
  if (syncEl) {
    syncEl.classList.remove('is-syncing', 'is-done', 'is-offline');
    syncEl.classList.add('is-dev');
    syncEl.textContent = 'クラウド同期OFF · LocalStorageのみ';
  }
}

function hubInitLocalDevMode() {
  hubRenderLocalDevStatus();
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('hub-local-dev', hubIsLocalDevMode());
  }
}

var HUB_DEV_PROFILE_KEY = 'oukei_hub_dev_profile';

function hubLoadLocalDevProfile() {
  if (!hubIsLocalDevMode() || typeof localStorage === 'undefined') return null;
  try {
    let raw = localStorage.getItem(HUB_DEV_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function hubSaveLocalDevProfile(profile) {
  if (!hubIsLocalDevMode() || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HUB_DEV_PROFILE_KEY, JSON.stringify(profile || {}));
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.hubIsLocalDevHost = hubIsLocalDevHost;
  window.hubIsLocalDevMode = hubIsLocalDevMode;
  window.hubIsCloudReadEnabled = hubIsCloudReadEnabled;
  window.hubIsCloudWriteEnabled = hubIsCloudWriteEnabled;
  window.hubRenderLocalDevStatus = hubRenderLocalDevStatus;
  window.hubInitLocalDevMode = hubInitLocalDevMode;
  window.hubLoadLocalDevProfile = hubLoadLocalDevProfile;
  window.hubSaveLocalDevProfile = hubSaveLocalDevProfile;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hubInitLocalDevMode);
  } else {
    hubInitLocalDevMode();
  }
}
