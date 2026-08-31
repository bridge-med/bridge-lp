/* 便R(v52)の実測ハーネス: C002独立加算(実績加算2+データ提出)の収益規模の追試
 * 実行: node clinic-flow-3d/tests/measure-c002-kasan.mjs
 *
 * シナリオ(固定): measure-c001-ro.mjsと同一(満室2棟+戸建て12地区×3人=50人・120日×10seed)。
 * レバー: 実績加算2(ハ)+データ提出を届出済みにして、加算の算定額を測る。
 * 注意: この数字はこのシナリオの値であり、ゲーム全体の点推定ではない(v51 PM条件1の型)。 */
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
  dept.policy.oncall = true; dept.fs.push('r08-fs-zaishien', 'r08-fs-c002-n7-jisseki2', 'r08-fs-c002-n13');
  dept.sd = 1;
  let id = 0;
  for (const cl of [12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13]) {
    dept.pt.push({ id: 'm' + (id++), pr: 'home', en: 1, nv: 2 + (id % 14), sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl, iv: 15, sj: 0, o: 1 + (id % 14) });
  }
  for (let c = 0; c < 12; c++) for (let k = 0; k < 3; k++) {
    dept.pt.push({ id: 'h' + (id++), pr: 'home', en: 1, nv: 2 + (id % 14), sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: c, iv: 15, sj: 0, o: 1 + (id % 14) });
  }
  const rand = rng(seed);
  let kasanYen = 0, n13 = 0, n7 = 0;
  for (let d = 1; d <= 120; d++) {
    const ctx = { day: d, rand, rep: 70, spec: d % 7 === 0 ? CLOSED : OPEN,
      homecareCap: 98,
      assignCluster: () => null, releaseCluster: () => {},
      orderByRoute: (due) => { const by = new Map(); for (const p of due) { if (!by.has(p.cl)) by.set(p.cl, []); by.get(p.cl).push(p); } const out = []; for (const [, ps] of by) ps.forEach((p, i) => out.push({ p, travelMin: i === 0 ? 8 : 2 })); return out; },
      siteInfo: site };
    const agg = DEPT.runDay(HOMECARE, dept, ctx);
    for (const [id, v] of Object.entries(agg.byItem)) {
      if (id.indexOf('r08-C002-n7-') === 0) { n7 += v.n; kasanYen += v.pts * 10; }
      if (id === 'r08-C002-n13') { n13 += v.n; kasanYen += v.pts * 10; }
    }
  }
  return { seed, n7, n13, kasanYen };
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const res = SEEDS.map(run);
const totals = res.map((r) => r.kasanYen).sort((a, b) => a - b);
const median = (totals[4] + totals[5]) / 2;
for (const r of res) console.log(`  seed=${r.seed} 実績加算${r.n7}件 データ提出${r.n13}件 加算額=${r.kasanYen.toLocaleString()}円/120日`);
console.log(`\n中央値 ${median.toLocaleString()}円/120日 (範囲 ${totals[0].toLocaleString()}〜${totals[9].toLocaleString()})`);
console.log(`年換算 約${Math.round(median * 365 / 120 / 10000)}万円 (このシナリオの値・実績2+データ提出。点推定ではない)`);
