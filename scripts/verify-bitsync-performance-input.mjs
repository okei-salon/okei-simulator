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
  portfolio.includes('NFT購入') && portfolio.includes('N BONUS') &&
  portfolio.includes('VAULT等利益') && portfolio.includes('累計利益'));
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
assert('bitsync cumulative save helpers', pd.includes('pdCalcBitsyncDailyMetrics') &&
  pd.includes('pdPreviewBitsyncCumulativeSave') && pd.includes('stakingRewardCumulative'));
assert('bitsync 4 revenue field defs', pd.includes('VAULT 運用益') && pd.includes('V BONUS') &&
  pd.includes('ステーキング報酬') && pd.includes('N BONUS'));
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
assert('bitsync input field order', bitsyncInput.indexOf('VAULT 運用益') < bitsyncInput.indexOf('V BONUS') &&
  bitsyncInput.indexOf('V BONUS') < bitsyncInput.indexOf('ステーキング報酬') &&
  bitsyncInput.indexOf('ステーキング報酬') < bitsyncInput.indexOf('N BONUS'));
assert('bitsync no official placeholder', !bitsyncInput.includes('公式の累計額'));
assert('bitsync USDT unit on fields', bitsyncInput.includes("ramInputUnit\">USDT") || bitsyncInput.includes("ramInputUnit'>USDT"));
assert('bitsync today profit preview row', bitsyncInput.includes('本日の収益') &&
  bitsyncInput.includes('bitsyncDailyProfit_') && bitsyncInput.includes('updateBitsyncDerivedPreview'));
