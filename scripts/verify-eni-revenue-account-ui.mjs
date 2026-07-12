#!/usr/bin/env node
/**
 * Verify ENI revenue-manage rows use the same expandable account-head UI as RAM/ORCA.
 */
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const code = readFileSync(path.join(root, 'assets/js/revenue-manage.js'), 'utf8');

let passed = 0;
let failed = 0;
function assert(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

assert(
  'rmSupportsAccountDetail includes eni',
  /function rmSupportsAccountDetail\(projectKey\) \{[\s\S]*?projectKey === 'eni'/.test(code)
);
assert(
  'RM_ACCOUNT_DETAIL_DEFS has eni lines',
  /eni:\s*\[[\s\S]*?operationAmount[\s\S]*?todayRevenue[\s\S]*?referralProfit[\s\S]*?titleProfit[\s\S]*?total/.test(code)
);
assert(
  'rmGetAccountDirectAmount handles eni',
  /if \(projectKey === 'eni'\) \{/.test(code)
);
assert(
  'rmGetAccountBreakdown handles eni',
  /if \(projectKey === 'eni' && entry && entry\.eniAccounts/.test(code)
);
assert(
  'ENI entry modal is wired',
  /rmOpenEniRevenueEntryModal/.test(code) && /rmSaveEniRevenueEntry/.test(code)
);
assert(
  'accountHead path uses shared menu button',
  /pfRenderAccountMenuBtn\(row\.projectKey, row\.key, row\.name\)/.test(code)
);

const wrapped =
  code +
  '\n;rmFilter = "eni";' +
  '\nrmGetProjectAccountRows = function () {' +
  '  return [{ id: "eni1", name: "eni-test", depth: 0, parentId: null, seriesIndex: 1 }];' +
  '};' +
  '\nrmIsAccountExpanded = function () { return false; };' +
  '\n;return { rmSupportsAccountDetail, rmBuildTableDisplayRows, RM_ACCOUNT_DETAIL_DEFS };';

const api = new Function(wrapped)();

assert('supports eni detail at runtime', api.rmSupportsAccountDetail('eni') === true);
assert('supports ram/orca unchanged', api.rmSupportsAccountDetail('ram') && api.rmSupportsAccountDetail('orca'));

const displayRows = api.rmBuildTableDisplayRows();
assert(
  'ENI account uses accountHead row type',
  displayRows.some((dr) => dr.type === 'accountHead' && dr.row.key === 'eni1'),
  JSON.stringify(displayRows.map((dr) => dr.type + ':' + (dr.row && dr.row.key)))
);
assert(
  'ENI account is not flat-only',
  !displayRows.some((dr) => dr.type === 'accountFlat' && dr.row.key === 'eni1')
);

console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed ? 1 : 0);
