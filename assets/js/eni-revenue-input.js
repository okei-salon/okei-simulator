/* OUKEI HUB ENI Revenue Input — USDT balance + totalPerformance model */

let eniSavePending = null;
let eniRegisterInFlight = false;
let eniRegisterCooldownUntil = 0;
let eniFocusAccountId = '';

function ensureEniInputAccounts() {
  if (typeof settings === 'undefined' || !settings || typeof settings !== 'object') {
    throw new Error('settings が初期化されていません');
  }
  if (!Array.isArray(settings.eniInputAccounts)) settings.eniInputAccounts = [];
}

function getEniInputAccounts() {
  ensureEniInputAccounts();
  return settings.eniInputAccounts.map(function (acc) {
    return {
      id: acc.id,
      username: String(acc.username || acc.name || '未入力').replace(/^@/, ''),
      name: acc.name || acc.username || '未入力',
      investment: Number(acc.investment) || 0
    };
  });
}

function getTodayEniRevenueEntry() {
  ensureRevenueLog();
  return settings.revenueLog[todayKey()] || null;
}

function getEniEntryDateKey() {
  return typeof todayKey === 'function' ? todayKey() : '';
}

function eniFormatNum(n) {
  let x = Number(n);
  if (!isFinite(x)) x = 0;
  if (typeof pdRoundEni === 'function') x = pdRoundEni(x);
  return String(x);
}

function eniFormatUsdt(n) {
  return eniFormatNum(n) + ' USDT';
}

function normalizeEniAccountsMap(eniAccounts) {
  if (!eniAccounts || typeof eniAccounts !== 'object') return {};
  let out = {};
  Object.keys(eniAccounts).forEach(function (id) {
    let a = eniAccounts[id];
    if (!a || !pdIsEniAccountEntryPresent(a)) return;
    out[id] = a;
  });
  return out;
}

function getEniAccountEntry(entry, accountId) {
  if (!entry || !entry.eniAccounts) return null;
  let acc = entry.eniAccounts[accountId];
  if (!acc) return null;
  if (typeof pdIsEniAccountEntryPresent === 'function') {
    return pdIsEniAccountEntryPresent(acc) ? acc : null;
  }
  return acc;
}

function isEniAccountEntered(entry, accountId) {
  return getEniAccountEntry(entry, accountId) !== null;
}

function isEniFullyEntered(entry) {
  let accounts = getEniInputAccounts();
  if (!accounts.length) return false;
  return accounts.every(function (a) { return isEniAccountEntered(entry, a.id); });
}

function hasEniDataSavedForToday(entry) {
  if (!entry || !entry.eniAccounts) return false;
  return getEniInputAccounts().some(function (a) { return isEniAccountEntered(entry, a.id); });
}

function eniAccountRevenueTotal(ae) {
  if (typeof pdEniAccountRevenueTotal === 'function') return pdEniAccountRevenueTotal(ae);
  if (!ae) return 0;
  if (ae.dailyProfit != null) return Number(ae.dailyProfit) || 0;
  return (Number(ae.todayRevenue) || 0) + (Number(ae.referralProfit) || 0) + (Number(ae.titleProfit) || 0);
}

function renderEniInputStatusBadge(done) {
  if (typeof renderInputStatusBadge === 'function') return renderInputStatusBadge(done);
  return done
    ? '<span class="ramInputStatus ramInputStatus--done">本日入力済み</span>'
    : '<span class="ramInputStatus ramInputStatus--pending">未入力</span>';
}

function renderEniInputProgress(existing) {
  let total = getEniInputAccounts().length;
  let done = getEniInputAccounts().filter(function (a) {
    return isEniAccountEntered(existing, a.id);
  }).length;
  let label = done + ' / ' + total;
  if (total > 0 && done === total) label += ' 完了';
  return '<div class="ramInputProgress">' +
    '<span class="ramInputProgressLabel">入力状況</span>' +
    '<span class="ramInputProgressVal' + (total > 0 && done === total ? ' isComplete' : '') + '">' + label + '</span>' +
    '</div>';
}

