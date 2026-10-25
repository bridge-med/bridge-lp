// 案A の止めた画像(ひらいた病院ぜんたい)を、時刻 × スマホ・PC で撮る。使い方は README.md
// PW=<playwright の場所> OUT=<出力先> BASE=http://localhost:8097/ node capture-open.mjs
const { chromium } = await import(process.env.PW || 'playwright');
const OUT = process.env.OUT || '.', BASE = process.env.BASE || 'http://localhost:8097/';
const JOBS = [];
for (const t of (process.env.TODS || 'day,dusk,night').split(',')) {
  // スマホ: 393×724 の画面の2倍。上は見出しと「病院の中」、下は一覧への入口を避ける(ページの scrubSafe と同じ範囲)
  JOBS.push([`capture=cutaway&id=hospital&tod=${t}&w=786&h=1448&el=30&dim=.3&box=1&fx0=.04&fx1=.96&fy0=.2&fy1=.86&shadow=2048`, `open-${t}-sp.png`]);
  // PC: 1440×900 と同じ縦横比
  JOBS.push([`capture=cutaway&id=hospital&tod=${t}&w=1600&h=1000&el=30&dim=.3&box=1&fx0=.3&fx1=.7&fy0=.18&fy1=.88&shadow=2048`, `open-${t}-pc.png`]);
}
for (const [q, name] of JOBS) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1600 } });
  await p.goto(`${BASE}proto/top-ad/hiraku5a/index.html?${q}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__done, null, { timeout: 300000 });
  const done = await p.evaluate(() => window.__done);
  await (await p.$('#cap')).screenshot({ path: `${OUT}/${name}`, omitBackground: true });
  console.log(name, JSON.stringify(done.st));   // 道具の画面の位置(画像の %)。hiraku.js の ST_SP・ST_PC に写す
  await b.close();
}
