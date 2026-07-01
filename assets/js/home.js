/* OUKEI HUB Home UI — Ver1.9.5 */
let homeCalView = { y: new Date().getFullYear(), m: new Date().getMonth() };
let ramSavePending = null;
let orcaSavePending = null;

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
  let list = getEnabledHomeProjects().map(function (p) {
    return { key: p.key, name: p.name, cls: p.dot || p.key };
  });
  (settings.customProjects || []).forEach(function (p) {
    let key = String(p.key || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || list.some(function (x) { return x.key === key; })) return;
    list.push({ key: key, name: p.name || key, cls: 'custom' });
  });
  return list;
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

function renderHomeProjIcon(projectKey, extraClass) {
  let cls = 'homeProjIcon homeProjIcon--' + projectKey;
  if (extraClass) cls += ' ' + extraClass;
  return '<span class="' + cls + '" aria-hidden="true"></span>';
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

function getRamInputAccounts() {
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

function ramInputDiffersFromSaved(collected, existing) {
  if (!existing || !hasRamDataSavedForToday(existing)) return false;
  let existingAccounts = normalizeRamAccountsMap(existing.ramAccounts);
  let accounts = getRamInputAccounts();

  return accounts.some(function (acc) {
    let next = collected.ramAccounts[acc.id];
    let prev = existingAccounts[acc.id];
    let nextRev = next && typeof next.todayRevenue === 'number' ? Number(next.todayRevenue) : NaN;
    let prevRev = prev && typeof prev.todayRevenue === 'number' ? Number(prev.todayRevenue) : NaN;
    let nextAdd = next ? Number(next.addInvestment) || 0 : 0;
    let prevAdd = typeof pdGetAdditionalInvestmentForDate === 'function'
      ? pdGetAdditionalInvestmentForDate(acc.id, 'ram', todayKey())
      : (prev ? Number(prev.addInvestment) || 0 : 0);
    if (isNaN(nextRev) && isNaN(prevRev)) return false;
    if (isNaN(nextRev) !== isNaN(prevRev)) return true;
    if (nextRev !== prevRev) return true;
    return nextAdd !== prevAdd;
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

  return { ramAccounts: ramAccounts, totalRam: totalRam };
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
    let revEl = document.getElementById('ramTodayRev_' + acc.id);
    if (addEl) {
      addEl.addEventListener('input', function () {
        updateRamInputDerived(acc.id);
      });
    }
  });
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

function renderRamInputAccountCard(acc, existing) {
  let accEntry = getRamAccountEntry(existing, acc.id);
  let dateKey = todayKey();
  let addInv = typeof pdGetAdditionalInvestmentForDate === 'function'
    ? pdGetAdditionalInvestmentForDate(acc.id, 'ram', dateKey)
    : (accEntry && accEntry.addInvestment > 0 ? accEntry.addInvestment : '');
  if (addInv === 0) addInv = '';
  let todayRev = accEntry ? accEntry.todayRevenue : '';
  let effectiveInv = typeof pdGetOperatingUsdAsOf === 'function'
    ? pdGetOperatingUsdAsOf(acc.id, 'ram', dateKey)
    : calcRamEffectiveInvestment(acc.investment, addInv);
  return '<section class="ramInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' + renderRamAccountStatusBadge(existing, acc.id) + '</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">ユーザー名</span><span class="ramInputVal">' + escapeHtml(acc.username) + '</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">現在運用額</span><span class="ramInputVal" id="ramInv_' + acc.id + '">' + num(effectiveInv) + 'ドル</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">日利</span><span class="ramInputVal" id="ramRate_' + acc.id + '">' + formatDailyRateLabel(effectiveInv) + '</span></div>' +
    '<div class="ramInputRow"><span class="ramInputLabel">追加投資額</span><div class="ramInputField"><input type="number" step="1" min="0" id="ramAddInv_' + acc.id + '" class="ramInputOptional" placeholder="0" value="' + addInv + '"><span class="ramInputUnit">ドル</span><span class="ramInputHint">追加投資があった時のみ入力</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">運用</span><span class="ramInputVal ramInputVal--gold" id="ramProfit_' + acc.id + '">' + money(calcRamOperatingProfit(effectiveInv)) + '</span></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">本日収益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="ramTodayRev_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + todayRev + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge">毎日入力</span></div></div>' +
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
  let n = Math.max(projects.length, 1);
  el.style.setProperty('--proj-cols', n);
  el.setAttribute('data-count', n);
  let amounts = projects.map(function (p) { return getAmount(p); });
  let total = typeof totalHint === 'number' ? totalHint : amounts.reduce(function (s, v) { return s + v; }, 0);
  el.innerHTML = projects.map(function (p, i) {
    let amt = amounts[i];
    let pct = total > 0 ? Math.round((amt / total) * 1000) / 10 : 0;
    return '<div class="homeProjCard homeProjCard--' + p.dot + '">' +
      '<div class="homeProjCardTop"><span class="homeProjCardDot"></span><span class="homeProjCardName">' + p.name + '</span></div>' +
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

function sumMonthRevenueLog(y, m) {
  ensureRevenueLog();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let out = { total: 0, hasLog: false };
  for (let d = 1; d <= daysInMonth; d++) {
    let entry = getRevenueEntry(revenueDateKey(y, m, d));
    if (!entry) continue;
    out.hasLog = true;
    out.total += entry.total || 0;
    Object.keys(entry).forEach(function (k) {
      if (k === 'total' || k === 'savedAt') return;
      out[k] = (out[k] || 0) + (Number(entry[k]) || 0);
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

function formatCalDayAmount(entry) {
  if (!entry) return typeof pdEmptyMark === 'function' ? pdEmptyMark() : '−';
  return money(entry.total || 0);
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
    cells += '<button type="button" class="' + cls.join(' ') + '" onclick="showRevenueDayDetail(\'' + key + '\')" aria-label="' + (m + 1) + '月' + d + '日 ' + formatCalDayAmount(entry) + '">' +
      '<span class="homeCalDayNum">' + d + '</span>' +
      '<span class="' + amtCls + '">' + formatCalDayAmount(entry) + '</span></button>';
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

var HOME_PROJECT_REGISTRY = [
  { key: 'ram', name: 'RAM', cls: 'ram' },
  { key: 'orca', name: 'ORCA', cls: 'orca' },
  { key: 'genesis', name: 'Genesis', cls: 'genesis' },
  { key: 'cary', name: 'Cary Pact', cls: 'cary' }
];

function getHomeProjectRegistry() {
  let list = HOME_PROJECT_REGISTRY.slice();
  (settings.customProjects || []).forEach(function (p) {
    let key = String(p.key || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || list.some(function (x) { return x.key === key; })) return;
    list.push({ key: key, name: p.name || key, cls: 'custom' });
  });
  return list;
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

  if (ctx.monthLog.hasLog) {
    Object.keys(ctx.monthLog).forEach(function (k) {
      if (k === 'total' || k === 'hasLog') return;
      if (registry.some(function (p) { return p.key === k; })) return;
      if ((ctx.monthLog[k] || 0) <= 0) return;
      registry.push({
        key: k,
        name: k.charAt(0).toUpperCase() + k.slice(1),
        cls: 'custom'
      });
    });
  }

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
    tip.innerHTML =
      '<span class="homeMonthlyChartTipDate">' + monthNum + '/' + p.d + '</span>' +
      '<span class="homeMonthlyChartTipAmt">' + money(p.val) + '</span>';
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

  container.querySelectorAll('.homeMonthlyChartHit').forEach(function (node) {
    node.addEventListener('mouseenter', function () {
      showTip(node, points[Number(node.getAttribute('data-idx'))]);
    });
    node.addEventListener('mouseleave', hideTip);
  });

  let todayIdx = points.findIndex(function (p) { return p.isToday; });
  if (todayIdx >= 0) {
    let todayHit = container.querySelector('.homeMonthlyChartHit[data-idx="' + todayIdx + '"]');
    if (todayHit) showTip(todayHit, points[todayIdx]);
  }
}

function monthlyChartPlotX(index, daysInMonth, chartLeft, plotPadLeft, plotW) {
  if (daysInMonth <= 1) return chartLeft + plotPadLeft + plotW / 2;
  return chartLeft + plotPadLeft + (index / (daysInMonth - 1)) * plotW;
}

function renderHomeMonthlyLineChart() {
  let el = document.getElementById('homeMonthlyLineChart');
  if (!el) return;
  ensureRevenueLog();
  let y = homeCalView.y;
  let m = homeCalView.m;
  let monthNum = m + 1;
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let today = getHomeReferenceDate();
  let vals = [];
  let dataMax = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    let entry = getRevenueEntry(revenueDateKey(y, m, d));
    let val = entry ? (entry.total || 0) : 0;
    vals.push({ d: d, val: val, isToday: today.getFullYear() === y && today.getMonth() === m && today.getDate() === d });
    if (val > dataMax) dataMax = val;
  }

  let axisMax = niceChartAxisMax(dataMax);
  let ticks = chartAxisTicks(axisMax, 5);
  let xMarks = chartXLabels(daysInMonth, monthNum);

  let w = 400;
  let h = 190;
  let yAxisW = 30;
  let padRight = 24;
  let padBottom = 16;
  let padY = 8;
  let plotPadLeft = 4;
  let plotPadRight = 14;
  let chartLeft = yAxisW;
  let innerW = w - chartLeft - padRight;
  let plotW = innerW - plotPadLeft - plotPadRight;
  let innerH = h - padY - padBottom;
  let plotRight = chartLeft + plotPadLeft + plotW;

  let gridSvg = ticks.map(function (t) {
    let yPos = padY + innerH - (t / axisMax) * innerH;
    return '<line class="homeMonthlyChartGrid" x1="' + chartLeft + '" y1="' + yPos.toFixed(1) + '" x2="' + plotRight.toFixed(1) + '" y2="' + yPos.toFixed(1) + '"></line>' +
      '<text class="homeMonthlyChartYLabel" x="' + (chartLeft - 4) + '" y="' + (yPos + 3.5).toFixed(1) + '" text-anchor="end">' + formatAxisDollar(t) + '</text>';
  }).join('');

  let xSvg = xMarks.map(function (mark) {
    let x = monthlyChartPlotX(mark.d - 1, daysInMonth, chartLeft, plotPadLeft, plotW);
    let anchor = mark.d === 1 ? 'start' : (mark.d === daysInMonth ? 'end' : 'middle');
    return '<text class="homeMonthlyChartXLabel" x="' + x.toFixed(1) + '" y="' + (h - 4) + '" text-anchor="' + anchor + '">' + mark.label + '</text>';
  }).join('');

  let pts = vals.map(function (v, i) {
    let x = monthlyChartPlotX(i, daysInMonth, chartLeft, plotPadLeft, plotW);
    let yPos = padY + innerH - (v.val / axisMax) * innerH;
    return x.toFixed(1) + ',' + yPos.toFixed(1);
  }).join(' ');

  let fillPts = pts + ' ' + plotRight.toFixed(1) + ',' + (padY + innerH).toFixed(1) + ' ' + (chartLeft + plotPadLeft).toFixed(1) + ',' + (padY + innerH).toFixed(1);

  let dots = vals.map(function (v, i) {
    let x = monthlyChartPlotX(i, daysInMonth, chartLeft, plotPadLeft, plotW);
    let yPos = padY + innerH - (v.val / axisMax) * innerH;
    let xf = x.toFixed(1);
    let yf = yPos.toFixed(1);
    let dotR = v.isToday ? 3 : 1.5;
    let cls = v.isToday ? 'homeMonthlyChartDot isToday' : 'homeMonthlyChartDot';
    return '<g class="homeMonthlyChartPoint">' +
      '<circle class="homeMonthlyChartHit" data-idx="' + i + '" cx="' + xf + '" cy="' + yf + '" r="8"></circle>' +
      '<circle class="' + cls + '" cx="' + xf + '" cy="' + yf + '" r="' + dotR + '"></circle></g>';
  }).join('');

  el.innerHTML =
    '<div class="homeMonthlyChartInner">' +
    '<div class="homeMonthlyChartTip"></div>' +
    '<svg class="homeMonthlyChartSvg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs><linearGradient id="homeMonthlyLineGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="rgba(96,165,250,.24)"/>' +
    '<stop offset="100%" stop-color="rgba(96,165,250,0)"/>' +
    '</linearGradient></defs>' +
    gridSvg + xSvg +
    '<polyline class="homeMonthlyChartFill" points="' + fillPts + '"></polyline>' +
    '<polyline class="homeMonthlyChartLine" points="' + pts + '"></polyline>' +
    dots +
    '</svg></div>';

  bindMonthlyChartTooltip(el, vals, monthNum);
}

function renderHomeMonthlyProjGrid(sAll) {
  let el = document.getElementById('homeMonthlyProjGrid');
  if (!el) return;
  let ctx = getHomeMonthlyRevenueContext(sAll);
  if (!ctx) return;

  let rows = getHomeMonthlyProjectRows(ctx);
  let cols = Math.max(rows.length, 1);
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
      '<span class="homeMonthlyProjCardName"><span class="homeMonthlyProjDot homeProjIcon homeProjIcon--' + p.cls + '"></span>' + p.name + '</span>' +
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

function getHomeTodayProjectRows(ctx) {
  if (!ctx) return [];
  let registry = getHomeProjectRegistry();
  let entry = ctx.todayEntry;

  if (entry) {
    Object.keys(entry).forEach(function (k) {
      if (k === 'total' || k === 'savedAt') return;
      if (registry.some(function (p) { return p.key === k; })) return;
      if ((entry[k] || 0) <= 0) return;
      registry.push({
        key: k,
        name: k.charAt(0).toUpperCase() + k.slice(1),
        cls: 'custom'
      });
    });
  }

  return registry.map(function (p) {
    let amt = entry ? (entry[p.key] || 0) : null;
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
  let cols = Math.max(rows.length, 1);
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
      '<span class="homeTodayProjCardName"><span class="homeTodayProjMark homeProjIcon homeProjIcon--' + p.cls + '"></span>' + p.name + '</span>' +
      '<span class="homeTodayProjCardPct">' + row.pct + '%</span></div>' +
      '<span class="homeTodayProjCardAmt">' + money(row.amt) + '</span>' +
      '<div class="homeTodayProjCardBar"><div class="homeTodayProjCardBarFill" style="width:' + row.pct + '%"></div></div>' +
      '</div>';
  }).join('');
}

function updateHomeTodaySection(sAll) {
  if (!sAll && typeof allOrgSummary === 'function') sAll = allOrgSummary();
  if (!sAll) return;

  let todayEntry = getRevenueEntry(todayKey());
  let yesterdayEntry = getRevenueEntry(yesterdayKey());
  let todayTotal = todayEntry ? (todayEntry.total || 0) : null;
  let yesterdayTotal = yesterdayEntry ? (yesterdayEntry.total || 0) : null;

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
    let ramDetail = '';
    if (entry.ramAccounts && typeof getRamInputAccounts === 'function') {
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
      '<div class="lineBox"><b>合計</b><div class="amount">' + money(entry.total) + '</div><div class="help">' + yen(entry.total) + '</div></div>' +
      '<div class="homeSummaryList" style="margin-top:10px">' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot ram"></span>RAM</span><b>' + money(entry.ram || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot orca"></span>ORCA</span><b>' + money(entry.orca || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot genesis"></span>Genesis</span><b>' + money(entry.genesis || 0) + '</b></div>' +
      '<div class="homeSummaryRow"><span><span class="homeProjDot cary"></span>Cary Pact</span><b>' + money(entry.cary || 0) + '</b></div>' +
      '</div>' +
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
    '<p class="help ramInputLead">毎日入力するのは「本日収益」だけです。それ以外は自動表示されます。</p>' +
    '<div class="ramInputList">' + cards + '</div>' +
    renderRamInputFooter();

  modalBg.style.display = 'flex';
  bindRamInputListeners();

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
  persistRamRevenueEntry(collected.ramAccounts, collected.totalRam);
  if (typeof render === 'function') render();
  refreshHomeAfterRevenueSave();
  if (typeof showPage === 'function') showPage('home');
  if (typeof closeModal === 'function') closeModal();
  showToast('✅ 保存しました');
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
  if (!Object.keys(collected.ramAccounts).length) {
    alert('保存する内容がありません。「本日収益」を入力してください。');
    return;
  }
  let existing = getTodayRamRevenueEntry();
  if (hasRamDataSavedForToday(existing) && ramInputDiffersFromSaved(collected, existing)) {
    showRamOverwriteConfirm(collected);
    return;
  }
  executeRamSave(collected);
}

function openRamAddAccountForm() {
  modalTitle.textContent = 'RAM アカウント追加';
  modalContent.innerHTML =
    '<p class="help">ユーザー名・投資額・本日収益を入力して登録します。</p>' +
    '<label>ユーザー名</label><input id="ramNewUsername" type="text" placeholder="例：kai1">' +
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
  return Math.round(((accEntry.yesterdayAiProfit || 0) + (accEntry.todayAffiliateProfit || 0)) * 100) / 100;
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
  if (!existing || !hasOrcaDataSavedForToday(existing)) return false;
  let existingAccounts = normalizeOrcaAccountsMap(existing.orcaAccounts);
  let accounts = getOrcaInputAccounts();

  return accounts.some(function (acc) {
    let next = collected.orcaAccounts[acc.id];
    let prev = existingAccounts[acc.id];
    let nextYesterday = next ? normalizeRamRevenueNumber(next.yesterdayAiProfit) : null;
    let prevYesterday = prev ? prev.yesterdayAiProfit : null;
    let nextAff = next ? normalizeRamRevenueNumber(next.todayAffiliateProfit) : null;
    let prevAff = prev ? prev.todayAffiliateProfit : null;
    if (!next && !prev) return false;
    if (!next || !prev) return true;
    return nextYesterday !== prevYesterday || nextAff !== prevAff;
  });
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

  return { orcaAccounts: orcaAccounts, totalOrca: Math.round(totalOrca * 100) / 100 };
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
  });
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
  return '<section class="ramInputAccount" data-acc="' + acc.id + '">' +
    '<div class="ramInputAccountHead">' + renderInputStatusBadge(isOrcaAccountEntered(existing, acc.id)) + '</div>' +
    '<div class="ramInputRows">' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">ユーザー名</span><span class="ramInputVal">' + escapeHtml(acc.username) + '</span></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">投資額</span><span class="ramInputVal">' + num(acc.investment) + 'ドル</span></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">昨日AI利益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="orcaYesterdayAi_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + yesterdayAi + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge">毎日入力</span></div></div>' +
    '<div class="ramInputRow ramInputRow--main"><span class="ramInputLabel ramInputLabel--hero">本日AF収益</span><div class="ramInputField ramInputField--hero"><input type="number" step="0.01" min="0" id="orcaTodayAff_' + acc.id + '" class="ramInputMain" inputmode="decimal" placeholder="0" value="' + todayAff + '"><span class="ramInputUnit">ドル</span><span class="ramInputBadge">毎日入力</span></div></div>' +
    '<div class="ramInputRow ramInputRow--readonly"><span class="ramInputLabel">本日のORCA合計</span><span class="ramInputVal ramInputVal--gold" id="orcaTotal_' + acc.id + '">' + money(total) + '</span></div>' +
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
  persistOrcaRevenueEntry(collected.orcaAccounts, collected.totalOrca);
  persistHubSettings();
  if (typeof render === 'function') render();
  refreshHomeAfterRevenueSave();
  if (typeof showPage === 'function') showPage('home');
  if (typeof closeModal === 'function') closeModal();
  showToast('✅ 保存しました');
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
  if (!Object.keys(collected.orcaAccounts).length) {
    alert('保存する内容がありません。「昨日AI利益」と「本日AF収益」を入力してください。');
    return;
  }
  let existing = getTodayOrcaRevenueEntry();
  if (hasOrcaDataSavedForToday(existing) && orcaInputDiffersFromSaved(collected, existing)) {
    showOrcaOverwriteConfirm(collected);
    return;
  }
  executeOrcaSave(collected);
}

function openOrcaAddAccountForm() {
  modalTitle.textContent = 'ORCA アカウント追加';
  modalContent.innerHTML =
    '<p class="help">ユーザー名・投資額・昨日AI利益・本日AF収益を入力して登録します。</p>' +
    '<label>ユーザー名</label><input id="orcaNewUsername" type="text" placeholder="例：kai1">' +
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
  let map = { home: 'home', ram: 'ram', portfolio: 'portfolio', revenueManage: 'portfolio', salesManage: 'portfolio', settings: 'settings', accountManage: 'ram' };
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
