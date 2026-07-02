/* OUKEI HUB ORCA Import — Ver2.0.3
 * Paste AI profit history → yesterdayAiProfit
 * Paste USDT wallet history → todayAffiliateProfit (本日AF収益)
 */

var oiPendingPreview = null;
var oiUndoSnapshot = null;
var oiLastImportResult = null;

var OI_WALLET_TYPES = {
  ranking: 'ランキングボーナス',
  override: 'アフィリエイトオーバーライド'
};

function oiRoundAmount4(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function oiFormatAmount4(n) {
  if (n == null || isNaN(n)) return '—';
  return String(oiRoundAmount4(n));
}

function oiEscape(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function oiNormalize(text) {
  let s = String(text == null ? '' : text);
  if (s.normalize) s = s.normalize('NFKC');
  return s.replace(/[\s　]/g, '').toLowerCase();
}

function oiFormatDisplayDate(dateKey) {
  if (!dateKey) return '';
  let p = dateKey.split('-');
  if (p.length !== 3) return dateKey;
  return p[0] + '/' + String(Number(p[1])).padStart(2, '0') + '/' + String(Number(p[2])).padStart(2, '0');
}

function oiParseDateKey(line) {
  if (!line) return null;
  let s = String(line);
  if (s.normalize) s = s.normalize('NFKC');

  let m = s.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (m) {
    let y = Number(m[1]);
    let mo = Number(m[2]);
    let d = Number(m[3]);
    if (y >= 2000 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
  }

  m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    let y2 = Number(m[1]);
    let mo2 = Number(m[2]);
    let d2 = Number(m[3]);
    if (y2 >= 2000 && mo2 >= 1 && mo2 <= 12 && d2 >= 1 && d2 <= 31) {
      return y2 + '-' + String(mo2).padStart(2, '0') + '-' + String(d2).padStart(2, '0');
    }
  }
  return null;
}

function oiStripDateTimeText(line) {
  let work = String(line);
  if (work.normalize) work = work.normalize('NFKC');
  work = work.replace(/\d{4}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2}(?:日)?/g, ' ');
  work = work.replace(/\d{4}-\d{1,2}-\d{1,2}/g, ' ');
  work = work.replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ');
  return work;
}

function oiParseDecimalToken(token) {
  if (token == null || token === '') return null;
  let s = String(token).trim();
  if (s.normalize) s = s.normalize('NFKC');
  s = s.replace(/,/g, '').replace(/[^\d.\-+]/g, '');
  if (!/^[+\-]?\d+\.\d{1,4}$/.test(s)) return null;
  let n = Number(s);
  if (isNaN(n)) return null;
  return oiRoundAmount4(Math.abs(n));
}

function oiFindDecimalAmounts(text) {
  let amounts = [];
  let re = /[+\-]?(\d+\.\d{1,4})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    amounts.push(oiRoundAmount4(Math.abs(Number(m[1]))));
  }
  return amounts;
}

function oiDetectAiAmountColumnIndex(headerLine) {
  let parts = headerLine.split('\t');
  for (let i = 0; i < parts.length; i++) {
    let n = oiNormalize(parts[i]);
    if (n.indexOf('ai利益') >= 0 || n.indexOf('aiprofit') >= 0) return i;
    if (n.indexOf('利益') >= 0 && n.indexOf('af') < 0 && n.indexOf('アフィ') < 0) return i;
    if (n === 'amount' || n === '金額') return i;
  }
  return -1;
}

function oiParseAiProfitAmount(line, dateKey, amountCol) {
  if (amountCol >= 0 && line.indexOf('\t') >= 0) {
    let parts = line.split('\t');
    if (parts.length > amountCol) {
      let fromCol = oiParseDecimalToken(parts[amountCol]);
      if (fromCol != null) return fromCol;
    }
  }

  if (line.indexOf('\t') >= 0) {
    let parts = line.split('\t');
    let decimals = [];
    parts.forEach(function (part) {
      let v = oiParseDecimalToken(String(part).trim());
      if (v != null) decimals.push(v);
    });
    if (decimals.length === 1) return decimals[0];
    if (decimals.length > 1) return decimals[0];
  }

  let work = oiStripDateTimeText(line);
  let decimals = oiFindDecimalAmounts(work);
  if (decimals.length >= 1) return decimals[0];

  return null;
}

function oiParseAmount(line, dateKey) {
  return oiParseAiProfitAmount(line, dateKey, -1);
}

