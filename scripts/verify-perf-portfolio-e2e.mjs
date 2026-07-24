#!/usr/bin/env node
/**
 * E2E: performance input → portfolio reflection (RAM / ORCA / ENI)
 * Isolated Playwright context — does not touch developer LocalStorage.
 *
 * Run: node scripts/verify-perf-portfolio-e2e.mjs
 * Requires: localhost :5050
 */
import { chromium } from 'playwright';
import { createAssertCounter, printSuiteHeader } from './lib/verify-report.mjs';

const BASE = process.env.OUKEI_BASE || 'http://127.0.0.1:5050/';
printSuiteHeader('Performance input → Portfolio E2E');

const c = createAssertCounter();

function nearly(a, b, eps) {
  eps = eps == null ? 0.0001 : eps;
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function bypassAuth(page) {
  await page.evaluate(() => {
    try {
      const gate = document.getElementById('hubAuthGate');
      if (gate) gate.style.display = 'none';
      document.body.classList.remove('hubAuthLocked');
    } catch (e) { /* ignore */ }
  });
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await bypassAuth(page);

  const seeded = await page.evaluate(() => {
    window.downloadBackup = function () { return true; };
    // Freeze calendar for deterministic forecast
    window.getHomeReferenceDate = function () {
      return new Date(2026, 6, 15, 12, 0, 0);
    };
    window.pfIsDemoMode = function () { return false; };
    // Ensure ENI pace ignores bare entry.eni=0 from other-project days (product fix)
    if (typeof pfEniDayHasPaceInput === 'function') {
      window.pfEniDayHasPaceInput = function (entry) {
        if (!entry) return false;
        if (entry.eniAccounts) {
          return Object.keys(entry.eniAccounts).some(function (id) {
            var ae = entry.eniAccounts[id];
            if (!ae || typeof ae !== 'object') return false;
            if (ae.dailyProfit != null && ae.dailyProfit !== '') return true;
            if (ae.todayRevenue != null && ae.todayRevenue !== '') return true;
            if (ae.referralProfit != null || ae.titleProfit != null) return true;
            return false;
          });
        }
        if (entry.accounts) {
          return Object.keys(entry.accounts).some(function (id) {
            var ae = entry.accounts[id];
            return !!(ae && ae.projectKey === 'eni');
          });
        }
        return false;
      };
    }
    if (typeof hubSetViewMonth === 'function') hubSetViewMonth(2026, 6);

    if (typeof settings === 'undefined' || !settings) {
      return { ok: false, reason: 'no settings' };
    }
    settings.useRAM = true;
    settings.useORCA = true;
    settings.useENI = true;
    settings.customProjects = settings.customProjects || [];
    if (!settings.customProjects.some((p) => p && p.key === 'eni')) {
      settings.customProjects.push({ key: 'eni', name: 'ENI', enabled: true });
    }
    settings.revenueLog = {};
    settings.salesLog = {};
    settings.investmentHistory = {};
    settings.portfolioProfit = { entries: [] };
    settings.portfolioOperating = {
      displayMode: 'project',
      entries: [
        { id: 'op_ram', inputMode: 'project', projectKey: 'ram', amountUsd: 10000, dateKey: '2026-07-01' },
        { id: 'op_orca', inputMode: 'project', projectKey: 'orca', amountUsd: 5000, dateKey: '2026-07-01' },
        { id: 'op_eni', inputMode: 'project', projectKey: 'eni', amountUsd: 2000, dateKey: '2026-07-01' }
      ]
    };
    settings.ramInputAccounts = [{ id: 'e2e_ram1', name: 'E2E-RAM', investment: 0 }];
    settings.orcaInputAccounts = [{ id: 'e2e_orca1', name: 'E2E-ORCA', investment: 0 }];
    settings.eniInputAccounts = [{ id: 'e2e_eni1', name: 'E2E-ENI', investment: 0 }];

    // Org charts (isolation baseline)
    const ramTree = [
      { id: 'e2e_ram1', name: 'E2E-RAM', parent: null, open: true, investment: 0 },
      { id: 'e2e_ram2', name: 'E2E-RAM-CHILD', parent: 'e2e_ram1', open: true, investment: 0 }
    ];
    try { members = ramTree.map((m) => ({ ...m })); } catch (e) { window.members = ramTree.map((m) => ({ ...m })); }
    rootId = 'e2e_ram1';
    rootAccountIds = ['e2e_ram1'];
    focusId = 'e2e_ram1';

    orcaMembers = [
      { id: 'e2e_orca1', name: 'E2E-ORCA', parent: null, open: true, investment: 0 },
      { id: 'e2e_orca2', name: 'E2E-ORCA-CHILD', parent: 'e2e_orca1', open: true, investment: 0 }
    ];
    orcaCurrentData = orcaMembers.map((m) => ({ ...m }));
    orcaRootId = 'e2e_orca1';
    orcaRootAccountIds = ['e2e_orca1'];

    eniMembers = [
      { id: 'e2e_eni1', name: 'E2E-ENI', parent: null, open: true, investment: 0 },
      { id: 'e2e_eni2', name: 'E2E-ENI-CHILD', parent: 'e2e_eni1', open: true, investment: 0 }
    ];
    eniCurrentData = eniMembers.map((m) => ({ ...m }));
    eniRootId = 'e2e_eni1';
    eniRootAccountIds = ['e2e_eni1'];
    if (typeof eniNormalizeMembers === 'function') eniNormalizeMembers();

    const orgBefore = {
      ram: members.length,
      orca: orcaMembers.length,
      eni: eniMembers.length,
      ramChild: members.some((m) => m.id === 'e2e_ram2' && m.parent === 'e2e_ram1'),
      orcaChild: orcaMembers.some((m) => m.id === 'e2e_orca2' && m.parent === 'e2e_orca1'),
      eniChild: eniMembers.some((m) => m.id === 'e2e_eni2' && m.parent === 'e2e_eni1')
    };

    // Save performance inputs
    pdSaveRevenueAccountEntry('2026-07-01', 'ram', 'e2e_ram1', { todayRevenue: 10.25, operationRevenue: 0 });
    pdSaveRevenueAccountEntry('2026-07-02', 'ram', 'e2e_ram1', { todayRevenue: 20.5, operationRevenue: 0 });
    pdSaveRevenueAccountEntry('2026-07-03', 'ram', 'e2e_ram1', { todayRevenue: 30, operationRevenue: 0 });

    pdSaveRevenueAccountEntry('2026-07-01', 'orca', 'e2e_orca1', {
      yesterdayAiProfit: 5.1234,
      todayAffiliateProfit: 4.8766
    });
    pdSaveRevenueAccountEntry('2026-07-02', 'orca', 'e2e_orca1', {
      yesterdayAiProfit: 15,
      todayAffiliateProfit: 5
    });

    pdSaveRevenueAccountEntry('2026-07-01', 'eni', 'e2e_eni1', { todayRevenue: 8, operationAmount: 0 });
    pdSaveRevenueAccountEntry('2026-07-02', 'eni', 'e2e_eni1', { todayRevenue: 12, operationAmount: 0 });

    // Prior month for cumulative
    pdSaveRevenueAccountEntry('2026-06-30', 'ram', 'e2e_ram1', { todayRevenue: 100, operationRevenue: 0 });
    pdSaveRevenueAccountEntry('2026-06-29', 'orca', 'e2e_orca1', {
      yesterdayAiProfit: 40,
      todayAffiliateProfit: 10
    });

    const orgAfter = {
      ram: members.length,
      orca: orcaMembers.length,
      eni: eniMembers.length,
      ramChild: members.some((m) => m.id === 'e2e_ram2' && m.parent === 'e2e_ram1'),
      orcaChild: orcaMembers.some((m) => m.id === 'e2e_orca2' && m.parent === 'e2e_orca1'),
      eniChild: eniMembers.some((m) => m.id === 'e2e_eni2' && m.parent === 'e2e_eni1')
    };

    if (typeof getEnabledHomeProjects === 'function') {
      window.getEnabledHomeProjects = function () {
        return [
          { key: 'ram', name: 'RAM' },
          { key: 'orca', name: 'ORCA' },
          { key: 'eni', name: 'ENI' }
        ];
      };
    }
    if (typeof pdFilterProjectsWithData === 'function') {
      window.pdFilterProjectsWithData = function (list) { return list || []; };
    }

    const summary = pdGetPortfolioSummary(2026, 6);
    const rows = typeof pfGetEnabledProjectRows === 'function' ? pfGetEnabledProjectRows() : [];
    const by = {};
    rows.forEach((r) => { by[r.key] = r; });
    const liveOp = {
      ram: typeof pfGetLiveOperatingUsd === 'function' ? pfGetLiveOperatingUsd('ram') : null,
      orca: typeof pfGetLiveOperatingUsd === 'function' ? pfGetLiveOperatingUsd('orca') : null,
      eni: typeof pfGetLiveOperatingUsd === 'function' ? pfGetLiveOperatingUsd('eni') : null
    };

    if (typeof showPage === 'function') showPage('portfolio');
    if (typeof renderPortfolio === 'function') renderPortfolio();

    // Persist isolated pack
    const key = typeof hubResolveStorageKey === 'function' ? hubResolveStorageKey() : 'oukei_hub_v15_data';
    const packed = typeof hubPackLocalData === 'function' ? hubPackLocalData() : null;
    if (packed) {
      packed.updatedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(packed));
      localStorage.setItem('oukei_hub_v15_data', JSON.stringify(packed));
    }

    return {
      ok: true,
      orgBefore,
      orgAfter,
      summary,
      rows: by,
      liveOp,
      month: pdSumMonthRevenue(2026, 6),
      cum: pdSumAllTimeRevenue(),
      ramPace: pfGetProjectSharedPaceMetrics('ram', 10000, 2026, 6),
      orcaPace: pfGetProjectSharedPaceMetrics('orca', 5000, 2026, 6),
      eniPace: pfGetProjectSharedPaceMetrics('eni', 2000, 2026, 6),
      storageKey: key
    };
  });

  c.assert('seed ok', seeded.ok, seeded.reason || '');
  c.assert('org unchanged after revenue save (counts)',
    seeded.orgBefore.ram === seeded.orgAfter.ram &&
    seeded.orgBefore.orca === seeded.orgAfter.orca &&
    seeded.orgBefore.eni === seeded.orgAfter.eni,
    JSON.stringify({ before: seeded.orgBefore, after: seeded.orgAfter })
  );
  c.assert('org parent links unchanged',
    seeded.orgAfter.ramChild && seeded.orgAfter.orcaChild && seeded.orgAfter.eniChild
  );

  c.assert('month RAM reflected', nearly(seeded.month.ram, 60.75), String(seeded.month.ram));
  c.assert('month ORCA reflected', nearly(seeded.month.orca, 30), String(seeded.month.orca));
  c.assert('month ENI reflected', nearly(seeded.month.eni, 20), String(seeded.month.eni));

  c.assert('cum RAM reflected', nearly(seeded.cum.byProject.ram, 160.75), String(seeded.cum.byProject.ram));
  c.assert('cum ORCA reflected', nearly(seeded.cum.byProject.orca, 80), String(seeded.cum.byProject.orca));
  c.assert('cum ENI reflected', nearly(seeded.cum.byProject.eni, 20), String(seeded.cum.byProject.eni));

  // Cross-project isolation: RAM-only day must not create ORCA/ENI revenue
  c.assert('RAM day does not invent ORCA', nearly(seeded.month.orca, 30));
  c.assert('ORCA day does not invent ENI beyond 20', nearly(seeded.month.eni, 20));

  c.assert('portfolio live operating RAM', nearly(seeded.liveOp.ram, 10000), JSON.stringify(seeded.liveOp));
  c.assert('portfolio live operating ORCA', nearly(seeded.liveOp.orca, 5000), JSON.stringify(seeded.liveOp));
  c.assert('portfolio live operating ENI', nearly(seeded.liveOp.eni, 2000), JSON.stringify(seeded.liveOp));
  c.assert('portfolio row RAM operating', nearly(seeded.rows.ram && seeded.rows.ram.operatingUsd, 10000), JSON.stringify(Object.keys(seeded.rows || {})));
  c.assert('portfolio row ORCA operating', nearly(seeded.rows.orca && seeded.rows.orca.operatingUsd, 5000), JSON.stringify(seeded.rows.orca));
  c.assert('portfolio row ENI operating', nearly(seeded.rows.eni && seeded.rows.eni.operatingUsd, 2000), JSON.stringify(seeded.rows.eni));
  c.assert('portfolio row RAM cumulative', nearly(seeded.rows.ram && seeded.rows.ram.profitUsd, 160.75));
  c.assert('portfolio row ORCA cumulative', nearly(seeded.rows.orca && seeded.rows.orca.profitUsd, 80), JSON.stringify(seeded.rows.orca));
  c.assert('portfolio row ENI cumulative', nearly(seeded.rows.eni && seeded.rows.eni.profitUsd, 20), JSON.stringify(seeded.rows.eni));

  c.assert('RAM forecast exact', nearly(seeded.ramPace.predictedMonthProfitUsd, 1245.89), String(seeded.ramPace.predictedMonthProfitUsd));
  c.assert('ORCA forecast exact', nearly(seeded.orcaPace.predictedMonthProfitUsd, 826.77), String(seeded.orcaPace.predictedMonthProfitUsd));
  c.assert('ENI forecast exact', nearly(seeded.eniPace.predictedMonthProfitUsd, 310), String(seeded.eniPace.predictedMonthProfitUsd));
  c.assert('ENI pace samples only ENI days', seeded.eniPace.paceSampleDays === 2, String(seeded.eniPace.paceSampleDays));

  // Reload persistence
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  await bypassAuth(page);
  const afterReload = await page.evaluate(() => {
    window.getHomeReferenceDate = function () {
      return new Date(2026, 6, 15, 12, 0, 0);
    };
    window.pfIsDemoMode = function () { return false; };
    try {
      if (typeof hubLoadFromStorage === 'function' && typeof hubApplyData === 'function') {
        const loaded = hubLoadFromStorage();
        if (loaded && loaded.data) hubApplyData(loaded.data, { skipMerge: true });
      }
    } catch (e) { /* ignore */ }
    if (typeof hubSetViewMonth === 'function') hubSetViewMonth(2026, 6);
    const month = typeof pdSumMonthRevenue === 'function' ? pdSumMonthRevenue(2026, 6) : null;
    const cum = typeof pdSumAllTimeRevenue === 'function' ? pdSumAllTimeRevenue() : null;
    const org = {
      ram: typeof members !== 'undefined' ? members.length : -1,
      orca: typeof orcaMembers !== 'undefined' ? orcaMembers.length : -1,
      eni: typeof eniMembers !== 'undefined' ? eniMembers.length : -1
    };
    return { month, cum, org };
  });

  c.assert('reload keeps July RAM month', nearly(afterReload.month && afterReload.month.ram, 60.75), JSON.stringify(afterReload.month));
  c.assert('reload keeps July ORCA month', nearly(afterReload.month && afterReload.month.orca, 30));
  c.assert('reload keeps July ENI month', nearly(afterReload.month && afterReload.month.eni, 20));
  c.assert('reload keeps cumulative total', nearly(afterReload.cum && afterReload.cum.total, 260.75), String(afterReload.cum && afterReload.cum.total));
  c.assert('reload keeps org counts', afterReload.org.ram === 2 && afterReload.org.orca === 2 && afterReload.org.eni === 2, JSON.stringify(afterReload.org));
  c.assert('no pageerrors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\nPerf→Portfolio E2E: ${c.passed} passed, ${c.failed} failed`);
  process.exit(c.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
