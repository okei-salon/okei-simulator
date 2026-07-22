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
  // 組織図専用の新規追加を行った後は、組織図メンバーを実績入力へ自動移行しない
  if (settings.ramOrgOnlyCreateUsed) return;
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
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    let em = eniMembers.find(function (x) { return x.id === accountId; });
    if (em) em.investment = amount;
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
  if (projectKey === 'eni' && typeof eniDisplayName === 'function') return eniDisplayName(member);
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
    name: acc.name || '',
    username: acc.username || '',
    walletAddress: acc.walletAddress || acc.username || '',
    investment: Number(acc.investment) || 0,
    stakingReward: Number(acc.stakingReward) || 0,
    teamReward: Number(acc.teamReward) || 0,
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
  if (!acc) {
    return { ok: false, error: '追加先アカウントが見つかりません' };
  }
  aimClearRemovedOrgAccountId(projectKey, accountId);
  parentId = parentId || null;
  if (parentId && !aimFindOrgMember(projectKey, parentId)) {
    return { ok: false, error: '親ノードが見つかりません' };
  }

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
    else if (parentId && typeof focusId !== 'undefined') focusId = accountId;
    return { ok: true, id: accountId };
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
    else if (parentId && typeof orcaFocusId !== 'undefined') orcaFocusId = accountId;
    return { ok: true, id: accountId };
  }
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    let existing = eniMembers.find(function (m) { return m.id === accountId; });
    if (existing) {
      existing.parent = parentId;
      if (acc.name != null) existing.name = acc.name || existing.name || '';
      if (acc.investment != null) existing.investment = Number(acc.investment) || 0;
      if (!existing.walletAddress) {
        existing.walletAddress = acc.walletAddress || acc.username || existing.username || '';
      }
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
    if (typeof eniFocusId !== 'undefined') eniFocusId = accountId;
    return { ok: true, id: accountId };
  }
  return { ok: false, error: '最新データの取得に失敗しました' };
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
      if (typeof eniFocusId !== 'undefined') eniFocusId = eniRootId;
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

var aimCloseModalHooked = false;

function aimEnsureCloseModalHook() {
  if (aimCloseModalHooked) return;
  if (typeof window === 'undefined' || typeof window.closeModal !== 'function') return;
  var orig = window.closeModal;
  window.closeModal = function () {
    if (typeof modalBg !== 'undefined' && modalBg) {
      modalBg.classList.remove('aimOrgAddOpen');
      modalBg.removeAttribute('data-aim-project');
    }
    return orig.apply(this, arguments);
  };
  aimCloseModalHooked = true;
}