function oiIsHeaderLine(line) {
  let n = oiNormalize(line);
  if (!n) return true;
  if (/^(日付|date|種類|タイプ|type|金額|amount|履歴|history|備考|note)$/.test(n)) return true;
  if (n.indexOf('日付') >= 0 && n.indexOf('金額') >= 0) return true;
  return false;
}

function oiIsWithdrawalLine(line) {
  return oiNormalize(line).indexOf('出金') >= 0;
}

function oiIsRankingBonusLine(line) {
  let n = oiNormalize(line);
  return n.indexOf('ランキングボーナス') >= 0 ||
    (n.indexOf('ランキング') >= 0 && n.indexOf('ボーナス') >= 0);
}

function oiIsAffiliateOverrideLine(line) {
  let n = oiNormalize(line);
  return n.indexOf('アフィリエイトオーバーライド') >= 0 ||
    (n.indexOf('アフィリエイト') >= 0 && n.indexOf('オーバーライド') >= 0);
}

function oiIsWalletRevenueLine(line) {
  if (oiIsWithdrawalLine(line)) return false;
  return oiIsRankingBonusLine(line) || oiIsAffiliateOverrideLine(line);
}

function oiSplitLines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(function (line) { return line.trim(); })
    .filter(function (line) { return !!line; });
}

function oiIsAiProfitLabel(line) {
  let n = oiNormalize(line);
  return n === 'ai利益' || n.indexOf('ai利益') >= 0;
}

function oiParseStandaloneAmount(line) {
  if (line == null || line === '') return null;
  let s = String(line).trim();
  if (s.normalize) s = s.normalize('NFKC');
  s = s.replace(/,/g, '').replace(/[^\d.\-+]/g, '');
  if (!/^[+\-]?\d+\.\d{1,4}$/.test(s)) return null;
  let n = Number(s);
  if (isNaN(n)) return null;
  return oiRoundAmount4(Math.abs(n));
}

function oiParseWalletAmount(line) {
  if (line == null || line === '') return null;
  let s = String(line).trim();
  if (s.normalize) s = s.normalize('NFKC');
  s = s.replace(/,/g, '').replace(/[^\d.\-+]/g, '');
  if (/^[+\-]?\d+\.\d{1,4}$/.test(s)) {
    return oiRoundAmount4(Math.abs(Number(s)));
  }
  if (/^[+\-]?\d+$/.test(s)) {
    return oiRoundAmount4(Math.abs(Number(s)));
  }
  return null;
}

function oiIsUsdtWalletLabel(line) {
  let n = oiNormalize(line);
  return n.indexOf('usdt') >= 0 && (n.indexOf('ウォレット') >= 0 || n.indexOf('wallet') >= 0);
}

function oiParseAiProfitHistoryBlockFormat(lines) {
  let rows = [];
  let pendingDate = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let dateKey = oiParseDateKey(line);
    if (dateKey) {
      pendingDate = dateKey;
      continue;
    }
    if (!oiIsAiProfitLabel(line)) continue;
    let amount = null;
    if (i + 1 < lines.length) {
      amount = oiParseStandaloneAmount(lines[i + 1]);
      if (amount != null) i += 1;
    }
    if (amount == null) amount = oiParseAiProfitAmount(line, pendingDate, -1);
    if (amount != null && pendingDate) {
      rows.push({ dateKey: pendingDate, amount: amount, source: 'ai' });
    }
  }
  return rows;
}

function oiParseAiProfitHistoryInlineFormat(lines, amountCol) {
  let rows = [];
  let skipped = 0;
  lines.forEach(function (line) {
    if (oiIsHeaderLine(line)) {
      skipped += 1;
      return;
    }
    if (oiIsWithdrawalLine(line)) {
      skipped += 1;
      return;
    }
    if (oiIsWalletRevenueLine(line)) {
      skipped += 1;
      return;
    }
    let dateKey = oiParseDateKey(line);
    if (!dateKey) {
      skipped += 1;
      return;
    }
    let amount = oiParseAiProfitAmount(line, dateKey, amountCol);
    if (amount == null) {
      skipped += 1;
      return;
    }
    rows.push({ dateKey: dateKey, amount: amount, source: 'ai' });
  });
  return { rows: rows, skipped: skipped };
}

