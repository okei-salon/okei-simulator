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
var eniSimMode = false;
var eniStakeOverride = null; // シミュレーション仮計算用（実データ非反映）
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
  // シミュレーション中は仮データを永続化しない
  var liveMembers = eniSimMode ? eniCurrentData : eniMembers;
  return {
    members: liveMembers,
    currentData: eniSimMode ? eniCurrentData : (eniCurrentData.length ? eniCurrentData : liveMembers),
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
  eniSimMode = false;
  eniStakeOverride = null;
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
 * - シミュレーション中：仮組織図ノードの investment のみ（実績・PFに影響させない）
 * - 通常：実績入力アカウントは運用額履歴を優先、それ以外はノード investment
 */
function eniGetStakingAmount(id) {
  if (!id) return 0;
  if (eniStakeOverride && Object.prototype.hasOwnProperty.call(eniStakeOverride, id)) {
    return eniRoundReward(Number(eniStakeOverride[id]) || 0);
  }
  if (eniStakeCache[id] != null) return eniStakeCache[id];
  var m = eniFindMember(id);
  if (!m || !eniIsMemberActive(m)) {
    eniStakeCache[id] = 0;
    return 0;
  }
  // シミュレーション中はノード編集値をそのまま使う
  if (eniSimMode) {
    var simAmt = eniRoundReward(Number(m.investment) || 0);
    eniStakeCache[id] = simAmt;
    return simAmt;
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

/** 世代解放に必要な直紹介人数（将来の「あと○人で解放」表示用） */
function eniDirectsNeededForGen(gen) {
  var g = Number(gen) || 0;
  if (g === 1) return 1;
  if (g === 2) return 2;
  if (g === 3) return 3;
  if (g === 4) return 4;
  if (g === 5) return 5;
  if (g === 6) return 6;
  if (g >= 7 && g <= 20) return 7;
  if (g >= 21 && g <= 30) return 8;
  if (g >= 31 && g <= 100) return 9;
  return null;
}

function eniEmptyRewardState() {
  return {
    stakingDaily: 0,
    stakingMonthly: 0,
    teamDaily: 0,
    teamMonthly: 0,
    totalMonthly: 0,
    teamVolume: 0,
    directCount: 0,
    generations: [],
    visibleGenerations: []
  };
}

function eniFormatUsdtAmount(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  v = eniRoundReward(v);
  var text = v.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return text + ' USDT';
}

function eniFormatRatePct(rate) {
  var pct = (Number(rate) || 0) * 100;
  var rounded = Math.round(pct * 1000) / 1000;
  return String(rounded) + '%';
}

function eniFormatPlainAmount(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  v = eniRoundReward(v);
  return v.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * 指定アカウントを基点にした報酬・実績・世代内訳。
 * 各ノードは「そのノード自身の直紹介人数・世代解放」で独立計算する。
 */
function eniCalcRewardsFor(rootId) {
  if (!rootId) return eniEmptyRewardState();
  if (eniRewardCache[rootId]) return eniRewardCache[rootId];
  var root = eniFindMember(rootId);
  if (!root || !eniIsMemberActive(root)) {
    var empty = eniEmptyRewardState();
    eniRewardCache[rootId] = empty;
    return empty;
  }

  var stake = eniGetStakingAmount(rootId);
  var stakingDaily = eniDailyStakingReward(stake);
  var stakingMonthly = eniMonthlyFromDaily(stakingDaily);

  var directs = eniChildrenOf(rootId);
  var directCount = directs.length;
  var teamDaily = 0;
  var byGen = {};
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

    var childStake = eniGetStakingAmount(item.id);
    if (!byGen[item.gen]) {
      byGen[item.gen] = { count: 0, stakeTotal: 0, daily: 0 };
    }
    byGen[item.gen].count += 1;
    byGen[item.gen].stakeTotal += childStake;

    var rate = eniGenerationRate(item.gen, directCount);
    if (rate > 0) {
      var memberDaily = eniDailyStakingReward(childStake) * rate;
      byGen[item.gen].daily += memberDaily;
      teamDaily += memberDaily;
    }

    if (item.gen < ENI_MAX_REWARD_GEN) {
      eniChildrenOf(item.id).forEach(function (c) {
        if (!visited[c.id]) queue.push({ id: c.id, gen: item.gen + 1 });
      });
    }
  }

  teamDaily = eniRoundReward(teamDaily);
  var teamMonthly = eniMonthlyFromDaily(teamDaily);
  var generations = [];
  var visibleGenerations = [];
  for (var g = 1; g <= ENI_MAX_REWARD_GEN; g++) {
    var bucket = byGen[g] || { count: 0, stakeTotal: 0, daily: 0 };
    var genRate = eniGenerationRate(g, directCount);
    var unlocked = genRate > 0;
    var directsNeeded = eniDirectsNeededForGen(g);
    var directsRemaining = unlocked || directsNeeded == null
      ? 0
      : Math.max(0, directsNeeded - directCount);
    var genMonthly = unlocked ? eniMonthlyFromDaily(bucket.daily) : 0;
    var row = {
      gen: g,
      count: bucket.count,
      stakeTotal: eniRoundReward(bucket.stakeTotal),
      rate: genRate,
      daily: unlocked ? eniRoundReward(bucket.daily) : 0,
      monthly: genMonthly,
      unlocked: unlocked,
      directsNeeded: directsNeeded,
      directsRemaining: directsRemaining
    };
    generations.push(row);
    if (unlocked && row.count > 0) visibleGenerations.push(row);
  }

  var result = {
    stakingDaily: stakingDaily,
    stakingMonthly: stakingMonthly,
    teamDaily: teamDaily,
    teamMonthly: teamMonthly,
    totalMonthly: eniRoundReward(stakingMonthly + teamMonthly),
    teamVolume: eniCalcTeamVolume(rootId),
    directCount: directCount,
    generations: generations,
    visibleGenerations: visibleGenerations
  };
  eniRewardCache[rootId] = result;
  return result;
}

/** チーム報酬の世代別内訳（上部カードと同値） */
function eniCalcTeamRewardBreakdown(rootId) {
  var rewards = eniCalcRewardsFor(rootId);
  return {
    directCount: rewards.directCount,
    generations: rewards.generations || [],
    visibleGenerations: rewards.visibleGenerations || [],
    teamDaily: rewards.teamDaily,
    teamMonthly: rewards.teamMonthly
  };
}

function eniShowAllAccountsTeamRewardDetail() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') {
    return;
  }
  var s = eniAllOrgSummary();
  var rows = (s.list || []).map(function (x) {
    return '<div class="eniAggTeamAllRow">' +
      '<div class="eniAggTeamAllName">' + eniEscape(x.name || x.id) + '</div>' +
      '<div class="eniAggTeamAllVal">' + eniEscape(eniAggFormatMonth(x.team)) + '</div>' +
      '</div>';
  }).join('');
  modalTitle.textContent = 'チーム報酬内訳';
  modalContent.innerHTML =
    '<div class="eniTeamBreakdown">' +
    '<p class="eniHelpLead">アカウントごとのチーム報酬一覧です。組織を横断して1つの世代構造としては計算していません。</p>' +
    '<div class="eniAggTeamAllList">' +
    (rows || '<div class="eniGenEmpty">表示できるアカウントがありません</div>') +
    '</div>' +
    '<div class="eniTeamBreakdownTotal">' +
    '<div class="eniTeamBreakdownTotalLabel">全アカウント合計</div>' +
    '<div class="eniTeamBreakdownTotalValue">' +
    eniEscape(eniAggFormatMonth(s.team)) + '</div>' +
    '</div>' +
    '</div>';
  modalBg.style.display = 'flex';
  if (modalContent.scrollTop != null) modalContent.scrollTop = 0;
}

function eniShowTeamRewardDetail(accountId) {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') {
    return;
  }
  if (accountId === 'all' || accountId === '') {
    eniShowAllAccountsTeamRewardDetail();
    return;
  }
  var targetId = accountId || eniRootId;
  var root = targetId ? eniFindMember(targetId) : null;
  if (!root || !eniIsMemberActive(root)) {
    if (typeof showToast === 'function') showToast('⚠️ 表示中のアカウントがありません');
    return;
  }
  var breakdown = eniCalcTeamRewardBreakdown(root.id);
  var cards = breakdown.visibleGenerations.map(function (row) {
    var stakeText = eniFormatPlainAmount(row.stakeTotal);
    var rateText = eniFormatRatePct(row.rate);
    var monthlyText = eniFormatUsdtAmount(row.monthly);
    return '<div class="eniGenCard">' +
      '<div class="eniGenCardHead">' +
      '<div class="eniGenTitle">第' + row.gen + '世代</div>' +
      '<span class="eniGenCountBadge">' + row.count + '人</span>' +
      '</div>' +
      '<div class="eniGenRewardBlock">' +
      '<div class="eniGenRewardLabel">月間報酬</div>' +
      '<div class="eniGenReward">' + eniEscape(monthlyText) + '</div>' +
      '</div>' +
      '<div class="eniGenMeta">' +
      '<div class="eniGenMetaRow"><span>💰 ステーキング合計</span><b>' +
      eniEscape(stakeText + ' USDT') + '</b></div>' +
      '<div class="eniGenMetaRow"><span>📈 報酬率</span><b>' +
      eniEscape(rateText) + '</b></div>' +
      '</div>' +
      '<div class="eniGenFormula">' +
      '<div class="eniGenFormulaTitle">【計算式】</div>' +
      '<div class="eniGenFormulaBody">' +
      eniEscape(stakeText) + ' × 0.9%<br>' +
      '× 30日<br>' +
      '× ' + eniEscape(rateText) + '<br>' +
      '<span class="eniGenFormulaResult">＝ ' + eniEscape(monthlyText) + '／月</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  modalTitle.textContent = 'チーム報酬内訳';
  modalContent.innerHTML =
    '<div class="eniTeamBreakdown">' +
    (cards || '<div class="eniGenEmpty">解放済み世代にメンバーがいません</div>') +
    '<div class="eniTeamBreakdownTotal">' +
    '<div class="eniTeamBreakdownTotalLabel">チーム報酬合計</div>' +
    '<div class="eniTeamBreakdownTotalValue">' +
    eniEscape(eniFormatUsdtAmount(breakdown.teamMonthly)) + '／月</div>' +
    '</div>' +
    '</div>';
  modalBg.style.display = 'flex';
  if (modalContent.scrollTop != null) modalContent.scrollTop = 0;
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
  if (!eniSimMode) eniCurrentData = eniClone(eniMembers);
  eniRenderStats();
  eniRenderRootAccounts();
  if (eniRootId && eniFindMember(eniRootId)) eniFocusId = eniRootId;
  eniRenderCards();
  eniRenderTree();
  var canvas = document.getElementById('eniCanvas');
  if (canvas) canvas.style.transform = 'scale(' + eniZoom + ')';
  if (typeof initOrgChartTitleIcons === 'function') initOrgChartTitleIcons();

  var badge = document.getElementById('eniModeBadge');
  var banner = document.getElementById('eniOrgSimBanner');
  var page = document.getElementById('eniOrgPage');
  if (badge) {
    badge.className = eniSimMode ? 'compactBadge orgModeBadge--sim' : 'compactBadge orgModeBadge--live';
    badge.textContent = eniSimMode ? '🟣 シミュレーション中' : '🟢 現在データ';
  }
  if (page) page.dataset.mode = eniSimMode ? 'simulation' : 'live';
  if (banner) banner.classList.toggle('isVisible', !!eniSimMode);

  if (typeof eniRenderAccountManage === 'function') eniRenderAccountManage();

  // シミュレーション中は LocalStorage / Cloud へ書き込まない
  if (!eniSimMode && typeof hubSaveToStorage === 'function') hubSaveToStorage();
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

function eniHelpCard(title, bodyHtml) {
  return '<div class="eniHelpCard">' +
    '<div class="eniHelpCardTitle">' + title + '</div>' +
    '<div class="eniHelpCardBody">' + bodyHtml + '</div>' +
    '</div>';
}

function eniNormalizeHelpContext(ctx) {
  if (ctx === 'all' || (ctx && ctx.allAccounts)) {
    return { mode: 'all' };
  }
  var accountId = null;
  if (typeof ctx === 'string' && ctx) accountId = ctx;
  else if (ctx && ctx.accountId) accountId = ctx.accountId;
  else if (eniRootId) accountId = eniRootId;
  if (accountId && eniFindMember(accountId)) {
    return { mode: 'account', accountId: accountId };
  }
  return { mode: 'generic' };
}

function eniCardHelpTotalBody(ctx) {
  var c = eniNormalizeHelpContext(ctx);
  var html = '<p class="eniHelpLead">ステーキング報酬とチーム報酬を合計した予測月間利益です。</p>' +
    eniHelpCard('計算式', '合計利益 ＝ ステーキング報酬 ＋ チーム報酬');
  if (c.mode === 'account') {
    var s = eniGetDisplaySummary(c.accountId);
    html += eniHelpCard('今回の数値',
      'ステーキング報酬：' + eniEscape(eniAggFormatMonth(s.staking)) + '<br>' +
      'チーム報酬：' + eniEscape(eniAggFormatMonth(s.team)) + '<br><br>' +
      '<b>合計利益：' + eniEscape(eniAggFormatMonth(s.total)) + '</b>');
  } else if (c.mode === 'all') {
    var all = eniAggregateTotals();
    html += eniHelpCard('全アカウント合計',
      '各アカウントの合計利益を足し合わせた値です。<br><br>' +
      'ステーキング報酬：' + eniEscape(eniAggFormatMonth(all.staking)) + '<br>' +
      'チーム報酬：' + eniEscape(eniAggFormatMonth(all.team)) + '<br><br>' +
      '<b>合計利益：' + eniEscape(eniAggFormatMonth(all.total)) + '</b>');
  }
  return html;
}

function eniCardHelpStakingBody(ctx) {
  var c = eniNormalizeHelpContext(ctx);
  var html = '<p class="eniHelpLead">ステーキング額に応じて毎日発生する報酬です。</p>' +
    eniHelpCard('計算式', 'ステーキング額 × 0.9% × 30日');
  if (c.mode === 'account') {
    var stake = eniGetStakingAmount(c.accountId);
    var monthly = eniGetDisplaySummary(c.accountId).staking;
    html += eniHelpCard('計算例',
      '<div class="eniHelpExampleLines">' +
      eniEscape(eniFormatPlainAmount(stake)) + ' × 0.9% × 30日<br>' +
      '＝ <b>' + eniEscape(eniAggFormatMonth(monthly)) + '</b>' +
      '</div>');
  } else if (c.mode === 'all') {
    var allS = eniAggregateTotals();
    html += eniHelpCard('全アカウント合計',
      '各アカウントのステーキング報酬を合計した値です。<br><br>' +
      '<b>' + eniEscape(eniAggFormatMonth(allS.staking)) + '</b>');
  } else {
    html += eniHelpCard('計算例',
      '<div class="eniHelpExampleLabel">300USDTの場合</div>' +
      '<div class="eniHelpExampleLines">' +
      '300 × 0.9% × 30日<br>' +
      '＝ <b>81 USDT／月</b>' +
      '</div>');
  }
  return html;
}

function eniCardHelpTeamBody(ctx) {
  var rows = [
    ['直紹介1人', '第1世代', '5%'],
    ['直紹介2人', '第2世代', '6%'],
    ['直紹介3人', '第3世代', '7%'],
    ['直紹介4人', '第4世代', '8%'],
    ['直紹介5人', '第5世代', '9%'],
    ['直紹介6人', '第6世代', '10%'],
    ['直紹介7人', '第7〜20世代', '3%'],
    ['直紹介8人', '第21〜30世代', '2%'],
    ['直紹介9人', '第31〜100世代', '0.5%']
  ];
  var table = '<table class="helpTable eniHelpTable">' +
    '<thead><tr><th>直紹介人数</th><th>報酬対象</th><th>報酬率</th></tr></thead><tbody>' +
    rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
    }).join('') +
    '</tbody></table>';
  return '<p class="eniHelpLead">配下メンバーのステーキング報酬から発生する紹介報酬です。</p>' +
    eniHelpCard('世代解放条件', table +
      '<p class="eniHelpNote">※直紹介9人で最大100世代までのチーム報酬を受け取ることができます。</p>') +
    eniHelpCard('計算例',
      '<div class="eniHelpExampleLabel">第1世代に300USDTのメンバーがいる場合</div>' +
      '<div class="eniHelpExampleLines">' +
      '<div class="eniHelpExampleSub">ステーキング報酬</div>' +
      '300 × 0.9% × 30日<br>' +
      '＝ 81 USDT／月<br><br>' +
      '<div class="eniHelpExampleSub">チーム報酬</div>' +
      '81 × 5%<br>' +
      '＝ <b>4.05 USDT／月</b>' +
      '</div>');
}

function eniCardHelpVolumeBody(ctx) {
  var c = eniNormalizeHelpContext(ctx);
  var html = '<p class="eniHelpLead">自分より下のメンバー全員のステーキング額合計です。</p>' +
    '<p class="eniHelpLead">組織全体の規模や成長状況を確認するための指標として表示しています。</p>';
  if (c.mode === 'account') {
    var vol = eniGetDisplaySummary(c.accountId).volume;
    html += eniHelpCard('今回の数値',
      '<b>チーム実績：' + eniEscape(eniAggFormatVolume(vol)) + '</b>');
  } else if (c.mode === 'all') {
    var allV = eniAggregateTotals();
    html += eniHelpCard('全アカウント合計',
      '各アカウントのチーム実績を合計した値です。<br><br>' +
      '<b>' + eniEscape(eniAggFormatVolume(allV.volume)) + '</b>');
  } else {
    html += eniHelpCard('計算例',
      '<div class="eniHelpExampleLines">' +
      'Aさん：300USDT<br>' +
      'Bさん：600USDT<br>' +
      'Cさん：1,000USDT<br><br>' +
      'チーム実績<br>' +
      '＝ <b>1,900 USDT</b>' +
      '</div>');
  }
  return html;
}

function eniCardHelpMap(ctx) {
  return {
    total: { title: '合計利益とは？', body: eniCardHelpTotalBody(ctx) },
    staking: { title: 'ステーキング報酬とは？', body: eniCardHelpStakingBody(ctx) },
    team: { title: 'チーム報酬とは？', body: eniCardHelpTeamBody(ctx) },
    volume: { title: 'チーム実績とは？', body: eniCardHelpVolumeBody(ctx) }
  };
}

function eniShowCardHelp(type, ctx) {
  // チーム報酬カード本体タップは内訳画面へ（？説明は type=team のまま）
  var map = eniCardHelpMap(ctx);
  var entry = map[type];
  if (!entry || typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') {
    return;
  }
  modalTitle.textContent = entry.title;
  modalContent.innerHTML = '<div class="explain eniHelpExplain">' + (entry.body || '説明は準備中です。') + '</div>';
  modalBg.style.display = 'flex';
  var body = document.getElementById('modalContent');
  if (body) body.scrollTop = 0;
}

/** 集計画面カードタップ（accountId 空文字 = 全アカウント合計） */
function eniShowAggCardDetail(type, accountId) {
  var isAll = accountId == null || accountId === '' || accountId === 'all';
  if (type === 'team') {
    eniShowTeamRewardDetail(isAll ? 'all' : accountId);
    return;
  }
  eniShowCardHelp(type, isAll ? { allAccounts: true } : { accountId: accountId });
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

/** 表示中アカウントの4指標（上部カードと同一ロジック） */
function eniGetDisplaySummary(rootId) {
  var id = rootId || eniRootId;
  var rewards = eniCalcRewardsFor(id);
  return {
    total: rewards.totalMonthly,
    staking: rewards.stakingMonthly,
    team: rewards.teamMonthly,
    volume: rewards.teamVolume,
    directCount: rewards.directCount
  };
}

function eniAggFormatMonth(n) {
  return eniFormatUsdtAmount(n) + '／月';
}

function eniAggFormatVolume(n) {
  return eniFormatUsdtAmount(n);
}

function eniAggCardOnclickAttr(type, accountId) {
  var idLit = (accountId == null || accountId === '')
    ? "''"
    : "'" + String(accountId).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return ' onclick="eniShowAggCardDetail(\'' + type + '\',' + idLit + ')"';
}

function eniSummaryCardsHtml(summary, opts) {
  opts = opts || {};
  var s = summary || { total: 0, staking: 0, team: 0, volume: 0 };
  var useUsdt = opts.useUsdt !== false;
  var clickable = !!opts.clickable;
  var clickableTeam = !!opts.teamClickable;
  var accountId = opts.accountId;
  var cardOpen = function (type, extraClass) {
    var cls = 'card' + (extraClass ? ' ' + extraClass : '');
    if (clickable || (type === 'team' && clickableTeam)) cls += ' eniCardClickable';
    var attr = ' class="' + cls + '"';
    if (clickable) attr += eniAggCardOnclickAttr(type, accountId);
    else if (type === 'team' && clickableTeam) attr += ' onclick="eniShowTeamRewardDetail()"';
    return '<div' + attr + '>';
  };
  var totalText = useUsdt ? eniAggFormatMonth(s.total) : (eniMoney(s.total) + '/月');
  var stakingText = useUsdt ? eniAggFormatMonth(s.staking) : (eniMoney(s.staking) + '/月');
  var teamText = useUsdt ? eniAggFormatMonth(s.team) : (eniMoney(s.team) + '/月');
  var volumeText = useUsdt ? eniAggFormatVolume(s.volume) : eniMoney(s.volume);
  return '<section class="cards eniIncomeCards eniAggCards">' +
    cardOpen('total', 'total') + '<div class="label">合計利益</div>' +
    '<div class="main">' + eniEscape(totalText) + '</div></div>' +
    cardOpen('staking') + '<div class="label">ステーキング報酬</div>' +
    '<div class="main">' + eniEscape(stakingText) + '</div></div>' +
    cardOpen('team') + '<div class="label">チーム報酬</div>' +
    '<div class="main">' + eniEscape(teamText) + '</div></div>' +
    cardOpen('volume') + '<div class="label">チーム実績</div>' +
    '<div class="main">' + eniEscape(volumeText) + '</div></div>' +
    '</section>';
}

function eniGetRootIdsForSummary() {
  eniEnsureRootAccounts();
  var ids = (eniRootAccountIds || []).filter(function (id) {
    return !!eniFindMember(id);
  });
  if (!ids.length && eniRootId && eniFindMember(eniRootId)) ids = [eniRootId];
  return ids;
}

function eniSummaryFor(id) {
  var m = eniFindMember(id);
  if (!m) {
    return { id: id, name: '-', total: 0, staking: 0, team: 0, volume: 0 };
  }
  var s = eniGetDisplaySummary(id);
  return {
    id: id,
    name: eniDisplayName(m),
    total: s.total,
    staking: s.staking,
    team: s.team,
    volume: s.volume
  };
}

function eniAllOrgSummary() {
  var list = eniGetRootIdsForSummary().map(eniSummaryFor);
  return {
    list: list,
    total: list.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0),
    staking: list.reduce(function (s, x) { return s + (Number(x.staking) || 0); }, 0),
    team: list.reduce(function (s, x) { return s + (Number(x.team) || 0); }, 0),
    volume: list.reduce(function (s, x) { return s + (Number(x.volume) || 0); }, 0)
  };
}

function eniAggregateTotals() {
  var s = eniAllOrgSummary();
  return {
    total: s.total,
    staking: s.staking,
    team: s.team,
    volume: s.volume
  };
}

function eniAggregateCardsHtml(id) {
  var t = id
    ? eniGetDisplaySummary(id)
    : eniAggregateTotals();
  return eniSummaryCardsHtml(t, {
    useUsdt: true,
    clickable: true,
    accountId: id || ''
  });
}

function eniRenderAccountManage() {
  var content = document.getElementById('eniAccountManageContent');
  if (!content) return;
  var s = eniAllOrgSummary();
  var rows = s.list.map(function (x) {
    var m = eniFindMember(x.id) || {};
    var homeLabel = m.homeVisible === false ? 'ホーム表示ON' : 'ホーム非表示';
    return '<div class="lineBox"><b>' + eniEscape(eniDisplayName(m)) + '</b>' +
      '<div class="homeToggleRow">' +
      '<button type="button" class="btn2 smallCtl" onclick="eniAccountManageMove(\'' + x.id + '\',-1)">↑</button>' +
      '<button type="button" class="btn2 smallCtl" onclick="eniAccountManageMove(\'' + x.id + '\',1)">↓</button>' +
      '<button type="button" class="btn2 smallCtl" onclick="eniToggleHomeVisible(\'' + x.id + '\')">' +
      homeLabel + '</button>' +
      '</div>' + eniAggregateCardsHtml(x.id) + '</div>';
  }).join('');
  content.innerHTML =
    '<p class="panelTitle">全アカウント合計</p>' +
    eniAggregateCardsHtml('') +
    '<p class="panelTitle" style="margin-top:16px">アカウント別</p>' +
    (rows || '<div class="help">登録アカウントがありません。</div>');
}

function eniToggleHomeVisible(id) {
  var m = eniFindMember(id);
  if (!m) return;
  m.homeVisible = m.homeVisible === false ? true : false;
  if (typeof markActivity === 'function') markActivity();
  eniRender();
  if (typeof showToast === 'function') {
    showToast((m.homeVisible === false ? '✅ ホーム非表示：' : '✅ ホーム表示：') + eniDisplayName(m));
  }
}

function eniReorderRootAccount(id, dir) {
  eniEnsureRootAccounts();
  var i = eniRootAccountIds.indexOf(id);
  var j = i + dir;
  if (i < 0 || j < 0 || j >= eniRootAccountIds.length) return;
  var tmp = eniRootAccountIds[i];
  eniRootAccountIds[i] = eniRootAccountIds[j];
  eniRootAccountIds[j] = tmp;
  if (typeof markActivity === 'function') markActivity();
  eniRender();
}

function eniAccountManageMove(id, dir) {
  eniReorderRootAccount(id, dir);
}

function eniShowAccountManage() {
  if (typeof showPage === 'function') showPage('eniAccountManage');
}

/** @deprecated 互換用。全画面集計へ切り替え */
function eniOpenAggregationPanel() {
  eniShowAccountManage();
}

/** 凍結中の現在データ（eniCurrentData）で一時計算して戻す */
function eniWithBaselineOrg(fn) {
  var prevMembers = eniMembers;
  var prevSim = eniSimMode;
  var prevOverride = eniStakeOverride;
  eniMembers = eniCurrentData.length ? eniCurrentData : eniMembers;
  eniSimMode = false;
  eniStakeOverride = null;
  eniClearAggCache();
  try {
    return fn();
  } finally {
    eniMembers = prevMembers;
    eniSimMode = prevSim;
    eniStakeOverride = prevOverride;
    eniClearAggCache();
  }
}

function eniEmptySummary() {
  return { total: 0, staking: 0, team: 0, volume: 0 };
}

function eniDiffSummary(before, after) {
  before = before || eniEmptySummary();
  after = after || eniEmptySummary();
  return {
    total: eniRoundReward((Number(after.total) || 0) - (Number(before.total) || 0)),
    staking: eniRoundReward((Number(after.staking) || 0) - (Number(before.staking) || 0)),
    team: eniRoundReward((Number(after.team) || 0) - (Number(before.team) || 0)),
    volume: eniRoundReward((Number(after.volume) || 0) - (Number(before.volume) || 0))
  };
}

/** 開始時に表示中の実効ステーキング額を仮ノードへ焼き込む */
function eniBakeLiveStakesIntoMembers(members) {
  var stakeById = {};
  eniMembers.forEach(function (m) {
    if (!m || !m.id) return;
    stakeById[m.id] = eniGetStakingAmount(m.id);
  });
  (members || []).forEach(function (m) {
    if (!m || !m.id) return;
    if (Object.prototype.hasOwnProperty.call(stakeById, m.id)) {
      m.investment = stakeById[m.id];
    }
  });
}

function eniOpenSimulationPanel() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = 'シミュレーション';
  modalContent.innerHTML =
    '<div class="lineBox"><b>現在の組織図をベースに検証できます</b>' +
    '<p class="help">シミュレーション開始を押すと、現在データをコピーした仮データで編集できます。</p>' +
    '<div class="homeToggleRow">' +
    '<button type="button" onclick="eniStartSimulation();closeModal();showToast(\'🟣 シミュレーションを開始しました\')">シミュレーション開始</button>' +
    '<button type="button" class="btn2" onclick="eniRestoreCurrent();closeModal();showToast(\'🟢 現在データへ戻しました\')">現在データへ戻る</button>' +
    '<button type="button" class="btn2" onclick="eniSaveScenario()">シミュレーション保存</button>' +
    '<button type="button" class="btn2" onclick="eniOpenScenarioList()">保存一覧</button>' +
    '</div></div>';
  modalBg.style.display = 'flex';
}

