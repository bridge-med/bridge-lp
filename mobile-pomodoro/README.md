# BRIDGE Focus

「タスクを管理するアプリ」ではなく、**「今やる作業に集中するためのアプリ」**。
ポモドーロタイマーとしてシンプルに使え、集中時間が**作業（WorkItem）に紐づいて**残ります。
メモ・タスク・作業ログは別アプリに任せ、このアプリは *計画ではなく実行／管理ではなく集中／
記録ではなく集中時間の積み上げ* に特化します。

- **スタック**: Expo (SDK 56) + React Native + TypeScript(strict) + expo-router
- **保存**: 端末内 `AsyncStorage`（オフライン・アカウント不要）。差し替え点は `lib/storage.ts`
- **広告／トラッキングなし／課金なし**。プライバシーは「データ収集なし」

## 起動方法

```bash
cd mobile-pomodoro
npm install --legacy-peer-deps
npm run typecheck                     # tsc --noEmit
npx expo start                        # Expo Go で読む / npm run ios|android
npx expo export --platform web --output-dir /tmp/webexport   # web 書き出し
```

> ⚠️ この環境ではネットワークポリシー上 `npx expo install` のバージョン解決APIに繋げないため、
> 依存追加は `node_modules/expo/bundledNativeModules.json` のバージョンを
> `npm install <pkg>@<ver> --legacy-peer-deps` で直接指定してください。

## 画面 / タブ

下部タブは **Focus / Log / Settings** の3つ。

| 画面 | 役割 |
|---|---|
| Focus | 今日の日付・今日の集中時間／大きなタイマー＋円形プログレス／現在の作業名（タップで選択・手入力、作業なしでも開始可）／START・STOP・リセット・スキップ／Focus・Short・Long。終了時に **完了 / もう1セット続ける / 中断 ＋ ひとことメモ** を選択 |
| 没入モード (`/immerse`) | 全画面・減光・呼吸するリングだけの「触らせない」集中画面。タップで一瞬だけ操作が出て自動で消える。完了で自動的に戻る |
| Log | 今日の合計集中時間・セッション数／作業別の集中時間／直近ログ（カード）。管理画面化せず「実績確認」に限定 |
| Settings | 集中/小休憩/長休憩の時間、没入モード自動化、通知音（5種から選択）、バイブ、テーマ（Light/Dark/System）、全削除 |

## データモデル（`lib/types.ts`）

将来の外部連携を見越した形:

```ts
WorkItem    { id, title, source, sourceId, category, createdAt, updatedAt }
FocusSession{ id, workItemId, startTime, endTime, duration, status, note, createdAt, updatedAt }
```

- `source`: `manual | memo_app | task_app | worklog_app`。MVPは `manual`（手入力）。
- フラットなレコードなので、`lib/storage.ts` の AsyncStorage 実装を差し替えれば同期/バックエンド移行できます。
- `lib/data.ts` の `buildExport()` / `importBundle()` でバックアップ＆作業ログアプリへの受け渡しの土台。

## アーキテクチャ

```
lib/
  types.ts      型定義（WorkItem / FocusSession）
  storage.ts    永続化（AsyncStorage。差し替える単一点）
  store.ts      リアクティブ Collection（useSyncExternalStore）
  data.ts       コレクション実体 ＋ import/export ＋ サンプルデータ
  prefs.ts      時間・通知・テーマ・没入設定
  timer.ts      タイムスタンプ基準のタイマーエンジン（完了→pending→画面が記録）
  sound.ts      内蔵チャイム5種（expo-audio）
  notifications.ts  完了アラーム（バックグラウンド用ローカル通知）
  date.ts / haptics.ts / theme.ts / secure.ts / id.ts
components/  ThemeProvider(light/dark), Sheet, ErrorBoundary
app/
  _layout.tsx        ルート（フォント／サンプルデータ初期化／stack）
  (tabs)/            index(Focus) / log / settings
  immerse.tsx        没入モード（fullScreenModal）
```

## 将来の拡張（設計済みの足場）

- メモアプリ／タスク管理アプリから作業を受け取る（共有シート・ディープリンク `bridgefocus://`、`source`/`sourceId`）
- 集中ログを作業ログアプリへ返す（`buildExport`）
- AIで1日の集中内容を要約 → 日報・週報・職務経歴書・振り返りの材料
- クラウド同期（`lib/storage.ts` 差し替え）

## アイコン / スプラッシュ

`scripts/gen-icons.mjs`（`@resvg/resvg-js`、dev-only）で生成。ブランド＝ネイビー地のフォーカスリング＋焦点ドット。
再生成は `node scripts/gen-icons.mjs`。

## リリース

`store/`（掲載文・プライバシー・審査メモ・チェックリスト）と `eas.json` を参照。
詳細手順は `RELEASE-RUNBOOK.md` / `DEPLOY.md`。広告・トラッキング・課金なし＝データ安全性は「収集しない」。
