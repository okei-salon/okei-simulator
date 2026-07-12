/* OUKEI HUB Project Icons — Ver2.0.5
 * Official icons: project NAME exact match only (not project key).
 * PNG icons loaded from assets/projects/
 */

var PJ_ICON_VERSION = '20260712-v310';
var PJ_ICON_BASE = 'assets/projects/';

/** プロジェクト名の完全一致 → 公式アイコン key */
var PJ_OFFICIAL_PROJECT_NAMES = {
  'RAM': 'ram',
  'ORCA': 'orca',
  'ENI': 'eni',
  'Genesis': 'genesis',
  'Cary Pact': 'cary'
};

var PJ_ICON_REGISTRY = {
  ram: { file: 'ram.png', alt: 'RAM' },
  orca: { file: 'orca.png', alt: 'ORCA' },
  eni: { file: 'eni.png', alt: 'ENI' },
  cary: { file: 'cary.png', alt: 'CarryPact' },
  genesis: { alt: 'GENESIS' },
  other: { alt: 'その他' },
  demo2026: { alt: 'Demo' },
  custom: { alt: 'プロジェクト' }
};

var PJ_ICON_SIZE_BY_CLASS = {
  homeMonthlyProjIcon: 'md',
  homeTodayProjIcon: 'md',
  homeProjCardIcon: 'md',
  rmRowIcon: 'md',
  rmFilterIconImg: 'md',
  orgChartTitleIcon: 'md',
  pfProjectCardIcon: 'lg',
  pmProjectCardIcon: 'xl',
  pmEditIcon: 'xl',
  revenueProjectCardIcon: 'xl'
};

function pjEscape(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pjGetOfficialIconKeyByName(name) {
  if (!name) return null;
  return PJ_OFFICIAL_PROJECT_NAMES[String(name).trim()] || null;
}

function pjIsOfficialProjectName(name) {
  return !!pjGetOfficialIconKeyByName(name);
}

/** @deprecated プロジェクト key ではなく名称で判定する */
function pjIsOfficialProjectKey(key) {
  if (typeof pmIsOfficialProjectName === 'function') {
    let p = typeof pmGetProject === 'function' ? pmGetProject(key) : null;
    return pmIsOfficialProjectName(p && p.name);
  }
  return false;
}

function pjResolveDisplayName(projectKey, opts) {
  opts = opts || {};
  if (opts.name) return opts.name;
  if (opts.project && opts.project.name) return opts.project.name;
  if (typeof getEnabledHomeProjects === 'function') {
    let list = getEnabledHomeProjects();
    if (list && list.length) {
      let hit = list.find(function (p) { return p.key === projectKey; });
      if (hit && hit.name) return hit.name;
    }
  }
  if (typeof pmGetProject === 'function') {
    let p = pmGetProject(projectKey);
    if (p && p.name) return p.name;
  }
  return '';
}

function pjResolveIconKeyByName(name) {
  return pjGetOfficialIconKeyByName(name) || 'custom';
}

function pjGetInitialLetter(displayName, projectKey) {
  if (displayName) {
    let ch = String(displayName).trim().charAt(0);
    if (ch) return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
  }
  if (projectKey) {
    let ch = String(projectKey).charAt(0);
    return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
  }
  return '?';
}

function pjLetterFontSize(sizeKey) {
  if (sizeKey === 'xl') return '18px';
  if (sizeKey === 'lg') return '14px';
  if (sizeKey === 'sm') return '10px';
  return '11px';
}

function pjGetIconMeta(key) {
  return PJ_ICON_REGISTRY[key] || PJ_ICON_REGISTRY.other;
}

function pjHasIconFile(key) {
  let meta = pjGetIconMeta(key);
  return !!(meta && meta.file);
}

function pjGetIconUrl(key) {
  let meta = pjGetIconMeta(key);
  return PJ_ICON_BASE + meta.file + '?v=' + PJ_ICON_VERSION;
}

function pjGetIconAlt(key, name) {
  let meta = pjGetIconMeta(key);
  return name || meta.alt || key;
}

function pjResolveSizeKey(extraClass) {
  if (!extraClass) return 'md';
  let parts = String(extraClass).trim().split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    if (PJ_ICON_SIZE_BY_CLASS[parts[i]]) return PJ_ICON_SIZE_BY_CLASS[parts[i]];
  }
  return 'md';
}

