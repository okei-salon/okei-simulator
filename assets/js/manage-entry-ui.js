/* OUKEI HUB Manage Entry UI — Ver1.8.5 */

var pfEntryModalFooterDefault = '';
var pfOriginalCloseModal = null;

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
  if (!amount) return '—';
  return '<button type="button" class="pfEditableAmount"' +
    ' data-project="' + pfEscapeAttr(meta.projectKey) + '"' +
    ' data-account="' + pfEscapeAttr(meta.accountId) + '"' +
    ' data-account-name="' + pfEscapeAttr(meta.accountName) + '"' +
    ' data-date="' + pfEscapeAttr(meta.dateKey) + '"' +
    ' data-amount="' + amount + '"' +
    ' aria-label="' + pfEscapeAttr((meta.dateKey || '') + ' ' + formattedLabel + ' を編集') + '">' +
    formattedLabel +
    '</button>';
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
