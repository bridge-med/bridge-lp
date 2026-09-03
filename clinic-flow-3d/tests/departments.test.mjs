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
const OPHTHA = require(join(ROOT, 'app', 'specialties', 'ophthalmology.js'));
const DIALYSIS = require(join(ROOT, 'app', 'specialties', 'dialysis.js'));
const HOMECARE = require(join(ROOT, 'app', 'specialties', 'homecare.js'));
const PSYCH = require(join(ROOT, 'app', 'specialties', 'psychiatry.js'));

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

t('(II)方針: 患者ごと月1回だけ(II)が算定され、検体検査はKB実点数で算定される(便I)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.policy.kanri = 'II';
  const rand = rng(7);
  for (let d = 1; d <= 60; d++) DEPT.runDay(INTERNAL, dept, ctx(d, rand));
  const agg = dept.last;
  ok(dept.pt.some((p) => p.mc['r08-B001-3-3'] === 1 || (p.lb && true)), '算定履歴が残る');
  for (const p of dept.pt) ok(!p.mc['r08-B001-3-3'] || p.mc['r08-B001-3-3'] <= 1, '月2回はいない');
  ok(!agg.approx.some((x) => x.n === '検体検査一式'), '検査の概算行は無い(KB実点数化)');
  ok(agg.byItem['r08-D026-4'] && agg.byItem['r08-D026-4'].n > 0, '生化学的検査(I)判断料が算定されている');
  ok(agg.byItem['r08-D400-1'] && agg.byItem['r08-D400-1'].n > 0, '血液採取(静脈)が算定されている');
  for (const p of dept.pt) ok(!p.mc['r08-D026-4'] || p.mc['r08-D026-4'] <= 1, '判断料の月2回はいない(D026注1)');
  for (const p of dept.pt) ok(!p.mc['r08-D005-9'] || p.mc['r08-D005-9'] <= 1, 'HbA1cの月2回はいない');
});

t('(I)方針: 検体検査はエンジンが包括で却下し、概算計上もされない(便I)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.policy.kanri = 'I';
  const rand = rng(7);
  let agg = null;
  for (let d = 1; d <= 40; d++) agg = DEPT.runDay(INTERNAL, dept, ctx(d, rand));
  const monthlySample = agg.sample;
  ok(monthlySample, '代表レセプトが取れる');
  ok(!agg.approx.some((x) => x.n === '検体検査一式'), '検査の概算行は無い');
  ok(monthlySample.kb && monthlySample.kb.rejected.some((x) => x.itemId === 'r08-D007-n1-ha'), '代表レセプトに検査の包括却下が出る(rule-0002)');
  ok(monthlySample.kb && monthlySample.kb.rejected.some((x) => x.itemId === 'r08-D026-4'), '判断料も包括で却下される');
  ok(!monthlySample.lines.some((l) => l.kb === 'r08-D007-n1-ha'), '(I)の月次レセプトに検査の算定行は無い');
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

t('充実管理加算3(v53): 届出前は施設基準未適用で却下・届出後は(I)(II)×主病のセルで算定・担当者が欠けると適用から外れる', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.staff.clerks = 0;
  let st = DEPT.fsStatus(INTERNAL, dept).find((x) => x.fsId === 'r08-fs-b001-3-n4-3');
  ok(st && !st.ok && st.missing.length === 1, '医療事務0なら担当者の要件が欠ける');
  ok(st.gameNote, 'ゲーム独自ゲートの断り(gameNote)がある');
  const p = DEPT.addPatient(dept, 'ht', 1); p.fb = true;
  const r0 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu1Ht' }, { id: 'jujitsu3IHt' }] }, 1);
  ok(r0.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-n4-ro-3' && b.fsInfo && b.fsInfo.id === 'r08-fs-b001-3-n4-3'), '届出前は施設基準未適用で却下(届出導線つき)');
  dept.staff.clerks = 1;
  st = DEPT.fsStatus(INTERNAL, dept).find((x) => x.fsId === 'r08-fs-b001-3-n4-3');
  ok(st.ok && !st.notified, '要件充足=届出できる');
  dept.fs.push('r08-fs-b001-3-n4-3');
  const p2 = DEPT.addPatient(dept, 'dm', 1); p2.fb = true;
  const r1 = DEPT.evalVisit(INTERNAL, dept, p2, { type: 'revisit', kbActs: [{ id: 'seikatsu1Dm' }, { id: 'jujitsu3IDm' }] }, 1);
  eq(r1.ev.totalPoints, REIMB.pointsOf('r08-A001') + REIMB.pointsOf('r08-B001-3-1-dm') + REIMB.pointsOf('r08-B001-3-n4-ha-3'), '(I)糖尿病+加算3の合計はKBどおり');
  const p3 = DEPT.addPatient(dept, 'lipid', 1); p3.fb = true;
  const r2 = DEPT.evalVisit(INTERNAL, dept, p3, { type: 'revisit', kbActs: [{ id: 'seikatsu2' }, { id: 'jujitsu3IILipid' }] }, 1);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-3-n4-i-3'), '(II)脂質のセルで算定');
  dept.staff.clerks = 0;
  DEPT.runDay(INTERNAL, dept, ctx(2, rng(1), CLOSED));
  eq(dept.fs.includes('r08-fs-b001-3-n4-3'), false, '担当者が欠けると適用から外れる(fs_broken)');
});

t('充実管理加算3(v53): 届出済みの60日運用で管理料と同じ日に該当セルだけが乗り、月2回はいない。届出前は一切申請されない', () => {
  const run = (notify, plan) => {
    const dept = DEPT.create(INTERNAL, 1);
    dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3'); dept.policy.kanri = plan;
    if (notify) dept.fs.push('r08-fs-b001-3-n4-3');
    const rand = rng(11); const seen = {};
    for (let d = 1; d <= 60; d++) { const a = DEPT.runDay(INTERNAL, dept, ctx(d, rand)); for (const k of Object.keys(a.byItem)) seen[k] = (seen[k] || 0) + a.byItem[k].n; }
    return { dept, seen };
  };
  const a = run(false, 'I');
  ok(!Object.keys(a.seen).some((k) => k.includes('-n4-')), '届出前は加算セルが一つも算定されない');
  ok(!a.dept.last.sample.kb.rejected.some((x) => x.itemId.includes('-n4-')), '届出前は申請もしない(却下行に出ない)');
  const b = run(true, 'I');
  const cellsI = Object.keys(b.seen).filter((k) => k.startsWith('r08-B001-3-n4-'));
  ok(cellsI.length > 0 && cellsI.every((k) => k.endsWith('-3')), `(I)方針は(I)側の加算3セルのみ(${cellsI.join(',')})`);
  ok(!Object.keys(b.seen).some((k) => k.startsWith('r08-B001-3-3-n4-')), '(II)側のセルは出ない');
  for (const p of b.dept.pt) for (const k of Object.keys(p.mc)) if (k.includes('-n4-')) ok(p.mc[k] <= 1, '月2回はいない');
  const c = run(true, 'II');
  const cellsII = Object.keys(c.seen).filter((k) => k.includes('-n4-'));
  ok(cellsII.length > 0 && cellsII.every((k) => k.startsWith('r08-B001-3-3-n4-') && k.endsWith('-3')), `(II)方針は(II)側の加算3セルのみ(${cellsII.join(',')})`);
});

t('眼科医療機関連携強化加算(v53): 患者1人につき年1回 — 同年内の2回目は却下・12月後は再算定できる(limit.per:year)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'dm', 1); p.fb = true;
  const acts = [{ id: 'seikatsu1Dm' }, { id: 'eyeLiaisonI' }];
  const r1 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: acts }, 1);
  ok(r1.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-n5'), '初回は算定');
  eq(p.lb['r08-B001-3-n5'], 0, '年1回の項目はlbで最終算定月を追う');
  p.mc = {};  // 月替わり(runDayのrolloverに相当。本体(I)を月1回で通し、加算だけを年1回で見る)
  const r2 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: acts }, 1 + 30 * 5);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-1-dm'), '本体(I)は算定');
  ok(r2.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-n5'), '5月後は年1回で却下');
  p.mc = {};
  const r3 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: acts }, 1 + 30 * 12);
  ok(r3.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-n5'), '12月後は再算定できる');
  const p2 = DEPT.addPatient(dept, 'dm', 1); p2.fb = true;
  const r4 = DEPT.evalVisit(INTERNAL, dept, p2, { type: 'revisit', kbActs: [{ id: 'seikatsu2' }, { id: 'eyeLiaisonII' }] }, 1);
  eq(r4.ev.totalPoints, REIMB.pointsOf('r08-A001') + REIMB.pointsOf('r08-B001-3-3') + REIMB.pointsOf('r08-B001-3-3-n5'), '(II)側の連携強化加算もKBどおり');
});

