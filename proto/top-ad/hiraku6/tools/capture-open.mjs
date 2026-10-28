// 到着の画の止めた画像(ひらいた病院ぜんたい)を、時刻 × スマホ・PC で撮る。使い方は README.md
// PW=<playwright の場所> OUT=<出力先> BASE=http://localhost:8097/ node capture-open.mjs
const { chromium } = await import(process.env.PW || 'playwright');
const OUT = process.env.OUT || '.', BASE = process.env.BASE || 'http://localhost:8097/';
const JOBS = [];
for (const t of (process.env.TODS || 'day,dusk,night').split(',')) {
  // v6: 立体の到着の画(live.js の K1・arriveFrame)とまったく同じ視点・枠(turn −16°・el 11°。屋根を残し、前の壁は沈んだ後、広場の弧は消し、町は空気へ溶かし、外枠の太い切り口つき)
  // スマホ: 393×724 の画面を2倍で。PC: 1440×900 を 1600×1000 で(同じ縦横比)
  JOBS.push([`capture=cutaway&id=hospital&arrive=1&tod=${t}&w=786&h=1448&cw=393&ch=724&shadow=2048`, `open-${t}-sp.png`]);
  JOBS.push([`capture=cutaway&id=hospital&arrive=1&tod=${t}&w=1600&h=1000&cw=1440&ch=900&shadow=2048`, `open-${t}-pc.png`]);
}
for (const [q, name] of JOBS) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1600 } });
  await p.goto(`${BASE}proto/top-ad/hiraku6/index.html?${q}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__done, null, { timeout: 300000 });
  const done = await p.evaluate(() => window.__done);
  await (await p.$('#cap')).screenshot({ path: `${OUT}/${name}`, omitBackground: true });
  console.log(name, JSON.stringify({ band: done.band, marks: done.marks }));   // 札の置き場・階の印・正面の地面の線(画像の %)。hiraku.js の STILL_SP・STILL_PC に写す
  await b.close();
}
