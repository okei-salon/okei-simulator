/* OUKEI HUB User Verify Panel — localhost / HUB_DEV_VERIFY_ENABLED only
 * Google Auth の実UIDは変更せず、検証用UIDで LocalStorage を切替する
 */

var HUB_VERIFY_SESSION_KEY = 'oukei_hub_verify_persona_v1';
var HUB_VERIFY_NEW_UID = 'test_new_user_001';
var HUB_VERIFY_EXISTING_UID = 'test_existing_user_001';

var hubVerifyState = {
  persona: 'admin',
  customUid: '',
  active: false
};

var hubMobilePreviewWidth = 0;
var HUB_MOBILE_PREVIEW_KEY = 'oukei_hub_mobile_preview_w';
var HUB_PREVIEW_QUERY = 'hub_preview';

function hubIsDevVerifyAllowed() {
  if (typeof hubIsLocalDevHost === 'function' && hubIsLocalDevHost()) return true;
  if (typeof window !== 'undefined' && window.HUB_DEV_VERIFY_ENABLED === true) return true;
  return false;
}

function hubIsUserVerifyActive() {
  return !!(hubIsDevVerifyAllowed() && hubVerifyState && hubVerifyState.active);
}

function hubGetVerifyPersona() {
  return hubVerifyState.persona || 'admin';
}

function hubGetVerifyPersonaRole() {
  if (!hubIsUserVerifyActive()) {
    return typeof hubResolveUserRole === 'function'
      ? hubResolveUserRole(null, hubGetRealLoginUid())
      : 'user';
  }
  if (hubVerifyState.persona === 'admin') return 'admin';
  return 'user';
}

function hubSanitizeVerifyUid(raw) {
  var uid = String(raw || '').trim();
  uid = uid.replace(/[^a-zA-Z0-9_\-.:@]/g, '');
  return uid.slice(0, 128);
}

function hubResolveVerifyTargetUid(persona, customUid) {
  persona = persona || 'admin';
  if (persona === 'new') return HUB_VERIFY_NEW_UID;
  if (persona === 'existing') return HUB_VERIFY_EXISTING_UID;
  if (persona === 'custom') {
    var custom = hubSanitizeVerifyUid(customUid || hubVerifyState.customUid);
    return custom || HUB_VERIFY_NEW_UID;
  }
  // admin: 実ログインUID（管理者データ保護）。未ログイン時のみ allowlist 先頭
  var real = hubGetRealLoginUid();
  if (real) return real;
  if (typeof HUB_ADMIN_UIDS !== 'undefined' && HUB_ADMIN_UIDS[0]) return HUB_ADMIN_UIDS[0];
  return 'admin_local_fallback';
}

function hubIsProtectedVerifyUid(uid) {
  uid = String(uid || '');
  if (!uid) return true;
  if (typeof hubIsAdminUid === 'function' && hubIsAdminUid(uid)) return true;
  var real = hubGetRealLoginUid();
  if (real && uid === real) return true;
  return false;
}

function hubPersistActiveLocalOnly() {
  if (typeof hubSaveToStorage !== 'function') return;
  if (!hubActiveUid && typeof hubActiveUid !== 'undefined') return;
  try {
    if (typeof hubActiveUid !== 'undefined' && hubActiveUid) {
      hubSaveToStorage({ localOnly: true });
    }
  } catch (e) {}
}

function hubClearVerifyUidLocalData(uid) {
  uid = String(uid || '');
  if (!uid || hubIsProtectedVerifyUid(uid)) return false;
  try {
    if (typeof localStorage === 'undefined') return false;
    var key = typeof hubStorageKeyForUid === 'function'
      ? hubStorageKeyForUid(uid)
      : ('oukei_hub_v15_data:' + uid);
    localStorage.removeItem(key);
    localStorage.removeItem('oukei_home_demo_mode:' + uid);
    return true;
  } catch (e) {
    return false;
  }
}

