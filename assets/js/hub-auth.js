/* OUKEI HUB Google Auth — Ver2.0.5 */

var hubCurrentProfile = null;
var hubAuthListenerAttached = false;
var hubAuthBusy = false;
var hubAuthInitDone = false;
var hubLastAuthUid = '';
var hubPendingAuthUser = null;
var hubRedirectResultUser = null;
var hubAuthBootstrapFinished = false;
var hubAuthDebug = {
  onAuthStateChangedCalled: false,
  onAuthStateUser: null,
  redirectResult: 'pending',
  currentUser: null,
  step: 'init',
  errorCode: '',
  errorMessage: ''
};

function hubAuthDebugRender() {
  let el = document.getElementById('hubAuthDebug');
  if (!el) return;
  let d = hubAuthDebug;
  let lines = [
    'onAuthStateChanged called: ' + (d.onAuthStateChangedCalled ? 'yes' : 'no'),
    'user: ' + (d.onAuthStateUser ? 'exists (' + d.onAuthStateUser + ')' : 'null'),
    'getRedirectResult: ' + d.redirectResult,
    'auth.currentUser: ' + (d.currentUser ? d.currentUser : 'null'),
    'step: ' + d.step
  ];
  if (d.errorCode) lines.push('error.code: ' + d.errorCode);
  if (d.errorMessage) lines.push('error.message: ' + d.errorMessage);
  el.textContent = lines.join('\n');
}

function hubAuthDebugSetError(err) {
  if (!err) return;
  let info = hubNormalizeError(err);
  hubAuthDebug.errorCode = info.code;
  hubAuthDebug.errorMessage = info.message;
  hubAuthDebugRender();
}

function hubAuthDebugUpdateCurrentUser(auth) {
  hubAuthDebug.currentUser = auth && auth.currentUser ? auth.currentUser.uid : 'null';
  hubAuthDebugRender();
}

function hubPromiseTimeout(promise, ms, fallbackValue) {
  return Promise.race([
    promise,
    new Promise(function (resolve) {
      setTimeout(function () { resolve(fallbackValue); }, ms);
    })
  ]);
}

function hubIsAuthRedirectReturn() {
  if (typeof location === 'undefined') return false;
  let href = location.href || '';
  return /authType=signInViaRedirect|\/__\/auth\/handler/.test(href);
}

function hubAuthBootstrapTimeoutMs() {
  if (hubIsAuthRedirectReturn()) return 8000;
  return hubIsIosSafari() ? 8000 : 6000;
}

function hubNormalizeError(err) {
  if (!err) return { code: 'error/unknown', message: 'ログインに失敗しました。' };
  return {
    code: err.code ? String(err.code) : 'error/unknown',
    message: err.message ? String(err.message) : 'ログインに失敗しました。'
  };
}

function hubFormatAuthError(err, targetId) {
  if (!err) {
    hubSetAuthError('', targetId);
    return;
  }
  let info = hubNormalizeError(err);
  hubSetAuthError('[' + info.code + '] ' + info.message, targetId);
}

function hubIsProfileGateVisible() {
  let profile = document.getElementById('hubAuthProfile');
  return !!(profile && !profile.classList.contains('hidden'));
}

function hubProcessAuthState(user) {
  if (user) {
    hubSetAuthError('');
    if (hubLastAuthUid === user.uid) {
      if (document.body.classList.contains('hub-auth-ready') || hubIsProfileGateVisible()) {
        return Promise.resolve();
      }
    }
    hubLastAuthUid = user.uid;
    return hubHandleAuthUser(user);
  }
  if (!hubAuthInitDone || hubAuthBusy) return Promise.resolve();
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (auth && auth.currentUser) {
    return hubProcessAuthState(auth.currentUser);
  }
  if (hubPendingAuthUser) {
    return hubProcessAuthState(hubPendingAuthUser);
  }
  hubLastAuthUid = '';
  hubHandleSignedOut();
  return Promise.resolve();
}

function hubIsIosSafari() {
  if (typeof navigator === 'undefined') return false;
  let ua = navigator.userAgent || '';
  let isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  let isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return isAppleMobile && isSafari;
}

function hubTestBrowserStorage() {
  try {
    localStorage.setItem('hubAuthProbe', '1');
    localStorage.removeItem('hubAuthProbe');
  } catch (e) {
    return false;
  }
  return true;
}

