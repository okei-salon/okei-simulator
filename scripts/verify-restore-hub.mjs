#!/usr/bin/env node
/**
 * Phase C: verify restoreBackup + unified v2 hub on localhost.
 * Usage: node scripts/verify-restore-hub.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseUrl = process.argv[2] || 'http://127.0.0.1:5050';
const v2Hub = JSON.parse(
  fs.readFileSync(path.join(root, 'merge-output/OUKEI_HUB_KAI2_UNIFIED_v2_20260711.hub'), 'utf8')
);
const bHub = JSON.parse(
  fs.readFileSync('/Users/kaiyasuhiro/Downloads/OUKEI_HUB_B_localhost.hub', 'utf8')
);

const checks = [];
function assert(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.body.classList.add('hub-auth-ready'));

  await page.evaluate((data) => {
    if (typeof hubApplyData === 'function') hubApplyData(data);
    else {
      members = data.members;
      currentData = data.currentData;
      settings = data.settings;
      rootId = data.rootId;
      rootAccountIds = data.rootAccountIds;
    }
  }, bHub);

  const bState = await page.evaluate(() => ({
    members: members.length,
    roots: rootAccountIds.length,
    kaiChildren: members.filter((m) => m.parent === 'm1').map((m) => m.username),
  }));
  assert('B baseline injected', bState.members === 32 && bState.roots === 3, JSON.stringify(bState));

  await page.evaluate((data) => {
    if (typeof hubApplyData === 'function') {
      hubApplyData(data);
    } else {
      members = data.members || members;
      currentData = data.currentData || currentData;
      settings = Object.assign(
        typeof hubCreateDefaultSettings === 'function' ? hubCreateDefaultSettings() : {},
        data.settings || {}
      );
      scenarios = data.scenarios || [];
      rootId = data.rootId || rootId;
      rootAccountIds = data.rootAccountIds || rootAccountIds || [];
    }
    focusId = rootId || focusId;
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
    if (typeof pmEnsureFxSettings === 'function') pmEnsureFxSettings();
    if (typeof pfEnsureManageDisplayAccounts === 'function') pfEnsureManageDisplayAccounts();
    if (typeof pfEnsurePerformanceInputHiddenAccounts === 'function') {
      pfEnsurePerformanceInputHiddenAccounts();
    }
    if (typeof pfMigrateDisplaySettingsCompat === 'function') pfMigrateDisplaySettingsCompat();
    if (typeof ensurePerformanceLogs === 'function') ensurePerformanceLogs();
    if (typeof hubSaveNow === 'function') hubSaveNow();
    if (typeof render === 'function') render();
    if (typeof orcaRender === 'function') orcaRender();
  }, v2Hub);

  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const kai2Ids = members.filter((m) => m.id === 'imp_mr604mrj_0').map((m) => m.username);
    const hidden = (settings.performanceInputHiddenAccounts && settings.performanceInputHiddenAccounts.ram) || [];
    const ramAccounts = typeof getRamInputAccounts === 'function' ? getRamInputAccounts() : [];
    let kai2RevDays = 0;
    Object.keys(settings.revenueLog || {}).forEach((dk) => {
      const ae = settings.revenueLog[dk].ramAccounts && settings.revenueLog[dk].ramAccounts['imp_mr604mrj_0'];
      if (ae && ae.todayRevenue != null && ae.todayRevenue !== '') kai2RevDays += 1;
    });
    let kai2SalesDays = 0;
    Object.keys(settings.salesLog || {}).forEach((dk) => {
      const ae = settings.salesLog[dk].accounts && settings.salesLog[dk].accounts['imp_mr604mrj_0'];
      if (ae && ae.todaySales != null) kai2SalesDays += 1;
    });
    let doubleRev = 0;
    Object.values(settings.revenueLog || {}).forEach((entry) => {
      const ra = entry.ramAccounts || {};
      if (ra.m1783174063025 && ra.imp_mr604mrj_0) doubleRev += 1;
    });
    return {
      members: members.length,
      roots: rootAccountIds.length,
      rootIds: rootAccountIds.slice(),
      kaiChildren: members.filter((m) => m.parent === 'm1').map((m) => m.username),
      kai2IdCount: kai2Ids.length,
      ramInputCount: ramAccounts.length,
      ramInputIds: ramAccounts.map((a) => a.id),
      kai2InRamInput: ramAccounts.filter((a) => a.id === 'imp_mr604mrj_0').length,
      orgSummaryCount: typeof allOrgSummary === 'function' ? allOrgSummary().list.length : -1,
      operatingUsd: typeof pfResolvePortfolioOperatingUsd === 'function'
        ? pfResolvePortfolioOperatingUsd('ram')
        : null,
      cumulativeProfit: typeof pdSumAllTimeRevenue === 'function' ? pdSumAllTimeRevenue().total : null,
      kai2RevDays,
      kai2SalesDays,
      doubleRev,
      oldIdInMembers: members.some((m) => m.id === 'm1783174063025'),
      hiddenRam: hidden,
    };
  });

  assert('members count 39', state.members === 39, String(state.members));
  assert('rootAccountIds count 8', state.roots === 8, String(state.roots));
  assert('kai2 id unique', state.kai2IdCount === 1, String(state.kai2IdCount));
  assert('old id removed from members', !state.oldIdInMembers, '');
  assert('kai3-kai8 under kai', ['kai3', 'kai4', 'kai5', 'kai6', 'kai7', 'kai8'].every((u) => state.kaiChildren.includes(u)), state.kaiChildren.join(','));
  assert('yone under kai', state.kaiChildren.includes('sayota1'), state.kaiChildren.join(','));
  assert('org summary 8 roots', state.orgSummaryCount === 8, String(state.orgSummaryCount));
  assert('ram input includes kai2 once', state.kai2InRamInput === 1, String(state.kai2InRamInput));
  assert('kai2 revenue 133 days', state.kai2RevDays === 133, String(state.kai2RevDays));
  assert('kai2 sales 127 days', state.kai2SalesDays === 127, String(state.kai2SalesDays));
  assert('no double kai2 revenue keys', state.doubleRev === 0, String(state.doubleRev));
  assert('portfolio operating 3900', state.operatingUsd === 3900, String(state.operatingUsd));
  assert('cumulative profit > 0', (state.cumulativeProfit || 0) > 0, String(state.cumulativeProfit));

  const orcaState = await page.evaluate(() => {
    const inputAccounts =
      typeof getOrcaInputAccounts === 'function' ? getOrcaInputAccounts() : [];
    let orcaRevDays = 0;
    Object.keys(settings.revenueLog || {}).forEach((dk) => {
      const oa = settings.revenueLog[dk].orcaAccounts || {};
      Object.keys(oa).forEach((aid) => {
        const ae = oa[aid];
        if (ae && (ae.yesterdayAiProfit != null || ae.todayAffiliateProfit != null)) {
          orcaRevDays += 1;
        }
      });
    });
    const totals =
      typeof orcaCalcTotals === 'function' && orcaRootId ? orcaCalcTotals(orcaRootId) : null;
    return {
      orcaMembers: orcaMembers.length,
      orcaRoots: orcaRootAccountIds.length,
      orcaRootId,
      orcaInputCount: inputAccounts.length,
      orcaInputIds: inputAccounts.map((a) => a.id),
      orcaOperatingUsd:
        typeof pfResolvePortfolioOperatingUsd === 'function'
          ? pfResolvePortfolioOperatingUsd('orca')
          : null,
      orcaCumulative:
        typeof pdSumAllTimeRevenue === 'function'
          ? (pdSumAllTimeRevenue().byProject || {}).orca
          : null,
      orcaRevDays,
      orcaCardTotal: totals ? totals.total : 0,
    };
  });

  assert('orca members 2', orcaState.orcaMembers === 2, String(orcaState.orcaMembers));
  assert('orca rootAccountIds 2', orcaState.orcaRoots === 2, String(orcaState.orcaRoots));
  assert('orca rootId set', !!orcaState.orcaRootId, orcaState.orcaRootId || 'empty');
  assert('orca input accounts 2', orcaState.orcaInputCount === 2, String(orcaState.orcaInputCount));
  assert(
    'orca portfolio operating 1100',
    orcaState.orcaOperatingUsd === 1100,
    String(orcaState.orcaOperatingUsd)
  );
  assert(
    'orca cumulative profit > 0',
    (orcaState.orcaCumulative || 0) > 0,
    String(orcaState.orcaCumulative)
  );
  assert('orca revenue history days > 0', orcaState.orcaRevDays > 0, String(orcaState.orcaRevDays));

  await page.evaluate(() => {
    if (typeof orcaApplyOrgChart !== 'function') return;
    const deep = {
      members: [
        {
          id: 'orca_1783005565893',
          parent: null,
          name: 'kai1',
          username: 'kai1',
          rank: 0,
          investment: 1000,
          aiAgent: '不明',
          personalSales: 0,
          groupSales: 0,
          open: true,
          bvMode: 'MANUAL',
          bvPrompted: false,
        },
        {
          id: 'orca_test_child_1',
          parent: 'orca_1783005565893',
          name: 'test-child',
          username: 'testchild',
          rank: 0,
          investment: 50,
          aiAgent: '不明',
          personalSales: 0,
          groupSales: 0,
          open: true,
          bvMode: 'MANUAL',
          bvPrompted: false,
        },
        {
          id: 'orca_1783005577176',
          parent: null,
          name: 'kai2',
          username: 'kai2',
          rank: 0,
          investment: 100,
          aiAgent: '不明',
          personalSales: 0,
          groupSales: 0,
          open: true,
          bvMode: 'MANUAL',
          bvPrompted: false,
        },
      ],
      currentData: [],
      scenarios: [],
      rootId: 'orca_1783005565893',
      rootAccountIds: ['orca_1783005565893', 'orca_1783005577176'],
      zoom: 1,
    };
    deep.currentData = JSON.parse(JSON.stringify(deep.members));
    orcaApplyOrgChart(deep);
  });

  await page.evaluate((data) => {
    if (typeof hubApplyData === 'function') hubApplyData(data);
  }, v2Hub);
  await page.waitForTimeout(300);

  const orcaHierarchyState = await page.evaluate(() => ({
    orcaMembers: orcaMembers.length,
    orcaWithParent: orcaMembers.filter((m) => m.parent).length,
    kai1Children: orcaMembers.filter((m) => m.parent === 'orca_1783005565893').length,
  }));
  assert(
    'orca hierarchy preserved on shallow restore',
    orcaHierarchyState.orcaWithParent >= 1 && orcaHierarchyState.kai1Children >= 1,
    JSON.stringify(orcaHierarchyState)
  );

  await page.evaluate(() => {
    if (typeof showPage === 'function') showPage('orcaOrg');
  });
  await page.waitForTimeout(800);
  const orcaOrgText = await page.evaluate(() => {
    const el = document.getElementById('orcaOrgPage');
    const sel = document.getElementById('orcaRootAccountSelect');
    const options = sel ? Array.from(sel.options).map((o) => o.textContent.trim()) : [];
    return {
      text: el ? el.innerText.slice(0, 600) : '',
      rootOptions: options,
      onlyAdd: el ? el.innerText.includes('＋追加') && !el.innerText.includes('kai1') : false,
    };
  });
  assert('orca org page has kai1/kai2', orcaOrgText.rootOptions.some((o) => o.includes('kai1')), orcaOrgText.rootOptions.join(','));
  assert('orca org root select 2 options', orcaOrgText.rootOptions.length === 2, String(orcaOrgText.rootOptions.length));
  assert('orca org not empty-only', !orcaOrgText.onlyAdd, orcaOrgText.text.slice(0, 80));

  await page.evaluate(() => {
    if (typeof openOrcaRevenueInput === 'function') openOrcaRevenueInput();
  });
  await page.waitForTimeout(500);
  const orcaInputText = await page.evaluate(() => {
    const el = document.getElementById('modalContent');
    return el ? el.innerText : '';
  });
  assert(
    'orca performance input renders accounts',
    orcaInputText.includes('kai1') && orcaInputText.includes('kai2'),
    orcaInputText.slice(0, 120)
  );

  await page.evaluate(() => { if (typeof showPage === 'function') showPage('ram'); });
  await page.waitForTimeout(500);
  const rootOptions = await page.evaluate(() => {
    const sel = document.getElementById('rootAccountSelect');
    if (!sel) return [];
    return Array.from(sel.options).map((o) => o.textContent.trim());
  });
  assert('root select 8 options', rootOptions.length === 8, String(rootOptions.length));

  await page.evaluate(() => { if (typeof showPage === 'function') showPage('portfolio'); });
  await page.waitForTimeout(800);
  const pfText = await page.evaluate(() => {
    const el = document.getElementById('portfolioPage');
    return el ? el.innerText.slice(0, 500) : '';
  });
  assert('portfolio page renders', pfText.includes('ポートフォリオ') || pfText.includes('RAM'), pfText.slice(0, 80));

  await page.evaluate(() => { if (typeof showPage === 'function') showPage('revenueManage'); });
  await page.waitForTimeout(800);
  const revText = await page.evaluate(() => {
    const el = document.getElementById('revenueManagePage');
    return el ? el.innerText : '';
  });
  assert('revenue manage renders', revText.includes('収益') || revText.length > 50, String(revText.length));

  await page.evaluate(() => { if (typeof showPage === 'function') showPage('salesManage'); });
  await page.waitForTimeout(800);
  const salesText = await page.evaluate(() => {
    const el = document.getElementById('salesManagePage');
    return el ? el.innerText : '';
  });
  assert('sales manage renders', salesText.includes('売上') || salesText.length > 50, String(salesText.length));

  const failed = checks.filter((c) => !c.ok);
  console.log('\n=== SUMMARY ===');
  console.log(`Passed ${checks.length - failed.length}/${checks.length}`);
  if (failed.length) {
    console.error('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
} finally {
  await browser.close();
}