function hubBuildExistingVerifySeed() {
  var empty = typeof hubCreateEmptyData === 'function' ? hubCreateEmptyData() : { settings: {}, members: [], currentData: [], scenarios: [] };
  var data = JSON.parse(JSON.stringify(empty));
  data.settings = data.settings || {};
  data.settings.useRAM = false;
  data.settings.useORCA = true;
  data.settings.useCARY = false;
  data.settings.projectMaster = {
    projects: {
      ram: { key: 'ram', name: 'RAM', startDate: '2024/01/20', inclusionRate: 100, visible: true, registered: false },
      orca: { key: 'orca', name: 'ORCA', startDate: '2024/04/15', inclusionRate: 100, visible: true, registered: true },
      cary: { key: 'cary', name: 'Cary Pact', startDate: '2024/03/10', inclusionRate: 0, visible: true, registered: false },
      genesis: { key: 'genesis', name: 'Genesis', startDate: '2023/11/20', inclusionRate: 100, visible: false, registered: false }
    },
    order: ['orca'],
    savedAt: 'verify-seed',
    _legacyMigrated: true
  };
  data.settings.orcaInputAccounts = [{
    id: 'verify_orca_demo_1',
    username: '既存ユーザー検証口座',
    investment: 1000,
    createdAt: Date.now()
  }];
  data.settings.revenueLog = {};
  data.settings.salesLog = {};
  data.orcaOrgChart = { members: [], rootId: '', rootAccountIds: [] };
  data.eniOrgChart = { members: [], rootId: '', rootAccountIds: [] };
  data.members = [];
  data.currentData = [];
  data.scenarios = [];
  data.updatedAt = Date.now();
  return data;
}

function hubEnsureExistingVerifySeed() {
  if (typeof localStorage === 'undefined') return;
  var uid = HUB_VERIFY_EXISTING_UID;
  var key = typeof hubStorageKeyForUid === 'function'
    ? hubStorageKeyForUid(uid)
    : ('oukei_hub_v15_data:' + uid);
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, JSON.stringify(hubBuildExistingVerifySeed()));
  } catch (e) {}
}

function hubSaveVerifySession() {
  if (!hubIsDevVerifyAllowed()) return;
  try {
    sessionStorage.setItem(HUB_VERIFY_SESSION_KEY, JSON.stringify({
      persona: hubVerifyState.persona,
      customUid: hubVerifyState.customUid || '',
      active: !!hubVerifyState.active
    }));
  } catch (e) {}
}

