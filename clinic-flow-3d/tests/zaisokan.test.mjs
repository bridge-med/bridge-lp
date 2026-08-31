/* 在医総管セル選択(app/zaisokan.js)のテスト — rule-0018の境界とみなし1人例外
 * 実行: node clinic-flow-3d/tests/zaisokan.test.mjs
 * 点数の期待値はKBパック経由(REIMB.pointsOf)で読む。点数をこのファイルに書かない。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const Z = require(join(ROOT, 'app', 'zaisokan.js'));

REIMB.init(KB);

let n = 0, failed = 0;
function t(name, fn) {
  n++;
  try { fn(); console.log(`  ok ${n} - ${name}`); }
  catch (e) { failed++; console.log(`  NG ${n} - ${name}: ${e.message}`); }
}
function eq(label, a, b) { if (a !== b) throw new Error(`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function ok(label, v) { if (!v) throw new Error(`${label}: falsy`); }

/* 1. 人数→セルの境界(告示C002の2ロの区分) */
t('人数境界: 1/2/9/10/19/20/49/50でセルが切り替わる', () => {
  eq('1人', Z.cellForCount(1), 'r08-C002-2-ro-1');
  eq('2人', Z.cellForCount(2), 'r08-C002-2-ro-2');
  eq('9人', Z.cellForCount(9), 'r08-C002-2-ro-2');
  eq('10人', Z.cellForCount(10), 'r08-C002-2-ro-3');
  eq('19人', Z.cellForCount(19), 'r08-C002-2-ro-3');
  eq('20人', Z.cellForCount(20), 'r08-C002-2-ro-4');
  eq('49人', Z.cellForCount(49), 'r08-C002-2-ro-4');
  eq('50人', Z.cellForCount(50), 'r08-C002-2-ro-5');
});

t('全セルがKBに実在し点数の序列が人数と逆順(多いほど低い)', () => {
  const pts = ['r08-C002-2-ro-1', 'r08-C002-2-ro-2', 'r08-C002-2-ro-3', 'r08-C002-2-ro-4', 'r08-C002-2-ro-5']
    .map((id) => { const p = REIMB.pointsOf(id); ok(`${id}に点数`, p != null); return p; });
  for (let i = 1; i < pts.length; i++) ok(`${i}番目 < ${i - 1}番目`, pts[i] < pts[i - 1]);
});

/* 2. みなし1人の例外(留意(11)) */
t('例外①: 同一患家の同一世帯は人数によらず1人セル', () => {
  eq('2人でも', Z.selectCell({ count: 2, units: 1, sameHousehold: true }).itemId, 'r08-C002-2-ro-1');
  eq('3人でも', Z.selectCell({ count: 3, units: 1, sameHousehold: true }).itemId, 'r08-C002-2-ro-1');
});

t('例外②: 患者数が戸数の10%以下なら1人セル(境界含む)', () => {
  eq('40戸4人(=10%)', Z.selectCell({ count: 4, units: 40 }).itemId, 'r08-C002-2-ro-1');
  eq('40戸5人(>10%)', Z.selectCell({ count: 5, units: 40 }).itemId, 'r08-C002-2-ro-2');
});

t('例外③: 20戸未満で2人以下なら1人セル', () => {
  eq('18戸2人', Z.selectCell({ count: 2, units: 18 }).itemId, 'r08-C002-2-ro-1');
  eq('18戸3人(例外外)', Z.selectCell({ count: 3, units: 18 }).itemId, 'r08-C002-2-ro-2');
  eq('20戸2人(20戸以上・10%超)', Z.selectCell({ count: 2, units: 20 }).itemId, 'r08-C002-2-ro-1');
});

t('戸建て(units=1)は例外②③を適用せず素の人数(1人)で選ぶ', () => {
  eq('1人', Z.selectCell({ count: 1, units: 1 }).itemId, 'r08-C002-2-ro-1');
});

t('units不明(null)は例外②③を適用しない(安全側=人数どおり)', () => {
  eq('3人', Z.selectCell({ count: 3, units: null }).itemId, 'r08-C002-2-ro-2');
});

/* 3. エンジン接続: 選択セルがそのまま算定でき月1回制限が効く */
t('選択セル(2〜9人)がエンジンで算定され、同月2回目は却下される', () => {
  const sel = Z.selectCell({ count: 3, units: 24 });
  eq('24戸3人は2〜9人セル', sel.itemId, 'r08-C002-2-ro-2');
  const r1 = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: sel.itemId }],
    facilityStandards: ['r08-fs-zaishien'], history: {},
  });
  ok('算定される', r1.billableItems.some((b) => b.itemId === sel.itemId));
  const r2 = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: sel.itemId }],
    facilityStandards: ['r08-fs-zaishien'], history: { month: { [sel.itemId]: 1 } },
  });
  ok('同月2回目は却下', r2.rejectedItems.some((b) => b.itemId === sel.itemId));
});

t('在支診の届出なしでは人数セルも算定できない(required)', () => {
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-C002-2-ro-2' }],
    facilityStandards: [], history: {},
  });
  ok('却下される', r.rejectedItems.some((b) => b.itemId === 'r08-C002-2-ro-2'));
});

/* 4. 訪問診療料のイ/ロ選択(v51・rule-0019) */
t('同一建物で同日2人以上はロ(同一建物居住者)・1人はイ', () => {
  eq('2人', Z.visitCellFor(2), 'r08-C001-1-ro');
  eq('7人', Z.visitCellFor(7), 'r08-C001-1-ro');
  eq('1人(繰越で1人になった日を含む)', Z.visitCellFor(1), 'r08-C001-1-i');
});

t('イ/ロの点数はKB由来で序列が正しい(ロ<イ)', () => {
  const i = REIMB.pointsOf('r08-C001-1-i'), ro = REIMB.pointsOf('r08-C001-1-ro');
  ok('両方登録済み', i != null && ro != null);
  ok('ロ<イ', ro < i);
});

console.log(`\nzaisokan.test: ${n - failed} passed / ${failed} failed`);
if (failed) process.exit(1);
