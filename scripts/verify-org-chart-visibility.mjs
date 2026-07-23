#!/usr/bin/env node
/**
 * Regression: org chart open-flag sync must not mass-collapse trees.
 * Covers RAM / ORCA / ENI visibility counting + snapshot/restore semantics.
 *
 * Run: node scripts/verify-org-chart-visibility.mjs
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadOrgViewState() {
  const code = readFileSync(path.join(root, 'assets/js/hub-org-view-state.js'), 'utf8');
  const wrapped =
    code +
    '\n;return {' +
    'hubOrgSnapshotOpenFlags,' +
    'hubOrgRestoreOpenFlags,' +
    'hubOrgRepairMassCollapsedOpens,' +
    'hubOrgOpenMapIsMassCollapsed,' +
    'hubOrgCountVisibleFromRoot,' +
    'hubOrgIsOpenFlag,' +
    'hubCaptureOrgChartViewState,' +
    'hubRestoreOrgChartViewState' +
    '};';
  return new Function(wrapped)();
}

const api = loadOrgViewState();
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

function makeTree(n) {
  const members = [];
  for (let i = 1; i <= n; i++) {
    members.push({
      id: 'n' + i,
      parent: i === 1 ? null : 'n' + Math.floor(i / 2),
      name: 'N' + i
      // open intentionally omitted
    });
  }
  return members;
}

function parentEdgeCount(list) {
  return list.filter((m) => m && m.parent).length;
}

// 1) Missing open must snapshot as true (not !!undefined → false)
{
  const members = makeTree(7);
  const map = api.hubOrgSnapshotOpenFlags(members);
  const allTrue = Object.keys(map).every((k) => map[k] === true);
  assert('snapshot: missing open ⇒ true', allTrue, JSON.stringify(map));
}

// 2) Explicit false stays false
{
  const members = makeTree(3);
  members[0].open = true;
  members[1].open = false;
  members[2].open = true;
  const map = api.hubOrgSnapshotOpenFlags(members);
  assert('snapshot: explicit false kept', map.n2 === false && map.n1 === true && map.n3 === true);
}

// 3) Capture(missing open) → normalize true → restore must NOT collapse
{
  const members = makeTree(12);
  const map = api.hubOrgSnapshotOpenFlags(members);
  members.forEach((m) => {
    m.open = true;
  }); // simulate normalize after apply
  api.hubOrgRestoreOpenFlags(members, map, 'test');
  const vis = api.hubOrgCountVisibleFromRoot(members, 'n1');
  assert(
    'restore after missing-open snapshot keeps all visible',
    vis.visible === 12 && vis.members === 12,
    JSON.stringify(vis)
  );
}

// 4) Mass-collapsed openMap is skipped
{
  const members = makeTree(8);
  members.forEach((m) => {
    m.open = true;
  });
  const badMap = {};
  members.forEach((m) => {
    badMap[m.id] = false;
  });
  assert('detect mass-collapsed map', api.hubOrgOpenMapIsMassCollapsed(badMap, members));
  api.hubOrgRestoreOpenFlags(members, badMap, 'test-skip');
  const stillOpen = members.every((m) => m.open === true);
  assert('skip restoring mass-collapsed map', stillOpen);
}

// 5) Persisted all-false data is repaired (open flags only)
{
  const members = makeTree(10);
  members.forEach((m) => {
    m.open = false;
  });
  const beforeParents = members.map((m) => m.parent);
  const repaired = api.hubOrgRepairMassCollapsedOpens(members, 'test-repair');
  const afterParents = members.map((m) => m.parent);
  assert('repair runs on all-false', repaired === true);
  assert(
    'repair expands all opens',
    members.every((m) => m.open === true)
  );
  assert(
    'repair does not change parents',
    JSON.stringify(beforeParents) === JSON.stringify(afterParents)
  );
  const vis = api.hubOrgCountVisibleFromRoot(members, 'n1');
  assert('after repair visible === members', vis.visible === 10, JSON.stringify(vis));
}

// 6) Intentional single closed branch is preserved
{
  const members = makeTree(7);
  members.forEach((m) => {
    m.open = true;
  });
  members.find((m) => m.id === 'n2').open = false;
  const map = api.hubOrgSnapshotOpenFlags(members);
  assert('not mass-collapsed when one branch closed', !api.hubOrgOpenMapIsMassCollapsed(map, members));
  const clone = members.map((m) => ({ ...m, open: true }));
  api.hubOrgRestoreOpenFlags(clone, map, 'branch');
  assert('branch closed flag restored', clone.find((m) => m.id === 'n2').open === false);
  const vis = api.hubOrgCountVisibleFromRoot(clone, 'n1');
  // n1 + kids of open nodes: n1 open → n2,n3; n2 closed hides n4,n5; n3 open → n6,n7 → visible 1+2+2=5? 
  // tree: 1→2,3; 2→4,5; 3→6,7. With n2 closed: n1,n2,n3,n6,n7 = 5
  assert('partial collapse visible count', vis.visible === 5, JSON.stringify(vis));
}

// 7) Edge count matches parent links
{
  const members = makeTree(15);
  const vis = api.hubOrgCountVisibleFromRoot(members, 'n1');
  assert('edge count = parent links', vis.edges === parentEdgeCount(members));
  // missing open treated as open in count helper
  assert('missing open counts as visible tree', vis.visible === 15, JSON.stringify(vis));
}

// 8) Portfolio-related: open helpers do not mutate unrelated fields
{
  const members = [
    { id: 'a', parent: null, name: 'A', investment: 100, open: undefined },
    { id: 'b', parent: 'a', name: 'B', investment: 50 }
  ];
  const map = api.hubOrgSnapshotOpenFlags(members);
  api.hubOrgRestoreOpenFlags(members, map, 'pf-isolation');
  assert('investment untouched', members[0].investment === 100 && members[1].investment === 50);
  assert('ids/parents untouched', members[0].id === 'a' && members[1].parent === 'a');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