function hubLoadVerifySession() {
  if (!hubIsDevVerifyAllowed()) return null;
  try {
    var raw = sessionStorage.getItem(HUB_VERIFY_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function hubCollectVerifyStats() {
  var settingsObj = typeof settings !== 'undefined' && settings ? settings : {};
  var projects = 0;
  if (typeof pmGetRegisteredProjects === 'function') {
    try { projects = pmGetRegisteredProjects().length; } catch (e) { projects = 0; }
  } else if (settingsObj.projectMaster && settingsObj.projectMaster.order) {
    projects = settingsObj.projectMaster.order.length;
  }
  var ramIn = Array.isArray(settingsObj.ramInputAccounts) ? settingsObj.ramInputAccounts.length : 0;
  var orcaIn = Array.isArray(settingsObj.orcaInputAccounts) ? settingsObj.orcaInputAccounts.length : 0;
  var eniIn = Array.isArray(settingsObj.eniInputAccounts) ? settingsObj.eniInputAccounts.length : 0;
  var accounts = ramIn + orcaIn + eniIn;
  var ramOrg = typeof members !== 'undefined' && Array.isArray(members) ? members.length : 0;
  var orcaOrg = 0;
  var eniOrg = 0;
  try {
    if (typeof orcaPackOrgChart === 'function') {
      var oc = orcaPackOrgChart();
      orcaOrg = oc && Array.isArray(oc.members) ? oc.members.length : 0;
    }
  } catch (e2) {}
  try {
    if (typeof eniPackOrgChart === 'function') {
      var ec = eniPackOrgChart();
      eniOrg = ec && Array.isArray(ec.members) ? ec.members.length : 0;
    }
  } catch (e3) {}
  var orgNodes = ramOrg + orcaOrg + eniOrg;
  var rev = settingsObj.revenueLog && typeof settingsObj.revenueLog === 'object'
    ? Object.keys(settingsObj.revenueLog).length : 0;
  var sales = settingsObj.salesLog && typeof settingsObj.salesLog === 'object'
    ? Object.keys(settingsObj.salesLog).length : 0;
  return {
    projects: projects,
    accounts: accounts,
    orgNodes: orgNodes,
    performance: rev + sales
  };
}

function hubGetDevServerPort() {
  try {
    var port = String(window.location.port || '');
    if (port) return port;
  } catch (e) {}
  return '5050';
}

function hubIsIpv4Host(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(String(host || ''));
}

function hubBuildLanUrl(ip) {
  return 'http://' + ip + ':' + hubGetDevServerPort();
}

function hubDiscoverLanIps(callback) {
  var ips = [];
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    callback(ips.slice());
  }
  try {
    var host = String(window.location.hostname || '');
    if (hubIsIpv4Host(host) && host.indexOf('127.') !== 0) ips.push(host);
  } catch (e0) {}
  try {
    var RTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!RTC) {
      finish();
      return;
    }
    var pc = new RTC({ iceServers: [] });
    pc.createDataChannel('hub-lan');
    pc.onicecandidate = function (ev) {
      if (!ev || !ev.candidate || !ev.candidate.candidate) {
        if (!ev || !ev.candidate) finish();
        return;
      }
      var m = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(ev.candidate.candidate);
      if (!m) return;
      var ip = m[1];
      if (ip.indexOf('127.') === 0) return;
      if (ips.indexOf(ip) < 0) ips.push(ip);
    };
    pc.createOffer().then(function (offer) {
      return pc.setLocalDescription(offer);
    }).catch(function () {
      finish();
    });
    setTimeout(function () {
      try { pc.close(); } catch (e1) {}
      finish();
    }, 1200);
  } catch (e2) {
    finish();
  }
}

function hubRefreshLanUrlDisplay() {
  var el = document.getElementById('hubVerifyLanUrls');
  if (!el) return;
  var port = hubGetDevServerPort();
  el.textContent = '検出中…';
  hubDiscoverLanIps(function (ips) {
    if (!ips.length) {
      el.innerHTML =
        '同じWi-FiのiPhoneから<br>' +
        '<code>http://&lt;MacのIP&gt;:' + port + '</code><br>' +
        'でアクセス（例: http://192.168.3.8:' + port + '）';
      return;
    }
    el.innerHTML = ips.map(function (ip) {
      var url = hubBuildLanUrl(ip);
      return '<a class="hubUserVerifyLanLink" href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
    }).join('<br>');
  });
}

/** iframe内（実viewport確認中）なら幅を返す。親ウィンドウでは 0 */
function hubGetPreviewFrameWidth() {
  try {
    if (window.self === window.top) return 0;
  } catch (e) {
    return 0;
  }
  try {
    var params = new URLSearchParams(window.location.search || '');
    var w = Number(params.get(HUB_PREVIEW_QUERY) || 0);
    if (w === 375 || w === 390 || w === 430) return w;
  } catch (e2) {}
  return 0;
}

function hubIsMobilePreviewFrame() {
  return hubGetPreviewFrameWidth() > 0;
}

function hubBuildMobilePreviewUrl(width) {
  var url;
  try {
    url = new URL(window.location.href);
  } catch (e) {
    return window.location.pathname + '?' + HUB_PREVIEW_QUERY + '=' + width;
  }
  url.searchParams.set(HUB_PREVIEW_QUERY, String(width));
  // プレビュー子はパネルを出さない。ハッシュは維持
  return url.pathname + url.search + url.hash;
}

function hubSyncMobilePreviewButtons(width) {
  document.querySelectorAll('[data-hub-mobile-w]').forEach(function (btn) {
    var w = Number(btn.getAttribute('data-hub-mobile-w') || 0);
    btn.classList.toggle('is-active', w === width);
  });
  var label = document.getElementById('hubVerifyMobileLabel');
  if (label) {
    label.textContent = width
      ? ('iframe確認中: ' + width + 'px（実viewport）')
      : 'PC幅（通常）';
  }
  var title = document.getElementById('hubMobilePreviewTitle');
  if (title) title.textContent = width ? ('スマホ確認 · ' + width + 'px') : 'スマホ確認';
}

function hubCloseMobilePreviewShell() {
  var shell = document.getElementById('hubMobilePreviewShell');
  if (shell && shell.parentNode) shell.parentNode.removeChild(shell);
  try {
    document.body.classList.remove('hub-mobile-preview-open');
  } catch (e) {}
}

function hubReloadMobilePreviewFrame() {
  if (!hubMobilePreviewWidth) return;
  var iframe = document.getElementById('hubMobilePreviewFrame');
  if (!iframe) return;
  iframe.src = hubBuildMobilePreviewUrl(hubMobilePreviewWidth);
}

function hubEnsureMobilePreviewShell(width) {
  var shell = document.getElementById('hubMobilePreviewShell');
  if (shell) return shell;
  shell = document.createElement('div');
  shell.id = 'hubMobilePreviewShell';
  shell.className = 'hubMobilePreviewShell';
  shell.innerHTML =
    '<div class="hubMobilePreviewChrome">' +
      '<div class="hubMobilePreviewChromeLeft">' +
        '<strong id="hubMobilePreviewTitle">スマホ確認 · ' + width + 'px</strong>' +
        '<span>iframe実viewport · media query発火</span>' +
      '</div>' +
      '<div class="hubMobilePreviewChromeActions">' +
        '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="375">375</button>' +
        '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="390">390</button>' +
        '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="430">430</button>' +
        '<button type="button" class="hubUserVerifyBtn" id="hubMobilePreviewCloseBtn">閉じる</button>' +
      '</div>' +
    '</div>' +
    '<div class="hubMobilePreviewStage">' +
      '<div class="hubMobilePreviewDevice" id="hubMobilePreviewDevice">' +
        '<iframe id="hubMobilePreviewFrame" class="hubMobilePreviewFrame" title="OUKEI HUB スマホ確認"></iframe>' +
      '</div>' +
    '</div>';
  document.body.appendChild(shell);
  document.body.classList.add('hub-mobile-preview-open');

  shell.querySelectorAll('[data-hub-mobile-w]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hubSetMobilePreviewWidth(Number(btn.getAttribute('data-hub-mobile-w') || 0));
    });
  });
  var closeBtn = document.getElementById('hubMobilePreviewCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      hubSetMobilePreviewWidth(0);
    });
  }
  return shell;
}