function eniStartSimulation() {
  if (!eniSimMode) {
    if (!eniCurrentData.length) eniCurrentData = eniClone(eniMembers);
    // ライブ表示中の実効額を仮組織へ焼き込み（編集可能にする）
    var working = eniClone(eniCurrentData);
    eniBakeLiveStakesIntoMembers(working);
    eniMembers = working;
    eniSimMode = true;
  }
  eniStakeOverride = null;
  if (typeof showPage === 'function') showPage('eniOrg');
  eniRender();
}

function eniRestoreCurrent() {
  eniMembers = eniClone(eniCurrentData);
  eniSimMode = false;
  eniStakeOverride = null;
  eniFocusId = eniRootId;
  if (typeof showPage === 'function') showPage('eniOrg');
  eniRender();
}

function eniBuildScenarioRecord(name) {
  var root = eniRootId ? eniFindMember(eniRootId) : null;
  var after = eniRootId ? eniGetDisplaySummary(eniRootId) : eniEmptySummary();
  var before = eniSimMode
    ? eniWithBaselineOrg(function () {
      return eniRootId ? eniGetDisplaySummary(eniRootId) : eniEmptySummary();
    })
    : after;
  return {
    project: 'eni',
    name: name,
    rootId: eniRootId || '',
    rootName: root ? eniDisplayName(root) : '',
    created: new Date().toLocaleString(),
    data: eniClone(eniMembers),
    summary: after,
    baseline: before,
    diff: eniDiffSummary(before, after)
  };
}

