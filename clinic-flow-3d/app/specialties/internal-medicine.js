/* 診療科モジュール: 一般内科(full)
 * 生活習慣病の継続管理パネルが柱。管理料(I)/(II)の選択が包括のトレードオフとして
 * そのまま収益に出る(判定は全てREIMB経由。ここに点数を書かない)。
 *
 * 制度とゲームの分離:
 *  - 制度上の事実(点数・月1回制限・(I)の検査等包括・(I)→(II)の6月窓)はKB+エンジンが判定。
 *    検体検査パネル(採血・血算・生化学まるめ・判断料・dmはHbA1c)もKB登録済み(便I) —
 *    (I)方針の日はエンジンが包括で却下し、(II)方針では算定される。判断料・HbA1cの
 *    月1回制限もエンジン判定
 *  - 管理料は初診日には申請しない、(II)算定日は外来管理加算を申請しない、は
 *    未機械化ルール(rule-0003)に対する安全側の運用(ゲーム上の判断であり制度の断定ではない)
 *  - 需要・来院間隔・費用・検査実施の頻度は managementParameters(ゲーム上の仮定) */
(function (root) {
  'use strict';
  const M = {
    id: 'internal',
    name: '一般内科',
    short: '内科',
    icon: '🩺',
    status: 'full',
    desc: '生活習慣病の継続管理が柱。管理料(I)/(II)の選択が収益設計の中心',
    patientProfiles: [
      { id: 'ht', label: '高血圧症', weight: 0.42 },
      { id: 'dm', label: '2型糖尿病', weight: 0.32 },
      { id: 'lipid', label: '脂質異常症', weight: 0.26 },
    ],
    workflows: ['受付→診察→(検体検査/X線)→(管理料)→処方→会計'],
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
      xrayDiagChest: { itemId: 'r08-E001-1-i' },
      xrayShoot: { itemId: 'r08-E002-1-ro' },
      presc: { itemId: 'r08-F400-3' },
      tokushori: { itemId: 'r08-F400-n4' }, // 対象疾患の別表がKB未登録のため自動算定しない(unused: 登録後に運用へ)
      ippanmei: { itemId: 'r08-F400-n6-i' },
      joho: { itemId: 'r08-B009-1' },
      labBlood: { itemId: 'r08-D400-1' },
      labCbc: { itemId: 'r08-D005-5' },
      labHba1c: { itemId: 'r08-D005-9' },
      labChem: { itemId: 'r08-D007-n1-ha' },
      labJudgeHem: { itemId: 'r08-D026-3' },
      labJudgeBio: { itemId: 'r08-D026-4' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.type === 'first') ps.push({ itemId: map.first.itemId });
      if (report.type === 'revisit') ps.push({ itemId: map.revisit.itemId });
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },

    /* ---- 部門(患者パネル型)実装 ---- */
    deptDefaults: {
      staff: { doctors: 1, nurses: 1, clerks: 1 },
      equip: {},
      policy: { kanri: 'II', ippanmei: true, keiji: false },
    },
    open: { cost: 8000000, repMin: 65, needPlan: true,
      condDesc: '事業計画の策定・本院評判65以上・開設資金' },
    /* 人員UI定義: [key, 表示名, 最小, 最大, 採用費(ゲーム仮定)] */
    staffDef: [
      ['doctors', '医師', 1, 3, 1500000],
      ['nurses', '看護師', 0, 4, 120000],
      ['clerks', '医療事務', 0, 3, 60000],
    ],
    deptBadge(d) { return `管理料(${d.policy.kanri === 'I' ? 'I' : 'II'})方針`; },
    /* ゲーム上の仮定(制度情報ではない) */
    managementParameters: {
      panelPerDoctor: 600,      // 医師1人が抱えられる継続患者数(月1回通院前提)
      visitCapPerDoctor: 45,    // 1日の外来処理能力/医師
      seedPanel: 80,            // 開設時の引き継ぎ患者(前医・健診からの紹介)。初月に分散して初来院する
      enrollBase: 8,            // 新規継続患者/日(立ち上がり・評判で変動)
      acuteBase: 9,             // 急性(単発)外来/日
      revisitDays: [24, 34],    // 継続患者の来院間隔(日)
      acuteXrayProb: 0.3,       // 急性外来で胸部X線に至る率
      labCost: 600,             // 検体検査の実施原価(¥)。点数はKB(D400/D005/D007/D026)が持つ
      costs: { doctorDay: 80000, nurseDay: 18000, clerkDay: 10000, rentDay: 30000, baseDay: 8000, perVisit: 250 },
      referralSources: ['健診センター', '調剤薬局', '地域包括'],
    },
    /* 開設時: 引き継ぎ患者を初月に分散して受け入れる(nv=初来院日) */
    deptInit(dept, day) {
      const P = this.managementParameters;
      for (let i = 0; i < P.seedPanel; i++) {
        const r = Math.random(); let pr = 'lipid'; let acc = 0;
        for (const pf of this.patientProfiles) { acc += pf.weight; if (r < acc) { pr = pf.id; break; } }
        const p = { iv: P.revisitDays[0] + Math.floor(Math.random() * (P.revisitDays[1] - P.revisitDays[0] + 1)) };
        p.nv = day + 1 + Math.floor(Math.random() * 30);
        // DEPT.addPatientはこの時点で使えない(モジュールは基盤に依存しない)ため素の形で積む
        dept.seq++;
        dept.pt.push(Object.assign({ id: 'in' + dept.seq, pr, en: day, sv: 0, mc: {}, wc: {}, lb: {}, fb: false }, p));
      }
    },
    fsDefs: [
      { fsId: 'r08-fs-b001-3',
        check(dept) {
          return dept.policy.keiji ? { ok: true } : { ok: false, missing: ['長期処方・リフィル対応の院内掲示等の体制整備'] };
        },
        note: '届出不要(体制要件のみ)。ゲームでは「体制を整える」の実施で充足' },
    ],

    runDay(dept, ctx, api, agg) {
      const P = this.managementParameters;
      const C = P.costs;
      if (ctx.spec.kind === 'closed') { agg.cost += C.rentDay + C.baseDay; return; }

      const kanriKey = { lipid: 'seikatsu1Lipid', ht: 'seikatsu1Ht', dm: 'seikatsu1Dm' };
      const kanriItem = { lipid: 'r08-B001-3-1-lipid', ht: 'r08-B001-3-1-ht', dm: 'r08-B001-3-1-dm' };
      const ramp = Math.min(1, 0.25 + (ctx.day - dept.openedDay) / 90);
      const pull = 0.6 + 0.4 * (ctx.rep / 100);

      // 新規の継続患者(健診・薬局・包括からの紹介を含む)
      const cap = P.panelPerDoctor * dept.staff.doctors;
      let enroll = api.frac(P.enrollBase * dept.staff.doctors * ramp * pull);
      while (enroll-- > 0 && dept.pt.length < cap) {
        let r = ctx.rand(); let pr = 'lipid';
        for (const pf of this.patientProfiles) { if (r < pf.weight) { pr = pf.id; break; } r -= pf.weight; }
        api.addPatient(pr, { iv: P.revisitDays[0] + Math.floor(ctx.rand() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }

      // 継続患者の来院(月1回ペース)。処理能力を超えた分は翌日へ
      const capV = P.visitCapPerDoctor * dept.staff.doctors;
      let seen = 0;
      for (const p of dept.pt) {
        if (p.nv > ctx.day) continue;
        if (seen >= capV) { p.nv = ctx.day + 1; continue; }
        seen++; api.countVisit();
        const isFirst = !p.fb;
        const plan = dept.policy.kanri;
        const report = { type: isFirst ? 'first' : 'revisit', kbActs: [] };
        let tryKanriRyo = false;
        if (!isFirst && plan !== 'none' && !p.mc[plan === 'II' ? 'r08-B001-3-3' : kanriItem[p.pr]]) {
          report.kbActs.push({ id: plan === 'II' ? 'seikatsu2' : kanriKey[p.pr] });
          tryKanriRyo = true;
        }
        // 外来管理加算: (I)はエンジンが包括で却下する(rule-0002)。(II)算定日は安全側で申請しない(rule-0003未機械化)
        if (!isFirst && !(plan === 'II' && tryKanriRyo)) report.kbActs.push({ id: 'kanri' });
        report.kbActs.push({ id: 'presc' });
        if (dept.policy.ippanmei) report.kbActs.push({ id: 'ippanmei' });

        // 糖尿病の定期眼底検査への紹介: 年1回の推奨頻度を月次来院×約1/12で表現(ゲーム上の仮定)。
        // 患者1人につき一度(紹介先で継続患者になる)。診療情報提供料(I)は申請するが、
        // 紹介先が法人内の眼科なら「特別の関係」でエンジンが却下する(rule-0013)。
        // 法人内に眼科が無ければ他院への紹介となり算定できる — どちらも制度どおり
        let refEye = false;
        if (tryKanriRyo && p.pr === 'dm' && !p.rfo && ctx.rand() < 1 / 12) {
          p.rfo = 1; refEye = true;
          report.kbActs.push({ id: 'joho' });
          report.conditions = { specialRelation: !!(ctx.hasDept && ctx.hasDept('ophthalmology')) };
          api.refer('ophthalmology', 'dm-retino', '糖尿病の定期眼底検査');
        }

        // 検体検査パネルは管理料の月次来院・初診時に実施(実施原価は常に発生)。
        // 採血+血算+生化学まるめ+判断料2種、dmはHbA1c(月1回)を追加。
        // (I)方針の日はエンジンが包括で却下する(rule-0002) — レセプトに条文つきで出る
        const doLab = tryKanriRyo || isFirst;
        if (doLab) {
          agg.cost += P.labCost;
          report.kbActs.push({ id: 'labBlood' }, { id: 'labCbc' }, { id: 'labChem' },
            { id: 'labJudgeHem' }, { id: 'labJudgeBio' });
          if (p.pr === 'dm') report.kbActs.push({ id: 'labHba1c' });
        }
        const r = api.evalVisit(p, report);
        const lines = r.lines.slice();
        p.nv = ctx.day + (p.iv || 28);
        const prLabel = (this.patientProfiles.find((x) => x.id === p.pr) || {}).label || '';
        if (refEye) api.setSample(`継続患者(${prLabel})の月次来院 — 定期眼底検査の紹介`, lines, r.ev, 4);
        else if (tryKanriRyo) api.setSample(`継続患者(${prLabel})の月次来院 — 管理料${plan === 'II' ? '(II)' : '(I)'}方針`, lines, r.ev, 2);
        else if (isFirst) api.setSample(`初診(${prLabel}・継続管理の開始)`, lines, r.ev, 1);
      }

      // 急性(単発)外来: パネルに載せない一見患者
      let acute = api.frac(P.acuteBase * dept.staff.doctors * ramp * pull);
      acute = Math.min(acute, Math.max(0, capV - seen));
      for (let i = 0; i < acute; i++) {
        api.countVisit();
        const tmp = { pr: 'acute', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
        const report = { type: 'first', kbActs: [{ id: 'presc' }] };
        if (dept.policy.ippanmei) report.kbActs.push({ id: 'ippanmei' });
        if (ctx.rand() < P.acuteXrayProb) { report.kbActs.push({ id: 'xrayDiagChest' }, { id: 'xrayShoot' }); }
        const ra = api.evalVisit(tmp, report);
        api.setSample('急性疾患の一見患者(初診)', ra.lines, ra.ev, 1);
      }

      agg.cost += dept.staff.doctors * C.doctorDay + dept.staff.nurses * C.nurseDay + dept.staff.clerks * C.clerkDay
        + C.rentDay + C.baseDay + agg.visits * C.perVisit;
      agg.info = { panel: dept.pt.length, panelCap: cap, seen, acute, plan: dept.policy.kanri };
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