function renderEniInputAccountCard(acc, existing) {
  let dateKey = getEniEntryDateKey();
  let ae = existing ? getEniAccountEntry(existing, acc.id) : null;
  let prev = typeof pdGetEniPreviousAccountEntry === 'function'
    ? pdGetEniPreviousAccountEntry(acc.id, dateKey)
    : null;
  let prevUsdt = prev ? (Number(prev.entry.usdtBalance) || 0) : 0;
  let prevTotal = prev && prev.entry.totalPerformance != null
    ? (Number(prev.entry.totalPerformance) || 0)
    : 0;
  let isFirst = !prev;
  let usdtHint = isFirst
    ? '昨日のUSDT残高 0（初回）'
    : '昨日のUSDT残高 ' + eniFormatUsdt(prevUsdt);
  let totalHint = isFirst
    ? '昨日の総実績 0（初回）'
    : '昨日の総実績 ' + eniFormatNum(prevTotal);

  let operatingUsd = ae && ae.operationAmount != null
    ? ae.operationAmount
    : (typeof pdGetOperatingUsdAsOf === 'function'
      ? pdGetOperatingUsdAsOf(acc.id, 'eni', dateKey)
      : acc.investment);
  let usdtVal = ae && ae.usdtBalance != null ? ae.usdtBalance : '';
  let withdrawVal = ae && ae.withdrawalAmount != null && Number(ae.withdrawalAmount) !== 0
    ? ae.withdrawalAmount
    : (ae && ae.withdrawalAmount === 0 ? 0 : '');
  let totalPerfVal = ae && ae.totalPerformance != null ? ae.totalPerformance : '';

  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };

  // Markup mirrors RAM/ORCA cards: shared ramInput* classes only (project accent via badge token).
  return '<section class="ramInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' + renderEniInputStatusBadge(isEniAccountEntered(existing, acc.id)) + '</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow"><span class="ramInputLabel">ユーザー名</span><div class="ramInputField"><input type="text" id="eniUsername_' + acc.id + '" class="ramInputOptional" value="' + esc(acc.username) + '"></div></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">現在運用額</span><div class="ramInputField"><input type="number" step="any" min="0" id="eniOp_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + (operatingUsd != null ? operatingUsd : '') + '"><span class="ramInputUnit">USDT</span><span class="ramInputHint">誤りがあれば修正して保存</span></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">本日のUSDT残高</span><div class="ramInputField ramInputField--hero"><input type="number" step="any" min="0" id="eniUsdt_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="例：2.835" value="' + usdtVal + '"><span class="ramInputUnit">USDT</span><span class="ramInputBadge">毎日入力</span><span class="ramInputHint">' + usdtHint + '</span></div></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">本日の出金額</span><div class="ramInputField"><input type="number" step="any" min="0" id="eniWithdraw_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + withdrawVal + '"><span class="ramInputUnit">USDT</span><span class="ramInputHint">出金した日のみ。未入力は0</span></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">総実績</span><div class="ramInputField ramInputField--hero"><input type="number" step="any" min="0" id="eniTotalPerf_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + totalPerfVal + '"><span class="ramInputBadge">毎日入力</span><span class="ramInputHint">' + totalHint + '</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日の利益</span><span class="ramInputVal ramInputVal--gold" id="eniDailyProfit_' + acc.id + '">—</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日売上</span><span class="ramInputVal ramInputVal--gold" id="eniDailySales_' + acc.id + '">—</span></div>' +
    (typeof aimRenderInputAccountActions === 'function'
      ? aimRenderInputAccountActions('eni', acc.id, acc.username, 'openEniRevenueInput')
      : '') +
    '</div></section>';
}

function bindEniInputListeners() {
  getEniInputAccounts().forEach(function (acc) {
    ['eniUsdt_', 'eniWithdraw_', 'eniTotalPerf_', 'eniOp_'].forEach(function (prefix) {
      let el = document.getElementById(prefix + acc.id);
      if (!el || el.dataset.eniBound === '1') return;
      el.dataset.eniBound = '1';
      el.addEventListener('input', function () { updateEniDerivedPreview(acc.id); });
    });
  });
}

function eniReadNonNegNumber(el, allowEmpty) {
  if (!el) return allowEmpty ? null : NaN;
  let raw = String(el.value || '').trim();
  if (raw === '') return allowEmpty ? null : NaN;
  let n = Number(raw);
  if (!isFinite(n) || n < 0) return NaN;
  return n;
}