function aimEscapeHtml(text) {
  if (typeof escapeHtml === 'function') return escapeHtml(text);
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

var aimOrgAddInFlight = false;

function aimOrgAddDebugEnabled() {
  try {
    if (typeof location !== 'undefined' && /(?:^|[?&])aimDebug=1(?:&|$)/.test(location.search || '')) {
      return true;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('oukei_aim_org_add_debug') === '1') {
      return true;
    }
  } catch (e) { /* ignore */ }
  return !!(typeof location !== 'undefined' &&
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'));
}

function aimOrgAddLog(payload) {
  if (!aimOrgAddDebugEnabled()) return;
  try {
    console.log('[aimOrgAdd]', payload);
  } catch (e) { /* ignore */ }
}

function aimGetDisplayedAccountId(projectKey) {
  if (projectKey === 'ram' && typeof rootId !== 'undefined') return rootId || '';
  if (projectKey === 'orca' && typeof orcaRootId !== 'undefined') return orcaRootId || '';
  if (projectKey === 'eni' && typeof eniRootId !== 'undefined') return eniRootId || '';
  return '';
}

function aimFindOrgMember(projectKey, id) {
  if (!id) return null;
  return aimGetOrgMembersList(projectKey).find(function (m) { return m && m.id === id; }) || null;
}

function aimWouldCreateParentCycle(projectKey, parentId, newId) {
  if (!parentId || !newId) return false;
  if (parentId === newId) return true;
  var guard = 0;
  var cur = parentId;
  while (cur && guard < 500) {
    if (cur === newId) return true;
    var m = aimFindOrgMember(projectKey, cur);
    cur = m && m.parent ? m.parent : null;
    guard += 1;
  }
  return false;
}

/**
 * 追加直前の共通検証。ok=false のとき error にユーザー向け文言。
 */
function aimValidateOrgAddTarget(projectKey, parentId, newId) {
  var list = aimGetOrgMembersList(projectKey);
  if (!projectKey || (projectKey !== 'ram' && projectKey !== 'orca' && projectKey !== 'eni')) {
    return { ok: false, error: '追加先プロジェクトが不正です' };
  }
  if (!list || typeof list.push !== 'function') {
    return { ok: false, error: '最新データの取得に失敗しました' };
  }
  if (newId && list.some(function (m) { return m && m.id === newId; })) {
    return { ok: false, error: '重複IDが検出されました' };
  }
  if (parentId) {
    var parent = list.find(function (m) { return m && m.id === parentId; });
    if (!parent) {
      return { ok: false, error: '親ノードが見つかりません' };
    }
    if (aimWouldCreateParentCycle(projectKey, parentId, newId || parentId)) {
      return { ok: false, error: '親子関係が不正です' };
    }
  }
  return { ok: true, parentId: parentId || null, beforeCount: list.length };
}

function aimPersistAndRerenderOrg(projectKey, opts) {
  opts = opts || {};
  var ok = true;
  try {
    if (typeof markActivity === 'function') markActivity();
    if (typeof persistHubSettings === 'function') persistHubSettings();
    else if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
  } catch (e) {
    ok = false;
    aimOrgAddLog({
      project: projectKey,
      phase: 'persist',
      success: false,
      error: String(e && e.message || e)
    });
    if (typeof showToast === 'function') showToast('⚠️ 保存に失敗しました');
    return false;
  }
  try {
    if (projectKey === 'ram' && typeof render === 'function') render();
    else if (projectKey === 'orca' && typeof orcaRender === 'function') orcaRender();
    else if (projectKey === 'eni' && typeof eniRender === 'function') eniRender();
    else ok = false;
  } catch (e2) {
    ok = false;
    aimOrgAddLog({
      project: projectKey,
      phase: 'rerender',
      success: false,
      error: String(e2 && e2.message || e2)
    });
    if (typeof showToast === 'function') showToast('⚠️ 再描画に失敗しました');
    return false;
  }
  if (opts.newId && !aimFindOrgMember(projectKey, opts.newId)) {
    aimOrgAddLog({
      project: projectKey,
      phase: 'verify',
      success: false,
      newNodeId: opts.newId,
      afterCount: aimGetOrgMembersList(projectKey).length
    });
    if (typeof showToast === 'function') showToast('⚠️ 追加が反映されませんでした');
    return false;
  }
  aimOrgAddLog({
    project: projectKey,
    phase: 'persistRerender',
    success: ok,
    accountId: aimGetDisplayedAccountId(projectKey),
    newNodeId: opts.newId || '',
    parentNodeId: opts.parentId || null,
    afterCount: aimGetOrgMembersList(projectKey).length,
    saveTarget: 'localStorage(+cloud schedule)'
  });
  return ok;
}

/**
 * 組織図専用の新規メンバー作成（実績入力 *InputAccounts には書かない）
 * @returns {{ok:boolean, id?:string, error?:string}}
 */
function aimCreateOrgOnlyMemberResult(projectKey, fields, parentId) {
  fields = fields || {};
  parentId = parentId || null;
  var name = String(fields.name || '').trim();
  var username = String(fields.username || '').trim().replace(/^@/, '');
  var investment = Number(fields.investment) || 0;
  var displayed = aimGetDisplayedAccountId(projectKey);

  // 親は「モーダルを開いた瞬間」ではなく、保存直前の最新リストで再確認
  if (parentId && !aimFindOrgMember(projectKey, parentId)) {
    aimOrgAddLog({
      project: projectKey,
      phase: 'create',
      success: false,
      accountId: displayed,
      parentNodeId: parentId,
      error: 'parent_missing'
    });
    return { ok: false, error: '親ノードが見つかりません' };
  }

  if (projectKey === 'ram' && typeof members !== 'undefined') {
    if (typeof settings !== 'undefined') settings.ramOrgOnlyCreateUsed = true;
    var ramId = 'm' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    var ramCheck = aimValidateOrgAddTarget('ram', parentId, ramId);
    if (!ramCheck.ok) return { ok: false, error: ramCheck.error };
    var ramMember = {
      id: ramId,
      parent: parentId,
      name: name || username || '未入力',
      username: username,
      rank: Number(fields.rank) || 0,
      investment: investment,
      manualVolume: 0,
      open: true,
      bvMode: 'MANUAL',
      bvPrompted: false
    };
    aimClearRemovedOrgAccountId('ram', ramId);
    aimApplyOrgMemberSeriesMeta('ram', ramMember, parentId);
    aimEnsureMemberSortOrderAtEnd('ram', ramMember);
    members.push(ramMember);
    if (!parentId) {
      if (typeof rootAccountIds !== 'undefined' && rootAccountIds.indexOf(ramId) < 0) rootAccountIds.push(ramId);
      if (typeof rootId !== 'undefined') rootId = ramId;
      if (typeof focusId !== 'undefined') focusId = ramId;
    } else {
      var ramParent = members.find(function (m) { return m.id === parentId; });
      if (ramParent) ramParent.open = true;
      if (typeof focusId !== 'undefined') focusId = ramId;
      if (typeof adjustAncestorManualVolumes === 'function') {
        adjustAncestorManualVolumes(parentId, investment);
      }
    }
    aimOrgAddLog({
      project: 'ram',
      phase: 'create',
      success: true,
      accountId: aimGetDisplayedAccountId('ram'),
      parentNodeId: parentId,
      newNodeId: ramId,
      beforeCount: ramCheck.beforeCount,
      afterCount: members.length
    });
    return { ok: true, id: ramId };
  }

  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    var orcaId = 'o' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    var orcaCheck = aimValidateOrgAddTarget('orca', parentId, orcaId);
    if (!orcaCheck.ok) return { ok: false, error: orcaCheck.error };
    var orcaMember = {
      id: orcaId,
      parent: parentId,
      name: name || username || '未入力',
      username: username,
      rank: Number(fields.rank) || 0,
      investment: investment,
      aiAgent: fields.aiAgent || '不明',
      personalSales: 0,
      groupSales: 0,
      open: true,
      bvMode: 'MANUAL',
      bvPrompted: false
    };
    aimClearRemovedOrgAccountId('orca', orcaId);
    aimApplyOrgMemberSeriesMeta('orca', orcaMember, parentId);
    aimEnsureMemberSortOrderAtEnd('orca', orcaMember);
    orcaMembers.push(orcaMember);
    if (!parentId) {
      if (typeof orcaRootAccountIds !== 'undefined' && orcaRootAccountIds.indexOf(orcaId) < 0) {
        orcaRootAccountIds.push(orcaId);
      }
      if (typeof orcaRootId !== 'undefined') orcaRootId = orcaId;
      if (typeof orcaFocusId !== 'undefined') orcaFocusId = orcaId;
    } else {
      var orcaParent = orcaMembers.find(function (m) { return m.id === parentId; });
      if (orcaParent) orcaParent.open = true;
      if (typeof orcaFocusId !== 'undefined') orcaFocusId = orcaId;
      var line = investment;
      if (typeof orcaAdjustAncestorManualVolumes === 'function') {
        orcaAdjustAncestorManualVolumes(parentId, line);
      }
      if (typeof orcaSyncPersonalSalesFor === 'function') {
        orcaSyncPersonalSalesFor(orcaId);
        orcaSyncPersonalSalesFor(parentId);
      }
      if (typeof orcaRefreshGroupSalesUpstream === 'function') {
        orcaRefreshGroupSalesUpstream(orcaId);
      }
    }
    aimOrgAddLog({
      project: 'orca',
      phase: 'create',
      success: true,
      accountId: aimGetDisplayedAccountId('orca'),
      parentNodeId: parentId,
      newNodeId: orcaId,
      beforeCount: orcaCheck.beforeCount,
      afterCount: orcaMembers.length
    });
    return { ok: true, id: orcaId };
  }

  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    var wallet = String(fields.walletAddress || fields.username || '').trim();
    if (!wallet) return { ok: false, error: 'ウォレットアドレスは必須です' };
    var eniId = 'eni_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    var eniCheck = aimValidateOrgAddTarget('eni', parentId, eniId);
    if (!eniCheck.ok) return { ok: false, error: eniCheck.error };
    var eniMember = {
      id: eniId,
      parent: parentId,
      name: name,
      username: wallet,
      walletAddress: wallet,
      investment: investment,
      stakingReward: 0,
      teamReward: 0,
      open: true
    };
    aimClearRemovedOrgAccountId('eni', eniId);
    aimApplyOrgMemberSeriesMeta('eni', eniMember, parentId);
    aimEnsureMemberSortOrderAtEnd('eni', eniMember);
    eniMembers.push(eniMember);
    if (!parentId) {
      if (typeof eniRootAccountIds !== 'undefined' && eniRootAccountIds.indexOf(eniId) < 0) {
        eniRootAccountIds.push(eniId);
      }
      if (typeof eniRootId !== 'undefined') eniRootId = eniId;
      if (typeof eniFocusId !== 'undefined') eniFocusId = eniId;
    } else {
      var eniParent = eniMembers.find(function (m) { return m.id === parentId; });
      if (eniParent) eniParent.open = true;
      if (typeof eniFocusId !== 'undefined') eniFocusId = eniId;
    }
    aimOrgAddLog({
      project: 'eni',
      phase: 'create',
      success: true,
      accountId: aimGetDisplayedAccountId('eni'),
      parentNodeId: parentId,
      newNodeId: eniId,
      beforeCount: eniCheck.beforeCount,
      afterCount: eniMembers.length
    });
    return { ok: true, id: eniId };
  }
  return { ok: false, error: '追加先アカウントが見つかりません' };
}

