/* OUKEI HUB Excel Import — Ver2.0.0
 * Phase 1: RAM sheet「収益R7.12月」→ revenueLog (past data migration)
 */

var xiPendingImport = null;
var xiUndoSnapshot = null;
var xiLastImportResult = null;

var XI_RAM_SHEET_NAMES = ['収益R7.12月'];
var XI_RAM_ACCOUNTS = ['kai1', 'kai2'];
var XI_ROW_OPERATION = 'リターン';
var XI_ROW_REVENUE = '報酬';

function xiEscape(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xiNormalizeLabel(val) {
  let s = String(val == null ? '' : val);
  if (s.normalize) s = s.normalize('NFKC');
  return s
    .replace(/[\s　・•【】\[\]()（）]/g, '')
    .toLowerCase();
}

function xiCanonicalAccountKey(label) {
  let n = xiNormalizeLabel(label);
  if (!n) return null;
  if (n === 'kai1' || n.indexOf('kai1') >= 0) return 'kai1';
  if (n === 'kai2' || n.indexOf('kai2') >= 0) return 'kai2';
  return null;
}

function xiIsOperationLabel(label) {
  let n = xiNormalizeLabel(label);
  return n === xiNormalizeLabel(XI_ROW_OPERATION) || n.indexOf('リターン') >= 0;
}

function xiIsRevenueLabel(label) {
  let n = xiNormalizeLabel(label);
  return n === xiNormalizeLabel(XI_ROW_REVENUE) || n === '報酬';
}

function xiParseNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && !isNaN(val)) return Math.round(val * 100) / 100;
  let s = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (s === '' || s === '-') return null;
  let n = Number(s);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function xiParseDayNumber(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && val >= 1 && val <= 31 && Math.floor(val) === val) return val;
  let s = String(val).trim().replace(/日/g, '');
  let n = Number(s);
  if (!isNaN(n) && n >= 1 && n <= 31 && Math.floor(n) === n) return n;
  return null;
}

function xiCellLabel(row, colMax) {
  colMax = colMax || 8;
  if (!row) return '';
  for (let c = 0; c < colMax && c < row.length; c++) {
    let v = row[c];
    if (v == null || v === '') continue;
    return String(v).trim();
  }
  return '';
}

function xiFindReturnRewardPair(rows, startRow, maxLookahead) {
  maxLookahead = maxLookahead || 10;
  let opRow = -1;
  let revRow = -1;
  for (let j = startRow + 1; j < Math.min(startRow + maxLookahead, rows.length); j++) {
    let sub = xiNormalizeLabel(xiCellLabel(rows[j]));
    let account = xiCanonicalAccountKey(sub);
    if (account && j > startRow) break;
    if (opRow < 0 && xiIsOperationLabel(sub)) opRow = j;
    if (revRow < 0 && opRow >= 0 && j > opRow && xiIsRevenueLabel(sub)) {
      revRow = j;
      break;
    }
  }
  if (opRow >= 0 && revRow >= 0) {
    return { opRow: opRow, revRow: revRow, nextIndex: revRow + 1 };
  }
  return null;
}

function xiFindAccountBlocks(rows) {
  let blocks = [];
  let usedRows = {};
  let i = 0;

  while (i < rows.length) {
    let label = xiNormalizeLabel(xiCellLabel(rows[i]));
    let accountKey = xiCanonicalAccountKey(label);
    if (accountKey) {
      let pair = xiFindReturnRewardPair(rows, i, 12);
      if (pair) {
        blocks.push({
          accountKey: accountKey,
          totalRow: i,
          opRow: pair.opRow,
          revRow: pair.revRow
        });
        usedRows[i] = true;
        usedRows[pair.opRow] = true;
        usedRows[pair.revRow] = true;
        i = pair.nextIndex;
        continue;
      }
    }
    i += 1;
  }

  if (blocks.length < 2) {
    let orphanPairs = [];
    i = 0;
    while (i < rows.length - 1) {
      if (usedRows[i]) { i += 1; continue; }
      let l1 = xiNormalizeLabel(xiCellLabel(rows[i]));
      let l2 = xiNormalizeLabel(xiCellLabel(rows[i + 1]));
      if (xiIsOperationLabel(l1) && xiIsRevenueLabel(l2)) {
        orphanPairs.push({ opRow: i, revRow: i + 1, totalRow: -1 });
        usedRows[i] = true;
        usedRows[i + 1] = true;
        i += 2;
        continue;
      }
      i += 1;
    }
    orphanPairs.forEach(function (pair, idx) {
      let key = XI_RAM_ACCOUNTS[idx];
      if (!key) return;
      if (blocks.some(function (b) { return b.accountKey === key; })) return;
      blocks.push({
        accountKey: key,
        totalRow: pair.totalRow,
        opRow: pair.opRow,
        revRow: pair.revRow
      });
    });
  }

  blocks.sort(function (a, b) {
    return XI_RAM_ACCOUNTS.indexOf(a.accountKey) - XI_RAM_ACCOUNTS.indexOf(b.accountKey);
  });
  return blocks;
}

