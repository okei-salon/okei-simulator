/* OUKEI HUB Project Master — Ver1.8.2 */

var PM_BUILTIN = {
  ram: { key: 'ram', name: 'RAM', startDate: '2024/01/20', inclusionRate: 100, visible: true, registered: false },
  orca: { key: 'orca', name: 'ORCA', startDate: '2024/04/15', inclusionRate: 100, visible: true, registered: false },
  cary: { key: 'cary', name: 'Cary Pact', startDate: '2024/03/10', inclusionRate: 0, visible: true, registered: false },
  genesis: { key: 'genesis', name: 'Genesis', startDate: '2023/11/20', inclusionRate: 100, visible: false, registered: false }
};

var PM_VALID_CODES = {
  RAM: 'ram',
  ENI: 'eni',
  ORCA: 'orca',
  GENESIS: 'genesis',
  OUKEI2026: 'demo2026'
};

/** 追加受付を停止するコード（旧Cary等） */
var PM_DISABLED_CODES = {
  CARY: 1,
  CARYPACT: 1
};

var PM_CODE_META = {
  ram: { name: 'RAM', startDate: '2024/01/20' },
  eni: { name: 'ENI', startDate: '2026/07/11' },
  orca: { name: 'ORCA', startDate: '2024/04/15' },
  genesis: { name: 'Genesis', startDate: '2023/11/20' },
  demo2026: { name: 'OUKEI 2026', startDate: '2026/01/01' }
};

var PM_OFFICIAL_ICON_KEYS = { ram: 1, orca: 1, genesis: 1, cary: 1, eni: 1 };

function pmIsOfficialProjectName(name) {
  return typeof pjIsOfficialProjectName === 'function' && pjIsOfficialProjectName(name);
}

function pmIsOfficialProjectKey(key) {
  let p = typeof pmGetProject === 'function' ? pmGetProject(key) : null;
  return pmIsOfficialProjectName(p && p.name);
}

function pmEscape(text) {
  return typeof escapeHtml === 'function' ? escapeHtml(text) : String(text);
}

function pmDefaultInclusionRate(key) {
  return key === 'cary' ? 0 : 100;
}

function pmEnsureProjectMaster() {
  if (typeof settings === 'undefined') return;
  if (!settings.projectMaster || typeof settings.projectMaster !== 'object') {
    settings.projectMaster = { projects: {}, order: [], savedAt: '' };
  }
  if (!settings.projectMaster.projects) settings.projectMaster.projects = {};
  if (!Array.isArray(settings.projectMaster.order)) settings.projectMaster.order = [];

  let migrated = false;
  Object.keys(PM_BUILTIN).forEach(function (key) {
    if (!settings.projectMaster.projects[key]) {
      migrated = true;
      let base = PM_BUILTIN[key];
      // カタログ定義のみ追加。registered は既存保存値を尊重し、新規は必ず false
      settings.projectMaster.projects[key] = {
        key: key,
        name: base.name,
        startDate: base.startDate,
        inclusionRate: pmDefaultInclusionRate(key),
        visible: base.visible !== false,
        registered: false
      };
    }
  });

  // order は registered 済みのみ（pmNormalizeProjects で再構築）
  if (migrated && !settings.projectMaster.order.length) {
    settings.projectMaster.order = [];
  }

  pmMigrateLegacySettings();
  pmNormalizeProjects();
  pmSyncLegacyFlags();
}

