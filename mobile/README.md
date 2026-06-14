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
| **タスク** | 未完了/今日まで/すべてで絞り込み。チェックで完了切替、優先度・期限つき。上部に件数サマリー |
| **メモ** | 形式自由のメモ。ピン留めで上部固定。更新日時を表示 |
| **日記** | 日付＋気分(5段階)＋本文。新しい順のタイムライン |
| **設定** | 件数サマリー、JSON バックアップの書き出し（共有）/取り込み、全削除、アプリ情報 |

## 課金（買い切り Pro）

「無料フル機能 × 買い切り Pro で便利機能を解放」のフリーミアム構成です。

| | 無料 | **Pro（買い切り ¥980）** |
|---|:--:|:--:|
| タスク・メモ・日記（無制限） | ✓ | ✓ |
| JSON バックアップ | ✓ | ✓ |
| **ふりかえり**（ストリーク・気分グラフ・月次サマリー） | – | ✓ |
| **Markdown エクスポート** | – | ✓ |
| 複数リマインダー / タグ・検索 / テーマ（今後） | – | ✓ |

- 課金状態は `lib/entitlement.ts` が単一の真実。`usePro()` で参照し、機能側はこのフラグだけに依存します。
- 現状 `purchasePro()` は**ローカル解錠のモック**です。本番化は RevenueCat (`react-native-purchases`) に差し替え（このファイルだけ）+ EAS 開発ビルド + ストア商品登録が必要です。
- 動作確認用に **設定 → このアプリについて → 「（開発用）Pro 状態を切り替え」** で Pro の ON/OFF を切替できます。

> ⚠️ IAP も AdMob も **Expo Go では動かず開発ビルド(EAS)が必須**。実際の販売・審査・課金テストは、あなたの Apple / Google 開発者アカウント＋EAS で行ってください。

## 設計（拡張しやすさ）

Web 版 `worklog` と同じく、データ層を抽象化して将来のバックエンド移行に備えています。

```
lib/
  types.ts        型定義（フラットなレコード。将来テーブルへ1:1で写せる）
  storage.ts      永続化（AsyncStorage 実装。ここだけ差し替えれば Supabase 等へ移行可能）
  store.ts        リアクティブなコレクション（useSyncExternalStore でタブ間同期）
  data.ts         コレクション実体（tasks / memos / journal）＋ import/export
  entitlement.ts  Pro 課金状態（usePro / purchasePro。RevenueCat に差し替え可能）
  stats.ts        ふりかえり用の集計（ストリーク・気分分布・月次）
  markdown.ts     Markdown エクスポート生成
  date.ts         日付ユーティリティ（端末ローカルTZ）
  theme.ts        デザイントークン（Web 版と同じ白ベース／青グレー配色）
components/
  ui.tsx          共通UI（Card / Button / Field / Chip / Fab / EmptyState …）
  Sheet.tsx       追加・編集用のボトムシート
  ProFeatures.tsx Pro 特典リスト（ペイウォール・設定で共有）
app/
  _layout.tsx          ルート（SafeArea / 起動時ロード / paywall・review 登録）
  (tabs)/_layout.tsx   タブ定義
  (tabs)/index.tsx     タスク
  (tabs)/memo.tsx      メモ
  (tabs)/journal.tsx   日記（→ ふりかえり導線）
  (tabs)/settings.tsx  設定（Pro カード / エクスポート）
  review.tsx           ふりかえり（Pro。未購入はティザー）
  paywall.tsx          ペイウォール（モーダル）
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
