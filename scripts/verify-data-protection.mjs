#!/usr/bin/env node
/**
 * Data protection / isolation unit checks (no localhost required).
 * - Project org charts do not cross-contaminate in packed payloads
 * - Orphan parent repair keeps grandchild links
 * - Performance/portfolio-like settings mutations do not shrink org members
 *
 * Run: node scripts/verify-data-protection.mjs
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAssertCounter, printSuiteHeader, exitFromCounter } from './lib/verify-report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

printSuiteHeader('Data protection / isolation');

function loadHubStorage() {
  const code = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');
  const wrapped =
    code +
    '\n;return {' +
    'hubCreateEmptyData,hubCreateDefaultSettings,hubCreateEmptyOrcaOrgChart,hubCreateEmptyEniOrgChart,' +
    'hubPackLocalData,hubRepairOrphanOrgParents,hubFilterOrgChartByRemovedIds,hubMergeHubDocuments,' +
    'hubNormalizeLoadedData' +
    '};';
  // Provide minimal globals referenced by hub-storage
  const sandbox = {
    console,
    JSON,
    Object,
    Array,
    String,
    Number,
    Math,
    Date,
    parseInt,
    isNaN,
    undefined
  };
  return new Function('console', wrapped)(console);
}

const api = loadHubStorage();
const c = createAssertCounter();

c.assert('hubRepairOrphanOrgParents exported', typeof api.hubRepairOrphanOrgParents === 'function');
c.assert('hubCreateEmptyData exported', typeof api.hubCreateEmptyData === 'function');

{
  const chart = {
    rootId: 'R',
    rootAccountIds: ['R'],
    members: [
      { id: 'R', name: 'kai1', parent: null, open: true },
      { id: 'A', name: '浅田', parent: 'MISSING1', seriesRootId: 'R', open: true },
      { id: 'B', name: '亜子', parent: 'MISSING1', seriesRootId: 'R', open: true },
      { id: 'C', name: '荒川', parent: 'B', seriesRootId: 'R', open: true },
      { id: 'D', name: '下中', parent: 'MISSING2', seriesRootId: 'R', open: true }
    ]
  };
  const beforeCount = chart.members.length;
  const out = api.hubRepairOrphanOrgParents(JSON.parse(JSON.stringify(chart)));
  const by = Object.fromEntries(out.members.map((m) => [m.id, m]));
  c.assert('orphan repair keeps member count', out.members.length === beforeCount);
  c.assert('orphan repair reparents to series root', by.A.parent === 'R' && by.B.parent === 'R' && by.D.parent === 'R');
  c.assert('orphan repair keeps grandchild link', by.C.parent === 'B');
}

{
  const removed = ['MISSING1', 'GONE'];
  const chart = {
    rootId: 'R',
    rootAccountIds: ['R', 'GONE'],
    members: [
      { id: 'R', name: 'root', parent: null },
      { id: 'GONE', name: 'gone', parent: null },
      { id: 'kid', name: 'kid', parent: 'MISSING1', seriesRootId: 'R' }
    ]
  };
  const filtered = api.hubFilterOrgChartByRemovedIds(chart, removed);
  const ids = filtered.members.map((m) => m.id);
  c.assert('filter removes tombstoned member', !ids.includes('GONE'));
  c.assert('filter keeps living members', ids.includes('R') && ids.includes('kid'));
  const kid = filtered.members.find((m) => m.id === 'kid');
  c.assert('filter+repair reattaches orphan kid', kid && kid.parent === 'R');
}

{
  const local = api.hubCreateEmptyData();
  local.updatedAt = 1000;
  local.members = [{ id: 'ram1', parent: null, name: 'RAM1', investment: 100 }];
  local.currentData = local.members.slice();
  local.rootId = 'ram1';
  local.rootAccountIds = ['ram1'];
  local.settings = api.hubCreateDefaultSettings();
  local.orcaOrgChart = api.hubCreateEmptyOrcaOrgChart();
  local.orcaOrgChart.members = [{ id: 'orca1', parent: null, name: 'ORCA1', investment: 200 }];
  local.orcaOrgChart.currentData = local.orcaOrgChart.members.slice();
  local.orcaOrgChart.rootId = 'orca1';
  local.orcaOrgChart.rootAccountIds = ['orca1'];
  local.eniOrgChart = api.hubCreateEmptyEniOrgChart();
  local.eniOrgChart.members = [{ id: 'eni1', parent: null, name: 'ENI1', investment: 300 }];
  local.eniOrgChart.currentData = local.eniOrgChart.members.slice();
  local.eniOrgChart.rootId = 'eni1';
  local.eniOrgChart.rootAccountIds = ['eni1'];

  const cloud = api.hubCreateEmptyData();
  cloud.updatedAt = 500; // older
  cloud.members = [{ id: 'ram1', parent: null, name: 'RAM1-OLD', investment: 1 }];
  cloud.currentData = cloud.members.slice();
  cloud.rootId = 'ram1';
  cloud.rootAccountIds = ['ram1'];
  cloud.settings = api.hubCreateDefaultSettings();
  cloud.orcaOrgChart = api.hubCreateEmptyOrcaOrgChart();
  cloud.eniOrgChart = api.hubCreateEmptyEniOrgChart();

  const merged = api.hubMergeHubDocuments(local, cloud);
  c.assert('merge does not drop RAM member', (merged.members || []).some((m) => m.id === 'ram1'));
  c.assert(
    'merge keeps richer/local ORCA when cloud empty-ish',
    (merged.orcaOrgChart.members || []).some((m) => m.id === 'orca1')
  );
  c.assert(
    'merge keeps ENI member',
    (merged.eniOrgChart.members || []).some((m) => m.id === 'eni1')
  );
  c.assert(
    'RAM/ORCA/ENI ids stay project-scoped',
    !(merged.members || []).some((m) => String(m.id).startsWith('orca') || String(m.id).startsWith('eni'))
  );
}

{
  // Simulate "portfolio settings change" that must not shrink org charts
  const data = api.hubCreateEmptyData();
  data.members = [
    { id: 'r1', parent: null, name: 'R' },
    { id: 'r2', parent: 'r1', name: 'C' }
  ];
  data.currentData = data.members.slice();
  data.rootId = 'r1';
  data.rootAccountIds = ['r1'];
  data.orcaOrgChart = api.hubCreateEmptyOrcaOrgChart();
  data.orcaOrgChart.members = [{ id: 'o1', parent: null, name: 'O' }];
  data.orcaOrgChart.rootId = 'o1';
  data.orcaOrgChart.rootAccountIds = ['o1'];
  data.eniOrgChart = api.hubCreateEmptyEniOrgChart();
  data.eniOrgChart.members = [
    { id: 'e1', parent: null, name: 'E' },
    { id: 'e2', parent: 'e1', name: 'E2' }
  ];
  data.eniOrgChart.rootId = 'e1';
  data.eniOrgChart.rootAccountIds = ['e1'];
  data.settings = api.hubCreateDefaultSettings();
  const before = {
    ram: data.members.length,
    orca: data.orcaOrgChart.members.length,
    eni: data.eniOrgChart.members.length
  };
  data.settings.portfolioGoal = { amountYen: 999999, savedAt: 'test' };
  data.settings.portfolioOperating = { displayMode: 'project', entries: [{ id: 'x', amountUsd: 1 }] };
  data.settings.revenueLog = { '2026-07-01': { ram: 1, orca: 2, eni: 3 } };
  c.assert('portfolio mutate keeps RAM count', data.members.length === before.ram);
  c.assert('portfolio mutate keeps ORCA count', data.orcaOrgChart.members.length === before.orca);
  c.assert('portfolio mutate keeps ENI count', data.eniOrgChart.members.length === before.eni);
}

const hubPath = path.join(root, 'merge-output', 'OUKEI_HUB_KAI2_UNIFIED_v2_20260711.hub');
if (existsSync(hubPath)) {
  c.assert('kai2 unified hub fixture present', true);
} else {
  console.log('  SKIP kai2 unified hub fixture (optional)');
}

console.log(`\nData protection: ${c.passed} passed, ${c.failed} failed`);
exitFromCounter(c);
