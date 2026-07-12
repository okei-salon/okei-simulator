import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const hub = JSON.parse(readFileSync(
  path.join(root, 'merge-output/OUKEI_HUB_KAI2_UNIFIED_v2_20260711.hub'),
  'utf8'
));

const ctx = {
  console,
  members: hub.members || [],
  settings: hub.settings || {},
  todayKey: () => '2026-07-12',
  calcRamOperatingProfit: (inv) => Math.round(inv * 0.01 * 100) / 100,
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; }
  },
  window: {},
  document: undefined
};
ctx.window = ctx;
vm.createContext(ctx);

const pdCode = readFileSync(path.join(root, 'assets/js/performance-data.js'), 'utf8')
  .replace(/\bif \(typeof window !== 'undefined'\)[\s\S]*$/, '');
vm.runInContext(pdCode, ctx);

ctx.ensurePerformanceLogs();

const kai2Id = 'imp_mr604mrj_0';
const op = ctx.pdGetOperatingUsdAsOf(kai2Id, 'ram', '2026-07-12');
const records = ctx.settings.investmentHistory[kai2Id]?.records || [];

let pass = 0;
let fail = 0;
function assert(name, ok, detail) {
  if (ok) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, detail || ''); }
}

assert('kai2 operating is 300 USD', op === 300, String(op));
assert('kai2 has manual record after repair', records.some((r) => r.type === 'manual'), JSON.stringify(records));
assert('kai2 duplicate initials removed', records.filter((r) => r.type === 'initial').length === 0, JSON.stringify(records));

const dailyOp = ctx.pdCalcDailyOperation(kai2Id, 'ram', '2026-07-12');
assert('kai2 daily operation uses 300 base', dailyOp === 3, `${dailyOp}`);

ctx.pdSetManualOperatingAmount(kai2Id, 'ram', '2026-07-12', 280, { skipPersist: true });
ctx.pdAddInvestmentRecord(kai2Id, 'ram', '2026-07-12', 20, 'additional', { skipPersist: true });
const combined = ctx.pdGetOperatingUsdAsOf(kai2Id, 'ram', '2026-07-12');
assert('manual 280 + additional 20 = 300', combined === 300, String(combined));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
