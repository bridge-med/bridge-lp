/* 精神科・心療内科(v82 便AF-3)の planVisit 抽出テスト: モジュールの planVisit → DEPT.evalVisit を
 * 本院の常連レコードと同じ形(mc/wc/lb/fb/pr/en)で回す。
 * 実行: node clinic-flow-3d/tests/main-psych.test.mjs。点数はKBパック経由で読み、このファイルに書かない。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const PSY = require(join(ROOT, 'app', 'specialties', 'psychiatry.js'));
REIMB.init(KB); DEPT.init(REIMB, KB);

let n = 0, failed = 0;
function t(name, fn) { n++; try { fn(); console.log(`  ok ${n} - ${name}`); } catch (e) { failed++; console.log(`  NG ${n} - ${name}\n      ${e.message}`); } }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期待=${JSON.stringify(b)} 実際=${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'falsy'); }
const has = (lines, id) => lines.some((l) => l.kb === id);
const act = (v, id) => v.report.kbActs.some((a) => a.id === id);
const always = () => 0.01, never = () => 0.99;   // 0.01=30分以上にする/処方あり、0.99=その逆
const P = PSY.managementParameters;
// 本院の shim(game.js mainDeptShim と同形): policy と fs は settings 由来の参照
function shim(policy, fs, staff) { return { id: 'psychiatry', policy: policy || {}, fs: fs || [], staff: Object.assign({ doctors: 1, nurses: 0, psws: 1 }, staff || {}), equip: {}, pt: [] }; }
function rec(pr, fb, en) { return { pr, mc: {}, wc: {}, lb: {}, fb: !!fb, sv: 0, en: en === undefined ? 1 : en }; }
function visit(p, policy, fs, rand, day) {
  const v = PSY.planVisit(p, policy || {}, fs || [], rand || never, () => false, {}, { day: day || 1 });
  const r = DEPT.evalVisit(PSY, shim(policy, fs), p, v.report, day || 1);
  return { v, r };
}

t('pickProfile は3プロファイルのどれかを返し、重みの境目で切り替わる', () => {
  eq(PSY.pickProfile(() => 0.1), 'mood'); eq(PSY.pickProfile(() => 0.6), 'anxiety'); eq(PSY.pickProfile(() => 0.9), 'shinshin');
  const ids = PSY.patientProfiles.map((x) => x.id);
  for (const r of [0, 0.25, 0.55, 0.99]) ok(ids.includes(PSY.pickProfile(() => r)));
});
t('profileKind: 気分障害・不安障害は通院精神療法、心身症は心身医学療法の系統', () => {
  eq(PSY.profileKind('mood'), 'i002'); eq(PSY.profileKind('anxiety'), 'i002'); eq(PSY.profileKind('shinshin'), 'i004');
});

t('std(30分未満が基本)の初診: 30分以上60分未満のセル・needMin=stdFirst。再診は30分未満のセル・needMin=stdRevisit', () => {
  const a = visit(rec('mood', false), { timePlan: 'std' }, [], never);
  ok(a.v.isFirst && !a.v.long); eq(a.v.needMin, P.visitMin.stdFirst);
  ok(act(a.v, 'i002FirstStd') && has(a.r.lines, 'r08-A000') && has(a.r.lines, 'r08-I002-1-ro-2'), '初診料+初診30分以上60分未満');
  const b = visit(rec('anxiety', true), { timePlan: 'std' }, [], never);
  eq(b.v.needMin, P.visitMin.stdRevisit);
  ok(act(b.v, 'i002Std') && has(b.r.lines, 'r08-A001') && has(b.r.lines, 'r08-I002-1-ha-2-1'), '再診料+30分未満');
});
t('long(全員30分以上)の初診: 60分以上のセル・needMin=longFirst。再診は30分以上のセル・needMin=longRevisit', () => {
  const a = visit(rec('mood', false), { timePlan: 'long' }, [], never);
  ok(a.v.long); eq(a.v.needMin, P.visitMin.longFirst);
  ok(act(a.v, 'i002FirstLong') && has(a.r.lines, 'r08-I002-1-ro-1-1'), '初診60分以上');
  const b = visit(rec('mood', true), { timePlan: 'long' }, [], never);
  eq(b.v.needMin, P.visitMin.longRevisit);
  ok(act(b.v, 'i002Long') && has(b.r.lines, 'r08-I002-1-ha-1-1'), '再診30分以上');
});
t('mix(必要に応じて30分以上): 乱数が閾値未満の来院だけ30分以上のセルになる。longは乱数を引かない', () => {
  const lo = PSY.planVisit(rec('mood', true), { timePlan: 'mix' }, [], () => P.mixLongShare - 0.001, () => false, {}, {});
  ok(lo.long && lo.needMin === P.visitMin.longRevisit && lo.report.kbActs.some((a) => a.id === 'i002Long'));
  const hi = PSY.planVisit(rec('mood', true), { timePlan: 'mix' }, [], () => P.mixLongShare + 0.001, () => false, {}, {});
  ok(!hi.long && hi.needMin === P.visitMin.stdRevisit && hi.report.kbActs.some((a) => a.id === 'i002Std'));
  let calls = 0; const count = () => { calls++; return 0.99; };
  PSY.planVisit(rec('mood', true), { timePlan: 'long' }, [], count, () => false, {}, {});
  eq(calls, 1, 'long方針では時間の判定に乱数を引かない(処方の1回だけ)');
});
t('心身症(心療内科)は心身医学療法のセルで、時間の方針では変わらない', () => {
  const a = visit(rec('shinshin', false), { timePlan: 'long' }, [], never);
  eq(a.v.needMin, P.visitMin.i004First); ok(has(a.r.lines, 'r08-I004-2-i'), '心身医学療法(初診時)');
  const b = visit(rec('shinshin', true), { timePlan: 'std' }, [], never);
  eq(b.v.needMin, P.visitMin.i004Revisit); ok(has(b.r.lines, 'r08-I004-2-ro'), '心身医学療法(再診時)');
});
t('一般名処方: 方針がONなら処方箋料と一緒に加算を申請し算定される。OFFなら申請しない', () => {
  const on = visit(rec('mood', true), { timePlan: 'std', ippanmei: true }, [], always);
  ok(act(on.v, 'presc') && act(on.v, 'ippanmei'));
  ok(has(on.r.lines, 'r08-F400-3') && has(on.r.lines, 'r08-F400-n6-i'), '処方箋料+一般名処方加算');
  const off = visit(rec('mood', true), { timePlan: 'std', ippanmei: false }, [], always);
  ok(act(off.v, 'presc') && !act(off.v, 'ippanmei'));
  ok(has(off.r.lines, 'r08-F400-3') && !has(off.r.lines, 'r08-F400-n6-i'), '加算は出ない');
  const no = visit(rec('mood', true), { timePlan: 'std', ippanmei: true }, [], never);
  ok(!act(no.v, 'presc') && !act(no.v, 'ippanmei'), '処方のない来院');
});
t('通院精神療法を行った日は外来管理加算が却下される(A001注8の精神科専門療法)', () => {
  const v = PSY.planVisit(rec('mood', true), { timePlan: 'std' }, [], never, () => false, {}, { day: 1 });
  ok(act(v, 'kanri'), '再診では申請する(却下を代表レセプトで見せる)');
  const r = REIMB.evaluateEncounter({ encounter: { visitType: 'revisit' }, procedures: PSY.buildProcedures(v.report), facilityStandards: [], history: {} });
  ok(r.billableItems.some((b) => b.itemId === 'r08-I002-1-ha-2-1'), '通院精神療法は算定');
  ok(r.rejectedItems.some((b) => b.itemId === 'r08-A001-n8'), '外来管理加算は却下');
  const first = PSY.planVisit(rec('mood', false), { timePlan: 'std' }, [], never, () => false, {}, { day: 1 });
  ok(!act(first, 'kanri'), '初診では申請しない');
});
t('早期診療体制充実加算3: 届出済みの通院精神療法にだけ1セル乗り、3年(1080日)で3年超のセルに替わる。心身医学療法には乗らない', () => {
  const fs = ['r08-fs-i002-n11-3'];
  const none = PSY.planVisit(rec('mood', true), { timePlan: 'std' }, [], never, () => false, {}, { day: 100 });
  ok(!act(none, 'n11ha1') && !act(none, 'n11ha2'), '届出前は申請しない');
  const a = visit(rec('mood', true, 1), { timePlan: 'std' }, fs, never, 1079);
  ok(act(a.v, 'n11ha1') && has(a.r.lines, 'r08-I002-n11-ha-1'), '3年以内のセル');
  const b = visit(rec('mood', true, 1), { timePlan: 'std' }, fs, never, 1081);
  ok(act(b.v, 'n11ha2') && has(b.r.lines, 'r08-I002-n11-ha-2'), '3年超のセル');
  const c = PSY.planVisit(rec('shinshin', true, 1), { timePlan: 'std' }, fs, never, () => false, {}, { day: 1079 });
  ok(!act(c, 'n11ha1') && !act(c, 'n11ha2'), '心身医学療法の日には乗らない');
});
t('1日の分数予算に収まらない来院は繰越になり、処方の乱数を引かない(旧 runDay と同じ引き順)', () => {
  let calls = 0; const count = () => { calls++; return 0.01; };
  const v = PSY.planVisit(rec('mood', true), { timePlan: 'mix' }, [], count, () => false, {}, { day: 1, fits: () => false });
  ok(v.deferred === true && v.report === null, '繰越');
  eq(v.needMin, P.visitMin.longRevisit, '必要分数は返す(呼び出し側が予算を判断する)');
  eq(calls, 1, '時間の判定だけを引く');
  const w = PSY.planVisit(rec('mood', true), { timePlan: 'std' }, [], never, () => false, {}, { day: 1, fits: (min) => min <= 999 });
  ok(w.deferred === false && w.report, '収まれば通常どおり');
});
t('dayBudget は医師数に比例し、churnRate は方針と精神保健福祉士で下がる(下限あり)', () => {
  eq(PSY.dayBudget({ timePlan: 'std' }, { doctors: 1 }), P.dayMinutes);
  eq(PSY.dayBudget({ timePlan: 'long' }, { doctors: 2 }), P.dayMinutes * 2);
  eq(PSY.churnRate({ timePlan: 'std' }, { psws: 0 }), P.churnMonthly.std);
  eq(PSY.churnRate({ timePlan: 'long' }, { psws: 0 }), P.churnMonthly.long);
  ok(PSY.churnRate({ timePlan: 'long' }, { psws: 2 }) >= 0.005, '下限0.005を割らない');
  ok(PSY.churnRate({ timePlan: 'std' }, { psws: 1 }) < PSY.churnRate({ timePlan: 'std' }, { psws: 0 }), '精神保健福祉士で下がる');
});
t('概算ゼロ: 全行が KB 項目(kb を持つ)', () => {
  const { r } = visit(rec('mood', true, 1), { timePlan: 'long', ippanmei: true }, ['r08-fs-i002-n11-3'], always, 30);
  ok(r.lines.length > 0 && r.lines.every((l) => l.kb), '全行に kb');
});

/* ===== 本院(main)の経路 — v82 便AF-3 工程3 ===== */
t('main候補: line は16字以内・order 4・preset に整形レバーのゼロ化と精神科の差分がある', () => {
  ok(PSY.main && PSY.main.line.length <= 16, `line=${PSY.main && PSY.main.line}`);
  eq(PSY.main.order, 4); eq(PSY.main.fsTitle, '精神科の届出');
  const pre = PSY.main.preset;
  eq(pre.settings.pInj, 0); eq(pre.settings.pReha, 0); eq(pre.settings.rehaLevel, 0); eq(pre.settings.pts, 0);
  ok(pre.shopHide.includes('pt') && pre.shopHide.includes('machines'), '整形の採用・設備は出さない');
  ok(pre.shopShow.includes('psw'), '精神保健福祉士は精神科の本院だけに出す');
  ok(pre.jihiHide.includes('selfReha') && pre.jihiHide.includes('prpOn'), '運動器の自費は出さない');
  ok(pre.relHide.includes('sports'), 'スポーツクラブは出さない');
  eq(pre.policy.timePlan, 'std'); eq(pre.policy.ippanmei, true); eq(pre.policy.renkei, false);
  ok(Object.keys(pre.textbook).length === 5, 'キホン集は差し替え可能な5項目だけ');
  ok(pre.keywords.length === 3, '広告キーワード3本');
});
t('本院の経路: 常連レコード(mc/wc/lb/fb/pr/en)で planVisit→DEPT.evalVisit が通り、全行がKB項目', () => {
  const p = rec('mood', true, 5);
  const v = PSY.planVisit(p, { timePlan: 'std', ippanmei: true }, [], always, () => false, {}, { day: 40 });
  const r = DEPT.evalVisit(PSY, shim({ timePlan: 'std' }, []), p, v.report, 40);
  ok(r.lines.length > 0 && r.lines.every((l) => l.kb), '全行に kb');
  ok(has(r.lines, 'r08-A001') && has(r.lines, 'r08-I002-1-ha-2-1'), '再診料+通院精神療法(30分未満)');
  ok(r.ev.rejectedItems.some((x) => x.itemId === 'r08-A001-n8'), '本院でも外来管理加算はA001注8で却下される');
});
t('早期診療体制充実加算3: 本院の shim でも精神保健福祉士0なら要件が欠け、1で埋まって届け出られる', () => {
  const noPsw = DEPT.fsStatus(PSY, shim({ timePlan: 'std', renkei: true }, [], { psws: 0 }))[0];
  ok(!noPsw.ok && noPsw.missing.includes('精神保健福祉士1名'), '0人では欠ける');
  const noRenkei = DEPT.fsStatus(PSY, shim({ timePlan: 'std', renkei: false }, [], { psws: 1 }))[0];
  ok(!noRenkei.ok && noRenkei.missing.includes('連携病院との協定'), '協定がなければ欠ける');
  const done = DEPT.fsStatus(PSY, shim({ timePlan: 'std', renkei: true }, [], { psws: 1 }))[0];
  ok(done.ok && done.missing.length === 0, '1人+協定で埋まる');
  ok(done.gameNote && /精神保健福祉士/.test(done.gameNote), 'ゲーム上の表し方であることを開示している');
});
t('mainLoyalty: std=1.0 で long>mix>1.0。値は churnMonthly から導く(独立変数を増やさない)', () => {
  const C = P.churnMonthly;
  eq(PSY.mainLoyalty({ timePlan: 'std' }), 1);
  eq(PSY.mainLoyalty({ timePlan: 'mix' }), C.std / C.mix);
  eq(PSY.mainLoyalty({ timePlan: 'long' }), C.std / C.long);
  ok(PSY.mainLoyalty({ timePlan: 'long' }) > PSY.mainLoyalty({ timePlan: 'mix' }), 'long>mix');
  ok(PSY.mainLoyalty({ timePlan: 'mix' }) > 1, 'mix>1.0');
  eq(PSY.mainLoyalty({}), 1, '方針が無ければ std と同じ');
});
t('mainExamMean: 3択で単調に増え、本院のキャパ比が分院の分数予算の来院比とほぼ一致する', () => {
  const em = (plan) => PSY.mainExamMean({ timePlan: plan });
  ok(em('std') < em('mix') && em('mix') < em('long'), '長く診るほど1人あたりの分数が増える');
  eq(em(), em('std'), '方針が無ければ std と同じ');
  const capOf = (plan) => 1 * (480 / (em(plan) + 1.5)) * 0.72;   // game.js の examCapDay と同じ式(医師1人)
  const ratio = (plan) => capOf(plan) / capOf('std');
  ok(Math.abs(ratio('mix') - 0.77) < 0.05, `mix のキャパ比 ${ratio('mix').toFixed(2)}`);
  ok(Math.abs(ratio('long') - 0.47) < 0.05, `long のキャパ比 ${ratio('long').toFixed(2)}`);
});

