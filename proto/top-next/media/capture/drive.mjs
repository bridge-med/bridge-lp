// Compass を製品自身の選択肢で答え進める(film/choice/shots2.mjs の compassTo と同じ作法。答えはトップの結果画面の例と同じ条件)
import { sleep } from '../../../../film/choice/lib.mjs';

// 理学療法士 / Q1 周囲を巻き込んで解決する / Q2 人やチームの調整 / Q3 チームがうまく動いた / Q4 仕組みを改善する・人の話を聞いてまとめる /
// Q5 特にない / Q6 チームを動かす仕事 / Q7 成長・働きやすさ / Q8 医療系企業のプロジェクトに入る / Q9・Q10 空欄
export const PICKS = { profession: 0, q1: 2, q2: 3, q3: 3, q4: [4, 1], q5: [-1], q6: 2, q7: [4, 5], q8: 4 };

export async function compassTo(page, needle, picks, { noStart = false } = {}) {
  if (!noStart) {
    await page.waitForSelector('#cpStart:not([disabled])');
    await page.click('#cpStart');
  }
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
