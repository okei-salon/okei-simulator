#!/usr/bin/env node
/** Static audit: hub schema version guard pieces stay in sync */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const errors = [];
const json = JSON.parse(read('assets/hub-app-version.json'));
const schemaVersion = Number(json.schemaVersion);
const versionJs = read('assets/js/hub-app-version.js');
const guardJs = read('assets/js/hub-version-guard.js');
const firebaseJs = read('assets/js/hub-firebase.js');
const devMode = read('assets/js/hub-dev-mode.js');
const storage = read('assets/js/hub-storage.js');
const rules = read('firestore.rules');
const indexHtml = read('index.html');

function check(name, ok) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) errors.push(name);
}

check('hub-app-version.json has schemaVersion', Number.isFinite(schemaVersion) && schemaVersion > 0);
check('hub-app-version.js embeds same schemaVersion',
  versionJs.includes('HUB_SCHEMA_VERSION = ' + schemaVersion));
check('firestore.rules requires same schemaVersion',
  rules.includes('return ' + schemaVersion + ';') || rules.includes('return ' + schemaVersion));
check('index loads hub-app-version.js', indexHtml.includes('hub-app-version.js'));
check('index loads hub-version-guard.js', indexHtml.includes('hub-version-guard.js'));
check('guard message present', guardJs.includes('最新版へ更新してください') || versionJs.includes('最新版へ更新してください'));
check('dev-mode write gate uses version allow', devMode.includes('hubIsVersionWriteAllowed'));
check('payload includes schemaVersion', storage.includes('schemaVersion:'));
check('payload does not use clientVersion', !storage.includes('clientVersion'));
check('rules gate hubData create/update', rules.includes('hasValidSchemaVersion'));
check('push re-fetches before write', firebaseJs.includes('cloud changed mid-flight'));
check('push rematch helper exists', firebaseJs.includes('hubCloudDocChanged'));

if (errors.length) {
  console.error('\nFailed:', errors.length);
  process.exit(1);
}
console.log('\nAll schema-version-guard checks passed for schemaVersion', schemaVersion);
