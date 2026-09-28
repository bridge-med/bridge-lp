// node export.mjs [query] — PASSAGE の場面を /tmp/claude-0/blender/scene/ に書き出す
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const ROOT = '/home/user/bridge-lp', OUT = process.env.OUT || '/tmp/claude-0/blender/scene';
mkdirSync(OUT, { recursive: true });
const server = createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const FC = '/tmp/bridge-film-fonts';
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => { const url = route.request().url(); const f = path.join(FC, createHash('sha1').update(url).digest('hex')); if (!existsSync(f)) execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 Chrome/141.0', '-o', f, url]); await route.fulfill({ status: 200, body: readFileSync(f), headers: { 'content-type': url.includes('googleapis') ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } }); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/film/passage/film.html?render=1&${process.argv[2] || ''}`);
await page.waitForFunction(() => window.FILM || window.FILM_ERROR, null, { timeout: 180000 });
const err = await page.evaluate(() => window.FILM_ERROR); if (err) { console.log(err); process.exit(1); }
const sc = await page.evaluate(() => window.FILM.exportScene());
// 写しの画像を一緒に置く
for (const m of sc.meshes) if (m.kind === 'plate') { const src = path.join(ROOT, 'film/passage', m.src); const dst = path.join(OUT, path.basename(src)); copyFileSync(src, dst); m.file = dst; }
writeFileSync(path.join(OUT, 'scene.json'), JSON.stringify(sc));
// 距離の地図 → PFM(下の行から。PFM も下の行から並べる)
const H2 = sc.H * 2, W2 = sc.W * 2, strips = [];
for (let y = 0; y < H2; y += 270) { const r = await page.evaluate(([a, b]) => window.FILM.exportDepth(a, b), [y, Math.min(H2, y + 270)]); strips.push(Buffer.from(r.data, 'base64')); }
const hdr = Buffer.from(`Pf\n${W2} ${H2}\n-1.0\n`, 'ascii');
writeFileSync(path.join(OUT, 'depth.pfm'), Buffer.concat([hdr, ...strips]));
for (const k of ['N', 'S']) { const d = await page.evaluate(k => window.FILM.exportMask(k), k); writeFileSync(path.join(OUT, `mask${k}.png`), Buffer.from(d.split(',')[1], 'base64')); }
const lk = await page.evaluate(() => window.FILM.exportLockup());
lk.forEach((l, i) => { writeFileSync(path.join(OUT, `lockup${i}.png`), Buffer.from(l.png.split(',')[1], 'base64')); delete l.png; });
writeFileSync(path.join(OUT, 'lockup.json'), JSON.stringify(lk));
console.log('meshes', sc.meshes.length, 'cams', sc.cams.length);
await browser.close(); server.close();
