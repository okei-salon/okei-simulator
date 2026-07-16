/* OUKEI HUB Admin / role helpers
 * 管理者表示は「実管理者UID」または「検証ペルソナ=admin」のみ
 * localhost でも一般ユーザー検証時は開発表示を出さない
 */

/** 本番で管理者UIを許可する Firebase Auth UID（本人のみ） */
var HUB_ADMIN_UIDS = [
  'HLoBjIRi7Wgt14crc82ey613Njy1'
];

/** 実GoogleログインUID（検証用UIDの影響を受けない） */
function hubGetRealLoginUid() {
  try {
    if (typeof hubFirebaseUid !== 'undefined' && hubFirebaseUid) return String(hubFirebaseUid);
  } catch (e) {}
  try {
    if (typeof hubGetFirebaseAuth === 'function') {
      var user = hubGetFirebaseAuth() && hubGetFirebaseAuth().currentUser;
      if (user && user.uid) return String(user.uid);
    }
  } catch (e2) {}
  return '';
}

/** データ操作に使うUID（検証ペルソナ時は検証用UID） */
function hubGetActiveAuthUid() {
  if (typeof hubIsUserVerifyActive === 'function' && hubIsUserVerifyActive() &&
      typeof hubActiveUid !== 'undefined' && hubActiveUid) {
    return String(hubActiveUid);
  }
  var real = hubGetRealLoginUid();
  if (real) return real;
  if (typeof hubActiveUid !== 'undefined' && hubActiveUid) return String(hubActiveUid);
  try {
    if (typeof localStorage !== 'undefined') {
      var stored = localStorage.getItem('oukei_hub_v15_uid');
      if (stored) return String(stored);
    }
  } catch (e3) {}
  return '';
}

function hubIsAdminUid(uid) {
  uid = String(uid || '');
  if (!uid) return false;
  return HUB_ADMIN_UIDS.indexOf(uid) >= 0;
}

/** プロファイル上の role。未設定時は UID allowlist のみで admin 判定 */
function hubResolveUserRole(profile, uid) {
  uid = uid || hubGetActiveAuthUid();
  if (typeof hubIsUserVerifyActive === 'function' && hubIsUserVerifyActive() &&
      typeof hubGetVerifyPersonaRole === 'function') {
    return hubGetVerifyPersonaRole();
  }
  if (hubIsAdminUid(uid)) return 'admin';
  if (profile && profile.role === 'admin' && hubIsAdminUid(uid)) return 'admin';
  return 'user';
}

function hubIsAdminUser() {
  if (typeof hubIsUserVerifyActive === 'function' && hubIsUserVerifyActive() &&
      typeof hubGetVerifyPersonaRole === 'function') {
    return hubGetVerifyPersonaRole() === 'admin';
  }
  var uid = hubGetRealLoginUid() || hubGetActiveAuthUid();
  if (hubIsAdminUid(uid)) return true;
  if (typeof hubCurrentProfile !== 'undefined' && hubCurrentProfile &&
      hubCurrentProfile.role === 'admin' && hubIsAdminUid(uid)) {
    return true;
  }
  return false;
}

/**
 * 開発用UI（デモ・サンプル・開発バー・Build等）を出してよいか
 * - 検証パネル有効時: ペルソナが admin のときのみ
 * - それ以外: 実管理者UIDのみ（localhostだけで全員表示しない）
 */
function hubCanShowDevUi() {
  if (typeof hubIsUserVerifyActive === 'function' && hubIsUserVerifyActive()) {
    return typeof hubGetVerifyPersonaRole === 'function' && hubGetVerifyPersonaRole() === 'admin';
  }
  return hubIsAdminUser();
}

function hubApplyDevUiVisibility() {
  var allow = hubCanShowDevUi();
  try {
    document.documentElement.classList.toggle('hub-dev-ui-allowed', allow);
    document.documentElement.classList.toggle('hub-dev-ui-hidden', !allow);
  } catch (e) {}

  var demoToolbar = document.getElementById('homeDemoToolbar');
  if (demoToolbar) demoToolbar.classList.toggle('hidden', !allow);

  var devTools = document.getElementById('hubDevToolsBlock');
  if (devTools) {
    devTools.classList.toggle('hidden', !allow);
  } else {
    document.querySelectorAll('.settingsRestoreBlock').forEach(function (block) {
      var title = block.querySelector('.settingBlockTitle');
      if (title && String(title.textContent || '').indexOf('開発用') >= 0) {
        block.classList.toggle('hidden', !allow);
      }
    });
  }

  var buildInfo = document.querySelector('.buildInfo');
  if (buildInfo) buildInfo.classList.toggle('hidden', !allow);

  var bar = document.getElementById('hubLocalDevBar');
  if (bar) {
    if (!allow) bar.classList.add('hidden');
  }

  if (!allow) {
    if (typeof toggleHomeDemoMode === 'function' && typeof HOME_DEMO_MODE !== 'undefined' && HOME_DEMO_MODE) {
      toggleHomeDemoMode(false);
    } else if (typeof HOME_DEMO_MODE !== 'undefined') {
      HOME_DEMO_MODE = false;
      try {
        if (typeof localStorage !== 'undefined' && typeof hubDemoModeStorageKey === 'function') {
          localStorage.setItem(hubDemoModeStorageKey(), '0');
        } else if (typeof localStorage !== 'undefined') {
          localStorage.setItem('oukei_home_demo_mode', '0');
        }
      } catch (e2) {}
    }
  }

  if (typeof hubApplySettingsVisibility === 'function') hubApplySettingsVisibility();
  if (typeof hubRefreshVerifyPanel === 'function') hubRefreshVerifyPanel();
}

if (typeof window !== 'undefined') {
  window.HUB_ADMIN_UIDS = HUB_ADMIN_UIDS;
  window.hubGetActiveAuthUid = hubGetActiveAuthUid;
  window.hubIsAdminUid = hubIsAdminUid;
  window.hubResolveUserRole = hubResolveUserRole;
  window.hubIsAdminUser = hubIsAdminUser;
  window.hubCanShowDevUi = hubCanShowDevUi;
  window.hubApplyDevUiVisibility = hubApplyDevUiVisibility;
  window.hubGetRealLoginUid = hubGetRealLoginUid;
}
