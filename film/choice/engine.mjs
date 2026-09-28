// P3 capture engine: drive a real page, freeze its clocks, step virtual time per frame,
// and capture an arbitrary rect at arbitrary scale via CDP (crisp re-raster, no resampling).
import { launch, context, settle, sleep, serve, FFMPEG, PAT } from './lib.mjs';
import { mkdirSync, writeFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const FPS = 30;
export const SHUTTER = 0.5;
export const ease = {
  lin: x => x,
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  inOutQuint: x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  outQuint: x => 1 - Math.pow(1 - x, 5),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outExpo: x => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inOutExpo: x => x === 0 ? 0 : x === 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
};
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

// Zoom about a fixed origin so that world point X sits at screen A (scale s0) and at screen B (scale s1).
// Returns cam(u) for u in [0,1] (already eased) giving {cx, cy, s}: the page point at frame centre.
export function zoomCam(X, A, B, s0, s1, W = 1920, H = 1080) {
  // screen(X) = P_s + s (X - P_w)  ;  A - B = (s0 - s1)(X - P_w)
  const dx = (A[0] - B[0]) / (s0 - s1), dy = (A[1] - B[1]) / (s0 - s1);
  const Pw = [X[0] - dx, X[1] - dy];
  const Ps = [A[0] - s0 * dx, A[1] - s0 * dy];
  return u => {
    const s = Math.exp(lerp(Math.log(s0), Math.log(s1), u));
    // frame centre (W/2,H/2) maps to world: Pw + (C - Ps)/s
    return { cx: Pw[0] + (W / 2 - Ps[0]) / s, cy: Pw[1] + (H / 2 - Ps[1]) / s, s };
  };
}
// place world point X at screen point A with scale s
export const placeCam = (X, A, s, W = 1920, H = 1080) => ({ cx: X[0] + (W / 2 - A[0]) / s, cy: X[1] + (H / 2 - A[1]) / s, s });

const VT_SRC = `(() => {
  if (window.__VT) return;
  const q = []; let now = 0, seq = 1;
  const base = performance.now(), dbase = Date.now();
  const VT = window.__VT = { now: 0 };
  window.setTimeout = (fn, ms = 0, ...a) => { const id = seq++; q.push({ id, at: now + Math.max(0, +ms || 0), fn, a }); return id; };
  window.clearTimeout = id => { const i = q.findIndex(x => x.id === id); if (i >= 0) q.splice(i, 1); };
  window.setInterval = (fn, ms = 0, ...a) => { const id = seq++; const iv = Math.max(4, +ms || 0); q.push({ id, at: now + iv, fn, a, iv }); return id; };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = fn => { const id = seq++; const at = (Math.floor(now / 16.6667) + 1) * 16.6667; q.push({ id, at, fn, a: [], raf: true }); return id; };
  window.cancelAnimationFrame = window.clearTimeout;
  performance.now = () => base + now;
  Date.now = () => dbase + now;
  VT.advance = t => {
    for (let guard = 0; guard < 200000; guard++) {
      let best = null; for (const x of q) if (x.at <= t && (!best || x.at < best.at || (x.at === best.at && x.id < best.id))) best = x;
      if (!best) break;
      now = Math.max(now, best.at);
      if (best.iv) best.at += best.iv; else q.splice(q.indexOf(best), 1);
      try { if (best.raf) best.fn(base + now); else if (typeof best.fn === 'function') best.fn(...best.a); } catch (e) { console.error('VT', e && e.message); }
    }
    now = Math.max(now, t); VT.now = now;
  };
  VT.skip = t => { now = Math.max(now, t); VT.now = now; };   // move the JS clock without firing (freeze-frame of the app's own sequencing)
  const starts = new WeakMap();
  VT.syncAnim = t => {
    for (const a of document.getAnimations()) {
      if (!starts.has(a)) starts.set(a, t - (a.playState === 'finished' ? 1e7 : Math.max(0, +a.currentTime || 0)));
      try { a.pause(); a.currentTime = Math.max(0, t - starts.get(a)); } catch (e) {}
    }
    for (const s of document.querySelectorAll('svg')) { try { if (!s.animationsPaused()) s.pauseAnimations(); s.setCurrentTime(t / 1000); } catch (e) {} }
  };
})();`;

export async function openShot(browser, base, shot) {
  const c = await context(browser, shot.theme, { w: shot.vw || 1440, h: shot.vh || 900, reduced: shot.reduced || 'no-preference' });
  const page = await c.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(base + shot.url, { waitUntil: 'networkidle' });
  await settle(page, shot.settleMs || 1200);
  if (shot.prep) await shot.prep(page);
  if (shot.prepAfter) await shot.prepAfter(page);
  await page.mouse.move(1, (shot.vh || 900) - 1);
  await sleep(400);
  await page.evaluate(VT_SRC);
  const cdp = await c.newCDPSession(page);
  return { c, page, cdp };
}

async function grab(cdp, cam, W, H, k) {
  const s = cam.s * k; // k = output width / 1920
  const w = W / s, h = H / s;
  // Chromium floors clip width/height to whole CSS px but honours fractional x/y: ask for a little more, crop the top-left WxH later
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: cam.cx - w / 2, y: cam.cy - h / 2, width: Math.ceil(w) + 1, height: Math.ceil(h) + 1, scale: s }, fromSurface: true, captureBeyondViewport: false });
  return Buffer.from(r.data, 'base64');
}

