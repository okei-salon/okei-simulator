/* OUKEI HUB Organization Aggregation Targets — Ver2.0.40
 * Member flag `aggTarget` (boolean): include this account in「全アカウント合計」.
 * Aggregation-only. Must never alter parent links, node placement, or reward formulas.
 */

function orgAggEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function orgAggIsSim(projectKey) {
  var pk = String(projectKey || 'ram');
  if (pk === 'orca') return !!(typeof orcaSimMode !== 'undefined' && orcaSimMode);
  if (pk === 'eni') return !!(typeof eniSimMode !== 'undefined' && eniSimMode);
  return !!(typeof simMode !== 'undefined' && simMode);
}

function orgAggGetMembers(projectKey) {
  var pk = String(projectKey || 'ram');
  if (pk === 'orca') return Array.isArray(orcaMembers) ? orcaMembers : [];
  if (pk === 'eni') return Array.isArray(eniMembers) ? eniMembers : [];
  return Array.isArray(members) ? members : [];
}

/** True only when explicitly marked. Missing/undefined = not included (opt-in). */
function orgAggIsTarget(m) {
  return !!(m && m.aggTarget === true);
}

function orgAggTargetIds(projectKey) {
  return orgAggGetMembers(projectKey)
    .filter(function (m) { return m && m.id && orgAggIsTarget(m); })
    .map(function (m) { return m.id; });
}

function orgAggTargetCount(projectKey) {
  return orgAggTargetIds(projectKey).length;
}

function orgAggDisplayName(m, projectKey) {
  if (!m) return '-';
  var pk = String(projectKey || 'ram');
  if (pk === 'orca' && typeof orcaDisplayName === 'function') return orcaDisplayName(m);
  if (pk === 'eni' && typeof eniDisplayName === 'function') return eniDisplayName(m);
  if (typeof displayName === 'function') return displayName(m);
  return m.name || m.username || m.id || '-';
}

/** List label: prefer username (□ kai), then name, then id. */
function orgAggListLabel(m, projectKey) {
  if (!m) return '-';
  var user = String(m.username || '').trim().replace(/^@/, '');
  if (user) return user;
  var wallet = String(m.walletAddress || '').trim();
  if (wallet && String(projectKey || '') === 'eni') {
    return wallet.length > 12 ? ('…' + wallet.slice(-8)) : wallet;
  }
  var name = String(m.name || '').trim();
  if (name) return name;
  return String(m.id || '-');
}

function orgAggPreserveOnSave(old, obj) {
  if (!old || !obj) return obj;
  if (old.aggTarget === true) obj.aggTarget = true;
  else delete obj.aggTarget;
  // Drop obsolete owner fields if present (no migration wipe of other data).
  delete obj.ownerId;
  delete obj.ownerName;
  if (old.homeVisible != null) obj.homeVisible = old.homeVisible;
  if (old.seriesIndex != null) obj.seriesIndex = old.seriesIndex;
  if (old.seriesRootId != null) obj.seriesRootId = old.seriesRootId;
  if (old.sortOrder != null) obj.sortOrder = old.sortOrder;
  return obj;
}

function orgAggApplyCheckbox(obj, checkboxEl) {
  if (!obj || !checkboxEl) return obj;
  if (checkboxEl.checked) obj.aggTarget = true;
  else delete obj.aggTarget;
  delete obj.ownerId;
  delete obj.ownerName;
  return obj;
}

function orgAggCheckboxHtml(projectKey, checked, inputId) {
  var pk = String(projectKey || 'ram');
  var sid = inputId || 'aggTargetInput';
  var on = !!checked;
  return (
    '<label class="orgAggEditCheck" for="' + orgAggEscape(sid) + '">' +
      '<input type="checkbox" class="orgAggEditCb" id="' + orgAggEscape(sid) +
        '" data-project="' + orgAggEscape(pk) + '"' + (on ? ' checked' : '') + '>' +
      '<span>集計対象アカウントにする</span>' +
    '</label>' +
    '<p class="help" style="margin-top:4px">ONにすると集計の「全アカウント合計」へこのアカウントの収益を加算します。組織図の親子・位置は変わりません。</p>'
  );
}

function orgAggBarHtml(projectKey) {
  var pk = String(projectKey || 'ram');
  var count = orgAggTargetCount(pk);
  return (
    '<div class="orgAggBar lineBox">' +
      '<div class="orgAggBarRow">' +
        '<label class="orgAggLabel">集計対象アカウント</label>' +
      '</div>' +
      '<div class="orgAggMeta">選択中：<b>' + count + '</b>件</div>' +
      '<div class="homeToggleRow" style="margin-top:8px">' +
        '<button type="button" class="btn2" onclick="orgAggOpenEditModal(\'' + pk + '\')">集計対象アカウントを追加・編集</button>' +
      '</div>' +
      '<p class="help" style="margin-top:8px">集計対象は「全アカウント合計」へ加算するかどうかだけを決めます。報酬計算・親子関係・チームボリュームには影響しません。</p>' +
    '</div>' +
    '<p class="panelTitle">全アカウント合計</p>'
  );
}

function orgAggRerenderManage(projectKey) {
  var pk = String(projectKey || 'ram');
  if (pk === 'orca' && typeof orcaRenderAccountManage === 'function') orcaRenderAccountManage();
  else if (pk === 'eni' && typeof eniRenderAccountManage === 'function') eniRenderAccountManage();
  else if (typeof renderAccountManage === 'function') renderAccountManage();
}

function orgAggPersist(projectKey) {
  var pk = String(projectKey || 'ram');
  if (orgAggIsSim(pk)) return;
  if (typeof markActivity === 'function') markActivity();
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
}

