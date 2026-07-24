#!/usr/bin/env node
/**
 * Deploy gate: require verify:release success before any firebase deploy.
 *
 * Usage:
 *   node scripts/deploy-with-verify.mjs --only hosting
 *   node scripts/deploy-with-verify.mjs              # full firebase deploy
 *
 * Env:
 *   OUKEI_SKIP_VERIFY=1   emergency bypass (prints warning; still blocked unless
 *                         OUKEI_ALLOW_UNVERIFIED_DEPLOY=1 is also set)
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const firebaseArgs = process.argv.slice(2);
const skipVerify = process.env.OUKEI_SKIP_VERIFY === '1';
const allowUnverified = process.env.OUKEI_ALLOW_UNVERIFIED_DEPLOY === '1';

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('close', (code) => resolve(code == null ? 1 : code));
  });
}

async function main() {
  console.log('\n══ OUKEI HUB Deploy Gate ══\n');

  if (skipVerify) {
    if (!allowUnverified) {
      console.error('DEPLOY BLOCKED ❌');
      console.error('OUKEI_SKIP_VERIFY=1 requires OUKEI_ALLOW_UNVERIFIED_DEPLOY=1 (emergency only).');
      console.error('Normal path: ensure `npm run dev` is up, then use npm run deploy:hosting\n');
      process.exit(1);
    }
    console.warn('⚠ UNVERIFIED DEPLOY — verify:release was skipped by explicit override.\n');
  } else {
    console.log('1) Running npm run verify:release ...\n');
    const verifyCode = await run('npm', ['run', 'verify:release']);
    if (verifyCode !== 0) {
      console.error('\nDEPLOY BLOCKED ❌ — verify:release failed. Firebase Deploy was not started.\n');
      process.exit(1);
    }
    console.log('2) verify:release passed — starting Firebase Deploy ...\n');
  }

  let code = await run('npx', ['--yes', 'firebase', 'deploy', ...firebaseArgs]);
  if (code !== 0) {
    console.error('\nDEPLOY BLOCKED ❌ — firebase deploy exited with', code, '\n');
    process.exit(code);
  }
  console.log('\nDeploy finished.\n');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  console.error('\nDEPLOY BLOCKED ❌\n');
  process.exit(1);
});