function updateEniDerivedPreview(accountId) {
  let dateKey = getEniEntryDateKey();
  let usdtEl = document.getElementById('eniUsdt_' + accountId);
  let withdrawEl = document.getElementById('eniWithdraw_' + accountId);
  let totalEl = document.getElementById('eniTotalPerf_' + accountId);
  let profitEl = document.getElementById('eniDailyProfit_' + accountId);
  let salesEl = document.getElementById('eniDailySales_' + accountId);
  if (!profitEl || !salesEl) return;

  let usdt = eniReadNonNegNumber(usdtEl, true);
  let totalPerf = eniReadNonNegNumber(totalEl, true);
  let withdraw = eniReadNonNegNumber(withdrawEl, true);
  if (withdraw == null) withdraw = 0;

  if (usdt == null || totalPerf == null || isNaN(usdt) || isNaN(totalPerf) || isNaN(withdraw)) {
    profitEl.textContent = '—';
    salesEl.textContent = '—';
    return;
  }

  let calc = typeof pdCalcEniDailyMetrics === 'function'
    ? pdCalcEniDailyMetrics(accountId, dateKey, {
      usdtBalance: usdt,
      withdrawalAmount: withdraw,
      totalPerformance: totalPerf
    })
    : { dailyProfit: 0, dailySales: 0 };

  profitEl.textContent = eniFormatUsdt(calc.dailyProfit);
  salesEl.textContent = eniFormatNum(calc.dailySales);
}

function collectEniRevenueFromForm() {
  let accounts = getEniInputAccounts();
  let eniAccounts = {};
  let errors = [];
  accounts.forEach(function (acc) {
    let opEl = document.getElementById('eniOp_' + acc.id);
    let usdtEl = document.getElementById('eniUsdt_' + acc.id);
    let withdrawEl = document.getElementById('eniWithdraw_' + acc.id);
    let totalEl = document.getElementById('eniTotalPerf_' + acc.id);

    let usdtRaw = usdtEl ? String(usdtEl.value || '').trim() : '';
    let totalRaw = totalEl ? String(totalEl.value || '').trim() : '';
    let opRaw = opEl ? String(opEl.value || '').trim() : '';
    let withdrawRaw = withdrawEl ? String(withdrawEl.value || '').trim() : '';

    let touched = usdtRaw !== '' || totalRaw !== '' || withdrawRaw !== '';
    if (!touched) return;

    let op = opRaw === '' ? null : Number(opRaw);
    let usdt = Number(usdtRaw);
    let totalPerf = Number(totalRaw);
    let withdraw = withdrawRaw === '' ? 0 : Number(withdrawRaw);

    if (usdtRaw === '' || !isFinite(usdt) || usdt < 0) {
      errors.push(acc.username + ': 本日のUSDT残高は0以上の数値で入力してください');
      return;
    }
    if (totalRaw === '' || !isFinite(totalPerf) || totalPerf < 0) {
      errors.push(acc.username + ': 総実績は0以上の数値で入力してください');
      return;
    }
    if (op != null && (!isFinite(op) || op < 0)) {
      errors.push(acc.username + ': 現在の運用額は0以上の数値で入力してください');
      return;
    }
    if (!isFinite(withdraw) || withdraw < 0) {
      errors.push(acc.username + ': 出金額は0以上の数値で入力してください');
      return;
    }

    eniAccounts[acc.id] = {
      operationAmount: op != null ? op : (Number(acc.investment) || 0),
      usdtBalance: usdt,
      withdrawalAmount: withdraw,
      totalPerformance: totalPerf
    };
  });
  return { eniAccounts: eniAccounts, errors: errors };
}

function eniBuildSaveWarnings(eniAccounts) {
  let dateKey = getEniEntryDateKey();
  let warnings = [];
  Object.keys(eniAccounts || {}).forEach(function (accountId) {
    let raw = eniAccounts[accountId];
    let calc = typeof pdCalcEniDailyMetrics === 'function'
      ? pdCalcEniDailyMetrics(accountId, dateKey, raw)
      : { isFirst: true, prevTotalPerformance: 0, prevUsdtBalance: 0 };
    if (!calc.isFirst && raw.totalPerformance < calc.prevTotalPerformance) {
      warnings.push('本日の総実績が前回の総実績を下回っています。入力内容をご確認ください。');
    }
    if (!calc.isFirst && raw.usdtBalance < calc.prevUsdtBalance) {
      warnings.push('USDT残高が前回より減少しています。出金額の入力漏れがないか確認してください。');
    }
  });
  // unique
  return warnings.filter(function (w, i, arr) { return arr.indexOf(w) === i; });
}

