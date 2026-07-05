/* OUKEI HUB Excel Import — Ver2.0.5 / build 20260705-v243
 * Past RAM revenue + sales migration from Excel → revenueLog / salesLog
 * Layout auto-detect: Pattern① separate 売上 sheet / Pattern② combined in 収益 sheet
 */

var xiPendingImport = null;
var xiPendingWorkbook = null;
var xiUndoSnapshot = null;
var xiLastImportResult = null;

var XI_RAM_ACCOUNTS = ['kai1', 'kai2'];
var XI_ROW_OPERATION = 'リターン';
var XI_ROW_REVENUE = '報酬';
var XI_ROW_SALES_DAILY = '売上日利';
var XI_ROW_SALES_TOTAL = '売上合計';
var XI_SHEET_META_RES = {
  revenue: /^収益\s*R\s*(\d+)\s*[.．‧・]\s*(\d+)\s*月\s*$/i,
  sales: /^売上\s*R\s*(\d+)\s*[.．‧・]\s*(\d+)\s*月\s*$/i
};

var xiImportQueue = [];
var xiLastDiagnostics = null;
var xiReimportSheetIndex = 0;
var xiOverwriteResolve = null;

function xiMonthImportIsComplete(workbook, meta) {
  let st = xiGetMonthImportStatus(workbook, meta);
  return !st.pending;
}

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

function xiIsSalesDailyLabel(label) {
  let n = xiNormalizeLabel(label);
  return n.indexOf('売上日利') >= 0 || n === xiNormalizeLabel(XI_ROW_SALES_DAILY);
}

function xiIsSalesTotalLabel(label) {
  let n = xiNormalizeLabel(label);
  return n.indexOf('売上合計') >= 0 || n === xiNormalizeLabel(XI_ROW_SALES_TOTAL);
}

function xiSheetContainsSalesLabels(rows) {
  if (!rows || !rows.length) return false;
  for (let i = 0; i < Math.min(rows.length, 80); i++) {
    let sub = xiNormalizeLabel(xiCellLabel(rows[i]));
    if (xiIsSalesDailyLabel(sub) || xiIsSalesTotalLabel(sub)) return true;
  }
  return false;
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

function xiFindSalesDailyTotalPair(rows, startRow, maxLookahead) {
  maxLookahead = maxLookahead || 12;
  let dailyRow = -1;
  let totalRow = -1;
  for (let j = startRow + 1; j < Math.min(startRow + maxLookahead, rows.length); j++) {
    let sub = xiNormalizeLabel(xiCellLabel(rows[j]));
    let account = xiCanonicalAccountKey(sub);
    if (account && j > startRow) break;
    if (dailyRow < 0 && xiIsSalesDailyLabel(sub)) dailyRow = j;
    if (totalRow < 0 && dailyRow >= 0 && j > dailyRow && xiIsSalesTotalLabel(sub)) {
      totalRow = j;
      break;
    }
  }
  if (dailyRow >= 0 && totalRow >= 0) {
    return { dailyRow: dailyRow, totalRow: totalRow, nextIndex: totalRow + 1 };
  }
  return null;
}

function xiFindSalesOnlyBlocks(rows) {
  let blocks = [];
  let usedRows = {};
  let i = 0;
  while (i < rows.length) {
    let label = xiNormalizeLabel(xiCellLabel(rows[i]));
    let accountKey = xiCanonicalAccountKey(label);
    if (accountKey) {
      let pair = xiFindSalesDailyTotalPair(rows, i, 12);
      if (pair) {
        blocks.push({
          accountKey: accountKey,
          totalRow: i,
          salesDailyRow: pair.dailyRow,
          salesTotalRow: pair.totalRow
        });
        usedRows[i] = true;
        usedRows[pair.dailyRow] = true;
        usedRows[pair.totalRow] = true;
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
      if (xiIsSalesDailyLabel(l1) && xiIsSalesTotalLabel(l2)) {
        orphanPairs.push({ salesDailyRow: i, salesTotalRow: i + 1, totalRow: -1 });
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
        salesDailyRow: pair.salesDailyRow,
        salesTotalRow: pair.salesTotalRow
      });
    });
  }
  blocks.sort(function (a, b) {
    return XI_RAM_ACCOUNTS.indexOf(a.accountKey) - XI_RAM_ACCOUNTS.indexOf(b.accountKey);
  });
  return blocks;
}

