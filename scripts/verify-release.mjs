#!/usr/bin/env node
/**
 * OUKEI HUB release gate — run all critical regression suites before deploy.
 *
 * Usage:
 *   npm run verify:release
 *
 * Env:
 *   OUKEI_BASE              default http://127.0.0.1:5050/
 *   OUKEI_SKIP_E2E=1        skip Playwright suites
 *   OUKEI_SKIP_OPTIONAL=1   skip optional fixture-dependent suites
 *   OUKEI_REQUIRE_SERVER=0  do not fail if :5050 is down (skip E2E)
 */
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.OUKEI_BASE || 'http://127.0.0.1:5050/';
const SKIP_E2E = process.env.OUKEI_SKIP_E2E === '1';
const SKIP_OPTIONAL = process.env.OUKEI_SKIP_OPTIONAL === '1';
const REQUIRE_SERVER = process.env.OUKEI_REQUIRE_SERVER !== '0';
const BASELINE_PATH = path.join(root, 'scripts', 'verify-release-baseline.json');

function loadBaselineMinPassed() {
  try {
    if (!existsSync(BASELINE_PATH)) return 253;
    const data = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    const n = Number(data.minPassed);
    return Number.isFinite(n) && n > 0 ? n : 253;
  } catch (e) {
    return 253;
  }
}

/** @typedef {{ id: string, label: string, cmd: string[], cwd?: string, optional?: boolean, needsServer?: boolean, category: string }} Suite */

/** @type {Suite[]} */
const SUITES = [
  // --- Unit / static ---
  {
    id: 'local-dev',
    label: 'LocalStorage / local-dev guards',
    category: 'LocalStorage',
    cmd: ['node', 'scripts/verify-local-dev-mode.mjs']
  },
  {
    id: 'version-guard',
    label: 'Schema / version guard',
    category: 'Firestore',
    cmd: ['node', 'scripts/verify-hub-version-guard.mjs']
  },
  {
    id: 'hub-sync',
    label: 'Firestore merge logic',
    category: 'Firestore',
    cmd: ['node', 'scripts/verify-hub-sync-merge.mjs']
  },
  {
    id: 'hub-destructive-guard',
    label: 'Destructive cloud push guard (kai2 wipe block)',
    category: 'Firestore',
    cmd: ['node', 'scripts/verify-hub-destructive-guard.mjs']
  },
  {
    id: 'data-protection',
    label: 'Data protection / isolation',
    category: 'LocalStorage',
    cmd: ['node', 'scripts/verify-data-protection.mjs']
  },
  {
    id: 'org-visibility',
    label: 'Organization open-flag integrity',
    category: 'Organization integrity',
    cmd: ['node', 'scripts/verify-org-chart-visibility.mjs']
  },
  {
    id: 'delete-modes',
    label: 'Organization delete modes',
    category: 'Organization integrity',
    cmd: ['node', 'scripts/verify-delete-modes.mjs']
  },
  {
    id: 'orca-delete',
    label: 'ORCA full-delete + tombstone',
    category: 'ORCA',
    cmd: ['node', 'scripts/verify-orca-account-full-delete.mjs']
  },
  {
    id: 'eni-performance',
    label: 'ENI performance formulas',
    category: 'Revenue Input',
    cmd: ['node', 'scripts/verify-eni-performance-input.mjs']
  },
  {
    id: 'eni-revenue-ui',
    label: 'ENI revenue account UI wiring',
    category: 'Revenue Input',
    cmd: ['node', 'scripts/verify-eni-revenue-account-ui.mjs']
  },
  {
    id: 'portfolio-calc',
    label: 'Portfolio calculation exact values',
    category: 'Portfolio',
    cmd: ['node', 'scripts/verify-portfolio-calc.mjs']
  },
  {
    id: 'ram-operating',
    label: 'RAM operating calculation',
    category: 'RAM',
    optional: true,
    cmd: ['node', 'scripts/verify-ram-operating.mjs']
  },

  // --- Playwright / localhost ---
  {
    id: 'org-localhost',
    label: 'Organization localhost render',
    category: 'Organization integrity',
    needsServer: true,
    cmd: ['node', 'scripts/verify-org-chart-localhost.mjs']
  },
  {
    id: 'org-simulation',
    label: 'Organization simulation isolation',
    category: 'Organization integrity',
    needsServer: true,
    cmd: ['node', 'scripts/verify-org-simulation.mjs']
  },
  {
    id: 'org-agg-target',
    label: 'Organization aggregation-target accounts',
    category: 'Organization integrity',
    needsServer: true,
    cmd: ['node', 'scripts/verify-org-agg-target.mjs']
  },
  {
    id: 'perf-portfolio-e2e',
    label: 'Performance input → Portfolio E2E',
    category: 'Portfolio',
    needsServer: true,
    cmd: ['node', 'scripts/verify-perf-portfolio-e2e.mjs']
  },
  {
    id: 'release-e2e',
    label: 'Release E2E (screens / org / portfolio / mobile)',
    category: 'Home',
    needsServer: true,
    cmd: ['node', 'scripts/verify-release-e2e.mjs']
  },
  {
    id: 'eni-optin',
    label: 'ENI opt-in visibility',
    category: 'ENI',
    needsServer: true,
    optional: true,
    cmd: ['node', 'scripts/verify-eni-optin.mjs']
  },
  {
    id: 'ram-localonly-restore',
    label: 'RAM localOnly restore (no Firestore writes)',
    category: 'Organization integrity',
    needsServer: true,
    cmd: ['node', 'scripts/verify-ram-localonly-restore.mjs']
  },
  {
    id: 'cloud-write-gate',
    label: 'Cloud write gate suspend/resume/explicit-only',
    category: 'Organization integrity',
    needsServer: true,
    cmd: ['node', 'scripts/verify-cloud-write-gate.mjs']
  }
];

