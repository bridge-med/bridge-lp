# BRIDGE Worklog

日々の**仕事ログ・メモ・タスク・気づき**を自然に蓄積し、その履歴が結果的に
**職務経歴書・自己PR・面接回答・1on1・昇給交渉・副業プロフィール**の材料になる、
スマホファーストの個人用アプリ（MVP）。

「職務経歴書を作るアプリ」ではなく、*日々の仕事ぶり・思考過程・改善プロセスが残ること*を重視します。
最初のターゲットは医療職（PT/OT・看護師・医療事務・事務長候補・PMI 等）ですが、設計は汎用です。

- **スタック**: Expo (SDK 56) + React Native + TypeScript + expo-router
- **保存**: 端末内 `AsyncStorage`（オフライン）。**Supabase 未設定でも起動・動作**します（差し替え点は `lib/storage.ts`）。
- **AI・課金は後付け前提**で分離済み（下記）。

## 起動方法

```bash
cd mobile
npm install
npx expo start          # QR を Expo Go で読む / npm run ios|android
```

環境変数は不要（ローカルで完結）。Gemini を使う場合のみ、アプリ内（設定→AI）で**自分のキー**を登録します。

> ⚠️ この環境ではネットワークポリシー上 `npx expo install` のバージョン解決APIに繋げないため、
> 依存追加は `node_modules/expo/bundledNativeModules.json` のバージョンを `npm install <pkg>@<ver>` で直接指定してください。

## 画面 / タブ

下部タブ：**ホーム / タイムライン / タスク / 振り返り / 設定**

| 画面 | 役割 |
|---|---|
| Onboarding | 初回に職種・立場・目的を選択（プロフィール） |
| ホーム | 今日のクイックメモ／仕事ログ作成、未完了タスク数・今週のログ数、振り返り導線、最近のログ |
| 仕事ログ作成/詳細 | 11項目（やったこと/困った/工夫/判断/関わった人/結果/学び/次/メモ）＋タグ。空欄保存OK |
| クイックメモ | 1行から保存。AIで整える。後でログ化も可 |
| タスク | 未着手/進行中/保留/完了で管理、期限、ログ関連付け、AIでまとめて追加、スワイプ削除 |
| タイムライン | ログ・メモ・タスク完了・振り返りを時系列表示（種別フィルタ） |
| 振り返り | 週次/月次をログから生成（AIキーありで Gemini、無しでモック） |
| キャリア変換 | 選択ログから職務経歴書/自己PR/面接/1on1/昇給/副業の文章を生成（AI or モック） |
| 設定 | プロフィール、テーマ、AIキー、広告を消す、バックアップ、全削除 |

## データモデル（Supabase テーブルに 1:1）

`lib/types.ts`：`work_logs` / `quick_memos` / `tasks` / `reflections` / `career_outputs`、
プロフィール（users 相当）は `lib/prefs.ts` に保持。フラットなレコードなので、
`lib/storage.ts` の AsyncStorage 実装を Supabase クライアントに差し替えれば移行できます。

## AI — マネージド（コイン消費）

- ユーザーはAPIキーを持たず、アプリ内で **コインを購入** → 生成ごとにコイン消費（軽1／重2／翻訳1）。
- **バックエンド実装済み**：`supabase/functions/ai/index.ts`（Supabase Edge Function）が開発者の
  Gemini キー（サーバ secret）で生成。クライアントは `lib/backend.ts` 経由で呼ぶ。鍵はアプリに入らない。
- **設定があれば本物のAI**（タスク化・メモ整理・ふり返り・キャリア変換・働き方分析・英/韓翻訳）、
  なければ `lib/ai.ts` / `lib/lang.ts` のオフライン・プレビューに自動フォールバック。
- 課金は `lib/iap.native.ts`（RevenueCat・消費型IAP）。web/プレビューはデモ購入。
- 登録特典として初回に無料コイン（`STARTER`）。BYOK・広告は廃止。