/**
 * スマホ確認: PCレイアウト縮小ではなく iframe の実viewport幅を変更する。
 * transform:scale は使わない。
 */
function hubSetMobilePreviewWidth(width) {
  if (hubIsMobilePreviewFrame()) return;
  if (!hubIsDevVerifyAllowed()) return;

  width = Number(width) || 0;
  if (width !== 0 && width !== 375 && width !== 390 && width !== 430) width = 390;
  hubMobilePreviewWidth = width;

  try {
    if (width) sessionStorage.setItem(HUB_MOBILE_PREVIEW_KEY, String(width));
    else sessionStorage.removeItem(HUB_MOBILE_PREVIEW_KEY);
  } catch (e) {}

  // 旧方式（body幅だけ縮める）の痕跡を必ず除去
  try {
    document.documentElement.classList.remove('hub-mobile-preview');
    document.documentElement.style.removeProperty('--hub-mobile-preview-width');
    document.documentElement.removeAttribute('data-hub-mobile-preview');
  } catch (e2) {}

  if (!width) {
    hubCloseMobilePreviewShell();
    hubSyncMobilePreviewButtons(0);
    return;
  }

  hubEnsureMobilePreviewShell(width);
  var device = document.getElementById('hubMobilePreviewDevice');
  var iframe = document.getElementById('hubMobilePreviewFrame');
  if (device) {
    device.style.width = width + 'px';
    device.setAttribute('data-width', String(width));
  }
  if (iframe) {
    var next = hubBuildMobilePreviewUrl(width);
    // 幅変更時は必ず再読込して viewport / matchMedia を取り直す
    if (iframe.getAttribute('data-preview-w') !== String(width) || !iframe.src) {
      iframe.setAttribute('data-preview-w', String(width));
      iframe.src = next;
    } else {
      iframe.src = next;
    }
  }
  hubSyncMobilePreviewButtons(width);
}

