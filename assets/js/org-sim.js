/* OUKEI HUB Organization Simulation helpers — Ver2.0.39
 * Shared start-chooser / end-confirm UI + deep-clone utilities.
 * Working sim data must never be written to production org / Firestore.
 */

function orgSimDeepClone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function hubIsAnyOrgSimActive() {
  return !!(
    (typeof simMode !== 'undefined' && simMode) ||
    (typeof orcaSimMode !== 'undefined' && orcaSimMode) ||
    (typeof eniSimMode !== 'undefined' && eniSimMode)
  );
}

function orgSimDefaultSaveName(projectKey) {
  var prefix =
    projectKey === 'orca' ? 'ORCAシミュレーション' :
    projectKey === 'eni' ? 'ENIシミュレーション' :
    'RAMシミュレーション';
  try {
    return prefix + ' ' + new Date().toLocaleString();
  } catch (e) {
    return prefix;
  }
}

function orgSimScenarioCount(projectKey) {
  if (projectKey === 'orca') return Array.isArray(orcaScenarios) ? orcaScenarios.length : 0;
  if (projectKey === 'eni') return Array.isArray(eniScenarios) ? eniScenarios.length : 0;
  return Array.isArray(scenarios) ? scenarios.length : 0;
}

/**
 * Persist current working sim chart into project-local scenarios only.
 * Never writes working members into production org pack.
 * @returns {boolean} true if saved
 */
function orgSimSaveWorkingScenario(projectKey, nameOpt) {
  var key = String(projectKey || 'ram');
  var name = nameOpt;
  if (name == null || name === '') {
    if (typeof prompt === 'function') {
      name = prompt('シミュレーション保存名', orgSimDefaultSaveName(key));
    } else {
      name = orgSimDefaultSaveName(key);
    }
  }
  if (!name) return false;
  name = String(name).trim();
  if (!name) return false;

  var deep = orgSimDeepClone;
  if (key === 'orca') {
    orcaScenarios.push({
      project: 'orca',
      name: name,
      created: new Date().toLocaleString(),
      rootId: orcaRootId || '',
      rootAccountIds: deep(orcaRootAccountIds || []),
      data: deep(orcaMembers || [])
    });
  } else if (key === 'eni') {
    if (typeof eniBuildScenarioRecord === 'function') {
      eniScenarios.push(eniBuildScenarioRecord(name));
    } else {
      eniScenarios.push({
        project: 'eni',
        name: name,
        created: new Date().toLocaleString(),
        rootId: eniRootId || '',
        rootAccountIds: deep(eniRootAccountIds || []),
        data: deep(eniMembers || [])
      });
    }
  } else {
    scenarios.push({
      project: 'ram',
      name: name,
      created: new Date().toLocaleString(),
      rootId: typeof rootId !== 'undefined' ? rootId : '',
      rootAccountIds: deep(typeof rootAccountIds !== 'undefined' ? rootAccountIds : []),
      data: deep(typeof members !== 'undefined' ? members : [])
    });
  }

  // localOnly: scenarios のみ更新。sim 中でも pack は本番スナップショットを使う
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
  return true;
}

function orgSimDiscardAndExit(projectKey) {
  var key = String(projectKey || 'ram');
  if (key === 'orca') {
    if (typeof orcaEndSimulationDiscard === 'function') orcaEndSimulationDiscard();
  } else if (key === 'eni') {
    if (typeof eniEndSimulationDiscard === 'function') eniEndSimulationDiscard();
  } else if (typeof endSimulationDiscard === 'function') {
    endSimulationDiscard();
  }
}

function orgSimBuildEndConfirmHtml(projectKey) {
  var key = String(projectKey || 'ram');
  return (
    '<div class="lineBox orgSimEndConfirm">' +
      '<p class="help" style="margin-top:0">今回のシミュレーション結果を保存しますか？</p>' +
      '<p class="help">※保存は本番組織図への反映ではありません。後から続きを編集できるシミュレーション専用データです。</p>' +
      '<div class="homeToggleRow orgSimEndActions">' +
        '<button type="button" onclick="orgSimConfirmEndSave(\'' + key + '\')">保存して終了</button>' +
        '<button type="button" class="btn2" onclick="orgSimConfirmEndDiscard(\'' + key + '\')">保存せず終了</button>' +
        '<button type="button" class="btn2" onclick="orgSimConfirmEndCancel()">キャンセル</button>' +
      '</div>' +
    '</div>'
  );
}

function orgSimRequestEnd(projectKey) {
  var key = String(projectKey || 'ram');
  var active =
    key === 'orca' ? !!orcaSimMode :
    key === 'eni' ? !!eniSimMode :
    !!simMode;
  if (!active) return;
  if (typeof modalTitle === 'undefined' || typeof modalContent === 'undefined' || typeof modalBg === 'undefined') {
    orgSimDiscardAndExit(key);
    return;
  }
  modalTitle.textContent = 'シミュレーションを終了しますか？';
  modalContent.innerHTML = orgSimBuildEndConfirmHtml(key);
  modalBg.style.display = 'flex';
}

