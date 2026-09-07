/* 本院眼科の365日計測(v76 便AI-2 計測コミット0)。実行: node clinic-flow-3d/tests/measure-ophtha-365.mjs [種]
 * ローカルサーバー http://localhost:8767 が要る。Math.random を種固定・分岐点は先頭の選択肢を機械的に選ぶ。月別の手術件数・手術+術前の純収益(材料費控除)・¥15,000,000 の回収月数を出す */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const seed = Number(process.argv[2] || 7);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.route(/googleapis|gstatic|zgo\.at/, (r) => r.abort());
await page.addInitScript((seed) => { let s = seed >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }, seed);
async function advanceDay() {
  await page.evaluate(() => document.getElementById('skipBtn')?.click());
  for (let j = 0; j < 8; j++) {
    const st = await page.evaluate(() => ({ m: document.getElementById('modal')?.classList.contains('show'), d: document.getElementById('decisionGate')?.classList.contains('show') }));
    if (st.m) { await page.evaluate(() => document.querySelector('#modal.show .btn-cta')?.click()); await page.waitForTimeout(20); continue; }
    if (st.d) {
      await page.evaluate(() => document.querySelector('.dec-choice:not(.blocked)')?.click()); await page.waitForTimeout(20);
      await page.evaluate(() => document.getElementById('decGo')?.click()); await page.waitForTimeout(20);
      await page.evaluate(() => document.getElementById('decClose')?.click()); await page.waitForTimeout(20);
      continue;
    }
    break;
  }
}
await page.goto('http://localhost:8767/clinic-flow-3d/index.html', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
await page.evaluate(() => { document.querySelector('[data-gate="ophthalmology"]')?.click(); document.getElementById('gateGo')?.click(); document.getElementById('tutSkip')?.click(); });
await page.waitForTimeout(150);
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('clinicTown_v3')); s.g.money = 60000000; s.settings.mainEquip.surgery = true; localStorage.setItem('clinicTown_v3', JSON.stringify(s)); });
await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(300);
const months = {};
let lastLen = 0;
for (let d = 0; d < 365; d++) {
  await advanceDay();
  const h = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('clinicTown_v3')); const H = s.g.history; return H.slice(-1)[0]; });
  if (!h) continue;
  const mo = Math.floor((h.day - 1) / 30) + 1;
  const M = months[mo] || (months[mo] = { ops: 0, opsYen: 0, preYen: 0, pat: 0, rev: 0, days: 0 });
  M.days++; M.pat += h.patients || 0; M.rev += h.revenue || 0;
  for (const [k, v] of Object.entries(h.acct || {})) { if (/水晶体再建術/.test(k)) { M.ops += v.n; M.opsYen += v.yen; } if (/角膜曲率|光学的眼軸/.test(k)) M.preYen += v.yen; }
}
const q = await page.evaluate(() => JSON.parse(localStorage.getItem('clinicTown_v3')).g.mainQueue);
let totOps = 0, totNet = 0;
console.log('seed', seed, 'month ops opsYen preYen net(=ops+pre-15000*ops) patients/day revenue');
for (const [mo, M] of Object.entries(months)) { const net = M.opsYen + M.preYen - 15000 * M.ops; totOps += M.ops; totNet += net; console.log(mo, M.ops, M.opsYen, M.preYen, net, (M.pat / M.days).toFixed(1), M.rev); }
console.log('total ops', totOps, 'net', totNet, 'payback months(15M/avg monthly net)', (15000000 / (totNet / Object.keys(months).length)).toFixed(1), 'queue', JSON.stringify(q));
await browser.close();
