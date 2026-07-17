/* OUKEI HUB — 組織図表示状態の同期時保持
 * 同期後の hubApplyData / render で rootId・ズーム・スクロールが初期化されないようにする。
 * RAM / ORCA / ENI 共通。
 */

function hubOrgPageIsVisible(pageEl) {
  return !!(pageEl && !pageEl.classList.contains('hidden'));
}

function hubOrgActiveProject() {
  if (typeof ramPage !== 'undefined' && hubOrgPageIsVisible(ramPage)) return 'ram';
  if (typeof orcaOrgPage !== 'undefined' && hubOrgPageIsVisible(orcaOrgPage)) return 'orca';
  if (typeof eniOrgPage !== 'undefined' && hubOrgPageIsVisible(eniOrgPage)) return 'eni';
  return null;
}

function hubOrgReadViewportScroll(viewportId) {
  let vp = typeof document !== 'undefined' ? document.getElementById(viewportId) : null;
  if (!vp) return { scrollLeft: 0, scrollTop: 0 };
  return {
    scrollLeft: Number(vp.scrollLeft) || 0,
    scrollTop: Number(vp.scrollTop) || 0
  };
}

function hubOrgWriteViewportScroll(viewportId, scroll) {
  if (!scroll) return;
  let vp = typeof document !== 'undefined' ? document.getElementById(viewportId) : null;
  if (!vp) return;
  try {
    vp.scrollLeft = Number(scroll.scrollLeft) || 0;
    vp.scrollTop = Number(scroll.scrollTop) || 0;
  } catch (e) {}
}

function hubOrgSnapshotOpenFlags(memberList) {
  let map = {};
  (memberList || []).forEach(function (m) {
    if (m && m.id != null) map[String(m.id)] = !!m.open;
  });
  return map;
}

function hubOrgRestoreOpenFlags(memberList, openMap) {
  if (!openMap || !memberList) return;
  memberList.forEach(function (m) {
    if (!m || m.id == null) return;
    let key = String(m.id);
    if (Object.prototype.hasOwnProperty.call(openMap, key)) {
      m.open = openMap[key];
    }
  });
}

function hubOrgMemberExists(memberList, id) {
  if (!id) return false;
  return (memberList || []).some(function (m) { return m && m.id === id; });
}

/** 同期直前に、表示中組織図のビュー状態を保存 */
function hubCaptureOrgChartViewState() {
  let project = hubOrgActiveProject();
  let state = {
    project: project,
    capturedAt: Date.now(),
    ram: null,
    orca: null,
    eni: null
  };

  if (typeof rootId !== 'undefined') {
    let scroll = hubOrgReadViewportScroll('viewport');
    state.ram = {
      rootId: rootId || '',
      focusId: typeof focusId !== 'undefined' ? (focusId || '') : '',
      zoom: typeof zoom === 'number' ? zoom : 1,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
      openMap: hubOrgSnapshotOpenFlags(typeof members !== 'undefined' ? members : [])
    };
  }

  if (typeof orcaRootId !== 'undefined') {
    let scroll = hubOrgReadViewportScroll('orcaViewport');
    state.orca = {
      rootId: orcaRootId || '',
      focusId: typeof orcaFocusId !== 'undefined' ? (orcaFocusId || '') : '',
      zoom: typeof orcaZoom === 'number' ? orcaZoom : 1,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
      openMap: hubOrgSnapshotOpenFlags(typeof orcaMembers !== 'undefined' ? orcaMembers : [])
    };
  }

  if (typeof eniRootId !== 'undefined') {
    let scroll = hubOrgReadViewportScroll('eniViewport');
    state.eni = {
      rootId: eniRootId || '',
      focusId: typeof eniFocusId !== 'undefined' ? (eniFocusId || '') : '',
      zoom: typeof eniZoom === 'number' ? eniZoom : 1,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
      openMap: hubOrgSnapshotOpenFlags(typeof eniMembers !== 'undefined' ? eniMembers : [])
    };
  }

  return state;
}

function hubOrgFallbackRootId(rootAccountIds, memberList) {
  let ids = rootAccountIds || [];
  for (let i = 0; i < ids.length; i++) {
    if (hubOrgMemberExists(memberList, ids[i])) return ids[i];
  }
  let first = (memberList || []).find(function (m) { return m && !m.parent; });
  return first ? first.id : '';
}

/**
 * hubApplyData 直後: rootId / focusId / zoom / open を復元。
 * 表示中アカウントがデータに残っていれば維持し、削除時のみメインへフォールバック。
 */
