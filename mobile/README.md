# BRIDGE Daily

タスク・メモ・日記を1つにまとめた、スキマ時間のための個人用**ネイティブアプリ**（iOS / Android）。
BRIDGE の Web ツール群（`worklog` など）の思想 ―― *スマホで1分入力・データは端末内・将来バックエンドに差し替え可能* ―― をネイティブに移植したものです。

- **スタック**: Expo (SDK 56) + React Native + TypeScript + expo-router
- **保存先**: 端末内 `AsyncStorage`（オフライン・サーバ送信なし）
- **画面**: タスク / メモ / 日記 / 設定 の4タブ

## 起動方法

```bash
cd mobile
npm install
npx expo start
```

- 表示される QR コードを **Expo Go**（App Store / Google Play）で読み取ると実機で確認できます。
- `npm run ios` / `npm run android` でシミュレータ起動（要 Xcode / Android Studio）。

> ⚠️ この環境ではネットワークポリシー上、`npx expo install` のバージョン解決 API（api.expo.dev）に接続できません。
> 依存を追加するときは `node_modules/expo/bundledNativeModules.json` に記載のバージョンを `npm install <pkg>@<version>` で直接指定してください。

## 機能

| 画面 | 役割 |
|---|---|
| **タスク** | 期限切れ/今日/今後/期限なし/完了に自動セクション分け。チェックで完了（触覚フィードバック）、優先度・期限・タグ。検索バー＋件数サマリー |
| **メモ** | 形式自由のメモ。ピン留めで上部固定、タグ、検索、更新日時 |
| **日記** | 日付＋気分(5段階)＋本文。新しい順のタイムライン。→ ふりかえり |
| **設定** | 件数サマリー、テーマ切替、AIキー登録、広告を消す、JSON / Markdown バックアップ、全削除、アプリ情報 |

- 初回起動時に **3画面のオンボーディング**（スキップ可）。
- タスク行は **左スワイプで削除**（確認ダイアログ付き）。
- **機能はすべて無料**。マネタイズは広告のみ（下記）。

## マネタイズ（全機能無料 + 広告 + 買い切りで広告除去）

**機能はすべて無料**（AI整理・ふりかえり・タグ・テーマ・検索・エクスポート）。マネタイズは
**タスク／メモ一覧の控えめなバナー広告**のみで、**買い切りで広告を消せます**（日記には広告を出さない）。

- 広告除去の状態は `lib/entitlement.ts` が単一の真実。`useAdFree()` で参照。
- `purchaseAdFree()` は現状**ローカル解錠のモック**。本番化は RevenueCat (`react-native-purchases`) に差し替え（このファイルだけ）+ EAS 開発ビルド + ストア商品登録。
- 広告は `components/BannerSlot.tsx`（現状プレースホルダ）。本番は AdMob `react-native-google-mobile-ads` に差し替え（EAS 開発ビルド必須）。
- 動作確認用に **設定 → このアプリについて → 「（開発用）広告オフを切り替え」**。

> ⚠️ IAP も AdMob も **Expo Go では動かず開発ビルド(EAS)が必須**。販売・審査・広告は、あなたの Apple / Google / AdMob アカウント＋EAS で行ってください。

### AI（Gemini）について — 無料機能・BYOK
- **BYOK（自分のAPIキー方式）**：ユーザーが自分の Gemini APIキー（無料枠あり）を設定 → 端末から直接 `generativelanguage` API（`gemini-2.5-flash`, structured output）を呼びます。サーバ不要・運営側のAPI費用ゼロ。
- 「自分のキーなのに課金」は不自然なので **AIは無料**（広告でマネタイズ）。
- キーは `lib/prefs.ts` に端末内保存（平文）。ロジックは `lib/ai.ts`。設定で「キーを確認」可能。
- 機能：タスクの「✨ AIでまとめて追加」、メモの「✨ AIで整理」、ふりかえりの「✨ AIふりかえり」。

## 設計（拡張しやすさ）

Web 版 `worklog` と同じく、データ層を抽象化して将来のバックエンド移行に備えています。

```
lib/
  types.ts        型定義（フラットなレコード。将来テーブルへ1:1で写せる）
  storage.ts      永続化（AsyncStorage 実装。ここだけ差し替えれば Supabase 等へ移行可能）
  store.ts        リアクティブなコレクション（useSyncExternalStore でタブ間同期）
  data.ts         コレクション実体（tasks / memos / journal）＋ import/export
  entitlement.ts  広告除去の課金状態（useAdFree / purchaseAdFree。RevenueCat に差し替え可能）
  ai.ts           Gemini クライアント（タスク抽出・メモ整理・日記ふりかえり）
  prefs.ts        アプリ設定（オンボーディング・アクセント・Geminiキー）永続化
  stats.ts        ふりかえり用の集計（ストリーク・気分分布・月次）
  markdown.ts     Markdown エクスポート生成
  tags.ts         タグ収集・テキスト検索のヘルパー
  haptics.ts      触覚フィードバックの薄いラッパー
  date.ts         日付ユーティリティ（端末ローカルTZ）
  theme.ts        デザイントークン＋アクセントテーマ（paletteFor）
components/
  ThemeProvider.tsx 現在のパレットを配信（useColors でアクセント追従）
  ui.tsx          共通UI（Card / Button / Field / Chip / Fab / EmptyState …）
  Sheet.tsx       追加・編集用のボトムシート
  Onboarding.tsx  初回オンボーディング（3画面）
  SwipeRow.tsx    左スワイプ削除（Animated + PanResponder、確認付き）
  SearchBar.tsx   検索バー
  TagInput.tsx    タグ編集
  TagFilter.tsx   タグでの絞り込みチップ
  ThemePicker.tsx アクセントカラー選択
  BannerSlot.tsx  バナー広告枠（広告オフ時は非表示。本番は AdMob に差し替え）
  AiTaskSheet.tsx 走り書き→AIタスク化のシート
  ProFeatures.tsx 広告除去の価値リスト（ペイウォール用）
app/
  _layout.tsx          ルート（SafeArea / 起動時ロード / paywall・review 登録）
  (tabs)/_layout.tsx   タブ定義
  (tabs)/index.tsx     タスク（AIまとめ追加 / 広告バナー）
  (tabs)/memo.tsx      メモ（AI整理 / 広告バナー）
  (tabs)/journal.tsx   日記（→ ふりかえり導線・広告なし）
  (tabs)/settings.tsx  設定（広告を消す / テーマ / AIキー）
  review.tsx           ふりかえり（AIふりかえり含む）
  paywall.tsx          広告を消す（モーダル）
```

## プライバシー

入力データは端末内（`AsyncStorage`、平文）のみに保存され、サーバには送信されません。
共有端末・紛失に注意し、機種変更前に設定画面から JSON バックアップを書き出してください。

## 今後の拡張案

- [ ] プッシュ通知（毎朝のタスク／日記リマインド）— `expo-notifications`
- [ ] バックエンド同期（Supabase 等）— `lib/storage.ts` の差し替えで対応
- [ ] タスクの繰り返し設定、タグ／検索
- [ ] 日記の月次サマリー・気分グラフ
- [ ] ファイル選択での import（`expo-document-picker`）
