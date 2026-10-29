// 舞台の回帰検査: 指のスクロール(CDP の dispatchTouchEvent)で病院の中まで進め、病院の壁が倒れて中が見えているか(立体の状態で)を確かめる。
// 2026-10-29 の不具合(戻ってきたときのハッシュ #town/<建物> の restore と舞台が重なり、壁が倒れず町が霞んだまま)を、ハッシュつきの読み込みでも確かめる。
// PW=<playwright> BASE=http://localhost:8097/ node town/tools/check-stage.mjs   (終了コード 0=合格)
const { chromium } = await import(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://localhost:8097/';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
for (const tod of ['day', 'night']) for (const hash of ['', '#town/office', '#town/hospital/keiji']) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 724 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.route(/gc\.zgo\.at|goatcounter/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${BASE}index.html?tod=${tod}&nudge=0&clock=manual${hash}`, { waitUntil: 'load' });   // 手で進める時計: この環境(ソフトウェアの描画)の遅さで低性能の止めた画像に替わらないように。こまは下で進める
  await p.waitForFunction(() => window.__ctl, null, { timeout: 120000, polling: 10 });   // 立体に替わった直後(戻ってきたときの restore の途中)から指で進める
  const cdp = await ctx.newCDPSession(p);
  const ty = await p.evaluate(() => { const st = document.getElementById('stage'), hero = document.getElementById('top'), span = st.offsetHeight - hero.offsetHeight; return Math.round(st.offsetTop + .75 / 1.5 / 1.48167 * span); });   // 病院ぜんたい(3F の手前)
  for (let k = 0; k < 30; k++) {
    const y = await p.evaluate(() => scrollY); if (y >= ty - 8) break;
    const dy = Math.min(260, ty - y + 20), x = 200, y0 = 320;   // 島の上(ひらいたシートの上)を指で払う
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - dy * i / 10 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200); await p.evaluate(() => { for (let i = 0; i < 4; i++) window.__ctl.advance(50); });
  }
  const reached = await p.evaluate(() => Math.round(scrollY));
  let st = null;
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(250); st = await p.evaluate(() => { for (let k = 0; k < 6; k++) window.__ctl.advance(50); return 0; }) || await p.evaluate(() => ({ ...window.__ctl.stageState, still: document.documentElement.classList.contains('stage-still') })); if (st.still || (st.wall > .95 && st.gate > .95)) break; }
  const ok = st.still || (st.scrub && st.id === 'hospital' && st.openA === st.hospitalBid && st.wall > .95 && st.gate > .95);
  if (!ok || errs.length) fail++;
  console.log(`${ok && !errs.length ? 'OK ' : 'NG '} ${tod} ${hash || '(ハッシュなし)'} 目標 y${ty} 届いた y${reached} 枠 ${st.id} 壁 ${st.wall.toFixed(2)} 中 ${st.gate.toFixed(2)} ひらく建物 ${st.openA}/${st.hospitalBid}${st.still ? ' (低性能の止めた画像に替わった)' : ''} ${errs.join(' | ')}`);
  await ctx.close();
}
await b.close();
process.exit(fail ? 1 : 0);