t('眼科医療機関連携強化加算(v53): 紹介(rfo=1)の次回来院で受診状況を確認した日に申請し、rfoが2に進む。特定疾患処方管理加算は申請しない(rule-0025)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  dept.pt.length = 0;  // 引き継ぎ患者を外し、観察対象1人だけにする
  const p = DEPT.addPatient(dept, 'dm', 1, { iv: 28, rfo: 1 }); p.fb = true; p.nv = 1;
  const rand = rng(3);
  const agg = DEPT.runDay(INTERNAL, dept, ctx(1, rand));
  ok(agg.byItem['r08-B001-3-3-n5'] && agg.byItem['r08-B001-3-3-n5'].n === 1, '(II)方針の来院で連携強化加算(II)が1回算定される');
  eq(p.rfo, 2, '確認済み=2に進む');
  ok(agg.sample && agg.sample.label.endsWith('眼科の受診状況を確認'), '代表レセプトに確認の来院が出る');
  p.nv = 31;
  const agg2 = DEPT.runDay(INTERNAL, dept, ctx(31, rand));
  ok(!agg2.byItem['r08-B001-3-3-n5'], '翌月は申請しない(患者1人につき1回の運用)');
  ok(!agg.byItem['r08-F400-n4'] && !agg2.byItem['r08-F400-n4'], '特定疾患処方管理加算は出ない');
  ok(!agg.sample.kb.rejected.some((x) => x.itemId === 'r08-F400-n4'), '申請もしていない(却下行に出ない)');
});

t('親不在で却下された眼科医療機関連携強化加算は年1回の枠を消費しない(v53 PM条件・rule-0027)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.policy.keiji = true; dept.fs.push('r08-fs-b001-3');
  const p = DEPT.addPatient(dept, 'dm', 1); p.fb = true;
  p.lb['r08-B001-3-1-dm'] = 0;  // 当月に(I)を算定済み → (II)は6月窓で却下される
  const r1 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu2' }, { id: 'eyeLiaisonII' }] }, 31);
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-3'), '(II)本体は6月窓で却下');
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-B001-3-3-n5'), '加算も親不在で却下');
  eq(p.lb['r08-B001-3-3-n5'], undefined, '年1回の枠は消費されない(lbに残らない)');
  const r2 = DEPT.evalVisit(INTERNAL, dept, p, { type: 'revisit', kbActs: [{ id: 'seikatsu2' }, { id: 'eyeLiaisonII' }] }, 1 + 30 * 7);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-3') && r2.ev.billableItems.some((b) => b.itemId === 'r08-B001-3-3-n5'), '6月経過後の正当な受診で本体と加算が算定できる');
});

console.log('# 眼科部門');

t('屈折×矯正視力: 条件なしは片方却下・眼鏡処方の条件付きで併算定可(rule-0005)', () => {
  const dept = DEPT.create(OPHTHA, 1);
  const p1 = { pr: 'g', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r1 = DEPT.evalVisit(OPHTHA, dept, p1, { type: 'revisit', kbActs: [{ id: 'refraction' }, { id: 'vision' }] }, 1);
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-D263-1'), '条件なしは矯正視力が却下');
  const p2 = { pr: 'g', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r2 = DEPT.evalVisit(OPHTHA, dept, p2, { type: 'revisit', kbActs: [{ id: 'refraction' }, { id: 'vision' }], conditions: { refraction_first_or_glasses: true } }, 1);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-D261-2') && r2.ev.billableItems.some((b) => b.itemId === 'r08-D263-1'), '条件付きで両方算定');
});

t('白内障手術の点数はKBと一致し、施設基準の定めなしでも算定できる', () => {
  const dept = DEPT.create(OPHTHA, 1);
  const p = { pr: 'c', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r = DEPT.evalVisit(OPHTHA, dept, p, { type: 'revisit', kbActs: [{ id: 'cataractOp' }] }, 1);
  const op = r.ev.billableItems.find((b) => b.itemId === 'r08-K282-1-ro');
  ok(op, '算定される');
  eq(op.points, REIMB.pointsOf('r08-K282-1-ro'), '点数はKB由来');
});

t('OCT(眼底三次元画像解析)は月1回: 同月2回目は却下される(告示D256-2注)', () => {
  const dept = DEPT.create(OPHTHA, 1);
  const p = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r1 = DEPT.evalVisit(OPHTHA, dept, p, { type: 'revisit', kbActs: [{ id: 'oct' }] }, 1);
  const oct = r1.ev.billableItems.find((b) => b.itemId === 'r08-D256-2');
  ok(oct, '1回目は算定');
  eq(oct.points, REIMB.pointsOf('r08-D256-2'), '点数はKB由来');
  const r2 = DEPT.evalVisit(OPHTHA, dept, p, { type: 'revisit', kbActs: [{ id: 'oct' }] }, 8);
  ok(r2.ev.rejectedItems.some((b) => b.itemId === 'r08-D256-2'), '同月2回目は却下');
});

t('静的量的視野検査は両眼=片側×2単位で算定される', () => {
  const dept = DEPT.create(OPHTHA, 1);
  const p = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r = DEPT.evalVisit(OPHTHA, dept, p, { type: 'revisit', kbActs: [{ id: 'fieldStatic', units: 2 }] }, 1);
  const f = r.ev.billableItems.find((b) => b.itemId === 'r08-D260-2');
  ok(f, '算定される');
  eq(f.subtotal, REIMB.pointsOf('r08-D260-2') * 2, '両眼=片側の点数×2');
});

t('眼科学的検査(OCT・視野)の実施日は外来管理加算が却下される(A001注8・定める検査)', () => {
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-D256-2' }],
    facilityStandards: [], history: {},
  });
  ok(r.rejectedItems.some((b) => b.itemId === 'r08-A001-n8'), 'OCT実施日は外来管理加算が却下');
  const r2 = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-D260-2', units: 2 }],
    facilityStandards: [], history: {},
  });
  ok(r2.rejectedItems.some((b) => b.itemId === 'r08-A001-n8'), '視野検査実施日も却下');
});

