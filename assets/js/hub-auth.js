/* OUKEI HUB Google Auth — Ver2.0.5 */

var hubCurrentProfile = null;
var hubAuthListenerAttached = false;
var hubAuthBusy = false;

function hubFormatAuthError(err, targetId) {
  if (!err) {
    hubSetAuthError('', targetId);
    return;
  }
  let code = err.code ? String(err.code) : 'error/unknown';
  let message = err.message ? String(err.message) : 'ログインに失敗しました。';
  hubSetAuthError('[' + code + '] ' + message, targetId);
}

function hubShowAuthScreen(mode) {
  let gate = document.getElementById('hubAuthGate');
  let login = document.getElementById('hubAuthLogin');
  let profile = document.getElementById('hubAuthProfile');
  if (!gate) return;
  gate.classList.remove('hidden');
  document.body.classList.remove('hub-auth-ready');
  if (mode === 'profile') {
    if (login) login.classList.add('hidden');
    if (profile) profile.classList.remove('hidden');
    let input = document.getElementById('hubUsernameInput');
    if (input) setTimeout(function () { input.focus(); }, 120);
  } else {
    if (login) login.classList.remove('hidden');
    if (profile) profile.classList.add('hidden');
  }
}

function hubShowAppShell() {
  let gate = document.getElementById('hubAuthGate');
  if (gate) gate.classList.add('hidden');
  document.body.classList.add('hub-auth-ready');
}

function hubHideAppShell() {
  document.body.classList.remove('hub-auth-ready');
}

function hubSetAuthError(message, targetId) {
  let id = targetId || 'hubAuthError';
  let el = document.getElementById(id);
  if (!el && id !== 'hubAuthError') el = document.getElementById('hubAuthError');
  if (!el) return;
  el.textContent = message || '';
  if (id === 'hubAuthProfileError') {
    let loginErr = document.getElementById('hubAuthError');
    if (loginErr) loginErr.textContent = '';
  } else {
    let profileErr = document.getElementById('hubAuthProfileError');
    if (profileErr) profileErr.textContent = '';
  }
}

function hubPrepareApplicationData() {
  if (typeof hubInitStorage === 'function') hubInitStorage();
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  settings.lastLogin = new Date().toLocaleString();
  if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
  if (typeof initHomeDemo === 'function') initHomeDemo();
}

function hubEnterApplication() {
  hubPrepareApplicationData();
  if (typeof render === 'function') render();
  if (typeof showPage === 'function') showPage('home');
  hubShowAppShell();
}

function hubFetchProfile() {
  let ref = typeof hubProfileDocRef === 'function' ? hubProfileDocRef() : null;
  if (!ref) return Promise.resolve(null);
  return ref.get().then(function (snap) {
    return snap.exists ? snap.data() : null;
  });
}

function hubSaveProfile(username, user) {
  user = user || (typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth().currentUser : null);
  let ref = typeof hubProfileDocRef === 'function' ? hubProfileDocRef() : null;
  if (!ref || !user) return Promise.reject(new Error('profile unavailable'));
  let now = Date.now();
  let payload = {
    username: username,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    lastLoginAt: now
  };
  payload.createdAt = (hubCurrentProfile && hubCurrentProfile.createdAt) ? hubCurrentProfile.createdAt : now;
  return ref.set(payload, { merge: true }).then(function () {
    hubCurrentProfile = Object.assign({}, hubCurrentProfile || {}, payload);
    hubRenderAccountSummary(user, hubCurrentProfile);
  });
}

function hubTouchProfileLogin(user, profile) {
  let ref = typeof hubProfileDocRef === 'function' ? hubProfileDocRef() : null;
  if (!ref || !user) return Promise.resolve();
  return ref.set({
    username: profile && profile.username ? profile.username : '',
    displayName: user.displayName || (profile && profile.displayName) || '',
    email: user.email || (profile && profile.email) || '',
    photoURL: user.photoURL || (profile && profile.photoURL) || '',
    createdAt: (profile && profile.createdAt) ? profile.createdAt : Date.now(),
    lastLoginAt: Date.now()
  }, { merge: true }).then(function () {
    hubCurrentProfile = Object.assign({}, profile || {}, {
      username: profile && profile.username ? profile.username : '',
      displayName: user.displayName || (profile && profile.displayName) || '',
      email: user.email || (profile && profile.email) || '',
      photoURL: user.photoURL || (profile && profile.photoURL) || '',
      lastLoginAt: Date.now()
    });
    hubRenderAccountSummary(user, hubCurrentProfile);
  });
}