function xiResolveHubAccountForKey(accountKey) {
  if (typeof pdResolveRamAccountIdByExcelKey === 'function') {
    let id = pdResolveRamAccountIdByExcelKey(accountKey);
    if (id) return id;
  }
  return null;
}

function xiGetHubAccountDisplay(accountId) {
  if (!accountId || typeof members === 'undefined') return '';
  let m = members.find(function (x) { return x.id === accountId; });
  if (!m) return '';
  let un = (m.username || '').replace(/^@/, '');
  return un || m.name || accountId;
}

function xiBuildAccountStatsFromRecords(records) {
  let stats = {};
  XI_RAM_ACCOUNTS.forEach(function (key) {
    stats[key] = { days: 0, accountId: null, mapped: false, hubLabel: '' };
  });
  (records || []).forEach(function (rec) {
    let key = rec.accountKey;
    if (!stats[key]) return;
    stats[key].days += 1;
  });
  XI_RAM_ACCOUNTS.forEach(function (key) {
    let accountId = xiResolveHubAccountForKey(key);
    stats[key].accountId = accountId;
    stats[key].mapped = !!accountId;
    stats[key].hubLabel = accountId ? xiGetHubAccountDisplay(accountId) : '';
  });
  return stats;
}

function xiApplyAccountIdsToRecords(records) {
  return (records || []).map(function (rec) {
    let accountId = rec.accountId || xiResolveHubAccountForKey(rec.accountKey);
    return Object.assign({}, rec, { accountId: accountId });
  });
}

function xiParseSheetYearMonth(sheetName) {
  let name = String(sheetName || '');
  let m = name.match(/R(\d+)\.(\d+)月/);
  if (m) {
    return { year: 2018 + Number(m[1]), month: Number(m[2]) - 1 };
  }
  m = name.match(/(\d{4})[.\-/年](\d{1,2})/);
  if (m) {
    return { year: Number(m[1]), month: Number(m[2]) - 1 };
  }
  return null;
}

function xiFindSheet(workbook, names) {
  if (!workbook || !workbook.SheetNames) return null;
  let wanted = (names || []).map(xiNormalizeLabel);
  for (let i = 0; i < workbook.SheetNames.length; i++) {
    let sn = workbook.SheetNames[i];
    if (wanted.indexOf(xiNormalizeLabel(sn)) >= 0) return sn;
  }
  for (let j = 0; j < workbook.SheetNames.length; j++) {
    let sn2 = workbook.SheetNames[j];
    let norm = xiNormalizeLabel(sn2);
    if (norm.indexOf('収益') >= 0 && norm.indexOf('12月') >= 0) return sn2;
  }
  return null;
}

function xiSheetToRows(workbook, sheetName) {
  let sheet = workbook.Sheets[sheetName];
  if (!sheet || typeof XLSX === 'undefined') return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
}

function xiFindDayColumns(rows, year, month) {
  let daysInMonth = new Date(year, month + 1, 0).getDate();
  let best = null;
  for (let r = 0; r < Math.min(12, rows.length); r++) {
    let row = rows[r] || [];
    let cols = [];
    for (let c = 0; c < row.length; c++) {
      let day = xiParseDayNumber(row[c]);
      if (day != null && day >= 1 && day <= daysInMonth) {
        cols.push({ col: c, day: day });
      }
    }
    if (cols.length > (best ? best.length : 0)) best = cols;
  }
  if (best && best.length >= 10) {
    best.sort(function (a, b) { return a.col - b.col; });
    return best;
  }
  let fallback = [];
  let startCol = 1;
  for (let d = 1; d <= daysInMonth; d++) {
    fallback.push({ col: startCol + d - 1, day: d });
  }
  return fallback;
}

