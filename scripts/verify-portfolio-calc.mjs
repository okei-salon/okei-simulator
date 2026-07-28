#!/usr/bin/env node
/**
 * Portfolio calculation exact-value tests (fixed fixture, isolated settings).
 * Covers operating / cumulative / monthly / month-end forecast / predicted yield
 * for RAM / ORCA / ENI, plus decimal + month-boundary cases.
 *
 * Run: node scripts/verify-portfolio-calc.mjs
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { createAssertCounter, printSuiteHeader, exitFromCounter } from './lib/verify-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

printSuiteHeader('Portfolio calculation (exact values)');

const REF = new Date(2026, 6, 15, 12, 0, 0); // 2026-07-15 local

function loadCtx() {
  const ctx = {
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    JSON,
    isNaN,
    parseInt,
    parseFloat,
    undefined,
    members: [],
    currentData: [],
    scenarios: [],
    rootId: '',
    rootAccountIds: [],
    orcaMembers: [],
    orcaRootId: '',
    orcaRootAccountIds: [],
    eniMembers: [],
    eniRootId: '',
    eniRootAccountIds: [],
    settings: {
      useRAM: true,
      useORCA: true,
      useENI: true,
      customProjects: [{ key: 'eni', name: 'ENI', enabled: true }],
      revenueLog: {},
      salesLog: {},
      investmentHistory: {},
      portfolioOperating: {
        displayMode: 'project',
        entries: [
          { id: 'op_ram', inputMode: 'project', projectKey: 'ram', amountUsd: 10000, dateKey: '2026-07-01' },
          { id: 'op_orca', inputMode: 'project', projectKey: 'orca', amountUsd: 5000, dateKey: '2026-07-01' },
          { id: 'op_eni', inputMode: 'project', projectKey: 'eni', amountUsd: 2000, dateKey: '2026-07-01' }
        ]
      },
      portfolioProfit: { entries: [] },
      portfolioGoal: { amountYen: 0, rates: {} },
      ramInputAccounts: [{ id: 't_ram1', name: 'T-RAM', investment: 0 }],
      orcaInputAccounts: [{ id: 't_orca1', name: 'T-ORCA', investment: 0 }],
      eniInputAccounts: [{ id: 't_eni1', name: 'T-ENI', investment: 0 }]
    },
    getHomeReferenceDate() { return new Date(REF.getTime()); },
    todayKey() { return '2026-07-15'; },
    yesterdayKey() { return '2026-07-14'; },
    revenueDateKey(y, m, d) {
      return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    },
    calcRamOperatingProfit(inv) {
      return Math.round((Number(inv) || 0) * 0.01 * 100) / 100;
    },
    getEnabledHomeProjects() {
      return [
        { key: 'ram', name: 'RAM' },
        { key: 'orca', name: 'ORCA' },
        { key: 'eni', name: 'ENI' }
      ];
    },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; }
    },
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; },
      querySelector() { return null; },
      addEventListener() {}
    },
    window: {},
    hubSaveToStorage() {},
    persistHubSettings() {},
    markActivity() {},
    markSettingsDirty() {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  const pdCode = readFileSync(path.join(root, 'assets/js/performance-data.js'), 'utf8')
    .replace(/\bif \(typeof window !== 'undefined'\)[\s\S]*$/, '');
  vm.runInContext(pdCode, ctx);

  const pfCode = readFileSync(path.join(root, 'assets/js/portfolio.js'), 'utf8')
    .replace(/\bwindow\.[A-Za-z0-9_]+\s*=\s*[A-Za-z0-9_]+;?\s*$/gm, '');
  vm.runInContext(pfCode, ctx);

  // Force non-demo + July 2026 view
  ctx.pfIsDemoMode = function () { return false; };
  if (typeof ctx.hubResetViewMonth === 'function') ctx.hubResetViewMonth();
  if (typeof ctx.hubSetViewMonth === 'function') ctx.hubSetViewMonth(2026, 6);
  else {
    ctx.hubViewMonth = { y: 2026, m: 6, _inited: true };
  }

  return ctx;
}

const c = createAssertCounter();
const ctx = loadCtx();

function nearly(a, b, eps) {
  eps = eps == null ? 0.0001 : eps;
  return Math.abs(Number(a) - Number(b)) <= eps;
}

// Seed known daily revenues (July 2026, through mid-month)
ctx.pdSaveRevenueAccountEntry('2026-07-01', 'ram', 't_ram1', {
  todayRevenue: 10.25,
  operationRevenue: 0
});
ctx.pdSaveRevenueAccountEntry('2026-07-02', 'ram', 't_ram1', {
  todayRevenue: 20.5,
  operationRevenue: 0
});
ctx.pdSaveRevenueAccountEntry('2026-07-03', 'ram', 't_ram1', {
  todayRevenue: 30,
  operationRevenue: 0
});

ctx.pdSaveRevenueAccountEntry('2026-07-01', 'orca', 't_orca1', {
  yesterdayAiProfit: 5.1234,
  todayAffiliateProfit: 4.8766
}); // total 10
ctx.pdSaveRevenueAccountEntry('2026-07-02', 'orca', 't_orca1', {
  yesterdayAiProfit: 15,
  todayAffiliateProfit: 5
}); // total 20

// ENI via simple todayRevenue model (no USDT chain)
ctx.pdSaveRevenueAccountEntry('2026-07-01', 'eni', 't_eni1', {
  todayRevenue: 8,
  operationAmount: 0
});
ctx.pdSaveRevenueAccountEntry('2026-07-02', 'eni', 't_eni1', {
  todayRevenue: 12,
  operationAmount: 0
});

// Prior month (June) for boundary / cumulative
ctx.pdSaveRevenueAccountEntry('2026-06-30', 'ram', 't_ram1', {
  todayRevenue: 100,
  operationRevenue: 0
});
ctx.pdSaveRevenueAccountEntry('2026-06-29', 'orca', 't_orca1', {
  yesterdayAiProfit: 40,
  todayAffiliateProfit: 10
}); // 50

const monthJul = ctx.pdSumMonthRevenue(2026, 6);
c.assert('July RAM monthly = 60.75', nearly(monthJul.ram, 60.75), String(monthJul.ram));
c.assert('July ORCA monthly = 30', nearly(monthJul.orca, 30), String(monthJul.orca));
c.assert('July ENI monthly = 20', nearly(monthJul.eni, 20), String(monthJul.eni));
c.assert('July total = 110.75', nearly(monthJul.total, 110.75), String(monthJul.total));

const monthJun = ctx.pdSumMonthRevenue(2026, 5);
c.assert('June RAM monthly = 100', nearly(monthJun.ram, 100), String(monthJun.ram));
c.assert('June ORCA monthly = 50', nearly(monthJun.orca, 50), String(monthJun.orca));

const cum = ctx.pdSumAllTimeRevenue();
c.assert('Cumulative RAM = 160.75', nearly(cum.byProject.ram, 160.75), String(cum.byProject.ram));
c.assert('Cumulative ORCA = 80', nearly(cum.byProject.orca, 80), String(cum.byProject.orca));
c.assert('Cumulative ENI = 20', nearly(cum.byProject.eni, 20), String(cum.byProject.eni));
c.assert('Cumulative total = 260.75', nearly(cum.total, 260.75), String(cum.total));

const summary = ctx.pdGetPortfolioSummary(2026, 6);
c.assert('Summary monthlyRevenue = 110.75', nearly(summary.monthlyRevenue, 110.75), String(summary.monthlyRevenue));
c.assert('Summary cumulativeRevenue = 260.75', nearly(summary.cumulativeRevenue, 260.75), String(summary.cumulativeRevenue));
c.assert('Summary view is July 2026', summary.viewYear === 2026 && summary.viewMonth === 6);

// Operating amounts from portfolioOperating
c.assert('Operating RAM = 10000', nearly(ctx.pfGetLiveOperatingUsd('ram'), 10000));
c.assert('Operating ORCA = 5000', nearly(ctx.pfGetLiveOperatingUsd('orca'), 5000));
c.assert('Operating ENI = 2000', nearly(ctx.pfGetLiveOperatingUsd('eni'), 2000));

// Pace / forecast (current month July, daysInMonth=31, lookback samples)
const ramPace = ctx.pfGetProjectSharedPaceMetrics('ram', 10000, 2026, 6);
// samples: 30, 20.5, 10.25 (+ June 100 also in lookback if within 14 and <= endKey 2026-07-15)
// endKey = 2026-07-15; June keys are included. Newest first: 07-03, 07-02, 07-01, 06-30
// avg = (30+20.5+10.25+100)/4 = 160.75/4 = 40.1875 → pdRound = 40.19
// predicted = 40.19 * 31 = 1245.89
c.assert('RAM pace sample includes July+June days', ramPace.paceSampleDays === 4, String(ramPace.paceSampleDays));
c.assert('RAM monthProfitToDate = 60.75', nearly(ramPace.monthProfitToDateUsd, 60.75), String(ramPace.monthProfitToDateUsd));
c.assert('RAM avgDaily exact', nearly(ramPace.avgDailyProfitUsd, 40.19), String(ramPace.avgDailyProfitUsd));
c.assert('RAM predictedMonth = avg*31', nearly(ramPace.predictedMonthProfitUsd, 1245.89), String(ramPace.predictedMonthProfitUsd));
c.assert('RAM predicted yield string', ramPace.predictedMonthYield === '12.5%', String(ramPace.predictedMonthYield));
// 1245.89/10000*100 = 12.4589 → round to 1 decimal via *1000/10 = 12.5%

const orcaPace = ctx.pfGetProjectSharedPaceMetrics('orca', 5000, 2026, 6);
// samples newest: 07-02=20, 07-01=10, 06-29=50 → avg 80/3 = 26.6666... pdRound=26.67
// predicted 26.67*31 = 826.77
c.assert('ORCA pace samples = 3', orcaPace.paceSampleDays === 3, String(orcaPace.paceSampleDays));
c.assert('ORCA monthProfitToDate = 30', nearly(orcaPace.monthProfitToDateUsd, 30), String(orcaPace.monthProfitToDateUsd));
c.assert('ORCA avgDaily exact', nearly(orcaPace.avgDailyProfitUsd, 26.67), String(orcaPace.avgDailyProfitUsd));
c.assert('ORCA predictedMonth exact', nearly(orcaPace.predictedMonthProfitUsd, 826.77), String(orcaPace.predictedMonthProfitUsd));
c.assert('ORCA predicted yield', orcaPace.predictedMonthYield === '16.5%', String(orcaPace.predictedMonthYield));
// 826.77/5000*100 = 16.5354 → 16.5%

const eniPace = ctx.pfGetProjectSharedPaceMetrics('eni', 2000, 2026, 6);
// samples: 12, 8 → avg 10, predicted 310, yield 15.5%
c.assert('ENI pace samples = 2', eniPace.paceSampleDays === 2, String(eniPace.paceSampleDays));
c.assert('ENI monthProfitToDate = 20', nearly(eniPace.monthProfitToDateUsd, 20), String(eniPace.monthProfitToDateUsd));
c.assert('ENI avgDaily = 10', nearly(eniPace.avgDailyProfitUsd, 10), String(eniPace.avgDailyProfitUsd));
c.assert('ENI predictedMonth = 310', nearly(eniPace.predictedMonthProfitUsd, 310), String(eniPace.predictedMonthProfitUsd));
c.assert('ENI predicted yield', eniPace.predictedMonthYield === '15.5%', String(eniPace.predictedMonthYield));

// Past month June: full-month scan, daysInMonth=30
const ramJunePace = ctx.pfGetProjectSharedPaceMetrics('ram', 10000, 2026, 5);
c.assert('June RAM monthProfitToDate = 100', nearly(ramJunePace.monthProfitToDateUsd, 100), String(ramJunePace.monthProfitToDateUsd));
c.assert('June RAM daysInMonth = 30', ramJunePace.daysInMonth === 30);
// samples up to 2026-06-30: only June 30 for RAM (=100). avg=100, predicted=3000
c.assert('June RAM predicted = 3000', nearly(ramJunePace.predictedMonthProfitUsd, 3000), String(ramJunePace.predictedMonthProfitUsd));

// Project rows integration
const rows = ctx.pfGetEnabledProjectRows();
const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
c.assert('Project rows include RAM/ORCA/ENI', !!(byKey.ram && byKey.orca && byKey.eni), JSON.stringify(Object.keys(byKey)));
c.assert('Row RAM operatingUsd', nearly(byKey.ram.operatingUsd, 10000));
c.assert('Row RAM profitUsd (cumulative)', nearly(byKey.ram.profitUsd, 160.75), String(byKey.ram.profitUsd));
c.assert('Row RAM monthProfitUsd (forecast)', nearly(byKey.ram.monthProfitUsd, 1245.89), String(byKey.ram.monthProfitUsd));
c.assert('Row ORCA profitUsd', nearly(byKey.orca.profitUsd, 80), String(byKey.orca.profitUsd));
c.assert('Row ENI profitUsd', nearly(byKey.eni.profitUsd, 20), String(byKey.eni.profitUsd));

// Recovery = cumulative/operating
c.assert(
  'Row RAM recovery %',
  nearly(byKey.ram.recovery, Math.round((160.75 / 10000) * 1000) / 10),
  String(byKey.ram.recovery)
);

// Decimal ORCA storage (4dp internals rounded in day totals via pdOrca)
const orcaDay1 = ctx.pdGetRevenueEntry('2026-07-01');
c.assert('ORCA day1 project total 10', nearly(orcaDay1.orca, 10), String(orcaDay1.orca));

// PF profit detail breakdown must use revenueLog (same as card forecast), not org aggregateTotals
ctx.aggregateTotals = function () {
  return { personal: 0, direct: 0, second: 0, title: 0, total: 0 };
};
ctx.orcaAggregateTotals = function () {
  return { personal: 0, ranking: 0, total: 0, volume: 0 };
};

const ramBd = ctx.pfGetProjectProfitBreakdown('ram', 10000);
c.assert('RAM breakdown predicted matches card forecast', nearly(ramBd.predicted, byKey.ram.monthProfitUsd), String(ramBd.predicted));
c.assert('RAM breakdown has pie segments > 0', (ramBd.chartSegments || []).some((s) => Number(s.amount) > 0));
c.assert('RAM breakdown pie sum ~= predicted', nearly(
  (ramBd.chartSegments || []).reduce((a, s) => a + (Number(s.amount) || 0), 0),
  ramBd.predicted
), String(ramBd.predicted));
c.assert('RAM org+personal ~= predicted', nearly(ramBd.personal + ramBd.org, ramBd.predicted));
c.assert('RAM empty org-agg still has non-zero breakdown', ramBd.personal + ramBd.org > 0);

const orcaBd = ctx.pfGetProjectProfitBreakdown('orca', 5000);
c.assert('ORCA breakdown predicted matches card', nearly(orcaBd.predicted, byKey.orca.monthProfitUsd), String(orcaBd.predicted));
c.assert('ORCA AI+AF ~= predicted', nearly(orcaBd.ai + orcaBd.affiliate, orcaBd.predicted));
c.assert('ORCA AI > 0 from revenueLog', orcaBd.ai > 0, String(orcaBd.ai));
c.assert('ORCA AF > 0 from revenueLog', orcaBd.affiliate > 0, String(orcaBd.affiliate));
c.assert('ORCA empty org-agg still has non-zero AI/AF', orcaBd.ai + orcaBd.affiliate > 0);

// Multi-account ORCA composition
ctx.pdSaveRevenueAccountEntry('2026-07-10', 'orca', 't_orca1', {
  yesterdayAiProfit: 8,
  todayAffiliateProfit: 2
});
ctx.pdSaveRevenueAccountEntry('2026-07-10', 'orca', 't_orca2', {
  yesterdayAiProfit: 1,
  todayAffiliateProfit: 4
});
ctx.settings.orcaInputAccounts.push({ id: 't_orca2', name: 'T-ORCA-2', investment: 0 });
const orcaComp = ctx.pfGetProjectRevenueLogComposition('orca', 2026, 6);
c.assert('ORCA multi-account composition has AI+AF', orcaComp.ai > 0 && orcaComp.affiliate > 0, JSON.stringify(orcaComp));
const orcaBd2 = ctx.pfGetProjectProfitBreakdown('orca', 5000);
c.assert('ORCA multi-account predicted still matches pace', nearly(orcaBd2.predicted, ctx.pfGetProjectSharedPaceMetrics('orca', 5000, 2026, 6).predictedMonthProfitUsd));
c.assert('ORCA multi-account pie not empty', (orcaBd2.chartSegments || []).some((s) => Number(s.amount) > 0));

// Truly empty project: no forecast, no composition
const emptyBd = ctx.pfGetProjectProfitBreakdown('ram', 0);
// still has seeded ram data — clear and check null/empty consistency via composition on cary
const caryBd = ctx.pfGetProjectProfitBreakdown('cary', 1000);
c.assert('Non RAM/ORCA breakdown returns null', caryBd == null);

console.log(`\nPortfolio calc: ${c.passed} passed, ${c.failed} failed`);
exitFromCounter(c);
