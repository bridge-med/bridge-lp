// ================================================================
// 写しの撮影 — 映像に使う実画面を、実物のページから撮る(加工しない)
// usage: node film/passage/capture.mjs [--only compass-q,tanaoroshi] [--date 2026-09-27]
//   → film/passage/plates/<id>-<theme>.webp(可逆)と plates.json(出典・撮影日・状態)
// 規則: 第22条の写しの但し書き(加工しない・色を枠の外へ持ち出さない)。ia.md §11(撮影日を残す)
//   - 1440×900 を 2 倍の密度で撮る(2880×1800)。切り抜き・色補正・書き換えをしない
//   - 保存データなしの新しい状態で撮る(個人の名前・メールが写らないように)
//   - 外部のデモ(bridge-med.github.io)とフォントは curl で取って返す(Chromium に TLS の例外を与えない)
// 依存: playwright(chromium)・ffmpeg(環境変数 FFMPEG か PATH。libwebp が要る)
// ================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUTDIR = path.join(HERE, 'plates');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n == null || n.startsWith('--')) argv[a.slice(2)] = true; else { argv[a.slice(2)] = n; i++; } } }
const ONLY = argv.only ? String(argv.only).split(',') : null;
const DATE = argv.date || new Date().toISOString().slice(0, 10);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const CACHE = path.join(os.tmpdir(), 'bridge-film-netcache');
mkdirSync(CACHE, { recursive: true }); mkdirSync(OUTDIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- 静的サーバー(ディレクトリは index.html を返す) ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary' };
const server = createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { if (statSync(p).isDirectory()) p = path.join(p, 'index.html'); } catch {}
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---- 外部の GET は curl で取って返す(フォント・公開デモ) ---- */
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
function curlGet(url) {
  const f = path.join(CACHE, createHash('sha1').update(url).digest('hex'));
  if (!existsSync(f)) {
    const hdr = execFileSync('curl', ['-sS', '-L', '-A', UA, '-D', '-', '-o', f, url], { maxBuffer: 1 << 26 }).toString();
    const ct = (hdr.match(/content-type:\s*([^\r\n]+)/ig) || []).pop()?.split(/:\s*/)[1] || 'application/octet-stream';
    writeFileSync(f + '.type', ct);
  }
  return { body: readFileSync(f), type: readFileSync(f + '.type', 'utf8') };
}
const ALLOW = /fonts\.(googleapis|gstatic)\.com|bridge-med\.github\.io|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function context(theme, dpr = 2) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await c.addInitScript(t => { try { localStorage.clear(); localStorage.setItem('bridge-theme', t); } catch (e) {} }, theme);
  await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, async route => {
    const u = route.request().url();
    if (ALLOW.test(u) && route.request().method() === 'GET') {
      try { const r = curlGet(u); return route.fulfill({ status: 200, body: r.body, headers: { 'content-type': r.type, 'access-control-allow-origin': '*' } }); }
      catch (e) { return route.abort(); }
    }
    return route.abort();   // 計測・解析などは読まない
  });
  return c;
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('on', 'in', 'is-in', 'visible')));
  await sleep(1200);
}

/* ---- Compass: 問いを進めて、目当ての問いの画面を「まだ何も選んでいない」状態で止める(選ぶのは見る人) ---- */
async function compassToQuestion(page, needle) {
  await page.waitForSelector('#cpStart:not([disabled])');
  await page.click('#cpStart');
  for (let guard = 0; guard < 30; guard++) {
    await sleep(500);
    const cur = await page.evaluate(() => {
      const s = [...document.querySelectorAll('.cp-screen')].filter(e => !e.hidden && e.isConnected).pop();
      return s ? { text: s.textContent.replace(/\u200b/g, ''), opts: s.querySelectorAll('.cp-opt').length } : null;   // BudouX のゼロ幅スペースを外して照合
    });
    if (!cur) continue;
    if (cur.text.includes(needle)) { await page.mouse.move(2, 890); await sleep(600); return; }   // ポインタを外して、ホバーの見た目を残さない
    const opts = await page.$$('.cp-screen:last-of-type .cp-opt');
    if (opts.length) await opts[0].click();
  }
  throw new Error('compass: 目当ての問いに届かない: ' + needle);
}

