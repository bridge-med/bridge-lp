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
 *    時間をかける診療は患者が治療を続けやすい(中断が減る)という効きもゲーム上の仮定
 *  - 早期診療体制充実加算(I002注11・v54便T): 診療所が届け出られるのは加算1と加算3。ゲームは加算3のみ扱う。
 *    届出(様式44の5の3)で通院精神療法と同日に
 *    「当該保険医療機関の精神科を最初に受診した日から3年以内」=(1)15点 / 以外=(2)10点 を1セル申請する。
 *    最初に受診した日=部門への登録日(p.en)。3年=36月×30日=1080日(ゲーム暦)。加算1・2はKBに写しとして
 *    登録のみ(加算2=病院・加算1=実績5%/60と精神科救急協力はゲーム未判定)。担当医・同意書・掲示は
 *    rule-0029(handled_externally)。本体が却下された受診では加算も却下される(rule-0028=親項目ゲート) */
(function (root) {
  'use strict';
  const M = {
    id: 'psychiatry',
    name: '精神科・心療内科',
    short: '精神科',
    icon: '🌙',
    status: 'full',
    desc: '診察時間の配分が柱。時間区分がそのまま点数になり、1日の使い方が経営を決める',
    // 開始の扉の候補=本院として引き継げる(v82 便AF-3・4枚目)。preset は本院の settings に上書きする整形専用レバーのゼロ化と方針の初期値
    main: {
      line: '気分障害と不安障害。点は時間区分', order: 4, fsTitle: '精神科の届出',
      preset: {
        // examMean は診察時間の方針(timePlan)から導く(mainExamMean)。std の値を初期値に置く
        settings: { pInj: 0, pTrig: 0, pPhysio: 0, pReha: 0, pTreat: 0, examMean: 12, rehaLevel: 0, machines: 0, physio: 0, pts: 0, rehaAides: 0, psws: 0, dexa: false, echo: false },
        policy: { timePlan: 'std', ippanmei: true, renkei: false },
        shopHide: ['pt', 'rehaAide', 'machines', 'physio', 'echo', 'dexa', 'mri'],
        shopShow: ['psw'], // 精神保健福祉士は精神科の本院だけに出す(早期診療体制充実加算3の要件の表し方=下の fsDefs の gameNote)
        jihiHide: ['selfReha', 'prpOn'], // 自費リハ延長・PRP療法は運動器の自費(v82 保留#45 のPRP側を閉じる)
        // キホン集(TEXTBOOK)の科別差し替え。整形前提の③⑥⑨⑩⑫だけ。制度上の数値は書かない
        textbook: {
          2: { t: '③ 単価は複合で作る', b: '精神科の単価は初再診料+通院精神療法+処方の組み合わせ。点数は診察にかけた時間の区分で変わる。' },
          5: { t: '⑥ 継続管理はLTVで考える', b: '精神科の通院は年単位で続く。単価を上げるより、通院が途切れないことのほうが生涯価値を動かす。' },
          9: { t: '⑨ 施設基準は経営の土台', b: '精神保健指定医が行う通院精神療法に、届出が必要な施設基準はない。届出で増えるのは加算のほうで、体制と記録を続けることがその土台になる。' },
          10: { t: '⑩ 分院は専従の壁', b: '分院の体制要件は施設ごとに満たす必要がある。本院の精神保健福祉士は分院の要件には数えられない。分院展開のボトルネックは資金より採用になる。' },
          12: { t: '⑫ 設備投資は回収期間で決める', b: '精神科の投資先は、診察の時間と人の採用に集まる。判断基準は「欲しい」ではなく、投資が何日の診療で回収できるかという期間になる。' },
        },
        relHide: ['sports'],
        // 営業先の文言(整形はリハ紹介前提)。効果の数値は同じ=文言だけ
        rel: {
          hospital: { effect: '紹介患者 +Lv人/日(退院後の治療の継続)', desc: '地域連携室との関係。精神科に入院した人の退院後の通院先になる。' },
          company: { desc: '従業員の定期健診。休職からの職場復帰の相談先になる。' },
          caremane: { effect: '高齢の新患 +Lv×0.7人/日', desc: '担当者会議に出て、不眠や気分の落ち込みの相談を受ける。' },
          rouken: { effect: '高齢の新患 +Lv×0.7人/日', desc: '退所後も通院を続ける先として連携する。' },
          school: { name: '高校(スクールカウンセラー)', effect: '高校生の新患 +Lv×0.5人/日', desc: '校内の相談で受診が必要になった生徒を引き受ける。' },
          houkatsu: { effect: '高齢の新患 +Lv×0.5人/日', desc: '介護予防教室に出て、閉じこもりや不眠の相談を受ける。' },
        },
        keywords: [
          { name: '「◯◯町 心療内科」', hint: '指名度が高く CV率10%。ただし検索数に上限', reha: false },
          { name: '「眠れない・気分が落ち込む」', hint: '検索数は多いが、比較検討層で CV率3.5%', reha: false },
          { name: '「職場復帰 精神科」', hint: 'CV率6%。駅前広告が要るぶん、拾える数は少ない', reha: false },
        ],
      },
    },
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
      n11ha1: { itemId: 'r08-I002-n11-ha-1' },        // 早期診療体制充実加算3(3年以内)
      n11ha2: { itemId: 'r08-I002-n11-ha-2' },        // 同(3年超)
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
      policy: { timePlan: 'std', ippanmei: true, renkei: false },
    },
    /* 体制アクション(ゲーム上の仮定。費用は在宅の24時間体制と同格) */
    actions: [
      { id: 'renkei', label: '連携病院と協定を結ぶ(時間外・緊急入院の受け皿)', cost: 300000,
        can: (d) => !d.policy.renkei, apply: (d) => { d.policy.renkei = true; },
        note: '精神科救急の指定病院と、時間外対応・緊急時の入院・退院患者の受け入れを文書で取り交わし、病院名と連絡先を院内に掲示する。届出は下の施設基準の行から' },
    ],
    open: { cost: 6000000, repMin: 65, needPlan: true,
      condDesc: '事業計画の策定・本院評判65以上・開設資金' },
    staffDef: [
      ['doctors', '医師(指定医)', 1, 2, 2000000],
      ['nurses', '看護師', 0, 2, 120000],
      ['psws', '精神保健福祉士', 0, 2, 120000],
    ],
    deptBadge(d) { return d.policy.timePlan === 'long' ? '全員30分以上' : d.policy.timePlan === 'mix' ? '必要に応じて30分以上' : '30分未満が基本'; },
    infoLine(i) { return `継続 ${i.panel}人・昨日 ${i.visits}件(診察${i.usedMin}分)` + (i.deferred ? `・翌日へ${i.deferred}件` : ''); },
    fsDefs: [
      // 早期診療体制充実加算3(v54便T・診療所)。要件の当てはめは note/gameNote に(第47の7の4の(3))
      { fsId: 'r08-fs-i002-n11-3',
        check(dept) {
          const missing = [];
          if ((dept.staff.doctors || 0) < 1) missing.push('精神保健指定医1名');
          if ((dept.staff.psws || 0) < 1) missing.push('精神保健福祉士1名');
          if (!dept.policy.renkei) missing.push('連携病院との協定');
          return missing.length ? { ok: false, missing } : { ok: true };
        },
        note: '診療所の加算3(様式44の5の3)。常勤指定医1名((1)のア)+他加算等の届出((1)のカ)+連携病院との協定又は精神科救急協力((3)のオ。留意(28)エの時間外電話対応体制も協定で表す)。実績((3)のウ・エ)は判定しない',
        gameNote: '要件カ(他加算の届出)は専任の精神保健福祉士1名で表す。その加算(療養生活継続支援加算・I002注8)はKB未登録のため算定しない。実績(割合2%・24件/医師)と共同指導年1回はゲームでは判定しない(簡略化)' },
    ],
    fsNote: '通院精神療法本体(精神保健指定医のセル)に届出必須の基準はない。非指定医のセルには注13の施設基準がある(KB未登録)',

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

    /* 主病の抽選(patientProfiles の weight)。部門の新規登録と本院の常連で共用(v82 便AF-3で runDay から抽出) */
    pickProfile(rand) {
      let r = rand(); let pr = 'mood';
      for (const pf of this.patientProfiles) { if (r < pf.weight) { pr = pf.id; break; } r -= pf.weight; }
      return pr;
    },
    /* 主病から算定の系統(通院精神療法 i002 / 心身医学療法 i004)を引く。名簿の上で混ざらない(rule-0010の運用) */
    profileKind(pr) { return (this.patientProfiles.find((x) => x.id === pr) || {}).kind || 'i002'; },

    /* 1日に使える診察分数(ゲーム上の仮定)。部門は runDay がこの予算で回す。
       診察時間の方針(policy.timePlan)は1回の来院の needMin 側に出るので、ここでは人数だけで決まる */
    dayBudget(policy, staff) { return this.managementParameters.dayMinutes * ((staff && staff.doctors) || 1); },
    /* 治療中断率(月あたり・ゲーム上の仮定)。時間をかける方針ほど下がり、精神保健福祉士の支援でさらに下がる */
    churnRate(policy, staff) {
      const P = this.managementParameters;
      const plan = (policy && policy.timePlan) || 'std';
      return Math.max(0.005, (P.churnMonthly[plan] !== undefined ? P.churnMonthly[plan] : P.churnMonthly.std)
        - ((staff && staff.psws) || 0) * P.pswChurnRelief);
    },

    /* ---- 本院(main)だけが使う導出。値の置き場所はここ1箇所(v82 便AF-3) ---- */
    /* 本院の1回あたりの平均診察分(settings.examMean)を診察時間の方針から導く。
       本院の診察キャパ doctors×480/(examMean+1.5)×0.72 は分院の1日の分数予算と同じ量なので、
       スライダーは出さず3択から導く(同じ量を二度置かない)。値は分院の来院比(std 1.00/mix 0.77/long 0.47)に
       キャパ比が一致するように置いた=ゲーム上の仮定 */
    mainExamMean(policy) {
      const plan = (policy && policy.timePlan) || 'std';
      return { std: 12, mix: 16, long: 27 }[plan] || 12;
    },
    /* 本院の定着(再来の起きやすさ)にかかる倍率。ゲーム上の仮定。
       分院は「時間をかけるほど治療の中断が減る」(churnMonthly)。本院は中断率を持たず待ち時間由来の
       満足度だけで再来が決まるため、同じ方針が逆向きに働いてしまう。そこで分院の中断率の比を
       そのまま定着の倍率にする: std を 1.0 として std/plan(= mix 約1.43・long 2.5)。
       新しい変数は増やさない(値は churnMonthly から導出) */
    mainLoyalty(policy) {
      const C = this.managementParameters.churnMonthly;
      const plan = (policy && policy.timePlan) || 'std';
      return C.std / (C[plan] !== undefined ? C[plan] : C.std);
    },

    /* 1回の来院で何をするかを決める(会計はしない)。部門の runDay と本院が同じ経路を通る(v82 便AF-3)。
     * 戻り値に needMin(この来院に使う診察分数)を足す — 時間区分がそのまま点数になるため、時間の決定と算定セルの決定は同じ1回の判断
     * env: { day(加算3の3年窓の判定に使う現在日。省略時は3年以内の扱い), fits(needMin)→bool(1日の分数予算に収まるか。
     *        省略時は常に収まる。部門の runDay だけが渡す — 予算そのものは呼び出し側が持つ) }
     * 乱数の引く順は旧 runDay と同じ: ①30分以上にするかの判定(policy.timePlan==='mix' のときだけ引く)→ ②処方の有無。
     *   予算に収まらない来院は②を引かずに { deferred:true } を返す(繰越)
     * hasDept・equip は他科と署名を揃えるために受けるだけで、精神科では使わない */
    planVisit(p, policy, fs, rand, hasDept, equip, env) {
      const P = this.managementParameters;
      const e = env || {};
      const plan = (policy && policy.timePlan) || 'std';
      const kind = this.profileKind(p.pr);
      const isFirst = !p.fb;
      // この患者の今日の診察を30分以上にするか(方針に従う。mixは一部の患者に時間をかける)
      const long = plan === 'long' || (plan === 'mix' && rand() < P.mixLongShare);
      const needMin = kind === 'i004'
        ? (isFirst ? P.visitMin.i004First : P.visitMin.i004Revisit)
        : (isFirst ? (long ? P.visitMin.longFirst : P.visitMin.stdFirst)
                   : (long ? P.visitMin.longRevisit : P.visitMin.stdRevisit));
      if (e.fits && !e.fits(needMin)) return { deferred: true, needMin, isFirst, kind, long, report: null };
      const report = { type: isFirst ? 'first' : 'revisit', kbActs: [] };
      if (kind === 'i004') {
        report.kbActs.push({ id: isFirst ? 'i004First' : 'i004Revisit' });
      } else {
        report.kbActs.push({ id: isFirst ? (long ? 'i002FirstLong' : 'i002FirstStd')
                                         : (long ? 'i002Long' : 'i002Std') });
        // 早期診療体制充実加算3: 届出済みなら通院精神療法と同日に1セル。最初に受診した日(p.en)から
        // 3年以内=(1)、以外=(2)。届出前は申請しない(内科の充実管理加算3と同じ安全側・決裁溜め(m))
        if ((fs || []).includes('r08-fs-i002-n11-3')) {
          const since = e.day === undefined ? 0 : e.day - (p.en || 0);
          report.kbActs.push({ id: since < 1080 ? 'n11ha1' : 'n11ha2' });
        }
      }
      // 外来管理加算は精神科専門療法の算定日には算定できない(A001注8)— エンジンの却下を代表レセプトで見せる
      if (!isFirst) report.kbActs.push({ id: 'kanri' });
      if (rand() < P.prescProb) {
        report.kbActs.push({ id: 'presc' });
        if (policy && policy.ippanmei) report.kbActs.push({ id: 'ippanmei' });
      }
      const prLabel = (this.patientProfiles.find((x) => x.id === p.pr) || {}).label || '';
      // 再診を最優先で見せる: 外来管理加算の却下(A001注8)が載るのは再診のレセプトだけ
      const sample = kind === 'i004' ? `心身医学療法の${isFirst ? '初診' : '再診'}(${prLabel})`
        : isFirst ? `通院精神療法の初診(${prLabel}・${long ? '60分以上' : '30分以上60分未満'})`
        : `通院精神療法(${prLabel}・${long ? '30分以上' : '30分未満'})`;
      return { report, isFirst, kind, long, needMin, prLabel, sample, slot: isFirst || kind === 'i004' ? 2 : 3, deferred: false };
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
      const ramp = Math.min(1, 0.25 + (ctx.day - dept.openedDay) / 90);
      const pull = 0.6 + 0.4 * (ctx.rep / 100);
      const plan = dept.policy.timePlan;

      // 新規(紹介・直接)。時間をかける方針は口コミでわずかに増える(ゲーム上の仮定)
      const cap = P.panelPerDoctor * dept.staff.doctors;
      let enroll = api.frac(P.enrollBase * dept.staff.doctors * ramp * pull * (plan === 'long' ? 1.15 : 1));
      while (enroll-- > 0 && dept.pt.length < cap) {
        const pr = this.pickProfile(ctx.rand);
        api.addPatient(pr, { iv: P.revisitDays[0] + Math.floor(ctx.rand() * (P.revisitDays[1] - P.revisitDays[0] + 1)) });
      }
      // 治療中断(時間の方針と精神保健福祉士の支援で変わる=ゲーム上の仮定)。来院とは独立に名簿から抜ける
      const churn = this.churnRate(dept.policy, dept.staff);
      for (let i = dept.pt.length - 1; i >= 0; i--) {
        if (ctx.rand() < churn / 26) dept.pt.splice(i, 1);
      }

      // 診察: 期日の来た患者を、1日の診察時間の枠内で診る。超えた分は翌日へ
      const budget = this.dayBudget(dept.policy, dept.staff);
      let used = 0, deferred = 0, seen = 0;
      for (const p of dept.pt) {
        if (p.nv > ctx.day) continue;
        const v = this.planVisit(p, dept.policy, dept.fs, ctx.rand, ctx.hasDept, dept.equip,
          { day: ctx.day, fits: (min) => used + min <= budget });
        if (v.deferred) { p.nv = ctx.day + 1; deferred++; continue; }
        used += v.needMin;
        api.countVisit();
        seen++;
        const r = api.evalVisit(p, v.report);
        p.nv = ctx.day + (p.iv || 14);
        api.setSample(v.sample, r.lines, r.ev, v.slot);
      }

      agg.cost += dept.staff.doctors * C.doctorDay + (dept.staff.nurses || 0) * C.nurseDay + (dept.staff.psws || 0) * C.pswDay
        + C.rentDay + C.baseDay + agg.visits * C.perVisit;
      agg.info = { panel: dept.pt.length, panelCap: cap, usedMin: used, budgetMin: budget, deferred, plan, visits: seen };
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
