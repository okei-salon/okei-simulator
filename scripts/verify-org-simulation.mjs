#!/usr/bin/env node
/**
 * Organization simulation isolation + UX regression (RAM / ORCA / ENI).
 * Covers: no auto-exit, copy/blank start, production isolation, no Firestore writes, no cross-project bleed.
 */
import { chromium } from 'playwright';

const baseUrl = String(process.env.OUKEI_BASE || process.argv[2] || 'http://127.0.0.1:5050').replace(/\/$/, '');
const checks = [];

function assert(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function seedProjects(page) {
  await page.evaluate(() => {
    document.body.classList.add('hub-auth-ready');
    localStorage.clear();
    const empty = typeof hubCreateEmptyData === 'function' ? hubCreateEmptyData() : { members: [], settings: {} };
    if (typeof hubApplyData === 'function') hubApplyData(empty, { clearSim: true });

    // RAM live tree A->B
    members = [
      { id: 'ram_a', parent: null, name: 'RAM-A', investment: 1000, open: true },
      { id: 'ram_b', parent: 'ram_a', name: 'RAM-B', investment: 500, open: true }
    ];
    currentData = JSON.parse(JSON.stringify(members));
    rootId = 'ram_a';
    rootAccountIds = ['ram_a'];
    focusId = 'ram_a';
    simMode = false;
    window.__ramSimLiveSnapshot = null;

    // ORCA live tree
    orcaMembers = [
      { id: 'orca_a', parent: null, name: 'ORCA-A', username: 'oa', rank: 0, investment: 300, aiAgent: 'Eden', personalSales: 0, groupSales: 0, open: true },
      { id: 'orca_b', parent: 'orca_a', name: 'ORCA-B', username: 'ob', rank: 0, investment: 200, aiAgent: 'Eden', personalSales: 0, groupSales: 0, open: true }
    ];
    orcaCurrentData = JSON.parse(JSON.stringify(orcaMembers));
    orcaRootId = 'orca_a';
    orcaRootAccountIds = ['orca_a'];
    orcaFocusId = 'orca_a';
    orcaSimMode = false;
    window.__orcaSimLiveSnapshot = null;

    // ENI live tree + register project
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
    eniMembers = [
      { id: 'eni_a', parent: null, name: 'ENI-A', username: 'ea', walletAddress: 'ea', investment: 1000, open: true },
      { id: 'eni_b', parent: 'eni_a', name: 'ENI-B', username: 'eb', walletAddress: 'eb', investment: 400, open: true }
    ];
    eniCurrentData = JSON.parse(JSON.stringify(eniMembers));
    eniRootId = 'eni_a';
    eniRootAccountIds = ['eni_a'];
    eniFocusId = 'eni_a';
    eniSimMode = false;
    window.__eniSimLiveSnapshot = null;

    if (typeof hubSaveToStorage === 'function') hubSaveToStorage({ localOnly: true });
    if (typeof render === 'function') render();
  });
}

async function runProjectSuite(page, project) {
  const label = project.toUpperCase();

  const opened = await page.evaluate((project) => {
    if (project === 'ram') {
      showPage('ram');
      openSimulationPanel();
    } else if (project === 'orca') {
      showPage('orcaOrg');
      orcaOpenSimulationPanel();
    } else {
      showPage('eniOrg');
      eniOpenSimulationPanel();
    }
    const html = (document.getElementById('modalContent') || {}).innerHTML || '';
    return {
      hasCopy: html.indexOf('現在の組織図をコピー') >= 0,
      hasBlank: html.indexOf('新しい組織図を作成') >= 0,
      hasResume: html.indexOf('保存したシミュレーションから再開') >= 0
    };
  }, project);
  assert(`${label} chooser shows copy option`, opened.hasCopy);
  assert(`${label} chooser shows blank option`, opened.hasBlank);
  assert(`${label} chooser shows resume option`, opened.hasResume);

  // B: copy start
  const afterCopy = await page.evaluate((project) => {
    if (project === 'ram') startSimulationCopy();
    else if (project === 'orca') orcaStartSimulationCopy();
    else eniStartSimulationCopy();
    if (project === 'ram') {
      return {
        sim: !!simMode,
        count: members.length,
        names: members.map((m) => m.name).join(','),
        banner: !!(document.getElementById('orgSimBanner') && document.getElementById('orgSimBanner').classList.contains('isVisible')),
        endBtn: !!document.querySelector('#orgSimBanner .orgSimEndBtn')
      };
    }
    if (project === 'orca') {
      return {
        sim: !!orcaSimMode,
        count: orcaMembers.length,
        names: orcaMembers.map((m) => m.name).join(','),
        banner: !!(document.getElementById('orcaOrgSimBanner') && document.getElementById('orcaOrgSimBanner').classList.contains('isVisible')),
        endBtn: !!document.querySelector('#orcaOrgSimBanner .orgSimEndBtn')
      };
    }
    return {
      sim: !!eniSimMode,
      count: eniMembers.length,
      names: eniMembers.map((m) => m.name).join(','),
      banner: !!(document.getElementById('eniOrgSimBanner') && document.getElementById('eniOrgSimBanner').classList.contains('isVisible')),
      endBtn: !!document.querySelector('#eniOrgSimBanner .orgSimEndBtn')
    };
  }, project);
  assert(`${label} copy start enters sim`, afterCopy.sim);
  assert(`${label} copy keeps member count`, afterCopy.count === 2, String(afterCopy.count));
  assert(`${label} banner visible`, afterCopy.banner);
  assert(`${label} end button present`, afterCopy.endBtn);

  // C/D: mutate sim independently
  const isolation = await page.evaluate((project) => {
    if (project === 'ram') {
      const liveBefore = JSON.stringify(window.__ramSimLiveSnapshot.currentData);
      members[0].name = 'RAM-SIM-CHANGED';
      members.push({ id: 'ram_x', parent: 'ram_a', name: 'RAM-X', investment: 1, open: true });
      // simulate sync apply that used to kill sim
      if (typeof hubApplyData === 'function') {
        const packed = hubPackLocalData();
        hubApplyData(packed);
      }
      return {
        stillSim: !!simMode,
        workingName: members[0].name,
        workingCount: members.length,
        liveName: (window.__ramSimLiveSnapshot.currentData[0] || {}).name,
        liveCount: window.__ramSimLiveSnapshot.currentData.length,
        liveBefore,
        liveAfter: JSON.stringify(window.__ramSimLiveSnapshot.currentData)
      };
    }
    if (project === 'orca') {
      orcaMembers[0].name = 'ORCA-SIM-CHANGED';
      orcaMembers.push({
        id: 'orca_x', parent: 'orca_a', name: 'ORCA-X', username: 'ox', rank: 0,
        investment: 1, aiAgent: 'Eden', personalSales: 0, groupSales: 0, open: true
      });
      if (typeof hubApplyData === 'function') hubApplyData(hubPackLocalData());
      return {
        stillSim: !!orcaSimMode,
        workingName: orcaMembers[0].name,
        workingCount: orcaMembers.length,
        liveName: (window.__orcaSimLiveSnapshot.currentData[0] || {}).name,
        liveCount: window.__orcaSimLiveSnapshot.currentData.length
      };
    }
    eniMembers[0].name = 'ENI-SIM-CHANGED';
    eniMembers.push({
      id: 'eni_x', parent: 'eni_a', name: 'ENI-X', username: 'ex', walletAddress: 'ex',
      investment: 1, open: true
    });
    if (typeof hubApplyData === 'function') hubApplyData(hubPackLocalData());
    return {
      stillSim: !!eniSimMode,
      workingName: eniMembers[0].name,
      workingCount: eniMembers.length,
      liveName: (window.__eniSimLiveSnapshot.currentData[0] || {}).name,
      liveCount: window.__eniSimLiveSnapshot.currentData.length
    };
  }, project);
  assert(`${label} still sim after hubApplyData`, isolation.stillSim);
  assert(`${label} working mutated`, String(isolation.workingName).indexOf('SIM-CHANGED') >= 0, isolation.workingName);
  assert(`${label} live baseline unchanged by sim edit`, isolation.liveCount === 2 && String(isolation.liveName).indexOf('SIM-CHANGED') < 0,
    `${isolation.liveName}/${isolation.liveCount}`);

  // A: wait + re-render must not exit
  await page.waitForTimeout(2200);
  const stayed = await page.evaluate((project) => {
    if (project === 'ram') { if (typeof render === 'function') render(); return !!simMode; }
    if (project === 'orca') { if (typeof orcaRender === 'function') orcaRender(); return !!orcaSimMode; }
    if (typeof eniRender === 'function') eniRender();
    return !!eniSimMode;
  }, project);
  assert(`${label} stays in sim after wait/render`, stayed);

  // I: pack must not contain sim-only nodes; cloud schedule suppressed
  const packCheck = await page.evaluate(async (project) => {
    const packed = hubPackLocalData();
    const payload = typeof hubPackFirestorePayload === 'function' ? hubPackFirestorePayload(Date.now()) : null;
    function membersOf(src, projectKey) {
      if (!src) return [];
      if (projectKey === 'ram') return src.members || (src.orgChart && src.orgChart.members) || [];
      if (projectKey === 'orca') return (src.orcaOrgChart && src.orcaOrgChart.members) || [];
      return (src.eniOrgChart && src.eniOrgChart.members) || [];
    }
    function dirty(list) {
      return (list || []).some((m) =>
        String(m.id || '').slice(-2) === '_x' ||
        String(m.name || '').indexOf('SIM-CHANGED') >= 0
      );
    }
    const packedMembers = membersOf(packed, project);
    const payloadMembers = membersOf(payload, project);
    let cloudSaveResult = null;
    if (typeof hubRunCloudSave === 'function') {
      cloudSaveResult = await hubRunCloudSave(true);
    }
    return {
      ids: packedMembers.map((m) => m.id),
      hasSimNode: dirty(packedMembers),
      firestoreHasSim: dirty(payloadMembers),
      cloudSaveResult
    };
  }, project);
  assert(`${label} pack excludes sim-only nodes`, !packCheck.hasSimNode, packCheck.ids.join(','));
  assert(`${label} firestore payload excludes sim edits`, !packCheck.firestoreHasSim);
  assert(`${label} cloud save blocked while sim`, packCheck.cloudSaveResult === false, String(packCheck.cloudSaveResult));

  // 4: cancel keeps editing
  const cancelKeep = await page.evaluate((project) => {
    orgSimRequestEnd(project);
    const title = (document.getElementById('modalTitle') || {}).textContent || '';
    const body = (document.getElementById('modalContent') || {}).innerHTML || '';
    orgSimConfirmEndCancel();
    const still =
      project === 'ram' ? !!simMode :
      project === 'orca' ? !!orcaSimMode : !!eniSimMode;
    const workingName =
      project === 'ram' ? (members[0] || {}).name :
      project === 'orca' ? (orcaMembers[0] || {}).name :
      (eniMembers[0] || {}).name;
    return {
      title,
      hasSave: body.indexOf('保存して終了') >= 0,
      hasDiscard: body.indexOf('保存せず終了') >= 0,
      hasCancel: body.indexOf('キャンセル') >= 0,
      still,
      workingName
    };
  }, project);
  assert(`${label} end confirm title`, cancelKeep.title.indexOf('終了しますか') >= 0, cancelKeep.title);
  assert(`${label} end confirm has 3 actions`, cancelKeep.hasSave && cancelKeep.hasDiscard && cancelKeep.hasCancel);
  assert(`${label} cancel keeps sim`, cancelKeep.still);
  assert(`${label} cancel keeps edits`, String(cancelKeep.workingName).indexOf('SIM-CHANGED') >= 0, cancelKeep.workingName);

  // 1/2/6: save and exit — production unchanged, resume later, firestore org clean
  const saveExit = await page.evaluate(async (project) => {
    const beforeLive =
      project === 'ram' ? JSON.stringify(window.__ramSimLiveSnapshot.currentData) :
      project === 'orca' ? JSON.stringify(window.__orcaSimLiveSnapshot.currentData) :
      JSON.stringify(window.__eniSimLiveSnapshot.currentData);
    const beforeCount =
      project === 'ram' ? scenarios.length :
      project === 'orca' ? orcaScenarios.length : eniScenarios.length;

    window.prompt = function () { return project.toUpperCase() + '-SAVED-EXIT'; };
    orgSimConfirmEndSave(project);

    const afterLiveMembers =
      project === 'ram' ? members :
      project === 'orca' ? orcaMembers : eniMembers;
    const afterLiveBaseline =
      project === 'ram' ? currentData :
      project === 'orca' ? orcaCurrentData : eniCurrentData;
    const scenariosArr =
      project === 'ram' ? scenarios :
      project === 'orca' ? orcaScenarios : eniScenarios;
    const packed = hubPackLocalData();
    const payload = hubPackFirestorePayload(Date.now());
    function orgMembers(src) {
      if (project === 'ram') return src.members || (src.orgChart && src.orgChart.members) || [];
      if (project === 'orca') return (src.orcaOrgChart && src.orcaOrgChart.members) || [];
      return (src.eniOrgChart && src.eniOrgChart.members) || [];
    }
    const cloudBlocked = await hubRunCloudSave(true);
    return {
      sim:
        project === 'ram' ? !!simMode :
        project === 'orca' ? !!orcaSimMode : !!eniSimMode,
      liveName: (afterLiveMembers[0] || {}).name,
      liveCount: afterLiveMembers.length,
      baselineName: (afterLiveBaseline[0] || {}).name,
      savedGrew: scenariosArr.length === beforeCount + 1,
      savedName: (scenariosArr[scenariosArr.length - 1] || {}).name,
      savedHasEdit: JSON.stringify((scenariosArr[scenariosArr.length - 1] || {}).data || []).indexOf('SIM-CHANGED') >= 0,
      packDirty: orgMembers(packed).some((m) => String(m.name || '').indexOf('SIM-CHANGED') >= 0),
      firestoreDirty: orgMembers(payload).some((m) => String(m.name || '').indexOf('SIM-CHANGED') >= 0),
      cloudBlocked,
      beforeLive,
      afterLive: JSON.stringify(afterLiveBaseline)
    };
  }, project);
  assert(`${label} save-exit clears sim`, !saveExit.sim);
  assert(`${label} save-exit production unchanged`, saveExit.liveCount === 2 && String(saveExit.liveName).indexOf('SIM-CHANGED') < 0,
    `${saveExit.liveName}/${saveExit.liveCount}`);
  assert(`${label} save-exit stores scenario`, saveExit.savedGrew && saveExit.savedHasEdit, saveExit.savedName);
  assert(`${label} save-exit pack clean`, !saveExit.packDirty);
  assert(`${label} save-exit firestore org clean`, !saveExit.firestoreDirty);
  assert(`${label} save-exit cloud blocked or noop`, saveExit.cloudBlocked === false, String(saveExit.cloudBlocked));

  // 2: resume from saved
  const resumed = await page.evaluate((project) => {
    const scenariosArr =
      project === 'ram' ? scenarios :
      project === 'orca' ? orcaScenarios : eniScenarios;
    const idx = scenariosArr.length - 1;
    if (project === 'ram') loadScenario(idx);
    else if (project === 'orca') orcaLoadScenario(idx);
    else eniLoadScenario(idx);
    const working =
      project === 'ram' ? members :
      project === 'orca' ? orcaMembers : eniMembers;
    const live =
      project === 'ram' ? (window.__ramSimLiveSnapshot && window.__ramSimLiveSnapshot.currentData) :
      project === 'orca' ? (window.__orcaSimLiveSnapshot && window.__orcaSimLiveSnapshot.currentData) :
      (window.__eniSimLiveSnapshot && window.__eniSimLiveSnapshot.currentData);
    return {
      sim:
        project === 'ram' ? !!simMode :
        project === 'orca' ? !!orcaSimMode : !!eniSimMode,
      workingName: (working[0] || {}).name,
      workingCount: working.length,
      liveName: (live && live[0] || {}).name,
      liveCount: live ? live.length : -1
    };
  }, project);
  assert(`${label} resume enters sim`, resumed.sim);
  assert(`${label} resume restores saved edits`, String(resumed.workingName).indexOf('SIM-CHANGED') >= 0, resumed.workingName);
  assert(`${label} resume keeps production snapshot`, resumed.liveCount === 2 && String(resumed.liveName).indexOf('SIM-CHANGED') < 0,
    `${resumed.liveName}/${resumed.liveCount}`);

  // 3: discard exit drops unsaved/new edits after resume mutation
  const discarded = await page.evaluate((project) => {
    if (project === 'ram') {
      members[0].name = 'RAM-DISCARD-TMP';
      endSimulationDiscard();
      return { sim: !!simMode, name: (members[0] || {}).name, count: members.length };
    }
    if (project === 'orca') {
      orcaMembers[0].name = 'ORCA-DISCARD-TMP';
      orcaEndSimulationDiscard();
      return { sim: !!orcaSimMode, name: (orcaMembers[0] || {}).name, count: orcaMembers.length };
    }
    eniMembers[0].name = 'ENI-DISCARD-TMP';
    eniEndSimulationDiscard();
    return { sim: !!eniSimMode, name: (eniMembers[0] || {}).name, count: eniMembers.length };
  }, project);
  assert(`${label} discard clears sim`, !discarded.sim);
  assert(`${label} discard restores production`, discarded.count === 2 && String(discarded.name).indexOf('DISCARD-TMP') < 0 && String(discarded.name).indexOf('SIM-CHANGED') < 0,
    discarded.name);

  // E: blank start
  const blank = await page.evaluate((project) => {
    if (project === 'ram') startSimulationBlank();
    else if (project === 'orca') orcaStartSimulationBlank();
    else eniStartSimulationBlank();
    if (project === 'ram') {
      return { sim: !!simMode, count: members.length, name: (members[0] || {}).name, liveCount: window.__ramSimLiveSnapshot.currentData.length };
    }
    if (project === 'orca') {
      return { sim: !!orcaSimMode, count: orcaMembers.length, name: (orcaMembers[0] || {}).name, liveCount: window.__orcaSimLiveSnapshot.currentData.length };
    }
    return { sim: !!eniSimMode, count: eniMembers.length, name: (eniMembers[0] || {}).name, liveCount: window.__eniSimLiveSnapshot.currentData.length };
  }, project);
  assert(`${label} blank start enters sim`, blank.sim);
  assert(`${label} blank has virtual root`, blank.count === 1 && String(blank.name).indexOf('仮想') >= 0, `${blank.count}/${blank.name}`);
  assert(`${label} blank keeps live snapshot`, blank.liveCount === 2, String(blank.liveCount));

  // end again before next project
  await page.evaluate((project) => {
    if (project === 'ram') endSimulationDiscard();
    else if (project === 'orca') orcaEndSimulationDiscard();
    else eniEndSimulationDiscard();
  }, project);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await seedProjects(page);
  await page.waitForTimeout(400);

  for (const project of ['ram', 'orca', 'eni']) {
    await runProjectSuite(page, project);
  }

  // H: no cross-project bleed — start RAM sim, ensure ORCA/ENI live untouched when mutating RAM
  const bleed = await page.evaluate(() => {
    startSimulationCopy();
    members[0].name = 'RAM-BLEED';
    const orcaLive = JSON.stringify(orcaCurrentData);
    const eniLive = JSON.stringify(eniCurrentData);
    const orcaWork = JSON.stringify(orcaMembers);
    const eniWork = JSON.stringify(eniMembers);
    endSimulationDiscard();
    return {
      orcaSame: orcaLive === JSON.stringify(orcaCurrentData) && orcaWork === JSON.stringify(orcaMembers),
      eniSame: eniLive === JSON.stringify(eniCurrentData) && eniWork === JSON.stringify(eniMembers),
      ramRestored: members[0].name !== 'RAM-BLEED'
    };
  });
  assert('No ORCA bleed from RAM sim', bleed.orcaSame);
  assert('No ENI bleed from RAM sim', bleed.eniSame);
  assert('RAM restored after bleed check', bleed.ramRestored);

  // 5: saved scenarios do not mix across projects
  const mix = await page.evaluate(() => {
    const ramNames = (scenarios || []).map((s) => s.name + '|' + (s.project || ''));
    const orcaNames = (orcaScenarios || []).map((s) => s.name + '|' + (s.project || ''));
    const eniNames = (eniScenarios || []).map((s) => s.name + '|' + (s.project || ''));
    const ramHasOrca = ramNames.some((n) => n.indexOf('ORCA-') >= 0);
    const orcaHasRam = orcaNames.some((n) => n.indexOf('RAM-') >= 0);
    const eniHasRam = eniNames.some((n) => n.indexOf('RAM-') >= 0);
    const eniHasOrca = eniNames.some((n) => n.indexOf('ORCA-') >= 0);
    return {
      ramCount: scenarios.length,
      orcaCount: orcaScenarios.length,
      eniCount: eniScenarios.length,
      isolated: !ramHasOrca && !orcaHasRam && !eniHasRam && !eniHasOrca
    };
  });
  assert('Saved sims exist per project', mix.ramCount >= 1 && mix.orcaCount >= 1 && mix.eniCount >= 1,
    `${mix.ramCount}/${mix.orcaCount}/${mix.eniCount}`);
  assert('Saved sims do not mix across projects', mix.isolated);

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) process.exitCode = 1;
} catch (err) {
  console.error('VERIFY ERROR:', err && err.message ? err.message : err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
