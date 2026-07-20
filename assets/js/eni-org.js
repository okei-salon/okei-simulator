/* OUKEI HUB ENI Organization Chart
 * RAM / ORCA 組織図とはデータ・操作を完全分離（eniMembers / eniOrgChart）。
 */

var eniMembers = [];
var eniCurrentData = [];
var eniScenarios = [];
var eniRootId = '';
var eniRootAccountIds = [];
var eniFocusId = '';
var eniZoom = 1;
var eniPinchBound = false;
var eniPinchStartDist = 0;
var eniPinchStartZoom = 1;
var eniVolCache = {};
var eniCountCache = {};
var eniDepthCache = {};
var eniRewardCache = {};
var eniStakeCache = {};

/** USDT 日利（配当内訳の USDT 0.9%）。ENI/EPAY 分は組織図では扱わない */
var ENI_USDT_DAILY_RATE = 0.009;
var ENI_REWARD_MONTH_DAYS = 30;
var ENI_MAX_REWARD_GEN = 100;

function eniClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function eniEscape(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function eniRoundReward(n) {
  var v = Number(n);
  if (!isFinite(v)) return 0;
  if (typeof pdRoundEni === 'function') return pdRoundEni(v);
  return Math.round(v * 10000) / 10000;
}

function eniMoney(n) {
  var v = Number(n) || 0;
  if (typeof money === 'function') return money(v);
  return '$' + v.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function eniPackOrgChart() {
  return {
    members: eniMembers,
    currentData: eniCurrentData,
    scenarios: eniScenarios,
    rootId: eniRootId,
    rootAccountIds: eniRootAccountIds,
    zoom: eniZoom
  };
}

function eniApplyOrgChart(data) {
  var base = typeof hubCreateEmptyEniOrgChart === 'function'
    ? hubCreateEmptyEniOrgChart()
    : { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 };
  var d = data && typeof data === 'object' ? data : base;
  eniMembers = eniClone(Array.isArray(d.members) ? d.members : []);
  eniCurrentData = eniClone(Array.isArray(d.currentData) ? d.currentData : []);
  eniScenarios = eniClone(Array.isArray(d.scenarios) ? d.scenarios : []);
  eniRootId = typeof d.rootId === 'string' ? d.rootId : '';
  eniRootAccountIds = eniClone(Array.isArray(d.rootAccountIds) ? d.rootAccountIds : []);
  eniZoom = typeof d.zoom === 'number' ? d.zoom : 1;
  eniFocusId = eniRootId;
  eniNormalizeMembers();
}

function eniNormalizeMembers() {
  eniMembers.forEach(function (m) {
    if (!m || typeof m !== 'object') return;
    if (m.walletAddress == null && m.username) m.walletAddress = m.username;
    if (m.open == null) m.open = true;
    if (m.investment == null) m.investment = 0;
    if (m.stakingReward == null) m.stakingReward = 0;
    if (m.teamReward == null) m.teamReward = 0;
    if (m.name == null) m.name = '';
  });
}

function eniClearAggCache() {
  eniVolCache = {};
  eniCountCache = {};
  eniDepthCache = {};
  eniRewardCache = {};
  eniStakeCache = {};
}

function eniIsMemberActive(m) {
  if (!m || !m.id) return false;
  if (m.deleted === true || m.isDeleted === true) return false;
  if (m.inactive === true || m.disabled === true || m.suspended === true) return false;
  if (m.active === false || m.enabled === false) return false;
  if (m.status != null) {
    var st = String(m.status).toLowerCase();
    if (st === 'deleted' || st === 'inactive' || st === 'disabled' || st === 'suspended') return false;
  }
  return true;
}

function eniChildrenOf(id) {
  var kids = eniMembers.filter(function (m) {
    return m && m.parent === id && eniIsMemberActive(m);
  });
  return kids.slice().sort(function (a, b) {
    var sa = a.sortOrder != null ? Number(a.sortOrder) : 0;
    var sb = b.sortOrder != null ? Number(b.sortOrder) : 0;
    if (sa !== sb) return sa - sb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function eniFindMember(id) {
  return eniMembers.find(function (m) { return m.id === id; }) || null;
}

/**
 * ステーキング額（運用額）
 * - 実績入力アカウント：現在運用額（investmentHistory）を優先
 * - 組織図のみの人物：ノードの investment
 */
function eniGetStakingAmount(id) {
  if (!id) return 0;
  if (eniStakeCache[id] != null) return eniStakeCache[id];
  var m = eniFindMember(id);
  if (!m || !eniIsMemberActive(m)) {
    eniStakeCache[id] = 0;
    return 0;
  }
  var amount = Number(m.investment) || 0;
  var inputAcc = typeof aimFindInputAccount === 'function'
    ? aimFindInputAccount('eni', id)
    : null;
  if (inputAcc) {
    amount = Number(inputAcc.investment) || 0;
    var dateKey = typeof todayKey === 'function' ? todayKey() : '';
    if (dateKey && typeof pdGetOperatingUsdAsOf === 'function' &&
        typeof settings !== 'undefined' && settings.investmentHistory) {
      var hist = settings.investmentHistory[id];
      if (hist && hist.projectKey === 'eni' && Array.isArray(hist.records) && hist.records.length) {
        amount = Number(pdGetOperatingUsdAsOf(id, 'eni', dateKey)) || 0;
      }
    }
  } else if (typeof settings !== 'undefined' && settings.investmentHistory) {
    var histOnly = settings.investmentHistory[id];
    var dateKey2 = typeof todayKey === 'function' ? todayKey() : '';
    if (histOnly && histOnly.projectKey === 'eni' &&
        Array.isArray(histOnly.records) && histOnly.records.length &&
        dateKey2 && typeof pdGetOperatingUsdAsOf === 'function') {
      amount = Number(pdGetOperatingUsdAsOf(id, 'eni', dateKey2)) || 0;
    }
  }
  amount = eniRoundReward(amount);
  eniStakeCache[id] = amount;
  return amount;
}

/**
 * 直紹介人数に応じた世代別報酬率。
 * 解放されていない世代は 0。
 */
function eniGenerationRate(gen, directCount) {
  var g = Number(gen) || 0;
  var d = Number(directCount) || 0;
  if (g < 1 || g > ENI_MAX_REWARD_GEN) return 0;
  if (g === 1) return d >= 1 ? 0.05 : 0;
  if (g === 2) return d >= 2 ? 0.06 : 0;
  if (g === 3) return d >= 3 ? 0.07 : 0;
  if (g === 4) return d >= 4 ? 0.08 : 0;
  if (g === 5) return d >= 5 ? 0.09 : 0;
  if (g === 6) return d >= 6 ? 0.10 : 0;
  if (g >= 7 && g <= 20) return d >= 7 ? 0.03 : 0;
  if (g >= 21 && g <= 30) return d >= 8 ? 0.02 : 0;
  if (g >= 31 && g <= 100) return d >= 9 ? 0.005 : 0;
  return 0;
}

function eniDailyStakingReward(stake) {
  return eniRoundReward((Number(stake) || 0) * ENI_USDT_DAILY_RATE);
}

function eniMonthlyFromDaily(daily) {
  return eniRoundReward((Number(daily) || 0) * ENI_REWARD_MONTH_DAYS);
}

/**
 * 指定アカウントを基点にした報酬・実績。
 * 各ノードは「そのノード自身の直紹介人数・世代解放」で独立計算する。
 */
function eniCalcRewardsFor(rootId) {
  if (!rootId) {
    return {
      stakingDaily: 0,
      stakingMonthly: 0,
      teamDaily: 0,
      teamMonthly: 0,
      totalMonthly: 0,
      teamVolume: 0,
      directCount: 0
    };
  }
  if (eniRewardCache[rootId]) return eniRewardCache[rootId];
  var root = eniFindMember(rootId);
  if (!root || !eniIsMemberActive(root)) {
    var empty = {
      stakingDaily: 0,
      stakingMonthly: 0,
      teamDaily: 0,
      teamMonthly: 0,
      totalMonthly: 0,
      teamVolume: 0,
      directCount: 0
    };
    eniRewardCache[rootId] = empty;
    return empty;
  }

  var stake = eniGetStakingAmount(rootId);
  var stakingDaily = eniDailyStakingReward(stake);
  var stakingMonthly = eniMonthlyFromDaily(stakingDaily);

  var directs = eniChildrenOf(rootId);
  var directCount = directs.length;
  var teamDaily = 0;
  var visited = {};
  visited[rootId] = true;

  var queue = [];
  directs.forEach(function (c) {
    queue.push({ id: c.id, gen: 1 });
  });

  while (queue.length) {
    var item = queue.shift();
    if (!item || !item.id || visited[item.id]) continue;
    visited[item.id] = true;
    var member = eniFindMember(item.id);
    if (!member || !eniIsMemberActive(member)) continue;
    if (item.gen < 1 || item.gen > ENI_MAX_REWARD_GEN) continue;

    var rate = eniGenerationRate(item.gen, directCount);
    if (rate > 0) {
      var childStake = eniGetStakingAmount(item.id);
      teamDaily += eniDailyStakingReward(childStake) * rate;
    }

    if (item.gen < ENI_MAX_REWARD_GEN) {
      eniChildrenOf(item.id).forEach(function (c) {
        if (!visited[c.id]) queue.push({ id: c.id, gen: item.gen + 1 });
      });
    }
  }

  teamDaily = eniRoundReward(teamDaily);
  var teamMonthly = eniMonthlyFromDaily(teamDaily);
  var teamVolume = eniCalcTeamVolume(rootId);
  var result = {
    stakingDaily: stakingDaily,
    stakingMonthly: stakingMonthly,
    teamDaily: teamDaily,
    teamMonthly: teamMonthly,
    totalMonthly: eniRoundReward(stakingMonthly + teamMonthly),
    teamVolume: teamVolume,
    directCount: directCount
  };
  eniRewardCache[rootId] = result;
  return result;
}

/** ウォレット下4桁（0x除去後）。 */
function eniWalletShort(addr) {
  var s = String(addr || '').trim();
  if (!s) return '';
  var clean = s.replace(/^0x/i, '');
  if (!clean) return '';
  if (clean.length <= 4) return clean;
  return clean.slice(-4).toUpperCase();
}

function eniWalletLabel(addr) {
  return eniWalletShort(addr) || '----';
}

function eniDisplayName(m) {
  if (!m) return '未登録';
  var n = String(m.name || '').trim();
  if (n) return n;
  var w = eniWalletShort(m.walletAddress);
  if (w) return 'ウォレット ' + w;
  return '未登録';
}

/**
 * チーム実績 = 配下全員のステーキング額合計（本人のステーキング額は含まない）
 */
function eniCalcTeamVolume(id, _visited) {
  if (eniVolCache[id] != null) return eniVolCache[id];
  var visited = _visited || {};
  if (visited[id]) {
    eniVolCache[id] = 0;
    return 0;
  }
  visited[id] = true;
  var sum = 0;
  eniChildrenOf(id).forEach(function (c) {
    if (visited[c.id]) return;
    sum += eniGetStakingAmount(c.id) + eniCalcTeamVolume(c.id, visited);
  });
  sum = eniRoundReward(sum);
  eniVolCache[id] = sum;
  return sum;
}

/**
 * チーム人数 = 配下人数（本人を含まない）
 */
function eniCalcTeamCount(id, _visited) {
  if (eniCountCache[id] != null) return eniCountCache[id];
  var visited = _visited || {};
  if (visited[id]) {
    eniCountCache[id] = 0;
    return 0;
  }
  visited[id] = true;
  var n = 0;
  eniChildrenOf(id).forEach(function (c) {
    if (visited[c.id]) return;
    n += 1 + eniCalcTeamCount(c.id, visited);
  });
  eniCountCache[id] = n;
  return n;
}

/** 表示中ルートから見た段数（ルート=0=本人、直下=1段目） */
function eniBuildDepthMap(rootId) {
  var map = {};
  if (!rootId || !eniFindMember(rootId)) return map;
  map[rootId] = 0;
  var queue = [rootId];
  while (queue.length) {
    var id = queue.shift();
    var d = map[id];
    eniChildrenOf(id).forEach(function (c) {
      if (map[c.id] != null) return; // 循環参照ガード
      map[c.id] = d + 1;
      queue.push(c.id);
    });
  }
  return map;
}

function eniDepthFromRoot(id, rootId) {
  if (!eniDepthCache._root || eniDepthCache._root !== rootId) {
    eniDepthCache = eniBuildDepthMap(rootId);
    eniDepthCache._root = rootId;
  }
  return eniDepthCache[id] != null ? eniDepthCache[id] : 0;
}

function eniDepthLabel(depth) {
  if (depth === 0 || depth == null) return '本人';
  return depth + '段目';
}

/**
 * チーム実績による色分けティア
 * green / blue / purple / orange / gold
 */
function eniVolumeTier(volume) {
  var v = Number(volume) || 0;
  if (v >= 300000) return 'gold';
  if (v >= 100000) return 'orange';
  if (v >= 50000) return 'purple';
  if (v >= 10000) return 'blue';
  return 'green';
}

function eniSubtreeIds(id) {
  var ids = [id];
  var changed = true;
  while (changed) {
    changed = false;
    eniMembers.forEach(function (m) {
      if (m.parent && ids.indexOf(m.parent) >= 0 && ids.indexOf(m.id) < 0) {
        ids.push(m.id);
        changed = true;
      }
    });
  }
  return ids;
}

function eniRender() {
  eniNormalizeMembers();
  eniClearAggCache();
  eniCurrentData = eniClone(eniMembers);
  eniRenderStats();
  eniRenderRootAccounts();
  if (eniRootId && eniFindMember(eniRootId)) eniFocusId = eniRootId;
  eniRenderCards();
  eniRenderTree();
  var canvas = document.getElementById('eniCanvas');
  if (canvas) canvas.style.transform = 'scale(' + eniZoom + ')';
  if (typeof initOrgChartTitleIcons === 'function') initOrgChartTitleIcons();
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
}

function eniRenderStats() {
  var badge = document.getElementById('eniAccountBadge');
  var reflectBadge = document.getElementById('eniReflectBadge');
  var total = 0;
  if (eniRootId && eniFindMember(eniRootId)) {
    total = eniSubtreeIds(eniRootId).length;
  }
  if (badge) badge.innerHTML = '👤 ' + total;
  if (reflectBadge) {
    reflectBadge.textContent = '📊 入力反映率 ' + eniReflectionRate() + '%';
  }
}

/**
 * ENI入力反映率 = 実績入力済みアカウント数 / ENI登録アカウント数 × 100
 * （当日の実績入力エントリを基準。登録0件なら 0%）
 */
function eniReflectionRate() {
  var accounts = typeof getEniInputAccounts === 'function' ? getEniInputAccounts() : [];
  var total = accounts.length;
  if (!total) return 0;
  var entry = typeof getTodayEniRevenueEntry === 'function'
    ? getTodayEniRevenueEntry()
    : null;
  var entered = 0;
  accounts.forEach(function (acc) {
    if (typeof isEniAccountEntered === 'function') {
      if (isEniAccountEntered(entry, acc.id)) entered += 1;
      return;
    }
    if (entry && entry.eniAccounts && entry.eniAccounts[acc.id] &&
        typeof pdIsEniAccountEntryPresent === 'function' &&
        pdIsEniAccountEntryPresent(entry.eniAccounts[acc.id])) {
      entered += 1;
    }
  });
  return Math.round((entered / total) * 100);
}

function eniRenderCards() {
  var set = function (id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  var zMonth = eniMoney(0) + '/月';
  var zVol = eniMoney(0);
  var root = eniRootId ? eniFindMember(eniRootId) : null;
  if (!root || !eniIsMemberActive(root)) {
    set('eniCardTotal', zMonth);
    set('eniCardStaking', zMonth);
    set('eniCardTeamReward', zMonth);
    set('eniCardTeamVolume', zVol);
    return;
  }
  var rewards = eniCalcRewardsFor(root.id);
  set('eniCardStaking', eniMoney(rewards.stakingMonthly) + '/月');
  set('eniCardTeamReward', eniMoney(rewards.teamMonthly) + '/月');
  set('eniCardTotal', eniMoney(rewards.totalMonthly) + '/月');
  set('eniCardTeamVolume', eniMoney(rewards.teamVolume));
  var volEl = document.getElementById('eniCardTeamVolume');
  if (volEl) volEl.className = 'main';
}

function eniEnsureRootAccounts() {
  eniRootAccountIds = (eniRootAccountIds || []).filter(function (id) {
    return !!eniFindMember(id);
  });
  if (!eniRootAccountIds.length) {
    var roots = eniMembers.filter(function (m) { return !m.parent; }).map(function (m) { return m.id; });
    eniRootAccountIds = roots.length ? roots : [eniRootId].filter(Boolean);
  }
  // 表示中アカウントがメンバーに残っている限り維持（同期後にメインへ戻さない）
  if (!eniRootAccountIds.includes(eniRootId)) {
    if (!eniFindMember(eniRootId)) {
      eniRootId = eniRootAccountIds[0] || eniRootId || '';
    }
  }
}

function eniRenderRootAccounts() {
  eniEnsureRootAccounts();
  var sel = document.getElementById('eniRootAccountSelect');
  if (!sel) return;
  sel.innerHTML = eniRootAccountIds.map(function (id) {
    var m = eniFindMember(id);
    if (!m) return '';
    return '<option value="' + eniEscape(m.id) + '"' +
      (m.id === eniRootId ? ' selected' : '') + '>' +
      eniEscape(eniDisplayName(m)) + '</option>';
  }).join('');
}

function eniSwitchRootAccount(id) {
  eniRootId = id;
  eniFocusId = id;
  eniRender();
  if (typeof showToast === 'function') {
    var m = eniFindMember(id);
    showToast('✅ ' + (m ? eniDisplayName(m) : '組織図') + 'に切り替えました');
  }
  setTimeout(eniCenterRootNode, 120);
}

function eniNodeHtml(m, kidCount) {
  var teamVol = eniCalcTeamVolume(m.id);
  var teamCount = eniCalcTeamCount(m.id);
  var depth = eniDepthFromRoot(m.id, eniRootId);
  var tier = eniVolumeTier(teamVol);
  var nm = eniDisplayName(m);
  var wallet = eniWalletLabel(m.walletAddress);
  var stake = eniGetStakingAmount(m.id);
  return '<div class="node eniNode eniVolTier-' + tier +
    (m.id === eniRootId ? ' root' : '') +
    '" onclick="flashEl(this)">' +
    '<div class="nodeHead">' +
    '<div><div class="nodeName">' + eniEscape(nm) + '</div>' +
    '<div class="userName">ウォレット：' + eniEscape(wallet) + '</div></div>' +
    '<span class="rank eniDepthBadge eniVolTier-' + tier + '">' + eniEscape(eniDepthLabel(depth)) + '</span>' +
    '</div>' +
    '<div class="nodeInfo eniNodeInfo">' +
    '<div class="eniNodeRow"><span>ステーキング額</span><b>' + eniMoney(stake) + '</b></div>' +
    '<div class="eniNodeRow"><span>チーム実績</span>' +
    '<b class="eniVolValue eniVolTier-' + tier + '">' + eniMoney(teamVol) + '</b></div>' +
    '<div class="eniNodeRow"><span>チーム人数</span><b>' + teamCount + '人</b></div>' +
    '</div>' +
    '<div class="nodeBtns">' +
    (kidCount
      ? '<button type="button" class="toggle" onclick="event.stopPropagation();eniToggleOpen(\'' + m.id + '\')">' +
        (m.open ? '▼' : '▶') + '</button>'
      : '') +
    '<button type="button" class="nodeAddBtn" onclick="event.stopPropagation();eniAddChild(\'' + m.id + '\')">＋</button>' +
    '<button type="button" class="btn2" onclick="event.stopPropagation();eniShowDetail(\'' + m.id + '\')">詳細</button>' +
    (m.id !== eniRootId
      ? '<button type="button" class="btn2" onclick="event.stopPropagation();eniReorderSibling(\'' + m.id + '\',-1)">←</button>' +
        '<button type="button" class="btn2" onclick="event.stopPropagation();eniReorderSibling(\'' + m.id + '\',1)">→</button>'
      : '') +
    '</div></div>';
}

function eniRenderNode(id) {
  var m = eniFindMember(id);
  if (!m) return '';
  var kids = eniChildrenOf(id);
  var vis = m.open ? kids : [];
  return '<li>' + eniNodeHtml(m, kids.length) +
    (vis.length ? '<ul>' + vis.map(function (k) { return eniRenderNode(k.id); }).join('') + '</ul>' : '') +
    '</li>';
}

function eniRenderTree() {
  var tree = document.getElementById('eniTree');
  if (!tree) return;
  if (!eniRootId || !eniFindMember(eniRootId)) {
    tree.innerHTML = '<div class="explain" style="padding:28px 16px;text-align:center;color:#9fb3cc">' +
      '組織図がありません。左上の「＋」から親アカウントを作成してください。</div>';
    return;
  }
  tree.innerHTML = '<ul>' + eniRenderNode(eniRootId) + '</ul>';
}

function eniToggleOpen(id) {
  var m = eniFindMember(id);
  if (m) m.open = !m.open;
  eniRender();
}

function eniReorderSibling(id, dir) {
  if (typeof aimSwapSiblingSortOrder === 'function' && aimSwapSiblingSortOrder('eni', id, dir)) {
    if (typeof markActivity === 'function') markActivity();
    eniRender();
    return;
  }
  var m = eniFindMember(id);
  if (!m) return;
  var sib = eniMembers.filter(function (x) { return x.parent === m.parent; });
  var i = sib.findIndex(function (x) { return x.id === id; });
  var j = i + dir;
  if (j < 0 || j >= sib.length) return;
  var order = sib.map(function (x) { return x.id; });
  var tmp = order[i];
  order[i] = order[j];
  order[j] = tmp;
  var others = eniMembers.filter(function (x) { return x.parent !== m.parent; });
  var reordered = order.map(function (oid) { return eniFindMember(oid); }).filter(Boolean);
  eniMembers = others.concat(reordered);
  if (typeof markActivity === 'function') markActivity();
  eniRender();
}

function eniAddChild(parent) {
  if (typeof aimRenderOrgPlacementModal === 'function') {
    aimRenderOrgPlacementModal('eni', parent || null);
    return;
  }
  eniOpenEdit({ parent: parent || null });
}

function eniParentOptions(selected, excludeId) {
  var exclude = {};
  if (excludeId) {
    eniSubtreeIds(excludeId).forEach(function (id) { exclude[id] = true; });
  }
  return '<option value="">親なし（ルート）</option>' + eniMembers.map(function (m) {
    if (exclude[m.id]) return '';
    return '<option value="' + eniEscape(m.id) + '"' +
      (selected === m.id ? ' selected' : '') + '>' +
      eniEscape(eniDisplayName(m)) + '</option>';
  }).join('');
}

function eniOpenEdit(data) {
  data = data || {};
  if (!data.id && typeof aimRenderOrgPlacementModal === 'function' && data.forceManual !== true) {
    aimRenderOrgPlacementModal('eni', data.parent || null);
    return;
  }
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = data.id ? 'ENIメンバー編集' : 'ENIメンバー追加';
  modalContent.innerHTML =
    '<input type="hidden" id="eniEditId" value="' + eniEscape(data.id || '') + '">' +
    '<label>親アカウント</label><select id="eniParentInput">' +
    eniParentOptions(data.parent || null, data.id || null) + '</select>' +
    '<label>名前（任意）</label><input id="eniNameInput" placeholder="未登録の場合は空欄可" value="' +
    eniEscape(data.name || '') + '">' +
    '<label>ウォレットアドレス（必須）</label><input id="eniWalletInput" placeholder="0x... またはアドレス" value="' +
    eniEscape(data.walletAddress || '') + '">' +
    '<label>ステーキング額</label><input id="eniInvestmentInput" type="number" min="0" step="any" value="' +
    (data.investment != null ? eniEscape(data.investment) : '') + '">' +
    '<input type="hidden" id="eniStakingRewardInput" value="' +
    eniEscape(data.stakingReward != null ? data.stakingReward : 0) + '">' +
    '<input type="hidden" id="eniTeamRewardInput" value="' +
    eniEscape(data.teamReward != null ? data.teamReward : 0) + '">' +
    '<p class="help">ステーキング報酬・チーム報酬・月間報酬・チーム実績は組織図データから自動計算します。ウォレットは組織図上では下4桁のみ表示されます。</p>' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '<button type="button" class="btn2" onclick="closeModal()">キャンセル</button>' +
    '<button type="button" onclick="eniSaveMember()">保存</button></div>';
  modalBg.style.display = 'flex';
}

function eniSaveMember() {
  var editId = document.getElementById('eniEditId');
  var parentInput = document.getElementById('eniParentInput');
  var nameInput = document.getElementById('eniNameInput');
  var walletInput = document.getElementById('eniWalletInput');
  var investmentInput = document.getElementById('eniInvestmentInput');
  var stakingRewardInput = document.getElementById('eniStakingRewardInput');
  var teamRewardInput = document.getElementById('eniTeamRewardInput');
  if (!editId || !walletInput) return;
  var wallet = String(walletInput.value || '').trim();
  if (!wallet) {
    if (typeof showToast === 'function') showToast('⚠️ ウォレットアドレスは必須です');
    return;
  }
  var id = editId.value || ('eni_' + Date.now());
  var isEdit = !!editId.value;
  var old = isEdit ? eniFindMember(id) : null;
  var obj = {
    id: id,
    parent: (parentInput && parentInput.value) ? parentInput.value : null,
    name: String(nameInput && nameInput.value || '').trim(),
    walletAddress: wallet,
    username: wallet,
    investment: Number(investmentInput && investmentInput.value) || 0,
    stakingReward: Number(stakingRewardInput && stakingRewardInput.value) || 0,
    teamReward: Number(teamRewardInput && teamRewardInput.value) || 0,
    open: old && old.open != null ? old.open : true
  };
  if (old) {
    if (old.seriesIndex != null) obj.seriesIndex = old.seriesIndex;
    if (old.seriesRootId != null) obj.seriesRootId = old.seriesRootId;
    if (old.sortOrder != null) obj.sortOrder = old.sortOrder;
    var idx = eniMembers.findIndex(function (m) { return m.id === id; });
    if (idx >= 0) eniMembers[idx] = obj;
  } else {
    if (typeof aimApplyOrgMemberSeriesMeta === 'function') {
      aimApplyOrgMemberSeriesMeta('eni', obj, obj.parent);
    }
    if (typeof aimEnsureMemberSortOrderAtEnd === 'function') {
      aimEnsureMemberSortOrderAtEnd('eni', obj);
    }
    eniMembers.push(obj);
  }
  if (!obj.parent && eniRootAccountIds.indexOf(obj.id) < 0) eniRootAccountIds.push(obj.id);
  if (!obj.parent) eniRootId = obj.id;
  eniFocusId = obj.id;
  if (typeof settings !== 'undefined') settings.lastUpdate = new Date().toLocaleString();
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  eniRender();
}

function eniOpenEditById(id) {
  var m = eniFindMember(id);
  if (!m) return;
  eniOpenEdit(Object.assign({}, m, { forceManual: true }));
}

function eniDeleteMember(id) {
  var m = eniFindMember(id);
  if (!m) return;
  if (m.id === eniRootId && eniRootAccountIds.length <= 1 && !m.parent) {
    if (typeof showToast === 'function') showToast('⚠️ 最後のルートアカウントは削除できません');
    return;
  }
  var kids = eniChildrenOf(id);
  var msg = kids.length
    ? '「' + eniDisplayName(m) + '」と配下 ' + eniCalcTeamCount(id) + ' 人を組織図から削除しますか？'
    : '「' + eniDisplayName(m) + '」を組織図から削除しますか？';
  if (!window.confirm(msg)) return;
  var ids = eniSubtreeIds(id);
  if (typeof aimRemoveOrgMembersOnly === 'function') {
    aimRemoveOrgMembersOnly('eni', ids);
  } else {
    var rm = {};
    ids.forEach(function (x) { rm[x] = true; });
    eniMembers = eniMembers.filter(function (x) { return !rm[x.id]; });
    eniRootAccountIds = eniRootAccountIds.filter(function (x) { return !rm[x]; });
    if (rm[eniRootId]) eniRootId = eniRootAccountIds[0] || '';
  }
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  eniRender();
}

function eniShowDetail(id) {
  var m = eniFindMember(id);
  if (!m) return;
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  eniFocusId = id;
  var teamVol = eniCalcTeamVolume(id);
  var teamCount = eniCalcTeamCount(id);
  var depth = eniDepthFromRoot(id, eniRootId);
  var tier = eniVolumeTier(teamVol);
  modalTitle.textContent = eniDisplayName(m) + ' 詳細';
  modalContent.innerHTML =
    '<div class="detailGrid">' +
    '<div class="detailBox"><div class="label">名前</div><div class="val">' + eniEscape(eniDisplayName(m)) + '</div></div>' +
    '<div class="detailBox"><div class="label">ウォレット下4桁</div><div class="val">' +
    eniEscape(eniWalletLabel(m.walletAddress)) + '</div></div>' +
    '<div class="detailBox"><div class="label">段数</div><div class="val">' + eniEscape(eniDepthLabel(depth)) + '</div></div>' +
    '<div class="detailBox"><div class="label">ステーキング額</div><div class="val">' + eniMoney(eniGetStakingAmount(id)) + '</div></div>' +
    '<div class="detailBox"><div class="label">チーム実績</div><div class="val eniVolValue eniVolTier-' + tier + '">' +
    eniMoney(teamVol) + '</div></div>' +
    '<div class="detailBox"><div class="label">チーム人数</div><div class="val">' + teamCount + '人</div></div>' +
    '</div>' +
    '<div class="lineBox"><b>管理</b>' +
    '<p class="help">「表示に追加」で実績入力・収益管理・売上管理の対象になります。</p>' +
    '<div class="accountManageActions">' +
    '<button type="button" class="btn2" onclick="pfAddManageDisplayFromOrgUi(\'eni\',\'' + m.id + '\')">表示に追加</button>' +
    '<button type="button" onclick="eniOpenEditById(\'' + m.id + '\')">編集</button>' +
    '<button type="button" class="btn2" onclick="eniAddChild(\'' + m.id + '\')">配下追加</button>' +
    '<button type="button" class="btn2" onclick="eniExportSubtree(\'' + m.id + '\')">配下保存</button>' +
    '<button type="button" class="btn2" onclick="eniImportSubtree(\'' + m.id + '\')">配下挿入</button>' +
    (m.id !== eniRootId
      ? '<button type="button" class="btn2" onclick="eniOpenMove(\'' + m.id + '\')">移動</button>' +
        '<button type="button" class="btnDanger" onclick="eniDeleteMember(\'' + m.id + '\')">削除</button>'
      : '') +
    '</div></div>';
  modalBg.style.display = 'flex';
}

function eniMakeSharePackage(id, type) {
  var ids = eniSubtreeIds(id);
  var root = eniFindMember(id);
  return {
    version: '2.0.9',
    app: 'OUKEI HUB',
    project: 'eni',
    type: type || 'subtree',
    exportedAt: new Date().toLocaleString(),
    rootId: id,
    rootName: eniDisplayName(root || {}),
    members: eniMembers.filter(function (m) { return ids.indexOf(m.id) >= 0; }).map(function (m) {
      return {
        id: m.id,
        parent: m.parent || null,
        name: m.name || '',
        walletAddress: m.walletAddress || m.username || '',
        username: m.username || m.walletAddress || '',
        investment: Number(m.investment) || 0,
        stakingReward: Number(m.stakingReward) || 0,
        teamReward: Number(m.teamReward) || 0,
        open: m.open !== false,
        sortOrder: m.sortOrder,
        seriesIndex: m.seriesIndex,
        seriesRootId: m.seriesRootId
      };
    })
  };
}

function eniExportSubtree(id) {
  var m = eniFindMember(id);
  if (!m) return;
  if (typeof downloadSharePackage === 'function') {
    downloadSharePackage(eniMakeSharePackage(id, 'subtree'), 'OUKEI_ENI_SUBTREE');
  }
  if (typeof showToast === 'function') {
    showToast('✅ ' + eniDisplayName(m) + '配下を保存しました');
  }
}

function eniReadHubFile(cb) {
  if (typeof readHubFile === 'function') {
    readHubFile(cb);
    return;
  }
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.onchange = function (e) {
    var f = e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try { cb(JSON.parse(r.result), f); } catch (err) { alert('読込できませんでした'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

function eniImportPackage(d, parentId, asRoot) {
  if (!d || !Array.isArray(d.members) || !d.members.length) {
    alert('OUKEI HUB共有ファイルではありません');
    return null;
  }
  var oldRoot = d.rootId || (d.members.find(function (m) { return !m.parent; }) || {}).id;
  if (!oldRoot) oldRoot = d.members[0].id;
  var stamp = Date.now().toString(36);
  var idMap = {};
  d.members.forEach(function (m, i) { idMap[m.id] = 'eimp_' + stamp + '_' + i; });
  var imported = d.members.map(function (m) {
    var wallet = m.walletAddress || m.username || '';
    var copy = {
      id: idMap[m.id],
      parent: m.id === oldRoot ? (asRoot ? null : parentId) : (idMap[m.parent] || null),
      name: String(m.name || '').trim(),
      walletAddress: wallet,
      username: wallet,
      investment: Number(m.investment) || 0,
      stakingReward: Number(m.stakingReward) || 0,
      teamReward: Number(m.teamReward) || 0,
      open: true
    };
    if (m.sortOrder != null) copy.sortOrder = m.sortOrder;
    return copy;
  });
  eniMembers = eniMembers.concat(imported);
  var newRoot = idMap[oldRoot] || imported[0].id;
  if (asRoot && eniRootAccountIds.indexOf(newRoot) < 0) eniRootAccountIds.push(newRoot);
  if (typeof settings !== 'undefined') settings.lastUpdate = new Date().toLocaleString();
  return newRoot;
}

function eniImportSubtree(parentId) {
  var p = eniFindMember(parentId);
  if (!p) return alert('導入先がありません');
  eniReadHubFile(function (d) {
    if (!d || !Array.isArray(d.members) || !d.members.length) {
      return alert('OUKEI HUB共有ファイルではありません');
    }
    if (d.project && d.project !== 'eni') {
      if (!confirm('ENI以外の共有ファイルの可能性があります。配下として挿入しますか？')) return;
    }
    var newRoot = eniImportPackage(d, parentId, false);
    if (newRoot) {
      p.open = true;
      eniFocusId = newRoot;
      if (typeof markActivity === 'function') markActivity();
      eniRender();
      if (typeof showToast === 'function') showToast('✅ 配下を挿入しました');
    }
  });
}

function eniOpenMove(id) {
  var moving = eniFindMember(id);
  if (!moving) return;
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  var banned = {};
  eniSubtreeIds(id).forEach(function (x) { banned[x] = true; });
  var opts = '<option value="">親なし（ルート）</option>' + eniMembers.filter(function (m) {
    return !banned[m.id];
  }).map(function (m) {
    return '<option value="' + eniEscape(m.id) + '"' +
      (moving.parent === m.id ? ' selected' : '') + '>' +
      eniEscape(eniDisplayName(m)) + '</option>';
  }).join('');
  modalTitle.textContent = '移動';
  modalContent.innerHTML =
    '<div class="lineBox"><b>' + eniEscape(eniDisplayName(moving)) + '</b>' +
    '<p class="help">移動先を選択してください。</p>' +
    '<select id="eniMoveParentInput">' + opts + '</select>' +
    '<button type="button" onclick="eniSaveMove(\'' + id + '\')">移動する</button></div>';
  modalBg.style.display = 'flex';
}

function eniSaveMove(id) {
  var m = eniFindMember(id);
  if (!m) return;
  var sel = document.getElementById('eniMoveParentInput');
  var newParent = sel && sel.value ? sel.value : null;
  if (newParent) {
    var banned = {};
    eniSubtreeIds(id).forEach(function (x) { banned[x] = true; });
    if (banned[newParent]) {
      if (typeof showToast === 'function') showToast('⚠️ 配下へは移動できません');
      return;
    }
  }
  m.parent = newParent;
  if (!newParent && eniRootAccountIds.indexOf(m.id) < 0) eniRootAccountIds.push(m.id);
  if (newParent) {
    eniRootAccountIds = eniRootAccountIds.filter(function (x) { return x !== m.id; });
    var p = eniFindMember(newParent);
    if (p) p.open = true;
  }
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  eniRender();
  if (typeof showToast === 'function') showToast('✅ ' + eniDisplayName(m) + 'を移動しました');
}

function eniShowMemberStats() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  var total = eniRootId ? eniSubtreeIds(eniRootId).length : 0;
  var team = eniRootId ? eniCalcTeamCount(eniRootId) : 0;
  var vol = eniRootId ? eniCalcTeamVolume(eniRootId) : 0;
  modalTitle.textContent = 'ENI 組織人数';
  modalContent.innerHTML =
    '<div class="lineBox">表示中アカウントを含む登録数：<b>' + total + '件</b><br>' +
    '配下人数（本人除く）：<b>' + team + '人</b><br>' +
    'チーム実績：<b>' + eniMoney(vol) + '</b></div>';
  modalBg.style.display = 'flex';
}

function eniOpenRootQuickAdd() {
  if (typeof aimRenderOrgPlacementModal === 'function') {
    aimRenderOrgPlacementModal('eni', null);
    return;
  }
  eniOpenEdit({ parent: null, forceManual: true });
}

function eniCenterRootNode() {
  try {
    var vp = document.getElementById('eniViewport');
    var root = document.querySelector('#eniTree .node.root');
    if (!vp || !root) return;
    var r = root.getBoundingClientRect();
    var v = vp.getBoundingClientRect();
    vp.scrollLeft += (r.left + r.width / 2) - (v.left + v.width / 2);
    vp.scrollTop += (r.top + r.height / 2) - (v.top + Math.min(v.height * 0.35, 220));
  } catch (e) {}
}

function eniZoomIn() {
  eniZoom = Math.min(2, eniZoom + 0.1);
  eniRender();
  setTimeout(eniCenterRootNode, 120);
}

function eniZoomOut() {
  eniZoom = Math.max(0.35, eniZoom - 0.1);
  eniRender();
  setTimeout(eniCenterRootNode, 120);
}

function eniFitView() {
  eniZoom = 0.72;
  eniRender();
  setTimeout(eniCenterRootNode, 120);
}

function eniInitPinchZoom() {
  if (eniPinchBound) return;
  var vp = document.getElementById('eniViewport');
  if (vp) {
    vp.addEventListener('wheel', function (e) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        eniZoom = Math.max(0.35, Math.min(2, eniZoom + (e.deltaY < 0 ? 0.08 : -0.08)));
        var canvas = document.getElementById('eniCanvas');
        if (canvas) canvas.style.transform = 'scale(' + eniZoom + ')';
        setTimeout(eniCenterRootNode, 80);
      }
    }, { passive: false });
  }
  var area = document.querySelector('#eniOrgPage .chartArea');
  if (area) {
    area.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        eniPinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        eniPinchStartZoom = eniZoom;
      }
    }, { passive: true });
    area.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && eniPinchStartDist > 0) {
        e.preventDefault();
        var d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        eniZoom = Math.max(0.35, Math.min(2, eniPinchStartZoom * (d / eniPinchStartDist)));
        var canvas = document.getElementById('eniCanvas');
        if (canvas) canvas.style.transform = 'scale(' + eniZoom + ')';
      }
    }, { passive: false });
  }
  eniPinchBound = true;
}

function eniShowAccountManage() {
  eniOpenAggregationPanel();
}

function eniOpenAggregationPanel() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = 'ENI 集計';
  modalContent.innerHTML =
    '<div class="lineBox"><b>準備中</b>' +
    '<p class="help">ENIの集計画面はまだ準備中です。組織図のカード・詳細からチーム実績・人数を確認できます。</p></div>';
  modalBg.style.display = 'flex';
}

