/* OUKEI HUB Account Input Management — shared RAM / ORCA / ENI
 * 実績入力 = アカウント管理、組織図 = 配置のみ
 */

var AIM_DELETE_CONFIRM_MESSAGE =
  '収益履歴・売上履歴・組織図データも削除されます。本当に削除しますか？';

var AIM_ORCA_RESTORE_HINTS = {
  orca_1783005565893: { username: 'kai1', name: 'kai1', investment: 1000 },
  orca_1783005577176: { username: 'kai2', name: 'kai2', investment: 100 }
};

function aimEnsureRamInputAccounts() {
  if (typeof settings === 'undefined') return;
  if (!Array.isArray(settings.ramInputAccounts)) settings.ramInputAccounts = [];
}

function aimMigrateRamInputAccountsFromMembers() {
  if (typeof settings === 'undefined') return;
  aimEnsureRamInputAccounts();
  if (settings.ramInputAccounts.length) return;
  if (typeof members === 'undefined') return;
  let roots = typeof getRootIdsForSummary === 'function'
    ? getRootIdsForSummary()
    : (typeof rootAccountIds !== 'undefined' ? rootAccountIds : []);
  roots.forEach(function (id) {
    let m = members.find(function (x) { return x.id === id; });
    if (!m) return;
    settings.ramInputAccounts.push({
      id: m.id,
      username: String(m.username || m.name || '未入力').replace(/^@/, ''),
      name: m.name || m.username || '未入力',
      investment: Number(m.investment) || 0
    });
  });
}

function aimGetInputAccountList(projectKey) {
  if (projectKey === 'ram') {
    aimMigrateRamInputAccountsFromMembers();
    return settings.ramInputAccounts || [];
  }
  if (projectKey === 'orca') return Array.isArray(settings.orcaInputAccounts) ? settings.orcaInputAccounts : [];
  if (projectKey === 'eni') return Array.isArray(settings.eniInputAccounts) ? settings.eniInputAccounts : [];
  return [];
}

function aimFindInputAccount(projectKey, accountId) {
  return aimGetInputAccountList(projectKey).find(function (a) { return a && a.id === accountId; }) || null;
}

function aimUpdateInputAccountName(projectKey, accountId, username) {
  username = String(username || '').trim().replace(/^@/, '');
  if (!username || !accountId) return false;
  let acc = aimFindInputAccount(projectKey, accountId);
  if (!acc) return false;
  acc.username = username;
  acc.name = username;
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    let m = members.find(function (x) { return x.id === accountId; });
    if (m) { m.username = username; m.name = username; }
  }
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    let om = orcaMembers.find(function (x) { return x.id === accountId; });
    if (om) { om.username = username; om.name = username; }
  }
  return true;
}

function aimUpdateInputAccountInvestment(projectKey, accountId, amount) {
  amount = Number(amount) || 0;
  let acc = aimFindInputAccount(projectKey, accountId);
  if (!acc) return false;
  acc.investment = amount;
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    let m = members.find(function (x) { return x.id === accountId; });
    if (m) m.investment = amount;
  }
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    let om = orcaMembers.find(function (x) { return x.id === accountId; });
    if (om) om.investment = amount;
  }
  if (typeof pdSetManualOperatingAmount === 'function' && projectKey === 'ram') {
    let dateKey = typeof todayKey === 'function' ? todayKey() : '';
    if (dateKey) pdSetManualOperatingAmount(accountId, 'ram', dateKey, amount, { skipPersist: true });
  }
  // ORCA/ENI も RAM と同様、現在運用額は initial 追加ではなく manual（基準額上書き）で保存する。
  // initial を日付違いで積み上げると運用額が二重計上される。
  if (typeof pdSetManualOperatingAmount === 'function' && (projectKey === 'orca' || projectKey === 'eni')) {
    let dateKey = typeof todayKey === 'function' ? todayKey() : '';
    if (dateKey) pdSetManualOperatingAmount(accountId, projectKey, dateKey, amount, { skipPersist: true });
  }
  return true;
}

function aimGetOrgMemberIds(projectKey) {
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    return members.map(function (m) { return m.id; });
  }
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    return orcaMembers.map(function (m) { return m.id; });
  }
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    return eniMembers.map(function (m) { return m.id; });
  }
  return [];
}

function aimGetAccountsForOrgPlacement(projectKey) {
  let registered = aimGetInputAccountList(projectKey);
  let placed = {};
  aimGetOrgMemberIds(projectKey).forEach(function (id) { placed[id] = true; });
  return registered.filter(function (acc) { return acc && acc.id && !placed[acc.id]; });
}

