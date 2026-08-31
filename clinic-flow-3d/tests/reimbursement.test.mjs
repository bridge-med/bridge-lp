#!/usr/bin/env node
/* 診療報酬エンジンのテスト。実行: node clinic-flow-3d/tests/reimbursement.test.mjs
 * 期待値の点数はKBゲームパック(=medical-kb正規データ)から読む。
 * テストコードに点数を直書きしない(改定でKBが変われば期待値も追随する)。 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const KB = require('../data/kb-r08.js');
const REIMB = require('../app/reimbursement.js');
REIMB.init(KB);

let pass = 0, fail = 0;
const eq = (name, actual, expected) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { pass++; }
  else { fail++; console.error(`✗ ${name}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`); }
};
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error(`✗ ${name}`); } };
const pts = (id) => REIMB.pointsOf(id);
const billedIds = (r) => r.billableItems.map((x) => x.itemId).sort();
const rejectedIds = (r) => r.rejectedItems.map((x) => x.itemId).sort();

/* 1. 正常算定: 整形外科の初診(初診+X線+関節穿刺) */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'first' },
    procedures: [{ itemId: 'r08-A000' }, { itemId: 'r08-E001-1-ro' }, { itemId: 'r08-E002-1-ro' }, { itemId: 'r08-J116' }],
    facilityStandards: [], history: {},
  });
  eq('正常算定: 4項目とも算定', billedIds(r), ['r08-A000', 'r08-E001-1-ro', 'r08-E002-1-ro', 'r08-J116']);
  eq('正常算定: 合計点数はKBの和', r.totalPoints, pts('r08-A000') + pts('r08-E001-1-ro') + pts('r08-E002-1-ro') + pts('r08-J116'));
  eq('正常算定: 円換算は1点10円', r.totalYen, r.totalPoints * 10);
  ok('正常算定: 根拠(evidence)が付く', r.billableItems.every((x) => x.evidence && x.evidence.quote));
}

/* 2. 施設基準不足: 運動器リハ(I)は届出なしでは算定不可 */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-H002-1', units: 2 }],
    facilityStandards: [], history: {},
  });
  eq('施設基準不足: リハは未算定', rejectedIds(r), ['r08-A001-n8'].filter(() => false).concat(['r08-H002-1']));
  ok('施設基準不足: 理由に施設基準名', r.rejectedItems[0].reasons.join().includes('施設基準'));
  ok('施設基準不足: 必要要件(人員)が返る', r.rejectedItems[0].fsInfo && !!r.rejectedItems[0].fsInfo.staffing);
}

/* 3. 施設基準充足: 届出済みなら算定でき、2単位分の点数になる */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-H002-1', units: 2 }],
    facilityStandards: ['r08-fs-h002-1'], history: {},
  });
  ok('施設基準充足: リハ算定', billedIds(r).includes('r08-H002-1'));
  eq('単位計算: 2単位', r.billableItems.find((x) => x.itemId === 'r08-H002-1').subtotal, pts('r08-H002-1') * 2);
}

/* 4. 併算定不可(同日): リハ実施日の外来管理加算(rule-0001) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-H002-1', units: 2 }],
    facilityStandards: ['r08-fs-h002-1'], history: {},
  });
  ok('同日併算定不可: 外来管理加算が未算定', rejectedIds(r).includes('r08-A001-n8'));
  const rej = r.rejectedItems.find((x) => x.itemId === 'r08-A001-n8');
  ok('同日併算定不可: 根拠ルールと原文引用', rej.rules.length > 0 && !!rej.rules[0].quote);
}

/* 5. 処置なし再診: 外来管理加算は算定できる */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }],
    facilityStandards: [], history: {},
  });
  ok('処置なし再診: 外来管理加算算定', billedIds(r).includes('r08-A001-n8'));
}

/* 6. 月回数制限: 生活習慣病管理料(I)は月1回 */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-1-ht' }],
    facilityStandards: ['r08-fs-b001-3'],
    history: { month: { 'r08-B001-3-1-ht': 1 } },
  });
  ok('月1回制限: 2回目は未算定', rejectedIds(r).includes('r08-B001-3-1-ht'));
}

