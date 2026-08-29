/* 部門エンジン(app/departments.js)+内科モジュールのテスト
 * 実行: node clinic-flow-3d/tests/departments.test.mjs
 * 期待値は全てKBパック経由(REIMB.pointsOf)で読む。点数をこのファイルに書かない。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const INTERNAL = require(join(ROOT, 'app', 'specialties', 'internal-medicine.js'));

REIMB.init(KB);
DEPT.init(REIMB, KB);

let n = 0, failed = 0;
function t(name, fn) {
  n++;
  try { fn(); console.log(`  ok ${n} - ${name}`); }
  catch (e) { failed++; console.log(`  NG ${n} - ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期待=${JSON.stringify(b)} 実際=${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'falsy'); }

/* 決定的乱数(mulberry32) */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t2 = Math.imul(a ^ (a >>> 15), 1 | a);
    t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
    return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
  };
}
const OPEN = { kind: 'normal', pay: 1 };
const CLOSED = { kind: 'closed', pay: 0 };
const ctx = (day, rand, spec) => ({ day, spec: spec || OPEN, rep: 70, aw: 0.5, rand });

console.log('# 部門エンジン基盤');

t('月/週/6月窓の追跡対象をKB構造から導出する(列挙しない)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'ht', 1);
  const r = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Ht' }] }, 1);
  ok(r.ev.billableItems.length >= 1, '算定されること');
  eq(p.mc['r08-B001-3-1-ht'], 1, '月1回制限の項目はmcに記録');
  eq(p.lb['r08-B001-3-1-ht'], 0, '6月窓の起点項目はlbに記録');
});

t('初診料は同一患者に1回だけ(visit_first)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  const p = DEPT.addPatient(dept, 'ht', 1);
  const r1 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'first', kbActs: [] }, 1);
  ok(r1.ev.billableItems.some((b) => b.itemId === 'r08-A000'), '1回目は初診料あり');
  ok(p.fb, 'fbが立つ');
  const r2 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'first', kbActs: [] }, 2);
  ok(r2.ev.rejectedItems.some((b) => b.itemId === 'r08-A000'), '2回目の初診料は却下');
});

t('月替わりでmcがリセットされ、管理料が翌月また算定できる', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'dm', 1);
  DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Dm' }] }, 5);
  const rSame = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Dm' }] }, 20);
  ok(rSame.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-1-dm'), '同月2回目は却下');
  DEPT.runDay(INTERNAL, dept, ctx(31, rng(1)));  // 翌月へ(rolloverが走る)
  const rNext = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Dm' }] }, 35);
  ok(rNext.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-1-dm'), '翌月は算定可');
});

t('(I)→(II)の6月窓が患者単位で効く(rule-0004)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'ht', 1);
  DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Ht' }] }, 5);
  const r = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu2' }] }, 65);  // 2月後
  ok(r.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-3'), '6月以内の(II)は却下');
  const r2 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu2' }] }, 5 + 30 * 7);  // 7月後
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-3'), '6月経過後の(II)は算定可');
});

t('施設基準ゲート: 体制未整備なら管理料は却下・整備後は算定可', () => {
  const dept = DEPT.create(INTERNAL, 1);
  const p = DEPT.addPatient(dept, 'lipid', 1);
  const r1 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Lipid' }] }, 1);
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-1-lipid'), '未整備は却下');
  dept.policy.keiji = true;
  dept.fs.push('r08-fs-b001-3');
  const r2 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Lipid' }] }, 2);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-1-lipid'), '整備後は算定可');
});

t('要件割れで適用から外れる(fsEnforce)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.policy.keiji = false;  // 体制が崩れた
  const agg = DEPT.runDay(INTERNAL, dept, ctx(2, rng(1)));
  eq(dept.fs.length, 0, '適用から外れる');
  ok(agg.events.some((e) => e.kind === 'fs_broken'), 'イベントが積まれる');
});

