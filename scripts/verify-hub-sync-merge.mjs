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
  !fullDeleteMerged.settings.revenueLog['2026-07-01']
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

console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed ? 1 : 0);