function aimGetOrgMembersList(projectKey) {
  if (projectKey === 'ram' && typeof members !== 'undefined') return members;
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') return orcaMembers;
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') return eniMembers;
  return [];
}

function aimGetOrgRootAccountIds(projectKey) {
  if (projectKey === 'ram' && typeof rootAccountIds !== 'undefined') return rootAccountIds || [];
  if (projectKey === 'orca' && typeof orcaRootAccountIds !== 'undefined') return orcaRootAccountIds || [];
  if (projectKey === 'eni' && typeof eniRootAccountIds !== 'undefined') return eniRootAccountIds || [];
  return [];
}

function aimResolveOrgRootIds(projectKey, memberList) {
  memberList = memberList || aimGetOrgMembersList(projectKey);
  let fromRoots = aimGetOrgRootAccountIds(projectKey).filter(function (id) {
    return memberList.some(function (m) { return m && m.id === id; });
  });
  if (fromRoots.length) return fromRoots;
  return memberList.filter(function (m) { return m && !m.parent; }).map(function (m) { return m.id; });
}

function aimSortOrgMemberSiblings(list) {
  if (!list || !list.length) return [];
  return list.slice().sort(function (a, b) {
    let ao = Number(a && a.sortOrder);
    let bo = Number(b && b.sortOrder);
    if (!isNaN(ao) && !isNaN(bo) && ao !== bo) return ao - bo;
    return String(a && a.id || '').localeCompare(String(b && b.id || ''));
  });
}

function aimGetSortedOrgChildren(projectKey, parentId) {
  let parentKey = parentId || null;
  return aimSortOrgMemberSiblings(aimGetOrgMembersList(projectKey).filter(function (m) {
    return m && (m.parent || null) === parentKey;
  }));
}

function aimGetSeriesRootIdFromMember(memberList, accountId) {
  let cur = accountId;
  let guard = 0;
  while (cur && guard < 64) {
    let m = memberList.find(function (x) { return x && x.id === cur; });
    if (!m) break;
    if (!m.parent) return m.id;
    cur = m.parent;
    guard++;
  }
  return accountId;
}

function aimGetNextSeriesIndex(projectKey) {
  let memberList = aimGetOrgMembersList(projectKey);
  let max = -1;
  memberList.forEach(function (m) {
    if (m && m.seriesIndex != null && !isNaN(Number(m.seriesIndex))) {
      max = Math.max(max, Number(m.seriesIndex));
    }
  });
  return max + 1;
}

function aimApplyOrgMemberSeriesMeta(projectKey, member, parentId) {
  if (!member) return;
  parentId = parentId || null;
  if (!parentId) {
    if (member.seriesIndex == null || member.seriesIndex === undefined) {
      member.seriesIndex = aimGetNextSeriesIndex(projectKey);
    }
    member.seriesRootId = member.id;
    return;
  }
  let memberList = aimGetOrgMembersList(projectKey);
  let parent = memberList.find(function (m) { return m && m.id === parentId; });
  let seriesRootId = aimGetSeriesRootIdFromMember(memberList, parentId);
  let rootMember = memberList.find(function (m) { return m && m.id === seriesRootId; });
  let inherited = parent && parent.seriesIndex != null ? Number(parent.seriesIndex)
    : (rootMember && rootMember.seriesIndex != null ? Number(rootMember.seriesIndex) : aimGetNextSeriesIndex(projectKey));
  member.seriesIndex = inherited;
  member.seriesRootId = seriesRootId;
}

function aimPropagateSeriesToDescendants(projectKey, rootId, seriesIndex, seriesRootId) {
  let memberList = aimGetOrgMembersList(projectKey);
  memberList.forEach(function (m) {
    if (!m || !m.parent) return;
    let cur = m.parent;
    let guard = 0;
    while (cur && guard < 64) {
      if (cur === rootId) {
        m.seriesIndex = seriesIndex;
        m.seriesRootId = seriesRootId;
        break;
      }
      let p = memberList.find(function (x) { return x && x.id === cur; });
      if (!p || !p.parent) break;
      cur = p.parent;
      guard++;
    }
  });
}

function aimEnsureMemberSortOrderAtEnd(projectKey, member) {
  if (!member) return;
  let siblings = aimGetSortedOrgChildren(projectKey, member.parent || null)
    .filter(function (m) { return m.id !== member.id; });
  let maxOrder = siblings.reduce(function (n, m) {
    return Math.max(n, Number(m.sortOrder) || 0);
  }, -1);
  member.sortOrder = maxOrder + 1;
}

