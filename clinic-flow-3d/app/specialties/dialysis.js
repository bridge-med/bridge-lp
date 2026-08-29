/* 診療科モジュール: 人工透析(basic — ベッド×クール×稼働率の経営構造で拡張予定) */
(function (root) {
  'use strict';
  const M = {
    id: 'dialysis',
    name: '人工透析',
    icon: '🫘',
    status: 'basic',
    desc: 'ベッド数×クール数×稼働率のストック型経営。施設区分の維持が最重要',
    patientProfiles: [
      { id: 'maintenance', label: '維持透析', majors: ['慢性腎臓病(維持透析)'] },
      { id: 'induction', label: '導入期', majors: ['透析導入'] },
    ],
    workflows: ['送迎→穿刺→透析(4-5h)→返血→(月1回 管理料/採血)→会計'],
    equipment: ['透析用監視装置(台数が施設区分を決める)', '水処理設備', '透析ベッド', '送迎車'],
    staffing: ['医師', '看護師', '臨床工学技士(CE・安全管理委員会責任者)', '送迎ドライバー'],
    reimbursementMappings: {
      revisit: { itemId: 'r08-A001' },
      hd: { itemId: 'r08-J038-1-ro' },          // 慢性維持透析1・4-5h(施設区分で差替え)
      waterQuality: { itemId: 'r08-J038-n9' },
      induction: { itemId: 'r08-J038-n2-i' },
      monthlyMgmt: { itemId: 'r08-B001-15' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.type === 'revisit' || report.type === 'hd') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },
    managementParameters: { baseDemand: 0.5, cool: { perDay: 2, nightOption: true }, referralSources: ['腎臓内科', '総合病院'] },
    todo: 'ダイアライザー材料・障害者等加算のKB登録と、クール/送迎の3D実装',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
