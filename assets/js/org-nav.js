/* OUKEI HUB Organization Chart Navigation — Ver2.0.10 */

var ORG_CHART_PROJECTS = [
  { key: 'ram', page: 'ram', label: 'RAM' },
  { key: 'orca', page: 'orcaOrg', label: 'ORCA' },
  { key: 'eni', page: 'eniOrg', label: 'ENI' }
];

function orgGetSelectableProjects() {
  var registered = typeof pmGetRegisteredProjects === 'function' ? pmGetRegisteredProjects() : [];
  var regKeys = registered.map(function (p) { return p.key; });
  return ORG_CHART_PROJECTS.filter(function (p) { return regKeys.indexOf(p.key) >= 0; });
}

function showOrgProjectSelect() {
  if (typeof showPage === 'function') showPage('orgSelect');
}

function openOrgChartForProject(projectKey) {
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
  var projects = orgGetSelectableProjects();
  grid.innerHTML = projects.map(function (p) {
    var icon = typeof pjRenderProjectIcon === 'function'
      ? pjRenderProjectIcon(p.key, 'orgSelectCardIcon')
      : '<span class="homeProjIcon homeProjIcon--' + p.key + ' orgSelectCardIcon"></span>';
    var name = p.label;
    if (typeof pmGetProject === 'function') {
      var meta = pmGetProject(p.key);
      if (meta && meta.name) name = meta.name;
    }
    return '<button type="button" class="orgSelectCard orgSelectCard--' + p.key + '" onclick="openOrgChartForProject(\'' + p.key + '\')">' +
      icon + '<span class="orgSelectName">' + name + '</span></button>';
  }).join('');
}

function initOrgChartTitleIcons() {
  [
    ['ramChartTitleIcon', 'ram'],
    ['orcaChartTitleIcon', 'orca'],
    ['eniChartTitleIcon', 'eni']
  ].forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (!el || typeof pjRenderProjectIcon !== 'function') return;
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
