# OUKEI HUB (okei-simulator)

## 本番 URL（Firebase Hosting）

- https://oukei-hub.web.app
- https://oukei-hub.firebaseapp.com

Google ログインは **Firebase Hosting**（`https://oukei-hub.web.app`）上で利用してください。  
`firebase-config.js` の `authDomain` は Hosting ドメイン（`oukei-hub.web.app`）に合わせてください。

## デプロイ（Firebase Hosting）

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
2. **Hosting** が有効で、`https://oukei-hub.web.app` で `index.html` が表示されること
3. **`firebase-config.js` の `authDomain`** が `oukei-hub.web.app` であること

## GitHub Pages（参考・旧）

GitHub Pages 用の設定はリポジトリ内に残していますが、Auth 検証は Firebase Hosting を優先してください。
