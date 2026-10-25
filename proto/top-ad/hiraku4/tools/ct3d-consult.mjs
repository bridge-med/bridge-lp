// Capture the Day 6 consultation (SL-01 / 岡部) of Clinic Town 3D through the real UI.
//
// Flow per attempt (fresh browser context each time, nothing edited, no state injected):
//   1. open the game, click the start gate's default button ("整形外科を引き継ぐ", lane "まず動かす")
//   2. Day 1-3: press the header's "1日" button, closing each result modal with its own button
//   3. Day 4 begins with the "打ち手が解放されました" modal. LEAVE IT OPEN and let Day 4 play out at the
//      default x2 speed. Because a modal is on screen when Day 4 closes, the game defers the consultation
//      by a day (decisionAfterDay: modalOpen() guard).
//   4. Day 5: close the modal with its button, press "1日".
//   5. Day 6 opens with the consultation. If it is not SL-01 (岡部), discard and retry with a new context
//      (the case is chosen from a seed derived from the page-load time).
//   6. Wait for banner/toast to fade, then screenshot (PNG, lossless) without touching the dialog.
//
// usage: node capture.mjs <pc|sp> <maxAttempts> <concurrency>
const { chromium } = await import(process.env.PW || 'playwright');   // PW: playwright の場所
import fs from 'node:fs';

const URL = 'http://localhost:8097/clinic-flow-3d/index.html';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const OUT = process.env.OUT || '.';   // 撮った PNG(<mode>-raw.png)と記録の置き場
const WANT_TITLE = '退院後の受け入れ相談を増やせそう';
const WANT_WHO = '市民総合病院 地域連携室 岡部からの相談';

const MODE = process.argv[2] || 'pc';
const MAX_ATTEMPTS = Number(process.argv[3] || 8);
const CONC = Number(process.argv[4] || 3);

const PROFILES = {
  pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  pc3: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3 },
  sp: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

const state = (page) => page.evaluate(() => ({
  day: window.GAME.G.day,
  t: Math.round(window.GAME.G.t),
  speed: window.GAME.G.speed,
  dec: document.getElementById('decisionGate').classList.contains('show'),
  modal: document.getElementById('modal').classList.contains('show'),
  modalTitle: document.getElementById('modalTitle').textContent,
}));

async function press(page, sel) {
  const loc = page.locator(sel);
  if (MODE === 'sp') await loc.tap(); else await loc.click();
}

async function attempt(browser, id) {
  const prof = PROFILES[MODE];
  const ctx = await browser.newContext(prof);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url() + ' ' + (r.failure() && r.failure().errorText)));
  const log = (...a) => console.log(`[${stamp()}][${MODE}#${id}]`, ...a);
  try {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('#startGate.show', { timeout: 20000 });
    await press(page, '#gateGo');
    await page.waitForSelector('#startGate.show', { state: 'hidden', timeout: 5000 });

    // Day 1-3 with the "1日" button
    for (let k = 0; k < 3; k++) {
      let s = await state(page);
      if (s.modal) { await press(page, '#modalBtn'); await sleep(300); }
      const d0 = s.day;
      await press(page, '#skipBtn');
      await page.waitForFunction((d) => window.GAME.G.day > d, d0, { timeout: 20000 });
      await sleep(350);
    }
    let s = await state(page);
    log('after Day1-3:', JSON.stringify(s));
    if (s.day !== 4 || !s.modal || s.dec) throw new Error('unexpected state at Day 4 start: ' + JSON.stringify(s));
    // leave the Day 4 modal open; Day 4 runs at x2 in real time
    log('Day 4 running in real time with modal open:', s.modalTitle);
    await page.waitForFunction(() => window.GAME.G.day >= 5, null, { timeout: 400000, polling: 1000 });
    await sleep(500);
    s = await state(page);
    log('Day 4 closed:', JSON.stringify(s));
    if (s.dec) throw new Error('consultation opened on Day 5 even though a modal was open');
    if (s.day !== 5) throw new Error('unexpected day ' + s.day);
    if (s.modal) { await press(page, '#modalBtn'); await sleep(400); }
    await press(page, '#skipBtn');
    await page.waitForFunction(() => window.GAME.G.day >= 6, null, { timeout: 20000 });
    await sleep(800);
    s = await state(page);
    if (!s.dec) { log('no consultation at Day 6:', JSON.stringify(s)); throw new Error('NO_CONSULT'); }
    const info = await page.evaluate(() => ({
      day: window.GAME.G.day,
      who: document.getElementById('decWho').textContent,
      title: document.getElementById('decTitle').textContent,
      step: document.getElementById('decStep').textContent,
      seed: window.GAME.G.dec && window.GAME.G.dec.seed,
    }));
    log('Day 6 consultation:', JSON.stringify(info));
    const extra = await page.evaluate(() => {
      const G = window.GAME.G, s = window.GAME.settings;
      const open7 = G.history.filter((h) => h.kind !== 'closed').slice(-7);
      const avg = (k) => (open7.length ? open7.reduce((a, h) => a + (h[k] || 0), 0) / open7.length : 0);
      const examCap = Math.max(10, s.doctors * (480 / (s.examMean + 1.5)) * 0.72);
      return { patients: open7.map((h) => h.patients), newCount: open7.map((h) => h.newCount),
        load: Math.round(Math.min(1.2, Math.round(avg('patients')) / examCap) * 100) / 100, money: Math.round(G.money), rep: G.rep, aw: G.aw, pickDraw: G.dec && G.dec.nextDay };
    });
    log('state:', JSON.stringify(extra));
    if (info.title !== WANT_TITLE || info.who !== WANT_WHO || info.day !== 6) { await ctx.close(); return { ok: false, info }; }
    return { ok: true, info, ctx, page, errs, log };
  } catch (e) {
    log('attempt failed:', e.message);
    await ctx.close().catch(() => {});
    return { ok: false, err: e.message };
  }
}

