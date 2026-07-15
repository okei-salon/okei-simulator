/* OUKEI HUB Organization Chart Navigation — Ver2.0.10 */

var ORG_CHART_PROJECTS = [
  { key: 'ram', page: 'ram', label: 'RAM' },
  { key: 'orca', page: 'orcaOrg', label: 'ORCA' },
  { key: 'eni', page: 'eniOrg', label: 'ENI' }
];

/** 組織図プロジェクト選択画面で「現在」として強調するキー（ram|orca|eni） */
var orgSelectCurrentKey = '';

function orgGetSelectableProjects() {
  var registered = typeof pmGetRegisteredProjects === 'function' ? pmGetRegisteredProjects() : [];
  var regKeys = registered.map(function (p) { return p.key; });
  return ORG_CHART_PROJECTS.filter(function (p) { return regKeys.indexOf(p.key) >= 0; });
}

function orgDetectCurrentProject() {
  try {
    if (typeof eniOrgPage !== 'undefined' && eniOrgPage && !eniOrgPage.classList.contains('hidden')) return 'eni';
    if (typeof orcaOrgPage !== 'undefined' && orcaOrgPage && !orcaOrgPage.classList.contains('hidden')) return 'orca';
    if (typeof ramPage !== 'undefined' && ramPage && !ramPage.classList.contains('hidden')) return 'ram';
    if (typeof orcaAccountManagePage !== 'undefined' && orcaAccountManagePage && !orcaAccountManagePage.classList.contains('hidden')) return 'orca';
    if (typeof accountManagePage !== 'undefined' && accountManagePage && !accountManagePage.classList.contains('hidden')) return 'ram';
  } catch (e) {}
  return orgSelectCurrentKey || '';
}

function showOrgProjectSelect() {
  orgSelectCurrentKey = orgDetectCurrentProject() || orgSelectCurrentKey || 'ram';
  if (typeof showPage === 'function') showPage('orgSelect');
}

function openOrgChartForProject(projectKey) {
  orgSelectCurrentKey = projectKey || orgSelectCurrentKey;
  if (projectKey === 'ram') {
    if (typeof showPage === 'function') showPage('ram');
    return;
  }
  if (projectKey === 'orca') {
    if (typeof showPage === 'function') showPage('orcaOrg');
    return;
  }
  if (projectKey === 'eni') {
    if (typeof showPage === 'function') showPage('eniOrg');
    return;
  }
  showOrgProjectSelect();
}

function hubGetManageOrgFilter() {
  if (typeof portfolioPage !== 'undefined' && !portfolioPage.classList.contains('hidden')) {
    return 'all';
  }
  if (typeof revenueManagePage !== 'undefined' && !revenueManagePage.classList.contains('hidden')) {
    return typeof rmFilter !== 'undefined' ? rmFilter : 'all';
  }
  if (typeof salesManagePage !== 'undefined' && !salesManagePage.classList.contains('hidden')) {
    return typeof smFilter !== 'undefined' ? smFilter : 'all';
  }
  return 'all';
}

function openOrgChartFromManage() {
  var filter = hubGetManageOrgFilter();
  if (filter === 'ram' || filter === 'orca' || filter === 'eni') {
    openOrgChartForProject(filter);
    return;
  }
  showOrgProjectSelect();
}

function renderOrgProjectSelect() {
  var grid = document.getElementById('orgSelectGrid');
  if (!grid) return;
  var current = orgSelectCurrentKey || orgDetectCurrentProject() || '';
  var page = document.getElementById('orgSelectPage');
  if (page) {
    page.setAttribute('data-org-select-theme', current || 'ram');
  }
  var projects = orgGetSelectableProjects();
  var html = projects.map(function (p) {
    var icon = typeof pjRenderProjectIcon === 'function'
      ? pjRenderProjectIcon(p.key, 'orgSelectCardIcon')
      : '<span class="homeProjIcon homeProjIcon--' + p.key + ' orgSelectCardIcon"></span>';
    var name = p.label;
    if (typeof pmGetProject === 'function') {
      var meta = pmGetProject(p.key);
      if (meta && meta.name) name = meta.name;
    }
    var selected = current === p.key;
    return '<button type="button" class="orgSelectCard orgSelectCard--' + p.key +
      (selected ? ' is-selected' : '') +
      '" data-pj-icon-key="' + p.key + '" aria-pressed="' + (selected ? 'true' : 'false') +
      '" onclick="openOrgChartForProject(\'' + p.key + '\')">' +
      icon +
      '<span class="orgSelectName">' + name + '</span>' +
      (selected ? '<span class="orgSelectSelectedBadge">選択中</span>' : '') +
      '</button>';
  }).join('');
  if (typeof pjSetHtmlKeepIcons === 'function') pjSetHtmlKeepIcons(grid, html);
  else grid.innerHTML = html;
}

function initOrgChartTitleIcons() {
  [
    ['ramChartTitleIcon', 'ram'],
    ['orcaChartTitleIcon', 'orca'],
    ['eniChartTitleIcon', 'eni']
  ].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (!el || typeof pjRenderProjectIcon !== 'function') return;
    if (el.getAttribute('data-pj-ready') === pair[1] && el.querySelector('img.homeProjIcon')) return;
    el.setAttribute('data-pj-ready', pair[1]);
    el.innerHTML = pjRenderProjectIcon(pair[1], 'orgChartTitleIcon');
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrgChartTitleIcons);
  } else {
    initOrgChartTitleIcons();
  }
}

if (typeof window !== 'undefined') {
  window.showOrgProjectSelect = showOrgProjectSelect;
  window.openOrgChartForProject = openOrgChartForProject;
  window.renderOrgProjectSelect = renderOrgProjectSelect;
  window.orgDetectCurrentProject = orgDetectCurrentProject;
}