function orgAggAfterChange(projectKey) {
  var pk = String(projectKey || 'ram');
  if (pk === 'orca' && typeof orcaRender === 'function') orcaRender();
  else if (pk === 'eni' && typeof eniRender === 'function') eniRender();
  else if (typeof render === 'function') render();
  else orgAggRerenderManage(pk);
}

function orgAggOpenEditModal(projectKey) {
  var pk = String(projectKey || 'ram');
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') return;

  var membersList = orgAggGetMembers(pk).slice().sort(function (a, b) {
    return String(orgAggListLabel(a, pk)).localeCompare(String(orgAggListLabel(b, pk)), 'ja');
  });
  var checks = membersList.map(function (m, idx) {
    var checked = orgAggIsTarget(m) ? ' checked' : '';
    var primary = orgAggListLabel(m, pk);
    var secondary = '';
    var disp = orgAggDisplayName(m, pk);
    if (disp && disp !== primary) {
      secondary = ' <span class="orgAggCheckSub">(' + orgAggEscape(disp) + ')</span>';
    }
    var cid = 'orgAggCb_' + pk + '_' + idx;
    return (
      '<div class="orgAggCheckRow">' +
        '<input type="checkbox" class="orgAggAssignCb" id="' + cid + '" value="' + orgAggEscape(m.id) + '"' + checked + '>' +
        '<label class="orgAggCheckLabel" for="' + cid + '">' +
          '<span class="orgAggCheckName">' + orgAggEscape(primary) + '</span>' +
          secondary +
        '</label>' +
      '</div>'
    );
  }).join('');

  modalTitle.textContent = '集計対象アカウントを追加・編集';
  modalContent.innerHTML =
    '<div class="lineBox orgAggAssignPanel">' +
      '<p class="help">組織図にあるアカウントのうち、「全アカウント合計」へ含めたいものにチェックを付けてください。ノード追加や親子変更は行いません。</p>' +
      '<div class="orgAggMeta" style="margin-top:10px">アカウント一覧（' + membersList.length + '件）</div>' +
      '<div class="orgAggCheckList" id="orgAggAssignList">' +
        (checks || '<div class="help">組織図にアカウントがありません。</div>') +
      '</div>' +
      '<div class="homeToggleRow" style="margin-top:12px">' +
        '<button type="button" onclick="orgAggSaveAssign(\'' + pk + '\')">保存</button>' +
        '<button type="button" class="btn2" onclick="closeModal()">キャンセル</button>' +
      '</div>' +
    '</div>';
  modalBg.style.display = 'flex';
}

function orgAggSaveAssign(projectKey) {
  var pk = String(projectKey || 'ram');
  var selected = {};
  document.querySelectorAll('#orgAggAssignList .orgAggAssignCb:checked').forEach(function (cb) {
    selected[cb.value] = true;
  });
  orgAggGetMembers(pk).forEach(function (m) {
    if (!m || !m.id) return;
    if (selected[m.id]) m.aggTarget = true;
    else delete m.aggTarget;
    delete m.ownerId;
    delete m.ownerName;
  });
  orgAggPersist(pk);
  if (typeof closeModal === 'function') closeModal();
  orgAggAfterChange(pk);
  if (typeof showToast === 'function') {
    showToast('✅ 集計対象アカウントを更新しました（' + Object.keys(selected).length + '件）');
  }
}

/** Sum existing per-account reward objects for a list of ids. */
function orgAggSumRamTotals(ids) {
  var a = { personal: 0, direct: 0, second: 0, title: 0, total: 0, volume: 0 };
  (ids || []).forEach(function (id) {
    if (typeof totals !== 'function') return;
    var t = totals(id);
    a.personal += t.personal || 0;
    a.direct += t.direct || 0;
    a.second += t.second || 0;
    a.title += t.title || 0;
    a.total += t.total || 0;
    if (typeof calcVolume === 'function') a.volume += calcVolume(id) || 0;
  });
  a.daily = a.total / 30;
  return a;
}

function orgAggSumOrcaTotals(ids) {
  var a = { total: 0, personal: 0, ranking: 0, volume: 0 };
  (ids || []).forEach(function (id) {
    if (typeof orcaCalcTotals !== 'function') return;
    var t = orcaCalcTotals(id);
    a.total += t.total || 0;
    a.personal += t.personal || 0;
    a.ranking += t.ranking || 0;
    a.volume += t.volume || 0;
  });
  return a;
}

function orgAggSumEniTotals(ids) {
  var a = { total: 0, staking: 0, team: 0, volume: 0 };
  (ids || []).forEach(function (id) {
    if (typeof eniGetDisplaySummary !== 'function') return;
    var t = eniGetDisplaySummary(id);
    a.total += t.total || 0;
    a.staking += t.staking || 0;
    a.team += t.team || 0;
    a.volume += t.volume || 0;
  });
  return a;
}

if (typeof window !== 'undefined') {
  window.orgAggIsSim = orgAggIsSim;
  window.orgAggIsTarget = orgAggIsTarget;
  window.orgAggTargetIds = orgAggTargetIds;
  window.orgAggTargetCount = orgAggTargetCount;
  window.orgAggPreserveOnSave = orgAggPreserveOnSave;
  window.orgAggApplyCheckbox = orgAggApplyCheckbox;
  window.orgAggCheckboxHtml = orgAggCheckboxHtml;
  window.orgAggBarHtml = orgAggBarHtml;
  window.orgAggOpenEditModal = orgAggOpenEditModal;
  window.orgAggSaveAssign = orgAggSaveAssign;
  window.orgAggSumRamTotals = orgAggSumRamTotals;
  window.orgAggSumOrcaTotals = orgAggSumOrcaTotals;
  window.orgAggSumEniTotals = orgAggSumEniTotals;
  window.orgAggListLabel = orgAggListLabel;
}
