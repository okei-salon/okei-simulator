# OUKEI HUB 回帰テスト基盤

本番デプロイ前に、主要画面・組織図・保存データが壊れていないことを確認する。

## 正式運用ルール

1. Deploy 前に必ず `npm run verify:release`
2. **Failed = 0** かつ **DEPLOY READY ✅** のときだけ Deploy 可
3. 失敗時は **DEPLOY BLOCKED ❌** → Deploy 中止
4. 機能追加・修正時は対応テストを追加し、`scripts/verify-release-baseline.json` の `minPassed` を必要なら上げる（下げない）
5. 基準 PASS 数: **253**（理由なく減らさない）

## 最速（推奨）

```bash
# 別ターミナルで localhost
npm run dev

# デプロイ前ゲート
npm run verify:release

# ユーザー承認後の Deploy（verify 内蔵）
npm run deploy:hosting
```

成功時: `DEPLOY READY ✅`（exit 0）  
失敗時: `DEPLOY BLOCKED ❌`（exit 1）→ **Deploy しない**

## Deploy コマンド構成

| コマンド | verify:release | 用途 |
|----------|----------------|------|
| `npm run deploy:hosting` | **必須前処理** | 通常の Hosting Deploy |
| `npm run deploy` | **必須前処理** | フル Deploy |
| `npm run deploy:rules` | **必須前処理** | Rules Deploy |
| `npm run deploy:hosting:safe` | **必須** + cleanup | 安全 Hosting |
| `npm run deploy:hosting:raw` | なし | 緊急用（原則禁止） |

実装: `scripts/deploy-with-verify.mjs`

## 構成

| レイヤ | 内容 | サーバー |
|--------|------|----------|
| Unit / static | merge・削除・open旗・ENI計算・PF計算厳密値・local-dev ガード等 | 不要 |
| E2E | 画面・組織図・実績→PF連動・LocalStorage再読込・Mobile 375/390/430 | `:5050` 必須 |

## 個別スクリプト

```bash
npm run verify:delete-modes
npm run verify:data-protection
npm run verify:portfolio-calc
npm run verify:perf-portfolio-e2e
npm run verify:hub-sync
npm run verify:org-visibility
npm run verify:org-localhost
npm run verify:release-e2e
# ほか package.json の verify:* を参照
```

## 環境変数

| 変数 | 意味 |
|------|------|
| `OUKEI_BASE` | 既定 `http://127.0.0.1:5050/` |
| `OUKEI_SKIP_E2E=1` | Playwright 系をスキップ |
| `OUKEI_SKIP_OPTIONAL=1` | 任意スイートをスキップ |
| `OUKEI_REQUIRE_SERVER=0` | localhost 無しでも E2E 失敗にしない |
| `OUKEI_SKIP_VERIFY=1` + `OUKEI_ALLOW_UNVERIFIED_DEPLOY=1` | 緊急の未検証 Deploy（両方必要・原則禁止） |

## Playwright

```bash
npx playwright install chromium
```

## まだ薄い／未自動化の領域

- 実績入力フォームのフル DOM 操作（クリック入力）※API 経由の入力→PF 連動はカバー済み
- **本番 Firestore への実ラウンドトリップ**（今は merge ロジック＋ガード）
- `verify-restore-hub`（Downloads 固定パス依存のため release 必須から除外）
- グラフ重なりの視覚回帰（スクショ差分）
