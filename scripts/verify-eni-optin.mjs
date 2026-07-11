#!/usr/bin/env node
/**
 * Verify ENI opt-in: hidden until Settings → Project Add → ENI, then visible everywhere.
 * Usage: node scripts/verify-eni-optin.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:5050';
const checks = [];

function assert(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

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
    eniRegistered: !!(typeof pmGetProject === 'function' && pmGetProject('eni') && pmGetProject('eni').registered),
    homeProjects: typeof getEnabledHomeProjects === 'function' ? getEnabledHomeProjects().map((p) => p.key) : [],
    pfProjects: typeof pfGetAllPortfolioProjects === 'function' ? pfGetAllPortfolioProjects().map((p) => p.key) : [],
    revenueProjects: typeof getRevenueInputProjects === 'function' ? getRevenueInputProjects().map((p) => p.key) : [],
    rmProjects: typeof rmGetActiveProjects === 'function' ? rmGetActiveProjects().map((p) => p.key) : [],
    smProjects: typeof smGetActiveProjects === 'function' ? smGetActiveProjects().map((p) => p.key) : [],
    orgProjects: typeof orgGetSelectableProjects === 'function' ? orgGetSelectableProjects().map((p) => p.key) : [],
    eniValid: typeof PM_VALID_CODES !== 'undefined' && PM_VALID_CODES.ENI === 'eni',
    eniBuiltin: typeof PM_BUILTIN !== 'undefined' && !!PM_BUILTIN.eni,
    ramCount: typeof members !== 'undefined' ? members.length : -1
  }));

  assert('ENI in PM_VALID_CODES', before.eniValid);
  assert('ENI not in PM_BUILTIN', !before.eniBuiltin);
  assert('ENI not registered initially', !before.eniRegistered);
  assert('ENI hidden on home', before.homeProjects.indexOf('eni') < 0, before.homeProjects.join(','));
  assert('ENI hidden on portfolio', before.pfProjects.indexOf('eni') < 0, before.pfProjects.join(','));
  assert('ENI hidden on revenue input', before.revenueProjects.indexOf('eni') < 0, before.revenueProjects.join(','));
  assert('ENI hidden on revenue manage', before.rmProjects.indexOf('eni') < 0, before.rmProjects.join(','));
  assert('ENI hidden on sales manage', before.smProjects.indexOf('eni') < 0, before.smProjects.join(','));
  assert('ENI hidden on org select', before.orgProjects.indexOf('eni') < 0, before.orgProjects.join(','));

  const addResult = await page.evaluate(() => {
    if (!pmDraftState && typeof pmInitDraftDefaults === 'function') pmInitDraftDefaults();
    let result = pmValidateProjectCode('ENI');
    if (!result.ok) return result;
    let meta = PM_CODE_META[result.key] || { name: result.key, startDate: '—' };
    pmDraftState.projects[result.key] = {
      key: result.key,
      name: meta.name,
      startDate: meta.startDate,
      inclusionRate: typeof pmDefaultInclusionRate === 'function' ? pmDefaultInclusionRate(result.key) : 100,
      visible: true,
      registered: true,
      iconKey: result.key
    };
    if (pmDraftState.order.indexOf(result.key) === -1) pmDraftState.order.push(result.key);
    pmCommitProjectMaster(pmReadDraftState());
    if (typeof render === 'function') render();
    if (typeof renderOrgProjectSelect === 'function') renderOrgProjectSelect();
    return { ok: true, key: result.key };
  });

  assert('ENI add via code succeeds', addResult.ok === true);

  await page.waitForTimeout(500);

  const after = await page.evaluate(() => ({
    eniRegistered: !!(pmGetProject('eni') && pmGetProject('eni').registered),
    homeProjects: getEnabledHomeProjects().map((p) => p.key),
    pfProjects: pfGetAllPortfolioProjects().map((p) => p.key),
    revenueProjects: getRevenueInputProjects().map((p) => p.key),
    rmProjects: rmGetActiveProjects().map((p) => p.key),
    smProjects: smGetActiveProjects().map((p) => p.key),
    orgProjects: orgGetSelectableProjects().map((p) => p.key),
    eniOrgEmpty: typeof eniPackOrgChart === 'function' ? (eniPackOrgChart().members || []).length : -1,
    eniInputAccounts: Array.isArray(settings.eniInputAccounts) ? settings.eniInputAccounts.length : -1,
    ramCount: members.length
  }));

  assert('ENI registered after add', after.eniRegistered);
  assert('ENI visible on home', after.homeProjects.indexOf('eni') >= 0, after.homeProjects.join(','));
  assert('ENI visible on portfolio', after.pfProjects.indexOf('eni') >= 0, after.pfProjects.join(','));
  assert('ENI visible on revenue input', after.revenueProjects.indexOf('eni') >= 0, after.revenueProjects.join(','));
  assert('ENI visible on revenue manage', after.rmProjects.indexOf('eni') >= 0, after.rmProjects.join(','));
  assert('ENI visible on sales manage', after.smProjects.indexOf('eni') >= 0, after.smProjects.join(','));
  assert('ENI visible on org select', after.orgProjects.indexOf('eni') >= 0, after.orgProjects.join(','));
  assert('ENI org chart empty', after.eniOrgEmpty === 0, String(after.eniOrgEmpty));
  assert('ENI input accounts empty', after.eniInputAccounts === 0, String(after.eniInputAccounts));
  assert('RAM member count unchanged', after.ramCount === before.ramCount, `${before.ramCount} -> ${after.ramCount}`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.body.classList.add('hub-auth-ready');
    if (typeof hubInitStorage === 'function') hubInitStorage();
    if (typeof pmEnsureProjectMaster === 'function') pmEnsureProjectMaster();
  });
  await page.waitForTimeout(500);

  const persisted = await page.evaluate(() => ({
    eniRegistered: !!(pmGetProject('eni') && pmGetProject('eni').registered),
    homeHasEni: getEnabledHomeProjects().some((p) => p.key === 'eni')
  }));
  assert('ENI persists after reload', persisted.eniRegistered && persisted.homeHasEni);

  const orgDev = await page.evaluate(() => {
    if (typeof showPage === 'function') showPage('eniOrg');
    return {
      hasComingSoon: !!document.querySelector('.eniComingSoonGlass'),
      text: document.querySelector('.eniComingSoonText')?.textContent || ''
    };
  });
  assert('ENI org shows development screen', orgDev.hasComingSoon && orgDev.text.indexOf('開発中') >= 0, orgDev.text);

  await page.evaluate(() => {
    if (typeof openEniAddAccountForm === 'function') openEniAddAccountForm();
  });
  await page.evaluate(() => {
    document.getElementById('eniNewUsername').value = 'testeni';
    document.getElementById('eniNewInvestment').value = '1000';
    document.getElementById('eniNewTodayRevenue').value = '50';
    window.confirm = function () { return true; };
    registerEniAccount();
  });
  await page.waitForTimeout(400);
  const afterAccount = await page.evaluate(() => ({
    count: typeof getEniInputAccounts === 'function' ? getEniInputAccounts().length : 0
  }));
  assert('ENI account add from revenue input', afterAccount.count >= 1, String(afterAccount.count));

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) {
    process.exitCode = 1;
  }
} catch (err) {
  console.error('VERIFY ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