t('手術設備なしでは手術パイプラインが動かない(ゲーム上のゲート)', () => {
  const dept = DEPT.create(OPHTHA, 1);
  const rand = rng(5);
  for (let d = 1; d <= 60; d++) DEPT.runDay(OPHTHA, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN));
  eq(dept.queue.preop + dept.queue.surgery + dept.queue.postop.length, 0, '手術キューは空のまま');
});

t('眼科120日運用: 収益は全てエンジン算定(概算ゼロ)', () => {
  const dept = DEPT.create(OPHTHA, 1);
  dept.equip.fundusSet = true; dept.equip.oct = true; dept.equip.field = true; dept.equip.surgery = true;
  const rand = rng(9);
  let revenue = 0, engineYen = 0, approxYen = 0, ops = 0;
  for (let d = 1; d <= 120; d++) {
    const agg = DEPT.runDay(OPHTHA, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN));
    revenue += agg.revenue; engineYen += agg.points * 10;
    approxYen += agg.approx.reduce((a, x) => a + x.yen, 0);
    ops += (agg.byItem['r08-K282-1-ro'] || { n: 0 }).n;
  }
  eq(approxYen, 0, '眼科に概算行はない');
  eq(revenue, engineYen, '収益=エンジン算定のみ');
  ok(ops > 0, `手術が実施される(${ops}件)`);
});

console.log('# 透析部門');

t('人工腎臓は施設区分1(届出)がないと算定できない', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  const p = dept.pt[0];
  const r1 = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }] }, 1);
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-J038-1-ro'), '未届出は却下');
  dept.fs.push('r08-fs-j038-1');
  const r2 = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }] }, 2);
  const hd = r2.ev.billableItems.find((b) => b.itemId === 'r08-J038-1-ro');
  ok(hd, '届出後は算定');
  eq(hd.points, REIMB.pointsOf('r08-J038-1-ro'), '点数はKB由来');
});

t('人工腎臓は月14回まで(15回目は患者単位で却下)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  const p = dept.pt[0];
  let rejected = 0;
  for (let i = 0; i < 15; i++) {
    const r = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }] }, 2 + i);
    if (r.ev.rejectedItems.some((b) => b.itemId === 'r08-J038-1-ro')) rejected++;
  }
  eq(p.mc['r08-J038-1-ro'], 14, '算定は14回で止まる');
  eq(rejected, 1, '15回目だけ却下');
});

t('導入期加算1・水質確保加算はそれぞれの届出があるときだけ算定される', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  const p = dept.pt[0];
  const r1 = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }, { id: 'induction' }, { id: 'waterQuality' }] }, 1);
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-J038-n2-i'), '導入期加算1は未届出で却下');
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-J038-n9'), '水質確保は未届出で却下');
  dept.fs.push('r08-fs-j038-donyuki1', 'r08-fs-j038-suishitsu');
  const r2 = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }, { id: 'induction' }, { id: 'waterQuality' }] }, 2);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-J038-n2-i'), '届出後は導入期加算が算定');
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-J038-n9'), '届出後は水質確保が算定');
});

t('便J: ダイアライザー(Ia型)は材料としてセッションごとに算定される(161点=1,610円/10)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  const p = dept.pt[0];
  const r = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }, { id: 'dialyzer' }, { id: 'monthlyMgmt' }] }, 2);
  const mat = r.ev.billableItems.find((b) => b.itemId === 'r08-t710010929');
  ok(mat, 'ダイアライザーが算定される');
  eq(mat.points, 161, '点数=材料価格1,610円を10円で除した161点');
  ok(r.ev.billableItems.some((b) => b.itemId === 'r08-B001-15'), '外来医学管理料と併算定できる(検査包括の対象外)');
  const r2 = DEPT.evalVisit(DIALYSIS, dept, p, { type: 'hd', kbActs: [{ id: 'hd' }, { id: 'dialyzer' }] }, 3);
  ok(r2.ev.billableItems.some((b) => b.itemId === 'r08-t710010929'), '翌セッションも算定される(回数制限なし)');
});

t('透析180日運用: 収益は全てエンジン算定・外来医学管理料は患者ごと月1回', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.policy.explain = true; dept.equip.water = true;
  dept.fs.push('r08-fs-j038-1', 'r08-fs-j038-donyuki1', 'r08-fs-j038-suishitsu');
  const rand = rng(11);
  let revenue = 0, engineYen = 0;
  for (let d = 1; d <= 180; d++) {
    const agg = DEPT.runDay(DIALYSIS, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN));
    revenue += agg.revenue; engineYen += agg.points * 10;
  }
  eq(revenue, engineYen, '収益=エンジン算定のみ(材料は原価側)');
  for (const p of dept.pt) ok(!p.mc['r08-B001-15'] || p.mc['r08-B001-15'] <= 1, '外来医学管理料は月1回まで');
  ok(dept.pt.length > 12, `患者が増える(${dept.pt.length}人)`);
});

t('装置26台でも患者/装置比3.5未満なら区分1のまま。比3.5以上で区分1を外れ、人工腎臓は届出不要の区分3で算定される(v55・第57の2の1(1)ア)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  dept.equip.beds = 26; dept.staff.nurses = 12;
  let agg = DEPT.runDay(DIALYSIS, dept, ctx(2, rng(3)));
  ok(!agg.events.some((e) => e.kind === 'fs_broken'), '12人/26台=比0.5は要件割れしない');
  ok(agg.byItem['r08-J038-1-ro'] && !agg.byItem['r08-J038-3-ro'], '区分1で算定');
  // 患者を増やして比3.5以上にする(26台×3.5=91人)
  while (dept.pt.length < 100) { dept.seq++; dept.pt.push({ id: 'dz' + dept.seq, pr: 'maintenance', en: 1, nv: 1, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: dept.seq % 2 }); }
  agg = DEPT.runDay(DIALYSIS, dept, ctx(3, rng(3)));
  ok(agg.events.some((e) => e.kind === 'fs_broken'), '比3.8で要件割れイベント');
  eq(dept.fs.includes('r08-fs-j038-1'), false, '区分1の適用から外れる');
  ok(!agg.byItem['r08-J038-1-ro'] && agg.byItem['r08-J038-3-ro'] && agg.byItem['r08-J038-3-ro'].n > 0, '人工腎臓は区分3で算定され続ける(算定できなくなるのではない)');
  eq(agg.byItem['r08-J038-3-ro'].pts / agg.byItem['r08-J038-3-ro'].n, REIMB.pointsOf('r08-J038-3-ro'), '点数はKB由来(区分3ロ)');
  eq(agg.info.kubun, 3, 'infoに区分3');
  ok(agg.sample && agg.sample.label.includes('区分3'), '代表レセプトのラベルに区分3');
});

