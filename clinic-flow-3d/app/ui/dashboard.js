/* UI: ダッシュボード(HUD・ミッション帯・今日やること)。game.js から抽出(v86 便AM-2)。挙動・文言は不変 */
(function (root) {
  'use strict';
  function create(ctx) {
    const { $, yen, yenShort, G, MISSIONS, onboard, WEEKDAYS, weekdayOf, specOf, ensureWeather, fmtClock, missionApplies, bottleneckInfo, todayKey, pickChallenge, requestHtml, bindGoto, showQuizModal, toast, save, SND } = ctx;
  function updateHeader() {
    if (G.speed > 4) ctx.enforceSpeedPass();
    const spec = G.daySpec || specOf(G.day);
    const wxh = ensureWeather();
    $('hDay').textContent = `${G.day} ${WEEKDAYS[weekdayOf(G.day)]}`; // 値は「N 曜」だけ(午前/休診はラベル側。列幅に収める・qa v87)
    const dl = $('hDayLabel'); if (dl) dl.textContent = spec.kind === 'am' ? 'Day 午前' : spec.kind === 'closed' ? 'Day 休診' : `Day ${wxh.icon}`; // 午前/休診の日は天気の代わりに区分(列幅に収める)
    $('hDay').title = `天気: ${wxh.label}${wxh.note ? ' — ' + wxh.note : ''}`;
    $('hClock').textContent = spec.kind === 'closed' ? '' : fmtClock(G.t);
    $('hMoney').textContent = yenShort(G.money);
    $('hMoney').title = yen(G.money);
    $('hMoney').classList.toggle('neg', G.money < 0);
    $('hPatients').textContent = `${G.today ? G.today.patients : 0}人`;
    $('hToday').textContent = yenShort(G.today ? G.today.revenue : 0);
    $('hToday').title = yen(G.today ? G.today.revenue : 0);
    $('hRep').textContent = Math.round(G.rep);
    const ms = ctx.medScoreNow();
    $('hMed').textContent = `${ms.score}`;
    $('hMed').title = `医療(適切な算定)スコア ${ms.score}点 ${ms.grade}(月内・要件どおりの算定 ${ms.proper}/60・判定の保留 ${ms.clean}/20・理解 ${ms.quiz}/20)`;
    const hm = $('hMedal'); if (hm) hm.textContent = `🪙 ${G.coins || 0}`;
    const ha = $('hAw'); if (ha) ha.textContent = `${Math.round(G.aw * 100)}%`;
  }

  function updateMissionBar() {
    if (!$('missionText')) return; // v87: ミッション帯は廃止(決裁②)。ミッションは「今日の経営」の1行目
    const m = MISSIONS[G.missionIdx];
    const lap = G.prestige && G.prestige.count > 0 ? `🏛${G.prestige.count + 1}周目 ` : '';
    const vis = MISSIONS.filter(missionApplies);
    $('missionText').textContent = lap + (m ? `MISSION ${vis.indexOf(m) + 1}/${vis.length}: ${m.title}` : '🏆 全ミッション制覇。街いちばんの医療法人だ — 殿堂入りはいつでも(経営タブ)');
  }

  // 今日の経営(v87 便AM-3): 1〜3行。①ミッション(進捗+タップ先) ②いまの詰まりの打ち手 ③依頼。クイズは末尾のチップ
  function firstSentence(t) { const m = String(t).split(/[。(]/)[0]; return m.length > 44 ? m.slice(0, 44) + '…' : m; }
  function renderTodo() {
    const el = $('todoBody');
    if (!el) return;
    const m = MISSIONS[G.missionIdx];
    const opens = G.history.filter((h) => h.kind !== 'closed');
    const h = opens[opens.length - 1];
    const bn = bottleneckInfo();
    const today = todayKey();
    const ch = pickChallenge(today);
    const chDone = G.daily && G.daily.chDone === today;
    const chState = G.daily && G.daily.chDay === today ? G.daily.chState : '';
    let reqRow;
    if (chDone) {
      reqRow = `<p>${requestHtml(ch, 20)} — <b class="daily-done">✅ クリア済み</b></p>`;
    } else if (chState === 'ok') {
      reqRow = `<p>${requestHtml(ch, 20)} — <b class="req-on">📋 受注中(今日の診療で達成を)</b></p>`;
    } else if (chState === 'pass') {
      reqRow = `<p class="req-passed">今日はパスしました。${typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[ch.char].name : ''}「わかりました、また明日相談しますね」</p>`;
    } else {
      reqRow = `<p>${requestHtml(ch, 20)}</p><div class="fix-row"><button class="fix-chip" data-chact="ok">受ける</button><button class="fix-chip ghost" data-chact="pass">今日はパス</button></div>`;
    }
    const rows = [];
    const ob = onboard && onboard.row(); // 導入 Day1〜7 の1行(新規セーブだけ・v89)
    if (ob) rows.push(ob);
    if (m) rows.push({ tag: '🎯', text: m.title, sub: m.prog ? m.prog(h) : '', goto: m.goto || 'mgmt|#missionCard', now: true });
    if (bn.fixes.length) rows.push({ tag: '🔍', text: bn.fixes[0].label, sub: firstSentence(bn.text), goto: `${bn.fixes[0].tab}|${bn.fixes[0].sel}` });
    // 行の識別は番号でなくタグ(🎯/🔍/📅)。番号は詰まりの有無で日ごとに動くため置かない(designer v87)
    const onb = !!(onboard && onboard.active());
    const shown = rows.slice(0, onb ? 3 : 2); // 行は最大3(導入中は3・通常は2+依頼)
    const rowHtml = shown.map((r) => `<button class="td-row${r.now ? ' now' : ''}${r.done ? ' done' : ''}" data-goto="${r.goto}"><span class="td-num">${r.tag}</span><span class="td-body"><span class="td-text">${r.text}</span>${r.sub ? `<small class="td-sub">${r.sub}</small>` : ''}</span><span class="td-go">→</span></button>`).join('');
    const reqHtml = `<div class="td-row td-req"><span class="td-num">📅</span><div class="td-body"><span class="todo-tag daily">依頼</span><div class="req-body">${reqRow}</div></div></div>`;
    // 導入中(Day1〜7)は依頼とクイズを出さない=1日1つに絞る(文字量・第8条)
    el.innerHTML = onb ? rowHtml : `${rowHtml}${reqHtml}<div class="td-foot"><span class="todo-tag quiz">🧠 クイズ</span>${G.daily && G.daily.quizDone === today ? '<b class="daily-done">✅ 本日の算定クイズはクリア済み</b>' : '<button class="fix-chip" id="quizBtn">算定◯×クイズに挑戦(🪙+1)</button>'}</div>`;
    bindGoto(el);
    const qb = $('quizBtn');
    if (qb) qb.addEventListener('click', () => { SND.click(); showQuizModal(); });
    el.querySelectorAll('[data-chact]').forEach((b) => b.addEventListener('click', () => {
      G.daily.chDay = today;
      G.daily.chState = b.dataset.chact;
      const name = typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[ch.char].name : 'スタッフ';
      toast(b.dataset.chact === 'ok' ? `📋 ${name}「ありがとうございます! お願いします!」` : `💬 ${name}「了解です、無理は禁物ですから」`);
      renderTodo(); save();
    }));
  }
    return { updateHeader, updateMissionBar, renderTodo };
  }
  root.UI_DASH = { create };
})(window);