function aimMigrateOrgMemberMeta(projectKey) {
  let memberList = aimGetOrgMembersList(projectKey);
  if (!memberList.length) return;
  let roots = aimResolveOrgRootIds(projectKey, memberList);
  roots.forEach(function (rootId, rootIdx) {
    let root = memberList.find(function (m) { return m && m.id === rootId; });
    if (!root) return;
    if (root.seriesIndex == null || root.seriesIndex === undefined) root.seriesIndex = rootIdx;
    if (!root.seriesRootId) root.seriesRootId = root.id;
    aimPropagateSeriesToDescendants(projectKey, root.id, Number(root.seriesIndex), root.seriesRootId);
  });
  let byParent = {};
  memberList.forEach(function (m, idx) {
    if (!m) return;
    let pk = m.parent || '__root__';
    if (!byParent[pk]) byParent[pk] = [];
    byParent[pk].push({ m: m, idx: idx });
  });
  Object.keys(byParent).forEach(function (pk) {
    byParent[pk].sort(function (a, b) { return a.idx - b.idx; });
    byParent[pk].forEach(function (item, i) {
      if (item.m.sortOrder == null || item.m.sortOrder === undefined) item.m.sortOrder = i;
    });
  });
}

function aimGetOrgMemberSeriesIndex(projectKey, accountId) {
  let m = aimGetOrgMembersList(projectKey).find(function (x) { return x && x.id === accountId; });
  if (!m || m.seriesIndex == null || m.seriesIndex === undefined) return null;
  return Number(m.seriesIndex);
}

function aimGetOrgMemberSeriesRootId(projectKey, accountId) {
  let m = aimGetOrgMembersList(projectKey).find(function (x) { return x && x.id === accountId; });
  if (m && m.seriesRootId) return m.seriesRootId;
  return aimGetSeriesRootIdFromMember(aimGetOrgMembersList(projectKey), accountId);
}

function aimGetOrgMemberDisplayName(projectKey, member) {
  if (!member) return '未入力';
  if (projectKey === 'orca' && typeof orcaDisplayName === 'function') return orcaDisplayName(member);
  if (projectKey === 'ram' && typeof displayName === 'function') return displayName(member);
  return member.name || member.username || member.id || '未入力';
}

function aimBuildOrgAccountTree(projectKey) {
  let memberList = aimGetOrgMembersList(projectKey);
  if (!memberList.length) return [];
  let roots = aimResolveOrgRootIds(projectKey, memberList);
  let out = [];
  let seen = {};
  function walk(id, depth) {
    if (!id || seen[id]) return;
    seen[id] = true;
    let m = memberList.find(function (x) { return x && x.id === id; });
    if (!m) return;
    out.push({
      id: id,
      name: aimGetOrgMemberDisplayName(projectKey, m),
      parentId: m.parent || null,
      depth: depth,
      seriesIndex: m.seriesIndex,
      sortOrder: m.sortOrder
    });
    aimGetSortedOrgChildren(projectKey, id).forEach(function (child) {
      walk(child.id, depth + 1);
    });
  }
  roots.forEach(function (id) { walk(id, 0); });
  return out;
}

function aimSwapSiblingSortOrder(projectKey, accountId, dir) {
  let memberList = aimGetOrgMembersList(projectKey);
  let m = memberList.find(function (x) { return x && x.id === accountId; });
  if (!m) return false;
  let sib = aimGetSortedOrgChildren(projectKey, m.parent || null);
  let i = sib.findIndex(function (x) { return x.id === accountId; });
  let j = i + Number(dir || 0);
  if (i < 0 || j < 0 || j >= sib.length) return false;
  let a = sib[i];
  let b = sib[j];
  let ao = Number(a.sortOrder) || 0;
  let bo = Number(b.sortOrder) || 0;
  a.sortOrder = bo;
  b.sortOrder = ao;
  return true;
}

function aimGetOrgParentOptions(projectKey) {
  return aimGetOrgMembersList(projectKey).map(function (m) {
    return {
      id: m.id,
      label: aimGetOrgMemberDisplayName(projectKey, m)
    };
  });
}

function aimBuildRamMemberFromInput(acc, parentId) {
  return {
    id: acc.id,
    parent: parentId || null,
    name: acc.name || acc.username || '未入力',
    username: acc.username || acc.name || '',
    rank: Number(acc.rank) || 0,
    investment: Number(acc.investment) || 0,
    manualVolume: Number(acc.manualVolume) || 0,
    open: true,
    bvMode: 'MANUAL',
    bvPrompted: false
  };
}