/** 成功時は id 文字列、失敗時は null（既存呼び出し互換） */
function aimCreateOrgOnlyMember(projectKey, fields, parentId) {
  var res = aimCreateOrgOnlyMemberResult(projectKey, fields, parentId);
  return res && res.ok ? res.id : null;
}

function aimRollbackOrgOnlyMember(projectKey, memberId) {
  if (!projectKey || !memberId) return;
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    members = members.filter(function (m) { return !m || m.id !== memberId; });
    if (typeof rootAccountIds !== 'undefined') {
      rootAccountIds = rootAccountIds.filter(function (id) { return id !== memberId; });
    }
    if (typeof rootId !== 'undefined' && rootId === memberId) {
      rootId = (rootAccountIds && rootAccountIds[0]) || '';
      if (typeof focusId !== 'undefined') focusId = rootId;
    }
    return;
  }
  if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    orcaMembers = orcaMembers.filter(function (m) { return !m || m.id !== memberId; });
    if (typeof orcaRootAccountIds !== 'undefined') {
      orcaRootAccountIds = orcaRootAccountIds.filter(function (id) { return id !== memberId; });
    }
    if (typeof orcaRootId !== 'undefined' && orcaRootId === memberId) {
      orcaRootId = (orcaRootAccountIds && orcaRootAccountIds[0]) || '';
      if (typeof orcaFocusId !== 'undefined') orcaFocusId = orcaRootId;
    }
    return;
  }
  if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    eniMembers = eniMembers.filter(function (m) { return !m || m.id !== memberId; });
    if (typeof eniRootAccountIds !== 'undefined') {
      eniRootAccountIds = eniRootAccountIds.filter(function (id) { return id !== memberId; });
    }
    if (typeof eniRootId !== 'undefined' && eniRootId === memberId) {
      eniRootId = (eniRootAccountIds && eniRootAccountIds[0]) || '';
      if (typeof eniFocusId !== 'undefined') eniFocusId = eniRootId;
    }
  }
}

