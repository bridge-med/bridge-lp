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
「本サイト(BRIDGE)のアクセス解析」の節(日英)を追記済み(第32条)。2026-10-30 から、公式サイトのポリシー
`legal/site-privacy.html`(フッターの Privacy)にも計測の説明がある。計測を変えるときは両方を直す。
ダッシュボード: https://wataru.goatcounter.com/

サイトコードを変える日が来たら、上記2ファイルの `GOATCOUNTER_CODE` を同じ値で書き換える。
空文字に戻せば計測は止まる(何も読み込まれない)。

補足:
- cockpitはnoindexだが計測には載る。運営者の自分のアクセスは GoatCounter の設定で除外できる

## 操作の計測(イベント。2026-11-03 の計測の便)

ページを読まれた回数だけでは「どこまで体験し、次の行動に進んだか」が分からない。そこで、決まった操作だけを GoatCounter の**イベント**として名前で数える。新しいサービス・DB は増やさない。送るのは名前(path)と題(title)だけで、回答・入力した文章・個人情報・リンク先のアドレスは送らない。

| 名前(path) | 何を数えるか | どこで・どう送るか | 二重送信の防ぎ方 |
|---|---|---|---|
| `compass-start` | Compass で質問を始めた(職種の画面に初めて着いた。導入から押した人も、町のパネルから直接来た人も同じ) | `compass/app/app.js` の `show()` → `BRIDGE.countEvent` | sessionStorage `bridge-compass-ev` に印。戻る・進む・再読み込みでは送らない |
| `compass-result` | Compass の結果に着いた | 同上 | 同上 |
| `starter-purchase` | RehaBoard Starter Kit の「購入を申し込む」を押した | `rehaboard-starter/index.html` の `data-goatcounter-click` 属性(count.js が自動で束ねる) | GoatCounter の既定(同じセッションの同じ操作は1回) |
| `services-consult` | 仕事のご依頼の「相談メールを書く」(上下2か所)を押した | `services/index.html` の `data-goatcounter-click` 属性 | 同上 |

- 仕組み: `shared/bridge.js` の `BRIDGE.countEvent(path, title)`。count.js は非同期に読むので、まだ無いときは 250ms おきに最大 10 秒待ってから送り、読めなければ捨てる。GoatCounter が止まっていても、ボタンや画面の動きは変わらない
- 増やすときの規則: 名前は `道具-操作` の形で、この表と `legal/site-privacy.html`・`legal/privacy.html` の計測の説明を同じコミットで直す(第32条)。数えるのは「次の行動」に当たる操作だけで、画面の中の細かな操作(選択肢を選んだ・テーマを替えた)は数えない
- 管理画面(https://wataru.goatcounter.com/)での見方: ページの一覧に、イベントは `compass-start` のような先頭に `/` の無い名前で並ぶ。期間を選び、`compass` で絞ると開始と結果到達が並ぶ。読み方は4つ
  1. **Compass の到達率** = `compass-result` ÷ `compass-start`。開始が少なければ入口(トップ・町・FOOTER)の問題、到達が少なければ質問の途中で離れている
  2. **Compass の入口の広さ** = `compass-start` ÷ `/compass/` のページビュー。開いただけで始めない人の割合
  3. **Starter Kit の購入意思** = `starter-purchase` ÷ `/rehaboard-starter/` のページビュー。販売記事を公開する前後で比べる(畳むかどうかの判断材料)
  4. **相談の意思** = `services-consult` ÷ `/services/` のページビュー。参照元(note.com)と並べると、発信から相談への線が見える
- 決め方(第15条): 数字は最低 30 日分を溜めてから読む。1件の増減で判断しない。ゼロは「使われていない」の最初の事実として台帳(ledger.json)の note に日付つきで書く

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
