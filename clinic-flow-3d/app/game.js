/* クリニックタウン3D — 経済モデル・法人経営・ミッション・チュートリアル・UI統合
 * 教育の核:
 *   売上 = 患者数 × 診療単価
 *   患者数 = 新患(認知 × 評判 × 競合) + 再診(治療計画 × 患者体験)
 *   単価 = 診療の中身(初再診・処置・リハ単位・自費・施設基準)
 *   利益 = 売上 − 固定費 − 変動費 − 広告費 − 金利
 */

'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const yen = (n) => `¥${Math.round(n).toLocaleString()}`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ================= 定数 ================= */

  const DAY_MIN = 480;
  const INTAKE_END = 420;
  const RIVAL_REP = 65;

  const FEES = { first: 2900, revisit: 1300, rehab: 1300, checkup: 8000, treat: 1200, goods: 3500, goodsCogs: 2100 };
  // 運動器リハ: 1回=2単位で計算。(III)85点/(II)170点/(I)185点 ×2単位×10円
  const REHA_FEE = [0, 1700, 3400, 3700];
  const REHA_NAMES = ['未届出', '運動器リハ(III)', '運動器リハ(II)', '運動器リハ(I)'];

  const KIJUN = [
    { lv: 1, name: '運動器リハ(III)', fee: REHA_FEE[1], reqText: '専従の理学療法士等 1名以上', ok: (pts, fl) => pts >= 1 },
    { lv: 2, name: '運動器リハ(II)', fee: REHA_FEE[2], reqText: '専従の常勤PT 2名以上・45㎡以上', ok: (pts, fl) => pts >= 2 },
    { lv: 3, name: '運動器リハ(I)', fee: REHA_FEE[3], reqText: '専従の常勤PT 4名以上・100㎡以上(要増築)', ok: (pts, fl) => pts >= 4 && fl >= 2 }
  ];

  const COSTS = {
    doctorDay: 80000, nurseDay: 18000, ptDay: 16000, recepDay: 10000,
    rent: [0, 25000, 55000], base: [0, 8000, 14000],
    perPatient: 300, billboardDay: 3000,
    branchRent: 35000, branchBase: 6000
  };

  const SHOP = {
    doctor:  { label: '医師を採用', costs: [0, 500000, 800000, 1200000], day: COSTS.doctorDay, hint: '診察室が1室増える(日給¥80,000)。採用費は人数とともに高騰' },
    nurse:   { label: '看護師を採用', costs: [120000, 120000, 150000, 180000], day: COSTS.nurseDay, hint: '処置ベッドの稼働数=看護師数(日給¥18,000)' },
    pt:      { label: 'PTを採用', costs: [150000, 150000, 180000, 180000, 220000, 220000, 250000, 250000, 300000, 300000, 350000, 350000], day: COSTS.ptDay, hint: '施設基準の要件・リハ稼働の源泉(日給¥16,000)。市場は売り手優位' },
    recep:   { label: '受付を増員', costs: [60000, 60000, 80000], day: COSTS.recepDay, hint: '受付窓口が増える(日給¥10,000)' },
    chairs:  { label: '待合椅子を+2脚', costs: null, flat: 40000, step: 2, hint: '立ち待ちはクレームと離反のもと' },
    beds:    { label: '処置ベッドを増設', costs: null, flat: 150000, hint: '処置1件+¥1,200。看護師とセットで機能' },
    machines:{ label: 'リハ機器を増設', costs: null, flat: 300000, hint: 'リハ稼働=min(機器, PT×2)。施設基準の面積要件は増築で' }
  };

  const EXPAND_COST = 5000000;

  const KEYWORDS = [
    { id: 'area', name: '「◯◯町 整形外科」', cpc: 400, cvr: 0.10, vol: 40, source: 'house', hint: '指名度が高く CV率10%。ただし検索数に上限' },
    { id: 'pain', name: '「腰痛・膝の痛み」', cpc: 150, cvr: 0.035, vol: 120, source: 'house', hint: '検索数は多いが、比較検討層で CV率3.5%' },
    { id: 'sports', name: '「スポーツ整形」', cpc: 250, cvr: 0.06, vol: 30, source: 'station', reha: true, hint: 'リハ需要の高い患者層。単価・LTVが高い' }
  ];

  const SITES = [
    { id: 'kita', name: '北口クリニック', cost: 8000000, rivalRep: 62, bigger: 1.0, rehaBias: 1.0, desc: '駅の北側の住宅エリア。手堅い商圏。' },
    { id: 'minami', name: '南町クリニック', cost: 9000000, rivalRep: 60, bigger: 0.95, rehaBias: 1.35, desc: '高齢者が多くリハ需要が高い。PTを厚く。' },
    { id: 'tonari', name: '隣駅クリニック', cost: 12000000, rivalRep: 70, bigger: 1.4, rehaBias: 1.0, desc: '商圏は大きいが競合も強い。評判勝負。' }
  ];

  const MISSIONS = [
    { id: 'profit', title: '1日を黒字で終える(本院)', reward: 100000,
      lesson: '損益分岐点 = 固定費 ÷ 1人あたり粗利。外来は固定費型ビジネス。まず「1日何人で黒字か」を頭に入れる。' },
    { id: 'wait', title: '平均待ち時間15分以下の日をつくる(来院15人以上)', reward: 100000,
      lesson: '待ち時間は最大の離反要因。受付・会計の詰まりでも回転は決まる。ボトルネックは1か所ずつ潰す。' },
    { id: 'aware', title: '商圏の認知率を50%にする', reward: 150000,
      lesson: '広告は「知られていない」を解く道具。認知×評判×アクセスの掛け算で新患は決まる。' },
    { id: 'reha', title: '運動器リハを届け出て、リハ実施10件/日', reward: 200000,
      lesson: '単価は「診療の中身」で決まる。リハは施設基準で単価が変わる: (III)¥1,700 →(II)¥3,400 →(I)¥3,700(2単位換算)。専従PTの人数が壁。' },
    { id: 'tie', title: '病院・ケアマネの両方と連携する', reward: 200000,
      lesson: '紹介は最強の新患チャネル。作るのに時間がかかるが、継続的に流れる資産になる。' },
    { id: 'rep', title: '評判を75にする', reward: 200000,
      lesson: '評判は患者体験の積分。評判70を超えると広告なしで認知が広がり始める=最も安い集患。' },
    { id: 'revenue', title: '本院の月商(直近30日)¥8,000,000', reward: 500000,
      lesson: 'バリューアップの順番: ①守り→②回転→③単価→④新患。患者数×単価、どちらを動かす打ち手かを常に意識。' },
    { id: 'expand', title: '院を増築する(リハ室100㎡・診察室4)', reward: 300000,
      lesson: '設備投資は「回収期間」で考える。増築¥500万は、リハ(I)への格上げ(+¥300/回)と機器増設の稼働でいつ回収できるか。投資の意思決定は必ず逆算から。' },
    { id: 'jihi', title: '自費・物販の月間売上 ¥100,000', reward: 300000,
      lesson: '保険診療は公定価格 — 価格決定権がない。自費は唯一「価格」を打ち手にできる領域。ただし価格を上げれば利用率は下がる(価格弾力性)。価値とセットで設計する。' },
    { id: 'branch', title: '分院1号店を開設する', reward: 500000,
      lesson: '分院は「成功した仕組みのコピー」でしか成功しない。施設基準の専従要件は分院ごとに必要 — 本院のPTは分院の要件に数えられない。採用が分院展開の本当の壁。' },
    { id: 'branchProfit', title: '分院の直近7日を黒字にする', reward: 500000,
      lesson: '分院経営は「見えない現場」のマネジメント。数字(稼働・評判・人件費率)で異変に気づく仕組みがないと、分院は静かに沈む。' },
    { id: 'corp', title: '法人月商(全拠点・直近30日)¥25,000,000', reward: 1000000,
      lesson: '経営者の仕事は「自分がいなくても回る仕組み」を作ること。ここまで来たら、次は現実のクリニックで。' }
  ];

  const TEXTBOOK = [
    { t: '① 売上 = 患者数 × 単価', b: 'すべての打ち手はこのどちらか(または両方)を動かす。「今日やったことはどちらを動かしたか?」を毎日問う。' },
    { t: '② 患者数 = 新患 + 再診', b: '新患は「認知×評判×アクセス」。再診は「治療計画×患者体験」。新患獲得コストは再診維持の5倍以上。' },
    { t: '③ 単価 = 診療の中身', b: '初再診料に処置・リハ・検査が積み上がる。リハは施設基準(専従PT数・面積)で単価そのものが変わる。医学的必要性が大前提。' },
    { t: '④ 外来は固定費型ビジネス', b: '人件費・家賃は患者0人でも出ていく。損益分岐点(何人で黒字か)を必ず把握する。' },
    { t: '⑤ 待ち時間は最大の離反要因', b: '医療の質は見えにくいが、待ち時間は誰にでも見える。予約制・動線・会計自動化で「体感」を削る。' },
    { t: '⑥ リハはLTVで考える', b: 'リハ1回の単価より「完遂までに何回通うか」。中断率を下げることが最大のリハ収益改善。' },
    { t: '⑦ 紹介は資産、広告は費用', b: '病院・ケアマネ・患者本人からの紹介は継続的に流れる。広告は止めた瞬間に止まる。徐々に紹介比率を上げる。' },
    { t: '⑧ CPAはLTVと比べる', b: '広告の良し悪しは「1人獲得にいくらかかったか(CPA)」を「1人が生涯いくら使うか(LTV)」と比べて判断する。CPA¥8,000でもLTV¥25,000なら勝ち。CPCが高騰したら撤退ラインを決める。' },
    { t: '⑨ 施設基準は経営の土台', b: '運動器リハ(III)=専従1名/(II)=専従常勤PT2名/(I)=4名+100㎡。要件割れは自主返還・指導のリスク。人が辞めたら基準も落ちる — 採用と定着は算定要件そのもの。' },
    { t: '⑩ 分院は専従の壁', b: '施設基準の専従要件は施設ごと。本院のPTを分院に「兼務」させることはできない。分院展開のボトルネックは資金より採用。' },
    { t: '⑪ 借入は時間を買う道具', b: '金利は「計画の質」で決まる。事業計画なしに銀行は貸さない。返済原資(日次黒字)の目処を先に立てるのが鉄則。' },
    { t: '⑫ バリューアップの順番', b: '①守り(基準・算定漏れ)→②回転(待ち時間)→③単価(リハ・自費)→④新患(紹介・広告)→⑤多店舗。順番を飛ばすと、増えた新患が悪い体験を拡散する。' }
  ];

  /* ================= 状態 ================= */

  const SAVE_KEY = 'clinicTown_v2';

  const settings = {
    floorLv: 1,
    doctors: 1, nurses: 1, pts: 0, receptionists: 1,
    chairs: 6, beds: 1, machines: 0,
    kiosk: false, reserve: false, reviewCare: false,
    rehaLevel: 0,
    examMean: 6, pTreat: 0.25, pReha: 0.35,
    selfReha: false, selfRehaPrice: 8000, goods: false
  };

  const G = {
    money: 2000000, rep: 55, aw: 0.30,
    day: 1, t: 0, speed: 1,
    billboard: false,
    hospitalTie: false, caremaneTie: false, companyTie: false,
    loans: [],                       // {principal, dailyRate, label}
    ads: { area: 0, pain: 0, sports: 0 },
    adPressure: 0, adReport: null, adSpendToday: 0,
    schedule: {}, arrivals: [], nextArrivalIdx: 0,
    today: null, history: [],
    branches: [],
    missionIdx: 0, missionDone: [],
    tutorialDone: false, plan: null
  };

  function monthRevenueMain() {
    return G.history.slice(-30).reduce((a, d) => a + d.revenue, 0) + (G.today ? G.today.revenue : 0);
  }
  function monthRevenueAll() {
    return G.history.slice(-30).reduce((a, d) => a + d.revenue + (d.brRevenue || 0), 0) + (G.today ? G.today.revenue : 0);
  }
  function monthJihi() {
    return G.history.slice(-30).reduce((a, d) => a + (d.jihi || 0), 0) + (G.today ? G.today.rev.jihi : 0);
  }

  function newToday() {
    return { revenue: 0, cost: 0, profit: 0, patients: 0, waitSum: 0, waitN: 0, rehaCount: 0, goodsCogs: 0,
      rev: { consult: 0, treat: 0, reha: 0, checkup: 0, jihi: 0 }, brRevenue: 0, brProfit: 0 };
  }

  /* ================= セーブ/ロード ================= */

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        settings, g: {
          money: G.money, rep: G.rep, aw: G.aw, day: G.day,
          billboard: G.billboard, hospitalTie: G.hospitalTie, caremaneTie: G.caremaneTie, companyTie: G.companyTie,
          loans: G.loans, ads: G.ads, adPressure: G.adPressure,
          schedule: G.schedule, history: G.history.slice(-40),
          branches: G.branches, missionIdx: G.missionIdx, missionDone: G.missionDone,
          tutorialDone: G.tutorialDone, plan: G.plan
        }
      }));
    } catch (e) { /* noop */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      Object.assign(settings, d.settings);
      Object.assign(G, d.g);
      return true;
    } catch (e) { return false; }
  }

  function hardReset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
    location.reload();
  }

  /* ================= シム構築 ================= */

  const clinicIso = new Iso($('clinicStage'), 20, 14, { maxTileW: 58 });
  const townIso = new Iso($('townStage'), TOWN.W, TOWN.H, { maxTileW: 52, topPad: 1.6 });

  const clinic = new CLINIC.ClinicSim(settings, {
    onRelayout(L) {
      clinicIso.W = L.W; clinicIso.H = L.H;
      clinicIso.resize();
    },
    onDischarge(p, report) {
      let revenue = 0;
      const T = G.today;
      if (report.type === 'first') { revenue += FEES.first; T.rev.consult += FEES.first; }
      if (report.type === 'revisit' || report.type === 'rehab') { revenue += FEES.revisit; T.rev.consult += FEES.revisit; }
      if (report.type === 'checkup') { revenue += FEES.checkup; T.rev.checkup += FEES.checkup; }
      for (const it of report.items) {
        if (it === 'treat') { revenue += FEES.treat; T.rev.treat += FEES.treat; }
        if (it === 'reha') {
          const f = REHA_FEE[settings.rehaLevel];
          revenue += f; T.rev.reha += f; T.rehaCount++;
        }
      }

      let sat = clamp(1.25 - report.wait / 40, 0, 1);
      if (report.didReha) sat = Math.min(1, sat + 0.1);

      // 自費リハ延長(価格弾力性: 高いほど使われない)
      if (report.didReha && settings.selfReha) {
        const pJihi = clamp((G.rep - 55) / 80, 0, 0.35) * clamp(1.7 - settings.selfRehaPrice / 9000, 0.15, 1.2);
        if (Math.random() < pJihi) { revenue += settings.selfRehaPrice; T.rev.jihi += settings.selfRehaPrice; }
      }
      // 物販(原価60%)
      if (settings.goods && (report.items.includes('treat') || report.items.includes('reha'))) {
        if (Math.random() < 0.12 * clamp(G.rep / 70, 0.6, 1.3)) {
          revenue += FEES.goods; T.rev.jihi += FEES.goods; T.goodsCogs += FEES.goodsCogs;
        }
      }

      T.revenue += revenue;
      T.patients++;
      T.waitSum += report.wait; T.waitN++;
      G.rep += (sat * 100 - G.rep) * 0.01;

      const showBoost = settings.reserve ? 0.05 : 0;
      if ((report.type === 'first' || report.type === 'revisit') && !report.didReha && Math.random() < 0.45 * sat + showBoost) {
        addSchedule(G.day + 2 + Math.floor(Math.random() * 6), 'revisit');
      }
      if (report.didReha && report.type !== 'rehab') {
        for (let k = 1; k <= 8; k++) addSchedule(G.day + Math.ceil(k * 2.5), 'rehab');
      }
      if (report.type === 'rehab' && Math.random() < 0.12 * (1 - sat)) removeSchedule('rehab');
      updateHeader();
      return revenue;
    }
  });
  clinicIso.W = clinic.L.W; clinicIso.H = clinic.L.H;

  const town = new TOWN.TownSim({
    onPatientArrive(wk) { clinic.spawn(wk.type, { refer: wk.refer }); }
  });

  /* ================= 1日の計画 ================= */

  function addSchedule(day, kind) {
    if (!G.schedule[day]) G.schedule[day] = { revisit: 0, rehab: 0 };
    G.schedule[day][kind]++;
  }
  function removeSchedule(kind) {
    const days = Object.keys(G.schedule).map(Number).sort((a, b) => a - b);
    for (const d of days) {
      if (d > G.day && G.schedule[d][kind] > 0) { G.schedule[d][kind]--; return; }
    }
  }

  function wait7() {
    const h = G.history.slice(-7);
    const n = h.reduce((a, d) => a + (d.patients || 0), 0);
    return n ? h.reduce((a, d) => a + d.avgWait * d.patients, 0) / n : 10;
  }

  function planDay() {
    const arrivals = [];
    const push = (type, source, refer) => arrivals.push({ t: 0, type, source, refer: !!refer });

    // 自然新患: 商圏 × 認知 × 評判シェア
    const share = G.rep / (G.rep + RIVAL_REP);
    const nNew = Math.max(0, Math.round(52 * G.aw * share + (Math.random() * 4 - 2)));
    for (let i = 0; i < nNew; i++) push('first', 'house');

    // リスティング広告(キーワード入札)
    G.adSpendToday = 0;
    const report = {};
    const w7 = wait7();
    for (const kw of KEYWORDS) {
      const budget = G.ads[kw.id] || 0;
      const cpcEff = Math.round(kw.cpc * (1 + G.adPressure));
      const clicks = budget > 0 ? Math.min(kw.vol, Math.floor(budget / cpcEff)) : 0;
      const cvrEff = kw.cvr * clamp(G.rep / 65, 0.5, 1.35) * (w7 > 25 ? 0.7 : 1);
      let pats = 0;
      for (let c = 0; c < clicks; c++) if (Math.random() < cvrEff) pats++;
      const spend = clicks * cpcEff;
      G.adSpendToday += spend;
      report[kw.id] = { spend, clicks, pats, cpcEff };
      for (let i = 0; i < pats; i++) push('first', kw.source, !!kw.reha);
    }
    G.adReport = report;

    if (G.billboard) for (let i = 0; i < 1 + Math.round(Math.random()); i++) push('first', 'station');
    if (G.hospitalTie) for (let i = 0; i < 2; i++) push('first', 'hospital', true);
    if (G.caremaneTie && settings.rehaLevel > 0) push('first', 'caremane', true);
    if (G.companyTie) for (let i = 0; i < 3; i++) push('checkup', 'station');

    const due = G.schedule[G.day] || { revisit: 0, rehab: 0 };
    const showRate = 0.75 + 0.2 * (G.rep / 100) + (settings.reserve ? 0.05 : 0);
    for (let i = 0; i < due.revisit; i++) if (Math.random() < showRate) push('revisit', 'house');
    for (let i = 0; i < due.rehab; i++) if (Math.random() < showRate) push('rehab', 'house');
    delete G.schedule[G.day];

    arrivals.forEach((a) => {
      a.t = settings.reserve ? 10 + Math.random() * (INTAKE_END - 30)
        : (Math.random() < 0.62 ? triRand(0, 210) : triRand(210, INTAKE_END));
    });
    arrivals.sort((a, b) => a.t - b.t);
    G.arrivals = arrivals;
    G.nextArrivalIdx = 0;
    G.today = newToday();
  }

  /* ================= 分院(マクロ経営) ================= */

  function branchStaffCost(st) {
    return st.doctors * COSTS.doctorDay + st.nurses * COSTS.nurseDay + st.pts * COSTS.ptDay + st.receptionists * COSTS.recepDay;
  }

  function branchKijunCheck(br) {
    // 分院の面積は45㎡想定 → (I)は取得不可。専従要件は分院ごと。
    if (br.rehaLevel === 3) br.rehaLevel = 2;
    if (br.rehaLevel === 2 && br.staff.pts < 2) { br.rehaLevel = br.staff.pts >= 1 ? 1 : 0; return true; }
    if (br.rehaLevel === 1 && br.staff.pts < 1) { br.rehaLevel = 0; return true; }
    return false;
  }

  function branchDay(br) {
    const site = SITES.find((s) => s.id === br.siteId);
    if (branchKijunCheck(br)) toast(`⚠️ ${br.name}: 専従PTが要件を割り、施設基準が降格しました`);
    const examCap = br.staff.doctors * 48;
    const share = br.rep / (br.rep + site.rivalRep);
    const nNewRaw = 42 * site.bigger * br.aw * share * (0.85 + Math.random() * 0.3);
    const revisRaw = br.revisitPool * (0.8 + Math.random() * 0.3);
    const visitsExam = Math.min(nNewRaw + revisRaw, examCap);
    const scale = (nNewRaw + revisRaw) > 0 ? visitsExam / (nNewRaw + revisRaw) : 0;
    const nNew = nNewRaw * scale, revis = revisRaw * scale;
    const rehaCap = Math.min(br.machines, br.staff.pts * 2) * 26;
    const rehaVisits = Math.min(br.rehabPool, rehaCap);
    const rehaFee = REHA_FEE[br.rehaLevel];
    const starts = br.rehaLevel > 0 ? Math.min(visitsExam * 0.35 * site.rehaBias, Math.max(0, rehaCap - rehaVisits)) : 0;
    const treats = visitsExam * 0.18 * Math.min(1, br.staff.nurses);
    const load = visitsExam / Math.max(1, examCap);
    const sat = clamp(1.2 - load * 0.55, 0.35, 1);

    const revenue = Math.round(nNew * FEES.first + revis * FEES.revisit + rehaVisits * (FEES.rehab + rehaFee) + treats * FEES.treat);
    const visits = Math.round(visitsExam + rehaVisits);
    const cost = Math.round(branchStaffCost(br.staff) + COSTS.branchRent + COSTS.branchBase + visits * COSTS.perPatient);
    const profit = revenue - cost;

    br.revisitPool = br.revisitPool * 0.55 + visitsExam * 0.45 * sat;
    br.rehabPool = Math.max(0, br.rehabPool - rehaVisits + starts * 7);
    br.rep = clamp(br.rep + (sat * 100 - br.rep) * 0.025, 20, 95);
    br.aw = clamp(br.aw + (br.rep >= 70 ? 0.006 : 0.0025) - 0.0045, 0.05, 0.9);
    br.last = { revenue, cost, profit, visits, reha: Math.round(rehaVisits) };
    br.profit7.push(profit);
    if (br.profit7.length > 7) br.profit7.shift();
    return { revenue, cost, profit };
  }

  function corpStaff() {
    const total = { doctors: settings.doctors, nurses: settings.nurses, pts: settings.pts, receptionists: settings.receptionists };
    for (const br of G.branches) for (const k of Object.keys(total)) total[k] += br.staff[k];
    return total;
  }

  /* ================= 日次決算 ================= */

  function mainStaffCost() {
    return (settings.doctors - 1) * COSTS.doctorDay + settings.nurses * COSTS.nurseDay + settings.pts * COSTS.ptDay + settings.receptionists * COSTS.recepDay;
  }

  function loanInterestDay() {
    return G.loans.reduce((a, l) => a + l.principal * l.dailyRate, 0);
  }

  function dayCost() {
    let c = COSTS.rent[settings.floorLv] + COSTS.base[settings.floorLv];
    c += mainStaffCost();
    c += G.adSpendToday;
    if (G.billboard) c += COSTS.billboardDay;
    c += loanInterestDay();
    c += (G.today ? G.today.patients : 0) * COSTS.perPatient;
    c += G.today ? G.today.goodsCogs : 0;
    return Math.round(c);
  }

  function endDay() {
    const T = G.today;
    T.cost = dayCost();
    T.profit = T.revenue - T.cost;
    T.avgWait = T.waitN ? T.waitSum / T.waitN : 0;

    // 分院決算
    for (const br of G.branches) {
      const r = branchDay(br);
      T.brRevenue += r.revenue;
      T.brProfit += r.profit;
    }

    G.money += T.profit + T.brProfit;
    G.history.push({
      day: G.day, revenue: T.revenue, cost: T.cost, profit: T.profit,
      patients: T.patients, avgWait: T.avgWait, rehaCount: T.rehaCount,
      jihi: T.rev.jihi, brRevenue: T.brRevenue, brProfit: T.brProfit
    });

    // 認知の変化(広告・看板・評判・忘却)
    let dAw = G.adSpendToday / 10000 * 0.0015 - 0.005;
    if (G.billboard) dAw += 0.008;
    if (G.rep >= 70) dAw += 0.006; else if (G.rep >= 60) dAw += 0.003;
    if (settings.reviewCare) dAw += 0.003;
    G.aw = clamp(G.aw + dAw, 0.05, 0.95);
    if (settings.reviewCare) G.rep = Math.min(100, G.rep + 0.15);

    // 競合の入札圧力(出しすぎるとCPC高騰)
    const totalAds = Object.values(G.ads).reduce((a, b) => a + b, 0);
    G.adPressure = totalAds > 12000 ? Math.min(0.6, G.adPressure + 0.04) : Math.max(0, G.adPressure - 0.03);

    // 施設基準の要件チェック(本院・専従PT数と面積)
    const cur = KIJUN.find((k) => k.lv === settings.rehaLevel);
    if (cur && !cur.ok(settings.pts, settings.floorLv)) {
      const next = [...KIJUN].reverse().find((k) => k.lv < settings.rehaLevel && k.ok(settings.pts, settings.floorLv));
      settings.rehaLevel = next ? next.lv : 0;
      toast(`⚠️ 施設基準の要件割れ! ${REHA_NAMES[settings.rehaLevel]}に降格しました(専従PT・面積を確認)`);
    }

    checkMission(T);

    // 30日ごとの計画レビュー
    if (G.plan && G.day % 30 === 0) reviewPlan();

    // 資金ショート → 緊急融資(高金利)
    if (G.money < -300000) {
      G.money += 1000000;
      G.loans.push({ principal: 1000000, dailyRate: 0.001, label: '緊急融資(高金利)' });
      showModal('🏦 緊急融資', `<p>資金がショートしました。銀行から <b>¥1,000,000</b> の緊急融資(日利0.1%・年利換算36%)を受けました。</p><p class="modal-note">📖 追い込まれてからの借入は高くつく。事業計画を策定していれば、通常融資(低金利)を計画的に使えます。</p>`, '経営を続ける');
    }

    const corpProfit = T.profit + T.brProfit;
    banner(`Day ${G.day} 終了 — 本院 ${yen(T.revenue)}${G.branches.length ? ` / 分院 ${yen(T.brRevenue)}` : ''} / 法人損益 <b class="${corpProfit >= 0 ? 'pos' : 'neg'}">${corpProfit >= 0 ? '+' : ''}${yen(corpProfit)}</b>`);

    G.day++;
    G.t = 0;
    planDay();
    save();
    renderPnl(); renderPlanner(); renderCorp(); renderAds();
    updateHeader();
  }

  function reviewPlan() {
    const rate = monthRevenueAll() / G.plan.revenue;
    const grade = rate >= 1 ? 'S' : rate >= 0.8 ? 'A' : rate >= 0.6 ? 'B' : 'C';
    const comments = {
      S: '目標達成。計画の精度と実行力、どちらも本物です。次の30日はもう一段高い目標を。',
      A: 'あと一歩。どのKPI(患者数/単価/認知)が計画とズレたかを予実カードで特定して、来月の一手に変えましょう。',
      B: '未達。計画が高すぎたのか、実行が足りなかったのか — 区別することが大事。キャパと認知のどちらがボトルネックでしたか?',
      C: '大幅未達。この計画は現在の体制と合っていません。目標を下げるのは敗北ではなく、計画の修正は経営の仕事そのものです。'
    };
    showModal(`📋 30日レビュー — 評価 ${grade}`,
      `<p>目標月商 ${yen(G.plan.revenue)} に対して、実績 <b>${yen(monthRevenueAll())}</b>(達成率 ${(rate * 100).toFixed(0)}%)。</p><div class="lesson-box"><b>📖 経営の学び</b><p>${comments[grade]}</p></div>`,
      '次の30日へ');
  }

  /* ================= ミッション ================= */

  function checkMission(T) {
    const m = MISSIONS[G.missionIdx];
    if (!m) return;
    let done = false;
    switch (m.id) {
      case 'profit': done = T.profit > 0; break;
      case 'wait': done = T.patients >= 15 && T.avgWait <= 15; break;
      case 'aware': done = G.aw >= 0.5; break;
      case 'reha': done = settings.rehaLevel >= 1 && T.rehaCount >= 10; break;
      case 'tie': done = G.hospitalTie && G.caremaneTie; break;
      case 'rep': done = G.rep >= 75; break;
      case 'revenue': done = monthRevenueMain() >= 8000000; break;
      case 'expand': done = settings.floorLv >= 2; break;
      case 'jihi': done = monthJihi() >= 100000; break;
      case 'branch': done = G.branches.length >= 1; break;
      case 'branchProfit': done = G.branches.some((b) => b.profit7.length >= 7 && b.profit7.reduce((a, x) => a + x, 0) > 0); break;
      case 'corp': done = monthRevenueAll() >= 25000000; break;
    }
    if (done) {
      G.money += m.reward;
      G.missionDone.push(m.id);
      showModal(`🎉 ミッション達成: ${m.title}`,
        `<p>達成ボーナス <b>${yen(m.reward)}</b> を獲得しました。</p><div class="lesson-box"><b>📖 経営の学び</b><p>${m.lesson}</p></div>`,
        G.missionIdx + 1 < MISSIONS.length ? '次のミッションへ' : 'クリニックタウンの覇者だ');
      G.missionIdx++;
      renderMissions();
      updateMissionBar();
    }
  }

  /* ================= UI: ヘッダー/バナー/モーダル ================= */

  function fmtClock(t) {
    const m = Math.floor(Math.min(t, DAY_MIN)) + 9 * 60;
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  function updateHeader() {
    $('hMoney').textContent = yen(G.money);
    $('hMoney').classList.toggle('neg', G.money < 0);
    $('hDay').textContent = `Day ${G.day}`;
    $('hClock').textContent = fmtClock(G.t);
    $('hRep').textContent = Math.round(G.rep);
    $('hAw').textContent = `${Math.round(G.aw * 100)}%`;
    $('hToday').textContent = yen(G.today ? G.today.revenue : 0);
  }

  function updateMissionBar() {
    const m = MISSIONS[G.missionIdx];
    $('missionText').textContent = m ? `MISSION ${G.missionIdx + 1}/${MISSIONS.length}: ${m.title}` : '🏆 全ミッション制覇! 街いちばんの医療法人だ';
  }

  let bannerTimer = null;
  function banner(html) {
    const el = $('banner');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 5000);
  }
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function showModal(title, bodyHtml, btnLabel) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    $('modalBtn').textContent = btnLabel || 'OK';
    $('modal').classList.add('show');
  }
  $('modalBtn').addEventListener('click', () => $('modal').classList.remove('show'));

  /* ================= UI: タブ ================= */

  let activeTab = 'clinic';
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('show', p.id === `tab-${tab}`));
    if (tab === 'clinic') clinicIso.resize();
    if (tab === 'town') { townIso.resize(); renderAds(); }
    if (tab === 'corp') renderCorp();
    if (tab === 'mgmt') { renderPnl(); renderMissions(); renderPlanner(); renderBank(); }
  }

  /* ================= UI: 院内(ショップ・自費) ================= */

  function shopCost(key) {
    const item = SHOP[key];
    if (item.flat) return item.flat;
    const cur = settingValue(key);
    return item.costs[Math.min(cur, item.costs.length - 1)];
  }
  function shopMax(key) {
    const M = clinic.L.MAX;
    return { doctor: M.doctors, nurse: M.nurses, pt: M.pts, recep: M.receptionists, chairs: M.chairs, beds: M.beds, machines: M.machines }[key];
  }
  function settingValue(key) {
    return { doctor: settings.doctors, nurse: settings.nurses, pt: settings.pts, recep: settings.receptionists, chairs: settings.chairs, beds: settings.beds, machines: settings.machines }[key];
  }
  function setSettingValue(key, v) {
    if (key === 'doctor') settings.doctors = v;
    else if (key === 'nurse') settings.nurses = v;
    else if (key === 'pt') settings.pts = v;
    else if (key === 'recep') settings.receptionists = v;
    else settings[key] = v;
  }

  function buy(key) {
    const item = SHOP[key];
    const cur = settingValue(key);
    const step = item.step || 1;
    if (cur + step > shopMax(key)) { toast(settings.floorLv === 1 ? 'これ以上は入りません(増築で上限UP)' : 'これ以上は増やせません'); return; }
    const cost = shopCost(key);
    if (G.money < cost) { toast('資金が足りません'); return; }
    G.money -= cost;
    setSettingValue(key, cur + step);
    clinic.applySettings();
    renderShop(); updateHeader(); save();
  }
  function fire(key) {
    const cur = settingValue(key);
    const min = { doctor: 1, nurse: 0, pt: 0, recep: 1, chairs: 2, beds: 0, machines: 0 }[key];
    const step = SHOP[key].step || 1;
    if (cur - step < min) { toast('これ以上は減らせません'); return; }
    setSettingValue(key, cur - step);
    clinic.applySettings();
    renderShop(); save();
  }

  function renderShop() {
    const rows = Object.entries(SHOP).map(([key, item]) => {
      const cur = settingValue(key);
      const max = shopMax(key);
      return `
      <div class="shop-row">
        <div class="shop-info">
          <span class="shop-name">${item.label} <b class="shop-count">${cur}${item.day ? '人' : ''}</b> <small class="shop-max">/ 最大${max}</small></span>
          <span class="shop-hint">${item.hint}</span>
        </div>
        <div class="shop-btns">
          <button class="mini-btn" data-fire="${key}">−</button>
          <button class="mini-btn plus" data-buy="${key}">＋ ${yen(shopCost(key))}</button>
        </div>
      </div>`;
    }).join('');
    const expand = settings.floorLv === 1
      ? `<div class="shop-row expand-row">
          <div class="shop-info"><span class="shop-name">🏗 院を増築する</span>
          <span class="shop-hint">フロア26×16へ。診察室4・リハ室100㎡(機器12台)・椅子20脚・ベッド4台に上限UP。運動器リハ(I)の面積要件を満たす</span></div>
          <div class="shop-btns"><button class="mini-btn plus" id="expandBtn">🏗 ${yen(EXPAND_COST)}</button></div>
        </div>`
      : `<div class="shop-row expand-row done"><div class="shop-info"><span class="shop-name">🏗 増築済み(リハ室100㎡)</span></div></div>`;
    $('shopList').innerHTML = rows + expand;
    $('shopList').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
    $('shopList').querySelectorAll('[data-fire]').forEach((b) => b.addEventListener('click', () => fire(b.dataset.fire)));
    const ex = $('expandBtn');
    if (ex) ex.addEventListener('click', () => {
      if (G.money < EXPAND_COST) { toast(`資金が足りません(${yen(EXPAND_COST)})`); return; }
      G.money -= EXPAND_COST;
      settings.floorLv = 2;
      clinic.applySettings();
      toast('🏗 増築完了! リハ室100㎡・診察室4室体制。院内は一時クリアされました');
      renderShop(); renderPnl(); updateHeader(); save();
    });

    $('opReserve').classList.toggle('on', settings.reserve);
    $('opKiosk').classList.toggle('on', settings.kiosk);
    $('opReview').classList.toggle('on', settings.reviewCare);

    // 自費メニュー
    $('selfReha').classList.toggle('on', settings.selfReha);
    $('goods').classList.toggle('on', settings.goods);
    $('vSelfPrice').textContent = yen(settings.selfRehaPrice);
    const uptake = clamp((G.rep - 55) / 80, 0, 0.35) * clamp(1.7 - settings.selfRehaPrice / 9000, 0.15, 1.2);
    $('selfUptake').textContent = `想定利用率 ${(uptake * 100).toFixed(0)}%(評判${Math.round(G.rep)}・この価格の場合)`;
  }

  $('opReserve').addEventListener('click', () => {
    if (!settings.reserve) {
      if (G.money < 50000) { toast('資金が足りません(¥50,000)'); return; }
      G.money -= 50000;
      settings.reserve = true;
      toast('予約制を導入しました。来院がならされ、再診の来院率も上がります');
    } else { settings.reserve = false; }
    renderShop(); updateHeader(); save();
  });
  $('opKiosk').addEventListener('click', () => {
    if (!settings.kiosk) {
      if (G.money < 300000) { toast('資金が足りません(¥300,000)'); return; }
      G.money -= 300000;
      settings.kiosk = true;
      clinic.applySettings();
      toast('自動精算機を設置しました');
    } else { settings.kiosk = false; clinic.applySettings(); }
    renderShop(); updateHeader(); save();
  });
  $('opReview').addEventListener('click', () => {
    settings.reviewCare = !settings.reviewCare;
    toast(settings.reviewCare ? 'クチコミに丁寧に返信する方針にしました' : 'クチコミ返信をやめました');
    renderShop(); save();
  });
  $('selfReha').addEventListener('click', () => {
    settings.selfReha = !settings.selfReha;
    toast(settings.selfReha ? '自費リハ延長メニューを開始(保険リハ後の追加枠)' : '自費リハをやめました');
    renderShop(); save();
  });
  $('goods').addEventListener('click', () => {
    settings.goods = !settings.goods;
    toast(settings.goods ? '物販(サポーター等)を開始。原価率60%' : '物販をやめました');
    renderShop(); save();
  });
  $('selfPrice').addEventListener('input', (e) => {
    settings.selfRehaPrice = Number(e.target.value);
    renderShop(); save();
  });

  $('examMean').addEventListener('input', (e) => { settings.examMean = Number(e.target.value); $('vExamMean').textContent = `${settings.examMean}分`; save(); });
  $('pTreat').addEventListener('input', (e) => { settings.pTreat = Number(e.target.value) / 100; $('vPTreat').textContent = `${e.target.value}%`; save(); });
  $('pReha').addEventListener('input', (e) => { settings.pReha = Number(e.target.value) / 100; $('vPReha').textContent = `${e.target.value}%`; save(); });

  /* ================= UI: タウン(広告・営業) ================= */

  function renderAds() {
    const el = $('adsList');
    if (!el) return;
    el.innerHTML = KEYWORDS.map((kw) => {
      const r = G.adReport ? G.adReport[kw.id] : null;
      const cpcEff = Math.round(kw.cpc * (1 + G.adPressure));
      return `
      <div class="ad-kw">
        <div class="ad-head">
          <span class="ad-name">${kw.name} <small>CPC ${yen(cpcEff)}${G.adPressure > 0 ? ` <b class="ad-up">↑競合入札</b>` : ''}</small></span>
          <b class="ad-budget">${G.ads[kw.id] === 0 ? '停止中' : yen(G.ads[kw.id]) + '/日'}</b>
        </div>
        <input type="range" data-ad="${kw.id}" min="0" max="15000" step="1000" value="${G.ads[kw.id]}">
        <div class="ad-stats">
          <span>${kw.hint}</span>
          ${r ? `<span class="ad-result">昨日: ${r.clicks}クリック → 新患${r.pats}人 ${r.pats > 0 ? `/ CPA ${yen(r.spend / r.pats)}` : r.spend > 0 ? '/ CPA ∞(成果ゼロ)' : ''}</span>` : ''}
        </div>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-ad]').forEach((s) => s.addEventListener('input', (e) => {
      G.ads[e.target.dataset.ad] = Number(e.target.value);
      renderAds(); save();
    }));
    const ltv = Math.round(avgUnitPrice() * 4.2);
    $('adSummary').innerHTML = `
      <span>広告費 合計 <b>${yen(Object.values(G.ads).reduce((a, b) => a + b, 0))}/日(上限)</b></span>
      <span>参考LTV(1人の新患が生む売上目安): <b>${yen(ltv)}</b> — CPAがこれを超えたら出しすぎ</span>
      ${G.adPressure > 0.1 ? `<span class="ad-warn">⚠️ 競合が入札を強めています(CPC +${Math.round(G.adPressure * 100)}%)。出稿を続けるほど単価は上がる</span>` : ''}`;
  }

  const TOWN_ACTIONS = {
    hospital: () => G.hospitalTie
      ? { title: '市民総合病院', body: '<p>🤝 連携済み。退院後の患者さんが毎日紹介されてきます。</p>' }
      : { title: '市民総合病院と連携する', cost: 50000, key: 'hospitalTie',
          body: '<p>地域連携室へ挨拶に行き、退院後のリハ・処置が必要な患者さんの受け皿になることを提案します。</p><p><b>効果:</b> 紹介患者 +2人/日(処置・リハ率が高い)</p><p><b>費用:</b> ¥50,000</p>' },
    caremane: () => G.caremaneTie
      ? { title: 'ケアマネ事業所', body: '<p>🤝 連携済み。リハが必要な利用者さんが紹介されてきます。</p>' }
      : settings.rehaLevel === 0
        ? { title: 'ケアマネ事業所', body: '<p>「リハビリの体制がないと、うちからはご紹介できません」<br>まず院内でリハ(専従PT・機器・施設基準)を立ち上げましょう。</p><p class="modal-note">📖 連携営業は「提供できる医療」が先。営業トークでは埋まりません。</p>' }
        : { title: 'ケアマネ事業所と連携する', cost: 20000, key: 'caremaneTie',
            body: '<p>担当者会議に顔を出し、リハの受け入れ体制と空き状況を共有します。</p><p><b>効果:</b> リハ紹介 +1人/日</p><p><b>費用:</b> ¥20,000</p>' },
    company: () => G.companyTie
      ? { title: '運送会社', body: '<p>🤝 健診契約済み。従業員の定期健診が毎日数件入ります。</p>' }
      : { title: '運送会社に健診営業する', cost: 30000, key: 'companyTie',
          body: '<p>従業員120人の定期健診契約を提案します。</p><p><b>効果:</b> 健診 +3件/日(単価¥8,000)</p><p><b>費用:</b> ¥30,000</p>' },
    station: () => G.billboard
      ? { title: '駅前看板', body: '<p>掲出中(維持費 ¥3,000/日)。駅利用者の新患と認知に効いています。</p>' }
      : { title: '駅前看板を出す', cost: 100000, key: 'billboard',
          body: '<p>駅前ロータリーの看板枠に広告を掲出します。</p><p><b>効果:</b> 認知 +0.8%/日、駅利用者の新患 +1〜2人/日</p><p><b>費用:</b> ¥100,000 + ¥3,000/日</p>' },
    rival: () => ({ title: 'ライバル整形外科', body: `<p>開業15年、評判 ${RIVAL_REP}。新患は評判の比で分け合っています。リスティングを出しすぎると、この医院も入札を強めてきます(CPC高騰)。</p><p class="modal-note">📖 相手を下げる手はない。自院の評判・認知・提供価値を上げるだけ。</p>` }),
    clinic: () => ({ title: 'あなたのクリニック(本院)', body: `<p>現在: 医師${settings.doctors}人 / PT${settings.pts}人 / ${REHA_NAMES[settings.rehaLevel]} / 評判${Math.round(G.rep)} / 認知${Math.round(G.aw * 100)}%</p>` })
  };

  $('townStage').addEventListener('click', (e) => {
    const rect = $('townStage').getBoundingClientRect();
    const tile = townIso.unproject(e.clientX - rect.left, e.clientY - rect.top);
    const b = town.buildingAt(tile);
    if (!b) return;
    if (b.id.startsWith('br_')) {
      const br = G.branches.find((x) => 'br_' + x.siteId === b.id);
      if (br) showModal(br.name, `<p>患者 ${br.last ? br.last.visits : 0}人/日 / リハ ${br.last ? br.last.reha : 0}件/日 / ${REHA_NAMES[br.rehaLevel]}</p><p>評判 ${Math.round(br.rep)} / 認知 ${Math.round(br.aw * 100)}% / 昨日の損益 ${br.last ? yen(br.last.profit) : '–'}</p><p class="modal-note">詳細な経営は「🏢 法人」タブで。</p>`, '閉じる');
      return;
    }
    if (!TOWN_ACTIONS[b.id]) return;
    const a = TOWN_ACTIONS[b.id]();
    if (a.key) {
      showModal(a.title, a.body + '<div class="modal-actions"><button class="btn-cta" id="actGo">実行する</button></div>', 'やめておく');
      $('actGo').addEventListener('click', () => {
        if (G.money < a.cost) { toast('資金が足りません'); return; }
        G.money -= a.cost;
        G[a.key] = true;
        $('modal').classList.remove('show');
        toast('✅ ' + a.title + ' — 完了!');
        updateHeader(); save();
      });
    } else {
      showModal(a.title, a.body, '閉じる');
    }
  });

  /* ================= UI: 法人(分院) ================= */

  const BR_ROLES = [['doctors', '医師', 1, 2], ['nurses', '看護師', 0, 2], ['pts', 'PT', 0, 8], ['receptionists', '受付', 1, 2]];

  function branchHireCost(role, cur) {
    if (role === 'doctors') return 800000;
    if (role === 'pts') return SHOP.pt.costs[Math.min(cur, SHOP.pt.costs.length - 1)];
    if (role === 'nurses') return 120000;
    return 60000;
  }

  function renderCorp() {
    const el = $('corpBody');
    if (!el) return;
    const total = corpStaff();
    const corpToday = G.history.length ? G.history[G.history.length - 1] : null;
    const summary = `
      <div class="corp-summary">
        <span>拠点 <b>${1 + G.branches.length}</b></span>
        <span>医師 <b>${total.doctors}</b></span>
        <span>看護師 <b>${total.nurses}</b></span>
        <span>PT <b>${total.pts}</b></span>
        <span>受付 <b>${total.receptionists}</b></span>
        ${corpToday ? `<span>昨日の法人損益 <b class="${(corpToday.profit + corpToday.brProfit) >= 0 ? 'pos-t' : 'neg-t'}">${yen(corpToday.profit + corpToday.brProfit)}</b></span>` : ''}
      </div>`;

    const brCards = G.branches.map((br, bi) => {
      const kijunBtns = KIJUN.filter((k) => k.lv <= 2).map((k) => {
        if (br.rehaLevel === k.lv) return `<span class="kijun-badge">${k.name} 届出済</span>`;
        const ok = k.ok(br.staff.pts, 1);
        return `<button class="mini-btn ${ok ? 'plus' : ''}" data-brkijun="${bi}:${k.lv}" ${ok ? '' : 'disabled'}>${k.name}</button>`;
      }).join(' ');
      const p7 = br.profit7.reduce((a, x) => a + x, 0);
      return `
      <div class="branch-card">
        <div class="branch-head">
          <b>🏥 ${br.name}</b>
          <span class="branch-stat">評判 ${Math.round(br.rep)} / 認知 ${Math.round(br.aw * 100)}% / ${REHA_NAMES[br.rehaLevel]}</span>
        </div>
        ${br.last ? `<div class="branch-pnl">昨日: 患者${br.last.visits}人(リハ${br.last.reha}) 売上${yen(br.last.revenue)} 損益 <b class="${br.last.profit >= 0 ? 'pos-t' : 'neg-t'}">${yen(br.last.profit)}</b> / 直近7日計 <b class="${p7 >= 0 ? 'pos-t' : 'neg-t'}">${yen(p7)}</b></div>` : '<div class="branch-pnl">開院準備中 — 明日から診療開始</div>'}
        <div class="branch-staff">
          ${BR_ROLES.map(([key, label, min, max]) => `
            <div class="plan-step"><span>${label} <small>最大${max}</small></span>
              <div><button class="mini-btn" data-brfire="${bi}:${key}">−</button><b>${br.staff[key]}</b><button class="mini-btn plus" data-brhire="${bi}:${key}">＋ ${yen(branchHireCost(key, br.staff[key]))}</button></div>
            </div>`).join('')}
          <div class="plan-step"><span>リハ機器 <small>最大8・稼働=min(機器,PT×2)</small></span>
            <div><button class="mini-btn" data-brmfire="${bi}">−</button><b>${br.machines}</b><button class="mini-btn plus" data-brmachine="${bi}">＋ ${yen(300000)}</button></div>
          </div>
        </div>
        <div class="branch-kijun">施設基準(分院は45㎡想定 → 最大II・<b>専従はこの分院のPTのみ</b>): ${kijunBtns}</div>
      </div>`;
    }).join('');

    const openable = SITES.filter((s) => !G.branches.some((b) => b.siteId === s.id));
    const openSection = openable.length ? `
      <h3 class="sub-title">🏗 新しい分院を開設する</h3>
      <p class="plan-lead">条件: <b>事業計画の策定 ${G.plan ? '✅' : '❌'}</b> / <b>本院評判70以上 ${G.rep >= 70 ? '✅' : `❌(現在${Math.round(G.rep)})`}</b> / 開設資金</p>
      ${openable.map((s) => {
        const can = G.plan && G.rep >= 70 && G.money >= s.cost;
        return `<div class="shop-row">
          <div class="shop-info"><span class="shop-name">${s.name} <small class="shop-max">${yen(s.cost)}</small></span><span class="shop-hint">${s.desc}</span></div>
          <div class="shop-btns"><button class="mini-btn ${can ? 'plus' : ''}" data-open="${s.id}" ${can ? '' : 'disabled'}>開設する</button></div>
        </div>`;
      }).join('')}` : '<p class="plan-lead">🏆 全拠点を開設済みです。</p>';

    el.innerHTML = summary + (brCards || '<p class="plan-lead">まだ分院はありません。本院を軌道に乗せてから(評判70+事業計画+資金)挑みましょう。<b>施設基準の専従要件は分院ごと</b> — PTの採用が本当の壁です。</p>') + openSection;

    el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
      const site = SITES.find((s) => s.id === b.dataset.open);
      if (G.money < site.cost) { toast('資金が足りません'); return; }
      G.money -= site.cost;
      G.branches.push({
        siteId: site.id, name: site.name, openedDay: G.day,
        staff: { doctors: 1, nurses: 1, pts: 0, receptionists: 1 },
        machines: 0, rehaLevel: 0, aw: 0.12, rep: 52, revisitPool: 4, rehabPool: 0, profit7: [], last: null
      });
      town.setBranches(G.branches.map((x) => x.siteId));
      toast(`🎉 ${site.name} を開設しました! タウンマップにも建ちました`);
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brhire]').forEach((b) => b.addEventListener('click', () => {
      const [bi, key] = b.dataset.brhire.split(':');
      const br = G.branches[Number(bi)];
      const role = BR_ROLES.find((r) => r[0] === key);
      if (br.staff[key] >= role[3]) { toast('これ以上は増やせません'); return; }
      const cost = branchHireCost(key, br.staff[key]);
      if (G.money < cost) { toast('資金が足りません'); return; }
      G.money -= cost;
      br.staff[key]++;
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brfire]').forEach((b) => b.addEventListener('click', () => {
      const [bi, key] = b.dataset.brfire.split(':');
      const br = G.branches[Number(bi)];
      const role = BR_ROLES.find((r) => r[0] === key);
      if (br.staff[key] <= role[2]) { toast('これ以上は減らせません'); return; }
      br.staff[key]--;
      branchKijunCheck(br);
      renderCorp(); save();
    }));
    el.querySelectorAll('[data-brmachine]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brmachine)];
      if (br.machines >= 8) { toast('これ以上は入りません'); return; }
      if (G.money < 300000) { toast('資金が足りません'); return; }
      G.money -= 300000;
      br.machines++;
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brmfire]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brmfire)];
      if (br.machines <= 0) return;
      br.machines--;
      renderCorp(); save();
    }));
    el.querySelectorAll('[data-brkijun]').forEach((b) => b.addEventListener('click', () => {
      const [bi, lv] = b.dataset.brkijun.split(':').map(Number);
      const br = G.branches[bi];
      br.rehaLevel = lv;
      toast(`✅ ${br.name}: ${REHA_NAMES[lv]}を届け出ました`);
      renderCorp(); save();
    }));
  }

  /* ================= UI: 経営タブ(P&L・基準・銀行) ================= */

  function renderPnl() {
    const T = G.today || newToday();
    const cost = dayCost();
    const staffCost = mainStaffCost();
    $('pnlToday').innerHTML = `
      <div class="pnl-row"><span>外来収益(初再診料)</span><b>${yen(T.rev.consult)}</b></div>
      <div class="pnl-row"><span>処置</span><b>${yen(T.rev.treat)}</b></div>
      <div class="pnl-row"><span>リハビリ(${T.rehaCount}件・${REHA_NAMES[settings.rehaLevel]})</span><b>${yen(T.rev.reha)}</b></div>
      <div class="pnl-row"><span>健診</span><b>${yen(T.rev.checkup)}</b></div>
      <div class="pnl-row"><span>自費・物販</span><b>${yen(T.rev.jihi)}</b></div>
      <div class="pnl-row total"><span>本院売上(${T.patients}人)</span><b>${yen(T.revenue)}</b></div>
      <div class="pnl-row"><span>人件費</span><b>−${yen(staffCost)}</b></div>
      <div class="pnl-row"><span>家賃・固定費${settings.floorLv === 2 ? '(増築後)' : ''}</span><b>−${yen(COSTS.rent[settings.floorLv] + COSTS.base[settings.floorLv])}</b></div>
      <div class="pnl-row"><span>広告費(本日消化)</span><b>−${yen(G.adSpendToday + (G.billboard ? COSTS.billboardDay : 0))}</b></div>
      <div class="pnl-row"><span>変動費(材料・物販原価)</span><b>−${yen(T.patients * COSTS.perPatient + T.goodsCogs)}</b></div>
      ${G.loans.length ? `<div class="pnl-row"><span>支払利息(${G.loans.length}件)</span><b>−${yen(loanInterestDay())}</b></div>` : ''}
      <div class="pnl-row total ${T.revenue - cost >= 0 ? 'pos' : 'neg'}"><span>本院 本日見込み損益</span><b>${T.revenue - cost >= 0 ? '+' : ''}${yen(T.revenue - cost)}</b></div>
      <div class="pnl-note">人件費率(本日): ${T.revenue > 0 ? Math.round(staffCost / T.revenue * 100) + '%' : '–'}(目安 45〜55%)${G.branches.length ? ` / 分院は17時にまとめて決算` : ''}</div>
    `;
    $('pnlMonth').textContent = `${yen(monthRevenueMain())}(法人 ${yen(monthRevenueAll())})`;

    const hist = G.history.slice(-14);
    const maxAbs = Math.max(50000, ...hist.map((h) => Math.abs(h.profit + (h.brProfit || 0))));
    $('pnlChart').innerHTML = hist.map((h) => {
      const p = h.profit + (h.brProfit || 0);
      const hpx = Math.max(3, Math.abs(p) / maxAbs * 46);
      return `<div class="bar-col" title="Day${h.day}: ${yen(p)}"><div class="bar ${p >= 0 ? 'pos' : 'neg'}" style="height:${hpx}px"></div><span>${h.day}</span></div>`;
    }).join('') || '<p class="pnl-empty">まだ実績がありません(1日終えると表示)</p>';

    // 施設基準(本院)
    $('kijunBody').innerHTML = KIJUN.map((k) => {
      const ok = k.ok(settings.pts, settings.floorLv);
      const active = settings.rehaLevel === k.lv;
      return `<div class="kijun-row ${active ? 'ok' : ''}">
        <div><b>${k.name}</b> — リハ1回(2単位) ${yen(k.fee)}<br><small>要件: ${k.reqText} ${ok ? '✅' : '❌'}</small></div>
        ${active ? '<span class="kijun-badge">届出済</span>' : `<button class="mini-btn ${ok ? 'plus' : ''}" data-kijun="${k.lv}" ${ok ? '' : 'disabled'}>届け出る</button>`}
      </div>`;
    }).join('') + `<p class="pnl-note">要件(専従PT数・面積)を割ると自動降格します。分院の基準は分院のPTだけで数えます(専従)。</p>`;
    $('kijunBody').querySelectorAll('[data-kijun]').forEach((b) => b.addEventListener('click', () => {
      settings.rehaLevel = Number(b.dataset.kijun);
      toast(`✅ ${REHA_NAMES[settings.rehaLevel]}を届け出ました(リハ1回 ${yen(REHA_FEE[settings.rehaLevel])})`);
      renderPnl(); save();
    }));
  }

  /* ---------- 銀行 ---------- */

  function blackDays7() {
    return G.history.slice(-7).filter((h) => h.profit + (h.brProfit || 0) > 0).length;
  }

  function renderBank() {
    const el = $('bankBody');
    if (!el) return;
    const outstanding = G.loans.reduce((a, l) => a + l.principal, 0);
    if (!G.plan) {
      el.innerHTML = `<p class="plan-lead">「事業計画書はお持ちですか?」<br>銀行融資には<b>事業計画の策定が必須</b>です。まず上の事業計画カードから策定を。</p>
        ${outstanding ? loanListHtml() : ''}`;
      bindLoanBtns(el);
      return;
    }
    const black = blackDays7();
    const limit = Math.min(10000000, 3000000 + black * 1000000);
    const available = Math.max(0, limit - G.loans.filter((l) => l.label === '銀行融資').reduce((a, l) => a + l.principal, 0));
    const diag = planDiagnosis({ revenue: G.plan.revenue, patientsPerDay: G.plan.patientsPerDay, rehaPerDay: G.plan.rehaPerDay, staff: G.plan.staff });
    const goodPlan = !diag.some((d) => d.lv === 'bad');
    const rate = goodPlan ? 0.0003 : 0.0006;
    el.innerHTML = `
      <p class="plan-lead">融資枠は<b>直近の黒字日数</b>で、金利は<b>事業計画の質</b>で決まります。</p>
      <div class="pnl-row"><span>融資枠(3百万+黒字日数×1百万)</span><b>${yen(limit)}(直近7日黒字 ${black}日)</b></div>
      <div class="pnl-row"><span>借入可能額</span><b>${yen(available)}</b></div>
      <div class="pnl-row"><span>適用金利</span><b>${goodPlan ? '日利0.03%(年利換算 約11%)— 計画良好' : '日利0.06%(年利換算 約22%)— 計画に⚠️あり'}</b></div>
      ${available >= 1000000 ? `
        <div class="plan-step"><span>借入額</span>
          <div><button class="mini-btn" id="loanMinus">−</button><b id="loanAmt">¥1,000,000</b><button class="mini-btn plus" id="loanPlus">＋</button></div>
        </div>
        <button class="btn-cta" id="loanGo">この条件で借り入れる</button>` : '<p class="plan-lead">現在借入可能額はありません(黒字を積むと枠が増えます)。</p>'}
      ${loanListHtml()}`;
    let amt = 1000000;
    const lm = $('loanMinus'), lp = $('loanPlus'), lg = $('loanGo');
    if (lp) {
      lp.addEventListener('click', () => { amt = Math.min(available, amt + 1000000); $('loanAmt').textContent = yen(amt); });
      lm.addEventListener('click', () => { amt = Math.max(1000000, amt - 1000000); $('loanAmt').textContent = yen(amt); });
      lg.addEventListener('click', () => {
        G.money += amt;
        G.loans.push({ principal: amt, dailyRate: rate, label: '銀行融資' });
        toast(`🏦 ${yen(amt)} を借り入れました(利息 ${yen(amt * rate)}/日)`);
        renderBank(); updateHeader(); save();
      });
    }
    bindLoanBtns(el);
  }

  function loanListHtml() {
    if (!G.loans.length) return '';
    return `<h3 class="sub-title">借入一覧</h3>` + G.loans.map((l, i) => `
      <div class="pnl-row"><span>${l.label} ${yen(l.principal)}(利息${yen(l.principal * l.dailyRate)}/日)</span>
      <button class="mini-btn" data-repay="${i}">全額返済</button></div>`).join('');
  }
  function bindLoanBtns(el) {
    el.querySelectorAll('[data-repay]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.repay);
      const l = G.loans[i];
      if (G.money < l.principal) { toast('返済資金が足りません'); return; }
      G.money -= l.principal;
      G.loans.splice(i, 1);
      toast('💸 完済しました。利息負担が消えます');
      renderBank(); updateHeader(); save();
    }));
  }

  /* ================= 事業計画(策定・予実) ================= */

  const PLAN_ROLES = [
    ['doctors', '医師', COSTS.doctorDay, 1, 4, '※院長1人分の人件費は利益から'],
    ['nurses', '看護師', COSTS.nurseDay, 0, 4, ''],
    ['pts', 'PT', COSTS.ptDay, 0, 12, ''],
    ['receptionists', '受付', COSTS.recepDay, 1, 3, '']
  ];
  let planEditing = false;
  let draft = null;

  function newDraft() {
    return {
      revenue: G.plan ? G.plan.revenue : 4000000,
      patientsPerDay: G.plan ? G.plan.patientsPerDay : 30,
      rehaPerDay: G.plan ? G.plan.rehaPerDay : 10,
      staff: G.plan ? Object.assign({}, G.plan.staff) : {
        doctors: settings.doctors, nurses: settings.nurses, pts: settings.pts, receptionists: settings.receptionists
      }
    };
  }

  function avgUnitPrice() {
    const h = G.history.slice(-7);
    const rev = h.reduce((a, d) => a + d.revenue, 0);
    const pt = h.reduce((a, d) => a + d.patients, 0);
    return pt >= 10 ? rev / pt : 2800;
  }

  function staffCostOf(st) {
    return (st.doctors - 1) * COSTS.doctorDay + st.nurses * COSTS.nurseDay + st.pts * COSTS.ptDay + st.receptionists * COSTS.recepDay;
  }

  function planDiagnosis(d) {
    const unit = avgUnitPrice();
    const fixed = staffCostOf(d.staff) + COSTS.rent[settings.floorLv] + COSTS.base[settings.floorLv] + Object.values(G.ads).reduce((a, b) => a + b, 0) + (G.billboard ? COSTS.billboardDay : 0);
    const bep = Math.ceil(fixed / Math.max(500, unit - COSTS.perPatient));
    const examCap = Math.floor(d.staff.doctors * (480 / (settings.examMean + 1.5)) * 0.72);
    const rehaCap = Math.min(settings.machines, d.staff.pts * 2) * Math.floor(480 / 15);
    const laborRate = d.revenue > 0 ? (staffCostOf(d.staff) * 30) / d.revenue : 1;
    const planProfit = Math.round((d.patientsPerDay * (unit - COSTS.perPatient) - fixed) * 30);
    const msgs = [];
    msgs.push({ lv: 'info', text: `想定単価 ${yen(unit)}/人(直近実績) → 損益分岐点は <b>1日${bep}人</b>` });
    if (d.patientsPerDay < bep) msgs.push({ lv: 'bad', text: `⚠️ 目標${d.patientsPerDay}人/日 < 損益分岐${bep}人/日 — <b>この計画は構造的に赤字</b>` });
    else msgs.push({ lv: 'good', text: `✅ 目標達成時の計画利益: <b>${planProfit >= 0 ? '+' : ''}${yen(planProfit)}/月</b>` });
    if (d.patientsPerDay > examCap) msgs.push({ lv: 'bad', text: `⚠️ 診察キャパ不足 — 医師${d.staff.doctors}人では約${examCap}人/日が限界` });
    if (d.rehaPerDay > rehaCap) msgs.push({ lv: 'bad', text: `⚠️ リハキャパ不足 — PT${d.staff.pts}人×機器${settings.machines}台では約${rehaCap}件/日が限界` });
    if (laborRate > 0.60) msgs.push({ lv: 'bad', text: `⚠️ 計画人件費率 ${(laborRate * 100).toFixed(0)}% — 目安(45〜55%)を大きく超過` });
    else if (laborRate > 0.55) msgs.push({ lv: 'warn', text: `計画人件費率 ${(laborRate * 100).toFixed(0)}% — やや高め(目安45〜55%)` });
    else msgs.push({ lv: 'good', text: `計画人件費率 ${(laborRate * 100).toFixed(0)}% — 健全圏(目安45〜55%)` });
    return msgs;
  }

  function renderPlanner() {
    const el = $('plannerBody');
    if (!el) return;
    if (!G.plan || planEditing) {
      if (!draft) draft = newDraft();
      const diag = planDiagnosis(draft);
      el.innerHTML = `
        <p class="plan-lead">目標と人員をセットで決めます。<b>計画は当てるためではなく、ズレに早く気づくため</b>。銀行融資・分院開設の前提条件でもあります。30日ごとにレビューが入ります。</p>
        <div class="plan-form">
          <label class="ctrl">
            <span class="ctrl-head">目標月商(30日) <b>${yen(draft.revenue)}</b></span>
            <input type="range" id="planRev" min="2000000" max="30000000" step="500000" value="${draft.revenue}">
          </label>
          <div class="plan-steppers">
            <div class="plan-step"><span>目標患者数/日(本院)</span><div><button class="mini-btn" data-pd="patientsPerDay" data-d="-5">−</button><b>${draft.patientsPerDay}人</b><button class="mini-btn plus" data-pd="patientsPerDay" data-d="5">＋</button></div></div>
            <div class="plan-step"><span>目標リハ件数/日(本院)</span><div><button class="mini-btn" data-pd="rehaPerDay" data-d="-5">−</button><b>${draft.rehaPerDay}件</b><button class="mini-btn plus" data-pd="rehaPerDay" data-d="5">＋</button></div></div>
            ${PLAN_ROLES.map(([key, label, cost, min, max, note]) => `
              <div class="plan-step"><span>${label}の計画 <small>${yen(cost)}/日${note}</small></span>
                <div><button class="mini-btn" data-ps="${key}" data-d="-1">−</button><b>${draft.staff[key]}人</b><button class="mini-btn plus" data-ps="${key}" data-d="1">＋</button></div>
              </div>`).join('')}
          </div>
          <div class="plan-diag">${diag.map((m) => `<p class="diag ${m.lv}">${m.text}</p>`).join('')}</div>
          <button class="btn-cta" id="planCommit">${G.plan ? 'この内容で計画を更新する' : 'この計画で行く(策定)'}</button>
          ${G.plan ? '<button class="btn-cta ghost" id="planCancel">見直しをやめる</button>' : ''}
        </div>`;
      $('planRev').addEventListener('input', (e) => { draft.revenue = Number(e.target.value); renderPlanner(); });
      el.querySelectorAll('[data-pd]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.pd;
        draft[k] = clamp(draft[k] + Number(b.dataset.d), 0, 200);
        renderPlanner();
      }));
      el.querySelectorAll('[data-ps]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.ps;
        const role = PLAN_ROLES.find((r) => r[0] === k);
        draft.staff[k] = clamp(draft.staff[k] + Number(b.dataset.d), role[3], role[4]);
        renderPlanner();
      }));
      $('planCommit').addEventListener('click', () => {
        G.plan = { revenue: draft.revenue, patientsPerDay: draft.patientsPerDay, rehaPerDay: draft.rehaPerDay, staff: Object.assign({}, draft.staff), startDay: G.day };
        planEditing = false;
        draft = null;
        toast('📝 事業計画を策定しました。銀行融資も使えるようになりました');
        renderPlanner(); renderBank(); save();
      });
      const pc = $('planCancel');
      if (pc) pc.addEventListener('click', () => { planEditing = false; draft = null; renderPlanner(); });
      return;
    }

    const plan = G.plan;
    const cur = monthRevenueAll();
    const pct = Math.min(100, cur / plan.revenue * 100);
    const h7 = G.history.slice(-7);
    const ptAvg = h7.length ? h7.reduce((a, d) => a + d.patients, 0) / h7.length : 0;
    const rehaAvg = h7.length ? h7.reduce((a, d) => a + d.rehaCount, 0) / h7.length : 0;
    const rev7 = h7.reduce((a, d) => a + d.revenue, 0);
    const laborNow = staffCostOf(settings) * h7.length;
    const laborRate = rev7 > 0 ? laborNow / rev7 : 0;
    const staffRows = PLAN_ROLES.map(([key, label]) => {
      const now = key === 'doctors' ? settings.doctors : key === 'nurses' ? settings.nurses : key === 'pts' ? settings.pts : settings.receptionists;
      const diff = now - plan.staff[key];
      return `<span class="staff-chip ${diff === 0 ? 'ok' : diff < 0 ? 'under' : 'over'}">${label} ${now}/${plan.staff[key]}人${diff === 0 ? '' : diff < 0 ? `(計画まであと${-diff})` : `(計画+${diff})`}</span>`;
    }).join('');
    const nextReview = 30 - (G.day % 30 || 30) + 30;
    const bar = (label, now, target, unit) => {
      const p = Math.min(100, target > 0 ? now / target * 100 : 0);
      return `<div class="pv-row"><span class="pv-label">${label}</span>
        <div class="pv-track"><i style="width:${p.toFixed(1)}%" class="${p >= 100 ? 'full' : p >= 70 ? 'mid' : 'low'}"></i></div>
        <span class="pv-num">${now}${unit} / ${target}${unit}</span></div>`;
    };
    el.innerHTML = `
      <div class="pv-head">
        <div class="pv-rev">
          <span>月商目標(法人) ${yen(plan.revenue)} に対して / 次回レビュー Day ${Math.ceil(G.day / 30) * 30}</span>
          <b>${yen(cur)} <small>(${pct.toFixed(0)}%)</small></b>
          <div class="pv-track big"><i style="width:${pct.toFixed(1)}%" class="${pct >= 100 ? 'full' : pct >= 70 ? 'mid' : 'low'}"></i></div>
        </div>
      </div>
      ${bar('患者数/日(7日平均)', Math.round(ptAvg), plan.patientsPerDay, '人')}
      ${bar('リハ件数/日(7日平均)', Math.round(rehaAvg), plan.rehaPerDay, '件')}
      <div class="pv-staff"><span class="pv-label">本院人員(現在/計画)</span>${staffRows}</div>
      <div class="pv-row"><span class="pv-label">人件費率(直近7日)</span>
        <b class="pv-rate ${laborRate > 0.6 ? 'bad' : laborRate > 0.55 ? 'warn' : 'good'}">${rev7 > 0 ? (laborRate * 100).toFixed(0) + '%' : '–'}</b>
        <small>目安 45〜55%</small></div>
      <button class="btn-cta ghost" id="planEdit">計画を見直す</button>`;
    $('planEdit').addEventListener('click', () => { planEditing = true; draft = newDraft(); renderPlanner(); });
  }

  function renderMissions() {
    $('missionList').innerHTML = MISSIONS.map((m, i) => {
      const st = i < G.missionIdx ? 'done' : i === G.missionIdx ? 'now' : 'locked';
      return `<div class="mission-row ${st}">
        <span class="mission-mark">${st === 'done' ? '✅' : st === 'now' ? '🎯' : '🔒'}</span>
        <div><b>${m.title}</b>${st === 'done' ? `<p class="mission-lesson">${m.lesson}</p>` : ''}</div>
      </div>`;
    }).join('');
    $('textbook').innerHTML = TEXTBOOK.map((c) => `<details class="tb-card"><summary>${c.t}</summary><p>${c.b}</p></details>`).join('');
  }

  /* ================= チュートリアル ================= */

  const TUTORIAL = [
    { tab: null, sel: null, text: 'ようこそ、クリニックタウンへ。あなたはこの街の整形外科クリニックを承継した新オーナーです。<b>目指すは医師4名・PT30名(分院含む)の医療法人</b>。しばらくは前院長のかかりつけ患者さんが来てくれますが、<b>何もしなければ先細り</b>です。' },
    { tab: null, sel: '.hud', text: '経営ダッシュボード。<b>資金</b>が尽きると高金利の緊急融資が始まります。<b>評判</b>は患者体験で、<b>認知</b>は「街の何%があなたを知っているか」。' },
    { tab: 'mgmt', sel: '#formulaCard', text: 'いちばん大事な式。<b>売上 = 患者数 × 単価</b>。全ての打ち手はこのどちらかを動かします。' },
    { tab: 'clinic', sel: '#clinicStage', text: '院内。患者さんが<b>受付→待合→診察→(処置/リハ)→会計</b>と流れます。行列ができたらそこがボトルネック。' },
    { tab: 'clinic', sel: '#shopCard', text: 'スタッフ・設備・<b>増築</b>はここ。医師は最大4人、PTは最大12人(本院)。採用費は人数とともに高騰します — <b>採用市場は売り手優位</b>。' },
    { tab: 'clinic', sel: '#jihiCard', text: '<b>自費メニュー</b>。保険診療は公定価格ですが、自費は価格を自分で決められます。ただし高くすると使われない(価格弾力性)。' },
    { tab: 'town', sel: '#townStage', text: '商圏。✓の家=あなたを知っている家。病院・ケアマネ・企業・駅をタップして営業。<b>分院を建てるとこの地図に増えていきます</b>。' },
    { tab: 'town', sel: '#marketingCard', text: '<b>リスティング広告はキーワード入札制</b>。「地域名」は濃いが数が少ない、「腰痛」は数が多いが薄い。出しすぎると競合が入札してCPCが高騰します。<b>CPAをLTVと比べて</b>勝ち負けを判断。' },
    { tab: 'mgmt', sel: '#plannerCard', text: '<b>事業計画</b>。目標×人員をセットで策定すると、損益分岐点・キャパ・人件費率を自動診断。<b>銀行融資と分院開設の前提条件</b>で、30日ごとにレビューが入ります。' },
    { tab: 'mgmt', sel: '#kijunCard', text: '<b>施設基準</b>。運動器リハは(III)専従1名→(II)常勤PT2名→(I)PT4名+100㎡(増築)で単価が変わります。<b>要件を割ると自動降格</b> — 人が辞めたら基準も落ちる。' },
    { tab: 'corp', sel: '#corpCard', text: '<b>法人タブ</b>。評判70+事業計画+資金で分院を開設できます。<b>専従要件は分院ごと</b> — 本院のPTは数えられません。分院展開の本当の壁は採用です。' },
    { tab: 'mgmt', sel: '#missionCard', text: 'ミッションが経営カリキュラム。<b>黒字化→回転→認知→リハ→連携→評判→月商→増築→自費→分院→法人月商2,500万</b>。まずは1日の黒字から。健闘を祈ります!' }
  ];
  let tutIdx = -1;

  function startTutorial() { tutIdx = 0; showTutStep(); }
  function showTutStep() {
    const st = TUTORIAL[tutIdx];
    if (!st) { endTutorial(); return; }
    if (st.tab) switchTab(st.tab);
    $('tutText').innerHTML = st.text;
    $('tutStep').textContent = `${tutIdx + 1} / ${TUTORIAL.length}`;
    $('tutorial').classList.add('show');
    document.querySelectorAll('.tut-focus').forEach((el) => el.classList.remove('tut-focus'));
    if (st.sel) {
      const el = document.querySelector(st.sel);
      if (el) {
        el.classList.add('tut-focus');
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      }
    }
    $('tutNext').textContent = tutIdx === TUTORIAL.length - 1 ? '経営を始める!' : '次へ →';
  }
  function endTutorial() {
    tutIdx = -1;
    $('tutorial').classList.remove('show');
    document.querySelectorAll('.tut-focus').forEach((el) => el.classList.remove('tut-focus'));
    G.tutorialDone = true;
    switchTab('clinic');
    save();
  }
  $('tutNext').addEventListener('click', () => { tutIdx++; showTutStep(); });
  $('tutSkip').addEventListener('click', endTutorial);
  $('helpBtn').addEventListener('click', startTutorial);
  $('resetBtn').addEventListener('click', () => {
    showModal('はじめからやり直す', '<p>セーブデータを消して、Day 1 からやり直します。よろしいですか?</p><div class="modal-actions"><button class="btn-cta danger" id="resetGo">全部消してやり直す</button></div>', 'やめておく');
    $('resetGo').addEventListener('click', hardReset);
  });

  /* ================= 速度・表示 ================= */

  document.querySelectorAll('.speed-btn').forEach((b) => {
    b.addEventListener('click', () => {
      G.speed = Number(b.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach((x) => x.classList.toggle('on', x === b));
    });
  });
  const view = { heat: false, lines: false };
  $('heatBtn').addEventListener('click', () => { view.heat = !view.heat; $('heatBtn').classList.toggle('on', view.heat); });
  $('lineBtn').addEventListener('click', () => { view.lines = !view.lines; $('lineBtn').classList.toggle('on', view.lines); });

  /* ================= メインループ ================= */

  function updateClinicHud() {
    const qs = clinic.queueSummary();
    qs.sort((a, b) => b[1] - a[1]);
    const [name, n] = qs[0];
    $('bottleneck').textContent = n >= 3 ? `ボトルネック: ${name}(${n}人)` : 'ボトルネック: なし 😌';
    $('bottleneck').classList.toggle('hot', n >= 3);
    $('panic').hidden = clinic.standingCount() === 0;
    const T = G.today;
    $('cWait').textContent = T && T.waitN ? `${(T.waitSum / T.waitN).toFixed(0)}分` : '–';
    $('cIn').textContent = clinic.patients.length;
  }

  let lastTs = 0;
  function loop(ts) {
    clinicIso.time = ts;
    townIso.time = ts;
    const dtReal = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    if (G.speed > 0 && tutIdx < 0) {
      let dt = dtReal * G.speed * 3;
      while (dt > 0) {
        const step = Math.min(0.5, dt);
        stepSim(step);
        dt -= step;
      }
    }
    if (activeTab === 'clinic') clinic.draw(clinicIso, view);
    if (activeTab === 'town') {
      town.setAwareness(G.aw);
      town.draw(townIso, { billboard: G.billboard, hospitalTie: G.hospitalTie, caremaneTie: G.caremaneTie, companyTie: G.companyTie, listing: Object.values(G.ads).reduce((a, b) => a + b, 0) });
    }
    updateHeader();
    updateClinicHud();
    requestAnimationFrame(loop);
  }

  function stepSim(dt) {
    G.t += dt;
    while (G.nextArrivalIdx < G.arrivals.length && G.arrivals[G.nextArrivalIdx].t <= G.t) {
      const a = G.arrivals[G.nextArrivalIdx];
      town.requestVisit(a.type, a.source, a.refer);
      G.nextArrivalIdx++;
    }
    clinic.tick(dt);
    town.tick(dt);
    const townPatients = town.walkers.some((w) => w.kind === 'patient');
    if (G.t >= DAY_MIN && !townPatients && clinic.patients.length === 0) endDay();
    else if (G.t >= DAY_MIN + 150) {
      clinic.reset();
      endDay();
    }
  }

  /* ================= デバッグフック(検証用) ================= */

  window.GAME = {
    G, settings, clinic, town, KIJUN, REHA_FEE,
    grant: (n) => { G.money += n; updateHeader(); }
  };

  /* ================= 起動 ================= */

  const hasSave = load();
  if (!hasSave) {
    [8, 7, 7, 6, 6, 5, 5, 4, 4, 3].forEach((n, i) => {
      for (let k = 0; k < n; k++) addSchedule(i + 1, 'revisit');
    });
  }
  clinic.applySettings();
  clinicIso.W = clinic.L.W; clinicIso.H = clinic.L.H;
  town.setBranches(G.branches.map((x) => x.siteId));
  planDay();
  renderShop();
  renderPnl();
  renderMissions();
  renderPlanner();
  renderBank();
  renderCorp();
  renderAds();
  updateMissionBar();
  updateHeader();
  $('vExamMean').textContent = `${settings.examMean}分`;
  $('examMean').value = settings.examMean;
  $('vPTreat').textContent = `${Math.round(settings.pTreat * 100)}%`;
  $('pTreat').value = Math.round(settings.pTreat * 100);
  $('vPReha').textContent = `${Math.round(settings.pReha * 100)}%`;
  $('pReha').value = Math.round(settings.pReha * 100);
  $('selfPrice').value = settings.selfRehaPrice;

  clinicIso.resize();
  townIso.resize();
  window.addEventListener('resize', () => { clinicIso.resize(); townIso.resize(); });

  switchTab('clinic');
  if (!G.tutorialDone) startTutorial();
  else if (hasSave) banner(`おかえりなさい — Day ${G.day} から再開します`);

  requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(loop); });
})();
