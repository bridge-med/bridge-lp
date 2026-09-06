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
    equipment: ['視力表・レフラクトメーター', '眼圧計', '細隙灯', '(投資)精密眼底セット', '(投資)OCT', '(投資)視野計', '(投資)手術設備'],
    staffing: ['医師', '看護師', '視能訓練士(ORT)', '受付・医療事務'],
    reimbursementMappings: {
      first: { itemId: 'r08-A000' },
      revisit: { itemId: 'r08-A001' },
      refraction: { itemId: 'r08-D261-2' },
      vision: { itemId: 'r08-D263-1' },
      tonometry: { itemId: 'r08-D264' },
      slitlamp: { itemId: 'r08-D257' },
      fundus: { itemId: 'r08-D255' },
      oct: { itemId: 'r08-D256-2' },
      fieldStatic: { itemId: 'r08-D260-2' },
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

    /* 本院候補(v73 便AF)。外来(継続管理・一見・眼鏡処方)+検査設備投資。白内障の日帰り手術は v74(便AF-2)で本院にも開いた
     * (術前→手術日→術後の経路は cataractOnVisit/cataractDay を分院の runDay と共用)。
     * 文言は editor(opus)原稿。keywords の hint は内科と同じ数値(名前と説明だけ科別) */
    main: {
      line: '緑内障を長く診る。単価は検査設備', order: 3, fsTitle: '眼科の届出',
      preset: {
        settings: { pInj: 0, pTrig: 0, pPhysio: 0, pReha: 0, pTreat: 0.05, examMean: 7, rehaLevel: 0, machines: 0, physio: 0, pts: 0, rehaAides: 0, dexa: false, echo: false },
        policy: {},
        shopHide: ['pt', 'rehaAide', 'machines', 'physio', 'echo', 'dexa', 'mri'],
        relHide: ['sports'],
        rel: {
          hospital: { effect: '紹介患者 +Lv人/日(術後の経過観察・糖尿病の眼底検査)', desc: '地域連携室との関係。病院で手術した人の経過観察と、糖尿病の定期眼底検査の受け皿になる。' },
          company: { desc: '従業員の定期健診。画面作業で目が疲れる人の相談先になる。' },
          caremane: { effect: '高齢の新患 +Lv×0.7人/日', desc: '担当者会議に出て、点眼が続かない人の相談先になる。' },
          rouken: { effect: '高齢の新患 +Lv×0.7人/日', desc: '退所後も眼圧と点眼を診る先として連携する。' },
          school: { name: '高校(学校健診)', effect: '学校健診の二次検査 +Lv×0.5人/日', desc: '学校健診で視力の再検査になった生徒を引き受ける。' },
          houkatsu: { effect: '高齢の新患 +Lv×0.5人/日', desc: '介護予防教室に出て、見えにくさの相談を受ける。' }
        },
        keywords: [
          { name: '「◯◯町 眼科」', hint: '指名度が高く CV率10%。ただし検索数に上限', reha: false },
          { name: '「目のかすみ・見えにくい」', hint: '検索数は多いが、比較検討層で CV率3.5%', reha: false },
          { name: '「緑内障 検査」', hint: 'CV率6%。駅前広告が要るぶん、拾える数は少ない', reha: false }
        ]
      }
    },
    deptDefaults: {
      staff: { doctors: 1, nurses: 1, orts: 1, clerks: 1 },
      equip: { fundusSet: false, oct: false, field: false, surgery: false },
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
      { id: 'octSet', label: 'OCTを導入', cost: 8000000,
        can: (d) => !d.equip.oct, apply: (d) => { d.equip.oct = true; },
        note: '緑内障・糖尿病網膜症の管理で眼底三次元画像解析ができるようになる(算定は患者1人につき月1回まで=告示D256-2注)。導入費はゲーム上の仮定' },
      { id: 'fieldSet', label: '視野計を導入', cost: 4000000,
        can: (d) => !d.equip.field, apply: (d) => { d.equip.field = true; },
        note: '緑内障の視野管理(静的量的視野検査)が始まる(両眼=片側につき×2で算定)。導入費はゲーム上の仮定' },
      { id: 'surgery', label: '手術設備を導入(白内障日帰り)', cost: 15000000,
        can: (d) => !d.equip.surgery, apply: (d) => { d.equip.surgery = true; },
        note: '術前検査(角膜曲率・眼軸)と水晶体再建術が始まる。眼内レンズの費用は手術の所定点数に含まれる(材料としては請求できない)' },
    ],
    deptBadge(d) {
      if (d.equip.surgery) return '日帰り手術あり';
      const t = [d.equip.fundusSet && '精密眼底', d.equip.oct && 'OCT', d.equip.field && '視野計'].filter(Boolean);
      return t.length ? `${t.join('・')}あり` : '基本検査のみ';
    },
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
      surgDays: [1, 4],           // 手術日(週内の曜日 0=月: 1=火・4=金。v73までは [2,5]=水・土になっていた=注釈と実装のずれを v74 で火・金に揃えた)
      surgMaterialCost: 15000,    // 手術1件の材料費概算(眼内レンズ等の購入原価。IOLは手術点数に包括=請求なしが制度どおり)
      costs: { doctorDay: 90000, nurseDay: 18000, ortDay: 15000, clerkDay: 10000, rentDay: 38000, baseDay: 8000, perVisit: 250 },
      referralSources: ['内科(糖尿病連携)', '学校健診', '高齢者施設'],
    },

    /* 主病の抽選(継続管理の3プロファイル)。本院(v73)と部門で共用 */
    pickProfile(rand) {
      let r = rand(); let pr = 'dry-eye';
      for (const pf of this.patientProfiles) { if (r < pf.weight) { pr = pf.id; break; } r -= pf.weight; }
      return pr;
    },
    /* 1回の来院で何をするかを決める(会計はしない)。部門の runDay と本院の onDischargeDept が同じ経路を通る(v73 便AF)。
     * p.pr: 継続管理(glaucoma/dm-retino/dry-eye)=眼圧+細隙灯(+設備がある場合の精密眼底/OCT/視野)+処方(1/2)
     *       'acute'=一見(初診・細隙灯+処方) / 'glasses'=眼鏡処方(屈折+矯正視力・条件付き併算定 rule-0005)
     * equip: 設備(部門は dept.equip、本院は settings.mainEquip)。乱数の引く順は旧 runDay と同じ(同値をテストで固定) */
    planVisit(p, policy, fs, rand, hasDept, equip) {
      const eq = equip || {};
      if (p.pr === 'acute') {
        return { report: { type: 'first', kbActs: [{ id: 'slitlamp' }, { id: 'presc' }] }, isFirst: true, prLabel: '急性', sample: '急性の一見患者(初診)', slot: 1 };
      }
      if (p.pr === 'glasses') {
        return { report: { type: 'first', kbActs: [{ id: 'refraction' }, { id: 'vision' }], conditions: { refraction_first_or_glasses: true } },
          isFirst: true, prLabel: '眼鏡処方', sample: '眼鏡処方の来院(屈折・矯正視力の条件付き併算定)', slot: 3 };
      }
      const isFirst = !p.fb;
      const report = { type: isFirst ? 'first' : 'revisit', kbActs: [{ id: 'tonometry' }, { id: 'slitlamp' }] };
      if (eq.fundusSet && (p.pr === 'glaucoma' || p.pr === 'dm-retino') && rand() < 0.5) report.kbActs.push({ id: 'fundus' });
      // OCTは月1回(D256-2注)。2回目以降はエンジンがp.mcの月次履歴で却下する
      if (eq.oct && (p.pr === 'glaucoma' || p.pr === 'dm-retino') && rand() < 0.4) report.kbActs.push({ id: 'oct' });
      // 静的量的視野は片側につき290点。両眼実施=×2単位(マスターに両側セルなし)
      if (eq.field && p.pr === 'glaucoma' && rand() < 0.3) report.kbActs.push({ id: 'fieldStatic', units: 2 });
      if (rand() < 0.5) report.kbActs.push({ id: 'presc' });
      const prLabel = (this.patientProfiles.find((x) => x.id === p.pr) || {}).label || '';
      return { report, isFirst, prLabel, sample: `継続管理(${prLabel})の来院`, slot: 2 };
    },

    /* 白内障の候補化(来院1回ごと)。pr が 'acute'(一見)なら cataractQueueFromAcute、'glasses' は候補にしない、それ以外(継続患者)は cataractConvert。
     * queue: { preop, surgery, postop: [] }(部門は dept.queue、本院は G.mainQueue)。手術設備が無い・待ちが上限なら乱数を引かない(旧 runDay と同じ引き順) */
    cataractOnVisit(queue, equip, rand, pr) {
      const P = this.managementParameters;
      if (!equip || !equip.surgery || !queue || pr === 'glasses') return false;
      if (queue.preop + queue.surgery >= P.queueMax) return false;
      if (rand() < (pr === 'acute' ? P.cataractQueueFromAcute : P.cataractConvert)) { queue.preop++; return true; }
      return false;
    },
    /* 白内障パイプラインの1日分: 術前検査 → 手術(手術日のみ) → 術後管理(3回で卒業)。部門の runDay と本院の endDay が同じ経路を通る(v74 便AF-2)。
     * api: { frac(x), rand(), visit(hist, report, label, slot) → r, cost(yen) }。戻り値は当日の件数 { preop, ops, postop } */
    cataractDay(queue, equip, staff, day, api) {
      const P = this.managementParameters;
      const out = { preop: 0, ops: 0, postop: 0 };
      if (!equip || !equip.surgery || !queue) return out;
      const mk = () => ({ pr: 'cataract', mc: {}, wc: {}, lb: {}, fb: true, sv: 0 });
      const preopToday = Math.min(queue.preop, api.frac(1.2 * staff.doctors));
      for (let i = 0; i < preopToday; i++) {
        api.visit(mk(), { type: 'revisit', kbActs: [{ id: 'keratometry' }, { id: 'axial' }, { id: 'slitlamp' }] }, '白内障の術前検査(角膜曲率・眼軸)', 3);
        queue.preop--; queue.surgery++; out.preop++;
      }
      const wd = (day - 1) % 7;
      if (P.surgDays.includes(wd)) {
        const ops = Math.min(queue.surgery, P.surgPerDay * staff.doctors);
        for (let i = 0; i < ops; i++) {
          api.visit(mk(), { type: 'revisit', kbActs: [{ id: 'cataractOp' }] }, '水晶体再建術(眼内レンズ挿入・日帰り)', 4);
          api.cost(P.surgMaterialCost);
          queue.surgery--; queue.postop.push(3); out.ops++;
        }
      }
      const post = queue.postop;
      for (let i = post.length - 1; i >= 0; i--) {
        if (api.rand() < 0.35) {
          api.visit(mk(), { type: 'revisit', kbActs: [{ id: 'slitlamp' }] }, null, 0);
          post[i]--; out.postop++;
          if (post[i] <= 0) post.splice(i, 1);
        }
      }
      return out;
    },
    /* 待ちの1行(部門カード・本院レバー共用) */
    queueLine(q) {
      if (!q) return '';
      return `白内障: 術前待ち${q.preop}人・手術待ち${q.surgery}人・術後${q.postop.length}人`;
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
        const pr = this.pickProfile(ctx.rand);
        api.addPatient(pr, { iv: P.revisitDays[0] + Math.floor(ctx.rand() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }

      // 継続管理の来院: 眼圧+細隙灯(+精密眼底は設備がある場合)
      for (const p of dept.pt) {
        if (p.nv > ctx.day) continue;
        if (examUsed >= examCap) { p.nv = ctx.day + 1; continue; }
        examUsed++; api.countVisit();
        const v = this.planVisit(p, dept.policy, dept.fs, ctx.rand, ctx.hasDept, dept.equip);
        const r = api.evalVisit(p, v.report);
        p.nv = ctx.day + (p.iv || 30);
        api.setSample(v.sample, r.lines, r.ev, v.slot);
        // 高齢層の一部が白内障の手術候補へ(月次換算の確率)
        this.cataractOnVisit(dept.queue, dept.equip, ctx.rand, p.pr);
      }

      // 一見(急性)+眼鏡処方
      let acute = api.frac(P.acuteBase * ramp * pull);
      let glasses = api.frac(P.glassesBase * ramp * pull);
      acute = Math.min(acute, Math.max(0, examCap - examUsed)); examUsed += acute;
      glasses = Math.min(glasses, Math.max(0, examCap - examUsed)); examUsed += glasses;
      for (let i = 0; i < acute; i++) {
        api.countVisit();
        const tmp = { pr: 'acute', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
        const v = this.planVisit(tmp, dept.policy, dept.fs, ctx.rand, ctx.hasDept, dept.equip);
        const r = api.evalVisit(tmp, v.report);
        api.setSample(v.sample, r.lines, r.ev, v.slot);
        this.cataractOnVisit(dept.queue, dept.equip, ctx.rand, 'acute');
      }
      for (let i = 0; i < glasses; i++) {
        api.countVisit();
        const tmp = { pr: 'glasses', mc: {}, wc: {}, lb: {}, fb: false, sv: 0 };
        // 屈折×矯正視力の併算定は「眼鏡処方箋の交付」の条件付きで可(rule-0005)。planVisit がエンジンに条件を渡す
        const v = this.planVisit(tmp, dept.policy, dept.fs, ctx.rand, ctx.hasDept, dept.equip);
        const r = api.evalVisit(tmp, v.report);
        api.setSample(v.sample, r.lines, r.ev, v.slot);
      }

      // 白内障パイプライン: 術前検査 → 手術(手術日のみ) → 術後3回(本院と共用の cataractDay)
      this.cataractDay(dept.queue, dept.equip, dept.staff, ctx.day, {
        frac: api.frac, rand: ctx.rand,
        visit: (tmp, report, label, slot) => { api.countVisit(); const r = api.evalVisit(tmp, report); if (label) api.setSample(label, r.lines, r.ev, slot); return r; },
        cost: (yen) => { agg.cost += yen; },
      });

      agg.cost += dept.staff.doctors * C.doctorDay + dept.staff.nurses * C.nurseDay
        + (dept.staff.orts || 0) * C.ortDay + (dept.staff.clerks || 0) * C.clerkDay
        + C.rentDay + C.baseDay + agg.visits * C.perVisit;
      agg.info = { panel: dept.pt.length, panelCap: cap, examCap, preop: dept.queue.preop, surgeryQueue: dept.queue.surgery, postop: dept.queue.postop.length };
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
