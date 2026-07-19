// Playwright録画ランナー — scenario.js を読み、操作しながら縦型動画を録画する
// 使い方: node record.js <workdir>   (事前にサイトを http://127.0.0.1:8123 で配信しておく)
//
// キャプチャ方式(UGC_CAPTURE):
//   x11   — Xvfb上のヘッドフルChromeをffmpeg x11grabでロスレス取得(高画質・既定はmake-short.shが選ぶ)
//   video — Playwright内蔵録画(VP8圧縮・可変fps。xvfbが無い環境のフォールバック)
'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const scenario = require('./scenario.js');

const WORK = process.argv[2] || path.join(__dirname, 'work');
const BASE = process.env.UGC_BASE_URL || 'http://127.0.0.1:8123';
const CHROMIUM = process.env.UGC_CHROMIUM || '/opt/pw-browsers/chromium';
const CAPTURE = process.env.UGC_CAPTURE || 'video';
const W = scenario.viewport.width * 2;
const H = scenario.viewport.height * 2;

const { chromium } = require(require.resolve('playwright', { paths: [WORK, __dirname] }));

(async () => {
  // 高解像度録画の要点: contextのdeviceScaleFactorエミュレーションでは録画が
  // CSSピクセル(540x960)のままになる(Playwrightのscreencastはviewportサイズで
  // フレームを取るため)。ブラウザ起動引数で物理解像度ごと2倍にすると、
  // レイアウトはCSS 540pxのまま実ピクセル1080x1920で扱える。
  let browser = null;
  let ctx;
  if (CAPTURE === 'x11') {
    // Xvfb画面いっぱいにキオスク表示し、画面そのものをffmpegで録る。
    // 通常のlaunch+newContextだと新規ウィンドウがキオスクにならずタブバーが映るため、
    // 最初のウィンドウをそのまま使えるpersistent contextで起動する
    ctx = await chromium.launchPersistentContext(path.join(WORK, 'rec', 'profile'), {
      executablePath: CHROMIUM,
      headless: false,
      viewport: null,
      hasTouch: true,
      locale: 'ja-JP',
      args: [
        '--force-device-scale-factor=2',
        '--window-position=0,0',
        `--window-size=${scenario.viewport.width},${scenario.viewport.height}`,
        '--kiosk',
        '--no-first-run',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
  } else {
    browser = await chromium.launch({
      executablePath: CHROMIUM,
      headless: true,
      args: ['--force-device-scale-factor=2'],
    });
    ctx = await browser.newContext({
      viewport: scenario.viewport,
      hasTouch: true,
      recordVideo: { dir: path.join(WORK, 'rec'), size: { width: W, height: H } },
      locale: 'ja-JP',
    });
  }

  // 外部リクエスト遮断(フォントCDN等でのハング防止)
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());

  const page = CAPTURE === 'x11' ? (ctx.pages()[0] || await ctx.newPage()) : await ctx.newPage();

  // テロップ・タップリップル・エンドカードの基盤を注入
  await ctx.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
        /* 録画中は画面遷移のフェードを止める(設問の速送りで白フレームが出ないように) */
        .app.enter .screen{animation:none !important}
        /* 録画にスクロールバーを写さない */
        html{scrollbar-width:none}
        ::-webkit-scrollbar{width:0;height:0}
        .vv-ripple{position:fixed;width:64px;height:64px;border-radius:50%;
          background:rgba(22,35,62,.30);border:2px solid rgba(22,35,62,.55);
          transform:translate(-50%,-50%) scale(.4);pointer-events:none;z-index:99998;
          animation:vvrip .5s ease-out forwards}
        @keyframes vvrip{to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}
        #vv-cap{position:fixed;left:50%;bottom:18%;transform:translateX(-50%);
          width:max-content;max-width:80%;padding:10px 20px;border-radius:10px;z-index:99997;
          background:rgba(27,27,30,.85);color:#fff;font-family:'Noto Sans JP',sans-serif;
          font-weight:700;font-size:22px;line-height:1.55;text-align:center;
          white-space:pre-line;opacity:0;transition:opacity .35s}
        #vv-cap.vv-cap-hero{bottom:auto;top:30%;font-size:28px;line-height:1.7;
          padding:14px 28px}
        #vv-end{position:fixed;inset:0;z-index:99999;display:flex;
          align-items:center;justify-content:center;background:#F7F4EE;
          font-family:'Noto Sans JP',sans-serif;opacity:0;transition:opacity .6s}
        #vv-end .in{display:flex;flex-direction:column;align-items:center;gap:14px;
          animation:vvbreath 6s ease-out forwards}
        @keyframes vvbreath{from{transform:scale(1)}to{transform:scale(1.03)}}
        #vv-end .t1{font-size:30px;font-weight:900;color:#1e1e1e;letter-spacing:.04em}
        #vv-end .t2{font-size:17px;font-weight:500;color:#555}
        #vv-end .t2b{display:flex;align-items:center;gap:11px;margin-top:24px;
          border:1.5px solid #c9c2b4;border-radius:12px;padding:13px 24px;background:#fff;
          font-size:17px;font-weight:700;color:#1e1e1e}
        #vv-end .mag{width:14px;height:14px;border:2.5px solid #6b6b6b;border-radius:50%;
          position:relative;flex:none}
        #vv-end .mag::after{content:'';position:absolute;width:8px;height:2.5px;
          background:#6b6b6b;right:-7px;bottom:-2px;transform:rotate(45deg);border-radius:2px}
        #vv-end .t3{margin-top:20px;font-size:12px;font-weight:700;color:#1e1e1e;
          border:1.5px solid #A98F63;border-radius:999px;padding:7px 20px;letter-spacing:.18em}
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
        // タップした選択肢に藍の縁取りを一瞬出す(「選んだ」の応答)
        const el = e.target && e.target.closest && e.target.closest('.choice');
        if (el) {
          el.style.boxShadow = '0 0 0 3px rgba(22,35,62,.55)';
          setTimeout(() => { el.style.boxShadow = ''; }, 280);
        }
      }, true);
    });
  });

  // x11キャプチャはページ遷移の直前に開始する
  let ff = null;
  let ffStart = 0;
  if (CAPTURE === 'x11') {
    fs.mkdirSync(path.join(WORK, 'rec'), { recursive: true });
    ff = spawn('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'x11grab', '-framerate', '30', '-video_size', `${W}x${H}`,
      '-draw_mouse', '0', '-i', process.env.DISPLAY,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0',
      path.join(WORK, 'rec', 'capture.mp4'),
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    await new Promise((r) => setTimeout(r, 500)); // 取り込み開始を待つ
    ffStart = Date.now();
  }

  await page.goto(BASE + scenario.page, { waitUntil: 'domcontentloaded' });

  const t0 = Date.now();
  if (ff) {
    // キャプチャ開始〜タイムライン0秒のずれを記録し、mix側で頭を切り落とす
    fs.writeFileSync(path.join(WORK, 'rec', 'lead.txt'),
      ((t0 - ffStart) / 1000).toFixed(3));
  }
  const until = (sec) => new Promise((res) => {
    setTimeout(res, Math.max(0, t0 + sec * 1000 - Date.now()));
  });
  const cap = (i) => page.evaluate(({ t, hero }) => {
    const c = document.getElementById('vv-cap');
    if (!t) { c.style.opacity = '0'; return; }
    c.textContent = t;
    c.classList.toggle('vv-cap-hero', hero);
    c.style.opacity = '1';
  }, { t: scenario.captions[i] || '', hero: i === (scenario.heroCap ?? -1) });

  await scenario.run(page, { until, cap, T: scenario.T });

  // エンドカード
  await until(scenario.T.seg4);
  await cap(-1);
  await page.evaluate((e) => {
    const end = document.createElement('div');
    end.id = 'vv-end';
    end.innerHTML = `
      <div class="in">
        <div class="t1">${e.title}</div>
        <div class="t2">${e.sub}</div>
        ${e.search ? `<div class="t2b"><span class="mag"></span>${e.search}</div>` : ''}
        <div class="t3">${e.badge}</div>
      </div>`;
    document.body.appendChild(end);
    requestAnimationFrame(() => { end.style.opacity = '1'; });
  }, scenario.endCard);

  await until(scenario.T.end);
  if (ff) {
    ff.stdin.write('q'); // ffmpegを正常終了させてmoovを書かせる
    await new Promise((r) => ff.on('close', r));
  }
  await ctx.close();
  if (browser) await browser.close();
  console.log('recorded ok');
})().catch((e) => { console.error(e); process.exit(1); });
