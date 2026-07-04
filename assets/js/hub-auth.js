/* OUKEI HUB Google Auth — Ver2.0.5 */

var hubCurrentProfile = null;
var hubAuthListenerAttached = false;
var hubAuthBusy = false;

function hubIsMobileAuth() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
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

function hubRenderAccountSummary(user, profile) {
  let wrap = document.getElementById('hubAccountSummary');
  if (!wrap) return;
  user = user || (typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth().currentUser : null);
  profile = profile || hubCurrentProfile || {};
  if (!user) {
    wrap.innerHTML = '<div class="hubAccountMeta"><div class="hubAccountName">未ログイン</div></div>';
    return;
  }
  let avatar = profile.photoURL || user.photoURL || '';
  let avatarHtml = avatar
    ? '<img class="hubAccountAvatar" src="' + avatar + '" alt="">'
    : '<div class="hubAccountAvatar"></div>';
  wrap.innerHTML =
    avatarHtml +
    '<div class="hubAccountMeta">' +
    '<div class="hubAccountName">' + (profile.displayName || user.displayName || 'Googleユーザー') + '</div>' +
    '<div class="hubAccountEmail">' + (profile.email || user.email || '') + '</div>' +
    '<div class="hubAccountUsername">@' + (profile.username || '—') + '</div>' +
    '</div>';
}

function hubHandleSignedOut() {
  hubCurrentProfile = null;
  hubSetCurrentUid('');
  hubSetAuthError('');
  hubRenderAccountSummary(null, null);
  hubHideAppShell();
  hubShowAuthScreen('login');
  hubSetSyncStatus('offline', 'オフライン');
}

function hubHandleAuthUser(user) {
  if (!user || hubAuthBusy) return Promise.resolve();
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
    hubSetAuthError('ログイン処理に失敗しました。時間をおいて再度お試しください。');
    hubShowAuthScreen('login');
    throw err;
  }).finally(function () {
    hubAuthBusy = false;
  });
}

function hubLoginWithGoogle() {
  if (typeof hubInitFirebaseServices === 'function' && !hubInitFirebaseServices()) {
    hubSetAuthError('Firebase設定が未完了です。');
    return Promise.resolve();
  }
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (!auth) {
    hubSetAuthError('認証サービスを開始できません。');
    return Promise.resolve();
  }
  let provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: '' });
  hubSetAuthError('');
  if (hubIsMobileAuth()) {
    return auth.signInWithRedirect(provider);
  }
  return auth.signInWithPopup(provider).catch(function (err) {
    if (err && err.code === 'auth/popup-blocked') {
      return auth.signInWithRedirect(provider);
    }
    hubSetAuthError('Googleログインに失敗しました。');
    throw err;
  });
}

function hubCompleteProfileSetup() {
  let input = document.getElementById('hubUsernameInput');
  let username = input ? String(input.value || '').trim() : '';
  if (!username) {
    hubSetAuthError('ユーザー名を入力してください。', 'hubAuthProfileError');
    return;
  }
  if (username.length > 32) {
    hubSetAuthError('ユーザー名は32文字以内で入力してください。', 'hubAuthProfileError');
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
  hubSaveProfile(username, user).then(function () {
    return typeof hubSyncHubData === 'function' ? hubSyncHubData() : Promise.resolve(false);
  }).then(function () {
    hubEnterApplication();
  }).catch(function () {
    hubSetAuthError('プロフィール保存に失敗しました。', 'hubAuthProfileError');
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
    hubSetAuthError('Firebaseに接続できません。');
    hubSetSyncStatus('offline', 'オフライン');
    return;
  }

  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (!auth) return;

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});

  auth.getRedirectResult().catch(function (err) {
    if (err && err.code !== 'auth/no-auth-event') {
      hubSetAuthError('Googleログインに失敗しました。');
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
  let usernameInput = document.getElementById('hubUsernameInput');
  if (usernameInput) {
    usernameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') hubCompleteProfileSetup();
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
  window.hubCurrentProfile = function () { return hubCurrentProfile; };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hubBindAuthUi);
  } else {
    hubBindAuthUi();
  }
}
