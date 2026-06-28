/* ============================================================
 * おーちゃんセリフエンジン — OUKEI HUB おーちゃんシステム Ver.1
 *
 * カテゴリ判定は OCHAN_CATEGORY_META.condition → OCHAN_CONDITIONS
 * セリフ選定は OCHAN_LINES + requires（行単位フィルタ）
 *
 * 新カテゴリ追加: 辞書側で meta + lines +（必要なら）milestone 閾値
 * 新条件タイプ追加: OCHAN_CONDITIONS に1件（稀な拡張のみ）
 * ============================================================ */

var OCHAN_WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

var OCHAN_CONDITIONS = {
  goalAchieved: function (ctx) { return ctx.flags.goalAchieved; },
  recordHigh: function (ctx) { return ctx.flags.recordHigh; },
  streak: function (ctx) { return ctx.flags.streak; },
  monthlyMilestone: function (ctx) { return ctx.flags.monthlyMilestone; },
  dailyUp: function (ctx) { return ctx.flags.dailyUp; },
  inputComplete: function (ctx) { return ctx.flags.inputComplete; },
  inputPending: function (ctx) { return ctx.flags.inputPending; },
  timeMorning: function (ctx) { return ctx.flags.timeMorning; },
  timeAfternoon: function (ctx) { return ctx.flags.timeAfternoon; },
  timeEvening: function (ctx) { return ctx.flags.timeEvening; },
  birthday: function (ctx) { return ctx.flags.birthday; },
  eventChristmas: function (ctx) { return ctx.flags.events.event_christmas; },
  eventNewYear: function (ctx) { return ctx.flags.events.event_newyear; },
  assetMilestone: function (ctx) { return ctx.flags.assetMilestone; },
  projectAdded: function (ctx) { return ctx.flags.projectAdded; },
  loginMilestone: function (ctx) { return ctx.flags.loginMilestone; },
  monthStart: function (ctx) { return ctx.flags.monthStart; },
  monthEnd: function (ctx) { return ctx.flags.monthEnd; },
  weekdayGreeting: function (ctx) { return ctx.flags.weekdayGreeting; }
};

function getOchanDialect() {
  return settings.ochanDialect === 'kansai' ? 'kansai' : 'standard';
}

function setOchanDialect(value) {
  settings.ochanDialect = value === 'kansai' ? 'kansai' : 'standard';
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  if (typeof updateOchanMessage === 'function') updateOchanMessage();
}

function setOchanDialectLive(value) {
  setOchanDialect(value);
}

function formatOchanDollar(n, signed) {
  let v = Math.round((Number(n) || 0) * 100) / 100;
  let s = '$' + v.toLocaleString();
  if (signed && v > 0) return '+' + s;
  return s;
}

function applyOchanTemplate(text, vars) {
  if (!text) return '';
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, key) {
    if (vars && Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] != null ? String(vars[key]) : '';
    }
    return '';
  });
}

function isOchanDateInRange(refDate, from, to) {
  if (!from && !to) return true;
  let md = String(refDate.getMonth() + 1).padStart(2, '0') + '-' + String(refDate.getDate()).padStart(2, '0');
  if (from && to) {
    if (from <= to) return md >= from && md <= to;
    return md >= from || md <= to;
  }
  if (from) return md >= from;
  if (to) return md <= to;
  return true;
}

function isOchanLineActive(line, ctx) {
  if (line.active === false) return false;
  if (!isOchanDateInRange(ctx.refDate, line.activeFrom, line.activeTo)) return false;
  return lineMatchesRequires(line, ctx);
}

function lineMatchesRequires(line, ctx) {
  let req = line.requires;
  if (!req) return true;

  if (req.hasUserName && !ctx.vars.userName) return false;
  if (req.minStreak != null && ctx.streak < req.minStreak) return false;
  if (req.maxStreak != null && ctx.streak > req.maxStreak) return false;
  if (req.minActivityDays != null && ctx.activityDays < req.minActivityDays) return false;
  if (req.weekday != null) {
    let list = Array.isArray(req.weekday) ? req.weekday : [req.weekday];
    if (list.indexOf(ctx.weekday) < 0) return false;
  }
  if (req.event && !ctx.flags.events[req.event]) return false;
  if (req.minAsset != null && ctx.assetTotal < req.minAsset) return false;

  return true;
}

