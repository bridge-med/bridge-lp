# リリース提出 Runbook（実戦版）— iOS / App Store

このアプリ（および `mobile/` テンプレから量産する新アプリ）を App Store 審査に出すまでの
**実際に通った手順**。初回に詰まった所を全部書いてあります。上から順にやればOK。

> 凡例：⌨️=PCのターミナル（PowerShell想定）、🌐=ブラウザ、💸=費用
> 作業は基本 `mobile/` で。`cd <repo>\mobile`

---

## ⚡ 最重要・先に知っておく「ハマりどころ」一覧
1. **`eas` 単体は動かないことが多い** → 必ず **`npx eas-cli ...`**。
2. **Expoログインはアクセストークンが確実**（メール/パスは弾かれがち）。
   PowerShellは **`$env:EXPO_TOKEN="トークン"`（"で囲む・1行ずつ）**。
3. **ビルドは必ずリポジトリの `mobile/` で**、`git pull` → **`npm install --legacy-peer-deps`** の後に。
4. **`.npmrc`（`legacy-peer-deps=true`）が無いとEASの依存インストールで落ちる**（→このテンプレには同梱済み）。
5. **スクショは iPhone 6.9インチ(1320×2868) と iPad 13インチ(2048×2732) が必要**。
   手持ちiPhone(例 iPhone17=1206×2622)は**そのままだと弾かれる→リサイズ**。
   iPadを出したくないなら **`app.config.ts` の `ios.supportsTablet:false`** にすれば iPad スクショ不要。
6. **アプリ本体は「無料」**。お金はコイン（IAP）だけ。
7. **有料App契約＋銀行/税(W-8BEN)** を済ませないとIAPが出せない。
8. App Store Connect の必須欄（**プライマリカテゴリ／年齢レーティング／Appプライバシー／プライバシーURL／サポートURL／ビルド選択／サインイン不要のチェック外し**）が1つでも欠けると「審査用に追加できません」。

---

## フェーズ0：アカウント（先に申込む）
- [ ] 🌐 Expo（無料） https://expo.dev
- [ ] 🌐💸 Apple Developer Program（$99/年・**承認に1〜2日**） https://developer.apple.com/programs/
- [ ] 🌐 RevenueCat（無料・IAP検証） https://app.revenuecat.com
- [ ] （Android出すなら）🌐💸 Google Play（$25）

---

## フェーズ1：EAS 初期化（PC）
```powershell
cd <repo>\mobile
npm install --legacy-peer-deps      # 依存を入れる（クローン直後は必須）
```
**ログインはトークンが確実：**
1. 🌐 https://expo.dev/settings/access-tokens（**個人**アカウント側。組織のRobotではない）→ Create token
2. ⌨️ PowerShellで（"で囲む・1行ずつ）
   ```powershell
   $env:EXPO_TOKEN="ここにトークン"
   ```
**プロジェクト作成：**
```powershell
npx eas-cli init
```
- 「Create a project for @<owner>/<slug>?」→ **Yes**。表示された **Project ID** を控える。
- 動的設定（app.config.ts）なので自動保存されない → **`app.config.ts` の `EAS_PROJECT_ID` 既定値に貼る**（このテンプレはそうしている）。
- ⚠️ slug は `app.config.ts` の `slug` と一致必須。昔の変なslugプロジェクトに紐づくと
  `Slug ... does not match` で落ちる → その時は `eas init` でクリーンに作り直す。

---

## フェーズ2：iOSビルド（PC・クラウドで焼く＝Mac不要）
```powershell
$env:EXPO_TOKEN="トークン"        # 同ウィンドウなら省略可
npx eas-cli build --platform ios --profile production
```
**プロンプト対応：**
- Apple アカウントにログイン → Yes（Apple ID＋2FA）
- Distribution Certificate / Provisioning Profile を生成 → **Yes（EAS管理に任せる）**
- Apple Push Notifications service key → **Yes**（任意。ローカル通知だけなら無くても可）

**詰まった実例：**
- `eas: 用語が認識されません` → `npx eas-cli ...` にする。
- `An Expo user account is required` → トークン未設定。`$env:EXPO_TOKEN="..."`。
- `Failed to resolve plugin ... expo-router` → `npm install --legacy-peer-deps` 忘れ。
- `Install dependencies` フェーズで失敗 → `.npmrc`（legacy-peer-deps）が無い（同梱済み）。
- 本番ビルドで `expo-updates` が入り `updates.url`/`runtimeVersion` を要求 → app.config に記載済み。

完了すると `.ipa` のURLが出る（10〜20分）。

---

## フェーズ3：App Store Connect 準備（🌐）
### 3-1. アプリ枠の作成
`eas submit` が自動作成してくれる（フェーズ5）か、手動で「マイApp → ＋」。
- Bundle ID：`com.bridgemed.worklog`（無ければ先に `eas build` すると自動登録される）
- 作成後 **App情報 → Apple ID（数字）= ascAppId** を `eas.json` に記入。

### 3-2. 有料App契約（IAPの前提・忘れやすい）
**上部メニュー「ビジネス」**（アプリ画面の中ではない）→ 契約 →「有料App」に同意
→ **銀行口座**＋**税務情報（W-8BEN）**。
- W-8BEN（日本の個人）：居住国=日本に**チェック(9番)**、特典は **Article 12 / 0% / Income from the sale of applications**、
  Title=`Owner`、Foreign TIN=**マイナンバー**（任意）、生年月日 MM-DD-YYYY、Part IIIで署名2か所チェック。
