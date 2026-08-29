/* 診療科モジュール: 一般内科(basic — 選択可能な基本構造。臨床フローの完全実装は次段) */
(function (root) {
  'use strict';
  const M = {
    id: 'internal',
    name: '一般内科',
    icon: '🩺',
    status: 'basic',
    desc: '生活習慣病の継続管理が柱。管理料(I)/(II)の選択が収益設計の中心',
    patientProfiles: [
      { id: 'lifestyle', label: '生活習慣病', majors: ['高血圧症', '2型糖尿病', '脂質異常症'] },
      { id: 'acute', label: '急性疾患', majors: ['感冒', '発熱', '胃腸炎'] },
      { id: 'chronic', label: 'その他慢性疾患', majors: ['慢性心不全', 'COPD'] },
    ],
    workflows: ['受付→診察→(検体検査/心電図/X線)→(管理料)→処方→会計'],
    equipment: ['心電計', 'X線装置', '(任意)超音波・迅速検査機器'],
    staffing: ['医師', '看護師', '受付・医療事務'],
    reimbursementMappings: {
      first: { itemId: 'r08-A000' },
      revisit: { itemId: 'r08-A001' },
      kanri: { itemId: 'r08-A001-n8' },
      seikatsu1Lipid: { itemId: 'r08-B001-3-1-lipid' },
      seikatsu1Ht: { itemId: 'r08-B001-3-1-ht' },
      seikatsu1Dm: { itemId: 'r08-B001-3-1-dm' },
      seikatsu2: { itemId: 'r08-B001-3-3' },
      xrayDiagChest: { itemId: 'r08-E001-1-i' },   // 胸部(イ)
      xrayShoot: { itemId: 'r08-E002-1-ro' },
      presc: { itemId: 'r08-F400-3' },
      tokushori: { itemId: 'r08-F400-n4' },
      ippanmei: { itemId: 'r08-F400-n6-i' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.type === 'first') ps.push({ itemId: map.first.itemId });
      if (report.type === 'revisit') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },
    managementParameters: { baseDemand: 1.1, referralSources: ['健診センター', '調剤薬局', '地域包括'] },
    todo: '検体検査の個別項目・体制加算群のKB登録後にフロー完全実装(medical-kb issues #10)',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
