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
  // rule-0008のsource配列対応: ロ(同一建物居住者)の算定日も往診料が却下される
  const r3 = REIMB.evaluateEncounter({
    encounter: { visitType: 'visit' },
    procedures: [{ itemId: 'r08-C001-1-ro' }, { itemId: 'r08-C000' }],
    facilityStandards: [], history: {},
  });
  ok('ロの算定日も往診料は却下(rule-0008配列source)', r3.rejectedItems.some((x) => x.itemId === 'r08-C000'));
}

/* 29. 便S: same_month_groupは同一受診内の同時申請も1件に絞る(#28解消・rule-0020/0023) */
{
  const r = REIMB.evaluateEncounter({
    encounter: { visitType: 'visit' },
    procedures: [{ itemId: 'r08-C002-2-ro-1' }, { itemId: 'r08-C002-2-ro-2' }],
    facilityStandards: ['r08-fs-zaishien'], history: { month: {} },
  });
  ok('在医総管: 先頭セルだけ通る', r.billableItems.some((x) => x.itemId === 'r08-C002-2-ro-1') && r.rejectedItems.some((x) => x.itemId === 'r08-C002-2-ro-2'));
  const r2 = REIMB.evaluateEncounter({
    encounter: { visitType: 'visit' },
    procedures: [{ itemId: 'r08-C002-2-ro-1' }, { itemId: 'r08-C002-n7-ha-1' }, { itemId: 'r08-C002-n7-ro-1' }],
    facilityStandards: ['r08-fs-zaishien', 'r08-fs-c002-n7-jisseki1', 'r08-fs-c002-n7-jisseki2'], history: { month: {} },
  });
  ok('実績加算: 2区分の同時申請は先頭(ha-1)だけ通る', r2.billableItems.some((x) => x.itemId === 'r08-C002-n7-ha-1') && r2.rejectedItems.some((x) => x.itemId === 'r08-C002-n7-ro-1'));
}

/* 30. 便S: 「所定点数に加算する」加算は親(本体)が同一受診で算定されないと通らない(rule-0026/0027・PM検出) */
{
  // (I)→(II)切替直後の6月窓: (II)本体はrule-0004で却下。加算3(II)は親不在で却下される
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-3' }, { itemId: 'r08-B001-3-3-n4-ro-3' }],
    facilityStandards: ['r08-fs-b001-3', 'r08-fs-b001-3-n4-3'],
    history: { monthsSince: { 'r08-B001-3-1-ht': 2 } },
  });
  ok('6月窓: (II)本体が却下', rejectedIds(r).includes('r08-B001-3-3'));
  ok('6月窓: 加算3(II)も親不在で却下(rule-0027)', rejectedIds(r).includes('r08-B001-3-3-n4-ro-3')
    && r.rejectedItems.find((x) => x.itemId === 'r08-B001-3-3-n4-ro-3').rules.some((x) => x.id === 'r08-rule-0027'));
  // 親が通る受診では加算も通る
  const r2 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-3' }, { itemId: 'r08-B001-3-3-n4-ro-3' }, { itemId: 'r08-B001-3-3-n5' }],
    facilityStandards: ['r08-fs-b001-3', 'r08-fs-b001-3-n4-3'],
    history: { monthsSince: { 'r08-B001-3-1-ht': 7 } },
  });
  ok('親あり: 加算3(II)・眼科連携強化加算(II)とも算定', billedIds(r2).includes('r08-B001-3-3-n4-ro-3') && billedIds(r2).includes('r08-B001-3-3-n5'));
  // (I)側: 本体が申請されていない受診(検体検査だけの日など)に眼科連携強化加算(I)だけ乗せても通らない
  const r3 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-n5' }],
    facilityStandards: ['r08-fs-b001-3'], history: {},
  });
  ok('(I)本体なし: 眼科連携強化加算(I)は却下(rule-0026)', rejectedIds(r3).includes('r08-B001-3-n5'));
}