function probeServer(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.get(
        { hostname: u.hostname, port: u.port || 80, path: u.pathname || '/', timeout: 2500 },
        (res) => {
          res.resume();
          resolve(res.statusCode && res.statusCode < 500);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (e) {
      resolve(false);
    }
  });
}

function runSuite(suite) {
  return new Promise((resolve) => {
    const child = spawn(suite.cmd[0], suite.cmd.slice(1), {
      cwd: root,
      env: { ...process.env, OUKEI_BASE: BASE },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      resolve({
        id: suite.id,
        label: suite.label,
        category: suite.category,
        optional: !!suite.optional,
        code: code == null ? 1 : code,
        out,
        err
      });
    });
  });
}

function countPassFail(text) {
  const pass = (text.match(/\bPASS\b/g) || []).length;
  const fail = (text.match(/\bFAIL\b/g) || []).length;
  return { pass, fail };
}

async function main() {
  console.log('\nOUKEI HUB Release Check\n');

  const serverUp = await probeServer(BASE);
  if (!serverUp) {
    console.log(`⚠ localhost not reachable at ${BASE}`);
    if (REQUIRE_SERVER && !SKIP_E2E) {
      console.log('  Start with: npm run dev');
      console.log('  Or set OUKEI_SKIP_E2E=1 / OUKEI_REQUIRE_SERVER=0\n');
    }
  } else {
    console.log(`✓ localhost ready (${BASE})\n`);
  }

  const results = [];
  for (const suite of SUITES) {
    if (suite.optional && SKIP_OPTIONAL) {
      results.push({
        id: suite.id,
        label: suite.label,
        category: suite.category,
        optional: true,
        code: 0,
        skipped: true,
        reason: 'OUKEI_SKIP_OPTIONAL=1',
        out: '',
        err: ''
      });
      continue;
    }
    if (suite.needsServer && (SKIP_E2E || !serverUp)) {
      const block = suite.needsServer && REQUIRE_SERVER && !SKIP_E2E && !serverUp && !suite.optional;
      results.push({
        id: suite.id,
        label: suite.label,
        category: suite.category,
        optional: !!suite.optional,
        code: block ? 1 : 0,
        skipped: !block,
        failedMissingServer: block,
        reason: SKIP_E2E ? 'OUKEI_SKIP_E2E=1' : 'localhost unavailable',
        out: '',
        err: ''
      });
      continue;
    }
    if (suite.id === 'ram-operating') {
      const hub = path.join(root, 'merge-output', 'OUKEI_HUB_KAI2_UNIFIED_v2_20260711.hub');
      if (!existsSync(hub)) {
        results.push({
          id: suite.id,
          label: suite.label,
          category: suite.category,
          optional: true,
          code: 0,
          skipped: true,
          reason: 'fixture hub missing',
          out: '',
          err: ''
        });
        continue;
      }
    }

    process.stdout.write(`… ${suite.label} ... `);
    const res = await runSuite(suite);
    const mark = res.code === 0 ? 'OK' : 'FAIL';
    console.log(mark);
    if (res.code !== 0) {
      const tail = (res.out + '\n' + res.err).trim().split('\n').slice(-12).join('\n');
      if (tail) console.log(tail.replace(/^/gm, '    '));
    }
    results.push(res);
  }

  // Aggregate categories for the requested report shape
  const categoryOrder = [
    'Home',
    'Portfolio',
    'Revenue Input',
    'RAM',
    'ORCA',
    'ENI',
    'Organization integrity',
    'LocalStorage',
    'Firestore',
    'Mobile 375',
    'Mobile 390',
    'Mobile 430'
  ];

  /** @type {Record<string, {ok: boolean, detail: string}>} */
  const cat = {};
  for (const name of categoryOrder) cat[name] = { ok: true, detail: 'no suite' };

  let totalPass = 0;
  let totalFail = 0;
  let blocked = false;

  for (const r of results) {
    const counts = countPassFail(r.out || '');
    totalPass += counts.pass;
    totalFail += counts.fail;
    if (r.skipped) continue;
    if (r.code !== 0) {
      blocked = true;
      if (counts.fail === 0) totalFail += 1;
    }

    // Map suite → report categories
    const fail = r.code !== 0;
    const touch = (name, ok) => {
      if (!cat[name] || cat[name].detail === 'no suite') {
        cat[name] = { ok, detail: r.label };
      } else {
        cat[name] = { ok: cat[name].ok && ok, detail: cat[name].detail + '; ' + r.label };
      }
    };

    if (r.id === 'release-e2e') {
      touch('Home', !fail);
      touch('Portfolio', !fail);
      touch('Mobile 375', !fail);
      touch('Mobile 390', !fail);
      touch('Mobile 430', !fail);
      touch('Organization integrity', !fail);
      touch('LocalStorage', !fail);
      touch('RAM', !fail);
      touch('ORCA', !fail);
      touch('ENI', !fail);
    } else if (r.category === 'Organization integrity') {
      touch('Organization integrity', !fail);
    } else if (r.category === 'LocalStorage') {
      touch('LocalStorage', !fail);
    } else if (r.category === 'Firestore') {
      touch('Firestore', !fail);
    } else if (r.category === 'Revenue Input') {
      touch('Revenue Input', !fail);
      if (r.id === 'perf-portfolio-e2e' || r.id === 'portfolio-calc') touch('Portfolio', !fail);
    } else if (r.category === 'Portfolio') {
      touch('Portfolio', !fail);
      touch('Revenue Input', !fail);
    } else if (r.category === 'ORCA') {
      touch('ORCA', !fail);
    } else if (r.category === 'ENI') {
      touch('ENI', !fail);
    } else if (r.category === 'RAM') {
      touch('RAM', !fail);
    } else if (r.category === 'Home') {
      touch('Home', !fail);
    }
  }

  // If E2E skipped due to missing server and required, mark mobile/home blocked
  if (!serverUp && REQUIRE_SERVER && !SKIP_E2E) {
    for (const name of ['Home', 'Portfolio', 'Mobile 375', 'Mobile 390', 'Mobile 430']) {
      if (cat[name].detail === 'no suite') {
        cat[name] = { ok: false, detail: 'localhost unavailable' };
        blocked = true;
      }
    }
  }

  console.log('\n────────────────────────────');
  console.log('OUKEI HUB Release Check');
  console.log('────────────────────────────');
  for (const name of categoryOrder) {
    const row = cat[name];
    const icon = row.ok ? '✅' : '❌';
    const note = row.detail === 'no suite' ? ' (coverage via related suites / pending)' : '';
    // Treat "no suite" as pass only if not explicitly failed elsewhere — show as ✅ soft
    const show = row.detail === 'no suite' ? '✅' : icon;
    console.log(`${show} ${name}${note}`);
    if (!row.ok) blocked = true;
  }

  console.log('');
  console.log(`Passed: ${totalPass}`);
  console.log(`Failed: ${totalFail}`);

  const minPassed = loadBaselineMinPassed();
  console.log(`Baseline minPassed: ${minPassed}`);
  if (totalPass < minPassed) {
    console.log(`\n⚠ PASS count ${totalPass} is below baseline ${minPassed}`);
    console.log('  Do not remove tests without raising/documenting baseline in scripts/verify-release-baseline.json');
    blocked = true;
    totalFail += 1;
  }
  console.log('');

  const skipped = results.filter((r) => r.skipped);
  if (skipped.length) {
    console.log('Skipped:');
    skipped.forEach((s) => console.log(`  - ${s.label} (${s.reason})`));
    console.log('');
  }

  if (blocked || totalFail > 0) {
    console.log('DEPLOY BLOCKED ❌\n');
    process.exit(1);
  }
  console.log('DEPLOY READY ✅\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  console.log('\nDEPLOY BLOCKED ❌\n');
  process.exit(1);
});
