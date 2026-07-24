#!/usr/bin/env node
/**
 * Verify ORCA account full-delete purges registry + performance + portfolio,
 * and keeps tombstones so cloud merge cannot resurrect the account.
 */
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function loadHubStorage() {
  const code = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');
  const wrapped = code + '\n;return {' +
    'hubMergeHubDocuments, hubCreateEmptyData, hubCreateDefaultSettings, ' +
    'hubStripRemovedAccountsFromSettings, hubMergeOrcaInputAccounts, hubRecordRemovedOrcaOrgAccountIds' +
    '};';
  return new Function(wrapped)();
}

function loadAimWithPd(settingsRef, hubApi) {
  const pdCode = readFileSync(path.join(root, 'assets/js/performance-data.js'), 'utf8');
  const aimCode = readFileSync(path.join(root, 'assets/js/account-input-manage.js'), 'utf8');
  const wrapped =
    'var settings = arguments[0];\n' +
    'var hubRecordRemovedOrcaOrgAccountIds = arguments[1];\n' +
    'var members = [];\n' +
    'var orcaMembers = [];\n' +
    'var orcaRootAccountIds = [];\n' +
    'var orcaRootId = "";\n' +
    'var orcaFocusId = "";\n' +
    'var autoBackups = [];\n' +
    'function downloadBackup() {}\n' +
    'function orcaSubtreeIds(id) { return [id]; }\n' +
    'function markActivity() {}\n' +
    'function markSettingsDirty() {}\n' +
    'function persistHubSettings() {}\n' +
    'function todayKey() { return "2026-07-12"; }\n' +
    'function allOrgSummary() { return {}; }\n' +
    'function updateHomeDashboard() {}\n' +
    'function pdPersist() {}\n' +
    pdCode + '\n' +
    aimCode + '\n' +
    ';return { aimDeleteInputAccountFully, pdDeleteAccountPerformanceData };';
  return new Function(wrapped)(settingsRef, hubApi.hubRecordRemovedOrcaOrgAccountIds);
}

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

const settings = {
  orcaInputAccounts: [{ id: 'test', username: 'test', name: 'test', investment: 10000 }],
  removedOrcaOrgAccountIds: [],
  removedOrcaOrgAccountIdTimes: {},
  revenueLog: {
    '2026-07-01': {
      orcaAccounts: { test: { revenueUsd: 120 } },
      accounts: { test: { projectKey: 'orca', revenueUsd: 120 } },
      totalRevenueUsd: 120
    }
  },
  salesLog: {},
  investmentHistory: {
    test: { projectKey: 'orca', records: [{ dateKey: '2026-07-01', amount: 10000, type: 'initial' }] }
  },
  portfolioOperating: {
    displayMode: 'project',
    entries: [
      { id: 'op1', inputMode: 'account', projectKey: 'orca', accountId: 'test', amountUsd: 10000 },
      { id: 'op2', inputMode: 'project', projectKey: 'orca', amountUsd: 5000 }
    ]
  },
  portfolioProfit: { entries: [] },
  manageDisplayAccounts: {
    orca: { orgAdded: ['test'], removed: [], labels: { test: 'test' } }
  },
  performanceInputHiddenAccounts: { orca: ['test'] },
  performanceMeta: { schemaVersion: 1, salesImportDedupeFixVersion: 2, ramOperatingRepairVersion: 1 }
};

const hub = loadHubStorage();
const api = loadAimWithPd(settings, hub);
api.aimDeleteInputAccountFully('orca', 'test');

assert('Removes orcaInputAccounts entry', !settings.orcaInputAccounts.some((a) => a.id === 'test'));
assert('Keeps deletion tombstone', settings.removedOrcaOrgAccountIds.indexOf('test') >= 0);
assert('Records tombstone timestamp', Number(settings.removedOrcaOrgAccountIdTimes.test) > 0);
assert('Clears revenueLog for account', !settings.revenueLog['2026-07-01']);
assert('Clears investmentHistory', !settings.investmentHistory.test);
assert(
  'Clears account portfolio operating entry',
  settings.portfolioOperating.entries.length === 1 &&
    settings.portfolioOperating.entries[0].id === 'op2'
);
assert('Clears manage display refs', settings.manageDisplayAccounts.orca.orgAdded.length === 0);
assert('Clears performance hidden refs', settings.performanceInputHiddenAccounts.orca.length === 0);

const local = hub.hubCreateEmptyData();
local.updatedAt = 9000;
local.settings = Object.assign(hub.hubCreateDefaultSettings(), {
  removedOrcaOrgAccountIds: settings.removedOrcaOrgAccountIds.slice(),
  removedOrcaOrgAccountIdTimes: Object.assign({}, settings.removedOrcaOrgAccountIdTimes),
  orcaInputAccounts: settings.orcaInputAccounts.slice(),
  revenueLog: {},
  investmentHistory: {},
  portfolioOperating: JSON.parse(JSON.stringify(settings.portfolioOperating))
});
const cloud = hub.hubCreateEmptyData();
cloud.updatedAt = 1000;
cloud.settings = Object.assign(hub.hubCreateDefaultSettings(), {
  orcaInputAccounts: [{ id: 'test', username: 'test', name: 'test', investment: 10000 }],
  revenueLog: {
    '2026-07-01': { orcaAccounts: { test: { revenueUsd: 120 } } }
  },
  investmentHistory: {
    test: { projectKey: 'orca', records: [{ dateKey: '2026-07-01', amount: 10000, type: 'initial' }] }
  },
  portfolioOperating: {
    displayMode: 'project',
    entries: [{ id: 'op1', inputMode: 'account', projectKey: 'orca', accountId: 'test', amountUsd: 10000 }]
  }
});
const merged = hub.hubMergeHubDocuments(local, cloud);
assert('Merge does not resurrect input account', !merged.settings.orcaInputAccounts.some((a) => a.id === 'test'));
assert(
  'Merge does not resurrect revenue',
  !merged.settings.revenueLog['2026-07-01'] ||
    !(merged.settings.revenueLog['2026-07-01'].orcaAccounts || {}).test
);
assert(
  'Merge does not resurrect account portfolio entry',
  !merged.settings.portfolioOperating.entries.some((e) => e.accountId === 'test')
);

console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed ? 1 : 0);
