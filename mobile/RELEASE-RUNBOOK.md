# リリース提出 Runbook — BRIDGE Worklog

このアプリを App Store / Google Play に出すための**手順書**。コードは提出可能な状態です。
ここから先は「アカウント作成・ストア管理画面の入力・実機ビルド」が中心で、上から順に
実行すれば出せます。所要：初回はおおむね **1〜2日（審査待ち除く）**。

> 凡例：⌨️=自分のPCのターミナル、🌐=ブラウザでの管理画面作業、💸=費用発生

すべて `mobile/` ディレクトリで作業します（`cd mobile`）。

---

## フェーズ0：アカウント作成（先にやる）

- [ ] 🌐 **Expo アカウント** … https://expo.dev （無料）
- [ ] 🌐💸 **Apple Developer Program** … https://developer.apple.com/programs/ （**$99/年**、登録に1〜2日かかることあり）
- [ ] 🌐💸 **Google Play Console** … https://play.google.com/console/signup （**$25 買い切り**）
- [ ] 🌐 **RevenueCat** … https://app.revenuecat.com （無料、課金検証に使用）

> Apple の登録審査が一番時間がかかるので**最初に申し込む**。待つ間に他を進められます。

---

## フェーズ1：Expo / EAS 初期化

- [ ] ⌨️ EAS CLI を用意してログイン
  ```bash
  npm i -g eas-cli
  eas login
  ```
- [ ] ⌨️ プロジェクトを EAS に紐付け（`app.config.ts` の `EAS_PROJECT_ID` / `owner` を環境に設定）
  ```bash
  cd mobile
  eas init        # 既存プロジェクトに紐付け or 新規作成
  ```
  → 表示された **projectId** と **owner（アカウント名）** を控える。
- [ ] ⌨️ ビルドで使う環境変数（EAS Secrets）を登録（後でRC鍵も足す。フェーズ2参照）
  ```bash
  # AI生成バックエンドを使う場合のみ（任意）。使わないなら飛ばしてOK
  # eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "..." --environment production
  ```

> `app.config.ts` は `EAS_PROJECT_ID` / `EAS_OWNER` を環境から読みます。ローカルビルド時は
> `.env` に、CI/EASビルド時は `eas env:create` か EAS のプロジェクト設定で渡します。

---

## フェーズ2：アプリ内課金（コイン）の作成 ★重要

商品IDはコードの `lib/credits.ts > COIN_PACKS` と**完全一致**させること：
`coins_10` / `coins_30` / `coins_100`（いずれも**消費型 / Consumable**）。

### 2-1. App Store Connect（iOS）🌐
- [ ] My Apps → 新規アプリ作成（Bundle ID = `com.bridgemed.worklog`）
- [ ] 「App内課金」→ **消費型**を3つ作成：`coins_10` `coins_30` `coins_100`
  - 価格：¥240 / ¥600 / ¥1,600 目安（`COIN_PACKS` の表示と合わせる）
  - 各商品に表示名・説明・審査用スクショ（コイン画面で可）を登録
- [ ] 「契約・税・口座」(Agreements) を**有効化**（これが未完だと課金が動かない）

### 2-2. Google Play Console（Android）🌐
- [ ] アプリ作成（パッケージ名 = `com.bridgemed.worklog`）
- [ ] 収益化 → アプリ内アイテム → **管理対象/消費型**を3つ：`coins_10` `coins_30` `coins_100`
- [ ] ※Playは**先に一度AABをアップロード**しないと課金商品を有効化できない → フェーズ4の後に戻って設定

### 2-3. RevenueCat 🌐
- [ ] プロジェクト作成 → iOS / Android アプリを追加（Bundle ID / パッケージ名）
- [ ] **Products** に `coins_10/30/100` を登録（各ストアの商品に紐付け）
- [ ] **Offerings → current** を作り、3商品をパッケージとして追加（コードは `current` を読む）
- [ ] **API Keys** から iOS/Android の公開鍵を取得

- [ ] ⌨️ RC鍵を EAS Secrets に登録
  ```bash
  eas env:create --name EXPO_PUBLIC_RC_IOS_KEY     --value "appl_xxx" --environment production
  eas env:create --name EXPO_PUBLIC_RC_ANDROID_KEY --value "goog_xxx" --environment production
  ```
  > これらが入ると `features.revenuecat` が true になり、アプリが**デモ購入→本物の課金**へ自動切替（`lib/iap.native.ts`）。

---

## フェーズ3：ストア掲載情報・素材

- [ ] 🌐 **プライバシーポリシーURL**（必須・登録済み）
  `https://bridge-med.github.io/bridge-lp/legal/privacy.html`
