#!/usr/bin/env node
/**
 * Localhost regression (Playwright, isolated storage):
 * - Inject synthetic RAM/ORCA/ENI trees (no wipe of real user data: clean context)
 * - Assert saved members == visible DOM nodes when open
 * - Reproduce pre-fix collapse via !!open semantics and confirm fix path
 *
 * Run: node scripts/verify-org-chart-localhost.mjs
 * Requires: npm run dev on :5050, playwright chromium
 */
import { chromium } from 'playwright';

const BASE = process.env.OUKEI_BASE || 'http://127.0.0.1:5050/';

function makeTree(prefix, n) {
  const members = [];
  for (let i = 1; i <= n; i++) {
    members.push({
      id: prefix + i,
      parent: i === 1 ? null : prefix + Math.floor(i / 2),
      name: prefix.toUpperCase() + i,
      investment: 100,
      open: true
    });
  }
  return members;
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  // Isolated context ⇒ does not touch the developer's normal browser LocalStorage
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1200);

  const ready = await page.evaluate(() => ({
    hubOrgSnapshotOpenFlags: typeof hubOrgSnapshotOpenFlags,
    hubOrgDiagnoseCharts: typeof hubOrgDiagnoseCharts,
    eniRender: typeof eniRender,
    orcaRender: typeof orcaRender,
    render: typeof render,
    showPage: typeof showPage
  }));
  assert('org fix helpers loaded', ready.hubOrgSnapshotOpenFlags === 'function', JSON.stringify(ready));
  assert('eniRender available', ready.eniRender === 'function');
  assert('orcaRender available', ready.orcaRender === 'function');

  // --- Reproduce OLD bug semantics in-page, then confirm NEW snapshot ---
  const logic = await page.evaluate(() => {
    const members = [];
    for (let i = 1; i <= 20; i++) {
      members.push({ id: 'e' + i, parent: i === 1 ? null : 'e' + Math.floor(i / 2), name: 'E' + i });
    }
    const oldMap = {};
    members.forEach((m) => {
      oldMap[m.id] = !!m.open;
    });
    const newMap = hubOrgSnapshotOpenFlags(members);
    // simulate apply normalize
    members.forEach((m) => {
      m.open = true;
    });
    const afterOld = members.map((m) => ({ ...m }));
    afterOld.forEach((m) => {
      m.open = oldMap[m.id];
    });
    const afterNew = members.map((m) => ({ ...m }));
    hubOrgRestoreOpenFlags(afterNew, newMap, 'logic');
    const visOld = hubOrgCountVisibleFromRoot(afterOld, 'e1').visible;
    const visNew = hubOrgCountVisibleFromRoot(afterNew, 'e1').visible;
    return {
      oldAllFalse: Object.values(oldMap).every((v) => v === false),
      newAllTrue: Object.values(newMap).every((v) => v === true),
      visOld,
      visNew
    };
  });
  assert('OLD !!open would mass-collapse', logic.oldAllFalse && logic.visOld === 1, JSON.stringify(logic));
  assert('NEW snapshot keeps full tree', logic.newAllTrue && logic.visNew === 20, JSON.stringify(logic));

  // --- Inject ENI tree and render ---
  const eni = await page.evaluate((members) => {
    // Bypass auth gate UI if present by forcing page show
    try {
      const gate = document.getElementById('hubAuthGate');
      if (gate) gate.style.display = 'none';
      const app = document.getElementById('app') || document.body;
      if (app) app.style.display = '';
    } catch (e) {}
    eniMembers = members.map((m) => ({ ...m }));
    eniCurrentData = eniMembers.map((m) => ({ ...m }));
    eniRootId = 'eni1';
    eniRootAccountIds = ['eni1'];
    eniFocusId = 'eni1';
    if (typeof eniNormalizeMembers === 'function') eniNormalizeMembers();
    if (typeof showPage === 'function') showPage('eniOrg');
    if (typeof eniRender === 'function') eniRender();
    const diag = typeof hubOrgDiagnoseCharts === 'function' ? hubOrgDiagnoseCharts() : null;
    const tree = document.getElementById('eniTree');
    const domLis = tree ? tree.querySelectorAll('li').length : 0;
    const parents = {};
    eniMembers.forEach((m) => {
      if (m.parent) parents[m.id] = m.parent;
    });
    return {
      members: eniMembers.length,
      edges: eniMembers.filter((m) => m.parent).length,
      domLis,
      diag: diag && diag.eni,
      sampleParent: parents['eni2'] || null
    };
  }, makeTree('eni', 15));
  assert('ENI saved members injected', eni.members === 15, JSON.stringify(eni));
  assert('ENI DOM li === members', eni.domLis === 15, JSON.stringify(eni));
  assert('ENI parent relation kept', eni.sampleParent === 'eni1', JSON.stringify(eni));

  // --- Mass-collapsed persisted ENI repairs on normalize ---
  const eniRepair = await page.evaluate((members) => {
    eniMembers = members.map((m) => ({ ...m, open: false }));
    eniRootId = 'eni1';
    eniNormalizeMembers();
    eniRender();
    const tree = document.getElementById('eniTree');
    return {
      allOpen: eniMembers.every((m) => m.open === true),
      parentsOk: eniMembers.filter((m) => m.parent).length === 14,
      domLis: tree ? tree.querySelectorAll('li').length : 0
    };
  }, makeTree('eni', 15));
  assert('ENI mass-collapse repaired', eniRepair.allOpen && eniRepair.domLis === 15, JSON.stringify(eniRepair));

  // --- ORCA ---
  const orca = await page.evaluate((members) => {
    orcaMembers = members.map((m) => ({ ...m }));
    orcaCurrentData = orcaMembers.map((m) => ({ ...m }));
    orcaRootId = 'orca1';
    orcaRootAccountIds = ['orca1'];
    orcaFocusId = 'orca1';
    if (typeof showPage === 'function') showPage('orcaOrg');
    if (typeof orcaRender === 'function') orcaRender();
    const tree = document.getElementById('orcaTree');
    return {
      members: orcaMembers.length,
      domLis: tree ? tree.querySelectorAll('li').length : 0
    };
  }, makeTree('orca', 12));
  assert('ORCA DOM li === members', orca.domLis === 12 && orca.members === 12, JSON.stringify(orca));

  // --- RAM ---
  const ram = await page.evaluate((members) => {
    members = members; // shadowed carefully below
  });
  const ramResult = await page.evaluate((treeMembers) => {
    if (typeof members !== 'undefined') {
      // assign global
    }
    window.members = treeMembers.map((m) => ({ ...m }));
    // index.html uses bare `members` binding — set both ways
    try {
      members = window.members;
    } catch (e) {
      /* ignore */
    }
    rootId = 'ram1';
    rootAccountIds = ['ram1'];
    focusId = 'ram1';
    if (typeof showPage === 'function') showPage('ram');
    if (typeof render === 'function') render();
    else if (typeof renderTree === 'function') renderTree();
    const tree = document.getElementById('tree');
    return {
      members: (typeof members !== 'undefined' ? members : window.members).length,
      domLis: tree ? tree.querySelectorAll('li').length : 0
    };
  }, makeTree('ram', 10));
  assert('RAM DOM li === members', ramResult.domLis === 10 && ramResult.members === 10, JSON.stringify(ramResult));

  // Project switch: ENI → ORCA → ENI keeps ENI members
  const switchKeep = await page.evaluate(() => {
    const before = eniMembers.length;
    if (typeof showPage === 'function') showPage('orcaOrg');
    if (typeof orcaRender === 'function') orcaRender();
    if (typeof showPage === 'function') showPage('eniOrg');
    if (typeof eniRender === 'function') eniRender();
    return { before, after: eniMembers.length };
  });
  assert('project switch keeps ENI data', switchKeep.before === switchKeep.after && switchKeep.after > 0, JSON.stringify(switchKeep));

  // Portfolio render must not clear ENI
  const pfIso = await page.evaluate(() => {
    const before = eniMembers.map((m) => m.id).join(',');
    if (typeof showPage === 'function') showPage('portfolio');
    if (typeof renderPortfolio === 'function') renderPortfolio();
    if (typeof showPage === 'function') showPage('eniOrg');
    if (typeof eniRender === 'function') eniRender();
    const after = eniMembers.map((m) => m.id).join(',');
    const tree = document.getElementById('eniTree');
    return {
      same: before === after,
      domLis: tree ? tree.querySelectorAll('li').length : 0,
      members: eniMembers.length
    };
  });
  assert('portfolio does not affect ENI org', pfIso.same && pfIso.domLis === pfIso.members, JSON.stringify(pfIso));

  if (pageErrors.length) {
    console.log('pageerrors', pageErrors.slice(0, 5));
  }
  assert('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
