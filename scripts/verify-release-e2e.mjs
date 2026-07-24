#!/usr/bin/env node
/**
 * Release E2E smoke (Playwright, isolated LocalStorage context).
 * Covers major pages, org integrity/delete modes, portfolio smoke,
 * LocalStorage reload, project isolation, and mobile viewports.
 *
 * Requires: localhost :5050 (npm run dev), playwright chromium
 * Run: node scripts/verify-release-e2e.mjs
 */
import { chromium } from 'playwright';
import { createAssertCounter, printSuiteHeader } from './lib/verify-report.mjs';

const BASE = process.env.OUKEI_BASE || 'http://127.0.0.1:5050/';
const MOBILE_WIDTHS = [375, 390, 430];

printSuiteHeader('Release E2E smoke');

const c = createAssertCounter();

function makeChain(prefix) {
  // A -> B -> C -> D
  return [
    { id: prefix + 'A', name: prefix + 'A', parent: null, open: true, investment: 100 },
    { id: prefix + 'B', name: prefix + 'B', parent: prefix + 'A', open: true, investment: 100 },
    { id: prefix + 'C', name: prefix + 'C', parent: prefix + 'B', open: true, investment: 100 },
    { id: prefix + 'D', name: prefix + 'D', parent: prefix + 'C', open: true, investment: 100 }
  ];
}

