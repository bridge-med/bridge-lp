# 独自ドメイン移行手順(憲法・未決事項#5)

**状態: ドメイン取得待ち(運営者アクション)**

## 1. ドメイン名の決定(運営者)

| 候補 | 一貫性 | 懸念 |
|---|---|---|
| `bridge-med.jp` | GitHub組織名(bridge-med)と一致 | 「med」が医療感を強める(憲法第21条と軽い緊張) |
| `bridgemed.jp` | 同上・ハイフンなし | 同上 |
| `bridge-project.jp` | 思想(プロジェクト)と一致 | やや一般的 |
| `expand-choices.jp` | タグラインと一致 | BRIDGEという名と離れる |

推奨は `bridge-med.jp`(組織名一致・移行が最も自然)。「med」の医療感は、ブランドは名より中身で語れているため許容範囲と判断。

## 2. 取得(運営者・約15分・年額 約1,500〜2,000円)

- お名前.com / ムームードメイン / Xserverドメイン のいずれかで取得
- **Whois情報公開代行を必ず有効に**(個人住所が公開されないように)

## 3. DNS設定(運営者・レジストラの管理画面で)

Apexドメイン(例: bridge-med.jp)にAレコード4本:

```
A  @  185.199.108.153
A  @  185.199.109.153
A  @  185.199.110.153
A  @  185.199.111.153
CNAME  www  bridge-med.github.io.
```

## 4. リポジトリ側(Claude が実施)

1. リポジトリ直下に `CNAME` ファイル(中身はドメイン名1行)を追加
2. GitHub Pages 設定で custom domain を確認+「Enforce HTTPS」を有効化(証明書発行に最大24時間)
3. 全ページの canonical / OGP / JSON-LD / sitemap.xml / robots.txt のURLを新ドメインへ一括置換
4. `404.html` と `bridge.js` の絶対パス(`/bridge-lp/`)を `/` へ変更
   ※ custom domain ではサイトがルート直下で配信されるため
5. Search Console に新ドメインのプロパティを追加(所有権確認タグは既存を流用可)+サイトマップ再送信
6. 旧URL(bridge-med.github.io/bridge-lp/…)はGitHub Pagesが自動で新ドメインへリダイレクトするため、既存リンク・ブックマークは壊れない

## 5. 独自ドメインメール(運営者+Claude)

コストゼロ案(推奨): **Cloudflare Email Routing**
1. CloudflareにドメインのDNS管理を移す(ネームサーバー変更)
2. Email Routing で `contact@bridge-med.jp` → Gmail へ転送(無料)
3. Gmail の「他のアドレスからメールを送信」で送信も独自ドメイン名義に
4. サイト内の連絡先(community/about/footer)を新アドレスへ差し替え(Claude)

有料案: Google Workspace(月800円〜)— 将来チーム化するならこちら。

## 6. 移行後チェックリスト

- [ ] https://ドメイン/ でトップが表示される(HTTPS有効)
- [ ] 旧 github.io URLからリダイレクトされる
- [ ] 404ページが正しく表示される(絶対パス確認)
- [ ] OGP画像がSNSシェアで出る
- [ ] Search Console 新プロパティでサイトマップ「成功」
- [ ] contact@ でメール送受信できる
- [ ] 憲法・未決事項#5を解決済みに更新