function eniSaveScenario() {
  var name = prompt('シミュレーション名', 'ENI配置シミュレーション');
  if (!name) return;
  eniScenarios.push(eniBuildScenarioRecord(name));
  // pack は sim 中でも live members を書くため、シナリオ一覧だけ永続化できる
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
  alert('保存しました');
}

function eniOpenScenarioList() {
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = '保存済みシミュレーション';
  modalContent.innerHTML = eniScenarios.length
    ? eniScenarios.map(function (s, i) {
      var meta = eniEscape(s.created || '');
      if (s.rootName) meta += ' ／ ' + eniEscape(s.rootName);
      var sum = s.summary
        ? '<div class="help">合計利益 ' + eniEscape(eniAggFormatMonth(s.summary.total)) + '</div>'
        : '';
      return '<div class="lineBox"><b>' + eniEscape(s.name || ('シミュレーション ' + (i + 1))) + '</b><br>' +
        meta + sum +
        '<div class="homeToggleRow" style="margin-top:8px">' +
        '<button type="button" onclick="eniLoadScenario(' + i + ')">開く</button>' +
        '<button type="button" class="btn2" onclick="eniDeleteScenario(' + i + ')">削除</button>' +
        '</div></div>';
    }).join('')
    : '保存済みシミュレーションはありません。';
  modalBg.style.display = 'flex';
}

