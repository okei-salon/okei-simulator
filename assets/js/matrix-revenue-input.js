/* OUKEI HUB MATRIX Revenue Input */

let matrixRegisterInFlight = false;
let matrixRegisterCooldownUntil = 0;
let matrixFocusAccountId = '';

function ensureMatrixInputAccounts() {
  if (typeof settings === 'undefined' || !settings || typeof settings !== 'object') {
    throw new Error('settings が初期化されていません');
  }
  if (!Array.isArray(settings.matrixInputAccounts)) settings.matrixInputAccounts = [];
}

function matrixMigrateInputAccountsFromRevenueLog() {
  ensureMatrixInputAccounts();
  let existing = {};
  settings.matrixInputAccounts.forEach(function (acc) {
    if (acc && acc.id) existing[acc.id] = true;
  });
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') return;
  Object.keys(settings.revenueLog).forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry || !entry.matrixAccounts) return;
    Object.keys(entry.matrixAccounts).forEach(function (id) {
      if (existing[id]) return;
      let ae = entry.matrixAccounts[id];
      let name = String(ae && ae.accountName || id).replace(/^@/, '');
      settings.matrixInputAccounts.push({
        id: id,
        username: name,
        name: name,
        investment: 0
      });
      existing[id] = true;
    });
  });
}

function getMatrixInputAccounts() {
  ensureMatrixInputAccounts();
  matrixMigrateInputAccountsFromRevenueLog();
  return settings.matrixInputAccounts.map(function (acc) {
    return {
      id: acc.id,
      username: String(acc.username || acc.name || '未入力').replace(/^@/, ''),
      name: acc.name || acc.username || '未入力',
      investment: Number(acc.investment) || 0
    };
  });
}

function matrixFindInputAccountByName(name) {
  name = String(name || '').trim().replace(/^@/, '');
  if (!name) return null;
  return getMatrixInputAccounts().find(function (acc) {
    let label = String(acc.username || acc.name || '').trim().replace(/^@/, '');
    return label.toLowerCase() === name.toLowerCase();
  }) || null;
}

function getTodayMatrixRevenueEntry() {
  ensureRevenueLog();
  return settings.revenueLog[todayKey()] || null;
}

function getMatrixAccountEntry(entry, accountId) {
  if (!entry || !entry.matrixAccounts || !entry.matrixAccounts[accountId]) return null;
  let ae = entry.matrixAccounts[accountId];
  if (typeof pdIsMatrixAccountEntryPresent === 'function') {
    return pdIsMatrixAccountEntryPresent(ae) ? ae : null;
  }
  return ae;
}

function isMatrixAccountEntered(entry, accountId) {
  return getMatrixAccountEntry(entry, accountId) !== null;
}

function isMatrixFullyEntered(entry) {
  let accounts = getMatrixInputAccounts();
  if (!accounts.length) return false;
  return accounts.every(function (a) { return isMatrixAccountEntered(entry, a.id); });
}

function hasMatrixDataSavedForToday(entry) {
  if (!entry || !entry.matrixAccounts) return false;
  return getMatrixInputAccounts().some(function (a) { return isMatrixAccountEntered(entry, a.id); });
}

function matrixFormatMoney(n) {
  if (typeof money === 'function') return money(n);
  return String(Number(n) || 0);
}

function renderMatrixInputStatusBadge(done) {
  if (typeof renderInputStatusBadge === 'function') return renderInputStatusBadge(done);
  return done
    ? '<span class="ramInputStatus ramInputStatus--done">本日入力済み</span>'
    : '<span class="ramInputStatus ramInputStatus--pending">未入力</span>';
}

function renderMatrixInputProgress(existing) {
  let total = getMatrixInputAccounts().length;
  let done = getMatrixInputAccounts().filter(function (a) {
    return isMatrixAccountEntered(existing, a.id);
  }).length;
  let label = done + ' / ' + total;
  if (total > 0 && done === total) label += ' 完了';
  return '<div class="ramInputProgress">' +
    '<span class="ramInputProgressLabel">入力状況</span>' +
    '<span class="ramInputProgressVal' + (total > 0 && done === total ? ' isComplete' : '') + '">' + label + '</span>' +
    '</div>';
}