function xiAttachSalesRowsToBlocks(blocks, rows) {
  blocks.forEach(function (block, idx) {
    block.salesDailyRow = -1;
    block.salesTotalRow = -1;
    let start = block.revRow + 1;
    let end = idx + 1 < blocks.length && blocks[idx + 1].totalRow >= 0
      ? blocks[idx + 1].totalRow
      : Math.min(start + 14, rows.length);
    for (let j = start; j < end; j++) {
      let sub = xiNormalizeLabel(xiCellLabel(rows[j]));
      if (xiIsSalesDailyLabel(sub)) block.salesDailyRow = j;
      if (xiIsSalesTotalLabel(sub)) block.salesTotalRow = j;
    }
  });
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

function xiBuildSalesStatsFromRecords(records) {
  let stats = {};
  XI_RAM_ACCOUNTS.forEach(function (key) {
    stats[key] = { days: 0 };
  });
  (records || []).forEach(function (rec) {
    if (!stats[rec.accountKey]) return;
    stats[rec.accountKey].days += 1;
  });
  return stats;
}

function xiApplyAccountIdsToRecords(records) {
  return (records || []).map(function (rec) {
    let accountId = rec.accountId || xiResolveHubAccountForKey(rec.accountKey);
    return Object.assign({}, rec, { accountId: accountId });
  });
}

function xiNormalizeSheetName(val) {
  let s = String(val == null ? '' : val).trim();
  if (s.normalize) s = s.normalize('NFKC');
  return s.replace(/\s+/g, '');
}

function xiParseSheetMeta(sheetName, kind) {
  kind = kind || 'revenue';
  let re = XI_SHEET_META_RES[kind];
  if (!re || !sheetName) return null;
  let norm = xiNormalizeSheetName(sheetName);
  let m = re.exec(norm);
  if (!m) return null;
  let reiwa = Number(m[1]);
  let calMonth = Number(m[2]);
  if (!reiwa || !calMonth || calMonth < 1 || calMonth > 12) return null;
  let year = 2018 + reiwa;
  let month = calMonth - 1;
  return {
    sheetName: sheetName,
    kind: kind,
    reiwaYear: reiwa,
    calendarMonth: calMonth,
    year: year,
    month: month,
    monthLabel: 'R' + reiwa + '.' + calMonth + '月'
  };
}

function xiCompareSheetMeta(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function xiParseSheetYearMonth(sheetName) {
  let meta = xiParseSheetMeta(sheetName, 'revenue');
  if (meta) return { year: meta.year, month: meta.month };
  let name = xiNormalizeSheetName(sheetName);
  let m = name.match(/(\d{4})[.\-/年](\d{1,2})/);
  if (m) {
    return { year: Number(m[1]), month: Number(m[2]) - 1 };
  }
  return null;
}

function xiFormatMonthLabel(year, month) {
  if (typeof pdFormatExcelImportMonthLabel === 'function') {
    return pdFormatExcelImportMonthLabel(year, month);
  }
  return 'R' + (year - 2018) + '.' + (month + 1) + '月';
}

function xiListRevenueSheets(workbook) {
  if (!workbook || !workbook.SheetNames) return [];
  let out = [];
  workbook.SheetNames.forEach(function (sn) {
    let meta = xiParseSheetMeta(sn, 'revenue');
    if (!meta) return;
    out.push(meta);
  });
  out.sort(xiCompareSheetMeta);
  return out;
}

function xiListSalesSheets(workbook) {
  if (!workbook || !workbook.SheetNames) return [];
  let out = [];
  workbook.SheetNames.forEach(function (sn) {
    let meta = xiParseSheetMeta(sn, 'sales');
    if (!meta) return;
    out.push(meta);
  });
  out.sort(xiCompareSheetMeta);
  return out;
}

function xiGetMonthImportStatus(workbook, meta) {
  let hasSales = xiMonthHasSalesInWorkbook(workbook, meta.year, meta.month, meta.sheetName);
  let importStatus = typeof pdGetExcelMonthImportStatus === 'function'
    ? pdGetExcelMonthImportStatus(meta.year, meta.month, hasSales)
    : { revenueDone: false, salesDone: false };
  let pending = !importStatus.revenueDone || (hasSales && !importStatus.salesDone);
  return {
    hasSales: hasSales,
    importStatus: importStatus,
    pending: pending
  };
}

function xiDiagnoseWorkbook(workbook) {
  let allSheets = (workbook && workbook.SheetNames) ? workbook.SheetNames.slice() : [];
  let revenueSheets = xiListRevenueSheets(workbook);
  let salesSheets = xiListSalesSheets(workbook);
  let unmatchedRevenueLike = [];
  allSheets.forEach(function (sn) {
    if (xiParseSheetMeta(sn, 'revenue')) return;
    let norm = xiNormalizeSheetName(sn);
    if (norm.indexOf('収益') >= 0) unmatchedRevenueLike.push(sn);
  });
  let pending = [];
  let imported = [];
  revenueSheets.forEach(function (meta) {
    let st = xiGetMonthImportStatus(workbook, meta);
    let entry = Object.assign({}, meta, st);
    if (st.pending) pending.push(entry);
    else imported.push(entry);
  });
  return {
    allSheets: allSheets,
    revenueSheets: revenueSheets,
    salesSheets: salesSheets,
    unmatchedRevenueLike: unmatchedRevenueLike,
    pending: pending,
    imported: imported
  };
}

function xiLogWorkbookDiagnostics(diag) {
  if (typeof console === 'undefined' || !console.group) return;
  console.group('[OUKEI HUB Excel Import] シート診断');
  console.log('① Excel内の全シート名 (' + diag.allSheets.length + '件):', diag.allSheets);
  console.log('② 収益シートとして検出 (' + diag.revenueSheets.length + '件):',
    diag.revenueSheets.map(function (m) { return m.sheetName + ' → ' + m.monthLabel; }));
  console.log('③ 売上シートとして検出 (' + diag.salesSheets.length + '件):',
    diag.salesSheets.map(function (m) { return m.sheetName + ' → ' + m.monthLabel; }));
  console.log('④ 未インポート (' + diag.pending.length + '件):',
    diag.pending.map(function (m) { return m.monthLabel + '(' + m.sheetName + ')'; }));
  console.log('⑤ インポート済み (' + diag.imported.length + '件):',
    diag.imported.map(function (m) { return m.monthLabel; }));
  if (diag.unmatchedRevenueLike.length) {
    console.warn('※ 「収益」を含むがパターン未マッチ:', diag.unmatchedRevenueLike);
  }
  console.groupEnd();
}

function xiFindSalesSheetForMonth(workbook, year, month) {
  if (!workbook || !workbook.SheetNames) return null;
  let sheets = xiListSalesSheets(workbook);
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].year === year && sheets[i].month === month) return sheets[i].sheetName;
  }
  return null;
}

function xiDetectSheetLayout(workbook, revenueSheetName, year, month) {
  let revenueRows = xiSheetToRows(workbook, revenueSheetName);
  let salesSheetName = xiFindSalesSheetForMonth(workbook, year, month);
  if (salesSheetName) {
    return { pattern: 1, patternLabel: 'パターン①（収益＋売上シート）', salesSheetName: salesSheetName };
  }
  if (xiSheetContainsSalesLabels(revenueRows)) {
    return { pattern: 2, patternLabel: 'パターン②（収益シート一体）', salesSheetName: null };
  }
  return { pattern: 0, patternLabel: '売上データなし', salesSheetName: null };
}

