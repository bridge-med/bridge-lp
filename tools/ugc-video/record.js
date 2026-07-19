// Playwright録画ランナー — scenario.js を読み、操作しながら縦型webmを録画する
// 使い方: node record.js <workdir>   (事前にサイトを http://127.0.0.1:8123 で配信しておく)
'use strict';

const path = require('path');
const scenario = require('./scenario.js');

const WORK = process.argv[2] || path.join(__dirname, 'work');
const BASE = process.env.UGC_BASE_URL || 'http://127.0.0.1:8123';
const CHROMIUM = process.env.UGC_CHROMIUM || '/opt/pw-browsers/chromium';

const { chromium } = require(require.resolve('playwright', { paths: [WORK, __dirname] }));

(async () => {
  // 高解像度録画の要点: contextのdeviceScaleFactorエミュレーションでは録画が
  // CSSピクセル(540x960)のままになる(Playwrightのscreencastはviewportサイズで
  // フレームを取るため)。ブラウザ起動引数で物理解像度ごと2倍にすると、
  // レイアウトはCSS 540pxのまま実ピクセル1080x1920で録画できる。
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--force-device-scale-factor=2'],
  });
  const ctx = await browser.newContext({
    viewport: scenario.viewport,
    hasTouch: true,
    recordVideo: {
      dir: path.join(WORK, 'rec'),
      size: { width: scenario.viewport.width * 2, height: scenario.viewport.height * 2 },
    },
    locale: 'ja-JP',
  });

  // 外部リクエスト遮断(フォントCDN等でのハング防止)
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());

  const page = await ctx.newPage();

  // テロップ・タップリップル・エンドカードの基盤を注入
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
        .vv-ripple{position:fixed;width:56px;height:56px;border-radius:50%;
          background:rgba(30,30,30,.28);border:2px solid rgba(30,30,30,.45);
          transform:translate(-50%,-50%) scale(.4);pointer-events:none;z-index:99998;
          animation:vvrip .5s ease-out forwards}
        @keyframes vvrip{to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
        #vv-cap{position:fixed;left:50%;bottom:7%;transform:translateX(-50%);
          max-width:86%;padding:10px 18px;border-radius:14px;z-index:99997;
          background:rgba(20,20,20,.82);color:#fff;font-family:'Noto Sans JP',sans-serif;
          font-weight:700;font-size:19px;line-height:1.5;text-align:center;
          white-space:nowrap;opacity:0;transition:opacity .35s}
        #vv-end{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:14px;background:#F7F4EE;
          font-family:'Noto Sans JP',sans-serif;opacity:0;transition:opacity .6s}
        #vv-end .t1{font-size:30px;font-weight:900;color:#1e1e1e;letter-spacing:.04em}
        #vv-end .t2{font-size:17px;font-weight:500;color:#555}
        #vv-end .t3{margin-top:22px;font-size:14px;font-weight:700;color:#1e1e1e;
          border:1.5px solid #1e1e1e;border-radius:999px;padding:9px 26px;letter-spacing:.18em}
      `;
      document.head.appendChild(style);
      const cap = document.createElement('div');
      cap.id = 'vv-cap';
      document.body.appendChild(cap);
      addEventListener('pointerdown', (e) => {
        const r = document.createElement('div');
        r.className = 'vv-ripple';
        r.style.left = e.clientX + 'px';
        r.style.top = e.clientY + 'px';
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 600);
      }, true);
    });
  });

  await page.goto(BASE + scenario.page, { waitUntil: 'domcontentloaded' });

  const t0 = Date.now();
  const until = (sec) => new Promise((res) => {
    setTimeout(res, Math.max(0, t0 + sec * 1000 - Date.now()));
  });
  const cap = (i) => page.evaluate((t) => {
    const c = document.getElementById('vv-cap');
    if (!t) { c.style.opacity = '0'; return; }
    c.textContent = t;
    c.style.opacity = '1';
  }, scenario.captions[i] || '');

  await scenario.run(page, { until, cap, T: scenario.T });

  // エンドカード
  await until(scenario.T.seg4);
  await cap(-1);
  await page.evaluate((e) => {
    const end = document.createElement('div');
    end.id = 'vv-end';
    end.innerHTML = `
      <div class="t1">${e.title}</div>
      <div class="t2">${e.sub}</div>
      <div class="t3">${e.badge}</div>`;
    document.body.appendChild(end);
    requestAnimationFrame(() => { end.style.opacity = '1'; });
  }, scenario.endCard);

  await until(scenario.T.end);
  await ctx.close();
  await browser.close();
  console.log('recorded ok');
})().catch((e) => { console.error(e); process.exit(1); });
