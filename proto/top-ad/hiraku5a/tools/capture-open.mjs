// 案A の止めた画像(ひらいた病院ぜんたい)を、時刻 × スマホ・PC で撮る。使い方は README.md
// PW=<playwright の場所> OUT=<出力先> BASE=http://localhost:8097/ node capture-open.mjs
const { chromium } = await import(process.env.PW || 'playwright');
const OUT = process.env.OUT || '.', BASE = process.env.BASE || 'http://localhost:8097/';
const JOBS = [];
for (const t of (process.env.TODS || 'day,dusk,night').split(',')) {
  // 立体の「ひらいた病院ぜんたい」(live.js の K1)と同じ収め方: 見下ろす角 14°、屋根を残し、前の壁は外し(倒れて広場の下へ沈んだ後)、広場の弧は消す(open5=1)
  // スマホ: 393×724 の画面の2倍。幅は安全な範囲(左右 10px)の 92%、建物の箱の真ん中を、安全な範囲(上 132px・下 86px)の 54% の高さに
  JOBS.push([`capture=cutaway&id=hospital&open5=1&tod=${t}&w=786&h=1448&el=14&dim=.3&box=1&fx0=.0636&fx1=.9364&fy0=.316&fy1=.802&shadow=2048`, `open-${t}-sp.png`]);
  // PC: 1440×900 と同じ縦横比。高さで収まる(安全な範囲 上 150px・下 92px の 86%)
  JOBS.push([`capture=cutaway&id=hospital&open5=1&tod=${t}&w=1600&h=1000&el=14&dim=.3&box=1&fx0=.308&fx1=.692&fy0=.247&fy1=.876&shadow=2048`, `open-${t}-pc.png`]);
}
for (const [q, name] of JOBS) {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1600 } });
  await p.goto(`${BASE}proto/top-ad/hiraku5a/index.html?${q}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__done, null, { timeout: 300000 });
  const done = await p.evaluate(() => window.__done);
  await (await p.$('#cap')).screenshot({ path: `${OUT}/${name}`, omitBackground: true });
  console.log(name, JSON.stringify(done.band));   // 札の置き場(その道具の階の天井の切り口。画像の %)。hiraku.js の BAND_SP・BAND_PC に写す
  await b.close();
}
