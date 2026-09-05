/* 本院=内科(v66 便AD)のエンジン経路テスト: モジュールの planVisit → DEPT.evalVisit を本院の常連レコード(mc/wc/lb/fb/pr)で回す。
 * 実行: node clinic-flow-3d/tests/main-internal.test.mjs
 * 点数はKBパック経由(REIMB.pointsOf)で読み、このファイルに書かない。 */
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

let n = 0, failed = 0;
function t(name, fn) { n++; try { fn(); console.log(`  ok ${n} - ${name}`); } catch (e) { failed++; console.log(`  NG ${n} - ${name}\n      ${e.message}`); } }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} 期待=${JSON.stringify(b)} 実際=${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'falsy'); }
const has = (lines, id) => lines.some((l) => l.kb === id);
const rejected = (ev, id) => ev.rejectedItems.some((x) => x.itemId === id);
const never = () => 0.99; // 紹介(1/12)を起こさない乱数

// 本院の shim(game.js mainDeptShim と同形): policy と fs は settings 由来の参照
function shim(policy, fs) { return { id: 'internal', policy, fs, staff: { doctors: 1, nurses: 1, clerks: 1 }, equip: {}, pt: [] }; }
function visit(rec, policy, fs, day) {
  const v = INTERNAL.planVisit(rec, policy, fs, never, () => false);
  const r = DEPT.evalVisit(INTERNAL, shim(policy, fs), rec, v.report, day);
  return { v, r };
}

t('main候補: main.line は16字以内・preset に整形レバーのゼロ化がある', () => {
  ok(INTERNAL.main && INTERNAL.main.line.length <= 16, 'line');
  eq(INTERNAL.main.preset.settings.pInj, 0); eq(INTERNAL.main.preset.settings.rehaLevel, 0);
  ok(Array.isArray(INTERNAL.main.preset.shopHide) && INTERNAL.main.preset.shopHide.includes('pt'));
});
t('pickProfile は patientProfiles の id を返す', () => {
  const ids = INTERNAL.patientProfiles.map((x) => x.id);
  for (const r of [0, 0.3, 0.6, 0.99]) ok(ids.includes(INTERNAL.pickProfile(() => r)));
});
t('初診: A000が立ち fb が true になる。管理料は申請しない', () => {
  const rec = { pr: 'ht', mc: {}, wc: {}, lb: {}, fb: false };
  const { v, r } = visit(rec, { kanri: 'II', ippanmei: true, keiji: true }, ['r08-fs-b001-3'], 1);
  eq(v.isFirst, true); ok(has(r.lines, 'r08-A000'), '初診料'); eq(rec.fb, true);
  ok(!has(r.lines, 'r08-B001-3-3') && !rejected(r.ev, 'r08-B001-3-3'), '初診では管理料を申請しない');
});
t('(II)方針・体制あり: 再診で管理料(II)が月1回だけ立つ(同月2回目は却下=mcで追跡)', () => {
  const rec = { pr: 'ht', mc: {}, wc: {}, lb: {}, fb: true };
  const pol = { kanri: 'II', ippanmei: true, keiji: true }; const fs = ['r08-fs-b001-3'];
  const a = visit(rec, pol, fs, 5);
  ok(has(a.r.lines, 'r08-B001-3-3'), '1回目=算定'); ok(has(a.r.lines, 'r08-D007-n1-ha'), '(II)は検査を別に算定');
  eq(rec.mc['r08-B001-3-3'], 1);
  const b2 = visit(rec, pol, fs, 12);
  ok(!b2.v.tryKanriRyo, '同月2回目は申請自体をしない(mc)'); ok(!has(b2.r.lines, 'r08-B001-3-3'));
  ok(has(b2.r.lines, 'r08-A001-n8'), '管理料の無い再診では外来管理加算');
});
t('(II)方針・体制なし(keiji=false・fs空): 管理料(II)は施設基準未適用で却下される', () => {
  const rec = { pr: 'lipid', mc: {}, wc: {}, lb: {}, fb: true };
  const { r } = visit(rec, { kanri: 'II', ippanmei: true, keiji: false }, [], 5);
  ok(rejected(r.ev, 'r08-B001-3-3'), '却下'); ok(!has(r.lines, 'r08-B001-3-3'));
});
t('(I)方針・体制あり: 管理料(I)が立ち検体検査は包括で却下(rule-0002)', () => {
  const rec = { pr: 'dm', mc: {}, wc: {}, lb: {}, fb: true };
  const { r } = visit(rec, { kanri: 'I', ippanmei: true, keiji: true }, ['r08-fs-b001-3'], 5);
  ok(has(r.lines, 'r08-B001-3-1-dm'), '(I)dm'); ok(rejected(r.ev, 'r08-D007-n1-ha'), '検査は包括で却下');
});
t('月のロールオーバー(mcを空に)で翌月は再び管理料(II)が立つ', () => {
  const rec = { pr: 'ht', mc: {}, wc: {}, lb: {}, fb: true };
  const pol = { kanri: 'II', ippanmei: true, keiji: true }; const fs = ['r08-fs-b001-3'];
  visit(rec, pol, fs, 5); rec.mc = {}; // game.js planDay の月替わり処理と同じ
  const { r } = visit(rec, pol, fs, 35); ok(has(r.lines, 'r08-B001-3-3'));
});
t('planVisit は部門 runDay と同じ判断(充実管理加算3は届出済みのときだけ申請)', () => {
  const rec = { pr: 'ht', mc: {}, wc: {}, lb: {}, fb: true };
  const pol = { kanri: 'II', ippanmei: true, keiji: true };
  const a = INTERNAL.planVisit({ ...rec, mc: {} }, pol, ['r08-fs-b001-3'], never, () => false);
  ok(!a.report.kbActs.some((x) => x.id.startsWith('jujitsu3')), '未届出=申請なし');
  const b2 = INTERNAL.planVisit({ ...rec, mc: {} }, pol, ['r08-fs-b001-3', 'r08-fs-b001-3-n4-3'], never, () => false);
  ok(b2.report.kbActs.some((x) => x.id === 'jujitsu3IIHt'), '届出済み=申請');
});
t('本院shimの施設基準(v67): 体制なし=未・体制あり=ok。届出前は notified=false', () => {
  const pol = { kanri: 'II', ippanmei: true, keiji: false };
  const a = DEPT.fsStatus(INTERNAL, shim(pol, []));
  const b1 = a.find((x) => x.fsId === 'r08-fs-b001-3'); ok(b1 && !b1.ok && !b1.notified, '体制なし=未');
  pol.keiji = true;
  const b2 = DEPT.fsStatus(INTERNAL, shim(pol, ['r08-fs-b001-3'])).find((x) => x.fsId === 'r08-fs-b001-3'); ok(b2 && b2.ok && b2.notified, '体制あり・届出済み');
});
t('fsEnforce は dept.fs を差し替える(別参照)=本院では settings.mainFs へ書き戻しが要る', () => {
  const fs = ['r08-fs-b001-3', 'r08-fs-b001-3-n4-3'];
  const d = shim({ kanri: 'II', ippanmei: true, keiji: true }, fs);
  d.staff.clerks = 0; // 医療事務0=充実管理加算3の要件割れ
  const broken = DEPT.fsEnforce(INTERNAL, d);
  eq(broken.length, 1); eq(broken[0].fsId, 'r08-fs-b001-3-n4-3');
  ok(d.fs !== fs, 'fsEnforce は新しい配列を代入する(元配列は不変)'); eq(fs.length, 2); eq(d.fs.length, 1);
});
console.log(`main-internal.test: ${n - failed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