function eniDeleteScenario(i) {
  if (!eniScenarios[i]) return;
  if (!confirm('このシミュレーションを削除しますか？')) return;
  eniScenarios.splice(i, 1);
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
  eniOpenScenarioList();
}

function eniLoadScenario(i) {
  if (!eniScenarios[i] || !eniScenarios[i].data) return;
  if (!eniSimMode) {
    if (!eniCurrentData.length) eniCurrentData = eniClone(eniMembers);
  }
  eniMembers = eniClone(eniScenarios[i].data);
  eniSimMode = true;
  eniStakeOverride = null;
  if (eniScenarios[i].rootId && eniFindMember(eniScenarios[i].rootId)) {
    eniRootId = eniScenarios[i].rootId;
  }
  eniFocusId = eniRootId;
  if (typeof closeModal === 'function') closeModal();
  if (typeof showPage === 'function') showPage('eniOrg');
  eniRender();
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
  window.eniRenderAccountManage = eniRenderAccountManage;
  window.eniAccountManageMove = eniAccountManageMove;
  window.eniToggleHomeVisible = eniToggleHomeVisible;
  window.eniOpenSimulationPanel = eniOpenSimulationPanel;
  window.eniStartSimulation = eniStartSimulation;
  window.eniRestoreCurrent = eniRestoreCurrent;
  window.eniSaveScenario = eniSaveScenario;
  window.eniOpenScenarioList = eniOpenScenarioList;
  window.eniDeleteScenario = eniDeleteScenario;
  window.eniLoadScenario = eniLoadScenario;
  window.eniGetDisplaySummary = eniGetDisplaySummary;
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
  window.eniShowCardHelp = eniShowCardHelp;
  window.eniShowTeamRewardDetail = eniShowTeamRewardDetail;
  window.eniShowAggCardDetail = eniShowAggCardDetail;
  window.eniShowAllAccountsTeamRewardDetail = eniShowAllAccountsTeamRewardDetail;
}