function hubFormatProfileDate(value) {
  if (!value) return '—';
  let date = new Date(typeof value === 'number' ? value : value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('ja-JP');
}

function hubValidateUsername(username) {
  let name = String(username || '').trim();
  if (!name) return { ok: false, message: 'ユーザー名を入力してください。' };
  if (name.length > 32) return { ok: false, message: 'ユーザー名は32文字以内で入力してください。' };
  return { ok: true, value: name };
}

function hubSetAccountInfoMessage(message, isError) {
  let el = document.getElementById('hubAccountInfoMessage');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-error', !!isError);
}

function hubRenderAccountInfo(user, profile) {
  user = user || (typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth().currentUser : null);
  profile = profile || hubCurrentProfile || {};

  let photo = document.getElementById('hubAccountPhoto');
  let displayNameEl = document.getElementById('hubAccountDisplayName');
  let emailEl = document.getElementById('hubAccountEmail');
  let usernameInput = document.getElementById('hubAccountUsernameInput');
  let uidEl = document.getElementById('hubAccountUid');
  let createdEl = document.getElementById('hubAccountCreatedAt');

  if (!user) {
    if (photo) {
      photo.classList.add('hidden');
      photo.removeAttribute('src');
    }
    if (displayNameEl) displayNameEl.textContent = '未ログイン';
    if (emailEl) emailEl.textContent = '—';
    if (usernameInput) usernameInput.value = '';
    if (uidEl) uidEl.textContent = '—';
    if (createdEl) createdEl.textContent = '—';
    return;
  }

  let photoUrl = user.photoURL || profile.photoURL || '';
  if (photo) {
    if (photoUrl) {
      photo.src = photoUrl;
      photo.alt = profile.displayName || user.displayName || 'プロフィール画像';
      photo.classList.remove('hidden');
    } else {
      photo.classList.add('hidden');
      photo.removeAttribute('src');
    }
  }

  if (displayNameEl) displayNameEl.textContent = profile.displayName || user.displayName || 'Googleユーザー';
  if (emailEl) emailEl.textContent = profile.email || user.email || '—';
  if (usernameInput) usernameInput.value = profile.username || '';
  if (uidEl) uidEl.textContent = user.uid || '—';
  if (createdEl) createdEl.textContent = hubFormatProfileDate(profile.createdAt);
}

function hubRenderAccountSummary(user, profile) {
  hubRenderAccountInfo(user, profile);
}

function hubHandleSignedOut() {
  hubCurrentProfile = null;
  hubSetCurrentUid('');
  hubSetAuthError('');
  hubSetAccountInfoMessage('');
  hubRenderAccountSummary(null, null);
  hubHideAppShell();
  hubShowAuthScreen('login');
  hubSetSyncStatus('offline', 'オフライン');
}

function hubHandleAuthUser(user) {
  if (!user || hubAuthBusy) return Promise.resolve();
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (document.body.classList.contains('hub-auth-ready') && auth && auth.currentUser && auth.currentUser.uid === user.uid) {
    return Promise.resolve();
  }
  hubAuthBusy = true;
  hubSetAuthError('');
  hubSetCurrentUid(user.uid);
  if (typeof hubBindStorageToUid === 'function') hubBindStorageToUid(user.uid);

  return hubFetchProfile().then(function (profile) {
    hubCurrentProfile = profile;
    hubRenderAccountSummary(user, profile);
    if (!profile || !profile.username) {
      hubShowAuthScreen('profile');
      return;
    }
    return hubTouchProfileLogin(user, profile).then(function () {
      return (typeof hubSyncHubData === 'function' ? hubSyncHubData() : Promise.resolve(false)).then(function () {
        hubEnterApplication();
      });
    });
  }).catch(function (err) {
    hubFormatAuthError(err);
    hubShowAuthScreen('login');
  }).finally(function () {
    hubAuthBusy = false;
  });
}

function hubLoginWithGoogle() {
  if (typeof hubFirebaseConfigValid === 'function' && !hubFirebaseConfigValid()) {
    hubSetAuthError('Firebase設定が未完了です。firebase-config.js を確認してください。');
    return Promise.resolve();
  }
  if (typeof hubEnsureFirebaseServices === 'function' && !hubEnsureFirebaseServices()) {
    hubSetAuthError('Firebaseに接続できません。ページを再読み込みしてください。');
    return Promise.resolve();
  }
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (!auth) {
    hubSetAuthError('認証サービスを開始できません。');
    return Promise.resolve();
  }
  let provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  hubSetAuthError('Googleログイン画面へ移動しています…');
  return auth.signInWithRedirect(provider).catch(function (err) {
    hubFormatAuthError(err);
  });
}

function hubSaveUsername() {
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  let user = auth ? auth.currentUser : null;
  let input = document.getElementById('hubAccountUsernameInput');
  let check = hubValidateUsername(input ? input.value : '');
  if (!check.ok) {
    hubSetAccountInfoMessage(check.message, true);
    return;
  }
  if (!user) {
    hubSetAccountInfoMessage('ログイン状態を確認できません。', true);
    return;
  }
  hubSetAccountInfoMessage('');
  hubSaveProfile(check.value, user).then(function () {
    hubSetAccountInfoMessage('ユーザー名を保存しました。');
    if (typeof showToast === 'function') showToast('✅ ユーザー名を保存しました');
  }).catch(function () {
    hubSetAccountInfoMessage('ユーザー名の保存に失敗しました。', true);
  });
}

function hubCopyUid() {
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  let uid = auth && auth.currentUser ? auth.currentUser.uid : '';
  if (!uid) {
    hubSetAccountInfoMessage('コピーする UID がありません。', true);
    return;
  }
  function onCopied() {
    hubSetAccountInfoMessage('UID をコピーしました。');
    if (typeof showToast === 'function') showToast('✅ UIDをコピーしました');
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(uid).then(onCopied).catch(function () {
      hubSetAccountInfoMessage('コピーに失敗しました。', true);
    });
    return;
  }
  let area = document.createElement('textarea');
  area.value = uid;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
    onCopied();
  } catch (e) {
    hubSetAccountInfoMessage('コピーに失敗しました。', true);
  }
  document.body.removeChild(area);
}

