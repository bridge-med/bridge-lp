# bridge-med.jp への切り替え

2026-09-13: 運営者から取得済み・切り替え作業の依頼あり。公開設定とDNSの変更は未実施です。

## GitHub側の準備

`.github/workflows/deploy.yml` は GitHub Pages の `base_url` を取得し、`scripts/prepare-pages.mjs` で公開用コピーを作ります。

- 現行URLではファイルの内容を変更しません。
- `https://bridge-med.jp`（またはwww付き）に設定した後は、公開用コピーだけで旧サイトURLと `/bridge-lp/` 始まりのパスを置換します。
- canonical、OGP、JSON-LD、サイトマップ、robots.txt、404ページ、Expo版キャリアログのパスを対象に含みます。
- 別リポジトリの `consult-simulator` などのURLは変更しません。
- Claude Codeが編集する各プロダクトのソースは維持します。生成し直したページも次回公開時に変換されます。
- docs、原典アーカイブ、モバイル開発元、workerは置換対象外です。ゲームのセーブ内容は変更しません。

現在は GitHub Actions で公開しているため、CNAMEファイルを置くだけではドメイン設定になりません。Settings → Pages の変更が必要です。この接続ではコードの書き込みとPR操作が可能ですが、Pages管理設定の変更用ツールはありません。

## 切り替え前にセーブを保全

クリニックタウンはブラウザのlocalStorageを使用しています。ドメイン間では共有されず、旧URLのリダイレクトだけでは移行できません。

対象キーは `clinicTown_v3`、`clinicTown_prestige`、`clinicTown_v3_dec` + 数字、`clinicTown_v3_keep`、`ct3d_rotateHint` です。継続したい端末・ブラウザごとに、旧URLでゲームを閉じて保存が完了した後、開発者ツールのストレージからこれらの値をローカルに退避してください。切り替え後は新ドメインでゲームを閉じた状態で同じキー・値を復元します。新ドメインで既に遊んだデータがあれば、先にそちらも退避してください。

他プロダクトの端末内データも自動移行しません。保存済みデータを使っている場合はそのプロダクトの書き出し機能・保存方式を先に確認します。バックアップの中身を公開リポジトリに保存しないでください。

## 管理画面での設定順

1. GitHubアカウントの Settings → Pages から `bridge-med.jp` の所有権確認用TXTレコードを取得し、DNSに追加して確認します。コード変更のPRをマージし、現行URLのDeploy成功を確認します。
2. セーブの退避完了後、[リポジトリのPages設定](https://github.com/bridge-med/bridge-lp/settings/pages)で Custom domain に `bridge-med.jp` を入力して保存します。
3. お名前.comのDNS管理画面で、下表を設定します。既存のメール用MX/TXTレコードは保持します。別サービスのネームサーバーを使っている場合は、そのDNS管理先で設定してください。
4. GitHub Actionsの「Deploy to GitHub Pages」を実行します。ドメイン設定だけではソースへのpushが発生しないため、手動実行で公開URLを合わせます。
5. DNSと証明書の準備後、Pages設定の Enforce HTTPS を有効にし、下の確認を行います。DNS反映・証明書発行は即時とは限りません。

| 名前 | TYPE | VALUE |
|---|---|---|
| ルート（bridge-med.jp） | A | 185.199.108.153 |
| ルート（bridge-med.jp） | A | 185.199.109.153 |
| ルート（bridge-med.jp） | A | 185.199.110.153 |
| ルート（bridge-med.jp） | A | 185.199.111.153 |
| www | CNAME | bridge-med.github.io |

`www` の接続先に `/bridge-lp/` は付けません。所有権確認用TXTの値はGitHub画面で発行されたものを使います。

## 公開確認と戻し方

- 新ドメインのトップ、products、clinic-flow-3d、daily-appを開き、画像・リンク・起動を確認します。
- 存在しない深いパスでも404ページのスタイルとホームへのリンクを確認します。
- sitemap.xml、robots.txt、canonical、OGPが新ドメインを指すことを確認します。
- 旧URLからの遷移と、必要なセーブの復元を確認します。
- Search Consoleに新ドメインを登録し、所有権をそのプロパティで確認してサイトマップを送信します。

不具合時はPagesのCustom domainを削除し、Deployを手動実行すると旧URL向けの内容に戻ります。新ドメインで増えたセーブは旧ドメインへ自動では戻りません。

独自ドメインメールの契約・設定は今回の対象外です。憲法の未決事項#5（連絡先）は未解決のままです。

## 参照

- [GitHub Pagesのドメイン設定](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [ドメインの所有権確認](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)
- [configure-pagesの出力](https://github.com/actions/configure-pages/blob/v4/action.yml)
