// 案B の病院の断面の止めた絵を撮る(capture=inside)。使い方は README.md
// node capture.mjs '<query>' <out.png>   例: node capture.mjs 'capture=inside&tod=day&w=1200' in-day.png
const { chromium } = await import(process.env.PW || 'playwright');   // PW: playwright の場所(例: /opt/node22/lib/node_modules/playwright/index.mjs)
const [,, q, out] = process.argv;
const w = +(new URLSearchParams(q).get('w') || 1200);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w + 40, height: Math.round(w * 1.6) + 40 } });   // 枠の高さは 幅 × 縦横比(1.6 倍あれば収まる)
const logs = []; p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
const t0 = Date.now();
await p.goto(`${process.env.BASE || 'http://localhost:8097/'}proto/top-ad/hiraku5b/index.html?${q}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__done, null, { timeout: 300000 }).catch(() => logs.push('timeout'));
const done = await p.evaluate(() => window.__done);
const el = await p.$('#cap'); if (el) await el.screenshot({ path: out, omitBackground: true });
console.log(JSON.stringify({ ...done, ms: Date.now() - t0 }), logs.join(' | '));
await b.close();
