/* OUKEI HUB ORCA Organization Chart — Ver2.0.9
 * RAM組織図とデータ・操作を完全分離。報酬計算は未実装（土台のみ）。
 */

var ORCA_AI_AGENTS = ['Eden', 'Oracle', 'Axiom', 'Apex'];

var orcaMembers = [];
var orcaCurrentData = [];
var orcaScenarios = [];
var orcaRootId = '';
var orcaRootAccountIds = [];
var orcaFocusId = '';
var orcaSimMode = false;
var orcaZoom = 1;
var orcaPinchStartDist = 0;
var orcaPinchStartZoom = 1;
var orcaPinchBound = false;

function orcaClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function orcaPackOrgChart() {
  return {
    members: orcaMembers,
    currentData: orcaCurrentData,
    scenarios: orcaScenarios,
    rootId: orcaRootId,
    rootAccountIds: orcaRootAccountIds,
    zoom: orcaZoom
  };
}

function orcaApplyOrgChart(data) {
  var base = typeof hubCreateEmptyOrcaOrgChart === 'function'
    ? hubCreateEmptyOrcaOrgChart()
    : { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 };
  var d = data && typeof data === 'object' ? data : base;
  orcaMembers = orcaClone(Array.isArray(d.members) ? d.members : []);
  orcaCurrentData = orcaClone(Array.isArray(d.currentData) ? d.currentData : []);
  orcaScenarios = orcaClone(Array.isArray(d.scenarios) ? d.scenarios : []);
  orcaRootId = typeof d.rootId === 'string' ? d.rootId : '';
  orcaRootAccountIds = orcaClone(Array.isArray(d.rootAccountIds) ? d.rootAccountIds : []);
  orcaZoom = typeof d.zoom === 'number' ? d.zoom : 1;
  orcaFocusId = orcaRootId || orcaFocusId || '';
  orcaSimMode = false;
}

function orcaChildrenOf(id) {
  return orcaMembers.filter(function (m) { return m.parent === id; });
}

function orcaDisplayName(m) {
  if (!m) return '未入力';
  return (m.name && m.name !== '未入力') ? m.name : (m.username ? ('@' + m.username) : '未入力');
}

function orcaMoney(n) {
  if (typeof money === 'function') return money(n);
  return '$' + (Number(n) || 0).toLocaleString();
}

function orcaChildLineVolume(id) {
  return orcaChildrenOf(id).reduce(function (s, c) {
    return s + (Number(c.investment) || 0) + orcaCalcVolume(c.id);
  }, 0);
}

function orcaCalcVolume(id) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  if (!m) return 0;
  var manual = Number(m.manualVolume) || 0;
  var child = orcaChildLineVolume(id);
  return Math.max(manual, child);
}

function orcaLineAmountOf(id) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  return m ? ((Number(m.investment) || 0) + orcaCalcVolume(id)) : 0;
}

function orcaAdjustAncestorManualVolumes(startId, delta) {
  var cur = startId;
  while (cur) {
    var p = orcaMembers.find(function (x) { return x.id === cur; });
    if (!p) break;
    p.manualVolume = Math.max(0, (Number(p.manualVolume) || 0) + delta);
    p.bvMode = 'MANUAL';
    cur = p.parent;
  }
}

function orcaNormalizeVolumes() {
  orcaMembers.forEach(function (m) {
    var child = orcaChildLineVolume(m.id);
    var cur = Number(m.manualVolume) || 0;
    if (child > cur) {
      m.manualVolume = child;
      m.bvMode = m.bvMode || 'AUTO';
    }
  });
}

function orcaReflectionRate() {
  var r = orcaCalcVolume(orcaRootId);
  var e = orcaMembers.reduce(function (s, m) { return s + (Number(m.investment) || 0); }, 0);
  return r ? Math.min(99, Math.round(e / r * 100)) : 0;
}

function orcaPlaceholderTotals() {
  return { total: 0, personal: 0, ranking: 0, title: 0, volume: orcaCalcVolume(orcaFocusId) };
}

