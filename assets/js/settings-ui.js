/* OUKEI HUB Settings UI — Ver1.8.0 */

var pmDraftState = null;
var pmDraftSnapshot = '';
var pmFxDraftSnapshot = '';

function pmCloneMasterState(state) {
  return JSON.parse(JSON.stringify(state));
}

function pmInitDraftFromCurrent() {
  pmDraftState = pmCloneMasterState(pmGetSavedMasterState());
  pmDraftSnapshot = pmSerializeMasterState(pmDraftState);
}

function pmInitDraftDefaults() {
  pmDraftState = pmCloneMasterState(pmGetDefaultMasterState());
  pmDraftSnapshot = pmSerializeMasterState(pmGetSavedMasterState());
}

function pmReadDraftState() {
  return pmCloneMasterState(pmDraftState || pmGetSavedMasterState());
}

function pmIsDraftDirty() {
  let current = pmSerializeMasterState(pmReadDraftState());
  if (!pmProjectMasterHasSaved()) {
    return current !== pmSerializeMasterState(pmGetDefaultMasterState());
  }
  return current !== pmDraftSnapshot;
}

function pmUpdateDraftProject(key, patch) {
  if (!pmDraftState || !pmDraftState.projects[key]) return;
  Object.assign(pmDraftState.projects[key], patch);
  pmRenderProjectSettingsList();
  pmHideProjectOverwriteConfirm();
}

function openProjectSettingsPage() {
  showPage('projectSettings');
}

function openFxSettingsPage() {
  showPage('fxSettings');
}

function pmCloseProjectSettings() {
  showPage('settings');
}

function pmCloseFxSettings() {
  showPage('settings');
}

function pmRenderProjectSettingsPage() {
  pmEnsureProjectMaster();
  if (pmProjectMasterHasSaved()) pmInitDraftFromCurrent();
  else pmInitDraftDefaults();
  pmRenderProjectSettingsList();
  pmHideProjectOverwriteConfirm();
  pmUpdateProjectSaveUi();
}

function pmIsOtherProject(p) {
  if (!p) return false;
  if (p.kind === 'other') return true;
  return typeof PM_BUILTIN !== 'undefined' && !PM_BUILTIN[p.key] && p.key !== 'demo2026';
}

function pmRenderProjectSettingsList() {
  let el = document.getElementById('pmProjectList');
  if (!el || !pmDraftState) return;
  let rows = (pmDraftState.order || []).map(function (key) {
    return pmDraftState.projects[key];
  }).filter(Boolean);

  el.innerHTML = rows.map(function (p) {
    return '<button type="button" class="pmProjectCard" onclick="pmOpenProjectEdit(\'' + p.key + '\')">' +
      '<div class="pmProjectCardGlow"></div>' +
      '<div class="pmProjectCardTop">' +
      pmRenderProjectIcon(p.key, 'pmProjectCardIcon', p) +
      '<div class="pmProjectCardHead">' +
      '<div class="pmProjectCardName">' + pmEscape(p.name) + '</div>' +
      '<div class="pmProjectCardMeta"><span>表示</span><b class="' + (p.visible ? 'isOn' : 'isOff') + '">' + (p.visible ? 'ON' : 'OFF') + '</b></div>' +
      '</div></div>' +
      '<div class="pmProjectCardRows">' +
      '<div class="pmProjectCardRow"><span>開始日</span><b>' + pmEscape(p.startDate || '—') + '</b></div>' +
      '<div class="pmProjectCardRow"><span>資産計上率</span><b>' + Math.round(p.inclusionRate) + '%</b></div>' +
      '</div></button>';
  }).join('');
}