function aimBuildOrcaMemberFromInput(acc, parentId) {
  if (typeof hubCreateOrcaMemberFromInputAccount === 'function') {
    let m = hubCreateOrcaMemberFromInputAccount(acc);
    m.parent = parentId || null;
    return m;
  }
  return {
    id: acc.id,
    parent: parentId || null,
    name: acc.name || acc.username || '未入力',
    username: acc.username || acc.name || '',
    rank: Number(acc.rank) || 0,
    investment: Number(acc.investment) || 0,
    aiAgent: acc.aiAgent || '不明',
    personalSales: Number(acc.personalSales) || 0,
    groupSales: Number(acc.groupSales) || 0,
    open: true,
    bvMode: 'MANUAL',
    bvPrompted: false
  };
}

function aimBuildEniMemberFromInput(acc, parentId) {
  return {
    id: acc.id,
    parent: parentId || null,
    name: acc.name || acc.username || '未入力',
    username: acc.username || acc.name || '',
    rank: Number(acc.rank) || 0,
    investment: Number(acc.investment) || 0,
    open: true
  };
}

function aimClearRemovedOrgAccountId(projectKey, accountId) {
  if (!accountId || typeof settings === 'undefined') return;
  if (projectKey === 'orca') {
    if (typeof hubClearRemovedOrcaOrgAccountIds === 'function') {
      hubClearRemovedOrcaOrgAccountIds(settings, [accountId]);
    } else if (Array.isArray(settings.removedOrcaOrgAccountIds)) {
      settings.removedOrcaOrgAccountIds = settings.removedOrcaOrgAccountIds.filter(function (id) {
        return id !== accountId;
      });
      if (settings.removedOrcaOrgAccountIdTimes && settings.removedOrcaOrgAccountIdTimes[accountId]) {
        delete settings.removedOrcaOrgAccountIdTimes[accountId];
      }
    }
  }
  if (projectKey === 'ram' && Array.isArray(settings.removedRamOrgAccountIds)) {
    settings.removedRamOrgAccountIds = settings.removedRamOrgAccountIds.filter(function (id) {
      return id !== accountId;
    });
  }
  if (projectKey === 'eni' && Array.isArray(settings.removedEniOrgAccountIds)) {
    settings.removedEniOrgAccountIds = settings.removedEniOrgAccountIds.filter(function (id) {
      return id !== accountId;
    });
  }
}

function aimPlaceInputAccountInOrg(projectKey, accountId, parentId) {
  let acc = aimFindInputAccount(projectKey, accountId);
  if (!acc) return false;
  aimClearRemovedOrgAccountId(projectKey, accountId);
  parentId = parentId || null;

  if (projectKey === 'ram' && typeof members !== 'undefined') {
    let existing = members.find(function (m) { return m.id === accountId; });
    if (existing) {
      existing.parent = parentId;
      aimApplyOrgMemberSeriesMeta(projectKey, existing, parentId);
      aimEnsureMemberSortOrderAtEnd(projectKey, existing);
    } else {
      let member = aimBuildRamMemberFromInput(acc, parentId);
      aimApplyOrgMemberSeriesMeta(projectKey, member, parentId);
      aimEnsureMemberSortOrderAtEnd(projectKey, member);
      members.push(member);
    }
    if (!parentId && typeof rootAccountIds !== 'undefined' && rootAccountIds.indexOf(accountId) < 0) {
      rootAccountIds.push(accountId);
    }
    if (!parentId && typeof rootId !== 'undefined') { rootId = accountId; focusId = accountId; }
    return true;
  }
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    let existing = orcaMembers.find(function (m) { return m.id === accountId; });
    if (existing) {
      existing.parent = parentId;
      aimApplyOrgMemberSeriesMeta(projectKey, existing, parentId);
      aimEnsureMemberSortOrderAtEnd(projectKey, existing);
    } else {
      let member = aimBuildOrcaMemberFromInput(acc, parentId);
      aimApplyOrgMemberSeriesMeta(projectKey, member, parentId);
      aimEnsureMemberSortOrderAtEnd(projectKey, member);
      orcaMembers.push(member);
    }
    if (!parentId && typeof orcaRootAccountIds !== 'undefined' && orcaRootAccountIds.indexOf(accountId) < 0) {
      orcaRootAccountIds.push(accountId);
    }
    if (!parentId && typeof orcaRootId !== 'undefined') { orcaRootId = accountId; orcaFocusId = accountId; }
    return true;
  }
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    let existing = eniMembers.find(function (m) { return m.id === accountId; });
    if (existing) {
      existing.parent = parentId;
      aimApplyOrgMemberSeriesMeta(projectKey, existing, parentId);
      aimEnsureMemberSortOrderAtEnd(projectKey, existing);
    } else {
      let member = aimBuildEniMemberFromInput(acc, parentId);
      aimApplyOrgMemberSeriesMeta(projectKey, member, parentId);
      aimEnsureMemberSortOrderAtEnd(projectKey, member);
      eniMembers.push(member);
    }
    if (!parentId && typeof eniRootAccountIds !== 'undefined' && eniRootAccountIds.indexOf(accountId) < 0) {
      eniRootAccountIds.push(accountId);
    }
    if (!parentId && typeof eniRootId !== 'undefined') { eniRootId = accountId; }
    return true;
  }
  return false;
}

