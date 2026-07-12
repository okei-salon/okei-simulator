#!/usr/bin/env node
/** Static audit: localhost safe mode blocks all Firestore paths */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const errors = [];
const checks = [];

const devMode = read('assets/js/hub-dev-mode.js');
const firebase = read('assets/js/hub-firebase.js');
const storage = read('assets/js/hub-storage.js');
const auth = read('assets/js/hub-auth.js');
const firebaseJson = read('firebase.json');
const firebaseIgnore = read('.firebaseignore');

const requiredGuards = [
  ['hub-dev-mode.js', 'hubIsCloudReadEnabled', devMode],
  ['hub-dev-mode.js', 'hubIsCloudWriteEnabled', devMode],
  ['hub-firebase.js', 'hubIsCloudReadEnabled', firebase],
  ['hub-firebase.js', 'hubIsCloudWriteEnabled', firebase],
  ['hub-firebase.js', 'hubIsLocalDevMode', firebase],
  ['hub-storage.js', 'hubIsCloudWriteEnabled', storage],
  ['hub-auth.js', 'hubIsLocalDevMode', auth],
];

requiredGuards.forEach(function (item) {
  const ok = item[2].includes(item[1]);
  checks.push({ name: item[0] + ' has ' + item[1], ok });
  if (!ok) errors.push('Missing guard symbol: ' + item[0] + ' -> ' + item[1]);
});

const blockedFns = [
  'hubFetchCloudDoc',
  'hubPushCloudDoc',
  'hubDeleteCloudData',
  'hubScheduleCloudSave',
  'hubRunCloudSave',
  'hubSyncHubData',
  'hubEnrichLocalFromCloud',
];
blockedFns.forEach(function (fn) {
  const re = new RegExp('function ' + fn + '\\([^)]*\\)\\s*\\{[^}]*hubIsCloud');
  const ok = re.test(firebase) || (fn === 'hubSyncHubData' && firebase.includes('hubIsLocalDevMode'));
  checks.push({ name: fn + ' guarded', ok });
  if (!ok) errors.push(fn + ' may not be guarded for local dev');
});

if (!read('index.html').includes('hub-dev-mode.js')) {
  errors.push('index.html does not load hub-dev-mode.js');
}
if (!read('index.html').includes('hubLocalDevBar')) {
  errors.push('index.html missing hubLocalDevBar');
}

['merge-output', 'merge-input'].forEach(function (dir) {
  const inJson = firebaseJson.includes(dir);
  const inIgnore = firebaseIgnore.includes(dir);
  checks.push({ name: dir + ' excluded from deploy', ok: inJson || inIgnore });
  if (!inJson && !inIgnore) errors.push(dir + ' not excluded from Firebase deploy');
});

console.log('Local Dev Safe Mode Audit\n');
checks.forEach(function (c) {
  console.log((c.ok ? '✅' : '❌') + ' ' + c.name);
});
if (errors.length) {
  console.error('\nFailed:', errors.length);
  errors.forEach(function (e) { console.error(' -', e); });
  process.exit(1);
}
console.log('\nAll static checks passed.');
