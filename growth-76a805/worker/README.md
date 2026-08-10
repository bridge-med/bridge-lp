# Growth OS — 自前API（Cloudflare Worker / Gemini 連携）

APIキーをフロントに置かないための「自前API」です。Growth OS（GitHub Pages）のAI変換
リクエストを受け、**サーバー側で Gemini を呼びます**。やわ返（yawagaeshi/worker）と同じ構成で、
同じ Gemini API キーを使い回せます。

```
Growth OS（GitHub Pages） → この Worker → Gemini API
```

デプロイしなくても Growth OS は動きます（既定はテンプレート生成）。
デプロイすると、同じ画面のままAI生成に切り替わります。

## 前提

- Cloudflare アカウント（無料枠で十分）
- Google AI Studio の Gemini API キー（https://aistudio.google.com/apikey ）
- `wrangler`（Cloudflare CLI）

```bash
npm install -g wrangler
wrangler login
```

## デプロイ手順

```bash
cd growth-76a805/worker

# 1) Gemini API キーを Secret として登録（コードやリポジトリには残りません）
wrangler secret put GEMINI_API_KEY
#   → プロンプトにキーを貼り付け（やわ返と同じキーで可）

# 2) デプロイ
wrangler deploy
#   → https://growth-api.<あなたのサブドメイン>.workers.dev が表示される
```

動作確認（GET でヘルスチェック）:

```bash
curl https://growth-api.<sub>.workers.dev/
# → {"ok":true,"service":"growth-api","provider":"gemini"}
```

## アプリ側の切り替え

Growth OS の「設定 → AI接続」で、生成方式を「自前API」にして
Worker の URL を貼り、保存するだけです（コード変更・再デプロイ不要）。

localStorage で直接切り替える場合:

```
localStorage['growth:provider'] = 'remote'
localStorage['growth:endpoint'] = 'https://growth-api.<sub>.workers.dev'
```

Worker が落ちていても、アプリは自動でテンプレート生成にフォールバックします。

## 契約（app/aiService.js と対）

```
POST { templateId, system, prompt, source }
→ 200 { sections: [{ h: "見出し", body: "本文" }, ...] }
```

- `templateId` は既知の11種のみ受け付ける（それ以外は 400）
- クライアントから届く `system` は使わない。この Worker が持つ SYSTEM_PROMPT を常に使う
  （公開エンドポイントを任意プロンプトの代理実行口にしないため）
- 失敗時は 4xx/5xx を返し、アプリ側がテンプレート生成へフォールバックする

## テスト

Cloudflare 環境なしで、Worker のハンドラをそのまま検証できます:

```bash
node growth-76a805/worker/worker.test.mjs
```

Gemini はモックし、CORS・ヘルスチェック・バリデーション・正規化・エラー時の
フォールバック応答を確認します。
