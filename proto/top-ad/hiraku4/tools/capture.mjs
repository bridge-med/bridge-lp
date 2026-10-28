// 町の立体から止めた絵を撮る(capture モード)。使い方は README.md
// node capture.mjs <slug> '<query>' <out.png>   例: node capture.mjs hiraku4 'capture=section&id=hospital&tod=0&w=2400&h=2600&el=8&m=0.03&shadow=4096' s-day.png
const { chromium } = await import(process.env.PW || 'playwright');   // PW: playwright の場所(例: /opt/node22/lib/node_modules/playwright/index.mjs)
const [,, slug, q, out] = process.argv;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +(process.env.VW || 1700), height: +(process.env.VH || 1500) }, deviceScaleFactor: +(process.env.DSF || 1) });
const logs = []; p.on('console', m => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', e => logs.push('pageerror: ' + e.message));
const t0 = Date.now();
await p.goto(`${process.env.BASE || 'http://localhost:8097/'}proto/top-ad/${slug}/index.html?${q}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__done, null, { timeout: 300000 }).catch(() => logs.push('timeout'));
const done = await p.evaluate(() => window.__done);
const el = await p.$('#cap'); if (el) await el.screenshot({ path: out, omitBackground: true });
console.log(JSON.stringify({ st: done && done.st, calls: done && done.calls, ms: Date.now() - t0 }), logs.join(" | "));
await b.close();