async function finalize(res) {
  const { page, ctx, errs, log, info } = res;
  // let banner/toast/animations settle (banner 5s, toast 3.2s, dialog rise 0.35s)
  await sleep(7000);
  const pre = await page.evaluate(() => {
    const box = document.querySelector('#decisionGate .dec-box');
    const r = box.getBoundingClientRect();
    const go = document.getElementById('decGo').getBoundingClientRect();
    const fontsOk = {
      zen: document.fonts.check('16px "Zen Kaku Gothic New"'),
      mono: document.fonts.check('16px "Roboto Mono"'),
    };
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight);
    return {
      vw: innerWidth, vh: innerHeight,
      box: { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom },
      boxScrollTop: box.scrollTop, boxScrollH: box.scrollHeight, boxClientH: box.clientHeight,
      go: { y: go.y, bottom: go.bottom, h: go.height },
      bannerShown: document.getElementById('banner').classList.contains('show'),
      toastShown: document.getElementById('toast').classList.contains('show'),
      modalShown: document.getElementById('modal').classList.contains('show'),
      fontsOk, loaded,
      decGoDisabled: document.getElementById('decGo').disabled,
      picked: document.querySelectorAll('.dec-choice.on').length,
      body: document.getElementById('decBody').innerText,
      hud: document.querySelector('.hud') ? document.querySelector('.hud').innerText.replace(/\s+/g, ' ') : '',
      money: document.getElementById('hMoney').textContent,
    };
  });
  log('pre-shot check:', JSON.stringify({ ...pre, body: undefined }));
  if (pre.bannerShown || pre.toastShown || pre.modalShown) log('WARNING: banner/toast/modal still shown');
  const file = `${OUT}/${MODE}-raw.png`;
  await page.screenshot({ path: file, type: 'png' });
  fs.writeFileSync(`${OUT}/${MODE}-meta.json`, JSON.stringify({ info, pre, errs, when: new Date().toISOString() }, null, 1));
  log('saved', file, 'errors:', JSON.stringify(errs));
  await ctx.close();
}

const browser = await chromium.launch({ args: ARGS });
let done = false; let started = 0; const tally = {};
async function worker(w) {
  while (!done && started < MAX_ATTEMPTS) {
    const id = ++started;
    const res = await attempt(browser, id);
    if (res.info) { const k = res.info.title; tally[k] = (tally[k] || 0) + 1; }
    if (res.ok && !done) { done = true; await finalize(res); }
    else if (res.ok) { await res.ctx.close(); }
  }
}
await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i)));
console.log('tally of Day-6 consultations seen:', JSON.stringify(tally));
console.log(done ? 'SUCCESS' : 'NOT FOUND within attempts');
await browser.close();
