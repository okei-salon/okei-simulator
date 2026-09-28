#!/usr/bin/env node
/**
 * Verify BITSYNC opt-in, registered-account revenue input, principal tracking, portfolio card.
 * Usage: node scripts/verify-bitsync-performance-input.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';

const baseUrl = process.argv[2] || 'http://127.0.0.1:5050';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const checks = [];

function assert(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadHubApi() {
  const code = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');
  const wrapped = code + '\n;return { hubMergeHubDocuments, hubCreateEmptyData, hubCreateDefaultSettings };';
  return new Function(wrapped)();
}

const pd = readFileSync(path.join(root, 'assets/js/performance-data.js'), 'utf8');
const bitsyncInput = readFileSync(path.join(root, 'assets/js/bitsync-revenue-input.js'), 'utf8');
const bitsyncInv = readFileSync(path.join(root, 'assets/js/bitsync-investment.js'), 'utf8');
const portfolio = readFileSync(path.join(root, 'assets/js/portfolio.js'), 'utf8');
const salesManage = readFileSync(path.join(root, 'assets/js/sales-manage.js'), 'utf8');
const matrixInput = readFileSync(path.join(root, 'assets/js/matrix-revenue-input.js'), 'utf8');
const pm = readFileSync(path.join(root, 'assets/js/project-master.js'), 'utf8');
const hub = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');
const icons = readFileSync(path.join(root, 'assets/js/project-icons.js'), 'utf8');

assert('PM_VALID_CODES.BITSYNC', pm.includes("BITSYNC: 'bitsync'"));
assert('pdSaveBitsyncPerformanceEntry exists', pd.includes('function pdSaveBitsyncPerformanceEntry'));
assert('bitsync investment module exists', bitsyncInv.includes('bitsyncAddNftPurchase'));
assert('bitsync investment history arrays', bitsyncInv.includes('nftPurchaseRecords'));
assert('bitsync separate revenue/investment blocks', bitsyncInput.includes('追加投資') && bitsyncInput.includes('実績入力'));
assert('bitsync main save also persists investment', bitsyncInput.includes('hasInvestment') &&
  bitsyncInput.includes('bitsyncRefreshAfterSave'));
assert('sales manage excludes matrix/bitsync', salesManage.includes('SM_SALES_UNSUPPORTED_KEYS') &&
  salesManage.includes('smIsSalesSupportedProject'));
assert('bitsync registration has startDate + principal', bitsyncInput.includes('bitsyncNewStartDate') &&
  bitsyncInput.includes('bitsyncNewNftPurchase') && bitsyncInput.includes('bitsyncNewOperating'));
assert('bitsync portfolio card 5 metrics', portfolio.includes('pfRenderBitsyncProjectCard') &&
  portfolio.includes('NFT購入') && portfolio.includes('NFT販売利益') &&
  portfolio.includes('運用利益') && portfolio.includes('累計利益'));
assert('bitsync recovery bar label', portfolio.includes('回収率') &&
  portfolio.includes('pfRecoveryScaleHtml(row.recovery'));
assert('bitsync profit breakdown helper', bitsyncInv.includes('bitsyncSumAllTimeProfitBreakdown'));
assert('bitsync month profit breakdown helper', bitsyncInv.includes('bitsyncSumMonthProfitBreakdown'));
assert('bitsync personal monthly yield helper', bitsyncInv.includes('bitsyncCalcPersonalMonthlyYield'));
assert('bitsync detail modal renderer', portfolio.includes('pfRenderBitsyncProfitDetailBody') &&
  portfolio.includes('pfGetBitsyncProfitBreakdown'));
assert('bitsync card opens detail', portfolio.includes('pfOpenProjectProfitDetail') &&
  portfolio.includes('bitsync') && portfolio.includes('isClickable'));
assert('bitsync card tap hint', portfolio.includes('pfProjectCardHint') &&
  portfolio.includes('タップで利益構成・月利詳細'));
const themeJs = readFileSync(path.join(root, 'assets/js/project-theme.js'), 'utf8');
assert('bitsync theme purple', themeJs.includes("bitsync: {") &&
  themeJs.includes("accent: '#a855f7'") && themeJs.includes("chart: '#a855f7'"));
assert('orca theme still blue', (function () {
  let m = themeJs.match(/orca:\s*\{[\s\S]*?accent:\s*'([^']+)'/);
  return m && m[1] === '#3b82f6';
})());
assert('bitsync save closes modal via hubFinish', bitsyncInput.includes('hubFinishRevenueInputSave'));
assert('matrix save closes modal via hubFinish', matrixInput.includes('hubFinishRevenueInputSave'));
assert('bitsync allocation uses total investment', portfolio.includes('bitsyncGetProjectTotalInvestment'));
assert('bitsync icon registry + PNG', icons.includes("bitsync: { file: 'bitsync.png'"));
assert('bitsyncAccounts in hub merge keys', hub.includes("'bitsyncAccounts'"));
assert('bitsync input field order', bitsyncInput.indexOf('NFT販売報酬') < bitsyncInput.indexOf('運用報酬') &&
  bitsyncInput.indexOf('運用報酬') < bitsyncInput.indexOf('運用益ボーナス'));
assert('bitsync no daily account name input', !bitsyncInput.includes('bitsyncAccountName'));
assert('matrix no daily account name input', !matrixInput.includes('matrixAccountName'));

const { hubMergeHubDocuments, hubCreateEmptyData, hubCreateDefaultSettings } = loadHubApi();
const localDoc = hubCreateEmptyData();
localDoc.updatedAt = 9000;
localDoc.settings = hubCreateDefaultSettings();
localDoc.settings.revenueLog = {
  '2026-09-27': { ram: 10, ramAccounts: { m1: { todayRevenue: 10 } }, total: 10 }
};
const cloudDoc = hubCreateEmptyData();
cloudDoc.updatedAt = 1000;
cloudDoc.settings = hubCreateDefaultSettings();
cloudDoc.settings.revenueLog = {
  '2026-09-27': {
    bitsyncAccounts: {
      bs1: { accountId: 'bs1', accountName: 'kai-bs', nftSaleReward: 100, operationReward: 50, profitBonus: 25, total: 175 }
    },
    bitsync: 175,
    total: 175
  }
};
cloudDoc.settings.bitsyncInputAccounts = [{
  id: 'bs1', username: 'kai-bs', name: 'kai-bs', startDate: '2026/09/27',
  nftPurchaseRecords: [{ dateKey: '2026/09/27', amount: 3000, type: 'initial' }],
  operatingRecords: [{ dateKey: '2026/09/27', amount: 5000, type: 'initial' }]
}];
const mergedDoc = hubMergeHubDocuments(localDoc, cloudDoc);
const mergedDay = mergedDoc.settings.revenueLog['2026-09-27'] || {};
assert('merge keeps cloud bitsyncAccounts', !!(mergedDay.bitsyncAccounts && mergedDay.bitsyncAccounts.bs1.total === 175));
assert('merge keeps RAM alongside bitsync', !!(mergedDay.ramAccounts && mergedDay.ramAccounts.m1));
assert('merge keeps bitsync principal records', !!(mergedDoc.settings.bitsyncInputAccounts &&
  mergedDoc.settings.bitsyncInputAccounts[0].nftPurchaseRecords.length === 1));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.body.classList.add('hub-auth-ready');
    let verifyPanel = document.getElementById('hubUserVerifyPanel');
    if (verifyPanel) verifyPanel.classList.add('hidden');
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
    ['BITSYNC', 'MATRIX'].forEach(function (code) {
      if (!pmDraftState && typeof pmInitDraftDefaults === 'function') pmInitDraftDefaults();
      let result = pmValidateProjectCode(code);
      if (!result.ok) return;
      let meta = PM_CODE_META[result.key] || { name: result.key, startDate: '—' };
      pmDraftState.projects[result.key] = {
        key: result.key,
        name: meta.name,
        startDate: meta.startDate,
        inclusionRate: 100,
        visible: true,
        registered: true,
        iconKey: result.key
      };
      if (pmDraftState.order.indexOf(result.key) === -1) pmDraftState.order.push(result.key);
    });
    if (typeof pmCommitProjectMaster === 'function') pmCommitProjectMaster(pmReadDraftState());
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(800);

  const countsBefore = await page.evaluate(() => ({
    ram: typeof members !== 'undefined' ? members.length : -1,
    revenueDays: settings && settings.revenueLog ? Object.keys(settings.revenueLog).length : -1
  }));

  const iconCheck = await page.evaluate(() => {
    if (typeof pjRenderProjectIcon !== 'function') return { ok: false, detail: 'no pjRenderProjectIcon' };
    let html = pjRenderProjectIcon('bitsync', 'homeProjCardIcon', { name: 'BITSYNC' });
    return {
      ok: html.indexOf('bitsync.png') >= 0 && html.indexOf('homeProjIcon--img') >= 0,
      detail: html.slice(0, 180)
    };
  });
  assert('BITSYNC official PNG icon rendered', iconCheck.ok, iconCheck.detail);

  await page.evaluate(() => {
    if (typeof openRevenueInput === 'function') openRevenueInput();
  });
  await page.waitForSelector('.revenueProjectList', { timeout: 10000 });
  await page.evaluate(() => selectRevenueProject('bitsync'));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (typeof openBitsyncAddAccountForm === 'function') openBitsyncAddAccountForm();
  });
  await page.waitForSelector('#bitsyncNewAccountName', { timeout: 10000 });
  await page.fill('#bitsyncNewAccountName', 'bitsync-test');
  await page.fill('#bitsyncNewStartDate', '2026/09/27');
  await page.fill('#bitsyncNewNftPurchase', '3000');
  await page.fill('#bitsyncNewOperating', '5000');
  await page.evaluate(() => {
    if (typeof registerBitsyncAccount === 'function') registerBitsyncAccount();
  });
  await page.waitForSelector('#bitsyncSaveRevenueBtn', { timeout: 10000 });
  await page.waitForTimeout(400);

  const bitsyncUi = await page.evaluate(() => {
    const ids = (typeof getBitsyncInputAccounts === 'function' ? getBitsyncInputAccounts() : []);
    const accId = ids[0] && ids[0].id;
    return {
      title: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : '',
      hasNameInput: !!document.getElementById('bitsyncNewAccountName'),
      hasNft: accId ? !!document.getElementById('bitsyncNft_' + accId) : false,
      hasOp: accId ? !!document.getElementById('bitsyncOp_' + accId) : false,
      hasBonus: accId ? !!document.getElementById('bitsyncBonus_' + accId) : false,
      hasAddNft: accId ? !!document.getElementById('bitsyncAddNft_' + accId) : false,
      hasAddOp: accId ? !!document.getElementById('bitsyncAddOp_' + accId) : false,
      hasSave: !!document.getElementById('bitsyncSaveRevenueBtn'),
      hasSaveInv: !!document.getElementById('bitsyncSaveInvestmentBtn'),
      accId: accId,
      nftTotal: accId && typeof bitsyncGetNftPurchaseTotal === 'function' ? bitsyncGetNftPurchaseTotal(accId) : 0,
      opTotal: accId && typeof bitsyncGetOperatingPrincipalTotal === 'function' ? bitsyncGetOperatingPrincipalTotal(accId) : 0
    };
  });
  assert('BITSYNC input title', bitsyncUi.title.indexOf('BITSYNC') >= 0, bitsyncUi.title);
  assert('BITSYNC no daily name field on input', !bitsyncUi.hasNameInput);
  assert('BITSYNC NFT reward field', bitsyncUi.hasNft);
  assert('BITSYNC operation reward field', bitsyncUi.hasOp);
  assert('BITSYNC bonus field', bitsyncUi.hasBonus);
  assert('BITSYNC add NFT field', bitsyncUi.hasAddNft);
  assert('BITSYNC add operating field', bitsyncUi.hasAddOp);
  assert('BITSYNC save revenue button', bitsyncUi.hasSave);
  assert('BITSYNC save investment button', bitsyncUi.hasSaveInv);
  assert('BITSYNC initial NFT purchase 3000', bitsyncUi.nftTotal === 3000, String(bitsyncUi.nftTotal));
  assert('BITSYNC initial operating 5000', bitsyncUi.opTotal === 5000, String(bitsyncUi.opTotal));

  if (bitsyncUi.accId) {
    await page.fill('#bitsyncNft_' + bitsyncUi.accId, '100');
    await page.fill('#bitsyncOp_' + bitsyncUi.accId, '50');
    await page.fill('#bitsyncBonus_' + bitsyncUi.accId, '25');
    await page.evaluate(() => {
      if (typeof saveBitsyncRevenueInput === 'function') saveBitsyncRevenueInput();
    });
    await page.waitForTimeout(600);
    const afterRevenueSave = await page.evaluate(() => ({
      modalOpen: !!(document.getElementById('modalBg') && document.getElementById('modalBg').style.display === 'flex'),
      homeVisible: !!(document.getElementById('homePage') && !document.getElementById('homePage').classList.contains('hidden'))
    }));
    assert('BITSYNC revenue save closes modal', !afterRevenueSave.modalOpen);
    assert('BITSYNC revenue save returns home', afterRevenueSave.homeVisible);

    await page.evaluate(() => {
      if (typeof openRevenueInput === 'function') openRevenueInput();
      selectRevenueProject('bitsync');
    });
    await page.waitForTimeout(400);

    await page.fill('#bitsyncAddNft_' + bitsyncUi.accId, '500');
    await page.fill('#bitsyncAddOp_' + bitsyncUi.accId, '2000');
    await page.evaluate(() => {
      if (typeof saveBitsyncInvestmentInput === 'function') saveBitsyncInvestmentInput();
    });
    await page.waitForTimeout(600);
    const afterInvSave = await page.evaluate(() => ({
      modalOpen: !!(document.getElementById('modalBg') && document.getElementById('modalBg').style.display === 'flex'),
      homeVisible: !!(document.getElementById('homePage') && !document.getElementById('homePage').classList.contains('hidden'))
    }));
    assert('BITSYNC investment save closes modal', !afterInvSave.modalOpen);
    assert('BITSYNC investment save returns home', afterInvSave.homeVisible);

    await page.evaluate(() => {
      if (typeof openRevenueInput === 'function') openRevenueInput();
      selectRevenueProject('bitsync');
    });
    await page.waitForTimeout(400);

    await page.fill('#bitsyncAddNft_' + bitsyncUi.accId, '1000');
    await page.fill('#bitsyncAddOp_' + bitsyncUi.accId, '500');
    await page.evaluate(() => {
      if (typeof saveBitsyncRevenueInput === 'function') saveBitsyncRevenueInput();
    });
    await page.waitForTimeout(600);
  }

  const saved = await page.evaluate(() => {
    let dk = typeof todayKey === 'function' ? todayKey() : '';
    let entry = settings.revenueLog && settings.revenueLog[dk];
    let acc = typeof getBitsyncInputAccounts === 'function' ? getBitsyncInputAccounts()[0] : null;
    let ae = acc && entry && entry.bitsyncAccounts ? entry.bitsyncAccounts[acc.id] : null;
    let nftTotal = acc && typeof bitsyncGetNftPurchaseTotal === 'function' ? bitsyncGetNftPurchaseTotal(acc.id) : 0;
    let opTotal = acc && typeof bitsyncGetOperatingPrincipalTotal === 'function' ? bitsyncGetOperatingPrincipalTotal(acc.id) : 0;
    return ae ? {
      total: ae.total,
      nft: ae.nftSaleReward,
      op: ae.operationReward,
      bonus: ae.profitBonus,
      nftTotal: nftTotal,
      opTotal: opTotal
    } : null;
  });
  assert('BITSYNC save total 175', saved && Number(saved.total) === 175, JSON.stringify(saved));
  assert('BITSYNC cumulative NFT 4500', saved && saved.nftTotal === 4500, JSON.stringify(saved));
  assert('BITSYNC cumulative operating 7500', saved && saved.opTotal === 7500, JSON.stringify(saved));

  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    if (typeof openPortfolioNav === 'function') openPortfolioNav();
    else if (typeof showPage === 'function') showPage('portfolio');
    if (typeof renderPortfolio === 'function') renderPortfolio();
  });
  await page.waitForSelector('.pfProjectCard--bitsync', { timeout: 10000 });
  await page.waitForTimeout(400);
  const pfCard = await page.evaluate(() => {
    let card = document.querySelector('.pfProjectCard--bitsync');
    if (!card) return { ok: false, detail: 'no card' };
    let text = card.textContent || '';
    return {
      ok: text.indexOf('NFT購入') >= 0 && text.indexOf('NFT販売利益') >= 0 &&
        text.indexOf('運用額') >= 0 && text.indexOf('運用利益') >= 0 &&
        text.indexOf('累計利益') >= 0 && text.indexOf('回収率') >= 0 &&
        text.indexOf('予測月利') < 0 && text.indexOf('累計利回り') < 0,
      hasRecoveryBar: !!card.querySelector('.pfRecoveryBlock .pfRecoveryTrack'),
      detail: text.replace(/\s+/g, ' ').slice(0, 260)
    };
  });
  assert('BITSYNC portfolio card 5 metrics + recovery', pfCard.ok, pfCard.detail);
  assert('BITSYNC portfolio recovery bar', pfCard.hasRecoveryBar);
  const cardHint = await page.evaluate(() => {
    let card = document.querySelector('.pfProjectCard--bitsync');
    let hint = card ? card.querySelector('.pfProjectCardHint') : null;
    return { hasHint: !!hint, text: hint ? hint.textContent : '' };
  });
  assert('BITSYNC card shows tap hint', cardHint.hasHint && cardHint.text.indexOf('タップで利益構成・月利詳細') >= 0, cardHint.text);

  const pfValues = await page.evaluate(() => {
    let card = document.querySelector('.pfProjectCard--bitsync');
    if (!card) return null;
    let nft = typeof bitsyncGetProjectNftPurchaseTotal === 'function' ? bitsyncGetProjectNftPurchaseTotal() : 0;
    let op = typeof bitsyncGetProjectOperatingPrincipalTotal === 'function' ? bitsyncGetProjectOperatingPrincipalTotal() : 0;
    let bd = typeof bitsyncSumAllTimeProfitBreakdown === 'function'
      ? bitsyncSumAllTimeProfitBreakdown() : { nftSaleProfit: 0, operationProfit: 0, totalProfit: 0 };
    let rows = typeof pfGetEnabledProjectRows === 'function' ? pfGetEnabledProjectRows() : [];
    let row = rows.find(function (r) { return r.key === 'bitsync'; });
    return {
      nft: nft,
      op: op,
      nftSaleProfit: bd.nftSaleProfit,
      operationProfit: bd.operationProfit,
      totalProfit: bd.totalProfit,
      recovery: row ? row.recovery : null,
      fill: row ? row.fill : null
    };
  });
  assert('BITSYNC portfolio NFT $4500', pfValues && pfValues.nft === 4500, JSON.stringify(pfValues));
  assert('BITSYNC portfolio operating $7500', pfValues && pfValues.op === 7500, JSON.stringify(pfValues));
  assert('BITSYNC NFT sale profit $100', pfValues && pfValues.nftSaleProfit === 100, JSON.stringify(pfValues));
  assert('BITSYNC operation profit $75', pfValues && pfValues.operationProfit === 75, JSON.stringify(pfValues));
  assert('BITSYNC total profit $175', pfValues && pfValues.totalProfit === 175, JSON.stringify(pfValues));
  assert('BITSYNC recovery ~1.5%', pfValues && pfValues.recovery === 1.5, JSON.stringify(pfValues));

  await page.evaluate(() => {
    let card = document.querySelector('.pfProjectCard--bitsync');
    if (card && typeof pfOpenProjectProfitDetail === 'function') pfOpenProjectProfitDetail('bitsync');
  });
  await page.waitForTimeout(400);
  const detailUi = await page.evaluate(() => {
    let content = document.getElementById('modalContent');
    let text = content ? content.textContent || '' : '';
    let viewMonth = typeof pfGetPortfolioViewMonth === 'function' ? pfGetPortfolioViewMonth() : { y: 2026, m: 8 };
    let bd = typeof pfGetBitsyncProfitBreakdown === 'function'
      ? pfGetBitsyncProfitBreakdown(viewMonth.y, viewMonth.m) : null;
    return {
      title: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : '',
      text: text.replace(/\s+/g, ' ').slice(0, 320),
      hasNftSection: text.indexOf('NFT購入金額') >= 0 && text.indexOf('NFT販売利益') >= 0,
      hasPersonalSection: text.indexOf('個人運用額') >= 0 && text.indexOf('個人運用利益') >= 0 && text.indexOf('個人運用月利') >= 0,
      hasGroupSection: text.indexOf('グループ運用利益') >= 0,
      hasMonthChart: text.indexOf('今月の収益構成') >= 0,
      hasPie: !!document.querySelector('.pfProfitDetail--bitsync .pfProfitPieChart, .pfProfitDetail--bitsync .pfProfitPieEmpty'),
      bd: bd
    };
  });
  assert('BITSYNC detail modal opens', detailUi.title.indexOf('BITSYNC') >= 0, detailUi.title);
  assert('BITSYNC detail NFT section', detailUi.hasNftSection, detailUi.text);
  assert('BITSYNC detail personal section', detailUi.hasPersonalSection, detailUi.text);
  assert('BITSYNC detail group section', detailUi.hasGroupSection, detailUi.text);
  assert('BITSYNC detail month chart section', detailUi.hasMonthChart && detailUi.hasPie, detailUi.text);
  assert('BITSYNC detail NFT purchase $4500', detailUi.bd && detailUi.bd.nftPurchaseUsd === 4500, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail NFT sale profit $100', detailUi.bd && detailUi.bd.nftSaleProfit === 100, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail personal operating $7500', detailUi.bd && detailUi.bd.personalOperatingUsd === 7500, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail personal profit $50', detailUi.bd && detailUi.bd.personalOperationProfit === 50, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail group profit $25', detailUi.bd && detailUi.bd.groupOperationProfit === 25, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail month total matches pie', detailUi.bd &&
    detailUi.bd.monthTotal === 175, JSON.stringify(detailUi.bd));

  const themeColors = await page.evaluate(() => {
    let cardBorder = '';
    let card = document.querySelector('.pfProjectCard--bitsync');
    if (card && typeof getComputedStyle === 'function') {
      cardBorder = getComputedStyle(card).borderColor;
    }
    let chart = typeof pjGetChartColor === 'function' ? pjGetChartColor('bitsync') : '';
    let orcaChart = typeof pjGetChartColor === 'function' ? pjGetChartColor('orca') : '';
    return { bitsyncChart: chart, orcaChart: orcaChart, cardBorder: cardBorder };
  });
  assert('BITSYNC chart color purple', themeColors.bitsyncChart === '#a855f7', JSON.stringify(themeColors));
  assert('ORCA chart color unchanged', themeColors.orcaChart === '#3b82f6', JSON.stringify(themeColors));

  await page.evaluate(() => {
    if (typeof showPage === 'function') showPage('salesManage');
    if (typeof renderSalesManage === 'function') renderSalesManage();
  });
  await page.waitForTimeout(500);
  const salesFilter = await page.evaluate(() => {
    let sel = document.getElementById('smProjectFilter');
    if (!sel) return { ok: false, options: [] };
    let options = Array.from(sel.options).map(function (o) { return o.value; });
    return {
      ok: options.indexOf('matrix') < 0 && options.indexOf('bitsync') < 0,
      options: options
    };
  });
  assert('sales manage excludes MATRIX/BITSYNC', salesFilter.ok, JSON.stringify(salesFilter.options));

  await page.evaluate(() => {
    if (typeof closeModal === 'function') closeModal();
    if (typeof openRevenueInput === 'function') openRevenueInput();
    selectRevenueProject('matrix');
  });
  await page.waitForTimeout(500);
  const matrixUi = await page.evaluate(() => ({
    hasDailyNameInput: !!document.getElementById('matrixAccountName'),
    hasAddBtn: !!document.getElementById('matrixOpenAddAccountBtn')
  }));
  assert('MATRIX input has add account not daily name', matrixUi.hasAddBtn && !matrixUi.hasDailyNameInput);

  await page.evaluate(() => {
    if (!settings.matrixInputAccounts) settings.matrixInputAccounts = [];
    settings.matrixInputAccounts.push({
      id: 'mtest-close',
      username: 'matrix-save-close-test',
      name: 'matrix-save-close-test',
      investment: 0
    });
    if (typeof openMatrixRevenueInput === 'function') openMatrixRevenueInput();
  });
  await page.waitForTimeout(400);
  await page.fill('#matrixRevenueBonus_mtest-close', '10');
  await page.evaluate(() => {
    if (typeof matrixSaveRevenueEntry === 'function') matrixSaveRevenueEntry();
  });
  await page.waitForTimeout(600);
  const afterMatrixSave = await page.evaluate(() => ({
    modalOpen: !!(document.getElementById('modalBg') && document.getElementById('modalBg').style.display === 'flex'),
    homeVisible: !!(document.getElementById('homePage') && !document.getElementById('homePage').classList.contains('hidden'))
  }));
  assert('MATRIX save closes modal', !afterMatrixSave.modalOpen);
  assert('MATRIX save returns home', afterMatrixSave.homeVisible);

  const recoveryBarMath = await page.evaluate(() => ({
    scale150: pfRecoveryScaleMax(150),
    fill150: pfRecoveryFillPct(150),
    scale250: pfRecoveryScaleMax(250),
    fill250: pfRecoveryFillPct(250)
  }));
  assert('recovery bar scale >100%', recoveryBarMath.scale150 === 200, JSON.stringify(recoveryBarMath));
  assert('recovery bar fill at 150%', recoveryBarMath.fill150 === 75, JSON.stringify(recoveryBarMath));
  assert('recovery bar scale >200%', recoveryBarMath.scale250 === 300, JSON.stringify(recoveryBarMath));

  const userScenario = await page.evaluate(() => {
    var scenarioDateKey = typeof todayKey === 'function' ? todayKey() : '2026-09-28';
    var scenarioStartDate = scenarioDateKey.replace(/-/g, '/');
    settings.bitsyncInputAccounts = [{
      id: 'bs-scenario',
      username: 'scenario',
      name: 'scenario',
      startDate: scenarioStartDate,
      nftPurchaseRecords: [{ dateKey: scenarioDateKey, amount: 3000, type: 'initial' }],
      operatingRecords: [{ dateKey: scenarioDateKey, amount: 500, type: 'initial' }]
    }];
    settings.revenueLog = {};
    settings.revenueLog[scenarioDateKey] = {
      bitsyncAccounts: {
        'bs-scenario': {
          accountId: 'bs-scenario',
          accountName: 'scenario',
          nftSaleReward: 90,
          operationReward: 10,
          profitBonus: 3,
          total: 103
        }
      }
    };
    let nft = bitsyncGetProjectNftPurchaseTotal();
    let op = bitsyncGetProjectOperatingPrincipalTotal();
    let bd = bitsyncSumAllTimeProfitBreakdown();
    let rows = pfGetEnabledProjectRows();
    let row = rows.find(function (r) { return r.key === 'bitsync'; });
    return {
      nft: nft,
      op: op,
      nftSaleProfit: bd.nftSaleProfit,
      operationProfit: bd.operationProfit,
      totalProfit: bd.totalProfit,
      recovery: row ? row.recovery : null
    };
  });
  assert('scenario NFT purchase $3000', userScenario.nft === 3000, JSON.stringify(userScenario));
  assert('scenario operating $500', userScenario.op === 500, JSON.stringify(userScenario));
  assert('scenario NFT sale profit $90', userScenario.nftSaleProfit === 90, JSON.stringify(userScenario));
  assert('scenario operation profit $13', userScenario.operationProfit === 13, JSON.stringify(userScenario));
  assert('scenario total profit $103', userScenario.totalProfit === 103, JSON.stringify(userScenario));
  assert('scenario recovery ~2.9%', userScenario.recovery === 2.9, JSON.stringify(userScenario));

  for (const pk of ['ram', 'orca', 'eni']) {
    await page.evaluate((k) => {
      if (typeof closeModal === 'function') closeModal();
      if (typeof openRevenueInput === 'function') openRevenueInput();
      selectRevenueProject(k);
    }, pk);
    await page.waitForTimeout(500);
    const title = await page.evaluate(() => document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : '');
    assert(pk.toUpperCase() + ' input opens', title.toUpperCase().indexOf(pk.toUpperCase()) >= 0, title);
  }

  const countsAfter = await page.evaluate(() => ({
    ram: typeof members !== 'undefined' ? members.length : -1,
    revenueDays: settings && settings.revenueLog ? Object.keys(settings.revenueLog).length : -1
  }));
  assert('RAM member count unchanged', countsBefore.ram === countsAfter.ram, countsBefore.ram + ' -> ' + countsAfter.ram);
  assert('revenue log days not decreased', countsAfter.revenueDays >= countsBefore.revenueDays);
} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok).length;
console.log('\n---');
console.log('Passed:', checks.length - failed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