function eniOpenSimulationPanel() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = 'シミュレーション';
  modalContent.innerHTML =
    '<div class="lineBox"><b>準備中</b>' +
    '<p class="help">ENI専用のシミュレーション機能はまだ準備中です。</p></div>';
  modalBg.style.display = 'flex';
}

function eniExportCurrentOrg() {
  var m = eniFindMember(eniRootId);
  if (!m) return alert('表示中の組織図がありません');
  if (typeof downloadSharePackage === 'function') {
    downloadSharePackage(eniMakeSharePackage(eniRootId, 'org-root'), 'OUKEI_ENI_ORG');
  }
  if (typeof showToast === 'function') showToast('✅ ENI組織図をエクスポートしました');
}

function eniImportOrgAsRoot() {
  eniReadHubFile(function (d) {
    if (!d || !Array.isArray(d.members) || !d.members.length) {
      return alert('OUKEI HUB共有ファイルではありません');
    }
    if (!confirm('ENI組織図を新規導入します。よろしいですか？')) return;
    var newRoot = eniImportPackage(d, null, true);
    if (newRoot) {
      eniRootId = newRoot;
      eniFocusId = newRoot;
      if (typeof markActivity === 'function') markActivity();
      eniRender();
      if (typeof showToast === 'function') showToast('✅ 組織図をインポートしました');
    }
  });
}

