# ごきげん回復ガチャ — iOS App Store 提出手順書

このアプリは **ビルド不要の静的PWA**(HTML/CSS/バニラJS + Service Worker)です。
iOSアプリとして App Store に出す最短ルートは、既存の `gokigen-gacha/` の一式を
**WKWebView にラップ**して配信する方法です。ここでは実務的に扱いやすい **Capacitor** を推奨手順として記載します。

> 前提として必要なもの
> - **Mac + Xcode**(最新の安定版)
> - **Apple Developer Program**(年額 約 $99 / 有料登録)
> - Node.js（Capacitor CLI 用）

---

## 0. 方針の選択(どれか1つ)

| 方式 | 向いている人 | 概要 |
|---|---|---|
| **A. Capacitor(推奨)** | Web資産をそのまま出したい | `www/` に静的一式を置き、iOSシェルを生成。将来ネイティブ機能も足せる |
| B. PWABuilder | GUIで済ませたい | pwabuilder.com にURLを入れて iOSパッケージを生成 |
| C. 手書き WKWebView | 完全に自前管理したい | Xcodeで空アプリを作り WKWebView で `index.html` を読み込む |

以降は **A. Capacitor** を前提に進める。B/C でも「4. App Store Connect の設定」以降は共通。

---

## 1. Capacitor プロジェクトを作る

```bash
# 作業用の空フォルダで
npm init -y
npm i @capacitor/core @capacitor/ios
npm i -D @capacitor/cli

# webDir はこのアプリの静的一式を入れる場所
npx cap init "ごきげん回復ガチャ" "app.bridge.gokigengacha" --web-dir=www
```

- **Bundle ID(App ID)例**: `app.bridge.gokigengacha`(Apple Developer で登録する識別子と一致させる)
- `www/` に **`gokigen-gacha/` の中身をそのままコピー**する
  （`index.html` / `app/` / `manifest.webmanifest` / `sw.js` / `legal.html`）。
  ただし `index.html` は `../shared/usage.js` を参照しているため、ラップ時は
  - `shared/usage.js` も `www/shared/` に同梱する、または
  - 同梱しないなら `index.html` の該当 `<script>` を削除する（利用ログは任意機能のため削除して問題ない）。
- フォントは Google Fonts をCDN参照している。**オフラインでも表示を保つ**なら、
  同等のWebフォントをローカルにセルフホストするかシステムフォントにフォールバックする
  （現状も `-apple-system` 等へフォールバックするため、CDN不達でも破綻はしない）。

```bash
npx cap add ios
npx cap copy ios      # www/ を iOS プロジェクトへ反映
npx cap open ios      # Xcode が開く
```

---

## 2. Xcode 側の設定

- **Display Name**: ごきげん回復ガチャ
- **Bundle Identifier**: 上で決めた App ID と一致
- **Deployment Target**: iOS 15 以上を推奨
- **Device**: iPhone（このアプリは iPhone 縦向き専用の設計）
- **Orientation**: Portrait のみ
- **App Icon**: `assets/icon-1024.png`（1024×1024・不透明・角丸なし）を
  Xcode の AppIcon セットに設定（自動で各サイズ生成される）
- **Launch Screen**: 背景 `#FBFAF7`（ライト）/ `#111521`（ダーク）で無地〜ロゴ程度
- **Status bar**: 既定（`index.html` の `apple-mobile-web-app-status-bar-style` 準拠）
- **Safe Area**: `viewport-fit=cover` 済み。CSSは `env(safe-area-inset-*)` を使用

### WKWebView の設定メモ
- `localStorage` は WKWebView で有効（このアプリの保存はすべてこれ）。
  アプリ削除でデータも消える点を「データの扱い」に明記済み。
- 外部リンク（`mailto:` / `legal.html`）はアプリ内で開く。`legal.html` は同梱されるので問題なし。

---

## 3. 提出用アセット(このフォルダに用意済み)

`gokigen-gacha/appstore/assets/` を参照。

- `icon-1024.png` — App Store 用アイコン（1024×1024・RGB・不透明・角丸なし）
- `screenshots/6.7/` — 6.7インチ（1290×2796）… iPhone 15/16 Pro Max 等【必須】
- `screenshots/5.5/` — 5.5インチ（1242×2208）… 旧機種用（任意だが用意すると審査で無難）