function orgSimConfirmEndSave(projectKey) {
  var key = String(projectKey || 'ram');
  var saved = orgSimSaveWorkingScenario(key);
  if (!saved) {
    // 名前入力キャンセル時は終了せず確認モーダルを維持
    orgSimRequestEnd(key);
    return;
  }
  if (typeof closeModal === 'function') closeModal();
  orgSimDiscardAndExit(key);
  if (typeof showToast === 'function') {
    showToast(
      key === 'orca' ? '🔵 保存してシミュレーションを終了しました' :
      key === 'eni' ? '🟢 保存してシミュレーションを終了しました' :
      '🟠 保存してシミュレーションを終了しました'
    );
  }
}

function orgSimConfirmEndDiscard(projectKey) {
  var key = String(projectKey || 'ram');
  if (typeof closeModal === 'function') closeModal();
  orgSimDiscardAndExit(key);
  if (typeof showToast === 'function') {
    showToast(
      key === 'orca' ? '🔵 シミュレーションを終了しました' :
      key === 'eni' ? '🟢 シミュレーションを終了しました' :
      '🟠 シミュレーションを終了しました'
    );
  }
}

function orgSimConfirmEndCancel() {
  if (typeof closeModal === 'function') closeModal();
}

/**
 * Build modal HTML for simulation start / manage.
 * @param {'ram'|'orca'|'eni'} projectKey
 * @param {boolean} isActive
 */
function orgSimBuildPanelHtml(projectKey, isActive) {
  var key = String(projectKey || 'ram');
  var startCopy =
    key === 'orca' ? 'orcaStartSimulationCopy' :
    key === 'eni' ? 'eniStartSimulationCopy' : 'startSimulationCopy';
  var startBlank =
    key === 'orca' ? 'orcaStartSimulationBlank' :
    key === 'eni' ? 'eniStartSimulationBlank' : 'startSimulationBlank';
  var saveFn =
    key === 'orca' ? 'orcaSaveScenario' :
    key === 'eni' ? 'eniSaveScenario' : 'saveScenario';
  var listFn =
    key === 'orca' ? 'orcaOpenScenarioList' :
    key === 'eni' ? 'eniOpenScenarioList' : 'openScenarioList';
  var savedCount = orgSimScenarioCount(key);

  if (isActive) {
    return (
      '<div class="lineBox orgSimChooser">' +
        '<b>SIMULATION｜シミュレーション中</b>' +
        '<p class="help">仮データ上で編集しています。終了時に保存するかどうか確認します（本番組織図へは書き戻しません）。</p>' +
        '<div class="homeToggleRow">' +
          '<button type="button" class="orgSimEndBtn" onclick="orgSimRequestEnd(\'' + key + '\')">シミュレーション終了</button>' +
          '<button type="button" class="btn2" onclick="' + saveFn + '()">シミュレーション保存</button>' +
          '<button type="button" class="btn2" onclick="' + listFn + '()">保存一覧</button>' +
        '</div>' +
      '</div>'
    );
  }

  return (
    '<div class="lineBox orgSimChooser">' +
      '<b>シミュレーション開始方法を選択</b>' +
      '<p class="help">シミュレーションデータは本番の組織図・実績・ポートフォリオ・Cloudと完全分離されます。</p>' +
      '<div class="orgSimChoiceList">' +
        '<button type="button" class="orgSimChoiceBtn" onclick="' + startCopy + '();closeModal();showToast(\'🟣 現在の組織図をコピーして開始しました\')">' +
          '<span class="orgSimChoiceTitle">① 現在の組織図をコピーして開始</span>' +
          '<span class="help">表示中プロジェクトの本番組織図を deep copy して仮編集します。</span>' +
        '</button>' +
        '<button type="button" class="orgSimChoiceBtn" onclick="' + startBlank + '();closeModal();showToast(\'🟣 新しい組織図でシミュレーションを開始しました\')">' +
          '<span class="orgSimChoiceTitle">② 新しい組織図を作成して開始</span>' +
          '<span class="help">空の仮想ルートから、本番と独立した組織を構築します。</span>' +
        '</button>' +
        '<button type="button" class="orgSimChoiceBtn" onclick="' + listFn + '()">' +
          '<span class="orgSimChoiceTitle">③ 保存したシミュレーションから再開</span>' +
          '<span class="help">このプロジェクト専用の保存データから続きを編集します（' + savedCount + '件）。</span>' +
        '</button>' +
      '</div>' +
    '</div>'
  );
}

if (typeof window !== 'undefined') {
  window.orgSimDeepClone = orgSimDeepClone;
  window.hubIsAnyOrgSimActive = hubIsAnyOrgSimActive;
  window.orgSimBuildPanelHtml = orgSimBuildPanelHtml;
  window.orgSimRequestEnd = orgSimRequestEnd;
  window.orgSimConfirmEndSave = orgSimConfirmEndSave;
  window.orgSimConfirmEndDiscard = orgSimConfirmEndDiscard;
  window.orgSimConfirmEndCancel = orgSimConfirmEndCancel;
  window.orgSimSaveWorkingScenario = orgSimSaveWorkingScenario;
  window.orgSimDiscardAndExit = orgSimDiscardAndExit;
}