t('3クール運用では3クール目のセッションだけに時間外・休日加算が乗る(v55・J038注1=午後5時以降開始とみなす)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  dept.equip.beds = 2; dept.staff.nurses = 6; dept.policy.cools = 3;
  dept.pt.length = 0;
  for (let i = 0; i < 8; i++) { dept.seq++; dept.pt.push({ id: 'dz' + dept.seq, pr: 'maintenance', en: 1, nv: 1, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: 0 }); }
  const agg = DEPT.runDay(DIALYSIS, dept, ctx(1, rng(5)));
  // 枠=floor(min(2×3, 6×4×3)×0.85)=5。添字0-1=1クール目・2-3=2クール目・4=3クール目
  eq(agg.info.seen, 5, '5セッション');
  eq(agg.info.overtime, 1, '3クール目は1セッション');
  ok(agg.byItem['r08-J038-n1'] && agg.byItem['r08-J038-n1'].n === 1, '時間外・休日加算は1件だけ');
  eq(agg.byItem['r08-J038-n1'].pts, REIMB.pointsOf('r08-J038-n1'), '点数はKB由来');
  dept.policy.cools = 2;
  const agg2 = DEPT.runDay(DIALYSIS, dept, ctx(3, rng(5)));
  ok(!agg2.byItem['r08-J038-n1'], '2クール運用では乗らない');
});

t('3クール目の判定は同時床数(装置と看護師×4床の小さい方)で割る — 12床・看護師2・3クールで3クール目は4件(v57・13g⑧の是正)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  dept.equip.beds = 12; dept.staff.nurses = 2; dept.policy.cools = 3;
  dept.pt.length = 0;
  for (let i = 0; i < 30; i++) { dept.seq++; dept.pt.push({ id: 'dz' + i, pr: 'maintenance', en: 1, nv: 1, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: 0 }); }
  const agg = DEPT.runDay(DIALYSIS, dept, ctx(1, () => 0.99));
  // 枠=floor(min(12×3, 2×4×3)×0.85)=20、同時床数=min(12, 8)=8 → 添字16〜19の4件が3クール目
  eq(agg.info.seen, 20, '20セッション');
  eq(agg.info.overtime, 4, '3クール目は4件(旧実装の添字/装置台数では0件)');
  eq(agg.byItem['r08-J038-n1'].n, 4, '時間外・休日加算も4件');
});

t('慢性維持透析濾過加算(オンラインHDF)は水処理設備で届け出られ、届出後は全セッションに乗る。届出前は申請もしない(v55・J038注13)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  let st = DEPT.fsStatus(DIALYSIS, dept).find((x) => x.fsId === 'r08-fs-j038-n13');
  ok(st && !st.ok && st.gameNote, '水処理設備が無いと届け出られない(gameNoteあり)');
  const a0 = DEPT.runDay(DIALYSIS, dept, ctx(2, rng(9)));
  ok(!a0.byItem['r08-J038-n13'] && !a0.sample.kb.rejected.some((x) => x.itemId === 'r08-J038-n13'), '届出前は算定も申請もない');
  dept.equip.water = true;
  st = DEPT.fsStatus(DIALYSIS, dept).find((x) => x.fsId === 'r08-fs-j038-n13');
  ok(st.ok, '水処理設備で要件充足');
  dept.fs.push('r08-fs-j038-suishitsu', 'r08-fs-j038-n13');
  const a1 = DEPT.runDay(DIALYSIS, dept, ctx(3, rng(9)));
  const hd = (a1.byItem['r08-J038-1-ro'] || { n: 0 }).n;
  ok(hd > 0 && a1.byItem['r08-J038-n13'] && a1.byItem['r08-J038-n13'].n === hd, '全セッションに濾過加算(件数=人工腎臓の件数)');
  ok(a1.byItem['r08-J038-n9'] && a1.byItem['r08-J038-n9'].n === hd, '水質確保加算も同数');
});

t('下肢末梢動脈疾患指導管理加算(v56): 届出前は申請せず、届出後は維持透析患者に月1回(導入期は除く)・親不在では通らない', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1'); dept.staff.nurses = 6;
  let st = DEPT.fsStatus(DIALYSIS, dept).find((x) => x.fsId === 'r08-fs-j038-n10');
  ok(st && !st.ok && st.missing.length === 1 && st.gameNote, '体制なしは要件不足(gameNoteあり)');
  const a0 = DEPT.runDay(DIALYSIS, dept, ctx(2, rng(4)));
  ok(!a0.byItem['r08-J038-n10'] && !a0.sample.kb.rejected.some((x) => x.itemId === 'r08-J038-n10'), '届出前は算定も申請もない');
  DIALYSIS.actions.find((a) => a.id === 'pad').apply(dept);
  ok(DEPT.fsStatus(DIALYSIS, dept).find((x) => x.fsId === 'r08-fs-j038-n10').ok, 'アクションで要件充足');
  dept.fs.push('r08-fs-j038-n10');
  const rand = rng(4); const seen = {};
  for (let d = 3; d <= 40; d++) { const a = DEPT.runDay(DIALYSIS, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN)); for (const k of Object.keys(a.byItem)) seen[k] = (seen[k] || 0) + a.byItem[k].n; }
  ok(seen['r08-J038-n10'] > 0, '届出後は算定される');
  for (const p of dept.pt) ok(!p.mc['r08-J038-n10'] || p.mc['r08-J038-n10'] <= 1, '患者ごと月1回まで(LIMITS経由でmcに積まれる)');
  const induction = dept.pt.filter((p) => p.du > 40);
  for (const p of induction) ok(!p.mc['r08-J038-n10'], '導入期の患者には申請しない');
});

t('透析時運動指導等加算(v56): 開始日から90日(開始日を含む)で切れる — ex+88日は申請・ex+90日は不申請', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1'); dept.policy.exercise = true; dept.staff.nurses = 6;
  dept.pt.length = 0;
  dept.seq++; dept.pt.push({ id: 'dz1', pr: 'maintenance', en: 1, nv: 1, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: 0 });
  const p = dept.pt[0];
  const noRef = () => 0.99;  // 新規紹介・離脱が起きない乱数(観察対象を1人に保つ)
  const a1 = DEPT.runDay(DIALYSIS, dept, ctx(1, noRef));
  eq(p.ex, 1, '初回に開始日が付く');
  ok(a1.byItem['r08-J038-n14'] && a1.byItem['r08-J038-n14'].n === 1 && a1.byItem['r08-J038-n14'].pts === REIMB.pointsOf('r08-J038-n14'), '開始日に算定(点数はKB)');
  eq(dept.pt.length, 1, '観察対象は1人のまま');
  // 隔日群so=0が来るのは ((day−1)%7)%2===0 の日: 89日目(ex+88)・91日目(ex+90)
  p.mc = {}; p.wc = {};
  const a89 = DEPT.runDay(DIALYSIS, dept, ctx(89, noRef));
  ok(a89.byItem['r08-J038-n14'] && a89.byItem['r08-J038-n14'].n === 1, 'ex+88日は申請');
  // ex+89(境界の内側)を固定: 開始日を2にずらして91日目(同群の来院日)=diff 89
  p.ex = 2; p.mc = {}; p.wc = {};
  const a89b = DEPT.runDay(DIALYSIS, dept, ctx(91, noRef));
  ok(a89b.byItem['r08-J038-n14'] && a89b.byItem['r08-J038-n14'].n === 1, 'ex+89日は申請(境界の内側)');
  p.ex = 1; p.mc = {}; p.wc = {};
  const a91 = DEPT.runDay(DIALYSIS, dept, ctx(91, noRef));
  eq(a91.info.seen, 1, '91日目もセッションはある');
  ok(!a91.byItem['r08-J038-n14'], 'ex+90日は申請しない');
  ok(!a91.sample.kb.rejected.some((x) => x.itemId === 'r08-J038-n14'), '申請自体をしない(却下行にも出ない)');
});

