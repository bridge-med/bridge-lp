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

## AI（Gemini）— BYOK・無料機能

- ユーザー自身の Gemini APIキー（無料枠あり）を登録 → 端末から直接 `generativelanguage`（`gemini-2.5-flash`, structured output）を呼びます。サーバ不要。
- **キー未設定でも動作**：`generateReflection()` / `generateCareerOutput()` はモックにフォールバック。
- ロジックは `lib/ai.ts` に集約：`extractTasks`（走り書き→タスク）、`tidyMemo`、`generateReflection`、`generateCareerOutput`、`validateApiKey`。

## マネタイズ（全機能無料 + 広告 + 買い切り広告除去）

機能はすべて無料。`components/BannerSlot.tsx` の控えめバナー（タスク/メモ/タイムライン等の一覧、**ログ詳細や日記的画面には出さない**）＋
買い切り「広告を消す」（`lib/entitlement.ts` の `useAdFree`）。

- 広告本番化：AdMob `react-native-google-mobile-ads` に差し替え（EAS 開発ビルド必須）。
- 課金本番化：RevenueCat `react-native-purchases` に差し替え（`entitlement.ts` のみ）。
- 動作確認：設定 → このアプリについて → 「（開発用）広告オフを切り替え」。

## アーキテクチャ

```
lib/
  constants.ts  職種/立場/目的/タグ/タスク状態/キャリア変換タイプのマスタ
  types.ts      型定義（Supabase テーブルに対応）
  storage.ts    永続化（AsyncStorage。Supabase へ差し替える単一点）
  store.ts      リアクティブ Collection（useSyncExternalStore）
  data.ts       コレクション実体 ＋ import/export
  prefs.ts      プロフィール・テーマ・AIキー・オンボーディング状態
  entitlement.ts 広告除去の課金状態（useAdFree）
  ai.ts         Gemini クライアント＋AIヘルパー（モックfallback）
  date.ts / tags.ts / haptics.ts / theme.ts
components/  ui, Sheet, Onboarding, TagPicker, TaskSheet, QuickMemoSheet,
             AiTaskSheet, SwipeRow, BannerSlot, ThemeProvider, ThemePicker
app/
  _layout.tsx          ルート（起動ロード / オンボーディング / stack 登録）
  (tabs)/              index(ホーム) / timeline / tasks / reflection / settings
  log-edit.tsx         仕事ログ作成・編集
  log/[id].tsx         仕事ログ詳細
  career.tsx           キャリア変換
  paywall.tsx          広告を消す（モーダル）
```

## 今後の実装予定

- Supabase 連携（認証・複数端末同期）— `lib/storage.ts` 差し替え
- AdMob / RevenueCat 結線（EAS 開発ビルド）
- AI 自動タグ付け、PDF / CSV エクスポート、Notion / カレンダー連携
- 採用企業向け共有URL、匿名ポートフォリオ共有