function orcaCardHelpPersonalBody() {
  return '<div class="helpSectionTitle">個人収益（個人運用益）とは</div>' +
    'AIエージェントによる運用で得られる予想収益です。<br><br>' +
    '本シミュレーションでは、毎日チェックインを行った場合の「中間利率」を採用しています。<br><br>' +
    '選択したAIエージェント・投資額・運用期間に応じて、自動で個人収益を計算します。<br><br>' +
    '<div class="helpSectionTitle">AIエージェント一覧</div>' +
    '<div class="helpSectionTitle">■ Eden（10日）</div>' +
    '・想定日次収益：0.20〜0.30%<br>' +
    '・チェックイン報酬：+50%<br>' +
    '・想定最大収益：0.30〜0.45%<br>' +
    '・採用利率：0.375%／日<br><br>' +
    '<div class="helpSectionTitle">■ Oracle（90日）</div>' +
    '・想定日次収益：0.30〜0.40%<br>' +
    '・チェックイン報酬：+50%<br>' +
    '・想定最大収益：0.45〜0.60%<br>' +
    '・採用利率：0.525%／日<br><br>' +
    '<div class="helpSectionTitle">■ Axiom（180日）</div>' +
    '・想定日次収益：0.40〜0.50%<br>' +
    '・チェックイン報酬：+75%<br>' +
    '・想定最大収益：0.70〜0.875%<br>' +
    '・採用利率：0.7875%／日<br><br>' +
    '<div class="helpSectionTitle">■ Apex（360日）</div>' +
    '・想定日次収益：0.50〜0.60%<br>' +
    '・チェックイン報酬：+100%<br>' +
    '・想定最大収益：1.00〜1.20%<br>' +
    '・採用利率：1.10%／日<br><br>' +
    '<div class="helpSectionTitle">計算式</div>' +
    '個人収益 ＝ 投資額 × 採用利率<br><br>' +
    '<div class="helpSectionTitle">計算例</div>' +
    'Apex・$1,000運用<br><br>' +
    '$1,000 × 1.10%<br><br>' +
    '＝ $11.00／日<br><br>' +
    '<div class="helpSectionTitle">注意事項</div>' +
    '・本シミュレーションでは、毎日チェックインを行う前提で計算しています。<br><br>' +
    '・実際の運用結果は市場状況やAIエージェントの成績により変動する場合があります。';
}

function orcaCardHelpRankingBody() {
  return '<div class="helpSectionTitle">ランキング報酬とは</div>' +
    'チームメンバーの基礎運用収益に対して、自分の保有ランクに応じた報酬が支払われます。<br><br>' +
    '※チェックイン報酬は計算対象外です。<br>' +
    '※相手のランクに関係なく、自分の保有ランクの報酬率が適用されます。<br><br>' +
    '<div class="helpSectionTitle">計算式</div>' +
    '相手の基礎運用収益 × 自分のランク報酬率<br><br>' +
    '<div class="helpSectionTitle">計算例</div>' +
    '自分：Orca2（20%）<br>' +
    '相手：$1,000・Apex<br><br>' +
    '基礎運用収益<br>' +
    '＝ $1,000 × 0.55%<br>' +
    '＝ $5.50／日<br><br>' +
    'ランキング報酬<br>' +
    '＝ $5.50 × 20%<br>' +
    '＝ $1.10／日<br><br>' +
    '相手がUserでもOrca5でも、自分がOrca2なら20%で計算されます。<br><br>' +
    '<div class="helpSectionTitle">ランク報酬率</div>' +
    '・User：5%<br>' +
    '・Orca1：10%<br>' +
    '・Orca2：20%<br>' +
    '・Orca3：30%<br>' +
    '・Orca4：40%<br>' +
    '・Orca5：50%<br>' +
    '・Orca6：55%<br>' +
    '・Orca7：60%<br>' +
    '・Orca8：65%<br>' +
    '・Orca9：70%';
}

function orcaCardHelpMap() {
  return {
    total: { title: '合計利益', body: null },
    personal: { title: '個人収益（個人運用益）', body: orcaCardHelpPersonalBody() },
    ranking: { title: 'ランキング報酬', body: orcaCardHelpRankingBody() },
    title: { title: 'タイトル報酬', body: null },
    volume: { title: 'グループ販売', body: null }
  };
}

function orcaShowCardHelp(type) {
  var map = orcaCardHelpMap();
  var entry = map[type];
  if (!entry || typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') {
    return;
  }
  modalTitle.textContent = entry.title;
  modalContent.innerHTML = entry.body
    ? '<div class="explain">' + entry.body + '</div>'
    : '<div class="explain">説明は準備中です。</div>';
  modalBg.style.display = 'flex';
}

function orcaRender() {
  orcaNormalizeVolumes();
  if (!orcaSimMode) orcaCurrentData = orcaClone(orcaMembers);
  orcaRenderStats();
  orcaRenderRootAccounts();
  if (orcaRootId && orcaMembers.some(function (x) { return x.id === orcaRootId; })) {
    orcaFocusId = orcaRootId;
  }
  orcaRenderCards();
  orcaRenderTree();
  var badge = document.getElementById('orcaModeBadge');
  var banner = document.getElementById('orcaOrgSimBanner');
  var page = document.getElementById('orcaOrgPage');
  if (badge) {
    badge.className = orcaSimMode ? 'compactBadge orgModeBadge--sim' : 'compactBadge orgModeBadge--live';
    badge.textContent = orcaSimMode ? '🟣 シミュレーション中' : '🔵 現在データ';
  }
  if (page) page.dataset.mode = orcaSimMode ? 'simulation' : 'live';
  if (banner) banner.classList.toggle('isVisible', orcaSimMode);
  var canvas = document.getElementById('orcaCanvas');
  if (canvas) canvas.style.transform = 'scale(' + orcaZoom + ')';
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
}

