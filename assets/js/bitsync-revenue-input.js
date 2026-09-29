/* OUKEI HUB BITSYNC Revenue Input + Principal (NFT購入 / 運用額) */

let bitsyncRegisterInFlight = false;
let bitsyncRegisterCooldownUntil = 0;
let bitsyncFocusAccountId = '';

function ensureBitsyncInputAccounts() {
  if (typeof settings === 'undefined' || !settings || typeof settings !== 'object') {
    throw new Error('settings が初期化されていません');
  }
  if (!Array.isArray(settings.bitsyncInputAccounts)) settings.bitsyncInputAccounts = [];
  settings.bitsyncInputAccounts.forEach(function (acc) {
    if (typeof bitsyncNormalizeAccount === 'function') bitsyncNormalizeAccount(acc);
  });
}

function bitsyncMigrateInputAccountsFromRevenueLog() {
  ensureBitsyncInputAccounts();
  let existing = {};
  settings.bitsyncInputAccounts.forEach(function (acc) {
    if (acc && acc.id) existing[acc.id] = true;
  });
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') return;
  Object.keys(settings.revenueLog).forEach(function (dateKey) {
    let entry = settings.revenueLog[dateKey];
    if (!entry || !entry.bitsyncAccounts) return;
    Object.keys(entry.bitsyncAccounts).forEach(function (id) {
      if (existing[id]) return;
      let ae = entry.bitsyncAccounts[id];
      let name = String(ae && ae.accountName || id).replace(/^@/, '');
      settings.bitsyncInputAccounts.push({
        id: id,
        username: name,
        name: name,
        startDate: '',
        nftPurchaseRecords: [],
        operatingRecords: []
      });
      existing[id] = true;
    });
  });
}

function getBitsyncInputAccounts() {
  ensureBitsyncInputAccounts();
  bitsyncMigrateInputAccountsFromRevenueLog();
  return settings.bitsyncInputAccounts.map(function (acc) {
    if (typeof bitsyncNormalizeAccount === 'function') bitsyncNormalizeAccount(acc);
    let nftTotal = typeof bitsyncGetNftPurchaseTotal === 'function'
      ? bitsyncGetNftPurchaseTotal(acc.id) : 0;
    let opTotal = typeof bitsyncGetOperatingPrincipalTotal === 'function'
      ? bitsyncGetOperatingPrincipalTotal(acc.id) : 0;
    return {
      id: acc.id,
      username: String(acc.username || acc.name || '未入力').replace(/^@/, ''),
      name: acc.name || acc.username || '未入力',
      startDate: acc.startDate || '',
      nftPurchaseTotal: nftTotal,
      operatingTotal: opTotal,
      totalInvestment: Math.round((nftTotal + opTotal) * 100) / 100,
      nftPurchaseRecords: Array.isArray(acc.nftPurchaseRecords) ? acc.nftPurchaseRecords.slice() : [],
      operatingRecords: Array.isArray(acc.operatingRecords) ? acc.operatingRecords.slice() : []
    };
  });
}

function getTodayBitsyncRevenueEntry() {
  ensureRevenueLog();
  return settings.revenueLog[todayKey()] || null;
}

function getBitsyncAccountEntry(entry, accountId) {
  if (!entry || !entry.bitsyncAccounts || !entry.bitsyncAccounts[accountId]) return null;
  let ae = entry.bitsyncAccounts[accountId];
  if (typeof pdIsBitsyncAccountEntryPresent === 'function') {
    return pdIsBitsyncAccountEntryPresent(ae) ? ae : null;
  }
  return ae;
}

function isBitsyncAccountEntered(entry, accountId) {
  return getBitsyncAccountEntry(entry, accountId) !== null;
}

function isBitsyncFullyEntered(entry) {
  let accounts = getBitsyncInputAccounts();
  if (!accounts.length) return false;
  return accounts.every(function (a) { return isBitsyncAccountEntered(entry, a.id); });
}

function hasBitsyncDataSavedForToday(entry) {
  if (!entry || !entry.bitsyncAccounts) return false;
  return getBitsyncInputAccounts().some(function (a) { return isBitsyncAccountEntered(entry, a.id); });
}

function bitsyncFormatMoney(n) {
  if (typeof money === 'function') return money(n);
  return String(Number(n) || 0);
}