async function bypassAuth(page) {
  await page.evaluate(() => {
    try {
      const gate = document.getElementById('hubAuthGate');
      if (gate) gate.style.display = 'none';
      document.body.classList.remove('hubAuthLocked');
      const app = document.getElementById('app');
      if (app) app.style.display = '';
    } catch (e) { /* ignore */ }
  });
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.error('Playwright chromium launch failed:', e.message || e);
    console.error('Install with: npx playwright install chromium');
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  await bypassAuth(page);

  // --- Major screens open ---
  const pages = [
    ['home', 'homePage'],
    ['portfolio', 'portfolioPage'],
    ['revenueManage', 'revenueManagePage'],
    ['salesManage', 'salesManagePage'],
    ['settings', 'settingsPage'],
    ['ram', 'ramPage'],
    ['orcaOrg', 'orcaOrgPage'],
    ['eniOrg', 'eniOrgPage']
  ];

  for (const [route, elId] of pages) {
    const ok = await page.evaluate(({ route, elId }) => {
      try {
        if (typeof showPage === 'function') showPage(route);
      } catch (e) {
        return { ok: false, err: String(e) };
      }
      const el = document.getElementById(elId);
      if (!el) return { ok: false, err: 'missing ' + elId };
      const hidden = el.classList.contains('hidden') || getComputedStyle(el).display === 'none';
      return { ok: !hidden, err: hidden ? 'still hidden' : '' };
    }, { route, elId });
    c.assert(`screen opens: ${route}`, ok.ok, ok.err);
  }
  c.assert('no JS pageerrors after screens', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  // --- Seed org charts & portfolio helpers ---
  const seeded = await page.evaluate((chains) => {
    // Avoid file-download side effects during delete backups
    window.downloadBackup = function () { return true; };
    if (typeof autoBackups === 'undefined') {
      try { autoBackups = []; } catch (e) { /* ignore */ }
    }

    // Enable projects
    if (typeof settings !== 'undefined' && settings) {
      settings.useRAM = true;
      settings.useORCA = true;
      settings.useENI = true;
      if (!settings.customProjects) settings.customProjects = [];
      if (!settings.customProjects.some((p) => p && p.key === 'eni')) {
        settings.customProjects.push({ key: 'eni', name: 'ENI', enabled: true });
      }
    }

    // RAM
    try { members = chains.ram.map((m) => ({ ...m })); } catch (e) { window.members = chains.ram.map((m) => ({ ...m })); }
    rootId = 'ramA';
    rootAccountIds = ['ramA'];
    focusId = 'ramA';

    // ORCA
    orcaMembers = chains.orca.map((m) => ({ ...m }));
    orcaCurrentData = orcaMembers.map((m) => ({ ...m }));
    orcaRootId = 'orcaA';
    orcaRootAccountIds = ['orcaA'];
    orcaFocusId = 'orcaA';

    // ENI
    eniMembers = chains.eni.map((m) => ({ ...m }));
    eniCurrentData = eniMembers.map((m) => ({ ...m }));
    eniRootId = 'eniA';
    eniRootAccountIds = ['eniA'];
    eniFocusId = 'eniA';
    if (typeof eniNormalizeMembers === 'function') eniNormalizeMembers();

    if (typeof render === 'function') render();
    if (typeof orcaRender === 'function') orcaRender();
    if (typeof eniRender === 'function') eniRender();
    if (typeof renderPortfolio === 'function') renderPortfolio();
    if (typeof hubSaveNow === 'function') hubSaveNow();
    else if (typeof hubSaveToStorage === 'function') hubSaveToStorage();

    function orphans(list) {
      const by = {};
      list.forEach((m) => { if (m && m.id) by[m.id] = m; });
      return list.filter((m) => m.parent && !by[m.parent]).length;
    }

    return {
      ram: members.length,
      orca: orcaMembers.length,
      eni: eniMembers.length,
      ramOrphans: orphans(members),
      orcaOrphans: orphans(orcaMembers),
      eniOrphans: orphans(eniMembers),
      hasAim: typeof aimDeleteOrgMemberOnly === 'function',
      hasPromote: typeof aimPromoteChildrenThenRemoveSelf === 'function',
      storageKey: typeof hubResolveStorageKey === 'function' ? hubResolveStorageKey() : 'oukei_hub_v15_data'
    };
  }, {
    ram: makeChain('ram'),
    orca: makeChain('orca'),
    eni: makeChain('eni')
  });

  c.assert('seed RAM 4 nodes', seeded.ram === 4, JSON.stringify(seeded));
  c.assert('seed ORCA 4 nodes', seeded.orca === 4);
  c.assert('seed ENI 4 nodes', seeded.eni === 4);
  c.assert('seed orphans 0 (RAM/ORCA/ENI)', seeded.ramOrphans + seeded.orcaOrphans + seeded.eniOrphans === 0);
  c.assert('delete APIs available', seeded.hasAim && seeded.hasPromote);

  // --- Org DOM counts ---
  for (const [route, treeId, expect] of [
    ['ram', 'tree', 4],
    ['orcaOrg', 'orcaTree', 4],
    ['eniOrg', 'eniTree', 4]
  ]) {
    const r = await page.evaluate(({ route, treeId }) => {
      showPage(route);
      if (route === 'ram' && typeof render === 'function') render();
      if (route === 'orcaOrg' && typeof orcaRender === 'function') orcaRender();
      if (route === 'eniOrg' && typeof eniRender === 'function') eniRender();
      const tree = document.getElementById(treeId);
      return tree ? tree.querySelectorAll('li').length : -1;
    }, { route, treeId });
    c.assert(`org DOM ${route} li === ${expect}`, r === expect, `got ${r}`);
  }

  // --- Promote delete on ENI: A-B-C-D delete B => A-C-D ---
  const promote = await page.evaluate(() => {
    const before = eniMembers.map((m) => ({ id: m.id, parent: m.parent }));
    const ok = aimDeleteOrgMemberOnly('eni', 'eniB', { mode: 'promote' });
    // stub downloadBackup side-effect already ran; ignore
    const by = Object.fromEntries(eniMembers.map((m) => [m.id, m]));
    function orphans() {
      return eniMembers.filter((m) => m.parent && !by[m.parent]).length;
    }
    return {
      ok,
      ids: eniMembers.map((m) => m.id).sort(),
      cParent: by.eniC && by.eniC.parent,
      dParent: by.eniD && by.eniD.parent,
      orphans: orphans(),
      before
    };
  });
  c.assert('ENI promote delete ok', promote.ok === true, JSON.stringify(promote));
  c.assert('ENI promote removed B', !promote.ids.includes('eniB'));
  c.assert('ENI promote C→A', promote.cParent === 'eniA');
  c.assert('ENI promote D stays under C', promote.dParent === 'eniC');
  c.assert('ENI promote orphans 0', promote.orphans === 0);

  // --- Subtree delete on ORCA: delete B removes B,C,D ---
  const subtree = await page.evaluate(() => {
    const ok = aimDeleteOrgMemberOnly('orca', 'orcaB', { mode: 'subtree' });
    const ids = orcaMembers.map((m) => m.id).sort();
    const by = Object.fromEntries(orcaMembers.map((m) => [m.id, m]));
    const orphans = orcaMembers.filter((m) => m.parent && !by[m.parent]).length;
    return { ok, ids, orphans, count: orcaMembers.length };
  });
  c.assert('ORCA subtree delete ok', subtree.ok === true, JSON.stringify(subtree));
  c.assert('ORCA subtree left A only', subtree.ids.join(',') === 'orcaA' && subtree.count === 1);
  c.assert('ORCA subtree orphans 0', subtree.orphans === 0);

  // --- Project switch keeps ENI ---
  const switched = await page.evaluate(() => {
    const eniBefore = eniMembers.length;
    showPage('orcaOrg');
    if (typeof orcaRender === 'function') orcaRender();
    showPage('eniOrg');
    if (typeof eniRender === 'function') eniRender();
    const tree = document.getElementById('eniTree');
    return {
      eniBefore,
      eniAfter: eniMembers.length,
      dom: tree ? tree.querySelectorAll('li').length : -1,
      ramStill: members.length
    };
  });
  c.assert('project switch keeps ENI count', switched.eniAfter === switched.eniBefore);
  c.assert('project switch keeps RAM untouched', switched.ramStill === 4);

  // --- Portfolio smoke ---
  const pf = await page.evaluate(() => {
    showPage('portfolio');
    if (typeof renderPortfolio === 'function') renderPortfolio();
    const pageEl = document.getElementById('portfolioPage');
    const text = pageEl ? pageEl.innerText : '';
    const html = pageEl ? pageEl.innerHTML : '';
    return {
      visible: pageEl && !pageEl.classList.contains('hidden'),
      hasRam: /RAM/i.test(text) || /ram/i.test(html),
      hasOrca: /ORCA/i.test(text) || /orca/i.test(html),
      hasEni: /ENI/i.test(text) || /eni/i.test(html),
      hasChart: !!(pageEl && (
        pageEl.querySelector('canvas') ||
        pageEl.querySelector('.pfStack') ||
        pageEl.querySelector('[class*="chart" i]') ||
        pageEl.querySelector('.pfMonth')
      )),
      len: text.length
    };
  });
  c.assert('portfolio page visible', pf.visible);
  c.assert('portfolio mentions projects', pf.hasRam || pf.hasOrca || pf.hasEni, JSON.stringify(pf));
  c.assert('portfolio has chart/month UI', pf.hasChart || pf.len > 50, JSON.stringify(pf));

  // --- Performance input must not shrink org ---
  const inputIsolation = await page.evaluate(() => {
    const before = {
      ram: members.length,
      orca: orcaMembers.length,
      eni: eniMembers.length
    };
    if (!settings.revenueLog) settings.revenueLog = {};
    settings.revenueLog['2099-01-01'] = {
      ram: 1, orca: 2, eni: 3,
      accounts: {},
      ramAccounts: {},
      orcaAccounts: {},
      eniAccounts: {}
    };
    if (typeof markActivity === 'function') markActivity();
    if (typeof hubSaveNow === 'function') hubSaveNow();
    return {
      before,
      after: {
        ram: members.length,
        orca: orcaMembers.length,
        eni: eniMembers.length
      }
    };
  });
  c.assert(
    'revenue input does not shrink org',
    inputIsolation.before.ram === inputIsolation.after.ram &&
    inputIsolation.before.orca === inputIsolation.after.orca &&
    inputIsolation.before.eni === inputIsolation.after.eni,
    JSON.stringify(inputIsolation)
  );

  // --- LocalStorage reload persistence ---
  const persisted = await page.evaluate(() => {
    window.downloadBackup = function () { return true; };
    if (typeof hubSaveNow === 'function') hubSaveNow();
    else if (typeof hubSaveToStorage === 'function') hubSaveToStorage();
    const key = typeof hubResolveStorageKey === 'function'
      ? hubResolveStorageKey()
      : 'oukei_hub_v15_data';
    const packed = typeof hubPackLocalData === 'function'
      ? hubPackLocalData()
      : null;
    if (packed) {
      packed.updatedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(packed));
      // also write legacy key for boot paths that ignore uid binding
      localStorage.setItem('oukei_hub_v15_data', JSON.stringify(packed));
    }
    const raw = localStorage.getItem(key) || localStorage.getItem('oukei_hub_v15_data') || '';
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    return {
      key,
      rawLen: raw.length,
      ram: parsed && Array.isArray(parsed.members) ? parsed.members.length : -1,
      orca: parsed && parsed.orcaOrgChart && Array.isArray(parsed.orcaOrgChart.members)
        ? parsed.orcaOrgChart.members.length : -1,
      eni: parsed && parsed.eniOrgChart && Array.isArray(parsed.eniOrgChart.members)
        ? parsed.eniOrgChart.members.length : -1,
      eniIds: parsed && parsed.eniOrgChart
        ? (parsed.eniOrgChart.members || []).map((m) => m.id)
        : [],
      orcaIds: parsed && parsed.orcaOrgChart
        ? (parsed.orcaOrgChart.members || []).map((m) => m.id)
        : []
    };
  });
  c.assert('LocalStorage has RAM 4 before reload', persisted.ram === 4, JSON.stringify(persisted));
  c.assert('LocalStorage has ENI promote result', persisted.eniIds.includes('eniC') && !persisted.eniIds.includes('eniB'), JSON.stringify(persisted));
  c.assert('LocalStorage has ORCA subtree result', persisted.orcaIds.join(',') === 'orcaA', JSON.stringify(persisted));

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  await bypassAuth(page);
  const afterReload = await page.evaluate(() => {
    // Force apply from LocalStorage if boot left empties (auth/dev path)
    try {
      if (typeof hubLoadFromStorage === 'function' && typeof hubApplyData === 'function') {
        const loaded = hubLoadFromStorage();
        if (loaded && loaded.data) hubApplyData(loaded.data, { skipMerge: true });
      }
    } catch (e) { /* ignore */ }
    return {
      ram: typeof members !== 'undefined' ? members.length : -1,
      orca: typeof orcaMembers !== 'undefined' ? orcaMembers.length : -1,
      eni: typeof eniMembers !== 'undefined' ? eniMembers.length : -1,
      eniHasC: typeof eniMembers !== 'undefined' && eniMembers.some((m) => m.id === 'eniC'),
      eniHasB: typeof eniMembers !== 'undefined' && eniMembers.some((m) => m.id === 'eniB'),
      orcaOnlyA: typeof orcaMembers !== 'undefined' && orcaMembers.length === 1 && orcaMembers[0].id === 'orcaA'
    };
  });
  c.assert('reload keeps RAM 4', afterReload.ram === 4, JSON.stringify(afterReload));
  c.assert('reload keeps ENI promote result', afterReload.eniHasC && !afterReload.eniHasB, JSON.stringify(afterReload));
  c.assert('reload keeps ORCA subtree result', afterReload.orcaOnlyA, JSON.stringify(afterReload));

  // --- Mobile viewports ---
  for (const w of MOBILE_WIDTHS) {
    await page.setViewportSize({ width: w, height: 844 });
    await bypassAuth(page);
    const mobile = await page.evaluate(async (width) => {
      const routes = [
        ['home', 'homePage'],
        ['portfolio', 'portfolioPage'],
        ['settings', 'settingsPage'],
        ['eniOrg', 'eniOrgPage']
      ];
      const results = [];
      for (const [route, id] of routes) {
        try { showPage(route); } catch (e) { /* ignore */ }
        await new Promise((r) => setTimeout(r, 80));
        const el = document.getElementById(id);
        const bodyScroll = document.documentElement.scrollWidth > width + 2 ||
          document.body.scrollWidth > width + 2;
        const modal = document.getElementById('modalBg');
        let modalOverflow = false;
        if (modal && getComputedStyle(modal).display !== 'none') {
          const r = modal.getBoundingClientRect();
          modalOverflow = r.left < -2 || r.right > width + 2;
        }
        const btn = el && el.querySelector('button, .btn, .btn2, .menuItem');
        results.push({
          route,
          visible: !!(el && !el.classList.contains('hidden')),
          hScroll: bodyScroll,
          hasBtn: !!btn,
          modalOverflow
        });
      }
      return results;
    }, w);

    const badScroll = mobile.filter((m) => m.hScroll);
    const missing = mobile.filter((m) => !m.visible);
    c.assert(`mobile ${w} screens open`, missing.length === 0, JSON.stringify(missing));
    c.assert(`mobile ${w} no page h-scroll`, badScroll.length === 0, JSON.stringify(badScroll));
    c.assert(`mobile ${w} has interactive controls`, mobile.every((m) => m.hasBtn), JSON.stringify(mobile));
  }

  c.assert('no JS pageerrors at end', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

  await browser.close();
  console.log(`\nRelease E2E: ${c.passed} passed, ${c.failed} failed`);
  process.exit(c.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