function eniImportSubtreeToRoot() {
  if (!eniRootId) return alert('表示中の組織図がありません');
  eniImportSubtree(eniRootId);
}

function eniUnpinRootAccount(targetId) {
  var m = eniFindMember(targetId);
  if (!m) return;
  if (!confirm(eniDisplayName(m) + ' を組織図切替一覧から外しますか？')) return;
  eniRootAccountIds = eniRootAccountIds.filter(function (x) { return x !== targetId; });
  if (eniRootId === targetId) {
    eniRootId = eniRootAccountIds[0] || '';
    eniFocusId = eniRootId;
  }
  if (typeof markActivity === 'function') markActivity();
  eniRender();
}

function eniRenameRootAccount() {
  var m = eniFindMember(eniRootId);
  if (!m) return;
  var name = prompt('組織図名を変更', m.name || '');
  if (name == null) return;
  m.name = String(name).trim();
  if (typeof markActivity === 'function') markActivity();
  eniRender();
}

function eniDeleteRootAccount() {
  if (eniRootAccountIds.length <= 1) return alert('最後の組織図は削除できません');
  var target = eniFindMember(eniRootId);
  if (!target) return;
  if (!confirm('表示中の親アカウント「' + eniDisplayName(target) +
      '」と配下を組織図から削除しますか？実績入力・収益履歴・売上履歴は保持されます。')) return;
  var rm = eniSubtreeIds(eniRootId);
  if (typeof aimRemoveOrgMembersOnly === 'function') {
    aimRemoveOrgMembersOnly('eni', rm);
  } else {
    var set = {};
    rm.forEach(function (x) { set[x] = true; });
    eniMembers = eniMembers.filter(function (x) { return !set[x.id]; });
    eniRootAccountIds = eniRootAccountIds.filter(function (x) { return !set[x]; });
  }
  eniRootId = eniRootAccountIds[0] || '';
  eniFocusId = eniRootId;
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  eniRender();
}

