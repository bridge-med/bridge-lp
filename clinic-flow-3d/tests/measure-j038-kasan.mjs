/* 便U(v55)の実測ハーネス: 透析の加算レイヤーと区分落下の収益規模
 * 実行: node clinic-flow-3d/tests/measure-j038-kasan.mjs
 *
 * シナリオ(固定): 透析1部門・医師1・CE1・水処理設備あり・区分1と水質確保を届出済み・開設から180日×10seed。
 * 条件 = (a)2クール・8床 (b)3クール・8床(3クール目に時間外・休日加算) (c)3クール・8床+HDF届出 (d)2クール・26床・看護師12で
 * 名簿を比3.5以上まで積む(区分3への落下) (e)2クール・8床+下肢末梢の届出(v56) (f)2クール・8床+運動指導の体制(v56)。
 * 測るもの: 時間外・濾過・下肢末梢・運動指導の件数と算定額、区分3セッション数、売上総額。
 * 注意: この数字はこのシナリオの値であり、ゲーム全体の点推定ではない(v51 PM条件1の型)。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const DIALYSIS = require(join(ROOT, 'app', 'specialties', 'dialysis.js'));
REIMB.init(KB); DEPT.init(REIMB, KB);

const rng = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const OPEN = { kind: 'normal', pay: 1 }, CLOSED = { kind: 'closed', pay: 0 };
const DAYS = 180;

function run(seed, cfg) {
  const dept = DEPT.create(DIALYSIS, 1);
  // deptInit(引き継ぎ12人)は乱数を使わないためそのまま。新規紹介はctx.randで決まる(seed固定)
  dept.equip.water = true; dept.policy.explain = true;
  dept.fs.push('r08-fs-j038-1', 'r08-fs-j038-suishitsu', 'r08-fs-j038-donyuki1');
  dept.policy.cools = cfg.cools; dept.equip.beds = cfg.beds; dept.staff.nurses = cfg.nurses;
  if (cfg.hdf) dept.fs.push('r08-fs-j038-n13');
  if (cfg.pad) { dept.policy.pad = true; dept.fs.push('r08-fs-j038-n10'); }
  if (cfg.exercise) dept.policy.exercise = true;
  const rand = rng(seed);
  let n1 = 0, n1Yen = 0, n13 = 0, n13Yen = 0, hd3 = 0, hd1 = 0, revenue = 0, n10 = 0, n10Yen = 0, n14 = 0, n14Yen = 0;
  for (let d = 1; d <= DAYS; d++) {
    if (cfg.flood && d === 30) { while (dept.pt.length < cfg.flood) { dept.seq++; dept.pt.push({ id: 'dz' + dept.seq, pr: 'maintenance', en: d, nv: d, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: dept.seq % 2 }); } }
    const agg = DEPT.runDay(DIALYSIS, dept, { day: d, rand, rep: 70, aw: 0.5, spec: d % 7 === 0 ? CLOSED : OPEN });
    revenue += agg.revenue;
    for (const [id, v] of Object.entries(agg.byItem)) {
      if (id === 'r08-J038-n1') { n1 += v.n; n1Yen += v.pts * 10; }
      if (id === 'r08-J038-n13') { n13 += v.n; n13Yen += v.pts * 10; }
      if (id === 'r08-J038-3-ro') hd3 += v.n;
      if (id === 'r08-J038-n10') { n10 += v.n; n10Yen += v.pts * 10; }
      if (id === 'r08-J038-n14') { n14 += v.n; n14Yen += v.pts * 10; }
      if (id === 'r08-J038-1-ro') hd1 += v.n;
    }
  }
  return { seed, n1, n1Yen, n13, n13Yen, n10, n10Yen, n14, n14Yen, hd1, hd3, revenue, census: dept.pt.length, kubun1: dept.fs.includes('r08-fs-j038-1') };
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return (s[4] + s[5]) / 2; };
const CFGS = [
  ['(a) 2クール・8床', { cools: 2, beds: 8, nurses: 4 }],
  ['(b) 3クール・8床', { cools: 3, beds: 8, nurses: 6 }],
  ['(c) 3クール・8床+HDF届出', { cools: 3, beds: 8, nurses: 6, hdf: true }],
  ['(d) 2クール・26床・30日目に名簿を100人へ(比3.8=区分3へ落下)', { cools: 2, beds: 26, nurses: 12, flood: 100 }],
  ['(e) 2クール・8床+下肢末梢動脈疾患指導管理加算の届出', { cools: 2, beds: 8, nurses: 4, pad: true }],
  ['(f) 2クール・8床+透析時運動指導の体制(看護師4=上限32人/日)', { cools: 2, beds: 8, nurses: 4, exercise: true }],
];
for (const [label, cfg] of CFGS) {
  const res = SEEDS.map((s) => run(s, cfg));
  console.log(`\n# ${label}`);
  for (const r of res) console.log(`  seed=${r.seed} 人工腎臓 区分1 ${r.hd1}件/区分3 ${r.hd3}件 / 時間外 ${r.n1}件 ${r.n1Yen.toLocaleString()}円 / 濾過 ${r.n13}件 ${r.n13Yen.toLocaleString()}円 / 下肢末梢 ${r.n10}件 ${r.n10Yen.toLocaleString()}円 / 運動指導 ${r.n14}件 ${r.n14Yen.toLocaleString()}円 / 売上 ${r.revenue.toLocaleString()}円 / 患者${r.census}人${r.kubun1 ? '' : '・区分1を外れた'}`);
  console.log(`  中央値: 時間外 ${med(res.map((r) => r.n1Yen)).toLocaleString()}円 / 濾過 ${med(res.map((r) => r.n13Yen)).toLocaleString()}円 / 下肢末梢 ${med(res.map((r) => r.n10Yen)).toLocaleString()}円 / 運動指導 ${med(res.map((r) => r.n14Yen)).toLocaleString()}円 / 区分3 ${med(res.map((r) => r.hd3))}件 / 売上 ${med(res.map((r) => r.revenue)).toLocaleString()}円 (${DAYS}日)`);
  const y = (v) => Math.round(v * 365 / DAYS / 10000);
  console.log(`  年換算: 時間外 約${y(med(res.map((r) => r.n1Yen)))}万円・濾過 約${y(med(res.map((r) => r.n13Yen)))}万円・下肢末梢 約${y(med(res.map((r) => r.n10Yen)))}万円・運動指導 約${y(med(res.map((r) => r.n14Yen)))}万円 (このシナリオの値。点推定ではない)`);
}