function hubRestoreMobilePreviewWidth() {
  if (!hubIsDevVerifyAllowed()) return;
  if (hubIsMobilePreviewFrame()) return;
  try {
    var raw = sessionStorage.getItem(HUB_MOBILE_PREVIEW_KEY);
    var w = Number(raw || 0);
    if (w) hubSetMobilePreviewWidth(w);
  } catch (e) {}
}

function hubInitPreviewFrameMode() {
  var w = hubGetPreviewFrameWidth();
  if (!w) return;
  try {
    document.documentElement.classList.add('hub-preview-frame');
    document.documentElement.setAttribute('data-hub-preview-w', String(w));
    document.body.classList.add('hub-preview-frame');
  } catch (e) {}
}

function hubRefreshVerifyPanel() {
  if (!hubIsDevVerifyAllowed()) return;
  var panel = document.getElementById('hubUserVerifyPanel');
  if (!panel) return;

  var realUid = (typeof hubGetRealLoginUid === 'function' ? hubGetRealLoginUid() : '') || '（未ログイン）';
  var dataUid = (typeof hubActiveUid !== 'undefined' && hubActiveUid)
    ? String(hubActiveUid)
    : hubResolveVerifyTargetUid(hubVerifyState.persona, hubVerifyState.customUid);
  var role = hubGetVerifyPersonaRole();
  var lsKey = typeof hubStorageKeyForUid === 'function'
    ? hubStorageKeyForUid(dataUid)
    : ('oukei_hub_v15_data:' + dataUid);
  var fsPath = 'users/' + dataUid + '/hubData/main';
  var stats = hubCollectVerifyStats();

  var setText = function (id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('hubVerifyRealUid', realUid);
  setText('hubVerifyDataUid', dataUid);
  setText('hubVerifyRole', role);
  setText('hubVerifyLsKey', lsKey);
  setText('hubVerifyFsPath', fsPath);
  setText('hubVerifyProjectCount', String(stats.projects));
  setText('hubVerifyAccountCount', String(stats.accounts));
  setText('hubVerifyOrgCount', String(stats.orgNodes));
  setText('hubVerifyPerfCount', String(stats.performance));

  var select = document.getElementById('hubUserVerifyPersona');
  if (select) select.value = hubVerifyState.persona || 'admin';
  var customWrap = document.getElementById('hubUserVerifyCustomWrap');
  var customInput = document.getElementById('hubUserVerifyCustomUid');
  if (customWrap) customWrap.classList.toggle('hidden', hubVerifyState.persona !== 'custom');
  if (customInput && hubVerifyState.customUid) customInput.value = hubVerifyState.customUid;

  panel.classList.toggle('is-admin-persona', role === 'admin');
  panel.classList.toggle('is-user-persona', role !== 'admin');

  document.querySelectorAll('[data-hub-mobile-w]').forEach(function (btn) {
    var w = Number(btn.getAttribute('data-hub-mobile-w') || 0);
    btn.classList.toggle('is-active', w === hubMobilePreviewWidth);
  });
  var label = document.getElementById('hubVerifyMobileLabel');
  if (label) {
    label.textContent = hubMobilePreviewWidth
      ? ('スマホ表示中: ' + hubMobilePreviewWidth + 'px')
      : 'PC幅（通常）';
  }
}

function hubMountUserVerifyPanel() {
  if (!hubIsDevVerifyAllowed()) return;
  // iframeプレビュー子では親パネルと二重にしない
  if (hubIsMobilePreviewFrame()) {
    hubInitPreviewFrameMode();
    return;
  }
  if (document.getElementById('hubUserVerifyPanel')) {
    hubRefreshVerifyPanel();
    return;
  }
  var panel = document.createElement('div');
  panel.id = 'hubUserVerifyPanel';
  panel.className = 'hubUserVerifyPanel';
  panel.innerHTML =
    '<div class="hubUserVerifyHead">' +
      '<strong>ユーザー確認</strong>' +
      '<span>localhost専用 · Auth UIDは変更しません</span>' +
      '<button type="button" class="hubUserVerifyToggle" id="hubUserVerifyToggle" aria-expanded="true">畳む</button>' +
    '</div>' +
    '<div class="hubUserVerifyBody" id="hubUserVerifyBody">' +
      '<div class="hubUserVerifyControls">' +
        '<label class="hubUserVerifyLabel">検証ユーザー' +
          '<select id="hubUserVerifyPersona">' +
            '<option value="admin">管理者ユーザー</option>' +
            '<option value="new">新規一般ユーザー</option>' +
            '<option value="existing">既存一般ユーザー</option>' +
            '<option value="custom">カスタムテストUID</option>' +
          '</select>' +
        '</label>' +
        '<label class="hubUserVerifyLabel hidden" id="hubUserVerifyCustomWrap">カスタムUID' +
          '<input id="hubUserVerifyCustomUid" type="text" placeholder="例: test_custom_001" autocomplete="off">' +
        '</label>' +
        '<div class="hubUserVerifyActions">' +
          '<button type="button" class="hubUserVerifyBtn" id="hubUserVerifyApplyBtn">このユーザーで確認</button>' +
          '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--danger" id="hubUserVerifyResetBtn">新規ユーザー状態へリセット</button>' +
        '</div>' +
        '<div class="hubUserVerifyMobile">' +
          '<div class="hubUserVerifyMobileTitle">スマホ表示確認（iframe実viewport）</div>' +
          '<div class="hubUserVerifyActions">' +
            '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="0">PC幅</button>' +
            '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="375">375</button>' +
            '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="390">390</button>' +
            '<button type="button" class="hubUserVerifyBtn hubUserVerifyBtn--ghost" data-hub-mobile-w="430">430</button>' +
          '</div>' +
          '<div id="hubVerifyMobileLabel" class="hubUserVerifyMobileLabel">PC幅（通常）</div>' +
          '<p class="hubUserVerifyNote">PCレイアウトの縮小ではなく、iframe内で media query が発火する実幅確認です。</p>' +
          '<div class="hubUserVerifyMobileTitle">実機iPhone（同じWi-Fi）</div>' +
          '<div id="hubVerifyLanUrls" class="hubUserVerifyLanUrls">検出中…</div>' +
        '</div>' +
      '</div>' +
      '<dl class="hubUserVerifyMeta">' +
        '<div><dt>実ログインUID</dt><dd id="hubVerifyRealUid">—</dd></div>' +
        '<div><dt>検証用UID</dt><dd id="hubVerifyDataUid">—</dd></div>' +
        '<div><dt>role</dt><dd id="hubVerifyRole">—</dd></div>' +
        '<div><dt>LocalStorage</dt><dd id="hubVerifyLsKey">—</dd></div>' +
        '<div><dt>Firestore</dt><dd id="hubVerifyFsPath">—</dd></div>' +
        '<div><dt>登録プロジェクト数</dt><dd id="hubVerifyProjectCount">0</dd></div>' +
        '<div><dt>登録アカウント数</dt><dd id="hubVerifyAccountCount">0</dd></div>' +
        '<div><dt>組織図ノード数</dt><dd id="hubVerifyOrgCount">0</dd></div>' +
        '<div><dt>実績件数</dt><dd id="hubVerifyPerfCount">0</dd></div>' +
      '</dl>' +
      '<p class="hubUserVerifyNote">Firestoreへは書き込みません（localhostはクラウド同期OFF）。管理者UIDのLocalStorageはリセット対象外です。</p>' +
    '</div>';

  var bar = document.getElementById('hubLocalDevBar');
  if (bar && bar.parentNode) bar.parentNode.insertBefore(panel, bar.nextSibling);
  else document.body.insertBefore(panel, document.body.firstChild);

  document.body.classList.add('hub-user-verify-open');

  var select = document.getElementById('hubUserVerifyPersona');
  if (select) {
    select.addEventListener('change', function () {
      hubVerifyState.persona = select.value;
      var wrap = document.getElementById('hubUserVerifyCustomWrap');
      if (wrap) wrap.classList.toggle('hidden', select.value !== 'custom');
    });
  }
  var applyBtn = document.getElementById('hubUserVerifyApplyBtn');
  if (applyBtn) applyBtn.addEventListener('click', function () {
    var persona = (document.getElementById('hubUserVerifyPersona') || {}).value || 'admin';
    var custom = (document.getElementById('hubUserVerifyCustomUid') || {}).value || '';
    hubApplyVerifyPersona(persona, { customUid: custom, forceEmpty: persona === 'new' });
  });
  var resetBtn = document.getElementById('hubUserVerifyResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', hubResetVerifyNewUserState);
  var toggle = document.getElementById('hubUserVerifyToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var body = document.getElementById('hubUserVerifyBody');
      if (!body) return;
      var collapsed = body.classList.toggle('hidden');
      toggle.textContent = collapsed ? '開く' : '畳む';
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      document.body.classList.toggle('hub-user-verify-collapsed', collapsed);
    });
  }
  panel.querySelectorAll('[data-hub-mobile-w]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hubSetMobilePreviewWidth(Number(btn.getAttribute('data-hub-mobile-w') || 0));
    });
  });

  hubRestoreMobilePreviewWidth();
  hubRefreshVerifyPanel();
  hubRefreshLanUrlDisplay();
}