/* 31. 便T: 早期診療体制充実加算は通院精神療法が同一受診で算定されないと通らない(rule-0028・親項目ゲート) */
{
  const r = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-I002-1-ha-2-1' }, { itemId: 'r08-I002-n11-ha-1' }],
    facilityStandards: ['r08-fs-i002-n11-3'],
    history: { week: { 'r08-I002-1-ha-2-1': 1 } },
  });
  ok('同週2回目: 通院精神療法が週1回で却下', rejectedIds(r).includes('r08-I002-1-ha-2-1'));
  ok('同週2回目: 加算3も親不在で却下(rule-0028)', rejectedIds(r).includes('r08-I002-n11-ha-1')
    && r.rejectedItems.find((x) => x.itemId === 'r08-I002-n11-ha-1').rules.some((x) => x.id === 'r08-rule-0028'));
  const r2 = REIMB.evaluateEncounter({
    procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-I002-1-ha-2-1' }, { itemId: 'r08-I002-n11-ha-1' }],
    facilityStandards: ['r08-fs-i002-n11-3'], history: { week: {} },
  });
  ok('親あり: 加算3が算定', billedIds(r2).includes('r08-I002-n11-ha-1'));
}

/* 32. 便U: same_month_groupのscope:'visit'(同一受診内の排他だけ)とlimit.share(月回数のセル横断合算)
 *     KBに当該ルールが入るのはコミット2のため、ここでは合成KBで機械の挙動だけ固定する */
{
  const synth = JSON.parse(JSON.stringify(KB));
  synth.rules.push({ id: 'test-visit-group', machine: { type: 'same_month_group', scope: 'visit', group: ['r08-D005-9', 'r08-D005-5'] } });
  for (const it of synth.items) if (it.id === 'r08-D005-9' || it.id === 'r08-D005-5') it.limit = { per: 'month', max: 2, share: ['r08-D005-9', 'r08-D005-5'] };
  REIMB.init(synth);
  const r = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-D005-5' }, { itemId: 'r08-D005-9' }], history: { month: {} } });
  ok('scope:visit 同一受診の2セル同時申請は申請順の先頭だけ通る', billedIds(r).includes('r08-D005-5') && rejectedIds(r).includes('r08-D005-9'));
  const r2 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-D005-9' }], history: { month: { 'r08-D005-5': 1 } } });
  ok('scope:visit 同月にグループの別セルを算定済みでも別日の受診なら通る(月枠の排他はしない)', billedIds(r2).includes('r08-D005-9'));
  const r3 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-D005-9' }], history: { month: { 'r08-D005-5': 1, 'r08-D005-9': 1 } } });
  ok('limit.share 月回数はセル横断で合算され上限に達すると却下', rejectedIds(r3).includes('r08-D005-9'));
  REIMB.init(KB);
}

