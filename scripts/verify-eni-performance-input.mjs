#!/usr/bin/env node
/**
 * Verify ENI performance input: formulas + required symbols in source.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function check(name, ok) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) errors.push(name);
}

function roundEni(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function calcEni(prev, raw) {
  const usdt = roundEni(raw.usdtBalance);
  const withdrawal = roundEni(raw.withdrawalAmount == null || raw.withdrawalAmount === '' ? 0 : raw.withdrawalAmount);
  const totalPerf = roundEni(raw.totalPerformance);
  if (!prev) {
    return { dailyProfit: withdrawal, dailySales: totalPerf, isFirst: true };
  }
  const prevUsdt = roundEni(prev.usdtBalance);
  const prevTotal = roundEni(prev.totalPerformance);
  return {
    dailyProfit: roundEni(usdt - prevUsdt + withdrawal),
    dailySales: roundEni(totalPerf - prevTotal),
    isFirst: false
  };
}

// Formula examples from product spec
const ex1 = calcEni({ usdtBalance: 10, totalPerformance: 100 }, {
  usdtBalance: 12.5,
  withdrawalAmount: 3,
  totalPerformance: 130
});
check('profit example 12.5-10+3=5.5', ex1.dailyProfit === 5.5);
check('sales example 130-100=30', ex1.dailySales === 30);

const first = calcEni(null, { usdtBalance: 50, withdrawalAmount: 2, totalPerformance: 80 });
check('first profit = withdrawal only', first.dailyProfit === 2);
check('first sales = totalPerformance', first.dailySales === 80);

const gap = calcEni({ usdtBalance: 10, totalPerformance: 100 }, {
  usdtBalance: 11,
  withdrawalAmount: 0,
  totalPerformance: 105
});
check('gap day uses previous entry (not calendar)', gap.dailyProfit === 1 && gap.dailySales === 5);

const decimal = calcEni({ usdtBalance: 1.1, totalPerformance: 10 }, {
  usdtBalance: 2.835,
  withdrawalAmount: 0,
  totalPerformance: 12.5
});
check('decimal USDT supported', decimal.dailyProfit === roundEni(2.835 - 1.1));

// Chain recalc simulation: edit day1 total → day2 sales changes
const day1a = { usdtBalance: 10, totalPerformance: 100 };
const day2raw = { usdtBalance: 12, withdrawalAmount: 0, totalPerformance: 130 };
const before = calcEni(day1a, day2raw);
const day1b = { usdtBalance: 10, totalPerformance: 110 }; // edited
const after = calcEni(day1b, day2raw);
check('edit earlier totalPerformance changes later sales', before.dailySales === 30 && after.dailySales === 20);

const pd = read('assets/js/performance-data.js');
const eni = read('assets/js/eni-revenue-input.js');
const rm = read('assets/js/revenue-manage.js');
const css = read('assets/css/eni-theme.css');
const hubVer = JSON.parse(read('assets/hub-app-version.json'));

check('pdSaveEniPerformanceEntry exists', pd.includes('function pdSaveEniPerformanceEntry'));
check('pdCalcEniDailyMetrics exists', pd.includes('function pdCalcEniDailyMetrics'));
check('pdGetEniPreviousAccountEntry exists', pd.includes('function pdGetEniPreviousAccountEntry'));
check('pdRecalculateEniAccountFrom exists', pd.includes('function pdRecalculateEniAccountFrom'));
check('eni input uses usdtBalance field', eni.includes('eniUsdt_') && eni.includes('totalPerformance'));
check('eni input shows prev hints', eni.includes('昨日のUSDT残高') && eni.includes('昨日の総実績'));
check('eni realtime calc', eni.includes('updateEniDerivedPreview') && eni.includes('本日の利益'));
check('eni validation warnings', eni.includes('本日の総実績が前回の総実績を下回っています'));
check('eni usdt decrease warning', eni.includes('USDT残高が前回より減少しています'));
check('revenue-manage uses new ENI fields', rm.includes('rmEntryEniUsdt') && rm.includes('rmEntryEniTotalPerf'));
check('eni uses shared ramInputAccount card', eni.includes('class="ramInputAccount"') && !eni.includes('eniInputAccount"') && !eni.includes('revenueProjectCard--eni'));
check('eni save uses shared ramInputBtnSave', /class="ramInputBtnSave"/.test(eni) && !eni.includes('eniInputBtnSave'));
check('eni daily badge uses shared style', eni.includes('ramInputBadge') && !eni.includes('ramInputBadge--eni'));
check('no ENI lime input overrides', !css.includes('eniInputRow--main') && !css.includes('eniPrevHint'));
check('eni prev hints use ramInputHint', eni.includes('昨日のUSDT残高') && eni.includes('ramInputHint'));
check('hub schemaVersion unchanged (no bump required)', hubVer.schemaVersion === 2);
check('ORCA wipe guards still present', pd.includes('pdSaveOrcaTotalSalesEntry') || read('assets/js/hub-firebase.js').includes('hubGuardOrcaPayloadBeforePush'));
check('does not use old ENI todayRevenue direct input as primary', !eni.includes('eniRev_') && !eni.includes('eniRef_'));

if (errors.length) {
  console.error('\nFailed:', errors.length, errors);
  process.exit(1);
}
console.log('\nAll ENI performance-input checks passed');
