/* 便Q(v51)の実測ハーネス: C001イ/ロ判定による過大計上解消額の追試
 * 実行: node clinic-flow-3d/tests/measure-c001-ro.mjs
 *
 * シナリオ(固定): 満室マンション2棟(cl=12/13に各7人)+戸建て12地区×3人=50人。
 * 訪問起点日oはid%14で分散(同日重複は自然発生分のみ)。120日×10seed(固定)。
 * 「解消額」=ロ(215点)で算定された件数×675点(イとの差)×10円。
 * 注意: 解消額は初期配置に強く依存する(PM再構成: 満室初日配置なら年約90万円・
 * 自然成長なら年約8万円)。この数字はこのシナリオの値であり、ゲーム全体の
 * 点推定ではない(v51 PM条件1)。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const HOMECARE = require(join(ROOT, 'app', 'specialties', 'homecare.js'));
REIMB.init(KB); DEPT.init(REIMB, KB);

const rng = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const OPEN = { kind: 'open', min: 480 }, CLOSED = { kind: 'closed' };
const site = (i) => (i >= 12 ? { mansion: true, units: 24 } : { x: 0, y: 0 });

function run(seed) {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true; dept.fs.push('r08-fs-zaishien');
  dept.sd = 1;
  let id = 0;
  for (const cl of [12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13]) {
    dept.pt.push({ id: 'm' + (id++), pr: 'home', en: 1, nv: 2 + (id % 14), sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl, iv: 15, sj: 0, o: 1 + (id % 14) });
  }
  for (let c = 0; c < 12; c++) for (let k = 0; k < 3; k++) {
    dept.pt.push({ id: 'h' + (id++), pr: 'home', en: 1, nv: 2 + (id % 14), sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: c, iv: 15, sj: 0, o: 1 + (id % 14) });
  }
  const rand = rng(seed);
  let ro = 0, i890 = 0;
  for (let d = 1; d <= 120; d++) {
    const ctx = { day: d, rand, rep: 70, spec: d % 7 === 0 ? CLOSED : OPEN,
      homecareCap: 98,
      assignCluster: () => null, releaseCluster: () => {},
      orderByRoute: (due) => { const by = new Map(); for (const p of due) { if (!by.has(p.cl)) by.set(p.cl, []); by.get(p.cl).push(p); } const out = []; for (const [, ps] of by) ps.forEach((p, i) => out.push({ p, travelMin: i === 0 ? 8 : 2 })); return out; },
      siteInfo: site };
    const agg = DEPT.runDay(HOMECARE, dept, ctx);
    ro += (agg.byItem['r08-C001-1-ro'] || { n: 0 }).n;
    i890 += (agg.byItem['r08-C001-1-i'] || { n: 0 }).n;
  }
  return { seed, ro, i890, savingYen: ro * 675 * 10 };
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const res = SEEDS.map(run);
const savings = res.map((r) => r.savingYen).sort((a, b) => a - b);
const median = (savings[4] + savings[5]) / 2;
for (const r of res) console.log(`  seed=${r.seed} ロ=${r.ro}件 イ=${r.i890}件 解消額=${r.savingYen.toLocaleString()}円/120日`);
console.log(`\n中央値 ${median.toLocaleString()}円/120日 (範囲 ${savings[0].toLocaleString()}〜${savings[9].toLocaleString()})`);
console.log(`年換算 約${Math.round(median * 365 / 120 / 10000)}万円 (このシナリオの値。初期配置依存=点推定ではない)`);