function getOchanTimeSlot(refDate) {
  let h = refDate.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  return 'evening';
}

function foreachRevenueEntry(fn) {
  if (typeof isHomeDemoActive === 'function' && isHomeDemoActive() && typeof HOME_DEMO_LOG !== 'undefined') {
    Object.keys(HOME_DEMO_LOG).forEach(function (key) {
      let entry = HOME_DEMO_LOG[key];
      if (entry) fn(key, entry);
    });
    return;
  }
  ensureRevenueLog();
  Object.keys(settings.revenueLog).forEach(function (key) {
    let entry = settings.revenueLog[key];
    if (entry) fn(key, entry);
  });
}

function getMaxDailyTotalBefore(keyExclude) {
  let max = 0;
  foreachRevenueEntry(function (key, entry) {
    if (keyExclude && key === keyExclude) return;
    max = Math.max(max, Number(entry.total) || 0);
  });
  return max;
}

function getMonthTotalBeforeToday(y, m, refDate) {
  let day = refDate.getDate();
  let total = 0;
  for (let d = 1; d < day; d++) {
    let entry = getRevenueEntry(revenueDateKey(y, m, d));
    if (entry) total += Number(entry.total) || 0;
  }
  return total;
}

function getMaxMonthlyTotalExcluding(y, m) {
  let byMonth = {};
  foreachRevenueEntry(function (key, entry) {
    let parts = key.split('-');
    if (parts.length < 3) return;
    let ym = parts[0] + '-' + parts[1];
    if (Number(parts[0]) === y && Number(parts[1]) === m + 1) return;
    byMonth[ym] = (byMonth[ym] || 0) + (Number(entry.total) || 0);
  });
  let max = 0;
  Object.keys(byMonth).forEach(function (ym) {
    max = Math.max(max, byMonth[ym]);
  });
  return max;
}

function getCrossedThreshold(total, before, list) {
  let hit = null;
  (list || []).forEach(function (t) {
    if (total >= t && before < t) hit = t;
  });
  return hit;
}

function buildOchanEventFlags(refDate) {
  let events = {};
  let cal = typeof OCHAN_EVENT_CALENDAR !== 'undefined' ? OCHAN_EVENT_CALENDAR : {};
  Object.keys(cal).forEach(function (key) {
    let range = cal[key];
    events[key] = isOchanDateInRange(refDate, range.from, range.to);
  });
  return events;
}

function getOchanUserName() {
  if (settings.ochanDisplayName) return String(settings.ochanDisplayName).trim();
  if (typeof members !== 'undefined' && typeof rootId !== 'undefined') {
    let root = members.find(function (m) { return m.id === rootId; });
    if (root && root.name && root.name !== '未入力') return root.name.replace(/さん$/, '');
  }
  return '';
}

function getOchanBirthdayMatch(refDate) {
  let bday = settings.ochanBirthday;
  if (!bday || typeof bday !== 'string') return false;
  let md = String(refDate.getMonth() + 1).padStart(2, '0') + '-' + String(refDate.getDate()).padStart(2, '0');
  return bday === md;
}

function getRecentProjectAdded() {
  let at = settings.ochanLastProjectAddedAt;
  let name = settings.ochanLastProjectName;
  if (!at) return null;
  let elapsed = Date.now() - new Date(at).getTime();
  if (elapsed < 0 || elapsed > 7 * 86400000) return null;
  return name || '新プロジェクト';
}

function getAssetTotalSnapshot() {
  if (typeof allOrgSummary === 'function') {
    let s = allOrgSummary();
    if (s && s.monthly) return Number(s.monthly) || 0;
  }
  return 0;
}

function getPreviousAssetSnapshot() {
  return Number(settings.ochanLastAssetSnapshot) || 0;
}