function renderMatrixInputAccountCard(acc, existing) {
  let ae = existing ? getMatrixAccountEntry(existing, acc.id) : null;
  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };
  let revVal = ae && ae.revenueBonus != null ? ae.revenueBonus : '';
  let matVal = ae && ae.matrixBonus != null ? ae.matrixBonus : '';

  return '<section class="ramInputAccount matrixInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' +
    renderMatrixInputStatusBadge(isMatrixAccountEntered(existing, acc.id)) +
    '<span class="ramInputAccountName">' + esc(acc.username || acc.name) + '</span></div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">収益ボーナス</span>' +
    '<div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="matrixRevenueBonus_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + esc(revVal) + '">' +
    '<span class="ramInputHint">1:1レベルマッチ・3:3バイナリー・達成ボーナス等の単発報酬合計</span></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">MATRIXボーナス</span>' +
    '<div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="matrixMatrixBonus_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + esc(matVal) + '">' +
    '<span class="ramInputHint">毎月ボーナス用（未入力・0でも保存可）</span></div></div>' +
    (typeof aimRenderInputAccountActions === 'function'
      ? aimRenderInputAccountActions('matrix', acc.id, acc.username, 'openMatrixRevenueInput')
      : '') +
    '</div></section>';
}

function matrixReadAccountValues(accountId) {
  let revEl = document.getElementById('matrixRevenueBonus_' + accountId);
  let matEl = document.getElementById('matrixMatrixBonus_' + accountId);
  return {
    revenueBonus: revEl ? revEl.value : '',
    matrixBonus: matEl ? matEl.value : ''
  };
}

function collectMatrixRevenueFromForm() {
  let out = {};
  let errors = [];
  getMatrixInputAccounts().forEach(function (acc) {
    let vals = matrixReadAccountValues(acc.id);
    let hasAny = [vals.revenueBonus, vals.matrixBonus].some(function (v) {
      return v != null && String(v).trim() !== '';
    });
    if (!hasAny) return;
    out[acc.id] = {
      accountName: acc.username || acc.name,
      revenueBonus: vals.revenueBonus,
      matrixBonus: vals.matrixBonus
    };
  });
  if (!Object.keys(out).length) {
    errors.push('保存する内容がありません。収益ボーナス・MATRIXボーナスのいずれかを入力してください。');
  }
  return { matrixAccounts: out, errors: errors };
}

function renderMatrixInputFooter() {
  return '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" id="matrixSaveRevenueBtn">保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" id="matrixOpenAddAccountBtn">アカウント追加</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRevenueProjectSelect()">プロジェクト選択に戻る</button>' +
    '</div>';
}

function bindMatrixModalActionButtons() {
  let saveBtn = document.getElementById('matrixSaveRevenueBtn');
  if (saveBtn && saveBtn.dataset.matrixBound !== '1') {
    saveBtn.dataset.matrixBound = '1';
    saveBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      matrixSaveRevenueEntry();
    });
  }
  let addBtn = document.getElementById('matrixOpenAddAccountBtn');
  if (addBtn && addBtn.dataset.matrixBound !== '1') {
    addBtn.dataset.matrixBound = '1';
    addBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      openMatrixAddAccountForm();
    });
  }
}

function matrixSaveRevenueEntry() {
  try {
    let collected = collectMatrixRevenueFromForm();
    if (collected.errors && collected.errors.length) {
      alert(collected.errors[0]);
      return;
    }
    if (typeof pdSaveMatrixPerformanceEntry !== 'function') {
      alert('MATRIX保存処理が利用できません。');
      return;
    }
    let dateKey = typeof todayKey === 'function' ? todayKey() : '';
    Object.keys(collected.matrixAccounts).forEach(function (accountId) {
      let vals = collected.matrixAccounts[accountId];
      pdSaveMatrixPerformanceEntry(
        dateKey,
        accountId,
        vals.accountName,
        vals.revenueBonus,
        vals.matrixBonus
      );
    });
    if (typeof markActivity === 'function') markActivity();
    if (typeof pdNotifyPerformanceChanged === 'function') {
      pdNotifyPerformanceChanged({ type: 'save', projectKey: 'matrix', dateKey: dateKey });
    }
    if (typeof hubFinishRevenueInputSave === 'function') {
      hubFinishRevenueInputSave('✅ MATRIX収益を保存しました', function () {
        let entry = typeof getRevenueEntry === 'function' ? getRevenueEntry(dateKey) : null;
        return !!(entry && entry.matrixAccounts && Object.keys(entry.matrixAccounts).length);
      });
    } else {
      if (typeof persistHubSettings === 'function') persistHubSettings({ immediate: true });
      if (typeof render === 'function') render();
      if (typeof refreshHomeAfterRevenueSave === 'function') refreshHomeAfterRevenueSave();
      if (typeof showPage === 'function') showPage('home');
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast('✅ MATRIX収益を保存しました');
    }
  } catch (err) {
    console.error('[matrix]', err);
    alert('保存できませんでした。時間をおいて再度お試しください。');
  }
}

function matrixShowRegisterError(message) {
  let box = document.getElementById('matrixRegisterError');
  if (!box) return;
  box.textContent = message || 'アカウントを登録できませんでした。';
  box.classList.remove('hidden');
}

