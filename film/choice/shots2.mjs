// P3 shot list. Every frame is a live, real page of this repo (captured at scale), except the signature card (S7).
import { sleep } from './lib.mjs';
import { ease, seg, lerp, clamp, zoomCam, placeCam, FPS } from './engine.mjs';

const W = 1920, H = 1080, C = [W / 2, H / 2];
const bbc = b => [b.x + b.width / 2, b.y + b.height / 2];
async function box(page, sel, i = 0) {
  return page.evaluate(([sel, i]) => { const e = document.querySelectorAll(sel)[i < 0 ? document.querySelectorAll(sel).length + i : i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; }, [sel, i]);
}
const jsClick = (sel, i = 0) => page => page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i].click(), [sel, i]);
const F = s => s * FPS;                       // seconds -> frames
const sub = (ranges, n = 10) => f => ranges.some(([a, b]) => f >= a && f < b) ? n : 1;

/* ---------- Compass driver (answers with the product's own options) ---------- */
async function compassTo(page, needle, picks) {
  await page.waitForSelector('#cpStart:not([disabled])');
  await page.click('#cpStart');
  for (let g = 0; g < 30; g++) {
    await sleep(700);
    const cur = await page.evaluate(() => { const s = [...document.querySelectorAll('.cp-screen')].pop(); return s ? { step: s.dataset.step, text: s.textContent.replace(/​/g, '') } : null; });
    if (!cur) continue;
    if (needle && cur.text.includes(needle)) return;
    if (cur.step === 'result') return;
    if (cur.step === 'translating') continue;
    const opts = await page.$$('.cp-screen:last-of-type .cp-opt');
    const want = picks[cur.step];
    if (opts.length && want !== undefined) {
      const arr = Array.isArray(want) ? want : [want];
      for (const w of arr) { await page.evaluate(i => { const o = document.querySelectorAll('.cp-screen:last-of-type .cp-opt'); o[i < 0 ? o.length + i : i].click(); }, w); await sleep(250); }
      if (Array.isArray(want)) await page.evaluate(() => document.querySelector('.cp-screen:last-of-type .cp-next').click());
    } else {
      await page.evaluate(() => { const s = document.querySelector('.cp-screen:last-of-type .cp-skip') || document.querySelector('.cp-screen:last-of-type .cp-next'); s.click(); });
    }
  }
}
// PT / 周囲を巻き込んで解決する / 人に教えること / 誰かが成長した / ... (自由記述は空欄のまま「あとで」)
const PICKS = { profession: 0, q1: 2, q2: 2, q3: 2, q4: [0, 3], q5: [-1], q6: 1, q7: [4, 3], q8: 1 };

/* ---------- S1 BRIDGE Compass: the first choice (dark) 0.0-2.8 ---------- */
export const S1 = {
  id: 's1', url: '/compass/', theme: 'dark', frames: 70,   // v2: 4 frames of the end hold go to the signature
  prep: page => compassTo(page, '周りから一番頼られるのは', PICKS),
  anchors: async page => ({ mark: bbc(await box(page, '.cp-screen:last-of-type .cp-opt .cp-mark', 2)), opt: await box(page, '.cp-screen:last-of-type .cp-opt', 2), q: await box(page, '.cp-screen:last-of-type .cp-q-h') }),
  actions: [{ f: 10, run: jsClick('.cp-screen:last-of-type .cp-opt', 2) }],
  js: f => false,                                   // hold the app's own "advance after choosing" (time-remap: the moment is held)
  sub: sub([[28, 60]], 12),
  cam: (t, A) => {
    // v2 start: the whole option (circle + 人に教えること) at 9x, the neighbouring options' edges above and below -> reads as a choice list
    const s0 = 9, oc = [A.opt.x + 100, A.opt.y + A.opt.height / 2];
    const Astart = [W / 2 + (A.mark[0] - oc[0]) * s0, H / 2 + (A.mark[1] - oc[1]) * s0];
    const endS = 3.3;
    const qx = A.q.x, qy = A.q.y + A.q.height / 2;
    const B = [W / 2 + (A.mark[0] - (qx + 250)) * endS, H / 2 + (A.mark[1] - (qy + A.mark[1]) / 2) * endS];
    return zoomCam(A.mark, Astart, B, s0, endS)(ease.inOutCubic(seg(t, 28 / FPS, 60 / FPS)));
  },
};

