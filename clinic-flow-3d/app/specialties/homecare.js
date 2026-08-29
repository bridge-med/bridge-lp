/* 診療科モジュール: 在宅医療・訪問診療(basic — 3Dタウン基盤)
 * 街そのものを診療フィールドにする将来モジュール。訪問先・移動・ルートの
 * パラメータ構造をここに定義し、3D実装(town.js拡張)の受け皿とする。 */
(function (root) {
  'use strict';
  const M = {
    id: 'homecare',
    name: '在宅医療・訪問診療',
    icon: '🚗',
    status: 'basic',
    desc: '街を診療フィールドに。訪問効率(移動距離)と在医総管のセル選択が収益を決める',
    patientProfiles: [
      { id: 'home', label: '居宅患者', majors: ['慢性心不全', '認知症', 'がん終末期'] },
      { id: 'facility', label: '施設入居者', majors: ['要介護高齢者(サ高住・有老)'] },
    ],
    workflows: ['紹介→新患受付→初回訪問→定期訪問(月2回)→(臨時往診)→(看取り)'],
    /* 3Dタウンの訪問先タイプ(town.js拡張の受け皿) */
    townSites: ['自院', '患者宅', '有料老人ホーム', '特養', 'サ高住', '病院', '居宅介護支援事業所', '訪問看護ステーション', '薬局'],
    /* 訪問患者の属性スキーマ(street座標・頻度・重症度・緊急往診確率) */
    visitPatientSchema: { pos: '[x,y] タウン座標', visitFreq: '月あたり定期訪問回数', severity: '重症度(定める状態か)', emergencyProb: '緊急往診の日次確率', buildingId: '同一建物判定用' },
    routeModel: {
      note: 'ゲーム上の仮定: 移動距離→1日訪問可能件数・車両費・遅延リスクに変換する係数',
      minutesPerKm: 4, visitMinutes: 25, dayMinutes: 480,
    },
    equipment: ['往診車', '携帯診察セット', 'ICT(情報共有)'],
    staffing: ['医師', '看護師', 'ドライバー', '事務(施設連携)'],
    reimbursementMappings: {
      visit: { itemId: 'r08-C001-1-i' },        // 訪問診療(同一建物以外)
      oushin: { itemId: 'r08-C000' },           // 臨時往診
      zaiisoukan: { itemId: 'r08-C002-2-ro-1' },// 在医総管(在支診・月2回・1人)
      shijiryo: { itemId: 'r08-C007' },         // 訪問看護指示料
    },
    facilityStandards: ['r08-fs-zaishien'],
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },
    managementParameters: { baseDemand: 0.6, referralSources: ['病院退院支援', 'ケアマネ', '訪問看護', '施設'] },
    todo: '施設総管・看取り加算・同一建物ロジックのKB登録と、訪問ルートの3D実装(town.js)',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
