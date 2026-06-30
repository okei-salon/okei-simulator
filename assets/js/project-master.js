/* OUKEI HUB Project Master — Ver1.8.0 */

var PM_BUILTIN = {
  ram: { key: 'ram', name: 'RAM', startDate: '2024/01/20', inclusionRate: 100, visible: true, registered: true },
  orca: { key: 'orca', name: 'ORCA', startDate: '2024/04/15', inclusionRate: 100, visible: true, registered: true },
  cary: { key: 'cary', name: 'Cary Pact', startDate: '2024/03/10', inclusionRate: 0, visible: true, registered: true },
  genesis: { key: 'genesis', name: 'GENESIS', startDate: '2023/11/20', inclusionRate: 100, visible: false, registered: false }
};

var PM_VALID_CODES = {
  ORCA: 'orca',
  CARY: 'cary',
  CARYPACT: 'cary',
  GENESIS: 'genesis',
  OUKEI2026: 'demo2026'
};

var PM_CODE_META = {
  orca: { name: 'ORCA', startDate: '2024/04/15' },
  cary: { name: 'Cary Pact', startDate: '2024/03/10' },
  genesis: { name: 'GENESIS', startDate: '2023/11/20' },
  demo2026: { name: 'OUKEI 2026', startDate: '2026/01/01' }
};

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
      settings.projectMaster.projects[key] = {
        key: key,
        name: base.name,
        startDate: base.startDate,
        inclusionRate: pmDefaultInclusionRate(key),
        visible: base.visible,
        registered: base.registered
      };
    }
  });

  if (migrated || !settings.projectMaster.order.length) {
    settings.projectMaster.order = ['ram', 'orca', 'cary'];
    Object.keys(settings.projectMaster.projects).forEach(function (key) {
      if (settings.projectMaster.order.indexOf(key) === -1) {
        settings.projectMaster.order.push(key);
      }
    });
  }

  pmMigrateLegacySettings();
  pmNormalizeProjects();
}

function pmMigrateLegacySettings() {
  if (typeof settings === 'undefined' || !settings.projectMaster) return;
  if (settings.projectMaster._legacyMigrated) return;

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
    p.registered = key === 'ram' ? true : !!p.registered;
    if (!p.startDate) p.startDate = PM_BUILTIN[key] ? PM_BUILTIN[key].startDate : '—';
    if (!p.name) p.name = PM_BUILTIN[key] ? PM_BUILTIN[key].name : key;
    if (!PM_BUILTIN[key] && key !== 'demo2026' && !p.kind) p.kind = 'other';
    if (!p.iconKey) p.iconKey = PM_BUILTIN[key] ? key : (p.kind === 'other' ? 'custom' : key);
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

function pmGetDefaultMasterState() {
  let projects = {};
  let order = ['ram', 'orca', 'cary'];
  order.forEach(function (key) {
    let base = PM_BUILTIN[key];
    projects[key] = {
      key: key,
      name: base.name,
      startDate: base.startDate,
      inclusionRate: pmDefaultInclusionRate(key),
      visible: true,
      registered: true
    };
  });
  return { projects: projects, order: order.slice() };
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

function pmApplyMasterState(state) {
  pmEnsureProjectMaster();
  settings.projectMaster.order = (state.order || []).slice();
  Object.keys(state.projects || {}).forEach(function (key) {
    settings.projectMaster.projects[key] = Object.assign({}, state.projects[key], { key: key, registered: true });
  });
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
  let opts = [
    { value: 'custom', label: 'デフォルト' },
    { value: 'ram', label: 'RAM' },
    { value: 'orca', label: 'ORCA' },
    { value: 'cary', label: 'Cary Pact' },
    { value: 'genesis', label: 'GENESIS' }
  ];
  return opts.map(function (o) {
    return '<option value="' + o.value + '"' + (selected === o.value ? ' selected' : '') + '>' + o.label + '</option>';
  }).join('');
}

function pmValidateProjectCode(codeRaw) {
  let code = String(codeRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'プロジェクトコードを入力してください。' };
  if (code === 'RAM') return { ok: false, message: 'RAMは初期登録済みです。' };
  let key = PM_VALID_CODES[code];
  if (!key) return { ok: false, message: 'プロジェクトコードが正しくありません。' };
  let existing = pmGetProject(key);
  if (existing && existing.registered) {
    return { ok: false, message: 'このプロジェクトは既に登録されています。' };
  }
  return { ok: true, key: key, code: code };
}

function pmRegisterProjectByCode(codeRaw) {
  let result = pmValidateProjectCode(codeRaw);
  if (!result.ok) return result;
  pmEnsureProjectMaster();
  let meta = PM_CODE_META[result.key] || { name: result.key, startDate: '—' };
  settings.projectMaster.projects[result.key] = {
    key: result.key,
    name: meta.name,
    startDate: meta.startDate,
    inclusionRate: pmDefaultInclusionRate(result.key),
    visible: true,
    registered: true,
    iconKey: result.key
  };
  if (settings.projectMaster.order.indexOf(result.key) === -1) {
    settings.projectMaster.order.push(result.key);
  }
  pmSyncLegacyFlags();
  return { ok: true, key: result.key, name: meta.name };
}

function pmSyncLegacyFlags() {
  if (typeof settings === 'undefined') return;
  settings.useRAM = true;
  settings.useORCA = !!(pmGetProject('orca') && pmGetProject('orca').registered && pmGetProject('orca').visible);
  settings.useCARY = !!(pmGetProject('cary') && pmGetProject('cary').registered && pmGetProject('cary').visible);
  settings.customProjects = pmGetRegisteredProjects()
    .filter(function (p) { return !PM_BUILTIN[p.key]; })
    .map(function (p) { return { key: p.key, name: p.name, startDate: p.startDate, type: 'master' }; });
  if (settings.portfolioGoal && settings.portfolioGoal.rates) {
    pmGetRegisteredProjects().forEach(function (p) {
      settings.portfolioGoal.rates[p.key] = p.inclusionRate;
    });
  }
}

function pmCommitProjectMaster(state) {
  pmApplyMasterState(state);
  settings.projectMaster.savedAt = new Date().toLocaleString();
  settings.lastUpdate = settings.projectMaster.savedAt;
  pmSyncLegacyFlags();
  pmPersistHubSettings();
}

function pmPersistHubSettings() {
  if (typeof localStorage === 'undefined' || typeof settings === 'undefined') return;
  try {
    localStorage.setItem('oukei_hub_v15_data', JSON.stringify({
      members: typeof members !== 'undefined' ? members : [],
      currentData: typeof currentData !== 'undefined' ? currentData : [],
      settings: settings,
      scenarios: typeof scenarios !== 'undefined' ? scenarios : [],
      rootId: typeof rootId !== 'undefined' ? rootId : 'm1',
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
  let p = project;
  if (!p && typeof pmGetProject === 'function') p = pmGetProject(key);
  let iconKey = (p && p.iconKey) ? p.iconKey : key;
  let cls = 'homeProjIcon homeProjIcon--' + iconKey;
  if (extraClass) cls += ' ' + extraClass;
  return '<span class="' + cls + '" aria-hidden="true"></span>';
}
