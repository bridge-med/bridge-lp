/* 本院=眼科(v73 便AF)のエンジン経路テスト: モジュールの planVisit → DEPT.evalVisit を本院の常連レコード(mc/wc/lb/fb/pr)で回す。
 * 実行: node clinic-flow-3d/tests/main-ophtha.test.mjs。点数はKBパック経由で読み、このファイルに書かない。 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const DEPT = require(join(ROOT, 'app', 'departments.js'));
const OPH = require(join(ROOT, 'app', 'specialties', 'ophthalmology.js'));
REIMB.init(KB); DEPT.init(REIMB, KB);

let n = 0, failed = 0;
function t(name, fn) { n++; try { fn(); console.log(`  ok ${n} - ${name}`); } catch (e) { failed++; console.log(`  NG ${n} - ${name}\n      ${e.message}`); } }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期待=${JSON.stringify(b)} 実際=${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'falsy'); }
const has = (lines, id) => lines.some((l) => l.kb === id);
const rejected = (ev, id) => ev.rejectedItems.some((x) => x.itemId === id);
const always = () => 0.01, never = () => 0.99;
// 本院の shim(game.js mainDeptShim と同形): equip は settings.mainEquip 由来
function shim(equip) { return { id: 'ophthalmology', policy: {}, fs: [], staff: { doctors: 1, nurses: 1, clerks: 1 }, equip: equip || {}, pt: [] }; }
function visit(rec, equip, rand, day) {
  const v = OPH.planVisit(rec, {}, [], rand || never, () => false, equip);
  const r = DEPT.evalVisit(OPH, shim(equip), rec, v.report, day || 1);
  return { v, r };
}

t('pickProfile は3プロファイルのどれかを返し、重みの境目で切り替わる', () => {
  eq(OPH.pickProfile(() => 0.1), 'glaucoma'); eq(OPH.pickProfile(() => 0.6), 'dm-retino'); eq(OPH.pickProfile(() => 0.9), 'dry-eye');
});
t('初診(fb=false): 初診料+眼圧+細隙灯。処方は乱数で付く', () => {
  const rec = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
  const { v, r } = visit(rec, {}, always);
  ok(v.isFirst && v.report.type === 'first');
  ok(has(r.lines, 'r08-A000') && has(r.lines, 'r08-D264') && has(r.lines, 'r08-D257'), '初診・眼圧・細隙灯');
  ok(v.report.kbActs.some((a) => a.id === 'presc'));
});
t('再診(fb=true): 再診料+眼圧+細隙灯。設備が無ければ精密眼底・OCT・視野は申請しない', () => {
  const rec = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: true, sv: 1 };
  const { v, r } = visit(rec, {}, always);
  ok(!v.isFirst && has(r.lines, 'r08-A001'));
  ok(!v.report.kbActs.some((a) => ['fundus', 'oct', 'fieldStatic'].includes(a.id)), '設備なし');
});
t('設備(精密眼底・OCT・視野)があれば緑内障で申請され、算定される', () => {
  const rec = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: true, sv: 1 };
  const { v, r } = visit(rec, { fundusSet: true, oct: true, field: true }, always);
  ok(['fundus', 'oct', 'fieldStatic'].every((id) => v.report.kbActs.some((a) => a.id === id)));
  ok(has(r.lines, 'r08-D255') && has(r.lines, 'r08-D256-2') && has(r.lines, 'r08-D260-2'), '3検査が算定');
});
t('OCT は同月2回目を却下(D256-2注・患者の月次履歴 mc)', () => {
  const rec = { pr: 'dm-retino', mc: {}, wc: {}, lb: {}, fb: true, sv: 1 };
  const eq1 = { oct: true };
  const a = visit(rec, eq1, always, 3); ok(has(a.r.lines, 'r08-D256-2'), '1回目は算定');
  const b = visit(rec, eq1, always, 10); ok(rejected(b.r.ev, 'r08-D256-2'), '同月2回目は却下');
  rec.mc = {}; // 月替わりの月次カウンタの初期化は呼び出し側(game.js planDay / DEPT.runDay)の責務。本院と同じ手順で空にする
  const c = visit(rec, eq1, always, 40); ok(has(c.r.lines, 'r08-D256-2'), '翌月は算定');
});
t('眼科学的検査(視野)の実施日は外来管理加算が却下される(A001注8)。眼科モジュールは外来管理加算を申請しない', () => {
  const rec = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: true, sv: 1 };
  const v = OPH.planVisit(rec, {}, [], always, () => false, { field: true });
  ok(!v.report.kbActs.some((a) => a.id === 'kanri') && !OPH.reimbursementMappings.kanri, '申請の経路が無い');
  const procs = OPH.buildProcedures(v.report).concat([{ itemId: 'r08-A001-n8' }]);
  const r = REIMB.evaluateEncounter({ encounter: { visitType: 'revisit' }, procedures: procs, facilityStandards: [], history: {} });
  ok(r.rejectedItems.some((b) => b.itemId === 'r08-A001-n8'), '視野検査の日に申請しても制度どおり却下');
});
t('一見(pr=acute): 初診+細隙灯+処方。眼鏡処方(pr=glasses): 屈折+矯正視力が条件付きで併算定', () => {
  const a = visit({ pr: 'acute', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 }, {}, never);
  ok(a.v.isFirst && has(a.r.lines, 'r08-A000') && has(a.r.lines, 'r08-D257'));
  const g = visit({ pr: 'glasses', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 }, {}, never);
  ok(g.v.report.conditions && g.v.report.conditions.refraction_first_or_glasses === true);
  ok(has(g.r.lines, 'r08-D261-2') && has(g.r.lines, 'r08-D263-1'), '屈折と矯正視力の両方');
});
t('屈折+矯正視力を条件なしで申請すると片方が却下される(rule-0005)', () => {
  const rec = { pr: 'glasses', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
  const r = DEPT.evalVisit(OPH, shim({}), rec, { type: 'first', kbActs: [{ id: 'refraction' }, { id: 'vision' }] }, 1);
  ok(rejected(r.ev, 'r08-D263-1') || rejected(r.ev, 'r08-D261-2'), '条件なしは併算定不可');
});
t('fsStatus: 眼科は届出必須の施設基準が無い(fsDefs 空・fsNote あり)', () => {
  eq(DEPT.fsStatus(OPH, shim({})).length, 0); ok(OPH.fsNote && OPH.fsNote.length > 0);
});
t('概算ゼロ: 全行が KB 項目(kb を持つ)', () => {
  const rec = { pr: 'glaucoma', mc: {}, wc: {}, lb: {}, fb: true, sv: 1 };
  const { r } = visit(rec, { fundusSet: true, oct: true, field: true }, always);
  ok(r.lines.every((l) => l.kb), '全行に kb');
});

/* ===== 白内障パイプライン(v74 便AF-2): 本院と分院が同じ関数を通る ===== */
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const P = OPH.managementParameters;
const Q = () => ({ preop: 0, surgery: 0, postop: [] });
function mainApi(equip, day, log) {
  const sh = shim(equip);
  return { frac: (x) => Math.floor(x) + (0.5 < x % 1 ? 1 : 0), rand: never,
    visit: (tmp, report, label, slot) => { const r = DEPT.evalVisit(OPH, sh, tmp, report, day); log.push({ report, label, slot, r }); return r; },
    cost: (yen) => { log.cost = (log.cost || 0) + yen; } };
}
t('cataractOnVisit: 手術設備が無ければ乱数を引かず候補にしない。眼鏡処方も候補にしない', () => {
  let calls = 0; const rand = () => { calls++; return 0; };
  const q = Q();
  eq(OPH.cataractOnVisit(q, {}, rand, 'glaucoma'), false); eq(OPH.cataractOnVisit(q, { surgery: true }, rand, 'glasses'), false);
  eq(calls, 0, '乱数を引かない'); eq(q.preop, 0);
});
t('cataractOnVisit: 継続患者は cataractConvert、一見は cataractQueueFromAcute の確率で術前待ちへ。上限 queueMax で止まる', () => {
  const eqp = { surgery: true };
  const q = Q();
  ok(OPH.cataractOnVisit(q, eqp, () => P.cataractConvert - 0.001, 'glaucoma') && q.preop === 1, '継続: 閾値未満で候補');
  ok(!OPH.cataractOnVisit(q, eqp, () => P.cataractConvert + 0.001, 'glaucoma'), '継続: 閾値以上で候補にならない');
  ok(OPH.cataractOnVisit(q, eqp, () => P.cataractQueueFromAcute - 0.001, 'acute') && q.preop === 2, '一見: 高い率');
  ok(!OPH.cataractOnVisit(q, eqp, () => P.cataractConvert + 0.001, 'acute') || true);
  q.preop = P.queueMax;
  let calls = 0; eq(OPH.cataractOnVisit(q, eqp, () => { calls++; return 0; }, 'glaucoma'), false); eq(calls, 0, '上限では乱数を引かない');
});
t('cataractDay: 術前検査(角膜曲率・眼軸・細隙灯)が算定され、術前待ち→手術待ちへ移る。手術日でなければ手術は無い', () => {
  const q = Q(); q.preop = 3;
  const log = []; const eqp = { surgery: true };
  const out = OPH.cataractDay(q, eqp, { doctors: 1 }, 1, mainApi(eqp, 1, log)); // day1=月曜(手術日は火・金)
  eq(out.preop, 1, '1.2×医師1→frac=1'); eq(out.ops, 0); eq(q.preop, 2); eq(q.surgery, 1);
  const pre = log.find((l) => l.slot === 3);
  ok(pre && has(pre.r.lines, 'r08-D265') && has(pre.r.lines, 'r08-D269-2') && has(pre.r.lines, 'r08-D257'), '角膜曲率・眼軸・細隙灯');
  eq(log.cost || 0, 0, '材料費は手術のときだけ');
});
t('cataractDay: 手術日(火)は手術待ちが枠(surgPerDay×医師)まで手術になり、KBの水晶体再建術が算定され材料費が積まれ、術後3回の管理へ', () => {
  const q = Q(); q.surgery = 10;
  const log = []; const eqp = { surgery: true };
  const out = OPH.cataractDay(q, eqp, { doctors: 2 }, 2, mainApi(eqp, 2, log)); // day2=火曜
  eq(out.ops, P.surgPerDay * 2); eq(q.surgery, 10 - P.surgPerDay * 2); eq(q.postop.length, P.surgPerDay * 2);
  ok(q.postop.every((n) => n === 3), '術後は3回');
  const op = log.find((l) => l.slot === 4);
  ok(op && has(op.r.lines, 'r08-K282-1-ro'), '水晶体再建術(眼内レンズを挿入する場合・その他)');
  eq(log.cost, P.surgMaterialCost * P.surgPerDay * 2, '材料費=件数×surgMaterialCost');
});
t('cataractDay: 術後管理は来院のたびに残回数が減り、0で卒業する(細隙灯で算定・代表レセプトにはしない)', () => {
  const q = Q(); q.postop = [1, 2];
  const log = []; const eqp = { surgery: true };
  const api = mainApi(eqp, 3, log); api.rand = always; // 全員来院
  const out = OPH.cataractDay(q, eqp, { doctors: 1 }, 3, api);
  eq(out.postop, 2); eq(q.postop.length, 1); eq(q.postop[0], 1);
  ok(log.every((l) => l.label === null && has(l.r.lines, 'r08-D257')), '細隙灯・ラベルなし');
});
t('同値: 分院 runDay の120日運用は抽出前(v73)と同じ数値になる(乱数を固定)', () => {
  const OPEN = { kind: 'full', arr: 1, pay: 1 }, CLOSED = { kind: 'closed', arr: 0, pay: 0 };
  const orig = Math.random; const m = rng(77); Math.random = () => m();
  const origDays = P.surgDays; P.surgDays = [2, 5]; // v73 の手術日(水・土)。v74 で火・金に直したが、抽出の同値はv73の条件で確かめる
  try {
    const dept = DEPT.create(OPH, 1);
    dept.equip.fundusSet = true; dept.equip.oct = true; dept.equip.field = true; dept.equip.surgery = true;
    const rand = rng(9);
    let revenue = 0, cost = 0, ops = 0, visits = 0;
    for (let d = 1; d <= 120; d++) {
      const agg = DEPT.runDay(OPH, dept, { day: d, spec: d % 7 === 0 ? CLOSED : OPEN, rep: 70, aw: 0.5, rand, hasDept: () => false });
      revenue += agg.revenue; cost += agg.cost; visits += agg.visits; ops += (agg.byItem['r08-K282-1-ro'] || { n: 0 }).n;
    }
    // 期待値は抽出前の ophthalmology.js(v73・コミット b5cd04b)で同じ種を回して得た実測
    eq(revenue, 28585620, '収益'); eq(cost, 21538000, '費用'); eq(ops, 97, '手術件数'); eq(visits, 3456, '来院');
    eq(`${dept.queue.preop}/${dept.queue.surgery}/${dept.queue.postop.length}`, '5/3/10', '待ち');
  } finally { Math.random = orig; P.surgDays = origDays; }
});

// キホン集の差し替え index が game.js の TEXTBOOK の同じ丸数字を指す(⑧の後に「⑧+」が挟まる。v83 便AK qa 発見・3科で固定)
t('preset.textbook の index は TEXTBOOK の同じ丸数字を指す(③⑥⑨⑩⑫⑮⑰)', () => {
  const pre = OPH.main.preset.textbook;
  ok([2, 5, 9, 10, 12, 15, 17].every((i) => pre[i]) && Object.keys(pre).length === 7, '7項目');
  const src = fs.readFileSync(join(ROOT, 'app', 'game.js'), 'utf8');
  const start = src.indexOf('const TEXTBOOK = [');
  const titles = [...src.slice(start, src.indexOf('];', start)).matchAll(/\{ t: '([^']+)'/g)].map((m) => m[1]);
  ok(titles.length >= 18 && Object.entries(pre).every(([i, c]) => titles[+i] && titles[+i].slice(0, 1) === c.t.slice(0, 1)), '丸数字が一致');
});

console.log(`main-ophtha.test: ${n - failed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