t('透析時運動指導等加算(v56): 1日の申請は看護師×8人まで。上限に達した日は新しい患者の指導を始めない(90日窓を無駄にしない)', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1'); dept.policy.exercise = true; dept.staff.nurses = 2; dept.equip.beds = 8; dept.policy.cools = 3;
  dept.pt.length = 0;
  for (let i = 0; i < 24; i++) { dept.seq++; dept.pt.push({ id: 'dz' + i, pr: 'maintenance', en: 1, nv: 1, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: 0 }); }
  const agg = DEPT.runDay(DIALYSIS, dept, ctx(1, rng(7)));
  // 枠=floor(min(8×3, 2×4×3)×0.85)=20セッション、上限=2×8=16
  eq(agg.info.seen, 20, '20セッション');
  eq(agg.info.exercise, 16, '運動指導は16件で止まる');
  eq(agg.byItem['r08-J038-n14'].n, 16, '算定も16件');
  eq(dept.pt.filter((p) => p.ex !== undefined).length, 16, '開始日が付くのは指導した16人だけ');
  dept.policy.exercise = false;
  const agg2 = DEPT.runDay(DIALYSIS, dept, ctx(3, rng(7)));
  ok(!agg2.byItem['r08-J038-n14'], '方針OFFでは申請しない');
});

console.log('# 在宅部門');

/* ゲーム側ctx(地区割当・ルート順)のスタブ */
function hcCtx(dept, day, rand, spec) {
  const counts = {};
  for (const p of dept.pt) counts[p.cl] = (counts[p.cl] || 0) + 1;
  return Object.assign(ctx(day, rand, spec), {
    homecareCap: 84,
    assignCluster: () => { for (let i = 0; i < 12; i++) if ((counts[i] || 0) < 7) { counts[i] = (counts[i] || 0) + 1; return i; } return null; },
    releaseCluster: (i) => { counts[i] = Math.max(0, (counts[i] || 0) - 1); },
    orderByRoute: (due) => due.map((p, i) => ({ p, travelMin: i === 0 ? 8 : 3 })),
  });
}

t('訪問診療の算定日は往診料が却下される(rule-0008)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  const p = { pr: 'home', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r = DEPT.evalVisit(HOMECARE, dept, p, { type: 'visit', kbActs: [{ id: 'visit' }, { id: 'oushin' }] }, 1);
  ok(r.ev.billableItems.some((b) => b.itemId === 'r08-C001-1-i'), '訪問診療は算定');
  ok(r.ev.rejectedItems.some((b) => b.itemId === 'r08-C000'), '同日の往診料は却下');
});

t('訪問診療は週3回まで(4回目は患者単位で却下)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  const p = { pr: 'home', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  let rejected = 0;
  for (let i = 0; i < 4; i++) {
    const r = DEPT.evalVisit(HOMECARE, dept, p, { type: 'visit', kbActs: [{ id: 'visit' }] }, 2 + i);
    if (r.ev.rejectedItems.some((b) => b.itemId === 'r08-C001-1-i')) rejected++;
  }
  eq(p.wc['r08-C001-1-i'], 3, '週3回で止まる');
  eq(rejected, 1, '4回目だけ却下');
});

t('在医総管は在支診の届出がないと却下・届出後は月1回算定できる', () => {
  const dept = DEPT.create(HOMECARE, 1);
  const p = { pr: 'home', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r1 = DEPT.evalVisit(HOMECARE, dept, p, { type: 'visit', kbActs: [{ id: 'visit' }, { id: 'zaiisoukan' }] }, 1);
  ok(r1.ev.rejectedItems.some((b) => b.itemId === 'r08-C002-2-ro-1'), '未届出は却下');
  dept.fs.push('r08-fs-zaishien');
  const r2 = DEPT.evalVisit(HOMECARE, dept, p, { type: 'visit', kbActs: [{ id: 'visit' }, { id: 'zaiisoukan' }] }, 3);
  const sk = r2.ev.billableItems.find((b) => b.itemId === 'r08-C002-2-ro-1');
  ok(sk, '届出後は算定');
  eq(sk.points, REIMB.pointsOf('r08-C002-2-ro-1'), '点数はKB由来');
  const r3 = DEPT.evalVisit(HOMECARE, dept, p, { type: 'visit', kbActs: [{ id: 'visit' }, { id: 'zaiisoukan' }] }, 10);
  ok(r3.ev.rejectedItems.some((b) => b.itemId === 'r08-C002-2-ro-1'), '同月2回目は却下');
});

t('マンション地区(同一建物)の在医総管は人数セルで算定される(v50・rule-0018)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien');
  dept.sd = 1; // シードを飛ばす
  // マンション地区(cl=12・24戸)に4人(10%=2.4を超える→2〜9人セル)。期日は当日・月内2回目(mv=1)
  for (let i = 0; i < 4; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hm' + i, pr: 'home', en: 1, nv: 20, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: 12, iv: 15, sj: 0, mv: 1, mvm: 0 });
  }
  const mctx = Object.assign(hcCtx(dept, 20, rng(4)), {
    siteInfo: (i) => (i === 12 ? { x: 15, y: 15, mansion: true, units: 24 } : { x: 0, y: 0 }),
  });
  const agg = DEPT.runDay(HOMECARE, dept, mctx);
  const cell = agg.byItem['r08-C002-2-ro-2'];
  ok(cell && cell.n === 4, `4人全員が2〜9人セルで算定(実際${cell ? cell.n : 0}件)`);
  eq(agg.byItem['r08-C002-2-ro-1'], undefined, '1人セルは使われない');
});

t('マンション地区でも2人以下はみなし1人セル(24戸の10%以下・rule-0018例外)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien');
  dept.sd = 1;
  for (let i = 0; i < 2; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hm2' + i, pr: 'home', en: 1, nv: 20, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: 12, iv: 15, sj: 0, mv: 1, mvm: 0 });
  }
  const mctx = Object.assign(hcCtx(dept, 20, rng(4)), {
    siteInfo: (i) => (i === 12 ? { x: 15, y: 15, mansion: true, units: 24 } : { x: 0, y: 0 }),
  });
  const agg = DEPT.runDay(HOMECARE, dept, mctx);
  const cell = agg.byItem['r08-C002-2-ro-1'];
  ok(cell && cell.n === 2, `2人とも1人セルで算定(実際${cell ? cell.n : 0}件)`);
});

