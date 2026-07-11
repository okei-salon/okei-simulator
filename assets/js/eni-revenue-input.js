/* OUKEI HUB ENI Revenue Input — Ver2.0.2 */

let eniSavePending = null;

function ensureEniInputAccounts() {
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

function normalizeEniAccountsMap(eniAccounts) {
  if (!eniAccounts || typeof eniAccounts !== 'object') return {};
  let out = {};
  Object.keys(eniAccounts).forEach(function (id) {
    let a = eniAccounts[id];
    if (!a) return;
    out[id] = {
      operationAmount: a.operationAmount != null && a.operationAmount !== '' ? Number(a.operationAmount) : null,
      todayRevenue: a.todayRevenue != null && a.todayRevenue !== '' ? Number(a.todayRevenue) : null,
      referralProfit: a.referralProfit != null && a.referralProfit !== '' ? Number(a.referralProfit) : null,
      titleProfit: a.titleProfit != null && a.titleProfit !== '' ? Number(a.titleProfit) : null,
      note: typeof a.note === 'string' ? a.note : ''
    };
  });
  return out;
}

function getEniAccountEntry(entry, accountId) {
  if (!entry || !entry.eniAccounts) return null;
  let acc = entry.eniAccounts[accountId];
  if (!acc) return null;
  let has = ['operationAmount', 'todayRevenue', 'referralProfit', 'titleProfit'].some(function (k) {
    return acc[k] != null && acc[k] !== '';
  }) || (acc.note && String(acc.note).trim());
  return has ? acc : null;
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
  return (Number(ae.todayRevenue) || 0) + (Number(ae.referralProfit) || 0) + (Number(ae.titleProfit) || 0);
}

function renderEniInputStatusBadge(done) {
  if (typeof renderInputStatusBadge === 'function') return renderInputStatusBadge(done);
  return done ? '<span class="ramInputStatus isDone">入力済</span>' : '<span class="ramInputStatus">未入力</span>';
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
  let ae = existing ? getEniAccountEntry(existing, acc.id) : null;
  let op = ae && ae.operationAmount != null ? ae.operationAmount : '';
  let rev = ae && ae.todayRevenue != null ? ae.todayRevenue : '';
  let ref = ae && ae.referralProfit != null ? ae.referralProfit : '';
  let title = ae && ae.titleProfit != null ? ae.titleProfit : '';
  let note = ae && ae.note ? ae.note : '';
  let total = ae ? eniAccountRevenueTotal(ae) : 0;
  let esc = typeof escapeHtml === 'function' ? escapeHtml : function (t) { return String(t || ''); };
  let moneyFn = typeof money === 'function' ? money : function (n) { return '$' + Math.round(n || 0); };
  return '<section class="ramInputAccount revenueProjectCard revenueProjectCard--eni" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' + renderEniInputStatusBadge(isEniAccountEntered(existing, acc.id)) + '</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">ユーザー名</span><span class="ramInputVal">' + esc(acc.username) + '</span></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">運用額</span><div class="ramInputField"><input type="number" step="0.01" min="0" id="eniOp_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + op + '"><span class="ramInputUnit">ドル</span></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">本日収益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="eniRev_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + rev + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge ramInputBadge--eni">毎日入力</span></div></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">紹介利益</span><div class="ramInputField"><input type="number" step="0.01" min="0" id="eniRef_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + ref + '"><span class="ramInputUnit">ドル</span></div></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">タイトル利益</span><div class="ramInputField"><input type="number" step="0.01" min="0" id="eniTitle_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + title + '"><span class="ramInputUnit">ドル</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日のENI合計</span><span class="ramInputVal ramInputVal--gold" id="eniTotal_' + acc.id + '">' + moneyFn(total) + '</span></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">メモ</span><div class="ramInputField"><input type="text" id="eniNote_' + acc.id + '" class="ramInputOptional" placeholder="任意" value="' + esc(note) + '"></div></div>' +
    '</div></section>';
}

function renderEniInputFooter() {
  return '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="saveEniRevenueInput()">保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openEniAddAccountForm()">アカウント追加</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRevenueProjectSelect()">プロジェクト選択に戻る</button>' +
    '</div>';
}

function bindEniInputListeners() {
  getEniInputAccounts().forEach(function (acc) {
    ['eniRev_', 'eniRef_', 'eniTitle_'].forEach(function (prefix) {
      let el = document.getElementById(prefix + acc.id);
      if (!el || el.dataset.eniBound === '1') return;
      el.dataset.eniBound = '1';
      el.addEventListener('input', function () { updateEniAccountTotalPreview(acc.id); });
    });
  });
}

function updateEniAccountTotalPreview(accountId) {
  let revEl = document.getElementById('eniRev_' + accountId);
  let refEl = document.getElementById('eniRef_' + accountId);
  let titleEl = document.getElementById('eniTitle_' + accountId);
  let totalEl = document.getElementById('eniTotal_' + accountId);
  if (!totalEl) return;
  let rev = revEl && revEl.value !== '' && !isNaN(Number(revEl.value)) ? Number(revEl.value) : 0;
  let ref = refEl && refEl.value !== '' && !isNaN(Number(refEl.value)) ? Number(refEl.value) : 0;
  let title = titleEl && titleEl.value !== '' && !isNaN(Number(titleEl.value)) ? Number(titleEl.value) : 0;
  let hasAny = (revEl && revEl.value !== '') || (refEl && refEl.value !== '') || (titleEl && titleEl.value !== '');
  let moneyFn = typeof money === 'function' ? money : function (n) { return '$' + Math.round(n || 0); };
  totalEl.textContent = moneyFn(hasAny ? rev + ref + title : 0);
}

function collectEniRevenueFromForm() {
  let accounts = getEniInputAccounts();
  let eniAccounts = {};
  let total = 0;
  accounts.forEach(function (acc) {
    let opEl = document.getElementById('eniOp_' + acc.id);
    let revEl = document.getElementById('eniRev_' + acc.id);
    let refEl = document.getElementById('eniRef_' + acc.id);
    let titleEl = document.getElementById('eniTitle_' + acc.id);
    let noteEl = document.getElementById('eniNote_' + acc.id);
    let entry = {
      operationAmount: opEl && opEl.value !== '' ? Number(opEl.value) : null,
      todayRevenue: revEl && revEl.value !== '' ? Number(revEl.value) : null,
      referralProfit: refEl && refEl.value !== '' ? Number(refEl.value) : null,
      titleProfit: titleEl && titleEl.value !== '' ? Number(titleEl.value) : null,
      note: noteEl ? noteEl.value.trim() : ''
    };
    let has = ['operationAmount', 'todayRevenue', 'referralProfit', 'titleProfit'].some(function (k) {
      return entry[k] != null && entry[k] !== '';
    }) || entry.note;
    if (has) {
      eniAccounts[acc.id] = entry;
      total += eniAccountRevenueTotal(entry);
    }
  });
  return { eniAccounts: eniAccounts, totalEni: total };
}

function persistEniRevenueEntry(eniAccounts, totalEni) {
  let dateKey = todayKey();
  if (typeof pdSaveRevenueAccountEntry === 'function') {
    Object.keys(eniAccounts || {}).forEach(function (accountId) {
      pdSaveRevenueAccountEntry(dateKey, 'eni', accountId, eniAccounts[accountId]);
    });
    return;
  }
  ensureRevenueLog();
  let entry = settings.revenueLog[dateKey] || {};
  entry.eniAccounts = normalizeEniAccountsMap(eniAccounts);
  entry.eni = totalEni;
  settings.revenueLog[dateKey] = entry;
  if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
}

function openEniRevenueInput() {
  eniSavePending = null;
  let accounts = getEniInputAccounts();
  modalTitle.textContent = 'ENI 実績入力';

  if (!accounts.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>アカウントがありません</b>' +
      '<p class="help">「アカウント追加」からENIアカウントを登録してください。</p></div>' +
      renderEniInputFooter();
    modalBg.style.display = 'flex';
    return;
  }

  let existing = getTodayEniRevenueEntry();
  modalContent.innerHTML =
    renderEniInputProgress(existing) +
    '<p class="help ramInputLead">運用額・本日収益・紹介利益・タイトル利益を入力してください。合計は自動で「本日のENI合計」として反映されます。</p>' +
    '<div class="ramInputList">' + accounts.map(function (acc) {
      return renderEniInputAccountCard(acc, existing);
    }).join('') + '</div>' + renderEniInputFooter();
  modalBg.style.display = 'flex';
  bindEniInputListeners();
  accounts.forEach(function (acc) { updateEniAccountTotalPreview(acc.id); });

  setTimeout(function () {
    let focusEl = accounts.map(function (acc) {
      return document.getElementById('eniRev_' + acc.id);
    }).find(function (el) { return el && el.value === ''; });
    if (focusEl) focusEl.focus();
  }, 80);
}

function saveEniRevenueInput() {
  let collected = collectEniRevenueFromForm();
  if (!Object.keys(collected.eniAccounts).length) {
    alert('保存する内容がありません。収益項目を入力してください。');
    return;
  }
  persistEniRevenueEntry(collected.eniAccounts, collected.totalEni);
  if (typeof persistHubSettings === 'function') persistHubSettings();
  if (typeof render === 'function') render();
  if (typeof refreshHomeAfterRevenueSave === 'function') refreshHomeAfterRevenueSave();
  if (typeof showPage === 'function') showPage('home');
  if (typeof closeModal === 'function') closeModal();
  if (typeof showToast === 'function') showToast('✅ 保存しました');
}

function openEniAddAccountForm() {
  modalTitle.textContent = 'ENI アカウント追加';
  modalContent.innerHTML =
    '<p class="help">ユーザー名・運用額・本日収益を入力して登録します。組織図がなくても登録できます。</p>' +
    '<label>ユーザー名</label><input id="eniNewUsername" type="text" placeholder="例：account1">' +
    '<label>運用額（USD）</label><input id="eniNewInvestment" type="number" step="1" min="0" placeholder="例：5000">' +
    '<label>本日収益（USD）</label><input id="eniNewTodayRevenue" type="number" step="0.01" min="0" placeholder="例：12">' +
    '<label>紹介利益（USD）</label><input id="eniNewReferral" type="number" step="0.01" min="0" placeholder="例：3">' +
    '<label>タイトル利益（USD）</label><input id="eniNewTitle" type="number" step="0.01" min="0" placeholder="例：1">' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="registerEniAccount()">このアカウントを登録</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openEniRevenueInput()">入力画面に戻る</button>' +
    '</div>';
  modalBg.style.display = 'flex';
  setTimeout(function () {
    let el = document.getElementById('eniNewUsername');
    if (el) el.focus();
  }, 80);
}

function registerEniAccount() {
  let username = (document.getElementById('eniNewUsername')?.value || '').trim().replace(/^@/, '');
  let investment = Number(document.getElementById('eniNewInvestment')?.value) || 0;
  let revRaw = document.getElementById('eniNewTodayRevenue')?.value;
  let refRaw = document.getElementById('eniNewReferral')?.value;
  let titleRaw = document.getElementById('eniNewTitle')?.value;
  if (!username) {
    alert('ユーザー名を入力してください。');
    return;
  }
  if (!investment) {
    alert('運用額を入力してください。');
    return;
  }
  if (revRaw === '' || isNaN(Number(revRaw))) {
    alert('本日収益を入力してください。');
    return;
  }
  if (!confirm('このアカウントを登録しますか？')) return;

  let id = 'eni_' + Date.now();
  ensureEniInputAccounts();
  settings.eniInputAccounts.push({
    id: id,
    username: username,
    name: username,
    investment: investment
  });

  let entry = {
    operationAmount: investment,
    todayRevenue: Number(revRaw) || 0,
    referralProfit: refRaw !== '' && !isNaN(Number(refRaw)) ? Number(refRaw) : null,
    titleProfit: titleRaw !== '' && !isNaN(Number(titleRaw)) ? Number(titleRaw) : null,
    note: ''
  };

  if (typeof pdSaveRevenueAccountEntry === 'function') {
    pdSaveRevenueAccountEntry(todayKey(), 'eni', id, entry);
  } else {
    persistEniRevenueEntry((function () { let m = {}; m[id] = entry; return m; })(), eniAccountRevenueTotal(entry));
  }

  if (typeof persistHubSettings === 'function') persistHubSettings();
  if (typeof markActivity === 'function') markActivity();
  if (typeof render === 'function') render();
  openEniRevenueInput();
  if (typeof showToast === 'function') showToast('✅ アカウントを登録しました');
}

if (typeof window !== 'undefined') {
  window.getEniInputAccounts = getEniInputAccounts;
  window.openEniRevenueInput = openEniRevenueInput;
  window.openEniAddAccountForm = openEniAddAccountForm;
  window.registerEniAccount = registerEniAccount;
  window.saveEniRevenueInput = saveEniRevenueInput;
  window.isEniAccountEntered = isEniAccountEntered;
  window.isEniFullyEntered = isEniFullyEntered;
  window.hasEniDataSavedForToday = hasEniDataSavedForToday;
}
