// 案2「実物が動く」の試作の素材。どのコマも、このリポジトリの実物のページを film/choice の engine で撮ったもの(拡大・切り抜き・カメラの移動と、最後のコマの静止だけ)
import { sleep } from '../../../../film/choice/lib.mjs';
import { ease, seg, lerp, FPS } from '../../../../film/choice/engine.mjs';
import { compassTo, PICKS } from './drive.mjs';

const W = 1920, H = 1080, TW = 1080, TH = 1350;
async function box(page, sel, i = 0) {
  return page.evaluate(([sel, i]) => { const e = document.querySelectorAll(sel)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; }, [sel, i]);
}

/* ---------- Compass: 置くカメラは動かさない(ナビの下から、問いと結果の地図が入る枠) ----------
   縦(4:5): 390×844 の画面の y 120〜607.5 を全幅で(結果の地図の下の「なぜこの橋が見えたか」を半端に切らない)。横(16:9): 1280×800 の画面の x 160〜1120・y 120〜660 */
const CT = { vw: 390, vh: 844, cam: () => ({ cx: 195, cy: 120 + 487.5 / 2, s: TW / 390 }) };
const CW = { vw: 1280, vh: 800, cam: () => ({ cx: 640, cy: 120 + 270, s: 2 }) };

// A: Q8 で「医療系企業のプロジェクトに入る」を選ぶ → 製品の 0.26 秒の間と 0.18 秒の退場まで(次の問いが入る前で切る)
export const CA = {
  id: 'ca', url: '/compass/', theme: 'light', frames: 31, ...CW,
  prep: page => compassTo(page, '1日だけ、別の仕事を完全に体験できるなら', PICKS),
  actions: [{ f: 18, run: page => page.evaluate(() => document.querySelectorAll('.cp-screen:last-of-type .cp-opt')[4].click()) }],
  tall: CT,
};
// B: Q10 を「あとで」で飛ばす(答えは空のまま)→ 翻訳中の画面(製品の 1.9 秒)→ 結果。地図の線と三つの橋が出そろうまで。
//    shift 0.18: 最初のコマは翻訳中の画面が入り始めたところ(A の最後の空の画から続く)
export const CB = {
  id: 'cb', url: '/compass/', theme: 'light', frames: 122, shift: 0.18, ...CW,
  prep: page => compassTo(page, 'もし失敗しないとしたら', PICKS),
  actions: [{ f: 0, run: page => page.evaluate(() => { const s = document.querySelector('.cp-screen:last-of-type .cp-skip') || document.querySelector('.cp-screen:last-of-type .cp-next'); s.click(); }) }],
  tall: CT,
};

/* ---------- クリニックタウン3D: Day 6 の経営の相談で、2つ目の選択肢を選ぶ → 見込みの数値と「数値はゲーム上の仮定」 ----------
   乱数は撮影ごとに同じ種から(縦と横で同じ相談が出るように。ゲームの中身・データは変えない) */
const SEED = `(() => { let a = 20261021 >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
async function townPrep(page) {
  await page.addInitScript(SEED);
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(2500);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { const g = document.getElementById('gateGo'); if (g && g.offsetParent) g.click(); }); await sleep(800); }
  for (let d = 0; d < 20; d++) {
    if (await page.evaluate(() => document.getElementById('decisionGate')?.classList.contains('show'))) break;
    await page.evaluate(() => { const b = document.querySelector('#modal.show button'); if (b) b.click(); });
    await sleep(400);
    await page.evaluate(() => document.getElementById('skipBtn').click());
    await sleep(1600);
  }
  await page.evaluate(() => { const t = document.querySelector('.toast.show, #toast.show'); if (t) t.classList.remove('show'); });
  await sleep(2600); // 「Day 5 を自動運営でスキップしました」が消えるまで
}
const CLICK = 2.2;  // 選ぶ時刻(秒)
const townBase = {
  id: 'town', url: '/clinic-flow-3d/', theme: 'light', frames: Math.round((CLICK + 1.5) * FPS), settleMs: 1000, gl: true,
  prep: townPrep,
  anchors: async page => { const c0 = await box(page, '#decisionGate .dec-choice'); const card = await box(page, '#decisionGate .dec-card, #decisionGate [class*=card]'); return { c0, cardOff: (card ? card.y : c0.y - 292) - c0.y }; },
  actions: [{ f: Math.round(CLICK * FPS), run: page => page.evaluate(() => document.querySelectorAll('#decisionGate .dec-choice')[1].click()) }],
  onFrame: async (page, t, A) => { A.c0 = await box(page, '#decisionGate .dec-choice'); },   // カメラは相談の板に付いていく(選ぶと板が上へ伸びる)
  js: () => false,
};
export const TOWN = {
  ...townBase, vw: 1280, vh: 800,
  cam: (t, A) => {
    const u = ease.inOutCubic(seg(t, 1.0, 2.0)), u2 = ease.inOutCubic(seg(t, CLICK + 0.1, CLICK + 0.8));
    const s = Math.exp(lerp(Math.log(2.6), Math.log(2), u));
    const top = A.c0.y + lerp(lerp(A.cardOff, -215, u), -165, u2);   // 選んだあとは見込みの「効果」まで入れる
    return { cx: 640, cy: top + (H / s) / 2, s };
  },
  tall: {
    vw: 390, vh: 844,
    cam: (t, A) => {
      // 選ぶ前は画面の下端(この方針で決める)の手前まで、選んだあとは板が伸びたぶん下げて、見込みの「費用」「効果」まで入れる
      const u = ease.inOutCubic(seg(t, 1.0, 2.0)), u2 = ease.inOutCubic(seg(t, CLICK + 0.1, CLICK + 0.8));
      const top = A.c0.y + lerp(lerp(A.cardOff, -140, u), -100, u2);
      return { cx: 195, cy: top + 487.5 / 2, s: TW / 390 };
    },
  },
};
