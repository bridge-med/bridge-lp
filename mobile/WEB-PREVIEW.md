# WEB PREVIEW 手順書 — GitHubに上げてWebで見れるようにする

Expoアプリは実機ビルド前に **Web版を書き出して GitHub Pages で公開**できる。
URLを共有すれば、誰でもブラウザで触れる（＝実機ビルド/審査の前に確認・共有できる）。

> これは**プレビュー**。通知・課金(IAP)・音声(TTS)など一部ネイティブ機能はWebでは
> 動かない（自動で無効化）。本番の挙動は実機ビルドで確認すること。

---

## 方式A：GitHub Actionsで自動公開（量産はこれ・推奨）

push するだけで最新Webが自動で出る。手作業ゼロ。

1. **ワークフローを設置**
   `mobile/.github-templates/deploy-web.yml` を、リポジトリ**ルート**の
   `.github/workflows/deploy-web.yml` にコピー。
   - アプリが `mobile/` 配下なら既定のまま。リポジトリ直下なら `env.WORKDIR: "."` に変更。

2. **baseUrl を合わせる**（`app.config.ts`）
   ```ts
   experiments: { baseUrl: '/<repo>' }   // 例: リポジトリ名が myapp なら '/myapp'
   ```
   - `<owner>.github.io` という名前のリポジトリだけは `baseUrl: ''`。

3. **Pagesを有効化**：リポジトリ Settings → Pages → **Source = "GitHub Actions"**。

4. **push**（`mobile/**` を変更）→ Actions が走り、数分で公開。
   URLは Actions の実行サマリ（"github-pages" environment）に出る：
   `https://<owner>.github.io/<repo>/`

> CIが毎回クリーンにビルドして成果物を直接アップするので、**フォント等の.gitignore問題は起きない**
> （手動方式の「force-add」不要）。

---

## 方式B：手動で1回だけ出す

CIを使わず、ローカルから出して push する場合。

```bash
cd mobile
npx expo export --platform web --output-dir dist
cp dist/+not-found.html dist/404.html        # ルーティング用フォールバック
```
- 公開方法はどちらか：
  - **`/docs` 公開**：`dist` の中身を `docs/` に置き、Settings → Pages → Source = "Deploy from a branch" → `main /docs`。
  - **`gh-pages` ブランチ**：`dist` を `gh-pages` ブランチの中身として push し、Pages のソースをそのブランチに。
- `app.config.ts` の `baseUrl` は方式Aと同じ規則（`/<repo>`）。
- 注意：`assets/node_modules/...`（同梱フォント）が `.gitignore` 対象なので、手動コミット時は
  `git add -f dist` で強制追加すること。

---

## つまずきやすい点

| 症状 | 原因 / 対処 |
|---|---|
| 画面が真っ白・JS/CSSが404 | `baseUrl` がリポジトリ名と不一致。`/<repo>` に。 |
| リロードで404 | `404.html`（＝`+not-found.html`のコピー）が無い。 |
| アイコンが豆腐(□) | フォント未取り込み。方式A（CIビルド）なら自動解決。手動は `-f`。 |
| 古い画面が出る | ブラウザのハード更新（Cmd/Ctrl+Shift+R）。 |
| 通知/課金/音声が動かない | 仕様。Webプレビュー非対応。実機で確認。 |

---

## このリポジトリ（bridge-worklog）の現状

- 既存の公開先：`https://bridge-med.github.io/bridge-lp/daily-app/`
  （`master` の `daily-app/` に手動デプロイ。`baseUrl='/bridge-lp/daily-app'`）
- 新規アプリでは上の**方式A**を使うのがおすすめ（自動・つまずき少）。