function orcaRenderStats() {
  var accountBadge = document.getElementById('orcaAccountBadge');
  var reflectBadge = document.getElementById('orcaReflectBadge');
  if (accountBadge) {
    accountBadge.innerHTML = '👤 ' + orcaMembers.length +
      ' <span class="inlineHelpQ" onclick="event.stopPropagation();orcaShowMemberStats()">?</span>';
  }
  if (reflectBadge) reflectBadge.textContent = '📊 入力反映率 ' + orcaReflectionRate() + '%';
}

function orcaRenderCards() {
  var t = orcaPlaceholderTotals();
  var z = orcaMoney(0);
  var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
  set('ocTotal', z);
  set('ocPersonal', z);
  set('ocRanking', z);
  set('ocTitle', z);
  set('ocVolume', orcaMoney(t.volume));
}

function orcaEnsureRootAccounts() {
  orcaRootAccountIds = (orcaRootAccountIds || []).filter(function (id) {
    return orcaMembers.some(function (m) { return m.id === id; });
  });
  if (!orcaRootAccountIds.length) {
    var roots = orcaMembers.filter(function (m) { return !m.parent; }).map(function (m) { return m.id; });
    orcaRootAccountIds = roots.length ? roots : [orcaRootId].filter(Boolean);
  }
  if (!orcaRootAccountIds.includes(orcaRootId)) {
    orcaRootId = orcaRootAccountIds[0] || orcaRootId;
  }
}

function orcaRenderRootAccounts() {
  orcaEnsureRootAccounts();
  var sel = document.getElementById('orcaRootAccountSelect');
  if (!sel) return;
  sel.innerHTML = orcaRootAccountIds.map(function (id) {
    var m = orcaMembers.find(function (x) { return x.id === id; });
    return m ? ('<option value="' + m.id + '"' + (m.id === orcaRootId ? ' selected' : '') + '>' +
      orcaDisplayName(m) + '</option>') : '';
  }).join('');
}

function orcaSwitchRootAccount(id) {
  orcaRootId = id;
  orcaFocusId = id;
  var m = orcaMembers.find(function (x) { return x.id === id; });
  orcaRender();
  if (typeof showToast === 'function') {
    showToast('✅ ' + (m ? orcaDisplayName(m) : '組織図') + 'に切り替えました');
  }
}

function orcaNodeHtml(m, kidCount) {
  var nm = orcaDisplayName(m);
  var agent = m.aiAgent || 'Eden';
  return '<div class="node ' + (m.id === orcaRootId ? 'root' : '') + ' rankBorder' + (m.rank || 0) +
    '" onclick="flashEl(this)"><div class="nodeHead"><div><div class="nodeName">' + nm +
    '</div><div class="userName">' + (m.username ? '@' + m.username : '') + '</div></div>' +
    '<span class="rank r' + (m.rank || 0) + '">' + (typeof rankName !== 'undefined' ? rankName[m.rank || 0] : ('L' + (m.rank || 0))) +
    '</span></div><div class="nodeInfo">個人投資額：' + orcaMoney(m.investment) + '<br>運用AIエージェント：' + agent +
    '<br>個人販売：' + orcaMoney(m.personalSales) + '<br>グループ販売：' + orcaMoney(m.groupSales) +
    '</div><div class="nodeBtns">' +
    (kidCount ? '<button class="toggle" onclick="event.stopPropagation();orcaToggleOpen(\'' + m.id + '\')">' +
      (m.open ? '▼' : '▶') + '</button>' : '') +
    '<button class="nodeAddBtn" onclick="event.stopPropagation();orcaAddChild(\'' + m.id + '\')">＋</button>' +
    '<button class="btn2" onclick="event.stopPropagation();orcaShowDetail(\'' + m.id + '\')">詳細</button>' +
    (m.id !== orcaRootId ?
      '<button class="btn2" onclick="event.stopPropagation();orcaReorderSibling(\'' + m.id + '\',-1)">←</button>' +
      '<button class="btn2" onclick="event.stopPropagation();orcaReorderSibling(\'' + m.id + '\',1)">→</button>' : '') +
    '</div></div>';
}

function orcaRenderNode(id) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  var kids = orcaChildrenOf(id);
  var vis = m && m.open ? kids : [];
  return '<li>' + orcaNodeHtml(m, kids.length) +
    (vis.length ? '<ul>' + vis.map(function (k) { return orcaRenderNode(k.id); }).join('') + '</ul>' : '') +
    '</li>';
}

function orcaRenderTree() {
  var tree = document.getElementById('orcaTree');
  if (!tree) return;
  if (!orcaRootId || !orcaMembers.some(function (x) { return x.id === orcaRootId; })) {
    tree.innerHTML = '<div class="explain" style="padding:28px 16px;text-align:center;color:#9fb3cc">' +
      '組織図がありません。左上の「＋」から親アカウントを作成してください。</div>';
    return;
  }
  tree.innerHTML = '<ul>' + orcaRenderNode(orcaRootId) + '</ul>';
}