function aimRecordRemovedOrgAccountIds(projectKey, ids) {
  if (!ids || !ids.length || typeof settings === 'undefined') return;
  if (projectKey === 'orca') {
    if (typeof hubRecordRemovedOrcaOrgAccountIds === 'function') {
      hubRecordRemovedOrcaOrgAccountIds(settings, ids);
      return;
    }
    if (!Array.isArray(settings.removedOrcaOrgAccountIds)) settings.removedOrcaOrgAccountIds = [];
    ids.forEach(function (id) {
      if (settings.removedOrcaOrgAccountIds.indexOf(id) < 0) settings.removedOrcaOrgAccountIds.push(id);
    });
    return;
  }
  if (projectKey === 'ram') {
    if (!Array.isArray(settings.removedRamOrgAccountIds)) settings.removedRamOrgAccountIds = [];
    ids.forEach(function (id) {
      if (settings.removedRamOrgAccountIds.indexOf(id) < 0) settings.removedRamOrgAccountIds.push(id);
    });
    return;
  }
  if (projectKey === 'eni') {
    if (!Array.isArray(settings.removedEniOrgAccountIds)) settings.removedEniOrgAccountIds = [];
    ids.forEach(function (id) {
      if (settings.removedEniOrgAccountIds.indexOf(id) < 0) settings.removedEniOrgAccountIds.push(id);
    });
  }
}

function aimRemoveOrgMembersOnly(projectKey, ids) {
  if (!ids || !ids.length) return;
  let rm = {};
  ids.forEach(function (id) { rm[id] = true; });
  aimRecordRemovedOrgAccountIds(projectKey, ids);
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    members = members.filter(function (m) { return !rm[m.id]; });
    if (typeof rootAccountIds !== 'undefined') {
      rootAccountIds = rootAccountIds.filter(function (id) { return !rm[id]; });
    }
    if (typeof rootId !== 'undefined' && rm[rootId]) {
      rootId = rootAccountIds[0] || '';
      focusId = rootId;
    }
    return;
  }
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    orcaMembers = orcaMembers.filter(function (m) { return !rm[m.id]; });
    if (typeof orcaRootAccountIds !== 'undefined') {
      orcaRootAccountIds = orcaRootAccountIds.filter(function (id) { return !rm[id]; });
    }
    if (typeof orcaRootId !== 'undefined' && rm[orcaRootId]) {
      orcaRootId = orcaRootAccountIds[0] || '';
      orcaFocusId = orcaRootId;
    }
    return;
  }
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    eniMembers = eniMembers.filter(function (m) { return !rm[m.id]; });
    if (typeof eniRootAccountIds !== 'undefined') {
      eniRootAccountIds = eniRootAccountIds.filter(function (id) { return !rm[id]; });
    }
    if (typeof eniRootId !== 'undefined' && rm[eniRootId]) {
      eniRootId = eniRootAccountIds[0] || '';
    }
  }
}

function aimRemoveInputAccountRecord(projectKey, accountId) {
  if (!accountId) return;
  if (projectKey === 'ram') {
    aimEnsureRamInputAccounts();
    settings.ramInputAccounts = settings.ramInputAccounts.filter(function (a) { return a.id !== accountId; });
    if (typeof rootAccountIds !== 'undefined') {
      rootAccountIds = rootAccountIds.filter(function (id) { return id !== accountId; });
    }
    return;
  }
  if (projectKey === 'orca' && Array.isArray(settings.orcaInputAccounts)) {
    settings.orcaInputAccounts = settings.orcaInputAccounts.filter(function (a) { return a.id !== accountId; });
    return;
  }
  if (projectKey === 'eni' && Array.isArray(settings.eniInputAccounts)) {
    settings.eniInputAccounts = settings.eniInputAccounts.filter(function (a) { return a.id !== accountId; });
  }
}

