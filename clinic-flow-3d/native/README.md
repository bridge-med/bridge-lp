# クリニックタウン3D — ネイティブアプリ化 (Capacitor)

Web版(親ディレクトリ)をそのまま Android / iOS アプリとしてパッケージするための雛形です。
ゲーム本体は静的な HTML/JS なのでビルド工程はなく、**コピー → ラップ → ストア提出** の3段階だけです。

## 必要なもの

- Node.js 18+
- Android: Android Studio(+ SDK 34 以降)
- iOS: macOS + Xcode 15 以降(+ Apple Developer Program 年会費)

## 初回セットアップ

```bash
cd clinic-flow-3d/native
npm install                 # Capacitor 本体とプラグイン
bash sync.sh                # 親ディレクトリの Web 版を www/ にコピー
npx cap add android         # android/ プロジェクト生成
npx cap add ios             # ios/ プロジェクト生成(macOSのみ)
```

## 日常の更新フロー

Web 版(`../index.html` や `../app/*.js`)を更新したら:

```bash
npm run cap:sync            # www/ を作り直して native プロジェクトへ反映
npm run android             # Android Studio が開く → Run ▶ で実機/エミュレータ
npm run ios                 # Xcode が開く(macOSのみ)
```

## 通知について

ゲーム側(`app/game.js` の `setupNotifications`)は実行環境を自動判別します:

- **ネイティブ(このプロジェクト)**: `@capacitor/local-notifications` で毎日 19:00 に
  ローカル通知をスケジュール。ストア審査で追加の許諾文言は不要(プッシュサーバ不使用)。
- **PWA(Web版)**: `Notification.requestPermission` + `periodicSync`(対応ブラウザのみ)。

Android 13+ は通知にランタイム許可が必要です。`android/app/src/main/AndroidManifest.xml` に
`POST_NOTIFICATIONS` 権限が自動追加されるのを確認してください。

## 収益化(広告)の追加方針

課金圧のないコイン経済のまま、広告でマネタイズする場合:

```bash
npm install @capacitor-community/admob
```

- おすすめの面: **日次リザルト画面のインタースティシャル(頻度上限つき)** と
  **「コイン+2を獲得」のリワード動画**(`grant` 関数にフックあり)
- AdMob のアプリID を `capacitor.config.json` の `plugins` に追記し、
  `android/app/src/main/AndroidManifest.xml` に meta-data を追加

## ストア提出チェックリスト

- [ ] `appId`(`jp.bridgemed.clinictown`)を確定(後から変更不可)
- [ ] アイコン: `www/icon-512.png` を元に `npx @capacitor/assets generate`
- [ ] スプラッシュ画面(同上コマンドで生成可)
- [ ] Android: 署名鍵の作成(`keytool`)→ Play Console にアップロード
- [ ] iOS: Bundle ID / Provisioning Profile を Xcode で設定
- [ ] プライバシーポリシー URL(データ収集なし・ローカルセーブのみ、の旨)
- [ ] スクリーンショット: 横持ちコックピット表示を推奨(タブレット枠も対応)

## 実機ビルド前チェック(プリフライト)

ローカルPCで以下を順に。エラーが出た段階のメッセージをそのまま相談してもらえれば解決できます。

```bash
cd clinic-flow-3d/native
node -v                      # 18+ であること
npm install
bash sync.sh                 # → "synced -> www/ (xx files)" が出ればOK
npx cap add android
npx cap doctor               # 環境診断(Android SDK のパス等)
npx cap sync
npx cap open android         # Android Studio が起動 → Run ▶
```

### 実機で必ず確認したい5点

1. **横持ちロック**: 視察モードで自動的に横向きになるか(効かない場合は
   `android/app/src/main/AndroidManifest.xml` の activity に
   `android:screenOrientation="fullUser"` があるか確認)
2. **ローカル通知**: 🔔ONで19時の通知が予約されるか(Android 13+は初回に許可ダイアログ)
3. **3D性能**: 視察モードのフレームレート(中級機で30fps以上が目安。重い場合は
   `walk3d.js` の `setPixelRatio` を1に固定する手がある)
4. **セーブ永続**: アプリ再起動でDay・常連・実績が残るか(WebViewのlocalStorage)
5. **効果音**: 初回タップ後に音が鳴るか(WebAudioのユーザー操作解禁)

## 構成

```
native/
├── package.json           # Capacitor 依存関係とスクリプト
├── capacitor.config.json  # appId / appName / webDir
├── sync.sh                # ../ (Web版) → www/ コピー
├── .gitignore             # node_modules, www, android, ios は生成物なので除外
├── www/                   # (生成) Web版のコピー
├── android/               # (生成) Android Studio プロジェクト
└── ios/                   # (生成) Xcode プロジェクト
```

生成物はコミットしません。`sync.sh` と設定ファイルだけをリポジトリで管理します。