function pmOpenProjectEdit(key) {
  if (!pmDraftState || !pmDraftState.projects[key]) return;
  let p = pmDraftState.projects[key];
  modalTitle.textContent = p.name + ' の設定';
  if (pmIsOtherProject(p)) {
    modalContent.innerHTML =
      '<div class="pmEditForm">' +
      pmRenderProjectIcon(key, 'pmEditIcon', p) +
      '<label for="pmEditName">プロジェクト名</label>' +
      '<input id="pmEditName" type="text" maxlength="40" value="' + pmEscape(p.name || '') + '">' +
      '<label for="pmEditIconKey">アイコン</label>' +
      '<select id="pmEditIconKey">' + pmIconOptionsHtml(p.iconKey || 'custom') + '</select>' +
      '<label class="pmToggleRow"><span>表示</span>' +
      '<input type="checkbox" id="pmEditVisible" ' + (p.visible ? 'checked' : '') + '></label>' +
      '<label for="pmEditStartDate">開始日</label>' +
      '<input id="pmEditStartDate" type="text" value="' + pmEscape(p.startDate || '') + '" placeholder="2024/01/20">' +
      '<label for="pmEditInclusionRate">資産計上率</label>' +
      '<div class="pmRateInputWrap"><input id="pmEditInclusionRate" type="number" min="0" max="100" step="1" value="' + Math.round(p.inclusionRate) + '"><span>%</span></div>' +
      '<label for="pmEditMemo">メモ（任意）</label>' +
      '<textarea id="pmEditMemo" rows="3" placeholder="メモ">' + pmEscape(p.memo || '') + '</textarea>' +
      '<div class="pmEditActions">' +
      '<button type="button" class="btn2" onclick="closeModal()">閉じる</button>' +
      '<button type="button" onclick="pmApplyProjectEdit(\'' + key + '\')">反映</button>' +
      '</div></div>';
  } else {
    modalContent.innerHTML =
      '<div class="pmEditForm">' +
      pmRenderProjectIcon(key, 'pmEditIcon', p) +
      '<label class="pmToggleRow"><span>表示</span>' +
      '<input type="checkbox" id="pmEditVisible" ' + (p.visible ? 'checked' : '') + '></label>' +
      '<label for="pmEditStartDate">開始日</label>' +
      '<input id="pmEditStartDate" type="text" value="' + pmEscape(p.startDate || '') + '" placeholder="2024/01/20">' +
      '<label for="pmEditInclusionRate">資産計上率</label>' +
      '<div class="pmRateInputWrap"><input id="pmEditInclusionRate" type="number" min="0" max="100" step="1" value="' + Math.round(p.inclusionRate) + '"><span>%</span></div>' +
      '<div class="pmEditActions">' +
      '<button type="button" class="btn2" onclick="closeModal()">閉じる</button>' +
      '<button type="button" onclick="pmApplyProjectEdit(\'' + key + '\')">反映</button>' +
      '</div></div>';
  }
  modalBg.style.display = 'flex';
}

function pmApplyProjectEdit(key) {
  if (!pmDraftState || !pmDraftState.projects[key]) return;
  let p = pmDraftState.projects[key];
  let visibleEl = document.getElementById('pmEditVisible');
  let startEl = document.getElementById('pmEditStartDate');
  let rateEl = document.getElementById('pmEditInclusionRate');
  let patch = {
    visible: !!(visibleEl && visibleEl.checked),
    startDate: (startEl && startEl.value.trim()) || '—',
    inclusionRate: Math.max(0, Math.min(100, Number(rateEl && rateEl.value) || 0))
  };
  if (pmIsOtherProject(p)) {
    let nameEl = document.getElementById('pmEditName');
    let iconEl = document.getElementById('pmEditIconKey');
    let memoEl = document.getElementById('pmEditMemo');
    let name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      if (typeof showToast === 'function') showToast('プロジェクト名を入力してください');
      return;
    }
    patch.name = name;
    patch.iconKey = iconEl ? iconEl.value : 'custom';
    patch.memo = memoEl ? memoEl.value.trim() : '';
  }
  pmUpdateDraftProject(key, patch);
  closeModal();
}