function eniOpenAccountManager() {
  eniEnsureRootAccounts();
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = 'ENI組織図管理';
  modalContent.innerHTML =
    '<div class="lineBox"><b>表示中の組織図</b><p class="help">切替一覧から外す操作ができます。</p>' +
    eniRootAccountIds.map(function (id) {
      var m = eniFindMember(id);
      if (!m) return '';
      return '<div class="lineBox"><b>' + eniEscape(eniDisplayName(m)) + '</b><div class="accountManageActions">' +
        '<button type="button" class="btn2 smallCtl" onclick="eniUnpinRootAccount(\'' + id + '\')">切替から外す</button></div></div>';
    }).join('') + '</div>' +
    '<div class="lineBox"><b>組織図共有</b><p class="help">表示中の親アカウント配下を保存・読込できます。</p>' +
    '<div class="accountManageActions">' +
    '<button type="button" onclick="eniExportCurrentOrg()">組織図エクスポート</button>' +
    '<button type="button" class="btn2" onclick="eniImportOrgAsRoot()">組織図インポート</button>' +
    '<button type="button" class="btn2" onclick="eniImportSubtreeToRoot()">配下を導入</button></div></div>' +
    '<div class="lineBox"><b>名称変更</b><button type="button" class="btn2" onclick="eniRenameRootAccount()">名称変更</button></div>' +
    '<div class="lineBox"><b>親アカウント削除</b><p class="dangerNote">現在表示中の親アカウントと配下を削除します。</p>' +
    '<button type="button" class="btnDanger" onclick="eniDeleteRootAccount()">削除</button></div>';
  modalBg.style.display = 'flex';
}

