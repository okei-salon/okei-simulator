/* OUKEI HUB Manage Entry UI — Ver1.9.3 */

var pfEntryModalFooterDefault = '';
var pfOriginalCloseModal = null;
var pfManageContextMenuEl = null;
var pfManageContextPressTimer = null;
var pfManageContextMeta = null;
var pfManageContextHandlers = null;

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

function pfAnnotateAccountSeries(accounts) {
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
    let root = pfGetSeriesRootId(a.id, parentMap);
    return Object.assign({}, a, {
      seriesIndex: rootToSeries[root] || 0,
      seriesRootId: root
    });
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

function pfGetManageDisplayBucket(projectKey) {
  pfEnsureManageDisplayAccounts();
  return settings.manageDisplayAccounts[projectKey] || { orgAdded: [], removed: [] };
}

function pfHasManageRevenueEntryData(projectKey, accountId) {
  if (typeof settings === 'undefined' || !settings.revenueLog) return false;
  return Object.keys(settings.revenueLog).some(function (key) {
    let entry = settings.revenueLog[key];
    if (!entry) return false;
    if (projectKey === 'ram' && entry.ramAccounts && entry.ramAccounts[accountId]) {
      let rev = entry.ramAccounts[accountId].todayRevenue;
      return rev !== null && rev !== undefined && rev !== '';
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
    if (!entry || !entry.accounts || !entry.accounts[accountId]) return false;
    let ae = entry.accounts[accountId];
    if (ae.projectKey && ae.projectKey !== projectKey) return false;
    return ae.todaySales != null;
  });
}

function pfIsManageAccountVisible(projectKey, accountId) {
  let bucket = pfGetManageDisplayBucket(projectKey);
  if (bucket.removed.indexOf(accountId) >= 0) return false;
  if (bucket.orgAdded.indexOf(accountId) >= 0) return true;
  if (pfHasManageRevenueEntryData(projectKey, accountId)) return true;
  if (pfHasManageSalesEntryData(projectKey, accountId)) return true;
  return false;
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

function pfResolveManageAccounts(projectKey, liveAccounts, demoAccounts) {
  if (typeof pdIsDemoMode === 'function' && pdIsDemoMode() &&
      demoAccounts && demoAccounts.length) {
    return pfAnnotateAccountSeries(
      pfApplyManageAccountLabels(projectKey,
        pfFilterManageAccounts(projectKey, demoAccounts, { useDemoBypass: true })
      )
    );
  }
  let merged = (liveAccounts || []).slice();
  let seen = {};
  merged.forEach(function (a) { seen[a.id] = true; });
  if (typeof pdCollectRevenueAccountIds === 'function') {
    pdCollectRevenueAccountIds(projectKey).forEach(function (id) {
      if (seen[id]) return;
      seen[id] = true;
      merged.push({ id: id, name: id, parentId: null, depth: 0 });
    });
  }
  if (typeof pdCollectSalesAccountIds === 'function') {
    pdCollectSalesAccountIds(projectKey).forEach(function (id) {
      if (seen[id]) return;
      seen[id] = true;
      merged.push({ id: id, name: id, parentId: null, depth: 0 });
    });
  }
  merged = pfFilterManageAccounts(projectKey, merged);
  merged = pfApplyManageAccountLabels(projectKey, merged);
  return pfAnnotateAccountSeries(merged);
}

function pfAddManageDisplayFromOrg(projectKey, accountId) {
  if (!projectKey || !accountId) return;
  let bucket = pfGetManageDisplayBucket(projectKey);
  if (bucket.orgAdded.indexOf(accountId) < 0) bucket.orgAdded.push(accountId);
  bucket.removed = bucket.removed.filter(function (id) { return id !== accountId; });
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
  pfCaptureModalFooterDefault();
  if (typeof modalTitle !== 'undefined') modalTitle.textContent = 'アカウント削除';
  if (typeof modalContent !== 'undefined') {
    modalContent.innerHTML =
      '<div class="pfConfirmBody">' +
      '<p class="pfConfirmMessage">このアカウントの実績データをすべて削除しますか？</p>' +
      '<p class="pfConfirmAccountName">' + pfEscapeHtml(accountName || accountId) + '</p>' +
      '<p class="pfEntryHelp">組織図・アカウント情報は削除されません。収益・売上の入力データのみ削除されます。</p>' +
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
        if (typeof pdDeleteAccountPerformanceData === 'function') {
          pdDeleteAccountPerformanceData(projectKey, accountId);
        }
        pfCloseEntryModal();
        if (typeof showToast === 'function') {
          showToast('✅ 実績データを削除しました');
        }
        if (typeof onDeleted === 'function') onDeleted();
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

function pfAddManageDisplayFromOrgUi(projectKey, accountId) {
  pfAddManageDisplayFromOrg(projectKey, accountId);
  let label = accountId;
  if (typeof members !== 'undefined') {
    let m = members.find(function (x) { return x.id === accountId; });
    if (m && typeof displayName === 'function') label = displayName(m);
  }
  if (typeof showToast === 'function') {
    showToast('✅ ' + label + ' を収益管理・売上管理の表示一覧に追加しました');
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
}