function bitsyncFormatUsdDisplay(n) {
  if (typeof pfDisplayUsd === 'function') return pfDisplayUsd(n, Number(n) > 0);
  return bitsyncFormatMoney(n);
}

function renderBitsyncInputStatusBadge(done) {
  if (typeof renderInputStatusBadge === 'function') return renderInputStatusBadge(done);
  return done
    ? '<span class="ramInputStatus ramInputStatus--done">本日入力済み</span>'
    : '<span class="ramInputStatus ramInputStatus--pending">未入力</span>';
}

function renderBitsyncInputProgress(existing) {
  let total = getBitsyncInputAccounts().length;
  let done = getBitsyncInputAccounts().filter(function (a) {
    return isBitsyncAccountEntered(existing, a.id);
  }).length;
  let label = done + ' / ' + total;
  if (total > 0 && done === total) label += ' 完了';
  return '<div class="ramInputProgress">' +
    '<span class="ramInputProgressLabel">入力状況</span>' +
    '<span class="ramInputProgressVal' + (total > 0 && done === total ? ' isComplete' : '') + '">' + label + '</span>' +
    '</div>';
}

function renderBitsyncInvestmentBlock(acc) {
  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };
  return '<div class="bitsyncInvestmentBlock">' +
    '<div class="bitsyncSectionTitle">追加投資</div>' +
    '<p class="help bitsyncInvestmentHint">NFT購入・運用額は収益とは別管理です。追加投入分を入力して「追加投資を保存」してください。</p>' +
    '<div class="bitsyncInvestmentSummary">' +
    '<div class="bitsyncInvestmentSummaryRow"><span>現NFT購入累計</span><b>' + bitsyncFormatUsdDisplay(acc.nftPurchaseTotal) + '</b></div>' +
    '<div class="bitsyncInvestmentSummaryRow"><span>現運用額累計</span><b>' + bitsyncFormatUsdDisplay(acc.operatingTotal) + '</b></div>' +
    '</div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel">NFT購入（追加）</span>' +
    '<div class="ramInputField"><input type="number" step="0.01" min="0" id="bitsyncAddNft_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0"></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel">運用額追加</span>' +
    '<div class="ramInputField"><input type="number" step="0.01" min="0" id="bitsyncAddOp_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0"></div></div>' +
    '</div>';
}

function renderBitsyncInputAccountCard(acc, existing) {
  let ae = existing ? getBitsyncAccountEntry(existing, acc.id) : null;
  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };
  let nftVal = ae && ae.nftSaleReward != null ? ae.nftSaleReward : '';
  let opVal = ae && ae.operationReward != null ? ae.operationReward : '';
  let bonusVal = ae && ae.profitBonus != null ? ae.profitBonus : '';

  return '<section class="ramInputAccount bitsyncInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' +
    renderBitsyncInputStatusBadge(isBitsyncAccountEntered(existing, acc.id)) +
    '<span class="ramInputAccountName">' + esc(acc.username || acc.name) + '</span></div>' +
    '<div class="bitsyncSectionTitle">実績入力</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">NFT販売報酬</span>' +
    '<div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="bitsyncNft_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + esc(nftVal) + '"></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">運用報酬</span>' +
    '<div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="bitsyncOp_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + esc(opVal) + '"></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">運用益ボーナス</span>' +
    '<div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="bitsyncBonus_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + esc(bonusVal) + '"></div></div>' +
    renderBitsyncInvestmentBlock(acc) +
    (typeof aimRenderInputAccountActions === 'function'
      ? aimRenderInputAccountActions('bitsync', acc.id, acc.username, 'openBitsyncRevenueInput')
      : '') +
    '</div></section>';
}

function bitsyncReadAccountValues(accountId) {
  let nftEl = document.getElementById('bitsyncNft_' + accountId);
  let opEl = document.getElementById('bitsyncOp_' + accountId);
  let bonusEl = document.getElementById('bitsyncBonus_' + accountId);
  return {
    nftSaleReward: nftEl ? nftEl.value : '',
    operationReward: opEl ? opEl.value : '',
    profitBonus: bonusEl ? bonusEl.value : ''
  };
}