function pmMigrateLegacySettings() {
  if (typeof settings === 'undefined' || !settings.projectMaster) return;
  if (settings.projectMaster._legacyMigrated) return;

  // 旧フラグからの1回限り移行。新規空ユーザーは use* = false のため登録されない。
  if (settings.useRAM && settings.projectMaster.projects.ram) {
    settings.projectMaster.projects.ram.registered = true;
    settings.projectMaster.projects.ram.visible = true;
  }
  if (settings.useORCA && settings.projectMaster.projects.orca) {
    settings.projectMaster.projects.orca.registered = true;
    settings.projectMaster.projects.orca.visible = true;
  }
  if (settings.useCARY && settings.projectMaster.projects.cary) {
    settings.projectMaster.projects.cary.registered = true;
    settings.projectMaster.projects.cary.visible = true;
  }

  if (settings.portfolioGoal && settings.portfolioGoal.rates) {
    Object.keys(settings.portfolioGoal.rates).forEach(function (key) {
      if (settings.projectMaster.projects[key]) {
        settings.projectMaster.projects[key].inclusionRate = Math.max(
          0,
          Math.min(100, Number(settings.portfolioGoal.rates[key]))
        );
      }
    });
  }

  (settings.customProjects || []).forEach(function (p) {
    let key = String(p.key || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!key || settings.projectMaster.projects[key]) return;
    settings.projectMaster.projects[key] = {
      key: key,
      name: p.name || key,
      startDate: p.startDate || '—',
      inclusionRate: 100,
      visible: true,
      registered: true,
      kind: 'other',
      iconKey: 'custom',
      memo: ''
    };
    if (settings.projectMaster.order.indexOf(key) === -1) {
      settings.projectMaster.order.push(key);
    }
  });

  settings.projectMaster._legacyMigrated = true;
}

function pmNormalizeProjects() {
  let projects = settings.projectMaster.projects;
  Object.keys(projects).forEach(function (key) {
    let p = projects[key];
    p.key = key;
    p.inclusionRate = Math.max(0, Math.min(100, Number(p.inclusionRate)));
    p.visible = !!p.visible;
    p.registered = !!p.registered;
    if (!p.startDate) p.startDate = PM_BUILTIN[key] ? PM_BUILTIN[key].startDate : '—';
    if (!p.name) p.name = PM_BUILTIN[key] ? PM_BUILTIN[key].name : key;
    if (!PM_BUILTIN[key] && key !== 'demo2026' && key !== 'eni' && !p.kind) p.kind = 'other';
    if (typeof pjGetOfficialIconKeyByName === 'function') {
      let official = pjGetOfficialIconKeyByName(p.name);
      p.iconKey = official || 'custom';
    } else if (pmIsOfficialProjectName(p.name)) {
      p.iconKey = key;
    } else {
      p.iconKey = 'custom';
    }
    if (typeof p.memo !== 'string') p.memo = p.memo ? String(p.memo) : '';
  });
  settings.projectMaster.order = settings.projectMaster.order.filter(function (key) {
    return !!projects[key] && projects[key].registered;
  });
  Object.keys(projects).forEach(function (key) {
    if (projects[key].registered && settings.projectMaster.order.indexOf(key) === -1) {
      settings.projectMaster.order.push(key);
    }
  });
}

function pmGetRegisteredProjects() {
  pmEnsureProjectMaster();
  return settings.projectMaster.order
    .map(function (key) { return settings.projectMaster.projects[key]; })
    .filter(function (p) { return p && p.registered; });
}

function pmGetEnabledProjects() {
  return pmGetRegisteredProjects()
    .filter(function (p) { return p.visible; })
    .map(function (p) {
      return { key: p.key, name: p.name, dot: p.key };
    });
}

function pmGetManageProjectList() {
  return pmGetRegisteredProjects().map(function (p) {
    return { key: p.key, name: p.name };
  });
}

function pmGetProject(key) {
  pmEnsureProjectMaster();
  return settings.projectMaster.projects[key] || null;
}

function pmGetInclusionRate(key) {
  let p = pmGetProject(key);
  if (p && typeof p.inclusionRate === 'number') return p.inclusionRate;
  return pmDefaultInclusionRate(key);
}

function pmGetStartDate(key) {
  let p = pmGetProject(key);
  if (p && p.startDate) return p.startDate;
  return PM_BUILTIN[key] ? PM_BUILTIN[key].startDate : '—';
}

function pmProjectMasterHasSaved() {
  pmEnsureProjectMaster();
  return !!settings.projectMaster.savedAt;
}

/** 未登録ユーザー用の空ドラフト（カタログ全体を載せない） */
function pmGetDefaultMasterState() {
  return { projects: {}, order: [] };
}

function pmSerializeMasterState(state) {
  return JSON.stringify(state);
}