/* ===== 同値: 抽出前(39f5be3)の runDay と同じ数値になる(乱数を固定) ===== */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
t('同値: 分院 runDay の120日運用は抽出前(39f5be3)と同じ数値になる(3方針・乱数を固定)', () => {
  const OPEN = { kind: 'normal', pay: 1 }, CLOSED = { kind: 'closed', pay: 0 };
  // 期待値は抽出前の psychiatry.js(コミット 39f5be3)で同じ種を回して得た実測
  const expected = {
    std: { revenue: 9602600, cost: 14469800, visits: 1852, deferred: 957, panel: 454 },
    mix: { revenue: 9065070, cost: 14451200, visits: 1728, deferred: 3093, panel: 473 },
    long: { revenue: 7714210, cost: 14395250, visits: 1355, deferred: 9950, panel: 539 },
  };
  const orig = Math.random;
  try {
    for (const plan of ['std', 'mix', 'long']) {
      const m = rng(77); Math.random = () => m();   // deptInit の種
      const dept = DEPT.create(PSY, 1);
      dept.policy.timePlan = plan; dept.staff.psws = 1; dept.policy.renkei = true; dept.fs.push('r08-fs-i002-n11-3');
      const rand = rng(9);
      let revenue = 0, cost = 0, visits = 0, deferred = 0;
      for (let d = 1; d <= 120; d++) {
        const agg = DEPT.runDay(PSY, dept, { day: d, spec: d % 7 === 0 ? CLOSED : OPEN, rep: 70, aw: 0.5, rand, hasDept: () => false });
        revenue += agg.revenue; cost += agg.cost; visits += agg.visits; deferred += (agg.info.deferred || 0);
      }
      const e = expected[plan];
      eq(revenue, e.revenue, `${plan}: 収益`); eq(cost, e.cost, `${plan}: 費用`);
      eq(visits, e.visits, `${plan}: 来院`); eq(deferred, e.deferred, `${plan}: 繰越の合計`);
      eq(dept.pt.length, e.panel, `${plan}: パネル人数`);
    }
  } finally { Math.random = orig; }
});
console.log(`main-psych.test: ${n - failed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