if (typeof window !== 'undefined') {
  window.eniMembers = eniMembers;
  window.eniPackOrgChart = eniPackOrgChart;
  window.eniApplyOrgChart = eniApplyOrgChart;
  window.eniRender = eniRender;
  window.eniShowAccountManage = eniShowAccountManage;
  window.eniOpenAggregationPanel = eniOpenAggregationPanel;
  window.eniOpenSimulationPanel = eniOpenSimulationPanel;
  window.eniOpenAccountManager = eniOpenAccountManager;
  window.eniExportCurrentOrg = eniExportCurrentOrg;
  window.eniImportOrgAsRoot = eniImportOrgAsRoot;
  window.eniImportSubtreeToRoot = eniImportSubtreeToRoot;
  window.eniUnpinRootAccount = eniUnpinRootAccount;
  window.eniRenameRootAccount = eniRenameRootAccount;
  window.eniDeleteRootAccount = eniDeleteRootAccount;
  window.eniReflectionRate = eniReflectionRate;
  window.eniInitPinchZoom = eniInitPinchZoom;
  window.eniCenterRootNode = eniCenterRootNode;
  window.eniSwitchRootAccount = eniSwitchRootAccount;
  window.eniAddChild = eniAddChild;
  window.eniOpenEdit = eniOpenEdit;
  window.eniOpenEditById = eniOpenEditById;
  window.eniSaveMember = eniSaveMember;
  window.eniDeleteMember = eniDeleteMember;
  window.eniShowDetail = eniShowDetail;
  window.eniShowMemberStats = eniShowMemberStats;
  window.eniOpenRootQuickAdd = eniOpenRootQuickAdd;
  window.eniToggleOpen = eniToggleOpen;
  window.eniReorderSibling = eniReorderSibling;
  window.eniZoomIn = eniZoomIn;
  window.eniZoomOut = eniZoomOut;
  window.eniFitView = eniFitView;
  window.eniCalcTeamVolume = eniCalcTeamVolume;
  window.eniCalcTeamCount = eniCalcTeamCount;
  window.eniVolumeTier = eniVolumeTier;
  window.eniWalletShort = eniWalletShort;
  window.eniDepthFromRoot = eniDepthFromRoot;
  window.eniDepthLabel = eniDepthLabel;
  window.eniExportSubtree = eniExportSubtree;
  window.eniImportSubtree = eniImportSubtree;
  window.eniOpenMove = eniOpenMove;
  window.eniSaveMove = eniSaveMove;
  window.eniMakeSharePackage = eniMakeSharePackage;
}