function pmGetSavedMasterState() {
  pmEnsureProjectMaster();
  let projects = {};
  pmGetRegisteredProjects().forEach(function (p) {
    projects[p.key] = {
      key: p.key,
      name: p.name,
      startDate: p.startDate,
      inclusionRate: p.inclusionRate,
      visible: p.visible,
      registered: true,
      iconKey: p.iconKey,
      memo: p.memo,
      kind: p.kind
    };
  });
  return {
    projects: projects,
    order: settings.projectMaster.order.slice()
  };
}

/**
 * draft / 保存stateを反映。
 * registered にするのは order にあるキー（または明示的に registered:true）だけ。
 * カタログに残っている未登録キーを一括 true にしない。
 */
function pmApplyMasterState(state) {
  pmEnsureProjectMaster();
  let incoming = (state && state.projects) || {};
  let order = Array.isArray(state && state.order) ? state.order.slice() : [];
  let registeredKeys = [];

  order.forEach(function (key) {
    if (key && incoming[key] && registeredKeys.indexOf(key) === -1) registeredKeys.push(key);
  });
  Object.keys(incoming).forEach(function (key) {
    if (incoming[key] && incoming[key].registered && registeredKeys.indexOf(key) === -1) {
      registeredKeys.push(key);
    }
  });

  Object.keys(settings.projectMaster.projects).forEach(function (key) {
    if (registeredKeys.indexOf(key) === -1) {
      settings.projectMaster.projects[key].registered = false;
    }
  });

  registeredKeys.forEach(function (key) {
    let src = incoming[key] || {};
    let prev = settings.projectMaster.projects[key] || {};
    settings.projectMaster.projects[key] = Object.assign({}, prev, src, {
      key: key,
      registered: true,
      visible: src.visible !== false
    });
  });

  settings.projectMaster.order = registeredKeys.slice();
  pmNormalizeProjects();
}

function pmSlugProjectKey(name, projects) {
  let base = String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) base = 'project';
  let key = base;
  let i = 2;
  while (projects[key]) {
    key = base + i;
    i += 1;
  }
  return key;
}

function pmIconOptionsHtml(selected) {
  return '<option value="custom"' + (selected === 'custom' ? ' selected' : '') + '>頭文字アイコン（自動）</option>';
}

function pmValidateProjectCode(codeRaw) {
  let code = String(codeRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'プロジェクトコードを入力してください。' };
  if (PM_DISABLED_CODES[code]) {
    return { ok: false, message: 'このプロジェクトコードは現在利用できません。' };
  }
  let key = PM_VALID_CODES[code];
  if (!key) return { ok: false, message: 'プロジェクトコードが正しくありません。' };
  let existing = pmGetProject(key);
  if (existing && existing.registered) {
    return { ok: false, message: 'このプロジェクトは既に登録されています。' };
  }
  return { ok: true, key: key, code: code };
}

/** 選択した1プロジェクトだけ registered:true にする（他は触らない） */
function pmRegisterSingleProject(key, opts) {
  opts = opts || {};
  key = String(key || '');
  if (!key) return { ok: false, message: 'プロジェクトが不正です。' };
  pmEnsureProjectMaster();
  let meta = PM_CODE_META[key] || PM_BUILTIN[key] || { name: key, startDate: '—' };
  let prev = settings.projectMaster.projects[key] || {};
  settings.projectMaster.projects[key] = Object.assign({}, prev, {
    key: key,
    name: opts.name || prev.name || meta.name || key,
    startDate: opts.startDate || prev.startDate || meta.startDate || '—',
    inclusionRate: typeof opts.inclusionRate === 'number'
      ? opts.inclusionRate
      : (typeof prev.inclusionRate === 'number' ? prev.inclusionRate : pmDefaultInclusionRate(key)),
    visible: opts.visible !== false,
    registered: true,
    iconKey: opts.iconKey || prev.iconKey || key,
    kind: opts.kind || prev.kind,
    memo: typeof opts.memo === 'string' ? opts.memo : (prev.memo || '')
  });
  if (settings.projectMaster.order.indexOf(key) === -1) {
    settings.projectMaster.order.push(key);
  }
  pmNormalizeProjects();
  pmSyncLegacyFlags();
  return { ok: true, key: key, name: settings.projectMaster.projects[key].name };
}

