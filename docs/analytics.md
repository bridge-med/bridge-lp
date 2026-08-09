# 訪問者計測の有効化手順

> 状態: **未計測**(2026-07-15時点)。
> 端末内の利用ログ(`bridge-usage`)は稼働済みだが、訪問者数はまだ測っていない。
> cockpit(運営の台帳)にも「未計測」と明示している。この文書は、気が向いた日に
> 5分で計測を立ち上げるための手順である(憲法第15条「測ってから語る」への道)。

## いま入っている仕組み

- `shared/bridge.js` — 端末内利用ログ(localStorage、外部送信なし)と、訪問者計測フック `ANALYTICS_ENDPOINT`(既定は空文字=無効)
- `shared/usage.js` — bridge.jsを読まないプロダクトページ用の利用ログ単機能版

## 手順A(推奨・約2分): GoatCounter

無料・クッキーなし・個人情報を集めない計測サービス。プライバシーポリシーの改定が
ほぼ不要で、BRIDGEの性格に合う。

ローダーは実装済み(2026-08-09)。残る作業はサイトコードを入れるだけ。

1. https://www.goatcounter.com/ でアカウントを作る(サイトコードは例: `bridge-med`)
2. 次の2箇所の `GOATCOUNTER_CODE = ''` に同じサイトコードを入れる
   - `shared/bridge.js` の「訪問者計測(未計測)」ブロック
   - `shared/usage.js` の末尾ブロック(bridge.jsを読まないプロダクトページ用)
3. 同じコミットで `legal/privacy.html` に下の一文を追記する(第32条)
4. コミットして出荷し、翌日 GoatCounter のダッシュボードに数字が出ていることを確かめる

privacy追記文(用意済み・「アクセス解析」の節として追加):

> 訪問者数の把握のため、アクセス解析サービス GoatCounter を利用しています。
> Cookieを使わず、個人を特定する情報は収集されません。

補足:
- cockpitはnoindexだが計測には載る。運営者の自分のアクセスは GoatCounter の設定で除外できる

## 手順B: 自前エンドポイント

`shared/bridge.js` の `ANALYTICS_ENDPOINT` にURLを入れると、ページ表示ごとに
`navigator.sendBeacon` で次のJSONがPOSTされる。

```json
{ "p": "/bridge-lp/products/index.html", "r": "https://参照元" }
```

受け口(Cloudflare Workers等)は自作が必要。手順Aより重いので、独自の集計要件が
出てきたときの選択肢として残す。

## タイミングの注意

独自ドメイン移行(憲法・未決事項#5)の**前**に有効化すると、移行前後の比較データが取れる。
移行後に入れると基準値を失う。