// shot: { id, url, theme, frames, prep, anchors(page)->obj, actions: [{f, run(page, A)}], cam(t, A)->{cx,cy,s}, sub(f)->n, js(f)->bool (advance app timers) }
export async function renderShot(shot, { W = 1920, H = 1080, outDir, only = null, base, browser }) {
  if (!only) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const k = 1, OW = W, OH = H; W = 1920; H = 1080;
  const { c, page, cdp } = await openShot(browser, base, shot);
  const A = shot.anchors ? await shot.anchors(page) : {};
  if (shot.debugAnchors) console.log(shot.id, JSON.stringify(A), await page.evaluate(() => [scrollX, scrollY, innerWidth, innerHeight, visualViewport.pageTop]));
  const acts = [...(shot.actions || [])].sort((a, b) => a.f - b.f);
  let ai = 0;
  const tmp = path.join(outDir, '_sub'); mkdirSync(tmp, { recursive: true });
  for (let f = 0; f < shot.frames; f++) {
    while (ai < acts.length && acts[ai].f <= f) { await acts[ai].run(page, A); ai++; }
    const n = Math.min(shot.sub ? shot.sub(f) : 1, +(process.env.SUBMAX || 99));
    const bufs = [];
    for (let j = 0; j < n; j++) {
      const tf = n === 1 ? f : f + ((j + 0.5) / n - 0.5) * SHUTTER;   // shutter 180 deg
      const tms = (tf / FPS + (shot.shift || 0)) * 1000;
      const js = shot.js ? shot.js(f) : true;
      await page.evaluate(([t, js]) => { if (js) __VT.advance(Math.max(__VT.now, t)); else __VT.skip(t); __VT.syncAnim(t); }, [tms, js]);
      if (shot.onFrame) await shot.onFrame(page, tf / FPS, A);
      if (only && !only.includes(f)) continue;
      const cam = shot.cam(tf / FPS, A);
      bufs.push(await grab(cdp, cam, W, H, k));
    }
    if (only && !only.includes(f)) continue;
    const dst = path.join(outDir, String(f).padStart(4, '0') + '.png');
    const ins = bufs.map((b, j) => { const p = path.join(tmp, j + '.png'); writeFileSync(p, b); return p; });
    const n2 = ins.length;
    const fc = ins.map((_, j) => `[${j}]crop=${W}:${H}:0:0,format=rgb24[c${j}]`).join(';') + ';' + (n2 === 1 ? '[c0]null' : ins.map((_, j) => `[c${j}]`).join('') + `mix=inputs=${n2}`) + (OW !== W ? `,scale=${OW}:${OH}:flags=area` : '');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...ins.flatMap(p => ['-i', p]), '-filter_complex', fc, '-frames:v', '1', dst]);
    if (f % 10 === 0) process.stdout.write(`${shot.id}:${f} `);
  }
  process.stdout.write('\n');
  await c.close();
}
