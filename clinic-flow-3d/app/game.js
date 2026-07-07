/* クリニックタウン3D — 経済モデル・法人経営・KPI・ミッション・UI統合
 * 教育の核:
 *   売上 = 患者数 × 診療単価
 *   患者数 = 新患(認知 × 評判 × 競合 × 紹介) + 再診(治療計画 × 患者体験)
 *   単価 = 診療の中身(初再診・注射・処置・物療・画像・リハ単位・自費)
 *   利益 = 売上 − 固定費 − 変動費 − 広告費 − 金利
 */

'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const yen = (n) => `¥${Math.round(n).toLocaleString()}`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // 期待値xを整数化(端数は確率で切り上げ)
  const frac = (x) => Math.floor(x) + (Math.random() < x % 1 ? 1 : 0);

  /* ================= 定数 ================= */

  const RIVAL_REP = 65;
  const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
  const DAY_SPECS = {
    full: { label: '終日', min: 480, intake: 420, pay: 1, arr: 1 },
    am: { label: '午前', min: 240, intake: 200, pay: 0.6, arr: 0.55 },
    closed: { label: '休診', min: 0, intake: 0, pay: 0, arr: 0 }
  };

  // 実態準拠の算定構造: 再診料に「何もしなければ外来管理加算」「処方箋料」が付随する
  const FEES = {
    first: 3000, revisit: 900, kanri: 520, presc: 680, rehab: 900, checkup: 8000,
    treat: 1500, inj: 1800, trig: 1200, physio: 350, xray: 1500, mri: 16000,
    osteo: 3800, goods: 3500, goodsCogs: 2100, prpCogs: 12000
  };
  const SEG_NAMES = { senior: '高齢者', worker: '勤労者', sports: 'スポーツ' };
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
    perPatient: 300, billboardDay: 3000, mriMaint: 12000,
    branchRent: 35000, branchBase: 6000
  };

  const SHOP = {
    doctor:  { label: '医師を採用', costs: [0, 500000, 800000, 1200000], day: COSTS.doctorDay, hint: '診察室が1室増える(日給¥80,000)。採用費は人数とともに高騰' },
    nurse:   { label: '看護師を採用', costs: [120000, 120000, 150000, 180000], day: COSTS.nurseDay, hint: '処置ベッドの稼働数=看護師数(日給¥18,000)' },
    pt:      { label: 'PTを採用', costs: [150000, 150000, 180000, 180000, 220000, 220000, 250000, 250000, 300000, 300000, 350000, 350000], day: COSTS.ptDay, hint: '施設基準の要件・リハ稼働の源泉(日給¥16,000)' },
    recep:   { label: '受付を増員', costs: [60000, 60000, 80000], day: COSTS.recepDay, hint: '受付窓口が増える(日給¥10,000)' },
    chairs:  { label: '待合椅子を+2脚', costs: null, flat: 40000, step: 2, hint: '立ち待ちはクレームと離反のもと' },
    beds:    { label: '処置ベッドを増設', costs: null, flat: 150000, hint: '処置(創傷・固定等)1件+¥1,500。看護師とセット' },
    machines:{ label: 'リハ機器を増設', costs: null, flat: 300000, hint: 'リハ稼働=min(機器, PT×2+助手)。面積要件は増築で' },
    physio:  { label: '物療機器を増設', costs: null, flat: 80000, hint: '消炎鎮痛等処置(1件¥350)。PT不要・高回転。1台35件/日' },
    rehaAide:{ label: 'リハ助手を採用', costs: [80000, 80000, 90000, 90000], day: 10000, hint: 'リハ室の回転対策: PT単位上限+4/人・機器稼働+1(日給¥10,000)' }
  };

  const EXPAND_COST = 5000000;
  const MRI_COST = 18000000;
  const DEXA_COST = 2500000;
  const PRP_CERT_COST = 500000;

  const KEYWORDS = [
    { id: 'area', name: '「◯◯町 整形外科」', cpc: 400, cvr: 0.10, vol: 40, source: 'house', hint: '指名度が高く CV率10%。ただし検索数に上限' },
    { id: 'pain', name: '「腰痛・膝の痛み」', cpc: 150, cvr: 0.035, vol: 120, source: 'house', hint: '検索数は多いが、比較検討層で CV率3.5%' },
    { id: 'sports', name: '「スポーツ整形」', cpc: 250, cvr: 0.06, vol: 30, source: 'station', reha: true, hint: 'リハ需要の高い患者層。単価・LTVが高い' }
  ];

  // 営業先(関係レベル 0〜max)。30日訪問しないと関係が1つ冷める
  const REL_DEF = {
    hospital: { name: '市民総合病院', cost: 50000, max: 3, effect: '紹介患者 +Lv人/日(処置・リハ率高)', desc: '地域連携室との関係。退院後の受け皿になる。' },
    caremane: { name: 'ケアマネ事業所', cost: 20000, max: 3, needsReha: true, effect: 'リハ紹介 +Lv×0.7人/日', desc: '担当者会議に顔を出し、空き状況を共有する。' },
    rouken: { name: '老健施設', cost: 30000, max: 3, needsReha: true, effect: 'リハ紹介 +Lv×0.7人/日', desc: '退所後の外来リハの受け皿として連携する。' },
    company: { name: '運送会社', cost: 30000, max: 2, effect: '健診 +Lv×1.5件/日', desc: '従業員の定期健診・腰痛対策セミナー。' },
    sports: { name: 'スポーツクラブ', cost: 30000, max: 3, effect: 'スポーツ外傷の新患 +Lv×0.6人/日・PRP需要UP', desc: 'トレーナーと提携し、外傷・障害の受け皿になる。' },
    school: { name: '高校(部活動)', cost: 25000, max: 2, effect: '部活外傷の新患 +Lv×0.5人/日', desc: '部活動の外傷対応・メディカルチェックで信頼を作る。' },
    shoutengai: { name: '商店街組合', cost: 40000, max: 3, effect: '訪問ごとに認知+1.2%・評判+0.5', desc: '祭りへの協賛・健康相談ブース。地域の顔になる。' }
  };

  const SITES = [
    { id: 'kita', name: '北口クリニック', cost: 8000000, rivalRep: 62, bigger: 1.0, rehaBias: 1.0, desc: '駅の北側の住宅エリア。手堅い商圏。' },
    { id: 'minami', name: '南町クリニック', cost: 9000000, rivalRep: 60, bigger: 0.95, rehaBias: 1.35, desc: '高齢者が多くリハ需要が高い。PTを厚く。' },
    { id: 'tonari', name: '隣駅クリニック', cost: 12000000, rivalRep: 70, bigger: 1.4, rehaBias: 1.0, desc: '商圏は大きいが競合も強い。評判勝負。' }
  ];

  const MISSIONS = [
    { id: 'firstday', title: '初日の診療を完了する', reward: 50000,
      lesson: 'このゲームの回し方: ①1日進める → ②結果を見る → ③スタッフの声を聞く → ④1つ改善する。この繰り返しで数字は必ず動く。' },
    { id: 'wait40', title: '平均待ち時間40分未満の日をつくる(来院8人以上)', reward: 50000,
      lesson: '待ち時間は最大の離反要因。医療の質は見えにくいが、待ち時間は誰にでも見える。詰まりは受付か診察か — 1か所ずつ潰す。' },
    { id: 'rev50k', title: '1日の売上¥50,000を超える', reward: 50000,
      lesson: 'いちばん大事な式: 売上 = 患者数 × 単価。すべての打ち手はどちらか(または両方)を動かす。「今日の一手はどちらを動かしたか?」を毎日問う。' },
    { id: 'rep60', title: '評判を60にする', reward: 80000,
      lesson: '評判は患者体験の積分。待ち時間を削り、丁寧に診る — 地味な積み上げが、いちばん安い集患になる。' },
    { id: 'web', title: 'Web問診・事前受付を導入する', reward: 80000,
      lesson: '受付は院内導線の最初の関門。受付処理を軽くすると、同じ人数でも待ちが減り評判が守れる。「人を増やす前に仕事を減らす」が改善の原則。' },
    { id: 'physio10', title: '物療(消炎鎮痛)を10件/日 実施する', reward: 100000,
      lesson: '物療は低単価(¥350)だが高回転で、再診の受け皿になる。整形外来の単価は「初再診料+注射+物療+画像+リハ」の複合で作る。' },
    { id: 'black3', title: '3日連続で黒字にする(法人)', reward: 150000,
      lesson: '外来は固定費型ビジネス。人件費・家賃は患者0人でも出ていく。損益分岐点(1日何人で黒字か)を頭に入れると、打ち手の優先順位が見える。' },
    { id: 'reha10', title: '運動器リハを届け出て、リハ実施10件/日', reward: 200000,
      lesson: 'リハは整形外来の柱。施設基準で単価が変わる: (III)¥1,700→(II)¥3,400→(I)¥3,700(2単位換算)。専従PTの人数と面積が壁。' },
    { id: 'tie', title: '病院・ケアマネの両方と関係を作る(Lv1以上)', reward: 200000,
      lesson: '紹介は最強の新患チャネル。ただし関係は「作って終わり」ではない — 30日放置すると冷める。定期訪問は資産のメンテナンス。' },
    { id: 'month300k', title: '月間利益(直近30日・法人)¥300,000', reward: 300000,
      lesson: '日次の黒字が「点」なら、月間利益は「線」。バリューアップの順番は ①守り(待ち・評判)→②回転→③単価→④新患。' },
    { id: 'expand', title: '院を増築する(リハ室100㎡・診察室4)', reward: 300000,
      lesson: '設備投資は「回収期間」で考える。増築もMRIも、1日あたりの増収×稼働日数でいつ回収できるかを先に計算する。' },
    { id: 'revenue', title: '本院の月商(直近30日)¥8,000,000', reward: 500000,
      lesson: '月商800万 = 1日30万×27診療日。患者数×単価に分解すると「あと何人」「あと何円」が見える — 分解できる目標だけが実行できる。' },
    { id: 'branch', title: '分院1号店を開設する', reward: 500000,
      lesson: '分院は「成功した仕組みのコピー」でしか成功しない。施設基準の専従要件は分院ごと — 採用が分院展開の本当の壁。' },
    { id: 'branchProfit', title: '分院の直近7日を黒字にする', reward: 500000,
      lesson: '分院経営は「見えない現場」のマネジメント。数字(稼働・評判・人件費率)で異変に気づく仕組みがないと、分院は静かに沈む。' },
    { id: 'corp', title: '法人月商(全拠点・直近30日)¥25,000,000', reward: 1000000,
      lesson: '経営者の仕事は「自分がいなくても回る仕組み」を作ること。ここまで来たら、次は現実のクリニックで。' }
  ];

  const TEXTBOOK = [
    { t: '① 売上 = 患者数 × 単価', b: 'すべての打ち手はこのどちらか(または両方)を動かす。「今日やったことはどちらを動かしたか?」を毎日問う。' },
    { t: '② 患者数 = 新患 + 再診', b: '新患は「認知×評判×アクセス×紹介」。再診は「治療計画×患者体験」。新患獲得コストは再診維持の5倍以上。' },
    { t: '③ 単価は複合で作る', b: '整形外来の単価 = 初再診料+注射+処置+物療+画像+リハ単位。リハだけに頼らず、医学的必要性のある行為を取りこぼさない。実施率をKPIにする。' },
    { t: '④ 外来は固定費型ビジネス', b: '人件費・家賃は患者0人でも出ていく。損益分岐点(何人で黒字か)を必ず把握する。' },
    { t: '⑤ 待ち時間は最大の離反要因', b: '医療の質は見えにくいが、待ち時間は誰にでも見える。予約制・動線・会計自動化で「体感」を削る。' },
    { t: '⑥ リハはLTVで考える', b: 'リハ1回の単価より「完遂までに何回通うか」。中断率を下げることが最大のリハ収益改善。単位/PT/日で稼働を見る。' },
    { t: '⑦ 紹介は資産、広告は費用', b: '病院・ケアマネ・スポーツクラブからの紹介は継続的に流れる。ただし関係は30日で冷め始める — 定期訪問が資産のメンテナンス。' },
    { t: '⑧ CPAはLTVと比べる', b: '広告の良し悪しは「1人獲得にいくらか(CPA)」を「1人が生涯いくら使うか(LTV)」と比べて判断。CPCが高騰したら撤退ラインを決める。' },
    { t: '⑨ 施設基準は経営の土台', b: '運動器リハ(III)=専従1名/(II)=常勤PT2名/(I)=4名+100㎡。要件割れは自主返還・指導のリスク。採用と定着は算定要件そのもの。' },
    { t: '⑩ 分院は専従の壁', b: '施設基準の専従要件は施設ごと。本院のPTを分院に兼務させることはできない。分院展開のボトルネックは資金より採用。' },
    { t: '⑪ 借入は時間を買う道具', b: '金利は「計画の質」で決まる。事業計画なしに銀行は貸さない。返済原資(日次黒字)の目処を先に立てる。' },
    { t: '⑫ 設備投資は回収期間で決める', b: 'MRI¥1,800万は1日3件×¥16,000=¥48,000の増収なら維持費を引いて回収約1.5年。「欲しい」ではなく「何日で返ってくるか」で判断する。' },
    { t: '⑬ KPIは絞って毎日見る', b: '指標を20個並べたダッシュボードは誰も見ない。日次は3〜4個(来院数・新患・単価・実施率など)に絞り、週次で構造(単価分解・継続率)、月次で計画差異を見る。' },
    { t: '⑭ 診療時間は採算で決める', b: '日曜開院は手当1.4倍でも競合が閉まっている分だけ新患が増える。半日診療は人件費6割。1コマごとの採算を見て開けるコマを決める。' },
    { t: '⑮ 自費は価値設計から', b: 'PRPもAGAも「保険でできないこと」への対価。価格は原価ではなく価値と価格弾力性で決める。評判が低いうちは売れない — 保険診療の信頼が自費の土台。' },
    { t: '⑯ 外来管理加算のトレードオフ', b: '再診で処置・注射・リハ・物療を何もしなければ外来管理加算(52点)が付く。注射をすれば加算は消えるが注射料+薬剤が入る — 「何もしない」にも値段が付いている構造を理解して、医学的必要性で選ぶ。' },
    { t: '⑰ 客層(セグメント)から逆算する', b: '高齢者=リハ・骨粗鬆症・定着率◎。勤労者=健診・AGA・土日夜間。スポーツ=外傷・MRI・PRP・単価◎。チャネル(ケアマネ/企業/クラブ/学校)ごとに来る客層は違う — 「誰に来てほしいか」から営業先と広告を選ぶ。' }
  ];

  // KPI定義(選んでピン留めできる)
  const KPIS = [
    { id: 'visits', name: '来院数/日', unit: '人', why: 'すべての起点。曜日でブレるので週平均とセットで見る', calc: (h) => h.patients },
    { id: 'newp', name: '新患数/日', unit: '人', why: '商圏×認知×評判×紹介の総合結果。マーケの通信簿', calc: (h) => h.newCount || 0 },
    { id: 'unit', name: '診療単価', unit: '円', why: '売上=患者数×単価の右側。診療の中身の充実度', calc: (h) => h.patients ? Math.round(h.revenue / h.patients) : 0 },
    { id: 'mix', name: '重点行為 実施率', unit: '%', why: '注射・ブロック等の実施率。単価の源泉(実クリニックで20〜40%程度)', calc: (h) => h.patients ? Math.round((h.injCount + h.trigCount) / h.patients * 100) : 0 },
    { id: 'rehaPerPT', name: 'リハ単位/PT/日', unit: '単位', why: 'PT1人あたり稼働。18単位/日が概ね上限、低ければ枠設計の問題', calc: (h) => h.pts ? Math.round(h.rehaCount * 2 / h.pts * 10) / 10 : 0 },
    { id: 'physio', name: '物療件数/日', unit: '件', why: '高回転・低単価の土台。継続来院の受け皿', calc: (h) => h.physioCount || 0 },
    { id: 'newRate', name: '新患率', unit: '%', why: '高すぎ=再診が定着していない、低すぎ=先細り。10%前後が目安', calc: (h) => h.patients ? Math.round((h.newCount || 0) / h.patients * 100) : 0 },
    { id: 'wait', name: '平均待ち時間', unit: '分', why: '患者体験の代表値。15分を超えたら回転設計を見直す', calc: (h) => Math.round(h.avgWait || 0) },
    { id: 'jihiDay', name: '自費売上/日', unit: '円', why: '価格決定権のある売上。評判との相関を見る', calc: (h) => h.jihi || 0 },
    { id: 'labor', name: '人件費率', unit: '%', why: '目安45〜55%。売上が伸びる前に人を増やすと悪化する', calc: (h) => h.revenue ? Math.round((h.staffCost || 0) / h.revenue * 100) : 0 },
    { id: 'mriN', name: 'MRI件数/日', unit: '件', why: '¥1,800万の投資回収を左右する。1日3件で維持費込み回収約1.5年', calc: (h) => h.mriCount || 0 },
    { id: 'profit', name: '法人損益/日', unit: '円', why: '最後はここ。ただし日次のブレに一喜一憂しないこと', calc: (h) => (h.profit || 0) + (h.brProfit || 0) }
  ];

  /* ================= 状態 ================= */

  const SAVE_KEY = 'clinicTown_v3';

  const settings = {
    floorLv: 1,
    doctors: 1, nurses: 1, pts: 0, receptionists: 1, rehaAides: 0,
    chairs: 6, beds: 1, machines: 0, physio: 0,
    kiosk: false, reserve: false, reviewCare: false, webIntake: false,
    mri: false, dexa: false,
    rehaLevel: 0,
    examMean: 6, pTreat: 0.15, pReha: 0.35, pInj: 0.2, pTrig: 0.12, pPhysio: 0.35,
    selfReha: false, selfRehaPrice: 8000, goods: false,
    prpOn: false, prpPrice: 55000, agaOn: false, agaPrice: 6000,
    schedule: ['full', 'full', 'full', 'am', 'full', 'am', 'closed'] // 月〜日
  };

  const G = {
    money: 2000000, rep: 55, aw: 0.30,
    day: 1, t: 0, speed: 1,
    billboard: false,
    relations: {}, // key -> {lv, last}
    loans: [],
    ads: { area: 0, pain: 0, sports: 0 },
    adPressure: 0, adReport: null, adSpendToday: 0,
    osteoPool: 0, agaPool: 0,
    kpiPins: ['visits', 'newp', 'unit', 'mix'],
    targetSeg: 'balance',
    cum: { revenue: 0, profit: 0 }, annualDone: false,
    voiceLog: [], voiceFeed: [],
    schedule: {}, arrivals: [], nextArrivalIdx: 0,
    today: null, history: [],
    branches: [],
    missionIdx: 0, missionDone: [],
    tutorialDone: false, plan: null,
    lastStage: 1, blackStreak: 0
  };
  Object.keys(REL_DEF).forEach((k) => { G.relations[k] = { lv: 0, last: 0 }; });

  function weekdayOf(day) { return (day - 1) % 7; }
  function specOf(day) {
    const kind = settings.schedule[weekdayOf(day)] || 'full';
    return Object.assign({ kind }, DAY_SPECS[kind]);
  }
  function openDaysCount() { return settings.schedule.filter((k) => k !== 'closed').length; }

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
    return {
      revenue: 0, cost: 0, profit: 0, patients: 0, waitSum: 0, waitN: 0,
      rehaCount: 0, goodsCogs: 0, jihiCogs: 0,
      newCount: 0, injCount: 0, trigCount: 0, physioCount: 0, xrayCount: 0, mriCount: 0, prpCount: 0, osteoVisits: 0, treatCount: 0, kanriCount: 0,
      segCounts: { senior: 0, worker: 0, sports: 0 },
      rev: { consult: 0, inj: 0, treat: 0, physio: 0, img: 0, reha: 0, osteo: 0, checkup: 0, jihi: 0 },
      brRevenue: 0, brProfit: 0
    };
  }

  /* ================= セーブ/ロード ================= */

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        settings, g: {
          money: G.money, rep: G.rep, aw: G.aw, day: G.day,
          billboard: G.billboard, relations: G.relations,
          loans: G.loans, ads: G.ads, adPressure: G.adPressure,
          osteoPool: G.osteoPool, agaPool: G.agaPool, kpiPins: G.kpiPins,
          targetSeg: G.targetSeg, cum: G.cum, annualDone: G.annualDone, voiceLog: G.voiceLog,
          schedule: G.schedule, history: G.history.slice(-40),
          branches: G.branches, missionIdx: G.missionIdx, missionDone: G.missionDone,
          tutorialDone: G.tutorialDone, plan: G.plan,
          lastStage: G.lastStage, blackStreak: G.blackStreak
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
      Object.keys(REL_DEF).forEach((k) => { if (!G.relations[k]) G.relations[k] = { lv: 0, last: 0 }; });
      if (!G.cum) G.cum = { revenue: 0, profit: 0 };
      if (d.g.blackStreak === undefined) G.blackStreak = 0;
      // 旧セーブは進行度から解放段階を復元(演出なしで全解放)
      if (d.g.lastStage === undefined) G.lastStage = G.day >= 8 ? 3 : G.day >= 4 ? 2 : 1;
      // 旧ミッションIDのセーブは、達成数を新カリキュラムに引き継ぐ
      if (G.missionDone.length && !G.missionDone.some((id) => MISSIONS.some((m) => m.id === id))) {
        G.missionIdx = Math.min(G.missionDone.length, MISSIONS.length);
      }
      // 旧セーブの分院にv4フィールドを補完
      for (const br of G.branches) {
        if (br.floorLv === undefined) br.floorLv = 1;
        if (br.physio === undefined) br.physio = 0;
        if (br.pInj === undefined) br.pInj = 0.2;
        if (br.pReha === undefined) br.pReha = 0.35;
        if (br.mri === undefined) br.mri = false;
      }
      return true;
    } catch (e) { return false; }
  }

  function hardReset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ }
    location.reload();
  }

  /* ================= シム構築 ================= */

  const clinicIso = new Iso($('clinicStage'), 20, 14, { maxTileW: 58 });
  const townIso = new Iso($('townStage'), TOWN.W, TOWN.H, { maxTileW: 46, topPad: 1.6 });

  const clinic = new CLINIC.ClinicSim(settings, {
    onRelayout(L) {
      clinicIso.W = L.W; clinicIso.H = L.H;
      clinicIso.resize();
    },
    onDischarge(p, report) {
      let revenue = 0;
      const T = G.today;
      const seg = report.seg || 'senior';
      T.segCounts[seg] = (T.segCounts[seg] || 0) + 1;
      let didProcedure = false; // 処置・注射・リハ・物療のいずれかを実施したか(外来管理加算の判定)

      if (report.type === 'first') { revenue += FEES.first; T.rev.consult += FEES.first; T.newCount++; }
      if (report.type === 'revisit' || report.type === 'rehab') { revenue += FEES.revisit; T.rev.consult += FEES.revisit; }
      if (report.type === 'checkup') { revenue += FEES.checkup; T.rev.checkup += FEES.checkup; }

      for (const it of report.items) {
        if (it === 'treat') { revenue += FEES.treat; T.rev.treat += FEES.treat; T.treatCount++; didProcedure = true; }
        if (it === 'inj') { revenue += FEES.inj; T.rev.inj += FEES.inj; T.injCount++; didProcedure = true; }
        if (it === 'trig') { revenue += FEES.trig; T.rev.inj += FEES.trig; T.trigCount++; didProcedure = true; }
        if (it === 'reha') {
          const f = REHA_FEE[settings.rehaLevel];
          revenue += f; T.rev.reha += f; T.rehaCount++; didProcedure = true;
        }
      }

      // 物療(消炎鎮痛等処置): 機器があれば高回転で回る(故障イベント時は停止)
      if (settings.physio > 0 && !G.evPhysioDown && report.type !== 'checkup' && T.physioCount < settings.physio * 35 && Math.random() < settings.pPhysio) {
        revenue += FEES.physio; T.rev.physio += FEES.physio; T.physioCount++; didProcedure = true;
      }

      // 外来管理加算: 再診で処置・注射・リハ・物療を「何もしなかった」場合のみ算定
      if ((report.type === 'revisit' || report.type === 'rehab') && !didProcedure) {
        revenue += FEES.kanri; T.rev.consult += FEES.kanri; T.kanriCount++;
      }
      // 処方箋料(処方が出る患者)
      if ((report.type === 'first' || report.type === 'revisit') && Math.random() < 0.55) {
        revenue += FEES.presc; T.rev.consult += FEES.presc;
      } else if (report.type === 'rehab' && Math.random() < 0.15) {
        revenue += FEES.presc; T.rev.consult += FEES.presc;
      }

      // 画像(X線は初診中心、MRIは装置があれば。スポーツ層は精査率が高い)
      if (report.type === 'first' && Math.random() < 0.7) { revenue += FEES.xray; T.rev.img += FEES.xray; T.xrayCount++; }
      else if (report.type === 'revisit' && Math.random() < 0.08) { revenue += FEES.xray; T.rev.img += FEES.xray; T.xrayCount++; }
      const mriMul = seg === 'sports' ? 1.6 : seg === 'worker' ? 1.1 : 0.85;
      if (settings.mri && T.mriCount < 8 && (report.type === 'first' || p.refer) && Math.random() < 0.3 * mriMul) {
        revenue += FEES.mri; T.rev.img += FEES.mri; T.mriCount++;
      }
      // 骨粗鬆症プログラム(DEXA): 高齢初診の一部が継続診療に乗る
      if (settings.dexa && report.type === 'first' && Math.random() < (seg === 'senior' ? 0.25 : 0.05)) G.osteoPool++;

      let sat = clamp(1.25 - report.wait / 40, 0, 1);
      if (report.didReha) sat = Math.min(1, sat + 0.1);

      // 自費リハ延長(価格弾力性)
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
      const loyalty = { senior: 0.55, worker: 0.32, sports: 0.42 }[seg] || 0.45; // 客層で再診定着が違う
      if ((report.type === 'first' || report.type === 'revisit') && !report.didReha && Math.random() < loyalty * sat + showBoost) {
        addSchedule(G.day + 2 + Math.floor(Math.random() * 6), 'revisit');
      }
      if (report.didReha && report.type !== 'rehab') {
        for (let k = 1; k <= 8; k++) addSchedule(G.day + Math.ceil(k * 2.5), 'rehab');
      }
      if (report.type === 'rehab' && !report.didReha) addSchedule(G.day + 1, 'rehab'); // 満枠振替
      else if (report.type === 'rehab' && Math.random() < 0.12 * (1 - sat)) removeSchedule('rehab');
      updateHeader();
      return revenue;
    }
  });
  clinicIso.W = clinic.L.W; clinicIso.H = clinic.L.H;

  const town = new TOWN.TownSim({
    onPatientArrive(wk) { clinic.spawn(wk.type, { refer: wk.refer, seg: wk.seg }); }
  });

  /* ================= 1日の計画 ================= */

  function addSchedule(day, kind) {
    if (!G.schedule[day]) G.schedule[day] = { revisit: 0, rehab: 0 };
    G.schedule[day][kind]++;
  }
  function addScheduleBulk(day, due) {
    if (!G.schedule[day]) G.schedule[day] = { revisit: 0, rehab: 0 };
    G.schedule[day].revisit += due.revisit;
    G.schedule[day].rehab += due.rehab;
  }
  function removeSchedule(kind) {
    const days = Object.keys(G.schedule).map(Number).sort((a, b) => a - b);
    for (const d of days) {
      if (d > G.day && G.schedule[d][kind] > 0) { G.schedule[d][kind]--; return; }
    }
  }

  function wait7() {
    const h = G.history.slice(-7).filter((x) => x.kind !== 'closed');
    const n = h.reduce((a, d) => a + (d.patients || 0), 0);
    return n ? h.reduce((a, d) => a + d.avgWait * d.patients, 0) / n : 10;
  }

  function relLv(key) { return G.relations[key] ? G.relations[key].lv : 0; }

  function planDay() {
    const spec = specOf(G.day);
    G.daySpec = spec;
    G.today = newToday();
    G.adSpendToday = 0;
    G.repDayStart = G.rep;

    // 現場イベント(当日限りの効果をリセット→低確率で発生)
    G.evArrivalMul = 1; G.evExamDelta = 0; G.evRecepSlow = false; G.evPhysioDown = false; G.evExtraRefer = 0;
    settings.evExamDelta = 0; settings.evRecepSlow = false;
    // 前日の振り返りコメントは残し、古い報告だけ流す
    G.voiceFeed = (G.voiceFeed || []).filter((v) => v.kind === 'daily').slice(-1);
    if (spec.kind !== 'closed' && G.day > 3 && typeof STAFF_UI !== 'undefined') {
      const pool = STAFF_UI.STAFF_EVENTS.filter((ev) => (!ev.cond || ev.cond(G, settings)) && Math.random() < ev.p);
      if (pool.length) {
        const ev = pool[Math.floor(Math.random() * pool.length)];
        ev.apply(G, settings);
        settings.evExamDelta = G.evExamDelta || 0;
        settings.evRecepSlow = !!G.evRecepSlow;
        pushVoice(ev.char, ev.text, 'event');
        banner(`💬 ${STAFF_UI.STAFF[ev.char].name}「${ev.text}」`);
      }
    }

    if (spec.kind === 'closed') {
      const due = G.schedule[G.day];
      if (due) {
        addScheduleBulk(G.day + 1, due);
        delete G.schedule[G.day];
      }
      G.arrivals = [];
      G.nextArrivalIdx = 0;
      return;
    }

    // 客層ミックス(ターゲット方針で商圏の獲得層が寄る)
    const baseMix = { senior: 0.55, worker: 0.33, sports: 0.12 };
    if (G.targetSeg !== 'balance') {
      baseMix[G.targetSeg] += 0.22;
      const tot = baseMix.senior + baseMix.worker + baseMix.sports;
      Object.keys(baseMix).forEach((k) => { baseMix[k] /= tot; });
    }
    const pickMix = (mix) => {
      const r = Math.random();
      return r < mix.senior ? 'senior' : r < mix.senior + mix.worker ? 'worker' : 'sports';
    };

    const arrivals = [];
    const push = (type, source, refer, seg) => arrivals.push({ t: 0, type, source, refer: !!refer, seg: seg || pickMix(baseMix) });
    const sundayBoost = weekdayOf(G.day) === 6 ? 1.3 : 1; // 日曜開院は競合が休み

    // 自然新患(雨・流行イベントで増減)
    const share = G.rep / (G.rep + RIVAL_REP);
    const nNew = Math.max(0, Math.round(52 * G.aw * share * spec.arr * sundayBoost * (G.evArrivalMul || 1) + (Math.random() * 4 - 2)));
    for (let i = 0; i < nNew; i++) push('first', 'house');

    // リスティング広告
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
      const adSeg = kw.id === 'sports' ? 'sports' : kw.id === 'pain' ? (Math.random() < 0.55 ? 'worker' : 'senior') : null;
      for (let i = 0; i < pats; i++) push('first', kw.source, !!kw.reha, adSeg);
    }
    G.adReport = report;

    if (G.billboard) for (let i = 0; i < 1 + Math.round(Math.random()); i++) push('first', 'station', false, Math.random() < 0.6 ? 'worker' : 'senior');

    // 営業関係からの紹介(関係レベル依存・チャネルごとに客層が違う)
    for (let i = 0; i < (G.evExtraRefer || 0); i++) push('first', 'hospital', true, 'senior');
    for (let i = 0; i < relLv('hospital'); i++) push('first', 'hospital', true, Math.random() < 0.7 ? 'senior' : 'worker');
    if (settings.rehaLevel > 0) {
      for (let i = 0; i < frac(relLv('caremane') * 0.7); i++) push('first', 'caremane', true, 'senior');
      for (let i = 0; i < frac(relLv('rouken') * 0.7); i++) push('first', 'caremane', true, 'senior');
    }
    for (let i = 0; i < frac(relLv('company') * 1.5); i++) push('checkup', 'station', false, 'worker');
    for (let i = 0; i < frac(relLv('sports') * 0.6); i++) push('first', 'station', true, 'sports');
    for (let i = 0; i < frac(relLv('school') * 0.5); i++) push('first', 'station', false, 'sports');

    // 再診・リハ(予約済み)
    const due = G.schedule[G.day] || { revisit: 0, rehab: 0 };
    const showRate = (0.75 + 0.2 * (G.rep / 100) + (settings.reserve ? 0.05 : 0)) * Math.min(1.1, G.evArrivalMul || 1);
    for (let i = 0; i < due.revisit; i++) if (Math.random() < showRate) push('revisit', 'house');
    for (let i = 0; i < due.rehab; i++) if (Math.random() < showRate) push('rehab', 'house');
    delete G.schedule[G.day];

    arrivals.forEach((a) => {
      a.t = settings.reserve ? 10 + Math.random() * (spec.intake - 30)
        : (Math.random() < 0.62 ? triRand(0, spec.intake * 0.5) : triRand(spec.intake * 0.5, spec.intake));
    });
    arrivals.sort((a, b) => a.t - b.t);
    G.arrivals = arrivals;
    G.nextArrivalIdx = 0;
  }

  /* ================= 分院(マクロ経営) ================= */

  function branchStaffCost(st) {
    return st.doctors * COSTS.doctorDay + st.nurses * COSTS.nurseDay + st.pts * COSTS.ptDay + st.receptionists * COSTS.recepDay;
  }

  // マップ上の3拠点以降は「郊外N号院」(マップ外・無制限)
  function siteOf(br) {
    return SITES.find((s) => s.id === br.siteId) || { id: br.siteId, name: br.name, rivalRep: 64, bigger: 1.05, rehaBias: 1.1 };
  }

  function branchKijunCheck(br) {
    const ok3 = br.staff.pts >= 4 && (br.floorLv || 1) >= 2;
    if (br.rehaLevel === 3 && !ok3) { br.rehaLevel = br.staff.pts >= 2 ? 2 : br.staff.pts >= 1 ? 1 : 0; return true; }
    if (br.rehaLevel === 2 && br.staff.pts < 2) { br.rehaLevel = br.staff.pts >= 1 ? 1 : 0; return true; }
    if (br.rehaLevel === 1 && br.staff.pts < 1) { br.rehaLevel = 0; return true; }
    return false;
  }

  function branchRent(br) { return (br.floorLv || 1) >= 2 ? 50000 : COSTS.branchRent; }

  function branchDay(br, spec) {
    const site = siteOf(br);
    if (branchKijunCheck(br)) toast(`⚠️ ${br.name}: 施設基準の要件割れで降格しました(専従PT・面積)`);
    if (spec.kind === 'closed') {
      const cost = branchRent(br) + COSTS.branchBase + (br.mri ? COSTS.mriMaint : 0);
      br.last = { revenue: 0, cost, profit: -cost, visits: 0, reha: 0 };
      br.profit7.push(-cost);
      if (br.profit7.length > 7) br.profit7.shift();
      return { revenue: 0, cost, profit: -cost };
    }
    const f = spec.arr;
    const examCap = br.staff.doctors * 48 * f;
    const share = br.rep / (br.rep + site.rivalRep);
    const nNewRaw = 42 * site.bigger * br.aw * share * f * (0.85 + Math.random() * 0.3);
    const revisRaw = br.revisitPool * f * (0.8 + Math.random() * 0.3);
    const visitsExam = Math.min(nNewRaw + revisRaw, examCap);
    const scale = (nNewRaw + revisRaw) > 0 ? visitsExam / (nNewRaw + revisRaw) : 0;
    const nNew = nNewRaw * scale, revis = revisRaw * scale;
    // リハ: 機器×PT稼働と、PT単位上限(1人24単位=12回)の両方でキャップ
    const rehaCap = Math.min(Math.min(br.machines, br.staff.pts * 2) * 26, br.staff.pts * 12) * f;
    const rehaVisits = Math.min(br.rehabPool, rehaCap);
    const rehaFee = REHA_FEE[br.rehaLevel];
    const starts = br.rehaLevel > 0 ? Math.min(visitsExam * (br.pReha || 0.35) * site.rehaBias, Math.max(0, rehaCap - rehaVisits)) : 0;
    // 分院ごとの診療方針(注射・物療)
    const injRev = visitsExam * (br.pInj || 0.2) * 2000;
    const physioN = Math.min(visitsExam * 0.45, (br.physio || 0) * 30 * f);
    const treats = visitsExam * 0.12 * Math.min(1, br.staff.nurses);
    const mriN = br.mri ? Math.min(nNew * 0.3, 6 * f) : 0;
    const load = visitsExam / Math.max(1, examCap);
    const sat = clamp(1.2 - load * 0.55, 0.35, 1);

    const revenue = Math.round(
      nNew * (FEES.first + FEES.xray * 0.6) + revis * 1500 +
      rehaVisits * (FEES.rehab + rehaFee) + treats * FEES.treat + injRev +
      physioN * FEES.physio + mriN * FEES.mri
    );
    const visits = Math.round(visitsExam + rehaVisits);
    const cost = Math.round(branchStaffCost(br.staff) * spec.pay + branchRent(br) + COSTS.branchBase + (br.mri ? COSTS.mriMaint : 0) + visits * COSTS.perPatient);
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
    return (settings.doctors - 1) * COSTS.doctorDay + settings.nurses * COSTS.nurseDay + settings.pts * COSTS.ptDay + settings.receptionists * COSTS.recepDay + (settings.rehaAides || 0) * 10000;
  }

  function loanInterestDay() {
    return G.loans.reduce((a, l) => a + l.principal * l.dailyRate, 0);
  }

  function dayCost() {
    const spec = G.daySpec || specOf(G.day);
    let c = COSTS.rent[settings.floorLv] + COSTS.base[settings.floorLv];
    c += mainStaffCost() * spec.pay * (weekdayOf(G.day) === 6 && spec.kind !== 'closed' ? 1.4 : 1);
    c += G.adSpendToday;
    if (G.billboard) c += COSTS.billboardDay;
    if (settings.mri) c += COSTS.mriMaint;
    c += loanInterestDay();
    c += (G.today ? G.today.patients : 0) * COSTS.perPatient;
    c += G.today ? G.today.goodsCogs + G.today.jihiCogs : 0;
    return Math.round(c);
  }

  // プール型・自由診療の収益(1日の締めで計上)
  function accrueDailyPrograms() {
    const T = G.today;
    const spec = G.daySpec;
    if (spec.kind === 'closed') return;
    if (settings.dexa && G.osteoPool > 0) {
      const visits = frac(G.osteoPool / 25 * spec.arr);
      T.osteoVisits = visits;
      T.revenue += visits * FEES.osteo;
      T.rev.osteo += visits * FEES.osteo;
      G.osteoPool = Math.max(0, G.osteoPool * 0.998);
    }
    if (settings.prpOn) {
      const demand = clamp((G.rep - 58) / 12, 0, 2.2) * clamp(1.55 - settings.prpPrice / 100000, 0.15, 1.3) * (1 + 0.25 * relLv('sports')) * spec.arr;
      const cases = frac(demand * (0.7 + Math.random() * 0.6));
      if (cases > 0) {
        T.prpCount = cases;
        T.revenue += cases * settings.prpPrice;
        T.rev.jihi += cases * settings.prpPrice;
        T.jihiCogs += cases * FEES.prpCogs;
      }
    }
    if (settings.agaOn) {
      const joins = frac(0.5 * clamp(G.aw * 1.5, 0.3, 1.2) * clamp(1.6 - settings.agaPrice / 12000, 0.2, 1.3) * spec.arr);
      G.agaPool = Math.max(0, G.agaPool + joins - frac(G.agaPool * 0.015));
      const rev = Math.round(G.agaPool * settings.agaPrice / 25 * spec.arr);
      T.revenue += rev;
      T.rev.jihi += rev;
      T.jihiCogs += Math.round(rev * 0.35);
    }
  }

  function endDay() {
    const T = G.today;
    const spec = G.daySpec || specOf(G.day);
    const endedDay = G.day;
    const repStart = G.repDayStart !== undefined ? G.repDayStart : G.rep;
    const prevOpen = G.history.filter((h) => h.kind !== 'closed').slice(-1)[0] || null;
    accrueDailyPrograms();
    T.cost = dayCost();
    T.profit = T.revenue - T.cost;
    T.avgWait = T.waitN ? T.waitSum / T.waitN : 0;

    for (const br of G.branches) {
      const r = branchDay(br, spec);
      T.brRevenue += r.revenue;
      T.brProfit += r.profit;
    }

    G.money += T.profit + T.brProfit;
    G.cum.revenue += T.revenue + T.brRevenue;
    G.cum.profit += T.profit + T.brProfit;
    G.history.push({
      day: G.day, wd: weekdayOf(G.day), kind: spec.kind,
      revenue: T.revenue, cost: T.cost, profit: T.profit,
      patients: T.patients, avgWait: T.avgWait, rehaCount: T.rehaCount,
      newCount: T.newCount, injCount: T.injCount, trigCount: T.trigCount,
      physioCount: T.physioCount, mriCount: T.mriCount, kanriCount: T.kanriCount,
      segS: T.segCounts.senior, segW: T.segCounts.worker, segP: T.segCounts.sports,
      jihi: T.rev.jihi, staffCost: Math.round(mainStaffCost() * spec.pay), pts: settings.pts,
      brRevenue: T.brRevenue, brProfit: T.brProfit
    });

    if (spec.kind !== 'closed') {
      let dAw = G.adSpendToday / 10000 * 0.0015 - 0.005;
      if (G.billboard) dAw += 0.008;
      if (G.rep >= 70) dAw += 0.006; else if (G.rep >= 60) dAw += 0.003;
      if (settings.reviewCare) dAw += 0.003;
      dAw += 0.001 * relLv('shoutengai');
      G.aw = clamp(G.aw + dAw, 0.05, 0.95);
      if (settings.reviewCare) G.rep = Math.min(100, G.rep + 0.15);
      const totalAds = Object.values(G.ads).reduce((a, b) => a + b, 0);
      G.adPressure = totalAds > 12000 ? Math.min(0.6, G.adPressure + 0.04) : Math.max(0, G.adPressure - 0.03);
    }

    // 営業関係の減衰(30日放置で1レベル冷める)
    const cooled = [];
    for (const [k, r] of Object.entries(G.relations)) {
      if (r.lv > 0 && G.day - r.last > 30) { r.lv--; r.last = G.day; cooled.push(REL_DEF[k].name); }
    }
    if (cooled.length) toast(`🥶 足が遠のいて関係が冷えました: ${cooled.join('・')}(定期訪問を!)`);

    // 施設基準チェック
    const cur = KIJUN.find((k) => k.lv === settings.rehaLevel);
    if (cur && !cur.ok(settings.pts, settings.floorLv)) {
      const next = [...KIJUN].reverse().find((k) => k.lv < settings.rehaLevel && k.ok(settings.pts, settings.floorLv));
      settings.rehaLevel = next ? next.lv : 0;
      toast(`⚠️ 施設基準の要件割れ! ${REHA_NAMES[settings.rehaLevel]}に降格しました`);
    }

    G.rep = clamp(G.rep, 15, 97);
    if (spec.kind !== 'closed') G.blackStreak = (T.profit + T.brProfit) > 0 ? (G.blackStreak || 0) + 1 : 0;
    dailyVoice();
    checkMission(T);

    if (G.day % 7 === 0 && G.history.length >= 8 && spec.kind !== 'closed') weeklyDigest();
    if (G.plan && G.day % 30 === 0) reviewPlan();

    if (G.money < -300000) {
      G.money += 1000000;
      G.loans.push({ principal: 1000000, dailyRate: 0.001, label: '緊急融資(高金利)' });
      showModal('🏦 緊急融資', `<p>資金がショートしました。銀行から <b>¥1,000,000</b> の緊急融資(日利0.1%)を受けました。</p><p class="modal-note">📖 追い込まれてからの借入は高くつく。事業計画があれば通常融資(低金利)を計画的に使えます。</p>`, '経営を続ける');
    }

    const corpProfit = T.profit + T.brProfit;
    const wdName = WEEKDAYS[weekdayOf(G.day)];
    banner(spec.kind === 'closed'
      ? `Day ${G.day}(${wdName}) — 🌙 休診日(固定費 ${yen(Math.abs(corpProfit))})`
      : `Day ${G.day}(${wdName}) 終了 — 本院 ${yen(T.revenue)}${G.branches.length ? ` / 分院 ${yen(T.brRevenue)}` : ''} / 法人損益 <b class="${corpProfit >= 0 ? 'pos' : 'neg'}">${corpProfit >= 0 ? '+' : ''}${yen(corpProfit)}</b>`);

    G.day++;
    G.t = 0;
    clinic.rehaToday = 0;
    if (G.day === 366 && !G.annualDone) {
      G.annualDone = true;
      const title = G.cum.revenue >= 250000000 ? '👑 地域医療の帝王(殿堂入り)'
        : G.cum.revenue >= 150000000 ? '🏆 名経営者'
        : G.cum.revenue >= 80000000 ? '🛡️ 堅実経営者' : '🎗️ 一年を生き抜いた経営者';
      showModal('🎊 Day 365 到達 — 年次決算', `
        <div class="pnl-row"><span>年商(法人・365日)</span><b>${yen(G.cum.revenue)}</b></div>
        <div class="pnl-row"><span>年間損益</span><b>${G.cum.profit >= 0 ? '+' : ''}${yen(G.cum.profit)}</b></div>
        <div class="pnl-row"><span>拠点数</span><b>${1 + G.branches.length}</b></div>
        <div class="pnl-row"><span>法人スタッフ</span><b>医師${corpStaff().doctors}・PT${corpStaff().pts}ほか</b></div>
        <div class="lesson-box"><b>称号: ${title}</b><p>1年間の意思決定、おつかれさまでした。2年目はさらなる高みへ — 経営は続く。</p></div>`, '2年目へ');
    }
    planDay();

    // 段階解放(Day4・Day8)— 新しい打ち手のお披露目
    const stg = unlockStage();
    if (stg > (G.lastStage || 1)) {
      G.lastStage = stg;
      applyUnlocks();
      renderShop();
      announceStage(stg);
    } else if (spec.kind !== 'closed' && G.speed <= 2 && tutIdx < 0 && !$('modal').classList.contains('show')) {
      // 1日の結果画面(ミッション達成・週次サマリーの演出があるときは譲る)
      showResult(T, spec, prevOpen, endedDay, Math.round(G.rep - repStart));
    }

    save();
    renderPnl(); renderPlanner(); renderCorp(); renderAds(); renderKpiStrip(); renderStaffStrip(); renderTodo();
    updateHeader();
  }

  /* ================= 現場スタッフ(キャラクター) ================= */

  function pushVoice(charKey, text, kind) {
    G.voiceFeed = (G.voiceFeed || []).slice(-1);
    G.voiceFeed.push({ char: charKey, text, kind });
    renderVoice();
  }

  function staffCtx() {
    const opens = G.history.filter((h) => h.kind !== 'closed');
    const h = opens[opens.length - 1] || null;
    const examCapDay = Math.max(10, settings.doctors * (480 / (settings.examMean + 1.5)) * 0.72);
    return {
      h, s: settings, G,
      wait: h ? h.avgWait : 0,
      load: h ? h.patients / examCapDay : 0,
      standing: clinic.standingCount(),
      rehaUtil: h && clinic.rehaCap() > 0 ? h.rehaCount / clinic.rehaCap() : 0,
      labor: h && h.revenue > 0 ? (h.staffCost || 0) / h.revenue : 0,
      profit: h ? h.profit + (h.brProfit || 0) : 0
    };
  }

  function renderStaffStrip() {
    const el = $('staffStrip');
    if (!el || typeof STAFF_UI === 'undefined') return;
    const c = staffCtx();
    el.innerHTML = Object.entries(STAFF_UI.STAFF).map(([k, st]) => {
      const mood = st.mood(c);
      return `<span class="staff-chip mood-${mood}" title="${st.title} ${st.name}">${STAFF_UI.faceSVG(k, mood, 34)}<span class="staff-meta"><small>${st.title}</small><b>${st.name}・${STAFF_UI.MOOD_LABEL[mood]}</b></span></span>`;
    }).join('');
  }

  function dailyVoice() {
    if (typeof STAFF_UI === 'undefined') return;
    const c = staffCtx();
    if (!c.h || c.h.patients === 0) return;
    if (!G.voiceLog) G.voiceLog = [];
    const recent = new Set(G.voiceLog.filter((v) => v.day > G.day - 5).map((v) => v.id));
    let best = null;
    for (const [k, st] of Object.entries(STAFF_UI.STAFF)) {
      for (const cm of st.comments) {
        if (recent.has(cm.id)) continue;
        let ok = false;
        try { ok = cm.cond(c); } catch (e) { ok = false; }
        if (!ok) continue;
        if (!best || cm.prio > best.cm.prio) best = { k, cm };
      }
    }
    if (best) {
      G.voiceLog.push({ id: best.cm.id, day: G.day });
      if (G.voiceLog.length > 30) G.voiceLog.shift();
      pushVoice(best.k, best.cm.text(c), 'daily');
    }
  }

  function renderVoice() {
    const card = $('voiceCard');
    if (!card || typeof STAFF_UI === 'undefined') return;
    const feed = G.voiceFeed || [];
    card.hidden = feed.length === 0;
    const c = staffCtx();
    $('voiceBody').innerHTML = feed.map((v) => {
      const st = STAFF_UI.STAFF[v.char];
      const mood = v.kind === 'event' ? 'idea' : st.mood(c);
      return `<div class="voice-row">${STAFF_UI.faceSVG(v.char, mood, 44)}<div class="voice-txt"><small>${st.title} ${st.name}${v.kind === 'event' ? ' — 現場から報告' : ' — 今日の振り返り'}</small><p>${v.text}</p></div></div>`;
    }).join('');
  }

  /* ================= 段階解放(Day1-3 / 4-7 / 8+) ================= */

  function unlockStage() { return G.day >= 8 ? 3 : G.day >= 4 ? 2 : 1; }
  const STAGE_SHOP = { recep: 1, chairs: 1, doctor: 2, nurse: 2, beds: 2, physio: 2, pt: 3, machines: 3, rehaAide: 3 };

  function applyUnlocks() {
    const stage = unlockStage();
    const vis = (id, need) => { const el = $(id); if (el) el.style.display = stage >= need ? '' : 'none'; };
    const corpBtn = document.querySelector('.tab-btn[data-tab="corp"]');
    if (corpBtn) corpBtn.style.display = stage >= 3 ? '' : 'none';
    vis('jihiCard', 3);
    vis('salesCard', 2);
    vis('adTarget', 2);
    ['kpiCard', 'plannerCard', 'bankCard', 'pnlCard', 'kijunCard'].forEach((id) => vis(id, 3));
    const lock = $('mgmtLock');
    if (lock) lock.hidden = stage >= 3;
    ['opWeb', 'opKiosk', 'opReview'].forEach((id) => vis(id, 2));
    const slider = (id, need) => {
      const el = $(id);
      if (el) { const w = el.closest('.ctrl'); if (w) w.style.display = stage >= need ? '' : 'none'; }
    };
    slider('pInj', 2); slider('pTrig', 2); slider('pPhysio', 2); slider('pTreat', 2); slider('pReha', 3);
  }

  function announceStage(stage) {
    const body = stage === 2
      ? `<p>Day 4 — 現場が回り始めたので、打ち手が増えます。</p>
         <ul class="unlock-list">
           <li>🧑‍⚕️ <b>採用</b>(医師・看護師)とベッド・物療機器</li>
           <li>💉 <b>診療方針</b>(注射・物療・処置)— 単価はここで作る</li>
           <li>📱 <b>Web問診・自動精算機・クチコミ返信</b> — 受付の詰まり対策</li>
           <li>🤝 <b>営業まわり・ターゲット客層</b>(タウン)</li>
         </ul>
         <p class="modal-note">📖 打ち手は「詰まっている所」に打つのが原則。院内タブの「今日やること」が案内します。</p>`
      : `<p>Day 8 — ここからが経営の本番です。</p>
         <ul class="unlock-list">
           <li>🏃 <b>運動器リハ</b>(PT採用・リハ機器・施設基準の届出)</li>
           <li>📊 <b>P&L・KPIピン留め・事業計画・銀行融資</b>(経営タブ)</li>
           <li>🏢 <b>分院展開</b>(法人タブ)</li>
           <li>💎 <b>自費メニュー</b>(PRP・AGAほか)と<b>大型投資</b>(MRI・DEXA・増築)</li>
         </ul>
         <p class="modal-note">📖 リハは整形外来の柱。施設基準(専従PT数×面積)で1回の単価が¥1,700→¥3,700まで変わります。</p>`;
    if ($('modal').classList.contains('show')) {
      banner('🔓 新しい打ち手が解放されました! 院内・経営タブをチェック');
      return;
    }
    showModal('🔓 打ち手が解放されました', body, 'やってみる');
  }

  /* ================= ボトルネック診断と改善候補 ================= */

  function bottleneckInfo() {
    const stage = unlockStage();
    const opens = G.history.filter((h) => h.kind !== 'closed');
    const h = opens[opens.length - 1];
    const F = (label, tab, sel) => ({ label, tab, sel });
    if (!h || !h.patients) {
      return { text: 'まだ実績がありません。まず1日診療してみましょう(⏸〜×2の速度がおすすめ)', fixes: [] };
    }
    const examCapDay = Math.max(10, settings.doctors * (480 / (settings.examMean + 1.5)) * 0.72);
    const load = h.patients / examCapDay;
    const rehaUtil = clinic.rehaCap() > 0 ? h.rehaCount / clinic.rehaCap() : 0;
    if (load >= 0.88) {
      return {
        text: `診察が詰まっています(医師キャパの${Math.round(load * 100)}%稼働)。待ち時間の主因はここ`,
        fixes: [
          stage >= 2 ? F('医師を採用する', 'clinic', '#shopCard') : null,
          F('診察時間を短くする', 'clinic', '#policyCard'),
          F('予約制で来院を平準化', 'clinic', '#shopCard')
        ].filter(Boolean)
      };
    }
    if (h.avgWait >= 30 && !settings.webIntake) {
      return {
        text: `受付が詰まっています(平均待ち${Math.round(h.avgWait)}分)。人を増やす前に、受付の仕事を軽くするのが先`,
        fixes: [
          stage >= 2 ? F('Web問診を導入する', 'clinic', '#shopCard') : null,
          F('受付を増員する', 'clinic', '#shopCard'),
          stage >= 2 ? F('自動精算機を置く', 'clinic', '#shopCard') : null
        ].filter(Boolean)
      };
    }
    if (settings.rehaLevel > 0 && rehaUtil >= 0.92) {
      return {
        text: `リハ枠が満杯です(稼働${Math.round(rehaUtil * 100)}%)。予約が取れず、リハ患者が離れ始めます`,
        fixes: [F('PTを採用する', 'clinic', '#shopCard'), F('リハ助手を配置する', 'clinic', '#shopCard'), F('リハ機器を増設する', 'clinic', '#shopCard')]
      };
    }
    if (stage >= 2 && settings.physio === 0) {
      return {
        text: '物療(消炎鎮痛)が未導入です。再診の受け皿と単価の土台がまだ抜けています',
        fixes: [F('物療機器を導入する', 'clinic', '#shopCard'), F('物療の案内方針を上げる', 'clinic', '#policyCard')]
      };
    }
    if (h.profit + (h.brProfit || 0) < 0) {
      return {
        text: `昨日は赤字でした(${yen(h.profit + (h.brProfit || 0))})。患者数と単価、どちらが足りないかを切り分けます`,
        fixes: [
          F('診療方針(単価)を見直す', 'clinic', '#policyCard'),
          F('広告で新患を増やす', 'town', '#marketingCard'),
          stage >= 3 ? F('P&Lで内訳を確認', 'mgmt', '#pnlCard') : null
        ].filter(Boolean)
      };
    }
    if ((h.newCount || 0) <= 3 && G.aw < 0.5) {
      return {
        text: `新患が少なめです(昨日${h.newCount || 0}人・認知${Math.round(G.aw * 100)}%)。まず「知られる」ことから`,
        fixes: [
          F('キーワード広告を出す', 'town', '#marketingCard'),
          F('駅前看板(タウンで駅をタップ)', 'town', '#townStage'),
          stage >= 2 ? F('商店街・営業まわり', 'town', '#salesCard') : null
        ].filter(Boolean)
      };
    }
    return { text: '大きな詰まりはありません。次の一手(集患・単価・新メニュー)を仕込むチャンス', fixes: [] };
  }

  function bindGoto(root) {
    root.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
      const [tab, sel] = b.dataset.goto.split('|');
      $('modal').classList.remove('show');
      switchTab(tab);
      const target = document.querySelector(sel);
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
        target.classList.add('tut-focus');
        setTimeout(() => target.classList.remove('tut-focus'), 2400);
      }
    }));
  }

  function renderTodo() {
    const el = $('todoBody');
    if (!el) return;
    const m = MISSIONS[G.missionIdx];
    const bn = bottleneckInfo();
    el.innerHTML = `
      ${m ? `<div class="todo-row"><span class="todo-tag mission">🎯 ミッション</span><p>${m.title}</p></div>` : ''}
      <div class="todo-row"><span class="todo-tag">🔍 いまの詰まり</span><p>${bn.text}</p></div>
      ${bn.fixes.length ? `<div class="fix-row">${bn.fixes.map((f) => `<button class="fix-chip" data-goto="${f.tab}|${f.sel}">${f.label} →</button>`).join('')}</div>` : ''}`;
    bindGoto(el);
  }

  /* ================= 1日の結果画面 ================= */

  function showResult(T, spec, prev, dayNum, repDelta) {
    const corpProfit = T.profit + T.brProfit;
    const delta = (now, before, isYen, goodUp) => {
      if (!prev) return '';
      const diff = now - before;
      if (Math.abs(diff) < (isYen ? 1000 : 1)) return '<small class="rs-flat">前日並み</small>';
      const good = goodUp ? diff > 0 : diff < 0;
      const v = isYen ? yen(Math.round(diff)) : String(Math.round(diff));
      return `<small class="rs-delta ${good ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${v}</small>`;
    };
    const bn = bottleneckInfo();
    const dv = (G.voiceFeed || []).filter((v) => v.kind === 'daily').slice(-1)[0];
    const st = dv && typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[dv.char] : null;
    const m = MISSIONS[G.missionIdx];
    showModal(`📋 Day ${dayNum}(${WEEKDAYS[weekdayOf(dayNum)]})の結果`, `
      <div class="rs-grid">
        <div class="rs-item"><small>患者数</small><b>${T.patients}人</b>${delta(T.patients, prev ? prev.patients : 0, false, true)}</div>
        <div class="rs-item"><small>売上(本院)</small><b>${yen(T.revenue)}</b>${delta(T.revenue, prev ? prev.revenue : 0, true, true)}</div>
        <div class="rs-item"><small>損益(法人)</small><b class="${corpProfit >= 0 ? 'pos-t' : 'neg-t'}">${corpProfit >= 0 ? '+' : ''}${yen(corpProfit)}</b>${delta(corpProfit, prev ? prev.profit + (prev.brProfit || 0) : 0, true, true)}</div>
        <div class="rs-item"><small>平均待ち</small><b>${Math.round(T.avgWait)}分</b>${delta(T.avgWait, prev ? prev.avgWait : 0, false, false)}</div>
        <div class="rs-item"><small>評判</small><b>${Math.round(G.rep)}</b><small class="rs-delta ${repDelta >= 0 ? 'up' : 'down'}">${repDelta >= 0 ? '+' : ''}${repDelta}</small></div>
        <div class="rs-item"><small>新患</small><b>${T.newCount}人</b>${delta(T.newCount, prev ? prev.newCount || 0 : 0, false, true)}</div>
      </div>
      <div class="rs-bottle">🔍 ${bn.text}</div>
      ${st ? `<div class="voice-row rs-voice">${STAFF_UI.faceSVG(dv.char, 'normal', 40)}<div class="voice-txt"><small>${st.title} ${st.name}</small><p>${dv.text}</p></div></div>` : ''}
      ${bn.fixes.length
        ? `<p class="rs-next"><b>明日のおすすめ:</b></p><div class="fix-row">${bn.fixes.map((f) => `<button class="fix-chip" data-goto="${f.tab}|${f.sel}">${f.label} →</button>`).join('')}</div>`
        : m ? `<p class="rs-next"><b>明日のおすすめ:</b> 🎯 ${m.title}</p>` : ''}
    `, '明日へ →');
    bindGoto($('modalBody'));
  }

  /* ================= 週次・月次レビュー ================= */

  function kpiWeekAgg(hist) {
    const open = hist.filter((h) => h.kind !== 'closed');
    if (!open.length) return null;
    const sum = (f) => open.reduce((a, h) => a + f(h), 0);
    return {
      days: open.length,
      visits: sum((h) => h.patients) / open.length,
      newp: sum((h) => h.newCount || 0) / open.length,
      unit: sum((h) => h.patients) ? sum((h) => h.revenue) / sum((h) => h.patients) : 0,
      mix: sum((h) => h.patients) ? (sum((h) => (h.injCount || 0) + (h.trigCount || 0))) / sum((h) => h.patients) * 100 : 0,
      rehaPerPT: sum((h) => h.pts) ? sum((h) => h.rehaCount * 2) / sum((h) => h.pts) : 0,
      physio: sum((h) => h.physioCount || 0) / open.length,
      wait: sum((h) => h.avgWait) / open.length,
      jihi: sum((h) => h.jihi || 0) / open.length,
      labor: sum((h) => h.revenue) ? sum((h) => h.staffCost || 0) / sum((h) => h.revenue) * 100 : 0,
      profit: hist.reduce((a, h) => a + h.profit + (h.brProfit || 0), 0)
    };
  }

  function weeklyDigest() {
    const thisW = kpiWeekAgg(G.history.slice(-7));
    const lastW = kpiWeekAgg(G.history.slice(-14, -7));
    if (!thisW) return;
    const row = (label, a, b, fmt, goodUp) => {
      const arrow = !b ? '' : a > b * 1.02 ? (goodUp ? '<b class="up">↗</b>' : '<b class="down">↗</b>') : a < b * 0.98 ? (goodUp ? '<b class="down">↘</b>' : '<b class="up">↘</b>') : '→';
      return `<div class="wk-row"><span>${label}</span><b>${fmt(a)}</b><small>先週 ${b ? fmt(b) : '–'}</small>${arrow}</div>`;
    };
    const f0 = (v) => Math.round(v).toLocaleString();
    const f1 = (v) => (Math.round(v * 10) / 10).toLocaleString();
    showModal(`📅 週次サマリー(Day ${G.day - 6}〜${G.day})`, `
      <div class="wk-table">
        ${row('来院数/日', thisW.visits, lastW && lastW.visits, f1, true)}
        ${row('新患数/日', thisW.newp, lastW && lastW.newp, f1, true)}
        ${row('診療単価', thisW.unit, lastW && lastW.unit, (v) => '¥' + f0(v), true)}
        ${row('重点行為 実施率', thisW.mix, lastW && lastW.mix, (v) => f0(v) + '%', true)}
        ${row('リハ単位/PT/日', thisW.rehaPerPT, lastW && lastW.rehaPerPT, f1, true)}
        ${row('物療件数/日', thisW.physio, lastW && lastW.physio, f1, true)}
        ${row('自費売上/日', thisW.jihi, lastW && lastW.jihi, (v) => '¥' + f0(v), true)}
        ${row('平均待ち時間', thisW.wait, lastW && lastW.wait, (v) => f0(v) + '分', false)}
        ${row('人件費率', thisW.labor, lastW && lastW.labor, (v) => f0(v) + '%', false)}
        ${row('週間損益(法人)', thisW.profit, lastW && lastW.profit, (v) => '¥' + f0(v), true)}
      </div>
      <p class="modal-note">📖 週次は「構造」を見る時間。単価が落ちたなら中身(実施率・リハ単位)のどれか、患者数が落ちたなら新患か再診かを切り分ける。</p>`,
      '来週も頑張る');
  }

  function reviewPlan() {
    const rate = monthRevenueAll() / G.plan.revenue;
    const grade = rate >= 1 ? 'S' : rate >= 0.8 ? 'A' : rate >= 0.6 ? 'B' : 'C';
    const comments = {
      S: '目標達成。計画の精度と実行力、どちらも本物です。次の30日はもう一段高い目標を。',
      A: 'あと一歩。どのKPI(患者数/単価/認知)が計画とズレたかを特定して、来月の一手に変えましょう。',
      B: '未達。計画が高すぎたのか、実行が足りなかったのか — 区別することが大事。',
      C: '大幅未達。目標を下げるのは敗北ではなく、計画の修正は経営の仕事そのものです。'
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
      case 'firstday': done = T.patients >= 1; break;
      case 'wait40': done = T.patients >= 8 && T.avgWait < 40; break;
      case 'rev50k': done = T.revenue >= 50000; break;
      case 'rep60': done = G.rep >= 60; break;
      case 'web': done = settings.webIntake; break;
      case 'physio10': done = T.physioCount >= 10; break;
      case 'black3': done = (G.blackStreak || 0) >= 3; break;
      case 'reha10': done = settings.rehaLevel >= 1 && T.rehaCount >= 10; break;
      case 'tie': done = relLv('hospital') > 0 && relLv('caremane') > 0; break;
      case 'month300k': done = G.history.slice(-30).reduce((a, h) => a + h.profit + (h.brProfit || 0), 0) >= 300000; break;
      case 'expand': done = settings.floorLv >= 2; break;
      case 'revenue': done = monthRevenueMain() >= 8000000; break;
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
      renderTodo();
    }
  }

  /* ================= UI: 共通 ================= */

  function fmtClock(t) {
    const spec = G.daySpec || specOf(G.day);
    const m = Math.floor(Math.min(t, spec.min || 0)) + 9 * 60;
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  function updateHeader() {
    $('hMoney').textContent = yen(G.money);
    $('hMoney').classList.toggle('neg', G.money < 0);
    const spec = G.daySpec || specOf(G.day);
    $('hDay').textContent = `Day ${G.day}(${WEEKDAYS[weekdayOf(G.day)]}${spec.kind === 'am' ? '·午前' : spec.kind === 'closed' ? '·休診' : ''})`;
    $('hClock').textContent = spec.kind === 'closed' ? '—' : fmtClock(G.t);
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
    if (tab === 'clinic') { clinicIso.resize(); renderKpiStrip(); renderStaffStrip(); renderVoice(); }
    if (tab === 'town') { townIso.resize(); renderAds(); }
    if (tab === 'corp') renderCorp();
    if (tab === 'mgmt') { renderPnl(); renderMissions(); renderPlanner(); renderBank(); renderKpiPicker(); }
  }

  /* ================= UI: 診療時間 ================= */

  function renderSchedule() {
    const el = $('scheduleRow');
    if (!el) return;
    el.innerHTML = settings.schedule.map((k, i) => `
      <button class="sch-btn ${k}" data-sch="${i}">
        <span class="sch-day">${WEEKDAYS[i]}</span>
        <span class="sch-kind">${DAY_SPECS[k].label}</span>
      </button>`).join('');
    const openMin = settings.schedule.reduce((a, k) => a + DAY_SPECS[k].min, 0);
    $('scheduleNote').innerHTML = `週の診療時間: <b>${(openMin / 60).toFixed(0)}時間</b> / 午前のみ=人件費6割 / 日曜開院=手当1.4倍・ただし競合休みで新患1.3倍`;
    el.querySelectorAll('[data-sch]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.sch);
      const order = ['full', 'am', 'closed'];
      const next = order[(order.indexOf(settings.schedule[i]) + 1) % 3];
      const openDays = settings.schedule.filter((k, j) => (j === i ? next : k) !== 'closed').length;
      if (openDays < 3) { toast('週3日は開けましょう(患者さんが離れます)'); return; }
      settings.schedule[i] = next;
      renderSchedule(); save();
    }));
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
    return { doctor: M.doctors, nurse: M.nurses, pt: M.pts, recep: M.receptionists, chairs: M.chairs, beds: M.beds, machines: M.machines, physio: 8, rehaAide: 4 }[key];
  }
  function settingValue(key) {
    return { doctor: settings.doctors, nurse: settings.nurses, pt: settings.pts, recep: settings.receptionists, chairs: settings.chairs, beds: settings.beds, machines: settings.machines, physio: settings.physio, rehaAide: settings.rehaAides }[key];
  }
  function setSettingValue(key, v) {
    if (key === 'doctor') settings.doctors = v;
    else if (key === 'nurse') settings.nurses = v;
    else if (key === 'pt') settings.pts = v;
    else if (key === 'recep') settings.receptionists = v;
    else if (key === 'rehaAide') settings.rehaAides = v;
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
    const min = { doctor: 1, nurse: 0, pt: 0, recep: 1, chairs: 2, beds: 0, machines: 0, physio: 0, rehaAide: 0 }[key];
    const step = SHOP[key].step || 1;
    if (cur - step < min) { toast('これ以上は減らせません'); return; }
    setSettingValue(key, cur - step);
    clinic.applySettings();
    renderShop(); save();
  }

  const SHOP_VOICE = { doctor: 'doctor', nurse: 'nurse', beds: 'nurse', pt: 'reha', machines: 'reha', physio: 'reha', rehaAide: 'reha', recep: 'front', chairs: 'front' };

  function renderShop() {
    const stage = unlockStage();
    const rows = Object.entries(SHOP).map(([key, item]) => {
      const need = STAGE_SHOP[key] || 1;
      if (need > stage) {
        return `
        <div class="shop-row locked">
          <div class="shop-info">
            <span class="shop-name">🔒 ${item.label}</span>
            <span class="shop-hint">Day ${need === 2 ? 4 : 8} で解放 — ${need === 2 ? 'まずは受付と椅子で回転を作る' : '経営が安定したら次のステージへ'}</span>
          </div>
        </div>`;
      }
      const cur = settingValue(key);
      const max = shopMax(key);
      const vc = SHOP_VOICE[key];
      const vt = vc && typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[vc].invest[key] : null;
      return `
      <div class="shop-row">
        <div class="shop-info">
          <span class="shop-name">${item.label} <b class="shop-count">${cur}${item.day ? '人' : ''}</b> <small class="shop-max">/ 最大${max}</small></span>
          <span class="shop-hint">${item.hint}</span>
          ${vt ? `<span class="shop-voice">${STAFF_UI.faceSVG(vc, 'normal', 17)} ${STAFF_UI.STAFF[vc].name}「${vt}」</span>` : ''}
        </div>
        <div class="shop-btns">
          <button class="mini-btn" data-fire="${key}">−</button>
          <button class="mini-btn plus" data-buy="${key}">＋ ${yen(shopCost(key))}</button>
        </div>
      </div>`;
    }).join('');

    const bigTicket = stage < 3 ? `
      <div class="shop-row locked">
        <div class="shop-info">
          <span class="shop-name">🔒 大型投資(MRI・DEXA・増築)</span>
          <span class="shop-hint">Day 8 で解放 — 大型投資は「何日で回収できるか」で判断する世界</span>
        </div>
      </div>` : `
      <div class="shop-row ${settings.mri ? 'expand-row done' : 'expand-row'}">
        <div class="shop-info"><span class="shop-name">🧲 MRI ${settings.mri ? '導入済み(維持費¥12,000/日)' : 'を導入する'}</span>
        <span class="shop-hint">MRI検査 1件¥16,000(1日最大8件)。維持費¥12,000/日</span>
        ${typeof STAFF_UI !== 'undefined' ? `<span class="shop-voice">${STAFF_UI.faceSVG('advisor', 'normal', 17)} 白瀬「${STAFF_UI.STAFF.advisor.invest.mri}」</span>` : ''}</div>
        ${settings.mri ? '' : `<div class="shop-btns"><button class="mini-btn plus" id="mriBtn">🧲 ${yen(MRI_COST)}</button></div>`}
      </div>
      <div class="shop-row ${settings.dexa ? 'expand-row done' : 'expand-row'}">
        <div class="shop-info"><span class="shop-name">🦴 骨密度測定装置(DEXA)${settings.dexa ? ' 導入済み' : ''}</span>
        <span class="shop-hint">骨粗鬆症の継続診療プログラム(1受診¥3,800)。初診の一部が定期通院に</span></div>
        ${settings.dexa ? '' : `<div class="shop-btns"><button class="mini-btn plus" id="dexaBtn">🦴 ${yen(DEXA_COST)}</button></div>`}
      </div>
      ${settings.floorLv === 1
        ? `<div class="shop-row expand-row">
            <div class="shop-info"><span class="shop-name">🏗 院を増築する</span>
            <span class="shop-hint">フロア26×16へ。診察室4・リハ室100㎡(機器12台)・椅子20脚に上限UP。運動器リハ(I)の面積要件</span></div>
            <div class="shop-btns"><button class="mini-btn plus" id="expandBtn">🏗 ${yen(EXPAND_COST)}</button></div>
          </div>`
        : `<div class="shop-row expand-row done"><div class="shop-info"><span class="shop-name">🏗 増築済み(リハ室100㎡)</span></div></div>`}`;

    $('shopList').innerHTML = rows + bigTicket;
    $('shopList').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
    $('shopList').querySelectorAll('[data-fire]').forEach((b) => b.addEventListener('click', () => fire(b.dataset.fire)));
    const ex = $('expandBtn');
    if (ex) ex.addEventListener('click', () => {
      if (G.money < EXPAND_COST) { toast(`資金が足りません(${yen(EXPAND_COST)})`); return; }
      G.money -= EXPAND_COST;
      settings.floorLv = 2;
      clinic.applySettings();
      toast('🏗 増築完了! リハ室100㎡・診察室4室体制');
      renderShop(); renderPnl(); updateHeader(); save();
    });
    const mriB = $('mriBtn');
    if (mriB) mriB.addEventListener('click', () => {
      if (G.money < MRI_COST) { toast(`資金が足りません(${yen(MRI_COST)})`); return; }
      G.money -= MRI_COST;
      settings.mri = true;
      toast('🧲 MRI導入! 初診・紹介患者の精査で稼働します');
      renderShop(); updateHeader(); save();
    });
    const dexaB = $('dexaBtn');
    if (dexaB) dexaB.addEventListener('click', () => {
      if (G.money < DEXA_COST) { toast(`資金が足りません(${yen(DEXA_COST)})`); return; }
      G.money -= DEXA_COST;
      settings.dexa = true;
      toast('🦴 DEXA導入! 骨粗鬆症の継続診療が始まります');
      renderShop(); updateHeader(); save();
    });

    $('opReserve').classList.toggle('on', settings.reserve);
    $('opKiosk').classList.toggle('on', settings.kiosk);
    $('opReview').classList.toggle('on', settings.reviewCare);
    $('opWeb').classList.toggle('on', settings.webIntake);
    renderJihi();
  }

  function renderJihi() {
    const el = $('jihiList');
    if (!el) return;
    const uptakeReha = clamp((G.rep - 55) / 80, 0, 0.35) * clamp(1.7 - settings.selfRehaPrice / 9000, 0.15, 1.2);
    const prpDemand = clamp((G.rep - 58) / 12, 0, 2.2) * clamp(1.55 - settings.prpPrice / 100000, 0.15, 1.3) * (1 + 0.25 * relLv('sports'));
    const agaJoin = 0.5 * clamp(G.aw * 1.5, 0.3, 1.2) * clamp(1.6 - settings.agaPrice / 12000, 0.2, 1.3);
    el.innerHTML = `
      <div class="jihi-item">
        <div class="jihi-head"><button class="op-btn ${settings.selfReha ? 'on' : ''}" data-jihi="selfReha">🏃 自費リハ延長</button>
        <span class="jihi-stat">想定利用率 ${(uptakeReha * 100).toFixed(0)}%(リハ完了者)</span></div>
        <label class="ctrl"><span class="ctrl-head">価格 <b>${yen(settings.selfRehaPrice)}</b></span>
        <input type="range" data-jprice="selfRehaPrice" min="4000" max="15000" step="1000" value="${settings.selfRehaPrice}"></label>
      </div>
      <div class="jihi-item">
        <div class="jihi-head"><button class="op-btn ${settings.prpOn ? 'on' : ''}" data-jihi="prpOn">💉 PRP療法(再生医療)${settings.prpOn ? '' : ` <small>要認定 ${yen(PRP_CERT_COST)}</small>`}</button>
        <span class="jihi-stat">想定 ${prpDemand.toFixed(1)}件/日(評判・スポーツ連携で増)・原価 ${yen(FEES.prpCogs)}/件</span></div>
        <label class="ctrl"><span class="ctrl-head">価格 <b>${yen(settings.prpPrice)}</b></span>
        <input type="range" data-jprice="prpPrice" min="30000" max="165000" step="5000" value="${settings.prpPrice}"></label>
      </div>
      <div class="jihi-item">
        <div class="jihi-head"><button class="op-btn ${settings.agaOn ? 'on' : ''}" data-jihi="agaOn">💇 AGA外来(継続課金)</button>
        <span class="jihi-stat">会員 ${Math.round(G.agaPool)}人・加入 ${agaJoin.toFixed(1)}人/日・原価率35%</span></div>
        <label class="ctrl"><span class="ctrl-head">月額 <b>${yen(settings.agaPrice)}</b></span>
        <input type="range" data-jprice="agaPrice" min="3000" max="15000" step="1000" value="${settings.agaPrice}"></label>
      </div>
      <div class="jihi-item">
        <div class="jihi-head"><button class="op-btn ${settings.goods ? 'on' : ''}" data-jihi="goods">🦵 物販(サポーター等)<small> 原価60%</small></button>
        <span class="jihi-stat">処置・リハ患者の一部が購入(¥3,500)</span></div>
      </div>`;
    el.querySelectorAll('[data-jihi]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.jihi;
      if (k === 'prpOn' && !settings.prpOn) {
        if (G.money < PRP_CERT_COST) { toast(`再生医療の届出・認定に ${yen(PRP_CERT_COST)} 必要です`); return; }
        G.money -= PRP_CERT_COST;
        toast('💉 再生医療等提供計画の認定完了。PRP療法を開始します');
      }
      settings[k] = !settings[k];
      renderJihi(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-jprice]').forEach((s) => s.addEventListener('input', (e) => {
      settings[e.target.dataset.jprice] = Number(e.target.value);
      renderJihi(); save();
    }));
  }

  $('opReserve').addEventListener('click', () => {
    if (!settings.reserve) {
      if (G.money < 50000) { toast('資金が足りません(¥50,000)'); return; }
      G.money -= 50000;
      settings.reserve = true;
      toast('予約制を導入しました');
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
  $('opWeb').addEventListener('click', () => {
    if (!settings.webIntake) {
      if (G.money < 200000) { toast('資金が足りません(¥200,000)'); return; }
      G.money -= 200000;
      settings.webIntake = true;
      toast('📱 Web問診・事前受付を導入! 受付時間が約45%短縮されます(受付ボトルネック対策)');
    } else { settings.webIntake = false; }
    renderShop(); updateHeader(); save();
  });

  [['examMean', 'vExamMean', (v) => `${v}分`, (v) => v],
   ['pTreat', 'vPTreat', (v) => `${v}%`, (v) => v / 100],
   ['pReha', 'vPReha', (v) => `${v}%`, (v) => v / 100],
   ['pInj', 'vPInj', (v) => `${v}%`, (v) => v / 100],
   ['pTrig', 'vPTrig', (v) => `${v}%`, (v) => v / 100],
   ['pPhysio', 'vPPhysio', (v) => `${v}%`, (v) => v / 100]
  ].forEach(([key, label, fmt, conv]) => {
    $(key).addEventListener('input', (e) => {
      const v = Number(e.target.value);
      settings[key] = conv(v);
      $(label).textContent = fmt(v);
      save();
    });
  });

  /* ================= UI: KPI ================= */

  function renderKpiPicker() {
    const el = $('kpiPicker');
    if (!el) return;
    el.innerHTML = KPIS.map((k) => `
      <button class="kpi-chip ${G.kpiPins.includes(k.id) ? 'on' : ''}" data-kpi="${k.id}" title="${k.why}">${k.name}</button>`).join('') +
      `<p class="plan-lead" style="margin-top:8px">タップでピン留め(最大4つ)→ 院内タブに常時表示。<b>日次は絞って毎日見る</b>のがコツ。週次サマリーは7日ごとに自動表示。</p>` +
      `<div class="kpi-why">${KPIS.filter((k) => G.kpiPins.includes(k.id)).map((k) => `<p><b>${k.name}</b> — ${k.why}</p>`).join('')}</div>`;
    el.querySelectorAll('[data-kpi]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.kpi;
      if (G.kpiPins.includes(id)) G.kpiPins = G.kpiPins.filter((x) => x !== id);
      else if (G.kpiPins.length >= 4) { toast('ピン留めは4つまで。「絞る」のもKPI設計です'); return; }
      else G.kpiPins.push(id);
      renderKpiPicker(); renderKpiStrip(); save();
    }));
  }

  function renderKpiStrip() {
    const el = $('kpiStrip');
    if (!el) return;
    const opens = G.history.filter((h) => h.kind !== 'closed');
    const last = opens[opens.length - 1];
    if (!last) { el.innerHTML = '<span class="kpi-tile empty">KPI: 1日終えると表示(経営タブで指標を選べます)</span>'; return; }
    const prior = opens.slice(-8, -1);
    el.innerHTML = G.kpiPins.map((id) => {
      const k = KPIS.find((x) => x.id === id);
      if (!k) return '';
      const v = k.calc(last);
      const avg = prior.length ? prior.reduce((a, h) => a + k.calc(h), 0) / prior.length : null;
      const trend = avg === null || avg === 0 ? '' : v > avg * 1.03 ? '<i class="tr up">▲</i>' : v < avg * 0.97 ? '<i class="tr down">▼</i>' : '<i class="tr">–</i>';
      const fv = k.unit === '円' ? '¥' + Math.round(v).toLocaleString() : `${v}${k.unit}`;
      return `<span class="kpi-tile"><small>${k.name}</small><b>${fv}</b>${trend}</span>`;
    }).join('');
  }

  /* ================= UI: タウン(広告・営業) ================= */

  function renderAds() {
    const tEl = $('adTarget');
    if (tEl) {
      const segLabel = { balance: '🎯 バランス', senior: '👴 高齢者重視', worker: '💼 勤労者重視', sports: '🏃 スポーツ重視' };
      const lastH = G.history.filter((h) => h.kind !== 'closed').slice(-1)[0];
      tEl.innerHTML = `
        <div class="op-row">${Object.entries(segLabel).map(([k, v]) => `<button class="op-btn ${G.targetSeg === k ? 'on' : ''}" data-tseg="${k}">${v}</button>`).join('')}</div>
        <p class="ctrl-note">高齢者=リハ・骨粗鬆症・定着◎ / 勤労者=健診・AGA・定着△ / スポーツ=MRI・PRP・単価◎${lastH && lastH.segS !== undefined ? ` — 昨日の客層: 高齢${lastH.segS}・勤労${lastH.segW}・スポーツ${lastH.segP}人` : ''}</p>`;
      tEl.querySelectorAll('[data-tseg]').forEach((b) => b.addEventListener('click', () => {
        G.targetSeg = b.dataset.tseg;
        toast(`🎯 ターゲット方針: ${segLabel[G.targetSeg]}(商圏からの新患の客層が寄ります)`);
        renderAds(); save();
      }));
    }
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
      ${G.adPressure > 0.1 ? `<span class="ad-warn">⚠️ 競合が入札を強めています(CPC +${Math.round(G.adPressure * 100)}%)</span>` : ''}`;
    renderRelations();
  }

  function stars(lv, max) { return '★'.repeat(lv) + '☆'.repeat(max - lv); }

  function renderRelations() {
    const el = $('relList');
    if (!el) return;
    el.innerHTML = Object.entries(REL_DEF).map(([k, def]) => {
      const r = G.relations[k];
      const stale = r.lv > 0 ? Math.max(0, 30 - (G.day - r.last)) : null;
      return `<div class="rel-row">
        <div class="rel-info"><b>${def.name}</b> <span class="rel-stars">${stars(r.lv, def.max)}</span>
        <small>${def.effect}${stale !== null ? ` / あと${stale}日で関係が冷える` : ''}</small></div>
        <button class="mini-btn plus" data-rel="${k}">${r.lv === 0 ? '挨拶に行く' : r.lv < def.max ? '関係を深める' : '定期訪問'} ${yen(def.cost)}</button>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-rel]').forEach((b) => b.addEventListener('click', () => visitRelation(b.dataset.rel)));
  }

  function visitRelation(key) {
    const def = REL_DEF[key];
    const r = G.relations[key];
    if (def.needsReha && settings.rehaLevel === 0) {
      showModal(def.name, '<p>「リハビリの体制がないと、ご紹介できません」<br>まず院内でリハ(専従PT・機器・施設基準)を立ち上げましょう。</p><p class="modal-note">📖 連携営業は「提供できる医療」が先。</p>', '出直す');
      return;
    }
    if (G.money < def.cost) { toast('資金が足りません'); return; }
    G.money -= def.cost;
    if (key === 'shoutengai') {
      G.aw = clamp(G.aw + 0.012, 0.05, 0.95);
      G.rep = Math.min(100, G.rep + 0.5);
    }
    if (r.lv < def.max) {
      r.lv++;
      toast(`🤝 ${def.name}: 関係が深まりました(${stars(r.lv, def.max)})`);
    } else {
      toast(`🍵 ${def.name}: 定期訪問。関係は良好です(${stars(r.lv, def.max)})`);
    }
    r.last = G.day;
    renderAds(); updateHeader(); save();
  }

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
    if (b.id === 'station') {
      if (G.billboard) { showModal('駅前看板', '<p>掲出中(維持費 ¥3,000/日)。駅利用者の新患と認知に効いています。</p>', '閉じる'); return; }
      showModal('駅前看板を出す', '<p>駅前ロータリーの看板枠に広告を掲出します。</p><p><b>効果:</b> 認知 +0.8%/日、駅利用者の新患 +1〜2人/日</p><p><b>費用:</b> ¥100,000 + ¥3,000/日</p><div class="modal-actions"><button class="btn-cta" id="actGo">実行する</button></div>', 'やめておく');
      $('actGo').addEventListener('click', () => {
        if (G.money < 100000) { toast('資金が足りません'); return; }
        G.money -= 100000;
        G.billboard = true;
        $('modal').classList.remove('show');
        toast('✅ 駅前看板を掲出しました');
        updateHeader(); save();
      });
      return;
    }
    if (b.id === 'rival') {
      showModal('ライバル整形外科', `<p>開業15年、評判 ${RIVAL_REP}。新患は評判の比で分け合っています。リスティングを出しすぎると入札を強めてきます。</p><p class="modal-note">📖 相手を下げる手はない。自院の評判・認知・提供価値を上げるだけ。</p>`, '閉じる');
      return;
    }
    if (b.id === 'clinic') {
      showModal('あなたのクリニック(本院)', `<p>現在: 医師${settings.doctors}人 / PT${settings.pts}人 / ${REHA_NAMES[settings.rehaLevel]} / 評判${Math.round(G.rep)} / 認知${Math.round(G.aw * 100)}%</p>`, '閉じる');
      return;
    }
    const def = REL_DEF[b.id];
    if (def) {
      const r = G.relations[b.id];
      showModal(def.name, `
        <p>${def.desc}</p>
        <p>関係レベル: <b class="rel-stars">${stars(r.lv, def.max)}</b>${r.lv > 0 ? `(最終訪問 Day ${r.last} / 30日放置で冷える)` : ''}</p>
        <p><b>効果:</b> ${def.effect}</p>
        ${def.needsReha && settings.rehaLevel === 0 ? '<p class="modal-note">⚠️ リハ体制がないと紹介は始まりません</p>' : ''}
        <div class="modal-actions"><button class="btn-cta" id="relGo">${r.lv === 0 ? '挨拶に行く' : r.lv < def.max ? '関係を深める' : '定期訪問する'}(${yen(def.cost)})</button></div>`,
        'やめておく');
      $('relGo').addEventListener('click', () => {
        $('modal').classList.remove('show');
        visitRelation(b.id);
      });
    }
  });

  /* ================= UI: 法人(分院) ================= */

  const BR_ROLES = [['doctors', '医師', 1, 3], ['nurses', '看護師', 0, 3], ['pts', 'PT', 0, 10], ['receptionists', '受付', 1, 2]];
  const BR_EXPAND_COST = 4000000;

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
      const machineMax = (br.floorLv || 1) >= 2 ? 12 : 6;
      const kijunBtns = KIJUN.map((k) => {
        if (br.rehaLevel === k.lv) return `<span class="kijun-badge">${k.name} 届出済</span>`;
        const ok = k.lv === 3 ? (br.staff.pts >= 4 && (br.floorLv || 1) >= 2) : k.ok(br.staff.pts, 1);
        return `<button class="mini-btn ${ok ? 'plus' : ''}" data-brkijun="${bi}:${k.lv}" ${ok ? '' : 'disabled'}>${k.name}</button>`;
      }).join(' ');
      const p7 = br.profit7.reduce((a, x) => a + x, 0);
      return `
      <div class="branch-card">
        <div class="branch-head">
          <b>🏥 ${br.name}${(br.floorLv || 1) >= 2 ? ' <small>🏗100㎡</small>' : ''}${br.mri ? ' <small>🧲MRI</small>' : ''}</b>
          <span class="branch-stat">評判 ${Math.round(br.rep)} / 認知 ${Math.round(br.aw * 100)}% / ${REHA_NAMES[br.rehaLevel]}</span>
        </div>
        ${br.last ? `<div class="branch-pnl">昨日: 患者${br.last.visits}人(リハ${br.last.reha}) 売上${yen(br.last.revenue)} 損益 <b class="${br.last.profit >= 0 ? 'pos-t' : 'neg-t'}">${yen(br.last.profit)}</b> / 直近7日計 <b class="${p7 >= 0 ? 'pos-t' : 'neg-t'}">${yen(p7)}</b></div>` : '<div class="branch-pnl">開院準備中 — 明日から診療開始</div>'}
        <div class="branch-staff">
          ${BR_ROLES.map(([key, label, min, max]) => `
            <div class="plan-step"><span>${label} <small>最大${max}</small></span>
              <div><button class="mini-btn" data-brfire="${bi}:${key}">−</button><b>${br.staff[key]}</b><button class="mini-btn plus" data-brhire="${bi}:${key}">＋ ${yen(branchHireCost(key, br.staff[key]))}</button></div>
            </div>`).join('')}
          <div class="plan-step"><span>リハ機器 <small>最大${machineMax}・稼働=min(機器,PT×2)</small></span>
            <div><button class="mini-btn" data-brmfire="${bi}">−</button><b>${br.machines}</b><button class="mini-btn plus" data-brmachine="${bi}">＋ ${yen(300000)}</button></div>
          </div>
          <div class="plan-step"><span>物療機器 <small>最大6・1台30件/日</small></span>
            <div><button class="mini-btn" data-brpfire="${bi}">−</button><b>${br.physio || 0}</b><button class="mini-btn plus" data-brphysio="${bi}">＋ ${yen(80000)}</button></div>
          </div>
        </div>
        <div class="ctrl-grid">
          <label class="ctrl"><span class="ctrl-head">注射方針 <b>${Math.round((br.pInj || 0.2) * 100)}%</b></span>
            <input type="range" data-brpinj="${bi}" min="0" max="50" step="5" value="${Math.round((br.pInj || 0.2) * 100)}"></label>
          <label class="ctrl"><span class="ctrl-head">リハ提案方針 <b>${Math.round((br.pReha || 0.35) * 100)}%</b></span>
            <input type="range" data-brpreha="${bi}" min="0" max="70" step="5" value="${Math.round((br.pReha || 0.35) * 100)}"></label>
        </div>
        <div class="op-row">
          ${(br.floorLv || 1) < 2 ? `<button class="op-btn" data-brexpand="${bi}">🏗 増築100㎡ <small>${yen(BR_EXPAND_COST)}</small></button>` : ''}
          ${!br.mri ? `<button class="op-btn" data-brmri="${bi}">🧲 MRI導入 <small>${yen(MRI_COST)}</small></button>` : ''}
          <button class="op-btn" data-brsales="${bi}">📣 地域営業 <small>¥30,000(認知+1.5%)</small></button>
        </div>
        <div class="branch-kijun">施設基準(<b>専従はこの分院のPTのみ</b>。(I)は増築100㎡+PT4名): ${kijunBtns}</div>
      </div>`;
    }).join('');

    const exCount = G.branches.filter((b) => b.siteId.startsWith('ex')).length;
    const generic = { id: 'ex' + (exCount + 1), name: `郊外${exCount + 1}号院`, cost: 12000000 + exCount * 2000000, desc: '隣町の新興住宅地。マップ外だが商圏は良好。分院数に上限はありません。' };
    const openable = [...SITES.filter((s) => !G.branches.some((b) => b.siteId === s.id)), generic];
    const openSection = `
      <h3 class="sub-title">🏗 新しい分院を開設する</h3>
      <p class="plan-lead">条件: <b>事業計画の策定 ${G.plan ? '✅' : '❌'}</b> / <b>本院評判70以上 ${G.rep >= 70 ? '✅' : `❌(現在${Math.round(G.rep)})`}</b> / 開設資金</p>
      ${openable.map((s) => {
        const can = G.plan && G.rep >= 70 && G.money >= s.cost;
        return `<div class="shop-row">
          <div class="shop-info"><span class="shop-name">${s.name} <small class="shop-max">${yen(s.cost)}</small></span><span class="shop-hint">${s.desc}</span></div>
          <div class="shop-btns"><button class="mini-btn ${can ? 'plus' : ''}" data-open="${s.id}" data-opencost="${s.cost}" data-openname="${s.name}" ${can ? '' : 'disabled'}>開設する</button></div>
        </div>`;
      }).join('')}`;

    el.innerHTML = summary + (brCards || '<p class="plan-lead">まだ分院はありません。本院を軌道に乗せてから(評判70+事業計画+資金)。<b>施設基準の専従要件は分院ごと</b> — PT採用が本当の壁です。</p>') + openSection;

    el.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
      const cost = Number(b.dataset.opencost);
      const name = b.dataset.openname;
      if (G.money < cost) { toast('資金が足りません'); return; }
      G.money -= cost;
      G.branches.push({
        siteId: b.dataset.open, name, openedDay: G.day,
        staff: { doctors: 1, nurses: 1, pts: 0, receptionists: 1 },
        machines: 0, physio: 0, floorLv: 1, mri: false, pInj: 0.2, pReha: 0.35,
        rehaLevel: 0, aw: 0.12, rep: 52, revisitPool: 4, rehabPool: 0, profit7: [], last: null
      });
      town.setBranches(G.branches.map((x) => x.siteId));
      toast(`🎉 ${name} を開設しました!`);
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
      const max = (br.floorLv || 1) >= 2 ? 12 : 6;
      if (br.machines >= max) { toast('これ以上は入りません(増築で上限UP)'); return; }
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
    el.querySelectorAll('[data-brphysio]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brphysio)];
      if ((br.physio || 0) >= 6) { toast('これ以上は入りません'); return; }
      if (G.money < 80000) { toast('資金が足りません'); return; }
      G.money -= 80000;
      br.physio = (br.physio || 0) + 1;
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brpfire]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brpfire)];
      if ((br.physio || 0) <= 0) return;
      br.physio--;
      renderCorp(); save();
    }));
    el.querySelectorAll('[data-brexpand]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brexpand)];
      if (G.money < BR_EXPAND_COST) { toast(`資金が足りません(${yen(BR_EXPAND_COST)})`); return; }
      G.money -= BR_EXPAND_COST;
      br.floorLv = 2;
      toast(`🏗 ${br.name} を増築(100㎡)! 機器12台・運動器リハ(I)の面積要件を満たしました`);
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brmri]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brmri)];
      if (G.money < MRI_COST) { toast(`資金が足りません(${yen(MRI_COST)})`); return; }
      G.money -= MRI_COST;
      br.mri = true;
      toast(`🧲 ${br.name} にMRIを導入しました(維持費¥12,000/日)`);
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brsales]').forEach((b) => b.addEventListener('click', () => {
      const br = G.branches[Number(b.dataset.brsales)];
      if (G.money < 30000) { toast('資金が足りません'); return; }
      G.money -= 30000;
      br.aw = clamp(br.aw + 0.015, 0.05, 0.9);
      toast(`📣 ${br.name}: 地域営業! 認知が ${Math.round(br.aw * 100)}% になりました`);
      renderCorp(); updateHeader(); save();
    }));
    el.querySelectorAll('[data-brpinj]').forEach((s) => s.addEventListener('input', (e) => {
      G.branches[Number(e.target.dataset.brpinj)].pInj = Number(e.target.value) / 100;
      save();
    }));
    el.querySelectorAll('[data-brpreha]').forEach((s) => s.addEventListener('input', (e) => {
      G.branches[Number(e.target.dataset.brpreha)].pReha = Number(e.target.value) / 100;
      save();
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
    const spec = G.daySpec || specOf(G.day);
    const staffCost = Math.round(mainStaffCost() * spec.pay);
    $('pnlToday').innerHTML = `
      <div class="pnl-row"><span>外来収益(初再診・外来管理${T.kanriCount}件・処方箋)</span><b>${yen(T.rev.consult)}</b></div>
      <div class="pnl-row"><span>注射(関節注・トリガー等 ${T.injCount + T.trigCount}件)</span><b>${yen(T.rev.inj)}</b></div>
      <div class="pnl-row"><span>処置(${T.treatCount}件)・物療(${T.physioCount}件)</span><b>${yen(T.rev.treat + T.rev.physio)}</b></div>
      <div class="pnl-row"><span>画像(X線${T.xrayCount}・MRI${T.mriCount})</span><b>${yen(T.rev.img)}</b></div>
      <div class="pnl-row"><span>リハビリ(${T.rehaCount}件・${REHA_NAMES[settings.rehaLevel]})</span><b>${yen(T.rev.reha)}</b></div>
      ${settings.dexa ? `<div class="pnl-row"><span>骨粗鬆症プログラム(${T.osteoVisits}件・登録${Math.round(G.osteoPool)}人)</span><b>${yen(T.rev.osteo)}</b></div>` : ''}
      <div class="pnl-row"><span>健診</span><b>${yen(T.rev.checkup)}</b></div>
      <div class="pnl-row"><span>自費(PRP${T.prpCount}件・AGA会員${Math.round(G.agaPool)}人ほか)</span><b>${yen(T.rev.jihi)}</b></div>
      <div class="pnl-row total"><span>本院売上(${T.patients}人)</span><b>${yen(T.revenue)}</b></div>
      <div class="pnl-row"><span>人件費${spec.kind === 'am' ? '(半日0.6)' : weekdayOf(G.day) === 6 && spec.kind !== 'closed' ? '(日曜手当1.4)' : ''}</span><b>−${yen(staffCost)}</b></div>
      <div class="pnl-row"><span>家賃・固定費${settings.mri ? '(MRI維持含む)' : ''}</span><b>−${yen(COSTS.rent[settings.floorLv] + COSTS.base[settings.floorLv] + (settings.mri ? COSTS.mriMaint : 0))}</b></div>
      <div class="pnl-row"><span>広告費(本日消化)</span><b>−${yen(G.adSpendToday + (G.billboard ? COSTS.billboardDay : 0))}</b></div>
      <div class="pnl-row"><span>変動費(材料・自費原価)</span><b>−${yen(T.patients * COSTS.perPatient + T.goodsCogs + T.jihiCogs)}</b></div>
      ${G.loans.length ? `<div class="pnl-row"><span>支払利息(${G.loans.length}件)</span><b>−${yen(loanInterestDay())}</b></div>` : ''}
      <div class="pnl-row total ${T.revenue - cost >= 0 ? 'pos' : 'neg'}"><span>本院 本日見込み損益</span><b>${T.revenue - cost >= 0 ? '+' : ''}${yen(T.revenue - cost)}</b></div>
      <div class="pnl-note">人件費率(本日): ${T.revenue > 0 ? Math.round(staffCost / T.revenue * 100) + '%' : '–'}(目安 45〜55%)</div>
    `;
    $('pnlMonth').textContent = `${yen(monthRevenueMain())}(法人 ${yen(monthRevenueAll())})`;

    const hist = G.history.slice(-14);
    const maxAbs = Math.max(50000, ...hist.map((h) => Math.abs(h.profit + (h.brProfit || 0))));
    $('pnlChart').innerHTML = hist.map((h) => {
      const p = h.profit + (h.brProfit || 0);
      const hpx = Math.max(3, Math.abs(p) / maxAbs * 46);
      return `<div class="bar-col" title="Day${h.day}: ${yen(p)}"><div class="bar ${p >= 0 ? 'pos' : 'neg'}" style="height:${hpx}px"></div><span>${WEEKDAYS[h.wd ?? (h.day - 1) % 7]}</span></div>`;
    }).join('') || '<p class="pnl-empty">まだ実績がありません(1日終えると表示)</p>';

    $('kijunBody').innerHTML = KIJUN.map((k) => {
      const ok = k.ok(settings.pts, settings.floorLv);
      const active = settings.rehaLevel === k.lv;
      return `<div class="kijun-row ${active ? 'ok' : ''}">
        <div><b>${k.name}</b> — リハ1回(2単位) ${yen(k.fee)}<br><small>要件: ${k.reqText} ${ok ? '✅' : '❌'}</small></div>
        ${active ? '<span class="kijun-badge">届出済</span>' : `<button class="mini-btn ${ok ? 'plus' : ''}" data-kijun="${k.lv}" ${ok ? '' : 'disabled'}>届け出る</button>`}
      </div>`;
    }).join('') + `<p class="pnl-note">要件(専従PT数・面積)を割ると自動降格。分院の基準は分院のPTだけで数えます(専従)。</p>`;
    $('kijunBody').querySelectorAll('[data-kijun]').forEach((b) => b.addEventListener('click', () => {
      settings.rehaLevel = Number(b.dataset.kijun);
      toast(`✅ ${REHA_NAMES[settings.rehaLevel]}を届け出ました(リハ1回 ${yen(REHA_FEE[settings.rehaLevel])})`);
      renderPnl(); save();
    }));
  }

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
      <div class="pnl-row"><span>適用金利</span><b>${goodPlan ? '日利0.03% — 計画良好' : '日利0.06% — 計画に⚠️あり'}</b></div>
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
      toast('💸 完済しました');
      renderBank(); updateHeader(); save();
    }));
  }

  /* ================= 事業計画 ================= */

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
    const h = G.history.slice(-7).filter((x) => x.kind !== 'closed');
    const rev = h.reduce((a, d) => a + d.revenue, 0);
    const pt = h.reduce((a, d) => a + d.patients, 0);
    return pt >= 10 ? rev / pt : 3200;
  }

  function staffCostOf(st) {
    return (st.doctors - 1) * COSTS.doctorDay + st.nurses * COSTS.nurseDay + st.pts * COSTS.ptDay + st.receptionists * COSTS.recepDay;
  }

  function planDiagnosis(d) {
    const unit = avgUnitPrice();
    const openDays = openDaysCount();
    const fixed = staffCostOf(d.staff) + COSTS.rent[settings.floorLv] + COSTS.base[settings.floorLv] + Object.values(G.ads).reduce((a, b) => a + b, 0) + (G.billboard ? COSTS.billboardDay : 0) + (settings.mri ? COSTS.mriMaint : 0);
    const bep = Math.ceil(fixed / Math.max(500, unit - COSTS.perPatient));
    const examCap = Math.floor(d.staff.doctors * (480 / (settings.examMean + 1.5)) * 0.72);
    const rehaCap = Math.min(settings.machines, d.staff.pts * 2) * Math.floor(480 / 15);
    const laborRate = d.revenue > 0 ? (staffCostOf(d.staff) * openDays * 4.3) / d.revenue : 1;
    const planProfit = Math.round((d.patientsPerDay * (unit - COSTS.perPatient) - fixed) * openDays * 4.3);
    const msgs = [];
    msgs.push({ lv: 'info', text: `想定単価 ${yen(unit)}/人(直近実績) → 損益分岐点は <b>1日${bep}人</b>(週${openDays}日診療)` });
    if (d.patientsPerDay < bep) msgs.push({ lv: 'bad', text: `⚠️ 目標${d.patientsPerDay}人/日 < 損益分岐${bep}人/日 — <b>この計画は構造的に赤字</b>` });
    else msgs.push({ lv: 'good', text: `✅ 目標達成時の計画利益: <b>${planProfit >= 0 ? '+' : ''}${yen(planProfit)}/月</b>` });
    if (d.patientsPerDay > examCap) msgs.push({ lv: 'bad', text: `⚠️ 診察キャパ不足 — 医師${d.staff.doctors}人では約${examCap}人/日が限界` });
    if (d.rehaPerDay > rehaCap) msgs.push({ lv: 'bad', text: `⚠️ リハキャパ不足 — PT${d.staff.pts}人×機器${settings.machines}台では約${rehaCap}件/日が限界` });
    if (laborRate > 0.60) msgs.push({ lv: 'bad', text: `⚠️ 計画人件費率 ${(laborRate * 100).toFixed(0)}% — 目安(45〜55%)を大きく超過` });
    else if (laborRate > 0.55) msgs.push({ lv: 'warn', text: `計画人件費率 ${(laborRate * 100).toFixed(0)}% — やや高め` });
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
        <p class="plan-lead">目標と人員をセットで決めます。<b>計画は当てるためではなく、ズレに早く気づくため</b>。銀行融資・分院開設の前提条件。30日ごとにレビュー。</p>
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
        toast('📝 事業計画を策定しました。銀行融資も使えます');
        renderPlanner(); renderBank(); save();
      });
      const pc = $('planCancel');
      if (pc) pc.addEventListener('click', () => { planEditing = false; draft = null; renderPlanner(); });
      return;
    }

    const plan = G.plan;
    const cur = monthRevenueAll();
    const pct = Math.min(100, cur / plan.revenue * 100);
    const h7 = G.history.slice(-7).filter((x) => x.kind !== 'closed');
    const ptAvg = h7.length ? h7.reduce((a, d) => a + d.patients, 0) / h7.length : 0;
    const rehaAvg = h7.length ? h7.reduce((a, d) => a + d.rehaCount, 0) / h7.length : 0;
    const rev7 = h7.reduce((a, d) => a + d.revenue, 0);
    const laborNow = h7.reduce((a, d) => a + (d.staffCost || 0), 0);
    const laborRate = rev7 > 0 ? laborNow / rev7 : 0;
    const staffRows = PLAN_ROLES.map(([key, label]) => {
      const now = key === 'doctors' ? settings.doctors : key === 'nurses' ? settings.nurses : key === 'pts' ? settings.pts : settings.receptionists;
      const diff = now - plan.staff[key];
      return `<span class="staff-chip ${diff === 0 ? 'ok' : diff < 0 ? 'under' : 'over'}">${label} ${now}/${plan.staff[key]}人${diff === 0 ? '' : diff < 0 ? `(計画まであと${-diff})` : `(計画+${diff})`}</span>`;
    }).join('');
    const bar = (label, now, target, unit) => {
      const p = Math.min(100, target > 0 ? now / target * 100 : 0);
      return `<div class="pv-row"><span class="pv-label">${label}</span>
        <div class="pv-track"><i style="width:${p.toFixed(1)}%" class="${p >= 100 ? 'full' : p >= 70 ? 'mid' : 'low'}"></i></div>
        <span class="pv-num">${now}${unit} / ${target}${unit}</span></div>`;
    };
    el.innerHTML = `
      <div class="pv-head">
        <div class="pv-rev">
          <span>月商目標(法人) ${yen(plan.revenue)} / 次回レビュー Day ${Math.ceil(G.day / 30) * 30}</span>
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
    { tab: null, sel: null, text: 'ようこそ、クリニックタウンへ。あなたはこの街の整形外科クリニックを承継した新オーナーです。<b>目指すは医師4名・PT30名(分院含む)の医療法人</b>。何もしなければ前院長の患者さんは先細りです。' },
    { tab: null, sel: null, text: 'このゲームの回し方はシンプル。<b>① 1日進める → ② 結果を見る → ③ スタッフの声を聞く → ④ 1つ改善する</b>。1日の終わりに結果画面が出るので、数字の変化を見ながらもう1日 — の繰り返しです。' },
    { tab: null, sel: '.hud', text: '経営ダッシュボード。<b>資金・評判・認知</b>が経営の体温計。右の<b>⏩1日</b>ボタンで、1日まるごと自動運営スキップもできます。' },
    { tab: 'clinic', sel: '#clinicStage', text: '院内。患者さんが<b>受付→待合→診察→会計</b>と流れます。どこかが詰まると待ち時間が伸びて評判が下がる — <b>詰まりを見つけて潰す</b>のがあなたの仕事。' },
    { tab: 'clinic', sel: '#todoCard', text: '<b>迷ったらここ</b>。「今日やること」に、いまのミッション・詰まっている場所・打ち手の候補を常に表示します。ボタンを押せばその画面へ飛べます。' },
    { tab: 'clinic', sel: '#scheduleCard', text: '<b>診療時間は自由に設計</b>。タップで「終日→午前→休診」。半日は人件費6割、日曜開院は手当1.4倍だが競合が休みで新患1.3倍 — コマごとの採算で決める。' },
    { tab: 'clinic', sel: '#shopCard', text: 'スタッフと設備。最初に触れるのは<b>受付と椅子</b>だけ — 経営が進むと(Day 4、Day 8)採用・リハ・大型投資が順次解放されます。まずは目の前の回転づくりから。' },
    { tab: 'mgmt', sel: '#formulaCard', text: 'いちばん大事な式。<b>売上 = 患者数 × 単価</b>。すべての打ち手はどちらか(または両方)を動かします。「今日の一手はどちらを動かしたか?」を毎日問う。' },
    { tab: 'mgmt', sel: '#missionCard', text: 'ミッションが経営カリキュラム(全15)。順番に進めるだけで外来経営の型が身につきます。まずは<b>「初日の診療を完了する」</b>から。健闘を祈ります!' }
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

  document.querySelectorAll('.speed-btn[data-speed]').forEach((b) => {
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

  let lastTs = 0, frameN = 0;
  function loop(ts) {
    clinicIso.time = ts;
    townIso.time = ts;
    if (activeTab === 'clinic' && ++frameN % 150 === 0) renderStaffStrip();
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
      town.draw(townIso, {
        billboard: G.billboard,
        hospitalTie: relLv('hospital') > 0, caremaneTie: relLv('caremane') > 0, companyTie: relLv('company') > 0,
        listing: Object.values(G.ads).reduce((a, b) => a + b, 0)
      });
    }
    updateHeader();
    updateClinicHud();
    requestAnimationFrame(loop);
  }

  let closedStreak = 0;
  function stepSim(dt) {
    const spec = G.daySpec || specOf(G.day);
    if (spec.kind === 'closed') {
      if (closedStreak++ > 8) { closedStreak = 0; return; } // 全休ガード
      endDay();
      return;
    }
    closedStreak = 0;
    G.t += dt;
    while (G.nextArrivalIdx < G.arrivals.length && G.arrivals[G.nextArrivalIdx].t <= G.t) {
      const a = G.arrivals[G.nextArrivalIdx];
      town.requestVisit(a.type, a.source, a.refer, a.seg);
      G.nextArrivalIdx++;
    }
    clinic.tick(dt);
    town.tick(dt);
    const townPatients = town.walkers.some((w) => w.kind === 'patient');
    if (G.t >= spec.min && !townPatients && clinic.patients.length === 0) endDay();
    else if (G.t >= spec.min + 150) {
      clinic.reset();
      endDay();
    }
  }

  /* ================= 1日スキップ(自動運営・期待値ベース) ================= */

  function autoDay() {
    if (tutIdx >= 0) return;
    const spec = G.daySpec || specOf(G.day);
    const T = G.today;
    if (spec.kind !== 'closed') {
      // 在院・移動中の患者は簡易精算
      let inflight = clinic.patients.length + town.walkers.filter((w) => w.kind === 'patient').length;
      town.walkers = town.walkers.filter((w) => w.kind !== 'patient');
      clinic.reset();
      while (inflight-- > 0) { T.patients++; T.revenue += 1500; T.rev.consult += 1500; }
      // 未到着の来院を期待値で処理
      const arr = G.arrivals.slice(G.nextArrivalIdx);
      G.nextArrivalIdx = G.arrivals.length;
      let rehaAvail = Math.min(clinic.usableMachines() * 26, clinic.rehaCap());
      const examCapDay = Math.max(10, settings.doctors * (spec.min / (settings.examMean + (G.evExamDelta || 0) + 1.5)) * 0.72);
      let examServed = 0, turnedAway = 0;
      for (const a of arr) {
        // 診察キャパを超えた患者は診られない(機会損失+評判低下)
        if (a.type !== 'rehab') {
          if (examServed >= examCapDay) { turnedAway++; continue; }
          examServed++;
        } else if (rehaAvail < 1) {
          if (Math.random() < 0.7) addSchedule(G.day + 1, 'rehab'); // 3割は離脱
          continue;
        }
        const seg = a.seg || 'senior';
        T.segCounts[seg] = (T.segCounts[seg] || 0) + 1;
        T.patients++;
        let rev = 0, proc = false, didReha = false;
        if (a.type === 'checkup') { rev += FEES.checkup; T.rev.checkup += FEES.checkup; }
        else if (a.type === 'first') { rev += FEES.first; T.rev.consult += FEES.first; T.newCount++; }
        else { rev += FEES.revisit; T.rev.consult += FEES.revisit; }
        if (a.type !== 'checkup') {
          if (Math.random() < settings.pInj) { rev += FEES.inj; T.rev.inj += FEES.inj; T.injCount++; proc = true; }
          if (Math.random() < settings.pTrig) { rev += FEES.trig; T.rev.inj += FEES.trig; T.trigCount++; proc = true; }
          if (settings.physio > 0 && !G.evPhysioDown && T.physioCount < settings.physio * 35 && Math.random() < settings.pPhysio) { rev += FEES.physio; T.rev.physio += FEES.physio; T.physioCount++; proc = true; }
          const segMul = { senior: 1.2, sports: 1.45, worker: 0.75 }[seg] || 1;
          const wantReha = a.type === 'rehab' || (settings.rehaLevel > 0 && (a.refer || Math.random() < settings.pReha * segMul));
          if (wantReha && settings.rehaLevel > 0 && rehaAvail >= 1) {
            rehaAvail--; didReha = true; proc = true;
            const fr = REHA_FEE[settings.rehaLevel];
            rev += fr; T.rev.reha += fr; T.rehaCount++;
          } else if (clinic.usableBeds() > 0 && Math.random() < settings.pTreat) {
            rev += FEES.treat; T.rev.treat += FEES.treat; T.treatCount++; proc = true;
          }
        }
        if ((a.type === 'revisit' || a.type === 'rehab') && !proc) { rev += FEES.kanri; T.rev.consult += FEES.kanri; T.kanriCount++; }
        if ((a.type === 'first' || a.type === 'revisit') && Math.random() < 0.55) { rev += FEES.presc; T.rev.consult += FEES.presc; }
        if (a.type === 'first' && Math.random() < 0.7) { rev += FEES.xray; T.rev.img += FEES.xray; T.xrayCount++; }
        const mriMul = seg === 'sports' ? 1.6 : seg === 'worker' ? 1.1 : 0.85;
        if (settings.mri && T.mriCount < 8 && (a.type === 'first' || a.refer) && Math.random() < 0.3 * mriMul) { rev += FEES.mri; T.rev.img += FEES.mri; T.mriCount++; }
        if (settings.dexa && a.type === 'first' && Math.random() < (seg === 'senior' ? 0.25 : 0.05)) G.osteoPool++;
        if (didReha && settings.selfReha) {
          const pJ = clamp((G.rep - 55) / 80, 0, 0.35) * clamp(1.7 - settings.selfRehaPrice / 9000, 0.15, 1.2);
          if (Math.random() < pJ) { rev += settings.selfRehaPrice; T.rev.jihi += settings.selfRehaPrice; }
        }
        if (settings.goods && proc && Math.random() < 0.12 * clamp(G.rep / 70, 0.6, 1.3)) { rev += FEES.goods; T.rev.jihi += FEES.goods; T.goodsCogs += FEES.goodsCogs; }
        T.revenue += rev;
        const loyalty = { senior: 0.55, worker: 0.32, sports: 0.42 }[seg] || 0.45;
        if ((a.type === 'first' || a.type === 'revisit') && !didReha && Math.random() < loyalty * 0.85) addSchedule(G.day + 2 + Math.floor(Math.random() * 6), 'revisit');
        if (didReha && a.type !== 'rehab') for (let k = 1; k <= 8; k++) addSchedule(G.day + Math.ceil(k * 2.5), 'rehab');
        if (a.type === 'rehab' && !didReha) addSchedule(G.day + 1, 'rehab');
      }
      const n = T.patients;
      if (n > 0) {
        const load = examServed / examCapDay;
        const wait = clamp(7 + load * 26, 5, 45);
        T.waitSum = wait * n; T.waitN = n;
        const sat = clamp(1.25 - wait / 40, 0, 1);
        G.rep += (sat * 100 - G.rep) * Math.min(0.3, 0.01 * n);
      }
      // 断られた患者は評判を下げ、街の噂になる
      if (turnedAway > 0) G.rep = Math.max(20, G.rep - Math.min(4, turnedAway * 0.08));
    }
    endDay();
    renderKpiStrip();
  }

  /* ================= デバッグフック(検証用) ================= */

  window.GAME = {
    G, settings, clinic, town, KIJUN, REHA_FEE, KPIS, REL_DEF, autoDay,
    grant: (n) => { G.money += n; updateHeader(); }
  };
  $('skipBtn').addEventListener('click', () => {
    if (tutIdx >= 0) return;
    autoDay();
    banner(`⏩ Day ${G.day - 1} を自動運営でスキップしました`);
  });

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
  applyUnlocks();
  renderSchedule();
  renderShop();
  renderTodo();
  renderPnl();
  renderMissions();
  renderPlanner();
  renderBank();
  renderCorp();
  renderAds();
  renderKpiPicker();
  renderKpiStrip();
  renderStaffStrip();
  renderVoice();
  updateMissionBar();
  updateHeader();
  $('vExamMean').textContent = `${settings.examMean}分`;
  $('examMean').value = settings.examMean;
  $('vPTreat').textContent = `${Math.round(settings.pTreat * 100)}%`;
  $('pTreat').value = Math.round(settings.pTreat * 100);
  $('vPReha').textContent = `${Math.round(settings.pReha * 100)}%`;
  $('pReha').value = Math.round(settings.pReha * 100);
  $('vPInj').textContent = `${Math.round(settings.pInj * 100)}%`;
  $('pInj').value = Math.round(settings.pInj * 100);
  $('vPTrig').textContent = `${Math.round(settings.pTrig * 100)}%`;
  $('pTrig').value = Math.round(settings.pTrig * 100);
  $('vPPhysio').textContent = `${Math.round(settings.pPhysio * 100)}%`;
  $('pPhysio').value = Math.round(settings.pPhysio * 100);

  clinicIso.resize();
  townIso.resize();
  window.addEventListener('resize', () => { clinicIso.resize(); townIso.resize(); });

  switchTab('clinic');
  if (!G.tutorialDone) startTutorial();
  else if (hasSave) banner(`おかえりなさい — Day ${G.day} から再開します`);

  requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(loop); });
})();