function orcaToggleOpen(id) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  if (m) m.open = !m.open;
  orcaRender();
}

function orcaReorderSibling(id, dir) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  if (!m) return;
  var sib = orcaMembers.filter(function (x) { return x.parent === m.parent; });
  var i = sib.findIndex(function (x) { return x.id === id; });
  var j = i + dir;
  if (j < 0 || j >= sib.length) return;
  var order = sib.map(function (x) { return x.id; });
  var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  var others = orcaMembers.filter(function (x) { return x.parent !== m.parent; });
  var reordered = order.map(function (oid) {
    return orcaMembers.find(function (x) { return x.id === oid; });
  }).filter(Boolean);
  orcaMembers = others.concat(reordered);
  if (typeof markActivity === 'function') markActivity();
  orcaRender();
}

function orcaAddChild(parent) {
  orcaOpenEdit({ parent: parent });
}

function orcaAgentOptions(selected) {
  return ORCA_AI_AGENTS.map(function (a) {
    return '<option value="' + a + '"' + (selected === a ? ' selected' : '') + '>' + a + '</option>';
  }).join('');
}

function orcaRankOptions(rank) {
  return [5, 4, 3, 2, 1, 0].map(function (r) {
    var label = typeof rankName !== 'undefined' ? rankName[r] : ('L' + r);
    return '<option value="' + r + '"' + (Number(rank || 0) === r ? ' selected' : '') + '>' + label + '</option>';
  }).join('');
}

function orcaOpenEdit(data) {
  data = data || {};
  var opts = '<option value="">親なし</option>' + orcaMembers.map(function (m) {
    return '<option value="' + m.id + '"' + (data.parent === m.id ? ' selected' : '') + '>' + orcaDisplayName(m) + '</option>';
  }).join('');
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;
  modalTitle.textContent = data.id ? 'メンバー編集' : 'メンバー追加';
  modalContent.innerHTML =
    '<input type="hidden" id="orcaEditId" value="' + (data.id || '') + '">' +
    '<label>親</label><select id="orcaParentInput">' + opts + '</select>' +
    '<label>名前</label><input id="orcaNameInput" value="' + (data.name || '') + '">' +
    '<label>ユーザーネーム</label><input id="orcaUsernameInput" value="' + (data.username || '') + '">' +
    '<div class="grid2"><div><label>保有ランク</label><select id="orcaRankInput">' + orcaRankOptions(data.rank) + '</select></div>' +
    '<div><label>個人投資額</label><input id="orcaInvestmentInput" type="number" value="' + (data.investment != null ? data.investment : '') + '"></div></div>' +
    '<label>運用AIエージェント</label><select id="orcaAiAgentInput">' + orcaAgentOptions(data.aiAgent || 'Eden') + '</select>' +
    '<div class="grid2"><div><label>個人販売</label><input id="orcaPersonalSalesInput" type="number" value="' + (data.personalSales != null ? data.personalSales : '') + '"></div>' +
    '<div><label>グループ販売</label><input id="orcaGroupSalesInput" type="number" value="' + (data.groupSales != null ? data.groupSales : '') + '"></div></div>' +
    '<label>チームボリューム</label><input id="orcaVolumeInput" type="number" value="' + (data.manualVolume != null ? data.manualVolume : '') + '">' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '<button class="btn2" onclick="closeModal()">キャンセル</button>' +
    '<button onclick="orcaSaveMember()">保存</button></div>';
  modalBg.style.display = 'flex';
}

function orcaSaveMember() {
  var editId = document.getElementById('orcaEditId');
  var parentInput = document.getElementById('orcaParentInput');
  var nameInput = document.getElementById('orcaNameInput');
  var usernameInput = document.getElementById('orcaUsernameInput');
  var rankInput = document.getElementById('orcaRankInput');
  var investmentInput = document.getElementById('orcaInvestmentInput');
  var aiAgentInput = document.getElementById('orcaAiAgentInput');
  var personalSalesInput = document.getElementById('orcaPersonalSalesInput');
  var groupSalesInput = document.getElementById('orcaGroupSalesInput');
  var volumeInput = document.getElementById('orcaVolumeInput');
  if (!editId) return;
  var id = editId.value || ('o' + Date.now());
  var isEdit = !!editId.value;
  var old = isEdit ? orcaMembers.find(function (x) { return x.id === id; }) : null;
  var oldParent = old ? old.parent : null;
  var oldLine = old ? orcaLineAmountOf(id) : 0;
  var obj = {
    id: id,
    parent: parentInput.value || null,
    name: (nameInput.value || usernameInput.value || '未入力'),
    username: usernameInput.value || '',
    rank: Number(rankInput.value),
    investment: Number(investmentInput.value) || 0,
    aiAgent: aiAgentInput.value || 'Eden',
    personalSales: Number(personalSalesInput.value) || 0,
    groupSales: Number(groupSalesInput.value) || 0,
    manualVolume: Number(volumeInput.value) || 0,
    open: true,
    bvMode: 'MANUAL',
    bvPrompted: false
  };
  var newLine = (Number(obj.investment) || 0) + (Number(obj.manualVolume) || 0);
  if (isEdit && old) {
    obj.open = old.open;
    obj.bvMode = old.bvMode || 'MANUAL';
    obj.bvPrompted = old.bvPrompted || false;
    orcaMembers[orcaMembers.findIndex(function (m) { return m.id === id; })] = obj;
    if (oldParent === obj.parent) {
      orcaAdjustAncestorManualVolumes(obj.parent, newLine - oldLine);
    } else {
      orcaAdjustAncestorManualVolumes(oldParent, -oldLine);
      orcaAdjustAncestorManualVolumes(obj.parent, newLine);
    }
  } else {
    orcaMembers.push(obj);
    orcaAdjustAncestorManualVolumes(obj.parent, newLine);
    var p = orcaMembers.find(function (x) { return x.id === obj.parent; });
    if (p) p.open = true;
  }
  if (!obj.parent && orcaRootAccountIds.indexOf(obj.id) < 0) orcaRootAccountIds.push(obj.id);
  if (!obj.parent) orcaRootId = obj.id;
  orcaFocusId = obj.id;
  if (typeof settings !== 'undefined') settings.lastUpdate = new Date().toLocaleString();
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  orcaRender();
}