t('マンションで同日2人を回る日は訪問診療料がロ(同一建物居住者)になる(v51・#25解消)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien');
  dept.sd = 1;
  for (let i = 0; i < 2; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hv' + i, pr: 'home', en: 1, nv: 20, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: 12, iv: 15, sj: 0, mv: 0, mvm: 0 });
  }
  const mctx = Object.assign(hcCtx(dept, 20, rng(4)), {
    siteInfo: (i) => (i === 12 ? { x: 15, y: 15, mansion: true, units: 24 } : { x: 0, y: 0 }),
  });
  const agg = DEPT.runDay(HOMECARE, dept, mctx);
  const ro = agg.byItem['r08-C001-1-ro'];
  ok(ro && ro.n === 2, `2人ともロで算定(実際${ro ? ro.n : 0}件)`);
  eq(agg.byItem['r08-C001-1-i'], undefined, 'イは使われない');
});

t('繰越で建物内が1人になった日はイ(実訪問集合で判定=2パスの境界)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien');
  dept.sd = 1;
  for (let i = 0; i < 2; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hd' + i, pr: 'home', en: 1, nv: 20, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: 12, iv: 15, sj: 0, mv: 0, mvm: 0 });
  }
  // 2人目の移動時間を枠超過にして繰越させる(480分枠: 1人目は8+25分・2人目は460分で超過)
  const mctx = Object.assign(hcCtx(dept, 20, rng(4)), {
    siteInfo: (i) => (i === 12 ? { x: 15, y: 15, mansion: true, units: 24 } : { x: 0, y: 0 }),
    orderByRoute: (due) => due.map((p, i) => ({ p, travelMin: i === 0 ? 8 : 460 })),
  });
  const agg = DEPT.runDay(HOMECARE, dept, mctx);
  eq(agg.info.deferred, 1, '1人は繰越');
  const iCell = agg.byItem['r08-C001-1-i'];
  ok(iCell && iCell.n === 1, `回れた1人はイで算定(実際${iCell ? iCell.n : 0}件)`);
  eq(agg.byItem['r08-C001-1-ro'], undefined, 'ロは使われない');
});

t('在宅療養実績加算2の届出で、在医総管と同じ人数区分の加算が乗る(v52・#26)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien', 'r08-fs-c002-n7-jisseki2');
  dept.sd = 1;
  for (let i = 0; i < 4; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hk' + i, pr: 'home', en: 1, nv: 20, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: 12, iv: 15, sj: 0, mv: 1, mvm: 0 });
  }
  const mctx = Object.assign(hcCtx(dept, 20, rng(4)), {
    siteInfo: (i) => (i === 12 ? { x: 15, y: 15, mansion: true, units: 24 } : { x: 0, y: 0 }),
  });
  const agg = DEPT.runDay(HOMECARE, dept, mctx);
  const ha2 = agg.byItem['r08-C002-n7-ha-2'];
  ok(ha2 && ha2.n === 4, `4人全員に実績加算2(2〜9人)が乗る(実際${ha2 ? ha2.n : 0}件)`);
  eq(ha2.pts / ha2.n, REIMB.pointsOf('r08-C002-n7-ha-2'), '点数はKB由来');
});

t('実績加算1と2の両方を届け出た場合は1(点数の高い側)だけが乗る', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien', 'r08-fs-c002-n7-jisseki2', 'r08-fs-c002-n7-jisseki1', 'r08-fs-c002-n13');
  dept.sd = 1;
  dept.seq++;
  dept.pt.push({ id: 'hk9', pr: 'home', en: 1, nv: 20, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: 0, iv: 15, sj: 0, mv: 1, mvm: 0 });
  const agg = DEPT.runDay(HOMECARE, dept, hcCtx(dept, 20, rng(4)));
  ok(agg.byItem['r08-C002-n7-ro-1'], '実績加算1(1人)が乗る');
  eq(agg.byItem['r08-C002-n7-ha-1'], undefined, '実績加算2は乗らない(二重計上なし)');
  ok(agg.byItem['r08-C002-n13'], 'データ提出加算も同時に乗る');
});

t('実績加算は施設基準の届出なしではエンジンが却下する(required)', () => {
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'visit' },
    procedures: [{ itemId: 'r08-C002-2-ro-1' }, { itemId: 'r08-C002-n7-ro-1' }],
    facilityStandards: ['r08-fs-zaishien'], history: {},
  });
  ok(r.rejectedItems.some((b) => b.itemId === 'r08-C002-n7-ro-1'), '届出なしは却下');
  ok(r.billableItems.some((b) => b.itemId === 'r08-C002-2-ro-1'), '本体は算定される');
});

t('同月に人数区分が変わっても在医総管と実績加算は1回だけ(v52 PM条件1=本体セル群ゲート)', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien', 'r08-fs-c002-n7-jisseki2');
  dept.sd = 1;
  // 患者0は月初にみなし1人セル(ro-1)+実績加算(ha-1)を算定済み。その後同じ建物が4人に増えた
  const billed = { 'r08-C002-2-ro-1': 1, 'r08-C002-n7-ha-1': 1 };
  for (let i = 0; i < 4; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hg' + i, pr: 'home', en: 1, nv: 25, sv: 0, mc: i === 0 ? billed : {}, wc: {}, lb: {}, fb: true, cl: 12, iv: 15, sj: 0, mv: 1, mvm: 0 });
  }
  const mctx = Object.assign(hcCtx(dept, 25, rng(4)), {
    siteInfo: (i) => (i === 12 ? { x: 15, y: 15, mansion: true, units: 24 } : { x: 0, y: 0 }),
  });
  const agg = DEPT.runDay(HOMECARE, dept, mctx);
  eq((agg.byItem['r08-C002-2-ro-2'] || { n: 0 }).n, 3, '本体は未算定の3人だけ(算定済み患者は再申請しない)');
  eq((agg.byItem['r08-C002-n7-ha-2'] || { n: 0 }).n, 3, '加算も未算定の3人だけ(区分またぎの二重計上なし)');
});

t('在宅180日運用: 収益は全てエンジン算定・在医総管は月2回目の訪問後だけ申請される', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.policy.oncall = true;
  dept.fs.push('r08-fs-zaishien');
  const rand = rng(31);
  let revenue = 0, engineYen = 0;
  for (let d = 1; d <= 180; d++) {
    const spec = d % 7 === 0 ? CLOSED : OPEN;
    const agg = DEPT.runDay(HOMECARE, dept, hcCtx(dept, d, rand, spec));
    revenue += agg.revenue; engineYen += agg.points * 10;
  }
  eq(revenue, engineYen, '収益=エンジン算定のみ(概算なし)');
  ok(dept.pt.length > 10, `患者が増える(${dept.pt.length}人)`);
  for (const p of dept.pt) {
    ok(!p.mc['r08-C002-2-ro-1'] || p.mc['r08-C002-2-ro-1'] <= 1, '在医総管は月1回まで');
    ok(!p.mc['r08-C007'] || p.mc['r08-C007'] <= 1, '訪問看護指示料は月1回まで');
  }
});

