# MOBILE APP PLAYBOOK — ゼロからApp Store/Google Playまで（量産用）

このリポジトリの `mobile/` を「型（テンプレート）」として、**同じ作り方でスマホアプリを量産する**ための手順書。
Claude Code（web/CLI）はこの `mobile/` をクローンした状態で読み、各セクションに沿って進められる。

> 関連ドキュメント：`README.md`(全体像) / `DEPLOY.md`(配信) / `RELEASE-RUNBOOK.md`(提出手順) / `AGENTS.md`(AIへの指示)

---

## 0. このスタックの思想（何を再現するか）

- **オフラインファースト**：ユーザーデータは端末内（AsyncStorage）。サーバ不要で動く。
- **BYO-Key AI**：AIは任意。ユーザー自身のAPIキー（OS keystoreに暗号化保存）か、開発者バックエンド。
- **相棒×ゲーミフィケーション**：記録するとXP/連続記録/称号で「育つ」。継続の動機付け。
- **収益化はコイン消費型IAP**（RevenueCat）。広告・トラッキングなし＝プライバシー欄は「収集なし」。
- **日本語UI・暖色のやさしいデザイン**。
- **Webプレビュー**を GitHub Pages に出して、実機ビルド前に触って確認できる。

---

## 1. 技術スタック（固定）

| 領域 | 採用 |
|---|---|
| フレームワーク | Expo SDK 56 + React Native（newArch有効） |
| ルーティング | expo-router（ファイルベース、`app/`） |
| 言語 | TypeScript（`strict: true`） |
| 状態/永続化 | 自作 `Collection`/ストア + `useSyncExternalStore` + AsyncStorage |
| 機密保存 | expo-secure-store（Keychain/Keystore） |
| 課金 | react-native-purchases（RevenueCat、消費型） |
| 通知 | expo-notifications（ローカル） |
| 音声 | expo-speech（OS音声、`lib/speech.ts`で最適voice選択） |
| ビルド/配信 | EAS Build / EAS Submit / EAS Update(OTA) |
| Webプレビュー | `expo export -p web` → GitHub Pages |

> **重要**：Expoはバージョンで作法が変わる。コードを書く前に必ず
> https://docs.expo.dev/versions/v56.0.0/ を確認（`AGENTS.md`の指示）。

---

## 2. プロジェクト構成（`mobile/`）

```
app/            画面（expo-router）。(tabs)/ はタブ、その他はStack
components/     再利用UI（ui.tsx, BlockHeader, Sheet, ErrorBoundary, …）
lib/            ロジック層（下記「再利用部品」）
assets/         アイコン/スプラッシュ/同梱データ(JSON)
scripts/        ビルド時生成（gen-icons.mjs, build-vocab*.mjs）
store/          ストア掲載文・審査メモ・プライバシー・チェックリスト
app.config.ts   アプリ定義（名前/ID/プラグイン/アイコン）
eas.json        ビルド/提出プロファイル
```

---

## 3. 再利用部品（`lib/`）— 新アプリでもほぼそのまま使える

- **`store.ts`** … `Collection<T>`：id/createdAt/updatedAt付きレコードのCRUD + 購読。`useCollection()`。
- **`prefs.ts`** … アプリ設定の単一ストア。**機密フィールドはsecure-storeへ自動隔離**（`SECRET_FIELDS`）。
- **`secure.ts`** … Keychain/Keystoreラッパ（web自動フォールバック）。
- **`progress.ts` / `leveling.ts` / `credits.ts`** … XP・連続記録・称号・コイン（ゲーミフィケーション一式）。
- **`iap.ts` / `iap.native.ts`** … RevenueCat課金。web/Expo Goはデモ、nativeは本物（Metroが自動切替）。価格はストアから取得表示。
- **`notifications.ts`** … 毎日のローカル通知（権限・チャンネル・再スケジュール）。
- **`speech.ts`** … TTS。言語に最適なvoiceを選択。
- **`ai.ts` / `env.ts` / `backend.ts`** … BYO-Key AI と任意のバックエンド。
- **`theme.ts` / `components/ui.tsx`** … 配色・タイポ・Button/Card/Chip/Field等。
- **`data.ts` / `types.ts`** … アプリ固有のデータモデルとコレクション束ね＋エクスポート/インポート。

**データ/アセットはビルドスクリプトで生成**（手打ちしない）：
- `scripts/gen-icons.mjs` … SVG→アイコン/スプラッシュ一式（@resvg/resvg-js）。
- `scripts/build-vocab*.mjs` … 公開コーパス/キュレーションから同梱JSONを生成。

