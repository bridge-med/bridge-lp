/* 診療科モジュール: 人工透析(full)
 * ベッド(装置)×クール×稼働率のストック型経営。施設区分(区分1)の維持が最重要。
 *
 * 制度とゲームの分離:
 *  - 人工腎臓の点数・月14回制限・薬剤包括(rule-0006)・外来医学管理料の検査包括(rule-0007)・
 *    施設基準(区分1: 装置26台未満または患者/装置比3.5未満+安全管理体制)はKB+エンジンが判定
 *  - ダイアライザー(Ia型・回路含む161点=材料価格1,610円)はKB登録済みでセッションごとに請求(v45)。
 *    型をIa型に固定するのはゲーム上の仮定。加算群(導入期以外)は未登録のまま
 *  - 患者獲得・離脱・クール運用・費用は managementParameters(ゲーム上の仮定)。
 *    materialPerSessionは穿刺針・生食等ダイアライザー以外も含む実施原価の概算 */
(function (root) {
  'use strict';
  const M = {
    id: 'dialysis',
    name: '人工透析',
    short: '透析',
    icon: '🫘',
    status: 'full',
    desc: 'ベッド数×クール数×稼働率のストック型経営。施設区分の維持が最重要',
    patientProfiles: [
      { id: 'maintenance', label: '維持透析', weight: 0.9 },
      { id: 'induction', label: '導入期', weight: 0.1 },
    ],
    workflows: ['穿刺→透析(4-5h)→返血→(月1回 管理料)→会計'],
    equipment: ['透析用監視装置(台数が施設区分を決める)', '水処理設備', '透析ベッド'],
    staffing: ['医師', '看護師', '臨床工学技士(CE・安全管理責任者)'],
    reimbursementMappings: {
      revisit: { itemId: 'r08-A001' },
      hd: { itemId: 'r08-J038-1-ro' },
      induction: { itemId: 'r08-J038-n2-i' },
      waterQuality: { itemId: 'r08-J038-n9' },
      monthlyMgmt: { itemId: 'r08-B001-15' },
      dialyzer: { itemId: 'r08-t710010929' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.type === 'revisit' || report.type === 'hd') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },

    deptDefaults: {
      staff: { doctors: 1, nurses: 2, ces: 1 },
      equip: { beds: 8, water: false },
      policy: { cools: 2, explain: false },
    },
    open: { cost: 25000000, repMin: 70, needPlan: true,
      condDesc: '事業計画の策定・本院評判70以上・開設資金(装置8台を含む)' },
    staffDef: [
      ['doctors', '医師', 1, 2, 1800000],
      ['nurses', '看護師', 2, 12, 120000],
      ['ces', '臨床工学技士', 0, 4, 200000],
    ],
    /* 設備・体制の投資(ゲーム上の仮定)。制度上の要件はfsDefs+KBが判定する */
    actions: [
      { id: 'addBed', label: '透析装置+ベッドを増設', cost: 2500000,
        can: (d) => d.equip.beds < 25, apply: (d) => { d.equip.beds++; },
        note: '装置26台以上は施設区分1の装置要件を外れる(KBの要件)ため25台まで' },
      { id: 'water', label: '水処理設備を導入(水質確保の体制)', cost: 3000000,
        can: (d) => !d.equip.water, apply: (d) => { d.equip.water = true; },
        note: '透析液水質確保加算の体制(様式49)。届出は施設基準の行から' },
      { id: 'explain', label: '腎代替療法の説明体制を整える', cost: 100000,
        can: (d) => !d.policy.explain, apply: (d) => { d.policy.explain = true; },
        note: '導入期加算1の体制(様式2の2)。届出は施設基準の行から' },
    ],
    deptBadge(d) { return `${d.equip.beds}床×${d.policy.cools}クール`; },
    infoLine(i) { return `患者 ${i.census}人・昨日 ${i.seen}/${i.capacity}枠` + (i.waitlist ? `・待機${i.waitlist}` : ''); },

    fsDefs: [
      { fsId: 'r08-fs-j038-1',
        check(dept) {
          const missing = [];
          if (dept.equip.beds >= 26) missing.push(`装置台数の要件(26台未満・現在${dept.equip.beds}台)`);
          if ((dept.staff.ces || 0) < 1) missing.push('安全管理責任者(専任CE1名以上)');
          return { ok: missing.length === 0, missing };
        },
        note: '患者/装置比3.5未満の代替要件はゲームでは装置台数で代表(簡略化)' },
      { fsId: 'r08-fs-j038-donyuki1',
        check(dept) {
          return dept.policy.explain ? { ok: true } : { ok: false, missing: ['腎代替療法の説明体制'] };
        },
        note: '説明体制はゲームでは体制スイッチで代表(簡略化)' },
      { fsId: 'r08-fs-j038-suishitsu',
        check(dept) {
          return dept.equip.water ? { ok: true } : { ok: false, missing: ['水処理設備'] };
        },
        note: null },
    ],

    managementParameters: {
      censusSeed: 12,               // 開設時の引き継ぎ患者(連携病院からの紹介)
      referBase: 0.6,               // 紹介による新規患者/日(評判・立ち上がりで変動)
      churnMonthly: 0.02,           // 月次の離脱率(転院・入院等)
      utilizationTarget: 0.85,      // クール枠に対する予約充足の上限
      materialPerSession: 6000,     // 材料の実施原価概算(ダイアライザー実購入費+穿刺針・生食等。請求はKBのダイアライザー161点のみ)
      nursePerBedsCool: 4,          // 看護師1人あたり同時4床
      costs: { doctorDay: 90000, nurseDay: 18000, ceDay: 20000, rentPerBed: 2000, baseDay: 12000 },
      referralSources: ['腎臓内科', '総合病院'],
    },

    deptInit(dept, day) {
      const P = this.managementParameters;
      for (let i = 0; i < P.censusSeed; i++) {
        dept.seq++;
        dept.pt.push({ id: 'dx' + dept.seq, pr: 'maintenance', en: day, nv: day, sv: 0,
          mc: {}, wc: {}, lb: {}, fb: true, du: 0, so: i % 2 });
      }
    },

    runDay(dept, ctx, api, agg) {
      const P = this.managementParameters;
      const C = P.costs;
      agg.cost += dept.equip.beds * C.rentPerBed + C.baseDay;
      if (ctx.spec.kind === 'closed') return; // 休診日は透析も休止(隔日スケジュールの週6日運用)

      const ramp = Math.min(1, 0.3 + (ctx.day - dept.openedDay) / 60);
      // 新規患者(腎臓内科からの紹介)。導入期は1月(du=導入期の終了日)
      // 受入は治療枠の範囲まで(枠がない患者を抱え込まない=紹介を断る)
      const acceptCap = Math.floor(Math.min(dept.equip.beds * dept.policy.cools,
        (dept.staff.nurses || 0) * P.nursePerBedsCool * dept.policy.cools) * P.utilizationTarget) * 2;
      let refer = api.frac(P.referBase * ramp * (0.5 + 0.5 * (ctx.rep / 100)));
      while (refer-- > 0 && dept.pt.length < acceptCap) {
        api.addPatient('induction', { fb: true, du: ctx.day + 30, so: dept.pt.length % 2 });
      }
      // 離脱(月次→日次換算。週6日営業=月26日)
      for (let i = dept.pt.length - 1; i >= 0; i--) {
        if (ctx.rand() < P.churnMonthly / 26) dept.pt.splice(i, 1);
      }

      // 今日のセッション: 隔日スケジュール(半分ずつ)×クール枠×稼働上限
      const wd = (ctx.day - 1) % 7;
      const group = wd % 2;
      const due = dept.pt.filter((p) => p.so === group);
      const nurseCap = (dept.staff.nurses || 0) * P.nursePerBedsCool * dept.policy.cools;
      const capacity = Math.floor(Math.min(dept.equip.beds * dept.policy.cools, nurseCap) * P.utilizationTarget);
      const seen = due.slice(0, capacity);

      // 枠からあふれた患者は治療を受けられず、高い確率で他院へ移る
      for (let i = dept.pt.length - 1; i >= 0; i--) {
        const p = dept.pt[i];
        if (p.so === group && !seen.includes(p) && ctx.rand() < 0.05) dept.pt.splice(i, 1);
      }
      for (const p of seen) {
        api.countVisit();
        // ダイアライザー(Ia型・回路含む)はセッションごとに1本(材料価格基準区分040)
        const report = { type: 'hd', kbActs: [{ id: 'hd' }, { id: 'dialyzer' }] };
        if (p.du > ctx.day) report.kbActs.push({ id: 'induction' });
        if (dept.fs.includes('r08-fs-j038-suishitsu')) report.kbActs.push({ id: 'waterQuality' });
        // 月1回: 慢性維持透析患者外来医学管理料(検査の包括はrule-0007)
        if (!p.mc['r08-B001-15'] && p.du <= ctx.day) report.kbActs.push({ id: 'monthlyMgmt' });
        const r = api.evalVisit(p, report);
        agg.cost += P.materialPerSession;
        const hasMgmt = r.ev.billableItems.some((b) => b.itemId === 'r08-B001-15');
        const label = p.du > ctx.day ? '導入期の透析(導入期加算1)'
          : hasMgmt ? '維持透析+月1回の外来医学管理料'
          : '維持透析(4時間以上5時間未満)';
        api.setSample(label, r.lines, r.ev, hasMgmt ? 3 : 2);
      }

      agg.cost += (dept.staff.doctors || 0) * C.doctorDay + (dept.staff.nurses || 0) * C.nurseDay + (dept.staff.ces || 0) * C.ceDay;
      agg.info = {
        census: dept.pt.length, beds: dept.equip.beds, cools: dept.policy.cools,
        capacity, seen: seen.length, waitlist: Math.max(0, due.length - seen.length),
      };
      // 区分1の維持が危うい時の予告(降格の前に知らせる)
      if (dept.equip.beds >= 24 && dept.fs.includes('r08-fs-j038-1')) {
        agg.events.push({ kind: 'fs_warn', message: `装置${dept.equip.beds}台 — 26台以上になると施設区分1の装置要件を外れます` });
      }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