/* ---------- S2 経験の棚卸し: typing an experience (dark) ---------- */
const TANA_Q = 8;   // 後輩指導・教育: 相手に合わせて、教え方を変えてみた場面はありますか
let TANA_TEXT = null;
export const S2 = {
  id: 's2', url: '/tanaoroshi/', theme: 'dark', frames: 68,
  prep: async page => {
    await page.click('#intro-start');
    await page.waitForSelector('#role-list .role-item');
    await page.click('#role-list .role-item[data-role="reha"]');
    await page.waitForSelector('#view-quest.on');
    for (let i = 0; i < TANA_Q; i++) { await page.click('#quest-next'); await sleep(250); }
    // 入力例: 同じ問いの看護師向けヒント(data.js QUESTIONS[8].hint.nurse)から「例えば、」を外した文(capture.mjs と同じ。作文しない)
    TANA_TEXT = (await page.evaluate(q => QUESTIONS[q].hint.nurse, TANA_Q)).replace(/^例えば、/, '');
    await page.click('#f-action');
    await page.evaluate(() => window.scrollTo(0, 0));
  },
  anchors: async page => {
    const ta = await box(page, '#f-action');
    // prefix widths measured off-DOM-flow on a detached clone of the textarea's font (removed before filming)
    const widths = await page.evaluate(text => {
      const ta = document.getElementById('f-action'); const cs = getComputedStyle(ta);
      const sp = document.createElement('span'); sp.style.cssText = `position:absolute;left:-9999px;top:0;white-space:pre;font:${cs.font};letter-spacing:${cs.letterSpacing};font-feature-settings:${cs.fontFeatureSettings};font-kerning:${cs.fontKerning}`;
      document.body.appendChild(sp); const out = [];
      for (let i = 0; i <= text.length; i++) { sp.textContent = text.slice(0, i); out.push(sp.getBoundingClientRect().width); }
      sp.remove(); return { out, pl: parseFloat(cs.paddingLeft), pt: parseFloat(cs.paddingTop), lh: parseFloat(cs.lineHeight) };
    }, TANA_TEXT);
    const q = await box(page, '#view-quest h2, #view-quest .q-title, #view-quest .quest-q', 0);
    // IME-like commits: Japanese input appears phrase by phrase (the product's example text, split at word boundaries)
    const chunks = ['萎縮', 'しがちな', '後輩に、', 'まず', '良かった', '点を', '伝えてから', '助言した'];
    if (chunks.join('') !== TANA_TEXT) throw new Error('example text changed: ' + TANA_TEXT);
    const times = []; let tt = 0.0, n = 0; const gaps = [0.2, 0.25, 0.3, 0.2, 0.24, 0.2, 0.28, 0.2];
    for (let i = 0; i < chunks.length; i++) { n += chunks[i].length; times.push([tt, n]); tt += gaps[i]; }
    return { ta, w: widths.out, pl: widths.pl, pt: widths.pt, lh: widths.lh, q, times, text: TANA_TEXT };
  },
  actions: [],
  onFrame: async (page, t, A) => {
    const n = A.times.filter(x => x[0] <= t).reduce((m, x) => Math.max(m, x[1]), 0);
    await page.evaluate(n => { const ta = document.getElementById('f-action'); const want = window.__TT.slice(0, n); if (ta.value !== want) { ta.value = want; ta.dispatchEvent(new Event('input', { bubbles: true })); } ta.setSelectionRange(0, 0); ta.setSelectionRange(n, n); }, n);   // re-placing the caret restarts its blink, so it stays solid while typing (as in any editor)
  },
  js: f => true,
  sub: sub([[55, 67]]),
  cam: (t, A) => {
    // the camera glides at a steady pace over the whole sentence; commits land around the reading point
    const cx = lerp(A.w[0] + 60, A.w[A.w.length - 1], ease.inOutSine(seg(t, 0.0, 1.75)));
    const caret = [A.ta.x + A.pl + cx, A.ta.y + A.pt + A.lh / 2];
    const s0 = 7.5;
    const pull = ease.inOutCubic(seg(t, 55 / FPS, 66 / FPS));
    if (pull <= 0) return placeCam(caret, [W * 0.56, H * 0.5], s0);
    const endS = 2.6;
    const tgt = [A.ta.x + A.ta.width * 0.5, (A.q ? A.q.y : A.ta.y - 120) + 120];
    const a = placeCam(caret, [W * 0.56, H * 0.5], s0), b = placeCam(tgt, C, endS);
    const s = Math.exp(lerp(Math.log(s0), Math.log(endS), pull));
    // keep the caret's screen motion natural: interpolate the screen position of the caret
    const cs = [W * 0.56, H * 0.5], ce = [W / 2 + (caret[0] - b.cx) * endS, H / 2 + (caret[1] - b.cy) * endS];
    const sp = [lerp(cs[0], ce[0], pull), lerp(cs[1], ce[1], pull)];
    return placeCam(caret, sp, s);
  },
};
S2.prepAfter = async page => page.evaluate(t => { window.__TT = t; }, TANA_TEXT);

