#!/usr/bin/env node
/**
 * Aggregation-target accounts (集計対象アカウント) regression — RAM / ORCA / ENI.
 * Ensures aggTarget only affects「全アカウント合計」summation, never parents/rewards,
 * and simulation changes never write back to live / Firestore pack.
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

async function seed(page) {
  await page.evaluate(() => {
    document.body.classList.add('hub-auth-ready');
    localStorage.clear();
    const empty = typeof hubCreateEmptyData === 'function' ? hubCreateEmptyData() : { members: [], settings: {} };
    if (typeof hubApplyData === 'function') hubApplyData(empty, { clearSim: true });
    if (typeof pmInitDraftDefaults === 'function') pmInitDraftDefaults();
    if (pmDraftState) {
      const meta = (typeof PM_CODE_META !== 'undefined' && PM_CODE_META.eni) || { name: 'ENI', startDate: '—' };
      pmDraftState.projects.eni = {
        key: 'eni', name: meta.name, startDate: meta.startDate,
        inclusionRate: 100, visible: true, registered: true, iconKey: 'eni'
      };
      if (pmDraftState.order.indexOf('eni') === -1) pmDraftState.order.push('eni');
      if (typeof pmCommitProjectMaster === 'function') pmCommitProjectMaster(pmReadDraftState());
    }

    members = [
      { id: 'ram_a', parent: null, name: '甲斐', username: 'kai', rank: 1, investment: 10000, manualVolume: 0, open: true },
      { id: 'ram_b', parent: 'ram_a', name: '甲斐2', username: 'kai2', rank: 0, investment: 3000, manualVolume: 0, open: true },
      { id: 'ram_c', parent: null, name: '東條', username: 'tojo', rank: 0, investment: 5000, manualVolume: 0, open: true }
    ];
    currentData = JSON.parse(JSON.stringify(members));
    rootId = 'ram_a';
    rootAccountIds = ['ram_a', 'ram_c'];
    focusId = 'ram_a';
    simMode = false;
    scenarios = [];
    window.__ramSimLiveSnapshot = null;

    orcaMembers = [
      { id: 'orca_a', parent: null, name: '甲斐', username: 'kai', rank: 1, investment: 1000, aiAgent: 'Eden', personalSales: 100, groupSales: 0, open: true },
      { id: 'orca_b', parent: 'orca_a', name: '甲斐2', username: 'kai2', rank: 0, investment: 400, aiAgent: 'Eden', personalSales: 40, groupSales: 0, open: true },
      { id: 'orca_c', parent: null, name: '東條', username: 'tojo', rank: 0, investment: 800, aiAgent: 'Eden', personalSales: 80, groupSales: 0, open: true }
    ];
    orcaCurrentData = JSON.parse(JSON.stringify(orcaMembers));
    orcaRootId = 'orca_a';
    orcaRootAccountIds = ['orca_a', 'orca_c'];
    orcaFocusId = 'orca_a';
    orcaSimMode = false;
    orcaScenarios = [];
    window.__orcaSimLiveSnapshot = null;

    eniMembers = [
      { id: 'eni_a', parent: null, name: '甲斐', username: 'kai', walletAddress: 'kai', investment: 1000, open: true },
      { id: 'eni_b', parent: 'eni_a', name: '甲斐2', username: 'kai2', walletAddress: 'kai2', investment: 400, open: true },
      { id: 'eni_c', parent: null, name: '東條', username: 'tojo', walletAddress: 'tojo', investment: 800, open: true }
    ];
    eniCurrentData = JSON.parse(JSON.stringify(eniMembers));
    eniRootId = 'eni_a';
    eniRootAccountIds = ['eni_a', 'eni_c'];
    eniFocusId = 'eni_a';
    eniSimMode = false;
    eniScenarios = [];
    window.__eniSimLiveSnapshot = null;

    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
    if (typeof render === 'function') render();
  });
}

function idsFor(project) {
  if (project === 'ram') return { a: 'ram_a', b: 'ram_b', c: 'ram_c' };
  if (project === 'orca') return { a: 'orca_a', b: 'orca_b', c: 'orca_c' };
  return { a: 'eni_a', b: 'eni_b', c: 'eni_c' };
}

async function runProject(page, project) {
  const label = project.toUpperCase();
  const ids = idsFor(project);

  const baseline = await page.evaluate((project) => {
    const parents = {};
    const rewards = {};
    if (project === 'ram') {
      members.forEach((m) => { parents[m.id] = m.parent; rewards[m.id] = totals(m.id); });
      return { parents, rewards, memberCount: members.length };
    }
    if (project === 'orca') {
      orcaMembers.forEach((m) => { parents[m.id] = m.parent; rewards[m.id] = orcaCalcTotals(m.id); });
      return { parents, rewards, memberCount: orcaMembers.length };
    }
    eniMembers.forEach((m) => { parents[m.id] = m.parent; rewards[m.id] = eniGetDisplaySummary(m.id); });
    return { parents, rewards, memberCount: eniMembers.length };
  }, project);

  // ③ zero targets → aggregate 0
  const zero = await page.evaluate((project) => {
    const list = project === 'ram' ? members : project === 'orca' ? orcaMembers : eniMembers;
    list.forEach((m) => { delete m.aggTarget; delete m.ownerId; delete m.ownerName; });
    if (project === 'ram') return aggregateTotals();
    if (project === 'orca') return orcaAggregateTotals();
    return eniAggregateTotals();
  }, project);
  assert(`${label} 集計対象0件 → 合計0`, nearly(zero.total, 0), String(zero.total));

  // ① one target
  const one = await page.evaluate((args) => {
    const { project, id } = args;
    const list = project === 'ram' ? members : project === 'orca' ? orcaMembers : eniMembers;
    list.forEach((m) => { delete m.aggTarget; });
    const m = list.find((x) => x.id === id);
    m.aggTarget = true;
    const per = project === 'ram' ? totals(id) : project === 'orca' ? orcaCalcTotals(id) : eniGetDisplaySummary(id);
    const agg = project === 'ram' ? aggregateTotals() : project === 'orca' ? orcaAggregateTotals() : eniAggregateTotals();
    return { perTotal: per.total, aggTotal: agg.total, ids: orgAggTargetIds(project) };
  }, { project, id: ids.a });
  assert(`${label} 集計対象1件`, one.ids.length === 1 && nearly(one.aggTotal, one.perTotal),
    `${one.ids.join(',')} agg=${one.aggTotal} per=${one.perTotal}`);

  // ② multiple targets
  const multi = await page.evaluate((args) => {
    const { project, a, b, c } = args;
    const list = project === 'ram' ? members : project === 'orca' ? orcaMembers : eniMembers;
    list.forEach((m) => { delete m.aggTarget; });
    list.find((x) => x.id === a).aggTarget = true;
    list.find((x) => x.id === b).aggTarget = true;
    // c stays off
    const ta = project === 'ram' ? totals(a) : project === 'orca' ? orcaCalcTotals(a) : eniGetDisplaySummary(a);
    const tb = project === 'ram' ? totals(b) : project === 'orca' ? orcaCalcTotals(b) : eniGetDisplaySummary(b);
    const tc = project === 'ram' ? totals(c) : project === 'orca' ? orcaCalcTotals(c) : eniGetDisplaySummary(c);
    const agg = project === 'ram' ? aggregateTotals() : project === 'orca' ? orcaAggregateTotals() : eniAggregateTotals();
    return {
      ids: orgAggTargetIds(project),
      aggTotal: agg.total,
      expect: (ta.total || 0) + (tb.total || 0),
      cTotal: tc.total || 0
    };
  }, { project, a: ids.a, b: ids.b, c: ids.c });
  assert(`${label} 集計対象複数件 = a+b`,
    multi.ids.length === 2 && nearly(multi.aggTotal, multi.expect) && multi.aggTotal + 1e-6 < multi.expect + multi.cTotal,
    `agg=${multi.aggTotal} expect=${multi.expect} c=${multi.cTotal}`);
  assert(`${label} 全アカウント合計が選択対象だけの合算`, nearly(multi.aggTotal, multi.expect));

  // ⑤ manage modal change
  const fromManage = await page.evaluate((args) => {
    const { project, a, b, c } = args;
    if (project === 'ram') { showPage('accountManage'); renderAccountManage(); }
    else if (project === 'orca') { showPage('orcaAccountManage'); orcaRenderAccountManage(); }
    else { showPage('eniAccountManage'); eniRenderAccountManage(); }
    const html = (document.getElementById(project === 'ram' ? 'accountManageContent' : (project === 'orca' ? 'orcaAccountManageContent' : 'eniAccountManageContent')) || {}).innerHTML || '';
    orgAggOpenEditModal(project);
    document.querySelectorAll('.orgAggAssignCb').forEach((cb) => {
      cb.checked = (cb.value === a || cb.value === c);
    });
    orgAggSaveAssign(project);
    const rows = Array.from(document.querySelectorAll('.orgAggCheckRow')).map((row) => ({
      text: (row.querySelector('.orgAggCheckName') || {}).textContent || '',
      cbWidth: (() => {
        const cb = row.querySelector('input.orgAggAssignCb');
        return cb ? parseFloat(getComputedStyle(cb).width) : -1;
      })()
    }));
    // reopen modal to inspect persisted checks (after save modal closed — reopen)
    orgAggOpenEditModal(project);
    const checked = Array.from(document.querySelectorAll('.orgAggAssignCb:checked')).map((cb) => cb.value).sort();
    const labelsOk = Array.from(document.querySelectorAll('.orgAggCheckName')).every((el) => el.textContent);
    const agg = project === 'ram' ? aggregateTotals() : project === 'orca' ? orcaAggregateTotals() : eniAggregateTotals();
    const ta = project === 'ram' ? totals(a) : project === 'orca' ? orcaCalcTotals(a) : eniGetDisplaySummary(a);
    const tc = project === 'ram' ? totals(c) : project === 'orca' ? orcaCalcTotals(c) : eniGetDisplaySummary(c);
    if (typeof closeModal === 'function') closeModal();
    return {
      hasBtn: html.indexOf('集計対象アカウントを追加・編集') >= 0,
      checked,
      labelsOk,
      aggTotal: agg.total,
      expect: (ta.total || 0) + (tc.total || 0),
      rowSample: rows.slice(0, 2)
    };
  }, { project, a: ids.a, b: ids.b, c: ids.c });
  assert(`${label} 集計画面に編集ボタン`, fromManage.hasBtn);
  assert(`${label} 集計画面から変更・再オープン保持`,
    fromManage.checked.join(',') === [ids.a, ids.c].sort().join(',') && nearly(fromManage.aggTotal, fromManage.expect),
    fromManage.checked.join(','));
  assert(`${label} モーダルにアカウント名表示`, fromManage.labelsOk, JSON.stringify(fromManage.rowSample));

  // ④ ON→OFF via manage (turn all off)
  const off = await page.evaluate((project) => {
    orgAggOpenEditModal(project);
    document.querySelectorAll('.orgAggAssignCb').forEach((cb) => { cb.checked = false; });
    orgAggSaveAssign(project);
    const agg = project === 'ram' ? aggregateTotals() : project === 'orca' ? orcaAggregateTotals() : eniAggregateTotals();
    return { total: agg.total, ids: orgAggTargetIds(project) };
  }, project);
  assert(`${label} 集計対象ON→OFF`, off.ids.length === 0 && nearly(off.total, 0), String(off.total));

  // ⑥ member edit toggle sync
  const fromEdit = await page.evaluate((args) => {
    const { project, a, b } = args;
    const list = project === 'ram' ? members : project === 'orca' ? orcaMembers : eniMembers;
    list.forEach((m) => { delete m.aggTarget; });
    if (project === 'ram') {
      openEdit(members.find((m) => m.id === a));
      const cb = document.getElementById('aggTargetInput');
      cb.checked = true;
      saveMember();
      openEdit(members.find((m) => m.id === b));
      document.getElementById('aggTargetInput').checked = true;
      saveMember();
    } else if (project === 'orca') {
      orcaOpenEdit(orcaMembers.find((m) => m.id === a));
      document.getElementById('orcaAggTargetInput').checked = true;
      orcaSaveMember();
      orcaOpenEdit(orcaMembers.find((m) => m.id === b));
      document.getElementById('orcaAggTargetInput').checked = true;
      orcaSaveMember();
    } else {
      eniOpenEdit(Object.assign({}, eniMembers.find((m) => m.id === a), { forceManual: true }));
      document.getElementById('eniAggTargetInput').checked = true;
      eniSaveMember();
      eniOpenEdit(Object.assign({}, eniMembers.find((m) => m.id === b), { forceManual: true }));
      document.getElementById('eniAggTargetInput').checked = true;
      eniSaveMember();
    }
    // reopen edit: checkbox matches
    let editChecked = false;
    if (project === 'ram') {
      openEdit(members.find((m) => m.id === a));
      editChecked = !!(document.getElementById('aggTargetInput') || {}).checked;
    } else if (project === 'orca') {
      orcaOpenEdit(orcaMembers.find((m) => m.id === a));
      editChecked = !!(document.getElementById('orcaAggTargetInput') || {}).checked;
    } else {
      eniOpenEdit(Object.assign({}, eniMembers.find((m) => m.id === a), { forceManual: true }));
      editChecked = !!(document.getElementById('eniAggTargetInput') || {}).checked;
    }
    if (typeof closeModal === 'function') closeModal();
    orgAggOpenEditModal(project);
    const checked = Array.from(document.querySelectorAll('.orgAggAssignCb:checked')).map((cb) => cb.value).sort();
    if (typeof closeModal === 'function') closeModal();
    const ta = project === 'ram' ? totals(a) : project === 'orca' ? orcaCalcTotals(a) : eniGetDisplaySummary(a);
    const tb = project === 'ram' ? totals(b) : project === 'orca' ? orcaCalcTotals(b) : eniGetDisplaySummary(b);
    const agg = project === 'ram' ? aggregateTotals() : project === 'orca' ? orcaAggregateTotals() : eniAggregateTotals();
    return {
      editChecked,
      checked,
      aggTotal: agg.total,
      expect: (ta.total || 0) + (tb.total || 0)
    };
  }, { project, a: ids.a, b: ids.b });
  assert(`${label} メンバー編集から変更`, fromEdit.editChecked && fromEdit.checked.join(',') === [ids.a, ids.b].sort().join(','),
    fromEdit.checked.join(','));
  assert(`${label} 編集と集計画面の同期`, nearly(fromEdit.aggTotal, fromEdit.expect));

  // ⑬⑭ parents + per-account rewards unchanged
  const after = await page.evaluate((project) => {
    const parents = {};
    const rewards = {};
    if (project === 'ram') {
      members.forEach((m) => { parents[m.id] = m.parent; rewards[m.id] = totals(m.id); });
      return { parents, rewards, memberCount: members.length };
    }
    if (project === 'orca') {
      orcaMembers.forEach((m) => { parents[m.id] = m.parent; rewards[m.id] = orcaCalcTotals(m.id); });
      return { parents, rewards, memberCount: orcaMembers.length };
    }
    eniMembers.forEach((m) => { parents[m.id] = m.parent; rewards[m.id] = eniGetDisplaySummary(m.id); });
    return { parents, rewards, memberCount: eniMembers.length };
  }, project);
  assert(`${label} 親子関係が変化しない`,
    JSON.stringify(baseline.parents) === JSON.stringify(after.parents));
  assert(`${label} 各アカウント単体報酬が変更されない`,
    Object.keys(baseline.rewards).every((id) => nearly(baseline.rewards[id].total, after.rewards[id].total)));
  assert(`${label} 既存データが消えない`, after.memberCount === baseline.memberCount && after.memberCount === 3);
}

async function runSimIsolation(page) {
  // Live: a+b targeted
  await page.evaluate(() => {
    members.forEach((m) => { delete m.aggTarget; });
    members.find((m) => m.id === 'ram_a').aggTarget = true;
    members.find((m) => m.id === 'ram_b').aggTarget = true;
    currentData = JSON.parse(JSON.stringify(members));
    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
  });
  const liveBefore = await page.evaluate(() => ({
    ids: orgAggTargetIds('ram').slice().sort(),
    packed: JSON.stringify(typeof hubPackLocalData === 'function' ? hubPackLocalData() : {}),
    firestore: JSON.stringify(typeof hubPackFirestorePayload === 'function' ? hubPackFirestorePayload() : {})
  }));

  // Start sim copy and change targets to c only
  const sim = await page.evaluate(() => {
    if (typeof startSimulationCopy === 'function') startSimulationCopy();
    else startSimulation();
    members.forEach((m) => { delete m.aggTarget; });
    members.find((m) => m.id === 'ram_c').aggTarget = true;
    const simIds = orgAggTargetIds('ram').slice().sort();
    const packedDuring = JSON.stringify(typeof hubPackLocalData === 'function' ? hubPackLocalData() : {});
    const firestoreDuring = JSON.stringify(typeof hubPackFirestorePayload === 'function' ? hubPackFirestorePayload() : {});
    // discard
    if (typeof endSimulationDiscard === 'function') endSimulationDiscard();
    const liveAfter = orgAggTargetIds('ram').slice().sort();
    const liveFlags = members.map((m) => ({ id: m.id, agg: !!m.aggTarget }));
    return { simIds, packedDuring, firestoreDuring, liveAfter, liveFlags, simMode };
  });

  assert('シミュレーション内で集計対象変更可能', sim.simIds.join(',') === 'ram_c', sim.simIds.join(','));
  assert('シミュレーション変更が本番へ反映されない',
    sim.liveAfter.join(',') === liveBefore.ids.join(',') &&
    sim.liveFlags.find((x) => x.id === 'ram_c').agg === false &&
    sim.liveFlags.find((x) => x.id === 'ram_a').agg === true,
    sim.liveAfter.join(','));
  const packDuringIds = (JSON.parse(sim.packedDuring).members || [])
    .filter((m) => m && m.aggTarget === true).map((m) => m.id).sort().join(',');
  const fsDuringIds = (((JSON.parse(sim.firestoreDuring) || {}).orgChart || {}).members || [])
    .filter((m) => m && m.aggTarget === true).map((m) => m.id).sort().join(',');
  assert('Sim中 pack は本番スナップショットの集計対象のみ',
    packDuringIds === 'ram_a,ram_b' && fsDuringIds === 'ram_a,ram_b',
    `pack=${packDuringIds} fs=${fsDuringIds}`);
  const packedAfter = await page.evaluate(() => {
    const pack = typeof hubPackLocalData === 'function' ? hubPackLocalData() : {};
    const fs = typeof hubPackFirestorePayload === 'function' ? hubPackFirestorePayload() : {};
    const liveIds = (pack.members || []).filter((m) => m.aggTarget === true).map((m) => m.id).sort();
    const fsIds = ((fs.orgChart && fs.orgChart.members) || []).filter((m) => m && m.aggTarget === true).map((m) => m.id).sort();
    return { liveIds, fsIds, simMode };
  });
  assert('Firestoreへの意図しない書き込みがない（本番集計対象のみ）',
    packedAfter.liveIds.join(',') === 'ram_a,ram_b' &&
    packedAfter.fsIds.join(',') === 'ram_a,ram_b' &&
    packedAfter.simMode === false,
    packedAfter.liveIds.join(','));

  // ORCA/ENI sim smoke: change in sim does not alter live snapshot restore
  for (const project of ['orca', 'eni']) {
    const r = await page.evaluate((project) => {
      const start = project === 'orca'
        ? (typeof orcaStartSimulationCopy === 'function' ? orcaStartSimulationCopy : orcaStartSimulation)
        : (typeof eniStartSimulationCopy === 'function' ? eniStartSimulationCopy : eniStartSimulation);
      const end = project === 'orca'
        ? (typeof orcaEndSimulationDiscard === 'function' ? orcaEndSimulationDiscard : null)
        : (typeof eniEndSimulationDiscard === 'function' ? eniEndSimulationDiscard : null);
      const listLive = () => (project === 'orca' ? orcaMembers : eniMembers);
      const idA = project === 'orca' ? 'orca_a' : 'eni_a';
      const idC = project === 'orca' ? 'orca_c' : 'eni_c';
      listLive().forEach((m) => { delete m.aggTarget; });
      listLive().find((m) => m.id === idA).aggTarget = true;
      if (project === 'orca') orcaCurrentData = JSON.parse(JSON.stringify(orcaMembers));
      else eniCurrentData = JSON.parse(JSON.stringify(eniMembers));
      const before = orgAggTargetIds(project).slice().sort();
      start();
      listLive().forEach((m) => { delete m.aggTarget; });
      listLive().find((m) => m.id === idC).aggTarget = true;
      const during = orgAggTargetIds(project).slice().sort();
      if (end) end();
      else if (project === 'orca') { orcaSimMode = false; orcaMembers = JSON.parse(JSON.stringify(orcaCurrentData)); }
      else { eniSimMode = false; eniMembers = JSON.parse(JSON.stringify(eniCurrentData)); }
      const after = orgAggTargetIds(project).slice().sort();
      return { before, during, after };
    }, project);
    assert(`${project.toUpperCase()} sim 集計対象が本番へ書き戻されない`,
      r.before.join(',') === r.after.join(',') && r.during.join(',') === (project === 'orca' ? 'orca_c' : 'eni_c'),
      JSON.stringify(r));
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof hubApplyData === 'function' && typeof orgAggTargetIds === 'function');
  await seed(page);

  for (const project of ['ram', 'orca', 'eni']) {
    await runProject(page, project);
  }
  await runSimIsolation(page);

  // apply roundtrip keeps members
  const sync = await page.evaluate(() => {
    const before = members.length;
    if (typeof hubApplyData === 'function' && typeof hubPackLocalData === 'function') {
      hubApplyData(hubPackLocalData(), { clearSim: true });
    }
    return { before, after: members.length };
  });
  assert('Firestore/local apply でメンバー数が消えない', sync.before === sync.after && sync.after === 3,
    `${sync.before}->${sync.after}`);

  await browser.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) {
    failed.forEach((f) => console.error('FAIL', f.name, f.detail));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