function aimDeleteInputAccountFully(projectKey, accountId) {
  if (!projectKey || !accountId) return 0;
  let subtree = [accountId];
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    let changed = true;
    while (changed) {
      changed = false;
      members.forEach(function (m) {
        if (m.parent && subtree.indexOf(m.parent) >= 0 && subtree.indexOf(m.id) < 0) {
          subtree.push(m.id);
          changed = true;
        }
      });
    }
    aimRemoveOrgMembersOnly(projectKey, subtree);
  } else if (projectKey === 'orca' && typeof orcaSubtreeIds === 'function') {
    subtree = orcaSubtreeIds(accountId);
    aimRemoveOrgMembersOnly(projectKey, subtree);
  } else if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    aimRemoveOrgMembersOnly(projectKey, [accountId]);
  } else {
    aimRecordRemovedOrgAccountIds(projectKey, [accountId]);
  }
  if (projectKey === 'orca' && typeof hubMarkExplicitOrcaDelete === 'function') {
    hubMarkExplicitOrcaDelete(subtree);
  }
  let removed = 0;
  subtree.forEach(function (id) {
    if (typeof pdDeleteAccountPerformanceData === 'function') {
      removed += pdDeleteAccountPerformanceData(projectKey, id, {
        skipPersist: true,
        skipNotify: true
      });
    } else if (typeof pdPurgeAccountPortfolioAndDisplay === 'function') {
      removed += pdPurgeAccountPortfolioAndDisplay(projectKey, id);
    }
    aimRemoveInputAccountRecord(projectKey, id);
  });
  // Keep removed*OrgAccountIds tombstones so cloud merge cannot resurrect accounts.
  if (typeof markActivity === 'function') markActivity();
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  if (typeof persistHubSettings === 'function') persistHubSettings();
  else if (typeof pdPersist === 'function') pdPersist();
  if (typeof pdNotifyPerformanceChanged === 'function') {
    pdNotifyPerformanceChanged({ type: 'delete', projectKey: projectKey, accountId: accountId });
  }
  return removed;
}

function aimRenderOrgPlacementModal(projectKey, contextParentId, onPlaced) {
  let available = aimGetAccountsForOrgPlacement(projectKey);
  if (!available.length) {
    alert('配置できる登録済みアカウントがありません。先に実績入力画面からアカウントを登録してください。');
    return;
  }
  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };
  let opts = available.map(function (acc) {
    let label = (acc.username || acc.name || acc.id);
    return '<option value="' + acc.id + '">' + esc(label) + '</option>';
  }).join('');
  let parentOptions = aimGetOrgParentOptions(projectKey);
  let parentOpts = parentOptions.map(function (p) {
    let selected = contextParentId && contextParentId === p.id ? ' selected' : '';
    return '<option value="' + p.id + '"' + selected + '>' + esc(p.label) + '</option>';
  }).join('');
  let contextParent = contextParentId
    ? aimGetOrgMembersList(projectKey).find(function (m) { return m && m.id === contextParentId; })
    : null;
  let contextParentLabel = contextParent
    ? aimGetOrgMemberDisplayName(projectKey, contextParent)
    : '';
  let canPlaceUnderParent = !!parentOptions.length || !!contextParentId;
  let defaultMode = contextParentId ? 'child' : (canPlaceUnderParent ? 'root' : 'root');
  let childHint = contextParentId
    ? ('親：' + esc(contextParentLabel))
    : '親アカウントを選択してください';
  if (typeof modalTitle !== 'undefined') {
    modalTitle.textContent = '登録済みアカウントを配置';
  }
  if (typeof modalContent !== 'undefined') {
    modalContent.innerHTML =
      '<p class="help">実績入力で登録済みのアカウントを組織図に配置します。配置方法を選んでください。</p>' +
      '<div class="lineBox aimPlaceModeBox">' +
      '<label class="aimPlaceModeLabel"><input type="radio" name="aimPlaceMode" value="child"' +
      (defaultMode === 'child' ? ' checked' : '') + (canPlaceUnderParent ? '' : ' disabled') + '> 既存アカウント配下へ追加</label>' +
      '<div id="aimPlaceChildWrap" class="aimPlaceChildWrap">' +
      '<p class="help aimPlaceChildHint" id="aimPlaceChildHint">' + childHint + '</p>' +
      (contextParentId ? '<input type="hidden" id="aimPlaceParentSelect" value="' + esc(contextParentId) + '">' :
        '<select id="aimPlaceParentSelect">' + parentOpts + '</select>') +
      '</div>' +
      '<label class="aimPlaceModeLabel"><input type="radio" name="aimPlaceMode" value="root"' +
      (defaultMode === 'root' ? ' checked' : '') + '> 新しい親系列として追加</label>' +
      '<p class="help">独立した系列の起点として配置します。</p>' +
      '</div>' +
      '<label>アカウント</label><select id="aimPlaceAccountSelect">' + opts + '</select>' +
      '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
      '<button class="btn2" onclick="closeModal()">キャンセル</button>' +
      '<button id="aimPlaceAccountConfirmBtn">配置</button></div>';

    function syncPlaceModeUi() {
      let modeEl = document.querySelector('input[name="aimPlaceMode"]:checked');
      let mode = modeEl ? modeEl.value : 'root';
      let wrap = document.getElementById('aimPlaceChildWrap');
      if (wrap) wrap.style.display = mode === 'child' ? '' : 'none';
    }
    document.querySelectorAll('input[name="aimPlaceMode"]').forEach(function (el) {
      el.addEventListener('change', syncPlaceModeUi);
    });
    syncPlaceModeUi();

    let btn = document.getElementById('aimPlaceAccountConfirmBtn');
    if (btn) {
      btn.onclick = function () {
        let sel = document.getElementById('aimPlaceAccountSelect');
        let id = sel ? sel.value : '';
        if (!id) return;
        let modeEl = document.querySelector('input[name="aimPlaceMode"]:checked');
        let mode = modeEl ? modeEl.value : 'root';
        let parentId = null;
        if (mode === 'child') {
          let parentSel = document.getElementById('aimPlaceParentSelect');
          parentId = parentSel ? (parentSel.value || null) : (contextParentId || null);
          if (!parentId) {
            alert('親アカウントを選択してください。');
            return;
          }
        }
        aimPlaceInputAccountInOrg(projectKey, id, parentId);
        if (typeof persistHubSettings === 'function') persistHubSettings();
        if (typeof markActivity === 'function') markActivity();
        if (typeof closeModal === 'function') closeModal();
        if (projectKey === 'ram' && typeof render === 'function') render();
        if (projectKey === 'orca' && typeof orcaRender === 'function') orcaRender();
        if (projectKey === 'eni' && typeof eniRender === 'function') eniRender();
        if (typeof onPlaced === 'function') onPlaced();
      };
    }
  }
  if (typeof modalBg !== 'undefined') modalBg.style.display = 'flex';
}

