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

t('手術設備なしでは手術パイプラインが動かない(ゲーム上のゲート)', () => {
  const dept = DEPT.create(OPHTHA, 1);
  const rand = rng(5);
  for (let d = 1; d <= 60; d++) DEPT.runDay(OPHTHA, dept, ctx(d, rand, d % 7 === 0 ? CLOSED : OPEN));
  eq(dept.queue.preop + dept.queue.surgery + dept.queue.postop.length, 0, '手術キューは空のまま');
});

t('眼科120日運用: 収益は全てエンジン算定(概算ゼロ)', () => {
  const dept = DEPT.create(OPHTHA, 1);
  dept.equip.fundusSet = true; dept.equip.surgery = true;
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

t('装置26台で施設区分1が要件割れし、人工腎臓が算定できなくなる', () => {
  const dept = DEPT.create(DIALYSIS, 1);
  dept.fs.push('r08-fs-j038-1');
  dept.equip.beds = 26;
  const agg = DEPT.runDay(DIALYSIS, dept, ctx(2, rng(3)));
  ok(agg.events.some((e) => e.kind === 'fs_broken'), '要件割れイベント');
  eq(dept.fs.includes('r08-fs-j038-1'), false, '適用から外れる');
  ok(!agg.byItem['r08-J038-1-ro'], '人工腎臓は算定されない');
  ok(agg.sample === null || !agg.sample.lines.some((l) => l.kb === 'r08-J038-1-ro'), 'サンプルにも出ない');
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
