// shared helpers: static server of the repo, browser context (external requests: only fonts / CDN, fetched once with curl)
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright: PLAYWRIGHT_MODULE (path to playwright's index.mjs) > a resolvable 'playwright' > the global install of this environment.
// Chromium comes from PLAYWRIGHT_BROWSERS_PATH (job2.sh defaults it to /opt/pw-browsers).
async function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const m of tries) { try { return await import(m); } catch (e) {} }
  throw new Error('playwright not found: set PLAYWRIGHT_MODULE to playwright/index.mjs');
}
const { chromium } = await loadPlaywright();

// FILM = this directory (film/choice). ROOT = the repo root (served as the site). WORK = frames (gitignored). FFMPEG = env or PATH.
export const FILM = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(FILM, '../..');
export const WORK = path.resolve(process.env.FILM_WORK || path.join(FILM, 'work'));
export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const CACHE = path.join(WORK, 'netcache');   // fonts / CDN files fetched once with curl (see context())
mkdirSync(CACHE, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary' };
export async function serve(root = ROOT, extra = {}) {
  const server = createServer((req, res) => {
    const pn = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const pre = Object.keys(extra).find(k => pn.startsWith(k));
    let p = pre ? path.join(extra[pre], pn.slice(pre.length)) : path.join(root, pn);
    try { if (statSync(p).isDirectory()) p = path.join(p, 'index.html'); } catch {}
    if (!existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(readFileSync(p));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
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
export async function launch(gl = true) {
  // SwiftShader (software WebGL) only where a page draws with WebGL (clinic-flow-3d); ~4x faster captures without it
  const g = gl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
  return chromium.launch({ args: [...g, '--lang=ja-JP', '--font-render-hinting=none'], env: { ...process.env, LANG: 'ja_JP.UTF-8', LANGUAGE: 'ja' } });
}
export async function context(browser, theme, { dpr = 1, w = 1440, h = 900, reduced = 'no-preference' } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: theme, locale: 'ja-JP', reducedMotion: reduced, serviceWorkers: 'block' });
  await c.addInitScript(t => { try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('bridge-theme', t); } catch (e) {} }, theme);
  await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, async route => {
    const u = route.request().url();
    if (ALLOW.test(u) && route.request().method() === 'GET') {
      try { const r = curlGet(u); return route.fulfill({ status: 200, body: r.body, headers: { 'content-type': r.type, 'access-control-allow-origin': '*' } }); }
      catch (e) { return route.abort(); }
    }
    return route.abort();
  });
  return c;
}
export async function settle(page, ms = 1200) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('on', 'in', 'is-in', 'visible')));
  await sleep(ms);
}
// CDP capture of an arbitrary rect at arbitrary scale (crisp re-raster)
export async function cdpShot(cdp, rect, scale, format = 'png') {
  const r = await cdp.send('Page.captureScreenshot', { format, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h, scale }, captureBeyondViewport: true, fromSurface: true });
  return Buffer.from(r.data, 'base64');
}
