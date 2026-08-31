/* 診療科モジュール: 在宅医療・訪問診療(full)
 * 街そのものが診療フィールド。移動時間が1日の訪問可能件数を決め、
 * 月2回の定期訪問の積み上げと在宅時医学総合管理料が収益の柱。
 *
 * 制度とゲームの分離:
 *  - 点数・週3回制限(C001注1)・訪問診療日の再診料/往診料の併算定不可(rule-0008)・
 *    在医総管の施設基準(在支診)はKB+エンジンが判定
 *  - 在医総管は「在支診等(機能強化型以外)・月2回以上」の単一建物人数セル5件が
 *    KB登録済み(v50)。セル選択はZAISOKAN(app/zaisokan.js・rule-0018のみなし1人例外込み)。
 *    月2回以上訪問した患者に限り申請する(安全側の運用)。戸建て地区の患者は各1人セル、
 *    マンション地区(同一建物)は建物内の患者数で人数セルを選ぶ。
 *    施設総管(C002_2)・看取り・重症度セルはKB登録後(issues #10)
 *  - 訪問診療料はイ/ロ(同一建物居住者以外890点/同一建物居住者215点)をZAISOKAN.visitCellForが
 *    「その日に実際に訪問する集合」の建物内人数で選ぶ(v51で#25解消・rule-0019。
 *    繰越で建物内が1人になった日はイ=留意(4))
 *  - 移動時間・訪問枠・患者獲得・費用は managementParameters(ゲーム上の仮定) */
