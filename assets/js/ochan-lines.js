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
  month_end: { priority: 7, label: '月末・締め日', condition: 'monthEnd' },
  month_start: { priority: 7, label: '月初・スタート', condition: 'monthStart' },
  season_greeting: { priority: 7, label: '季節イベント', condition: 'seasonGreeting' },
  greeting_morning: { priority: 8, label: '朝', condition: 'timeMorning' },
  greeting_afternoon: { priority: 8, label: '昼', condition: 'timeAfternoon' },
  greeting_evening: { priority: 8, label: '夜', condition: 'timeEvening' },
  greeting_general: { priority: 8, label: '通常あいさつ', condition: 'greetingGeneral' },

  /* --- 将来・特別（enabled: false → 有効化は辞書側のみ） --- */
  birthday: { priority: 2, label: '誕生日', condition: 'birthday', enabled: false },
  event_christmas: { priority: 2, label: 'クリスマス', condition: 'eventChristmas', enabled: false },
  event_newyear: { priority: 2, label: '正月', condition: 'eventNewYear', enabled: false },
  asset_milestone: { priority: 4, label: '資産節目', condition: 'assetMilestone', enabled: false },
  project_added: { priority: 5, label: 'プロジェクト追加', condition: 'projectAdded', enabled: false },
  event_special: { priority: 5, label: '特別イベント', condition: 'specialEvent', enabled: false },
  login_milestone: { priority: 6, label: 'ログイン節目', condition: 'loginMilestone', enabled: false },
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
  /* --- 目標達成（Ver.1 辞書 20件） --- */
  { id: 'goal_001', category: 'goal_achieved', standard: '目標達成！！最高だね！', kansai: '目標達成や！！最高や！' },
  { id: 'goal_002', category: 'goal_achieved', standard: 'やったね！おめでとう！', kansai: 'やったやん！おめでとう！' },
  { id: 'goal_003', category: 'goal_achieved', standard: '今日の主役だね！', kansai: '今日の主役や！' },
  { id: 'goal_004', category: 'goal_achieved', standard: '積み重ねが結果になったね！', kansai: '積み重ねが結果になったな！' },
  { id: 'goal_005', category: 'goal_achieved', standard: '本当にすごい！', kansai: 'ほんますごいで！' },
  { id: 'goal_006', category: 'goal_achieved', standard: '今日は自分を褒めよう！', kansai: '今日は自分褒めたってや！' },
  { id: 'goal_007', category: 'goal_achieved', standard: '最高の一日だね！', kansai: '最高の一日や！' },
  { id: 'goal_008', category: 'goal_achieved', standard: 'この瞬間が嬉しいね！', kansai: 'この瞬間がたまらんな！' },
  { id: 'goal_009', category: 'goal_achieved', standard: 'やればできるね！', kansai: 'やればできるやん！' },
  { id: 'goal_010', category: 'goal_achieved', standard: 'また一つ夢に近づいた！', kansai: 'また夢に近づいたで！' },
  { id: 'goal_011', category: 'goal_achieved', standard: '今日は記念日だね！', kansai: '今日は記念日やな！' },
  { id: 'goal_012', category: 'goal_achieved', standard: '本当にお疲れさま！', kansai: 'ほんまよう頑張った！' },
  { id: 'goal_013', category: 'goal_achieved', standard: 'ここまで積み上げた自分に拍手！', kansai: 'ここまで積み上げた自分に拍手や！' },
  { id: 'goal_014', category: 'goal_achieved', standard: 'この景色、最高だね！', kansai: 'この景色最高やな！' },
  { id: 'goal_015', category: 'goal_achieved', standard: 'また次の目標が楽しみ！', kansai: '次の目標も楽しみや！' },
  { id: 'goal_016', category: 'goal_achieved', standard: '努力がちゃんと形になったね！', kansai: '努力がちゃんと形になったな！' },
  { id: 'goal_017', category: 'goal_achieved', standard: '今日は思いっきり喜ぼう！', kansai: '今日は思いっきり喜ぼ！' },
  { id: 'goal_018', category: 'goal_achieved', standard: '未来がもっと楽しみになったね！', kansai: '未来がもっと楽しみになったな！' },
  { id: 'goal_019', category: 'goal_achieved', standard: 'この達成感、最高！', kansai: 'この達成感、最高や！' },
  { id: 'goal_020', category: 'goal_achieved', standard: '次も一緒に積み上げよう！', kansai: '次も一緒に積み上げよ！' },

  /* --- 過去最高更新 --- */
  { id: 'record_001', category: 'record_high', standard: '過去最高更新！{todayDollar}！', kansai: '過去最高更新！{todayDollar}や！' },
  { id: 'record_002', category: 'record_high', standard: '今月{monthlyDollar}で過去最高！', kansai: '今月{monthlyDollar}で過去最高や！' },
  { id: 'record_003', category: 'record_high', standard: '新記録！めっちゃいい感じ！', kansai: '新記録！めっちゃええ感じ！' },
  { id: 'record_004', category: 'record_high', standard: '最高更新！今日も積み重ねられたね！', kansai: '最高更新！今日も積み重ねられたな！' },

  /* --- 連続入力（Ver.1 辞書 20件） --- */
  { id: 'streak_001', category: 'streak', standard: '今日で{streakDaysJa}連続！すごい！', kansai: '今日で{streakDaysJa}連続や！すごい！' },
  { id: 'streak_002', category: 'streak', standard: '継続って本当に強いね！', kansai: '継続ってほんま強いな！' },
  { id: 'streak_003', category: 'streak', standard: '今日も記録更新！', kansai: '今日も記録更新や！' },
  { id: 'streak_004', category: 'streak', standard: '毎日の積み重ね、最高！', kansai: '毎日の積み重ね最高や！' },
  { id: 'streak_005', category: 'streak', standard: 'ここまで続けたね！', kansai: 'ようここまで続けたな！' },
  { id: 'streak_006', category: 'streak', standard: 'いい習慣になってきたね！', kansai: 'ええ習慣になってきたな！' },
  { id: 'streak_007', category: 'streak', standard: '今日も未来に近づいた！', kansai: '今日も未来に近づいたで！' },
  { id: 'streak_008', category: 'streak', standard: 'コツコツ最強！', kansai: 'コツコツ最強や！' },
  { id: 'streak_009', category: 'streak', standard: 'この調子ならもっと伸びるね！', kansai: 'この調子ならもっと伸びるで！' },
  { id: 'streak_010', category: 'streak', standard: '今日も積み上げ完了！', kansai: '今日も積み上げ完了や！' },
  { id: 'streak_011', category: 'streak', standard: '続けるってかっこいいね！', kansai: '続けるってかっこええな！' },
  { id: 'streak_012', category: 'streak', standard: '今日も自分との約束を守れたね！', kansai: '今日も自分との約束守れたな！' },
  { id: 'streak_013', category: 'streak', standard: '毎日続けてるの、本当にすごい！', kansai: '毎日続けとるん、ほんますごい！' },
  { id: 'streak_014', category: 'streak', standard: '今日もいい流れ！', kansai: '今日もええ流れや！' },
  { id: 'streak_015', category: 'streak', standard: '習慣が一番の武器だね！', kansai: '習慣が一番の武器や！' },
  { id: 'streak_016', category: 'streak', standard: 'また記録が伸びたね！', kansai: 'また記録伸びたな！' },
  { id: 'streak_017', category: 'streak', standard: '今日もナイス継続！', kansai: '今日もナイス継続や！' },
  { id: 'streak_018', category: 'streak', standard: 'この積み重ねが未来を作るよ！', kansai: 'この積み重ねが未来を作るで！' },
  { id: 'streak_019', category: 'streak', standard: '一歩ずつ、でも確実だね！', kansai: '一歩ずつやけど確実や！' },
  { id: 'streak_020', category: 'streak', standard: '明日も一緒に積み上げよう！', kansai: '明日も一緒に積み上げよ！' },

  /* --- 今月収益突破 --- */
  { id: 'milestone_001', category: 'monthly_milestone', standard: '今月{milestoneDollar}突破！', kansai: '今月{milestoneDollar}突破や！' },
  { id: 'milestone_002', category: 'monthly_milestone', standard: '今月{milestoneDollar}超えた！すごい！', kansai: '今月{milestoneDollar}超えた！すごいで！' },
  { id: 'milestone_003', category: 'monthly_milestone', standard: '{milestoneDollar}の大台きた！', kansai: '{milestoneDollar}の大台きたで！' },
  { id: 'milestone_004', category: 'monthly_milestone', standard: '今月{milestoneDollar}！その調子！', kansai: '今月{milestoneDollar}！その調子や！' },

  /* --- 収益アップ / 昨日より収益アップ（Ver.1 辞書 20件） --- */
  { id: 'dailyup_001', category: 'daily_up', standard: '昨日より{deltaDollarSigned}！いい流れだね！', kansai: '昨日より{deltaDollarSigned}や！ええ流れや！' },
  { id: 'dailyup_002', category: 'daily_up', standard: '今日もしっかり積み上がったね！', kansai: '今日もしっかり積み上がったな！' },
  { id: 'dailyup_003', category: 'daily_up', standard: '昨日の自分を超えたね！', kansai: '昨日の自分超えたやん！' },
  { id: 'dailyup_004', category: 'daily_up', standard: 'この調子でいこう！', kansai: 'この調子でいこか！' },
  { id: 'dailyup_005', category: 'daily_up', standard: '利益が育ってきたね！', kansai: '利益育ってきたな！' },
  { id: 'dailyup_006', category: 'daily_up', standard: '今日もいい感じ！', kansai: '今日もええ感じや！' },
  { id: 'dailyup_007', category: 'daily_up', standard: 'また一歩前進！', kansai: 'また一歩前進や！' },
  { id: 'dailyup_008', category: 'daily_up', standard: 'コツコツが結果になってきたね！', kansai: 'コツコツが結果になってきたな！' },
  { id: 'dailyup_009', category: 'daily_up', standard: '今日も未来に近づいたね！', kansai: '今日も未来に近づいたで！' },
  { id: 'dailyup_010', category: 'daily_up', standard: 'いいペースで伸びてる！', kansai: 'ええペースで伸びとる！' },
  { id: 'dailyup_011', category: 'daily_up', standard: '積み重ねってやっぱり強いね！', kansai: '積み重ねってほんま強いな！' },
  { id: 'dailyup_012', category: 'daily_up', standard: '今日の数字、最高だね！', kansai: '今日の数字、最高や！' },
  { id: 'dailyup_013', category: 'daily_up', standard: '昨日より伸びてるよ！', kansai: '昨日より伸びとるで！' },
  { id: 'dailyup_014', category: 'daily_up', standard: 'また新しい記録だね！', kansai: 'また新しい記録やな！' },
  { id: 'dailyup_015', category: 'daily_up', standard: 'この流れ、好きだな！', kansai: 'この流れ好きやわ！' },
  { id: 'dailyup_016', category: 'daily_up', standard: '今日もナイス収益！', kansai: '今日もナイス収益や！' },
  { id: 'dailyup_017', category: 'daily_up', standard: '今日も笑顔になれる数字だね！', kansai: '今日も笑顔になれる数字やな！' },
  { id: 'dailyup_018', category: 'daily_up', standard: 'また未来が楽しみになったね！', kansai: 'また未来が楽しみになってきた！' },
  { id: 'dailyup_019', category: 'daily_up', standard: '今日もいい一日だったね！', kansai: '今日もええ一日やったな！' },
  { id: 'dailyup_020', category: 'daily_up', standard: 'この積み重ね、きっと大きくなるよ！', kansai: 'この積み重ね、きっと大きなるで！' },

  /* --- 今日入力完了（Ver.1 辞書 20件） --- */
  { id: 'complete_001', category: 'input_complete', standard: '今日も入力ありがとう！', kansai: '今日も入力ありがとうな！' },
  { id: 'complete_002', category: 'input_complete', standard: '今日も一歩前に進んだね！', kansai: '今日も一歩前に進んだな！' },
  { id: 'complete_003', category: 'input_complete', standard: '今日も積み上げ完了！', kansai: '今日も積み上げ完了や！' },
  { id: 'complete_004', category: 'input_complete', standard: 'その調子！', kansai: 'その調子や！' },
  { id: 'complete_005', category: 'input_complete', standard: '今日もいい感じ！', kansai: '今日もええ感じや！' },
  { id: 'complete_006', category: 'input_complete', standard: 'また今日も未来に近づいたね！', kansai: 'また今日も未来に近づいたな！' },
  { id: 'complete_007', category: 'input_complete', standard: 'コツコツ続けるのって強いね！', kansai: 'コツコツ続けるんが一番強いで！' },
  { id: 'complete_008', category: 'input_complete', standard: '今日もちゃんと積み上がったね！', kansai: '今日もちゃんと積み上がったな！' },
  { id: 'complete_009', category: 'input_complete', standard: '今日も最高！', kansai: '今日も最高や！' },
  { id: 'complete_010', category: 'input_complete', standard: 'またひとつ記録できたね！', kansai: 'またひとつ記録できたな！' },
  { id: 'complete_011', category: 'input_complete', standard: '今日もナイス！', kansai: '今日もナイスや！' },
  { id: 'complete_012', category: 'input_complete', standard: 'この調子なら楽しみだね！', kansai: 'この調子なら楽しみやな！' },
  { id: 'complete_013', category: 'input_complete', standard: '今日もちゃんと続けられたね！', kansai: '今日もちゃんと続けられたな！' },
  { id: 'complete_014', category: 'input_complete', standard: '積み重ねってやっぱり強いね！', kansai: '積み重ねってやっぱ強いな！' },
  { id: 'complete_015', category: 'input_complete', standard: '今日もいい一日だったね！', kansai: '今日もええ一日やったな！' },
  { id: 'complete_016', category: 'input_complete', standard: '未来の自分が喜んでるよ！', kansai: '未来の自分も喜んどるで！' },
  { id: 'complete_017', category: 'input_complete', standard: '今日もありがとう！', kansai: '今日もおおきにな！' },
  { id: 'complete_018', category: 'input_complete', standard: 'また明日も一緒に積み上げよう！', kansai: 'また明日も一緒に積み上げよな！' },
  { id: 'complete_019', category: 'input_complete', standard: 'ちゃんと続けてるの、本当にすごいよ！', kansai: 'ちゃんと続けとるん、ほんますごいで！' },
  { id: 'complete_020', category: 'input_complete', standard: '今日も未来への投資完了！', kansai: '今日も未来への投資完了や！' },

  /* --- 未入力・入力待ち（Ver.1 辞書 20件・応援のみ） --- */
  { id: 'pending_001', category: 'input_pending', standard: '今日も待ってるよ！', kansai: '今日も待っとるで！' },
  { id: 'pending_002', category: 'input_pending', standard: '入力したら今日も完成！', kansai: '入力したら今日も完成や！' },
  { id: 'pending_003', category: 'input_pending', standard: 'あと少し！', kansai: 'あとちょっとや！' },
  { id: 'pending_004', category: 'input_pending', standard: '今日も一緒に積み上げよう！', kansai: '今日も一緒に積み上げよ！' },
  { id: 'pending_005', category: 'input_pending', standard: '忘れる前に入力しよう！', kansai: '忘れる前に入力や！' },
  { id: 'pending_006', category: 'input_pending', standard: '今日の記録を残そう！', kansai: '今日の記録残しとこ！' },
  { id: 'pending_007', category: 'input_pending', standard: '未来の自分が喜ぶよ！', kansai: '未来の自分が喜ぶで！' },
  { id: 'pending_008', category: 'input_pending', standard: '今日も楽しみに待ってる！', kansai: '今日も待っとるで！' },
  { id: 'pending_009', category: 'input_pending', standard: '一緒に続けよう！', kansai: '一緒に続けよ！' },
  { id: 'pending_010', category: 'input_pending', standard: '今日もあと一歩！', kansai: '今日もあと一歩や！' },
  { id: 'pending_011', category: 'input_pending', standard: '今日もコツコツいこう！', kansai: '今日もコツコツいこ！' },
  { id: 'pending_012', category: 'input_pending', standard: '入力したらスッキリするよ！', kansai: '入力したらスッキリや！' },
  { id: 'pending_013', category: 'input_pending', standard: '今日もいい一日にしよう！', kansai: '今日もええ一日にしよ！' },
  { id: 'pending_014', category: 'input_pending', standard: '一日一歩！', kansai: '一日一歩や！' },
  { id: 'pending_015', category: 'input_pending', standard: '今日も応援してる！', kansai: '今日も応援しとる！' },
  { id: 'pending_016', category: 'input_pending', standard: '今日も未来へ！', kansai: '今日も未来へ！' },
  { id: 'pending_017', category: 'input_pending', standard: '入力すると気持ちいいよ！', kansai: '入力すると気持ちええで！' },
  { id: 'pending_018', category: 'input_pending', standard: '今日もよろしく！', kansai: '今日もよろしくや！' },
  { id: 'pending_019', category: 'input_pending', standard: 'またあとで会おう！', kansai: 'またあとで会おな！' },
  { id: 'pending_020', category: 'input_pending', standard: '今日も楽しもう！', kansai: '今日も楽しも！' },

  /* --- 月末・締め日（Ver.1 辞書 20件） --- */
  { id: 'monthend_001', category: 'month_end', standard: '今月もあと少し！最後までいこう！', kansai: '今月もあと少しや！最後までいこ！' },
  { id: 'monthend_002', category: 'month_end', standard: 'ラストスパートだね！', kansai: 'ラストスパートや！' },
  { id: 'monthend_003', category: 'month_end', standard: '今月の締めまであと少し！', kansai: '今月の締めまであとちょっと！' },
  { id: 'monthend_004', category: 'month_end', standard: '最後の積み上げ、いこう！', kansai: '最後まで積み上げよ！' },
  { id: 'monthend_005', category: 'month_end', standard: '今日の入力で今月も締めよう！', kansai: '今日の入力で締めや！' },
  { id: 'monthend_006', category: 'month_end', standard: '最後までコツコツ！', kansai: '最後までコツコツや！' },
  { id: 'monthend_007', category: 'month_end', standard: '今月もよく頑張ったね！', kansai: '今月もよう頑張ったな！' },
  { id: 'monthend_008', category: 'month_end', standard: 'あと一歩で締め日！', kansai: 'あと一歩で締め日や！' },
  { id: 'monthend_009', category: 'month_end', standard: '今日が勝負だね！', kansai: '今日が勝負や！' },
  { id: 'monthend_010', category: 'month_end', standard: '最後まで気持ちよく終わろう！', kansai: '気持ちよく締めよ！' },
  { id: 'monthend_011', category: 'month_end', standard: '今月も成長できたね！', kansai: '今月も成長したな！' },
  { id: 'monthend_012', category: 'month_end', standard: '積み重ねた一ヶ月だったね！', kansai: '積み重ねた一ヶ月やった！' },
  { id: 'monthend_013', category: 'month_end', standard: '今日が締めくくり！', kansai: '今日が締めくくりや！' },
  { id: 'monthend_014', category: 'month_end', standard: '今月もありがとう！', kansai: '今月もありがとう！' },
  { id: 'monthend_015', category: 'month_end', standard: 'ラストまで楽しもう！', kansai: 'ラストまで楽しも！' },
  { id: 'monthend_016', category: 'month_end', standard: '今日の入力で完成！', kansai: '今日で完成や！' },
  { id: 'monthend_017', category: 'month_end', standard: '来月につながる一日だね！', kansai: '来月につながる一日や！' },
  { id: 'monthend_018', category: 'month_end', standard: '締め日まであと少し！', kansai: '締め日まであと少し！' },
  { id: 'monthend_019', category: 'month_end', standard: '今日も未来へ一歩！', kansai: '今日も未来へ一歩や！' },
  { id: 'monthend_020', category: 'month_end', standard: '今月も最高だったね！', kansai: '今月も最高やった！' },

  /* --- 月初・スタート（Ver.1 辞書 20件） --- */
  { id: 'monthstart_001', category: 'month_start', standard: '新しい一ヶ月が始まったね！', kansai: '新しい一ヶ月の始まりや！' },
  { id: 'monthstart_002', category: 'month_start', standard: '今月も楽しもう！', kansai: '今月も楽しも！' },
  { id: 'monthstart_003', category: 'month_start', standard: 'また新しいスタート！', kansai: 'またスタートや！' },
  { id: 'monthstart_004', category: 'month_start', standard: '今月も積み上げよう！', kansai: '今月も積み上げよ！' },
  { id: 'monthstart_005', category: 'month_start', standard: '今日から新しいチャレンジ！', kansai: '今日から新しい挑戦や！' },
  { id: 'monthstart_006', category: 'month_start', standard: '一歩ずついこう！', kansai: '一歩ずついこ！' },
  { id: 'monthstart_007', category: 'month_start', standard: '今月もよろしく！', kansai: '今月もよろしくや！' },
  { id: 'monthstart_008', category: 'month_start', standard: '今日が未来のスタート！', kansai: '今日が未来のスタートや！' },
  { id: 'monthstart_009', category: 'month_start', standard: 'ワクワクする一ヶ月にしよう！', kansai: 'ワクワクする一ヶ月にしよ！' },
  { id: 'monthstart_010', category: 'month_start', standard: '今日もいい一日にしよう！', kansai: '今日もええ一日にしよ！' },
  { id: 'monthstart_011', category: 'month_start', standard: 'また新しい物語の始まり！', kansai: 'また新しい物語の始まりや！' },
  { id: 'monthstart_012', category: 'month_start', standard: '今月もコツコツ！', kansai: '今月もコツコツや！' },
  { id: 'monthstart_013', category: 'month_start', standard: '積み重ねのスタート！', kansai: '積み重ねスタート！' },
  { id: 'monthstart_014', category: 'month_start', standard: '未来が楽しみだね！', kansai: '未来が楽しみやな！' },
  { id: 'monthstart_015', category: 'month_start', standard: '今日からまた一緒に！', kansai: '今日からまた一緒や！' },
  { id: 'monthstart_016', category: 'month_start', standard: '今月も笑顔でいこう！', kansai: '今月も笑顔でいこ！' },
  { id: 'monthstart_017', category: 'month_start', standard: '一ヶ月後が楽しみ！', kansai: '一ヶ月後が楽しみや！' },
  { id: 'monthstart_018', category: 'month_start', standard: '新しい目標へ！', kansai: '新しい目標へ！' },
  { id: 'monthstart_019', category: 'month_start', standard: '今日が第一歩！', kansai: '今日が第一歩や！' },
  { id: 'monthstart_020', category: 'month_start', standard: '今月も最高にしよう！', kansai: '今月も最高にしよ！' },

  /* --- 通常あいさつ（Ver.1 辞書 20件） --- */
  { id: 'general_001', category: 'greeting_general', standard: '今日もよろしく！', kansai: '今日もよろしくや！' },
  { id: 'general_002', category: 'greeting_general', standard: '今日もいい日になりそう！', kansai: '今日もええ日になりそうや！' },
  { id: 'general_003', category: 'greeting_general', standard: '会えて嬉しい！', kansai: '会えて嬉しいわ！' },
  { id: 'general_004', category: 'greeting_general', standard: '一緒に頑張ろう！', kansai: '一緒に頑張ろ！' },
  { id: 'general_005', category: 'greeting_general', standard: '今日もコツコツ！', kansai: '今日もコツコツや！' },
  { id: 'general_006', category: 'greeting_general', standard: '未来が楽しみだね！', kansai: '未来が楽しみや！' },
  { id: 'general_007', category: 'greeting_general', standard: '今日も応援してる！', kansai: '今日も応援しとる！' },
  { id: 'general_008', category: 'greeting_general', standard: '焦らずいこう！', kansai: '焦らんでええで！' },
  { id: 'general_009', category: 'greeting_general', standard: '笑顔でいこう！', kansai: '笑顔でいこ！' },
  { id: 'general_010', category: 'greeting_general', standard: '今日も積み上げよう！', kansai: '今日も積み上げよ！' },
  { id: 'general_011', category: 'greeting_general', standard: 'ゆっくりでも大丈夫！', kansai: 'ゆっくりでも大丈夫や！' },
  { id: 'general_012', category: 'greeting_general', standard: '一歩ずつ進もう！', kansai: '一歩ずついこ！' },
  { id: 'general_013', category: 'greeting_general', standard: 'いい流れだね！', kansai: 'ええ流れや！' },
  { id: 'general_014', category: 'greeting_general', standard: '今日もいいスタート！', kansai: '今日もええスタート！' },
  { id: 'general_015', category: 'greeting_general', standard: '未来へGO！', kansai: '未来へGOや！' },
  { id: 'general_016', category: 'greeting_general', standard: '今日もナイス！', kansai: '今日もナイス！' },
  { id: 'general_017', category: 'greeting_general', standard: '今日もありがとう！', kansai: '今日もありがとう！' },
  { id: 'general_018', category: 'greeting_general', standard: '今日も最高！', kansai: '今日も最高や！' },
  { id: 'general_019', category: 'greeting_general', standard: '今日もワクワク！', kansai: '今日もワクワクや！' },
  { id: 'general_020', category: 'greeting_general', standard: '一緒に未来を作ろう！', kansai: '一緒に未来作ろ！' },

  /* --- 季節イベント（Ver.1 辞書 20件・activeFrom/To で期間限定） --- */
  { id: 'season_001', category: 'season_greeting', activeFrom: '01-01', activeTo: '01-07', standard: 'あけましておめでとう！', kansai: 'あけましておめでとう！' },
  { id: 'season_002', category: 'season_greeting', activeFrom: '01-01', activeTo: '01-07', standard: '今年もよろしく！', kansai: '今年もよろしくや！' },
  { id: 'season_003', category: 'season_greeting', activeFrom: '03-01', activeTo: '03-31', standard: '春が来たね！', kansai: '春が来たな！' },
  { id: 'season_004', category: 'season_greeting', activeFrom: '03-20', activeTo: '04-10', standard: '桜の季節だね！', kansai: '桜の季節やな！' },
  { id: 'season_005', category: 'season_greeting', activeFrom: '04-29', activeTo: '05-05', standard: 'ゴールデンウィーク楽しもう！', kansai: 'ゴールデンウィーク楽しも！' },
  { id: 'season_006', category: 'season_greeting', activeFrom: '06-01', activeTo: '06-30', standard: '夏が始まるね！', kansai: '夏が始まるな！' },
  { id: 'season_007', category: 'season_greeting', activeFrom: '07-01', activeTo: '08-31', standard: '暑さに気を付けよう！', kansai: '暑さに気を付けや！' },
  { id: 'season_008', category: 'season_greeting', activeFrom: '09-01', activeTo: '11-15', standard: '秋もコツコツ！', kansai: '秋もコツコツや！' },
  { id: 'season_009', category: 'season_greeting', activeFrom: '11-01', activeTo: '11-30', standard: '紅葉がきれいだね！', kansai: '紅葉きれいやな！' },
  { id: 'season_010', category: 'season_greeting', activeFrom: '12-01', activeTo: '12-25', standard: 'メリークリスマス！', kansai: 'メリークリスマスや！' },
  { id: 'season_011', category: 'season_greeting', activeFrom: '12-20', activeTo: '12-31', standard: '年末まであと少し！', kansai: '年末まであと少しや！' },
  { id: 'season_012', category: 'season_greeting', activeFrom: '12-28', activeTo: '12-31', standard: '一年ありがとう！', kansai: '一年おおきに！' },
  { id: 'season_013', category: 'season_greeting', activeFrom: '07-07', activeTo: '07-07', standard: '今日は七夕だね！', kansai: '今日は七夕やな！' },
  { id: 'season_014', category: 'season_greeting', activeFrom: '10-20', activeTo: '10-31', standard: 'ハロウィン楽しもう！', kansai: 'ハロウィン楽しも！' },
  { id: 'season_015', category: 'season_greeting', activeFrom: '02-01', activeTo: '02-03', standard: '節分だね！', kansai: '節分やな！' },
  { id: 'season_016', category: 'season_greeting', activeFrom: '04-01', activeTo: '04-07', standard: '新年度スタート！', kansai: '新年度スタートや！' },
  { id: 'season_017', category: 'season_greeting', activeFrom: '12-01', activeTo: '02-28', standard: '冬も頑張ろう！', kansai: '冬も頑張ろ！' },
  { id: 'season_018', category: 'season_greeting', activeFrom: '03-01', activeTo: '11-30', standard: '季節を楽しもう！', kansai: '季節楽しも！' },
  { id: 'season_019', category: 'season_greeting', activeFrom: '01-01', activeTo: '12-31', standard: '今年も積み上げよう！', kansai: '今年も積み上げよ！' },
  { id: 'season_020', category: 'season_greeting', activeFrom: '12-01', activeTo: '12-31', standard: '最高の一年にしよう！', kansai: '最高の一年にしよ！' },

  /* --- 特別イベント（Ver.1 辞書 20件・enabled: false 時は非表示） --- */
  { id: 'special_001', category: 'event_special', standard: '今日は特別な日！', kansai: '今日は特別な日や！' },
  { id: 'special_002', category: 'event_special', standard: 'アップデートありがとう！', kansai: 'アップデートおおきに！' },
  { id: 'special_003', category: 'event_special', standard: '新機能試してみてね！', kansai: '新機能試してみてな！' },
  { id: 'special_004', category: 'event_special', standard: '新しいプロジェクト追加！', kansai: '新しいプロジェクト追加や！' },
  { id: 'special_005', category: 'event_special', standard: '今日は記念日！', kansai: '今日は記念日や！' },
  { id: 'special_006', category: 'event_special', standard: 'みんなで盛り上がろう！', kansai: 'みんなで盛り上がろ！' },
  { id: 'special_007', category: 'event_special', standard: '新しい挑戦が始まる！', kansai: '新しい挑戦が始まるで！' },
  { id: 'special_008', category: 'event_special', standard: '未来がもっと楽しみ！', kansai: '未来がもっと楽しみや！' },
  { id: 'special_009', category: 'event_special', standard: '今日はワクワク！', kansai: '今日はワクワクや！' },
  { id: 'special_010', category: 'event_special', standard: '最高のニュース！', kansai: '最高のニュースや！' },
  { id: 'special_011', category: 'event_special', standard: 'おめでとう！', kansai: 'おめでとう！' },
  { id: 'special_012', category: 'event_special', standard: 'ここからさらに進化！', kansai: 'ここからさらに進化や！' },
  { id: 'special_013', category: 'event_special', standard: '新しい仲間が増えた！', kansai: '新しい仲間増えたで！' },
  { id: 'special_014', category: 'event_special', standard: 'イベント開催中！', kansai: 'イベント開催中や！' },
  { id: 'special_015', category: 'event_special', standard: '今日だけの特別！', kansai: '今日だけの特別や！' },
  { id: 'special_016', category: 'event_special', standard: '一緒に楽しもう！', kansai: '一緒に楽しも！' },
  { id: 'special_017', category: 'event_special', standard: '新しい景色が見えるよ！', kansai: '新しい景色見えるで！' },
  { id: 'special_018', category: 'event_special', standard: '今日も最高！', kansai: '今日も最高や！' },
  { id: 'special_019', category: 'event_special', standard: 'また一歩進化！', kansai: 'また一歩進化や！' },
  { id: 'special_020', category: 'event_special', standard: 'これからもよろしく！', kansai: 'これからもよろしくや！' },

  /* --- 朝（時間帯あいさつ） --- */
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