function persistEniRevenueEntry(eniAccounts) {
  let dateKey = getEniEntryDateKey();
  Object.keys(eniAccounts || {}).forEach(function (accountId) {
    if (typeof pdSaveEniPerformanceEntry === 'function') {
      pdSaveEniPerformanceEntry(dateKey, accountId, eniAccounts[accountId]);
    } else if (typeof pdSaveRevenueAccountEntry === 'function') {
      pdSaveRevenueAccountEntry(dateKey, 'eni', accountId, eniAccounts[accountId]);
    }
  });
}

function openEniRevenueInput(opts) {
  opts = opts || {};
  eniSavePending = null;
  if (opts.focusAccountId) eniFocusAccountId = String(opts.focusAccountId);
  eniRestoreModalFooter();
  let accounts = getEniInputAccounts();
  modalTitle.textContent = 'ENI 実績入力';

  if (!accounts.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>アカウントがありません</b>' +
      '<p class="help">「アカウント追加」からENIアカウントを登録してください。</p></div>' +
      renderEniInputFooter();
    modalBg.style.display = 'flex';
    bindEniModalActionButtons();
    return;
  }

  let existing = getTodayEniRevenueEntry();
  modalContent.innerHTML =
    renderEniInputProgress(existing) +
    '<p class="help ramInputLead">毎日「本日のUSDT残高」と「総実績」を入力してください。出金した日のみ出金額を入力します。本日の利益・本日売上は自動計算されます。</p>' +
    '<div class="ramInputList">' + accounts.map(function (acc) {
      return renderEniInputAccountCard(acc, existing);
    }).join('') + '</div>' + renderEniInputFooter();
  modalBg.style.display = 'flex';
  bindEniInputListeners();
  bindEniModalActionButtons();
  accounts.forEach(function (acc) { updateEniDerivedPreview(acc.id); });

  setTimeout(function () {
    let focusId = eniFocusAccountId;
    eniFocusAccountId = '';
    let focusEl = null;
    if (focusId) {
      let card = (modalContent && typeof modalContent.querySelector === 'function')
        ? modalContent.querySelector('.ramInputAccount[data-acc="' + focusId + '"]')
        : null;
      if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      focusEl = document.getElementById('eniUsdt_' + focusId);
      if (card && card.classList && typeof card.classList.add === 'function') {
        card.classList.add('isSelected');
      }
    }
    if (!focusEl) {
      focusEl = accounts.map(function (acc) {
        return document.getElementById('eniUsdt_' + acc.id);
      }).find(function (el) { return el && el.value === ''; });
    }
    if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
  }, 80);
}

function saveEniRevenueInput() {
  try {
    let collected = collectEniRevenueFromForm();
    if (collected.errors && collected.errors.length) {
      alert(collected.errors[0]);
      return;
    }
    if (!Object.keys(collected.eniAccounts).length) {
      alert('保存する内容がありません。USDT残高と総実績を入力してください。');
      return;
    }

    let warnings = eniBuildSaveWarnings(collected.eniAccounts);
    if (warnings.length) {
      let msg = warnings.join('\n\n') + '\n\n内容を確認のうえ保存しますか？';
      if (!confirm(msg)) return;
    }

    if (typeof aimPersistInputAccountMetaFromForm === 'function') {
      aimPersistInputAccountMetaFromForm('eni');
    }
    persistEniRevenueEntry(collected.eniAccounts);
    if (typeof persistHubSettings === 'function') persistHubSettings();
    if (typeof render === 'function') render();
    if (typeof refreshHomeAfterRevenueSave === 'function') refreshHomeAfterRevenueSave();
    if (typeof showPage === 'function') showPage('home');
    if (typeof closeModal === 'function') closeModal();
    if (typeof showToast === 'function') showToast('✅ 保存しました');
  } catch (err) {
    console.error('[eni]', err);
    alert('保存できませんでした。時間をおいて再度お試しください。');
  }
}

