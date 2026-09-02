/* 便T(v54)の実測ハーネス: 精神科の早期診療体制充実加算3の収益規模と協定費用の回収
 * 実行: node clinic-flow-3d/tests/measure-i002-n11.mjs
 *
 * シナリオ(固定): 精神科1部門・医師1(指定医)・精神保健福祉士1・連携病院との協定あり・開設から180日×10seed。
 * 4条件 = 診察時間の方針(std/long) × 加算3の届出あり/なし。PSWと協定は両側で固定し、
 * 加算の効果とPSWの中断率効果(pswChurnRelief)を混ぜない(v54 PM条件)。
 * 測るもの: 加算セル(-n11-ha-1/2)の件数と算定額、売上総額、協定費用(30万円・ゲーム上の仮定)の回収日数。
 * 注意: この数字はこのシナリオの値であり、ゲーム全体の点推定ではない(v51 PM条件1の型)。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const PSYCH = require(join(ROOT, 'app', 'specialties', 'psychiatry.js'));
REIMB.init(KB); DEPT.init(REIMB, KB);

const rng = (s) => () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const OPEN = { kind: 'normal', pay: 1 }, CLOSED = { kind: 'closed', pay: 0 };
const DAYS = 180;
const RENKEI_COST = (PSYCH.actions.find((a) => a.id === 'renkei') || { cost: 0 }).cost;

function run(seed, plan, notify) {
  // deptInit(引き継ぎ患者)はMath.randomを使うため、seed固定のために引き継ぎを空にして新規登録だけで育てる
  const dept = DEPT.create(PSYCH, 1);
  dept.pt.length = 0; dept.seq = 0;
  dept.staff.psws = 1; dept.policy.renkei = true; dept.policy.timePlan = plan;
  if (notify) dept.fs.push('r08-fs-i002-n11-3');
  const rand = rng(seed);
  let n11 = 0, n11Yen = 0, revenue = 0, i002 = 0;
  for (let d = 1; d <= DAYS; d++) {
    const agg = DEPT.runDay(PSYCH, dept, { day: d, rand, rep: 70, aw: 0.5, spec: d % 7 === 0 ? CLOSED : OPEN });
    revenue += agg.revenue;
    for (const [id, v] of Object.entries(agg.byItem)) {
      if (/-n11-ha-[12]$/.test(id)) { n11 += v.n; n11Yen += v.pts * 10; }
      if (id.startsWith('r08-I002-1-')) i002 += v.n;
    }
  }
  return { seed, n11, n11Yen, i002, revenue, panel: dept.pt.length };
}

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return (s[4] + s[5]) / 2; };
for (const plan of ['std', 'long']) {
  for (const notify of [false, true]) {
    const res = SEEDS.map((s) => run(s, plan, notify));
    const n11Yen = med(res.map((r) => r.n11Yen)), rev = med(res.map((r) => r.revenue)), i002 = med(res.map((r) => r.i002));
    console.log(`\n# 診察時間 ${plan}・加算3 ${notify ? '届出あり' : '届出なし'}`);
    for (const r of res) console.log(`  seed=${r.seed} 通院精神療法 ${r.i002}件 / 加算3 ${r.n11}件 ${r.n11Yen.toLocaleString()}円 / 売上 ${r.revenue.toLocaleString()}円 / 患者${r.panel}人`);
    console.log(`  中央値: 通院精神療法 ${i002}件 / 加算3 ${n11Yen.toLocaleString()}円 / 売上 ${rev.toLocaleString()}円 (${DAYS}日)`);
    if (notify) console.log(`  年換算: 加算3 約${Math.round(n11Yen * 365 / DAYS / 10000)}万円。協定費用${RENKEI_COST.toLocaleString()}円の回収 約${n11Yen > 0 ? Math.round(RENKEI_COST / (n11Yen / DAYS)) : '-'}日 (このシナリオの値。点推定ではない)`);
  }
}
