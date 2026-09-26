// ================================================================
// showreel render — reel.html を 1 フレームずつ描いて MP4 にする
// usage: node showreel/render.mjs [--from 0] [--to 15] [--fps 60] [--samples 6] [--out showreel/showreel.mp4]
//        node showreel/render.mjs --stills 0.5,2.1,7.3 --outdir <dir>   (確認用の静止画だけ)
// 依存: playwright(chromium)・ffmpeg(PATH か FFMPEG)。音は showreel/sound.mjs が書く WAV を重ねる
// フォント: reel.html は Google Fonts を読む。描画時はその要求を curl で取ったキャッシュから返す
//           (Chromium に TLS の例外を与えないため。キャッシュは --fontcache、既定は OS の一時領域)
// ================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const FPS = +(argv.fps || 60);
const FROM = +(argv.from || 0);
const TO = argv.to != null ? +argv.to : null;
const SAMPLES = +(argv.samples || 6);
const SHUTTER = +(argv.shutter || 0.5);            // 1 フレームのうちシャッターが開いている割合(180°)
const OUT = argv.out || path.join(HERE, 'showreel.mp4');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FONTCACHE = argv.fontcache || path.join(os.tmpdir(), 'bridge-showreel-fonts');
const CRF = argv.crf || '14';
mkdirSync(FONTCACHE, { recursive: true });

/* ---- 静的サーバー(canvas に画像を描くため file:// ではなく http で開く) ---- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---- フォントの要求は curl のキャッシュから返す ---- */
function cached(url) {
  const f = path.join(FONTCACHE, createHash('sha1').update(url).digest('hex'));
  if (!existsSync(f)) execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', '-o', f, url]);
  return readFileSync(f);
}

const launch = {};
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
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

await page.goto(`${BASE}/showreel/reel.html?render=1`, { waitUntil: 'load' });
await page.evaluate(() => window.REEL.ready);
const DUR = await page.evaluate(() => window.REEL.DUR);

/* ---- 1 フレーム: サブフレームを Float で平均して動きのぼけを作る ---- */
async function frame(t, samples) {
  return page.evaluate(async ([t, samples, shutter, fps]) => {
    const R = window.REEL;
    R.renderBlur(t, samples, shutter / fps);
    const blob = await new Promise(r => R.out.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, [t, samples, SHUTTER, FPS]);
}

if (argv.stills) {
  const dir = argv.outdir || path.join(os.tmpdir(), 'showreel-stills');
  mkdirSync(dir, { recursive: true });
  for (const ts of argv.stills.split(',').map(Number)) {
    const b64 = await frame(ts, +(argv.samples || 1));
    const f = path.join(dir, `t${ts.toFixed(3).padStart(6, '0')}.png`);
    writeFileSync(f, Buffer.from(b64, 'base64'));
    console.log(f);
  }
  await browser.close(); server.close();
  process.exit(0);
}

/* ---- 動画: PNG を ffmpeg に流す。音(sound.wav)があれば重ねる ---- */
const end = TO ?? DUR;
const n0 = Math.round(FROM * FPS), n1 = Math.round(end * FPS);
const wav = path.join(HERE, 'sound.wav');
const withAudio = existsSync(wav) && !argv.noaudio;
const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-'];
if (withAudio) args.push('-ss', String(FROM), '-t', String((n1 - n0) / FPS), '-i', wav);
// RGB→YUV は bt709 の行列で(既定の bt601 のままだと藍・砂がわずかにずれる)
args.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'animation',
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
