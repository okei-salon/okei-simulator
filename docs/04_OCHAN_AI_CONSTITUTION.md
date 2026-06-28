# O-CHAN AI CONSTITUTION

OUKEI HUB おーちゃんシステム Ver.1 — 正式仕様

## 1. 役割分担

| | AI（今日のアクション） | おーちゃん |
|---|------------------------|------------|
| 担当 | 入力指示・未入力通知・事務案内 | 応援・励まし・褒める・数字の変化 |
| 禁止 | — | 入力指示・否定的表現・責める言葉 |

## 2. 基本ルール

否定しない / 全力で褒める / 他人と比較しない（昨日・先月のみ） / ドル優先 / 行動も褒める

## 3. ファイル構成

| ファイル | 役割 |
|----------|------|
| `assets/js/ochan-lines.js` | **辞書データのみ**（カテゴリ・セリフ・閾値・イベント期間） |
| `assets/js/ochan-engine.js` | コンテキスト生成・条件判定・テンプレート差し込み |

## 4. 拡張設計（500〜1000セリフ対応）

### カテゴリ追加（コード変更不要）

```javascript
// ochan-lines.js
event_christmas: { priority: 2, label: 'クリスマス', condition: 'eventChristmas', enabled: true }
```

`enabled: false` の将来カテゴリは、セリフ追加後に `true` へ切り替えるだけ。

### セリフ追加（コード変更不要）

```javascript
{
  id: 'xmas_001',
  category: 'event_christmas',
  activeFrom: '12-01',
  activeTo: '12-25',
  requires: { hasUserName: true },
  standard: '{userName}、メリークリスマス！',
  kansai: '{userName}、メリークリスマスや！'
}
```

### 行単位フィルタ `requires`

| キー | 意味 |
|------|------|
| `hasUserName` | ユーザー名がある場合のみ |
| `minStreak` / `maxStreak` | 連続入力日数 |
| `minActivityDays` | 活動日数 |
| `weekday` | 曜日 0=日 … 6=土（数値 or 配列） |
| `event` | `OCHAN_EVENT_CALENDAR` のキー |
| `minAsset` | 資産サマリー下限 |

### テンプレート変数（自動生成）

`{userName}` `{weekdayJa}` `{monthDayJa}` `{activityDays}` `{activityDaysJa}`  
`{deltaDollarSigned}` `{todayDollar}` `{monthlyDollar}` `{milestoneDollar}`  
`{assetDollar}` `{assetMilestoneDollar}` `{remainingDollar}` `{monthlyGoal}`  
`{streakDays}` `{streakDaysJa}` `{projectName}` `{loginMilestoneDays}`

### 辞書側の閾値・イベント

- `OCHAN_MONTHLY_MILESTONES` … 月次収益大台
- `OCHAN_ASSET_MILESTONES` … 資産節目
- `OCHAN_LOGIN_MILESTONES` … 活動日数節目
- `OCHAN_EVENT_CALENDAR` … 季節イベント期間（MM-DD）

### 将来フック（エンジン側ヘルパー）

- `notifyOchanProjectAdded(name)` … プロジェクト追加時
- `settings.ochanBirthday` … `'MM-DD'` 誕生日
- `settings.ochanDisplayName` … 呼び名上書き
- `settings.ochanLastAssetSnapshot` … 資産節目検知用

## 5. 表示優先順位

①目標達成 → ②過去最高 → ③連続達成 → ④月次大台 → ⑤昨日比アップ → ⑥入力完了 → ⑦未入力（応援） → ⑧挨拶

## 6. 新条件タイプが必要な場合のみ

`OCHAN_CONDITIONS` に1件追加（稀）。通常は既存 condition + 辞書データで対応。

## 7. コンセプト

> おーちゃんは「毎日の積み重ねを、一番近くで応援する相棒」

AI = 仕事 / おーちゃん = 心
