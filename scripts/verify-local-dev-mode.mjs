/**
 * Static audit: localhost dev safe mode guards.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const checks = [
  ['hub-dev-mode.js exists', () => existsSync(join(root, 'assets/js/hub-dev-mode.js'))],
  ['hub-dev-mode.js has hubIsCloudReadEnabled', () => /function hubIsCloudReadEnabled/.test(read('assets/js/hub-dev-mode.js'))],
  ['hub-dev-mode.js has hubIsCloudWriteEnabled', () => /function hubIsCloudWriteEnabled/.test(read('assets/js/hub-dev-mode.js'))],
  ['hub-firebase.js guards hubFetchCloudDoc', () => /hubFetchCloudDoc[\s\S]*hubIsCloudReadEnabled/.test(read('assets/js/hub-firebase.js'))],
  ['hub-firebase.js guards hubPushCloudDoc', () => /hubPushCloudDoc[\s\S]*hubIsCloudWriteEnabled/.test(read('assets/js/hub-firebase.js'))],
  ['hub-firebase.js guards hubSyncHubData', () => /hubSyncHubData[\s\S]*hubIsCloudReadEnabled/.test(read('assets/js/hub-firebase.js'))],
  ['hub-storage.js guards cloud save', () => /hubIsCloudWriteEnabled/.test(read('assets/js/hub-storage.js'))],
  ['hub-auth.js has local dev entry', () => /hubEnterLocalDevApplication/.test(read('assets/js/hub-auth.js'))],
  ['index.html loads hub-dev-mode.js', () => /hub-dev-mode\.js/.test(read('index.html'))],
  ['index.html has dev banner', () => /hubLocalDevBar/.test(read('index.html')) && /開発モード/.test(read('index.html'))]
];

let failed = 0;
console.log('Local Dev Safe Mode Audit\n');
checks.forEach(function (item) {
  let ok = false;
  try { ok = !!item[1](); } catch (e) { ok = false; }
  console.log((ok ? '✅' : '❌') + ' ' + item[0]);
  if (!ok) failed++;
});

if (failed) {
  console.error('\n' + failed + ' check(s) failed.');
  process.exit(1);
}
console.log('\nAll static checks passed.');
