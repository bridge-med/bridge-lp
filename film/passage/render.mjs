// ================================================================
// 書き出し — film.html を 1 フレームずつ描いて MP4 にする
// usage:
//   node film/passage/render.mjs                                   (1920×1080・60fps・ライト → film/passage/out/passage-light-16x9.mp4)
//   node film/passage/render.mjs --w 1080 --h 1920                 (縦。カメラの鍵は横用のまま)
//   node film/passage/render.mjs --stills 0.5,2,3 --outdir /tmp/x  (確認用の静止画だけ)
//   オプション: --from 0 --to 15 --fps 60 --samples 16 --crf 16 --out <path> --noaudio
// 依存: playwright(chromium)・ffmpeg(環境変数 FFMPEG か PATH。libx264 が要る)
// 先例: PR131「一本の線」の showreel/render.mjs(bt709 の行列・フォントの curl キャッシュ)を、
//       縦横比・テーマ・WebGL(SwiftShader)に合わせて書き直したもの
// ================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

/* ---- 引数(値のない --noaudio なども受ける) ---- */
const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next == null || next.startsWith('--')) argv[a.slice(2)] = true;
  else { argv[a.slice(2)] = next; i++; }
}
const W = +(argv.w || 1920), H = +(argv.h || 1080);
const FPS = +(argv.fps || 60);
if (argv.theme && argv.theme !== 'light') { console.error('映像はライトの値に固定(STORYBOARD.md §4)。--theme は light だけ'); process.exit(1); }
const THEME = 'light';
const SAMPLES = +(argv.samples || 16);
const CRF = String(argv.crf || 16);
const FONTCACHE = argv.fontcache || path.join(os.tmpdir(), 'bridge-film-fonts');
const aspect = W === H ? '1x1' : W > H ? '16x9' : '9x16';
const OUT = argv.out || path.join(HERE, 'out', `passage-${THEME}-${aspect}.mp4`);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
mkdirSync(FONTCACHE, { recursive: true });

/* ---- 静的サーバー(リポジトリの根を配る。画像を WebGL に載せるため file:// ではなく http) ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.wav': 'audio/wav' };
const server = createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---- フォントの要求は curl のキャッシュから返す(Chromium にプロキシの証明書の例外を与えないため) ---- */
function cached(url) {
  const f = path.join(FONTCACHE, createHash('sha1').update(url).digest('hex'));
  if (!existsSync(f)) execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', '-o', f, url]);
  return readFileSync(f);
}

const launch = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
  const url = route.request().url();
  try {
    const body = cached(url);
    const type = url.includes('googleapis') ? 'text/css' : 'font/woff2';
    await route.fulfill({ status: 200, body, headers: { 'content-type': type, 'access-control-allow-origin': '*' } });
  } catch (e) { console.error('font fetch failed', url); await route.abort(); }
});
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));

const rel = path.relative(ROOT, path.join(HERE, 'film.html')).split(path.sep).join('/');
const extra = argv.query ? '&' + argv.query : '';            // 確認用: --query "top=1" など
await page.goto(`${BASE}/${rel}?render=1&w=${W}&h=${H}${extra}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.FILM || window.FILM_ERROR, null, { timeout: 180000 });
const err = await page.evaluate(() => window.FILM_ERROR);
if (err) { console.error(err); process.exit(1); }
await page.evaluate(() => window.FILM.ready);

/* ---- 色の照合: 場面の TOK が shared/bridge.css(トークンの唯一の情報源)の :root の値と一致するか ---- */
{
  const css = readFileSync(path.join(ROOT, 'shared/bridge.css'), 'utf8');
  const rootBlock = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  const NAME = { bg: '--bg', bg2: '--bg-2', bg3: '--bg-3', card: '--card', ink: '--ink', ink2: '--ink-2', ink3: '--ink-3', navy: '--navy', dawn: '--dawn' };
  const tok = await page.evaluate(() => window.FILM.TOK);
  const bad = Object.entries(NAME).filter(([k, v]) => {
    const m = rootBlock.match(new RegExp(v.replace(/-/g, '\\-') + '\\s*:\\s*(#[0-9A-Fa-f]{6})'));
    return !m || m[1].toUpperCase() !== String(tok[k]).toUpperCase();
  });
  if (bad.length) { console.error('TOK と shared/bridge.css の値が違う:', bad.map(b => b[1]).join(', ')); process.exit(1); }
}
if (argv.metrics) {                                          // 読ませる拍の数値と、同時に見える写しの数を JSON で書く
  const m = await page.evaluate(step => window.FILM.metrics(step), +(argv.step || 1 / 30));
  const vis = [];
  for (let t = 0; t <= 15; t += +(argv.visstep || 0.25)) vis.push({ t: +t.toFixed(3), counts: await page.evaluate(t => window.FILM.visibleCounts(t), t) });
  const info = await page.evaluate(() => ({ cruise: window.FILM.CRUISE, pathLen: window.FILM.PATHLEN, plates: window.FILM.plates.map(p => p.name) }));
  writeFileSync(argv.metrics, JSON.stringify({ info, frames: m, visibility: vis }, null, 1));
  console.log('wrote', argv.metrics, JSON.stringify(info));
  await browser.close(); server.close(); process.exit(0);
}
const DUR = await page.evaluate(() => window.FILM.DUR);

/* ---- 1 フレーム(サブフレームを線形光で平均した結果)を PNG で受け取る ---- */
async function frame(t, samples) {
  return page.evaluate(async ([t, samples, FPS_]) => {
    const F = window.FILM;
    F.renderFrame(t, samples, FPS_);
    const blob = await new Promise(r => F.out.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, [t, samples, FPS]);
}

if (argv.stills) {
  const dir = argv.outdir || path.join(os.tmpdir(), 'film-stills');
  mkdirSync(dir, { recursive: true });
  for (const ts of String(argv.stills).split(',').map(Number)) {
    const b64 = await frame(ts, +(argv.samples || 8));
    const f = path.join(dir, `${argv.prefix || ''}${THEME}-${aspect}-t${ts.toFixed(3).padStart(6, '0')}.png`);
    writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log(f);
  }
  await browser.close(); server.close();
  process.exit(0);
}

/* ---- 動画: PNG を ffmpeg に流す。音(sound.wav)があれば重ねる ---- */
mkdirSync(path.dirname(OUT), { recursive: true });
const FROM = +(argv.from || 0);
const end = argv.to != null ? +argv.to : DUR;
const n0 = Math.round(FROM * FPS), n1 = Math.round(end * FPS);
const wav = path.join(HERE, 'out', 'sound.wav');
const withAudio = existsSync(wav) && !argv.noaudio;
const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];
if (withAudio) args.push('-ss', String(FROM), '-t', String((n1 - n0) / FPS), '-i', wav);
// RGB→YUV は bt709 の行列で(既定の bt601 のままだと藍・砂がわずかにずれる。PR131 の知見)
args.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart');
if (withAudio) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
args.push(OUT);
const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let n = n0; n < n1; n++) {
  const b64 = await frame(n / FPS, SAMPLES);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (n % 60 === 0) console.log(`frame ${n}/${n1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close(); server.close();
console.log('wrote', OUT);
