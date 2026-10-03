// ================================================================
// 「名前になる」の写しの撮影 — 実物の iikae/ を、実物への入力(タップとなぞり)だけで動かし、1 コマずつ撮る
// 実物を高い解像度(take ごとの dpr)で撮り、カメラ(寄り・引き)は撮ったあとに縦横同じ倍率の切り出しで掛ける(compose.py)。
// 舞台の transform で寄ると倍率が変わるたびに Chrome が字を組み直して字が揺れるため、実物の画素を一度だけ作って切り出す。
// take ごとにビューポートの高さ(take.vh)・撮る範囲(take.clip。ページの CSS px)・クリップボードの許可(take.clipboard。
// ブラウザの設定で、ページには書かない)を選ぶ。動きのないコマの画は前のコマと共有する。
//
// 規律(qa はこのファイルを無加工の証跡として読む):
//   - 実ページには何も書かない。DOM・CSS・保存データを書き換える命令も、スクリプトや CSS の差し込みもしない
//   - 実ページへの入力は、タップ(page.touchscreen.tap)と指のなぞり(Input.dispatchTouchEvent)だけ
//   - 実ページから読むのは、押す位置を決めるための要素の箱(locator.boundingBox)と、撮影記録のための状態だけ
//   - 時刻は撮影の仕組みで止め、1 コマずつ進める。速さは 1 倍
//       JS の時計: Playwright の clock / CSS の動き: DevTools の Animation(時間軸を止め、経過時刻に合わせる)
//   - 保存データのない新しいプロファイル、ライト、幅 1440 の実ページ(高さと撮る倍率は take ごと)
//   - 実ページの画は、変わったときだけ新しい 1 枚として残す(同じ画は前の 1 枚を指す)
// 出力: <outdir>/p###.png(実ページの画)、<outdir>/frames.json(コマごとに、使う画とカメラのサブフレーム)、capture-log.json
// usage: node showreel/namae/capture.mjs showreel/namae/shots.mjs <outdir> [--only name] [--step 0.5] [--maxsamples 48] [--fontcache dir]
// ================================================================
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../..');   // リポジトリの根
let DPR = 3;
const [shotsPath, OUT] = process.argv.slice(2);
const opt = Object.fromEntries(process.argv.slice(4).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const FONTCACHE = opt.fontcache || path.join(os.tmpdir(), 'bridge-showreel-fonts');
mkdirSync(FONTCACHE, { recursive: true });
const FPS = 60;
const MAXS = +(opt.maxsamples || 48);
const STEP = +(opt.step || 0.5);                 // サブフレームの間隔(画面の px)
const SHOTS = (await import(pathToFileURL(path.resolve(shotsPath)).href)).default;
mkdirSync(OUT, { recursive: true });

/* ---- 緩急とカメラ(capture.mjs と同じ。v3 の reel.html と同じ定義) ---- */
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, u) => a + (b - a) * u;
const E = {
  lin: u => u, quadIn: u => u * u, cubicIn: u => u * u * u, cubicOut: u => 1 - Math.pow(1 - u, 3),
  cubicInOut: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2,
  expoOut: u => (1 - Math.pow(2, -10 * u)) / (1 - Math.pow(2, -10)),
  sineInOut: u => (1 - Math.cos(Math.PI * u)) / 2,
};
const seg = (t, a, d, e = E.lin) => e(clamp((t - a) / d));
function sim(t, a, d, k0, k1, ease) {
  const e = seg(t, a, d, ease);
  if (Math.abs(k0.z - k1.z) < 1e-9) return { x: lerp(k0.x, k1.x, e), y: lerp(k0.y, k1.y, e), z: k0.z };
  const z = Math.pow(k0.z, 1 - e) * Math.pow(k1.z, e);
  const px = (k1.x * k1.z - k0.x * k0.z) / (k1.z - k0.z), py = (k1.y * k1.z - k0.y * k0.z) / (k1.z - k0.z);
  return { x: px - (px - k0.x) * k0.z / z, y: py - (py - k0.y) * k0.z / z, z };
}
const pullLike = (ramp, d) => { const r = ramp / d; return u => { const w = (u < r ? u * u / (2 * r) : u - r / 2) / (1 - r / 2); return E.expoOut(clamp(w)); }; };
function camAt(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b.t) {
      if (b.ease === 'cut' || !b.ease) return a;
      const e = typeof b.ease === 'object' ? pullLike(b.ease.pull, b.t - a.t) : E[b.ease];
      return sim(t, a.t, b.t - a.t, a, b, e);
    }
  }
  return keys[keys.length - 1];
}
function speedPx(keys, t) {                      // 画面上の最大の動き(px/コマ)。四隅と中心で測る
  const a = camAt(keys, t), b = camAt(keys, t + 1 / FPS);
  let v = 0;
  for (const [sx, sy] of [[0, 0], [1920, 0], [0, 1080], [1920, 1080], [960, 540]]) {
    const px = (sx - 960) / a.z + a.x, py = (sy - 540) / a.z + a.y;
    v = Math.max(v, Math.hypot((px - b.x) * b.z + 960 - sx, (py - b.y) * b.z + 540 - sy));
  }
  return v;
}