/**
 * 「表示に追加」用：組織図メンバーを実績入力アカウント一覧へ登録（未登録時のみ）
 * 収益ログや投資履歴は自動作成しない
 */
function aimEnsureOrgMemberRegisteredAsInput(projectKey, accountId) {
  if (!projectKey || !accountId || typeof settings === 'undefined') return false;
  if (aimFindInputAccount(projectKey, accountId)) return true;
  var m = aimGetOrgMembersList(projectKey).find(function (x) { return x && x.id === accountId; });
  if (!m) return false;

  if (projectKey === 'ram') {
    aimEnsureRamInputAccounts();
    settings.ramInputAccounts.push({
      id: m.id,
      username: String(m.username || m.name || '未入力').replace(/^@/, ''),
      name: m.name || m.username || '未入力',
      investment: Number(m.investment) || 0,
      rank: Number(m.rank) || 0
    });
    return true;
  }
  if (projectKey === 'orca') {
    if (!Array.isArray(settings.orcaInputAccounts)) settings.orcaInputAccounts = [];
    settings.orcaInputAccounts.push({
      id: m.id,
      username: String(m.username || m.name || '未入力').replace(/^@/, ''),
      name: m.name || m.username || '未入力',
      investment: Number(m.investment) || 0,
      aiAgent: m.aiAgent || '不明',
      rank: Number(m.rank) || 0
    });
    return true;
  }
  if (projectKey === 'eni') {
    if (!Array.isArray(settings.eniInputAccounts)) settings.eniInputAccounts = [];
    var wallet = m.walletAddress || m.username || '';
    settings.eniInputAccounts.push({
      id: m.id,
      username: wallet,
      name: m.name || '',
      walletAddress: wallet,
      investment: Number(m.investment) || 0
    });
    return true;
  }
  return false;
}