/* 7. 包括: 生活習慣病管理料(I)算定時は外来管理加算が包括で未算定(rule-0002) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-B001-3-1-ht' }],
    facilityStandards: ['r08-fs-b001-3'], history: {},
  });
  ok('包括: 管理料は算定', billedIds(r).includes('r08-B001-3-1-ht'));
  ok('包括: 外来管理加算は包括で未算定', rejectedIds(r).includes('r08-A001-n8'));
}

/* 8. 6月ウィンドウ: (I)算定から6月以内は(II)不可(rule-0004) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-3' }],
    facilityStandards: ['r08-fs-b001-3'],
    history: { monthsSince: { 'r08-B001-3-1-ht': 3 } },
  });
  ok('6月ウィンドウ: (II)未算定', rejectedIds(r).includes('r08-B001-3-3'));
  const r2 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-3' }],
    facilityStandards: ['r08-fs-b001-3'],
    history: { monthsSince: { 'r08-B001-3-1-ht': 7 } },
  });
  ok('6月経過後: (II)算定可', billedIds(r2).includes('r08-B001-3-3'));
}

/* 9. 条件付き併算定: 屈折×矯正視力(rule-0005) */
{
  const base = { procedures: [{ itemId: 'r08-A000' }, { itemId: 'r08-D261-2' }, { itemId: 'r08-D263-1' }], facilityStandards: [], history: {} };
  const rNo = REIMB.evaluateEncounter({ ...base, encounter: { conditions: {} } });
  ok('条件不成立: 矯正視力が未算定', rejectedIds(rNo).includes('r08-D263-1'));
  const rYes = REIMB.evaluateEncounter({ ...base, encounter: { conditions: { refraction_first_or_glasses: true } } });
  ok('条件成立: 両方算定', billedIds(rYes).includes('r08-D261-2') && billedIds(rYes).includes('r08-D263-1'));
}

/* 10. 同日制限: 訪問診療日の再診料・往診料(rule-0008) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-C001-1-i' }, { itemId: 'r08-A001' }, { itemId: 'r08-C000' }],
    facilityStandards: [], history: {},
  });
  ok('訪問診療日: 訪問診療料は算定', billedIds(r).includes('r08-C001-1-i'));
  ok('訪問診療日: 再診料・往診料は未算定', rejectedIds(r).includes('r08-A001') && rejectedIds(r).includes('r08-C000'));
}

/* 11. 週回数制限: 訪問診療は週3回まで */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-C001-1-i' }],
    facilityStandards: [], history: { week: { 'r08-C001-1-i': 3 } },
  });
  ok('週3回制限: 4回目は未算定', rejectedIds(r).includes('r08-C001-1-i'));
}

/* 12. 単位上限: 運動器リハは1日6単位で切り詰め */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-H002-1', units: 8 }],
    facilityStandards: ['r08-fs-h002-1'], history: {},
  });
  const b = r.billableItems.find((x) => x.itemId === 'r08-H002-1');
  eq('単位上限: 6単位に切り詰め', b.subtotal, pts('r08-H002-1') * 6);
  ok('単位上限: warningあり', r.warnings.some((w) => w.kind === 'limit_capped'));
}

/* 13. 未知項目: KBに無いIDはneeds_reviewで算定しない(エンジンは停止しない) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A000' }, { itemId: 'r08-XXXX-unknown' }],
    facilityStandards: [], history: {},
  });
  ok('未知項目: warningsに載る', r.warnings.some((w) => w.kind === 'unknown_item'));
  ok('未知項目: 既知項目は正常算定', billedIds(r).includes('r08-A000'));
  ok('未知項目: 合計に含めない', r.totalPoints === pts('r08-A000'));
}

/* 14. 未機械化ルール: 透析の外来医学管理料はrule-0007等の注意が出る */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-15' }],
    facilityStandards: [], history: {},
  });
  ok('月次管理料: 算定', billedIds(r).includes('r08-B001-15'));
}

/* 15. 増収試算: 運動器リハ(I)届出の推定月間増収 = (I-III点差)×単位×月回数 */
{
  const est = REIMB.estimateFacilityStandardUplift('r08-fs-h002-1', ['r08-H002-3'],
    [{ itemId: 'r08-H002-1', monthlyCount: 400, units: 2 }]);
  eq('増収試算: 点差×2単位×400回', est.estMonthlyPointsDelta, (pts('r08-H002-1') - pts('r08-H002-3')) * 2 * 400);
  ok('増収試算: simulation estimateの注記', est.note.includes('simulation estimate'));
}

/* 16. 定める検査(v41で別表を機械リスト化・留意A001(7)キ): 該当検査の算定日は外来管理加算却下 */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-D264' }],
    facilityStandards: [], history: {},
  });
  ok('定める検査: 精密眼圧測定(眼科学的検査)の算定日は外来管理加算却下', r.rejectedItems.some((x) => x.itemId === 'r08-A001-n8'));
  ok('定める検査: 別表リスト化済みのためneeds_review警告は出ない', !r.warnings.some((w) => w.kind === 'needs_review' && w.ruleId === 'r08-rule-0001'));
}

