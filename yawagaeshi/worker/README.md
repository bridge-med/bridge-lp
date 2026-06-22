# やわ返 — 自前API（Cloudflare Worker / Gemini 連携）

APIキーをフロントに置かないための「自前API」です。スマホアプリ（GitHub Pages）からのリクエストを受け、**サーバー側で Gemini を呼びます**。

```
スマホアプリ（GitHub Pages） → この Worker → Gemini API
```

## 前提

- Cloudflare アカウント（無料枠で十分）
- Google AI Studio の Gemini API キー（https://aistudio.google.com/apikey）
- `wrangler`（Cloudflare CLI）

```bash
npm install -g wrangler
wrangler login
```

## デプロイ手順

```bash
cd yawagaeshi/worker

# 1) Gemini API キーを Secret として登録（コードやリポジトリには残りません）
wrangler secret put GEMINI_API_KEY
#   → プロンプトにキーを貼り付け

# 2) デプロイ
wrangler deploy
#   → https://yawagaeshi-api.<あなたのサブドメイン>.workers.dev が表示される
```

動作確認（GET でヘルスチェック）:

```bash
curl https://yawagaeshi-api.<sub>.workers.dev/
# → {"ok":true,"service":"yawagaeshi-api","provider":"gemini"}
```

生成テスト（POST）:

```bash
curl -X POST https://yawagaeshi-api.<sub>.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"request":{"userIntent":"明日午前なら対応できると伝えたい","relationship":"取引先","channel":"メール","tones":["やわらかく","丁寧に"],"length":"普通"}}'
```

## アプリ側で連携を有効にする

デプロイで得た URL をアプリに教えます。どちらかでOK：

**A. コードに設定（恒久・全ユーザー）** — `yawagaeshi/app/replyService.js`

```js
var REPLY_PROVIDER = 'remote';
var REPLY_ENDPOINT = 'https://yawagaeshi-api.<sub>.workers.dev';
```

変更を `master` にマージすると GitHub Pages に反映されます。

**B. 端末だけで切り替え（試用・コード変更なし）** — ブラウザの DevTools コンソールで：

```js
localStorage['yawagaeshi:endpoint'] = 'https://yawagaeshi-api.<sub>.workers.dev';
localStorage['yawagaeshi:provider'] = 'remote';
```

> どちらの場合も、**通信失敗・キー未設定・障害時は自動でモック生成にフォールバック**します（アプリは止まりません）。

## モデルの変更

`wrangler.toml` の `GEMINI_MODEL` を変更します。

- `gemini-2.5-flash`（既定）— 速くて安く、品質も十分
- `gemini-2.5-flash-lite` — さらに安い・速い
- `gemini-2.5-pro` — 高品質（やや高価）

## 仕組み（worker.js）

- `POST` で `{ request: ReplyRequest }` を受け取る
- サーバー側の `SYSTEM_PROMPT` ＋入力から Gemini 用プロンプトを構築
- Gemini の **structured output**（`responseSchema`）で
  `{ suggestions:[{label,text,note}×3], riskCheck:{coldness,pressure,length,comment} }` を取得
- ラベルを「やわらかめ/ちょうどいい/短め」に正規化、risk を 1〜3 にクランプして返す
- CORS 許可（GitHub Pages から別オリジンで叩けるように）

## 注意

- **APIキーは Secret にのみ保存**してください。`wrangler.toml` やコードに直書きしない。
- 公開エンドポイントになるため、本番運用ではレート制限（Cloudflare の設定や Worker 内カウンタ）を検討してください。`replyService.js` の `DAILY_LIMIT` は将来の利用回数制限の土台です。