assert('bitsync preview uses pdCalcBitsyncDailyMetrics', bitsyncInput.includes('pdCalcBitsyncDailyMetrics'));
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
      bs1: {
        accountId: 'bs1', accountName: 'kai-bs',
        nftSaleReward: 100, operationReward: 50, profitBonus: 25, stakingReward: 10, total: 185,
        operationRewardCumulative: 50, profitBonusCumulative: 25,
        stakingRewardCumulative: 10, nftSaleRewardCumulative: 100,
        inputMode: 'cumulative', isBaseline: false
      }
    },
    bitsync: 185,
    total: 185
  }
};
cloudDoc.settings.bitsyncInputAccounts = [{
  id: 'bs1', username: 'kai-bs', name: 'kai-bs', startDate: '2026/09/27',
  nftPurchaseRecords: [{ dateKey: '2026/09/27', amount: 3000, type: 'initial' }],
  operatingRecords: [{ dateKey: '2026/09/27', amount: 5000, type: 'initial' }]
}];
const mergedDoc = hubMergeHubDocuments(localDoc, cloudDoc);
const mergedDay = mergedDoc.settings.revenueLog['2026-09-27'] || {};
assert('merge keeps cloud bitsyncAccounts', !!(mergedDay.bitsyncAccounts && mergedDay.bitsyncAccounts.bs1.total === 185));
assert('merge keeps bitsync cumulative fields', !!(mergedDay.bitsyncAccounts &&
  mergedDay.bitsyncAccounts.bs1.stakingRewardCumulative === 10 &&
  mergedDay.bitsyncAccounts.bs1.operationRewardCumulative === 50 &&
  mergedDay.bitsyncAccounts.bs1.inputMode === 'cumulative'));
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
    const body = document.getElementById('modalContent') ? (document.getElementById('modalContent').textContent || '') : '';
    const html = document.getElementById('modalContent') ? (document.getElementById('modalContent').innerHTML || '') : '';
    function hasCum(key) {
      return accId ? !!document.getElementById('bitsyncCum_' + key + '_' + accId) : false;
    }
    function fieldHtml(key) {
      let el = accId ? document.getElementById('bitsyncCum_' + key + '_' + accId) : null;
      return el && el.parentElement ? el.parentElement.innerHTML : '';
    }
    return {
      title: document.getElementById('modalTitle') ? document.getElementById('modalTitle').textContent : '',
      hasNameInput: !!document.getElementById('bitsyncNewAccountName'),
      hasVault: hasCum('operationRewardCumulative'),
      hasVBonus: hasCum('profitBonusCumulative'),
      hasStaking: hasCum('stakingRewardCumulative'),
      hasNBonus: hasCum('nftSaleRewardCumulative'),
      labelOrderOk: body.indexOf('VAULT 運用益') >= 0 &&
        body.indexOf('VAULT 運用益') < body.indexOf('V BONUS') &&
        body.indexOf('V BONUS') < body.indexOf('ステーキング報酬') &&
        body.indexOf('ステーキング報酬') < body.indexOf('N BONUS'),
      noOfficialPlaceholder: html.indexOf('公式の累計額') < 0 &&
        !(accId && document.getElementById('bitsyncCum_operationRewardCumulative_' + accId) &&
          document.getElementById('bitsyncCum_operationRewardCumulative_' + accId).getAttribute('placeholder')),
      hasUsdtUnit: fieldHtml('operationRewardCumulative').indexOf('USDT') >= 0,
      hasPrevHint: body.indexOf('初回入力：基準値として保存') >= 0 || body.indexOf('前回の累計額') >= 0,
      hasTodayProfit: accId ? !!document.getElementById('bitsyncDailyProfit_' + accId) : false,
      todayProfitText: accId && document.getElementById('bitsyncDailyProfit_' + accId)
        ? document.getElementById('bitsyncDailyProfit_' + accId).textContent : '',
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
  assert('BITSYNC VAULT cumulative field', bitsyncUi.hasVault);
  assert('BITSYNC V BONUS cumulative field', bitsyncUi.hasVBonus);
  assert('BITSYNC staking cumulative field', bitsyncUi.hasStaking);
  assert('BITSYNC N BONUS cumulative field', bitsyncUi.hasNBonus);
  assert('BITSYNC 4-field display order', bitsyncUi.labelOrderOk);
  assert('BITSYNC no official placeholder', bitsyncUi.noOfficialPlaceholder);
  assert('BITSYNC USDT unit visible', bitsyncUi.hasUsdtUnit);
  assert('BITSYNC previous cumulative hint', bitsyncUi.hasPrevHint);
  assert('BITSYNC today profit row', bitsyncUi.hasTodayProfit);
  assert('BITSYNC today profit starts empty', bitsyncUi.todayProfitText === '—', bitsyncUi.todayProfitText);
  assert('BITSYNC add NFT field', bitsyncUi.hasAddNft);
  assert('BITSYNC add operating field', bitsyncUi.hasAddOp);
  assert('BITSYNC save revenue button', bitsyncUi.hasSave);
  assert('BITSYNC save investment button', bitsyncUi.hasSaveInv);
  assert('BITSYNC initial NFT purchase 3000', bitsyncUi.nftTotal === 3000, String(bitsyncUi.nftTotal));
  assert('BITSYNC initial operating 5000', bitsyncUi.opTotal === 5000, String(bitsyncUi.opTotal));

  if (bitsyncUi.accId) {
    const id = bitsyncUi.accId;
    await page.fill('#bitsyncCum_operationRewardCumulative_' + id, '100');
    await page.fill('#bitsyncCum_profitBonusCumulative_' + id, '50');
    await page.fill('#bitsyncCum_stakingRewardCumulative_' + id, '25');
    await page.fill('#bitsyncCum_nftSaleRewardCumulative_' + id, '200');
    await page.waitForTimeout(200);
    const livePreview = await page.evaluate((accId) => {
      if (typeof updateBitsyncDerivedPreview === 'function') updateBitsyncDerivedPreview(accId);
      let el = document.getElementById('bitsyncDailyProfit_' + accId);
      let hint = document.getElementById('bitsyncDailyProfitHint_' + accId);
      return {
        text: el ? el.textContent : '',
        hint: hint ? hint.textContent : '',
        hasUsdt: el ? String(el.textContent || '').indexOf('USDT') >= 0 : false
      };
    }, id);
    assert('BITSYNC live preview baseline 0 USDT', livePreview.text.indexOf('0') >= 0 && livePreview.hasUsdt, JSON.stringify(livePreview));
    assert('BITSYNC live preview baseline hint', livePreview.hint.indexOf('初回') >= 0 || livePreview.hint.indexOf('0 USDT') >= 0, livePreview.hint);

    // Partial fill → preview not confirmed
    await page.fill('#bitsyncCum_nftSaleRewardCumulative_' + id, '');
    await page.waitForTimeout(100);
    const incompletePreview = await page.evaluate((accId) => {
      updateBitsyncDerivedPreview(accId);
      let el = document.getElementById('bitsyncDailyProfit_' + accId);
      return el ? el.textContent : '';
    }, id);
    assert('BITSYNC incomplete fields show dash', incompletePreview === '—', incompletePreview);
    await page.fill('#bitsyncCum_nftSaleRewardCumulative_' + id, '200');
    await page.waitForTimeout(100);

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
      isBaseline: ae.isBaseline,
      inputMode: ae.inputMode,
      vaultCum: ae.operationRewardCumulative,
      vBonusCum: ae.profitBonusCumulative,
      stakeCum: ae.stakingRewardCumulative,
      nBonusCum: ae.nftSaleRewardCumulative,
      vault: ae.operationReward,
      vBonus: ae.profitBonus,
      stake: ae.stakingReward,
      nBonus: ae.nftSaleReward,
      nftTotal: nftTotal,
      opTotal: opTotal
    } : null;
  });
  assert('BITSYNC first save is baseline total 0', saved && Number(saved.total) === 0 && saved.isBaseline === true, JSON.stringify(saved));
  assert('BITSYNC first save stores cumulatives', saved &&
    Number(saved.vaultCum) === 100 && Number(saved.vBonusCum) === 50 &&
    Number(saved.stakeCum) === 25 && Number(saved.nBonusCum) === 200, JSON.stringify(saved));
  assert('BITSYNC first save daily zeros', saved &&
    Number(saved.vault) === 0 && Number(saved.vBonus) === 0 &&
    Number(saved.stake) === 0 && Number(saved.nBonus) === 0, JSON.stringify(saved));
  assert('BITSYNC cumulative NFT 4500', saved && saved.nftTotal === 4500, JSON.stringify(saved));
  assert('BITSYNC cumulative operating 7500', saved && saved.opTotal === 7500, JSON.stringify(saved));

  // Isolated cumulative calc scenarios (fixed dates; no prod cloud)
  const calcSuite = await page.evaluate(() => {
    const out = {};
    const accA = 'bs-calc-a';
    const accB = 'bs-calc-b';
    const cum = (v, b, s, n) => ({
      operationRewardCumulative: v,
      profitBonusCumulative: b,
      stakingRewardCumulative: s,
      nftSaleRewardCumulative: n
    });
    // preserve investment accounts from UI test; use separate revenue log keys
    const preservedInv = (settings.bitsyncInputAccounts || []).slice();
    settings.bitsyncInputAccounts = preservedInv.concat([
      { id: accA, username: 'calc-a', name: 'calc-a', startDate: '2026/10/16', nftPurchaseRecords: [], operatingRecords: [] },
      { id: accB, username: 'calc-b', name: 'calc-b', startDate: '2026/10/16', nftPurchaseRecords: [], operatingRecords: [] }
    ]);
    // wipe only calc account days by rebuilding log without calc ids — keep today UI entry
    const keepLog = {};
    Object.keys(settings.revenueLog || {}).forEach(function (dk) {
      const day = settings.revenueLog[dk];
      if (!day || !day.bitsyncAccounts) {
        keepLog[dk] = day;
        return;
      }
      const copy = Object.assign({}, day, { bitsyncAccounts: Object.assign({}, day.bitsyncAccounts) });
      delete copy.bitsyncAccounts[accA];
      delete copy.bitsyncAccounts[accB];
      keepLog[dk] = copy;
    });
    settings.revenueLog = keepLog;

    // 1) baseline + gap + delta
    pdSaveBitsyncPerformanceEntry('2026-10-16', accA, 'calc-a', cum(100, 50, 25, 200));
    pdSaveBitsyncPerformanceEntry('2026-10-18', accA, 'calc-a', cum(110, 55, 30, 210));
    const d16 = settings.revenueLog['2026-10-16'].bitsyncAccounts[accA];
    const d18 = settings.revenueLog['2026-10-18'].bitsyncAccounts[accA];
    out.baselineTotal = d16.total;
    out.baselineFlag = d16.isBaseline;
    out.gapDayTotal = d18.total;
    out.gapDayVault = d18.operationReward;
    out.gapDayStake = d18.stakingReward;

    // 2) same-day re-entry (overwrite 10-18)
    pdSaveBitsyncPerformanceEntry('2026-10-18', accA, 'calc-a', cum(120, 60, 35, 220));
    const d18b = settings.revenueLog['2026-10-18'].bitsyncAccounts[accA];
    out.sameDayTotal = d18b.total;
    out.sameDayVault = d18b.operationReward;

    // 3) past edit 10-17 insert path: add 10-17 then edit, with 10-18 present
    // Reset chain for past-edit scenario
    delete settings.revenueLog['2026-10-16'].bitsyncAccounts[accA];
    delete settings.revenueLog['2026-10-18'].bitsyncAccounts[accA];
    pdSaveBitsyncPerformanceEntry('2026-10-16', accA, 'calc-a', cum(100, 0, 0, 0));
    pdSaveBitsyncPerformanceEntry('2026-10-17', accA, 'calc-a', cum(105, 0, 0, 0));
    pdSaveBitsyncPerformanceEntry('2026-10-18', accA, 'calc-a', cum(110, 0, 0, 0));
    out.beforeEdit17 = settings.revenueLog['2026-10-17'].bitsyncAccounts[accA].total;
    out.beforeEdit18 = settings.revenueLog['2026-10-18'].bitsyncAccounts[accA].total;
    const preview = pdPreviewBitsyncCumulativeSave(accA, '2026-10-17', cum(107, 0, 0, 0));
    out.previewOk = preview.ok;
    out.preview17 = preview.impacts && preview.impacts.find(function (r) { return r.dateKey === '2026-10-17'; });
    out.preview18 = preview.impacts && preview.impacts.find(function (r) { return r.dateKey === '2026-10-18'; });
    pdSaveBitsyncPerformanceEntry('2026-10-17', accA, 'calc-a', cum(107, 0, 0, 0));
    out.afterEdit17 = settings.revenueLog['2026-10-17'].bitsyncAccounts[accA].total;
    out.afterEdit18 = settings.revenueLog['2026-10-18'].bitsyncAccounts[accA].total;
    out.afterEdit18Cum = settings.revenueLog['2026-10-18'].bitsyncAccounts[accA].operationRewardCumulative;

    // 4) decrease rejected
    const dec = pdPreviewBitsyncCumulativeSave(accA, '2026-10-18', cum(100, 0, 0, 0));
    out.decreaseOk = dec.ok;
    out.decreaseReason = dec.reason;

    // 5) inconsistency rejected (edit 10-16 vault above later day)
    const bad = pdPreviewBitsyncCumulativeSave(accA, '2026-10-16', cum(200, 0, 0, 0));
    out.inconsistOk = bad.ok;
    out.inconsistReason = bad.reason;

    // 6) legacy preserved
    settings.revenueLog['2026-10-10'] = {
      bitsyncAccounts: {
        [accA]: {
          accountId: accA,
          nftSaleReward: 90,
          operationReward: 10,
          profitBonus: 3,
          total: 103,
          inputMode: 'legacy'
        }
      },
      bitsync: 103
    };
    const legacyBefore = JSON.stringify(settings.revenueLog['2026-10-10'].bitsyncAccounts[accA]);
    pdSaveBitsyncPerformanceEntry('2026-10-19', accA, 'calc-a', cum(130, 0, 0, 0));
    const legacyAfter = JSON.stringify(settings.revenueLog['2026-10-10'].bitsyncAccounts[accA]);
    out.legacyUnchanged = legacyBefore === legacyAfter;
    out.legacyTotal = settings.revenueLog['2026-10-10'].bitsyncAccounts[accA].total;

    // 7) multi-account independence
    pdSaveBitsyncPerformanceEntry('2026-10-16', accB, 'calc-b', cum(1000, 0, 0, 0));
    pdSaveBitsyncPerformanceEntry('2026-10-18', accB, 'calc-b', cum(1005, 0, 0, 0));
    out.accB18 = settings.revenueLog['2026-10-18'].bitsyncAccounts[accB].total;
    out.accA18Still = settings.revenueLog['2026-10-18'].bitsyncAccounts[accA]
      ? settings.revenueLog['2026-10-18'].bitsyncAccounts[accA].total
      : null;

    // Seed portfolio profit data (4 fields) for card assertions
    settings.revenueLog['2026-10-20'] = settings.revenueLog['2026-10-20'] || {};
    settings.revenueLog['2026-10-20'].bitsyncAccounts = settings.revenueLog['2026-10-20'].bitsyncAccounts || {};
    // Use UI account for portfolio totals
    const uiAcc = preservedInv[0];
    if (uiAcc && uiAcc.id) {
      settings.revenueLog['2026-10-20'].bitsyncAccounts[uiAcc.id] = {
        accountId: uiAcc.id,
        accountName: uiAcc.username,
        operationReward: 50,
        profitBonus: 25,
        stakingReward: 10,
        nftSaleReward: 100,
        total: 185,
        inputMode: 'legacy'
      };
      settings.revenueLog['2026-10-20'] = pdRecalculateRevenueEntry(settings.revenueLog['2026-10-20'], '2026-10-20');
    }
    const bd = bitsyncSumAllTimeProfitBreakdown();
    out.pfVault = bd.vaultProfit;
    out.pfVBonus = bd.vBonusProfit;
    out.pfStake = bd.stakingProfit;
    out.pfNBonus = bd.nBonusProfit;
    out.pfTotal = bd.totalProfit;
    return out;
  });
  assert('calc baseline total 0', calcSuite.baselineTotal === 0 && calcSuite.baselineFlag === true, JSON.stringify(calcSuite));
  assert('calc gap-day delta total 30', calcSuite.gapDayTotal === 30, JSON.stringify(calcSuite));
  assert('calc gap-day vault delta 10', calcSuite.gapDayVault === 10, JSON.stringify(calcSuite));
  assert('calc gap-day staking delta 5', calcSuite.gapDayStake === 5, JSON.stringify(calcSuite));
  // Same-day rewrite uses cumulative from the last day BEFORE today (not the overwritten values).
  assert('calc same-day reentry vs prior day', calcSuite.sameDayTotal === 60 && calcSuite.sameDayVault === 20, JSON.stringify(calcSuite));
  assert('calc past-edit preview ok', calcSuite.previewOk === true, JSON.stringify(calcSuite));
  assert('calc past-edit 10/17 becomes 7', calcSuite.afterEdit17 === 7, JSON.stringify(calcSuite));
  assert('calc past-edit 10/18 becomes 3', calcSuite.afterEdit18 === 3, JSON.stringify(calcSuite));
  assert('calc past-edit keeps later cumulative 110', calcSuite.afterEdit18Cum === 110, JSON.stringify(calcSuite));
  assert('calc decrease rejected', calcSuite.decreaseOk === false && calcSuite.decreaseReason === 'decrease', JSON.stringify(calcSuite));
  assert('calc inconsistency rejected', calcSuite.inconsistOk === false && calcSuite.inconsistReason === 'inconsistency', JSON.stringify(calcSuite));
  assert('calc legacy history preserved', calcSuite.legacyUnchanged === true && calcSuite.legacyTotal === 103, JSON.stringify(calcSuite));
  assert('calc multi-account B delta 5', calcSuite.accB18 === 5, JSON.stringify(calcSuite));
  assert('calc staking in portfolio breakdown', calcSuite.pfStake >= 10 && calcSuite.pfNBonus >= 100, JSON.stringify(calcSuite));

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
      ok: text.indexOf('NFT購入') >= 0 && text.indexOf('N BONUS') >= 0 &&
        text.indexOf('運用額') >= 0 && text.indexOf('VAULT等利益') >= 0 &&
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
  assert('BITSYNC N BONUS profit includes seed', pfValues && pfValues.nftSaleProfit >= 100, JSON.stringify(pfValues));
  assert('BITSYNC VAULT等 profit includes staking path', pfValues && pfValues.operationProfit >= 75, JSON.stringify(pfValues));
  assert('BITSYNC total profit includes 4 fields', pfValues && pfValues.totalProfit >= 175, JSON.stringify(pfValues));
  assert('BITSYNC recovery positive', pfValues && pfValues.recovery != null && pfValues.recovery > 0, JSON.stringify(pfValues));

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
  const detailLabels = await page.evaluate(() => {
    let content = document.getElementById('modalContent');
    let text = content ? content.textContent || '' : '';
    return {
      hasVault: text.indexOf('VAULT 運用益') >= 0,
      hasVBonus: text.indexOf('V BONUS') >= 0,
      hasStaking: text.indexOf('ステーキング報酬') >= 0,
      hasNBonus: text.indexOf('N BONUS') >= 0,
      hasPrincipal: text.indexOf('NFT購入金額') >= 0 && text.indexOf('運用額') >= 0,
      hasMonthChart: text.indexOf('今月の収益構成') >= 0,
      hasPie: !!document.querySelector('.pfProfitDetail--bitsync .pfProfitPieChart, .pfProfitDetail--bitsync .pfProfitPieEmpty'),
      bd: typeof pfGetBitsyncProfitBreakdown === 'function'
        ? pfGetBitsyncProfitBreakdown(2026, 9) : null
    };
  });
  assert('BITSYNC detail 4 profit labels', detailLabels.hasVault && detailLabels.hasVBonus &&
    detailLabels.hasStaking && detailLabels.hasNBonus, JSON.stringify(detailLabels));
  assert('BITSYNC detail principal section', detailLabels.hasPrincipal, JSON.stringify(detailLabels));
  assert('BITSYNC detail month chart section', detailLabels.hasMonthChart && detailLabels.hasPie, JSON.stringify(detailLabels));
  assert('BITSYNC detail NFT purchase $4500', detailUi.bd && detailUi.bd.nftPurchaseUsd === 4500, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail personal operating $7500', detailUi.bd && detailUi.bd.personalOperatingUsd === 7500, JSON.stringify(detailUi.bd));
  assert('BITSYNC detail segments are 4', detailLabels.bd && detailLabels.bd.chartSegments &&
    detailLabels.bd.chartSegments.length === 4, JSON.stringify(detailLabels.bd && detailLabels.bd.chartSegments));

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