function aimBuildOrgOnlyNewFormHtml(projectKey) {
  var esc = aimEscapeHtml;
  if (projectKey === 'ram') {
    var rankOpts = '';
    var ranks = (typeof rankName !== 'undefined') ? [5, 4, 3, 2, 1, 0] : [0];
    ranks.forEach(function (r) {
      var label = (typeof rankName !== 'undefined' && rankName[r]) ? rankName[r] : ('Rank ' + r);
      rankOpts += '<option value="' + r + '"' + (r === 0 ? ' selected' : '') + '>' + esc(label) + '</option>';
    });
    return '<div class="aimOrgAddFormGrid">' +
      '<label>名前</label><input id="aimOrgNewName" type="text" placeholder="表示名">' +
      '<label>ユーザーネーム</label><input id="aimOrgNewUsername" type="text" placeholder="@なしで入力">' +
      '<label>保有ランク</label><select id="aimOrgNewRank">' + rankOpts + '</select>' +
      '<label>個人投資額</label><input id="aimOrgNewInvestment" type="number" min="0" step="any" placeholder="例：300" value="0">' +
      '</div>';
  }
  if (projectKey === 'orca') {
    var agentOpts = '';
    var agents = (typeof ORCA_AI_AGENTS !== 'undefined' && ORCA_AI_AGENTS.length)
      ? ORCA_AI_AGENTS
      : ['不明', 'Eden', 'Atlas', 'Nova'];
    agents.forEach(function (a) {
      agentOpts += '<option value="' + esc(a) + '"' + (a === '不明' ? ' selected' : '') + '>' + esc(a) + '</option>';
    });
    return '<div class="aimOrgAddFormGrid">' +
      '<label>名前</label><input id="aimOrgNewName" type="text" placeholder="表示名">' +
      '<label>ユーザーネーム</label><input id="aimOrgNewUsername" type="text" placeholder="@なしで入力">' +
      '<label>個人投資額</label><input id="aimOrgNewInvestment" type="number" min="0" step="any" placeholder="例：300" value="0">' +
      '<label>運用AIエージェント</label><select id="aimOrgNewAiAgent">' + agentOpts + '</select>' +
      '</div>';
  }
  return '<div class="aimOrgAddFormGrid">' +
    '<label>名前（任意）</label><input id="aimOrgNewName" type="text" placeholder="未入力時はウォレット表示">' +
    '<label>ウォレットアドレス（必須）</label><input id="aimOrgNewWallet" type="text" placeholder="0x... またはアドレス">' +
    '<label>ステーキング額</label><input id="aimOrgNewInvestment" type="number" min="0" step="any" placeholder="例：10000" value="0">' +
    '</div>';
}

