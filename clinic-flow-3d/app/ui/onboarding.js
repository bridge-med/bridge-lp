/* UI: 導入シナリオ Day 1〜7(v89 便AM-5・社長指示 2026-09-12)。
 * 「今日の経営」の1行目に、その日にやる操作を1つだけ置く。結果の達成(ミッション)とは別物=MISSIONS には触れない。
 * 新規セーブだけに出す(旧セーブは load() で step=7)。Day 8 の朝に「ここからは自由経営」を1行だけ出し、以後は出さない。 */
(function (root) {
  'use strict';
  // 7日の割り当ては既存の解放日に合わせる(Day 4=stage2 でタウン・スタッフが開く、Day 7=週次サマリー)
  const ONBOARD = [
    { day: 1, title: '⏩1日 を押して患者を診る', sub: '売上が入り、夜に結果が出る', goto: 'clinic|#skipBtn', done: (c) => !!c.last },
    { day: 2, title: '待ちが出たら受付か椅子を1つ増やす', sub: '3D 視察で詰まりを見る', goto: 'clinic|#shopCard', done: (c) => c.marks.shop >= 2 || c.marks.walk >= 2 },
    { day: 3, title: '診療方針で単価を作る', sub: '患者数だけでは利益は伸びない', goto: 'clinic|#policyCard', done: (c) => c.marks.policy >= 3 },
    { day: 4, title: '病院か薬局へ営業に行く', sub: '新患は待っていても来ない', goto: 'town|#salesCard', done: (c) => c.marks.sales >= 4 },
    { day: 5, title: 'ライブモニターで戻ってきた患者をタップ', sub: '患者との関係が経営になる', goto: 'clinic|#pulseCard', done: (c) => c.marks.pulse >= 5 || c.marks.walk >= 5 },
    { day: 6, title: 'スタッフ・設備・診療時間を1つ整える', sub: '待ち時間と利益の両立', goto: 'clinic|#scheduleCard', done: (c) => ['shop', 'hire', 'policy', 'schedule'].some((k) => c.marks[k] >= 6) },
    { day: 7, title: '週の振り返りを読む', sub: '売上・利益・患者数・待ち時間・評判', goto: 'learn|#missionCard', done: (c) => c.day >= 8 },
  ];
  const FREE = { title: 'ここからは自由経営', sub: 'ミッションが次の目標。迷ったらこのカード', goto: 'learn|#missionCard' };
  const LAST = 7;

  function create(ctx) {
    const G = ctx.G;
    function state() {
      if (!G.onboard) G.onboard = { step: 0, marks: {} };
      if (!G.onboard.marks) G.onboard.marks = {};
      return G.onboard;
    }
    // 導入中か(新規セーブの Day 1〜7)。旧セーブは step=7 で入ってくる
    function active() { const s = state(); return s.step < LAST && G.day <= LAST; }
    // 操作の痕跡: 何日目に触ったか(done の判定に使う)。UI から delegated listener で呼ぶ
    function mark(key) { const s = state(); if (!s.marks[key] || s.marks[key] < G.day) s.marks[key] = G.day; }
    function ctxNow() {
      const opens = (G.history || []).filter((h) => h.kind !== 'closed');
      return { day: G.day, last: opens[opens.length - 1], marks: state().marks };
    }
    // 今日の経営に置く1行(なければ null)。Day 8 の朝は「自由経営」を1回だけ
    function row() {
      const s = state();
      if (G.day > LAST) {
        if (s.step < LAST) { s.step = LAST; return { tag: '🧭', text: FREE.title, sub: FREE.sub, goto: FREE.goto, now: true, free: true }; }
        return null;
      }
      if (s.step >= LAST) return null;
      const e = ONBOARD[Math.min(G.day, LAST) - 1];
      const done = e.done(ctxNow());
      return { tag: '🧭', text: `Day ${e.day} ${e.title}`, sub: done ? '✅ できた。明日は次の1手' : e.sub, goto: e.goto, now: !done, done };
    }
    // ❓: 7日の一覧(Level2・押したときだけ)
    function guideHtml() {
      const s = state();
      return `<ol class="onb-list">${ONBOARD.map((e) => `<li class="${G.day === e.day ? 'now' : G.day > e.day ? 'past' : ''}"><b>Day ${e.day}</b> ${e.title}<small>${e.sub}</small></li>`).join('')}</ol><p class="modal-note">${s.step >= LAST || G.day > LAST ? FREE.title + '。' : '1日1つ。終わると次の日に進む。'}</p>`;
    }
    // 痕跡の収集(描画側に手を入れない)
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target : null; if (!t) return;
      if (t.closest('#shopCard [data-buy], #shopCard .op-btn')) mark('shop');
      else if (t.closest('#hireCard [data-buy]')) mark('hire');
      else if (t.closest('#walkBtn, #walkTownBtn')) mark('walk');
      else if (t.closest('#pulseCard canvas, #pulseCard .pulse-list, #pulseCard [data-rid]')) mark('pulse');
      else if (t.closest('#salesCard button, #salesCard [data-visit], #townStage')) mark('sales');
      else if (t.closest('#scheduleCard button')) mark('schedule');
      else if (t.closest('#policyCard button')) mark('policy');
    }, true);
    document.addEventListener('change', (e) => { if (e.target.closest && e.target.closest('#policyCard')) mark('policy'); }, true);
    return { active, row, mark, guideHtml, LAST };
  }
  root.UI_ONBOARD = { create, ONBOARD };
})(window);