/* ---- 掲示じたく: 臨時休診を選び、製品の入力例(placeholder の「例: 」の後ろ)で埋めて、できあがりの A4 を出す ---- */
async function keijiPoster(page) {
  await page.click('.type-card');                                   // 先頭 = 臨時休診
  await page.waitForSelector('#form-fields input, #form-fields select');
  await page.evaluate(date => {
    for (const el of document.querySelectorAll('#form-fields [data-key]')) {
      if (el.type === 'date') { if (el.dataset.key === 'date') el.value = date; }
      else if (el.tagName === 'INPUT' && !el.value) { const ph = el.getAttribute('placeholder') || ''; if (/^例[:：]/.test(ph)) el.value = ph.replace(/^例[:：]\s*/, ''); }
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, POSTER_DATE);
  await page.click('#form-el [type=submit]');
  await page.waitForSelector('#poster');
  await sleep(500);
  await page.evaluate(() => { const p = document.querySelector('.poster-box'); p.scrollIntoView({ block: 'start' }); window.scrollBy(0, -300); });   // 下端の差出(架空の施設名)の行が枠の外に出る位置
}
const POSTER_DATE = '2026-10-16';   // 掲示の日付(未来の平日。撮影日によらず同じ画になるよう固定)

const PLATES = [
  { id: 'compass-q', name: 'BRIDGE Compass', url: '/compass/', themes: ['dark', 'light'], state: '2問目「周りから一番頼られるのは?」をまだ選んでいない状態(職種と1問目は先頭の選択肢)', prep: page => compassToQuestion(page, '周りから一番頼られるのは') },
  { id: 'tanaoroshi', name: '経験の棚卸し', url: '/tanaoroshi/', themes: ['light'], state: '最初の画面・保存データなし' },
  { id: 'keiji', name: '掲示じたく', url: '/keiji/', themes: ['light'], state: 'できあがりの A4(臨時休診。入力は製品の入力例と固定の日付。差出の行は枠の外)', prep: keijiPoster },
  { id: 'consult-sim', name: 'ConsultSim', url: 'https://bridge-med.github.io/consult-simulator/', themes: ['light'], state: '公開デモの最初の画面(ダークなし)' },
];

const manifestPath = path.join(OUTDIR, 'plates.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { note: '写しの台帳。すべて実物のページから撮り、加工していない(capture.mjs)。撮り直したら日付が変わる', plates: [] };
const tmp = path.join(os.tmpdir(), 'bridge-film-capture'); mkdirSync(tmp, { recursive: true });

for (const P of PLATES) {
  if (ONLY && !ONLY.includes(P.id)) continue;
  for (const theme of P.themes) {
    const c = await context(theme, P.dpr || 2);
    const page = await c.newPage();
    page.setDefaultTimeout(60000);
    const url = P.url.startsWith('http') ? P.url : BASE + P.url;
    await page.goto(url, { waitUntil: 'networkidle' });
    await settle(page);
    if (P.prep) await P.prep(page);
    await sleep(600);
    const png = path.join(tmp, `${P.id}-${theme}.png`);
    await page.screenshot({ path: png });
    const file = `${P.id}-${theme}.webp`;
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', path.join(OUTDIR, file)]);   // 可逆(画素を変えない)
    rmSync(png);
    manifest.plates = manifest.plates.filter(x => x.file !== file);
    manifest.plates.push({ file, id: P.id, name: P.name, theme, source: P.url, state: P.state, viewport: `1440x900@${P.dpr || 2}x`, captured: DATE });
    console.log('plate', file);
    await c.close();
  }
}
manifest.plates.sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
await browser.close(); server.close();
