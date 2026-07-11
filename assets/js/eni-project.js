/* OUKEI HUB ENI Project Init — Ver2.0.1
 * ENI is opt-in only: initialized when user adds code ENI in settings.
 */

function eniIsRegistered() {
  if (typeof pmGetProject !== 'function') return false;
  let p = pmGetProject('eni');
  return !!(p && p.registered);
}

function eniInitProjectData() {
  if (typeof settings === 'undefined') return false;
  if (!Array.isArray(settings.eniInputAccounts)) settings.eniInputAccounts = [];
  if (!settings.eniInvestmentHistory || typeof settings.eniInvestmentHistory !== 'object') {
    settings.eniInvestmentHistory = {};
  }
  if (!settings.eniSettings || typeof settings.eniSettings !== 'object') {
    settings.eniSettings = { schemaVersion: 1, rewardRules: null };
  }
  if (settings.portfolioGoal && settings.portfolioGoal.rates &&
      typeof settings.portfolioGoal.rates.eni !== 'number') {
    settings.portfolioGoal.rates.eni = 100;
  }
  if (typeof eniApplyOrgChart === 'function') {
    let packed = typeof eniPackOrgChart === 'function' ? eniPackOrgChart() : null;
    let empty = typeof hubCreateEmptyEniOrgChart === 'function'
      ? hubCreateEmptyEniOrgChart()
      : { members: [], currentData: [], scenarios: [], rootId: '', rootAccountIds: [], zoom: 1 };
    if (!packed || !Array.isArray(packed.members) || !packed.members.length) {
      eniApplyOrgChart(empty);
    }
  }
  return true;
}

function pmInitProjectData(projectKey) {
  if (projectKey === 'eni') eniInitProjectData();
}

function pmOnProjectsCommitted(prevKeys, nextKeys) {
  (nextKeys || []).forEach(function (key) {
    if ((prevKeys || []).indexOf(key) < 0 && typeof pmInitProjectData === 'function') {
      pmInitProjectData(key);
    }
  });
}

if (typeof window !== 'undefined') {
  window.eniIsRegistered = eniIsRegistered;
  window.eniInitProjectData = eniInitProjectData;
  window.pmInitProjectData = pmInitProjectData;
  window.pmOnProjectsCommitted = pmOnProjectsCommitted;
}