function isHomeInputAllComplete() {
  if (typeof getHomeActionProjects !== 'function') return false;
  let projects = getHomeActionProjects();
  if (!projects.length) return false;
  let entry = getRevenueEntry(todayKey());
  return projects.every(function (p) {
    return typeof isHomeProjectEnteredToday === 'function' && isHomeProjectEnteredToday(entry, p.key);
  });
}

function buildOchanContext() {
  let refDate = typeof getHomeReferenceDate === 'function' ? getHomeReferenceDate() : new Date();
  let y = refDate.getFullYear();
  let m = refDate.getMonth();
  let day = refDate.getDate();
  let daysInMonth = new Date(y, m + 1, 0).getDate();
  let todayK = typeof todayKey === 'function' ? todayKey() : revenueDateKey(y, m, day);
  let yesterdayK = typeof yesterdayKey === 'function' ? yesterdayKey() : null;

  let todayEntry = getRevenueEntry(todayK);
  let yesterdayEntry = yesterdayK ? getRevenueEntry(yesterdayK) : null;
  let todayTotal = todayEntry ? (Number(todayEntry.total) || 0) : 0;
  let yesterdayTotal = yesterdayEntry ? (Number(yesterdayEntry.total) || 0) : 0;
  let delta = todayTotal - yesterdayTotal;

  let monthLog = typeof sumMonthRevenueLog === 'function' ? sumMonthRevenueLog(y, m) : { total: 0, hasLog: false };
  let monthTotal = monthLog.total || 0;
  let monthBeforeToday = getMonthTotalBeforeToday(y, m, refDate);
  let monthlyMilestoneHit = getCrossedThreshold(
    monthTotal,
    monthBeforeToday,
    typeof OCHAN_MONTHLY_MILESTONES !== 'undefined' ? OCHAN_MONTHLY_MILESTONES : [1000, 3000, 5000, 10000]
  );

  let streak = typeof calcInputStreak === 'function' ? calcInputStreak() : 0;
  let activityDays = Number(settings.activityDays) || 0;
  let monthlyGoal = Number(settings.ochanMonthlyGoal) || 0;
  let remaining = monthlyGoal > 0 ? Math.max(0, monthlyGoal - monthTotal) : 0;

  let dailyRecord = todayTotal > 0 && todayTotal > getMaxDailyTotalBefore(todayK);
  let monthlyRecord = monthTotal > 0 && monthTotal > getMaxMonthlyTotalExcluding(y, m);

  let assetTotal = getAssetTotalSnapshot();
  let assetBefore = getPreviousAssetSnapshot();
  let assetMilestoneHit = getCrossedThreshold(
    assetTotal,
    assetBefore,
    typeof OCHAN_ASSET_MILESTONES !== 'undefined' ? OCHAN_ASSET_MILESTONES : [1000, 10000, 100000]
  );

  let loginMilestoneHit = null;
  let loginList = typeof OCHAN_LOGIN_MILESTONES !== 'undefined' ? OCHAN_LOGIN_MILESTONES : [7, 30, 100, 365];
  loginList.forEach(function (n) {
    if (activityDays === n) loginMilestoneHit = n;
  });

  let projectName = getRecentProjectAdded();
  let userName = getOchanUserName();
  let weekday = refDate.getDay();
  let timeSlot = getOchanTimeSlot(refDate);
  let events = buildOchanEventFlags(refDate);
  let inputComplete = isHomeInputAllComplete();

  let flags = {
    goalAchieved: monthlyGoal > 0 && monthTotal >= monthlyGoal,
    recordHigh: dailyRecord || monthlyRecord,
    streak: streak >= 2,
    monthlyMilestone: !!monthlyMilestoneHit,
    dailyUp: todayTotal > 0 && !!yesterdayEntry && delta > 0,
    inputComplete: inputComplete,
    inputPending: !inputComplete,
    timeMorning: timeSlot === 'morning',
    timeAfternoon: timeSlot === 'afternoon',
    timeEvening: timeSlot === 'evening',
    birthday: getOchanBirthdayMatch(refDate),
    assetMilestone: !!assetMilestoneHit,
    projectAdded: !!projectName,
    loginMilestone: loginMilestoneHit != null,
    monthStart: day === 1,
    monthEnd: day === daysInMonth,
    weekdayGreeting: true,
    events: events
  };

  let vars = {
    userName: userName,
    weekdayJa: OCHAN_WEEKDAY_JA[weekday],
    monthDayJa: (m + 1) + '月' + day + '日',
    activityDays: String(activityDays),
    activityDaysJa: activityDays + '日',
    deltaDollar: formatOchanDollar(Math.abs(delta)),
    deltaDollarSigned: formatOchanDollar(delta, true),
    todayDollar: formatOchanDollar(todayTotal),
    monthlyDollar: formatOchanDollar(monthTotal),
    milestoneDollar: monthlyMilestoneHit ? formatOchanDollar(monthlyMilestoneHit) : '',
    assetDollar: formatOchanDollar(assetTotal),
    assetMilestoneDollar: assetMilestoneHit ? formatOchanDollar(assetMilestoneHit) : '',
    remainingDollar: formatOchanDollar(remaining),
    monthlyGoal: formatOchanDollar(monthlyGoal),
    streakDays: String(streak),
    streakDaysJa: streak + '日',
    projectName: projectName || '',
    loginMilestoneDays: loginMilestoneHit != null ? String(loginMilestoneHit) : ''
  };

  return {
    refDate: refDate,
    weekday: weekday,
    timeSlot: timeSlot,
    streak: streak,
    activityDays: activityDays,
    assetTotal: assetTotal,
    todayTotal: todayTotal,
    monthTotal: monthTotal,
    milestone: monthlyMilestoneHit,
    assetMilestone: assetMilestoneHit,
    loginMilestone: loginMilestoneHit,
    flags: flags,
    vars: vars
  };
}