function hubCompleteProfileSetup() {
  let input = document.getElementById('hubUsernameInput');
  let check = hubValidateUsername(input ? input.value : '');
  if (!check.ok) {
    hubSetAuthError(check.message, 'hubAuthProfileError');
    return;
  }
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  let user = auth ? auth.currentUser : null;
  if (!user) {
    hubSetAuthError('ログイン状態を確認できません。再度ログインしてください。');
    hubShowAuthScreen('login');
    return;
  }
  hubSetAuthError('');
  hubSaveProfile(check.value, user).then(function () {
    return typeof hubSyncHubData === 'function' ? hubSyncHubData() : Promise.resolve(false);
  }).then(function () {
    hubEnterApplication();
  }).catch(function (err) {
    hubFormatAuthError(err, 'hubAuthProfileError');
  });
}

function hubLogout() {
  if (!confirm('ログアウトしますか？\n\n次回起動時は再度Googleログインが必要です。')) return;
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (typeof hubClearStorageForLogout === 'function') hubClearStorageForLogout();
  hubLastPushedHash = '';
  if (auth) {
    auth.signOut().catch(function () {
      hubHandleSignedOut();
    });
  } else {
    hubHandleSignedOut();
  }
}

function hubInitAuth() {
  hubShowAuthScreen('login');
  if (typeof hubFirebaseConfigValid === 'function' && !hubFirebaseConfigValid()) {
    hubSetAuthError('Firebase設定が未完了です。firebase-config.js を設定してください。');
    hubSetSyncStatus('offline', 'オフライン');
    return;
  }
  if (typeof hubInitFirebaseServices === 'function' && !hubInitFirebaseServices()) {
    hubSetAuthError('Firebaseに接続できません。ネットワーク接続を確認してください。');
    hubSetSyncStatus('offline', 'オフライン');
    return;
  }

  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (!auth) return;

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function (err) {
    hubFormatAuthError(err);
  });

  auth.getRedirectResult()
    .then(function (result) {
      if (result && result.user) {
        return hubHandleAuthUser(result.user);
      }
      return null;
    })
    .catch(function (err) {
      if (err && err.code !== 'auth/no-auth-event') {
        hubFormatAuthError(err);
      }
    });

  if (hubAuthListenerAttached) return;
  hubAuthListenerAttached = true;
  auth.onAuthStateChanged(function (user) {
    if (user) {
      hubHandleAuthUser(user);
    } else {
      hubHandleSignedOut();
    }
  });
}

function hubBootApplication() {
  if (typeof initPinchZoom === 'function') initPinchZoom();
  if (typeof hubInitAuth === 'function') hubInitAuth();
}

function hubBindAuthUi() {
  let googleBtn = document.getElementById('hubGoogleLoginBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', function () {
      hubLoginWithGoogle();
    });
  }
  let startBtn = document.getElementById('hubProfileStartBtn');
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      hubCompleteProfileSetup();
    });
  }
  let setupUsernameInput = document.getElementById('hubUsernameInput');
  if (setupUsernameInput) {
    setupUsernameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') hubCompleteProfileSetup();
    });
  }
  let usernameInput = document.getElementById('hubAccountUsernameInput');
  if (usernameInput) {
    usernameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') hubSaveUsername();
    });
  }
}

if (typeof window !== 'undefined') {
  window.hubInitAuth = hubInitAuth;
  window.hubBootApplication = hubBootApplication;
  window.hubLoginWithGoogle = hubLoginWithGoogle;
  window.hubCompleteProfileSetup = hubCompleteProfileSetup;
  window.hubLogout = hubLogout;
  window.hubRenderAccountSummary = hubRenderAccountSummary;
  window.hubRenderAccountInfo = hubRenderAccountInfo;
  window.hubSaveUsername = hubSaveUsername;
  window.hubCopyUid = hubCopyUid;
  window.hubCurrentProfile = function () { return hubCurrentProfile; };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hubBindAuthUi);
  } else {
    hubBindAuthUi();
  }
}
