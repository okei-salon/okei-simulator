#!/usr/bin/env node
/**
 * Unit tests for destructive hubData push guard (no Firestore writes).
 * Blocks kai2-style account wipe: cloud has account days, payload drops to 0
 * without tombstone / explicit reset.
 */
import { readFileSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = readFileSync(path.join(root, 'assets/js/hub-firebase.js'), 'utf8');

function extractFn(name) {
  const re = new RegExp(
    'function\\s+' + name + '\\s*\\([\\s\\S]*?\\n\\}\\n(?=\\nfunction |\\nvar |\\nif \\(typeof window)'
  );
  const m = src.match(re);
  if (!m) throw new Error('extract failed: ' + name);
  return m[0];
}

const prelude = `
var hubExplicitHubDataResetPending = false;
var hubExplicitHubDataResetReason = '';
var hubExplicitHubDataResetAt = 0;
var hubLocalUpdatedAt = 0;
function hubCloudUpdatedAt(doc) {
  return doc && typeof doc === 'object' ? (Number(doc.updatedAt) || 0) : 0;
}
`;

const api = new Function(
  prelude +
    extractFn('hubCollectHubPayloadAccountStats') +
    extractFn('hubTombstoneAllowsAccountDrop') +
    extractFn('hubGuardDestructiveHubPayloadBeforePush') +
    '\n;return { hubCollectHubPayloadAccountStats, hubTombstoneAllowsAccountDrop, hubGuardDestructiveHubPayloadBeforePush, get pending(){return hubExplicitHubDataResetPending;}, set pending(v){hubExplicitHubDataResetPending=!!v;} };'
)();

let passed = 0;
let failed = 0;
function assert(name, ok, detail) {
  if (ok) {
    passed++;
    console.log('PASS ' + name);
  } else {
    failed++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

const kai2 = 'imp_mr604mrj_0';
const cloudDoc = {
  updatedAt: 1000,
  settings: {},
  revenue: {
    revenueLog: {
      '2026-03-01': {
        ramAccounts: {
          m1: { todayRevenue: 1 },
          [kai2]: { todayRevenue: 2 }
        }
      },
      '2026-03-02': {
        ramAccounts: {
          m1: { todayRevenue: 1 },
          [kai2]: { todayRevenue: 3 }
        }
      }
    },
    salesLog: {
      '2026-03-01': {
        accounts: {
          m1: { projectKey: 'ram', todaySales: 1 },
          [kai2]: { projectKey: 'ram', todaySales: 2 }
        }
      }
    }
  }
};

const wipedPayload = {
  updatedAt: 2000,
  settings: { removedRamOrgAccountIds: [], removedOrcaOrgAccountIds: [] },
  revenue: {
    revenueLog: {
      '2026-03-01': { ramAccounts: { m1: { todayRevenue: 1 } } },
      '2026-03-02': { ramAccounts: { m1: { todayRevenue: 1 } } }
    },
    salesLog: {
      '2026-03-01': {
        accounts: { m1: { projectKey: 'ram', todaySales: 1 } }
      }
    }
  }
};

const blocked = api.hubGuardDestructiveHubPayloadBeforePush(wipedPayload, cloudDoc, 'test-wipe');
assert('kai2 wipe blocked without tombstone', blocked.blocked === true && blocked.writeAllowed === false);
assert('kai2 listed in dropped/reduced ids', blocked.droppedIds.indexOf(kai2) >= 0 || blocked.reducedRevIds.indexOf(kai2) >= 0);

api.pending = true;
const allowed = api.hubGuardDestructiveHubPayloadBeforePush(wipedPayload, cloudDoc, 'test-explicit');
assert('explicit hub reset allows destructive wipe', allowed.writeAllowed === true && allowed.blocked === false);
api.pending = false;

const tombPayload = JSON.parse(JSON.stringify(wipedPayload));
tombPayload.settings.removedRamOrgAccountIds = [kai2];
const tombOk = api.hubGuardDestructiveHubPayloadBeforePush(tombPayload, cloudDoc, 'test-tomb');
assert('RAM tombstone allows kai2 drop', tombOk.writeAllowed === true);

const safePayload = JSON.parse(JSON.stringify(cloudDoc));
safePayload.settings = { removedRamOrgAccountIds: [] };
const safe = api.hubGuardDestructiveHubPayloadBeforePush(safePayload, cloudDoc, 'test-safe');
assert('identical account maps allowed', safe.writeAllowed === true && safe.blocked === false);

const stats = api.hubCollectHubPayloadAccountStats(cloudDoc);
assert('stats sees kai2 revenue days', (stats.revDaysById[kai2] || 0) === 2);
assert('stats sees kai2 sales days', (stats.salesDaysById[kai2] || 0) === 1);

console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed ? 1 : 0);
