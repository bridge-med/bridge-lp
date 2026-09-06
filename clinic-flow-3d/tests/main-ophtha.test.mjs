/* 本院=眼科(v73 便AF)のエンジン経路テスト: モジュールの planVisit → DEPT.evalVisit を本院の常連レコード(mc/wc/lb/fb/pr)で回す。
 * 実行: node clinic-flow-3d/tests/main-ophtha.test.mjs。点数はKBパック経由で読み、このファイルに書かない。 */
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
console.log(`main-ophtha.test: ${n - failed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
