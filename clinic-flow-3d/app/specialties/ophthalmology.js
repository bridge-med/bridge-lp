/* 診療科モジュール: 眼科(full)
 * 検査設備投資→検査可能範囲→単価のループと、白内障日帰り手術のパイプラインが柱。
 *
 * 制度とゲームの分離:
 *  - 点数・併算定(屈折×矯正視力のrule-0005)・回数制限はKB+エンジンが判定
 *  - 水晶体再建術に届出必須の施設基準の定めがないことはKBで否定的確認済み
 *    (item r08-K282-1-ro)。手術の可否を「手術設備投資」で縛るのはゲーム上の仮定
 *  - 眼内レンズは請求しない — これは制度上の事実(v45で確定): 費用は水晶体再建術の
 *    所定点数に含まれ別に算定できない(留意K282(2))。材料価格基準(告示73号)・
 *    特定器材マスターにも不収載(否定的確認)。surgMaterialCostは原価のみ計上
 *  - 需要・変換率・費用は managementParameters(ゲーム上の仮定) */
(function (root) {
  'use strict';
  const M = {
    id: 'ophthalmology',
    name: '眼科',
    short: '眼科',
    icon: '👁',
    status: 'full',
    desc: '検査の積み上げ・白内障日帰り手術。設備投資が検査可能範囲と単価を決める',
    patientProfiles: [
      { id: 'glaucoma', label: '緑内障管理', weight: 0.5 },
      { id: 'dm-retino', label: '糖尿病網膜症', weight: 0.2 },
      { id: 'dry-eye', label: '慢性眼表面疾患', weight: 0.3 },
    ],
    workflows: ['受付→視力/屈折/眼圧→診察→(細隙灯/眼底)→(術前検査→手術→術後)→会計'],
    equipment: ['視力表・レフラクトメーター', '眼圧計', '細隙灯', '(投資)精密眼底セット', '(投資)手術設備'],
    staffing: ['医師', '看護師', '視能訓練士(ORT)', '受付・医療事務'],
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

    deptDefaults: {
      staff: { doctors: 1, nurses: 1, orts: 1, clerks: 1 },
      equip: { fundusSet: false, surgery: false },
      policy: {},
    },
    open: { cost: 12000000, repMin: 65, needPlan: true,
      condDesc: '事業計画の策定・本院評判65以上・開設資金' },
    staffDef: [
      ['doctors', '医師', 1, 2, 1800000],
      ['nurses', '看護師', 1, 4, 120000],
      ['orts', '視能訓練士', 0, 3, 150000],
      ['clerks', '医療事務', 0, 2, 60000],
    ],
    /* 設備投資(主役レバー)。ゲーム上の仮定 */
    actions: [
      { id: 'fundusSet', label: '精密眼底セットを導入', cost: 1200000,
        can: (d) => !d.equip.fundusSet, apply: (d) => { d.equip.fundusSet = true; },
        note: '精密眼底検査ができるようになる(緑内障・糖尿病網膜症の管理単価が上がる)' },
      { id: 'surgery', label: '手術設備を導入(白内障日帰り)', cost: 15000000,
        can: (d) => !d.equip.surgery, apply: (d) => { d.equip.surgery = true; },
        note: '術前検査(角膜曲率・眼軸)と水晶体再建術が始まる。眼内レンズの費用は手術の所定点数に含まれる(材料としては請求できない)' },
    ],
    deptBadge(d) { return d.equip.surgery ? '日帰り手術あり' : d.equip.fundusSet ? '精密眼底あり' : '基本検査のみ'; },
    infoLine(i) { return `継続 ${i.panel}人` + (i.preop !== undefined && (i.preop + i.surgeryQueue + i.postop) > 0 ? `・白内障 待ち${i.preop + i.surgeryQueue}/術後${i.postop}` : ''); },
    fsDefs: [],
    fsNote: '登録項目に届出必須の施設基準の定めはない(KBで否定的確認済み)',

    managementParameters: {
      panelPerDoctor: 1200,       // 継続管理(緑内障等)の名簿上限/医師
      seedPanel: 120,
      enrollBase: 12,
      revisitDays: [28, 42],      // 継続患者の来院間隔
      examCapBase: 15,            // 医師1人の検査枠/日
      examCapPerOrt: 25,          // ORT1人の検査枠/日
      acuteBase: 12,              // 急性・一見(結膜炎等)/日
      glassesBase: 4,             // 眼鏡処方の来院/日
      cataractConvert: 0.02,      // 継続患者の来院1回あたり手術候補になる確率
      cataractQueueFromAcute: 0.08, // 一見から手術候補への変換率
      surgPerDay: 4,              // 手術枠/日(手術日のみ)
      queueMax: 40,               // 手術待ちの上限(超えると紹介患者は他院へ流れる)
      surgDays: [2, 5],           // 手術日(週内の曜日: 火・金)
      surgMaterialCost: 15000,    // 手術1件の材料費概算(眼内レンズ等の購入原価。IOLは手術点数に包括=請求なしが制度どおり)
      costs: { doctorDay: 90000, nurseDay: 18000, ortDay: 15000, clerkDay: 10000, rentDay: 38000, baseDay: 8000, perVisit: 250 },
      referralSources: ['内科(糖尿病連携)', '学校健診', '高齢者施設'],
    },

    deptInit(dept, day) {
      const P = this.managementParameters;
      dept.queue = { preop: 0, surgery: 0, postop: [] }; // 白内障パイプライン(人数)
      for (let i = 0; i < P.seedPanel; i++) {
        const r = Math.random(); let pr = 'dry-eye'; let acc = 0;
        for (const pf of this.patientProfiles) { acc += pf.weight; if (r < acc) { pr = pf.id; break; } }
        dept.seq++;
        dept.pt.push({ id: 'op' + dept.seq, pr, en: day, sv: 0, mc: {}, wc: {}, lb: {}, fb: false,
          nv: day + 1 + Math.floor(Math.random() * 35), iv: P.revisitDays[0] + Math.floor(Math.random() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }
    },

    runDay(dept, ctx, api, agg) {
      const P = this.managementParameters;
      const C = P.costs;
      if (!dept.queue) dept.queue = { preop: 0, surgery: 0, postop: [] };
      if (ctx.spec.kind === 'closed') { agg.cost += C.rentDay + C.baseDay; return; }
      const ramp = Math.min(1, 0.25 + (ctx.day - dept.openedDay) / 90);
      const pull = 0.6 + 0.4 * (ctx.rep / 100);
      const examCap = P.examCapBase * dept.staff.doctors + P.examCapPerOrt * (dept.staff.orts || 0);
      let examUsed = 0;

      // 新規の継続患者
      const cap = P.panelPerDoctor * dept.staff.doctors;
      let enroll = api.frac(P.enrollBase * dept.staff.doctors * ramp * pull);
      while (enroll-- > 0 && dept.pt.length < cap) {
        let r = ctx.rand(); let pr = 'dry-eye';
        for (const pf of this.patientProfiles) { if (r < pf.weight) { pr = pf.id; break; } r -= pf.weight; }
        api.addPatient(pr, { iv: P.revisitDays[0] + Math.floor(ctx.rand() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }

      // 継続管理の来院: 眼圧+細隙灯(+精密眼底は設備がある場合)
      for (const p of dept.pt) {
        if (p.nv > ctx.day) continue;
        if (examUsed >= examCap) { p.nv = ctx.day + 1; continue; }
        examUsed++; api.countVisit();
        const isFirst = !p.fb;
        const report = { type: isFirst ? 'first' : 'revisit', kbActs: [{ id: 'tonometry' }, { id: 'slitlamp' }] };
        if (dept.equip.fundusSet && (p.pr === 'glaucoma' || p.pr === 'dm-retino') && ctx.rand() < 0.5) report.kbActs.push({ id: 'fundus' });
        if (ctx.rand() < 0.5) report.kbActs.push({ id: 'presc' });
        const r = api.evalVisit(p, report);
        p.nv = ctx.day + (p.iv || 30);
        const prLabel = (this.patientProfiles.find((x) => x.id === p.pr) || {}).label || '';
        api.setSample(`継続管理(${prLabel})の来院`, r.lines, r.ev, 2);
        // 高齢層の一部が白内障の手術候補へ(月次換算の確率)
        if (dept.equip.surgery && dept.queue.preop + dept.queue.surgery < P.queueMax && ctx.rand() < P.cataractConvert) dept.queue.preop++;
      }

      // 一見(急性)+眼鏡処方
      let acute = api.frac(P.acuteBase * ramp * pull);
      let glasses = api.frac(P.glassesBase * ramp * pull);
      acute = Math.min(acute, Math.max(0, examCap - examUsed)); examUsed += acute;
      glasses = Math.min(glasses, Math.max(0, examCap - examUsed)); examUsed += glasses;
      for (let i = 0; i < acute; i++) {
        api.countVisit();
        const tmp = { pr: 'acute', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
        const r = api.evalVisit(tmp, { type: 'first', kbActs: [{ id: 'slitlamp' }, { id: 'presc' }] });
        api.setSample('急性の一見患者(初診)', r.lines, r.ev, 1);
        if (dept.equip.surgery && dept.queue.preop + dept.queue.surgery < P.queueMax && ctx.rand() < P.cataractQueueFromAcute) dept.queue.preop++;
      }
      for (let i = 0; i < glasses; i++) {
        api.countVisit();
        const tmp = { pr: 'glasses', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
        // 屈折×矯正視力の併算定は「眼鏡処方箋の交付」の条件付きで可(rule-0005)。エンジンに条件を渡す
        const r = api.evalVisit(tmp, { type: 'first',
          kbActs: [{ id: 'refraction' }, { id: 'vision' }],
          conditions: { refraction_first_or_glasses: true } });
        api.setSample('眼鏡処方の来院(屈折・矯正視力の条件付き併算定)', r.lines, r.ev, 3);
      }

      // 白内障パイプライン: 術前検査 → 手術(手術日のみ) → 術後3回
      if (dept.equip.surgery) {
        const preopToday = Math.min(dept.queue.preop, api.frac(1.2 * dept.staff.doctors));
        for (let i = 0; i < preopToday; i++) {
          api.countVisit();
          const tmp = { pr: 'cataract', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
          const r = api.evalVisit(tmp, { type: 'revisit', kbActs: [{ id: 'keratometry' }, { id: 'axial' }, { id: 'slitlamp' }] });
          api.setSample('白内障の術前検査(角膜曲率・眼軸)', r.lines, r.ev, 3);
          dept.queue.preop--; dept.queue.surgery++;
        }
        const wd = (ctx.day - 1) % 7;
        if (P.surgDays.includes(wd)) {
          const ops = Math.min(dept.queue.surgery, P.surgPerDay * dept.staff.doctors);
          for (let i = 0; i < ops; i++) {
            api.countVisit();
            const tmp = { pr: 'cataract', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
            const r = api.evalVisit(tmp, { type: 'revisit', kbActs: [{ id: 'cataractOp' }] });
            api.setSample('水晶体再建術(眼内レンズ挿入・日帰り)', r.lines, r.ev, 4);
            agg.cost += P.surgMaterialCost;
            dept.queue.surgery--; dept.queue.postop.push(3);
          }
        }
        // 術後管理(3回で卒業)
        const post = dept.queue.postop;
        for (let i = post.length - 1; i >= 0; i--) {
          if (ctx.rand() < 0.35) {
            api.countVisit();
            const tmp = { pr: 'cataract', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 };
            api.evalVisit(tmp, { type: 'revisit', kbActs: [{ id: 'slitlamp' }] });
            post[i]--;
            if (post[i] <= 0) post.splice(i, 1);
          }
        }
      }

      agg.cost += dept.staff.doctors * C.doctorDay + dept.staff.nurses * C.nurseDay
        + (dept.staff.orts || 0) * C.ortDay + (dept.staff.clerks || 0) * C.clerkDay
        + C.rentDay + C.baseDay + agg.visits * C.perVisit;
      agg.info = { panel: dept.pt.length, panelCap: cap, examCap, preop: dept.queue.preop, surgeryQueue: dept.queue.surgery, postop: dept.queue.postop.length };
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