t('1日の訪問枠(移動+診療時間)を超えた分は翌日に繰り越される', () => {
  const dept = DEPT.create(HOMECARE, 1);
  dept.fs.push('r08-fs-zaishien');
  // 期日の来た患者を大量に用意(枠は480分/医師1人 → 25分+移動で最大18件前後)
  for (let i = 0; i < 40; i++) {
    dept.seq++;
    dept.pt.push({ id: 'hcx' + i, pr: 'home', en: 1, nv: 5, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, cl: i % 12, iv: 15, sj: 0 });
  }
  dept.sd = 1; // シードを飛ばす
  const agg = DEPT.runDay(HOMECARE, dept, hcCtx(dept, 5, rng(2)));
  ok(agg.info.visits < 40, `全件は回れない(実際${agg.info.visits}件)`);
  ok(agg.info.deferred > 0, `繰越が出る(${agg.info.deferred}件)`);
  ok(agg.info.visits + agg.info.deferred >= 40 - 5, '回った+繰越で概ね全件を説明できる');
});

console.log('# 精神科・心療内科部門');

t('通院精神療法・心身医学療法の点数はKBと一致する', () => {
  const dept = DEPT.create(PSYCH, 1);
  const p = { pr: 'mood', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r1 = DEPT.evalVisit(PSYCH, dept, p, { type: 'revisit', kbActs: [{ id: 'i002Long' }] }, 1);
  eq(r1.ev.billableItems.find((b) => b.itemId === 'r08-I002-1-ha-1-1').points, REIMB.pointsOf('r08-I002-1-ha-1-1'));
  const p2 = { pr: 'shinshin', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r2 = DEPT.evalVisit(PSYCH, dept, p2, { type: 'revisit', kbActs: [{ id: 'i004Revisit' }] }, 1);
  eq(r2.ev.billableItems.find((b) => b.itemId === 'r08-I004-2-ro').points, REIMB.pointsOf('r08-I004-2-ro'));
});

t('初診60分のセルは同一初診に1回だけ(初診料と同じ追跡)', () => {
  const dept = DEPT.create(PSYCH, 1);
  const p = { pr: 'mood', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
  const r1 = DEPT.evalVisit(PSYCH, dept, p, { type: 'first', kbActs: [{ id: 'i002FirstLong' }] }, 1);
  ok(r1.ev.billableItems.some((b) => b.itemId === 'r08-I002-1-ro-1-1'), '初診日は算定');
  const r2 = DEPT.evalVisit(PSYCH, dept, p, { type: 'revisit', kbActs: [{ id: 'i002FirstLong' }] }, 10);
  ok(r2.ev.rejectedItems.some((b) => b.itemId === 'r08-I002-1-ro-1-1'), '再診では却下');
});

t('通院精神療法は週1回まで(同週2回目は却下)', () => {
  const dept = DEPT.create(PSYCH, 1);
  const p = { pr: 'mood', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  DEPT.evalVisit(PSYCH, dept, p, { type: 'revisit', kbActs: [{ id: 'i002Std' }] }, 8);
  const r = DEPT.evalVisit(PSYCH, dept, p, { type: 'revisit', kbActs: [{ id: 'i002Std' }] }, 10);
  ok(r.ev.rejectedItems.some((b) => b.itemId === 'r08-I002-1-ha-2-1'), '同週2回目は却下');
});

t('通院精神療法の算定日は外来管理加算が却下される(A001注8の精神科専門療法)', () => {
  const dept = DEPT.create(PSYCH, 1);
  const p = { pr: 'anxiety', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
  const r = DEPT.evalVisit(PSYCH, dept, p, { type: 'revisit', kbActs: [{ id: 'i002Std' }, { id: 'kanri' }, { id: 'presc' }] }, 1);
  ok(r.ev.billableItems.some((b) => b.itemId === 'r08-I002-1-ha-2-1'), '通院精神療法は算定');
  ok(r.ev.rejectedItems.some((b) => b.itemId === 'r08-A001-n8'), '外来管理加算は却下');
  ok(r.ev.billableItems.some((b) => b.itemId === 'r08-F400-3'), '処方箋料は算定できる');
});

t('精神科180日運用: 収益は全てエンジン算定・I002患者とI004患者が混ざらない(rule-0010の運用)', () => {
  const dept = DEPT.create(PSYCH, 1);
  const rand = rng(51);
  let revenue = 0, engineYen = 0;
  for (let d = 1; d <= 180; d++) {
    const agg = DEPT.runDay(PSYCH, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN));
    revenue += agg.revenue; engineYen += agg.points * 10;
  }
  eq(revenue, engineYen, '収益=エンジン算定のみ(概算なし)');
  ok(dept.pt.length > 60, `名簿が育つ(${dept.pt.length}人)`);
  for (const p of dept.pt) {
    const hasI002 = Object.keys(p.wc).concat(Object.keys(p.mc)).some((k) => k.indexOf('r08-I002') === 0);
    const hasI004 = Object.keys(p.wc).concat(Object.keys(p.mc)).some((k) => k.indexOf('r08-I004') === 0);
    ok(!(hasI002 && hasI004), '同一患者にI002とI004が混在しない');
  }
});

t('30分以上の方針は1日の診察枠を圧迫し、超えた分は翌日へ繰り越される', () => {
  const dept = DEPT.create(PSYCH, 1);
  dept.policy.timePlan = 'long';
  for (let i = 0; i < 30; i++) {
    dept.seq++;
    dept.pt.push({ id: 'psx' + i, pr: 'mood', en: 1, nv: 8, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, iv: 14 });
  }
  const agg = DEPT.runDay(PSYCH, dept, ctx(8, rng(3)));
  ok(agg.info.usedMin <= agg.info.budgetMin, '枠を超えない');
  ok(agg.info.deferred > 0, `繰越が出る(${agg.info.deferred}件)`);
});

t('早期診療体制充実加算3(v54): 届出前はfs未適用で却下・要件(PSW1名+連携病院)充足で届出でき・届出後は通院精神療法と同日にKB点数で乗る', () => {
  const dept = DEPT.create(PSYCH, 1);
  let st = DEPT.fsStatus(PSYCH, dept).find((x) => x.fsId === 'r08-fs-i002-n11-3');
  ok(st && !st.ok && st.missing.length === 2 && st.gameNote, '初期はPSWと連携病院の2つが欠け、gameNoteがある');
  const p = { pr: 'mood', mc: {}, wc: {}, lb: {}, fb: true, sv: 0, en: 1 };
  const r0 = DEPT.evalVisit(PSYCH, dept, p, { type: 'revisit', kbActs: [{ id: 'i002Std' }, { id: 'n11ha1' }] }, 1);
  ok(r0.ev.rejectedItems.some((b) => b.itemId === 'r08-I002-n11-ha-1' && b.fsInfo && b.fsInfo.id === 'r08-fs-i002-n11-3'), '届出前は施設基準未適用で却下(届出導線つき)');
  dept.staff.psws = 1;
  const act = PSYCH.actions.find((a) => a.id === 'renkei');
  ok(act.can(dept), '協定アクションは未実施なら実行できる'); act.apply(dept); ok(!act.can(dept), '実施後は出ない');
  st = DEPT.fsStatus(PSYCH, dept).find((x) => x.fsId === 'r08-fs-i002-n11-3');
  ok(st.ok && !st.notified, '要件充足=届出できる');
  dept.fs.push('r08-fs-i002-n11-3');
  const p2 = { pr: 'anxiety', mc: {}, wc: {}, lb: {}, fb: true, sv: 0, en: 1 };
  const r1 = DEPT.evalVisit(PSYCH, dept, p2, { type: 'revisit', kbActs: [{ id: 'i002Std' }, { id: 'n11ha1' }, { id: 'presc' }] }, 8);
  eq(r1.ev.totalPoints, REIMB.pointsOf('r08-A001') + REIMB.pointsOf('r08-I002-1-ha-2-1') + REIMB.pointsOf('r08-I002-n11-ha-1') + REIMB.pointsOf('r08-F400-3'), '再診+通院精神療法+加算3(3年以内)+処方箋料');
  dept.staff.psws = 0;
  DEPT.runDay(PSYCH, dept, ctx(9, rng(1), CLOSED));
  eq(dept.fs.includes('r08-fs-i002-n11-3'), false, 'PSWが欠けると適用から外れる(fs_broken)');
});

t('早期診療体制充実加算3(v54): 届出済みの運用では通院精神療法の全件に1セルだけ乗り、心身医学療法には乗らない。届出前は申請もしない', () => {
  const run = (notify) => {
    const dept = DEPT.create(PSYCH, 1);
    dept.staff.psws = 1; dept.policy.renkei = true;
    if (notify) dept.fs.push('r08-fs-i002-n11-3');
    const rand = rng(21); const seen = {};
    let lastSample = null;
    for (let d = 1; d <= 60; d++) { const a = DEPT.runDay(PSYCH, dept, ctx(d, rand)); for (const k of Object.keys(a.byItem)) seen[k] = (seen[k] || 0) + a.byItem[k].n; if (a.sample) lastSample = a.sample; }
    return { seen, lastSample };
  };
  const a = run(false);
  ok(!Object.keys(a.seen).some((k) => k.includes('-n11-')), '届出前は加算セルが算定されない');
  ok(!a.lastSample.kb.rejected.some((x) => x.itemId.includes('-n11-')), '届出前は申請もしない(却下行に出ない)');
  const b = run(true);
  const i002 = Object.keys(b.seen).filter((k) => k.startsWith('r08-I002-1-')).reduce((s, k) => s + b.seen[k], 0);
  eq(b.seen['r08-I002-n11-ha-1'], i002, '加算3(3年以内)の件数=通院精神療法の件数(全件に1セル)');
  eq(b.seen['r08-I002-n11-ha-2'], undefined, '60日運用では3年超のセルは出ない');
  ok(!Object.keys(b.seen).some((k) => k.startsWith('r08-I002-n11-i') || k.startsWith('r08-I002-n11-ro')), '加算1・2のセルは出ない(写しのみ)');
});

t('早期診療体制充実加算3(v54): 最初に受診した日(p.en)から1080日(36月)以降は3年超のセルに切り替わる', () => {
  const dept = DEPT.create(PSYCH, 1);
  dept.staff.psws = 1; dept.policy.renkei = true; dept.fs.push('r08-fs-i002-n11-3');
  dept.pt.length = 0;
  const mk = (id, nv) => { dept.seq++; dept.pt.push({ id, pr: 'mood', en: 1, nv, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, iv: 14 }); };
  mk('py1', 1079);
  const a1 = DEPT.runDay(PSYCH, dept, ctx(1079, rng(2)));
  ok(a1.byItem['r08-I002-n11-ha-1'] && !a1.byItem['r08-I002-n11-ha-2'], '1079日目は3年以内のセル');
  dept.pt.length = 0; mk('py2', 1081);
  const a2 = DEPT.runDay(PSYCH, dept, ctx(1081, rng(2)));
  ok(a2.byItem['r08-I002-n11-ha-2'] && a2.byItem['r08-I002-n11-ha-2'].n === 1, '1081日目の当該患者は3年超のセル(同日に初来院した新規患者は3年以内のセルで別計上)');
  eq(a2.byItem['r08-I002-n11-ha-2'].pts, REIMB.pointsOf('r08-I002-n11-ha-2'), '点数はKB由来');
});

console.log('# 法人シナジー(部門間紹介)');

t('内科→眼科: 糖尿病患者の眼底紹介の意図が積まれ、B009は特別の関係で却下される(法人内に眼科あり)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.pt = [{ id: 'x1', pr: 'dm', en: 1, nv: 5, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, iv: 28 }];
  const c = ctx(5, () => 0); // rand=0: 紹介ロール(<1/12)が必ず成立
  c.hasDept = () => true;
  const agg = DEPT.runDay(INTERNAL, dept, c);
  ok(agg.referrals.some((r) => r.to === 'ophthalmology' && r.profile === 'dm-retino'), '紹介の意図(眼科・dm-retino)');
  ok(dept.pt[0].rfo === 1, '紹介済みフラグ(一度きり)');
  const s = agg.sample;
  ok(s && s.kb && s.kb.rejected.some((x) => x.itemId === 'r08-B009-1'), 'B009は却下される');
  const rej = s.kb.rejected.find((x) => x.itemId === 'r08-B009-1');
  ok(rej.reasons.join('').includes('特別の関係'), `却下理由に特別の関係(${rej.reasons[0]})`);
  ok(!Object.keys(agg.byItem).includes('r08-B009-1'), '収益には載らない');
});

t('内科→他院: 法人内に眼科が無ければB009は算定できる(告示注1どおり)', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.pt = [{ id: 'x2', pr: 'dm', en: 1, nv: 5, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, iv: 28 }];
  const c = ctx(5, () => 0);
  c.hasDept = () => false;
  const agg = DEPT.runDay(INTERNAL, dept, c);
  ok(agg.byItem['r08-B009-1'] && agg.byItem['r08-B009-1'].pts === REIMB.pointsOf('r08-B009-1'), 'B009が算定される(点数はKB)');
  ok(agg.referrals.length >= 1, '紹介の意図は同様に積まれる(他院への経路付けはゲーム側)');
});

t('紹介は一度きり: 同じ患者の次回来院では紹介もB009申請も起きない', () => {
  const dept = DEPT.create(INTERNAL, 1);
  dept.pt = [{ id: 'x3', pr: 'dm', en: 1, nv: 5, sv: 0, mc: {}, wc: {}, lb: {}, fb: true, iv: 28 }];
  const c = ctx(5, () => 0); c.hasDept = () => true;
  DEPT.runDay(INTERNAL, dept, c);
  dept.pt[0].nv = 40; dept.pt[0].mc = {};
  const c2 = ctx(40, () => 0); c2.hasDept = () => true;
  const agg2 = DEPT.runDay(INTERNAL, dept, c2);
  ok(agg2.referrals.filter((r) => r.to === 'ophthalmology').length === 0, '既紹介患者からの再紹介なし');
  const s2 = agg2.sample;
  ok(!(s2 && s2.kb && s2.kb.rejected.some((x) => x.itemId === 'r08-B009-1')), '2回目の来院ではB009を申請しない');
});

console.log(failed ? `\nNG: ${failed}/${n} 失敗` : `\n全${n}件 合格`);
process.exit(failed ? 1 : 0);