function oiParseAiProfitHistory(text) {
  let lines = oiSplitLines(text);
  if (!lines.length) return { rows: [], skipped: 0 };

  let hasBlockFormat = lines.some(function (line) { return oiIsAiProfitLabel(line); });
  if (hasBlockFormat) {
    let blockRows = oiParseAiProfitHistoryBlockFormat(lines);
    if (blockRows.length) {
      return { rows: blockRows, skipped: Math.max(0, lines.length - blockRows.length * 4) };
    }
  }

  let amountCol = -1;
  lines.forEach(function (line) {
    if (amountCol >= 0) return;
    if (line.indexOf('\t') >= 0 && oiIsHeaderLine(line)) {
      amountCol = oiDetectAiAmountColumnIndex(line);
    }
  });
  return oiParseAiProfitHistoryInlineFormat(lines, amountCol);
}

function oiParseUsdtWalletHistoryBlockFormat(lines) {
  let rows = [];
  let ignoredWithdrawals = 0;
  let pendingDate = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let dateKey = oiParseDateKey(line);
    if (dateKey) {
      pendingDate = dateKey;
      continue;
    }
    if (oiIsUsdtWalletLabel(line)) continue;
    if (oiIsWithdrawalLine(line)) {
      ignoredWithdrawals += 1;
      if (i + 1 < lines.length && oiParseWalletAmount(lines[i + 1]) != null) i += 1;
      continue;
    }
    if (!oiIsWalletRevenueLine(line)) continue;
    let amount = null;
    if (i + 1 < lines.length) {
      amount = oiParseWalletAmount(lines[i + 1]);
      if (amount != null) i += 1;
    }
    if (amount != null && pendingDate) {
      let type = oiIsRankingBonusLine(line) ? OI_WALLET_TYPES.ranking : OI_WALLET_TYPES.override;
      rows.push({ dateKey: pendingDate, amount: amount, source: 'wallet', walletType: type });
    }
  }
  return { rows: rows, ignoredWithdrawals: ignoredWithdrawals };
}

function oiParseUsdtWalletHistory(text) {
  let lines = oiSplitLines(text);
  if (!lines.length) return { rows: [], skipped: 0, ignoredWithdrawals: 0 };

  let hasBlockFormat = lines.some(function (line) {
    return oiIsUsdtWalletLabel(line) || oiIsWalletRevenueLine(line) || oiIsWithdrawalLine(line);
  });
  if (hasBlockFormat) {
    let parsed = oiParseUsdtWalletHistoryBlockFormat(lines);
    if (parsed.rows.length || parsed.ignoredWithdrawals) {
      return {
        rows: parsed.rows,
        skipped: Math.max(0, lines.length - parsed.rows.length * 4),
        ignoredWithdrawals: parsed.ignoredWithdrawals
      };
    }
  }

  let rows = [];
  let skipped = 0;
  let ignoredWithdrawals = 0;
  lines.forEach(function (line) {
    if (oiIsHeaderLine(line)) {
      skipped += 1;
      return;
    }
    if (oiIsWithdrawalLine(line)) {
      ignoredWithdrawals += 1;
      return;
    }
    if (!oiIsWalletRevenueLine(line)) {
      skipped += 1;
      return;
    }
    let dateKey = oiParseDateKey(line);
    if (!dateKey) {
      skipped += 1;
      return;
    }
    let amount = oiParseWalletAmount(line) || oiParseAiProfitAmount(line, dateKey, -1);
    if (amount == null) {
      skipped += 1;
      return;
    }
    let type = oiIsRankingBonusLine(line) ? OI_WALLET_TYPES.ranking : OI_WALLET_TYPES.override;
    rows.push({ dateKey: dateKey, amount: amount, source: 'wallet', walletType: type });
  });
  return { rows: rows, skipped: skipped, ignoredWithdrawals: ignoredWithdrawals };
}

