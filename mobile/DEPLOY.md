# BRIDGE Worklog — ストア公開ランブック（実装の手前→公開）

このリポジトリには **あなたのアカウント/認証が不要な範囲は全部** 用意してあります。
残りは「あなたのアカウントで鍵を入れて差し替える」だけです。所要は概ね半日〜1日（審査待ち除く）。

## いま出来ていること（コード側）
- アプリ本体（全タブ・全画面）／ローカル保存で完全動作
- AIは **マネージド（コイン消費）**。現状はローカル整形でプレビュー動作 — `lib/ai.ts` / `lib/credits.ts`
- コイン経済（残高・パック・消費・登録特典）`lib/credits.ts` ＋ コイン画面 `app/coins.tsx`
- 広告なし・BYOK（自分のキー）なし
- `eas.json` / `app.config.ts`（env対応）/ `.env.example`
- Supabase クライアント雛形 `lib/supabase.ts` ＋ スキーマ `supabase/schema.sql`
- CI: `.github/workflows/eas-build.yml`（手動/タグで EAS ビルド）
- ストア掲載文・プライバシーポリシー・審査メモ・素材チェックリスト（`store/`）

## あなたがやること（要アカウント/支払い）
0. 各アカウント作成：Expo / Apple Developer(年¥約12,000) / Google Play(初回¥約3,500) / RevenueCat（消費型IAP）。生成用の開発者AIキー（サーバ側）。
1. **EAS 初期化**
   ```bash
   cd mobile && npm install --legacy-peer-deps
   npm i -g eas-cli && eas login && eas init   # projectId が作られる
   ```
   `.env` に `EAS_PROJECT_ID` と `EAS_OWNER` を設定（`app.config.ts` が読みます）。
2. **実機で動作確認（開発ビルド）**
   ```bash
   eas build --profile development --platform ios   # または android
   ```
   ※ Expo Go では IAP は動きません。開発ビルドで確認します。

---

## 課金（RevenueCat で「コイン」消費型IAP）
```bash
npx expo install react-native-purchases
```
クライアント側は **実装済み**。やることは3つだけ：
1. `npm i react-native-purchases`（native の `lib/iap.native.ts` が有効化される）
2. RevenueCat で **消費型（consumable）** プロダクトを `lib/credits.ts` の
   `COIN_PACKS`（`coins_10` / `coins_30` / `coins_100`）の id に合わせて作成
3. `.env` に `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`

起動時 `configureIap()`、購入は `app/coins.tsx` の `buy()`→`purchasePack(id)`→成功で
`credits.add(pack.coins)` まで結線済み。web/Expo Go では自動でデモ購入にフォールバック。

`app/coins.tsx` の `buy()` は **実装済み**：`iapEnabled()` なら `purchasePack(id)`→成功で `credits.add`。
native の実体は `lib/iap.native.ts`（RevenueCat）。web/プレビューは `lib/iap.ts`（デモ）に自動で切替。
より厳密にするならサーバでレシート検証→残高クレジット（不正防止）に発展可能。

## 生成バックエンド（開発者キー）— 実装済み・鍵を入れるだけ
AI生成・翻訳は **Supabase Edge Function `ai`**（`supabase/functions/ai/index.ts`）に実装済み。
サーバ側で開発者の Gemini キーを使い、クライアントには鍵を置きません。

```bash
# Supabase プロジェクトに紐付け済みの状態で:
supabase functions deploy ai --no-verify-jwt
supabase secrets set GEMINI_API_KEY=xxxx
# 任意: supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```
`.env` に `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` を入れれば、
クライアント（`lib/backend.ts`）が `${SUPABASE_URL}/functions/v1/ai` を自動で呼びます
（別ホストなら `EXPO_PUBLIC_AI_BACKEND_URL` を指定）。

- 設定あり → `lib/ai.ts` / `lib/lang.ts` が **本物のAI**（タスク化・メモ整理・ふり返り・
  キャリア変換・働き方分析・英/韓翻訳）を呼ぶ。
- 設定なし → そのままオフラインのプレビュー（ローカル整形・グロッサリ訳）で動作。
- モデル差し替えは `GEMINI_MODEL`（2.5-flash↔3.0系）だけで可。

## クラウド同期（Supabase・任意）
1. Supabase プロジェクト作成 → SQL エディタで `supabase/schema.sql` を実行。
2. `.env` に `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`。
3. 認証（メール/OAuth）を追加し、`lib/storage.ts` に `user_id` ベースの
   Supabase アダプタを実装（AsyncStorage 実装と差し替え）。`getSupabase()` は用意済み。

---

## ビルド & 申請
**CIで（推奨）**：リポジトリ Secret に `EXPO_TOKEN` を登録 → GitHub の Actions タブから
「EAS Build (mobile)」を実行（platform/profile/submit を選択）。タグ `mobile-v0.1.0` push でも起動。
（`workflow_dispatch` は `master` にこのワークフローがある必要があります）

**ローカルで**：
```bash
eas build --platform all --profile production
eas submit --platform ios     # eas.json の submit に Apple ID 等を記入後
eas submit --platform android  # google-service-account.json を配置後
```

## ストア掲載
- 文言：`store/listing-ja.md` / `store/listing-en.md`
- プライバシーポリシー：`store/privacy-policy.md` を公開URL化（例：GitHub Pages に置く）
- 審査メモ：`store/review-notes.md`（アカウント不要・コイン消費型IAPである旨）
- スクショ/アイコン：`store/assets-checklist.md`

## 最終チェック
- [ ] アイコン/スプラッシュを実ブランド画像に（現状はExpo既定）
- [ ] バージョン/ビルド番号、bundleId(`com.bridgemed.worklog`)確認
- [ ] iOS: 課金サンドボックステスト / Android: 内部テストトラック
- [ ] 消費型IAPのレシート検証（サーバ）→ コイン残高クレジット