function hubRestoreOrgChartViewState(state) {
  if (!state) return;

  if (state.ram && typeof rootId !== 'undefined') {
    let list = typeof members !== 'undefined' ? members : [];
    hubOrgRestoreOpenFlags(list, state.ram.openMap);
    if (typeof currentData !== 'undefined' && Array.isArray(currentData)) {
      hubOrgRestoreOpenFlags(currentData, state.ram.openMap);
    }
    if (hubOrgMemberExists(list, state.ram.rootId)) {
      rootId = state.ram.rootId;
      focusId = hubOrgMemberExists(list, state.ram.focusId) ? state.ram.focusId : rootId;
    } else {
      rootId = hubOrgFallbackRootId(
        typeof rootAccountIds !== 'undefined' ? rootAccountIds : [],
        list
      );
      focusId = rootId;
    }
    if (typeof zoom === 'number' && typeof state.ram.zoom === 'number') {
      zoom = state.ram.zoom;
    }
  }

  if (state.orca && typeof orcaRootId !== 'undefined') {
    let list = typeof orcaMembers !== 'undefined' ? orcaMembers : [];
    hubOrgRestoreOpenFlags(list, state.orca.openMap);
    if (typeof orcaCurrentData !== 'undefined' && Array.isArray(orcaCurrentData)) {
      hubOrgRestoreOpenFlags(orcaCurrentData, state.orca.openMap);
    }
    if (hubOrgMemberExists(list, state.orca.rootId)) {
      orcaRootId = state.orca.rootId;
      orcaFocusId = hubOrgMemberExists(list, state.orca.focusId) ? state.orca.focusId : orcaRootId;
    } else {
      orcaRootId = hubOrgFallbackRootId(
        typeof orcaRootAccountIds !== 'undefined' ? orcaRootAccountIds : [],
        list
      );
      orcaFocusId = orcaRootId;
    }
    if (typeof orcaZoom === 'number' && typeof state.orca.zoom === 'number') {
      orcaZoom = state.orca.zoom;
    }
  }

  if (state.eni && typeof eniRootId !== 'undefined') {
    let list = typeof eniMembers !== 'undefined' ? eniMembers : [];
    hubOrgRestoreOpenFlags(list, state.eni.openMap);
    if (typeof eniCurrentData !== 'undefined' && Array.isArray(eniCurrentData)) {
      hubOrgRestoreOpenFlags(eniCurrentData, state.eni.openMap);
    }
    if (hubOrgMemberExists(list, state.eni.rootId)) {
      eniRootId = state.eni.rootId;
      eniFocusId = hubOrgMemberExists(list, state.eni.focusId) ? state.eni.focusId : eniRootId;
    } else {
      eniRootId = hubOrgFallbackRootId(
        typeof eniRootAccountIds !== 'undefined' ? eniRootAccountIds : [],
        list
      );
      eniFocusId = eniRootId;
    }
    if (typeof eniZoom === 'number' && typeof state.eni.zoom === 'number') {
      eniZoom = state.eni.zoom;
    }
  }
}

/** 再描画後にスクロール位置を戻す（tree.innerHTML 差し替え対策） */
function hubRestoreOrgChartScrollState(state) {
  if (!state || !state.project) return;

  function apply() {
    if (state.project === 'ram' && state.ram) {
      hubOrgWriteViewportScroll('viewport', state.ram);
    } else if (state.project === 'orca' && state.orca) {
      hubOrgWriteViewportScroll('orcaViewport', state.orca);
    } else if (state.project === 'eni' && state.eni) {
      hubOrgWriteViewportScroll('eniViewport', state.eni);
    }
  }

  apply();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(function () {
      apply();
      setTimeout(apply, 50);
      setTimeout(apply, 150);
    });
  } else {
    setTimeout(apply, 50);
    setTimeout(apply, 150);
  }
}

/**
 * ensureRootAccounts 系が「rootAccountIds に無い rootId」をメインへ戻すのを緩和。
 * メンバーが存在する限り表示中アカウントを維持する。
 */
function hubPatchOrgEnsureRootGuards() {
  function wrap(name, getRoot, setRoot, getIds, getMembers) {
    let fn = typeof window !== 'undefined' ? window[name] : null;
    if (typeof fn !== 'function' || fn.__hubOrgViewPatched) return;
    let orig = fn;
    window[name] = function () {
      let prev = getRoot();
      let ret = orig.apply(this, arguments);
      let list = getMembers();
      let ids = getIds() || [];
      if (prev && hubOrgMemberExists(list, prev) && getRoot() !== prev) {
        // 元実装が rootAccountIds 外へフォールバックした場合、存在すれば復元
        if (ids.indexOf(prev) >= 0 || hubOrgMemberExists(list, prev)) {
          setRoot(prev);
        }
      }
      return ret;
    };
    window[name].__hubOrgViewPatched = true;
  }

  if (typeof ensureRootAccounts === 'function') {
    wrap(
      'ensureRootAccounts',
      function () { return rootId; },
      function (id) { rootId = id; },
      function () { return rootAccountIds; },
      function () { return members; }
    );
  }
  if (typeof orcaEnsureRootAccounts === 'function') {
    wrap(
      'orcaEnsureRootAccounts',
      function () { return orcaRootId; },
      function (id) { orcaRootId = id; },
      function () { return orcaRootAccountIds; },
      function () { return orcaMembers; }
    );
  }
  if (typeof eniEnsureRootAccounts === 'function') {
    wrap(
      'eniEnsureRootAccounts',
      function () { return eniRootId; },
      function (id) { eniRootId = id; },
      function () { return eniRootAccountIds; },
      function () { return eniMembers; }
    );
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hubPatchOrgEnsureRootGuards);
  } else {
    hubPatchOrgEnsureRootGuards();
  }
  setTimeout(hubPatchOrgEnsureRootGuards, 0);
  setTimeout(hubPatchOrgEnsureRootGuards, 100);
}

if (typeof window !== 'undefined') {
  window.hubCaptureOrgChartViewState = hubCaptureOrgChartViewState;
  window.hubRestoreOrgChartViewState = hubRestoreOrgChartViewState;
  window.hubRestoreOrgChartScrollState = hubRestoreOrgChartScrollState;
  window.hubPatchOrgEnsureRootGuards = hubPatchOrgEnsureRootGuards;
}