/* ---------- S2B 経験の棚卸し: the sentence just typed, now kept as a material (dark) ----------
   Same state as S2 (the product's example sentence in やったこと), then the product's own 「ここまでの材料を見る →」:
   the materials view rises (the product's .45 s entrance) with the sentence in its list. */
export const S2B = {
  id: 's2b', url: '/tanaoroshi/', theme: 'dark', frames: 20, shift: 0.1,
  prep: async page => {
    await S2.prep(page);
    await page.evaluate(t => { const ta = document.getElementById('f-action'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.blur(); }, TANA_TEXT);
    await sleep(700);
  },
  anchors: async page => ({}),
  actions: [{ f: 0, run: async (page, A) => {
    await page.evaluate(() => document.getElementById('quest-to-materials').click());
    await page.evaluate(() => { window.scrollTo(0, 0); __VT.syncAnim(0); });
    A.row = await box(page, '#mat-list .mat-row'); A.a = await box(page, '#mat-list .mat-row .a');
  } }],
  js: f => true,
  cam: (t, A) => placeCam([A.a.x + 205, A.row.y + A.row.height / 2 - 6], C, Math.exp(lerp(Math.log(3.7), Math.log(4.2), ease.outCubic(seg(t, 0.1, 0.75))))),   // settles onto the kept sentence
};

/* ---------- S3 現場のことば 言いかえ帳: read the reframe (dark). v2: no star, no push onto a lone icon ---------- */
export const S3 = {
  id: 's3', url: '/iikae/', theme: 'dark', frames: 42,
  prep: async page => {
    await page.click('#intro-start');
    await page.waitForSelector('#view-list.on');
    await page.click('#chips-cat .chip[data-cat="team"]'); await sleep(400);
    await page.evaluate(() => { const r = [...document.querySelectorAll('.word-row')].find(r => r.dataset.key === '板挟みになってた'); r.scrollIntoView({ block: 'center' }); });
    await sleep(300);
  },
  anchors: async page => {
    const i = await page.evaluate(() => [...document.querySelectorAll('.word-row')].findIndex(r => r.dataset.key === '板挟みになってた'));
    return { i, genba: await box(page, '.word-row .genba', i), kotoba: await box(page, '.word-row .kotoba', i) };
  },
  js: f => true,
  cam: (t, A) => {
    const s = 8, y = A.genba.y + A.genba.height / 2;
    const x0 = A.genba.x + 105, x1 = A.kotoba.x + A.kotoba.width - 110;
    return placeCam([lerp(x0, x1, ease.inOutSine(seg(t, 0, 1.15))), y], C, s);
  },
};

/* ---------- S4 掲示じたく: choose a notice, the A4 (tight), then the product's own light/dark switch, pressed on screen ----------
   Tall viewport and scroll 0, so the switch (top right of the bar) and the paper are both on the layout at once. */
export const S4 = {
  id: 's4', url: '/keiji/', theme: 'dark', frames: 68, vh: 1200,
  prep: async page => { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300); },
  anchors: async page => ({ card: await box(page, '.type-card', 0), title: await box(page, '.type-card .type-name', 0), btn: await box(page, '#themeBtn') }),
  actions: [{
    f: 12, run: async (page, A) => {
      await page.evaluate(() => document.querySelector('.type-card').click());
      await page.evaluate(date => {
        for (const el of document.querySelectorAll('#form-fields [data-key]')) {
          if (el.type === 'date') { if (el.dataset.key === 'date') el.value = date; }
          else if (el.tagName === 'INPUT' && !el.value) { const ph = el.getAttribute('placeholder') || ''; if (/^例[:：]/.test(ph)) el.value = ph.replace(/^例[:：]\s*/, ''); }
          el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        document.querySelector('#form-el [type=submit]').click();
      }, '2026-10-16');
      await page.evaluate(() => window.scrollTo(0, 0));
      A.pt = await box(page, '.poster-title'); A.big = await box(page, '.poster-big'); A.poster = await box(page, '#poster'); A.btn = await box(page, '#themeBtn');
    }
  },
  // the pointer comes onto the switch (its own hover), presses it, and leaves
  { f: 33, run: async (page, A) => { const b = bbc(A.btn); await page.mouse.move(b[0], b[1]); } },
  { f: 36, run: async (page, A) => { await page.mouse.down(); await page.mouse.up(); } },
  { f: 45, run: async page => page.mouse.move(1, 1199) }],
  js: f => true,
  cam: (t, A) => {
    if (t < 12 / FPS) { const c = A.title ? bbc(A.title) : [A.card.x + 120, A.card.y + A.card.height / 2]; return placeCam([A.card.x + 30, c[1]], [W * 0.30, H / 2], 5.0); }
    // the notice itself: title + the first body line, with a strip of the room on both sides.
    // 2026-10-03 (designer, 第13条): the date is chosen by the shooter, not the product, so the date box stays out of frame
    // (frame bottom 20 CSS px above where it is measured; the paper is still rising then, so the margin is generous); same 3x, same timing
    const nS = 3.0, nc = [A.pt.x + A.pt.width / 2, A.big.y - 20 - H / 2 / nS];
    if (t < 31 / FPS) return placeCam(nc, C, nS);
    // the switch, close: the room around it goes from night to day when it is pressed (the product's own .5 s transition);
    // then a cut back to the same framing of the notice, now in the light room (hard cut, like every other cut in the film)
    if (t < 52 / FPS) return placeCam(bbc(A.btn), [W / 2, H * 0.56], 7.0);
    return placeCam(nc, C, nS);
  },
};

/* ---------- S5 クリニックタウン3D: an organisation decides (game) ---------- */
export const S5 = {
  id: 's5', url: '/clinic-flow-3d/', theme: 'light', frames: 42, settleMs: 2500, gl: true,
  prep: async page => {
    for (let i = 0; i < 3; i++) { await page.evaluate(() => { const g = document.getElementById('gateGo'); if (g && g.offsetParent) g.click(); }); await sleep(800); }
    for (let d = 0; d < 20; d++) {
      const dec = await page.evaluate(() => document.getElementById('decisionGate')?.classList.contains('show'));
      if (dec) break;
      await page.evaluate(() => { const b = document.querySelector('#modal.show button'); if (b) b.click(); });
      await sleep(400);
      await page.evaluate(() => document.getElementById('skipBtn').click());
      await sleep(1600);
    }
    await sleep(800);
  },
  anchors: async page => ({ ch: await box(page, '#decisionGate .dec-choice', 1), sc: await page.evaluate(() => [scrollX, scrollY]) }),
  actions: [{ f: 14, run: async (page, A) => { await page.evaluate(() => document.querySelectorAll('#decisionGate .dec-choice')[1].click()); A.ch2 = await box(page, '#decisionGate .dec-choice.on'); A.ask = await box(page, '#decisionGate .dec-ask'); } }],
  js: f => false,
  sub: sub([[18, 33]]),
  cam: (t, A) => {
    const ch = (t >= 14 / FPS && A.ch2) ? A.ch2 : A.ch;
    const c = [ch.x + 24, ch.y + ch.height / 2];
    // 2026-10-03: pull 20-39 -> 18-32 so the end frame (the options, their numbers and the product's own label
    // 「数値はゲーム上の仮定」 under them) holds 10 frames instead of 3. Duration unchanged (42 frames)
    const pull = ease.inOutCubic(seg(t, 18 / FPS, 32 / FPS));
    // end: the decision itself (the ask + the three options), not the whole game screen
    const endS = 2.3, mid = [A.ask ? A.ask.x + A.ask.width / 2 : c[0] + 200, (A.ask ? A.ask.y : c[1] - 120) + 170];
    return zoomCam(c, [W * 0.36, H / 2], [W / 2 + (c[0] - mid[0]) * endS, H / 2 + (c[1] - mid[1]) * endS], 5.5, endS)(pull);
  },
};

/* ---------- M1-M5 staccato: the same moment of choosing, again and again, at the same point and size (light) ----------
   Each is a separate real page state. The click happens at virtual 0 and the first frame is 0.12 s into the product's own
   transition, so every flash already shows the choice landing. */
function mini({ id, url, prep, mark, click, frames, s, mouse = false }) {
  return {
    id, url, theme: 'light', frames, prep, shift: 0.12,
    anchors: async page => ({ m: bbc(await box(page, mark[0], mark[1])) }),
    actions: [{ f: 0, run: async (page, A) => {
      if (mouse) { const b = await page.evaluate(([sel, i]) => { const r = document.querySelectorAll(sel)[i].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, click); await page.mouse.click(b[0], b[1]); await page.mouse.move(1, 899); }
      else await page.evaluate(([sel, i]) => document.querySelectorAll(sel)[i].click(), click);
      await page.evaluate(() => __VT.syncAnim(0));
    } }],
    js: f => false,
    cam: (t, A) => placeCam(A.m, C, s),
  };
}
const OPT = '.cp-screen:last-of-type .cp-opt', MARK = '.cp-screen:last-of-type .cp-opt .cp-mark';
const iikaeTeam = async page => { await page.click('#intro-start'); await page.waitForSelector('#view-list.on'); await page.click('#chips-cat .chip[data-cat="team"]'); await sleep(400); await page.evaluate(() => window.scrollTo(0, 260)); await sleep(200); };
export const M1 = mini({ id: 'm1', url: '/compass/', prep: p => compassTo(p, '得意だし、嫌いじゃない', PICKS), mark: [MARK, 0], click: [OPT, 0], frames: 6, s: 26 });              // 人に教える
export const M2 = mini({ id: 'm2', url: '/iikae/', prep: iikaeTeam, mark: ['.word-row .word-star svg', 1], click: ['.word-row .word-star', 1], frames: 5, s: 38, mouse: true });   // 医者とリハの間に立ってた
export const M3 = mini({ id: 'm3', url: '/compass/', prep: p => compassTo(p, 'これから特に欲しいもの', PICKS), mark: [MARK, 4], click: [OPT, 4], frames: 4, s: 26 });              // 成長
export const M4 = mini({ id: 'm4', url: '/iikae/', prep: iikaeTeam, mark: ['.word-row .word-star svg', 2], click: ['.word-row .word-star', 2], frames: 4, s: 38, mouse: true });   // カンファで発言してた
export const M5 = mini({ id: 'm5', url: '/compass/', prep: p => compassTo(p, '一つだけ新しい役割を足せるなら', PICKS), mark: [MARK, 1], click: [OPT, 1], frames: 4, s: 26 });       // 人を育てる仕事

/* ---------- S6 BRIDGE Compass result (light): the map, then one dive into 現在地 ----------
   Opens on the map (現在地 and the three bridges with their names, readable), then a single accelerating push
   into the 現在地 point until its navy fills the frame (the last 2 frames), where the mark takes over (S7). */
export const S6_S0 = 4.2, S6_S1 = 400;
export const S6 = {
  id: 's6', url: '/compass/', theme: 'light', frames: 34,
  prep: async page => { await compassTo(page, null, PICKS); await sleep(13000); await page.evaluate(() => window.scrollTo(0, 0)); },
  anchors: async page => ({ map: await box(page, '.cp-map'), o: bbc(await box(page, '.cp-map-svg .ln-origin')), list: await box(page, '.cp-map-list') }),
  js: f => false,
  sub: sub([[16, 32]], 10),
  cam: (t, A) => {
    const cx0 = (A.o[0] - 60 + A.list.x + 262) / 2;
    const Astart = [W / 2 + (A.o[0] - cx0) * S6_S0, H / 2];
    const u = clamp(t / (33 / FPS));
    const zc = zoomCam(A.o, Astart, C, S6_S0, S6_S1);
    // log-scale progress u^3: a slow start (the map is read), then the dive
    const s = Math.exp(lerp(Math.log(S6_S0), Math.log(S6_S1), u * u * u));
    return zc((Math.log(s) - Math.log(S6_S0)) / (Math.log(S6_S1) - Math.log(S6_S0)));
  },
};

/* ---------- S7 signature (light): out of the navy arc, the sand line crosses, then BRIDGE / EXPAND CHOICES. ----------
   Starts inside the navy stroke a little before the crossing (solid navy, like the end of S6), pulls back
   (decelerating) to the full mark. No motion blur once the mark is recognisable. */
export const S7_S0 = 320;
export const S7 = {
  id: 's7', url: '/__p3/card/', theme: 'light', frames: 85, vw: 1440, vh: 810,
  prep: async page => { await page.evaluate(async () => { await document.fonts.ready;
    // v2 timing: BRIDGE 0.98-1.23 s, EXPAND CHOICES. 1.08-1.33 s after the card starts (fully on at 13.50 s; still to 15.00)
    window.setT = t => { const f = (a, b) => Math.max(0, Math.min(1, (t - a) / (b - a))); document.getElementById('wm').style.opacity = f(0.98, 1.23); document.getElementById('tg').style.opacity = f(1.08, 1.33); }; }); },
  anchors: async page => page.evaluate(() => {
    const bez = (P, t) => { const u = 1 - t; return [0, 1].map(k => u*u*u*P[0][k] + 3*u*u*t*P[1][k] + 3*u*t*t*P[2][k] + t*t*t*P[3][k]); };
    const N = [[8,74],[62,16],[118,24],[176,84]];
    const k = window.MARKBOX.w / 240;
    // walk back along the navy stroke ~7 units from the crossing (t = 0.745): the first card frames are solid navy (5 units was tried: the sand then shows through the dissolve as a muddy mix)
    let t = 0.745, prev = bez(N, t), d = 0;
    while (d < 7) { t -= 0.0005; const p = bez(N, t); d += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p; }
    return { cross: window.CROSS, mb: window.MARKBOX, p: [window.MARKBOX.x + prev[0] * k, window.MARKBOX.y + prev[1] * k] };
  }),
  onFrame: async (page, t) => page.evaluate(t => window.setT(t), t),
  js: f => true,
  sub: sub([[1, 10]], 10),
  cam: (t, A) => {
    const endS = 1.45;
    const B = [W / 2 + (A.p[0] - 720) * endS, H / 2 + (A.p[1] - 405) * endS];
    const u = clamp(t / (36 / FPS));
    const pr = 1 - Math.pow(1 - u, 2.6);
    return zoomCam(A.p, C, B, S7_S0, endS)(pr);
  },
};
