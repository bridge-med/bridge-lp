/* 診療科モジュール: 人工透析(full)
 * ベッド(装置)×クール×稼働率のストック型経営。施設区分(区分1)の維持が最重要。
 *
 * 制度とゲームの分離:
 *  - 人工腎臓の点数・月14回制限・薬剤包括(rule-0006)・外来医学管理料の検査包括(rule-0007)・
 *    施設基準(区分1: 装置26台未満又は患者/装置比3.5未満+安全管理体制)はKB+エンジンが判定
 *  - ダイアライザー(Ia型・回路含む161点=材料価格1,610円)はKB登録済みでセッションごとに請求(v45)。
 *    型をIa型に固定するのはゲーム上の仮定
 *  - 区分(v55便U): 区分1の施設基準は「装置26台未満 又は 患者/装置比3.5未満」(第57の2の1の(1)ア=いずれか)。
 *    比はゲームでは名簿人数/装置台数で代表(制度は直近12か月平均・月5回以下の患者を除外)。区分1を外れた部門は
 *    届出不要の区分3(4-5hのセルは区分1より低い点数。点数はKB)で算定する。区分2(26台以上かつ比3.5〜4.0・届出)は
 *    KBに写しのみ=ゲームは届け出ない(過小側の簡略化)。以下、接続詞は「又は」に統一
 *  - 加算(v55便U): 3クール目のセッションは午後5時以降の開始とみなし時間外・休日加算(注1)を申請(ゲーム上の仮定。
 *    クールの割付は添字/装置台数で、同時床数が看護師で絞られるときは3クール目を過小に数える=取りこぼし側。次のエンジン便で修正。
 *    ゲームに祝日が無く、日曜は休日加算の対象外(留意(14))のため休日分は生じない)。慢性維持透析濾過加算(注13=オンラインHDF)は水処理設備を持つ部門の
 *    届出(様式49の3)で全セッションに乗る。加算は本体が却下された受診では通らない(rule-0030=親項目ゲート)。
 *    注3障害者等・注11長時間は患者状態を持たないため申請しない。
 *  - 注10・注14(v56便V): 下肢末梢動脈疾患指導管理加算(月1回・届出)は「下肢の血流評価と連携先病院の体制」アクション+届出で
 *    維持透析患者(導入期を除く=過小側)に月1回申請。透析時運動指導等加算(届出不要・開始日から90日)は「透析中の運動指導の体制」アクションで
 *    ON、患者フィールド ex(指導開始日)を付けて (day−ex)<90 のセッションに申請。担当者=研修受講の看護師とみなし(ゲーム上の仮定)、
 *    1日の申請は看護師×8人まで(留意(25)は1回8人程度=ゲームは1日で数える簡略化)。上限に達した日は新しい患者の指導を始めない(90日窓を無駄にしない)
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
      hd: { itemId: 'r08-J038-1-ro' },                 // 区分1(届出)
      hd3: { itemId: 'r08-J038-3-ro' },                // 区分3(届出なし。区分1の要件を外れた部門)
      overtime: { itemId: 'r08-J038-n1' },             // 時間外・休日加算(3クール目)
      hdf: { itemId: 'r08-J038-n13' },                 // 慢性維持透析濾過加算(オンラインHDF・届出)
      pad: { itemId: 'r08-J038-n10' },                 // 下肢末梢動脈疾患指導管理加算(月1回・届出)
      exercise: { itemId: 'r08-J038-n14' },            // 透析時運動指導等加算(開始日から90日・届出不要)
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
      policy: { cools: 2, explain: false, pad: false, exercise: false },
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
        can: () => true, apply: (d) => { d.equip.beds++; },
        note: '装置26台以上でも、患者/装置比が3.5未満なら区分1のまま。台数・比のどちらの要件も外れると、届出不要の「慢性維持透析を行った場合3」(区分3。1回あたりの点数が下がる)で算定する' },
      { id: 'water', label: '水処理設備を導入(水質確保の体制)', cost: 3000000,
        can: (d) => !d.equip.water, apply: (d) => { d.equip.water = true; },
        note: '届け出ると、透析を行った日ごとに透析液水質確保加算が付く。同じ設備で慢性維持透析濾過加算(オンラインHDF)も届け出られる。届出は下の施設基準の行から(様式49の3)' },
      { id: 'explain', label: '腎代替療法の説明体制を整える', cost: 100000,
        can: (d) => !d.policy.explain, apply: (d) => { d.policy.explain = true; },
        note: '届け出ると、導入期の患者に最初の1月のあいだ1日ごとに導入期加算1が付く。届出は下の施設基準の行から(様式2の2)' },
      // v56便V: 注10・注14の体制(費用はゲーム上の仮定)
      { id: 'pad', label: '下肢の血流評価と連携先病院の体制を整える', cost: 200000,
        can: (d) => !d.policy.pad, apply: (d) => { d.policy.pad = true; },
        note: '維持透析の全患者に下肢の血流のリスク評価を行い、重い患者を紹介する専門の病院(循環器内科と、胸部外科又は血管外科と、整形外科・皮膚科又は形成外科を標榜する病院)をあらかじめ決めて掲示する。届け出ると患者ごと月1回の加算が付く。届出は下の施設基準の行から(様式49の3の2)' },
      { id: 'exercise', label: '透析中の運動指導の体制を整える(研修+モニター)', cost: 400000,
        can: (d) => !d.policy.exercise, apply: (d) => { d.policy.exercise = true; },
        note: '看護師が研修を受け、心電図・SpO2・血圧計を備えて透析中に20分以上の運動指導を行う。届出は不要。患者ごとに開始から90日まで1回ごとの加算が付く(制度の上限は担当者1人あたり1回8人程度。ゲームは看護師1人あたり1日8人で数える)' },
    ],
    deptBadge(d) { return `${d.equip.beds}床×${d.policy.cools}クール`; },
    infoLine(i) { return `患者 ${i.census}人・昨日 ${i.seen}/${i.capacity}枠` + (i.waitlist ? `・待機${i.waitlist}` : ''); },

    fsDefs: [
      { fsId: 'r08-fs-j038-1',
        check(dept) {
          const missing = [];
          const ratio = dept.equip.beds > 0 ? dept.pt.length / dept.equip.beds : 0;
          if (dept.equip.beds >= 26 && ratio >= 3.5) missing.push(`装置26台未満 又は 比3.5未満(${dept.equip.beds}台・比${ratio.toFixed(1)})`);
          if ((dept.staff.ces || 0) < 1) missing.push('安全管理責任者(専任CE1名以上)');
          return { ok: missing.length === 0, missing };
        },
        note: '装置26台未満 又は 患者/装置比3.5未満のいずれか(第57の2の1の(1)ア)+水質管理+安全管理委員会。外れた部門は届出不要の区分3で算定',
        gameNote: '患者/装置比は名簿人数/装置台数で表す(制度は直近12か月平均・月5回以下の患者を除外)' },
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
      // 慢性維持透析濾過加算(v55便U): 施設基準・届出は水質確保加算の例による(様式49の3)=同じ水処理設備に乗る
      { fsId: 'r08-fs-j038-n13',
        check(dept) {
          return dept.equip.water ? { ok: true } : { ok: false, missing: ['水処理設備(水質確保加算と同じ設備)'] };
        },
        note: '透析液水質確保加算と同じ体制で届け出る(様式49の3)。加算の対象は複雑な血液透析濾過=透析液から分離作製した置換液を用いるもの',
        gameNote: '届け出た部門は全セッションをこの方法で行う扱い(実施率100%はゲーム上の仮定)' },
      // 下肢末梢動脈疾患指導管理加算(v56便V): 全患者のリスク評価・紹介・連携先の事前届出と院内掲示(第57の2の2)
      { fsId: 'r08-fs-j038-n10',
        check(dept) {
          return dept.policy.pad ? { ok: true } : { ok: false, missing: ['下肢の血流評価と連携先病院の体制'] };
        },
        note: '全患者へのリスク評価と指導管理の記録・重い患者の専門病院への紹介・連携先の事前届出と院内掲示(様式49の3の2)',
        gameNote: '評価・紹介・連携先はひとつのアクションで整えた扱い(ゲーム上の仮定)' },
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
      const hdKey = dept.fs.includes('r08-fs-j038-1') ? 'hd' : 'hd3';   // 区分1の届出が無い(外れた)部門は区分3で算定
      let overtime = 0;
      // 透析時運動指導等加算: 1日の担当上限=研修受講の看護師×8人(留意(25))。上限に達した日は新しい患者の指導を始めない
      const exCap = dept.policy.exercise ? (dept.staff.nurses || 0) * 8 : 0;
      let exCount = 0;
      seen.forEach((p, i) => {
        api.countVisit();
        // クールは枠の順に埋める(1クール目→2→3)。3クール目=午後5時以降の開始とみなし時間外・休日加算(ゲーム上の仮定)
        const evening = dept.policy.cools >= 3 && Math.floor(i / Math.max(1, dept.equip.beds)) >= 2;
        // ダイアライザー(Ia型・回路含む)を1セッション1本で請求。材料と価格は材料価格基準040、
        // 回路を含むのは材料留意II-040。「1回1本」という数量は制度側に定めがない
        // (042のような本数制限も040には無い=否定的確認)ため、ゲーム上の仮定
        const report = { type: 'hd', kbActs: [{ id: hdKey }, { id: 'dialyzer' }] };
        if (evening) { report.kbActs.push({ id: 'overtime' }); overtime++; }
        if (p.du > ctx.day) report.kbActs.push({ id: 'induction' });
        if (dept.fs.includes('r08-fs-j038-suishitsu')) report.kbActs.push({ id: 'waterQuality' });
        if (dept.fs.includes('r08-fs-j038-n13')) report.kbActs.push({ id: 'hdf' });
        // 下肢末梢動脈疾患指導管理加算: 届出済みなら維持透析患者(導入期を除く)に月1回(mcはエンジンのLIMITS経由で積まれる)
        if (dept.fs.includes('r08-fs-j038-n10') && !p.mc['r08-J038-n10'] && p.du <= ctx.day) report.kbActs.push({ id: 'pad' });
        // 透析時運動指導等加算: 開始日(p.ex)から90日(開始日を含む)。未開始の患者は上限に余裕がある日に始める
        if (exCap > exCount && (p.ex === undefined ? true : ctx.day - p.ex < 90)) {
          if (p.ex === undefined) p.ex = ctx.day;
          if (ctx.day - p.ex < 90) { report.kbActs.push({ id: 'exercise' }); exCount++; }
        }
        // 月1回: 慢性維持透析患者外来医学管理料(検査の包括はrule-0007)
        if (!p.mc['r08-B001-15'] && p.du <= ctx.day) report.kbActs.push({ id: 'monthlyMgmt' });
        const r = api.evalVisit(p, report);
        agg.cost += P.materialPerSession;
        const hasMgmt = r.ev.billableItems.some((b) => b.itemId === 'r08-B001-15');
        const kubun = hdKey === 'hd' ? '' : '区分3の';
        const label = p.du > ctx.day ? `${kubun}導入期の透析(導入期加算1)`
          : hasMgmt ? `${kubun}維持透析+月1回の外来医学管理料`
          : evening ? `${kubun}維持透析(3クール目)`
          : `${kubun}維持透析(4時間以上5時間未満)`;
        api.setSample(label, r.lines, r.ev, hasMgmt ? 3 : evening ? 2.5 : 2);
      });

      agg.cost += (dept.staff.doctors || 0) * C.doctorDay + (dept.staff.nurses || 0) * C.nurseDay + (dept.staff.ces || 0) * C.ceDay;
      agg.info = {
        census: dept.pt.length, beds: dept.equip.beds, cools: dept.policy.cools,
        capacity, seen: seen.length, waitlist: Math.max(0, due.length - seen.length), overtime, kubun: hdKey === 'hd' ? 1 : 3, exercise: exCount,
      };
      // 区分1の維持が危うい時の予告(降格の前に知らせる)
      if (dept.equip.beds >= 24 && dept.fs.includes('r08-fs-j038-1') && dept.pt.length / dept.equip.beds >= 3.0) {
        agg.events.push({ kind: 'fs_warn', message: `装置${dept.equip.beds}台・患者/装置比${(dept.pt.length / dept.equip.beds).toFixed(1)} — 26台以上かつ比3.5以上になると区分1を外れ、区分3(1回あたりの点数が下がる)で算定します` });
      }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else if (root.SPECIALTIES) root.SPECIALTIES.register(M);
})(typeof self !== 'undefined' ? self : this);