function pmOpenProjectAdd() {
  modalTitle.textContent = 'プロジェクト追加';
  modalContent.innerHTML =
    '<div class="pmAddChoice lineBox">' +
    '<b>追加方法を選択</b>' +
    '<p class="help">OUKEI公式プロジェクトはコード入力、その他は自由追加できます。</p>' +
    '<button type="button" onclick="pmOpenOukeiProjectAdd()">🏷 OUKEIプロジェクトを追加</button>' +
    '<button type="button" class="btn2" onclick="pmOpenOtherProjectAdd()">📁 その他プロジェクトを追加</button>' +
    '</div>';
  modalBg.style.display = 'flex';
}

function pmOpenOukeiProjectAdd() {
  modalTitle.textContent = 'OUKEIプロジェクトを追加';
  modalContent.innerHTML =
    '<div class="pmAddForm">' +
    '<label for="pmAddCodeInput">プロジェクトコード</label>' +
    '<input id="pmAddCodeInput" type="text" maxlength="32" placeholder="プロジェクトコードを入力">' +
    '<p class="help">コードが正しい場合のみプロジェクトを追加できます。</p>' +
    '<p id="pmAddCodeError" class="pmAddCodeError hidden"></p>' +
    '<div class="pmEditActions">' +
    '<button type="button" class="btn2" onclick="closeModal()">キャンセル</button>' +
    '<button type="button" onclick="pmConfirmProjectAdd()">確認</button>' +
    '</div></div>';
  modalBg.style.display = 'flex';
  setTimeout(function () {
    let input = document.getElementById('pmAddCodeInput');
    if (input) input.focus();
  }, 80);
}

function pmOpenOtherProjectAdd() {
  modalTitle.textContent = 'その他プロジェクトを追加';
  modalContent.innerHTML =
    '<div class="pmAddForm">' +
    '<label for="pmOtherName">プロジェクト名</label>' +
    '<input id="pmOtherName" type="text" maxlength="40" placeholder="プロジェクト名">' +
    '<label for="pmOtherIcon">アイコン</label>' +
    '<select id="pmOtherIcon">' + pmIconOptionsHtml('custom') + '</select>' +
    '<label for="pmOtherStartDate">開始日</label>' +
    '<input id="pmOtherStartDate" type="text" placeholder="2024/01/20">' +
    '<label for="pmOtherInclusionRate">資産計上率</label>' +
    '<div class="pmRateInputWrap"><input id="pmOtherInclusionRate" type="number" min="0" max="100" step="1" value="100"><span>%</span></div>' +
    '<label class="pmToggleRow"><span>表示</span>' +
    '<input type="checkbox" id="pmOtherVisible" checked></label>' +
    '<label for="pmOtherMemo">メモ（任意）</label>' +
    '<textarea id="pmOtherMemo" rows="3" placeholder="メモ"></textarea>' +
    '<p id="pmOtherAddError" class="pmAddCodeError hidden"></p>' +
    '<div class="pmEditActions">' +
    '<button type="button" class="btn2" onclick="closeModal()">キャンセル</button>' +
    '<button type="button" onclick="pmConfirmOtherProjectAdd()">追加</button>' +
    '</div></div>';
  modalBg.style.display = 'flex';
  setTimeout(function () {
    let input = document.getElementById('pmOtherName');
    if (input) input.focus();
  }, 80);
}