- [ ] 説明文：`store/listing-ja.md` / `store/listing-en.md` をコピペ
- [ ] 審査メモ：`store/review-notes.md`（課金の確認手順あり）
- [ ] スクショ：実機/シミュレータから撮影（必要サイズは `store/assets-checklist.md`）
  - 推奨：ホーム / 仕事ログ / 記録(検索) / 英単語コース / そだち の5枚
- [ ] Android の **Feature graphic**（1024×500 PNG）を1枚用意
- [ ] **データ安全性 / プライバシー欄**：
  - 広告・トラッキングSDKなし → **「データを収集しない」**で申告可
  - 補足：AI機能は“ユーザー自身のキーで各社へ直接送信”（開発者サーバ経由なし）
- [ ] 年齢レーティング質問票（暴力等なし＝最低区分）／輸出コンプライアンス（標準暗号のみ＝該当なし）

---

## フェーズ4：ビルド（EAS）

`eas.json` は `appVersionSource: remote`（ビルド番号はEASが自動採番）。`production` は
`autoIncrement: true` 済み。

### 方法A：ローカルCLI（おすすめ・初回向け）⌨️
```bash
cd mobile
# iOS（証明書はEASが対話で作成・管理してくれる）
eas build --platform ios --profile production
# Android
eas build --platform android --profile production
```
- iOS：Apple ログインを求められたら従う。Distribution証明書/Provisioningは「EASに任せる(Yes)」でOK。
- Android：keystore も「EASに生成・管理させる(Yes)」でOK（紛失リスクが無い）。

### 方法B：GitHub Actions（`.github/workflows/eas-build.yml`）
- [ ] 🌐 リポジトリ Secrets に **`EXPO_TOKEN`**（expo.dev → Access Tokens で発行）を追加
- [ ] Actions タブ → “EAS Build (mobile)” → Run：`platform=all` `profile=production`（`submit` は後述）

> 初回は方法Aで対話的に証明書を作るのが安全。2回目以降はAでもBでも可。

---

## フェーズ5：ストア提出

`eas.json > submit.production` の **プレースホルダを自分の値に**置き換える：
```jsonc
"ios": {
  "appleId": "あなたのApple ID(メール)",
  "ascAppId": "App Store Connect の App ID（数字）",
  "appleTeamId": "Apple Team ID（10桁英数）"
}
```
Android は `google-service-account.json`（Play Console→APIアクセス→サービスアカウントのJSON鍵）を
`mobile/` に置く（**.gitignore 済みか確認、コミット厳禁**）。

- [ ] ⌨️ 提出
  ```bash
  eas submit --platform ios --profile production --latest
  eas submit --platform android --profile production --latest
  ```
- [ ] 🌐 App Store Connect / Play Console 側で、ビルドに**課金商品を紐付け**、審査に提出
  - iOS：初回は IAP も同時に審査されるので、課金商品を「Appと一緒に提出」する
  - Android：内部テスト(`track: internal`)→クローズド→製品版、と段階を踏むのが安全

---

## フェーズ6：提出後／以降の更新

- **JS/データ修正**は審査不要で即配信（OTA）：
  ```bash
  eas update --branch production --message "fix: ..."
  ```
  （`production` ビルドは channel=production を見る設定済み）
- **ネイティブ変更**（新ライブラリ・権限・SDK更新・アイコン）だけ再ビルド＆再提出。
- バージョン表記を上げるときは `app.config.ts > version`（ビルド番号はEAS自動）。

---

## つまずきやすい点（先回り）

| 症状 | 原因 / 対処 |
|---|---|
| 課金が「商品が見つかりません」 | RCの **Offering(current)** 未設定 / 商品IDの綴り違い / Apple「契約」未有効 |
| iOSで課金が出ない | サンドボックスのテスターでログイン、ビルドはTestFlight経由で確認 |
| Playで課金有効化できない | 先に一度AABをアップロード（内部テスト）してから商品を有効化 |
| 審査で「広告の記載と挙動が不一致」 | 本アプリは広告なし。掲載文に広告を書かない（修正済み） |
| キーストア紛失が怖い | EAS管理に任せる（方法Aの“Yes”）。自前管理しない |
| EAS env が反映されない | `--environment production` を付けたか、productionプロファイルでビルドしたか確認 |

---

## 「自分の値」記入欄（控え）

```
EAS projectId      : ____________________
Apple ID (email)   : ____________________
Apple Team ID      : ____________________
ASC App ID (iOS)   : ____________________
RC iOS key         : appl_________________
RC Android key     : goog_________________
EXPO_TOKEN (CI用)  : ____________________
```

困ったら、該当フェーズ番号を教えてくれれば一緒に潰します。