(function (root) {
  'use strict';
  // セル選択コア(ブラウザ=index.htmlが先に読む/Node=相対require)
  const ZAISOKAN = root.ZAISOKAN || (typeof require === 'function' ? require('../zaisokan.js') : null);
  const M = {
    id: 'homecare',
    name: '在宅医療・訪問診療',
    short: '在宅',
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
      zaisokanKasan: { itemId: 'r08-C002-n7-ha-1' }, // 実itemIdはZAISOKAN.n7CellForが上書き(v52)
      dataKasan: { itemId: 'r08-C002-n13' },
      shijiryo: { itemId: 'r08-C007' },
    },
    buildProcedures(report) {
      const map = this.reimbursementMappings; const ps = [];
      // a.itemIdの明示指定はマッピングに優先(在医総管の人数セル=ZAISOKANの選択結果)
      if (report.kbActs) for (const a of report.kbActs) { const m = map[a.id]; if (m) ps.push({ itemId: a.itemId || m.itemId, units: a.units || 1 }); }
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
        note: '届け出ると在宅時医学総合管理料を算定でき、休診日も臨時往診を受けられる。届出は下の施設基準の行から(在宅療養支援診療所・通常型)' },
    ],
    deptBadge(d) { return `在宅 ${d.pt.length}人`; },
    infoLine(i) { return `昨日 ${i.visits}件(往診${i.oushin})・移動${i.travelMin}分` + (i.deferred ? `・翌日へ${i.deferred}件` : ''); },

    fsDefs: [
      { fsId: 'r08-fs-zaishien',
        check(dept) {
          return dept.policy.oncall ? { ok: true } : { ok: false, missing: ['24時間の連絡・往診体制'] };
        },
        note: '従来型=通常型(様式11・届出区分4)。強化型(常勤医3名)の在医総管セルはKB未登録のため扱わない(簡略化)' },
      // 在宅療養実績加算(v52・#26): 制度は過去1年の緊急往診・看取り件数が要件。
      // 実績量はゲームでは判定しない(体制を整えた扱い=ゲーム上の仮定・便N先例)。
      // 両方届け出た場合の算定は実績1を優先(点数の高い側。二重には算定しない)
      { fsId: 'r08-fs-c002-n7-jisseki2',
        check(dept) {
          return dept.fs.includes('r08-fs-zaishien') ? { ok: true } : { ok: false, missing: ['在宅療養支援診療所の届出'] };
        },
        note: '通常型在支診+緊急往診4件・看取り2件/年+緩和ケア研修修了医(様式11の5)。実績はゲーム未判定' },
      { fsId: 'r08-fs-c002-n7-jisseki1',
        check(dept) {
          return dept.fs.includes('r08-fs-c002-n7-jisseki2') ? { ok: true } : { ok: false, missing: ['在宅療養実績加算2の届出'] };
        },
        note: '通常型在支診+緊急往診10件・看取り4件/年(様式11の5)。制度は段階制ではないがゲームは2→1の順で上げる(簡略化)',
        gameNote: '制度は段階制ではないが、ゲームでは実績加算2から順に上げる(簡略化)' },
      { fsId: 'r08-fs-c002-n13',
        check(dept) {
          return dept.fs.includes('r08-fs-zaishien') ? { ok: true } : { ok: false, missing: ['在宅療養支援診療所の届出'] };
        },
        note: '外来医療等調査への参加+データ提出体制(様式7の11)。提出の継続はゲームでは届出をもって続く扱い。制度上は在支診でなくても届出できるが、ゲームでは在医総管に乗る加算のため在支診の届出を前提にする(簡略化)',
        gameNote: '制度上は在支診でなくても届け出られる。ゲームでは在医総管に乗る加算のため在支診の届出を前提にする(簡略化)' },
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
      const cap = (ctx.homecareCap !== undefined ? ctx.homecareCap : 98); // 既定=14地区×7(game.jsのhomecareCtxが正)
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
      // パス1: 時間枠と経路で「その日に実際に訪問する集合」を確定(繰越を先に落とす)。
      // 訪問診療料のイ/ロは実訪問集合の建物内人数で決めるため2パスが必須(v51 PM指定:
      // 繰越で建物内が1人になった日はイ=890点が正しく、期日ベースで数えると過大計上が残る)
      const visited = [];
      for (const o of ordered) {
        const t = o.travelMin !== undefined ? o.travelMin : 5;
        if (minutes + t + P.visitMinutes > P.dayMinutes * (dept.staff.doctors || 1)) { o.p.nv = ctx.day + 1; deferred++; continue; }
        minutes += t + P.visitMinutes; travel += t;
        visited.push(o);
      }
      const sameDayByCl = {};
      for (const o of visited) sameDayByCl[o.p.cl] = (sameDayByCl[o.p.cl] || 0) + 1;

      // パス2: 計上(訪問診療料はマンション地区で同日2人以上ならロ=同一建物居住者215点)
      for (const o of visited) {
        const p = o.p;
        api.countVisit();
        // 月内の訪問回数はモジュール側で数える(C001は週制限の項目でエンジンの月次カウンタに載らないため)
        const mIdx = Math.floor((ctx.day - 1) / 30);
        if (p.mvm !== mIdx) { p.mvm = mIdx; p.mv = 0; }
        const site = ctx.siteInfo ? ctx.siteInfo(p.cl) : null;
        const isMansion = !!(site && site.mansion);
        // 訪問診療料のイ/ロ: 同一建物(マンション)で同日2人以上=ロ(rule-0019・v51で#25解消)
        const visitCell = (isMansion && ZAISOKAN) ? ZAISOKAN.visitCellFor(sameDayByCl[p.cl] || 1) : 'r08-C001-1-i';
        const report = { type: 'visit', kbActs: [{ id: 'visit', itemId: visitCell }] };
        // 月2回目の定期訪問で在医総管(「月2回以上」のセル要件を満たしてから申請する安全側の運用)。
        // セルは単一建物診療患者数から選ぶ: 戸建て地区=別建物なので各1人セル、
        // マンション地区=建物内の当院患者数でZAISOKANが選択(みなし1人例外込み)。
        // 人数は訪問時点の建物内患者数(全患者が毎月2回訪問+算定の決定的な運びのため月末確定と乖離しない)
        let soukanSel = null; // マンション地区のセル選択結果(ラベル分岐用に保持)
        if ((p.mv || 0) >= 1) {
          let cellId = 'r08-C002-2-ro-1';
          if (isMansion && ZAISOKAN) {
            const inBldg = dept.pt.filter((q) => q.cl === p.cl).length;
            soukanSel = ZAISOKAN.selectCell({ count: inBldg, units: site.units });
            cellId = soukanSel.itemId;
          }
          // ゲートは当該セルでなく本体セル群で判定(v52 PM条件1)。月の途中で人数区分が
          // 変わると別セルのmcが空のまま=本体はrule-0020で却下されるのに加算だけ通る穴があった
          const C002_CELLS = ['r08-C002-2-ro-1', 'r08-C002-2-ro-2', 'r08-C002-2-ro-3', 'r08-C002-2-ro-4', 'r08-C002-2-ro-5'];
          if (!C002_CELLS.some((c) => p.mc[c])) {
            report.kbActs.push({ id: 'zaiisoukan', itemId: cellId });
            // 在医総管に乗る独立加算(v52・#26): 注7実績加算(実績1優先・本体と同じ人数区分)+注13データ提出。
            // 本体の申請と同時にだけ乗せる(注7/13は在医総管の所定点数への加算のため)
            const eff = soukanSel ? soukanSel.effectiveCount : 1;
            const tier = dept.fs.includes('r08-fs-c002-n7-jisseki1') ? 'jisseki1'
              : dept.fs.includes('r08-fs-c002-n7-jisseki2') ? 'jisseki2' : null;
            if (tier && ZAISOKAN) {
              const n7 = ZAISOKAN.n7CellFor(tier, eff);
              if (n7 && !p.mc[n7]) report.kbActs.push({ id: 'zaisokanKasan', itemId: n7 });
            }
            if (dept.fs.includes('r08-fs-c002-n13') && !p.mc['r08-C002-n13']) report.kbActs.push({ id: 'dataKasan' });
          }
        }
        if (p.sj && !p.mc['r08-C007']) report.kbActs.push({ id: 'shijiryo' });
        const r = api.evalVisit(p, report);
        // 月内訪問回数はイ・ロどちらの算定でも数える(在医総管の「月2回以上」の要件はC001通算)
        if (r.ev.billableItems.some((b) => b.itemId.indexOf('r08-C001-1-') === 0)) p.mv = (p.mv || 0) + 1;
        agg.cost += P.perVisitCost;
        p.nv = this._nextVisit(p, ctx.day);
        // ラベルは地区の性質と実効人数で分岐(みなし1人はセルがro-1でもマンション訪問と言う)。
        // v50の簡略化開示3本は#25解消(イ/ロ実装)により撤去(v51 editor承認フロー)
        const soukan = r.ev.billableItems.find((b) => b.itemId.indexOf('r08-C002-2-ro') === 0);
        let label = '定期訪問診療';
        if (soukan) {
          if (!soukanSel) label = '月2回目の定期訪問+在宅時医学総合管理料';
          else if (soukanSel.effectiveCount === 1 && soukanSel.rawCount >= 2) label = '同一建物(マンション)への定期訪問+在宅時医学総合管理料(戸数比の例外で「1人の場合」を算定)';
          else label = '同一建物(マンション)への定期訪問+在宅時医学総合管理料';
        } else if (visitCell === 'r08-C001-1-ro') {
          label = '同一建物(マンション)への定期訪問 — 訪問診療料は「同一建物居住者の場合」で算定';
        }
        api.setSample(label, r.lines, r.ev, soukan ? 3 : 2);
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