- ステータスが **Active** になるまで待つ。

### 3-3. アプリ内課金（消費型）を3つ
収益化 → App内課金 → ＋（3回）。**製品IDは厳守**：`coins_10` `coins_30` `coins_100`
- タイプ：**消費型**／参照名／**価格**（¥250・¥600・¥1,600目安）
- **ローカリゼーション（必須）**：日本語の表示名＋説明（オファーコードは不要）
- **審査用スクショ（必須）**：コイン画面のスクショ1枚
- 初回IAPは **App本体と一緒に審査**（バージョン画面の「アプリ内購入」で選択して提出）

---

## フェーズ4：スクリーンショット（最大の難所）★
実機(TestFlight)かシミュレータの**実画面**が必要（webプレビューのスクショ不可）。

### 4-1. TestFlightで実機に入れる
1. 🌐 ASC → TestFlight → ビルドの **輸出コンプライアンス** が出たら「管理」→**いいえ（標準暗号のみ）**
   （テンプレは `ITSAppUsesNonExemptEncryption:false` 済みなので次回から出ない）
2. 🌐 内部テスト → グループ **Team (Expo)** にビルド追加＋**自分をテスターに追加**
3. 📱 iPhoneの **TestFlightアプリ**（**ASCと同じApple IDでログイン**）→ アプリが出る→インストール
   - 「コードを使う/招待が必要」画面 = テスター未登録 or 別Apple ID。上記2と端末のApple IDを確認。

### 4-2. 必要なサイズ（ここ重要）
| 端末区分 | 必須サイズ(px, 縦) | 備考 |
|---|---|---|
| **iPhone 6.9インチ** | **1320 × 2868** | 必須。iPhone 16/17 Pro Max のサイズ |
| **iPad 13インチ** | **2048 × 2732** | `supportsTablet:true` の場合**必須**。不要なら下記で回避 |

- 手持ちが iPhone 17（**1206×2622**）等だと、そのままでは弾かれる → **1320×2868 にリサイズ**（比率ほぼ同じなので拡大でOK）。
- **iPadを出さないなら**：`app.config.ts` の `ios.supportsTablet` を **`false`** にして再ビルド → iPadスクショ不要になる。
- 枚数：各サイズ 3〜5枚（ホーム/記録/タスク(マトリクス)/そだち/英単語 など）。

### 4-3. Windowsでのリサイズ
- ペイント：右クリック→ペイントで開く→「サイズ変更」→**ピクセル**→**「縦横比を維持」OFF**→幅/高さを**両方**指定→PNG保存。
- まとめてなら **PowerToys の「画像のサイズ変更」**（カスタムサイズ・縦横比無視で一括）。

---

## フェーズ5：掲載情報を埋めて提出（🌐）
配信 → バージョン1.0：
- **概要(説明)/プロモーション文/キーワード**：`store/listing-ja.md` から
- **サポートURL**：`https://bridge-med.github.io/bridge-lp/legal/support.html`
- **著作権**：`2026 Wataru Hashimoto`（年＋名・©不要）
- **ビルド**：1.0.0(最新) を選択
- **スクショ**：4でアップ

アプリ情報／左メニュー：
- **プライバシーポリシーURL**：`https://bridge-med.github.io/bridge-lp/legal/privacy.html`（**綴り注意**）
- **プライマリカテゴリ**：仕事効率化（必須）
- **アプリのプライバシー**：データを収集していません
- **年齢レーティング**：全て「なし」→4+
- **App Review情報**：**「サインインが必要です」のチェックを外す**（アカウント不要）＋連絡先＋メモ
- **価格**：アプリ本体は **無料**

最後に提出：
```powershell
npx eas-cli submit --platform ios --profile production --latest
```
- API Key ロール → **ADMIN**（初回はアプリ作成も伴うため確実）
- アップロード後、ASCで **IAPをこのバージョンに紐付け** → **「審査へ提出」**

---

## フェーズ6：審査後・更新
- **JS/データ修正**：審査不要で配信 → `npx eas-cli update --branch production -m "..."`
- **ネイティブ変更/新機能/SDK更新/アイコン**：再ビルド＆再提出。`version` を上げる（ビルド番号はEAS自動）。

---

## AIバックエンド（任意・Supabase）— 実体験メモ
- 関数デプロイは **mobile/ で** `npx supabase login` → `link --project-ref <ref>` → `functions deploy ai --no-verify-jwt`。
- secrets：`GEMINI_API_KEY`（**Paid/Billing有効キー**）、`APP_SHARED_SECRET`。
- **新形式のGeminiキー（`AQ.`始まり）はヘッダ認証**（`x-goog-api-key`）。テンプレ対応済み。
- クライアントのSupabase URL/公開キーは `lib/env.ts` に既定値で埋め込み済み（公開可）。

---

## 量産チェックリスト（新アプリ）
- [ ] `mobile/` をコピー → `app.config.ts`：name/slug/scheme/bundleId/`experiments.baseUrl`
- [ ] アイコン：`scripts/gen-icons.mjs` → `node scripts/gen-icons.mjs`
- [ ] `lib/theme.ts` 配色、`store/` 掲載文・プライバシー/サポートHTML（連絡先）
- [ ] iPad不要なら `ios.supportsTablet:false`
- [ ] `eas init`（新Project ID）→ app.config に反映
- [ ] フェーズ2〜5を実行