function isOchanCategoryEnabled(meta) {
  return meta && meta.enabled !== false;
}

function evaluateOchanMatches(ctx) {
  if (typeof OCHAN_CATEGORY_META === 'undefined') return [];
  let matches = [];

  Object.keys(OCHAN_CATEGORY_META).forEach(function (catKey) {
    let meta = OCHAN_CATEGORY_META[catKey];
    if (!isOchanCategoryEnabled(meta)) return;
    if (!meta.condition) return;
    let fn = OCHAN_CONDITIONS[meta.condition];
    if (!fn || !fn(ctx)) return;
    matches.push({
      category: catKey,
      priority: meta.priority,
      vars: ctx.vars
    });
  });

  return matches;
}

function pickOchanLine(ctx) {
  if (typeof OCHAN_LINES_BY_CATEGORY === 'undefined' || typeof OCHAN_CATEGORY_META === 'undefined') {
    return '今日も一緒にいこう！';
  }

  let matches = evaluateOchanMatches(ctx);
  if (!matches.length) return '今日も一緒にいこう！';

  matches.sort(function (a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return 0;
  });

  let topPriority = matches[0].priority;
  let topMatches = matches.filter(function (m) { return m.priority === topPriority; });
  let chosen = topMatches[Math.floor(Math.random() * topMatches.length)];
  let pool = OCHAN_LINES_BY_CATEGORY[chosen.category] || [];
  let active = pool.filter(function (line) {
    return isOchanLineActive(line, ctx);
  });
  if (!active.length) return '今日も一緒にいこう！';

  let line = active[Math.floor(Math.random() * active.length)];
  let dialect = getOchanDialect();
  let raw = dialect === 'kansai' ? (line.kansai || line.standard) : (line.standard || line.kansai);
  return applyOchanTemplate(raw, chosen.vars);
}

function updateOchanMessage() {
  let el = document.getElementById('ochanMessageText');
  if (!el) return;
  let ctx = buildOchanContext();
  el.textContent = pickOchanLine(ctx);
}

function notifyOchanProjectAdded(name) {
  settings.ochanLastProjectAddedAt = new Date().toISOString();
  settings.ochanLastProjectName = name || '';
  if (typeof markSettingsDirty === 'function') markSettingsDirty();
  if (typeof updateOchanMessage === 'function') updateOchanMessage();
}
