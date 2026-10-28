// 下見: Compass と クリニックタウン3D の画面の位置を測り、確認用のスクリーンショットを撮る(素材には使わない)
import { serve, launch, context, settle, sleep } from '../../../../film/choice/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.PROBE_OUT || '/tmp/probe';
mkdirSync(OUT, { recursive: true });
const which = process.argv[2] || 'compass';
const vw = +(process.argv[3] || 390), vh = +(process.argv[4] || 844);
const { server, base } = await serve();
const browser = await launch(which === 'town');
const c = await context(browser, 'light', { w: vw, h: vh, dpr: 1 });
const page = await c.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
const shot = async name => { await page.screenshot({ path: path.join(OUT, `${which}-${vw}-${name}.png`) }); console.log('shot', name); };

if (which === 'compass') {
  const { compassTo, PICKS } = await import('./drive.mjs');
  await page.goto(base + '/compass/', { waitUntil: 'networkidle' });
  await settle(page, 800);
  await compassTo(page, '1日だけ、別の仕事を完全に体験できるなら', PICKS);
  await sleep(800); await shot('q8');
  console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.cp-screen:last-of-type .cp-opt')].map(o => { const r = o.getBoundingClientRect(); return [o.textContent.trim().slice(0, 20), Math.round(r.y), Math.round(r.height)]; }))));
  await page.evaluate(() => document.querySelectorAll('.cp-screen:last-of-type .cp-opt')[4].click());
  await sleep(250); await shot('q8-picked');
  await sleep(900); await shot('q9');
  await compassTo(page, 'もし失敗しないとしたら', PICKS, { noStart: true });
  await sleep(800); await shot('q10');
  await page.evaluate(() => { const s = document.querySelector('.cp-screen:last-of-type .cp-skip') || document.querySelector('.cp-screen:last-of-type .cp-next'); s.click(); });
  await sleep(700); await shot('translating');
  await sleep(1500); await shot('result-0');
  await sleep(3000); await shot('result-3');
  console.log(JSON.stringify(await page.evaluate(() => { const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]; }; return { scrollY, map: b('.cp-map'), list: b('.cp-map-list'), origin: b('.ln-origin'), head: b('.cp-r-h'), hero: b('.cp-r-hero'), trans: b('.cp-trans-t') }; })));
} else {
  await page.goto(base + '/clinic-flow-3d/', { waitUntil: 'networkidle' });
  await settle(page, 2500);
  await shot('open');
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { const g = document.getElementById('gateGo'); if (g && g.offsetParent) g.click(); }); await sleep(800); }
  await shot('after-gate');
  const days = +(process.argv[5] || 0);
  for (let d = 0; d < days; d++) {
    await page.evaluate(() => { const b = document.querySelector('#modal.show button'); if (b) b.click(); const g = document.getElementById('decisionGate'); if (g && g.classList.contains('show')) { const c = g.querySelector('.dec-choice'); if (c) c.click(); const ok = g.querySelector('.dec-go, .btn-cta, button[data-act]'); if (ok) ok.click(); } });
    await sleep(400);
    await page.evaluate(() => document.getElementById('skipBtn').click());
    await sleep(1600);
  }
  await shot('day');
  console.log(JSON.stringify(await page.evaluate(() => { const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height), !!e.offsetParent]; }; return { sch: b('#scheduleCard'), kpi: b('#kpiStrip'), pulse: b('#pulseCard'), top: b('.top, header, #hud'), dec: b('#decisionGate'), modal: b('#modal.show'), kpiText: document.getElementById('kpiStrip')?.innerText.slice(0, 300), hud: document.body.innerText.slice(0, 400) }; })));
}
await c.close(); await browser.close(); server.close();