function hubApplyVerifyPersona(persona, opts) {
  opts = opts || {};
  if (!hubIsDevVerifyAllowed()) return false;

  persona = persona || 'admin';
  var customUid = hubSanitizeVerifyUid(opts.customUid || '');
  var targetUid = hubResolveVerifyTargetUid(persona, customUid);
  var forceEmpty = !!opts.forceEmpty;
  var role = persona === 'admin' ? 'admin' : 'user';

  // 切替前に現在UIDのローカルだけ保存（管理者データ保護）
  hubPersistActiveLocalOnly();

  if (persona === 'existing') hubEnsureExistingVerifySeed();

  if (forceEmpty) {
    if (hubIsProtectedVerifyUid(targetUid)) {
      if (typeof showToast === 'function') showToast('⚠️ 保護されたUIDは空初期化できません');
      return false;
    }
    hubClearVerifyUidLocalData(targetUid);
  }

  // Auth UID は触らず、データUIDだけ切替
  if (typeof hubBindStorageToUid === 'function') {
    hubBindStorageToUid(targetUid);
  } else if (typeof hubSetActiveUid === 'function') {
    hubSetActiveUid(targetUid);
  }

  if (forceEmpty && typeof hubCreateEmptyData === 'function' && typeof hubApplyData === 'function') {
    hubApplyData(hubCreateEmptyData(), { skipMerge: true });
  }

  if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  if (typeof ensureRevenueLog === 'function') ensureRevenueLog();
  if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
  if (typeof pfEnsurePerformanceInputHiddenAccounts === 'function') pfEnsurePerformanceInputHiddenAccounts();

  if (typeof hubCurrentProfile !== 'undefined') {
    hubCurrentProfile = Object.assign({}, hubCurrentProfile || {}, {
      role: role,
      username: hubCurrentProfile && hubCurrentProfile.username
        ? hubCurrentProfile.username
        : (persona === 'admin' ? 'admin-verify' : 'user-verify'),
      displayName: persona === 'admin' ? '管理者（検証）' : '一般ユーザー（検証）'
    });
  }

  hubVerifyState.persona = persona;
  hubVerifyState.customUid = customUid;
  hubVerifyState.active = true;
  hubSaveVerifySession();

  if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
  if (typeof initHomeDemo === 'function') initHomeDemo();
  if (typeof hubApplyDevUiVisibility === 'function') hubApplyDevUiVisibility();
  if (typeof hubApplySettingsVisibility === 'function') hubApplySettingsVisibility();
  if (typeof hubRenderLocalDevStatus === 'function') hubRenderLocalDevStatus();
  if (typeof hubRenderAccountSummary === 'function') {
    try {
      var authUser = typeof hubGetFirebaseAuth === 'function' && hubGetFirebaseAuth()
        ? hubGetFirebaseAuth().currentUser
        : null;
      hubRenderAccountSummary(authUser, hubCurrentProfile);
    } catch (e) {}
  }
  if (!opts.skipRender) {
    if (typeof render === 'function') render();
  }
  hubRefreshVerifyPanel();
  // 親でiframe確認中なら、同じ検証状態でiframeを再読込
  if (!hubIsMobilePreviewFrame() && hubMobilePreviewWidth) {
    hubReloadMobilePreviewFrame();
  }
  if (!opts.silent && typeof showToast === 'function') {
    showToast('✅ 検証ユーザーを切替: ' + targetUid + ' (' + role + ')');
  }
  return true;
}

