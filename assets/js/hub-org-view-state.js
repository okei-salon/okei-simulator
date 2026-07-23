/* OUKEI HUB — 組織図表示状態の同期時保持
 * 同期後の hubApplyData / render で rootId・ズーム・スクロールが初期化されないようにする。
 * RAM / ORCA / ENI 共通。
 *
 * IMPORTANT (Ver2.0.32 緊急修正):
 * open 未設定を !!m.open すると false になり、同期 restore で全ノードが折りたたまれる。
 * 欠落 open は「開いている」扱い（open !== false）とする。
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

/** Missing open ⇒ opened. Only explicit false is closed. */
function hubOrgIsOpenFlag(openVal) {
  return openVal !== false;
}

/**
 * Snapshot open flags for sync restore.
 * MUST use open !== false (not !!open). Missing/undefined open means expanded.
 */
function hubOrgSnapshotOpenFlags(memberList) {
  let map = {};
  (memberList || []).forEach(function (m) {
    if (m && m.id != null) map[String(m.id)] = hubOrgIsOpenFlag(m.open);
  });
  return map;
}

/** True when every snapshotted node is closed (corrupt !!undefined capture). */
function hubOrgOpenMapIsMassCollapsed(openMap, memberList) {
  if (!openMap || !memberList || memberList.length <= 1) return false;
  let keys = Object.keys(openMap);
  if (keys.length < 2) return false;
  for (let i = 0; i < keys.length; i++) {
    if (openMap[keys[i]]) return false;
  }
  return true;
}

/**
 * Repair already-persisted mass collapse (all open===false).
 * Does NOT wipe members/parents — only flips open flags.
 * Returns true if repair ran.
 */
function hubOrgRepairMassCollapsedOpens(memberList, label) {
  if (!memberList || memberList.length <= 1) return false;
  let closed = 0;
  let total = 0;
  memberList.forEach(function (m) {
    if (!m || m.id == null) return;
    total++;
    if (m.open === false) closed++;
  });
  if (total < 2 || closed !== total) return false;
  memberList.forEach(function (m) {
    if (m && m.id != null) m.open = true;
  });
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('[OUKEI][ORG-DIAG] repaired mass-collapsed opens', {
      project: label || '',
      members: total
    });
  }
  return true;
}

function hubOrgRestoreOpenFlags(memberList, openMap, label) {
  if (!openMap || !memberList) return;
  if (hubOrgOpenMapIsMassCollapsed(openMap, memberList)) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[OUKEI][ORG-DIAG] skip mass-collapsed openMap restore', {
        project: label || '',
        members: memberList.length,
        mapKeys: Object.keys(openMap).length
      });
    }
    return;
  }
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

/**
 * Count nodes visible from root given open flags (same rule as render).
 * edges = parent links among active members.
 */
function hubOrgCountVisibleFromRoot(memberList, rootId) {
  let list = memberList || [];
  let byParent = {};
  list.forEach(function (m) {
    if (!m || m.id == null) return;
    let p = m.parent || '';
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(m);
  });
  let visible = 0;
  let edges = 0;
  list.forEach(function (m) {
    if (m && m.parent) edges++;
  });
  function walk(id) {
    let m = list.find(function (x) { return x && x.id === id; });
    if (!m) return;
    visible++;
    if (!hubOrgIsOpenFlag(m.open)) return;
    let kids = byParent[id] || [];
    kids.forEach(function (k) { walk(k.id); });
  }
  if (rootId) walk(rootId);
  return { members: list.length, edges: edges, visible: visible, rootId: rootId || '' };
}

/** READ-ONLY diagnosis for RAM / ORCA / ENI (no writes). */
function hubOrgDiagnoseCharts() {
  function pack(label, list, rootId, treeSel) {
    let counts = hubOrgCountVisibleFromRoot(list, rootId);
    let openTrue = 0;
    let openFalse = 0;
    let openMissing = 0;
    (list || []).forEach(function (m) {
      if (!m) return;
      if (m.open === true) openTrue++;
      else if (m.open === false) openFalse++;
      else openMissing++;
    });
    let domNodes = 0;
    if (typeof document !== 'undefined' && treeSel) {
      let tree = document.querySelector(treeSel);
      if (tree) domNodes = tree.querySelectorAll('.node, .eniNode, .orcaNode').length;
      if (tree && !domNodes) domNodes = tree.querySelectorAll('li').length;
    }
    return {
      project: label,
      savedMembers: counts.members,
      savedEdges: counts.edges,
      rootId: counts.rootId,
      visibleByOpenFlags: counts.visible,
      domNodes: domNodes,
      openTrue: openTrue,
      openFalse: openFalse,
      openMissing: openMissing,
      massCollapsed: counts.members > 1 && openFalse === counts.members
    };
  }
  let report = {
    at: new Date().toISOString(),
    ram: pack(
      'ram',
      typeof members !== 'undefined' ? members : [],
      typeof rootId !== 'undefined' ? rootId : '',
      '#tree'
    ),
    orca: pack(
      'orca',
      typeof orcaMembers !== 'undefined' ? orcaMembers : [],
      typeof orcaRootId !== 'undefined' ? orcaRootId : '',
      '#orcaTree'
    ),
    eni: pack(
      'eni',
      typeof eniMembers !== 'undefined' ? eniMembers : [],
      typeof eniRootId !== 'undefined' ? eniRootId : '',
      '#eniTree'
    )
  };
  if (typeof console !== 'undefined' && console.info) {
    console.info('[OUKEI][ORG-DIAG]', report);
  }
  return report;
}

