#!/usr/bin/env node
/**
 * Org delete mode integrity (subtree / promote / no orphans).
 * Pure Node — mirrors account-input-manage promote/subtree contracts.
 *
 * Run: node scripts/verify-delete-modes.mjs
 */
import { createAssertCounter, printSuiteHeader, exitFromCounter } from './lib/verify-report.mjs';

printSuiteHeader('Organization delete modes');

function collectSubtree(members, accountId) {
  const subtree = [accountId];
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of members) {
      if (m.parent && subtree.includes(m.parent) && !subtree.includes(m.id)) {
        subtree.push(m.id);
        changed = true;
      }
    }
  }
  return subtree;
}

function countOrphans(members) {
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  return members.filter((m) => m.parent && !byId[m.parent]);
}

function promoteThenRemove(members, rootIds, accountId) {
  const target = members.find((m) => m.id === accountId);
  if (!target) throw new Error('missing target');
  const newParent = target.parent || null;
  const children = members.filter((m) => m.parent === accountId);
  for (const c of children) c.parent = newParent;
  if (!newParent) {
    for (const c of children) {
      if (!rootIds.includes(c.id)) rootIds.push(c.id);
    }
  }
  return {
    members: members.filter((m) => m.id !== accountId),
    rootIds: rootIds.filter((id) => id !== accountId),
    children
  };
}

function subtreeRemove(members, rootIds, accountId) {
  const ids = new Set(collectSubtree(members, accountId));
  return {
    members: members.filter((m) => !ids.has(m.id)),
    rootIds: rootIds.filter((id) => !ids.has(id)),
    deletedCount: ids.size
  };
}

const c = createAssertCounter();

// Spec: A -> B -> C -> D ; delete B with promote => A -> C -> D
{
  const chain = [
    { id: 'A', name: 'A', parent: null },
    { id: 'B', name: 'B', parent: 'A' },
    { id: 'C', name: 'C', parent: 'B' },
    { id: 'D', name: 'D', parent: 'C' }
  ];
  const out = promoteThenRemove(chain, ['A'], 'B');
  c.assert('promote removes B only', !out.members.find((m) => m.id === 'B'));
  c.assert('promote reparents C to A', out.members.find((m) => m.id === 'C').parent === 'A');
  c.assert('promote keeps D under C', out.members.find((m) => m.id === 'D').parent === 'C');
  c.assert('promote leaves 0 orphans', countOrphans(out.members).length === 0);
  c.assert('promote keeps A,C,D', out.members.map((m) => m.id).sort().join(',') === 'A,C,D');
}

{
  const members = [
    { id: 'R', name: 'root', parent: null },
    { id: 'A', name: 'mid', parent: 'R' },
    { id: 'B', name: 'childB', parent: 'A' },
    { id: 'C', name: 'childC', parent: 'A' },
    { id: 'D', name: 'grand', parent: 'C' }
  ];
  c.assert('subtree count A = 4', collectSubtree(members, 'A').length === 4);

  const snap = JSON.parse(JSON.stringify({ members, rootIds: ['R'] }));
  const promoted = promoteThenRemove(snap.members, snap.rootIds, 'A');
  c.assert('promote mid keeps grandchild under C', promoted.members.find((m) => m.id === 'D').parent === 'C');
  c.assert('promote mid orphans 0', countOrphans(promoted.members).length === 0);

  const snap2 = JSON.parse(JSON.stringify({ members, rootIds: ['R'] }));
  const sub = subtreeRemove(snap2.members, snap2.rootIds, 'A');
  c.assert('subtree deletes 4', sub.deletedCount === 4);
  c.assert('subtree leaves only R', sub.members.length === 1 && sub.members[0].id === 'R');
  c.assert('subtree orphans 0', countOrphans(sub.members).length === 0);

  const bad = members.filter((m) => m.id !== 'A');
  c.assert('self-only delete would orphan (forbidden)', countOrphans(bad).length === 2);
}

{
  const only = [
    { id: 'R', name: 'root', parent: null },
    { id: 'X', name: 'x', parent: 'R' },
    { id: 'Y', name: 'y', parent: 'X' }
  ];
  const out = promoteThenRemove(only, ['R'], 'R');
  c.assert('promote last root: X becomes root', out.members.find((m) => m.id === 'X').parent === null);
  c.assert('promote last root: Y stays under X', out.members.find((m) => m.id === 'Y').parent === 'X');
  c.assert('promote last root: orphans 0', countOrphans(out.members).length === 0);
}

console.log(`\nDelete modes: ${c.passed} passed, ${c.failed} failed`);
exitFromCounter(c);