function hubApplyStoredVerifyPersona(opts) {
  opts = opts || {};
  if (!hubIsDevVerifyAllowed()) return false;
  var saved = hubLoadVerifySession();
  if (!saved || !saved.active) {
    // デフォルトは管理者確認（実ログインUIDのデータ）
    return hubApplyVerifyPersona('admin', { silent: true, skipRender: !!opts.skipRender, forceEmpty: false });
  }
  return hubApplyVerifyPersona(saved.persona || 'admin', {
    customUid: saved.customUid || '',
    forceEmpty: false,
    silent: true,
    skipRender: !!opts.skipRender
  });
}

function hubResetVerifyNewUserState() {
  if (!hubIsDevVerifyAllowed()) return;
  var msg =
    '検証用ユーザーのローカルデータだけを削除します。\n' +
    '管理者データ・本番データには影響しません。';
  if (!confirm(msg)) return;

  var uid = (typeof hubActiveUid !== 'undefined' && hubActiveUid)
    ? String(hubActiveUid)
    : hubResolveVerifyTargetUid(hubVerifyState.persona, hubVerifyState.customUid);

  if (hubIsProtectedVerifyUid(uid)) {
    // 管理者選択中なら新規検証UIDへ切り替えてリセット
    uid = HUB_VERIFY_NEW_UID;
  }

  hubPersistActiveLocalOnly();
  hubClearVerifyUidLocalData(uid);
  hubVerifyState.persona = 'new';
  hubVerifyState.customUid = '';
  hubVerifyState.active = true;
  hubApplyVerifyPersona('new', { forceEmpty: true, silent: false });
}

