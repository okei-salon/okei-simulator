/* OUKEI HUB Manage Entry UI — Ver1.9.3 */

var pfEntryModalFooterDefault = '';
var pfOriginalCloseModal = null;
var pfManageContextMenuEl = null;
var pfManageContextPressTimer = null;
var pfManageContextMeta = null;
var pfManageContextHandlers = null;
var pfDisplayHideConfirmPending = null;

var PF_SERIES_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

function pfInitEntryModalHooks() {
  if (typeof closeModal === 'function' && !pfOriginalCloseModal) {
    pfOriginalCloseModal = closeModal;
    window.closeModal = function () {
      pfRestoreModalFooter();
      pfOriginalCloseModal();
    };
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pfInitEntryModalHooks);
  } else {
    pfInitEntryModalHooks();
  }
}

function pfEscapeAttr(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pfGetSeriesRootId(accountId, parentMap) {
  let cur = accountId;
  let guard = 0;
  while (parentMap[cur] && guard < 64) {
    cur = parentMap[cur];
    guard++;
  }
  return cur;
}

function pfAnnotateAccountSeries(accounts, projectKey) {
  if (!accounts || !accounts.length) return [];
  let parentMap = {};
  accounts.forEach(function (a) {
    parentMap[a.id] = a.parentId || null;
  });
  let rootOrder = [];
  accounts.forEach(function (a) {
    let root = pfGetSeriesRootId(a.id, parentMap);
    if (rootOrder.indexOf(root) < 0) rootOrder.push(root);
  });
  let rootToSeries = {};
  rootOrder.forEach(function (root, i) {
    rootToSeries[root] = i;
  });
  return accounts.map(function (a) {
    if (projectKey && typeof aimGetOrgMemberSeriesIndex === 'function') {
      let stored = aimGetOrgMemberSeriesIndex(projectKey, a.id);
      if (stored != null) {
        return Object.assign({}, a, {
          seriesIndex: stored,
          seriesRootId: typeof aimGetOrgMemberSeriesRootId === 'function'
            ? aimGetOrgMemberSeriesRootId(projectKey, a.id)
            : pfGetSeriesRootId(a.id, parentMap)
        });
      }
    }
    let root = pfGetSeriesRootId(a.id, parentMap);
    return Object.assign({}, a, {
      seriesIndex: rootToSeries[root] || 0,
      seriesRootId: root
    });
  });
}

function pfNormalizeRamSeriesColors(projectKey, accounts) {
  if (projectKey !== 'ram' || !accounts || !accounts.length) return accounts;
  return accounts.map(function (a) {
    if (a.seriesIndex != null && typeof aimGetOrgMemberSeriesIndex === 'function' &&
        aimGetOrgMemberSeriesIndex(projectKey, a.id) != null) {
      return a;
    }
    let label = String(a.name || '').normalize ? String(a.name).normalize('NFKC') : String(a.name || '');
    if (/甲斐|kai/i.test(label)) {
      return Object.assign({}, a, { seriesIndex: 0 });
    }
    return a;
  });
}

function pfRenderSeriesMarker(seriesIndex) {
  let color = PF_SERIES_COLORS[(seriesIndex || 0) % PF_SERIES_COLORS.length];
  return '<span class="pfSeriesMarker" style="background:' + color + '" aria-hidden="true"></span>';
}

function pfRenderAccountLabel(name, seriesIndex, extraHtml) {
  return '<span class="pfAccountLabel">' +
    pfRenderSeriesMarker(seriesIndex) +
    '<span class="pfAccountLabelText">' + name + '</span>' +
    (extraHtml || '') +
    '</span>';
}

function pfRenderEditableAmountCell(amount, formattedLabel, meta) {
  let amtAttr = amount != null && amount !== '' ? amount : '';
  return '<button type="button" class="pfEditableAmount"' +
    ' data-project="' + pfEscapeAttr(meta.projectKey) + '"' +
    ' data-account="' + pfEscapeAttr(meta.accountId) + '"' +
    ' data-account-name="' + pfEscapeAttr(meta.accountName) + '"' +
    ' data-date="' + pfEscapeAttr(meta.dateKey) + '"' +
    ' data-amount="' + amtAttr + '"' +
    ' aria-label="' + pfEscapeAttr((meta.dateKey || '') + ' ' + formattedLabel + ' を編集') + '">' +
    formattedLabel +
    '</button>';
}

function pfRenderAccountMenuBtn(projectKey, accountId, accountName) {
  return '<button type="button" class="pfAccountMenuBtn" aria-label="アカウントメニュー"' +
    ' data-project="' + pfEscapeAttr(projectKey) + '"' +
    ' data-account="' + pfEscapeAttr(accountId) + '"' +
    ' data-account-name="' + pfEscapeAttr(accountName) + '">⋯</button>';
}

function pfCaptureModalFooterDefault() {
  let footer = document.querySelector('#modalBg .modalFooter');
  if (footer && !pfEntryModalFooterDefault) {
    pfEntryModalFooterDefault = footer.innerHTML;
  }
}

function pfRestoreModalFooter() {
  let footer = document.querySelector('#modalBg .modalFooter');
  if (footer && pfEntryModalFooterDefault) {
    footer.innerHTML = pfEntryModalFooterDefault;
  }
  if (footer) footer.style.display = '';
}

function pfCloseEntryModal() {
  pfRestoreModalFooter();
  if (typeof closeModal === 'function') closeModal();
}

function pfOpenEntryModal(title, bodyHtml, saveHandlerName) {
  pfCaptureModalFooterDefault();
  if (typeof modalTitle !== 'undefined') modalTitle.textContent = title;
  if (typeof modalContent !== 'undefined') {
    modalContent.innerHTML = '<div class="pfEntryForm">' + bodyHtml + '</div>';
  }
  let footer = document.querySelector('#modalBg .modalFooter');
  if (footer) {
    footer.style.display = 'flex';
    footer.innerHTML =
      '<button type="button" class="btn2" onclick="pfCloseEntryModal()">キャンセル</button>' +
      '<button type="button" onclick="' + saveHandlerName + '()">保存</button>';
  }
  if (typeof modalBg !== 'undefined') modalBg.style.display = 'flex';
}

function pfEntryReadonlyField(label, value) {
  return '<label class="pfEntryLabel">' + label + '</label>' +
    '<input type="text" class="pfEntryInput pfEntryInput--readonly" value="' + String(value).replace(/"/g, '&quot;') + '" readonly>';
}

function pfEntryNumberField(label, id, value, help) {
  let helpHtml = help ? '<p class="pfEntryHelp">' + help + '</p>' : '';
  return '<label class="pfEntryLabel" for="' + id + '">' + label + '</label>' +
    '<input type="number" id="' + id + '" class="pfEntryInput" min="0" step="0.01" value="' + (value != null ? value : '') + '">' +
    helpHtml;
}

function pfEntryDateField(label, id, value) {
  return '<label class="pfEntryLabel" for="' + id + '">' + label + '</label>' +
    '<input type="date" id="' + id + '" class="pfEntryInput" value="' + value + '">';
}

function pfEntrySaveDummy(message) {
  pfCloseEntryModal();
  if (typeof showToast === 'function') {
    showToast(message || '保存は次回バージョンで実装予定です');
  }
}

function pfFormatIsoDate(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function pfGetProjectLabel(projectKey, projects) {
  if (typeof pmGetProject === 'function') {
    let mp = pmGetProject(projectKey);
    if (mp && mp.name) return mp.name;
  }
  let list = projects || [];
  let p = list.find(function (x) { return x.key === projectKey; });
  return p ? p.name : projectKey;
}

function pfBindEditableAmountClicks(table, openHandler) {
  if (!table || table._pfEditableBound) return;
  table._pfEditableBound = true;
  table.addEventListener('click', function (e) {
    let cell = e.target.closest('.pfEditableAmount');
    if (!cell) return;
    e.preventDefault();
    openHandler({
      projectKey: cell.getAttribute('data-project'),
      accountId: cell.getAttribute('data-account'),
      accountName: cell.getAttribute('data-account-name'),
      dateKey: cell.getAttribute('data-date'),
      amount: Number(cell.getAttribute('data-amount')) || 0
    });
  });
}

var PF_MANAGE_PROJECT_KEYS = ['ram', 'orca', 'cary', 'genesis', 'other'];
var PF_PERFORMANCE_INPUT_PROJECT_KEYS = ['ram', 'orca', 'cary'];

function pfEscapeHtml(text) {
  if (typeof escapeHtml === 'function') return escapeHtml(text);
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pfEnsureManageDisplayAccounts() {
  if (typeof settings === 'undefined') return;
  if (!settings.manageDisplayAccounts || typeof settings.manageDisplayAccounts !== 'object') {
    settings.manageDisplayAccounts = {};
  }
  PF_MANAGE_PROJECT_KEYS.forEach(function (key) {
    if (!settings.manageDisplayAccounts[key]) {
      settings.manageDisplayAccounts[key] = { orgAdded: [], removed: [], labels: {} };
    } else {
      if (!Array.isArray(settings.manageDisplayAccounts[key].orgAdded)) {
        settings.manageDisplayAccounts[key].orgAdded = [];
      }
      if (!Array.isArray(settings.manageDisplayAccounts[key].removed)) {
        settings.manageDisplayAccounts[key].removed = [];
      }
      if (!settings.manageDisplayAccounts[key].labels || typeof settings.manageDisplayAccounts[key].labels !== 'object') {
        settings.manageDisplayAccounts[key].labels = {};
      }
    }
  });
}

function pfPersistManageDisplayAccounts() {
  pfEnsureManageDisplayAccounts();
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  if (typeof persistHubSettings === 'function') persistHubSettings();
}

function pfEnsurePerformanceInputHiddenAccounts() {
  if (typeof settings === 'undefined') return;
  if (!settings.performanceInputHiddenAccounts || typeof settings.performanceInputHiddenAccounts !== 'object') {
    settings.performanceInputHiddenAccounts = {};
  }
  PF_PERFORMANCE_INPUT_PROJECT_KEYS.forEach(function (key) {
    if (!Array.isArray(settings.performanceInputHiddenAccounts[key])) {
      settings.performanceInputHiddenAccounts[key] = [];
    }
  });
}

function pfNormalizeHiddenIdList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(function (id) { return typeof id === 'string' && id; });
  }
  if (typeof raw === 'object') {
    return Object.keys(raw).filter(function (id) {
      let val = raw[id];
      return val === false || val === 0 || val === 'false';
    });
  }
  return [];
}

function pfMigrateDisplaySettingsCompat() {
  if (typeof settings === 'undefined') return;
  pfEnsureManageDisplayAccounts();
  pfEnsurePerformanceInputHiddenAccounts();
  PF_PERFORMANCE_INPUT_PROJECT_KEYS.forEach(function (key) {
    settings.performanceInputHiddenAccounts[key] =
      pfNormalizeHiddenIdList(settings.performanceInputHiddenAccounts[key]);
  });
  PF_MANAGE_PROJECT_KEYS.forEach(function (key) {
    let bucket = settings.manageDisplayAccounts[key];
    if (!bucket) return;
    bucket.removed = pfNormalizeHiddenIdList(bucket.removed);
    if (!Array.isArray(bucket.orgAdded)) bucket.orgAdded = [];
  });
}

function pfIsPerformanceInputAccountHidden(projectKey, accountId) {
  if (!projectKey || !accountId) return false;
  pfEnsurePerformanceInputHiddenAccounts();
  let list = settings.performanceInputHiddenAccounts[projectKey];
  if (!Array.isArray(list)) return false;
  return list.indexOf(accountId) >= 0;
}

function pfIsPerformanceInputAccountVisible(projectKey, accountId) {
  return !pfIsPerformanceInputAccountHidden(projectKey, accountId);
}

function pfIsRevenueManageAccountVisible(projectKey, accountId) {
  if (!projectKey || !accountId) return true;
  pfEnsureManageDisplayAccounts();
  let bucket = pfGetManageDisplayBucket(projectKey);
  let removed = Array.isArray(bucket.removed) ? bucket.removed : [];
  return removed.indexOf(accountId) < 0;
}

function pfSetPerformanceInputAccountVisible(projectKey, accountId, visible) {
  if (!projectKey || !accountId) return;
  if (visible) {
    pfRestorePerformanceInputAccount(projectKey, accountId);
    return;
  }
  pfEnsurePerformanceInputHiddenAccounts();
  let list = settings.performanceInputHiddenAccounts[projectKey];
  if (list.indexOf(accountId) < 0) list.push(accountId);
  pfPersistPerformanceInputHiddenAccounts();
}

function pfSetRevenueManageAccountVisible(projectKey, accountId, visible) {
  if (!projectKey || !accountId) return;
  let bucket = pfGetManageDisplayBucket(projectKey);
  if (visible) {
    bucket.removed = bucket.removed.filter(function (id) { return id !== accountId; });
  } else if (bucket.removed.indexOf(accountId) < 0) {
    bucket.removed.push(accountId);
  }
  pfPersistManageDisplayAccounts();
}

function pfHidePerformanceInputAccount(projectKey, accountId) {
  pfSetPerformanceInputAccountVisible(projectKey, accountId, false);
}

function pfRestorePerformanceInputAccount(projectKey, accountId) {
  if (!projectKey || !accountId) return;
  pfEnsurePerformanceInputHiddenAccounts();
  settings.performanceInputHiddenAccounts[projectKey] =
    (settings.performanceInputHiddenAccounts[projectKey] || []).filter(function (id) {
      return id !== accountId;
    });
  pfPersistPerformanceInputHiddenAccounts();
}

function pfPersistPerformanceInputHiddenAccounts() {
  pfEnsurePerformanceInputHiddenAccounts();
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  if (typeof persistHubSettings === 'function') persistHubSettings();
}

function pfGetManageDisplayBucket(projectKey) {
  pfEnsureManageDisplayAccounts();
  return settings.manageDisplayAccounts[projectKey] || { orgAdded: [], removed: [] };
}

function pfHasManageRevenueEntryData(projectKey, accountId) {
  if (typeof settings === 'undefined' || !settings.revenueLog) return false;
  return Object.keys(settings.revenueLog).some(function (key) {
    let entry = settings.revenueLog[key];
    if (!entry) return false;
    if (projectKey === 'ram' && entry.ramAccounts) {
      let found = typeof pdFindRamAccountEntry === 'function'
        ? pdFindRamAccountEntry(entry, accountId)
        : null;
      if (found) return true;
    }
    if (projectKey === 'orca' && entry.orcaAccounts && entry.orcaAccounts[accountId]) {
      let ae = entry.orcaAccounts[accountId];
      if (ae.todayRevenue != null) return true;
      return ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null;
    }
    if (projectKey === 'cary' && entry.caryAccounts && entry.caryAccounts[accountId]) {
      return entry.caryAccounts[accountId].todayReward != null;
    }
    if (entry.accounts && entry.accounts[accountId]) {
      let ae = entry.accounts[accountId];
      if (ae.projectKey && ae.projectKey !== projectKey) return false;
      return ae.todayRevenue != null || ae.revenue != null;
    }
    return false;
  });
}

function pfHasManageSalesEntryData(projectKey, accountId) {
  if (typeof settings === 'undefined' || !settings.salesLog) return false;
  return Object.keys(settings.salesLog).some(function (key) {
    let entry = settings.salesLog[key];
    if (!entry || !entry.accounts) return false;
    if (projectKey === 'ram' && typeof pdFindRamSalesAccountEntry === 'function') {
      let found = pdFindRamSalesAccountEntry(entry, accountId);
      if (found) return found.ae.todaySales != null;
    }
    if (!entry.accounts[accountId]) return false;
    let ae = entry.accounts[accountId];
    if (ae.projectKey && ae.projectKey !== projectKey) return false;
    return ae.todaySales != null;
  });
}

function pfGetPerformanceInputRegisteredAccountIds(projectKey) {
  if (projectKey === 'ram' && typeof getRamAllRootAccounts === 'function') {
    return getRamAllRootAccounts().map(function (a) { return a.id; });
  }
  if (projectKey === 'orca' && typeof getOrcaInputAccounts === 'function') {
    return getOrcaInputAccounts().map(function (a) { return a.id; });
  }
  if (projectKey === 'eni' && typeof getEniInputAccounts === 'function') {
    return getEniInputAccounts().map(function (a) { return a.id; });
  }
  if (projectKey === 'cary' && typeof getCaryInputAccounts === 'function') {
    return getCaryInputAccounts().map(function (a) { return a.id; });
  }
  return [];
}

function pfIsPerformanceInputRegisteredAccount(projectKey, accountId) {
  if (!projectKey || !accountId) return false;
  return pfGetPerformanceInputRegisteredAccountIds(projectKey).indexOf(accountId) >= 0;
}

function pfIsManageAccountVisible(projectKey, accountId) {
  if (!pfIsRevenueManageAccountVisible(projectKey, accountId)) return false;
  if (projectKey === 'ram' || projectKey === 'orca' || projectKey === 'eni' || projectKey === 'cary') {
    return pfIsPerformanceInputRegisteredAccount(projectKey, accountId);
  }
  return true;
}

function pfFilterToPerformanceInputRegistered(projectKey, accounts) {
  let registered = pfGetPerformanceInputRegisteredAccountIds(projectKey);
  if (!registered.length) return accounts || [];
  let set = {};
  registered.forEach(function (id) { set[id] = true; });
  return (accounts || []).filter(function (a) { return set[a.id]; });
}

function pfFilterManageAccounts(projectKey, accounts, options) {
  if (!accounts || !accounts.length) return [];
  if (options && options.useDemoBypass &&
      typeof pdIsDemoMode === 'function' && pdIsDemoMode()) {
    return accounts.slice();
  }
  return accounts.filter(function (acc) {
    return pfIsManageAccountVisible(projectKey, acc.id);
  });
}

function pfLookupManageAccountName(projectKey, accountId) {
  if (!accountId) return '';
  if (projectKey === 'ram') {
    if (typeof members !== 'undefined') {
      let m = members.find(function (x) { return x.id === accountId; });
      if (m) {
        let un = (m.username || m.name || '').replace(/^@/, '').trim();
        if (un) return un;
      }
    }
    if (typeof getRamAllRootAccounts === 'function') {
      let acc = getRamAllRootAccounts().find(function (a) { return a.id === accountId; });
      if (acc && acc.username) return String(acc.username).replace(/^@/, '').trim();
    }
    if (typeof getRamInputAccounts === 'function') {
      let acc = getRamInputAccounts().find(function (a) { return a.id === accountId; });
      if (acc && acc.username) return String(acc.username).replace(/^@/, '').trim();
    }
    if (typeof settings !== 'undefined' && settings.ramExcelAccountMap) {
      let keys = Object.keys(settings.ramExcelAccountMap);
      for (let i = 0; i < keys.length; i++) {
        if (settings.ramExcelAccountMap[keys[i]] === accountId) return keys[i];
      }
    }
  }
  if (projectKey === 'orca' && typeof settings !== 'undefined' && Array.isArray(settings.orcaInputAccounts)) {
    let o = settings.orcaInputAccounts.find(function (x) { return x.id === accountId; });
    if (o) {
      let un = (o.username || o.name || '').replace(/^@/, '').trim();
      if (un) return un;
    }
  }
  if (projectKey === 'cary' && typeof settings !== 'undefined' && Array.isArray(settings.caryInputAccounts)) {
    let c = settings.caryInputAccounts.find(function (x) { return x.id === accountId; });
    if (c) {
      let un = (c.username || c.name || '').replace(/^@/, '').trim();
      if (un) return un;
    }
  }
  return '';
}

function pfResolveManageAccounts(projectKey, liveAccounts, demoAccounts) {
  let annotate = function (list) {
    return pfNormalizeRamSeriesColors(projectKey, pfAnnotateAccountSeries(list, projectKey));
  };
  if (typeof pdIsDemoMode === 'function' && pdIsDemoMode() &&
      demoAccounts && demoAccounts.length) {
    return annotate(
      pfApplyManageAccountLabels(projectKey,
        pfFilterManageAccounts(projectKey, demoAccounts, { useDemoBypass: true })
      )
    );
  }
  let merged = pfFilterToPerformanceInputRegistered(projectKey, liveAccounts || []);
  let seen = {};
  merged.forEach(function (a) { seen[a.id] = true; });
  let registeredOnly = projectKey === 'ram' || projectKey === 'orca' || projectKey === 'cary';
  if (typeof pdCollectRevenueAccountIds === 'function') {
    pdCollectRevenueAccountIds(projectKey).forEach(function (id) {
      if (registeredOnly && !pfIsPerformanceInputRegisteredAccount(projectKey, id)) return;
      if (seen[id]) return;
      seen[id] = true;
      merged.push({
        id: id,
        name: pfLookupManageAccountName(projectKey, id) || id,
        parentId: null,
        depth: 0
      });
    });
  }
  if (typeof pdCollectSalesAccountIds === 'function') {
    pdCollectSalesAccountIds(projectKey).forEach(function (id) {
      if (registeredOnly && !pfIsPerformanceInputRegisteredAccount(projectKey, id)) return;
      if (seen[id]) return;
      seen[id] = true;
      merged.push({
        id: id,
        name: pfLookupManageAccountName(projectKey, id) || id,
        parentId: null,
        depth: 0
      });
    });
  }
  merged = pfFilterManageAccounts(projectKey, merged);
  merged = pfApplyManageAccountLabels(projectKey, merged);
  return annotate(merged);
}

function pfAddManageDisplayFromOrg(projectKey, accountId) {
  if (!projectKey || !accountId) return;
  pfSetRevenueManageAccountVisible(projectKey, accountId, true);
  let bucket = pfGetManageDisplayBucket(projectKey);
  if (bucket.orgAdded.indexOf(accountId) < 0) bucket.orgAdded.push(accountId);
  pfPersistManageDisplayAccounts();
}

function pfRegisterManageDisplayFromEntry(projectKey, accountId) {
  if (!projectKey || !accountId) return;
  let bucket = pfGetManageDisplayBucket(projectKey);
  bucket.removed = bucket.removed.filter(function (id) { return id !== accountId; });
  if (bucket.orgAdded.indexOf(accountId) < 0 && !pfHasManageRevenueEntryData(projectKey, accountId) &&
      !pfHasManageSalesEntryData(projectKey, accountId)) {
    bucket.orgAdded.push(accountId);
  }
  pfPersistManageDisplayAccounts();
}

function pfGetManageAccountDisplayName(projectKey, accountId, defaultName) {
  let bucket = pfGetManageDisplayBucket(projectKey);
  if (bucket.labels && bucket.labels[accountId]) return bucket.labels[accountId];
  let resolved = pfLookupManageAccountName(projectKey, accountId);
  if (resolved) return resolved;
  return defaultName || accountId;
}

function pfApplyManageAccountLabels(projectKey, accounts) {
  return (accounts || []).map(function (acc) {
    return Object.assign({}, acc, {
      name: pfGetManageAccountDisplayName(projectKey, acc.id, acc.name || acc.username)
    });
  });
}

function pfRenameManageAccount(projectKey, accountId, currentName) {
  let next = prompt('表示名を変更', currentName || accountId);
  if (next === null) return false;
  next = String(next).trim();
  if (!next || next === currentName) return false;
  let bucket = pfGetManageDisplayBucket(projectKey);
  bucket.labels[accountId] = next;
  if (typeof members !== 'undefined') {
    let m = members.find(function (x) { return x.id === accountId; });
    if (m) {
      m.name = next;
      if (typeof markActivity === 'function') markActivity();
      if (typeof render === 'function') render();
    }
  }
  pfPersistManageDisplayAccounts();
  if (typeof showToast === 'function') showToast('✅ 表示名を変更しました');
  return true;
}

function pfRemoveManageDisplayAccount(projectKey, accountId) {
  if (!projectKey || !accountId) return;
  let bucket = pfGetManageDisplayBucket(projectKey);
  if (bucket.removed.indexOf(accountId) < 0) bucket.removed.push(accountId);
  pfPersistManageDisplayAccounts();
}

function pfRenderManageAccountTrigger(projectKey, accountId, accountName, innerHtml) {
  return '<span class="pfManageAccountTrigger"' +
    ' data-project="' + pfEscapeAttr(projectKey) + '"' +
    ' data-account="' + pfEscapeAttr(accountId) + '"' +
    ' data-account-name="' + pfEscapeAttr(accountName) + '">' +
    innerHtml +
    '</span>';
}

function pfEnsureManageContextMenu() {
  if (pfManageContextMenuEl) return pfManageContextMenuEl;
  pfManageContextMenuEl = document.createElement('div');
  pfManageContextMenuEl.id = 'pfManageContextMenu';
  pfManageContextMenuEl.className = 'pfManageContextMenu isHidden';
  pfManageContextMenuEl.innerHTML =
    '<button type="button" class="pfManageContextMenuItem" data-action="rename">✏️ 編集</button>' +
    '<button type="button" class="pfManageContextMenuItem pfManageContextMenuItem--danger" data-action="deleteData">🗑 アカウント削除</button>' +
    '<button type="button" class="pfManageContextMenuItem pfManageContextMenuItem--cancel" data-action="cancel">キャンセル</button>';
  document.body.appendChild(pfManageContextMenuEl);
  pfManageContextMenuEl.addEventListener('click', function (e) {
    let btn = e.target.closest('[data-action]');
    if (!btn || !pfManageContextMeta) return;
    e.preventDefault();
    e.stopPropagation();
    let action = btn.getAttribute('data-action');
    let meta = pfManageContextMeta;
    let handlers = pfManageContextHandlers || {};
    pfCloseManageContextMenu();
    if (action === 'cancel') return;
    if (action === 'rename') {
      if (pfRenameManageAccount(meta.projectKey, meta.accountId, meta.accountName) &&
          typeof handlers.onChanged === 'function') {
        handlers.onChanged();
      }
      return;
    }
    if (action === 'deleteData') {
      pfConfirmManageDeleteData(meta.projectKey, meta.accountId, meta.accountName, handlers.onChanged);
    }
  });
  document.addEventListener('click', pfCloseManageContextMenu);
  document.addEventListener('contextmenu', function (e) {
    if (!pfManageContextMenuEl || pfManageContextMenuEl.classList.contains('isHidden')) return;
    if (!e.target.closest('#pfManageContextMenu')) pfCloseManageContextMenu();
  });
  window.addEventListener('scroll', pfCloseManageContextMenu, true);
  window.addEventListener('resize', pfCloseManageContextMenu);
  return pfManageContextMenuEl;
}

function pfCloseManageContextMenu() {
  if (pfManageContextMenuEl) pfManageContextMenuEl.classList.add('isHidden');
  pfManageContextMeta = null;
  pfManageContextHandlers = null;
}

function pfOpenManageAccountContextMenu(clientX, clientY, meta, handlers) {
  let menu = pfEnsureManageContextMenu();
  pfManageContextMeta = meta;
  pfManageContextHandlers = handlers || {};
  menu.classList.remove('isHidden');
  let pad = 8;
  let rect = menu.getBoundingClientRect();
  let left = clientX;
  let top = clientY;
  if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
  if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function pfReadManageAccountMeta(el) {
  return {
    projectKey: el.getAttribute('data-project'),
    accountId: el.getAttribute('data-account'),
    accountName: el.getAttribute('data-account-name')
  };
}

function pfBindManageAccountMenu(table, onChanged) {
  if (!table || table._pfAccountMenuBound) return;
  table._pfAccountMenuBound = true;
  pfEnsureManageContextMenu();
  table.addEventListener('click', function (e) {
    let btn = e.target.closest('.pfAccountMenuBtn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    let rect = btn.getBoundingClientRect();
    pfOpenManageAccountContextMenu(rect.right, rect.bottom, pfReadManageAccountMeta(btn), { onChanged: onChanged });
  });
}

function pfBindManageAccountContextMenu(table, onChanged) {
  pfBindManageAccountMenu(table, onChanged);
}

function pfConfirmManageDeleteData(projectKey, accountId, accountName, onDeleted) {
  if (typeof aimShowDeleteAccountDialog === 'function') {
    pfCaptureModalFooterDefault();
    aimShowDeleteAccountDialog(projectKey, accountId, accountName, {
      scope: 'full',
      onDone: function () {
        if (typeof onDeleted === 'function') onDeleted();
      }
    });
    return;
  }
  pfCaptureModalFooterDefault();
  if (typeof modalTitle !== 'undefined') modalTitle.textContent = 'アカウント削除';
  if (typeof modalContent !== 'undefined') {
    modalContent.innerHTML =
      '<div class="pfConfirmBody">' +
      '<p class="pfConfirmMessage">このアカウントを完全に削除しますか？</p>' +
      '<p class="pfConfirmAccountName">' + pfEscapeHtml(accountName || accountId) + '</p>' +
      '<p class="pfEntryHelp">アカウント本体・組織図・収益・売上・ポートフォリオ・関連キャッシュをすべて削除します。この操作は取り消せません。</p>' +
      '</div>';
  }
  let footer = document.querySelector('#modalBg .modalFooter');
  if (footer) {
    footer.style.display = 'flex';
    footer.innerHTML =
      '<button type="button" class="btn2" onclick="pfCloseEntryModal()">キャンセル</button>' +
      '<button type="button" class="btnDanger" id="pfManageDeleteDataConfirmBtn">削除</button>';
    let confirmBtn = document.getElementById('pfManageDeleteDataConfirmBtn');
    if (confirmBtn) {
      confirmBtn.onclick = function () {
        if (typeof aimDeleteInputAccountFully === 'function') {
          aimDeleteInputAccountFully(projectKey, accountId, { mode: 'subtree' });
        } else if (typeof pdDeleteAccountPerformanceData === 'function') {
          pdDeleteAccountPerformanceData(projectKey, accountId);
        }
        pfCloseEntryModal();
        if (typeof showToast === 'function') {
          showToast('✅ アカウントを削除しました');
        }
        if (typeof onDeleted === 'function') onDeleted();
        if (projectKey === 'orca' && typeof orcaRender === 'function') orcaRender();
        if (projectKey === 'ram' && typeof render === 'function') render();
        if (projectKey === 'eni' && typeof eniRender === 'function') eniRender();
        if (typeof renderPortfolio === 'function') renderPortfolio();
      };
    }
  }
  if (typeof modalBg !== 'undefined') modalBg.style.display = 'flex';
}

function pfConfirmManageRemove(projectKey, accountId, accountName, onRemoved) {
  pfCaptureModalFooterDefault();
  if (typeof modalTitle !== 'undefined') modalTitle.textContent = '表示一覧から削除';
  if (typeof modalContent !== 'undefined') {
    modalContent.innerHTML =
      '<div class="pfConfirmBody">' +
      '<p class="pfConfirmMessage">このアカウントを表示一覧から削除しますか？</p>' +
      '<p class="pfConfirmAccountName">' + pfEscapeHtml(accountName || accountId) + '</p>' +
      '<p class="pfEntryHelp">組織図データ・アカウント情報は削除されません。収益管理・売上管理の一覧から非表示になります。</p>' +
      '</div>';
  }
  let footer = document.querySelector('#modalBg .modalFooter');
  if (footer) {
    footer.style.display = 'flex';
    footer.innerHTML =
      '<button type="button" class="btn2" onclick="pfCloseEntryModal()">キャンセル</button>' +
      '<button type="button" class="btnDanger" id="pfManageRemoveConfirmBtn">削除</button>';
    let confirmBtn = document.getElementById('pfManageRemoveConfirmBtn');
    if (confirmBtn) {
      confirmBtn.onclick = function () {
        pfRemoveManageDisplayAccount(projectKey, accountId);
        pfCloseEntryModal();
        if (typeof showToast === 'function') {
          showToast('✅ 表示一覧から削除しました');
        }
        if (typeof onRemoved === 'function') onRemoved();
      };
    }
  }
  if (typeof modalBg !== 'undefined') modalBg.style.display = 'flex';
}

function pfRenderRamInputDisplaySettingsPanel(accountId) {
  let idAttr = pfEscapeAttr(accountId);
  let perfVisible = pfIsPerformanceInputAccountVisible('ram', accountId);
  let revVisible = pfIsRevenueManageAccountVisible('ram', accountId);
  return '<div class="ramInputDisplayPanel" id="ramDisplayPanel_' + idAttr + '">' +
    '<p class="help ramInputDisplayHelp">組織図・集計・保存データには影響しません。</p>' +
    '<label class="pfDisplayCheck">' +
    '<input type="checkbox" id="pfPerfInput_' + idAttr + '" ' + (perfVisible ? 'checked' : '') +
    ' onchange="pfHandlePerformanceInputDisplayToggle(\'' + idAttr + '\', this)">' +
    '<span>実績入力に表示</span></label>' +
    '<label class="pfDisplayCheck">' +
    '<input type="checkbox" id="pfRevManage_' + idAttr + '" ' + (revVisible ? 'checked' : '') +
    ' onchange="pfHandleRevenueManageDisplayToggle(\'' + idAttr + '\', this)">' +
    '<span>収益管理に表示</span></label>' +
    '</div>';
}

function pfSyncAccountDisplayCheckboxes(accountId) {
  let perfEl = document.getElementById('pfPerfInput_' + accountId);
  let revEl = document.getElementById('pfRevManage_' + accountId);
  if (perfEl) perfEl.checked = pfIsPerformanceInputAccountVisible('ram', accountId);
  if (revEl) revEl.checked = pfIsRevenueManageAccountVisible('ram', accountId);
}

function pfRefreshViewsAfterDisplayChange() {
  // renderHome → updateHomeDashboard already refreshes portfolio + visible manage pages
  if (typeof renderHome === 'function') {
    renderHome();
  } else if (typeof updateHomeDashboard === 'function' && typeof allOrgSummary === 'function') {
    updateHomeDashboard(allOrgSummary());
  }
  if (typeof modalContent !== 'undefined' &&
      modalContent.querySelector('.ramInputList') &&
      typeof openRamRevenueInput === 'function') {
    openRamRevenueInput();
  }
}

function pfShowDisplayHideConfirm(kind, accountId, onConfirm) {
  pfCancelDisplayHideConfirm();
  if (typeof modalContent === 'undefined') return;
  let message = kind === 'performanceInput'
    ? 'このアカウントを実績入力から非表示にしますか？<br><br>※組織図・集計・保存データは削除されません。'
    : 'このアカウントを収益管理から非表示にしますか？<br><br>※組織図・集計・保存データは削除されません。';
  modalContent.insertAdjacentHTML('beforeend',
    '<div class="ramInputConfirm pfDisplayHideConfirm" id="pfDisplayHideConfirm">' +
    '<p class="ramInputConfirmText">' + message + '</p>' +
    '<div class="ramInputFooterStack pfDisplayHideConfirmActions">' +
    '<button type="button" class="btn2 ramInputBtnAdd" onclick="pfCancelDisplayHideConfirm()">キャンセル</button>' +
    '<button type="button" class="ramInputBtnSave" onclick="pfConfirmDisplayHide()">非表示にする</button>' +
    '</div></div>');
  pfDisplayHideConfirmPending = { kind: kind, accountId: accountId, onConfirm: onConfirm };
  let confirmEl = document.getElementById('pfDisplayHideConfirm');
  if (confirmEl && confirmEl.scrollIntoView) {
    confirmEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function pfCancelDisplayHideConfirm() {
  pfDisplayHideConfirmPending = null;
  let el = document.getElementById('pfDisplayHideConfirm');
  if (el) el.remove();
}

function pfConfirmDisplayHide() {
  if (!pfDisplayHideConfirmPending) return;
  let pending = pfDisplayHideConfirmPending;
  pfCancelDisplayHideConfirm();
  if (typeof pending.onConfirm === 'function') pending.onConfirm();
}

function pfHandlePerformanceInputDisplayToggle(accountId, inputEl) {
  if (!accountId || !inputEl) return;
  if (inputEl.checked) {
    pfSetPerformanceInputAccountVisible('ram', accountId, true);
    pfRefreshViewsAfterDisplayChange();
    if (typeof showToast === 'function') showToast('✅ 実績入力に表示しました');
    return;
  }
  inputEl.checked = true;
  pfShowDisplayHideConfirm('performanceInput', accountId, function () {
    pfSetPerformanceInputAccountVisible('ram', accountId, false);
    pfSyncAccountDisplayCheckboxes(accountId);
    pfRefreshViewsAfterDisplayChange();
    if (typeof showToast === 'function') showToast('✅ 実績入力から非表示にしました');
  });
}

function pfHandleRevenueManageDisplayToggle(accountId, inputEl) {
  if (!accountId || !inputEl) return;
  if (inputEl.checked) {
    pfSetRevenueManageAccountVisible('ram', accountId, true);
    pfRefreshViewsAfterDisplayChange();
    if (typeof showToast === 'function') showToast('✅ 収益管理に表示しました');
    return;
  }
  inputEl.checked = true;
  pfShowDisplayHideConfirm('revenueManage', accountId, function () {
    pfSetRevenueManageAccountVisible('ram', accountId, false);
    pfSyncAccountDisplayCheckboxes(accountId);
    pfRefreshViewsAfterDisplayChange();
    if (typeof showToast === 'function') showToast('✅ 収益管理から非表示にしました');
  });
}

function pfAddManageDisplayFromOrgUi(projectKey, accountId) {
  if (typeof aimEnsureOrgMemberRegisteredAsInput === 'function') {
    aimEnsureOrgMemberRegisteredAsInput(projectKey, accountId);
  }
  pfAddManageDisplayFromOrg(projectKey, accountId);
  let label = accountId;
  if (projectKey === 'ram' && typeof members !== 'undefined') {
    let m = members.find(function (x) { return x.id === accountId; });
    if (m && typeof displayName === 'function') label = displayName(m);
  } else if (projectKey === 'orca' && typeof orcaMembers !== 'undefined') {
    let om = orcaMembers.find(function (x) { return x.id === accountId; });
    if (om && typeof orcaDisplayName === 'function') label = orcaDisplayName(om);
  } else if (projectKey === 'eni' && typeof eniMembers !== 'undefined') {
    let em = eniMembers.find(function (x) { return x.id === accountId; });
    if (em && typeof eniDisplayName === 'function') label = eniDisplayName(em);
  }
  if (typeof persistHubSettings === 'function') persistHubSettings();
  else if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
  if (typeof markActivity === 'function') markActivity();
  if (typeof showToast === 'function') {
    showToast('✅ ' + label + ' を実績入力・収益管理・売上管理の対象に追加しました');
  }
  if (typeof revenueManagePage !== 'undefined' && !revenueManagePage.classList.contains('hidden') &&
      typeof renderRevenueManage === 'function') {
    renderRevenueManage();
  }
  if (typeof salesManagePage !== 'undefined' && !salesManagePage.classList.contains('hidden') &&
      typeof renderSalesManage === 'function') {
    renderSalesManage();
  }
}

if (typeof window !== 'undefined') {
  window.pfAddManageDisplayFromOrgUi = pfAddManageDisplayFromOrgUi;
  window.pfEnsureManageDisplayAccounts = pfEnsureManageDisplayAccounts;
  window.pfEnsurePerformanceInputHiddenAccounts = pfEnsurePerformanceInputHiddenAccounts;
  window.pfIsPerformanceInputAccountHidden = pfIsPerformanceInputAccountHidden;
  window.pfIsPerformanceInputAccountVisible = pfIsPerformanceInputAccountVisible;
  window.pfIsRevenueManageAccountVisible = pfIsRevenueManageAccountVisible;
  window.pfHidePerformanceInputAccount = pfHidePerformanceInputAccount;
  window.pfRestorePerformanceInputAccount = pfRestorePerformanceInputAccount;
  window.pfSetPerformanceInputAccountVisible = pfSetPerformanceInputAccountVisible;
  window.pfSetRevenueManageAccountVisible = pfSetRevenueManageAccountVisible;
  window.pfMigrateDisplaySettingsCompat = pfMigrateDisplaySettingsCompat;
  window.pfRenderRamInputDisplaySettingsPanel = pfRenderRamInputDisplaySettingsPanel;
  window.pfHandlePerformanceInputDisplayToggle = pfHandlePerformanceInputDisplayToggle;
  window.pfHandleRevenueManageDisplayToggle = pfHandleRevenueManageDisplayToggle;
  window.pfCancelDisplayHideConfirm = pfCancelDisplayHideConfirm;
  window.pfConfirmDisplayHide = pfConfirmDisplayHide;
}
