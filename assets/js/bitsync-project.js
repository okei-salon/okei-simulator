/* OUKEI HUB BITSYNC Project Init — opt-in via code BITSYNC */

function bitsyncIsRegistered() {
  if (typeof pmGetProject !== 'function') return false;
  let p = pmGetProject('bitsync');
  return !!(p && p.registered);
}

function bitsyncInitProjectData() {
  if (typeof settings === 'undefined') return false;
  if (!Array.isArray(settings.bitsyncInputAccounts)) settings.bitsyncInputAccounts = [];
  if (typeof bitsyncMigrateInputAccountsFromRevenueLog === 'function') {
    bitsyncMigrateInputAccountsFromRevenueLog();
  }
  if (typeof bitsyncEnsureInputAccounts === 'function') bitsyncEnsureInputAccounts();
  if (settings.portfolioGoal && settings.portfolioGoal.rates &&
      typeof settings.portfolioGoal.rates.bitsync !== 'number') {
    settings.portfolioGoal.rates.bitsync = 100;
  }
  return true;
}

(function bitsyncHookProjectMaster() {
  if (typeof window === 'undefined') return;
  let prevInit = window.pmInitProjectData;
  let prevCommit = window.pmOnProjectsCommitted;

  window.pmInitProjectData = function (projectKey) {
    if (typeof prevInit === 'function') prevInit(projectKey);
    if (projectKey === 'bitsync') bitsyncInitProjectData();
  };

  window.pmOnProjectsCommitted = function (prevKeys, nextKeys) {
    if (typeof prevCommit === 'function') prevCommit(prevKeys, nextKeys);
    (nextKeys || []).forEach(function (key) {
      if ((prevKeys || []).indexOf(key) < 0 && key === 'bitsync') bitsyncInitProjectData();
    });
  };

  window.bitsyncIsRegistered = bitsyncIsRegistered;
  window.bitsyncInitProjectData = bitsyncInitProjectData;
})();
