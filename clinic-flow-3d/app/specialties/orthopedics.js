/* 診療科モジュール: 整形外科(Reference Implementation・完全統合)
 * ゲームの診療レポート(report)を診療報酬エンジンの procedures に変換する。
 * KB項目IDのみを書く。点数・条件はKB(data/kb-r08.js)が唯一の情報源。 */
(function (root) {
  'use strict';
  const M = {
    id: 'orthopedics',
    name: '整形外科',
    short: '整形外科',
    icon: '🦴',
    status: 'full',
    desc: 'リハ・注射・画像の複合単価。施設基準(運動器リハ)が経営の天井を決める',
    main: { line: 'リハと注射と画像。天井は施設基準', order: 1 }, // 開始の扉の候補=本院として引き継げる外来型(v66)。lineは375pxで1行(20字以内)

    patientProfiles: [
      { id: 'senior', label: '高齢者', majors: ['変形性膝関節症', '腰部脊柱管狭窄症', '骨粗鬆症'] },
      { id: 'worker', label: '勤労者', majors: ['腰痛症', '頸肩腕症候群'] },
      { id: 'sports', label: 'スポーツ', majors: ['捻挫・靱帯損傷', '疲労骨折'] },
    ],
    workflows: ['受付→診察→(X線)→(処置/注射)→(リハ処方→理学療法)→会計'],
    equipment: ['X線装置', '物理療法機器', '機能訓練室(45㎡/100㎡)', '(任意)エコー・MRI・DEXA'],
    staffing: ['医師', '看護師', '理学療法士(施設基準要件)', '受付'],

    /* 行為カタログ: ゲーム内行為ID → KB項目ID(+既定単位) */
    reimbursementMappings: {
      first: { itemId: 'r08-A000' },
      revisit: { itemId: 'r08-A001' },
      kanri: { itemId: 'r08-A001-n8' },       // 外来管理加算(可否はエンジンが判定)
      xrayDiag: { itemId: 'r08-E001-1-ro' },   // 四肢の写真診断
      xrayShoot: { itemId: 'r08-E002-1-ro' },  // デジタル撮影
      jointInj: { itemId: 'r08-J116' },        // 関節穿刺(片側)
      reha1: { itemId: 'r08-H002-1', units: 2 },
      reha2: { itemId: 'r08-H002-2', units: 2 },
      reha3: { itemId: 'r08-H002-3', units: 2 },
      presc: { itemId: 'r08-F400-3' },
      tokushori: { itemId: 'r08-F400-n4' },
      ippanmei: { itemId: 'r08-F400-n6-i' },
    },
    /* 施設基準: ゲームのリハ届出レベル(1..3=III..I) → KBのfs id */
    rehaFsByLevel: { 1: 'r08-fs-h002-3', 2: 'r08-fs-h002-2', 3: 'r08-fs-h002-1' },
    rehaItemByLevel: { 1: 'r08-H002-3', 2: 'r08-H002-2', 3: 'r08-H002-1' },

    /* ゲームレポート → エンジン入力(procedures)。KB未登録の行為はここに含めず、
       ゲーム側でsimulated(教育用概算)として扱う */
    buildProcedures(report, settings) {
      const map = this.reimbursementMappings;
      const ps = [];
      if (report.type === 'first') ps.push({ itemId: map.first.itemId });
      if (report.type === 'revisit' || report.type === 'rehab') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) {
        for (const act of report.kbActs) {
          const m = map[act.id];
          if (m) ps.push({ itemId: m.itemId, units: act.units || m.units || 1 });
        }
      }
      return ps;
    },

    /* ゲーム上の仮定(制度情報ではない): 需要・確率・原価等は game.js の
       COSTS/確率スライダーに委譲。ここでは診療科差分のみ持つ */
    managementParameters: { baseDemand: 1.0, referralSources: ['整形外科病院', '介護施設', '学校/クラブ'] },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