## 成長・相棒・語学（続けたくなる仕掛け）

- **相棒（育つ芽）** `components/BuddySprite.tsx`：レベルで7段階に姿が変化。着せ替え対応。
- **レベル制** `lib/leveling.ts`：Lv1–50、後半ほど必要EXP増。100日フル入力で≈Lv50。
- **進捗** `lib/progress.ts`：XP・連続記録・称号。記録すると加点、毎日でデイリー＋連続ボーナス。節目でコイン進呈。
- **ごほうび演出** `components/RewardModal.tsx`：レベルアップ／連続／称号で紙吹雪のお祝い。
- **きせかえ** `lib/cosmetics.ts` ＋ `app/closet.tsx`：コインで帽子・鉢・背景・アクセを購入＆装着（コインの出口）。
- **語学カード** `lib/lang.ts` ＋ `app/lang.tsx`：仕事ログを英語・韓国語の学習カード（訳＋単語帳）に変換（1回1コイン）。現状はグロッサリでプレビュー、本番はサーバ翻訳に差し替え。
- 「そだち」タブ＝成長ダッシュボード＋キャリア/自己理解モジュール。
- **毎日のリマインダー** `lib/notifications.ts`：設定でON＋時間を選ぶと、ローカル通知が毎日届く（連続記録の習慣化）。web は非対応で自動 no-op、実機（dev/本番ビルド）で有効。

## アイコン / スプラッシュ

`scripts/gen-icons.mjs`（`@resvg/resvg-js`、dev-only）で生成。ブランドの上昇バー・マーク（青グラデ）。再生成は `node scripts/gen-icons.mjs`。

## マネタイズ（コインのみ・広告なし）

広告は無し。AI生成は **コイン消費型**（`lib/credits.ts`：`GEN_COST` / `COIN_PACKS` / `STARTER`）。
コイン画面（`app/coins.tsx`）でパック購入、各AI機能が1コインずつ消費。

- 課金本番化：RevenueCat `react-native-purchases`（消費型IAP）でコイン残高をクレジット。
- 生成本番化：サーバ（開発者キー）に接続し、`lib/ai.ts` のローカル整形を置き換え。

## アーキテクチャ

```
lib/
  constants.ts  職種/立場/目的/タグ/タスク状態/キャリア変換タイプのマスタ
  types.ts      型定義（Supabase テーブルに対応）
  storage.ts    永続化（AsyncStorage。Supabase へ差し替える単一点）
  store.ts      リアクティブ Collection（useSyncExternalStore）
  data.ts       コレクション実体 ＋ import/export
  prefs.ts      プロフィール・テーマ・オンボーディング状態
  credits.ts    コイン残高・パック・消費（マネージドAIの土台）
  ai.ts         AIヘルパー（現状ローカル整形／本番はサーバ生成）
  date.ts / tags.ts / haptics.ts / theme.ts
components/  ui, Sheet, Onboarding, TagPicker, TaskSheet, QuickMemoSheet,
             AiTaskSheet, SwipeRow, BlockHeader, ThemeProvider, ThemePicker
app/
  _layout.tsx          ルート（起動ロード / オンボーディング / stack 登録）
  (tabs)/              index(ホーム) / timeline / tasks / reflection / hub / settings
  log-edit.tsx         仕事ログ作成・編集
  log/[id].tsx         仕事ログ詳細
  career.tsx           キャリア変換
  coins.tsx            コイン購入
  workstyle.tsx        働き方タイプ分析
  m/[key].tsx          キャリア/自己理解モジュール
```

## 今後の実装予定

- Supabase 連携（認証・複数端末同期）— `lib/storage.ts` 差し替え
- RevenueCat 結線（消費型IAP→コイン）＋サーバ生成（開発者キー）
- AI 自動タグ付け、PDF / CSV エクスポート、Notion / カレンダー連携
- 採用企業向け共有URL、匿名ポートフォリオ共有