function xiBuildSalesRecords(blocks, rows, dayCols, year, month) {
  let records = [];
  blocks.forEach(function (block) {
    if (XI_RAM_ACCOUNTS.indexOf(block.accountKey) < 0) return;
    if (block.salesDailyRow < 0 && block.salesTotalRow < 0) return;
    let accountId = xiResolveHubAccountForKey(block.accountKey);
    dayCols.forEach(function (dc) {
      let daily = block.salesDailyRow >= 0
        ? xiParseNumber((rows[block.salesDailyRow] || [])[dc.col])
        : null;
      let total = block.salesTotalRow >= 0
        ? xiParseNumber((rows[block.salesTotalRow] || [])[dc.col])
        : null;
      if (daily == null && total == null) return;
      records.push({
        dateKey: xiBuildDateKey(year, month, dc.day),
        accountKey: block.accountKey,
        accountId: accountId,
        todaySales: daily != null ? daily : 0,
        totalSales: total
      });
    });
  });
  return xiApplyAccountIdsToRecords(records);
}

function xiMonthHasSalesInWorkbook(workbook, year, month, revenueSheetName) {
  let layout = xiDetectSheetLayout(workbook, revenueSheetName, year, month);
  if (layout.pattern === 1) return true;
  if (layout.pattern === 2) return true;
  return false;
}

function xiIsMonthPendingImport(workbook, year, month, revenueSheetName) {
  let meta = { year: year, month: month, sheetName: revenueSheetName };
  return xiGetMonthImportStatus(workbook, meta).pending;
}

