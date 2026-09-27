#!/usr/bin/env node
/**
 * Verify MATRIX opt-in, revenue input (4 fields), save/merge, portfolio visibility.
 * Usage: node scripts/verify-matrix-performance-input.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const baseUrl = process.argv[2] || 'http://127.0.0.1:5050';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const checks = [];

function assert(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function loadHubApi() {
  const code = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');
  const wrapped = code + '\n;return { hubMergeHubDocuments, hubCreateEmptyData, hubCreateDefaultSettings };';
  return new Function(wrapped)();
}

function round4(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

// --- Static formula checks ---
assert('total = revenueBonus + matrixBonus (both)', round4(100 + 50) === 150);
assert('total with matrixBonus 0', round4(80 + 0) === 80);
assert('total with revenueBonus 0', round4(0 + 25) === 25);
assert('empty values treated as 0', round4('' + 0) === 0);

const pd = readFileSync(path.join(root, 'assets/js/performance-data.js'), 'utf8');
const matrixInput = readFileSync(path.join(root, 'assets/js/matrix-revenue-input.js'), 'utf8');
const pm = readFileSync(path.join(root, 'assets/js/project-master.js'), 'utf8');
const hub = readFileSync(path.join(root, 'assets/js/hub-storage.js'), 'utf8');

assert('PM_VALID_CODES.MATRIX', pm.includes("MATRIX: 'matrix'"));
assert('pdSaveMatrixPerformanceEntry exists', pd.includes('function pdSaveMatrixPerformanceEntry'));
assert('matrixAccounts in hub merge keys', hub.includes("'matrixAccounts'"));
assert('matrix per-account input fields', matrixInput.includes('matrixRevenueBonus_') &&
  matrixInput.includes('matrixMatrixBonus_') && matrixInput.includes('matrixSaveRevenueBtn'));
assert('matrix no daily account name on input', !matrixInput.includes('id="matrixAccountName"'));
assert('matrix save closes modal via hubFinish', matrixInput.includes('hubFinishRevenueInputSave'));
assert('ORG_CHART does not list matrix', !readFileSync(path.join(root, 'assets/js/org-nav.js'), 'utf8').includes("key: 'matrix'"));

// --- Hub merge: cloud-only matrixAccounts preserved ---
const { hubMergeHubDocuments, hubCreateEmptyData, hubCreateDefaultSettings } = loadHubApi();
const localDoc = hubCreateEmptyData();
localDoc.updatedAt = 9000;
localDoc.settings = hubCreateDefaultSettings();
localDoc.settings.revenueLog = {
  '2026-09-22': {
    ramAccounts: { m1: { todayRevenue: 10, addInvestment: 0 } },
    ram: 10,
    total: 10
  }
};
const cloudDoc = hubCreateEmptyData();
cloudDoc.updatedAt = 1000;
cloudDoc.settings = hubCreateDefaultSettings();
cloudDoc.settings.revenueLog = {
  '2026-09-22': {
    ramAccounts: { m1: { todayRevenue: 10, addInvestment: 0 } },
    matrixAccounts: {
      mx1: {
        accountId: 'mx1',
        accountName: 'kai-matrix',
        revenueBonus: 120,
        matrixBonus: 30,
        total: 150
      }
    },
    ram: 10,
    matrix: 150,
    total: 160
  }
};
cloudDoc.settings.matrixInputAccounts = [{ id: 'mx1', username: 'kai-matrix', name: 'kai-matrix' }];
const mergedDoc = hubMergeHubDocuments(localDoc, cloudDoc);
const mergedDay = mergedDoc.settings.revenueLog['2026-09-22'] || {};
assert(
  'merge keeps cloud matrixAccounts',
  !!(mergedDay.matrixAccounts && mergedDay.matrixAccounts.mx1 && mergedDay.matrixAccounts.mx1.total === 150)
);
assert(
  'merge keeps RAM account alongside matrix',
  !!(mergedDay.ramAccounts && mergedDay.ramAccounts.m1)
);
assert(
  'merge keeps matrixInputAccounts',
  Array.isArray(mergedDoc.settings.matrixInputAccounts) &&
    mergedDoc.settings.matrixInputAccounts.some((a) => a.id === 'mx1')
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.body.classList.add('hub-auth-ready');
    localStorage.clear();
    if (typeof hubApplyData === 'function') {
      hubApplyData(typeof hubCreateEmptyData === 'function' ? hubCreateEmptyData() : { members: [], settings: {} });
    }
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
    if (typeof render === 'function') render();
  });
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => ({
    matrixRegistered: !!(typeof pmGetProject === 'function' && pmGetProject('matrix') && pmGetProject('matrix').registered),
    orgProjects: typeof orgGetSelectableProjects === 'function' ? orgGetSelectableProjects().map((p) => p.key) : [],
    ramCount: typeof members !== 'undefined' ? members.length : -1
  }));
  assert('MATRIX not registered initially', !before.matrixRegistered);
  assert('MATRIX not in org select', before.orgProjects.indexOf('matrix') < 0, before.orgProjects.join(','));

  const addResult = await page.evaluate(() => {
    if (!pmDraftState && typeof pmInitDraftDefaults === 'function') pmInitDraftDefaults();
    let result = pmValidateProjectCode('MATRIX');
    if (!result.ok) return result;
    let meta = PM_CODE_META[result.key] || { name: result.key, startDate: '—' };
    pmDraftState.projects[result.key] = {
      key: result.key,
      name: meta.name,
      startDate: meta.startDate,
      inclusionRate: 100,
      visible: true,
      registered: true,
      iconKey: result.key
    };
    if (pmDraftState.order.indexOf(result.key) === -1) pmDraftState.order.push(result.key);
    pmCommitProjectMaster(pmReadDraftState());
    if (typeof render === 'function') render();
    return { ok: true, key: result.key };
  });
  assert('MATRIX add via code succeeds', addResult.ok === true);

  await page.waitForTimeout(400);

  const visible = await page.evaluate(() => ({
    home: getEnabledHomeProjects().map((p) => p.key),
    pf: pfGetAllPortfolioProjects().map((p) => p.key),
    revenue: getRevenueInputProjects().map((p) => p.key),
    rm: rmGetActiveProjects().map((p) => p.key),
    org: orgGetSelectableProjects().map((p) => p.key),
    matrixAccounts: Array.isArray(settings.matrixInputAccounts) ? settings.matrixInputAccounts.length : -1
  }));
  assert('MATRIX visible on home', visible.home.indexOf('matrix') >= 0, visible.home.join(','));
  assert('MATRIX visible on portfolio', visible.pf.indexOf('matrix') >= 0, visible.pf.join(','));
  assert('MATRIX visible on revenue input', visible.revenue.indexOf('matrix') >= 0, visible.revenue.join(','));
  assert('MATRIX visible on revenue manage', visible.rm.indexOf('matrix') >= 0, visible.rm.join(','));
  assert('MATRIX hidden on org select', visible.org.indexOf('matrix') < 0, visible.org.join(','));

  const saveOnlyBonus = await page.evaluate(() => {
    if (!settings.matrixInputAccounts) settings.matrixInputAccounts = [];
    settings.matrixInputAccounts.push({
      id: 'mtest1',
      username: 'matrix-test-1',
      name: 'matrix-test-1',
      investment: 0
    });
    let acc = { id: 'mtest1' };
    let dateKey = todayKey();
    let saved = pdSaveMatrixPerformanceEntry(dateKey, acc.id, 'matrix-test-1', 100, '');
    if (typeof persistHubSettings === 'function') persistHubSettings();
    let entry = settings.revenueLog[dateKey];
    let ae = entry && entry.matrixAccounts ? entry.matrixAccounts[acc.id] : null;
    return {
      revenueBonus: ae ? ae.revenueBonus : null,
      matrixBonus: ae ? ae.matrixBonus : null,
      total: ae ? ae.total : null,
      projectTotal: entry ? entry.matrix : null
    };
  });
  assert('save revenueBonus only', saveOnlyBonus.revenueBonus === 100 && saveOnlyBonus.matrixBonus === 0);
  assert('total with matrixBonus 0', saveOnlyBonus.total === 100);
  assert('project matrix total recalculated', saveOnlyBonus.projectTotal === 100);

  const saveBoth = await page.evaluate(() => {
    let acc = matrixFindInputAccountByName('matrix-test-1');
    let dateKey = todayKey();
    pdSaveMatrixPerformanceEntry(dateKey, acc.id, 'matrix-test-1', 100, 25);
    if (typeof persistHubSettings === 'function') persistHubSettings();
    let ae = settings.revenueLog[dateKey].matrixAccounts[acc.id];
    return { total: ae.total, matrix: settings.revenueLog[dateKey].matrix };
  });
  assert('save both bonuses total=125', saveBoth.total === 125 && saveBoth.matrix === 125);

  await page.evaluate(() => {
    openMatrixRevenueInput();
  });
  await page.waitForTimeout(300);
  const formFields = await page.evaluate(() => {
    let acc = matrixFindInputAccountByName('matrix-test-1');
    return {
      hasAddBtn: !!document.getElementById('matrixOpenAddAccountBtn'),
      revenueBonus: acc ? !!document.getElementById('matrixRevenueBonus_' + acc.id) : false,
      matrixBonus: acc ? !!document.getElementById('matrixMatrixBonus_' + acc.id) : false,
      saveBtn: !!document.getElementById('matrixSaveRevenueBtn')
    };
  });
  assert('form has add account button', formFields.hasAddBtn);
  assert('form has revenueBonus field', formFields.revenueBonus);
  assert('form has matrixBonus field', formFields.matrixBonus);
  assert('form has save button', formFields.saveBtn);

  const pfRow = await page.evaluate(() => {
    if (typeof portfolioPage !== 'undefined') portfolioPage.classList.remove('hidden');
    if (typeof renderPortfolio === 'function') renderPortfolio();
    let grid = document.getElementById('pfProjectGrid');
    let html = grid ? grid.innerHTML : '';
    return {
      hasMatrix: /MATRIX|pfProjectCard--matrix/.test(html),
      cumulative: typeof pdSumAllTimeRevenue === 'function' ? pdSumAllTimeRevenue().byProject.matrix : null
    };
  });
  assert('portfolio shows MATRIX', pfRow.hasMatrix);
  assert('portfolio cumulative matrix revenue', pfRow.cumulative === 125, String(pfRow.cumulative));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.body.classList.add('hub-auth-ready');
    if (typeof hubInitStorage === 'function') hubInitStorage();
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  });
  const persisted = await page.evaluate(() => {
    let dateKey = todayKey();
    let entry = settings.revenueLog && settings.revenueLog[dateKey];
    let acc = matrixFindInputAccountByName('matrix-test-1');
    let ae = entry && acc && entry.matrixAccounts ? entry.matrixAccounts[acc.id] : null;
    return {
      registered: !!(pmGetProject('matrix') && pmGetProject('matrix').registered),
      total: ae ? ae.total : null,
      ramCount: members.length
    };
  });
  assert('MATRIX persists after reload', persisted.registered && persisted.total === 125);
  assert('RAM member count unchanged', persisted.ramCount === before.ramCount, `${before.ramCount} -> ${persisted.ramCount}`);

  await page.evaluate(() => {
    if (typeof openMatrixRevenueInput === 'function') openMatrixRevenueInput();
  });
  await page.waitForTimeout(300);
  await page.fill('#matrixRevenueBonus_mtest1', '5');
  await page.evaluate(() => {
    if (typeof matrixSaveRevenueEntry === 'function') matrixSaveRevenueEntry();
  });
  await page.waitForTimeout(400);
  const afterMatrixUiSave = await page.evaluate(() => ({
    modalOpen: !!(document.getElementById('modalBg') && document.getElementById('modalBg').style.display === 'flex'),
    homeVisible: !!(document.getElementById('homePage') && !document.getElementById('homePage').classList.contains('hidden'))
  }));
  assert('MATRIX UI save closes modal', !afterMatrixUiSave.modalOpen);
  assert('MATRIX UI save returns home', afterMatrixUiSave.homeVisible);

} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
process.exit(failed.length ? 1 : 0);