function pjSizeClass(sizeKey) {
  return 'homeProjIcon--size-' + (sizeKey || 'md');
}

function pjWrapClass(sizeKey) {
  return 'pjIconWrap pjIconWrap--size-' + (sizeKey || 'md');
}

function pjBuildProjectIconOpts(projectKey, opts) {
  opts = opts || {};
  let p = opts.project;
  if (!p && typeof pmGetProject === 'function') p = pmGetProject(projectKey);
  let name = pjResolveDisplayName(projectKey, opts);
  let officialIconKey = pjGetOfficialIconKeyByName(name);
  return {
    project: p,
    name: name,
    iconKey: officialIconKey || 'custom'
  };
}

/** 全画面共通: projectKey のみ渡す（表示名は pmGetProject / getEnabledHomeProjects から解決） */
function pjRenderProjectIcon(projectKey, extraClass, projectOpt) {
  return renderProjectIcon(projectKey, extraClass, projectOpt ? { project: projectOpt, name: projectOpt.name } : undefined);
}

function renderProjectIcon(projectKey, extraClass, opts) {
  opts = pjBuildProjectIconOpts(projectKey, opts || {});
  let officialIconKey = pjGetOfficialIconKeyByName(opts.name);
  let sizeKey = pjResolveSizeKey(extraClass);
  let sizeCls = pjSizeClass(sizeKey);

  if (officialIconKey) {
    let meta = pjGetIconMeta(officialIconKey);
    let cls = 'homeProjIcon homeProjIcon--' + officialIconKey + ' ' + sizeCls;
    if (extraClass) cls += ' ' + extraClass;
    if (meta.file && pjHasIconFile(officialIconKey)) {
      cls += ' homeProjIcon--img';
      let img = '<img class="' + cls + '" src="' + pjEscape(pjGetIconUrl(officialIconKey)) + '" alt="' +
        pjEscape(pjGetIconAlt(officialIconKey, opts.name)) + '" loading="lazy" decoding="async">';
      return '<span class="' + pjWrapClass(sizeKey) + '">' + img + '</span>';
    }
    return '<span class="' + pjWrapClass(sizeKey) + '"><span class="' + cls + '" aria-hidden="true"></span></span>';
  }

  let letter = pjGetInitialLetter(opts.name, projectKey);
  let cls = 'homeProjIcon homeProjIcon--letter ' + sizeCls;
  if (extraClass) cls += ' ' + extraClass;
  return '<span class="' + pjWrapClass(sizeKey) + '"><span class="' + cls + '" style="font-size:' +
    pjLetterFontSize(sizeKey) + '" aria-hidden="true">' + pjEscape(letter) + '</span></span>';
}

function renderHomeProjIcon(projectKey, extraClass) {
  return pjRenderProjectIcon(projectKey, extraClass);
}

function pmRenderProjectIcon(key, extraClass, project) {
  return pjRenderProjectIcon(key, extraClass, project);
}

function pjUpdateFilterIcon(containerId, projectKey) {
  let el = document.getElementById(containerId);
  if (!el) return;
  if (!projectKey || projectKey === 'all') {
    el.innerHTML = '';
    el.className = 'rmFilterIcon isEmpty';
    return;
  }
  el.className = 'rmFilterIcon';
  el.innerHTML = pjRenderProjectIcon(projectKey, 'rmFilterIconImg');
}

if (typeof window !== 'undefined') {
  window.PJ_OFFICIAL_PROJECT_NAMES = PJ_OFFICIAL_PROJECT_NAMES;
  window.PJ_ICON_REGISTRY = PJ_ICON_REGISTRY;
  window.pjGetIconUrl = pjGetIconUrl;
  window.pjHasIconFile = pjHasIconFile;
  window.pjGetOfficialIconKeyByName = pjGetOfficialIconKeyByName;
  window.pjIsOfficialProjectName = pjIsOfficialProjectName;
  window.pjIsOfficialProjectKey = pjIsOfficialProjectKey;
  window.pjRenderProjectIcon = pjRenderProjectIcon;
  window.renderProjectIcon = renderProjectIcon;
  window.renderHomeProjIcon = renderHomeProjIcon;
  window.pmRenderProjectIcon = pmRenderProjectIcon;
  window.pjUpdateFilterIcon = pjUpdateFilterIcon;
}