/* 17. 便E: 整形の処置・注射(J119=処置)の算定日は外来管理加算が却下される */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-J119-2' }],
    facilityStandards: [], history: {},
  });
  ok('J119算定日: 外来管理加算は却下(A001注8・処置)', r.rejectedItems.some((x) => x.itemId === 'r08-A001-n8'));
  ok('J119自体は算定', billedIds(r).includes('r08-J119-2'));
}

/* 18. 便E: 関節腔内注射(G010=第6部注射)はA001注8の列挙外で外来管理加算を妨げない */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-G010' }],
    facilityStandards: [], history: {},
  });
  ok('G010算定日: 外来管理加算は算定できる(注射は注8列挙外)', billedIds(r).includes('r08-A001-n8'));
}

/* 19. 便E: トリガーポイント注射(L104=麻酔)の算定日は外来管理加算が却下される */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-L104' }],
    facilityStandards: [], history: {},
  });
  ok('L104算定日: 外来管理加算は却下(A001注8・麻酔)', r.rejectedItems.some((x) => x.itemId === 'r08-A001-n8'));
}

/* 20. 便E: リハ総合計画評価料1は運動器(I)/(II)の届出が要る(ANY)。無届出は却下 */
{
  const r0 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-H003-2-1-i' }], facilityStandards: [], history: {},
  });
  ok('H003-2: 無届出は却下', r0.rejectedItems.some((x) => x.itemId === 'r08-H003-2-1-i'));
  const r2 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-H003-2-1-i' }], facilityStandards: ['r08-fs-h002-2'], history: {},
  });
  ok('H003-2: 運動器(II)届出で算定可', billedIds(r2).includes('r08-H003-2-1-i'));
  eq('H003-2: 点数はKB一致', r2.billableItems.find((x) => x.itemId === 'r08-H003-2-1-i').points, pts('r08-H003-2-1-i'));
}

/* 21. 便H: 腰部硬膜外ブロック(L100-2)の算定日はトリガーポイント注射を却下(留意L100(7)=rule-0012) */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-L100-2-lumbar' }, { itemId: 'r08-L104' }],
    facilityStandards: [], history: {},
  });
  ok('L100-2算定日: トリガーポイント注射は却下(rule-0012)', r.rejectedItems.some((x) => x.itemId === 'r08-L104'));
  ok('L100-2自体は算定', billedIds(r).includes('r08-L100-2-lumbar'));
  eq('L100-2: 点数はKB一致(800点)', r.billableItems.find((x) => x.itemId === 'r08-L100-2-lumbar').points, 800);
}

/* 22. 便H: E202-2(MRI 1.5T以上3T未満)は届出必須(注1)。無届出は却下・様式37届出で算定可 */
{
  const r0 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-E202-2' }], facilityStandards: [], history: {},
  });
  ok('E202-2: 無届出は却下', r0.rejectedItems.some((x) => x.itemId === 'r08-E202-2'));
  const r1 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-E202-2' }, { itemId: 'r08-E203' }, { itemId: 'r08-E-denshi-ct' }],
    facilityStandards: ['r08-fs-e202'], history: {},
  });
  ok('E202-2: 届出で算定可', billedIds(r1).includes('r08-E202-2'));
  eq('MRI一式の合計点(1330+450+120)', r1.billableItems.reduce((a, x) => a + x.subtotal, 0), 1900);
}

/* 23. 便H: E203コンピューター断層診断は月1回(告示注・算定回数テーブル) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-E203' }],
    facilityStandards: [], history: { month: { 'r08-E203': 1 } },
  });
  ok('E203: 同月2回目は却下(月1回)', r.rejectedItems.some((x) => x.itemId === 'r08-E203'));
}

/* 24. 便H: 時間外対応体制加算・明細書発行体制等加算はKB点数(7/4/1点)と一致 */
{
  eq('時間外対応体制加算1=7点', pts('r08-A001-n10-1'), 7);
  eq('時間外対応体制加算3=4点', pts('r08-A001-n10-3'), 4);
  eq('明細書発行体制等加算=1点', pts('r08-A001-n11'), 1);
  eq('電子画像管理加算(単純撮影)=57点', pts('r08-E-denshi-tanjun'), 57);
  eq('超音波(四肢・体表等)=350点', pts('r08-D215-2-ro-3'), 350);
  eq('機能強化加算=80点', pts('r08-A000-n10'), 80);
  eq('電子的診療情報連携体制整備加算3=4点', pts('r08-A000-n16-3'), 4);
}

