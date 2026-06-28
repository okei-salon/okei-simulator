/* ============================================================
 * おーちゃんセリフ辞書 — OUKEI HUB おーちゃんシステム Ver.1
 *
 * 【セリフ追加】 OCHAN_LINES に1件追加するだけ（エンジン変更不要）
 * 【カテゴリ追加】 OCHAN_CATEGORY_META に condition を指定して追加
 *   → enabled: true にすれば即反映（条件判定はエンジン側レジストリ済み）
 *
 * --- 辞書1件のフィールド ---
 *   id, category, standard, kansai
 *   activeFrom / activeTo … MM-DD（季節・イベント期間フィルタ）
 *   requires … 行単位の追加条件（辞書のみで細分化可能）
 *     例: { minStreak: 7, weekday: [1,5], hasUserName: true, event: 'event_christmas' }
 *
 * --- テンプレート変数 {name}（buildOchanContext が自動生成）---
 *   userName           … ユーザー名（設定 or ルートアカウント名）
 *   weekdayJa          … 月・火…
 *   monthDayJa         … 6月30日
 *   activityDays       … ログイン/活動日数
 *   activityDaysJa     … 30日
 *   deltaDollarSigned  … +$38
 *   deltaDollar        … $38
 *   todayDollar        … 今日 $448
 *   monthlyDollar      … 今月 $4,120
 *   milestoneDollar  … 突破大台 $5,000
 *   assetDollar        … 資産/収益サマリー $10,000
 *   assetMilestoneDollar … 資産節目 $10,000
 *   remainingDollar    … 目標まで $120
 *   monthlyGoal        … 目標 $5,000
 *   streakDays / streakDaysJa
 *   projectName        … 新規追加プロジェクト名
 *   loginMilestoneDays … 7（ログイン節目）
 *
 * --- 将来カテゴリ追加手順 ---
 *   1. OCHAN_CATEGORY_META に { priority, label, condition, enabled: true }
 *   2. OCHAN_LINES にセリフを追加
 *   3. 必要なら OCHAN_EVENT_CALENDAR / OCHAN_*_MILESTONES に閾値追加
 * ============================================================ */

var OCHAN_CATEGORY_META = {
  /* --- Ver.1 有効カテゴリ --- */
  goal_achieved: { priority: 1, label: '目標達成', condition: 'goalAchieved' },
  record_high: { priority: 2, label: '過去最高更新', condition: 'recordHigh' },
  streak: { priority: 3, label: '連続達成', condition: 'streak' },
  monthly_milestone: { priority: 4, label: '今月収益突破', condition: 'monthlyMilestone' },
  daily_up: { priority: 5, label: '昨日より収益アップ', condition: 'dailyUp' },
  input_complete: { priority: 6, label: '今日入力完了', condition: 'inputComplete' },
  input_pending: { priority: 7, label: '今日未入力', condition: 'inputPending' },
  greeting_morning: { priority: 8, label: '朝', condition: 'timeMorning' },
  greeting_afternoon: { priority: 8, label: '昼', condition: 'timeAfternoon' },
  greeting_evening: { priority: 8, label: '夜', condition: 'timeEvening' },

  /* --- 将来カテゴリ（enabled: false → セリフ追加後に true へ） --- */
  birthday: { priority: 2, label: '誕生日', condition: 'birthday', enabled: false },
  event_christmas: { priority: 2, label: 'クリスマス', condition: 'eventChristmas', enabled: false },
  event_newyear: { priority: 2, label: '正月', condition: 'eventNewYear', enabled: false },
  asset_milestone: { priority: 4, label: '資産節目', condition: 'assetMilestone', enabled: false },
  project_added: { priority: 5, label: 'プロジェクト追加', condition: 'projectAdded', enabled: false },
  login_milestone: { priority: 6, label: 'ログイン節目', condition: 'loginMilestone', enabled: false },
  month_start: { priority: 7, label: '月初', condition: 'monthStart', enabled: false },
  month_end: { priority: 7, label: '月末', condition: 'monthEnd', enabled: false },
  weekday: { priority: 8, label: '曜日', condition: 'weekdayGreeting', enabled: false }
};

/** 月次収益の大台突破ライン（USD） */
var OCHAN_MONTHLY_MILESTONES = [1000, 3000, 5000, 10000, 20000];

/** 資産・収益サマリーの節目（USD）— 将来 category: asset_milestone 用 */
var OCHAN_ASSET_MILESTONES = [1000, 10000, 100000];

/** 活動日数の節目 — 将来 category: login_milestone 用 */
var OCHAN_LOGIN_MILESTONES = [7, 30, 100, 365];