function bitsyncReadInvestmentValues(accountId) {
  let nftEl = document.getElementById('bitsyncAddNft_' + accountId);
  let opEl = document.getElementById('bitsyncAddOp_' + accountId);
  return {
    addNft: nftEl ? nftEl.value : '',
    addOperating: opEl ? opEl.value : ''
  };
}

function collectBitsyncRevenueFromForm() {
  let out = {};
  getBitsyncInputAccounts().forEach(function (acc) {
    let vals = bitsyncReadAccountValues(acc.id);
    let hasAny = [vals.nftSaleReward, vals.operationReward, vals.profitBonus].some(function (v) {
      return v != null && String(v).trim() !== '';
    });
    if (!hasAny) return;
    out[acc.id] = {
      accountName: acc.username || acc.name,
      nftSaleReward: vals.nftSaleReward,
      operationReward: vals.operationReward,
      profitBonus: vals.profitBonus
    };
  });
  return { bitsyncAccounts: out };
}

function collectBitsyncInvestmentFromForm() {
  let out = {};
  getBitsyncInputAccounts().forEach(function (acc) {
    let vals = bitsyncReadInvestmentValues(acc.id);
    let addNft = Number(vals.addNft) || 0;
    let addOp = Number(vals.addOperating) || 0;
    if (addNft <= 0 && addOp <= 0) return;
    out[acc.id] = { addNft: addNft, addOperating: addOp };
  });
  return { investments: out };
}

function bitsyncRefreshAfterSave() {
  if (typeof markActivity === 'function') markActivity();
  if (typeof pdNotifyPerformanceChanged === 'function') {
    pdNotifyPerformanceChanged({ type: 'save', projectKey: 'bitsync' });
  } else if (typeof refreshHomeAfterRevenueSave === 'function') {
    refreshHomeAfterRevenueSave();
  } else if (typeof renderPortfolio === 'function') {
    renderPortfolio();
  }
  if (typeof render === 'function') render();
}

function bitsyncBuildSaveToast(savedRevenue, savedInvestment) {
  if (savedRevenue && savedInvestment) return '✅ BITSYNC収益と追加投資を保存しました';
  if (savedInvestment) return '✅ BITSYNC追加投資を保存しました';
  return '✅ BITSYNC収益を保存しました';
}

function persistBitsyncRevenueEntry(bitsyncAccounts) {
  let dateKey = typeof todayKey === 'function' ? todayKey() : '';
  if (typeof pdSaveBitsyncPerformanceEntry !== 'function') {
    throw new Error('BITSYNC保存処理が利用できません');
  }
  Object.keys(bitsyncAccounts).forEach(function (accountId) {
    let vals = bitsyncAccounts[accountId];
    pdSaveBitsyncPerformanceEntry(
      dateKey,
      accountId,
      vals.accountName,
      vals.nftSaleReward,
      vals.operationReward,
      vals.profitBonus
    );
  });
  if (typeof pdNotifyPerformanceChanged === 'function') {
    pdNotifyPerformanceChanged({ type: 'save', projectKey: 'bitsync', dateKey: dateKey });
  }
}

function persistBitsyncInvestmentEntry(investments) {
  let dateKey = typeof todayKey === 'function' ? todayKey() : '';
  if (typeof bitsyncAddNftPurchase !== 'function' || typeof bitsyncAddOperatingPrincipal !== 'function') {
    throw new Error('BITSYNC追加投資処理が利用できません');
  }
  Object.keys(investments).forEach(function (accountId) {
    let vals = investments[accountId];
    if (vals.addNft > 0) bitsyncAddNftPurchase(accountId, dateKey, vals.addNft, 'additional');
    if (vals.addOperating > 0) bitsyncAddOperatingPrincipal(accountId, dateKey, vals.addOperating, 'additional');
  });
  return Object.keys(investments).length > 0;
}

function renderBitsyncInputFooter() {
  return '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" id="bitsyncSaveRevenueBtn">保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" id="bitsyncSaveInvestmentBtn">追加投資を保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" id="bitsyncOpenAddAccountBtn">アカウント追加</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRevenueProjectSelect()">プロジェクト選択に戻る</button>' +
    '</div>';
}

