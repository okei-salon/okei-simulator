#!/usr/bin/env node
/**
 * Verify hub merge keeps richer org chart and merges portfolio entries.
 */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function loadScript(relPath) {
  const code = readFileSync(path.join(root, relPath), 'utf8');
  const wrapped = code + '\n;return { hubMergeHubDocuments, hubMergeRamOrgCharts, hubPackRamOrgFromData, hubCreateEmptyData, hubNormalizeLoadedData, hubCreateDefaultSettings, hubCreateEmptyOrcaOrgChart, hubCreateEmptyEniOrgChart };';
  const fn = new Function(wrapped);
  return fn();
}

const api = loadScript('assets/js/hub-storage.js');
const {
  hubMergeHubDocuments,
  hubMergeRamOrgCharts,
  hubPackRamOrgFromData,
  hubCreateEmptyData,
  hubCreateDefaultSettings,
  hubCreateEmptyOrcaOrgChart,
  hubCreateEmptyEniOrgChart
} = api;

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

const local = hubCreateEmptyData();
local.updatedAt = 1000;
local.members = [{ id: 'a', parent: null, name: 'A', investment: 100 }];
local.currentData = local.members.slice();
local.rootId = 'a';
local.rootAccountIds = ['a'];
local.settings = hubCreateDefaultSettings();
local.settings.portfolioGoal = { amountYen: 100, savedAt: 'local', rates: { ram: 100 } };
local.settings.portfolioOperating = {
  displayMode: 'project',
  entries: [{ id: 'op1', amountUsd: 1000, updatedAt: 'local-op' }]
};

const cloud = hubCreateEmptyData();
cloud.updatedAt = 2000;
cloud.members = [{ id: 'a', parent: null, name: 'A', investment: 100 }];
cloud.currentData = cloud.members.slice();
cloud.members.push({ id: 'b', parent: 'a', name: 'B', investment: 50 });
cloud.currentData = cloud.members.slice();
cloud.rootId = 'a';
cloud.rootAccountIds = ['a'];
cloud.settings = hubCreateDefaultSettings();
cloud.settings.portfolioGoal = { amountYen: 200, savedAt: 'cloud', rates: { orca: 100 } };
cloud.settings.portfolioOperating = {
  displayMode: 'account',
  entries: [{ id: 'op2', amountUsd: 2000, updatedAt: 'cloud-op' }]
};

const merged = hubMergeHubDocuments(local, cloud);
assert('RAM org keeps child from newer cloud', merged.members.some((m) => m.id === 'b'));
assert('Portfolio keeps both operating entries', merged.settings.portfolioOperating.entries.length === 2);
assert('Portfolio goal prefers newer cloud doc', merged.settings.portfolioGoal.amountYen === 200);
assert('Portfolio rates merged', merged.settings.portfolioGoal.rates.ram === 100 && merged.settings.portfolioGoal.rates.orca === 100);

const ramOnlyCloud = hubPackRamOrgFromData({
  members: [{ id: 'x', parent: null, name: 'X' }, { id: 'y', parent: 'x', name: 'Y' }],
  currentData: [],
  scenarios: [],
  rootId: 'x',
  rootAccountIds: ['x']
});
const ramOnlyLocal = hubPackRamOrgFromData({
  members: [{ id: 'x', parent: null, name: 'X' }],
  currentData: [],
  scenarios: [],
  rootId: 'x',
  rootAccountIds: ['x']
});
const ramMerged = hubMergeRamOrgCharts(ramOnlyCloud, ramOnlyLocal);
assert('RAM merge picks richer chart', ramMerged.members.length === 2);