/**
 * 季節イベント期間（MM-DD）
 * カテゴリ condition と対応。セリフは activeFrom/To でも絞れる。
 */
var OCHAN_EVENT_CALENDAR = {
  event_christmas: { from: '12-01', to: '12-25' },
  event_newyear: { from: '01-01', to: '01-07' },
  event_halloween: { from: '10-20', to: '10-31' }
};

var OCHAN_LINES = [
  /* --- 目標達成 --- */
  { id: 'goal_001', category: 'goal_achieved', standard: '最高！今月の目標クリア！', kansai: '最高！今月の目標クリアや！' },
  { id: 'goal_002', category: 'goal_achieved', standard: 'やった！{monthlyGoal}達成！', kansai: 'やった！{monthlyGoal}達成や！' },
  { id: 'goal_003', category: 'goal_achieved', standard: '目標達成！その調子！', kansai: '目標達成！その調子や！' },
  { id: 'goal_004', category: 'goal_achieved', standard: '今月{monthlyGoal}いった！最高！', kansai: '今月{monthlyGoal}いった！最高や！' },
  { id: 'goal_005', category: 'goal_achieved', requires: { hasUserName: true }, standard: '{userName}、目標達成！最高！', kansai: '{userName}、目標達成！最高や！' },

  /* --- 過去最高更新 --- */
  { id: 'record_001', category: 'record_high', standard: '過去最高更新！{todayDollar}！', kansai: '過去最高更新！{todayDollar}や！' },
  { id: 'record_002', category: 'record_high', standard: '今月{monthlyDollar}で過去最高！', kansai: '今月{monthlyDollar}で過去最高や！' },
  { id: 'record_003', category: 'record_high', standard: '新記録！めっちゃいい感じ！', kansai: '新記録！めっちゃええ感じ！' },
  { id: 'record_004', category: 'record_high', standard: '最高更新！今日も積み重ねられたね！', kansai: '最高更新！今日も積み重ねられたな！' },

  /* --- 連続達成 --- */
  { id: 'streak_001', category: 'streak', standard: '{streakDaysJa}連続！その調子！', kansai: '{streakDaysJa}連続！その調子や！' },
  { id: 'streak_002', category: 'streak', standard: '{streakDaysJa}連続入力！最高！', kansai: '{streakDaysJa}連続入力！最高や！' },
  { id: 'streak_003', category: 'streak', standard: '{streakDays}日続いてる！えらい！', kansai: '{streakDays}日続いてる！えらいで！' },
  { id: 'streak_004', category: 'streak', standard: '{streakDaysJa}連続！今日も積み重ね！', kansai: '{streakDaysJa}連続！今日も積み重ね！' },
  { id: 'streak_005', category: 'streak', requires: { minStreak: 7 }, standard: '{streakDaysJa}連続！習慣になってきたね！', kansai: '{streakDaysJa}連続！習慣になってきたな！' },

  /* --- 今月収益突破 --- */
  { id: 'milestone_001', category: 'monthly_milestone', standard: '今月{milestoneDollar}突破！', kansai: '今月{milestoneDollar}突破や！' },
  { id: 'milestone_002', category: 'monthly_milestone', standard: '今月{milestoneDollar}超えた！すごい！', kansai: '今月{milestoneDollar}超えた！すごいで！' },
  { id: 'milestone_003', category: 'monthly_milestone', standard: '{milestoneDollar}の大台きた！', kansai: '{milestoneDollar}の大台きたで！' },
  { id: 'milestone_004', category: 'monthly_milestone', standard: '今月{milestoneDollar}！その調子！', kansai: '今月{milestoneDollar}！その調子や！' },

  /* --- 昨日より収益アップ --- */
  { id: 'dailyup_001', category: 'daily_up', standard: '昨日より{deltaDollarSigned}！その調子！', kansai: '昨日より{deltaDollarSigned}！その調子や！' },
  { id: 'dailyup_002', category: 'daily_up', standard: '昨日より{deltaDollarSigned}上がってる！最高！', kansai: '昨日より{deltaDollarSigned}上がってる！最高や！' },
  { id: 'dailyup_003', category: 'daily_up', standard: '{deltaDollarSigned}アップ！いい流れ！', kansai: '{deltaDollarSigned}アップ！ええ流れや！' },
  { id: 'dailyup_004', category: 'daily_up', standard: '昨日より{deltaDollarSigned}！今日も積み重ね！', kansai: '昨日より{deltaDollarSigned}！今日も積み重ね！' },

  /* --- 今日入力完了 --- */
  { id: 'complete_001', category: 'input_complete', standard: '今日も入力完了！気持ちいいね！', kansai: '今日も入力完了！気持ちええで！' },
  { id: 'complete_002', category: 'input_complete', standard: '今日も入力ありがとう！', kansai: '今日も入力おおきに！' },
  { id: 'complete_003', category: 'input_complete', standard: '今日も積み重ねられたね！', kansai: '今日も積み重ねられたな！' },
  { id: 'complete_004', category: 'input_complete', standard: '入力完了！その調子！', kansai: '入力完了！その調子や！' },
  { id: 'complete_005', category: 'input_complete', standard: '今日も一歩前進！最高！', kansai: '今日も一歩前進！最高や！' },

  /* --- 今日未入力（応援のみ・指示なし） --- */
  { id: 'pending_001', category: 'input_pending', standard: '今日も待ってるよ！', kansai: '今日も待っとるで！' },
  { id: 'pending_002', category: 'input_pending', standard: '時間あるときにやろう！', kansai: '時間あるときにやろな！' },
  { id: 'pending_003', category: 'input_pending', standard: '入力したら今日も気持ちいいね！', kansai: '入力したら今日も気持ちええで！' },
  { id: 'pending_004', category: 'input_pending', standard: '今日も一緒に積み重ねよう！', kansai: '今日も一緒に積み重ねよな！' },
  { id: 'pending_005', category: 'input_pending', standard: 'ゆっくりで大丈夫！', kansai: 'ゆっくりでええで！' },

  /* --- 朝 --- */
  { id: 'morning_001', category: 'greeting_morning', standard: 'おはよう！今日もいこう！', kansai: 'おはよう！今日もいこか！' },
  { id: 'morning_002', category: 'greeting_morning', standard: 'おはよう！今日もよろしく！', kansai: 'おはよう！今日もよろしくな！' },
  { id: 'morning_003', category: 'greeting_morning', requires: { hasUserName: true }, standard: 'おはよう{userName}！今日もいこう！', kansai: 'おはよう{userName}！今日もいこか！' },

  /* --- 昼 --- */
  { id: 'afternoon_001', category: 'greeting_afternoon', standard: 'こんにちは！調子どう？', kansai: 'こんにちは！調子どう？' },
  { id: 'afternoon_002', category: 'greeting_afternoon', standard: '午後もいこう！', kansai: '午後もいこか！' },
  { id: 'afternoon_003', category: 'greeting_afternoon', standard: '今日も順調？その調子！', kansai: '今日も順調？その調子や！' },

  /* --- 夜 --- */
  { id: 'evening_001', category: 'greeting_evening', standard: 'お疲れさま！今日もおつかれ！', kansai: 'お疲れさま！今日もおつかれ！' },
  { id: 'evening_002', category: 'greeting_evening', standard: '夜や！今日もよく頑張ったね！', kansai: '夜や！今日もよく頑張ったな！' },
  { id: 'evening_003', category: 'greeting_evening', standard: '今日も一日おつかれ！', kansai: '今日も一日おつかれ！' }

  /* --- 将来セリフ例（カテゴリ enabled 後に追加） ---
  { id: 'birthday_001', category: 'birthday', standard: 'Happy Birthday {userName}！', kansai: 'Happy Birthday {userName}！' },
  { id: 'xmas_001', category: 'event_christmas', activeFrom: '12-01', activeTo: '12-25', standard: 'メリークリスマス！', kansai: 'メリークリスマスや！' },
  { id: 'asset_001', category: 'asset_milestone', standard: '{assetMilestoneDollar}突破！すごい！', kansai: '{assetMilestoneDollar}突破！すごいで！' },
  { id: 'project_001', category: 'project_added', standard: '{projectName}追加！一緒にいこう！', kansai: '{projectName}追加！一緒にいこか！' },
  { id: 'login_001', category: 'login_milestone', standard: '{loginMilestoneDays}日目！ありがとう！', kansai: '{loginMilestoneDays}日目！おおきに！' },
  { id: 'monthstart_001', category: 'month_start', standard: '新しい月が始まった！いこう！', kansai: '新しい月が始まった！いこか！' },
  --- */
];

(function buildOchanLineIndex() {
  var byCategory = {};
  OCHAN_LINES.forEach(function (line) {
    if (!byCategory[line.category]) byCategory[line.category] = [];
    byCategory[line.category].push(line);
  });
  if (typeof window !== 'undefined') {
    window.OCHAN_LINES_BY_CATEGORY = byCategory;
  }
})();