/* 25. 便I: 検体検査は「定める検査」(生体検査料8区分)の対象外 — 外来管理加算を妨げず、警告も出ない */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-D400-1' },
      { itemId: 'r08-D005-5' }, { itemId: 'r08-D007-n1-ha' }, { itemId: 'r08-D026-3' }, { itemId: 'r08-D026-4' }],
    facilityStandards: [], history: {},
  });
  ok('検体検査の算定日でも外来管理加算は算定できる(留意A001(7)キ)', billedIds(r).includes('r08-A001-n8'));
  ok('採血+検体検査4項目すべて算定', ['r08-D400-1', 'r08-D005-5', 'r08-D007-n1-ha', 'r08-D026-3', 'r08-D026-4'].every((id) => billedIds(r).includes(id)));
  ok('needs_review警告は出ない(clearedKensaItems)', !r.warnings.some((w) => w.kind === 'needs_review' && w.ruleId === 'r08-rule-0001'));
  eq('検査パネル合計(採血40+血算21+生化学103+判断料125+144=433点)', r.billableItems.filter((x) => x.itemId.indexOf('r08-D') === 0).reduce((a, x) => a + x.subtotal, 0), 433);
}

/* 25b. 便I(editor必修2): 超音波検査(D215)は「定める検査」(超音波検査等)=算定日は外来管理加算を却下 */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n8' }, { itemId: 'r08-D215-2-ro-3' }],
    facilityStandards: [], history: {},
  });
  ok('D215算定日: 外来管理加算は却下(A001注8・超音波検査等)', r.rejectedItems.some((x) => x.itemId === 'r08-A001-n8'));
  ok('D215自体は算定', billedIds(r).includes('r08-D215-2-ro-3'));
}

/* 26. 便I: 生活習慣病管理料(I)の算定日は検体検査が包括される(rule-0002) */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'revisit' },
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-1-dm' }, { itemId: 'r08-D005-9' },
      { itemId: 'r08-D007-n1-ha' }, { itemId: 'r08-D026-4' }],
    facilityStandards: ['r08-fs-b001-3'], history: {},
  });
  ok('(I)算定日: HbA1cは包括で却下', r.rejectedItems.some((x) => x.itemId === 'r08-D005-9'));
  ok('(I)算定日: 血液化学(まるめ)は包括で却下', r.rejectedItems.some((x) => x.itemId === 'r08-D007-n1-ha'));
  ok('(I)算定日: 判断料も包括で却下', r.rejectedItems.some((x) => x.itemId === 'r08-D026-4'));
  ok('(I)自体は算定', billedIds(r).includes('r08-B001-3-1-dm'));
}

/* 27. 便I: 判断料・HbA1cの月1回制限(告示D026注1・算定回数テーブル) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-D026-3' }, { itemId: 'r08-D005-9' }],
    facilityStandards: [], history: { month: { 'r08-D026-3': 1, 'r08-D005-9': 1 } },
  });
  ok('血液学的検査判断料: 同月2回目は却下', r.rejectedItems.some((x) => x.itemId === 'r08-D026-3'));
  ok('HbA1c: 同月2回目は却下', r.rejectedItems.some((x) => x.itemId === 'r08-D005-9'));
}

/* 28. 便Q: C001の1ロ(同一建物居住者)はKB点数・在医総管セル横断の月1回排他(rule-0020) */
{
  eq('訪問診療料(1)1ロ(同一建物居住者)=215点', pts('r08-C001-1-ro'), 215);
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'visit' },
    procedures: [{ itemId: 'r08-C002-2-ro-2' }],
    facilityStandards: ['r08-fs-zaishien'],
    history: { month: { 'r08-C002-2-ro-1': 1 } },
  });
  ok('別の人数セルを同月に算定済みなら却下(same_month_group)', r.rejectedItems.some((x) => x.itemId === 'r08-C002-2-ro-2'));
  const r2 = REIMB.evaluateEncounter({
    encounter: { visitType: 'visit' },
    procedures: [{ itemId: 'r08-C002-2-ro-2' }],
    facilityStandards: ['r08-fs-zaishien'],
    history: { month: {} },
  });
  ok('同月算定なしなら通る', r2.billableItems.some((x) => x.itemId === 'r08-C002-2-ro-2'));
}

console.log(`\nreimbursement.test: ${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
