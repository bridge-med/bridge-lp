#!/usr/bin/env node
/* ================================================================
   わたしのAIパートナー — ローカルサーバ
   ブラウザのチャット画面と、ローカルのClaude Code(claude -p)をつなぐ。
   依存パッケージなし。Node.js 18+ と Claude Code(ログイン済み)だけで動く。
   起動:  node server.mjs   →  http://127.0.0.1:8737 が自動で開く
   ================================================================ */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP  = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(APP, '..');                       // my-ai-partner/
const PORT = Number(process.env.AIP_PORT || 8737);
const CLAUDE = process.env.AIP_CLAUDE_BIN || 'claude'; // テスト時に差し替え可
const SESSION_FILE = join(APP, '.session');
const TIMEOUT_MS = 240_000;

/* ---- 画面から読んでよいファイル(これ以外は404) ---- */
const READABLE_PREFIXES = ['profile/', 'ideas/', 'work/'];
function safeRead(name) {
  if (!name || name.includes('..') || !name.endsWith('.md')) return null;
  if (!READABLE_PREFIXES.some(p => name.startsWith(p))) return null;
  const abs = normalize(join(ROOT, name));
  if (!abs.startsWith(ROOT) || !existsSync(abs)) return null;
  return readFile(abs, 'utf8');
}

/* ---- Claude Codeを1往復呼ぶ ---- */
async function askClaude(message) {
  const args = ['-p', '--output-format', 'json',
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read,Write,Edit,Glob,Grep',
    '--max-turns', '25'];
  let sid = null;
  try { sid = (await readFile(SESSION_FILE, 'utf8')).trim() || null; } catch {}
  if (sid) args.push('--resume', sid);
  args.push(message);

  return new Promise(res => {
    const child = spawn(CLAUDE, args, { cwd: ROOT, env: process.env });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => err += d);
    child.on('error', e => { clearTimeout(timer); res({ error: friendly(e.message) }); });
    child.on('close', async code => {
      clearTimeout(timer);
      let data = null;
      try { data = JSON.parse(out); }
      catch { const m = out.match(/\{[\s\S]*\}\s*$/); if (m) { try { data = JSON.parse(m[0]); } catch {} } }
      if (!data) return res({ error: friendly(err || `終了コード ${code}`) });
      if (data.session_id) { try { await writeFile(SESSION_FILE, data.session_id); } catch {} }
      if (data.is_error) return res({ error: friendly(data.result || err) });
      res({ reply: data.result ?? '(応答が空でした。もう一度送ってみてください)' });
    });
  });
}

function friendly(raw) {
  const s = String(raw || '');
  if (/log ?in|auth|credential|API key/i.test(s))
    return 'AIへの接続に失敗しました。このパソコンで一度ターミナルを開き、「claude」と入力してログインを済ませてから、アプリを起動し直してください。';
  if (/ENOENT/.test(s))
    return 'Claude Codeが見つかりません。インストール後にもう一度お試しください(はじめかた.md 参照)。';
  return '少し調子が悪いみたいです。時間をおいてもう一度送ってみてください。' + (s ? `\n(詳細: ${s.slice(0, 200)})` : '');
}

/* ---- HTTP ---- */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const send = (code, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html'))
      return send(200, await readFile(join(APP, 'public', 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/health')
      return send(200, { ok: true, hasSession: existsSync(SESSION_FILE) });
    if (req.method === 'GET' && url.pathname === '/api/view') {
      const p = safeRead(url.searchParams.get('name'));
      if (!p) return send(404, { error: 'not found' });
      return send(200, { content: await p });
    }
    if (req.method === 'POST' && url.pathname === '/api/new') {
      try { await unlink(SESSION_FILE); } catch {}
      return send(200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      let body = '';
      for await (const c of req) { body += c; if (body.length > 200_000) { req.destroy(); return; } }
      const msg = (JSON.parse(body || '{}').message || '').toString().trim();
      if (!msg) return send(400, { error: 'メッセージが空です' });
      return send(200, await askClaude(msg));
    }
    send(404, { error: 'not found' });
  } catch (e) {
    send(500, { error: friendly(e.message) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://127.0.0.1:${PORT}`;
  console.log(`わたしのAIパートナー: ${addr} で待っています(このウィンドウは開いたまま)`);
  const cmd = process.platform === 'darwin' ? ['open', [addr]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', addr]]
    : ['xdg-open', [addr]];
  try {
    const opener = spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true });
    opener.on('error', () => console.log(`ブラウザで ${addr} を開いてください`));
    opener.unref();
  } catch { console.log(`ブラウザで ${addr} を開いてください`); }
});
