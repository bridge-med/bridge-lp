# BRIDGE Worklog — ストア公開ランブック（実装の手前→公開）

このリポジトリには **あなたのアカウント/認証が不要な範囲は全部** 用意してあります。
残りは「あなたのアカウントで鍵を入れて差し替える」だけです。所要は概ね半日〜1日（審査待ち除く）。

## いま出来ていること（コード側）
- アプリ本体（5タブ・全画面）／ローカル保存で完全動作
- AIは BYOK（鍵があれば Gemini、無ければモック）— `lib/ai.ts`
- 課金フラグの単一窓口 `lib/entitlement.ts`（`useAdFree`）＋ペイウォール画面
- 広告枠 `components/BannerSlot.tsx`（プレースホルダ、広告オフで非表示）
- `eas.json` / `app.config.ts`（env対応）/ `.env.example`
- Supabase クライアント雛形 `lib/supabase.ts` ＋ スキーマ `supabase/schema.sql`
- CI: `.github/workflows/eas-build.yml`（手動/タグで EAS ビルド）
- ストア掲載文・プライバシーポリシー・審査メモ・素材チェックリスト（`store/`）

## あなたがやること（要アカウント/支払い）
0. 各アカウント作成：Expo / Apple Developer(年¥約12,000) / Google Play(初回¥約3,500) /（広告なら）AdMob /（課金なら）RevenueCat。Gemini鍵は任意。
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
   ※ Expo Go では IAP/広告は動きません。開発ビルドで確認します。

---

## 広告（AdMob）を入れる
```bash
npx expo install react-native-google-mobile-ads
```
`.env` に：
```
ADMOB_ANDROID_APP_ID=ca-app-pub-xxx~xxx
ADMOB_IOS_APP_ID=ca-app-pub-xxx~xxx
EXPO_PUBLIC_ADMOB_BANNER_ANDROID=ca-app-pub-xxx/xxx
EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-xxx/xxx
```
`app.config.ts` は App ID があれば自動でプラグインを追加します。
`components/BannerSlot.tsx` の中身を実バナーに差し替え：
```tsx
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import { env } from '../lib/env';
// adFree が false のときだけ表示（既存のガードはそのまま）
const unitId = Platform.OS === 'ios' ? env.admobBannerIos : env.admobBannerAndroid;
return <BannerAd unitId={unitId} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />;
```
iOS は ATT（App Tracking Transparency）対応も検討（`expo-tracking-transparency`）。

## 課金（RevenueCat で「広告を消す」）
```bash
npx expo install react-native-purchases
```
RevenueCat ダッシュボードで非消耗型プロダクト `bridge_worklog_adfree`（仮）と
Entitlement `adfree` を作成。`.env` に `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY`。
`lib/entitlement.ts` の `purchaseAdFree` / `restorePurchases` / `load` を差し替え：
```ts
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { env } from './env';
// 起動時に一度:
Purchases.configure({ apiKey: Platform.OS === 'ios' ? env.revenuecatIosKey : env.revenuecatAndroidKey });
// load(): const info = await Purchases.getCustomerInfo(); adFree = !!info.entitlements.active['adfree'];
// purchaseAdFree(): const offerings = await Purchases.getOfferings();
//   await Purchases.purchasePackage(offerings.current!.availablePackages[0]); then set(true)
// restorePurchases(): const info = await Purchases.restorePurchases(); return !!info.entitlements.active['adfree'];
```
アプリ内の他の場所（ペイウォール・設定）は `useAdFree()` を見ているので変更不要です。

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
- 審査メモ：`store/review-notes.md`（アカウント不要・BYOK・買い切りである旨）
- スクショ/アイコン：`store/assets-checklist.md`

## 最終チェック
- [ ] アイコン/スプラッシュを実ブランド画像に（現状はExpo既定）
- [ ] バージョン/ビルド番号、bundleId(`com.bridgemed.worklog`)確認
- [ ] iOS: ATT・課金サンドボックステスト / Android: 内部テストトラック
- [ ] プライバシー表示（AdMob使うなら識別子の申告）
