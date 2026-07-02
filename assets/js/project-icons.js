/* OUKEI HUB Project Icons — Ver2.0.3
 * PNG icons loaded from assets/projects/
 * Add {key}.png to the folder and register below to enable a project icon.
 */

var PJ_ICON_VERSION = '20260628-v211';
var PJ_ICON_BASE = 'assets/projects/';

var PJ_ICON_REGISTRY = {
  ram: { file: 'ram.png', alt: 'RAM' },
  orca: { file: 'orca.png', alt: 'ORCA' },
  cary: { alt: 'Cary Pact' },
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

function pjResolveIconKey(projectKey, opts) {
  opts = opts || {};
  if (opts.iconKey) return opts.iconKey;
  if (opts.project && opts.project.iconKey) return opts.project.iconKey;
  return projectKey || 'other';
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

function renderProjectIcon(projectKey, extraClass, opts) {
  opts = opts || {};
  let key = pjResolveIconKey(projectKey, opts);
  let meta = pjGetIconMeta(key);
  let sizeKey = pjResolveSizeKey(extraClass);
  let sizeCls = pjSizeClass(sizeKey);
  let cls = 'homeProjIcon homeProjIcon--' + key + ' ' + sizeCls;
  if (extraClass) cls += ' ' + extraClass;

  if (meta.file) {
    cls += ' homeProjIcon--img';
    let img = '<img class="' + cls + '" src="' + pjEscape(pjGetIconUrl(key)) + '" alt="' +
      pjEscape(pjGetIconAlt(key, opts.alt || opts.name)) + '" loading="lazy" decoding="async">';
    return '<span class="' + pjWrapClass(sizeKey) + '">' + img + '</span>';
  }

  return '<span class="' + cls + '" aria-hidden="true"></span>';
}

function renderHomeProjIcon(projectKey, extraClass) {
  return renderProjectIcon(projectKey, extraClass);
}

function pmRenderProjectIcon(key, extraClass, project) {
  return renderProjectIcon(key, extraClass, {
    project: project,
    iconKey: project && project.iconKey ? project.iconKey : key,
    name: project && project.name ? project.name : ''
  });
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
  el.innerHTML = renderProjectIcon(projectKey, 'rmFilterIconImg');
}

if (typeof window !== 'undefined') {
  window.PJ_ICON_REGISTRY = PJ_ICON_REGISTRY;
  window.pjGetIconUrl = pjGetIconUrl;
  window.pjHasIconFile = pjHasIconFile;
  window.renderProjectIcon = renderProjectIcon;
  window.renderHomeProjIcon = renderHomeProjIcon;
  window.pmRenderProjectIcon = pmRenderProjectIcon;
  window.pjUpdateFilterIcon = pjUpdateFilterIcon;
}
