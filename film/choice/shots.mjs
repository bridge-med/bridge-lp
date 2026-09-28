// P3 shot list. Every frame is a live, real page of this repo (captured at scale), except the signature card (S7).
import { sleep } from './lib.mjs';
import { ease, seg, lerp, zoomCam, placeCam, FPS } from './engine.mjs';

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
  id: 's1', url: '/compass/', theme: 'dark', frames: 74,
  prep: page => compassTo(page, '周りから一番頼られるのは', PICKS),
  anchors: async page => ({ mark: bbc(await box(page, '.cp-screen:last-of-type .cp-opt .cp-mark', 2)), q: await box(page, '.cp-screen:last-of-type .cp-q-h') }),
  actions: [{ f: 10, run: jsClick('.cp-screen:last-of-type .cp-opt', 2) }],
  js: f => false,                                   // hold the app's own "advance after choosing" (time-remap: the moment is held)
  sub: sub([[28, 60]], 14),
  cam: (t, A) => {
    // end: question + chosen option, question text ~100px tall at 1920
    const endS = 3.3;
    const qx = A.q.x, qy = A.q.y + A.q.height / 2;
    const B = [W / 2 + (A.mark[0] - (qx + 250)) * endS, H / 2 + (A.mark[1] - (qy + A.mark[1]) / 2) * endS];
    return zoomCam(A.mark, [W * 0.30, H * 0.5], B, 30, endS)(ease.inOutCubic(seg(t, 28 / FPS, 60 / FPS)));
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

/* ---------- S3 現場のことば 言いかえ帳: read the reframe, star it (dark) ---------- */
export const S3 = {
  id: 's3', url: '/iikae/', theme: 'dark', frames: 62,
  prep: async page => {
    await page.click('#intro-start');
    await page.waitForSelector('#view-list.on');
    await page.click('#chips-cat .chip[data-cat="team"]'); await sleep(400);
    await page.evaluate(() => { const r = [...document.querySelectorAll('.word-row')].find(r => r.dataset.key === '板挟みになってた'); r.scrollIntoView({ block: 'center' }); });
    await sleep(300);
  },
  anchors: async page => {
    const i = await page.evaluate(() => [...document.querySelectorAll('.word-row')].findIndex(r => r.dataset.key === '板挟みになってた'));
    return {
      i, genba: await box(page, '.word-row .genba', i), arrow: await box(page, '.word-row .arrow', i),
      kotoba: await box(page, '.word-row .kotoba', i), star: await box(page, '.word-row .word-star', i), row: await box(page, '.word-row', i),
    };
  },
  // a real pointer click (so the product shows exactly what a mouse user sees), then the pointer leaves
  actions: [{ f: 50, run: async (page, A) => { const b = await page.evaluate(i => { const r = document.querySelectorAll('.word-row')[i].querySelector('.word-star').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, A.i); await page.mouse.click(b[0], b[1]); await page.mouse.move(1, 899); } }],
  js: f => f < 50,       // freeze after the star so the confirmation toast stays out of the way
  sub: sub([[24, 39], [36, 50]]),
  cam: (t, A) => {
    const s = 8, y = A.genba.y + A.genba.height / 2;
    const x0 = A.genba.x + 105, x1 = A.kotoba.x + A.kotoba.width - 110;
    const st = [A.star.x + A.star.width / 2, A.star.y + A.star.height / 2];
    // read the reframe (0-0.85s), travel along the row to its star (0.86-1.4s), then close in on the star (1.3-1.8s)
    const u1 = seg(t, 0, 0.8), u2 = ease.inOutCubic(seg(t, 0.81, 1.3));
    let x = lerp(lerp(x0, x1, u1), st[0], u2);
    const base = placeCam([x, lerp(y, st[1], u2)], C, s);
    const push = ease.inOutCubic(seg(t, 1.22, 1.66));
    if (push <= 0) return base;
    return zoomCam(st, C, C, s, 44)(push);
  },
};

/* ---------- S4 掲示じたく: choose a notice, the A4 appears (dark UI, white paper) ---------- */
export const S4 = {
  id: 's4', url: '/keiji/', theme: 'dark', frames: 68,
  prep: async page => { await page.evaluate(() => { const c = document.querySelector('.type-card'); c.scrollIntoView({ block: 'center' }); }); await sleep(300); },
  anchors: async page => ({ card: await box(page, '.type-card', 0), title: await box(page, '.type-card .type-name', 0) }),
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
      await page.evaluate(() => { const p = document.querySelector('.poster-box'); p.scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); });
      const t = await box(page, '.poster-title'); const pb = await box(page, '#poster');
      A.pt = t; A.poster = pb;
    }
  }, { f: 44, run: jsClick('#themeBtn') }],   // the product's own light/dark switch: the room around the paper turns light
  js: f => true,
  sub: sub([[22, 39]]),
  cam: (t, A) => {
    if (t < 12 / FPS) { const c = A.title ? bbc(A.title) : [A.card.x + 120, A.card.y + A.card.height / 2]; return placeCam([A.card.x + 30, c[1]], [W * 0.30, H / 2], 5.0); }
    const c = bbc(A.pt);
    const pull = ease.inOutCubic(seg(t, 22 / FPS, 38 / FPS));
    const pc = [A.poster.x + A.poster.width / 2, A.poster.y + A.poster.height * 0.42];
    return zoomCam(c, C, [W / 2 + (c[0] - pc[0]) * 1.5, H / 2 + (c[1] - pc[1]) * 1.5], 5.0, 1.5)(pull);
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
  sub: sub([[20, 40]]),
  cam: (t, A) => {
    const ch = (t >= 14 / FPS && A.ch2) ? A.ch2 : A.ch;
    const c = [ch.x + 24, ch.y + ch.height / 2];
    const pull = ease.inOutCubic(seg(t, 20 / FPS, 39 / FPS));
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

/* ---------- S6 BRIDGE Compass result (light): from 現在地 out to the three bridges ----------
   Opens on the 現在地 point at the size of the last round check (a disc matched on the cut), then widens to
   「人をつなぎ、育てる力」 and 01 教育/人材育成・02 プロジェクトマネジメント・03 行政/医療政策. The page is left
   13 s after the result appears so its one-off entrance animations (lines, the ring around 現在地) are over. */
export const S6 = {
  id: 's6', url: '/compass/', theme: 'light', frames: 30,
  prep: async page => { await compassTo(page, null, PICKS); await sleep(13000); await page.evaluate(() => window.scrollTo(0, 0)); },
  anchors: async page => ({ h: await box(page, '.cp-r-h'), map: await box(page, '.cp-map'), o: bbc(await box(page, '.cp-map-svg .ln-origin')), od: (await box(page, '.cp-map-svg .ln-origin')).width }),
  js: f => false,
  sub: sub([[3, 24]]),
  cam: (t, A) => {
    const l = A.h.x - 40, r = A.map.x + A.map.width + 40, sc = W / (r - l);
    const wide = placeCam([(l + r) / 2, A.h.y + A.h.height / 2 + 66], C, sc);   // low enough that the site's nav stays out of frame
    const Bw = [W / 2 + (A.o[0] - wide.cx) * sc, H / 2 + (A.o[1] - wide.cy) * sc];
    const s0 = 572 / A.od;
    return zoomCam(A.o, C, Bw, s0, sc)(ease.inOutCubic(seg(t, 3 / FPS, 23 / FPS)));
  },
};

/* ---------- S7 signature: the crossing, then BRIDGE / EXPAND CHOICES. (light) ---------- */
export const S7 = {
  id: 's7', url: '/__p3/card/', theme: 'light', frames: 83, vw: 1440, vh: 810,
  prep: async page => { await page.evaluate(() => document.fonts.ready); },
  anchors: async page => page.evaluate(() => ({ cross: window.CROSS, mb: window.MARKBOX })),
  onFrame: async (page, t) => page.evaluate(t => window.setT(t), t),
  js: f => true,
  sub: sub([[0, 34]]),
  cam: (t, A) => {
    const endS = 1.45;
    const B = [W / 2 + (A.cross[0] - 720) * endS, H / 2 + (A.cross[1] - 405) * endS];
    return zoomCam(A.cross, C, B, 18, endS)(ease.inOutCubic(seg(t, 0.0, 0.95)));
  },
};
