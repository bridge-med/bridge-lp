/* 診療科モジュール: 精神科・心療内科(full)
 * 診察時間の配分が柱。30分未満で多く診るか、30分以上かけて診るか —
 * 時間区分がそのまま点数になる(通院精神療法)ため、1日の診察時間の使い方が経営になる。
 *
 * 制度とゲームの分離:
 *  - 点数(時間区分×精神保健指定医)・初診時1回/週1回の制限・通院精神療法の算定日に
 *    外来管理加算が算定できないこと(A001注8の精神科専門療法)はKB+エンジンが判定
 *  - 精神保健指定医に固定(社長決定)。非指定医セルと注13の減算はKB未登録のため扱わない
 *  - I002算定患者に心身医学療法は算定できない(rule-0010)ため、通院精神療法の患者と
 *    心身医学療法(心身症)の患者は名簿の上でも分けて管理する
 *  - 通いやすさ・通院間隔・費用・診察所要時間はmanagementParameters(ゲーム上の仮定)。
 *    時間をかける診療は患者が治療を続けやすい(中断が減る)という効きもゲーム上の仮定 */
(function (root) {
  'use strict';
  const M = {
    id: 'psychiatry',
    name: '精神科・心療内科',
    icon: '🌙',
    status: 'full',
    desc: '診察時間の配分が柱。時間区分がそのまま点数になり、1日の使い方が経営を決める',
    patientProfiles: [
      { id: 'mood', label: '気分障害', weight: 0.5, kind: 'i002' },
      { id: 'anxiety', label: '不安障害', weight: 0.32, kind: 'i002' },
      { id: 'shinshin', label: '心身症(心療内科)', weight: 0.18, kind: 'i004' },
    ],
    workflows: ['受付→診察(精神療法/心身医学療法)→処方→会計'],
    equipment: ['診察室(面接に足る静かな環境)'],
    staffing: ['医師(精神保健指定医)', '看護師', '精神保健福祉士'],
    reimbursementMappings: {
      first: { itemId: 'r08-A000' },
      revisit: { itemId: 'r08-A001' },
      kanri: { itemId: 'r08-A001-n8' },
      i002FirstLong: { itemId: 'r08-I002-1-ro-1-1' },   // 初診60分以上
      i002FirstStd: { itemId: 'r08-I002-1-ro-2' },      // 初診30分以上60分未満
      i002Long: { itemId: 'r08-I002-1-ha-1-1' },        // 30分以上
      i002Std: { itemId: 'r08-I002-1-ha-2-1' },         // 30分未満
      i004First: { itemId: 'r08-I004-2-i' },
      i004Revisit: { itemId: 'r08-I004-2-ro' },
      presc: { itemId: 'r08-F400-3' },
      ippanmei: { itemId: 'r08-F400-n6-i' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.type === 'first') ps.push({ itemId: map.first.itemId });
      if (report.type === 'revisit') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },

    deptDefaults: {
      staff: { doctors: 1, nurses: 0, psws: 0 },
      equip: {},
      policy: { timePlan: 'std', ippanmei: true },
    },
    open: { cost: 6000000, repMin: 65, needPlan: true,
      condDesc: '事業計画の策定・本院評判65以上・開設資金' },
    staffDef: [
      ['doctors', '医師(指定医)', 1, 2, 2000000],
      ['nurses', '看護師', 0, 2, 120000],
      ['psws', '精神保健福祉士', 0, 2, 120000],
    ],
    deptBadge(d) { return d.policy.timePlan === 'long' ? '全員30分以上' : d.policy.timePlan === 'mix' ? '必要に応じて30分以上' : '30分未満が基本'; },
    infoLine(i) { return `継続 ${i.panel}人・昨日 ${i.visits}件(診察${i.usedMin}分)` + (i.deferred ? `・翌日へ${i.deferred}件` : ''); },
    fsDefs: [],
    fsNote: '登録項目(精神保健指定医のセル)に届出必須の基準はない(KBで否定的確認済み。非指定医のセルには注13の施設基準がある)',

    /* ゲーム上の仮定(制度情報ではない) */
    managementParameters: {
      panelPerDoctor: 550,        // 継続患者の名簿上限/医師
      seedPanel: 60,
      enrollBase: 6,              // 新規/日(紹介・直接)
      revisitDays: [13, 18],      // 通院間隔(2週間隔が中心)
      dayMinutes: 460,            // 医師1人の1日の診察時間
      visitMin: { stdFirst: 45, stdRevisit: 12, longFirst: 65, longRevisit: 30, i004First: 35, i004Revisit: 12 },
      churnMonthly: { std: 0.05, mix: 0.035, long: 0.02 }, // 治療中断率(時間をかけるほど中断が減る=ゲーム上の仮定)
      pswChurnRelief: 0.005,      // 精神保健福祉士1人あたり中断率の軽減
      mixLongShare: 0.3,          // 「必要に応じて」方針で30分以上をかける患者の割合
      prescProb: 0.85,
      costs: { doctorDay: 90000, nurseDay: 18000, pswDay: 14000, rentDay: 22000, baseDay: 7000, perVisit: 150 },
      referralSources: ['内科(不調の相談)', '産業医・職場', '心理相談機関'],
    },

    deptInit(dept, day) {
      const P = this.managementParameters;
      for (let i = 0; i < P.seedPanel; i++) {
        const r = Math.random(); let pr = 'mood'; let acc = 0;
        for (const pf of this.patientProfiles) { acc += pf.weight; if (r < acc) { pr = pf.id; break; } }
        dept.seq++;
        dept.pt.push({ id: 'ps' + dept.seq, pr, en: day, sv: 0, mc: {}, wc: {}, lb: {}, fb: false,
          nv: day + 1 + Math.floor(Math.random() * 14),
          iv: P.revisitDays[0] + Math.floor(Math.random() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }
    },

    runDay(dept, ctx, api, agg) {
      const P = this.managementParameters;
      const C = P.costs;
      if (ctx.spec.kind === 'closed') { agg.cost += C.rentDay + C.baseDay; return; }
      const kindOf = (pr) => (this.patientProfiles.find((x) => x.id === pr) || {}).kind || 'i002';
      const ramp = Math.min(1, 0.25 + (ctx.day - dept.openedDay) / 90);
      const pull = 0.6 + 0.4 * (ctx.rep / 100);
      const plan = dept.policy.timePlan;

      // 新規(紹介・直接)。時間をかける方針は口コミでわずかに増える(ゲーム上の仮定)
      const cap = P.panelPerDoctor * dept.staff.doctors;
      let enroll = api.frac(P.enrollBase * dept.staff.doctors * ramp * pull * (plan === 'long' ? 1.15 : 1));
      while (enroll-- > 0 && dept.pt.length < cap) {
        let r = ctx.rand(); let pr = 'mood';
        for (const pf of this.patientProfiles) { if (r < pf.weight) { pr = pf.id; break; } r -= pf.weight; }
        api.addPatient(pr, { iv: P.revisitDays[0] + Math.floor(ctx.rand() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }
      // 治療中断(時間の方針と精神保健福祉士の支援で変わる=ゲーム上の仮定)
      const churn = Math.max(0.005, P.churnMonthly[plan] - (dept.staff.psws || 0) * P.pswChurnRelief);
      for (let i = dept.pt.length - 1; i >= 0; i--) {
        if (ctx.rand() < churn / 26) dept.pt.splice(i, 1);
      }

      // 診察: 期日の来た患者を、1日の診察時間の枠内で診る。超えた分は翌日へ
      const budget = P.dayMinutes * dept.staff.doctors;
      let used = 0, deferred = 0, seen = 0;
      for (const p of dept.pt) {
        if (p.nv > ctx.day) continue;
        const isFirst = !p.fb;
        const kind = kindOf(p.pr);
        // この患者の今日の診察を30分以上にするか(方針に従う。mixは一部の患者に時間をかける)
        const long = plan === 'long' || (plan === 'mix' && ctx.rand() < P.mixLongShare);
        const need = kind === 'i004'
          ? (isFirst ? P.visitMin.i004First : P.visitMin.i004Revisit)
          : (isFirst ? (long ? P.visitMin.longFirst : P.visitMin.stdFirst)
                     : (long ? P.visitMin.longRevisit : P.visitMin.stdRevisit));
        if (used + need > budget) { p.nv = ctx.day + 1; deferred++; continue; }
        used += need;
        api.countVisit();
        seen++;
        const report = { type: isFirst ? 'first' : 'revisit', kbActs: [] };
        if (kind === 'i004') {
          report.kbActs.push({ id: isFirst ? 'i004First' : 'i004Revisit' });
        } else {
          report.kbActs.push({ id: isFirst ? (long ? 'i002FirstLong' : 'i002FirstStd')
                                           : (long ? 'i002Long' : 'i002Std') });
        }
        // 外来管理加算は精神科専門療法の算定日には算定できない(A001注8)— エンジンの却下を代表レセプトで見せる
        if (!isFirst) report.kbActs.push({ id: 'kanri' });
        if (ctx.rand() < P.prescProb) {
          report.kbActs.push({ id: 'presc' });
          if (dept.policy.ippanmei) report.kbActs.push({ id: 'ippanmei' });
        }
        const r = api.evalVisit(p, report);
        p.nv = ctx.day + (p.iv || 14);
        const prLabel = (this.patientProfiles.find((x) => x.id === p.pr) || {}).label || '';
        // 再診を最優先で見せる: 外来管理加算の却下(A001注8)が載るのは再診のレセプトだけ
        if (kind === 'i004') api.setSample(`心身医学療法の${isFirst ? '初診' : '再診'}(${prLabel})`, r.lines, r.ev, 2);
        else if (isFirst) api.setSample(`通院精神療法の初診(${prLabel}・${long ? '60分以上' : '30分以上60分未満'})`, r.lines, r.ev, 2);
        else api.setSample(`通院精神療法(${prLabel}・${long ? '30分以上' : '30分未満'})`, r.lines, r.ev, 3);
      }

      agg.cost += dept.staff.doctors * C.doctorDay + (dept.staff.nurses || 0) * C.nurseDay + (dept.staff.psws || 0) * C.pswDay
        + C.rentDay + C.baseDay + agg.visits * C.perVisit;
      agg.info = { panel: dept.pt.length, panelCap: cap, usedMin: used, budgetMin: budget, deferred, plan, visits: seen };
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
