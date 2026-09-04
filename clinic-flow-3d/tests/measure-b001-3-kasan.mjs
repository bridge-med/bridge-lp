/* 便S(v53)の実測ハーネス: 内科の加算レイヤー(充実管理加算3+眼科医療機関連携強化加算)の収益規模
 * 実行: node clinic-flow-3d/tests/measure-b001-3-kasan.mjs
 *
 * シナリオ(固定): 内科1部門・医師1・医療事務1・体制あり・開設から180日×10seed(seed固定)。
 * 4条件 = 管理料方針(I)/(II) × 充実管理加算3の届出あり/なし。
 * 測るもの: 加算セル(-n4-*-3)と連携強化加算(-n5)の算定件数と算定額、売上総額。
 * 注意: この数字はこのシナリオの値であり、ゲーム全体の点推定ではない(v51 PM条件1の型)。
 * 眼科への紹介は月次来院×1/12の乱数で起きるため、連携強化加算の件数はseedで散る。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const INTERNAL = require(join(ROOT, 'app', 'specialties', 'internal-medicine.js'));
REIMB.init(KB); DEPT.init(REIMB, KB);

const rng = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const OPEN = { kind: 'normal', pay: 1 }, CLOSED = { kind: 'closed', pay: 0 };
const DAYS = 180;

function run(seed, plan, notify) {
  // deptInit(引き継ぎ患者)はMath.randomを使うため、seed固定のために引き継ぎを空にして新規登録だけで育てる
  const dept = DEPT.create(INTERNAL, 1);
  dept.pt.length = 0; dept.seq = 0;
  dept.policy.keiji = true; dept.policy.kanri = plan; dept.fs.push('r08-fs-b001-3');
  if (notify) dept.fs.push('r08-fs-b001-3-n4-3');
  const rand = rng(seed);
  let n4 = 0, n4Yen = 0, n5 = 0, n5Yen = 0, revenue = 0;
  for (let d = 1; d <= DAYS; d++) {
    const agg = DEPT.runDay(INTERNAL, dept, { day: d, rand, rep: 70, aw: 0.5, spec: d % 7 === 0 ? CLOSED : OPEN });
    revenue += agg.revenue;
    for (const [id, v] of Object.entries(agg.byItem)) {
      if (/-n4-(i|ro|ha)-3$/.test(id)) { n4 += v.n; n4Yen += v.pts * 10; }
      if (/-n5$/.test(id)) { n5 += v.n; n5Yen += v.pts * 10; }
    }
  }
  return { seed, n4, n4Yen, n5, n5Yen, revenue, panel: dept.pt.length };
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return (s[4] + s[5]) / 2; };
for (const plan of ['I', 'II']) {
  for (const notify of [false, true]) {
    const res = SEEDS.map((s) => run(s, plan, notify));
    const n4Yen = med(res.map((r) => r.n4Yen)), n5Yen = med(res.map((r) => r.n5Yen)), rev = med(res.map((r) => r.revenue));
    console.log(`\n# 管理料(${plan})方針・充実管理加算3 ${notify ? '届出あり' : '届出なし'}`);
    for (const r of res) console.log(`  seed=${r.seed} 加算3 ${r.n4}件 ${r.n4Yen.toLocaleString()}円 / 連携強化 ${r.n5}件 ${r.n5Yen.toLocaleString()}円 / 売上 ${r.revenue.toLocaleString()}円 / 患者${r.panel}人`);
    console.log(`  中央値: 加算3 ${n4Yen.toLocaleString()}円 / 連携強化 ${n5Yen.toLocaleString()}円 / 売上 ${rev.toLocaleString()}円 (${DAYS}日)`);
    console.log(`  年換算: 加算3 約${Math.round(n4Yen * 365 / DAYS / 10000)}万円・連携強化 約${Math.round(n5Yen * 365 / DAYS / 10000)}万円 (このシナリオの値。点推定ではない)`);
  }
}