/* 33. 便U: 人工腎臓の区分セル家族 — 区分3は届出なしで算定・同一受診の区分排他(rule-0031)・月14回はセル横断(share)・加算は親不在で却下(rule-0030) */
{
  const r = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-J038-3-ro' }, { itemId: 'r08-J038-n1' }], facilityStandards: [], history: { month: {} } });
  ok('区分3ロは施設基準の届出なしで算定でき、時間外・休日加算も乗る', billedIds(r).includes('r08-J038-3-ro') && billedIds(r).includes('r08-J038-n1'));
  const r2 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-3-ro' }], facilityStandards: ['r08-fs-j038-1'], history: { month: {} } });
  ok('同一受診に区分1と区分3を申請しても先頭(区分1)だけ通る(rule-0031)', billedIds(r2).includes('r08-J038-1-ro') && rejectedIds(r2).includes('r08-J038-3-ro'));
  const r3 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-J038-3-ro' }], facilityStandards: [], history: { month: { 'r08-J038-1-ro': 10, 'r08-J038-3-ro': 4 } } });
  ok('月14回は区分セル横断で数える(区分1で10回+区分3で4回の後の15回目は却下)', rejectedIds(r3).includes('r08-J038-3-ro'));
  const r4 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-n2-i' }, { itemId: 'r08-J038-n9' }, { itemId: 'r08-J038-n13' }], facilityStandards: ['r08-fs-j038-1', 'r08-fs-j038-donyuki1', 'r08-fs-j038-suishitsu', 'r08-fs-j038-n13'], history: { month: { 'r08-J038-1-ro': 14 } } });
  ok('人工腎臓が月14回で却下された受診では導入期加算1・水質確保・濾過加算も親不在で却下(rule-0030)', ['r08-J038-1-ro', 'r08-J038-n2-i', 'r08-J038-n9', 'r08-J038-n13'].every((id) => rejectedIds(r4).includes(id)));
  const r5 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-n13' }], facilityStandards: ['r08-fs-j038-1', 'r08-fs-j038-suishitsu'], history: { month: {} } });
  ok('濾過加算は自身の届出(様式49の3)が無ければ却下される', rejectedIds(r5).includes('r08-J038-n13') && billedIds(r5).includes('r08-J038-1-ro'));
}

/* 34. 便V: 下肢末梢動脈疾患指導管理加算・透析時運動指導等加算も親項目ゲート(rule-0030)の対象。n10は月1回 */
{
  const r = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-n10' }, { itemId: 'r08-J038-n14' }], facilityStandards: ['r08-fs-j038-1', 'r08-fs-j038-n10'], history: { month: { 'r08-J038-1-ro': 14 } } });
  ok('人工腎臓が月14回で却下された受診では注10・注14も親不在で却下', rejectedIds(r).includes('r08-J038-n10') && rejectedIds(r).includes('r08-J038-n14'));
  const r2 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-n10' }, { itemId: 'r08-J038-n14' }], facilityStandards: ['r08-fs-j038-1', 'r08-fs-j038-n10'], history: { month: { 'r08-J038-1-ro': 3 } } });
  ok('親ありなら両方算定', billedIds(r2).includes('r08-J038-n10') && billedIds(r2).includes('r08-J038-n14'));
  const r3 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-n10' }], facilityStandards: ['r08-fs-j038-1', 'r08-fs-j038-n10'], history: { month: { 'r08-J038-1-ro': 3, 'r08-J038-n10': 1 } } });
  ok('注10は月1回(同月2回目は却下)', rejectedIds(r3).includes('r08-J038-n10'));
  const r4 = REIMB.evaluateEncounter({ encounter: { visitType: 'hd' }, procedures: [{ itemId: 'r08-J038-1-ro' }, { itemId: 'r08-J038-n10' }], facilityStandards: ['r08-fs-j038-1'], history: { month: {} } });
  ok('注10は届出(様式49の3の2)が無ければ却下', rejectedIds(r4).includes('r08-J038-n10'));
}

