# Growth OS — 仕事の記録を、次の仕事に

日々の仕事の記録(Worklog)を、プロジェクト・収益化アイデア・コンテンツ・売上の管理まで
1つの流れでつなぐ台帳。運営者用の内部ツールとして出荷し、2026-08-09の社長決裁で
プロダクトカタログ(products)に掲載した。

- URL: `growth-76a805/index.html`(noindex。Productsカタログから開く)
- データはすべて端末の localStorage(`bridge-growth-v1`)にのみ保存。外部送信はしない
- デモデータはすべて架空の汎用サンプル(実在の業務・人物・数字は含めない)
- ビルドなし。`index.html` + `app/` の4ファイルで完結

## 構成(責務分離。やわ返 yawagaeshi と同じ設計)

| ファイル | 責務 |
|---|---|
| `index.html` | 画面シェル(左ナビ+中央8ビュー+右サイドパネル)。フォームは静的HTML |
| `app/styles.css` | 見た目。トークンは shared/bridge.css v3.0 から転記(共通シェルは読まない) |
| `app/store.js` | `window.GrowthStore` — データモデル・localStorage永続化・集計・pub/sub |
| `app/aiService.js` | `window.GrowthAI` — AI変換のサービス層。UIはこの層だけを呼ぶ |
| `app/app.js` | 画面描画とフォームの接続。store/aiService以外に依存しない |

## AI変換の設計

`aiService.js` はプロバイダ切り替え式(replyService.js と同じ):

- 既定は `mock` — 変換テンプレート(11種)ごとの生成ロジックで、外部APIなしで一連の体験が動く
- `remote` — 自前API(Cloudflare Worker等)のURLを設定すると、同じUIのままLLM生成に切り替わる。
  APIキーはフロントに置かない。失敗時は必ずmockにフォールバックし、体験を止めない

切り替え(設定画面、または localStorage):

```
localStorage['growth:provider'] = 'remote'
localStorage['growth:endpoint'] = 'https://....workers.dev'
```

Workerへのリクエスト/レスポンス契約:

```
POST { templateId, system, prompt, source }
→ 200 { sections: [{ h: "見出し", body: "本文" }, ...] }
```

`system` にはGrowth OSの回答方針(次の1アクションまで落とす、売れる可能性と作りやすさを分けて考える等)、
`prompt` にはテンプレートの出力見出しと素材のJSONが入っている。

**Worker本体は `worker/` に用意済み**(yawagaeshi/workerと同型・Gemini連携・テスト付き)。
デプロイ手順は `worker/README.md`。デプロイまでは既定のテンプレート生成で動く。

将来RAGや履歴文脈を足す場合も、注入点は `aiService.js` の `buildPrompt()` 1か所。
UIとstoreには手を入れずに済む。

## データモデル

`store.js` 冒頭のJSDocが唯一の定義。WorklogEntry / Project / Task / Idea /
ContentItem / RevenueRecord / AiLog / Settings。語彙(カテゴリ・ステータス・チャネル等)は
`store.js` の定数配列が唯一の情報源で、増やすときはそこに足す。

## 動作確認

ローカルでそのまま `index.html` を開くだけ。初回はデモデータが入る。
設定 → 「デモデータに戻す」でいつでも初期状態に戻せる。
