// 町の止めた画像を1枚撮る(最初の画面 poster・建物の肖像 portrait・建物の中 cutaway)。使い方は README.md
// PW=<playwright の場所> BASE=http://localhost:8097/ node cap.mjs '<?capture= の引数>' <出力.png>
const { chromium } = await import(process.env.PW || 'playwright');
const [,, q, out] = process.argv, BASE = process.env.BASE || 'http://localhost:8097/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1700, height: 1500 } });
await p.route(/gc\.zgo\.at|goatcounter/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));   // 撮るときは訪問の計測に数えない
await p.goto(`${BASE}index.html?capture=${q}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__done, null, { timeout: 400000 });
await (await p.$('#cap')).screenshot({ path: out, omitBackground: true, timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => window.__done)));   // poster は建物ごとの名前の札・押せる範囲・外形(pins)。cutaway は道具の画面の位置(st)
await b.close();
