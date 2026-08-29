/* 診療科モジュール: 在宅医療・訪問診療(full)
 * 街そのものが診療フィールド。移動時間が1日の訪問可能件数を決め、
 * 月2回の定期訪問の積み上げと在宅時医学総合管理料が収益の柱。
 *
 * 制度とゲームの分離:
 *  - 点数・週3回制限(C001注1)・訪問診療日の再診料/往診料の併算定不可(rule-0008)・
 *    在医総管の施設基準(在支診)はKB+エンジンが判定
 *  - KBに登録済みの在医総管は「在支診等(機能強化型以外)・月2回以上・単一建物1人」の
 *    セルのみ。よってゲームでは (1)月2回以上訪問した患者に限り申請する(安全側の運用)
 *    (2)患者は全員べつべつの戸建てに住む(地区=戸建ての集まり。同一建物のセルはKB未登録のため
 *    施設・集合住宅の在宅は扱わない)。施設総管・看取り・重症度セルはKB登録後(issues #10)
 *  - 移動時間・訪問枠・患者獲得・費用は managementParameters(ゲーム上の仮定) */
(function (root) {
  'use strict';
  const M = {
    id: 'homecare',
    name: '在宅医療・訪問診療',
    icon: '🚗',
    status: 'full',
    desc: '街を診療フィールドに。訪問効率(移動距離)と24時間体制が収益を決める',
    patientProfiles: [
      { id: 'home', label: '居宅患者', weight: 1 },
    ],
    workflows: ['紹介→初回訪問→定期訪問(月2回)→(臨時往診)'],
    townSites: ['自院', '患者宅(地区=戸建ての集まり)'],
    equipment: ['往診車', '携帯診察セット', 'ICT(情報共有)'],
    staffing: ['医師', '看護師', 'ドライバー'],
    reimbursementMappings: {
      visit: { itemId: 'r08-C001-1-i' },
      oushin: { itemId: 'r08-C000' },
      zaiisoukan: { itemId: 'r08-C002-2-ro-1' },
      shijiryo: { itemId: 'r08-C007' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: m.itemId, units: a.units || 1 }); }
      return ps;
    },

    deptDefaults: {
      staff: { doctors: 1, nurses: 1, drivers: 1 },
      equip: { car: 1 },
      policy: { oncall: false },
    },
    open: { cost: 3000000, repMin: 65, needPlan: true,
      condDesc: '事業計画の策定・本院評判65以上・開設資金(往診車を含む)' },
    staffDef: [
      ['doctors', '医師', 1, 2, 1800000],
      ['nurses', '看護師', 1, 3, 120000],
      ['drivers', 'ドライバー', 1, 2, 60000],
    ],
    actions: [
      { id: 'oncall', label: '24時間の連絡・往診体制を整える', cost: 300000,
        can: (d) => !d.policy.oncall, apply: (d) => { d.policy.oncall = true; },
        note: '在宅療養支援診療所(通常型)の体制。届出は施設基準の行から' },
    ],
    deptBadge(d) { return `在宅 ${d.pt.length}人`; },
    infoLine(i) { return `昨日 ${i.visits}件(往診${i.oushin})・移動${i.travelMin}分` + (i.deferred ? `・翌日へ${i.deferred}件` : ''); },

    fsDefs: [
      { fsId: 'r08-fs-zaishien',
        check(dept) {
          return dept.policy.oncall ? { ok: true } : { ok: false, missing: ['24時間の連絡・往診体制'] };
        },
        note: '通常型(様式11の2)。強化型(常勤医3名)のセルはKB未登録のため扱わない(簡略化)' },
    ],

    managementParameters: {
      visitEveryDays: 15,          // 定期訪問の間隔(月2回ペース)
      seedPanel: 10,               // 開設時の引き継ぎ患者(病院退院支援からの紹介)
      referBase: 0.5,              // 紹介による新規患者/日(ケアマネ・病院退院支援)
      churnMonthly: 0.04,          // 月次の看取り・入院等による減(看取り加算はKB未登録のため算定しない)
      dayMinutes: 480,             // 1日の訪問活動時間
      visitMinutes: 25,            // 1件の診療時間
      minutesPerTile: 1.2,         // タウン1タイルの移動時間(ゲーム仮定)
      emergencyProb: 0.004,        // 患者1人あたり臨時往診の日次確率
      shijiRate: 0.4,              // 訪問看護連携患者の割合(訪問看護指示料の対象)
      carCostDay: 5000, perVisitCost: 500,
      costs: { doctorDay: 80000, nurseDay: 18000, driverDay: 10000, baseDay: 6000 },
      referralSources: ['病院退院支援', 'ケアマネ', '地域包括'],
    },

    /* 定期訪問はその月のo日とo+14日に揃える(月2回パターン。在医総管の
       「月2回以上」要件を確実に満たす予定の組み方=実際の在宅診療の運用と同じ) */
    _nextVisit(p, day) {
      const o = p.o || 1;
      for (let m = Math.floor((day - 1) / 30); ; m++) {
        for (const dd of [m * 30 + o, m * 30 + o + 14]) if (dd > day) return dd;
      }
    },

    /* 訪問先の割当・ルートはgame.js/town.js側(HOMECARE_SITES)が持つ。
       モジュールは「今日回る患者」の選定と算定だけを行う */
    runDay(dept, ctx, api, agg) {
      const P = this.managementParameters;
      const C = P.costs;
      agg.cost += C.baseDay + P.carCostDay * (dept.equip.car || 1);
      if (ctx.spec.kind === 'closed') {
        // 24時間体制なら休診日も臨時往診は受ける
        if (dept.policy.oncall && dept.fs.includes('r08-fs-zaishien')) this._emergencies(dept, ctx, api, agg, P);
        agg.info = Object.assign({ visits: 0, oushin: (agg.info && agg.info.oushin) || 0, travelMin: 0, deferred: 0 }, agg.info || {});
        return;
      }

      // 初営業日: 引き継ぎ患者を受け入れる(地区の割当はゲーム側のctxが行う)
      if (!dept.sd) {
        dept.sd = 1;
        for (let i = 0; i < P.seedPanel; i++) {
          const cl = ctx.assignCluster ? ctx.assignCluster() : 0;
          if (cl === null) break;
          const o = 1 + Math.floor(ctx.rand() * 14);
          const np = api.addPatient('home', { fb: true, cl, o, sj: ctx.rand() < P.shijiRate ? 1 : 0 });
          np.nv = this._nextVisit(np, ctx.day);
        }
      }
      const ramp = Math.min(1, 0.3 + (ctx.day - dept.openedDay) / 75);
      // 新規(通院困難になった患者の紹介)。空いている地区の枠まで
      const cap = (ctx.homecareCap !== undefined ? ctx.homecareCap : 84);
      let refer = api.frac(P.referBase * ramp * (0.5 + 0.5 * (ctx.rep / 100)) * (dept.staff.doctors || 1));
      while (refer-- > 0 && dept.pt.length < cap) {
        const cl = ctx.assignCluster ? ctx.assignCluster() : 0;
        if (cl === null) break;
        const o = 1 + Math.floor(ctx.rand() * 14);
        const np = api.addPatient('home', { fb: true, cl, o, sj: ctx.rand() < P.shijiRate ? 1 : 0 });
        np.nv = ctx.day; // 初回訪問は当日から(以後は月2回パターン)
      }
      // 看取り・入院等による減
      for (let i = dept.pt.length - 1; i >= 0; i--) {
        if (ctx.rand() < P.churnMonthly / 26) {
          const p = dept.pt[i];
          if (ctx.releaseCluster) ctx.releaseCluster(p.cl);
          dept.pt.splice(i, 1);
        }
      }

      // 今日の定期訪問: 期日が来た患者を地区の近い順に回る(移動時間+診療時間が1日の枠を超えたら翌日)
      const due = dept.pt.filter((p) => p.nv <= ctx.day);
      const ordered = ctx.orderByRoute ? ctx.orderByRoute(due) : due;
      let minutes = 0, travel = 0, deferred = 0;
      const visited = [];
      for (const o of ordered) {
        const t = o.travelMin !== undefined ? o.travelMin : 5;
        if (minutes + t + P.visitMinutes > P.dayMinutes * (dept.staff.doctors || 1)) { o.p.nv = ctx.day + 1; deferred++; continue; }
        minutes += t + P.visitMinutes; travel += t;
        visited.push(o);
        const p = o.p;
        api.countVisit();
        // 月内の訪問回数はモジュール側で数える(C001は週制限の項目でエンジンの月次カウンタに載らないため)
        const mIdx = Math.floor((ctx.day - 1) / 30);
        if (p.mvm !== mIdx) { p.mvm = mIdx; p.mv = 0; }
        const report = { type: 'visit', kbActs: [{ id: 'visit' }] };
        // 月2回目の定期訪問で在医総管(「月2回以上」のセル要件を満たしてから申請する安全側の運用)
        if ((p.mv || 0) >= 1 && !p.mc['r08-C002-2-ro-1']) report.kbActs.push({ id: 'zaiisoukan' });
        if (p.sj && !p.mc['r08-C007']) report.kbActs.push({ id: 'shijiryo' });
        const r = api.evalVisit(p, report);
        if (r.ev.billableItems.some((b) => b.itemId === 'r08-C001-1-i')) p.mv = (p.mv || 0) + 1;
        agg.cost += P.perVisitCost;
        p.nv = this._nextVisit(p, ctx.day);
        const hasSoukan = r.ev.billableItems.some((b) => b.itemId === 'r08-C002-2-ro-1');
        api.setSample(hasSoukan ? '月2回目の定期訪問+在宅時医学総合管理料' : '定期訪問診療(同一建物居住者以外)', r.lines, r.ev, hasSoukan ? 3 : 2);
      }

      // 臨時往診(訪問診療の算定日はrule-0008で往診料が却下されることも、エンジンがそのまま見せる)
      const oushin = this._emergencies(dept, ctx, api, agg, P);

      agg.cost += (dept.staff.doctors || 0) * C.doctorDay + (dept.staff.nurses || 0) * C.nurseDay + (dept.staff.drivers || 0) * C.driverDay;
      agg.info = {
        panel: dept.pt.length, cap,
        visits: visited.length, oushin, travelMin: Math.round(travel), deferred,
        visitedClusters: [...new Set(visited.map((o) => o.p.cl))],
      };
    },

    _emergencies(dept, ctx, api, agg, P) {
      let n = 0;
      for (const p of dept.pt) {
        if (ctx.rand() < P.emergencyProb) {
          api.countVisit(); n++;
          const r = api.evalVisit(p, { type: 'oushin', kbActs: [{ id: 'oushin' }] });
          agg.cost += P.perVisitCost;
          api.setSample('臨時の往診(患家の求めに応じて)', r.lines, r.ev, 2);
        }
      }
      return n;
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