function hubSetAuthPersistence(auth) {
  if (!hubTestBrowserStorage()) {
    return auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  }
  return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {
    return auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  });
}

function hubResolveAuthUser(auth) {
  if (hubRedirectResultUser) return hubRedirectResultUser;
  if (auth && auth.currentUser) return auth.currentUser;
  if (hubPendingAuthUser) return hubPendingAuthUser;
  return null;
}


function hubWaitForSignedInUser(auth, maxWaitMs) {
  let immediate = hubResolveAuthUser(auth);
  if (immediate) return Promise.resolve(immediate);

  maxWaitMs = typeof maxWaitMs === 'number' ? maxWaitMs : 5000;
  let intervalMs = 200;
  let elapsed = 0;

  return new Promise(function (resolve) {
    function tick() {
      hubAuthDebugUpdateCurrentUser(auth);
      let user = hubResolveAuthUser(auth);
      if (user) {
        resolve(user);
        return;
      }
      elapsed += intervalMs;
      if (elapsed >= maxWaitMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, intervalMs);
    }
    tick();
  });
}

function hubFinishAuthBootstrap(auth, user) {
  if (hubAuthBootstrapFinished) return Promise.resolve();
  hubAuthBootstrapFinished = true;
  hubAuthInitDone = true;
  hubAuthDebug.step = user ? 'signed-in' : 'show-login';
  hubAuthDebugUpdateCurrentUser(auth);
  if (user) {
    return hubProcessAuthState(user);
  }
  hubSetAuthError('');
  hubShowAuthScreen('login');
  return Promise.resolve();
}

function hubOnAuthStateChanged(user) {
  hubAuthDebug.onAuthStateChangedCalled = true;
  hubAuthDebug.onAuthStateUser = user ? user.uid : null;
  hubAuthDebugRender();

  if (user) {
    hubPendingAuthUser = user;
    if (!hubAuthInitDone) return;
    hubProcessAuthState(user);
    return;
  }

  if (!hubAuthInitDone) return;

  if (hubAuthBusy) return;
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (auth && auth.currentUser) {
    hubProcessAuthState(auth.currentUser);
    return;
  }
  hubProcessAuthState(null);
}

function hubBootstrapAuth(auth) {
  hubAuthBootstrapFinished = false;
  hubRedirectResultUser = null;
  hubAuthDebug.step = 'persistence';
  hubAuthDebug.redirectResult = 'pending';
  hubAuthDebug.errorCode = '';
  hubAuthDebug.errorMessage = '';
  hubAuthDebugRender();

  let timeoutMs = hubAuthBootstrapTimeoutMs();
  let bootstrapTimer = setTimeout(function () {
    hubAuthDebug.step = 'timeout -> login';
    hubAuthDebugRender();
    hubFinishAuthBootstrap(auth, hubResolveAuthUser(auth));
  }, timeoutMs);

  function finish(user) {
    clearTimeout(bootstrapTimer);
    return hubFinishAuthBootstrap(auth, user);
  }

  return hubSetAuthPersistence(auth)
    .then(function () {
      hubAuthDebug.step = 'getRedirectResult';
      hubAuthDebugRender();
      return hubPromiseTimeout(auth.getRedirectResult(), 5000, null);
    })
    .catch(function (err) {
      if (err && err.code !== 'auth/no-auth-event') hubAuthDebugSetError(err);
      return null;
    })
    .then(function (redirectResult) {
      if (redirectResult && redirectResult.user) {
        hubRedirectResultUser = redirectResult.user;
        hubPendingAuthUser = redirectResult.user;
        hubAuthDebug.redirectResult = 'user exists (' + redirectResult.user.uid + ')';
      } else {
        hubAuthDebug.redirectResult = redirectResult ? 'empty' : 'null';
      }
      hubAuthDebug.step = 'waiting user';
      hubAuthDebugRender();
      let remainMs = Math.max(1500, timeoutMs - 2000);
      return hubWaitForSignedInUser(auth, remainMs);
    })
    .then(function (user) {
      return finish(user || hubResolveAuthUser(auth));
    })
    .catch(function (err) {
      hubAuthDebugSetError(err);
      return finish(hubResolveAuthUser(auth));
    });
}