---

## 4. 開発ワークフロー（毎回これを回す）

```bash
cd mobile
npm install --legacy-peer-deps
npm run typecheck                 # tsc --noEmit（必ず通す）
npx expo export --platform web --output-dir /tmp/webexport   # web書き出しが通るか
```
**プレビュー公開**（GitHub Pages, `baseUrl`は`app.config.ts`の`experiments.baseUrl`）：
`master` の `daily-app/` に `webexport` を入れて push（`+not-found.html`→`404.html`もコピー）。
→ `https://<owner>.github.io/<repo>/daily-app/` で実機前に確認。
- フォント等の`assets/node_modules`は`-f`で**強制add**（.gitignore対策）。

---

## 5. リリース（要点。詳細は `RELEASE-RUNBOOK.md`）

1. アカウント：Apple Developer($99/年) / Google Play($25) / Expo / RevenueCat。
2. `eas login` → `eas init`。
3. 課金：ストア＋RevenueCatに**消費型**商品を `COIN_PACKS` のidで作成、`current` Offering、RC鍵をEAS env。
4. `eas build --platform ios|android --profile production`（証明書/keystoreはEAS管理＝Mac不要）。
5. `eas submit` ＋ ストア掲載（`store/` の文面、プライバシーURL、スクショ）。
6. 以降の修正は **`eas update`（OTA・審査不要）**。ネイティブ変更時のみ再ビルド。

---

## 6. ストア提出チェック（落ちないために）

- [ ] プライバシーポリシーを**URLで公開**（連絡先メール記入）
- [ ] 広告/トラッキングSDKなし → データ安全性「収集しない」
- [ ] 機密（APIキー等）はsecure-store
- [ ] 課金は消費型id一致＋有料App契約（iOS）／先にAABアップロード（Android）
- [ ] Error Boundaryあり、初回起動でクラッシュしない
- [ ] version は `1.0.0`、Bundle ID/パッケージが本番値
- [ ] スクショ（＋AndroidはFeature graphic）

---

## 7. 新しいアプリを量産する手順（テンプレ流用）

1. `mobile/` を新リポジトリへコピー（このフォルダ全体が型）。
2. **アプリ固有値を置換**：
   - `app.config.ts`：`name` / `slug` / `scheme` / `ios.bundleIdentifier` / `android.package` / `experiments.baseUrl`
   - `eas.json`：`submit.production` の Apple/Google 値
   - アイコン：`scripts/gen-icons.mjs` の図柄と配色 → `node scripts/gen-icons.mjs`
   - 配色/ブランド：`lib/theme.ts`
   - `store/` の掲載文・プライバシー（連絡先・URL）
3. **要らない機能を削る／必要な機能を選ぶ**（下記「機能スイッチ」）。
4. **データモデルを定義**：`lib/types.ts` にレコード、`lib/data.ts` に `Collection` を追加。
5. 画面を `app/` に追加（`components/ui.tsx` の部品で組む）。
6. `npm run typecheck` → web export → プレビュー → リリース。

### 機能スイッチ（残す/外すの判断）
| 部品 | 使うアプリ例 | 外し方 |
|---|---|---|
| ゲーミフィケーション(progress/credits) | 継続系・学習系 | 使わないならボタン/呼び出しを消す |
| IAPコイン | AI課金/有料機能 | `app.config`からプラグイン外す＋coins画面非表示 |
| AI(BYO-Key) | 生成系 | `ai.ts`未使用でOK（鍵未設定でモック） |
| 通知 | 習慣化 | `notifications`呼び出しを消す |
| 音声/語学データ | 学習系 | 該当`lib`/`assets`/画面を削除 |

---

## 8. Claude Code（web）での進め方

1. 新リポジトリにこの `mobile/`（playbook含む）を入れる。
2. セッションで「**PLAYBOOK.md に沿って、◯◯なアプリを作って**」と指示。
3. Claudeは §7 の流れで scaffold → 機能 → typecheck → web export → プレビュー → 提出準備まで実行。
4. リリースのアカウント/管理画面作業（§5）は人間が実施。Claudeは `eas.json` 埋めや手順伴走。

> 守るルール：①Expo v56ドキュメントを見る ②`npm run typecheck`を必ず通す
> ③機密はsecure-store ④広告/トラッキングは入れない ⑤コミットは小さく、プレビューを更新。
