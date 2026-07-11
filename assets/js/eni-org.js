/* OUKEI HUB ENI Organization Chart — Ver2.0.2 (stub)
 * 組織図本体は未実装。準備中画面のみ表示。データ構造は将来実装用に維持。
 */

var eniMembers = [];
var eniCurrentData = [];
var eniScenarios = [];
var eniRootId = '';
var eniRootAccountIds = [];
var eniZoom = 1;

function eniClone(data) {
  return JSON.parse(JSON.stringify(data));
}

function eniPackOrgChart() {
  return {
    members: eniMembers,
    currentData: eniCurrentData,
    scenarios: eniScenarios,
    rootId: eniRootId,
    rootAccountIds: eniRootAccountIds,
    zoom: eniZoom
  };
}

function eniApplyOrgChart(data) {
  var base = typeof hubCreateEmptyEniOrgChart === 'function'
    ? hubCreateEmptyEniOrgChart()
    : { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 };
  var d = data && typeof data === 'object' ? data : base;
  eniMembers = eniClone(Array.isArray(d.members) ? d.members : []);
  eniCurrentData = eniClone(Array.isArray(d.currentData) ? d.currentData : []);
  eniScenarios = eniClone(Array.isArray(d.scenarios) ? d.scenarios : []);
  eniRootId = typeof d.rootId === 'string' ? d.rootId : '';
  eniRootAccountIds = eniClone(Array.isArray(d.rootAccountIds) ? d.rootAccountIds : []);
  eniZoom = typeof d.zoom === 'number' ? d.zoom : 1;
}

function eniRenderComingSoon() {
  var page = document.getElementById('eniOrgPage');
  if (!page) return;
  var icon = typeof pjRenderProjectIcon === 'function'
    ? pjRenderProjectIcon('eni', 'eniComingSoonLogoIcon')
    : '';
  var shell = page.querySelector('.eniComingSoonShell');
  if (!shell) return;
  var logoEl = shell.querySelector('.eniComingSoonLogo');
  if (logoEl) logoEl.innerHTML = icon;
  if (typeof initOrgChartTitleIcons === 'function') initOrgChartTitleIcons();
}

function eniRender() {
  eniRenderComingSoon();
}

function eniShowAccountManage() {
  if (typeof showPage === 'function') showPage('eniOrg');
}

function eniInitPinchZoom() {}

function eniCenterRootNode() {}

if (typeof window !== 'undefined') {
  window.eniPackOrgChart = eniPackOrgChart;
  window.eniApplyOrgChart = eniApplyOrgChart;
  window.eniRender = eniRender;
  window.eniRenderComingSoon = eniRenderComingSoon;
  window.eniShowAccountManage = eniShowAccountManage;
  window.eniInitPinchZoom = eniInitPinchZoom;
  window.eniCenterRootNode = eniCenterRootNode;
}