function bindEniModalActionButtons() {
  // Revenue input screen buttons (still in modalBody)
  let saveBtn = document.getElementById('eniSaveRevenueBtn');
  if (saveBtn && saveBtn.dataset.eniBound !== '1') {
    saveBtn.dataset.eniBound = '1';
    saveBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      saveEniRevenueInput();
    });
  }
  let addBtn = document.getElementById('eniOpenAddAccountBtn');
  if (addBtn && addBtn.dataset.eniBound !== '1') {
    addBtn.dataset.eniBound = '1';
    addBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      openEniAddAccountForm();
    });
  }
}

function eniGetModalFooter() {
  return document.querySelector('#modalBg .modalFooter');
}

function eniCaptureModalFooterDefault() {
  if (typeof pfCaptureModalFooterDefault === 'function') {
    pfCaptureModalFooterDefault();
    return;
  }
  let footer = eniGetModalFooter();
  if (footer && !window.__eniFooterDefaultHtml) {
    window.__eniFooterDefaultHtml = footer.innerHTML;
  }
}

function eniRestoreModalFooter() {
  if (typeof pfRestoreModalFooter === 'function') {
    pfRestoreModalFooter();
    return;
  }
  let footer = eniGetModalFooter();
  if (footer && window.__eniFooterDefaultHtml) {
    footer.innerHTML = window.__eniFooterDefaultHtml;
  }
  if (footer) footer.style.display = '';
}

function renderEniInputFooter() {
  return '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" id="eniSaveRevenueBtn">保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" id="eniOpenAddAccountBtn">アカウント追加</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRevenueProjectSelect()">プロジェクト選択に戻る</button>' +
    '</div>';
}

function eniShowRegisterError(message) {
  let box = document.getElementById('eniRegisterError');
  if (!box) return;
  box.textContent = message || 'アカウントを登録できませんでした。時間をおいて再度お試しください。';
  box.classList.remove('hidden');
  box.style.display = 'block';
}

function eniClearRegisterError() {
  let box = document.getElementById('eniRegisterError');
  if (!box) return;
  box.textContent = '';
  box.classList.add('hidden');
  box.style.display = '';
}

function registerEniAccount() {
  // Absorb duplicate pointerup/touchend/click delivery (Safari often skips click).
  let now = Date.now();
  if (eniRegisterInFlight) return;
  if (now < eniRegisterCooldownUntil) return;
  eniRegisterCooldownUntil = now + 1200;

  eniClearRegisterError();

  let usernameEl = document.getElementById('eniNewUsername');
  let investmentEl = document.getElementById('eniNewInvestment');
  let username = ((usernameEl && usernameEl.value) || '').trim().replace(/^@/, '');
  let investmentRaw = investmentEl ? String(investmentEl.value || '').trim() : '';
  let investment = Number(investmentRaw);

  if (!username) {
    eniRegisterCooldownUntil = 0;
    eniShowRegisterError('ユーザー名を入力してください。');
    return;
  }
  if (investmentRaw === '' || !isFinite(investment) || investment < 0) {
    eniRegisterCooldownUntil = 0;
    eniShowRegisterError('現在の運用額は0以上の数値で入力してください。');
    return;
  }

  // Register button is the explicit action; avoid native confirm() (Safari can return false).
  eniRegisterInFlight = true;

  try {
    let id = 'eni_' + Date.now();
    ensureEniInputAccounts();
    settings.eniInputAccounts.push({
      id: id,
      username: username,
      name: username,
      investment: investment
    });

    let dateKey = typeof todayKey === 'function' ? todayKey() : '';
    if (typeof pdAddInvestmentRecord === 'function' && dateKey) {
      pdAddInvestmentRecord(id, 'eni', dateKey, investment, 'initial');
    } else if (typeof pdSetManualOperatingAmount === 'function' && dateKey) {
      pdSetManualOperatingAmount(id, 'eni', dateKey, investment);
    }

    if (typeof persistHubSettings === 'function') {
      persistHubSettings();
    } else if (typeof hubSaveToStorage === 'function') {
      hubSaveToStorage();
    }

    if (typeof markActivity === 'function') markActivity();
    if (typeof render === 'function') render();

    eniFocusAccountId = id;
    eniRestoreModalFooter();
    openEniRevenueInput({ focusAccountId: id });
    if (typeof showToast === 'function') showToast('✅ アカウントを登録しました');
  } catch (err) {
    eniRegisterInFlight = false;
    eniRegisterCooldownUntil = 0;
    console.error('[eniRegister]', err);
    eniShowRegisterError('アカウントを登録できませんでした。時間をおいて再度お試しください。');
    return;
  }

  eniRegisterInFlight = false;
}