> スクショは実UIをそのままレンダリングしたもの。文言オーバーレイは付けていない。
> マーケティング的に訴求文を載せる場合は、各画像の上部に帯を足す（キャプション案は `metadata.md`）。

> **フォントについて**: これらのアセットはネットワーク遮断環境で生成したため、
> 見出しフォント（Zen Maru Gothic）ではなくシステムのゴシック体で描画されている。
> 本番の見た目に合わせたい場合は、Google Fonts が読める環境で下記の手順で再生成する。

### アセットの再生成手順

1. リポジトリ直下でローカルサーバを起動: `python3 -m http.server 8000`
2. Playwright（Chromium）で以下を撮影（`deviceScaleFactor:3`）:
   - アイコン: `appstore/assets` の元HTMLを 1024×1024 でスクショ（不透明・角丸なし）
   - 6.7": ビューポート 430×932 → 出力 1290×2796
   - 5.5": ビューポート 414×736 → 出力 1242×2208
3. 撮影前に `localStorage` へサンプルデータを投入すると、履歴・お気に入り・図鑑が
   埋まった状態で撮れる（オンボーディングも `onboardedAt` を入れてスキップ）。

---

## 4. App Store Connect の設定

`metadata.md` の内容を App Store Connect に転記する。

- **App 名 / サブタイトル / 説明 / キーワード / プロモーション用テキスト** → `metadata.md`
- **カテゴリ**: メディカル は避け、**ヘルスケア/フィットネス**（主）+ **ライフスタイル**（副）
- **年齢制限（Age Rating）**: 全年齢想定（4+）。暴力/性的表現/ギャンブル等なし
  - 「ガチャ」という語だが**課金・射幸性は一切なし**（無料・報酬型ではない）。審査メモに明記
- **価格**: 無料
- **サポートURL**: `https://bridge-med.github.io/bridge-lp/gokigen-gacha/legal.html#contact`
- **マーケティングURL(任意)**: `https://bridge-med.github.io/bridge-lp/gokigen-gacha/`
- **プライバシーポリシーURL**: `https://bridge-med.github.io/bridge-lp/gokigen-gacha/legal.html#privacy`

### App Privacy(プライバシー栄養表示)
`app-privacy.md` の回答をそのまま入力。要点は **「データを収集していません(Data Not Collected)」**。

### 審査メモ(App Review Information / Notes)例
```
本アプリは、疲れているときに今できる小さな回復行動を1つ提案するセルフケアアプリです。
アカウント登録・ログインは不要で、テスト用アカウントも必要ありません。
すべてのデータは端末内(localStorage)にのみ保存され、外部送信・トラッキングはありません。
「ガチャ」は演出上の名称で、課金・ランダム報酬型の射幸性要素はなく、すべて無料です。
医療・診断アプリではなく、免責事項をアプリ内および privacy ページに明記しています。
```

---

## 5. ビルド & 提出

```bash
# Xcode で
# 1. Signing & Capabilities で自分の Team を選択(自動署名でOK)
# 2. Product > Archive
# 3. Distribute App > App Store Connect > Upload
```

- アップロード後、App Store Connect の該当ビルドを選択
- スクショ・メタデータ・App Privacy・審査メモを揃えて **審査へ提出**

---

## 6. リリース後 / 更新時

- Web資産(`gokigen-gacha/`)を更新したら `www/` へ再コピー → `npx cap copy ios` → Archive → Upload
- **Service Worker のキャッシュ版**（`sw.js` の `CACHE` と `?v=` クエリ）を更新すると、
  WebView内キャッシュも確実に切り替わる（本PRで `v6` に更新済み）

---

## チェックリスト(提出前)

- [ ] Bundle ID を Apple Developer に登録し、Xcode と一致
- [ ] `www/` に静的一式をコピー（`shared/usage.js` の同梱有無を決定）
- [ ] アイコン 1024（不透明・角丸なし）を設定
- [ ] Portrait のみ / iPhone
- [ ] スクショ 6.7"（必須）を登録
- [ ] メタデータ（`metadata.md`）を転記
- [ ] App Privacy = Data Not Collected（`app-privacy.md`）
- [ ] プライバシーポリシーURL / サポートURL を設定
- [ ] 審査メモに「ガチャ=課金なし」「データ端末内のみ」「医療目的でない」を明記
- [ ] 実機で一通り動作確認（オンボ→状態選択→結果→少しやってみる→完了）
