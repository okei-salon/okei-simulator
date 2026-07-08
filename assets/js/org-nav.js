/* OUKEI HUB Organization Chart Navigation — Ver2.0.9 */

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
  if (filter === 'ram') {
    openOrgChartForProject('ram');
    return;
  }
  if (filter === 'orca') {
    openOrgChartForProject('orca');
    return;
  }
  showOrgProjectSelect();
}

function renderOrgProjectSelect() {
  var grid = document.getElementById('orgSelectGrid');
  if (!grid) return;
  var ramIcon = typeof pjRenderProjectIcon === 'function'
    ? pjRenderProjectIcon('ram', 'orgSelectCardIcon')
    : '<span class="homeProjIcon homeProjIcon--ram orgSelectCardIcon"></span>';
  var orcaIcon = typeof pjRenderProjectIcon === 'function'
    ? pjRenderProjectIcon('orca', 'orgSelectCardIcon')
    : '<span class="homeProjIcon homeProjIcon--orca orgSelectCardIcon"></span>';
  grid.innerHTML =
    '<button type="button" class="orgSelectCard orgSelectCard--ram" onclick="openOrgChartForProject(\'ram\')">' +
      ramIcon +
      '<span class="orgSelectName">RAM</span>' +
    '</button>' +
    '<button type="button" class="orgSelectCard orgSelectCard--orca" onclick="openOrgChartForProject(\'orca\')">' +
      orcaIcon +
      '<span class="orgSelectName">ORCA</span>' +
    '</button>';
}

function initOrgChartTitleIcons() {
  [
    ['ramChartTitleIcon', 'ram'],
    ['orcaChartTitleIcon', 'orca']
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