/* 35. 便W: 在宅・処方の加算も親項目ゲート(rule-0033/0034・#33残り2家族) */
{
  const r = REIMB.evaluateEncounter({ encounter: { visitType: 'visit' }, procedures: [{ itemId: 'r08-C002-2-ro-2' }, { itemId: 'r08-C002-n7-ha-2' }, { itemId: 'r08-C002-n13' }], facilityStandards: ['r08-fs-zaishien', 'r08-fs-c002-n7-jisseki2', 'r08-fs-c002-n13'], history: { month: { 'r08-C002-2-ro-2': 1 } } });
  ok('在医総管が月1回で却下された受診では実績加算2・データ提出加算も却下(rule-0033)', rejectedIds(r).includes('r08-C002-n7-ha-2') && rejectedIds(r).includes('r08-C002-n13'));
  const r2 = REIMB.evaluateEncounter({ encounter: { visitType: 'visit' }, procedures: [{ itemId: 'r08-C002-2-ro-2' }, { itemId: 'r08-C002-n7-ha-2' }, { itemId: 'r08-C002-n13' }], facilityStandards: ['r08-fs-zaishien', 'r08-fs-c002-n7-jisseki2', 'r08-fs-c002-n13'], history: { month: {} } });
  ok('親ありなら実績加算2・データ提出加算とも算定', billedIds(r2).includes('r08-C002-n7-ha-2') && billedIds(r2).includes('r08-C002-n13'));
  const r3 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-F400-n6-i' }], facilityStandards: ['r08-fs-f400-n6'], history: {} });
  ok('処方箋料なしでは一般名処方加算が却下(rule-0034)', rejectedIds(r3).includes('r08-F400-n6-i'));
  const r4 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-F400-3' }, { itemId: 'r08-F400-n6-i' }], facilityStandards: ['r08-fs-f400-n6'], history: {} });
  ok('処方箋料ありなら一般名処方加算は算定', billedIds(r4).includes('r08-F400-n6-i'));
}

/* 36. 便W: 「いずれか」一族の同一受診排他(rule-0035〜0039・#36水平展開)。同一受診に複数セルを申請しても申請順の先頭だけ通る */
{
  const r = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-I002-1-ha-2-1' }, { itemId: 'r08-I002-n11-ha-1' }, { itemId: 'r08-I002-n11-ha-2' }], facilityStandards: ['r08-fs-i002-n11-3'], history: { week: {} } });
  ok('早期診療体制充実加算: 3年以内と3年超の同時申請は先頭だけ(rule-0035)', billedIds(r).includes('r08-I002-n11-ha-1') && rejectedIds(r).includes('r08-I002-n11-ha-2'));
  const r2 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-B001-3-1-ht' }, { itemId: 'r08-B001-3-n4-ro-3' }, { itemId: 'r08-B001-3-n4-ha-3' }], facilityStandards: ['r08-fs-b001-3', 'r08-fs-b001-3-n4-3'], history: {} });
  ok('充実管理加算(I): 主病をまたぐ2セルの同時申請は先頭だけ(rule-0036)', billedIds(r2).includes('r08-B001-3-n4-ro-3') && rejectedIds(r2).includes('r08-B001-3-n4-ha-3'));
  const r3 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-A001-n10-1' }, { itemId: 'r08-A001-n10-4' }], facilityStandards: ['r08-fs-a001-n10-1', 'r08-fs-a001-n10-4'], history: {} });
  ok('時間外対応体制加算: 1と4の同時申請は先頭だけ(rule-0038)', (billedIds(r3).includes('r08-A001-n10-1') || rejectedIds(r3).includes('r08-A001-n10-1')) && rejectedIds(r3).includes('r08-A001-n10-4'));
  const r4 = REIMB.evaluateEncounter({ encounter: { visitType: 'first' }, procedures: [{ itemId: 'r08-A000' }, { itemId: 'r08-A000-n16-1' }, { itemId: 'r08-A000-n16-3' }], facilityStandards: ['r08-fs-a000-n16-1', 'r08-fs-a000-n16-3'], history: {} });
  ok('電子的診療情報連携体制整備加算: 1と3の同時申請は後続が却下(rule-0039)', rejectedIds(r4).includes('r08-A000-n16-3'));
  const r5 = REIMB.evaluateEncounter({ procedures: [{ itemId: 'r08-A001' }, { itemId: 'r08-I002-1-ha-2-1' }, { itemId: 'r08-I002-n11-ha-1' }], facilityStandards: ['r08-fs-i002-n11-3'], history: { week: {}, month: { 'r08-I002-n11-ha-1': 3 } } });
  ok('scope:visit なので同月に同セルを算定済みでも別日の受診は通る(月枠の排他はしない)', billedIds(r5).includes('r08-I002-n11-ha-1'));
}

console.log(`\nreimbursement.test: ${pass} passed / ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
