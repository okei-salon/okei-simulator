/* OUKEI HUB Home UI — Ver2.0.7 */
let homeCalView = { y: new Date().getFullYear(), m: new Date().getMonth() };
let ramSavePending = null;
let ramSalesDecreasePending = null;
let orcaSavePending = null;
let orcaSalesDecreasePending = null;

function ensureRevenueLog() {
  if (!settings.revenueLog || typeof settings.revenueLog !== 'object') settings.revenueLog = {};
}

function revenueDateKey(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function todayKey() {
  if (typeof getHomeDemoTodayKey === 'function') {
    let k = getHomeDemoTodayKey();
    if (k) return k;
  }
  let t = getHomeReferenceDate();
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function yesterdayKey() {
  if (typeof getHomeDemoYesterdayKey === 'function') {
    let k = getHomeDemoYesterdayKey();
    if (k) return k;
  }
  let t = getHomeReferenceDate();
  t.setDate(t.getDate() - 1);
  return revenueDateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatCalLabel(y, m) {
  return y + '年' + (m + 1) + '月';
}

function getEnabledHomeProjects() {
  if (typeof getHomeDemoEnabledProjects === 'function') {
    let demo = getHomeDemoEnabledProjects();
    if (demo) return demo;
  }
  if (typeof pmGetEnabledProjects === 'function') {
    return pmGetEnabledProjects();
  }
  let list = [];
  if (settings.useRAM !== false) list.push({ key: 'ram', name: 'RAM', dot: 'ram' });
  if (settings.useORCA) list.push({ key: 'orca', name: 'ORCA', dot: 'orca' });
  if (settings.useCARY) list.push({ key: 'cary', name: 'Cary Pact', dot: 'cary' });
  return list.length ? list : [{ key: 'ram', name: 'RAM', dot: 'ram' }];
}

var HOME_ACTION_ICON_PENDING = '<span class="homeActionItemIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg></span>';
var HOME_ACTION_ICON_DONE = '<span class="homeActionItemIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg></span>';

function getHomeActionProjects() {
  return getEnabledHomeProjects().map(function (p) {
    return { key: p.key, name: p.name, cls: homeProjectCls(p.key) };
  });
}

var HOME_BUILTIN_PROJECT_KEYS = { ram: 1, orca: 1, cary: 1, genesis: 1 };

function homeProjectCls(key) {
  return HOME_BUILTIN_PROJECT_KEYS[key] ? key : 'custom';
}

function homeProjectEntryFromMaster(p) {
  return { key: p.key, name: p.name, cls: homeProjectCls(p.key) };
}

function homeResponsiveGridCols(count) {
  count = Math.max(1, count || 1);
  if (typeof window === 'undefined' || !window.matchMedia) return Math.min(count, 5);
  let w = window.innerWidth || 0;
  if (w <= 480) return count <= 1 ? 1 : Math.min(count, 2);
  if (w <= 768) return Math.min(count, 3);
  if (w <= 1024) return Math.min(count, 4);
  return Math.min(count, 5);
}

function isHomeProjectEnteredToday(entry, projectKey) {
  if (!entry) return false;
  if (projectKey === 'ram') return isRamFullyEntered(entry);
  if (projectKey === 'orca') return isOrcaFullyEntered(entry);
  if (projectKey === 'cary') return isCaryFullyEntered(entry);
  return Number(entry[projectKey] || 0) > 0;
}

function getRevenueInputProjects() {
  return getEnabledHomeProjects();
}

var REVENUE_PROJECT_META = {
  ram: { desc: '銅鉱山／本日の収益', ready: true },
  orca: { desc: '昨日AI利益＋本日AF収益', ready: true },
  cary: { desc: 'ブロックチェーン／報酬入力', ready: false }
};

function getRevenueProjectMeta(projectKey) {
  return REVENUE_PROJECT_META[projectKey] || { desc: '収益入力', ready: false };
}

function countProjectEnteredAccounts(projectKey, entry) {
  if (projectKey === 'ram') {
    return getRamInputAccounts().filter(function (a) { return isRamAccountEntered(entry, a.id); }).length;
  }
  if (projectKey === 'orca') {
    return getOrcaInputAccounts().filter(function (a) { return isOrcaAccountEntered(entry, a.id); }).length;
  }
  if (projectKey === 'cary') {
    return getCaryInputAccounts().filter(function (a) { return isCaryAccountEntered(entry, a.id); }).length;
  }
  return entry && Number(entry[projectKey] || 0) > 0 ? 1 : 0;
}

function countProjectInputAccounts(projectKey) {
  if (projectKey === 'ram') return getRamInputAccounts().length;
  if (projectKey === 'orca') return getOrcaInputAccounts().length;
  if (projectKey === 'cary') return getCaryInputAccounts().length;
  return 0;
}

function getProjectInputSavedTotal(projectKey, entry) {
  if (!entry) return 0;
  let dateKey = typeof todayKey === 'function' ? todayKey() : '';
  if (projectKey === 'ram') {
    return getRamInputAccounts().reduce(function (sum, acc) {
      let ae = getRamAccountEntry(entry, acc.id);
      if (!ae) return sum;
      if (typeof pdRamAccountRevenueTotal === 'function' && dateKey) {
        return sum + pdRamAccountRevenueTotal(ae, acc.id, dateKey);
      }
      let op = typeof pdCalcDailyOperation === 'function' && dateKey
        ? pdCalcDailyOperation(acc.id, 'ram', dateKey) : 0;
      return sum + op + ae.todayRevenue;
    }, 0);
  }
  if (projectKey === 'orca') {
    return getOrcaInputAccounts().reduce(function (sum, acc) {
      let ae = getOrcaAccountEntry(entry, acc.id);
      if (!ae) return sum;
      if (typeof pdOrcaAccountRevenueTotal === 'function') {
        return sum + pdOrcaAccountRevenueTotal(ae);
      }
      return sum + (typeof calcOrcaAccountTotal === 'function' ? calcOrcaAccountTotal(ae) : 0);
    }, 0);
  }
  if (projectKey === 'cary') {
    return getCaryInputAccounts().reduce(function (sum, acc) {
      let ae = getCaryAccountEntry(entry, acc.id);
      return sum + (ae ? ae.todayReward : 0);
    }, 0);
  }
  return Number(entry[projectKey] || 0);
}

function getRevenueProjectCardStats(projectKey) {
  let entry = getRevenueEntry(todayKey());
  let accountCount = countProjectInputAccounts(projectKey);
  let enteredCount = countProjectEnteredAccounts(projectKey, entry);
  let total = getProjectInputSavedTotal(projectKey, entry);
  if (!accountCount && entry) {
    enteredCount = countProjectEnteredAccounts(projectKey, entry) || (Number(entry[projectKey] || 0) > 0 ? 1 : 0);
    total = Number(entry[projectKey] || 0);
  }
  return {
    accountCount: accountCount,
    enteredCount: enteredCount,
    total: Math.round(total * 100) / 100
  };
}

function renderInputStatusBadge(isEntered) {
  if (isEntered) {
    return '<span class="ramInputStatus ramInputStatus--done">本日入力済み</span>';
  }
  return '<span class="ramInputStatus ramInputStatus--pending">未入力</span>';
}

function getRamAllRootAccounts() {
  if (typeof getHomeDemoRamAccounts === 'function') {
    let demo = getHomeDemoRamAccounts();
    if (demo) return demo;
  }
  if (typeof getRootIdsForSummary !== 'function' || typeof members === 'undefined') return [];
  return getRootIdsForSummary().map(function (id) {
    let m = members.find(function (x) { return x.id === id; });
    if (!m) return null;
    let username = (m.username || m.name || '未入力').replace(/^@/, '');
    return {
      id: id,
      username: username,
      investment: Number(m.investment) || 0
    };
  }).filter(Boolean);
}

function getRamInputAccounts() {
  return getRamAllRootAccounts().filter(function (acc) {
    if (typeof pfIsPerformanceInputAccountHidden === 'function') {
      return !pfIsPerformanceInputAccountHidden('ram', acc.id);
    }
    return true;
  });
}

function getDailyRateDecimal(investment) {
  if (typeof rateFor !== 'function') return { pct: 0, decimal: 0, label: '' };
  let r = rateFor(investment);
  let decimal = r.m / 30;
  let pct = Math.round(decimal * 10000) / 100;
  return { pct: pct, decimal: decimal, label: r.label };
}

function formatDailyRateLabel(investment) {
  let rate = getDailyRateDecimal(investment);
  return '日利' + rate.pct + '%';
}

function calcRamOperatingProfit(investment) {
  let rate = getDailyRateDecimal(investment);
  return Math.round(investment * rate.decimal * 100) / 100;
}

function calcRamEffectiveInvestment(baseInvestment, addInvestment) {
  let add = Number(addInvestment) || 0;
  return (Number(baseInvestment) || 0) + (add > 0 ? add : 0);
}

function normalizeRamRevenueNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  let n = Number(val);
  return isNaN(n) ? null : n;
}

function normalizeRamAccountsMap(ramAccounts) {
  if (!ramAccounts || typeof ramAccounts !== 'object') return {};
  let out = {};
  Object.keys(ramAccounts).forEach(function (id) {
    let a = ramAccounts[id];
    if (!a) return;
    let todayRevenue = normalizeRamRevenueNumber(a.todayRevenue);
    if (todayRevenue === null) return;
    out[id] = {
      todayRevenue: todayRevenue,
      addInvestment: Number(a.addInvestment) || 0
    };
  });
  return out;
}

function getTodayRamRevenueEntry() {
  let entry = getRevenueEntry(todayKey());
  if (!entry) return null;
  return Object.assign({}, entry, {
    ramAccounts: normalizeRamAccountsMap(entry.ramAccounts)
  });
}

function getRamAccountEntry(entry, accountId) {
  if (!entry || !entry.ramAccounts) return null;
  let acc = entry.ramAccounts[accountId];
  if (!acc) return null;
  let todayRevenue = normalizeRamRevenueNumber(acc.todayRevenue);
  if (todayRevenue === null) return null;
  let out = {
    todayRevenue: todayRevenue,
    addInvestment: Number(acc.addInvestment) || 0
  };
  if (acc.operationRevenue != null && acc.operationRevenue !== '') {
    out.operationRevenue = Number(acc.operationRevenue) || 0;
  }
  if (acc.operationSource) out.operationSource = acc.operationSource;
  return out;
}

function isRamAccountEntered(entry, accountId) {
  return getRamAccountEntry(entry, accountId) !== null;
}

function countRamEnteredAccounts(entry) {
  return getRamInputAccounts().filter(function (a) {
    return isRamAccountEntered(entry, a.id);
  }).length;
}

function isRamFullyEntered(entry) {
  let accounts = getRamInputAccounts();
  if (!accounts.length) return false;
  return accounts.every(function (a) { return isRamAccountEntered(entry, a.id); });
}

function hasRamDataSavedForToday(entry) {
  if (!entry || !entry.ramAccounts) return false;
  return getRamInputAccounts().some(function (a) { return isRamAccountEntered(entry, a.id); });
}

function getTodayRamSalesEntry() {
  let key = todayKey();
  if (typeof pdGetSalesEntry === 'function') return pdGetSalesEntry(key);
  if (typeof getSalesEntry === 'function') return getSalesEntry(key);
  return null;
}

function getRamAccountSalesEntry(entry, accountId) {
  if (!entry || !entry.accounts) return null;
  return entry.accounts[accountId] || null;
}

function formatRamTodaySalesPreview(accountId, totalSalesRaw) {
  if (totalSalesRaw === '' || totalSalesRaw == null || isNaN(Number(totalSalesRaw))) return '—';
  let dateKey = todayKey();
  if (typeof pdCalcRamTodaySalesFromTotal === 'function') {
    let calc = pdCalcRamTodaySalesFromTotal(accountId, dateKey, Number(totalSalesRaw));
    return money(calc.todaySales);
  }
  return '—';
}

function collectRamSalesFromForm() {
  let out = {};
  getRamInputAccounts().forEach(function (acc) {
    let el = document.getElementById('ramTotalSales_' + acc.id);
    if (el && el.value !== '' && !isNaN(Number(el.value))) {
      out[acc.id] = Number(el.value);
    }
  });
  return out;
}

function ramTotalSalesDecreaseConfirmNeeded(ramSales, dateKey) {
  if (typeof pdGetRamPreviousTotalSales !== 'function') return false;
  return Object.keys(ramSales || {}).some(function (accountId) {
    let prev = pdGetRamPreviousTotalSales(accountId, dateKey);
    if (prev == null) return false;
    return Number(ramSales[accountId]) < prev;
  });
}

function hasRamSalesSavedForToday() {
  let entry = getTodayRamSalesEntry();
  if (!entry || !entry.accounts) return false;
  return getRamInputAccounts().some(function (a) {
    let ae = getRamAccountSalesEntry(entry, a.id);
    return ae && ae.totalSales != null && ae.totalSales !== '';
  });
}

function ramInputDiffersFromSaved(collected, existing) {
  let hasExistingRevenue = existing && hasRamDataSavedForToday(existing);
  let hasExistingSales = hasRamSalesSavedForToday();
  if (!hasExistingRevenue && !hasExistingSales) return false;

  let existingAccounts = hasExistingRevenue ? normalizeRamAccountsMap(existing.ramAccounts) : {};
  let existingSales = getTodayRamSalesEntry();
  let accounts = getRamInputAccounts();

  return accounts.some(function (acc) {
    if (hasExistingRevenue) {
      let next = collected.ramAccounts[acc.id];
      let prev = existingAccounts[acc.id];
      let nextRev = next && typeof next.todayRevenue === 'number' ? Number(next.todayRevenue) : NaN;
      let prevRev = prev && typeof prev.todayRevenue === 'number' ? Number(prev.todayRevenue) : NaN;
      let nextAdd = next ? Number(next.addInvestment) || 0 : 0;
      let prevAdd = typeof pdGetAdditionalInvestmentForDate === 'function'
        ? pdGetAdditionalInvestmentForDate(acc.id, 'ram', todayKey())
        : (prev ? Number(prev.addInvestment) || 0 : 0);
      if (!(isNaN(nextRev) && isNaN(prevRev))) {
        if (isNaN(nextRev) !== isNaN(prevRev)) return true;
        if (nextRev !== prevRev) return true;
        if (nextAdd !== prevAdd) return true;
      }
    }
    if (hasExistingSales || getRamAccountSalesEntry(existingSales, acc.id)) {
      let nextTotalSales = collected.ramSales && collected.ramSales[acc.id];
      let prevSales = getRamAccountSalesEntry(existingSales, acc.id);
      let prevTotalSales = prevSales && prevSales.totalSales != null ? Number(prevSales.totalSales) : null;
      if (nextTotalSales != null && prevTotalSales != null && nextTotalSales !== prevTotalSales) return true;
      if (nextTotalSales != null && prevTotalSales == null) return true;
      if (nextTotalSales == null && prevTotalSales != null) return true;
    }
    return false;
  });
}

function persistRamSalesFromTotals(ramSales, dateKey) {
  if (!ramSales || typeof pdSaveRamTotalSalesEntry !== 'function') return;
  Object.keys(ramSales).forEach(function (accountId) {
    pdSaveRamTotalSalesEntry(dateKey, accountId, ramSales[accountId]);
  });
}

function collectRamInputFromForm() {
  let accounts = getRamInputAccounts();
  let existingEntry = getTodayRamRevenueEntry() || { ramAccounts: {} };
  let ramAccounts = {};
  let totalRam = 0;
  let dateKey = todayKey();

  accounts.forEach(function (acc) {
    let revEl = document.getElementById('ramTodayRev_' + acc.id);
    let addEl = document.getElementById('ramAddInv_' + acc.id);
    let prev = getRamAccountEntry(existingEntry, acc.id);
    let prevAdd = typeof pdGetAdditionalInvestmentForDate === 'function'
      ? pdGetAdditionalInvestmentForDate(acc.id, 'ram', dateKey)
      : (prev ? prev.addInvestment : 0);
    let addInvestment = addEl && addEl.value !== '' ? Number(addEl.value) || 0 : prevAdd;
    let hasInput = revEl && revEl.value !== '' && !isNaN(Number(revEl.value));
    if (hasInput) {
      let todayRevenue = Number(revEl.value) || 0;
      ramAccounts[acc.id] = { todayRevenue: todayRevenue, addInvestment: addInvestment };
      if (typeof pdPreviewRamAccountRevenueTotal === 'function') {
        totalRam += pdPreviewRamAccountRevenueTotal(acc.id, todayRevenue, addInvestment, dateKey);
      } else if (typeof pdRamAccountRevenueTotal === 'function') {
        totalRam += pdRamAccountRevenueTotal(ramAccounts[acc.id], acc.id, dateKey);
      } else {
        totalRam += todayRevenue;
      }
    } else if (prev) {
      ramAccounts[acc.id] = {
        todayRevenue: prev.todayRevenue,
        addInvestment: addInvestment
      };
      if (typeof pdPreviewRamAccountRevenueTotal === 'function') {
        totalRam += pdPreviewRamAccountRevenueTotal(acc.id, prev.todayRevenue, addInvestment, dateKey);
      } else if (typeof pdRamAccountRevenueTotal === 'function') {
        totalRam += pdRamAccountRevenueTotal(ramAccounts[acc.id], acc.id, dateKey);
      } else {
        totalRam += prev.todayRevenue;
      }
    }
  });

  return { ramAccounts: ramAccounts, totalRam: totalRam, ramSales: collectRamSalesFromForm() };
}

function persistRamRevenueEntry(ramAccounts, totalRam) {
  let dateKey = todayKey();
  if (typeof pdSyncRamSaveInvestments === 'function') {
    pdSyncRamSaveInvestments(ramAccounts, dateKey);
  }
  let existing = getRevenueEntry(dateKey) || {};
  let normalizedAccounts = normalizeRamAccountsMap(ramAccounts);
  if (typeof pdMergeRevenueEntry === 'function') {
    pdMergeRevenueEntry(dateKey, {
      ramAccounts: normalizedAccounts,
      orcaAccounts: existing.orcaAccounts || {},
      caryAccounts: existing.caryAccounts || {},
      orca: existing.orca,
      cary: existing.cary,
      genesis: existing.genesis
    });
    return;
  }
  saveRevenueEntry(dateKey, {
    total: totalRam + (Number(existing.orca) || 0) + (Number(existing.genesis) || 0) + (Number(existing.cary) || 0),
    ram: totalRam,
    orca: Number(existing.orca) || 0,
    genesis: Number(existing.genesis) || 0,
    cary: Number(existing.cary) || 0,
    ramAccounts: normalizedAccounts,
    orcaAccounts: existing.orcaAccounts || {},
    savedAt: new Date().toLocaleString()
  });
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bindRamInputListeners() {
  getRamInputAccounts().forEach(function (acc) {
    let addEl = document.getElementById('ramAddInv_' + acc.id);
    let salesEl = document.getElementById('ramTotalSales_' + acc.id);
    if (addEl) {
      addEl.addEventListener('input', function () {
        updateRamInputDerived(acc.id);
      });
    }
    if (salesEl) {
      salesEl.addEventListener('input', function () {
        updateRamSalesDerived(acc.id);
      });
    }
  });
}

function updateRamSalesDerived(accountId) {
  let previewEl = document.getElementById('ramTodaySales_' + accountId);
  let salesEl = document.getElementById('ramTotalSales_' + accountId);
  if (!previewEl) return;
  let raw = salesEl ? String(salesEl.value).trim() : '';
  if (raw === '' || isNaN(Number(raw))) {
    previewEl.textContent = '—';
    return;
  }
  previewEl.textContent = formatRamTodaySalesPreview(accountId, raw);
}

function updateRamInputDerived(accountId) {
  let acc = getRamInputAccounts().find(function (a) { return a.id === accountId; });
  if (!acc) return;
  let addEl = document.getElementById('ramAddInv_' + accountId);
  let addRaw = addEl ? String(addEl.value).trim() : '';
  let add = addRaw !== '' ? Number(addRaw) || 0 : 0;
  let dateKey = todayKey();
  let previewOperating = typeof calcRamEffectiveInvestment === 'function'
    ? calcRamEffectiveInvestment(
      typeof pdGetOperatingUsdAsOf === 'function' ? pdGetOperatingUsdAsOf(acc.id, 'ram', dateKey) : acc.investment,
      add
    )
    : acc.investment + add;
  let effectiveInv = typeof pdGetOperatingUsdAsOf === 'function'
    ? pdGetOperatingUsdAsOf(acc.id, 'ram', dateKey) + add
    : previewOperating;
  let invEl = document.getElementById('ramInv_' + accountId);
  let rateEl = document.getElementById('ramRate_' + accountId);
  let profitEl = document.getElementById('ramProfit_' + accountId);
  if (invEl) invEl.textContent = num(effectiveInv) + 'ドル';
  if (rateEl) rateEl.textContent = formatDailyRateLabel(effectiveInv);
  if (profitEl) profitEl.textContent = money(calcRamOperatingProfit(effectiveInv));
}

function renderRamInputFooter() {
  return '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="saveTodayRevenue()">保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRamAddAccountForm()">アカウント追加</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRevenueProjectSelect()">プロジェクト選択に戻る</button>' +
    '</div>';
}

function renderRamAccountStatusBadge(existing, accountId) {
  return renderInputStatusBadge(isRamAccountEntered(existing, accountId));
}

function renderRamInputProgress(existing) {
  let total = getRamInputAccounts().length;
  let done = countRamEnteredAccounts(existing);
  let label = done + ' / ' + total;
  if (total > 0 && done === total) label += ' 完了';
  return '<div class="ramInputProgress">' +
    '<span class="ramInputProgressLabel">入力状況</span>' +
    '<span class="ramInputProgressVal' + (total > 0 && done === total ? ' isComplete' : '') + '">' + label + '</span>' +
    '</div>';
}

function isRamDisplaySettingsEnabled() {
  if (typeof getHomeDemoRamAccounts === 'function' && getHomeDemoRamAccounts()) return false;
  return true;
}

function toggleRamAccountDisplaySettings(accountId) {
  if (!accountId || !isRamDisplaySettingsEnabled()) return;
  let panelId = 'ramDisplayPanel_' + accountId;
  let existing = document.getElementById(panelId);
  if (existing) {
    existing.remove();
    return;
  }
  document.querySelectorAll('.ramInputDisplayPanel').forEach(function (el) { el.remove(); });
  if (typeof pfCancelDisplayHideConfirm === 'function') pfCancelDisplayHideConfirm();
  let card = document.querySelector('.ramInputAccount[data-acc="' + accountId + '"]');
  if (!card || typeof pfRenderRamInputDisplaySettingsPanel !== 'function') return;
  let head = card.querySelector('.ramInputAccountHead');
  if (head) {
    head.insertAdjacentHTML('afterend', pfRenderRamInputDisplaySettingsPanel(accountId));
    let panel = document.getElementById(panelId);
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

function renderRamInputAccountHead(existing, accountId) {
  let html = '<div class="ramInputAccountHeadCol">' +
    renderRamAccountStatusBadge(existing, accountId);
  if (isRamDisplaySettingsEnabled()) {
    html += '<button type="button" class="btn2 ramInputDisplayBtn" onclick="toggleRamAccountDisplaySettings(\'' + accountId + '\')">表示設定</button>';
  }
  html += '</div>';
  return html;
}

function renderRamInputAccountCard(acc, existing) {
  let accEntry = getRamAccountEntry(existing, acc.id);
  let dateKey = todayKey();
  let addInv = typeof pdGetAdditionalInvestmentForDate === 'function'
    ? pdGetAdditionalInvestmentForDate(acc.id, 'ram', dateKey)
    : (accEntry && accEntry.addInvestment > 0 ? accEntry.addInvestment : '');
  if (addInv === 0) addInv = '';
  let todayRev = accEntry ? accEntry.todayRevenue : '';
  let salesEntry = getTodayRamSalesEntry();
  let accSales = getRamAccountSalesEntry(salesEntry, acc.id);
  let totalSalesVal = accSales && accSales.totalSales != null ? accSales.totalSales : '';
  let prevTotal = typeof pdGetRamPreviousTotalSales === 'function'
    ? pdGetRamPreviousTotalSales(acc.id, dateKey)
    : null;
  let todaySalesPreview = totalSalesVal !== ''
    ? formatRamTodaySalesPreview(acc.id, totalSalesVal)
    : (accSales && accSales.todaySales != null ? money(accSales.todaySales) : '—');
  let salesHint = prevTotal != null
    ? '前回 ' + money(prevTotal)
    : '初回は本日売上0として登録';
  let effectiveInv = typeof pdGetOperatingUsdAsOf === 'function'
    ? pdGetOperatingUsdAsOf(acc.id, 'ram', dateKey)
    : calcRamEffectiveInvestment(acc.investment, addInv);
  return '<section class="ramInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' +
    renderRamInputAccountHead(existing, acc.id) +
    '</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">ユーザー名</span><span class="ramInputVal">' + escapeHtml(acc.username) + '</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">現在運用額</span><span class="ramInputVal" id="ramInv_' + acc.id + '">' + num(effectiveInv) + 'ドル</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">日利</span><span class="ramInputVal" id="ramRate_' + acc.id + '">' + formatDailyRateLabel(effectiveInv) + '</span></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">追加投資額</span><div class="ramInputField"><input type="number" step="1" min="0" id="ramAddInv_' + acc.id + '" class="ramInputOptional" placeholder="0" value="' + addInv + '"><span class="ramInputUnit">ドル</span><span class="ramInputHint">追加投資があった時のみ入力</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">運用</span><span class="ramInputVal ramInputVal--gold" id="ramProfit_' + acc.id + '">' + money(calcRamOperatingProfit(effectiveInv)) + '</span></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">本日収益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="ramTodayRev_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + todayRev + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge">毎日入力</span></div></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">総売上</span><div class="ramInputField"><input type="number" step="0.01" id="ramTotalSales_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + totalSalesVal + '"><span class="ramInputUnit">ドル</span><span class="ramInputHint">' + salesHint + '</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日売上</span><span class="ramInputVal" id="ramTodaySales_' + acc.id + '">' + todaySalesPreview + '</span></div>' +
    '</div></section>';
}

function updateHomeActionCard() {
  let listEl = document.getElementById('homeActionList');
  let completeEl = document.getElementById('homeActionComplete');
  let rateEl = document.getElementById('homeActionRate');
  if (!listEl) return;

  let projects = getHomeActionProjects();
  let entry = getRevenueEntry(todayKey());
  let rows = projects.map(function (p) {
    return { proj: p, done: isHomeProjectEnteredToday(entry, p.key) };
  });

  rows.sort(function (a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return 0;
  });

  let doneCount = rows.filter(function (row) { return row.done; }).length;
  let allDone = projects.length > 0 && doneCount === projects.length;

  if (allDone) {
    listEl.innerHTML = '';
    listEl.classList.add('isHidden');
    if (completeEl) completeEl.classList.remove('hidden');
    if (rateEl) rateEl.textContent = '100%';
    return;
  }

  listEl.classList.remove('isHidden');
  if (completeEl) completeEl.classList.add('hidden');

  listEl.innerHTML = rows.map(function (row) {
    let p = row.proj;
    if (row.done) {
      return '<div class="homeActionItem homeActionItem--done">' +
        HOME_ACTION_ICON_DONE +
        '<span class="homeActionItemText">' + p.name + ' 入力完了</span></div>';
    }
    return '<div class="homeActionItem homeActionItem--pending">' +
      HOME_ACTION_ICON_PENDING +
      '<span class="homeActionItemText">' + getHomeActionPendingText(p.key, p.name) + '</span></div>';
  }).join('');
}

function getHomeActionPendingText(projectKey, projectName) {
  if (projectKey === 'ram') return projectName + 'の本日収益を入力してください';
  if (projectKey === 'orca') return projectName + 'の昨日AI利益・本日AF収益を入力してください';
  if (projectKey === 'cary') return projectName + 'の報酬を入力してください';
  return projectName + 'の収益を入力してください';
}

function defaultRevenueEntry() {
  let s = allOrgSummary();
  return {
    total: s.daily,
    ram: s.daily,
    orca: 0,
    genesis: 0,
    cary: 0,
    savedAt: new Date().toLocaleString()
  };
}

function getHomeReferenceDate() {
  if (typeof getHomeDemoReferenceDate === 'function') {
    let d = getHomeDemoReferenceDate();
    if (d) return d;
  }
  return new Date();
}

function getRevenueEntry(key) {
  if (typeof getHomeDemoRevenueEntry === 'function') {
    let demo = getHomeDemoRevenueEntry(key);
    if (demo !== undefined) return demo;
  }
  ensureRevenueLog();
  return settings.revenueLog[key] || null;
}

function persistHubSettings() {
  if (typeof hubSaveToStorage === 'function') {
    hubSaveToStorage();
    return;
  }
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    localStorage.setItem('oukei_hub_v15_data', JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : '',
      rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : []
    }));
  } catch (e) {}
}

function saveRevenueEntry(key, entry) {
  if (typeof isHomeDemoActive === 'function' && isHomeDemoActive()) return;
  ensureRevenueLog();
  settings.revenueLog[key] = entry;
  settings.lastUpdate = new Date().toLocaleString();
  markActivity();
  persistHubSettings();
  if (typeof pdNotifyPerformanceChanged === 'function') {
    pdNotifyPerformanceChanged({ type: 'revenue', dateKey: key });
  }
}

function calcInputStreak() {
  ensureRevenueLog();
  let streak = 0;
  let d = new Date();
  let today = todayKey();
  if (!getRevenueEntry(today)) d.setDate(d.getDate() - 1);
  for (;;) {
    let key = revenueDateKey(d.getFullYear(), d.getMonth(), d.getDate());
    if (!getRevenueEntry(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcMonthInputDetail() {
  ensureRevenueLog();
  let now = getHomeReferenceDate();
  let y = now.getFullYear();
  let m = now.getMonth();
  let elapsed = now.getDate();
  let filled = 0;
  for (let d = 1; d <= elapsed; d++) {
    if (getRevenueEntry(revenueDateKey(y, m, d))) filled++;
  }
  let rate = elapsed ? Math.round((filled / elapsed) * 100) : 0;
  return { filled: filled, elapsed: elapsed, rate: rate };
}

function calcMonthInputRate() {
  return calcMonthInputDetail().rate;
}

function renderProjectGrid(containerId, projects, getAmount, totalHint) {
  let el = document.getElementById(containerId);
  if (!el) return;
  let n = homeResponsiveGridCols(projects.length);
  el.style.setProperty('--proj-cols', n);
  el.setAttribute('data-count', projects.length);
  let amounts = projects.map(function (p) { return getAmount(p); });
  let total = typeof totalHint === 'number' ? totalHint : amounts.reduce(function (s, v) { return s + v; }, 0);
  el.innerHTML = projects.map(function (p, i) {
    let amt = amounts[i];
    let pct = total > 0 ? Math.round((amt / total) * 1000) / 10 : 0;
    return '<div class="homeProjCard homeProjCard--' + p.dot + '">' +
      '<div class="homeProjCardTop">' + renderHomeProjIcon(p.key, 'homeProjCardIcon') +
      '<span class="homeProjCardName">' + p.name + '</span></div>' +
      '<span class="homeProjCardAmt">' + money(amt) + '</span>' +
      '<span class="homeProjCardPct">' + pct + '%</span>' +
      '<div class="homeProjCardBar"><div class="homeProjCardBarFill" style="width:' + pct + '%"></div></div>' +
      '</div>';
  }).join('');
}

function updateHomeInputStats() {
  let streakEl = document.getElementById('homeInputStreak');
  let rateEl = document.getElementById('homeInputRate');
  let detailEl = document.getElementById('homeInputRateDetail');
  let ringEl = document.getElementById('homeInputRateRing');
  let detail = calcMonthInputDetail();
  if (streakEl) streakEl.textContent = calcInputStreak() + '日';
  if (rateEl) rateEl.textContent = detail.rate + '%';
  if (detailEl) detailEl.textContent = detail.filled + ' / ' + detail.elapsed + '日';
  if (ringEl) {
    let c = 2 * Math.PI * 47;
    ringEl.setAttribute('stroke-dasharray', c.toFixed(2));
    ringEl.setAttribute('stroke-dashoffset', (c * (1 - detail.rate / 100)).toFixed(2));
  }
}

function sumEntryRegisteredTotal(entry, dateKey) {
  if (!entry) return 0;
  let total = 0;
  getHomeProjectRegistry().forEach(function (p) {
    let amt = getHomeTodayProjectAmount(p.key, entry, dateKey);
    if (amt != null && amt > 0) total += amt;
  });
  return total;
}

function sumMonthRevenueLog(y, m) {
  ensureRevenueLog();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let out = { total: 0, hasLog: false };
  for (let d = 1; d <= daysInMonth; d++) {
    let dateKey = revenueDateKey(y, m, d);
    let entry = getRevenueEntry(dateKey);
    if (!entry) continue;
    let dayTotal = sumEntryRegisteredTotal(entry, dateKey);
    if (dayTotal <= 0) continue;
    out.hasLog = true;
    out.total += dayTotal;
    getHomeProjectRegistry().forEach(function (p) {
      let amt = getHomeTodayProjectAmount(p.key, entry, dateKey);
      if (amt != null && amt > 0) out[p.key] = (out[p.key] || 0) + amt;
    });
  }
  return out;
}

function projectAmountFromEntry(entry, proj) {
  if (!entry) return 0;
  return entry[proj.key] || 0;
}

function fallbackProjectAmount(proj, sAll, mode) {
  if (proj.key === 'ram') return mode === 'monthly' ? sAll.monthly : sAll.daily;
  return 0;
}

function formatPerformanceAmount(n) {
  if (n === null || n === undefined) {
    return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
  }
  return money(n);
}

function formatCalDayAmount(entry, dateKey) {
  if (!entry) return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
  let total = dateKey ? sumEntryRegisteredTotal(entry, dateKey) : (Number(entry.total) || 0);
  if (!total) return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
  return money(total);
}

function renderHomeCalendar() {
  if (typeof homeCalendar === 'undefined') return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let first = new Date(y, m, 1);
  let start = first.getDay();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let today = getHomeReferenceDate();
  let weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  let cells = weekdays.map(function (w, i) {
    let cls = 'homeCalDayLabel' + (i === 0 ? ' isSun' : i === 6 ? ' isSat' : '');
    return '<div class="' + cls + '">' + w + '</div>';
  }).join('');

  for (let i = 0; i < start; i++) cells += '<div class="homeCalDay homeCalDay--blank"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    let key = revenueDateKey(y, m, d);
    let entry = getRevenueEntry(key);
    let isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
    let cls = ['homeCalDay'];
    if (isToday) cls.push('isToday');
    if (entry) cls.push('isFilled');
    else cls.push('isEmpty');
    let amtCls = entry ? 'homeCalDayAmt' : 'homeCalDayAmt isDash';
    cells += '<button type="button" class="' + cls.join(' ') + '" onclick="showRevenueDayDetail(\'' + key + '\')" aria-label="' + (m + 1) + '月' + d + '日 ' + formatCalDayAmount(entry, key) + '">' +
      '<span class="homeCalDayNum">' + d + '</span>' +
      '<span class="' + amtCls + '">' + formatCalDayAmount(entry, key) + '</span></button>';
  }

  homeCalendar.innerHTML =
    '<div class="homeCalShell">' +
    '<div class="homeCalHead">' +
    '<button type="button" class="homeCalNavBtn" onclick="homeCalPrevMonth()" aria-label="前の月">‹</button>' +
    '<div class="homeCalTitle">' + formatCalLabel(y, m) + '</div>' +
    '<button type="button" class="homeCalNavBtn" onclick="homeCalNextMonth()" aria-label="次の月">›</button>' +
    '</div>' +
    '<div class="homeCalGrid">' + cells + '</div>' +
    '<div class="homeCalLegend">' +
    '<span class="homeCalLegendItem"><i class="homeCalLegendMark isToday"></i>今日</span>' +
    '<span class="homeCalLegendItem"><i class="homeCalLegendMark isFilled"></i>入力済み</span>' +
    '<span class="homeCalLegendItem"><i class="homeCalLegendMark isEmpty"></i>未入力</span>' +
    '</div></div>';
}

function homeCalPrevMonth() {
  if (typeof hubPrevMonth === 'function') hubPrevMonth();
}

function homeCalNextMonth() {
  if (typeof hubNextMonth === 'function') hubNextMonth();
}

function formatAxisDollar(n) {
  n = Math.round(n * 100) / 100;
  if (n >= 1000) return '$' + Math.round(n).toLocaleString();
  if (Number.isInteger(n)) return '$' + n;
  return '$' + n.toFixed(1);
}

function niceChartAxisMax(rawMax) {
  if (rawMax <= 0) return 20;
  let padded = rawMax * 1.08;
  let mag = Math.pow(10, Math.floor(Math.log10(padded)));
  let norm = padded / mag;
  let nice = 10;
  if (norm <= 1) nice = 1;
  else if (norm <= 1.2) nice = 1.2;
  else if (norm <= 1.5) nice = 1.5;
  else if (norm <= 2) nice = 2;
  else if (norm <= 2.5) nice = 2.5;
  else if (norm <= 3) nice = 3;
  else if (norm <= 4) nice = 4;
  else if (norm <= 5) nice = 5;
  else if (norm <= 6) nice = 6;
  else if (norm <= 8) nice = 8;
  return nice * mag;
}

function chartAxisTicks(axisMax, steps) {
  steps = steps || 5;
  let ticks = [];
  for (let i = 0; i < steps; i++) ticks.push((axisMax / (steps - 1)) * i);
  return ticks;
}

function chartXLabels(daysInMonth, monthNum) {
  let marks = [1];
  [5, 10, 15, 20, 25, 30].forEach(function (d) {
    if (d <= daysInMonth && d !== 1) marks.push(d);
  });
  if (marks[marks.length - 1] !== daysInMonth) marks.push(daysInMonth);
  return marks.map(function (d) { return { d: d, label: monthNum + '/' + d }; });
}

function getHomeProjectRegistry() {
  if (typeof getHomeDemoEnabledProjects === 'function') {
    let demo = getHomeDemoEnabledProjects();
    if (demo) {
      return demo.map(function (p) {
        return homeProjectEntryFromMaster({ key: p.key, name: p.name });
      });
    }
  }
  if (typeof pmGetEnabledProjects === 'function') {
    return pmGetEnabledProjects().map(function (p) {
      return homeProjectEntryFromMaster(p);
    });
  }
  return [];
}

function getHomeMonthlyRevenueContext(sAll) {
  if (!sAll && typeof allOrgSummary === 'function') sAll = allOrgSummary();
  if (!sAll) return null;
  let y = homeCalView.y;
  let m = homeCalView.m;
  if (typeof getHomeDemoMonthlyOverride === 'function') {
    let demo = getHomeDemoMonthlyOverride(y, m, sAll);
    if (demo) return demo;
  }
  let monthLog = sumMonthRevenueLog(y, m);
  let total = monthLog.hasLog ? monthLog.total : null;
  return { sAll: sAll, monthLog: monthLog, total: total };
}

function getHomeMonthlyProjectRows(ctx) {
  if (!ctx) return [];
  let registry = getHomeProjectRegistry();
  let entry = ctx.monthLog.hasLog ? ctx.monthLog : null;
  return registry.map(function (p) {
    let amt = entry ? (entry[p.key] || 0) : null;
    let pct = ctx.total > 0 && amt != null ? Math.round((amt / ctx.total) * 1000) / 10 : 0;
    return { proj: p, amt: amt, pct: pct };
  }).filter(function (row) { return row.amt != null && row.amt > 0; });
}

function updateHomeMonthlySummary(sAll) {
  let ctx = getHomeMonthlyRevenueContext(sAll);
  if (!ctx) return;
  let monthlyEl = document.getElementById('homeMonthly');
  let yenEl = document.getElementById('homeMonthlyYen');
  if (monthlyEl) monthlyEl.textContent = formatPerformanceAmount(ctx.total);
  if (yenEl) yenEl.textContent = ctx.total != null ? yen(ctx.total) : formatPerformanceAmount(null);
}

function bindMonthlyChartTooltip(container, points, monthNum) {
  let tip = container.querySelector('.homeMonthlyChartTip');
  let svg = container.querySelector('.homeMonthlyChartSvg');
  if (!tip || !svg) return;

  function positionTip(node) {
    let cx = Number(node.getAttribute('cx'));
    let cy = Number(node.getAttribute('cy'));
    let vb = svg.viewBox.baseVal;
    let px = (cx / vb.width) * svg.clientWidth;
    let ratio = cx / vb.width;
    let left;
    if (ratio > 0.82) left = px - tip.offsetWidth + 6;
    else if (ratio < 0.18) left = px - 6;
    else left = px - tip.offsetWidth / 2;
    left = Math.max(4, Math.min(left, svg.clientWidth - tip.offsetWidth - 4));
    let top = ((cy / vb.height) * svg.clientHeight) - tip.offsetHeight - 12;
    tip.style.left = left + 'px';
    tip.style.top = Math.max(4, top) + 'px';
  }

  function showTip(node, p) {
    if (!p) return;
    let amtHtml = p.hasData
      ? money(p.val)
      : '<span class="homeMonthlyChartTipEmpty">データなし</span>';
    tip.innerHTML =
      '<span class="homeMonthlyChartTipDate">' + monthNum + '/' + p.d + '</span>' +
      '<span class="homeMonthlyChartTipAmt">' + amtHtml + '</span>';
    tip.classList.add('isVisible');
    positionTip(node);
    container.querySelectorAll('.homeMonthlyChartDot').forEach(function (d) { d.classList.remove('isActive'); });
    let dot = node.parentNode ? node.parentNode.querySelector('.homeMonthlyChartDot') : null;
    if (dot) dot.classList.add('isActive');
  }

  function hideTip() {
    tip.classList.remove('isVisible');
    container.querySelectorAll('.homeMonthlyChartDot').forEach(function (d) { d.classList.remove('isActive'); });
  }

  function bindHit(node) {
    node.addEventListener('mouseenter', function () {
      showTip(node, points[Number(node.getAttribute('data-idx'))]);
    });
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('click', function (ev) {
      ev.preventDefault();
      showTip(node, points[Number(node.getAttribute('data-idx'))]);
    });
  }

  container.querySelectorAll('.homeMonthlyChartHit').forEach(bindHit);
}

function homeChartLastDataDay(y, m) {
  let ref = getHomeReferenceDate();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  if (y < ref.getFullYear() || (y === ref.getFullYear() && m < ref.getMonth())) return daysInMonth;
  if (y === ref.getFullYear() && m === ref.getMonth()) return ref.getDate();
  return 0;
}

function homeCalcPrevMonth(y, m) {
  let pm = m - 1;
  let py = y;
  if (pm < 0) { pm = 11; py -= 1; }
  return { y: py, m: pm };
}

function homeDayHasRevenueEntry(y, m, d) {
  let dateKey = revenueDateKey(y, m, d);
  let entry = getRevenueEntry(dateKey);
  if (!entry) return false;
  if (typeof homeTodayEntryHasRevenue === 'function') {
    return homeTodayEntryHasRevenue(entry, dateKey);
  }
  return (Number(entry.total) || 0) > 0;
}

function homeCollectDailyTotals(y, m) {
  let days = new Date(y, m + 1, 0).getDate();
  let lastDay = homeChartLastDataDay(y, m);
  let vals = [];
  for (let d = 1; d <= days; d++) {
    if (d > lastDay || !homeDayHasRevenueEntry(y, m, d)) {
      vals.push(null);
      continue;
    }
    let dateKey = revenueDateKey(y, m, d);
    let entry = getRevenueEntry(dateKey);
    let total = Number(entry.total) || 0;
    if (typeof pdRecalculateRevenueEntry === 'function') {
      total = pdRecalculateRevenueEntry(JSON.parse(JSON.stringify(entry)), dateKey).total;
    }
    vals.push(total);
  }
  return vals;
}

function homeBuildChartLineSegments(vals, plotX, plotY) {
  let segments = [];
  let current = [];
  vals.forEach(function (v, i) {
    if (v === null || v === undefined) {
      if (current.length >= 2) segments.push(current.slice());
      current = [];
      return;
    }
    current.push(plotX(i).toFixed(1) + ',' + plotY(v).toFixed(1));
  });
  if (current.length >= 2) segments.push(current);
  return segments;
}

var HOME_CHART_X_DAYS = [1, 5, 10, 15, 20, 25, 30];

function renderHomeMonthlyLineChart() {
  let el = document.getElementById('homeMonthlyLineChart');
  if (!el) return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let monthNum = m + 1;
  let prev = homeCalcPrevMonth(y, m);
  let days = new Date(y, m + 1, 0).getDate();
  let curVals = homeCollectDailyTotals(y, m);
  let prevVals = homeCollectDailyTotals(prev.y, prev.m);
  let numeric = curVals.concat(prevVals).filter(function (v) { return v != null; });
  let dataMax = numeric.length ? Math.max.apply(null, numeric) : 1;
  let axisMax = typeof niceChartAxisMax === 'function' ? niceChartAxisMax(dataMax) : Math.max(dataMax, 450);
  let cc = { current: '#60a5fa', prev: '#64748b', label: '#7f97b3', grid: 'rgba(80,110,150,.25)', dotStroke: '#0b182b' };

  let w = 520;
  let h = 168;
  let padLeft = 42;
  let padRight = 16;
  let padTop = 10;
  let padBottom = 20;
  let plotW = w - padLeft - padRight;
  let plotH = h - padTop - padBottom;

  function plotY(val) {
    return padTop + plotH - (Math.max(0, val) / axisMax) * plotH;
  }

  function plotX(idx) {
    if (days <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (days - 1)) * plotW;
  }

  let ticks = typeof chartAxisTicks === 'function' ? chartAxisTicks(axisMax, 5) : [0, axisMax / 2, axisMax];
  let grid = ticks.map(function (t) {
    let yPos = plotY(t);
    let label = typeof formatAxisDollar === 'function' ? formatAxisDollar(t) : money(t);
    return '<line x1="' + padLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + (w - padRight) + '" y2="' + yPos.toFixed(1) + '" stroke="' + cc.grid + '" stroke-width="1"></line>' +
      '<text x="' + (padLeft - 6) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end" fill="' + cc.label + '" font-size="10" font-weight="700">' + label + '</text>';
  }).join('');

  let xSvg = HOME_CHART_X_DAYS.filter(function (d) { return d <= days; }).map(function (d) {
    let x = plotX(d - 1);
    return '<text x="' + x.toFixed(1) + '" y="' + (h - 3) + '" text-anchor="middle" fill="' + cc.label + '" font-size="10" font-weight="700">' + d + '日</text>';
  }).join('');

  let prevSegments = homeBuildChartLineSegments(prevVals, plotX, plotY);
  let curSegments = homeBuildChartLineSegments(curVals, plotX, plotY);
  let prevLines = prevSegments.map(function (seg) {
    return '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + cc.prev + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 4"></polyline>';
  }).join('');
  let curLines = curSegments.map(function (seg) {
    return '<polyline points="' + seg.join(' ') + '" fill="none" stroke="' + cc.current + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>';
  }).join('');

  function lineDots(vals, fill, stroke) {
    return vals.map(function (v, i) {
      if (v === null || v === undefined) return '';
      return '<circle cx="' + plotX(i).toFixed(1) + '" cy="' + plotY(v).toFixed(1) + '" r="3.2" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.2"></circle>';
    }).join('');
  }

  let hits = curVals.map(function (v, i) {
    let d = i + 1;
    let hasData = v !== null && v !== undefined;
    let cy = hasData ? plotY(v) : plotY(0);
    return '<circle class="homeMonthlyChartHit" data-idx="' + i + '" cx="' + plotX(i).toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="8" fill="transparent"></circle>';
  }).join('');

  let points = curVals.map(function (v, i) {
    return { d: i + 1, val: v, hasData: v !== null && v !== undefined };
  });

  let prevLabel = typeof hubFormatMonthLabel === 'function'
    ? hubFormatMonthLabel(prev.y, prev.m)
    : (prev.y + '年' + (prev.m + 1) + '月');
  let curLabel = typeof hubFormatMonthLabel === 'function'
    ? hubFormatMonthLabel(y, m)
    : (y + '年' + monthNum + '月');

  el.innerHTML =
    '<div class="homeMonthlyChartInner">' +
    '<div class="homeMonthlyChartTip"></div>' +
    '<svg class="homeMonthlyChartSvg rmCompareSvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    grid + xSvg + prevLines + lineDots(prevVals, cc.prev, cc.dotStroke) +
    curLines + lineDots(curVals, cc.current, cc.dotStroke) + hits +
    '</svg>' +
    '<div class="rmCompareLegend homeMonthlyChartLegend">' +
    '<span class="rmCompareLegendItem"><i class="isCurrent"></i>今月（' + curLabel + '）</span>' +
    '<span class="rmCompareLegendItem"><i class="isPrev"></i>前月（' + prevLabel + '）</span>' +
    '</div></div>';

  bindMonthlyChartTooltip(el, points, monthNum);
}

function renderHomeMonthlyProjGrid(sAll) {
  let el = document.getElementById('homeMonthlyProjGrid');
  if (!el) return;
  let ctx = getHomeMonthlyRevenueContext(sAll);
  if (!ctx) return;

  let rows = getHomeMonthlyProjectRows(ctx);
  let cols = homeResponsiveGridCols(rows.length);
  el.style.setProperty('--monthly-proj-cols', cols);
  el.setAttribute('data-count', rows.length);

  if (!rows.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = rows.map(function (row) {
    let p = row.proj;
    return '<div class="homeMonthlyProjCard homeMonthlyProjCard--' + p.cls + '">' +
      '<div class="homeMonthlyProjCardHead">' +
      '<span class="homeMonthlyProjCardName"><span class="homeMonthlyProjDot">' +
      renderHomeProjIcon(p.key, 'homeMonthlyProjIcon') + '</span>' + p.name + '</span>' +
      '<span class="homeMonthlyProjCardPct">' + row.pct + '%</span></div>' +
      '<span class="homeMonthlyProjCardAmt">' + money(row.amt) + '</span>' +
      '<div class="homeMonthlyProjCardBar"><div class="homeMonthlyProjCardBarFill" style="width:' + row.pct + '%"></div></div>' +
      '</div>';
  }).join('');
}

function updateHomeMonthlyProjects(sAll) {
  updateHomeMonthlySummary(sAll);
  renderHomeMonthlyProjGrid(sAll);
}

function getHomeTodayProjectAmount(projectKey, entry, dateKey) {
  if (!entry) return null;
  if (typeof pdSumProjectDayRevenue === 'function') {
    return pdSumProjectDayRevenue(entry, projectKey, dateKey);
  }
  if (typeof getProjectInputSavedTotal === 'function') {
    return getProjectInputSavedTotal(projectKey, entry);
  }
  return Number(entry[projectKey]) || 0;
}

function homeTodayEntryHasRevenue(entry, dateKey) {
  if (!entry) return false;
  if (typeof pdProjectDayHasRevenue === 'function') {
    return getHomeProjectRegistry().some(function (p) {
      return pdProjectDayHasRevenue(entry, p.key, dateKey);
    });
  }
  return sumEntryRegisteredTotal(entry, dateKey) > 0;
}

function resolveHomeTodayEntry(dateKey) {
  let entry = getRevenueEntry(dateKey);
  if (!entry || !homeTodayEntryHasRevenue(entry, dateKey)) {
    return { entry: null, total: null };
  }
  return { entry: entry, total: sumEntryRegisteredTotal(entry, dateKey) };
}

function getHomeTodayProjectRows(ctx) {
  if (!ctx) return [];
  let registry = getHomeProjectRegistry();
  let entry = ctx.todayEntry;
  let dateKey = typeof todayKey === 'function' ? todayKey() : '';

  return registry.map(function (p) {
    let amt = entry ? getHomeTodayProjectAmount(p.key, entry, dateKey) : null;
    let pct = ctx.todayTotal != null && ctx.todayTotal > 0 && amt != null
      ? Math.round((amt / ctx.todayTotal) * 1000) / 10 : 0;
    return { proj: p, amt: amt, pct: pct };
  }).filter(function (row) { return row.amt != null && row.amt > 0; });
}

function renderHomeTodayDonut(rows, total) {
  let el = document.getElementById('homeTodayDonut');
  if (!el) return;
  if (!rows.length || total <= 0) {
    el.innerHTML = '';
    el.classList.remove('isHover');
    return;
  }

  let colors = {
    ram: '#3b82f6',
    orca: '#14b8a6',
    genesis: '#a855f7',
    cary: '#a855f7',
    custom: '#94a3b8'
  };
  let r = 30;
  let cx = 44;
  let cy = 44;
  let c = 2 * Math.PI * r;
  let offset = 0;
  let segs = rows.map(function (row, i) {
    let len = (row.amt / total) * c;
    let stroke = colors[row.proj.cls] || colors.custom;
    let hit = '<circle class="homeTodayDonutHit" data-idx="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="transparent" stroke-width="14" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>';
    let seg = '<circle class="homeTodayDonutSeg" data-idx="' + i + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + stroke + '" stroke-width="9" stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>';
    offset += len;
    return hit + seg;
  }).join('');

  let legend = rows.map(function (row, i) {
    let stroke = colors[row.proj.cls] || colors.custom;
    return '<button type="button" class="homeTodayDonutLegendItem" data-idx="' + i + '" aria-label="' + row.proj.name + ' ' + row.pct + '%">' +
      '<span class="homeTodayDonutLegendDot" style="background:' + stroke + '"></span>' +
      '<span class="homeTodayDonutLegendName">' + row.proj.name + '</span>' +
      '<span class="homeTodayDonutLegendPct">' + row.pct + '%</span></button>';
  }).join('');

  el.innerHTML =
    '<div class="homeTodayDonutTip" id="homeTodayDonutTip" role="tooltip"></div>' +
    '<div class="homeTodayDonutInner">' +
    '<svg class="homeTodayDonutSvg" viewBox="0 0 88 88" aria-hidden="true">' +
    '<circle class="homeTodayDonutTrack" cx="' + cx + '" cy="' + cy + '" r="' + r + '"></circle>' +
    segs +
    '</svg>' +
    '<span class="homeTodayDonutCenter"><span class="homeTodayDonutCenterMain">内訳</span><span class="homeTodayDonutCenterSub">100%</span></span>' +
    '</div>' +
    '<div class="homeTodayDonutLegend">' + legend + '</div>';

  bindHomeTodayDonutHover(el, rows);
}

function bindHomeTodayDonutHover(wrap, rows) {
  if (!wrap || !rows.length) return;
  let tip = wrap.querySelector('#homeTodayDonutTip');
  let hits = wrap.querySelectorAll('.homeTodayDonutHit');
  let segs = wrap.querySelectorAll('.homeTodayDonutSeg');
  let legendItems = wrap.querySelectorAll('.homeTodayDonutLegendItem');

  function clearActive() {
    wrap.classList.remove('isHover');
    segs.forEach(function (s) { s.classList.remove('isActive'); });
    legendItems.forEach(function (l) { l.classList.remove('isActive'); });
    if (tip) {
      tip.classList.remove('isVisible');
      tip.textContent = '';
    }
  }

  function setActive(idx) {
    let row = rows[idx];
    if (!row) return;
    wrap.classList.add('isHover');
    segs.forEach(function (s) {
      s.classList.toggle('isActive', Number(s.getAttribute('data-idx')) === idx);
    });
    legendItems.forEach(function (l) {
      l.classList.toggle('isActive', Number(l.getAttribute('data-idx')) === idx);
    });
    if (tip) {
      tip.textContent = row.proj.name + ' ' + row.pct + '% · ' + money(row.amt);
      tip.classList.add('isVisible');
    }
  }

  hits.forEach(function (hit) {
    hit.addEventListener('mouseenter', function () {
      setActive(Number(hit.getAttribute('data-idx')));
    });
  });

  legendItems.forEach(function (item) {
    item.addEventListener('mouseenter', function () {
      setActive(Number(item.getAttribute('data-idx')));
    });
    item.addEventListener('focus', function () {
      setActive(Number(item.getAttribute('data-idx')));
    });
    item.addEventListener('blur', function () {
      if (!wrap.matches(':hover') && !wrap.contains(document.activeElement)) clearActive();
    });
  });

  wrap.addEventListener('mouseleave', clearActive);
}

function renderHomeTodayProjGrid(rows) {
  let el = document.getElementById('homeDailyProjGrid');
  if (!el) return;
  let cols = homeResponsiveGridCols(rows.length);
  el.style.setProperty('--today-proj-cols', cols);
  el.setAttribute('data-count', rows.length);

  if (!rows.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = rows.map(function (row) {
    let p = row.proj;
    return '<div class="homeTodayProjCard homeTodayProjCard--' + p.cls + '">' +
      '<div class="homeTodayProjCardHead">' +
      '<span class="homeTodayProjCardName"><span class="homeTodayProjMark">' +
      renderHomeProjIcon(p.key, 'homeTodayProjIcon') + '</span>' + p.name + '</span>' +
      '<span class="homeTodayProjCardPct">' + row.pct + '%</span></div>' +
      '<span class="homeTodayProjCardAmt">' + money(row.amt) + '</span>' +
      '<div class="homeTodayProjCardBar"><div class="homeTodayProjCardBarFill" style="width:' + row.pct + '%"></div></div>' +
      '</div>';
  }).join('');
}

function updateHomeTodaySection(sAll) {
  if (!sAll && typeof allOrgSummary === 'function') sAll = allOrgSummary();
  if (!sAll) return;

  let tk = todayKey();
  let todayResolved = resolveHomeTodayEntry(tk);
  let todayEntry = todayResolved.entry;
  let todayTotal = todayResolved.total;
  let yesterdayEntry = getRevenueEntry(yesterdayKey());
  let yKey = yesterdayKey();
  let yesterdayTotal = (yesterdayEntry && homeTodayEntryHasRevenue(yesterdayEntry, yKey))
    ? sumEntryRegisteredTotal(yesterdayEntry, yKey)
    : null;

  let dailyEl = document.getElementById('homeDaily');
  let yenEl = document.getElementById('homeDailyYen');
  if (dailyEl) dailyEl.textContent = formatPerformanceAmount(todayTotal);
  if (yenEl) yenEl.textContent = todayTotal != null ? yen(todayTotal) : formatPerformanceAmount(null);

  let compareEl = document.getElementById('homeTodayCompare');
  if (compareEl) {
    compareEl.innerHTML =
      '<div class="homeTodayCompareItem">' +
      '<span class="homeTodayCompareLabel">昨日の収益</span>' +
      '<span class="homeTodayCompareVal">' + formatPerformanceAmount(yesterdayTotal) + '</span></div>' +
      '<div class="homeTodayCompareItem homeTodayCompareItem--today">' +
      '<span class="homeTodayCompareLabel">本日の収益</span>' +
      '<span class="homeTodayCompareVal">' + formatPerformanceAmount(todayTotal) + '</span></div>';
  }

  let ctx = { sAll: sAll, todayEntry: todayEntry, todayTotal: todayTotal, yesterdayTotal: yesterdayTotal };
  let rows = getHomeTodayProjectRows(ctx);
  renderHomeTodayDonut(rows, todayTotal || 0);
  renderHomeTodayProjGrid(rows);
}

function updateHomeDashboard(sAll) {
  if (typeof hubEnsureViewMonth === 'function') hubEnsureViewMonth();
  updateHomeInputStats();
  updateHomeActionCard();
  renderHomeCalendar();
  renderHomeMonthlyLineChart();
  updateHomeMonthlyProjects(sAll);
  updateHomeTodaySection(sAll);
  if (typeof revenueManagePage !== 'undefined' && !revenueManagePage.classList.contains('hidden') && typeof renderRevenueManage === 'function') {
    renderRevenueManage();
  }
  if (typeof salesManagePage !== 'undefined' && !salesManagePage.classList.contains('hidden') && typeof renderSalesManage === 'function') {
    renderSalesManage();
  }
  if (typeof updateOchanMessage === 'function') updateOchanMessage();
  if (typeof renderPortfolio === 'function') renderPortfolio();
}

function showRevenueDayDetail(key) {
  let entry = getRevenueEntry(key);
  let parts = key.split('-');
  let label = parts[0] + '年' + Number(parts[1]) + '月' + Number(parts[2]) + '日';
  modalTitle.textContent = label + ' の収益';
  if (!entry) {
    modalContent.innerHTML = '<div class="lineBox"><b>未入力</b><p class="help">この日付の実績はまだ記録されていません。</p></div>';
  } else {
    let dayTotal = sumEntryRegisteredTotal(entry, key);
    let projectRows = getHomeProjectRegistry().map(function (p) {
      let amt = getHomeTodayProjectAmount(p.key, entry, key);
      return { proj: p, amt: amt || 0 };
    }).filter(function (row) { return row.amt > 0; });
    let projectHtml = projectRows.map(function (row) {
      return '<div class="homeSummaryRow"><span class="homeSummaryProjLabel">' +
        renderHomeProjIcon(row.proj.key, 'homeSummaryProjIcon') +
        '<span>' + escapeHtml(row.proj.name) + '</span></span><b>' + money(row.amt) + '</b></div>';
    }).join('');
    let ramDetail = '';
    if (entry.ramAccounts && typeof getRamInputAccounts === 'function' &&
      getHomeProjectRegistry().some(function (p) { return p.key === 'ram'; })) {
      let rows = getRamInputAccounts().map(function (acc) {
        let ae = entry.ramAccounts[acc.id];
        if (!ae) return '';
        let total = typeof pdRamAccountRevenueTotal === 'function'
          ? pdRamAccountRevenueTotal(ae, acc.id, key)
          : (ae.todayRevenue || 0);
        return '<div class="homeSummaryRow"><span>' + escapeHtml(acc.username) + '</span><b>' + money(total) + '</b></div>';
      }).join('');
      if (rows) ramDetail = '<div class="lineBox" style="margin-top:10px"><b>RAM アカウント別</b><div class="homeSummaryList">' + rows + '</div></div>';
    }
    modalContent.innerHTML =
      '<div class="lineBox"><b>合計</b><div class="amount">' + money(dayTotal) + '</div><div class="help">' + yen(dayTotal) + '</div></div>' +
      (projectHtml ? '<div class="homeSummaryList" style="margin-top:10px">' + projectHtml + '</div>' : '') +
      ramDetail +
      (entry.savedAt ? '<p class="help" style="margin-top:10px">記録：' + entry.savedAt + '</p>' : '');
  }
  modalBg.style.display = 'flex';
}

function openRevenueInput() {
  openRevenueProjectSelect();
}

function openRevenueProjectSelect() {
  ramSavePending = null;
  orcaSavePending = null;
  let projects = getRevenueInputProjects();
  modalTitle.textContent = '実績入力';

  if (!projects.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>表示中のプロジェクトがありません</b><p class="help">設定のプロジェクト管理から、入力したいプロジェクトを表示 ON にしてください。</p></div>';
    modalBg.style.display = 'flex';
    return;
  }

  let buttons = projects.map(function (p) {
    let meta = getRevenueProjectMeta(p.key);
    let stats = getRevenueProjectCardStats(p.key);
    let countLabel = Math.max(stats.accountCount, stats.enteredCount) + '件';
    return '<button type="button" class="revenueProjectCard revenueProjectCard--' + escapeHtml(p.key) + (meta.ready ? '' : ' isSoon') + '" onclick="selectRevenueProject(\'' + p.key + '\')">' +
      renderHomeProjIcon(p.key, 'revenueProjectCardIcon') +
      '<div class="revenueProjectCardBody">' +
      '<div class="revenueProjectCardName">' + escapeHtml(p.name) + '</div>' +
      '<div class="revenueProjectCardDesc">' + escapeHtml(meta.desc) + '</div>' +
      '<div class="revenueProjectCardMeta">入力件数：' + countLabel + '</div>' +
      '<div class="revenueProjectCardTotal">入力済み合計：' + money(stats.total) + '</div>' +
      (meta.ready ? '' : '<div class="revenueProjectCardNote">準備中</div>') +
      '</div></button>';
  }).join('');

  modalContent.innerHTML =
    '<p class="help ramInputLead">入力するプロジェクトを選んでください。</p>' +
    '<div class="revenueProjectList">' + buttons + '</div>';
  modalBg.style.display = 'flex';
}

function selectRevenueProject(projectKey) {
  if (projectKey === 'ram') {
    openRamRevenueInput();
    return;
  }
  if (projectKey === 'orca') {
    openOrcaRevenueInput();
    return;
  }
  alert('このプロジェクトの実績入力は準備中です。');
}

function openRamRevenueInput() {
  ramSavePending = null;
  ramSalesDecreasePending = null;
  if (typeof pfCancelDisplayHideConfirm === 'function') pfCancelDisplayHideConfirm();
  let accounts = getRamInputAccounts();
  modalTitle.textContent = 'RAM 実績入力';

  if (!accounts.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>アカウントがありません</b><p class="help">「アカウント追加」からRAMアカウントを登録してください。</p></div>' +
      renderRamInputFooter();
    modalBg.style.display = 'flex';
    return;
  }

  let existing = getTodayRamRevenueEntry();
  let cards = accounts.map(function (acc) {
    return renderRamInputAccountCard(acc, existing);
  }).join('');

  modalContent.innerHTML =
    renderRamInputProgress(existing) +
    '<p class="help ramInputLead">毎日入力するのは「本日収益」と「総売上」です。総売上と前回保存値の差額が本日売上として自動反映されます。</p>' +
    '<div class="ramInputList">' + cards + '</div>' +
    renderRamInputFooter();

  modalBg.style.display = 'flex';
  bindRamInputListeners();
  getRamInputAccounts().forEach(function (acc) {
    updateRamSalesDerived(acc.id);
  });

  setTimeout(function () {
    let focusEl = accounts.map(function (acc) {
      return document.getElementById('ramTodayRev_' + acc.id);
    }).find(function (el) {
      return el && el.value === '';
    });
    if (focusEl) focusEl.focus();
  }, 80);
}

function refreshHomeAfterRevenueSave() {
  if (typeof allOrgSummary === 'function' && typeof updateHomeDashboard === 'function') {
    updateHomeDashboard(allOrgSummary());
  } else {
    updateHomeActionCard();
  }
}

function executeRamSave(collected) {
  if (collected.ramAccounts && Object.keys(collected.ramAccounts).length) {
    persistRamRevenueEntry(collected.ramAccounts, collected.totalRam);
  }
  if (collected.ramSales && Object.keys(collected.ramSales).length) {
    persistRamSalesFromTotals(collected.ramSales, todayKey());
  }
  if (typeof render === 'function') render();
  refreshHomeAfterRevenueSave();
  if (typeof showPage === 'function') showPage('home');
  if (typeof closeModal === 'function') closeModal();
  showToast('✅ 保存しました');
}

function proceedRamSaveAfterSalesChecks(collected) {
  let existing = getTodayRamRevenueEntry();
  if ((hasRamDataSavedForToday(existing) || hasRamSalesSavedForToday()) &&
    ramInputDiffersFromSaved(collected, existing)) {
    showRamOverwriteConfirm(collected);
    return;
  }
  executeRamSave(collected);
}

function proceedRamSaveAfterDecreaseConfirm(collected) {
  proceedRamSaveAfterSalesChecks(collected);
}

function showRamTotalSalesDecreaseConfirm(collected) {
  ramSalesDecreasePending = collected;
  let existing = document.getElementById('ramTotalSalesDecreaseConfirm');
  if (existing) existing.remove();
  modalContent.insertAdjacentHTML('beforeend',
    '<div class="ramInputConfirm" id="ramTotalSalesDecreaseConfirm">' +
    '<p class="ramInputConfirmText">前回より総売上が減少しています。入力内容に間違いがなければ『登録』を押してください。</p>' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="confirmRamTotalSalesDecreaseSave()">登録</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="cancelRamTotalSalesDecrease()">キャンセル</button>' +
    '</div></div>');
  let confirmEl = document.getElementById('ramTotalSalesDecreaseConfirm');
  if (confirmEl && confirmEl.scrollIntoView) confirmEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelRamTotalSalesDecrease() {
  ramSalesDecreasePending = null;
  let el = document.getElementById('ramTotalSalesDecreaseConfirm');
  if (el) el.remove();
}

function confirmRamTotalSalesDecreaseSave() {
  if (!ramSalesDecreasePending) return;
  let collected = ramSalesDecreasePending;
  ramSalesDecreasePending = null;
  let el = document.getElementById('ramTotalSalesDecreaseConfirm');
  if (el) el.remove();
  proceedRamSaveAfterDecreaseConfirm(collected);
}

function showRamOverwriteConfirm(collected) {
  ramSavePending = collected;
  let existing = document.getElementById('ramOverwriteConfirm');
  if (existing) existing.remove();
  modalContent.insertAdjacentHTML('beforeend',
    '<div class="ramInputConfirm" id="ramOverwriteConfirm">' +
    '<p class="ramInputConfirmText">本日のRAM実績はすでに保存されています。<br>この内容で上書きしますか？</p>' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="confirmRamOverwriteSave()">上書き保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="cancelRamOverwrite()">キャンセル</button>' +
    '</div></div>');
  let confirmEl = document.getElementById('ramOverwriteConfirm');
  if (confirmEl && confirmEl.scrollIntoView) confirmEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelRamOverwrite() {
  ramSavePending = null;
  let el = document.getElementById('ramOverwriteConfirm');
  if (el) el.remove();
}

function confirmRamOverwriteSave() {
  if (!ramSavePending) return;
  let collected = ramSavePending;
  ramSavePending = null;
  let el = document.getElementById('ramOverwriteConfirm');
  if (el) el.remove();
  executeRamSave(collected);
}

function saveTodayRevenue() {
  let collected = collectRamInputFromForm();
  let hasRevenue = Object.keys(collected.ramAccounts).length;
  let hasSales = collected.ramSales && Object.keys(collected.ramSales).length;
  if (!hasRevenue && !hasSales) {
    alert('保存する内容がありません。「本日収益」または「総売上」を入力してください。');
    return;
  }
  let dateKey = todayKey();
  if (hasSales && ramTotalSalesDecreaseConfirmNeeded(collected.ramSales, dateKey)) {
    showRamTotalSalesDecreaseConfirm(collected);
    return;
  }
  proceedRamSaveAfterSalesChecks(collected);
}

function openRamAddAccountForm() {
  modalTitle.textContent = 'RAM アカウント追加';
  modalContent.innerHTML =
    '<p class="help">ユーザー名・投資額・本日収益を入力して登録します。</p>' +
    '<label>ユーザー名</label><input id="ramNewUsername" type="text" placeholder="例：account1">' +
    '<label>投資額（USD）</label><input id="ramNewInvestment" type="number" step="1" min="0" placeholder="例：40000">' +
    '<label>本日収益（USD）</label><input id="ramNewTodayRev" type="number" step="0.01" min="0" placeholder="例：10">' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="registerRamAccount()">このアカウントを登録</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRamRevenueInput()">入力画面に戻る</button>' +
    '</div>';
  modalBg.style.display = 'flex';
  setTimeout(function () {
    let el = document.getElementById('ramNewUsername');
    if (el) el.focus();
  }, 80);
}

function registerRamAccount() {
  let username = (document.getElementById('ramNewUsername')?.value || '').trim().replace(/^@/, '');
  let investment = Number(document.getElementById('ramNewInvestment')?.value) || 0;
  let todayRevRaw = document.getElementById('ramNewTodayRev')?.value;
  if (!username) {
    alert('ユーザー名を入力してください。');
    return;
  }
  if (!investment) {
    alert('投資額を入力してください。');
    return;
  }
  if (todayRevRaw === '' || isNaN(Number(todayRevRaw))) {
    alert('本日収益を入力してください。');
    return;
  }
  if (!confirm('このアカウントを登録しますか？')) return;

  let id = 'm' + Date.now();
  members.push({
    id: id,
    parent: null,
    name: username,
    username: username,
    rank: 0,
    investment: investment,
    manualVolume: 0,
    open: true,
    bvMode: 'MANUAL',
    bvPrompted: false
  });
  if (typeof ensureRootAccounts === 'function') ensureRootAccounts();
  if (typeof rootAccountIds !== 'undefined' && !rootAccountIds.includes(id)) rootAccountIds.push(id);
  if (typeof rootId !== 'undefined') rootId = id;
  if (typeof focusId !== 'undefined') focusId = id;

  let todayRevenue = Number(todayRevRaw) || 0;
  if (typeof pdAddInvestmentRecord === 'function') {
    pdAddInvestmentRecord(id, 'ram', todayKey(), investment, 'initial');
  }
  let existing = getRevenueEntry(todayKey()) || {};
  let ramAccounts = existing.ramAccounts || {};
  ramAccounts[id] = { todayRevenue: todayRevenue, addInvestment: 0 };
  let totalRam = Object.keys(ramAccounts).reduce(function (s, key) {
    return s + (Number(ramAccounts[key].todayRevenue) || 0);
  }, 0);

  persistRamRevenueEntry(ramAccounts, totalRam);
  if (typeof markActivity === 'function') markActivity();
  if (typeof render === 'function') render();
  openRamRevenueInput();
  showToast('✅ アカウントを登録しました');
}

function ensureOrcaInputAccounts() {
  if (!Array.isArray(settings.orcaInputAccounts)) settings.orcaInputAccounts = [];
}

function getOrcaInputAccounts() {
  if (typeof getHomeDemoOrcaAccounts === 'function') {
    let demo = getHomeDemoOrcaAccounts();
    if (demo) return demo;
  }
  ensureOrcaInputAccounts();
  return settings.orcaInputAccounts.map(function (acc) {
    return {
      id: acc.id,
      username: (acc.username || acc.name || '未入力').replace(/^@/, ''),
      investment: Number(acc.investment) || 0
    };
  });
}

function normalizeOrcaAccountsMap(orcaAccounts) {
  if (!orcaAccounts || typeof orcaAccounts !== 'object') return {};
  let out = {};
  Object.keys(orcaAccounts).forEach(function (id) {
    let a = orcaAccounts[id];
    if (!a) return;
    let yesterdayAiProfit = normalizeRamRevenueNumber(a.yesterdayAiProfit);
    let todayAffiliateProfit = normalizeRamRevenueNumber(a.todayAffiliateProfit);
    if (yesterdayAiProfit === null && todayAffiliateProfit === null) {
      if (a.todayRevenue != null) {
        out[id] = { todayRevenue: Number(a.todayRevenue) };
      }
      return;
    }
    out[id] = {
      yesterdayAiProfit: yesterdayAiProfit || 0,
      todayAffiliateProfit: todayAffiliateProfit || 0
    };
  });
  return out;
}

function getTodayOrcaRevenueEntry() {
  let entry = getRevenueEntry(todayKey());
  if (!entry) return null;
  return Object.assign({}, entry, {
    orcaAccounts: normalizeOrcaAccountsMap(entry.orcaAccounts)
  });
}

function getOrcaAccountEntry(entry, accountId) {
  if (!entry || !entry.orcaAccounts) return null;
  let acc = entry.orcaAccounts[accountId];
  if (!acc) return null;
  if (acc.yesterdayAiProfit != null || acc.todayAffiliateProfit != null) {
    return {
      yesterdayAiProfit: Number(acc.yesterdayAiProfit) || 0,
      todayAffiliateProfit: Number(acc.todayAffiliateProfit) || 0
    };
  }
  if (acc.todayRevenue != null) {
    return { todayRevenue: Number(acc.todayRevenue) || 0 };
  }
  return null;
}

function calcOrcaAccountTotal(accEntry) {
  if (!accEntry) return 0;
  if (accEntry.todayRevenue != null) return Number(accEntry.todayRevenue) || 0;
  return Math.round(((accEntry.yesterdayAiProfit || 0) + (accEntry.todayAffiliateProfit || 0)) * 10000) / 10000;
}

function isOrcaAccountEntered(entry, accountId) {
  return getOrcaAccountEntry(entry, accountId) !== null;
}

function countOrcaEnteredAccounts(entry) {
  return getOrcaInputAccounts().filter(function (a) {
    return isOrcaAccountEntered(entry, a.id);
  }).length;
}

function isOrcaFullyEntered(entry) {
  let accounts = getOrcaInputAccounts();
  if (!accounts.length) return false;
  return accounts.every(function (a) { return isOrcaAccountEntered(entry, a.id); });
}

function hasOrcaDataSavedForToday(entry) {
  if (!entry || !entry.orcaAccounts) return false;
  return getOrcaInputAccounts().some(function (a) { return isOrcaAccountEntered(entry, a.id); });
}

function ensureCaryInputAccounts() {
  if (!Array.isArray(settings.caryInputAccounts)) settings.caryInputAccounts = [];
}

function getCaryInputAccounts() {
  if (typeof getHomeDemoCaryAccounts === 'function') {
    let demo = getHomeDemoCaryAccounts();
    if (demo) return demo;
  }
  ensureCaryInputAccounts();
  return settings.caryInputAccounts.map(function (acc) {
    return {
      id: acc.id,
      username: (acc.username || acc.name || '未入力').replace(/^@/, ''),
      investment: Number(acc.investment) || 0
    };
  });
}

function getCaryAccountEntry(entry, accountId) {
  if (!entry || !entry.caryAccounts) return null;
  let acc = entry.caryAccounts[accountId];
  if (!acc) return null;
  let todayReward = normalizeRamRevenueNumber(acc.todayReward);
  if (todayReward === null) return null;
  return { todayReward: todayReward };
}

function isCaryAccountEntered(entry, accountId) {
  return getCaryAccountEntry(entry, accountId) !== null;
}

function isCaryFullyEntered(entry) {
  let accounts = getCaryInputAccounts();
  if (!accounts.length) return false;
  return accounts.every(function (a) { return isCaryAccountEntered(entry, a.id); });
}

function orcaInputDiffersFromSaved(collected, existing) {
  let hasExistingRevenue = existing && hasOrcaDataSavedForToday(existing);
  let hasExistingSales = hasOrcaSalesSavedForToday();
  if (!hasExistingRevenue && !hasExistingSales) return false;
  let existingAccounts = hasExistingRevenue ? normalizeOrcaAccountsMap(existing.orcaAccounts) : {};
  let existingSales = getTodayRamSalesEntry();
  let accounts = getOrcaInputAccounts();

  return accounts.some(function (acc) {
    if (hasExistingRevenue) {
      let next = collected.orcaAccounts[acc.id];
      let prev = existingAccounts[acc.id];
      let nextYesterday = next ? normalizeRamRevenueNumber(next.yesterdayAiProfit) : null;
      let prevYesterday = prev ? prev.yesterdayAiProfit : null;
      let nextAff = next ? normalizeRamRevenueNumber(next.todayAffiliateProfit) : null;
      let prevAff = prev ? prev.todayAffiliateProfit : null;
      if (!next && !prev) {
        // continue to sales check
      } else if (!next || !prev) {
        return true;
      } else if (nextYesterday !== prevYesterday || nextAff !== prevAff) {
        return true;
      }
    }
    let nextTotalSales = collected.orcaSales && collected.orcaSales[acc.id];
    let prevSales = getRamAccountSalesEntry(existingSales, acc.id);
    if (prevSales && prevSales.projectKey && prevSales.projectKey !== 'orca') prevSales = null;
    let prevTotalSales = prevSales && prevSales.totalSales != null ? Number(prevSales.totalSales) : null;
    if (nextTotalSales != null) {
      if (prevTotalSales == null || nextTotalSales !== prevTotalSales) return true;
    } else if (prevTotalSales != null) {
      return true;
    }
    return false;
  });
}

function collectOrcaSalesFromForm() {
  let out = {};
  getOrcaInputAccounts().forEach(function (acc) {
    let el = document.getElementById('orcaTotalSales_' + acc.id);
    if (el && el.value !== '' && !isNaN(Number(el.value))) {
      out[acc.id] = Number(el.value);
    }
  });
  return out;
}

function orcaTotalSalesDecreaseConfirmNeeded(orcaSales, dateKey) {
  if (typeof pdGetOrcaPreviousTotalSales !== 'function') return false;
  return Object.keys(orcaSales || {}).some(function (accountId) {
    let prev = pdGetOrcaPreviousTotalSales(accountId, dateKey);
    if (prev == null) return false;
    return Number(orcaSales[accountId]) < prev;
  });
}

function hasOrcaSalesSavedForToday() {
  let entry = getTodayRamSalesEntry();
  if (!entry || !entry.accounts) return false;
  return getOrcaInputAccounts().some(function (a) {
    let ae = getRamAccountSalesEntry(entry, a.id);
    return ae && ae.projectKey === 'orca' && ae.totalSales != null && ae.totalSales !== '';
  });
}

function persistOrcaSalesFromTotals(orcaSales, dateKey) {
  if (!orcaSales || !dateKey) return false;
  if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
  let saveEntry = typeof pdSaveOrcaTotalSalesEntry === 'function'
    ? pdSaveOrcaTotalSalesEntry
    : (typeof pdSaveTotalSalesEntry === 'function'
      ? function (dk, id, val) { return pdSaveTotalSalesEntry(dk, id, val, 'orca'); }
      : null);
  if (!saveEntry) return false;
  let saved = false;
  Object.keys(orcaSales).forEach(function (accountId) {
    let result = saveEntry(dateKey, accountId, orcaSales[accountId]);
    if (result == null) return;
    saved = true;
    if (typeof pfRegisterManageDisplayFromEntry === 'function') {
      pfRegisterManageDisplayFromEntry('orca', accountId);
    }
  });
  if (saved && typeof renderSalesManage === 'function') {
    renderSalesManage();
  }
  return saved;
}

function formatOrcaTodaySalesPreview(accountId, totalSalesRaw) {
  if (totalSalesRaw === '' || totalSalesRaw == null || isNaN(Number(totalSalesRaw))) return '—';
  let dateKey = todayKey();
  if (typeof pdCalcOrcaTodaySalesFromTotal === 'function') {
    let calc = pdCalcOrcaTodaySalesFromTotal(accountId, dateKey, Number(totalSalesRaw));
    return money(calc.todaySales);
  }
  return '—';
}

function collectOrcaInputFromForm() {
  let accounts = getOrcaInputAccounts();
  let existingEntry = getTodayOrcaRevenueEntry() || { orcaAccounts: {} };
  let orcaAccounts = {};
  let totalOrca = 0;

  accounts.forEach(function (acc) {
    let yesterdayEl = document.getElementById('orcaYesterdayAi_' + acc.id);
    let affEl = document.getElementById('orcaTodayAff_' + acc.id);
    let prev = getOrcaAccountEntry(existingEntry, acc.id);
    let hasYesterday = yesterdayEl && yesterdayEl.value !== '' && !isNaN(Number(yesterdayEl.value));
    let hasAff = affEl && affEl.value !== '' && !isNaN(Number(affEl.value));
    if (hasYesterday && hasAff) {
      let entry = {
        yesterdayAiProfit: Number(yesterdayEl.value) || 0,
        todayAffiliateProfit: Number(affEl.value) || 0
      };
      orcaAccounts[acc.id] = entry;
      totalOrca += calcOrcaAccountTotal(entry);
    } else if (prev) {
      orcaAccounts[acc.id] = {
        yesterdayAiProfit: prev.yesterdayAiProfit,
        todayAffiliateProfit: prev.todayAffiliateProfit
      };
      totalOrca += calcOrcaAccountTotal(prev);
    }
  });

  return {
    orcaAccounts: orcaAccounts,
    totalOrca: Math.round(totalOrca * 100) / 100,
    orcaSales: collectOrcaSalesFromForm()
  };
}

function persistOrcaRevenueEntry(orcaAccounts, totalOrca) {
  let dateKey = todayKey();
  let existing = getRevenueEntry(dateKey) || {};
  let normalizedAccounts = normalizeOrcaAccountsMap(orcaAccounts);
  if (typeof pdMergeRevenueEntry === 'function') {
    pdMergeRevenueEntry(dateKey, {
      orcaAccounts: normalizedAccounts,
      ramAccounts: existing.ramAccounts || {},
      caryAccounts: existing.caryAccounts || {},
      ram: existing.ram,
      genesis: existing.genesis,
      cary: existing.cary
    });
    return;
  }
  saveRevenueEntry(dateKey, {
    total: (Number(existing.ram) || 0) + totalOrca + (Number(existing.genesis) || 0) + (Number(existing.cary) || 0),
    ram: Number(existing.ram) || 0,
    orca: totalOrca,
    genesis: Number(existing.genesis) || 0,
    cary: Number(existing.cary) || 0,
    ramAccounts: existing.ramAccounts || {},
    orcaAccounts: normalizedAccounts,
    savedAt: new Date().toLocaleString()
  });
}

function bindOrcaInputListeners() {
  getOrcaInputAccounts().forEach(function (acc) {
    ['orcaYesterdayAi_', 'orcaTodayAff_'].forEach(function (prefix) {
      let el = document.getElementById(prefix + acc.id);
      if (el) {
        el.addEventListener('input', function () {
          updateOrcaInputDerived(acc.id);
        });
      }
    });
    let salesEl = document.getElementById('orcaTotalSales_' + acc.id);
    if (salesEl) {
      salesEl.addEventListener('input', function () {
        updateOrcaSalesDerived(acc.id);
      });
    }
  });
}

function updateOrcaSalesDerived(accountId) {
  let previewEl = document.getElementById('orcaTodaySales_' + accountId);
  let salesEl = document.getElementById('orcaTotalSales_' + accountId);
  if (!previewEl) return;
  let raw = salesEl ? String(salesEl.value).trim() : '';
  if (raw === '' || isNaN(Number(raw))) {
    previewEl.textContent = '—';
    return;
  }
  previewEl.textContent = formatOrcaTodaySalesPreview(accountId, raw);
}

function updateOrcaInputDerived(accountId) {
  let yesterdayEl = document.getElementById('orcaYesterdayAi_' + accountId);
  let affEl = document.getElementById('orcaTodayAff_' + accountId);
  let totalEl = document.getElementById('orcaTotal_' + accountId);
  if (!totalEl) return;
  let yesterday = yesterdayEl && yesterdayEl.value !== '' && !isNaN(Number(yesterdayEl.value)) ? Number(yesterdayEl.value) || 0 : 0;
  let aff = affEl && affEl.value !== '' && !isNaN(Number(affEl.value)) ? Number(affEl.value) || 0 : 0;
  let hasAny = (yesterdayEl && yesterdayEl.value !== '') || (affEl && affEl.value !== '');
  totalEl.textContent = money(hasAny ? calcOrcaAccountTotal({ yesterdayAiProfit: yesterday, todayAffiliateProfit: aff }) : 0);
}

function renderOrcaInputFooter() {
  return '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="saveTodayOrcaRevenue()">保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openOrcaAddAccountForm()">アカウント追加</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openRevenueProjectSelect()">プロジェクト選択に戻る</button>' +
    '</div>';
}

function renderOrcaInputProgress(existing) {
  let total = getOrcaInputAccounts().length;
  let done = countOrcaEnteredAccounts(existing);
  let label = done + ' / ' + total;
  if (total > 0 && done === total) label += ' 完了';
  return '<div class="ramInputProgress">' +
    '<span class="ramInputProgressLabel">入力状況</span>' +
    '<span class="ramInputProgressVal' + (total > 0 && done === total ? ' isComplete' : '') + '">' + label + '</span>' +
    '</div>';
}

function renderOrcaInputAccountCard(acc, existing) {
  let accEntry = getOrcaAccountEntry(existing, acc.id);
  let yesterdayAi = accEntry ? accEntry.yesterdayAiProfit : '';
  let todayAff = accEntry ? accEntry.todayAffiliateProfit : '';
  let total = accEntry ? calcOrcaAccountTotal(accEntry) : 0;
  let dateKey = todayKey();
  let salesEntry = getTodayRamSalesEntry();
  let accSales = getRamAccountSalesEntry(salesEntry, acc.id);
  if (accSales && accSales.projectKey && accSales.projectKey !== 'orca') accSales = null;
  let totalSalesVal = accSales && accSales.totalSales != null ? accSales.totalSales : '';
  let prevTotal = typeof pdGetOrcaPreviousTotalSales === 'function'
    ? pdGetOrcaPreviousTotalSales(acc.id, dateKey)
    : null;
  let todaySalesPreview = totalSalesVal !== ''
    ? formatOrcaTodaySalesPreview(acc.id, totalSalesVal)
    : (accSales && accSales.todaySales != null ? money(accSales.todaySales) : '—');
  let salesHint = prevTotal != null
    ? '前回 ' + money(prevTotal)
    : '初回は本日売上0として登録';
  return '<section class="ramInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' + renderInputStatusBadge(isOrcaAccountEntered(existing, acc.id)) + '</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">ユーザー名</span><span class="ramInputVal">' + escapeHtml(acc.username) + '</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">投資額</span><span class="ramInputVal">' + num(acc.investment) + 'ドル</span></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">昨日AI利益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="orcaYesterdayAi_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + yesterdayAi + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge">毎日入力</span></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">本日AF収益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="orcaTodayAff_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + todayAff + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge">毎日入力</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日のORCA合計</span><span class="ramInputVal ramInputVal--gold" id="orcaTotal_' + acc.id + '">' + money(total) + '</span></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">総売上</span><div class="ramInputField"><input type="number" step="0.01" id="orcaTotalSales_' + acc.id + '" class="ramInputOptional" inputmode="decimal" placeholder="0" value="' + totalSalesVal + '"><span class="ramInputUnit">ドル</span><span class="ramInputHint">' + salesHint + '</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日売上</span><span class="ramInputVal" id="orcaTodaySales_' + acc.id + '">' + todaySalesPreview + '</span></div>' +
    '</div></section>';
}

function openOrcaRevenueInput() {
  orcaSavePending = null;
  let accounts = getOrcaInputAccounts();
  modalTitle.textContent = 'ORCA 実績入力';

  if (!accounts.length) {
    modalContent.innerHTML =
      '<div class="lineBox"><b>アカウントがありません</b><p class="help">「アカウント追加」からORCAアカウントを登録してください。</p></div>' +
      renderOrcaInputFooter();
    modalBg.style.display = 'flex';
    return;
  }

  let existing = getTodayOrcaRevenueEntry();
  let cards = accounts.map(function (acc) {
    return renderOrcaInputAccountCard(acc, existing);
  }).join('');

  modalContent.innerHTML =
    renderOrcaInputProgress(existing) +
    '<p class="help ramInputLead">毎日入力するのは「昨日AI利益」と「本日AF収益」です。合計は自動で「本日のORCA合計」として全画面に反映されます。</p>' +
    '<div class="ramInputList">' + cards + '</div>' +
    renderOrcaInputFooter();

  modalBg.style.display = 'flex';
  bindOrcaInputListeners();

  setTimeout(function () {
    let focusEl = accounts.map(function (acc) {
      return document.getElementById('orcaYesterdayAi_' + acc.id);
    }).find(function (el) {
      return el && el.value === '';
    });
    if (focusEl) focusEl.focus();
  }, 80);
}

function executeOrcaSave(collected) {
  if (collected.orcaSales && Object.keys(collected.orcaSales).length) {
    persistOrcaSalesFromTotals(collected.orcaSales, todayKey());
  }
  if (collected.orcaAccounts && Object.keys(collected.orcaAccounts).length) {
    persistOrcaRevenueEntry(collected.orcaAccounts, collected.totalOrca);
  }
  if (typeof render === 'function') render();
  refreshHomeAfterRevenueSave();
  if (typeof showPage === 'function') showPage('home');
  if (typeof closeModal === 'function') closeModal();
  showToast('✅ 保存しました');
}

function proceedOrcaSaveAfterSalesChecks(collected) {
  let existing = getTodayOrcaRevenueEntry();
  if ((hasOrcaDataSavedForToday(existing) || hasOrcaSalesSavedForToday()) &&
    orcaInputDiffersFromSaved(collected, existing)) {
    showOrcaOverwriteConfirm(collected);
    return;
  }
  executeOrcaSave(collected);
}

function proceedOrcaSaveAfterDecreaseConfirm(collected) {
  proceedOrcaSaveAfterSalesChecks(collected);
}

function showOrcaTotalSalesDecreaseConfirm(collected) {
  orcaSalesDecreasePending = collected;
  let existing = document.getElementById('orcaTotalSalesDecreaseConfirm');
  if (existing) existing.remove();
  modalContent.insertAdjacentHTML('beforeend',
    '<div class="ramInputConfirm" id="orcaTotalSalesDecreaseConfirm">' +
    '<p class="ramInputConfirmText">前回より総売上が減少しています。入力内容に間違いがなければ『登録』を押してください。</p>' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="confirmOrcaTotalSalesDecreaseSave()">登録</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="cancelOrcaTotalSalesDecrease()">キャンセル</button>' +
    '</div></div>');
  let confirmEl = document.getElementById('orcaTotalSalesDecreaseConfirm');
  if (confirmEl && confirmEl.scrollIntoView) confirmEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelOrcaTotalSalesDecrease() {
  orcaSalesDecreasePending = null;
  let el = document.getElementById('orcaTotalSalesDecreaseConfirm');
  if (el) el.remove();
}

function confirmOrcaTotalSalesDecreaseSave() {
  if (!orcaSalesDecreasePending) return;
  let collected = orcaSalesDecreasePending;
  orcaSalesDecreasePending = null;
  let el = document.getElementById('orcaTotalSalesDecreaseConfirm');
  if (el) el.remove();
  proceedOrcaSaveAfterDecreaseConfirm(collected);
}

function showOrcaOverwriteConfirm(collected) {
  orcaSavePending = collected;
  let existing = document.getElementById('orcaOverwriteConfirm');
  if (existing) existing.remove();
  modalContent.insertAdjacentHTML('beforeend',
    '<div class="ramInputConfirm" id="orcaOverwriteConfirm">' +
    '<p class="ramInputConfirmText">本日のORCA実績はすでに保存されています。<br>この内容で上書きしますか？</p>' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="confirmOrcaOverwriteSave()">上書き保存</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="cancelOrcaOverwrite()">キャンセル</button>' +
    '</div></div>');
  let confirmEl = document.getElementById('orcaOverwriteConfirm');
  if (confirmEl && confirmEl.scrollIntoView) confirmEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cancelOrcaOverwrite() {
  orcaSavePending = null;
  let el = document.getElementById('orcaOverwriteConfirm');
  if (el) el.remove();
}

function confirmOrcaOverwriteSave() {
  if (!orcaSavePending) return;
  let collected = orcaSavePending;
  orcaSavePending = null;
  let el = document.getElementById('orcaOverwriteConfirm');
  if (el) el.remove();
  executeOrcaSave(collected);
}

function saveTodayOrcaRevenue() {
  let collected = collectOrcaInputFromForm();
  let hasRevenue = Object.keys(collected.orcaAccounts).length;
  let hasSales = collected.orcaSales && Object.keys(collected.orcaSales).length;
  if (!hasRevenue && !hasSales) {
    alert('保存する内容がありません。「昨日AI利益」と「本日AF収益」、または「総売上」を入力してください。');
    return;
  }
  let dateKey = todayKey();
  if (hasSales && orcaTotalSalesDecreaseConfirmNeeded(collected.orcaSales, dateKey)) {
    showOrcaTotalSalesDecreaseConfirm(collected);
    return;
  }
  proceedOrcaSaveAfterSalesChecks(collected);
}

function openOrcaAddAccountForm() {
  modalTitle.textContent = 'ORCA アカウント追加';
  modalContent.innerHTML =
    '<p class="help">ユーザー名・投資額・昨日AI利益・本日AF収益を入力して登録します。</p>' +
    '<label>ユーザー名</label><input id="orcaNewUsername" type="text" placeholder="例：account1">' +
    '<label>投資額（USD）</label><input id="orcaNewInvestment" type="number" step="1" min="0" placeholder="例：5000">' +
    '<label>昨日AI利益（USD）</label><input id="orcaNewYesterdayAi" type="number" step="0.01" min="0" placeholder="例：8">' +
    '<label>本日AF収益（USD）</label><input id="orcaNewTodayAff" type="number" step="0.01" min="0" placeholder="例：2">' +
    '<div class="ramInputFooterStack">' +
    '<button type="button" class="ramInputBtnSave" onclick="registerOrcaAccount()">このアカウントを登録</button>' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="openOrcaRevenueInput()">入力画面に戻る</button>' +
    '</div>';
  modalBg.style.display = 'flex';
  setTimeout(function () {
    let el = document.getElementById('orcaNewUsername');
    if (el) el.focus();
  }, 80);
}

function registerOrcaAccount() {
  let username = (document.getElementById('orcaNewUsername')?.value || '').trim().replace(/^@/, '');
  let investment = Number(document.getElementById('orcaNewInvestment')?.value) || 0;
  let yesterdayRaw = document.getElementById('orcaNewYesterdayAi')?.value;
  let affRaw = document.getElementById('orcaNewTodayAff')?.value;
  if (!username) {
    alert('ユーザー名を入力してください。');
    return;
  }
  if (!investment) {
    alert('投資額を入力してください。');
    return;
  }
  if (yesterdayRaw === '' || isNaN(Number(yesterdayRaw))) {
    alert('昨日AI利益を入力してください。');
    return;
  }
  if (affRaw === '' || isNaN(Number(affRaw))) {
    alert('本日AF収益を入力してください。');
    return;
  }
  if (!confirm('このアカウントを登録しますか？')) return;

  let id = 'orca_' + Date.now();
  ensureOrcaInputAccounts();
  settings.orcaInputAccounts.push({
    id: id,
    username: username,
    name: username,
    investment: investment
  });

  let yesterdayAiProfit = Number(yesterdayRaw) || 0;
  let todayAffiliateProfit = Number(affRaw) || 0;
  let existing = getRevenueEntry(todayKey()) || {};
  let orcaAccounts = existing.orcaAccounts || {};
  orcaAccounts[id] = { yesterdayAiProfit: yesterdayAiProfit, todayAffiliateProfit: todayAffiliateProfit };
  let totalOrca = 0;
  Object.keys(orcaAccounts).forEach(function (key) {
    let ae = orcaAccounts[key];
    totalOrca += calcOrcaAccountTotal({
      yesterdayAiProfit: Number(ae.yesterdayAiProfit) || 0,
      todayAffiliateProfit: Number(ae.todayAffiliateProfit) || 0
    });
  });

  persistOrcaRevenueEntry(orcaAccounts, Math.round(totalOrca * 100) / 100);
  persistHubSettings();
  if (typeof markActivity === 'function') markActivity();
  if (typeof render === 'function') render();
  openOrcaRevenueInput();
  showToast('✅ アカウントを登録しました');
}

function openPortfolioNav() {
  showPage('portfolio');
}

function syncMobileNav(page) {
  let nav = document.getElementById('mobileBottomNav');
  if (!nav) return;
  let map = { home: 'home', ram: 'ram', orgSelect: 'ram', orcaOrg: 'ram', orcaAccountManage: 'ram', portfolio: 'portfolio', revenueManage: 'portfolio', salesManage: 'portfolio', settings: 'settings', accountManage: 'ram' };
  let active = map[page] || '';
  nav.querySelectorAll('[data-nav]').forEach(function (btn) {
    btn.classList.toggle('isActive', btn.getAttribute('data-nav') === active);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  let avatar = document.querySelector('.ochanAvatar');
  if (avatar) {
    avatar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showPage('ochanRoom');
      }
    });
  }
});
