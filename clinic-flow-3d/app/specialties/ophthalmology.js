/* 診療科モジュール: 眼科(basic — 選択可能な基本構造。設備投資→検査範囲→単価の軸で拡張予定) */
(function (root) {
  'use strict';
  const M = {
    id: 'ophthalmology',
    name: '眼科',
    icon: '👁',
    status: 'basic',
    desc: '検査の積み上げ+白内障日帰り手術。設備投資が検査可能範囲と単価を決める',
    patientProfiles: [
      { id: 'cataract', label: '白内障', majors: ['白内障'] },
      { id: 'glaucoma', label: '緑内障管理', majors: ['緑内障'] },
      { id: 'dm-retino', label: '糖尿病網膜症', majors: ['糖尿病網膜症(内科紹介)'] },
    ],
    workflows: ['受付→視力/屈折/眼圧→診察→(細隙灯/眼底)→(術前検査→手術)→会計'],
    equipment: ['視力表・レフラクトメーター', '眼圧計', '細隙灯', '眼底鏡', '(投資)OCT・視野計・手術設備'],
    staffing: ['医師', '看護師', '視能訓練士(将来)', '受付'],
    reimbursementMappings: {
      first: { itemId: 'r08-A000' },
      revisit: { itemId: 'r08-A001' },
      refraction: { itemId: 'r08-D261-2' },
      vision: { itemId: 'r08-D263-1' },
      tonometry: { itemId: 'r08-D264' },
      slitlamp: { itemId: 'r08-D257' },
      fundus: { itemId: 'r08-D255' },
      keratometry: { itemId: 'r08-D265' },
      axial: { itemId: 'r08-D269-2' },
      cataractOp: { itemId: 'r08-K282-1-ro' },
      presc: { itemId: 'r08-F400-3' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.type === 'first') ps.push({ itemId: map.first.itemId });
      if (report.type === 'revisit') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },
    managementParameters: { baseDemand: 0.9, referralSources: ['内科(糖尿病連携)', '学校健診', '高齢者施設'] },
    todo: 'OCT・視野検査・眼内レンズ材料のKB登録後に設備投資ループを実装',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