function hubResumeAuthIfNeeded() {
  if (!hubAuthInitDone || hubAuthBusy) return;
  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (!auth) return;
  if (auth.currentUser) {
    hubProcessAuthState(auth.currentUser);
    return;
  }
  if (document.body.classList.contains('hub-auth-ready')) return;
  hubShowAuthLoading('ログイン状態を再確認しています…');
  hubWaitForSignedInUser(auth, 5000).then(function (user) {
    if (user) {
      hubProcessAuthState(user);
      return;
    }
    hubShowAuthScreen('login');
  });
}

function hubBindIosAuthResume() {
  if (typeof window === 'undefined') return;
  window.addEventListener('pageshow', function () {
    hubResumeAuthIfNeeded();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') hubResumeAuthIfNeeded();
  });
}

function hubShowAuthLoading(message) {
  let gate = document.getElementById('hubAuthGate');
  let login = document.getElementById('hubAuthLogin');
  let profile = document.getElementById('hubAuthProfile');
  let loading = document.getElementById('hubAuthLoading');
  let debug = document.getElementById('hubAuthDebug');
  if (!gate) return;
  gate.classList.remove('hidden');
  document.body.classList.remove('hub-auth-ready');
  if (login) login.classList.add('hidden');
  if (profile) profile.classList.add('hidden');
  if (loading) loading.classList.remove('hidden');
  if (debug) debug.classList.remove('hidden');
  let text = document.getElementById('hubAuthLoadingText');
  if (text) text.textContent = message || 'ログイン状態を確認しています…';
  hubAuthDebugRender();
}

function hubShowAuthScreen(mode) {
  let gate = document.getElementById('hubAuthGate');
  let login = document.getElementById('hubAuthLogin');
  let profile = document.getElementById('hubAuthProfile');
  let loading = document.getElementById('hubAuthLoading');
  let debug = document.getElementById('hubAuthDebug');
  if (!gate) return;
  gate.classList.remove('hidden');
  document.body.classList.remove('hub-auth-ready');
  if (loading) loading.classList.add('hidden');
  if (debug) debug.classList.remove('hidden');
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
  let debug = document.getElementById('hubAuthDebug');
  if (gate) gate.classList.add('hidden');
  if (debug) debug.classList.add('hidden');
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
  hubShowAuthLoading('プロフィールを確認しています…');
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
    let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
    if (auth && auth.currentUser) {
      hubShowAuthScreen('profile');
    } else {
      hubShowAuthScreen('login');
    }
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
  return hubSetAuthPersistence(auth).then(function () {
    hubSetAuthError('Googleログイン画面へ移動しています…');
    return auth.signInWithRedirect(provider);
  }).catch(function (err) {
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
  hubLastAuthUid = '';
  if (typeof hubClearStorageForLogout === 'function') hubClearStorageForLogout();
  hubLastPushedHash = '';
  if (auth) {
    auth.signOut().catch(function (err) {
      hubFormatAuthError(err);
      hubHandleSignedOut();
    });
  } else {
    hubHandleSignedOut();
  }
}

function hubInitAuth() {
  hubShowAuthLoading('ログイン状態を確認しています…');
  hubAuthDebug.step = 'init';
  hubAuthDebugRender();
  hubSetAuthError('');
  if (typeof hubFirebaseConfigValid === 'function' && !hubFirebaseConfigValid()) {
    hubShowAuthScreen('login');
    hubSetAuthError('Firebase設定が未完了です。firebase-config.js を設定してください。');
    hubSetSyncStatus('offline', 'オフライン');
    return;
  }
  if (typeof hubInitFirebaseServices === 'function' && !hubInitFirebaseServices()) {
    hubShowAuthScreen('login');
    hubSetAuthError('Firebaseに接続できません。ネットワーク接続を確認してください。');
    hubSetSyncStatus('offline', 'オフライン');
    return;
  }

  let auth = typeof hubGetFirebaseAuth === 'function' ? hubGetFirebaseAuth() : null;
  if (!auth) {
    hubShowAuthScreen('login');
    hubSetAuthError('認証サービスを開始できません。');
    return;
  }

  if (!hubAuthListenerAttached) {
    hubAuthListenerAttached = true;
    auth.onAuthStateChanged(function (user) {
      hubOnAuthStateChanged(user);
    });
  }

  hubBootstrapAuth(auth);
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
    document.addEventListener('DOMContentLoaded', function () {
      hubBindAuthUi();
      hubBindIosAuthResume();
    });
  } else {
    hubBindAuthUi();
    hubBindIosAuthResume();
  }
}
