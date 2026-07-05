# OUKEI HUB (okei-simulator)

## ローカル開発（動作確認）

修正後は **Firebase Hosting へデプロイせず**、まずローカルで確認してください。  
本番デプロイは、内容を確認・承認したタイミングでのみ行います。

### 起動方法

```bash
cd /Users/kaiyasuhiro/Documents/GitHub/okei-simulator
npm install          # 初回のみ
npm run dev          # または npm start
```

### Safari で開く URL

| 用途 | URL |
|---|---|
| **メイン（推奨）** | **http://localhost:5050** |
| 同上（IP表記） | http://127.0.0.1:5050 |

**重要**: ログイン状態はオリジンごとに別管理です。普段は **http://localhost:5050** だけを使ってください（`127.0.0.1` と混在しない）。

### Google ログイン（ローカル）

ローカル開発では **ポップアップログイン** を使用します（Safari で `signInWithRedirect` が失敗するため）。  
本番（oukei-hub.web.app）では従来どおりリダイレクトログインです。

Firebase Console → Authentication → **承認済みドメイン** に以下を追加してください。

- `localhost`
- `127.0.0.1`

### 開発フロー

1. Cursor で修正
2. **http://localhost:5050** で確認（`npm run dev`）
3. 問題があれば修正 → ②を繰り返す
4. OK が出たら GitHub へ Commit / Push
5. **リリース時のみ** `npm run deploy:hosting` で本番公開

開発中は **Firebase Hosting へデプロイしない** 運用です。

ターミナルに `Local server: http://127.0.0.1:5050` と表示されれば起動成功です。停止は `Ctrl + C`。  
キャッシュが気になる場合は Safari で **開発 → キャッシュを空にする** のあとスーパーリロードしてください。

---

## 本番 URL（Firebase Hosting）

- https://oukei-hub.web.app
- https://oukei-hub.firebaseapp.com

Google ログインは **Firebase Hosting**（`https://oukei-hub.web.app`）上で利用してください。  
`firebase-config.js` の `authDomain` は Hosting ドメイン（`oukei-hub.web.app`）に合わせてください。

## デプロイ（Firebase Hosting）

**ローカル確認・承認後のみ** 実行してください。

```bash
# 初回のみ
npm install
npx firebase login

# Hosting + Firestore Rules
npm run deploy

# Hosting のみ
npm run deploy:hosting
```

## Firebase Console 確認事項

1. **Authentication → 設定 → 承認済みドメイン**  
   `oukei-hub.web.app` が含まれていること（Hosting 有効化後は通常自動追加）  
   ローカル確認時は `localhost` も追加
2. **Hosting** が有効で、`https://oukei-hub.web.app` で `index.html` が表示されること
3. **`firebase-config.js` の `authDomain`** が `oukei-hub.web.app` であること

## GitHub Pages（参考・旧）

GitHub Pages 用の設定はリポジトリ内に残していますが、Auth 検証は Firebase Hosting を優先してください。
