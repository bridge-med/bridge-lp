// 「名前になる」の写しの区間(フレーム 226〜759)のカメラと拭いの縁を reel.js から取り、サブフレームごとに <work>/cam.json へ書く(compose.py が読む)
// 画の出どころ(reel.js の TAKE_OF が枠の収まりで選ぶ): 一覧は list9(9 倍)、あつめた言葉は saved6(6 倍)、名前のあいだは name13(13 倍)、行を読む寄りは pair13(13 倍)。226〜246 は拭い
// usage: node showreel/namae/cams.mjs [--work showreel/namae/work] [--fontcache dir]   (撮った画は <work>/cap/frames.json)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const argv = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const WORK = path.resolve(argv.work || path.join(HERE, 'work')), FC = argv.fontcache || path.join(os.tmpdir(), 'bridge-showreel-fonts');
const FPS = 60, STEP = 0.5, MAXS = 48;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const p = path.join(ROOT, u); if (!existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const b = await chromium.launch();
const page = await b.newPage();
await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => { const url = route.request().url(); const f = path.join(FC, createHash('sha1').update(url).digest('hex')); if (!existsSync(f)) { mkdirSync(FC, { recursive: true }); execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36', '-o', f, url]); } await route.fulfill({ status: 200, body: readFileSync(f), headers: { 'content-type': url.includes('googleapis') ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } }); });
await page.goto(`http://127.0.0.1:${server.address().port}/showreel/namae/reel.html?render=1`, { waitUntil: 'load' });
await page.evaluate(() => window.REEL.ready);
const CAP = Object.fromEntries(JSON.parse(readFileSync(path.join(WORK, 'cap', 'frames.json'))).map(f => [f.take + ':' + f.n, { ...f, dir: path.join(WORK, 'cap') }]));   // take が重なる区間があるので take と n で引く
const out = await page.evaluate(({ STEP, MAXS, FPS }) => {
  const R = window.REEL, res = [];
  const speed = (t) => {                             // 画面上の最大の動き(px/コマ)。四隅と中心
    const [s0, s1] = R.segOf(t + 1e-9);
    const ta = Math.max(s0, t - 0.5 / FPS), tb = Math.min(s1 - 1e-6, t + 0.5 / FPS);
    const a = R.camPage(ta), c = R.camPage(tb); let v = 0;
    for (const [sx, sy] of [[0, 0], [1920, 0], [0, 1080], [1920, 1080], [960, 540]]) {
      const px = (sx - 960) / a.z + a.x, py = (sy - 540) / a.z + a.y;
      v = Math.max(v, Math.hypot((px - c.x) * c.z + 960 - sx, (py - c.y) * c.z + 540 - sy) * (1 / FPS) / (tb - ta));
    }
    return v;
  };
  const edgeSpeed = t => { const [s0, s1] = R.segOf(t + 1e-9); const ta = Math.max(s0, t - 0.5 / FPS), tb = Math.min(s1 - 1e-6, t + 0.5 / FPS); return Math.abs(R.wipeX(tb) - R.wipeX(ta)) * (1 / FPS) / (tb - ta) + 70; };
  const n0 = Math.floor(R.WIPE0 * FPS) + 1, n1 = Math.ceil(R.FS * FPS) - 1;
  for (let n = n0; n <= n1; n++) {
    const t = n / FPS, [s0, s1] = R.segOf(t + 1e-9), wipe = t < R.WIPE1 + 1e-9;
    const v = Math.max(speed(t), wipe ? edgeSpeed(t) : 0), ns = Math.min(MAXS, Math.max(1, Math.ceil(v * 0.5 / STEP)));
    const cams = [], wx = [];
    for (let i = 0; i < ns; i++) {
      let ts = ns === 1 ? t : t + (0.5 / FPS) * ((i + .5) / ns - .5);
      ts = Math.min(Math.max(ts, s0), s1 - 1e-6);
      const c = R.camPage(ts); cams.push([c.x, c.y, c.z]); if (wipe) wx.push(R.wipeX(ts));
    }
    res.push({ n, t, v, cams, wipe: wipe ? wx : null, want: R.TAKE_OF(n) });
  }
  return res;
}, { STEP, MAXS, FPS });
for (const f of out) {
  const c = CAP[f.want + ':' + f.n];
  if (!c) throw new Error(`撮った画がない: frame ${f.n} (${f.want})`);
  Object.assign(f, { dir: c.dir, take: c.take, dpr: c.dpr, clip: c.clip, image: c.image }); delete f.want;
}
writeFileSync(path.join(WORK, 'cam.json'), JSON.stringify(out));
console.log('frames', out.length, 'max samples', Math.max(...out.map(f => f.cams.length)));
await b.close(); server.close();