// Expose immediately (same global pattern as RAM/ORCA function declarations in home.js).
window.registerEniAccount = registerEniAccount;

function eniBindAddAccountFooterEvents() {
  let registerBtn = document.getElementById('eniRegisterAccountBtn');
  let backBtn = document.getElementById('eniAddBackBtn');

  function onRegisterEvent(ev) {
    if (ev && ev.type === 'pointerup' && ev.pointerType === 'mouse' && ev.button != null && ev.button !== 0) {
      return;
    }
    if (ev && (ev.type === 'touchend' || ev.type === 'pointerup')) {
      if (typeof ev.preventDefault === 'function') {
        try { ev.preventDefault(); } catch (err) { /* ignore */ }
      }
    }
    registerEniAccount();
  }

  if (registerBtn && registerBtn.dataset.eniBound !== '1') {
    registerBtn.dataset.eniBound = '1';
    // Prefer pointerup/touchend; Safari may skip click on this control.
    registerBtn.addEventListener('pointerup', onRegisterEvent, { passive: false });
    registerBtn.addEventListener('touchend', onRegisterEvent, { passive: false });
    registerBtn.addEventListener('click', onRegisterEvent);
  }

  if (backBtn && backBtn.dataset.eniBound !== '1') {
    backBtn.dataset.eniBound = '1';
    backBtn.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      eniRestoreModalFooter();
      openEniRevenueInput();
    });
  }
}

function openEniAddAccountForm() {
  // Layout: Ver2.0.12-style modalFooter row (戻る | 登録 | 閉じる). Body = fields only.
  eniRegisterInFlight = false;
  eniRegisterCooldownUntil = 0;
  eniCaptureModalFooterDefault();
  modalTitle.textContent = 'ENI アカウント追加';
  modalContent.innerHTML =
    '<p class="help">ユーザー名と現在の運用額を登録します。日次のUSDT残高・総実績は実績入力画面で入力します。</p>' +
    '<p class="help hidden" id="eniRegisterError" style="color:#fca5a5;font-weight:800;"></p>' +
    '<label>ユーザー名</label>' +
    '<input id="eniNewUsername" type="text" placeholder="例：account1">' +
    '<label>現在の運用額（USDT）</label>' +
    '<input id="eniNewInvestment" type="number" step="any" min="0" inputmode="decimal" placeholder="例：5000">';

  let footer = eniGetModalFooter();
  if (footer) {
    footer.style.display = 'flex';
    footer.innerHTML =
      '<button type="button" class="btn2" id="eniAddBackBtn">入力画面に戻る</button>' +
      '<button type="button" class="ramInputBtnSave" id="eniRegisterAccountBtn"' +
      ' onclick="window.registerEniAccount && window.registerEniAccount()">このアカウントを登録</button>' +
      '<button type="button" class="btn2" onclick="closeModal()">閉じる</button>';
  }

  modalBg.style.display = 'flex';
  eniBindAddAccountFooterEvents();
  setTimeout(function () {
    let el = document.getElementById('eniNewUsername');
    if (el && typeof el.focus === 'function') el.focus();
  }, 80);
}

window.openEniAddAccountForm = openEniAddAccountForm;

if (typeof window !== 'undefined') {
  window.getEniInputAccounts = getEniInputAccounts;
  window.openEniRevenueInput = openEniRevenueInput;
  window.openEniAddAccountForm = openEniAddAccountForm;
  window.registerEniAccount = registerEniAccount;
  window.saveEniRevenueInput = saveEniRevenueInput;
  window.isEniAccountEntered = isEniAccountEntered;
  window.isEniFullyEntered = isEniFullyEntered;
  window.hasEniDataSavedForToday = hasEniDataSavedForToday;
  window.getEniAccountEntry = getEniAccountEntry;
  window.updateEniDerivedPreview = updateEniDerivedPreview;
  window.normalizeEniAccountsMap = normalizeEniAccountsMap;
}