/* ---- 静的サーバー(リポジトリの実ページだけ) ---- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  if (!existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a]).toString().trim();
const LOG = {
  capturedAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'),
  iikaeSameAsOriginMaster: (() => { try { execFileSync('git', ['-C', ROOT, 'diff', '--quiet', 'origin/master', '--', 'iikae/']); return true; } catch { return false; } })(),
  page: '/iikae/index.html', viewport: 'per take (1440 wide)', theme: 'light', profile: 'new (no storage)',
  camera: 'after capture: uniform-scale crop of the whole-page image (no pixel edits)', takes: [],
};
const browser = await chromium.launch();
const FRAMES = [];
let pid = 0;

async function runTake(take) {
  DPR = take.dpr || 3;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: take.vh || 900 }, deviceScaleFactor: DPR, colorScheme: 'light', hasTouch: true });
  if (take.clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.clock.install({ time: new Date('2026-09-27T10:00:00+09:00') });
  const page = await ctx.newPage();
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const url = route.request().url();
    const f = path.join(FONTCACHE, createHash('sha1').update(url).digest('hex'));
    if (!existsSync(f)) execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', '-o', f, url]);
    await route.fulfill({ status: 200, body: readFileSync(f), headers: { 'content-type': url.includes('googleapis') ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.request().url().includes('fonts.g') ? r.fallback() : r.abort());
  const cdp = await ctx.newCDPSession(page);
  const live = new Map();
  let vt = null;
  let dirty = true;                                // 入力か動きが起きたら、次のコマで撮り直す
  cdp.on('Animation.animationStarted', e => { if (vt != null) { const src = e.animation.source || {}; live.set(e.animation.id, { at: vt, end: vt + ((src.delay || 0) + (src.duration || 0)) / 1000 }); dirty = true; } });
  await cdp.send('Animation.enable');
  await page.goto(`${BASE}/iikae/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);   // 読むだけ(字の読み込みを待つ)
  await page.waitForTimeout(400);
  await ctx.clock.pauseAt(new Date('2026-09-27T10:00:10+09:00').getTime());
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
  const V0 = take.prepStart ?? -10;
  vt = V0;
  let clockMs = 0;
  const advance = async (to) => {
    const ms = Math.round((to - V0) * 1e6) / 1000;
    if (ms > clockMs) { await ctx.clock.runFor(ms - clockMs); clockMs = ms; }
    vt = to;
    for (const [id, a] of [...live]) {
      try { await cdp.send('Animation.seekAnimations', { animations: [id], currentTime: Math.max(0, (to - a.at) * 1000) }); }
      catch { live.delete(id); }
    }
  };
  const inputs = [];
  const doInput = async (ev) => {
    if (ev.tap) {
      const box = await page.locator(ev.tap).first().boundingBox();          // 読むだけ
      if (!box) throw new Error('tap target not visible: ' + ev.tap);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.touchscreen.tap(x, y);
      inputs.push({ vt: +vt.toFixed(6), tap: ev.tap, page: [+x.toFixed(1), +y.toFixed(1)] });
    } else if (ev.swipe) {                         // 指のなぞり: 画面の中央を下から上へ(ev.swipe 回。1 回 ev.dist px、既定 600。始点はビューポートの下から 60px)
      const dist = ev.dist || 600;
      for (let k = 0; k < ev.swipe; k++) {
        const x = 720; let y = Math.min(800, (take.vh || 900) - 60);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 0; i < 24; i++) { y -= dist / 24; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await page.waitForTimeout(8); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(150);
      }
      inputs.push({ vt: +vt.toFixed(6), swipe: ev.swipe + ' x ' + dist + 'px', scrollY: await page.evaluate(() => scrollY) });
    }
    dirty = true;
    await page.waitForTimeout(ev.realWait ?? 120);
  };
  for (const ev of take.prep || []) {
    if (ev.wait != null) { await advance(vt + ev.wait); continue; }
    await doInput(ev);
  }
  const [t0, t1] = take.out;
  const events = [...(take.events || [])].sort((a, b) => a.t - b.t);
  let ei = 0, lastHash = null, lastP = null;
  while (ei < events.length && events[ei].t <= t0) { await advance(events[ei].t); await doInput(events[ei]); ei++; }   // 撮影の区間より前の出来事も、その仮想時刻で入れる
  await advance(t0);
  const n0 = Math.round(t0 * FPS), n1 = Math.round(t1 * FPS);
  for (let n = n0; n < n1; n++) {
    const t = n / FPS;
    while (ei < events.length && events[ei].t <= t) { await advance(events[ei].t); await doInput(events[ei]); ei++; }
    await advance(t);
    await page.waitForTimeout(20);                 // 時計で起きた動き(知らせの消えなど)の登録を待つ
    const moving = [...live.values()].some(a => t < a.end + 1 / FPS);
    // 実ページの画(take.clip の範囲を dpr 倍で)。入力も動きもないコマは前の 1 枚を使う。同じ画も前の 1 枚を使う
    if (dirty || moving || !lastP) {
      const buf = await page.screenshot({ type: 'png', ...(take.clip ? { clip: take.clip } : {}) });
      const h = createHash('sha1').update(buf).digest('hex');
      if (h !== lastHash) { lastP = `p${String(pid++).padStart(3, '0')}.png`; writeFileSync(path.join(OUT, lastP), buf); lastHash = h; }
      dirty = false;
    }
    // カメラのサブフレーム(シャッター 180°。間隔 STEP px 以下)
    const v = speedPx(take.cam, t), ns = clamp(Math.ceil(v * 0.5 / STEP), 1, MAXS);
    const cams = [];
    for (let i = 0; i < ns; i++) { const ts = ns === 1 ? t : t + (0.5 / FPS) * ((i + .5) / ns - .5); const c = camAt(take.cam, ts); cams.push([c.x, c.y, c.z]); }
    FRAMES.push({ n, take: take.name, dpr: DPR, clip: take.clip || null, image: lastP, cams });
    if (n % 60 === 0) console.log(`${take.name}: frame ${n}/${n1} (images ${pid})`);
  }
  LOG.takes.push({ name: take.name, dpr: DPR, viewport: `1440x${take.vh || 900}`, clipboard: !!take.clipboard, clip: take.clip || null, out: take.out, inputs, frames: n1 - n0,
    state: await page.evaluate(() => ({ view: document.querySelector('.view.on')?.id, open: document.querySelector('.word-row.open')?.dataset.key || null, stars: document.querySelectorAll('.word-star.on').length, saved: Array.from(document.querySelectorAll('#saved-list .genba')).map(e => e.textContent), toast: document.getElementById('toast').textContent, scrollY })) });
  await ctx.close();
}

for (const take of SHOTS.takes) {
  if (opt.only && opt.only !== take.name) continue;
  await runTake(take);
}
writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(FRAMES));
writeFileSync(path.join(OUT, 'capture-log.json'), JSON.stringify(LOG, null, 1));
await browser.close(); server.close();
console.log('done', OUT, 'frames', FRAMES.length, 'images', pid);