function pmRegisterProjectByCode(codeRaw) {
  let result = pmValidateProjectCode(codeRaw);
  if (!result.ok) return result;
  let reg = pmRegisterSingleProject(result.key);
  if (!reg.ok) return reg;
  return { ok: true, key: reg.key, name: reg.name };
}

function pmSyncLegacyFlags() {
  if (typeof settings === 'undefined') return;
  // pmGetProject / pmGetRegisteredProjects は pmEnsure を呼ぶため使わない（再入防止）
  let projects = (settings.projectMaster && settings.projectMaster.projects) || {};
  function flag(key) {
    let p = projects[key];
    return !!(p && p.registered && p.visible);
  }
  settings.useRAM = flag('ram');
  settings.useORCA = flag('orca');
  settings.useCARY = flag('cary');
  let order = (settings.projectMaster && Array.isArray(settings.projectMaster.order))
    ? settings.projectMaster.order : [];
  settings.customProjects = order
    .map(function (key) { return projects[key]; })
    .filter(function (p) { return p && p.registered && !PM_BUILTIN[p.key]; })
    .map(function (p) { return { key: p.key, name: p.name, startDate: p.startDate, type: 'master' }; });
  if (settings.portfolioGoal && settings.portfolioGoal.rates) {
    order.forEach(function (key) {
      let p = projects[key];
      if (p && p.registered) settings.portfolioGoal.rates[p.key] = p.inclusionRate;
    });
  }
}

function pmCommitProjectMaster(state) {
  let prevKeys = pmGetRegisteredProjects().map(function (p) { return p.key; });
  pmApplyMasterState(state);
  let nextKeys = pmGetRegisteredProjects().map(function (p) { return p.key; });
  if (typeof pmOnProjectsCommitted === 'function') pmOnProjectsCommitted(prevKeys, nextKeys);
  settings.projectMaster.savedAt = new Date().toLocaleString();
  settings.lastUpdate = settings.projectMaster.savedAt;
  pmSyncLegacyFlags();
  pmPersistHubSettings();
}

function pmPersistHubSettings() {
  if (typeof hubSaveToStorage === 'function') {
    hubSaveToStorage();
    return;
  }
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    let key = typeof hubResolveStorageKey === 'function' ? hubResolveStorageKey() : 'oukei_hub_v15_data';
    localStorage.setItem(key, JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : '',
      rootAccountIds: typeof rootAccountIds !== 'undefined' ? rootAccountIds : []
    }));
  } catch (e) {}
}

function pmEnsureFxSettings() {
  if (typeof settings === 'undefined') return;
  if (!settings.fxSettings || typeof settings.fxSettings !== 'object') {
    settings.fxSettings = {
      rate: Number(settings.yenRate) || 155,
      savedAt: ''
    };
  }
  if (typeof settings.fxSettings.rate !== 'number') {
    settings.fxSettings.rate = Number(settings.yenRate) || 155;
  }
}

function pmFxHasSaved() {
  pmEnsureFxSettings();
  return !!settings.fxSettings.savedAt;
}

function pmGetFxRate() {
  pmEnsureFxSettings();
  return Number(settings.fxSettings.rate) || Number(settings.yenRate) || 155;
}

function pmCommitFxSettings(rate) {
  pmEnsureFxSettings();
  settings.fxSettings.rate = Math.max(1, Number(rate) || 155);
  settings.yenRate = settings.fxSettings.rate;
  settings.fxSettings.savedAt = new Date().toLocaleString();
  settings.lastUpdate = settings.fxSettings.savedAt;
  pmPersistHubSettings();
}

function pmRenderProjectIcon(key, extraClass, project) {
  if (typeof pjRenderProjectIcon === 'function') {
    return pjRenderProjectIcon(key, extraClass, project);
  }
  if (typeof renderProjectIcon === 'function') {
    return renderProjectIcon(key, extraClass, project ? { project: project } : undefined);
  }
  return '';
}