function oiMergeImportRows(aiRows, walletRows) {
  aiRows = aiRows || [];
  walletRows = walletRows || [];
  let map = {};
  aiRows.forEach(function (row) {
    if (!map[row.dateKey]) {
      map[row.dateKey] = {
        dateKey: row.dateKey,
        yesterdayAiProfit: null,
        todayAffiliateProfit: null,
        aiLines: 0,
        walletLines: 0
      };
    }
    map[row.dateKey].yesterdayAiProfit = oiRoundAmount4((map[row.dateKey].yesterdayAiProfit || 0) + row.amount);
    map[row.dateKey].aiLines += 1;
  });
  walletRows.forEach(function (row) {
    if (!map[row.dateKey]) {
      map[row.dateKey] = {
        dateKey: row.dateKey,
        yesterdayAiProfit: null,
        todayAffiliateProfit: null,
        aiLines: 0,
        walletLines: 0
      };
    }
    map[row.dateKey].todayAffiliateProfit = oiRoundAmount4((map[row.dateKey].todayAffiliateProfit || 0) + row.amount);
    map[row.dateKey].walletLines += 1;
  });
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

function oiGetOrcaAccountOptions() {
  if (typeof getOrcaInputAccounts !== 'function') return [];
  return getOrcaInputAccounts().map(function (acc) {
    return {
      id: acc.id,
      label: acc.username || acc.name || acc.id
    };
  });
}

function oiAnalyzePaste(accountId, aiText, walletText) {
  if (!accountId) return { ok: false, error: 'ORCAアカウントを選択してください。' };
  let ai = oiParseAiProfitHistory(aiText || '');
  let wallet = oiParseUsdtWalletHistory(walletText || '');
  if (!ai.rows.length && !wallet.rows.length) {
    return {
      ok: false,
      error: '取り込めるデータがありません。AI利益履歴またはUSDTウォレット履歴を貼り付けてください。'
    };
  }
  let merged = oiMergeImportRows(ai.rows, wallet.rows);
  let totalAi = ai.rows.reduce(function (s, r) { return s + r.amount; }, 0);
  let totalWallet = wallet.rows.reduce(function (s, r) { return s + r.amount; }, 0);
  return {
    ok: true,
    accountId: accountId,
    merged: merged,
    aiCount: ai.rows.length,
    walletCount: wallet.rows.length,
    aiSkipped: ai.skipped,
    walletSkipped: wallet.skipped,
    ignoredWithdrawals: wallet.ignoredWithdrawals,
    totalAi: oiRoundAmount4(totalAi),
    totalWallet: oiRoundAmount4(totalWallet),
    dates: merged.length
  };
}

function oiBuildImportRecords(preview) {
  if (!preview || !preview.merged || !preview.accountId) return [];
  return preview.merged.map(function (row) {
    let rec = {
      dateKey: row.dateKey,
      accountId: preview.accountId
    };
    if (row.yesterdayAiProfit != null) rec.yesterdayAiProfit = row.yesterdayAiProfit;
    if (row.todayAffiliateProfit != null) rec.todayAffiliateProfit = row.todayAffiliateProfit;
    return rec;
  });
}

function oiRenderPreviewTable(preview) {
  if (!preview || !preview.merged || !preview.merged.length) return '';
  let rows = preview.merged.slice(0, 40).map(function (row) {
    let yesterday = row.yesterdayAiProfit != null ? row.yesterdayAiProfit : 0;
    let todayAff = row.todayAffiliateProfit != null ? row.todayAffiliateProfit : 0;
    let total = oiRoundAmount4(yesterday + todayAff);
    return '<div class="oiPreviewRow">' +
      '<span>' + oiEscape(oiFormatDisplayDate(row.dateKey)) + '</span>' +
      '<span>' + (row.yesterdayAiProfit != null ? oiEscape(oiFormatAmount4(row.yesterdayAiProfit)) : '—') + '</span>' +
      '<span>' + (row.todayAffiliateProfit != null ? oiEscape(oiFormatAmount4(row.todayAffiliateProfit)) : '—') + '</span>' +
      '<span><b>' + oiEscape(oiFormatAmount4(total)) + '</b></span>' +
      '</div>';
  }).join('');
  let more = preview.merged.length > 40
    ? '<p class="help">…他 ' + (preview.merged.length - 40) + '日分</p>'
    : '';
  return '<div class="oiPreviewTable">' +
    '<div class="oiPreviewHead">' +
    '<span>日付</span><span>昨日AI利益</span><span>本日AF収益</span><span>合計</span>' +
    '</div>' + rows + more + '</div>';
}

function oiRenderImportPage() {
  let el = document.getElementById('oiMain');
  if (!el) return;

  let accounts = oiGetOrcaAccountOptions();
  let accountOptions = accounts.length
    ? accounts.map(function (acc) {
        let sel = oiPendingPreview && oiPendingPreview.accountId === acc.id ? ' selected' : '';
        return '<option value="' + oiEscape(acc.id) + '"' + sel + '>' + oiEscape(acc.label) + '</option>';
      }).join('')
    : '<option value="">（アカウント未登録）</option>';

  let previewHtml = '';
  if (oiPendingPreview && oiPendingPreview.ok) {
    let accLabel = accounts.find(function (a) { return a.id === oiPendingPreview.accountId; });
    previewHtml =
      '<div class="oiPreview panel">' +
      '<div class="oiPreviewTitle">解析結果</div>' +
      '<div class="oiPreviewMeta"><span>対象アカウント</span><b>' + oiEscape((accLabel && accLabel.label) || oiPendingPreview.accountId) + '</b></div>' +
      '<div class="oiPreviewMeta"><span>AI利益履歴</span><b>' + oiPendingPreview.aiCount + '件 / $' + oiFormatAmount4(oiPendingPreview.totalAi) + '</b></div>' +
      '<div class="oiPreviewMeta"><span>USDTウォレット</span><b>' + oiPendingPreview.walletCount + '件 / $' + oiFormatAmount4(oiPendingPreview.totalWallet) + '</b></div>' +
      (oiPendingPreview.ignoredWithdrawals
        ? '<div class="oiInfo">出金 ' + oiPendingPreview.ignoredWithdrawals + '件は収益ではないため除外しました。</div>'
        : '') +
      '<div class="oiPreviewMeta"><span>対象日数</span><b>' + oiPendingPreview.dates + '日</b></div>' +
      oiRenderPreviewTable(oiPendingPreview) +
      '<div class="oiPreviewActions">' +
      '<button type="button" id="oiImportBtn" onclick="oiExecuteImport()">保存して反映</button>' +
      '<button type="button" class="btn2" onclick="oiResetPreview()">やり直す</button>' +
      '</div></div>';
  }

  let successHtml = '';
  if (oiLastImportResult) {
    successHtml =
      '<div class="oiPreview panel oiSuccess">' +
      '<div class="oiPreviewTitle">移行完了</div>' +
      '<div class="oiPreviewMeta"><span>取込件数</span><b>' + oiLastImportResult.imported + '件</b></div>' +
      '<div class="oiPreviewMeta"><span>対象日数</span><b>' + oiLastImportResult.dates + '日</b></div>' +
      '<p class="help oiPreviewOk">ホーム・ポートフォリオ・収益管理に反映しました。</p>' +
      '</div>';
  }

  el.innerHTML =
    '<div class="oiStep panel">' +
    '<div class="oiStepNum">①</div>' +
    '<div class="oiStepBody">' +
    '<div class="oiStepTitle">ORCAアカウントを選択</div>' +
    '<p class="help">HUBに登録済みのORCAアカウントを選んでから、履歴データを貼り付けてください。</p>' +
    '<label for="oiAccountSelect">対象アカウント</label>' +
    '<select id="oiAccountSelect"' + (accounts.length ? '' : ' disabled') + '>' + accountOptions + '</select>' +
    (accounts.length ? '' : '<p class="oiWarn">先にホームの実績入力からORCAアカウントを登録してください。</p>') +
    '</div></div>' +
    '<div class="oiStep panel">' +
    '<div class="oiStepNum">②</div>' +
    '<div class="oiStepBody">' +
    '<div class="oiStepTitle">AI利益履歴を貼り付け → 昨日AI利益</div>' +
    '<p class="help">ORCAのAI利益履歴をコピーして貼り付けます（日付・AI 利益・金額のブロック形式に対応）。表示数値を小数第4位までそのまま取り込み、同日分は自動合計します。</p>' +
    '<textarea id="oiAiText" class="oiPaste" rows="10" placeholder="AI利益履歴を貼り付け…"></textarea>' +
    '</div></div>' +
    '<div class="oiStep panel">' +
    '<div class="oiStepNum">③</div>' +
    '<div class="oiStepBody">' +
    '<div class="oiStepTitle">USDTウォレット履歴を貼り付け → 本日AF収益</div>' +
    '<p class="help">「' + OI_WALLET_TYPES.ranking + '」「' + OI_WALLET_TYPES.override + '」のみ本日AF収益（アフィリエイト収益）として集計します。「出金」は無視。同日の2種類は自動合計します。</p>' +
    '<textarea id="oiWalletText" class="oiPaste" rows="10" placeholder="USDTウォレット履歴を貼り付け…"></textarea>' +
    '</div></div>' +
    '<div class="oiStep panel">' +
    '<div class="oiStepNum">④</div>' +
    '<div class="oiStepBody">' +
    '<div class="oiStepTitle">解析・保存</div>' +
    '<button type="button" class="btn2" onclick="oiRunPreview()"' + (accounts.length ? '' : ' disabled') + '>内容を解析</button>' +
    '</div></div>' +
    previewHtml +
    successHtml +
    (oiUndoSnapshot
      ? '<div class="oiUndo panel"><button type="button" class="btnDanger" onclick="oiUndoImport()">直前の移行を元に戻す</button></div>'
      : '');
}

function oiRunPreview() {
  let accountId = (document.getElementById('oiAccountSelect') || {}).value || '';
  let aiText = (document.getElementById('oiAiText') || {}).value || '';
  let walletText = (document.getElementById('oiWalletText') || {}).value || '';
  let result = oiAnalyzePaste(accountId, aiText, walletText);
  if (!result.ok) {
    alert(result.error || '解析に失敗しました。');
    return;
  }
  oiPendingPreview = result;
  oiLastImportResult = null;
  oiRenderImportPage();
}

function oiResetPreview() {
  oiPendingPreview = null;
  oiRenderImportPage();
}

function oiExecuteImport() {
  if (!oiPendingPreview || !oiPendingPreview.ok) {
    alert('先に内容を解析してください。');
    return;
  }
  let records = oiBuildImportRecords(oiPendingPreview);
  if (!records.length) {
    alert('保存するデータがありません。');
    return;
  }
  let acc = oiGetOrcaAccountOptions().find(function (a) { return a.id === oiPendingPreview.accountId; });
  let label = (acc && acc.label) || oiPendingPreview.accountId;
  if (!confirm(label + ' へ ' + records.length + '日分のORCA実績を保存します。\n\nホーム・ポートフォリオ・収益管理に反映されます。')) {
    return;
  }

  if (typeof pdCreatePerformanceSnapshot === 'function') {
    oiUndoSnapshot = pdCreatePerformanceSnapshot();
  }

  let result = typeof pdImportOrcaRevenueRecords === 'function'
    ? pdImportOrcaRevenueRecords(records)
    : { imported: 0, dates: 0 };

  oiLastImportResult = result;
  oiPendingPreview = null;
  oiRenderImportPage();

  if (typeof showToast === 'function') {
    showToast('✅ ORCA ' + result.imported + '件を移行しました');
  }
}

function oiUndoImport() {
  if (!oiUndoSnapshot) return alert('元に戻せる移行がありません');
  if (!confirm('直前のORCA移行前の実績データに戻しますか？')) return;
  if (typeof pdRestorePerformanceSnapshot === 'function') {
    pdRestorePerformanceSnapshot(oiUndoSnapshot);
  }
  oiUndoSnapshot = null;
  oiLastImportResult = null;
  oiPendingPreview = null;
  oiRenderImportPage();
  if (typeof showToast === 'function') showToast('↩️ 移行前に戻しました');
}

function openOrcaImportPage() {
  if (typeof showPage === 'function') showPage('orcaImport');
}

function oiHookShowPage() {
  if (window._oiShowPageHooked || typeof showPage !== 'function') return;
  window._oiShowPageHooked = true;
  let orig = showPage;
  window.showPage = function (p) {
    if (p === 'orcaImport') {
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
      if (typeof excelImportPage !== 'undefined') excelImportPage.classList.add('hidden');
      if (typeof orcaImportPage !== 'undefined') orcaImportPage.classList.remove('hidden');
      if (typeof setPageLocation === 'function') setPageLocation('ORCAデータ移行');
      if (typeof syncMobileNav === 'function') syncMobileNav('settings');
      oiRenderImportPage();
      return;
    }
    if (typeof orcaImportPage !== 'undefined') orcaImportPage.classList.add('hidden');
    return orig(p);
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', oiHookShowPage);
  } else {
    oiHookShowPage();
  }
}

if (typeof window !== 'undefined') {
  window.openOrcaImportPage = openOrcaImportPage;
  window.oiRunPreview = oiRunPreview;
  window.oiExecuteImport = oiExecuteImport;
  window.oiResetPreview = oiResetPreview;
  window.oiUndoImport = oiUndoImport;
  window.oiParseAiProfitHistory = oiParseAiProfitHistory;
  window.oiParseUsdtWalletHistory = oiParseUsdtWalletHistory;
  window.oiAnalyzePaste = oiAnalyzePaste;
}