function aimRenderInputAccountActions(projectKey, accountId, accountName, reopenFn) {
  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };
  let reopen = reopenFn || 'location.reload()';
  return '<div class="ramInputAccountActions">' +
    '<button type="button" class="btn2 ramInputDisplayBtn" onclick="aimPromptRenameInputAccount(\'' + projectKey + '\',\'' + accountId + '\',\'' + esc(accountName).replace(/'/g, "\\'") + '\',' + reopen + ')">名前変更</button>' +
    '<button type="button" class="btnDanger ramInputDisplayBtn" onclick="aimConfirmDeleteInputAccount(\'' + projectKey + '\',\'' + accountId + '\',\'' + esc(accountName).replace(/'/g, "\\'") + '\',' + reopen + ')">アカウント削除</button>' +
    '</div>';
}

function aimPromptRenameInputAccount(projectKey, accountId, currentName, reopenFn) {
  let next = prompt('アカウント名を入力', currentName || '');
  if (next == null) return;
  next = String(next).trim().replace(/^@/, '');
  if (!next) {
    alert('アカウント名を入力してください。');
    return;
  }
  aimUpdateInputAccountName(projectKey, accountId, next);
  if (typeof persistHubSettings === 'function') persistHubSettings();
  if (typeof markActivity === 'function') markActivity();
  if (typeof showToast === 'function') showToast('✅ アカウント名を更新しました');
  aimInvokeReopen(reopenFn);
}

function aimInvokeReopen(reopenFn) {
  if (typeof reopenFn === 'function') reopenFn();
  else if (typeof reopenFn === 'string' && typeof window[reopenFn] === 'function') window[reopenFn]();
}

function aimConfirmDeleteInputAccount(projectKey, accountId, accountName, reopenFn) {
  if (!confirm(AIM_DELETE_CONFIRM_MESSAGE)) return;
  aimDeleteInputAccountFully(projectKey, accountId);
  if (typeof showToast === 'function') showToast('✅ アカウントを削除しました');
  aimInvokeReopen(reopenFn);
}

function aimPersistInputAccountMetaFromForm(projectKey) {
  let accounts = [];
  if (projectKey === 'ram' && typeof getRamInputAccounts === 'function') accounts = getRamInputAccounts();
  else if (projectKey === 'orca' && typeof getOrcaInputAccounts === 'function') accounts = getOrcaInputAccounts();
  else if (projectKey === 'eni' && typeof getEniInputAccounts === 'function') accounts = getEniInputAccounts();
  accounts.forEach(function (acc) {
    let nameEl = document.getElementById(
      (projectKey === 'ram' ? 'ramUsername_' : projectKey === 'orca' ? 'orcaUsername_' : 'eniUsername_') + acc.id
    );
    if (nameEl && nameEl.value !== '') aimUpdateInputAccountName(projectKey, acc.id, nameEl.value);
    let opEl = document.getElementById(
      (projectKey === 'ram' ? 'ramOp_' : projectKey === 'orca' ? 'orcaOp_' : 'eniOp_') + acc.id
    );
    if (opEl && opEl.value !== '' && !isNaN(Number(opEl.value))) {
      aimUpdateInputAccountInvestment(projectKey, acc.id, Number(opEl.value));
    }
  });
}

function hubRepairOrcaInputAccounts(settings) {
  if (!settings) return false;
  if (!Array.isArray(settings.orcaInputAccounts)) settings.orcaInputAccounts = [];
  let existing = {};
  settings.orcaInputAccounts.forEach(function (a) {
    if (a && a.id) existing[a.id] = true;
  });
  let removed = {};
  (Array.isArray(settings.removedOrcaOrgAccountIds) ? settings.removedOrcaOrgAccountIds : []).forEach(function (id) {
    if (id) removed[id] = true;
  });
  let candidateIds = {};
  if (settings.revenueLog) {
    Object.keys(settings.revenueLog).forEach(function (dk) {
      let entry = settings.revenueLog[dk];
      if (!entry || !entry.orcaAccounts) return;
      Object.keys(entry.orcaAccounts).forEach(function (id) { candidateIds[id] = true; });
    });
  }
  let repaired = false;
  Object.keys(candidateIds).forEach(function (id) {
    if (existing[id] || removed[id]) return;
    let hint = AIM_ORCA_RESTORE_HINTS[id] || {};
    let inv = Number(hint.investment) || 0;
    if (!inv && settings.investmentHistory && settings.investmentHistory[id]) {
      let recs = settings.investmentHistory[id].records || [];
      inv = recs.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    }
    settings.orcaInputAccounts.push({
      id: id,
      username: hint.username || id,
      name: hint.name || hint.username || id,
      investment: inv
    });
    repaired = true;
  });
  return repaired;
}

function aimInitAccountInputManagement() {
  if (typeof settings === 'undefined') return;
  aimMigrateRamInputAccountsFromMembers();
  if (typeof hubRepairOrcaInputAccounts === 'function') hubRepairOrcaInputAccounts(settings);
  ['ram', 'orca', 'eni'].forEach(function (pk) { aimMigrateOrgMemberMeta(pk); });
}

if (typeof window !== 'undefined') {
  window.AIM_DELETE_CONFIRM_MESSAGE = AIM_DELETE_CONFIRM_MESSAGE;
  window.aimInitAccountInputManagement = aimInitAccountInputManagement;
  window.aimGetInputAccountList = aimGetInputAccountList;
  window.aimUpdateInputAccountName = aimUpdateInputAccountName;
  window.aimUpdateInputAccountInvestment = aimUpdateInputAccountInvestment;
  window.aimGetAccountsForOrgPlacement = aimGetAccountsForOrgPlacement;
  window.aimPlaceInputAccountInOrg = aimPlaceInputAccountInOrg;
  window.aimRemoveOrgMembersOnly = aimRemoveOrgMembersOnly;
  window.aimDeleteInputAccountFully = aimDeleteInputAccountFully;
  window.aimRenderOrgPlacementModal = aimRenderOrgPlacementModal;
  window.aimSortOrgMemberSiblings = aimSortOrgMemberSiblings;
  window.aimGetSortedOrgChildren = aimGetSortedOrgChildren;
  window.aimBuildOrgAccountTree = aimBuildOrgAccountTree;
  window.aimSwapSiblingSortOrder = aimSwapSiblingSortOrder;
  window.aimGetOrgMemberSeriesIndex = aimGetOrgMemberSeriesIndex;
  window.aimGetOrgMemberSeriesRootId = aimGetOrgMemberSeriesRootId;
  window.aimMigrateOrgMemberMeta = aimMigrateOrgMemberMeta;
  window.aimRenderInputAccountActions = aimRenderInputAccountActions;
  window.aimPromptRenameInputAccount = aimPromptRenameInputAccount;
  window.aimConfirmDeleteInputAccount = aimConfirmDeleteInputAccount;
  window.aimPersistInputAccountMetaFromForm = aimPersistInputAccountMetaFromForm;
  window.hubRepairOrcaInputAccounts = hubRepairOrcaInputAccounts;
  aimInitAccountInputManagement();
}