function aimReadOrgOnlyNewFormFields(projectKey) {
  var nameEl = document.getElementById('aimOrgNewName');
  var userEl = document.getElementById('aimOrgNewUsername');
  var invEl = document.getElementById('aimOrgNewInvestment');
  var fields = {
    name: nameEl ? nameEl.value : '',
    username: userEl ? userEl.value : '',
    investment: invEl ? invEl.value : 0
  };
  if (projectKey === 'ram') {
    var rankEl = document.getElementById('aimOrgNewRank');
    fields.rank = rankEl ? rankEl.value : 0;
  }
  if (projectKey === 'orca') {
    var agentEl = document.getElementById('aimOrgNewAiAgent');
    fields.aiAgent = agentEl ? agentEl.value : '不明';
  }
  if (projectKey === 'eni') {
    var walletEl = document.getElementById('aimOrgNewWallet');
    fields.walletAddress = walletEl ? walletEl.value : '';
    fields.username = fields.walletAddress;
  }
  return fields;
}

/**
 * 組織図追加モーダル
 * contextParentId あり → 配下へ追加（親固定）
 * contextParentId なし → 独立親系列の追加
 */
function aimRenderOrgPlacementModal(projectKey, contextParentId, onPlaced) {
  aimEnsureCloseModalHook();
  var isChildMode = !!contextParentId;
  var available = aimGetAccountsForOrgPlacement(projectKey);
  var esc = aimEscapeHtml;
  var contextParent = isChildMode
    ? aimGetOrgMembersList(projectKey).find(function (m) { return m && m.id === contextParentId; })
    : null;
  var contextParentLabel = contextParent
    ? aimGetOrgMemberDisplayName(projectKey, contextParent)
    : '';
  var projectLabel = projectKey === 'ram' ? 'RAM' : projectKey === 'orca' ? 'ORCA' : 'ENI';
  var defaultTab = 'new';

  if (typeof modalBg !== 'undefined' && modalBg) {
    modalBg.classList.add('aimOrgAddOpen');
    modalBg.setAttribute('data-aim-project',
      projectKey === 'ram' || projectKey === 'orca' || projectKey === 'eni' ? projectKey : 'eni');
  }
  if (typeof modalTitle !== 'undefined') {
    modalTitle.textContent = isChildMode ? '配下へ追加' : '親系列を追加';
  }
  if (typeof modalContent === 'undefined') return;

  var accountOpts = available.map(function (acc) {
    var label = acc.username || acc.name || acc.id;
    if (projectKey === 'eni' && typeof eniWalletShort === 'function' && (acc.walletAddress || acc.username)) {
      var short = eniWalletShort(acc.walletAddress || acc.username);
      var nm = String(acc.name || '').trim();
      label = nm ? (nm + '（' + short + '）') : ('ウォレット ' + short);
    }
    return '<option value="' + esc(acc.id) + '">' + esc(label) + '</option>';
  }).join('');

  var fromInputPanel = available.length
    ? ('<div class="aimOrgAddPanel">' +
      '<p class="help">実績入力に登録済みで、まだこの組織図に配置されていないアカウントです。</p>' +
      '<label>未配置アカウント</label>' +
      '<select id="aimPlaceAccountSelect">' + accountOpts + '</select>' +
      '</div>')
    : ('<div class="aimOrgAddPanel"><div class="aimOrgAddEmpty">' +
      '<b>組織図に未配置の実績入力アカウントはありません</b>' +
      '<p class="help">' + projectLabel + 'の実績入力アカウントは、すべて配置済みか、まだ登録がありません。</p>' +
      '</div></div>');

  var lead = isChildMode
    ? ('親：<b>' + esc(contextParentLabel || contextParentId) + '</b> の直下へ追加します。組織図専用の新規追加では実績入力へは登録しません。')
    : ('新しい独立系列の起点アカウントを追加します。組織図専用の新規追加では実績入力へは登録しません。');

  modalContent.innerHTML =
    '<div class="aimOrgAddModal">' +
    '<p class="help aimOrgAddLead">' + lead + '</p>' +
    '<div class="aimOrgAddTabs" role="tablist">' +
    '<button type="button" class="aimOrgAddTab is-active" data-aim-tab="new" role="tab" aria-selected="true">新規追加</button>' +
    '<button type="button" class="aimOrgAddTab" data-aim-tab="fromInput" role="tab" aria-selected="false">実績入力から追加</button>' +
    '</div>' +
    '<div id="aimOrgAddTabNew" class="aimOrgAddTabPanel" data-aim-tab-panel="new">' +
    aimBuildOrgOnlyNewFormHtml(projectKey) +
    '<p class="help">この登録は組織図だけに保存されます。実績入力へ追加するには、後から詳細の「表示に追加」を使います。</p>' +
    '</div>' +
    '<div id="aimOrgAddTabFromInput" class="aimOrgAddTabPanel hidden" data-aim-tab-panel="fromInput">' +
    fromInputPanel +
    '</div>' +
    '<div class="aimOrgAddFooter">' +
    '<button type="button" class="btn2" id="aimOrgAddCancelBtn">キャンセル</button>' +
    '<button type="button" id="aimOrgAddPrimaryBtn">' +
    (isChildMode ? '登録して配下へ追加' : '登録して系列を追加') + '</button>' +
    '</div></div>';

  var currentTab = defaultTab;

  function syncTabUi() {
    document.querySelectorAll('.aimOrgAddTab').forEach(function (btn) {
      var on = btn.getAttribute('data-aim-tab') === currentTab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.aimOrgAddTabPanel').forEach(function (panel) {
      panel.classList.toggle('hidden', panel.getAttribute('data-aim-tab-panel') !== currentTab);
    });
    var primary = document.getElementById('aimOrgAddPrimaryBtn');
    if (primary) {
      if (currentTab === 'new') {
        primary.textContent = isChildMode ? '登録して配下へ追加' : '登録して系列を追加';
      } else {
        primary.textContent = isChildMode ? '配下へ追加' : '系列として追加';
      }
    }
  }

  document.querySelectorAll('.aimOrgAddTab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentTab = btn.getAttribute('data-aim-tab') || 'new';
      syncTabUi();
    });
  });
  syncTabUi();

  var cancelBtn = document.getElementById('aimOrgAddCancelBtn');
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      if (typeof closeModal === 'function') closeModal();
    };
  }

  var primaryBtn = document.getElementById('aimOrgAddPrimaryBtn');
  if (primaryBtn) {
    primaryBtn.onclick = function () {
      if (aimOrgAddInFlight) return;
      var parentId = isChildMode ? contextParentId : null;
      // 保存直前に親を最新メンバー一覧で再確認（切替直後の取り違え防止）
      if (parentId && !aimFindOrgMember(projectKey, parentId)) {
        if (typeof showToast === 'function') showToast('⚠️ 親ノードが見つかりません');
        return;
      }

      var primaryLabel = primaryBtn.textContent;
      function setBusy(busy) {
        aimOrgAddInFlight = !!busy;
        primaryBtn.disabled = !!busy;
        primaryBtn.textContent = busy ? '保存中…' : primaryLabel;
      }

      if (currentTab === 'new') {
        var fields = aimReadOrgOnlyNewFormFields(projectKey);
        if (projectKey === 'eni' && !String(fields.walletAddress || '').trim()) {
          if (typeof showToast === 'function') showToast('⚠️ ウォレットアドレスは必須です');
          return;
        }
        if (projectKey !== 'eni' && !String(fields.name || '').trim() && !String(fields.username || '').trim()) {
          if (typeof showToast === 'function') showToast('⚠️ 名前またはユーザーネームを入力してください');
          return;
        }
        setBusy(true);
        var created = aimCreateOrgOnlyMemberResult(projectKey, fields, parentId);
        if (!created || !created.ok || !created.id) {
          setBusy(false);
          if (typeof showToast === 'function') {
            showToast('⚠️ ' + ((created && created.error) || '追加できませんでした'));
          }
          return;
        }
        var saved = aimPersistAndRerenderOrg(projectKey, {
          newId: created.id,
          parentId: parentId
        });
        if (!saved) {
          // 保存／描画失敗時は tombstone なしでロールバック
          aimRollbackOrgOnlyMember(projectKey, created.id);
          setBusy(false);
          return;
        }
        if (typeof onPlaced === 'function') onPlaced(created.id);
        if (typeof showToast === 'function') {
          showToast(isChildMode ? '✅ 組織図の配下へ追加しました' : '✅ 新しい親系列を追加しました');
        }
        setBusy(false);
        if (typeof closeModal === 'function') closeModal();
        return;
      }

      if (!available.length) {
        if (typeof showToast === 'function') {
          showToast('⚠️ 組織図に未配置の実績入力アカウントはありません');
        }
        return;
      }
      var sel = document.getElementById('aimPlaceAccountSelect');
      var id = sel ? sel.value : '';
      if (!id) {
        if (typeof showToast === 'function') showToast('⚠️ 追加先アカウントが見つかりません');
        return;
      }
      setBusy(true);
      var placed = aimPlaceInputAccountInOrg(projectKey, id, parentId);
      if (!placed || !placed.ok) {
        setBusy(false);
        if (typeof showToast === 'function') {
          showToast('⚠️ ' + ((placed && placed.error) || '追加できませんでした'));
        }
        return;
      }
      if (isChildMode) {
        var p = aimFindOrgMember(projectKey, parentId);
        if (p) p.open = true;
      }
      var placedOk = aimPersistAndRerenderOrg(projectKey, {
        newId: placed.id,
        parentId: parentId
      });
      if (!placedOk) {
        setBusy(false);
        return;
      }
      if (typeof onPlaced === 'function') onPlaced(placed.id);
      if (typeof showToast === 'function') {
        showToast(isChildMode ? '✅ 配下へ追加しました' : '✅ 親系列として追加しました');
      }
      setBusy(false);
      if (typeof closeModal === 'function') closeModal();
    };
  }

  if (typeof modalBg !== 'undefined') modalBg.style.display = 'flex';
}

/** @deprecated 組織図からは実績入力登録フォームを開かない */
function aimOpenProjectRegisterFromOrg(projectKey, contextParentId) {
  aimRenderOrgPlacementModal(projectKey, contextParentId || null);
}

/** @deprecated ENI組織図専用新規は aimCreateOrgOnlyMember に統合 */
function aimRenderEniOrgRegisterAndPlaceForm(contextParentId) {
  aimRenderOrgPlacementModal('eni', contextParentId || null);
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
  window.aimOpenProjectRegisterFromOrg = aimOpenProjectRegisterFromOrg;
  window.aimRenderEniOrgRegisterAndPlaceForm = aimRenderEniOrgRegisterAndPlaceForm;
  window.aimCreateOrgOnlyMember = aimCreateOrgOnlyMember;
  window.aimCreateOrgOnlyMemberResult = aimCreateOrgOnlyMemberResult;
  window.aimPersistAndRerenderOrg = aimPersistAndRerenderOrg;
  window.aimEnsureOrgMemberRegisteredAsInput = aimEnsureOrgMemberRegisteredAsInput;
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