/**
 * READ-ONLY backup download of current org charts (members/parents/open).
 * Does not mutate in-memory or storage data.
 */
function hubOrgBackupOrgChartsDownload() {
  let payload = {
    exportedAt: new Date().toISOString(),
    app: 'OUKEI HUB',
    type: 'org-chart-backup-readonly',
    diagnose: hubOrgDiagnoseCharts(),
    ram: {
      rootId: typeof rootId !== 'undefined' ? rootId : '',
      rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : [],
      members: typeof members !== 'undefined' ? members : []
    },
    orca: {
      rootId: typeof orcaRootId !== 'undefined' ? orcaRootId : '',
      rootAccountIds: typeof orcaRootAccountIds !== 'undefined' ? orcaRootAccountIds : [],
      members: typeof orcaMembers !== 'undefined' ? orcaMembers : []
    },
    eni: {
      rootId: typeof eniRootId !== 'undefined' ? eniRootId : '',
      rootAccountIds: typeof eniRootAccountIds !== 'undefined' ? eniRootAccountIds : [],
      members: typeof eniMembers !== 'undefined' ? eniMembers : []
    }
  };
  let json = JSON.stringify(payload, null, 2);
  if (typeof document !== 'undefined') {
    let a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = 'OUKEI_ORG_BACKUP_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  return payload;
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
    hubOrgRestoreOpenFlags(list, state.ram.openMap, 'ram');
    if (typeof currentData !== 'undefined' && Array.isArray(currentData)) {
      hubOrgRestoreOpenFlags(currentData, state.ram.openMap, 'ram-current');
    }
    hubOrgRepairMassCollapsedOpens(list, 'ram');
    if (typeof currentData !== 'undefined' && Array.isArray(currentData)) {
      hubOrgRepairMassCollapsedOpens(currentData, 'ram-current');
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
    hubOrgRestoreOpenFlags(list, state.orca.openMap, 'orca');
    if (typeof orcaCurrentData !== 'undefined' && Array.isArray(orcaCurrentData)) {
      hubOrgRestoreOpenFlags(orcaCurrentData, state.orca.openMap, 'orca-current');
    }
    hubOrgRepairMassCollapsedOpens(list, 'orca');
    if (typeof orcaCurrentData !== 'undefined' && Array.isArray(orcaCurrentData)) {
      hubOrgRepairMassCollapsedOpens(orcaCurrentData, 'orca-current');
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
    hubOrgRestoreOpenFlags(list, state.eni.openMap, 'eni');
    if (typeof eniCurrentData !== 'undefined' && Array.isArray(eniCurrentData)) {
      hubOrgRestoreOpenFlags(eniCurrentData, state.eni.openMap, 'eni-current');
    }
    hubOrgRepairMassCollapsedOpens(list, 'eni');
    if (typeof eniCurrentData !== 'undefined' && Array.isArray(eniCurrentData)) {
      hubOrgRepairMassCollapsedOpens(eniCurrentData, 'eni-current');
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
  window.hubOrgSnapshotOpenFlags = hubOrgSnapshotOpenFlags;
  window.hubOrgRestoreOpenFlags = hubOrgRestoreOpenFlags;
  window.hubOrgOpenMapIsMassCollapsed = hubOrgOpenMapIsMassCollapsed;
  window.hubOrgRepairMassCollapsedOpens = hubOrgRepairMassCollapsedOpens;
  window.hubOrgDiagnoseCharts = hubOrgDiagnoseCharts;
  window.hubOrgBackupOrgChartsDownload = hubOrgBackupOrgChartsDownload;
  window.hubOrgCountVisibleFromRoot = hubOrgCountVisibleFromRoot;
  window.hubOrgIsOpenFlag = hubOrgIsOpenFlag;
}