function orcaDeleteMember(id) {
  var target = orcaMembers.find(function (x) { return x.id === id; });
  if (!target) return;
  if (!confirm('削除しますか？配下も削除されます。')) return;
  var parent = target.parent;
  var line = orcaLineAmountOf(id);
  var rm = new Set([id]);
  var ch = true;
  while (ch) {
    ch = false;
    orcaMembers.forEach(function (x) {
      if (x.parent && rm.has(x.parent) && !rm.has(x.id)) { rm.add(x.id); ch = true; }
    });
  }
  orcaMembers = orcaMembers.filter(function (x) { return !rm.has(x.id); });
  orcaRootAccountIds = (orcaRootAccountIds || []).filter(function (x) { return !rm.has(x); });
  orcaAdjustAncestorManualVolumes(parent, -line);
  if (typeof markActivity === 'function') markActivity();
  orcaFocusId = orcaRootId;
  if (typeof closeModal === 'function') closeModal();
  orcaRender();
}

function orcaOpenEditById(id) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  if (m) orcaOpenEdit(m);
}

function orcaShowDetail(id) {
  orcaFocusId = id;
  var m = orcaMembers.find(function (x) { return x.id === id; });
  if (!m || typeof modalTitle === 'undefined') return;
  var rankLabel = typeof rankName !== 'undefined' ? rankName[m.rank || 0] : ('L' + (m.rank || 0));
  modalTitle.textContent = orcaDisplayName(m) + ' 詳細';
  modalContent.innerHTML =
    '<div class="detailGrid">' +
    '<div class="detailBox"><div class="label">名前</div><div class="val">' + (m.name || '未入力') + '</div></div>' +
    '<div class="detailBox"><div class="label">ユーザーネーム</div><div class="val">' + (m.username ? '@' + m.username : '—') + '</div></div>' +
    '<div class="detailBox"><div class="label">保有ランク</div><div class="val">' + rankLabel + '</div></div>' +
    '<div class="detailBox"><div class="label">個人投資額</div><div class="val">' + orcaMoney(m.investment) + '</div></div>' +
    '<div class="detailBox"><div class="label">運用AIエージェント</div><div class="val">' + (m.aiAgent || 'Eden') + '</div></div>' +
    '<div class="detailBox"><div class="label">個人販売</div><div class="val">' + orcaMoney(m.personalSales) + '</div></div>' +
    '<div class="detailBox"><div class="label">グループ販売</div><div class="val">' + orcaMoney(m.groupSales) + '</div></div>' +
    '</div><div class="lineBox"><b>管理</b><div class="accountManageActions">' +
    '<button onclick="orcaOpenEditById(\'' + id + '\')">編集</button>' +
    '<button class="btn2" onclick="orcaAddChild(\'' + id + '\')">配下追加</button>' +
    '<button class="btn2" onclick="orcaExportSubtree(\'' + id + '\')">配下保存</button>' +
    '<button class="btn2" onclick="orcaImportSubtree(\'' + id + '\')">配下導入</button>' +
    (m.id !== orcaRootId ? '<button class="btnDanger" onclick="orcaDeleteMember(\'' + id + '\')">削除</button>' : '') +
    '</div></div>';
  modalBg.style.display = 'flex';
}

function orcaShowMemberStats() {
  if (typeof modalTitle === 'undefined') return;
  var holders = orcaMembers.filter(function (m) { return (m.rank || 0) > 0; }).length;
  modalTitle.textContent = 'メンバー統計';
  modalContent.innerHTML = '<div class="lineBox"><b>ORCA組織図メンバー数</b><br><br>総人数：<b>' +
    orcaMembers.length + '件</b><br>タイトル保有者：<b>' + holders + '名</b></div>';
  modalBg.style.display = 'flex';
}

