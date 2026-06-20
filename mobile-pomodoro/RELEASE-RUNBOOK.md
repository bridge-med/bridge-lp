# リリース提出 Runbook — BRIDGE Focus

App Store / Google Play に出すための**手順書**。コードは提出可能な状態です。
ここから先は「アカウント作成・実機ビルド・ストア入力」が中心で、上から順に実行すれば出せます。
**課金なし・広告なし・トラッキングなし**なので、IAP/RevenueCat 等の設定は不要です。

> 凡例：⌨️=自分のPCのターミナル、🌐=ブラウザでの管理画面作業、💸=費用発生
> 作業はすべて `mobile-pomodoro/` で行います（`cd mobile-pomodoro`）。

---

## フェーズ0：アカウント作成（先にやる）

- [ ] 🌐 **Expo アカウント** … https://expo.dev （無料）
- [ ] 🌐💸 **Apple Developer Program** … https://developer.apple.com/programs/ （**$99/年**、登録に1〜2日かかることあり）
- [ ] 🌐💸 **Google Play Console** … https://play.google.com/console/signup （**$25 買い切り**）

> Apple の登録審査が一番時間がかかるので**最初に申し込む**。待つ間に他を進められます。

## フェーズ1：EAS 初期化

```bash
cd mobile-pomodoro
npm install --legacy-peer-deps
npm i -g eas-cli
eas login
eas init            # projectId が作られる
```
- [ ] 表示された **projectId** と **owner（アカウント名）** を控える
- [ ] それを環境変数に設定（`app.config.ts` が読む）
  ```bash
  export EAS_PROJECT_ID=xxxxxxxx-xxxx-...   # eas init で出た値
  export EAS_OWNER=your-expo-username
  ```
  （CI/恒久化する場合は `eas env:create` か `.env` で）

## フェーズ2：実機で動作確認（開発ビルド）

```bash
eas build --profile development --platform ios       # または android
```
- [ ] 出来た開発ビルドを実機に入れ、タイマー・通知音・没入モード・記録を確認
- [ ] iOS の通知音／バイブ、Android の通知チャンネルが鳴ることを確認

## フェーズ3：本番ビルド

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```
- 署名（iOS証明書 / Android keystore）は EAS が管理（Mac不要）。
- `version` は `1.0.0`（`app.config.ts`）、ビルド番号は `autoIncrement` 済み。

## フェーズ4：ストア入力 & 提出

### iOS（App Store Connect）
- [ ] 🌐 新規アプリ作成：Bundle ID = `com.bridgemed.focus`、名称 = **BRIDGE Focus**
- [ ] `eas.json` の `submit.production.ios` に `appleId / ascAppId / appleTeamId` を記入
- [ ] ⌨️ `eas submit --platform ios --latest`
- [ ] 🌐 掲載情報（`store/listing-ja.md` / `listing-en.md`）、スクショ、プライバシー、
      **App Privacy = Data Not Collected**、価格=無料 を設定 → 審査提出

### Android（Google Play Console）
- [ ] 🌐 新規アプリ作成：パッケージ = `com.bridgemed.focus`
- [ ] サービスアカウントJSONを作成し `./google-service-account.json` に配置（`eas.json` 参照）
- [ ] ⌨️ `eas submit --platform android --latest`
- [ ] 🌐 ストア掲載、スクショ＋Feature graphic(1024×500)、
      **データ安全性 = データを収集しない/共有しない**、価格=無料 → 内部テスト→製品版

## フェーズ5：公開後の更新

- JSのみの修正は **`eas update`（OTA・審査不要）**：
  ```bash
  eas update --branch production -m "fix: ..."
  ```
- ネイティブ依存やアイコン/権限を変えた時だけ再ビルド＆再提出。

---

## 提出前チェック（落ちないために）

- [x] アカウント不要・初回起動でサンプルデータ表示・オフライン動作
- [x] 広告/トラッキングSDKなし → プライバシー「収集なし」
- [x] アプリ内課金なし（設定不要）
- [x] Error Boundary あり（`components/ErrorBoundary.tsx`）
- [x] バージョン `1.0.0`、Bundle ID/パッケージ＝本番値
- [ ] プライバシーURLを公開（例: https://bridge-med.github.io/bridge-lp/legal/focus-privacy.html）
- [ ] スクショ（iOS 6.7" / Android 1080×1920、+ Feature graphic）
- [ ] 年齢レーティング、輸出コンプライアンス（標準暗号のみ）

詳しい素材サイズは `store/assets-checklist.md`、審査メモは `store/review-notes.md`。