function hubInitUserVerifyPanel() {
  if (!hubIsDevVerifyAllowed()) return;
  hubInitPreviewFrameMode();
  hubMountUserVerifyPanel();
}

if (typeof window !== 'undefined') {
  window.HUB_VERIFY_NEW_UID = HUB_VERIFY_NEW_UID;
  window.HUB_VERIFY_EXISTING_UID = HUB_VERIFY_EXISTING_UID;
  window.hubIsDevVerifyAllowed = hubIsDevVerifyAllowed;
  window.hubIsUserVerifyActive = hubIsUserVerifyActive;
  window.hubGetVerifyPersona = hubGetVerifyPersona;
  window.hubGetVerifyPersonaRole = hubGetVerifyPersonaRole;
  window.hubApplyVerifyPersona = hubApplyVerifyPersona;
  window.hubApplyStoredVerifyPersona = hubApplyStoredVerifyPersona;
  window.hubResetVerifyNewUserState = hubResetVerifyNewUserState;
  window.hubRefreshVerifyPanel = hubRefreshVerifyPanel;
  window.hubInitUserVerifyPanel = hubInitUserVerifyPanel;
  window.hubIsProtectedVerifyUid = hubIsProtectedVerifyUid;
  window.hubSetMobilePreviewWidth = hubSetMobilePreviewWidth;
  window.hubRefreshLanUrlDisplay = hubRefreshLanUrlDisplay;
  window.hubIsMobilePreviewFrame = hubIsMobilePreviewFrame;
  window.hubReloadMobilePreviewFrame = hubReloadMobilePreviewFrame;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hubInitUserVerifyPanel);
  } else {
    hubInitUserVerifyPanel();
  }
}