function orcaOpenRootQuickAdd() {
  orcaEnsureRootAccounts();
  var opts = orcaMembers.map(function (m) {
    return '<option value="' + m.id + '">' + orcaDisplayName(m) + '</option>';
  }).join('');
  modalTitle.textContent = '組織図を追加';
  modalContent.innerHTML = '<div class="quickAddGrid">' +
    '<div class="lineBox"><b>親アカウント作成</b><p class="help">全く別ラインの親アカウントを新しく作成します。</p>' +
    '<button onclick="orcaAddRootAccount()">＋ 親アカウント作成</button></div>' +
    '<div class="lineBox"><b>表示組織図に追加</b><p class="help">入力済みアカウントを切替一覧に追加します。</p>' +
    '<select id="orcaPromoteMemberSelect">' + opts + '</select>' +
    '<button onclick="orcaPromoteExistingMember()">追加</button></div></div>';
  modalBg.style.display = 'flex';
}

function orcaAddRootAccount() {
  var name = prompt('親アカウント名', '新規ORCAアカウント');
  if (!name) return;
  var id = 'o' + Date.now();
  orcaMembers.push({
    id: id, parent: null, name: name, username: '', rank: 0, investment: 300,
    aiAgent: 'Eden', personalSales: 0, groupSales: 0, manualVolume: 0, open: true, bvMode: 'MANUAL'
  });
  orcaRootAccountIds.push(id);
  orcaRootId = id;
  orcaFocusId = id;
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  orcaRender();
}

function orcaPromoteExistingMember() {
  var sel = document.getElementById('orcaPromoteMemberSelect');
  if (!sel) return;
  var id = sel.value;
  if (!id) return;
  if (orcaRootAccountIds.indexOf(id) < 0) orcaRootAccountIds.push(id);
  orcaRootId = id;
  orcaFocusId = id;
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  orcaRender();
}

function orcaOpenAccountManager() {
  orcaEnsureRootAccounts();
  modalTitle.textContent = 'ORCA組織図管理';
  modalContent.innerHTML =
    '<div class="lineBox"><b>表示中の組織図</b><p class="help">切替一覧から外す操作ができます。</p>' +
    orcaRootAccountIds.map(function (id) {
      var m = orcaMembers.find(function (x) { return x.id === id; });
      if (!m) return '';
      return '<div class="lineBox"><b>' + orcaDisplayName(m) + '</b><div class="accountManageActions">' +
        '<button class="btn2 smallCtl" onclick="orcaUnpinRootAccount(\'' + id + '\')">切替から外す</button></div></div>';
    }).join('') + '</div>' +
    '<div class="lineBox"><b>組織図共有</b><p class="help">表示中の親アカウント配下を保存・読込できます。</p>' +
    '<div class="accountManageActions">' +
    '<button onclick="orcaExportCurrentOrg()">組織図エクスポート</button>' +
    '<button class="btn2" onclick="orcaImportOrgAsRoot()">組織図インポート</button>' +
    '<button class="btn2" onclick="orcaImportSubtreeToRoot()">配下を導入</button></div></div>' +
    '<div class="lineBox"><b>名称変更</b><button class="btn2" onclick="orcaRenameRootAccount()">名称変更</button></div>' +
    '<div class="lineBox"><b>親アカウント削除</b><p class="dangerNote">現在表示中の親アカウントと配下を削除します。</p>' +
    '<button class="btnDanger" onclick="orcaDeleteRootAccount()">削除</button></div>';
  modalBg.style.display = 'flex';
}

function orcaUnpinRootAccount(targetId) {
  var m = orcaMembers.find(function (x) { return x.id === targetId; });
  if (!m) return;
  if (!confirm(orcaDisplayName(m) + ' を組織図切替一覧から外しますか？')) return;
  orcaRootAccountIds = orcaRootAccountIds.filter(function (x) { return x !== targetId; });
  if (orcaRootId === targetId) {
    orcaRootId = orcaRootAccountIds[0] || '';
    orcaFocusId = orcaRootId;
  }
  orcaRender();
}

function orcaRenameRootAccount() {
  var m = orcaMembers.find(function (x) { return x.id === orcaRootId; });
  if (!m) return;
  var name = prompt('組織図名を変更', m.name);
  if (!name) return;
  m.name = name;
  if (typeof markActivity === 'function') markActivity();
  orcaRender();
}

