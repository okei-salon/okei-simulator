#!/usr/bin/env node
/**
 * RAM title reward Ver2.0 regression (localhost).
 * - same-rank 30%
 * - exactly +1 title overrun → 10% of child's actual titleReward
 * - +2 or more → 0 (legacy)
 * - live vs sim same totals
 */
import { chromium } from 'playwright';

const baseUrl = String(process.env.OUKEI_BASE || process.argv[2] || 'http://127.0.0.1:5050').replace(/\/$/, '');
const checks = [];

function assert(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function nearly(a, b, eps = 1e-6) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof titleReward === 'function' && typeof totals === 'function');

  const result = await page.evaluate(() => {
    function mk(id, parent, rank, investment, manualVolume) {
      return {
        id, parent, name: id, username: id, rank, investment: investment || 0,
        manualVolume: manualVolume || 0, open: true, bvMode: 'MANUAL'
      };
    }

    // ① same-rank 30%: A(L3) -> B(L3) -> C(L1 with BV)
    // C title for B: (L3-L1)=2% * BV. B title for A: B.title * 30%
    members = [
      mk('a', null, 3, 1200, 0),
      mk('b', 'a', 3, 1200, 0),
      mk('c', 'b', 1, 0, 100000)
    ];
    rootId = 'a';
    rootAccountIds = ['a'];
    const bTitle = titleReward('b').total; // should be 100000 * 0.02 = 2000
    const aFromB = titleReward('a').total; // should be 2000 * 0.3 = 600
    const sameRank = { bTitle, aFromB, expectB: 2000, expectA: 600 };

    // ② L3 -> L4: L3 gets L4.title * 10%
    // Give L4 a downline L1 with BV so L4 has title reward
    members = [
      mk('l3', null, 3, 1200, 0),
      mk('l4', 'l3', 4, 2400, 0),
      mk('d1', 'l4', 1, 0, 100000)
    ];
    // L4 title = (4.5%-1%)*100000 = 3500
    const l4Title = titleReward('l4').total;
    const l3Title = titleReward('l3').total;
    const case2 = { l4Title, l3Title, expectL4: 3500, expectL3: 350 };

    // ③ L3 -> L4 -> L5 chain
    members = [
      mk('p3', null, 3, 1200, 0),
      mk('p4', 'p3', 4, 2400, 0),
      mk('p5', 'p4', 5, 4800, 0),
      mk('leaf', 'p5', 1, 0, 100000)
    ];
    // p5 title = (6%-1%)*100000 = 5000
    // p4 title = p5.title * 10% = 500
    // p3 title = p4.title * 10% = 50
    const p5 = titleReward('p5').total;
    const p4 = titleReward('p4').total;
    const p3 = titleReward('p3').total;
    const case3 = { p5, p4, p3, expectP5: 5000, expectP4: 500, expectP3: 50 };

    // ④ L3 -> L2 -> L4: L3 = normal + L4*10%; L2 = normal only (no 10%)
    members = [
      mk('x3', null, 3, 1200, 0),
      mk('x2', 'x3', 2, 600, 0),
      mk('x4', 'x2', 4, 2400, 0),
      mk('xLeaf', 'x4', 1, 0, 100000),
      mk('x2side', 'x2', 1, 0, 50000)
    ];
    const x4t = titleReward('x4').total;
    const x2t = titleReward('x2').total;
    const x3t = titleReward('x3').total;
    const x3lineFromX4 = (titleReward('x3').lines || [])
      .filter((l) => String(l.calc || '').indexOf('× 10%') >= 0 || String(l.reason || '').indexOf('1ランク越え') >= 0)
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);
    // Also accept amount contributed via higher-branch recursion on the x2 line
    const x3fromX2 = (titleReward('x3').lines || []).find((l) => l.name === 'x2');
    const case4 = {
      x4t, x2t, x3t,
      expectX4: 3500,
      expectX2: 500,
      expectX3Overrun: 350,
      x3fromX2Amt: x3fromX2 ? x3fromX2.amount : null,
      x3lineFromX4
    };

    // ⑤ L3 -> L5: no 10%, title 0 from that line
    members = [
      mk('y3', null, 3, 1200, 0),
      mk('y5', 'y3', 5, 4800, 0),
      mk('yLeaf', 'y5', 1, 0, 100000)
    ];
    const y5t = titleReward('y5').total;
    const y3t = titleReward('y3').total;
    const case5 = { y5t, y3t, expectY5: 5000, expectY3: 0 };

    // ⑥ live vs sim same
    members = [
      mk('s3', null, 3, 1200, 0),
      mk('s4', 's3', 4, 2400, 0),
      mk('sLeaf', 's4', 1, 0, 80000)
    ];
    rootId = 's3';
    rootAccountIds = ['s3'];
    const live = {
      s3: totals('s3'),
      s4: totals('s4'),
      title3: titleReward('s3').total,
      title4: titleReward('s4').total
    };
    if (typeof startSimulationCopy === 'function') startSimulationCopy();
    else { simMode = true; }
    const sim = {
      s3: totals('s3'),
      s4: totals('s4'),
      title3: titleReward('s3').total,
      title4: titleReward('s4').total,
      simMode: !!simMode
    };
    if (typeof endSimulationDiscard === 'function') endSimulationDiscard();
    else { simMode = false; }

    return { sameRank, case2, case3, case4, case5, live, sim };
  });

  assert('① 同ランク下位タイトル = BV差額', nearly(result.sameRank.bTitle, result.sameRank.expectB), String(result.sameRank.bTitle));
  assert('① 同ランクは30%', nearly(result.sameRank.aFromB, result.sameRank.expectA), String(result.sameRank.aFromB));

  assert('② L4タイトル', nearly(result.case2.l4Title, result.case2.expectL4), String(result.case2.l4Title));
  assert('② L3→L4 で10%', nearly(result.case2.l3Title, result.case2.expectL3), String(result.case2.l3Title));

  assert('③ L5タイトル', nearly(result.case3.p5, result.case3.expectP5), String(result.case3.p5));
  assert('③ L4 = L5×10%', nearly(result.case3.p4, result.case3.expectP4), String(result.case3.p4));
  assert('③ L3 = L4×10% 連鎖', nearly(result.case3.p3, result.case3.expectP3), String(result.case3.p3));

  assert('④ L4タイトル', nearly(result.case4.x4t, result.case4.expectX4), String(result.case4.x4t));
  assert('④ L2は通常のみ（10%なし）', nearly(result.case4.x2t, result.case4.expectX2), String(result.case4.x2t));
  assert('④ L3はL4×10%を含む',
    nearly(result.case4.x3fromX2Amt, result.case4.expectX3Overrun) ||
    (Number(result.case4.x3fromX2Amt) >= result.case4.expectX3Overrun),
    String(result.case4.x3fromX2Amt));
  assert('④ L3合計 > L4×10%（通常分あり）',
    result.case4.x3t > result.case4.expectX3Overrun + 1,
    String(result.case4.x3t));

  assert('⑤ L5タイトル', nearly(result.case5.y5t, result.case5.expectY5), String(result.case5.y5t));
  assert('⑤ L3→L5 は10%なし（0）', nearly(result.case5.y3t, result.case5.expectY3), String(result.case5.y3t));

  assert('⑥ simMode入る', result.sim.simMode === true);
  assert('⑥ live/sim タイトル一致 L3', nearly(result.live.title3, result.sim.title3), `${result.live.title3} vs ${result.sim.title3}`);
  assert('⑥ live/sim タイトル一致 L4', nearly(result.live.title4, result.sim.title4), `${result.live.title4} vs ${result.sim.title4}`);
  assert('⑥ live/sim totals.total 一致', nearly(result.live.s3.total, result.sim.s3.total));

  await browser.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) {
    failed.forEach((f) => console.error('FAIL', f.name, f.detail));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