function xiBuildDateKey(year, month, day) {
  if (typeof revenueDateKey === 'function') {
    return revenueDateKey(year, month, day);
  }
  return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function xiParseRamSheet(workbook) {
  let sheetName = xiFindSheet(workbook, XI_RAM_SHEET_NAMES);
  if (!sheetName) {
    return { ok: false, error: 'シート「収益R7.12月」が見つかりません。' };
  }
  let ym = xiParseSheetYearMonth(sheetName);
  if (!ym) {
    return { ok: false, error: 'シート名から年月を判別できませんでした。' };
  }
  let rows = xiSheetToRows(workbook, sheetName);
  if (!rows.length) {
    return { ok: false, error: 'シートにデータがありません。' };
  }
  let dayCols = xiFindDayColumns(rows, ym.year, ym.month);
  let blocks = xiFindAccountBlocks(rows);
  if (!blocks.length) {
    return { ok: false, error: 'kai1 / kai2 の行構成（リターン・報酬）が見つかりません。' };
  }

  let records = [];
  let accountStats = {};
  let mismatches = [];

  blocks.forEach(function (block) {
    let accountKey = block.accountKey;
    if (XI_RAM_ACCOUNTS.indexOf(accountKey) < 0) return;
    let accountId = xiResolveHubAccountForKey(accountKey);
    dayCols.forEach(function (dc) {
      let op = xiParseNumber((rows[block.opRow] || [])[dc.col]);
      let rev = xiParseNumber((rows[block.revRow] || [])[dc.col]);
      let totalExcel = block.totalRow >= 0
        ? xiParseNumber((rows[block.totalRow] || [])[dc.col])
        : null;
      if (op == null && rev == null) return;
      op = op || 0;
      rev = rev || 0;
      let totalCalc = Math.round((op + rev) * 100) / 100;
      if (totalExcel != null && Math.abs(totalExcel - totalCalc) > 0.02) {
        mismatches.push({
          accountKey: accountKey,
          day: dc.day,
          excelTotal: totalExcel,
          calcTotal: totalCalc
        });
      }
      records.push({
        dateKey: xiBuildDateKey(ym.year, ym.month, dc.day),
        accountKey: accountKey,
        accountId: accountId,
        operationRevenue: op,
        todayRevenue: rev,
        totalRevenue: totalCalc,
        excelTotal: totalExcel
      });
    });
  });

  records = xiApplyAccountIdsToRecords(records);
  accountStats = xiBuildAccountStatsFromRecords(records);

  return {
    ok: true,
    sheetName: sheetName,
    year: ym.year,
    month: ym.month,
    records: records,
    accountStats: accountStats,
    mismatches: mismatches,
    dayColumnCount: dayCols.length
  };
}

function xiReadExcelFile(file) {
  return new Promise(function (resolve, reject) {
    if (!file) return reject(new Error('ファイルが選択されていません。'));
    if (typeof XLSX === 'undefined') return reject(new Error('Excel読込ライブラリが読み込まれていません。'));
    let reader = new FileReader();
    reader.onload = function (e) {
      try {
        let data = new Uint8Array(e.target.result);
        let wb = XLSX.read(data, { type: 'array', cellDates: false });
        resolve(wb);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = function () { reject(new Error('ファイルの読込に失敗しました。')); };
    reader.readAsArrayBuffer(file);
  });
}

function xiRenderImportPage() {
  let el = document.getElementById('xiMain');
  if (!el) return;
  let preview = xiPendingImport;
  let previewHtml = '';
  if (preview && preview.ok) {
    let totalRecords = (preview.records || []).length;
    let statsRows = XI_RAM_ACCOUNTS.map(function (key) {
      let st = preview.accountStats[key] || { days: 0, mapped: false, hubLabel: '' };
      let mapLabel = st.mapped
        ? 'HUB連携: ' + xiEscape(st.hubLabel || key)
        : '要確認（HUBにアカウント未登録）';
      return '<div class="xiPreviewRow"><span>' + xiEscape(key) + '</span><b>' + st.days + '日</b><small>' + mapLabel + '</small></div>';
    }).join('');
    let warnHtml = '';
    if (preview.mismatches && preview.mismatches.length) {
      warnHtml = '<div class="xiWarn">合計検算の差異: ' + preview.mismatches.length + '件（0.02ドル超）があります。インポート値はリターン＋報酬を使用します。</div>';
    }
    let unmapped = XI_RAM_ACCOUNTS.filter(function (k) {
      return !(preview.accountStats[k] && preview.accountStats[k].mapped);
    });
    if (unmapped.length) {
      warnHtml += '<div class="xiWarn">HUBに「' + unmapped.join('」「') + '」のRAMアカウント（ユーザー名一致）が必要です。組織図で登録後に再度お試しください。</div>';
    }
    previewHtml =
      '<div class="xiPreview panel">' +
      '<div class="xiPreviewTitle">プレビュー</div>' +
      '<div class="xiPreviewMeta"><span>対象シート</span><b>' + xiEscape(preview.sheetName) + '</b></div>' +
      '<div class="xiPreviewMeta"><span>合計件数</span><b>' + totalRecords + '件</b></div>' +
      '<div class="xiPreviewMeta"><span>読み込み件数（日数）</span></div>' +
      statsRows +
      warnHtml +
      '<p class="help xiPreviewOk">問題なければ「インポート開始」を押してください。</p>' +
      '<div class="xiPreviewActions">' +
      '<button type="button" class="btn2" onclick="xiResetImport()">ファイルを選び直す</button>' +
      '<button type="button" id="xiImportBtn" onclick="xiExecuteImport()">インポート開始</button>' +
      '</div></div>';
  }

  el.innerHTML =
    '<div class="xiStep panel">' +
    '<div class="xiStepNum">①</div>' +
    '<div class="xiStepBody">' +
    '<div class="xiStepTitle">Excelファイルを選択</div>' +
    '<p class="help">RAM管理Excel（ポートフォリオ.xlsx）の「収益R7.12月」シートを読み込みます。</p>' +
    '<button type="button" class="btn2" onclick="document.getElementById(\'xiFileInput\').click()">Excelファイルを選択</button>' +
    '<input id="xiFileInput" type="file" accept=".xlsx,.xls,.xlsm" class="hidden" onchange="xiHandleFileSelect(event)">' +
    '</div></div>' +
    '<div class="xiStep panel">' +
    '<div class="xiStepNum">②</div>' +
    '<div class="xiStepBody">' +
    '<div class="xiStepTitle">データを解析</div>' +
    '<p class="help">kai1 / kai2 の「リターン → 運用」「報酬 → 本日収益」として取り込みます。</p>' +
    '</div></div>' +
    previewHtml +
    (xiLastImportResult
      ? '<div class="xiPreview panel xiSuccess">' +
        '<div class="xiPreviewTitle">インポート完了</div>' +
        '<div class="xiPreviewMeta"><span>対象シート</span><b>' + xiEscape(xiLastImportResult.sheetName || '') + '</b></div>' +
        '<div class="xiPreviewMeta"><span>取込件数</span><b>' + xiLastImportResult.imported + '件</b></div>' +
        '<div class="xiPreviewMeta"><span>対象日数</span><b>' + xiLastImportResult.dates + '日</b></div>' +
        '<p class="help xiPreviewOk">ホーム・ポートフォリオ・収益管理へ反映しました。</p>' +
        '</div>'
      : '') +
    (xiUndoSnapshot ? '<div class="xiUndo panel"><button type="button" class="btnDanger" onclick="xiUndoImport()">インポートを元に戻す</button></div>' : '');
}

function xiResetImport() {
  xiPendingImport = null;
  xiLastImportResult = null;
  let input = document.getElementById('xiFileInput');
  if (input) input.value = '';
  xiRenderImportPage();
}

function xiHandleFileSelect(ev) {
  let file = ev.target.files && ev.target.files[0];
  if (!file) return;
  xiReadExcelFile(file).then(function (wb) {
    let parsed = xiParseRamSheet(wb);
    if (!parsed.ok) {
      alert(parsed.error || '解析に失敗しました。');
      xiResetImport();
      return;
    }
    xiPendingImport = parsed;
    xiRenderImportPage();
    if (typeof showToast === 'function') showToast('✅ Excelを解析しました');
  }).catch(function (err) {
    alert(err.message || 'Excelの読込に失敗しました。');
    xiResetImport();
  });
}

function xiExecuteImport() {
  if (!xiPendingImport || !xiPendingImport.ok) return;
  let records = xiApplyAccountIdsToRecords(xiPendingImport.records || []);
  let unmapped = XI_RAM_ACCOUNTS.filter(function (k) {
    return !records.some(function (r) { return r.accountKey === k && r.accountId; });
  });
  if (unmapped.length) {
    alert('HUBアカウント（' + unmapped.join(', ') + '）が見つかりません。\n組織図のRAMアカウント（ユーザー名 kai1 / kai2）を確認してください。');
    return;
  }
  let importable = records.filter(function (r) { return r.accountId; });
  if (!importable.length) {
    alert('インポート可能なデータがありません。');
    return;
  }
  if (!confirm('収益R7.12月（' + importable.length + '件）をインポートします。\n\n既存の同日データは上書きされます。\n実行しますか？')) return;

  if (typeof pdCreatePerformanceSnapshot === 'function') {
    xiUndoSnapshot = pdCreatePerformanceSnapshot();
  }

  let importRecords = importable.map(function (rec) {
    return {
      dateKey: rec.dateKey,
      accountId: rec.accountId,
      operationRevenue: rec.operationRevenue,
      todayRevenue: rec.todayRevenue
    };
  });

  let result = typeof pdImportRamRevenueRecords === 'function'
    ? pdImportRamRevenueRecords(importRecords)
    : { imported: 0, dates: 0 };

  if (typeof hubSetViewMonth === 'function') {
    hubSetViewMonth(xiPendingImport.year, xiPendingImport.month);
  }

  if (typeof updateHomeDashboard === 'function' && typeof allOrgSummary === 'function') {
    updateHomeDashboard(allOrgSummary());
  }
  if (typeof renderPortfolio === 'function') renderPortfolio();
  if (typeof renderRevenueManage === 'function') renderRevenueManage();
  if (typeof renderSalesManage === 'function') renderSalesManage();
  if (typeof render === 'function') render();

  xiLastImportResult = {
    imported: result.imported,
    dates: result.dates,
    sheetName: xiPendingImport.sheetName
  };
  xiPendingImport = null;
  xiRenderImportPage();

  if (typeof showToast === 'function') {
    showToast('✅ ' + result.imported + '件インポートしました');
  }
}

function xiUndoImport() {
  if (!xiUndoSnapshot) return alert('元に戻せるインポートがありません');
  if (!confirm('直前のExcelインポート前の実績データに戻しますか？')) return;
  if (typeof pdRestorePerformanceSnapshot === 'function') {
    pdRestorePerformanceSnapshot(xiUndoSnapshot);
  }
  xiUndoSnapshot = null;
  if (typeof updateHomeDashboard === 'function' && typeof allOrgSummary === 'function') {
    updateHomeDashboard(allOrgSummary());
  }
  if (typeof renderPortfolio === 'function') renderPortfolio();
  if (typeof renderRevenueManage === 'function') renderRevenueManage();
  xiRenderImportPage();
  if (typeof showToast === 'function') showToast('↩️ インポート前に戻しました');
}

function openExcelImportPage() {
  if (typeof showPage === 'function') showPage('excelImport');
}

function xiHookShowPage() {
  if (window._xiShowPageHooked || typeof showPage !== 'function') return;
  window._xiShowPageHooked = true;
  let orig = showPage;
  window.showPage = function (p) {
    if (p === 'excelImport') {
      menu.classList.remove('open');
      homePage.classList.add('hidden');
      ramPage.classList.add('hidden');
      settingsPage.classList.add('hidden');
      if (typeof accountManagePage !== 'undefined') accountManagePage.classList.add('hidden');
      if (typeof ochanRoomPage !== 'undefined') ochanRoomPage.classList.add('hidden');
      if (typeof portfolioPage !== 'undefined') portfolioPage.classList.add('hidden');
      if (typeof pfGoalSettingsPage !== 'undefined') pfGoalSettingsPage.classList.add('hidden');
      if (typeof projectSettingsPage !== 'undefined') projectSettingsPage.classList.add('hidden');
      if (typeof fxSettingsPage !== 'undefined') fxSettingsPage.classList.add('hidden');
      if (typeof revenueManagePage !== 'undefined') revenueManagePage.classList.add('hidden');
      if (typeof salesManagePage !== 'undefined') salesManagePage.classList.add('hidden');
      if (typeof excelImportPage !== 'undefined') excelImportPage.classList.remove('hidden');
      if (typeof setPageLocation === 'function') setPageLocation('Excelインポート');
      if (typeof syncMobileNav === 'function') syncMobileNav('settings');
      xiRenderImportPage();
      return;
    }
    if (typeof excelImportPage !== 'undefined') excelImportPage.classList.add('hidden');
    return orig(p);
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', xiHookShowPage);
  } else {
    xiHookShowPage();
  }
}

if (typeof window !== 'undefined') {
  window.openExcelImportPage = openExcelImportPage;
  window.xiHandleFileSelect = xiHandleFileSelect;
  window.xiExecuteImport = xiExecuteImport;
  window.xiResetImport = xiResetImport;
  window.xiUndoImport = xiUndoImport;
  window.xiParseRamSheet = xiParseRamSheet;
}