const deletedLocal = hubCreateEmptyData();
deletedLocal.updatedAt = 3000;
deletedLocal.settings = hubCreateDefaultSettings();
deletedLocal.settings.removedOrcaOrgAccountIds = ['kai1', 'kai2'];
// Explicit delete timestamps must be newer than cloud.updatedAt to block cloud resurrection
deletedLocal.settings.removedOrcaOrgAccountIdTimes = { kai1: 4000, kai2: 4000 };
deletedLocal.orcaOrgChart = {
  members: [{ id: 'kai3', parent: null, name: 'kai3' }],
  currentData: [{ id: 'kai3', parent: null, name: 'kai3' }],
  scenarios: [],
  rootId: 'kai3',
  rootAccountIds: ['kai3'],
  zoom: 1
};
const cloudWithDeleted = hubCreateEmptyData();
cloudWithDeleted.updatedAt = 1000;
cloudWithDeleted.settings = hubCreateDefaultSettings();
cloudWithDeleted.settings.orcaInputAccounts = [
  { id: 'kai1', username: 'kai1', name: 'kai1' },
  { id: 'kai2', username: 'kai2', name: 'kai2' }
];
cloudWithDeleted.orcaOrgChart = {
  members: [
    { id: 'kai1', parent: null, name: 'kai1' },
    { id: 'kai2', parent: null, name: 'kai2' },
    { id: 'kai3', parent: null, name: 'kai3' }
  ],
  currentData: [],
  scenarios: [],
  rootId: 'kai1',
  rootAccountIds: ['kai1', 'kai2', 'kai3'],
  zoom: 1
};
cloudWithDeleted.orcaOrgChart.currentData = cloudWithDeleted.orcaOrgChart.members.slice();
const deletedMerged = hubMergeHubDocuments(deletedLocal, cloudWithDeleted);
assert('ORCA deletion tombstones block restore', !deletedMerged.orcaOrgChart.members.some((m) => m.id === 'kai1' || m.id === 'kai2'));
assert('ORCA deletion keeps remaining account', deletedMerged.orcaOrgChart.members.some((m) => m.id === 'kai3'));
assert(
  'ORCA input accounts respect tombstones',
  !deletedMerged.settings.orcaInputAccounts.some((a) => a.id === 'kai1' || a.id === 'kai2')
);

const fullDeleteLocal = hubCreateEmptyData();
fullDeleteLocal.updatedAt = 5000;
fullDeleteLocal.settings = hubCreateDefaultSettings();
fullDeleteLocal.settings.removedOrcaOrgAccountIds = ['test'];
fullDeleteLocal.settings.removedOrcaOrgAccountIdTimes = { test: 6000 };
fullDeleteLocal.settings.orcaInputAccounts = [];
fullDeleteLocal.settings.revenueLog = {};
fullDeleteLocal.settings.portfolioOperating = {
  displayMode: 'project',
  entries: [{ id: 'keep-project', inputMode: 'project', projectKey: 'orca', amountUsd: 5000 }]
};
const fullDeleteCloud = hubCreateEmptyData();
fullDeleteCloud.updatedAt = 1000;
fullDeleteCloud.settings = hubCreateDefaultSettings();
fullDeleteCloud.settings.orcaInputAccounts = [
  { id: 'test', username: 'test', name: 'test', investment: 10000 }
];
fullDeleteCloud.settings.revenueLog = {
  '2026-07-01': {
    orcaAccounts: { test: { revenueUsd: 100 } },
    accounts: { test: { projectKey: 'orca', revenueUsd: 100 } }
  }
};
fullDeleteCloud.settings.investmentHistory = {
  test: { projectKey: 'orca', records: [{ dateKey: '2026-07-01', amount: 10000, type: 'initial' }] }
};
fullDeleteCloud.settings.portfolioOperating = {
  displayMode: 'account',
  entries: [
    { id: 'op-test', inputMode: 'account', projectKey: 'orca', accountId: 'test', amountUsd: 10000 },
    { id: 'keep-project', inputMode: 'project', projectKey: 'orca', amountUsd: 5000 }
  ]
};
const fullDeleteMerged = hubMergeHubDocuments(fullDeleteLocal, fullDeleteCloud);
assert(
  'Full delete keeps tombstone and drops input account',
  fullDeleteMerged.settings.removedOrcaOrgAccountIds.indexOf('test') >= 0 &&
    !fullDeleteMerged.settings.orcaInputAccounts.some((a) => a.id === 'test')
);
assert(
  'Full delete strips revenue for removed account',
  !fullDeleteMerged.settings.revenueLog['2026-07-01'] ||
    !(fullDeleteMerged.settings.revenueLog['2026-07-01'].orcaAccounts || {}).test
);
assert(
  'Full delete strips investment history',
  !fullDeleteMerged.settings.investmentHistory || !fullDeleteMerged.settings.investmentHistory.test
);
assert(
  'Full delete strips account portfolio entries only',
  fullDeleteMerged.settings.portfolioOperating.entries.length === 1 &&
    fullDeleteMerged.settings.portfolioOperating.entries[0].id === 'keep-project'
);