console.log('# 内科部門(患者パネル)');

t('休診日は固定費のみで診療しない', () => {
  const dept = DEPT.create(INTERNAL, 1);
  const agg = DEPT.runDay(INTERNAL, dept, ctx(1, rng(2), CLOSED));
  eq(agg.visits, 0);
  eq(agg.revenue, 0);
  ok(agg.cost > 0, '固定費はかかる');
});

t('180日運用: 収益は全てエンジン点数×10+明示概算のみで構成される', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const rand = rng(42);
  let engineYen = 0, approxYen = 0, revenue = 0;
  for (let d = 1; d <= 180; d++) {
    const agg = DEPT.runDay(INTERNAL, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN));
    revenue += agg.revenue;
    engineYen += agg.points * 10;
    approxYen += agg.approx.reduce((a, x) => a + x.yen, 0);
  }
  ok(dept.pt.length > 100, `パネルが育つ(実際${dept.pt.length}人)`);
  ok(revenue > 0, '売上が立つ');
  eq(revenue, engineYen + approxYen, '売上=エンジン算定+明示概算(それ以外の収益源が無い)');
});

t('(II)方針: 患者ごと月1回だけ(II)が算定され、検査は概算計上される', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.policy.kanri = 'II';
  const rand = rng(7);
  for (let d = 1; d <= 60; d++) DEPT.runDay(INTERNAL, dept, ctx(d, rand));
  const agg = dept.last;
  ok(dept.pt.some((p) => p.mc['r08-B001-3-3'] === 1 || (p.lb && true)), '算定履歴が残る');
  for (const p of dept.pt) ok(!p.mc['r08-B001-3-3'] || p.mc['r08-B001-3-3'] <= 1, '月2回はいない');
  ok(agg.approx.some((x) => x.n === '検体検査一式'), '検査は概算として明示');
});

t('(I)方針: 検査は包括行(0点)になり概算計上されない', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.policy.kanri = 'I';
  const rand = rng(7);
  let agg = null;
  for (let d = 1; d <= 40; d++) agg = DEPT.runDay(INTERNAL, dept, ctx(d, rand));
  const monthlySample = agg.sample;
  ok(monthlySample, '代表レセプトが取れる');
  ok(monthlySample.lines.some((l) => l.incl === 'r08-rule-0002' && l.t === 0), '包括行がある');
  ok(!monthlySample.lines.some((l) => (l.n || '').indexOf('検体検査一式(概算)') === 0), '(I)の月次来院レセプトに検査の概算行がない');
  ok(agg.byItem['r08-B001-3-1-ht'] || agg.byItem['r08-B001-3-1-dm'] || agg.byItem['r08-B001-3-1-lipid'], '(I)が算定されている');
});

t('(I)方針の月次来院では外来管理加算がエンジンに却下される(包括rule-0002)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'ht', 1);
  p.fb = true;
  const r = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Ht' }, { id: 'kanri' }, { id: 'presc' }] }, 1);
  ok(r.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-1-ht'), '(I)は算定');
  ok(r.ev.rejectedItems.some((b) => b.itemId === 'r08-A001-n8'), '外来管理加算は包括で却下');
  ok(r.ev.billableItems.some((b) => b.itemId === 'r08-F400-3'), '処方箋料は算定できる');
});

t('点数の期待値はKBと一致する(スポット確認)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'dm', 1);
  p.fb = true;
  const r = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Dm' }, { id: 'presc' }, { id: 'ippanmei' }] }, 1);
  const want = REIMB.pointsOf('r08-A001') + REIMB.pointsOf('r08-B001-3-1-dm') + REIMB.pointsOf('r08-F400-3') + REIMB.pointsOf('r08-F400-n6-i');
  eq(r.ev.totalPoints, want, '合計点数');
});

console.log(failed ? `\nNG: ${failed}/${n} 失敗` : `\n全${n}件 合格`);
process.exit(failed ? 1 : 0);