function orcaDeleteRootAccount() {
  if (orcaRootAccountIds.length <= 1) return alert('最後の組織図は削除できません');
  var target = orcaMembers.find(function (x) { return x.id === orcaRootId; });
  if (!target) return;
  if (!confirm('表示中の親アカウント「' + orcaDisplayName(target) + '」と配下を削除しますか？')) return;
  var rm = new Set([orcaRootId]);
  var changed = true;
  while (changed) {
    changed = false;
    orcaMembers.forEach(function (x) {
      if (x.parent && rm.has(x.parent) && !rm.has(x.id)) { rm.add(x.id); changed = true; }
    });
  }
  orcaMembers = orcaMembers.filter(function (x) { return !rm.has(x.id); });
  orcaRootAccountIds = orcaRootAccountIds.filter(function (id) { return !rm.has(id); });
  orcaRootId = orcaRootAccountIds[0];
  orcaFocusId = orcaRootId;
  if (typeof markActivity === 'function') markActivity();
  if (typeof closeModal === 'function') closeModal();
  orcaRender();
}

function orcaOpenSimulationPanel() {
  modalTitle.textContent = 'シミュレーション';
  modalContent.innerHTML = '<div class="lineBox"><b>現在の組織図をベースに検証できます</b>' +
    '<p class="help">シミュレーション開始を押すと、現在データをコピーした仮データで編集できます。</p>' +
    '<div class="homeToggleRow">' +
    '<button onclick="orcaStartSimulation();closeModal();showToast(\'🟣 シミュレーションを開始しました\')">シミュレーション開始</button>' +
    '<button class="btn2" onclick="orcaRestoreCurrent();closeModal();showToast(\'🔵 現在データへ戻しました\')">現在データへ戻る</button>' +
    '<button class="btn2" onclick="orcaSaveScenario()">シミュレーション保存</button>' +
    '<button class="btn2" onclick="orcaOpenScenarioList()">保存一覧</button></div></div>';
  modalBg.style.display = 'flex';
}

function orcaStartSimulation() {
  if (!orcaSimMode) { orcaMembers = orcaClone(orcaCurrentData); orcaSimMode = true; }
  orcaRender();
}

function orcaRestoreCurrent() {
  orcaMembers = orcaClone(orcaCurrentData);
  orcaSimMode = false;
  orcaFocusId = orcaRootId;
  orcaRender();
}

function orcaSaveScenario() {
  var name = prompt('シミュレーション名', 'ORCA配置シミュレーション');
  if (!name) return;
  orcaScenarios.push({ name: name, data: orcaClone(orcaMembers), created: new Date().toLocaleString() });
  orcaRender();
  alert('保存しました');
}

function orcaOpenScenarioList() {
  modalTitle.textContent = '保存済みシミュレーション';
  modalContent.innerHTML = orcaScenarios.length ? orcaScenarios.map(function (s, i) {
    return '<div class="lineBox"><b>' + s.name + '</b><br>' + s.created +
      '<br><button onclick="orcaLoadScenario(' + i + ')">開く</button></div>';
  }).join('') : '保存済みシミュレーションはありません。';
  modalBg.style.display = 'flex';
}

function orcaLoadScenario(i) {
  orcaMembers = orcaClone(orcaScenarios[i].data);
  orcaSimMode = true;
  orcaFocusId = orcaRootId;
  if (typeof closeModal === 'function') closeModal();
  orcaRender();
}

function orcaShowAccountManage() {
  if (typeof showToast === 'function') showToast('ORCA集計は準備中です');
}

function orcaSubtreeIds(id) {
  var ids = [id];
  var changed = true;
  while (changed) {
    changed = false;
    orcaMembers.forEach(function (m) {
      if (m.parent && ids.indexOf(m.parent) >= 0 && ids.indexOf(m.id) < 0) { ids.push(m.id); changed = true; }
    });
  }
  return ids;
}

function orcaMakeSharePackage(id, type) {
  var ids = orcaSubtreeIds(id);
  var root = orcaMembers.find(function (m) { return m.id === id; });
  return {
    version: '2.0.9',
    app: 'OUKEI HUB',
    project: 'orca',
    type: type || 'subtree',
    exportedAt: new Date().toLocaleString(),
    rootId: id,
    rootName: orcaDisplayName(root || {}),
    members: orcaMembers.filter(function (m) { return ids.indexOf(m.id) >= 0; }).map(function (m) {
      return Object.assign({}, m);
    })
  };
}

function orcaExportCurrentOrg() {
  var m = orcaMembers.find(function (x) { return x.id === orcaRootId; });
  if (!m) return alert('表示中の組織図がありません');
  if (typeof downloadSharePackage === 'function') {
    downloadSharePackage(orcaMakeSharePackage(orcaRootId, 'org-root'), 'OUKEI_ORCA_ORG');
  }
  if (typeof showToast === 'function') showToast('✅ ORCA組織図をエクスポートしました');
}

function orcaExportSubtree(id) {
  var m = orcaMembers.find(function (x) { return x.id === id; });
  if (!m) return;
  if (typeof downloadSharePackage === 'function') {
    downloadSharePackage(orcaMakeSharePackage(id, 'subtree'), 'OUKEI_ORCA_SUBTREE');
  }
  if (typeof showToast === 'function') showToast('✅ ' + orcaDisplayName(m) + '配下を保存しました');
}