// --- kai2-style: preferLocal must NOT drop cloud-only RAM account maps ---
const kai2Id = 'imp_mr604mrj_0';
const preferLocalStale = hubCreateEmptyData();
preferLocalStale.updatedAt = 9000;
preferLocalStale.settings = hubCreateDefaultSettings();
preferLocalStale.settings.revenueLog = {
  '2026-03-01': {
    ramAccounts: { m1: { todayRevenue: 10, addInvestment: 0 } },
    ram: 10,
    total: 10
  }
};
preferLocalStale.settings.salesLog = {
  '2026-03-01': {
    accounts: { m1: { projectKey: 'ram', todaySales: 5 } }
  }
};
const preferCloudRich = hubCreateEmptyData();
preferCloudRich.updatedAt = 1000;
preferCloudRich.settings = hubCreateDefaultSettings();
preferCloudRich.settings.revenueLog = {
  '2026-03-01': {
    ramAccounts: {
      m1: { todayRevenue: 10, addInvestment: 0 },
      [kai2Id]: { todayRevenue: 20, addInvestment: 0 }
    },
    ram: 30,
    total: 30
  }
};
preferCloudRich.settings.salesLog = {
  '2026-03-01': {
    accounts: {
      m1: { projectKey: 'ram', todaySales: 5 },
      [kai2Id]: { projectKey: 'ram', todaySales: 8 }
    }
  }
};
const preferMerged = hubMergeHubDocuments(preferLocalStale, preferCloudRich);
const preferRev = preferMerged.settings.revenueLog['2026-03-01'] || {};
const preferSales = preferMerged.settings.salesLog['2026-03-01'] || {};
assert(
  'preferLocal keeps cloud-only kai2 in ramAccounts',
  !!(preferRev.ramAccounts && preferRev.ramAccounts[kai2Id])
);
assert(
  'preferLocal keeps m1 alongside kai2',
  !!(preferRev.ramAccounts && preferRev.ramAccounts.m1)
);
assert(
  'preferLocal keeps cloud-only kai2 in sales accounts',
  !!(preferSales.accounts && preferSales.accounts[kai2Id])
);

// Explicit RAM tombstone may drop kai2
const tombLocal = hubCreateEmptyData();
tombLocal.updatedAt = 9000;
tombLocal.settings = hubCreateDefaultSettings();
tombLocal.settings.removedRamOrgAccountIds = [kai2Id];
tombLocal.settings.revenueLog = {
  '2026-03-01': { ramAccounts: { m1: { todayRevenue: 10 } }, ram: 10 }
};
const tombMerged = hubMergeHubDocuments(tombLocal, preferCloudRich);
assert(
  'RAM tombstone allows dropping kai2 from revenue merge',
  !(tombMerged.settings.revenueLog['2026-03-01'].ramAccounts || {})[kai2Id]
);
assert(
  'RAM tombstone keeps m1',
  !!(tombMerged.settings.revenueLog['2026-03-01'].ramAccounts || {}).m1
);

console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed ? 1 : 0);
