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

**2026-08-09に有効化済み。** サイトコード `wataru`(社長開設)。`shared/bridge.js` と
`shared/usage.js` の `GOATCOUNTER_CODE` に設定済みで、`legal/privacy.html` には
「本サイト(BRIDGE)のアクセス解析」の節(日英)を追記済み(第32条)。
ダッシュボード: https://wataru.goatcounter.com/

サイトコードを変える日が来たら、上記2ファイルの `GOATCOUNTER_CODE` を同じ値で書き換える。
空文字に戻せば計測は止まる(何も読み込まれない)。

補足:
- cockpitはnoindexだが計測には載る。運営者の自分のアクセスは GoatCounter の設定で除外できる

## 手順B: 自前エンドポイント

`shared/bridge.js` の `ANALYTICS_ENDPOINT` にURLを入れると、ページ表示ごとに
`navigator.sendBeacon` で次のJSONがPOSTされる。

```json
{ "p": "/products/index.html", "r": "https://参照元" }
```

受け口(Cloudflare Workers等)は自作が必要。手順Aより重いので、独自の集計要件が
出てきたときの選択肢として残す。

## タイミングの注意

独自ドメイン移行(憲法・未決事項#5)の**前**に有効化すると、移行前後の比較データが取れる。
移行後に入れると基準値を失う。