function orcaReadHubFile(cb) {
  if (typeof readHubFile === 'function') { readHubFile(cb); return; }
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

function orcaImportPackage(d, parentId, asRoot) {
  if (!d || !Array.isArray(d.members) || !d.members.length) {
    alert('OUKEI HUB共有ファイルではありません');
    return null;
  }
  var oldRoot = d.rootId || d.members.find(function (m) { return !m.parent; });
  if (!oldRoot) oldRoot = d.members[0].id;
  var stamp = Date.now().toString(36);
  var idMap = {};
  d.members.forEach(function (m, i) { idMap[m.id] = 'oimp_' + stamp + '_' + i; });
  var imported = d.members.map(function (m) {
    var copy = Object.assign({}, m);
    copy.id = idMap[m.id];
    copy.parent = m.id === oldRoot ? (asRoot ? null : parentId) : (idMap[m.parent] || null);
    copy.open = true;
    copy.aiAgent = copy.aiAgent || 'Eden';
    copy.personalSales = Number(copy.personalSales) || 0;
    copy.groupSales = Number(copy.groupSales) || 0;
    return copy;
  });
  orcaMembers = orcaMembers.concat(imported);
  var newRoot = idMap[oldRoot] || imported[0].id;
  if (asRoot && orcaRootAccountIds.indexOf(newRoot) < 0) orcaRootAccountIds.push(newRoot);
  if (typeof settings !== 'undefined') settings.lastUpdate = new Date().toLocaleString();
  return newRoot;
}

function orcaImportOrgAsRoot() {
  orcaReadHubFile(function (d) {
    if (!d || !Array.isArray(d.members) || !d.members.length) return alert('OUKEI HUB共有ファイルではありません');
    if (!confirm('ORCA組織図を新規導入します。よろしいですか？')) return;
    var newRoot = orcaImportPackage(d, null, true);
    if (newRoot) {
      orcaRootId = newRoot;
      orcaFocusId = newRoot;
      if (typeof markActivity === 'function') markActivity();
      orcaRender();
    }
  });
}

function orcaImportSubtree(parentId) {
  var p = orcaMembers.find(function (x) { return x.id === parentId; });
  if (!p) return alert('導入先がありません');
  orcaReadHubFile(function (d) {
    if (!d || !Array.isArray(d.members) || !d.members.length) return alert('OUKEI HUB共有ファイルではありません');
    var newRoot = orcaImportPackage(d, parentId, false);
    if (newRoot) {
      p.open = true;
      orcaFocusId = newRoot;
      if (typeof markActivity === 'function') markActivity();
      orcaRender();
    }
  });
}

function orcaImportSubtreeToRoot() {
  orcaImportSubtree(orcaRootId);
}

function orcaCenterRootNode() {
  try {
    var vp = document.getElementById('orcaViewport');
    var root = document.querySelector('#orcaTree .node.root');
    if (!vp || !root) return;
    var r = root.getBoundingClientRect();
    var v = vp.getBoundingClientRect();
    vp.scrollLeft += (r.left + r.width / 2) - (v.left + v.width / 2);
    vp.scrollTop += (r.top + r.height / 2) - (v.top + Math.min(v.height * 0.35, 220));
  } catch (e) {}
}

function orcaZoomIn() {
  orcaZoom = Math.min(2, orcaZoom + 0.1);
  orcaRender();
  setTimeout(orcaCenterRootNode, 120);
}

function orcaZoomOut() {
  orcaZoom = Math.max(0.35, orcaZoom - 0.1);
  orcaRender();
  setTimeout(orcaCenterRootNode, 120);
}

function orcaFitView() {
  orcaZoom = 0.72;
  orcaRender();
  setTimeout(orcaCenterRootNode, 120);
}

function orcaInitPinchZoom() {
  if (orcaPinchBound) return;
  var vp = document.getElementById('orcaViewport');
  if (vp) {
    vp.addEventListener('wheel', function (e) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        orcaZoom = Math.max(0.35, Math.min(2, orcaZoom + (e.deltaY < 0 ? 0.08 : -0.08)));
        var canvas = document.getElementById('orcaCanvas');
        if (canvas) canvas.style.transform = 'scale(' + orcaZoom + ')';
        setTimeout(orcaCenterRootNode, 80);
      }
    }, { passive: false });
  }
  var area = document.querySelector('#orcaOrgPage .chartArea');
  if (area) {
    area.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        orcaPinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        orcaPinchStartZoom = orcaZoom;
      }
    }, { passive: true });
    area.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && orcaPinchStartDist > 0) {
        e.preventDefault();
        var d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        orcaZoom = Math.max(0.35, Math.min(2, orcaPinchStartZoom * (d / orcaPinchStartDist)));
        var canvas = document.getElementById('orcaCanvas');
        if (canvas) canvas.style.transform = 'scale(' + orcaZoom + ')';
      }
    }, { passive: false });
  }
  orcaPinchBound = true;
}