function pmConfirmOtherProjectAdd() {
  let nameEl = document.getElementById('pmOtherName');
  let iconEl = document.getElementById('pmOtherIcon');
  let startEl = document.getElementById('pmOtherStartDate');
  let rateEl = document.getElementById('pmOtherInclusionRate');
  let visibleEl = document.getElementById('pmOtherVisible');
  let memoEl = document.getElementById('pmOtherMemo');
  let err = document.getElementById('pmOtherAddError');
  let name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (err) {
      err.textContent = 'プロジェクト名を入力してください。';
      err.classList.remove('hidden');
    }
    return;
  }
  if (!pmDraftState) pmInitDraftDefaults();
  let key = pmSlugProjectKey(name, pmDraftState.projects);
  pmDraftState.projects[key] = {
    key: key,
    name: name,
    startDate: (startEl && startEl.value.trim()) || '—',
    inclusionRate: Math.max(0, Math.min(100, Number(rateEl && rateEl.value) || 100)),
    visible: !!(visibleEl && visibleEl.checked),
    registered: true,
    kind: 'other',
    iconKey: iconEl ? iconEl.value : 'custom',
    memo: memoEl ? memoEl.value.trim() : ''
  };
  if (pmDraftState.order.indexOf(key) === -1) {
    pmDraftState.order.push(key);
  }
  closeModal();
  pmRenderProjectSettingsList();
  if (typeof showToast === 'function') showToast('✅ ' + name + ' を追加しました');
}

function pmConfirmProjectAdd() {
  let input = document.getElementById('pmAddCodeInput');
  let err = document.getElementById('pmAddCodeError');
  let code = input ? input.value : '';
  let result = pmValidateProjectCode(code);
  if (!result.ok) {
    if (err) {
      err.textContent = result.message;
      err.classList.remove('hidden');
    }
    return;
  }
  let meta = PM_CODE_META[result.key] || { name: result.key, startDate: '—' };
  if (!pmDraftState) pmInitDraftDefaults();
  pmDraftState.projects[result.key] = {
    key: result.key,
    name: meta.name,
    startDate: meta.startDate,
    inclusionRate: pmDefaultInclusionRate(result.key),
    visible: true,
    registered: true,
    iconKey: result.key
  };
  if (pmDraftState.order.indexOf(result.key) === -1) {
    pmDraftState.order.push(result.key);
  }
  closeModal();
  pmRenderProjectSettingsList();
  if (typeof showToast === 'function') showToast('✅ ' + meta.name + ' を追加しました');
}

function pmOnProjectSettingsInput() {
  pmHideProjectOverwriteConfirm();
  pmUpdateProjectSaveUi();
}

function pmUpdateProjectSaveUi() {
  let saveBtn = document.getElementById('pmProjectSaveBtn');
  if (saveBtn) saveBtn.classList.remove('hidden');
}

function pmHideProjectOverwriteConfirm() {
  let confirm = document.getElementById('pmProjectOverwriteConfirm');
  let saveBtn = document.getElementById('pmProjectSaveBtn');
  if (confirm) confirm.classList.add('hidden');
  if (saveBtn) saveBtn.classList.remove('hidden');
}

function pmShowProjectOverwriteConfirm() {
  let confirm = document.getElementById('pmProjectOverwriteConfirm');
  let saveBtn = document.getElementById('pmProjectSaveBtn');
  if (confirm) confirm.classList.remove('hidden');
  if (saveBtn) saveBtn.classList.add('hidden');
}

function pmTrySaveProjectSettings() {
  if (pmProjectMasterHasSaved()) {
    if (!pmIsDraftDirty()) {
      if (typeof showToast === 'function') showToast('変更はありません');
      return;
    }
    pmShowProjectOverwriteConfirm();
    return;
  }
  pmCommitProjectSettings();
}

function pmCancelProjectOverwrite() {
  pmHideProjectOverwriteConfirm();
}

function pmConfirmProjectOverwrite() {
  pmCommitProjectSettings();
}

function pmCommitProjectSettings() {
  pmCommitProjectMaster(pmReadDraftState());
  pmDraftSnapshot = pmSerializeMasterState(pmReadDraftState());
  pmHideProjectOverwriteConfirm();
  if (typeof showToast === 'function') showToast('✅ プロジェクト設定を保存しました');
  pmRenderProjectSettingsList();
  if (typeof renderPortfolio === 'function') renderPortfolio();
  if (typeof render === 'function') render();
}

