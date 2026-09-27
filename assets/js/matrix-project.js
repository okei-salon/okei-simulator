/* OUKEI HUB MATRIX Project Init — opt-in via code MATRIX */

function matrixIsRegistered() {
  if (typeof pmGetProject !== 'function') return false;
  let p = pmGetProject('matrix');
  return !!(p && p.registered);
}

function matrixInitProjectData() {
  if (typeof settings === 'undefined') return false;
  if (!Array.isArray(settings.matrixInputAccounts)) settings.matrixInputAccounts = [];
  if (typeof matrixMigrateInputAccountsFromRevenueLog === 'function') {
    matrixMigrateInputAccountsFromRevenueLog();
  }
  if (settings.portfolioGoal && settings.portfolioGoal.rates &&
      typeof settings.portfolioGoal.rates.matrix !== 'number') {
    settings.portfolioGoal.rates.matrix = 100;
  }
  return true;
}

(function matrixHookProjectMaster() {
  if (typeof window === 'undefined') return;
  let prevInit = window.pmInitProjectData;
  let prevCommit = window.pmOnProjectsCommitted;

  window.pmInitProjectData = function (projectKey) {
    if (typeof prevInit === 'function') prevInit(projectKey);
    if (projectKey === 'matrix') matrixInitProjectData();
  };

  window.pmOnProjectsCommitted = function (prevKeys, nextKeys) {
    if (typeof prevCommit === 'function') prevCommit(prevKeys, nextKeys);
    (nextKeys || []).forEach(function (key) {
      if ((prevKeys || []).indexOf(key) < 0 && key === 'matrix') matrixInitProjectData();
    });
  };

  window.matrixIsRegistered = matrixIsRegistered;
  window.matrixInitProjectData = matrixInitProjectData;
})();