function matrixClearRegisterError() {
  let box = document.getElementById('matrixRegisterError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('hidden');
}

function registerMatrixAccount() {
  let now = Date.now();
  if (matrixRegisterInFlight) return;
  if (now < matrixRegisterCooldownUntil) return;
  matrixRegisterCooldownUntil = now + 1200;
  matrixClearRegisterError();

  let nameEl = document.getElementById('matrixNewAccountName');
  let username = ((nameEl && nameEl.value) || '').trim().replace(/^@/, '');
  if (!username) {
    matrixRegisterCooldownUntil = 0;
    matrixShowRegisterError('アカウント名を入力してください。');
    return;
  }

  matrixRegisterInFlight = true;
  try {
    if (matrixFindInputAccountByName(username)) {
      matrixRegisterCooldownUntil = 0;
      matrixShowRegisterError('同じアカウント名が既に登録されています。');
      matrixRegisterInFlight = false;
      return;
    }
    let id = 'matrix_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    ensureMatrixInputAccounts();
    settings.matrixInputAccounts.push({
      id: id,
      username: username,
      name: username,
      investment: 0
    });
    if (typeof persistHubSettings === 'function') persistHubSettings();
    if (typeof markActivity === 'function') markActivity();
    matrixFocusAccountId = id;
    openMatrixRevenueInput({ focusAccountId: id });
    if (typeof showToast === 'function') showToast('✅ アカウントを登録しました');
  } catch (err) {
    matrixRegisterCooldownUntil = 0;
    console.error('[matrixRegister]', err);
    matrixShowRegisterError('アカウントを登録できませんでした。');
    matrixRegisterInFlight = false;
    return;
  }
  matrixRegisterInFlight = false;
}

function openMatrixAddAccountForm() {
  matrixRegisterInFlight = false;
  matrixRegisterCooldownUntil = 0;
  modalTitle.textContent = 'MATRIX アカウント追加';
  modalContent.innerHTML =
    '<p class="help">アカウント名を登録します。日々の実績入力ではこの名前を再入力する必要はありません。</p>' +
    '<p class="help hidden" id="matrixRegisterError" style="color:#fca5a5;font-weight:800;"></p>' +
    '<label for="matrixNewAccountName">アカウント名</label>' +
    '<input id="matrixNewAccountName" type="text" placeholder="例：kai1">' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '<button type="button" class="btn2" id="matrixAddBackBtn">入力画面に戻る</button>' +
    '<button type="button" class="ramInputBtnSave" id="matrixRegisterAccountBtn">このアカウントを登録</button></div>';
  modalBg.style.display = 'flex';
  let backBtn = document.getElementById('matrixAddBackBtn');
  if (backBtn) backBtn.onclick = function () { openMatrixRevenueInput(); };
  let regBtn = document.getElementById('matrixRegisterAccountBtn');
  if (regBtn) regBtn.onclick = registerMatrixAccount;
  setTimeout(function () {
    let el = document.getElementById('matrixNewAccountName');
    if (el && typeof el.focus === 'function') el.focus();
  }, 80);
}

function openMatrixRevenueInput(opts) {
  opts = opts || {};
  if (opts.focusAccountId) matrixFocusAccountId = String(opts.focusAccountId);
  matrixMigrateInputAccountsFromRevenueLog();
  let accounts = getMatrixInputAccounts();
  modalTitle.textContent = 'MATRIX 収益入力';

  if (!accounts.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>アカウントがありません</b>' +
      '<p class="help">「アカウント追加」からMATRIXアカウント名を登録してください。</p></div>' +
      renderMatrixInputFooter();
    modalBg.style.display = 'flex';
    bindMatrixModalActionButtons();
    return;
  }

  let existing = getTodayMatrixRevenueEntry();
  modalContent.innerHTML =
    renderMatrixInputProgress(existing) +
    '<p class="help ramInputLead">登録済みアカウントごとに収益ボーナス・MATRIXボーナスを入力して保存します。未入力項目は0として保存できます。</p>' +
    '<div class="ramInputList">' + accounts.map(function (acc) {
      return renderMatrixInputAccountCard(acc, existing);
    }).join('') + '</div>' + renderMatrixInputFooter();
  modalBg.style.display = 'flex';
  bindMatrixModalActionButtons();
}

if (typeof window !== 'undefined') {
  window.getMatrixInputAccounts = getMatrixInputAccounts;
  window.openMatrixRevenueInput = openMatrixRevenueInput;
  window.openMatrixAddAccountForm = openMatrixAddAccountForm;
  window.registerMatrixAccount = registerMatrixAccount;
  window.matrixSaveRevenueEntry = matrixSaveRevenueEntry;
  window.isMatrixAccountEntered = isMatrixAccountEntered;
  window.isMatrixFullyEntered = isMatrixFullyEntered;
  window.hasMatrixDataSavedForToday = hasMatrixDataSavedForToday;
  window.matrixMigrateInputAccountsFromRevenueLog = matrixMigrateInputAccountsFromRevenueLog;
}