function pmRenderFxSettingsPage() {
  pmEnsureFxSettings();
  let input = document.getElementById('pmFxRateInput');
  if (input) input.value = pmGetFxRate();
  pmFxDraftSnapshot = String(pmGetFxRate());
  pmHideFxOverwriteConfirm();
}

function pmIsFxDirty() {
  let input = document.getElementById('pmFxRateInput');
  let val = String(Number(input && input.value) || pmGetFxRate());
  if (!pmFxHasSaved()) return val !== '155';
  return val !== pmFxDraftSnapshot;
}

function pmOnFxSettingsInput() {
  pmHideFxOverwriteConfirm();
}

function pmTrySaveFxSettings() {
  if (pmFxHasSaved()) {
    if (!pmIsFxDirty()) {
      if (typeof showToast === 'function') showToast('変更はありません');
      return;
    }
    pmShowFxOverwriteConfirm();
    return;
  }
  pmCommitFxSettingsForm();
}

function pmHideFxOverwriteConfirm() {
  let confirm = document.getElementById('pmFxOverwriteConfirm');
  let saveBtn = document.getElementById('pmFxSaveBtn');
  if (confirm) confirm.classList.add('hidden');
  if (saveBtn) saveBtn.classList.remove('hidden');
}

function pmShowFxOverwriteConfirm() {
  let confirm = document.getElementById('pmFxOverwriteConfirm');
  let saveBtn = document.getElementById('pmFxSaveBtn');
  if (confirm) confirm.classList.remove('hidden');
  if (saveBtn) saveBtn.classList.add('hidden');
}

function pmCancelFxOverwrite() {
  pmHideFxOverwriteConfirm();
}

function pmConfirmFxOverwrite() {
  pmCommitFxSettingsForm();
}

function pmCommitFxSettingsForm() {
  let input = document.getElementById('pmFxRateInput');
  pmCommitFxSettings(Number(input && input.value));
  pmFxDraftSnapshot = String(pmGetFxRate());
  pmHideFxOverwriteConfirm();
  if (typeof showToast === 'function') showToast('✅ 為替設定を保存しました');
  if (typeof renderPortfolio === 'function') renderPortfolio();
}

function openProjectAdd() {
  openProjectSettingsPage();
  setTimeout(function () { pmOpenProjectAdd(); }, 120);
}

function addProjectByCode() {
  openProjectAdd();
}

function renderSettingsHub() {
  /* settings hub is static */
}

function renderSettings() {
  renderSettingsHub();
  let dialect = settings.ochanDialect === 'kansai' ? 'kansai' : 'standard';
  document.querySelectorAll('input[name=ochanDialect]').forEach(function (el) {
    el.checked = el.value === dialect;
  });
  let lastUpdate = document.getElementById('settingsLastUpdate');
  let lastBackup = document.getElementById('settingsLastBackup');
  if (lastUpdate) lastUpdate.textContent = settings.lastUpdate || '-';
  if (lastBackup) lastBackup.textContent = settings.lastBackup || '-';
}

function saveSettings() {
  settings.currencyMode = 'both';
  settings.yenRate = pmGetFxRate();
  settings.ochanDialect = (document.querySelector('input[name=ochanDialect]:checked') || {}).value || 'standard';
  settings.useRAM = true;
  pmSyncLegacyFlags();
  settings.lastUpdate = new Date().toLocaleString();
  if (typeof markActivity === 'function') markActivity();
  if (typeof render === 'function') render();
  if (typeof showSaved === 'function') showSaved();
}

function renderDynamicProjects() {
  if (typeof menuDynamicProjects === 'undefined') return;
  let out = '';
  pmGetRegisteredProjects().forEach(function (p) {
    if (p.key === 'ram') return;
    out += '<div class="menuItem" onclick="alert(\'' + pmEscape(p.name) + 'は準備中です\')">' + pmEscape(p.name) + '</div>';
  });
  menuDynamicProjects.innerHTML = out;
}