function bindBitsyncModalActionButtons() {
  let saveBtn = document.getElementById('bitsyncSaveRevenueBtn');
  if (saveBtn && saveBtn.dataset.bitsyncBound !== '1') {
    saveBtn.dataset.bitsyncBound = '1';
    saveBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      saveBitsyncRevenueInput();
    });
  }
  let invBtn = document.getElementById('bitsyncSaveInvestmentBtn');
  if (invBtn && invBtn.dataset.bitsyncBound !== '1') {
    invBtn.dataset.bitsyncBound = '1';
    invBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      saveBitsyncInvestmentInput();
    });
  }
  let addBtn = document.getElementById('bitsyncOpenAddAccountBtn');
  if (addBtn && addBtn.dataset.bitsyncBound !== '1') {
    addBtn.dataset.bitsyncBound = '1';
    addBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      openBitsyncAddAccountForm();
    });
  }
}

function openBitsyncRevenueInput(opts) {
  opts = opts || {};
  if (opts.focusAccountId) bitsyncFocusAccountId = String(opts.focusAccountId);
  let accounts = getBitsyncInputAccounts();
  modalTitle.textContent = 'BITSYNC 実績入力';

  if (!accounts.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>アカウントがありません</b>' +
      '<p class="help">「アカウント追加」からBITSYNCアカウント名・開始日・NFT購入額・運用額を登録してください。</p></div>' +
      renderBitsyncInputFooter();
    modalBg.style.display = 'flex';
    bindBitsyncModalActionButtons();
    return;
  }

  let existing = getTodayBitsyncRevenueEntry();
  modalContent.innerHTML =
    renderBitsyncInputProgress(existing) +
    '<p class="help ramInputLead">【実績入力】は日次の収益、【追加投資】はNFT購入・運用額の元本追加です。混同しないよう別ブロックで管理します。</p>' +
    '<div class="ramInputList">' + accounts.map(function (acc) {
      return renderBitsyncInputAccountCard(acc, existing);
    }).join('') + '</div>' + renderBitsyncInputFooter();
  modalBg.style.display = 'flex';
  bindBitsyncModalActionButtons();

  setTimeout(function () {
    let focusId = bitsyncFocusAccountId;
    bitsyncFocusAccountId = '';
    if (!focusId) return;
    let card = modalContent && modalContent.querySelector
      ? modalContent.querySelector('.bitsyncInputAccount[data-acc="' + focusId + '"]')
      : null;
    if (card && typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, 80);
}

function saveBitsyncRevenueInput() {
  try {
    let revenueCollected = collectBitsyncRevenueFromForm();
    let investmentCollected = collectBitsyncInvestmentFromForm();
    let hasRevenue = Object.keys(revenueCollected.bitsyncAccounts || {}).length > 0;
    let hasInvestment = Object.keys(investmentCollected.investments || {}).length > 0;
    if (!hasRevenue && !hasInvestment) {
      alert('保存する内容がありません。【実績入力】または【追加投資】のいずれかを入力してください。');
      return;
    }
    let toastMsg = bitsyncBuildSaveToast(hasRevenue, hasInvestment);
    let dateKey = typeof todayKey === 'function' ? todayKey() : '';
    if (typeof hubPersistThenCloudConfirm === 'function') {
      hubPersistThenCloudConfirm(function () {
        if (hasRevenue) persistBitsyncRevenueEntry(revenueCollected.bitsyncAccounts);
        if (hasInvestment) persistBitsyncInvestmentEntry(investmentCollected.investments);
        bitsyncRefreshAfterSave();
      }, toastMsg, function () {
        if (!hasRevenue) return true;
        let entry = typeof getRevenueEntry === 'function' ? getRevenueEntry(dateKey) : null;
        return !!(entry && entry.bitsyncAccounts && Object.keys(entry.bitsyncAccounts).length);
      }, hasRevenue
        ? (typeof hubRevenueSaveMeta === 'function' ? hubRevenueSaveMeta('bitsync', dateKey) : { projectKey: 'bitsync', dateKey: dateKey })
        : null);
    } else if (typeof hubFinishRevenueInputSave === 'function') {
      if (hasRevenue) persistBitsyncRevenueEntry(revenueCollected.bitsyncAccounts);
      if (hasInvestment) persistBitsyncInvestmentEntry(investmentCollected.investments);
      bitsyncRefreshAfterSave();
      hubFinishRevenueInputSave(toastMsg, function () {
        if (!hasRevenue) return true;
        let entry = typeof getRevenueEntry === 'function' ? getRevenueEntry(dateKey) : null;
        return !!(entry && entry.bitsyncAccounts && Object.keys(entry.bitsyncAccounts).length);
      });
    } else {
      if (hasRevenue) persistBitsyncRevenueEntry(revenueCollected.bitsyncAccounts);
      if (hasInvestment) persistBitsyncInvestmentEntry(investmentCollected.investments);
      bitsyncRefreshAfterSave();
      if (typeof persistHubSettings === 'function') persistHubSettings({ immediate: true });
      if (typeof refreshHomeAfterRevenueSave === 'function') refreshHomeAfterRevenueSave();
      if (typeof showPage === 'function') showPage('home');
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast(toastMsg);
    }
  } catch (err) {
    console.error('[bitsync]', err);
    alert('保存できませんでした。時間をおいて再度お試しください。');
  }
}

function saveBitsyncInvestmentInput() {
  try {
    let collected = collectBitsyncInvestmentFromForm();
    if (!Object.keys(collected.investments || {}).length) {
      alert('追加投資の内容がありません。NFT購入または運用額追加を入力してください。');
      return;
    }
    if (typeof hubPersistThenCloudConfirm === 'function') {
      hubPersistThenCloudConfirm(function () {
        persistBitsyncInvestmentEntry(collected.investments);
        bitsyncRefreshAfterSave();
      }, '✅ BITSYNC追加投資を保存しました', function () { return true; });
    } else if (typeof hubFinishRevenueInputSave === 'function') {
      persistBitsyncInvestmentEntry(collected.investments);
      bitsyncRefreshAfterSave();
      hubFinishRevenueInputSave('✅ BITSYNC追加投資を保存しました', function () { return true; });
    } else {
      persistBitsyncInvestmentEntry(collected.investments);
      bitsyncRefreshAfterSave();
      if (typeof persistHubSettings === 'function') persistHubSettings({ immediate: true });
      if (typeof refreshHomeAfterRevenueSave === 'function') refreshHomeAfterRevenueSave();
      if (typeof showPage === 'function') showPage('home');
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast('✅ BITSYNC追加投資を保存しました');
    }
  } catch (err) {
    console.error('[bitsync-investment]', err);
    alert('追加投資を保存できませんでした。時間をおいて再度お試しください。');
  }
}

function bitsyncShowRegisterError(message) {
  let box = document.getElementById('bitsyncRegisterError');
  if (!box) return;
  box.textContent = message || 'アカウントを登録できませんでした。';
  box.classList.remove('hidden');
}

function bitsyncClearRegisterError() {
  let box = document.getElementById('bitsyncRegisterError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('hidden');
}

function bitsyncDefaultStartDateValue() {
  if (typeof todayKey === 'function') return todayKey();
  return '';
}

function registerBitsyncAccount() {
  let now = Date.now();
  if (bitsyncRegisterInFlight) return;
  if (now < bitsyncRegisterCooldownUntil) return;
  bitsyncRegisterCooldownUntil = now + 1200;
  bitsyncClearRegisterError();

  let nameEl = document.getElementById('bitsyncNewAccountName');
  let startEl = document.getElementById('bitsyncNewStartDate');
  let nftEl = document.getElementById('bitsyncNewNftPurchase');
  let opEl = document.getElementById('bitsyncNewOperating');
  let username = ((nameEl && nameEl.value) || '').trim().replace(/^@/, '');
  let startDate = ((startEl && startEl.value) || '').trim();
  let initialNft = Number(nftEl && nftEl.value) || 0;
  let initialOp = Number(opEl && opEl.value) || 0;

  if (!username) {
    bitsyncRegisterCooldownUntil = 0;
    bitsyncShowRegisterError('アカウント名を入力してください。');
    return;
  }
  if (!startDate) {
    bitsyncRegisterCooldownUntil = 0;
    bitsyncShowRegisterError('開始日を入力してください。');
    return;
  }

  bitsyncRegisterInFlight = true;
  try {
    let dup = getBitsyncInputAccounts().some(function (a) {
      return String(a.username || a.name || '').toLowerCase() === username.toLowerCase();
    });
    if (dup) {
      bitsyncRegisterCooldownUntil = 0;
      bitsyncShowRegisterError('同じアカウント名が既に登録されています。');
      bitsyncRegisterInFlight = false;
      return;
    }
    let id = 'bitsync_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    ensureBitsyncInputAccounts();
    let acc = {
      id: id,
      username: username,
      name: username,
      startDate: startDate,
      nftPurchaseRecords: [],
      operatingRecords: []
    };
    settings.bitsyncInputAccounts.push(acc);
    if (initialNft > 0) bitsyncAddNftPurchase(id, startDate, initialNft, 'initial');
    if (initialOp > 0) bitsyncAddOperatingPrincipal(id, startDate, initialOp, 'initial');
    if (typeof persistHubSettings === 'function') persistHubSettings();
    if (typeof markActivity === 'function') markActivity();
    bitsyncFocusAccountId = id;
    openBitsyncRevenueInput({ focusAccountId: id });
    if (typeof showToast === 'function') showToast('✅ アカウントを登録しました');
  } catch (err) {
    bitsyncRegisterCooldownUntil = 0;
    console.error('[bitsyncRegister]', err);
    bitsyncShowRegisterError('アカウントを登録できませんでした。');
    bitsyncRegisterInFlight = false;
    return;
  }
  bitsyncRegisterInFlight = false;
}

function openBitsyncAddAccountForm() {
  bitsyncRegisterInFlight = false;
  bitsyncRegisterCooldownUntil = 0;
  modalTitle.textContent = 'BITSYNC アカウント追加';
  modalContent.innerHTML =
    '<p class="help">アカウント名・開始日・NFT購入額・運用額を登録します。日々の実績入力ではアカウント名の再入力は不要です。</p>' +
    '<p class="help hidden" id="bitsyncRegisterError" style="color:#fca5a5;font-weight:800;"></p>' +
    '<label for="bitsyncNewAccountName">アカウント名</label>' +
    '<input id="bitsyncNewAccountName" type="text" placeholder="例：kai1">' +
    '<label for="bitsyncNewStartDate">開始日</label>' +
    '<input id="bitsyncNewStartDate" type="text" placeholder="2026/09/27" value="' + bitsyncDefaultStartDateValue() + '">' +
    '<label for="bitsyncNewNftPurchase">NFT購入額（初回）</label>' +
    '<input id="bitsyncNewNftPurchase" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0">' +
    '<label for="bitsyncNewOperating">運用額（初回）</label>' +
    '<input id="bitsyncNewOperating" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0">' +
    '<div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">' +
    '<button type="button" class="btn2" id="bitsyncAddBackBtn">入力画面に戻る</button>' +
    '<button type="button" class="ramInputBtnSave" id="bitsyncRegisterAccountBtn">このアカウントを登録</button></div>';
  modalBg.style.display = 'flex';
  let backBtn = document.getElementById('bitsyncAddBackBtn');
  if (backBtn) backBtn.onclick = function () { openBitsyncRevenueInput(); };
  let regBtn = document.getElementById('bitsyncRegisterAccountBtn');
  if (regBtn) regBtn.onclick = registerBitsyncAccount;
  setTimeout(function () {
    let el = document.getElementById('bitsyncNewAccountName');
    if (el && typeof el.focus === 'function') el.focus();
  }, 80);
}

if (typeof window !== 'undefined') {
  window.getBitsyncInputAccounts = getBitsyncInputAccounts;
  window.openBitsyncRevenueInput = openBitsyncRevenueInput;
  window.openBitsyncAddAccountForm = openBitsyncAddAccountForm;
  window.registerBitsyncAccount = registerBitsyncAccount;
  window.saveBitsyncRevenueInput = saveBitsyncRevenueInput;
  window.saveBitsyncInvestmentInput = saveBitsyncInvestmentInput;
  window.isBitsyncAccountEntered = isBitsyncAccountEntered;
  window.isBitsyncFullyEntered = isBitsyncFullyEntered;
  window.hasBitsyncDataSavedForToday = hasBitsyncDataSavedForToday;
  window.bitsyncMigrateInputAccountsFromRevenueLog = bitsyncMigrateInputAccountsFromRevenueLog;
}
