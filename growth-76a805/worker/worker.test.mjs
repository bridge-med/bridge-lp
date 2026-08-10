/* Growth OS worker — ローカルテスト（Cloudflare環境なしで実行できる）
 * 使い方: node growth-76a805/worker/worker.test.mjs
 * Gemini呼び出しは globalThis.fetch の差し替えでモックする。
 */
import worker from './worker.js';

const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-2.5-flash' };
let failures = 0;

function check(name, cond) {
  if (cond) { console.log('  ok:', name); }
  else { failures++; console.error('  NG:', name); }
}

function req(method, body) {
  return new Request('https://growth-api.example.workers.dev/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function geminiOk(sections) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ sections }) }] } }]
    })
  };
}

const realFetch = globalThis.fetch;

// 1. OPTIONS → 204 + CORS
{
  const res = await worker.fetch(req('OPTIONS'), env);
  check('OPTIONS returns 204', res.status === 204);
  check('CORS origin header present', res.headers.get('Access-Control-Allow-Origin') === '*');
}

// 2. GET → ヘルスチェック
{
  const res = await worker.fetch(req('GET'), env);
  const body = await res.json();
  check('GET health ok', res.status === 200 && body.ok === true && body.service === 'growth-api');
}

// 3. キー未設定 → 500
{
  const res = await worker.fetch(req('POST', { templateId: 'learning', prompt: 'x' }), {});
  check('missing key returns 500', res.status === 500);
}

// 4. 不正JSON → 400
{
  const bad = new Request('https://x/', { method: 'POST', body: '{oops' });
  const res = await worker.fetch(bad, env);
  check('invalid json returns 400', res.status === 400);
}

// 5. 未知テンプレート → 400
{
  const res = await worker.fetch(req('POST', { templateId: 'nope', prompt: 'x' }), env);
  check('unknown template returns 400', res.status === 400);
}

// 6. prompt欠落 → 400
{
  const res = await worker.fetch(req('POST', { templateId: 'learning', prompt: '  ' }), env);
  check('missing prompt returns 400', res.status === 400);
}

// 7. 正常系 → sections正規化(空要素の除去・トリム)
{
  globalThis.fetch = async () => geminiOk([
    { h: ' 今日やったこと ', body: ' 記録の整理 ' },
    { h: '', body: '見出しなしは落ちる' },
    { h: '空本文も落ちる', body: '' },
    { h: '1行まとめ', body: '目次から始める' }
  ]);
  const res = await worker.fetch(req('POST', { templateId: 'learning', prompt: '変換して', system: '(無視される)' }), env);
  const body = await res.json();
  globalThis.fetch = realFetch;
  check('happy path returns 200', res.status === 200);
  check('sections normalized to 2', Array.isArray(body.sections) && body.sections.length === 2);
  check('section text trimmed', body.sections[0].h === '今日やったこと' && body.sections[0].body === '記録の整理');
}

// 8. Gemini異常応答 → 502(アプリ側フォールバックの合図)
{
  globalThis.fetch = async () => ({ ok: false, text: async () => 'boom' });
  const res = await worker.fetch(req('POST', { templateId: 'tasks', prompt: '分解して' }), env);
  globalThis.fetch = realFetch;
  check('provider error returns 502', res.status === 502);
}

// 9. sections空 → 502
{
  globalThis.fetch = async () => geminiOk([]);
  const res = await worker.fetch(req('POST', { templateId: 'tasks', prompt: '分解して' }), env);
  globalThis.fetch = realFetch;
  check('empty sections returns 502', res.status === 502);
}

console.log(failures === 0 ? '\nall tests passed' : '\n' + failures + ' test(s) failed');
process.exit(failures === 0 ? 0 : 1);