function xiIsMonthImported(year, month) {
  if (typeof pdDetectImportedRamMonth === 'function') {
    return pdDetectImportedRamMonth(year, month);
  }
  return false;
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

function xiParseRamSheet(workbook, sheetName) {
  if (!workbook) {
    return { ok: false, error: 'Excelファイルが読み込まれていません。' };
  }
  if (!sheetName) {
    let sheets = xiListRevenueSheets(workbook);
    if (!sheets.length) {
      return { ok: false, error: '「収益R○.○月」形式のシートが見つかりません。' };
    }
    sheetName = sheets[0].sheetName;
  }
  let ym = xiParseSheetYearMonth(sheetName);
  if (!ym) {
    return { ok: false, error: 'シート名から年月を判別できませんでした。' };
  }
  let revenueRows = xiSheetToRows(workbook, sheetName);
  if (!revenueRows.length) {
    return { ok: false, error: 'シートにデータがありません。' };
  }
  let dayCols = xiFindDayColumns(revenueRows, ym.year, ym.month);
  let blocks = xiFindAccountBlocks(revenueRows);
  if (!blocks.length) {
    return { ok: false, error: 'kai1 / kai2 の行構成（リターン・報酬）が見つかりません。' };
  }

  let layout = xiDetectSheetLayout(workbook, sheetName, ym.year, ym.month);
  let salesRows = revenueRows;
  let salesBlocks = [];
  if (layout.pattern === 1 && layout.salesSheetName) {
    salesRows = xiSheetToRows(workbook, layout.salesSheetName);
    salesBlocks = xiFindSalesOnlyBlocks(salesRows);
    if (!salesBlocks.length) {
      return { ok: false, error: '売上シートに kai1 / kai2（売上日利・売上合計）が見つかりません。' };
    }
  } else if (layout.pattern === 2) {
    xiAttachSalesRowsToBlocks(blocks, revenueRows);
    salesBlocks = blocks;
  }

  let records = [];
  let mismatches = [];

  blocks.forEach(function (block) {
    let accountKey = block.accountKey;
    if (XI_RAM_ACCOUNTS.indexOf(accountKey) < 0) return;
    let accountId = xiResolveHubAccountForKey(accountKey);
    dayCols.forEach(function (dc) {
      let op = xiParseNumber((revenueRows[block.opRow] || [])[dc.col]);
      let rev = xiParseNumber((revenueRows[block.revRow] || [])[dc.col]);
      let totalExcel = block.totalRow >= 0
        ? xiParseNumber((revenueRows[block.totalRow] || [])[dc.col])
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
  let accountStats = xiBuildAccountStatsFromRecords(records);

  let salesRecords = [];
  let salesAccountStats = {};
  let hasSalesData = layout.pattern > 0 && salesBlocks.length > 0;
  if (hasSalesData) {
    let salesDayCols = layout.pattern === 1
      ? xiFindDayColumns(salesRows, ym.year, ym.month)
      : dayCols;
    salesRecords = xiBuildSalesRecords(salesBlocks, salesRows, salesDayCols, ym.year, ym.month);
    salesAccountStats = xiBuildSalesStatsFromRecords(salesRecords);
  }

  let importStatus = typeof pdGetExcelMonthImportStatus === 'function'
    ? pdGetExcelMonthImportStatus(ym.year, ym.month, hasSalesData)
    : { revenueDone: false, salesDone: false };

  return {
    ok: true,
    sheetName: sheetName,
    salesSheetName: layout.salesSheetName || '',
    layoutPattern: layout.pattern,
    layoutLabel: layout.patternLabel,
    year: ym.year,
    month: ym.month,
    monthLabel: xiFormatMonthLabel(ym.year, ym.month),
    records: records,
    salesRecords: salesRecords,
    accountStats: accountStats,
    salesAccountStats: salesAccountStats,
    hasSalesData: hasSalesData,
    importStatus: importStatus,
    mismatches: mismatches,
    dayColumnCount: dayCols.length
  };
}

function xiAnalyzeWorkbook(workbook) {
  let diag = xiDiagnoseWorkbook(workbook);
  xiLastDiagnostics = diag;
  xiLogWorkbookDiagnostics(diag);

  if (!diag.revenueSheets.length) {
    return {
      ok: false,
      error: '「収益R○.○月」形式のシートが見つかりません。',
      diagnostics: diag
    };
  }

  if (diag.pending.length) {
    xiImportQueue = diag.pending.slice();
    let target = diag.pending[0];
    let parsed = xiParseRamSheet(workbook, target.sheetName);
    if (!parsed.ok) return Object.assign({ diagnostics: diag }, parsed);
    parsed.pendingSheets = diag.pending;
    parsed.importedSheets = diag.imported;
    parsed.detectedSheets = diag.revenueSheets;
    parsed.importQueue = diag.pending;
    parsed.diagnostics = diag;
    parsed.unimportedLabel = target.monthLabel;
    parsed.remainingCount = diag.pending.length;
    parsed.reimportMode = false;
    parsed.reimportQueue = diag.revenueSheets;
    return parsed;
  }

  if (xiReimportSheetIndex >= diag.revenueSheets.length) xiReimportSheetIndex = 0;
  let target = diag.revenueSheets[xiReimportSheetIndex];
  xiImportQueue = [target];
  let parsed = xiParseRamSheet(workbook, target.sheetName);
  if (!parsed.ok) return Object.assign({ diagnostics: diag, allImported: true }, parsed);
  parsed.pendingSheets = [];
  parsed.importedSheets = diag.imported;
  parsed.detectedSheets = diag.revenueSheets;
  parsed.importQueue = [target];
  parsed.reimportQueue = diag.revenueSheets;
  parsed.diagnostics = diag;
  parsed.unimportedLabel = target.monthLabel;
  parsed.remainingCount = 0;
  parsed.allImported = true;
  parsed.reimportMode = true;
  return parsed;
}

function xiFindRevenueSheetMeta(sheetName) {
  if (!sheetName || !xiLastDiagnostics || !xiLastDiagnostics.revenueSheets) return null;
  for (let i = 0; i < xiLastDiagnostics.revenueSheets.length; i++) {
    if (xiLastDiagnostics.revenueSheets[i].sheetName === sheetName) {
      return xiLastDiagnostics.revenueSheets[i];
    }
  }
  return null;
}

function xiApplyWorkbookContextToParsed(parsed, meta, diag) {
  let isReimport = xiMonthImportIsComplete(xiPendingWorkbook, meta);
  parsed.pendingSheets = diag.pending;
  parsed.importedSheets = diag.imported;
  parsed.detectedSheets = diag.revenueSheets;
  parsed.diagnostics = diag;
  parsed.reimportMode = isReimport;
  parsed.importQueue = [meta];
  parsed.reimportQueue = diag.revenueSheets;
  parsed.unimportedLabel = meta.monthLabel;
  parsed.remainingCount = diag.pending.length;
  parsed.allImported = !diag.pending.length;
  return parsed;
}

function xiSelectImportMonth(sheetName) {
  if (!xiPendingWorkbook || !sheetName) return;
  let diag = xiLastDiagnostics || xiDiagnoseWorkbook(xiPendingWorkbook);
  xiLastDiagnostics = diag;
  let meta = xiFindRevenueSheetMeta(sheetName);
  if (!meta) {
    meta = diag.revenueSheets.find(function (m) { return m.sheetName === sheetName; });
  }
  if (!meta) return;

  let parsed = xiParseRamSheet(xiPendingWorkbook, sheetName);
  if (!parsed.ok) {
    alert(parsed.error || '解析に失敗しました。');
    return;
  }
  xiApplyWorkbookContextToParsed(parsed, meta, diag);
  xiImportQueue = [meta];
  xiPendingImport = parsed;
  xiLastImportResult = null;

  for (let i = 0; i < diag.revenueSheets.length; i++) {
    if (diag.revenueSheets[i].sheetName === sheetName) {
      xiReimportSheetIndex = i;
      break;
    }
  }

  xiRenderImportPage();
  let previewEl = document.querySelector('#xiMain .xiPreview');
  if (previewEl && typeof previewEl.scrollIntoView === 'function') {
    previewEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  if (typeof showToast === 'function') {
    showToast('✅ ' + meta.monthLabel + (parsed.reimportMode ? '（再インポート）' : '') + 'を選択しました');
  }
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

function xiRenderDetectionPanel(diag, selectedSheetName) {
  if (!diag || !diag.revenueSheets.length) return '';
  let clickable = !!xiPendingWorkbook;
  let rows = diag.revenueSheets.map(function (meta) {
    let st = xiGetMonthImportStatus(xiPendingWorkbook, meta);
    let badge = st.pending ? '未' : '済';
    let cls = st.pending ? 'xiDetectPending' : 'xiDetectDone';
    if (clickable) cls += ' xiDetectClickable';
    if (selectedSheetName && meta.sheetName === selectedSheetName) cls += ' xiDetectSelected';
    let action = '';
    if (clickable) {
      action = st.pending
        ? '<em class="xiDetectAction">取込</em>'
        : '<em class="xiDetectAction">再インポート</em>';
    }
    let clickAttr = clickable
      ? ' data-xi-sheet="' + xiEscape(meta.sheetName) + '" role="button" tabindex="0"'
      : '';
    return '<div class="xiDetectRow ' + cls + '"' + clickAttr + '><span>' + xiEscape(meta.monthLabel) + '</span>' +
      '<small>' + xiEscape(meta.sheetName) + '</small><b>' + badge + action + '</b></div>';
  }).join('');
  let note = '検出 ' + diag.revenueSheets.length + '件';
  if (diag.pending.length) note += ' / 未インポート ' + diag.pending.length + '件';
  if (!diag.pending.length) note += ' / すべてインポート済み';
  let pickHelp = clickable
    ? '<p class="help xiDetectPickHelp">取込・再インポートする月を一覧から選択してください（済＝再インポート、未＝新規取込）。</p>'
    : '';
  return '<div class="xiInfo panel xiDetectPanel">' +
    '<div class="xiStepTitle">収益シート検出一覧（' + note + '）</div>' +
    pickHelp +
    '<p class="help">古い順: ' + diag.revenueSheets.map(function (m) { return m.monthLabel; }).join(' → ') + '</p>' +
    rows +
    (diag.unmatchedRevenueLike.length
      ? '<p class="help xiWarn">未マッチ: ' + xiEscape(diag.unmatchedRevenueLike.join('、')) + '</p>'
      : '') +
    '</div>';
}

function xiRenderImportedMonthsNote(importedSheets) {
  if (!importedSheets || !importedSheets.length) return '';
  let labels = importedSheets.map(function (s) { return s.monthLabel; }).join('、');
  return '<div class="xiInfo">インポート済み: ' + xiEscape(labels) + '</div>';
}

function xiBindImportPageEvents() {
  let el = document.getElementById('xiMain');
  if (!el || el.dataset.xiEventsBound === '1') return;
  el.dataset.xiEventsBound = '1';
  el.addEventListener('click', function (e) {
    let row = e.target.closest('.xiDetectClickable[data-xi-sheet]');
    if (!row) return;
    let sheetName = row.getAttribute('data-xi-sheet');
    if (sheetName) xiSelectImportMonth(sheetName);
  });
  el.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    let row = e.target.closest('.xiDetectClickable[data-xi-sheet]');
    if (!row) return;
    e.preventDefault();
    xiSelectImportMonth(row.getAttribute('data-xi-sheet'));
  });
}

function xiRenderImportPage() {
  let el = document.getElementById('xiMain');
  if (!el) return;
  let preview = xiPendingImport;
  let previewHtml = '';
  let detectionHtml = xiLastDiagnostics
    ? xiRenderDetectionPanel(xiLastDiagnostics, preview && preview.sheetName)
    : '';
  if (preview && preview.ok) {
    let totalRecords = (preview.records || []).length;
    let totalSalesRecords = (preview.salesRecords || []).length;
    let status = preview.importStatus || {};
    let statsRows = XI_RAM_ACCOUNTS.map(function (key) {
      let st = preview.accountStats[key] || { days: 0, mapped: false, hubLabel: '' };
      let salesSt = (preview.salesAccountStats && preview.salesAccountStats[key]) || { days: 0 };
      let mapLabel = st.mapped
        ? 'HUB連携: ' + xiEscape(st.hubLabel || key)
        : '要確認（HUBにアカウント未登録）';
      let salesNote = preview.hasSalesData ? ' / 売上' + salesSt.days + '日' : '';
      return '<div class="xiPreviewRow"><span>' + xiEscape(key) + '</span><b>収益' + st.days + '日' + salesNote + '</b><small>' + mapLabel + '</small></div>';
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
    let statusNote = '';
    if (preview.reimportMode) {
      statusNote = '<div class="xiInfo xiWarn">この月はインポート済みです。再インポートすると、当該月のExcel取込データのみ上書きされます（手入力・他月・組織図は変更されません）。別の月は上の一覧から選択してください。</div>';
    } else if (status.revenueDone && !status.salesDone && preview.hasSalesData) {
      statusNote = '<div class="xiInfo">収益はインポート済みです。今回は売上データのみ取り込みます。</div>';
    } else if (!status.revenueDone && status.salesDone) {
      statusNote = '<div class="xiInfo">売上はインポート済みです。今回は収益データのみ取り込みます。</div>';
    }
    let layoutNote = preview.layoutLabel
      ? '<div class="xiPreviewMeta"><span>シート構成</span><b>' + xiEscape(preview.layoutLabel) + '</b></div>'
      : '';
    let salesSheetNote = preview.salesSheetName
      ? '<div class="xiPreviewMeta"><span>売上シート</span><b>' + xiEscape(preview.salesSheetName) + '</b></div>'
      : (preview.hasSalesData
        ? '<div class="xiPreviewMeta"><span>売上シート</span><b>（収益シート内）</b></div>'
        : '');
    let detectNote = '';
    if (preview.detectedSheets && preview.detectedSheets.length > 1) {
      detectNote = '<div class="xiInfo">検出シート: ' +
        preview.detectedSheets.map(function (s) { return xiEscape(s.sheetName); }).join(' / ') +
        '</div>';
    }
    let importedNote = xiRenderImportedMonthsNote(preview.importedSheets);
    let queueCount = (preview.importQueue || preview.pendingSheets || []).length;
    let remainingNote = '';
    if (preview.reimportMode) {
      remainingNote = '<div class="xiInfo">対象: ' + xiEscape(preview.monthLabel) + '（再インポート）</div>';
    } else if (queueCount > 1) {
      remainingNote = '<div class="xiInfo">未インポート ' + queueCount + 'ヶ月を古い順に一括インポートします（' +
        (preview.importQueue || preview.pendingSheets).map(function (m) { return m.monthLabel; }).join(' → ') +
        '）</div>';
    }
    let totalLine = '収益 ' + totalRecords + '件';
    if (preview.hasSalesData) totalLine += ' / 売上 ' + totalSalesRecords + '件';
    previewHtml =
      '<div class="xiPreview panel">' +
      '<div class="xiPreviewTitle">プレビュー</div>' +
      '<p class="help xiPreviewLead">' +
      (preview.reimportMode
        ? xiEscape(preview.monthLabel) + 'の再インポート内容を確認してください。'
        : xiEscape(preview.unimportedLabel || preview.monthLabel) + 'データを検出しました。内容を確認してインポートしてください。') +
      '</p>' +
      detectNote +
      importedNote +
      statusNote +
      layoutNote +
      '<div class="xiPreviewMeta"><span>対象シート（収益）</span><b>' + xiEscape(preview.sheetName) + '</b></div>' +
      salesSheetNote +
      '<div class="xiPreviewMeta"><span>対象月</span><b>' + xiEscape(preview.unimportedLabel || preview.monthLabel) + '</b></div>' +
      '<div class="xiPreviewMeta"><span>読み込み件数</span></div>' +
      statsRows +
      '<div class="xiPreviewMeta xiPreviewTotal"><span>合計</span><b>' + totalLine + '</b></div>' +
      remainingNote +
      warnHtml +
      '<div class="xiPreviewActions">' +
      '<button type="button" class="btn2" onclick="xiResetImport()">ファイルを選び直す</button>' +
      '<button type="button" id="xiImportBtn" onclick="xiExecuteImport()">' +
      (preview.reimportMode ? '再インポート開始' : 'インポート開始') +
      '</button>' +
      '</div></div>';
  }

  let importedListHtml = '';
  if (typeof pdListExcelImportedMonthKeys === 'function') {
    let keys = pdListExcelImportedMonthKeys();
    if (keys.length) {
      importedListHtml = '<div class="xiInfo panel">' +
        '<div class="xiStepTitle">移行済みの月</div>' +
        '<p class="help">' + keys.map(function (k) {
          let p = k.split('-');
          if (p.length !== 2) return xiEscape(k);
          return xiEscape(xiFormatMonthLabel(Number(p[0]), Number(p[1]) - 1));
        }).join('、') + '</p></div>';
    }
  }

  el.innerHTML =
    '<div class="xiStep panel">' +
    '<div class="xiStepNum">①</div>' +
    '<div class="xiStepBody">' +
    '<div class="xiStepTitle">Excelファイルを選択</div>' +
    '<p class="help">RAM管理Excel（ポートフォリオ.xlsx）から過去の収益・売上実績を移行します。「収益R○.○月」「売上R○.○月」を自動検出し、シート構成（パターン①/②）も自動判定します。</p>' +
    '<p class="help">※インポート済みの月も再インポートできます（当該月のExcel取込分のみ上書き）。以後の日常入力はOUKEI HUBで行います。</p>' +
    '<button type="button" class="btn2" onclick="document.getElementById(\'xiFileInput\').click()">Excelファイルを選択</button>' +
    '<input id="xiFileInput" type="file" accept=".xlsx,.xls,.xlsm" class="hidden" onchange="xiHandleFileSelect(event)">' +
    '</div></div>' +
    '<div class="xiStep panel">' +
    '<div class="xiStepNum">②</div>' +
    '<div class="xiStepBody">' +
    '<div class="xiStepTitle">収益シートを解析</div>' +
    '<p class="help">収益: リターン→運用 / 報酬→本日収益。売上: 売上日利→売上 / 売上合計→累計売上。インポート済みの月も、当該月のExcel取込データのみ上書き再インポートできます。</p>' +
    '</div></div>' +
    importedListHtml +
    detectionHtml +
    previewHtml +
    (xiLastImportResult
      ? '<div class="xiPreview panel xiSuccess">' +
        '<div class="xiPreviewTitle">インポート完了</div>' +
        '<div class="xiPreviewMeta"><span>対象シート</span><b>' + xiEscape(xiLastImportResult.sheetName || '') + '</b></div>' +
        '<div class="xiPreviewMeta"><span>取込月数</span><b>' + (xiLastImportResult.monthsImported || 1) + 'ヶ月</b></div>' +
        '<div class="xiPreviewMeta"><span>取込件数</span><b>収益' + (xiLastImportResult.revenueImported || 0) + ' / 売上' + (xiLastImportResult.salesImported || 0) + '</b></div>' +
        '<div class="xiPreviewMeta"><span>合計</span><b>' + xiLastImportResult.imported + '件</b></div>' +
        '<div class="xiPreviewMeta"><span>対象日数</span><b>' + xiLastImportResult.dates + '日</b></div>' +
        (xiLastImportResult.remainingCount > 0
          ? '<p class="help xiPreviewOk">未インポート月が残っています。同じファイルで続けてインポートできます。</p>' +
            '<div class="xiPreviewActions"><button type="button" class="btn2" onclick="xiContinueNextMonth()">次の月をインポート</button></div>'
          : (xiLastImportResult.reimportMode && xiLastImportResult.reimportRemaining > 0
            ? '<p class="help xiPreviewOk">他の月も再インポートできます。</p>' +
              '<div class="xiPreviewActions"><button type="button" class="btn2" onclick="xiContinueNextMonth()">次の月を再インポート</button></div>'
            : '<p class="help xiPreviewOk">' +
              (xiLastImportResult.reimportMode
                ? '再インポートが完了しました。'
                : '過去データの移行が完了しました。以後はOUKEI HUBで実績管理してください。') +
              '</p>')) +
        '</div>'
      : '') +
    (xiUndoSnapshot ? '<div class="xiUndo panel"><button type="button" class="btnDanger" onclick="xiUndoImport()">直前のインポートを元に戻す</button></div>' : '');
}

function xiResetImport() {
  xiPendingImport = null;
  xiPendingWorkbook = null;
  xiLastImportResult = null;
  xiImportQueue = [];
  xiLastDiagnostics = null;
  xiReimportSheetIndex = 0;
  let input = document.getElementById('xiFileInput');
  if (input) input.value = '';
  xiRenderImportPage();
}

function xiContinueNextMonth() {
  if (!xiPendingWorkbook) {
    alert('Excelファイルを再度選択してください。');
    return;
  }
  let wasReimport = xiPendingImport && xiPendingImport.reimportMode;
  if (wasReimport && xiPendingImport.reimportQueue && xiPendingImport.reimportQueue.length > 1) {
    xiReimportSheetIndex = (xiReimportSheetIndex + 1) % xiPendingImport.reimportQueue.length;
  }
  let analyzed = xiAnalyzeWorkbook(xiPendingWorkbook);
  if (!analyzed.ok) {
    alert(analyzed.error || '解析に失敗しました。');
    return;
  }
  xiPendingImport = analyzed;
  xiLastImportResult = null;
  xiRenderImportPage();
  if (typeof showToast === 'function') {
    let label = analyzed.unimportedLabel || analyzed.monthLabel;
    showToast('✅ ' + label + (analyzed.reimportMode ? '（再インポート）' : '') + 'を解析しました');
  }
}

function xiHandleFileSelect(ev) {
  let file = ev.target.files && ev.target.files[0];
  if (!file) return;
  xiReadExcelFile(file).then(function (wb) {
    xiPendingWorkbook = wb;
    xiLastImportResult = null;
    xiReimportSheetIndex = 0;
    let analyzed = xiAnalyzeWorkbook(wb);
    if (!analyzed.ok) {
      alert(analyzed.error || '解析に失敗しました。');
      xiResetImport();
      return;
    }
    xiPendingImport = analyzed;
    xiRenderImportPage();
    if (typeof showToast === 'function') {
      let label = analyzed.unimportedLabel || analyzed.monthLabel;
      showToast('✅ ' + label + (analyzed.reimportMode ? '（再インポート可能・一覧から月を選択）' : 'データを検出しました'));
    }
  }).catch(function (err) {
    alert(err.message || 'Excelの読込に失敗しました。');
    xiResetImport();
  });
}

function xiImportSingleMonth(parsed, options) {
  options = options || {};
  let status = parsed.importStatus || {};
  let forceReimport = !!options.forceReimport;
  let revenueRecords = xiApplyAccountIdsToRecords(parsed.records || []);
  let salesRecords = xiApplyAccountIdsToRecords(parsed.salesRecords || []);
  let importableRev = forceReimport
    ? revenueRecords.filter(function (r) { return r.accountId; })
    : (status.revenueDone ? [] : revenueRecords.filter(function (r) { return r.accountId; }));
  let importableSales = forceReimport
    ? (parsed.hasSalesData ? salesRecords.filter(function (r) { return r.accountId; }) : [])
    : ((status.salesDone || !parsed.hasSalesData)
      ? []
      : salesRecords.filter(function (r) { return r.accountId; }));
  if (!importableRev.length && !importableSales.length) {
    return { ok: false, error: (parsed.monthLabel || parsed.sheetName) + ': インポート可能なデータがありません。' };
  }
  let importMeta = {
    year: parsed.year,
    month: parsed.month,
    sheetName: parsed.sheetName,
    salesSheetName: parsed.salesSheetName || '',
    layoutPattern: parsed.layoutPattern || 0,
    hasSalesData: parsed.hasSalesData,
    revenueDone: forceReimport ? false : status.revenueDone,
    salesDone: forceReimport ? false : status.salesDone,
    forceReimport: forceReimport
  };
  let result = typeof pdImportRamExcelMonth === 'function'
    ? pdImportRamExcelMonth(
      importableRev.map(function (rec) {
        return {
          dateKey: rec.dateKey,
          accountId: rec.accountId,
          operationRevenue: rec.operationRevenue,
          todayRevenue: rec.todayRevenue
        };
      }),
      importableSales.map(function (rec) {
        return {
          dateKey: rec.dateKey,
          accountId: rec.accountId,
          todaySales: rec.todaySales,
          totalSales: rec.totalSales
        };
      }),
      importMeta
    )
    : { imported: 0, revenueImported: 0, salesImported: 0, dates: 0 };
  return { ok: true, result: result, parsed: parsed };
}

function xiConfirmMonthOverwrite(monthLabels) {
  return new Promise(function (resolve) {
    let overlay = document.getElementById('xiOverwriteConfirm');
    let textEl = document.getElementById('xiOverwriteConfirmText');
    if (!overlay || !textEl) {
      resolve(confirm(monthLabels.join('、') + 'は既にインポートされています。\nこの月のデータを上書きしますか？'));
      return;
    }
    textEl.textContent = monthLabels.join('、') + 'は既にインポートされています。\nこの月のデータを上書きしますか？';
    overlay.classList.remove('hidden');
    xiOverwriteResolve = resolve;
  });
}

function xiAcceptMonthOverwrite() {
  let overlay = document.getElementById('xiOverwriteConfirm');
  if (overlay) overlay.classList.add('hidden');
  if (xiOverwriteResolve) xiOverwriteResolve(true);
  xiOverwriteResolve = null;
}

function xiCancelMonthOverwrite() {
  let overlay = document.getElementById('xiOverwriteConfirm');
  if (overlay) overlay.classList.add('hidden');
  if (xiOverwriteResolve) xiOverwriteResolve(false);
  xiOverwriteResolve = null;
}

function xiRunImportQueue(queue) {
  if (typeof pdCreatePerformanceSnapshot === 'function') {
    xiUndoSnapshot = pdCreatePerformanceSnapshot();
  }

  let reimportMode = !!(xiPendingImport && xiPendingImport.reimportMode);
  let reimportQueue = xiPendingImport && xiPendingImport.reimportQueue;

  let total = { imported: 0, revenueImported: 0, salesImported: 0, dates: 0, months: 0 };
  let lastSheetName = '';
  let lastMonthLabel = '';
  let failed = '';

  for (let i = 0; i < queue.length; i++) {
    let monthInfo = queue[i];
    let parsed = xiParseRamSheet(xiPendingWorkbook, monthInfo.sheetName);
    if (!parsed.ok) {
      failed = (monthInfo.monthLabel || monthInfo.sheetName) + ': ' + (parsed.error || '解析失敗');
      break;
    }
    let forceReimport = xiMonthImportIsComplete(xiPendingWorkbook, monthInfo);
    let one = xiImportSingleMonth(parsed, { forceReimport: forceReimport });
    if (!one.ok) {
      failed = one.error || 'インポート失敗';
      break;
    }
    total.imported += one.result.imported || 0;
    total.revenueImported += one.result.revenueImported || 0;
    total.salesImported += one.result.salesImported || 0;
    total.dates = Math.max(total.dates, one.result.dates || 0);
    total.months += 1;
    lastSheetName = parsed.sheetName;
    lastMonthLabel = parsed.monthLabel;
    if (typeof hubSetViewMonth === 'function') {
      hubSetViewMonth(parsed.year, parsed.month);
    }
  }

  if (typeof updateHomeDashboard === 'function' && typeof allOrgSummary === 'function') {
    updateHomeDashboard(allOrgSummary());
  }
  if (typeof renderPortfolio === 'function') renderPortfolio();
  if (typeof renderRevenueManage === 'function') renderRevenueManage();
  if (typeof renderSalesManage === 'function') renderSalesManage();
  if (typeof render === 'function') render();

  xiImportQueue = [];
  xiPendingImport = null;
  if (xiPendingWorkbook) {
    xiLastDiagnostics = xiDiagnoseWorkbook(xiPendingWorkbook);
    xiLogWorkbookDiagnostics(xiLastDiagnostics);
  }

  let remaining = xiLastDiagnostics ? xiLastDiagnostics.pending.length : 0;
  let reimportRemaining = reimportQueue ? Math.max(0, reimportQueue.length - 1) : 0;
  xiLastImportResult = {
    imported: total.imported,
    revenueImported: total.revenueImported,
    salesImported: total.salesImported,
    dates: total.dates,
    monthsImported: total.months,
    sheetName: lastSheetName,
    monthLabel: lastMonthLabel,
    remainingCount: remaining,
    reimportMode: reimportMode,
    reimportRemaining: reimportRemaining,
    failed: failed
  };
  xiRenderImportPage();

  if (failed) {
    alert('インポートを中断しました。\n' + failed + '\n\n成功: ' + total.months + 'ヶ月 / ' + total.imported + '件');
  } else if (typeof showToast === 'function') {
    showToast('✅ ' + total.months + 'ヶ月・' + total.imported + '件インポートしました');
  }
}

function xiExecuteImport() {
  if (!xiPendingImport || !xiPendingImport.ok || !xiPendingWorkbook) return;
  let queue = (xiImportQueue && xiImportQueue.length)
    ? xiImportQueue.slice()
    : (xiPendingImport.importQueue || xiPendingImport.pendingSheets || [xiPendingImport]).slice();
  if (!queue.length) {
    alert('インポート対象がありません。');
    return;
  }

  let firstParsed = xiPendingImport;
  let revenueRecords = xiApplyAccountIdsToRecords(firstParsed.records || []);
  let salesRecords = xiApplyAccountIdsToRecords(firstParsed.salesRecords || []);
  let unmapped = XI_RAM_ACCOUNTS.filter(function (k) {
    return !revenueRecords.some(function (r) { return r.accountKey === k && r.accountId; }) &&
      !(firstParsed.hasSalesData && salesRecords.some(function (r) { return r.accountKey === k && r.accountId; }));
  });
  if (unmapped.length) {
    alert('HUBアカウント（' + unmapped.join(', ') + '）が見つかりません。\n組織図のRAMアカウント（ユーザー名 kai1 / kai2）を確認してください。');
    return;
  }

  let overwriteLabels = [];
  queue.forEach(function (monthInfo) {
    if (xiMonthImportIsComplete(xiPendingWorkbook, monthInfo)) {
      overwriteLabels.push(monthInfo.monthLabel || xiFormatMonthLabel(monthInfo.year, monthInfo.month));
    }
  });
  if (overwriteLabels.length) {
    xiConfirmMonthOverwrite(overwriteLabels).then(function (ok) {
      if (!ok) return;
      xiRunImportQueue(queue);
    });
    return;
  }

  let queueLabels = queue.map(function (m) { return m.monthLabel; }).join(' → ');
  let confirmMsg = '未インポート ' + queue.length + 'ヶ月を古い順にインポートします。\n\n' +
    queueLabels + '\n\n既存の同日データは上書きされます。\n実行しますか？';
  if (!confirm(confirmMsg)) return;
  xiRunImportQueue(queue);
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
      if (typeof orcaImportPage !== 'undefined') orcaImportPage.classList.add('hidden');
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
    document.addEventListener('DOMContentLoaded', function () {
      xiHookShowPage();
      xiBindImportPageEvents();
    });
  } else {
    xiHookShowPage();
    xiBindImportPageEvents();
  }
}

if (typeof window !== 'undefined') {
  window.openExcelImportPage = openExcelImportPage;
  window.xiHandleFileSelect = xiHandleFileSelect;
  window.xiExecuteImport = xiExecuteImport;
  window.xiResetImport = xiResetImport;
  window.xiUndoImport = xiUndoImport;
  window.xiSelectImportMonth = xiSelectImportMonth;
  window.xiContinueNextMonth = xiContinueNextMonth;
  window.xiAcceptMonthOverwrite = xiAcceptMonthOverwrite;
  window.xiCancelMonthOverwrite = xiCancelMonthOverwrite;
  window.xiParseRamSheet = xiParseRamSheet;
  window.xiListRevenueSheets = xiListRevenueSheets;
  window.xiDiagnoseWorkbook = xiDiagnoseWorkbook;
  window.xiLogWorkbookDiagnostics = xiLogWorkbookDiagnostics;
}
