/* クリニックタウン3D — 経済モデル・ミッション・チュートリアル・UI統合
 * 教育の核:
 *   売上 = 患者数 × 診療単価
 *   患者数 = 新患(認知 × 評判 × 競合) + 再診(治療計画 × 患者体験)
 *   単価 = 診療の中身(初再診・処置・リハ・健診・施設基準)
 *   利益 = 売上 − 固定費 − 変動費 − 広告費
 */

'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const yen = (n) => `¥${Math.round(n).toLocaleString()}`;

  /* ================= 定数 ================= */

  const DAY_MIN = 480;          // 9:00-17:00
  const INTAKE_END = 420;       // 16:00 受付終了
  const RIVAL_REP = 65;

  const FEES = {
    first: 2900, revisit: 1300, rehab: 1300, checkup: 8000,
    treat: 1200, rehaII: 3400, rehaI: 4900
  };

  const COSTS = {
    doctorDay: 80000, nurseDay: 18000, ptDay: 16000, recepDay: 10000,
    rent: 25000, base: 8000, perPatient: 300, billboardDay: 3000, loanInterest: 5000
  };

  const SHOP = {
    doctor:  { label: '医師を採用',      cost: 200000, max: 3, day: COSTS.doctorDay, hint: '診察室が1室増える(日給¥80,000)' },
    nurse:   { label: '看護師を採用',    cost: 80000,  max: 3, day: COSTS.nurseDay,  hint: '処置ベッドの稼働数=看護師数(日給¥18,000)' },
    pt:      { label: 'PTを採用',        cost: 60000,  max: 6, day: COSTS.ptDay,    hint: 'リハ機器の稼働数=PT×2(日給¥16,000)' },
    recep:   { label: '受付を増員',      cost: 40000,  max: 2, day: COSTS.recepDay,  hint: '受付窓口が2つになる(日給¥10,000)' },
    chairs:  { label: '待合椅子を+2脚',  cost: 30000,  max: 12, step: 2, hint: '立ち待ちはクレームと離反のもと' },
    beds:    { label: '処置ベッドを増設', cost: 100000, max: 3, hint: '処置は1件+¥1,200。看護師とセットで機能する' },
    machines:{ label: 'リハ機器を増設',  cost: 150000, max: 6, hint: 'リハは1回+¥3,400〜。施設基準の要件にもなる' }
  };

  const MISSIONS = [
    { id: 'profit', title: '1日を黒字で終える', reward: 100000,
      lesson: '損益分岐点 = 固定費 ÷ 1人あたり粗利。外来は固定費型ビジネスなので、まず「1日何人で黒字か」を頭に入れる。人件費・家賃は患者が0人でも出ていく。' },
    { id: 'wait', title: '平均待ち時間15分以下の日をつくる(来院15人以上)', reward: 100000,
      lesson: '待ち時間は最大の離反要因。回転は「診察時間×診察室数」だけでなく、受付・会計の詰まりでも決まる。ボトルネックは常に1か所ずつ潰す。' },
    { id: 'aware', title: '商圏の認知率を50%にする', reward: 150000,
      lesson: '広告は「良さ」を伝える道具ではなく「知られていない」を解く道具。認知×評判×アクセスの掛け算で新患は決まる。評判が低いうちに広告を打つと逆効果。' },
    { id: 'reha', title: '運動器リハ(II)を届け出て、リハ実施10件/日', reward: 200000,
      lesson: '単価は「診療の中身」で決まる。整形外来の柱はリハ:1回あたり+¥3,400〜、しかも計画的に通院が続く=LTVが大きい。PT・機器・施設基準の3点セットで立ち上がる。' },
    { id: 'tie', title: '病院・ケアマネの両方と連携する', reward: 200000,
      lesson: '紹介は最強の新患チャネル。広告と違い「必要性が確定した患者」が来る。連携は一度作れば継続的に流れる資産になる。ただし提供できる医療(リハ体制)がないと始まらない。' },
    { id: 'rep', title: '評判を75にする', reward: 200000,
      lesson: '評判は患者体験の積分。待たせない・ちゃんと治る(リハ完遂)・口コミに応える。評判70を超えると広告なしで認知が広がり始める=最も安い集患。' },
    { id: 'revenue', title: '月商(直近30日売上)¥8,000,000', reward: 500000,
      lesson: 'バリューアップの順番: ①守り(基準・算定漏れ)→②回転(待ち時間)→③単価(リハ・処置)→④新患(紹介・広告)。患者数×単価、どちらを動かす打ち手かを常に意識する。' }
  ];

  const TEXTBOOK = [
    { t: '① 売上 = 患者数 × 単価', b: 'すべての打ち手はこのどちらか(または両方)を動かす。「今日やったことはどちらを動かしたか?」を毎日問う。' },
    { t: '② 患者数 = 新患 + 再診', b: '新患は「認知×評判×アクセス」の掛け算。再診は「治療計画×患者体験」。新患獲得コストは再診維持コストの5倍以上と言われる。' },
    { t: '③ 単価 = 診療の中身', b: '初再診料に、処置・リハ・検査・加算が積み上がる。医学的必要性が大前提。その上で「必要なのに提供できていない医療」がないかを探す。' },
    { t: '④ 外来は固定費型ビジネス', b: '人件費・家賃は患者0人でも出ていく。損益分岐点(何人で黒字か)を必ず把握する。稼働率が命。' },
    { t: '⑤ 待ち時間は最大の離反要因', b: '医療の質は患者には見えにくいが、待ち時間は誰にでも見える。予約制・動線設計・会計の自動化で「体感待ち時間」を削る。' },
    { t: '⑥ リハはLTVで考える', b: 'リハ1回の単価より「1人の患者が完遂までに何回通うか」。中断率を下げる(=体験を良くする)ことが最大のリハ収益改善。' },
    { t: '⑦ 紹介は資産、広告は費用', b: '病院・ケアマネ・患者本人からの紹介は、作るのに時間がかかるが継続的に流れる。広告は止めた瞬間に止まる。両方使い、徐々に紹介の比率を上げる。' },
    { t: '⑧ バリューアップの順番', b: '①守り(施設基準・算定漏れ・労務)→②回転(待ち時間・動線)→③単価(リハ・処置)→④新患(紹介・広告)。順番を飛ばすと、増えた新患が悪い体験を拡散する。' }
  ];

  /* ================= 状態 ================= */

  const SAVE_KEY = 'clinicTown_v1';

  const settings = {
    doctors: 1, nurses: 1, pts: 0, receptionists: 1,
    chairs: 6, beds: 1, machines: 0,
    kiosk: false, reserve: false, reviewCare: false,
    rehaLevel: 0,
    examMean: 6, pTreat: 0.25, pReha: 0.35
  };

  const G = {
    money: 2000000, rep: 55, aw: 0.35,
    day: 1, t: 0, speed: 1,
    listing: 0, billboard: false,
    hospitalTie: false, caremaneTie: false, companyTie: false,
    loans: 0,
    schedule: {},           // day -> {revisit, rehab}
    arrivals: [], nextArrivalIdx: 0,
    today: null, history: [],
    missionIdx: 0, missionDone: [],
    tutorialDone: false,
    plan: null,             // 事業計画 {revenue, patientsPerDay, rehaPerDay, staff:{...}, startDay}
    monthRevenue: () => G.history.slice(-30).reduce((a, d) => a + d.revenue, 0) + (G.today ? G.today.revenue : 0)
  };

  function newToday() {
    return { revenue: 0, cost: 0, profit: 0, patients: 0, waitSum: 0, waitN: 0, rehaCount: 0,
      rev: { consult: 0, treat: 0, reha: 0, checkup: 0 } };
  }

  /* ================= セーブ/ロード ================= */

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        settings, g: {
          money: G.money, rep: G.rep, aw: G.aw, day: G.day,
          listing: G.listing, billboard: G.billboard,
          hospitalTie: G.hospitalTie, caremaneTie: G.caremaneTie, companyTie: G.companyTie,
          loans: G.loans, schedule: G.schedule, history: G.history.slice(-40),
          missionIdx: G.missionIdx, missionDone: G.missionDone, tutorialDone: G.tutorialDone,
          plan: G.plan
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

  const clinicIso = new Iso($('clinicStage'), CLINIC.W, CLINIC.H, { maxTileW: 58 });
  const townIso = new Iso($('townStage'), TOWN.W, TOWN.H, { maxTileW: 52, topPad: 1.6 });

  const clinic = new CLINIC.ClinicSim(settings, {
    onDischarge(p, report) {
      let revenue = 0;
      const T = G.today;
      if (report.type === 'first') { revenue += FEES.first; T.rev.consult += FEES.first; }
      if (report.type === 'revisit' || report.type === 'rehab') { revenue += FEES.revisit; T.rev.consult += FEES.revisit; }
      if (report.type === 'checkup') { revenue += FEES.checkup; T.rev.checkup += FEES.checkup; }
      for (const it of report.items) {
        if (it === 'treat') { revenue += FEES.treat; T.rev.treat += FEES.treat; }
        if (it === 'reha') {
          const f = settings.rehaLevel === 2 ? FEES.rehaI : FEES.rehaII;
          revenue += f; T.rev.reha += f; T.rehaCount++;
        }
      }
      T.revenue += revenue;
      T.patients++;
      T.waitSum += report.wait; T.waitN++;

      // 満足度 → 評判
      let sat = Math.max(0, Math.min(1, 1.25 - report.wait / 40));
      if (report.didReha) sat = Math.min(1, sat + 0.1);
      G.rep += (sat * 100 - G.rep) * 0.02;

      // 再診・リハ通院の予約(治療計画)
      const showBoost = settings.reserve ? 0.05 : 0;
      if ((report.type === 'first' || report.type === 'revisit') && !report.didReha && Math.random() < 0.45 * sat + showBoost) {
        addSchedule(G.day + 2 + Math.floor(Math.random() * 6), 'revisit');
      }
      if (report.didReha && report.type !== 'rehab') {
        // リハ初回 → 通院コース(約8回)を計画
        for (let k = 1; k <= 8; k++) addSchedule(G.day + Math.ceil(k * 2.5), 'rehab');
      }
      if (report.type === 'rehab' && Math.random() < 0.12 * (1 - sat)) {
        // 体験が悪いとコース中断(以後の来院が1つ消える)
        removeSchedule('rehab');
      }
      updateHeader();
      return revenue;
    }
  });

  const town = new TOWN.TownSim({
    onPatientArrive(wk) {
      // タウンを歩いてきた患者が院内に入る
      clinic.spawn(wk.type, { refer: wk.refer });
    }
  });

  function dispatchArrival(a) {
    town.requestVisit(a.type, a.source, a.refer);
  }

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

  function planDay() {
    const arrivals = [];
    const push = (type, source, refer) => arrivals.push({ t: 0, type, source, refer: !!refer });

    // 新患: 商圏 × 認知 × 評判シェア
    const share = G.rep / (G.rep + RIVAL_REP);
    const newMean = 60 * G.aw * share;
    const nNew = Math.max(0, Math.round(newMean + (Math.random() * 4 - 2)));
    for (let i = 0; i < nNew; i++) push('first', 'house');

    // 駅看板の駅利用者
    if (G.billboard) for (let i = 0; i < 1 + Math.round(Math.random()); i++) push('first', 'station');

    // 紹介
    if (G.hospitalTie) for (let i = 0; i < 2; i++) push('first', 'hospital', true);
    if (G.caremaneTie && settings.rehaLevel > 0) push('first', 'caremane', true);

    // 健診
    if (G.companyTie) for (let i = 0; i < 3; i++) push('checkup', 'station');

    // 再診・リハ(予約済み)
    const due = G.schedule[G.day] || { revisit: 0, rehab: 0 };
    const showRate = 0.75 + 0.2 * (G.rep / 100) + (settings.reserve ? 0.05 : 0);
    for (let i = 0; i < due.revisit; i++) if (Math.random() < showRate) push('revisit', 'house');
    for (let i = 0; i < due.rehab; i++) if (Math.random() < showRate) push('rehab', 'house');
    delete G.schedule[G.day];

    // 来院時刻を割り当て
    arrivals.forEach((a) => {
      if (settings.reserve) {
        a.t = 10 + Math.random() * (INTAKE_END - 30); // 予約でならされる
      } else {
        // 午前に山ができる
        a.t = Math.random() < 0.62 ? triRand(0, 210) : triRand(210, INTAKE_END);
      }
    });
    arrivals.sort((a, b) => a.t - b.t);
    G.arrivals = arrivals;
    G.nextArrivalIdx = 0;
    G.today = newToday();
  }

  /* ================= 日次決算 ================= */

  function dayCost() {
    let c = COSTS.rent + COSTS.base;
    c += (settings.doctors - 1) * COSTS.doctorDay;
    c += settings.nurses * COSTS.nurseDay;
    c += settings.pts * COSTS.ptDay;
    c += settings.receptionists * COSTS.recepDay;
    c += G.listing;
    if (G.billboard) c += COSTS.billboardDay;
    c += G.loans * COSTS.loanInterest;
    c += (G.today ? G.today.patients : 0) * COSTS.perPatient;
    return c;
  }

  function endDay() {
    const T = G.today;
    T.cost = dayCost();
    T.profit = T.revenue - T.cost;
    T.avgWait = T.waitN ? T.waitSum / T.waitN : 0;
    G.money += T.profit;
    G.history.push({ day: G.day, revenue: T.revenue, cost: T.cost, profit: T.profit, patients: T.patients, avgWait: T.avgWait, rehaCount: T.rehaCount });

    // 認知の変化
    let dAw = G.listing / 20000 * 0.03 - 0.004;
    if (G.billboard) dAw += 0.015;
    if (G.rep >= 70) dAw += 0.01; else if (G.rep >= 60) dAw += 0.005;
    if (settings.reviewCare) dAw += 0.004;
    G.aw = Math.max(0.05, Math.min(0.95, G.aw + dAw));
    if (settings.reviewCare) G.rep = Math.min(100, G.rep + 0.3);

    // 施設基準の要件チェック(割れたら自動降格)
    if (settings.rehaLevel === 2 && !(settings.pts >= 3 && settings.machines >= 4)) {
      settings.rehaLevel = settings.pts >= 1 && settings.machines >= 1 ? 1 : 0;
      toast('⚠️ 施設基準の要件割れ! 運動器リハ(I)を維持できず降格しました');
    } else if (settings.rehaLevel === 1 && !(settings.pts >= 1 && settings.machines >= 1)) {
      settings.rehaLevel = 0;
      toast('⚠️ 施設基準の要件割れ! リハの届出を維持できません');
    }

    checkMission(T);

    // 資金ショート → 緊急融資
    if (G.money < -300000) {
      G.money += 1000000;
      G.loans++;
      showModal('🏦 緊急融資', `<p>資金がショートしました。銀行から <b>¥1,000,000</b> の緊急融資を受けました。</p><p>以後、利息として <b>1日¥5,000</b>(融資${G.loans}件分: ¥${(G.loans * 5000).toLocaleString()}/日)が費用に乗ります。</p><p class="modal-note">借入は時間を買う道具。ただし利息は固定費になる — 返済原資となる「日次黒字」の目処を先に立てるのが鉄則です。</p>`, '経営を続ける');
    }

    banner(`Day ${G.day} 終了 — 売上 ${yen(T.revenue)} / 費用 ${yen(T.cost)} / 損益 <b class="${T.profit >= 0 ? 'pos' : 'neg'}">${T.profit >= 0 ? '+' : ''}${yen(T.profit)}</b>`);

    G.day++;
    G.t = 0;
    planDay();
    save();
    renderPnl();
    renderPlanner();
    updateHeader();
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
      case 'revenue': done = G.monthRevenue() >= 8000000; break;
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
    $('missionText').textContent = m ? `MISSION ${G.missionIdx + 1}/${MISSIONS.length}: ${m.title}` : '🏆 全ミッション制覇! あとは自由に街一番のクリニックへ';
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
    if (tab === 'town') townIso.resize();
    if (tab === 'mgmt') { renderPnl(); renderMissions(); renderPlanner(); }
  }

  /* ================= UI: 院内パネル ================= */

  function buy(key) {
    const item = SHOP[key];
    const cur = settingValue(key);
    const step = item.step || 1;
    if (cur + step > item.max) { toast('これ以上は増やせません'); return; }
    if (G.money < item.cost) { toast('資金が足りません'); return; }
    G.money -= item.cost;
    setSettingValue(key, cur + step);
    clinic.applySettings();
    renderShop();
    updateHeader();
    save();
  }
  function fire(key) {
    const cur = settingValue(key);
    const min = { doctor: 1, nurse: 0, pt: 0, recep: 1, chairs: 2, beds: 0, machines: 0 }[key];
    const step = SHOP[key].step || 1;
    if (cur - step < min) { toast('これ以上は減らせません'); return; }
    setSettingValue(key, cur - step);
    clinic.applySettings();
    renderShop();
    save();
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

  function renderShop() {
    const rows = Object.entries(SHOP).map(([key, item]) => {
      const cur = settingValue(key);
      return `
      <div class="shop-row">
        <div class="shop-info">
          <span class="shop-name">${item.label} <b class="shop-count">${cur}${item.day ? '人' : ''}</b></span>
          <span class="shop-hint">${item.hint}</span>
        </div>
        <div class="shop-btns">
          <button class="mini-btn" data-fire="${key}">−</button>
          <button class="mini-btn plus" data-buy="${key}">＋ ${yen(item.cost)}</button>
        </div>
      </div>`;
    }).join('');
    $('shopList').innerHTML = rows;
    $('shopList').querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
    $('shopList').querySelectorAll('[data-fire]').forEach((b) => b.addEventListener('click', () => fire(b.dataset.fire)));

    // 運用トグル
    $('opReserve').classList.toggle('on', settings.reserve);
    $('opKiosk').classList.toggle('on', settings.kiosk);
    $('opReview').classList.toggle('on', settings.reviewCare);
  }

  $('opReserve').addEventListener('click', () => {
    if (!settings.reserve) {
      if (G.money < 50000) { toast('資金が足りません(¥50,000)'); return; }
      G.money -= 50000;
      settings.reserve = true;
      toast('予約制を導入しました。来院が1日にならされ、再診の来院率も上がります');
    } else { settings.reserve = false; }
    renderShop(); updateHeader(); save();
  });
  $('opKiosk').addEventListener('click', () => {
    if (!settings.kiosk) {
      if (G.money < 300000) { toast('資金が足りません(¥300,000)'); return; }
      G.money -= 300000;
      settings.kiosk = true;
      clinic.applySettings();
      toast('自動精算機を設置しました。会計の詰まりが解消されます');
    } else { settings.kiosk = false; clinic.applySettings(); }
    renderShop(); updateHeader(); save();
  });
  $('opReview').addEventListener('click', () => {
    settings.reviewCare = !settings.reviewCare;
    toast(settings.reviewCare ? 'クチコミに丁寧に返信する方針にしました(評判が少しずつ回復)' : 'クチコミ返信をやめました');
    renderShop(); save();
  });

  $('examMean').addEventListener('input', (e) => { settings.examMean = Number(e.target.value); $('vExamMean').textContent = `${settings.examMean}分`; save(); });
  $('pTreat').addEventListener('input', (e) => { settings.pTreat = Number(e.target.value) / 100; $('vPTreat').textContent = `${e.target.value}%`; save(); });
  $('pReha').addEventListener('input', (e) => { settings.pReha = Number(e.target.value) / 100; $('vPReha').textContent = `${e.target.value}%`; save(); });

  /* ================= UI: タウン ================= */

  $('listing').addEventListener('input', (e) => {
    G.listing = Number(e.target.value);
    $('vListing').textContent = G.listing === 0 ? 'なし' : `${yen(G.listing)}/日`;
    save();
  });

  const TOWN_ACTIONS = {
    hospital: () => G.hospitalTie
      ? { title: '市民総合病院', body: '<p>🤝 連携済み。退院後の患者さんが毎日紹介されてきます(紹介患者は処置・リハの必要性が高い)。</p>' }
      : { title: '市民総合病院と連携する', cost: 50000, key: 'hospitalTie',
          body: '<p>地域連携室へ挨拶に行き、退院後のリハ・処置が必要な患者さんの受け皿になることを提案します。</p><p><b>効果:</b> 紹介患者 +2人/日(処置・リハ率が高い)</p><p><b>費用:</b> ¥50,000(訪問・資料・関係構築)</p>' },
    caremane: () => G.caremaneTie
      ? { title: 'ケアマネ事業所', body: '<p>🤝 連携済み。リハが必要な利用者さんが紹介されてきます。</p>' }
      : settings.rehaLevel === 0
        ? { title: 'ケアマネ事業所', body: '<p>「リハビリの体制がないと、うちからはご紹介できません」<br>まず院内でリハ(PT・機器・施設基準)を立ち上げましょう。</p><p class="modal-note">📖 連携営業は「提供できる医療」が先。営業トークでは埋まりません。</p>' }
        : { title: 'ケアマネ事業所と連携する', cost: 20000, key: 'caremaneTie',
            body: '<p>担当者会議に顔を出し、リハの受け入れ体制と空き状況を共有します。</p><p><b>効果:</b> リハ紹介 +1人/日</p><p><b>費用:</b> ¥20,000</p>' },
    company: () => G.companyTie
      ? { title: '運送会社', body: '<p>🤝 健診契約済み。従業員の定期健診が毎日数件入ります(単価¥8,000)。</p>' }
      : { title: '運送会社に健診営業する', cost: 30000, key: 'companyTie',
          body: '<p>従業員120人の定期健診契約を提案します。</p><p><b>効果:</b> 健診 +3件/日(単価¥8,000・診察は短時間)</p><p><b>費用:</b> ¥30,000(提案・見積もり)</p><p class="modal-note">📖 健診は「保険外の安定収入」。ただし現場の負荷と引き換え。</p>' },
    station: () => G.billboard
      ? { title: '駅前看板', body: '<p>掲出中(維持費 ¥3,000/日)。駅利用者からの新患と認知の広がりに効いています。</p>' }
      : { title: '駅前看板を出す', cost: 100000, key: 'billboard',
          body: '<p>駅前ロータリーの看板枠に広告を掲出します。</p><p><b>効果:</b> 認知 +1.5%/日、駅利用者の新患 +1〜2人/日</p><p><b>費用:</b> ¥100,000(制作・掲出)+ ¥3,000/日</p>' },
    rival: () => ({ title: 'ライバル整形外科', body: `<p>駅の東側に立つ、開業15年の整形外科。評判は ${RIVAL_REP}。</p><p>新患はあなたの評判とライバルの評判の比で分け合っています。<b>相手を下げる手はありません — 自院の評判と認知を上げるだけ。</b></p><p class="modal-note">📖 競合分析は「相手を知って自分の差別化を決める」ためのもの。悪口はNG、違いを作るのが仕事。</p>` }),
    clinic: () => ({ title: 'あなたのクリニック', body: `<p>承継したばかりの整形外科クリニック。院内の様子は「🏥 院内」タブでどうぞ。</p><p>現在: 医師${settings.doctors}人 / 看護師${settings.nurses}人 / PT${settings.pts}人 / 評判${Math.round(G.rep)} / 認知${Math.round(G.aw * 100)}%</p>` })
  };

  $('townStage').addEventListener('click', (e) => {
    const rect = $('townStage').getBoundingClientRect();
    const tile = townIso.unproject(e.clientX - rect.left, e.clientY - rect.top);
    const b = town.buildingAt(tile);
    if (!b || !TOWN_ACTIONS[b.id]) return;
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

  /* ================= UI: 経営タブ ================= */

  function renderPnl() {
    const T = G.today || newToday();
    const cost = dayCost();
    $('pnlToday').innerHTML = `
      <div class="pnl-row"><span>外来収益(初再診料)</span><b>${yen(T.rev.consult)}</b></div>
      <div class="pnl-row"><span>処置</span><b>${yen(T.rev.treat)}</b></div>
      <div class="pnl-row"><span>リハビリ(${T.rehaCount}件)</span><b>${yen(T.rev.reha)}</b></div>
      <div class="pnl-row"><span>健診</span><b>${yen(T.rev.checkup)}</b></div>
      <div class="pnl-row total"><span>売上合計(${T.patients}人)</span><b>${yen(T.revenue)}</b></div>
      <div class="pnl-row"><span>人件費</span><b>−${yen((settings.doctors - 1) * COSTS.doctorDay + settings.nurses * COSTS.nurseDay + settings.pts * COSTS.ptDay + settings.receptionists * COSTS.recepDay)}</b></div>
      <div class="pnl-row"><span>家賃・固定費</span><b>−${yen(COSTS.rent + COSTS.base)}</b></div>
      <div class="pnl-row"><span>広告費</span><b>−${yen(G.listing + (G.billboard ? COSTS.billboardDay : 0))}</b></div>
      <div class="pnl-row"><span>変動費(材料ほか)</span><b>−${yen(T.patients * COSTS.perPatient)}</b></div>
      ${G.loans ? `<div class="pnl-row"><span>借入利息(${G.loans}件)</span><b>−${yen(G.loans * COSTS.loanInterest)}</b></div>` : ''}
      <div class="pnl-row total ${T.revenue - cost >= 0 ? 'pos' : 'neg'}"><span>本日の見込み損益</span><b>${T.revenue - cost >= 0 ? '+' : ''}${yen(T.revenue - cost)}</b></div>
      <div class="pnl-note">人件費率(本日): ${T.revenue > 0 ? Math.round(staffCostOf(settings) / T.revenue * 100) + '%' : '–'}(目安 45〜55%)</div>
    `;
    $('pnlMonth').textContent = yen(G.monthRevenue());

    // 直近14日の損益バー
    const hist = G.history.slice(-14);
    const maxAbs = Math.max(50000, ...hist.map((h) => Math.abs(h.profit)));
    $('pnlChart').innerHTML = hist.map((h) => {
      const hpx = Math.max(3, Math.abs(h.profit) / maxAbs * 46);
      return `<div class="bar-col" title="Day${h.day}: ${yen(h.profit)}"><div class="bar ${h.profit >= 0 ? 'pos' : 'neg'}" style="height:${hpx}px"></div><span>${h.day}</span></div>`;
    }).join('') || '<p class="pnl-empty">まだ実績がありません(1日終えると表示)</p>';

    // 施設基準
    const canII = settings.pts >= 1 && settings.machines >= 1;
    const canI = settings.pts >= 3 && settings.machines >= 4;
    $('kijunBody').innerHTML = `
      <div class="kijun-row ${settings.rehaLevel >= 1 ? 'ok' : ''}">
        <div><b>運動器リハ(II)</b> — リハ1回 ¥3,400<br><small>要件: PT1人以上・機器1台以上 ${canII ? '✅' : '❌'}</small></div>
        ${settings.rehaLevel >= 1 ? '<span class="kijun-badge">届出済</span>' : `<button class="mini-btn plus" id="kijunII" ${canII ? '' : 'disabled'}>届け出る</button>`}
      </div>
      <div class="kijun-row ${settings.rehaLevel >= 2 ? 'ok' : ''}">
        <div><b>運動器リハ(I)</b> — リハ1回 ¥4,900<br><small>要件: PT3人以上・機器4台以上 ${canI ? '✅' : '❌'}</small></div>
        ${settings.rehaLevel >= 2 ? '<span class="kijun-badge">届出済</span>' : `<button class="mini-btn plus" id="kijunI" ${canI ? '' : 'disabled'}>届け出る</button>`}
      </div>`;
    const kII = $('kijunII'), kI = $('kijunI');
    if (kII) kII.addEventListener('click', () => { settings.rehaLevel = 1; toast('✅ 運動器リハ(II)を届け出ました。診察からリハへの流れが生まれます'); renderPnl(); save(); });
    if (kI) kI.addEventListener('click', () => { settings.rehaLevel = 2; toast('✅ 運動器リハ(I)! リハ単価が¥4,900に上がりました'); renderPnl(); save(); });
  }

  /* ================= 事業計画(人員計画・予実管理) ================= */

  const PLAN_ROLES = [
    ['doctors', '医師', COSTS.doctorDay, 1, 3, '※院長1人分の人件費は利益から'],
    ['nurses', '看護師', COSTS.nurseDay, 0, 3, ''],
    ['pts', 'PT', COSTS.ptDay, 0, 6, ''],
    ['receptionists', '受付', COSTS.recepDay, 1, 2, '']
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
    const fixed = staffCostOf(d.staff) + COSTS.rent + COSTS.base + G.listing + (G.billboard ? COSTS.billboardDay : 0);
    const bep = Math.ceil(fixed / Math.max(500, unit - COSTS.perPatient));
    const examCap = Math.floor(d.staff.doctors * (480 / (settings.examMean + 1.5)) * 0.72);
    const rehaCap = Math.min(settings.machines, d.staff.pts * 2) * Math.floor(480 / 15);
    const laborRate = d.revenue > 0 ? (staffCostOf(d.staff) * 30) / d.revenue : 1;
    const planProfit = Math.round((d.patientsPerDay * (unit - COSTS.perPatient) - fixed) * 30);
    const msgs = [];
    msgs.push({ lv: 'info', text: `想定単価 ${yen(unit)}/人(直近実績) → 損益分岐点は <b>1日${bep}人</b>` });
    if (d.patientsPerDay < bep) msgs.push({ lv: 'bad', text: `⚠️ 目標${d.patientsPerDay}人/日 < 損益分岐${bep}人/日 — <b>この計画は構造的に赤字</b>。人員を削るか、目標(集患・単価)を上げる` });
    else msgs.push({ lv: 'good', text: `✅ 目標達成時の計画利益: <b>${planProfit >= 0 ? '+' : ''}${yen(planProfit)}/月</b>` });
    if (d.patientsPerDay > examCap) msgs.push({ lv: 'bad', text: `⚠️ 診察キャパ不足 — 医師${d.staff.doctors}人では約${examCap}人/日が限界。医師を増やすか診察時間を見直す` });
    if (d.rehaPerDay > rehaCap) msgs.push({ lv: 'bad', text: `⚠️ リハキャパ不足 — PT${d.staff.pts}人×機器${settings.machines}台では約${rehaCap}件/日が限界` });
    if (laborRate > 0.60) msgs.push({ lv: 'bad', text: `⚠️ 計画人件費率 ${(laborRate * 100).toFixed(0)}% — 目安(45〜55%)を大きく超過。売上目標に対して人が多すぎる` });
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
        <p class="plan-lead">目標と人員をセットで決めます。<b>計画は当てるためではなく、ズレに早く気づくため</b>のもの。</p>
        <div class="plan-form">
          <label class="ctrl">
            <span class="ctrl-head">目標月商(30日) <b>${yen(draft.revenue)}</b></span>
            <input type="range" id="planRev" min="2000000" max="15000000" step="500000" value="${draft.revenue}">
          </label>
          <div class="plan-steppers">
            <div class="plan-step"><span>目標患者数/日</span><div><button class="mini-btn" data-pd="patientsPerDay" data-d="-5">−</button><b>${draft.patientsPerDay}人</b><button class="mini-btn plus" data-pd="patientsPerDay" data-d="5">＋</button></div></div>
            <div class="plan-step"><span>目標リハ件数/日</span><div><button class="mini-btn" data-pd="rehaPerDay" data-d="-5">−</button><b>${draft.rehaPerDay}件</b><button class="mini-btn plus" data-pd="rehaPerDay" data-d="5">＋</button></div></div>
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
        draft[k] = Math.max(0, Math.min(150, draft[k] + Number(b.dataset.d)));
        renderPlanner();
      }));
      el.querySelectorAll('[data-ps]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.ps;
        const role = PLAN_ROLES.find((r) => r[0] === k);
        draft.staff[k] = Math.max(role[3], Math.min(role[4], draft.staff[k] + Number(b.dataset.d)));
        renderPlanner();
      }));
      $('planCommit').addEventListener('click', () => {
        G.plan = { revenue: draft.revenue, patientsPerDay: draft.patientsPerDay, rehaPerDay: draft.rehaPerDay, staff: Object.assign({}, draft.staff), startDay: G.day };
        planEditing = false;
        draft = null;
        toast('📝 事業計画を策定しました。予実のズレを毎日チェックしましょう');
        renderPlanner();
        save();
      });
      const pc = $('planCancel');
      if (pc) pc.addEventListener('click', () => { planEditing = false; draft = null; renderPlanner(); });
      return;
    }

    // ===== 予実管理ビュー =====
    const plan = G.plan;
    const cur = G.monthRevenue();
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
    const bar = (label, now, target, unit) => {
      const p = Math.min(100, target > 0 ? now / target * 100 : 0);
      return `<div class="pv-row"><span class="pv-label">${label}</span>
        <div class="pv-track"><i style="width:${p.toFixed(1)}%" class="${p >= 100 ? 'full' : p >= 70 ? 'mid' : 'low'}"></i></div>
        <span class="pv-num">${now}${unit} / ${target}${unit}</span></div>`;
    };
    el.innerHTML = `
      <div class="pv-head">
        <div class="pv-rev">
          <span>月商目標 ${yen(plan.revenue)} に対して</span>
          <b>${yen(cur)} <small>(${pct.toFixed(0)}%)</small></b>
          <div class="pv-track big"><i style="width:${pct.toFixed(1)}%" class="${pct >= 100 ? 'full' : pct >= 70 ? 'mid' : 'low'}"></i></div>
        </div>
      </div>
      ${bar('患者数/日(7日平均)', Math.round(ptAvg), plan.patientsPerDay, '人')}
      ${bar('リハ件数/日(7日平均)', Math.round(rehaAvg), plan.rehaPerDay, '件')}
      <div class="pv-staff"><span class="pv-label">人員(現在/計画)</span>${staffRows}</div>
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
        <div><b>${m.title}</b>${st === 'done' ? `<p class="mission-lesson">${m.lesson}</p>` : st === 'now' ? '' : ''}</div>
      </div>`;
    }).join('');
    $('textbook').innerHTML = TEXTBOOK.map((c) => `<details class="tb-card"><summary>${c.t}</summary><p>${c.b}</p></details>`).join('');
  }

  /* ================= チュートリアル ================= */

  const TUTORIAL = [
    { tab: null, sel: null, text: 'ようこそ、クリニックタウンへ。あなたはこの街の整形外科クリニックを承継した新オーナー(事務長兼務)です。<b>家々と商店街と駅しかない小さな街</b>で、経営を立て直しましょう。しばらくは前院長のかかりつけ患者さんが来てくれますが、<b>何もしなければ先細り</b>です。' },
    { tab: null, sel: '.hud', text: 'これが経営ダッシュボード。<b>資金</b>が尽きると借金が始まります。<b>評判</b>は患者体験で上下し、<b>認知</b>は「この街の何%があなたの存在を知っているか」。この3つが経営の体温計です。' },
    { tab: 'mgmt', sel: '#formulaCard', text: 'いちばん大事な式がこれ。<b>売上 = 患者数 × 単価</b>。これからやる打ち手は全部「患者数を増やす」か「単価を上げる」のどちらかです。どちらを動かしているか、常に意識してください。' },
    { tab: 'clinic', sel: '#clinicStage', text: 'ここが院内。患者さんが<b>受付→待合→診察→(処置/リハ)→会計</b>と流れます。🔥ボタンで導線ヒートマップ、行列ができたらそこがボトルネック。' },
    { tab: 'clinic', sel: '#shopCard', text: 'スタッフと設備はここで増減。<b>全部自由</b>です。医師を増やせば診察室が増え、PTと機器を揃えればリハ室が動き出す。ただし人件費は毎日出ていく — 固定費との勝負です。' },
    { tab: 'town', sel: '#townStage', text: 'そしてこれが商圏。<b>✓が付いた家 = あなたを知っている家</b>。知られていなければ、どんな名医でも患者は来ません。病院・ケアマネ・企業・駅 — 建物をタップすると営業アクションが打てます。' },
    { tab: 'town', sel: '#marketingCard', text: 'リスティング広告はここ。お金で認知を買えますが、<b>広告は蛇口 — 止めると止まる</b>。紹介や評判という「資産型」の集患と組み合わせるのがコツです。' },
    { tab: 'mgmt', sel: '#pnlCard', text: '毎日17時に決算。売上の中身(初再診・処置・リハ・健診)と費用の構造がここに出ます。<b>リハの積み上げが整形外来の生命線</b>だと、数字が教えてくれるはず。' },
    { tab: 'mgmt', sel: '#plannerCard', text: 'そして<b>事業計画</b>。目標月商と人員計画をセットで立てると、損益分岐点・キャパ・人件費率を自動診断し、以後は<b>予実のズレ</b>を毎日追いかけられます。計画は当てるためではなく、ズレに早く気づくためのもの。' },
    { tab: 'mgmt', sel: '#missionCard', text: 'ミッションが経営のカリキュラムです。<b>①黒字化 → ②待ち時間 → ③認知 → ④リハ → ⑤連携 → ⑥評判 → ⑦月商800万</b>。まずは「1日を黒字で終える」から。健闘を祈ります!' }
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
      let dt = dtReal * G.speed * 3; // ×1 = 3シミュ分/秒
      while (dt > 0) {
        const step = Math.min(0.5, dt);
        stepSim(step);
        dt -= step;
      }
    }
    if (activeTab === 'clinic') clinic.draw(clinicIso, view);
    if (activeTab === 'town') {
      town.setAwareness(G.aw);
      town.draw(townIso, { billboard: G.billboard, hospitalTie: G.hospitalTie, caremaneTie: G.caremaneTie, companyTie: G.companyTie, listing: G.listing });
    }
    updateHeader();
    updateClinicHud();
    requestAnimationFrame(loop);
  }

  function stepSim(dt) {
    G.t += dt;
    // 来院ディスパッチ
    while (G.nextArrivalIdx < G.arrivals.length && G.arrivals[G.nextArrivalIdx].t <= G.t) {
      dispatchArrival(G.arrivals[G.nextArrivalIdx]);
      G.nextArrivalIdx++;
    }
    clinic.tick(dt);
    town.tick(dt);
    // 診療終了判定
    const townPatients = town.walkers.some((w) => w.kind === 'patient');
    if (G.t >= DAY_MIN && !townPatients && clinic.patients.length === 0) endDay();
    else if (G.t >= DAY_MIN + 150) { // 強制クローズ(残患者は翌日に)
      clinic.reset();
      endDay();
    }
  }

  /* ================= デバッグフック(検証用) ================= */

  window.GAME = {
    G, settings, clinic, town,
    endDayNow: () => { G.t = DAY_MIN + 151; },
    grant: (n) => { G.money += n; updateHeader(); }
  };

  /* ================= 起動 ================= */

  const hasSave = load();
  if (!hasSave) {
    // 承継患者: 前院長のかかりつけ患者がしばらく来てくれる(放置すると先細り)
    [8, 7, 7, 6, 6, 5, 5, 4, 4, 3].forEach((n, i) => {
      for (let k = 0; k < n; k++) addSchedule(i + 1, 'revisit');
    });
  }
  clinic.applySettings();
  planDay();
  renderShop();
  renderPnl();
  renderMissions();
  updateMissionBar();
  updateHeader();
  $('vExamMean').textContent = `${settings.examMean}分`;
  $('examMean').value = settings.examMean;
  $('vPTreat').textContent = `${Math.round(settings.pTreat * 100)}%`;
  $('pTreat').value = Math.round(settings.pTreat * 100);
  $('vPReha').textContent = `${Math.round(settings.pReha * 100)}%`;
  $('pReha').value = Math.round(settings.pReha * 100);
  $('listing').value = G.listing;
  $('vListing').textContent = G.listing === 0 ? 'なし' : `${yen(G.listing)}/日`;

  clinicIso.resize();
  townIso.resize();
  window.addEventListener('resize', () => { clinicIso.resize(); townIso.resize(); });

  switchTab('clinic');
  if (!G.tutorialDone) startTutorial();
  else if (hasSave) banner(`おかえりなさい — Day ${G.day} から再開します`);

  requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(loop); });
})();
