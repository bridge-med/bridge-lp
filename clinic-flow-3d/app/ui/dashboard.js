/* UI: ダッシュボード(HUD・ミッション帯・今日やること)。game.js から抽出(v86 便AM-2)。挙動・文言は不変 */
(function (root) {
  'use strict';
  function create(ctx) {
    const { $, yen, G, MISSIONS, WEEKDAYS, weekdayOf, specOf, ensureWeather, fmtClock, missionApplies, bottleneckInfo, todayKey, pickChallenge, requestHtml, bindGoto, showQuizModal, toast, save, SND } = ctx;
  function updateHeader() {
    if (G.speed > 4) ctx.enforceSpeedPass();
    $('hMoney').textContent = yen(G.money);
    $('hMoney').classList.toggle('neg', G.money < 0);
    const hm = $('hMedal');
    if (hm) hm.textContent = `🪙 ${G.coins || 0}`;
    const spec = G.daySpec || specOf(G.day);
    const wxh = ensureWeather();
    $('hDay').textContent = `Day ${G.day}(${WEEKDAYS[weekdayOf(G.day)]}${spec.kind === 'am' ? '·午前' : spec.kind === 'closed' ? '·休診' : ''}) ${wxh.icon}`;
    $('hDay').title = `天気: ${wxh.label}${wxh.note ? ' — ' + wxh.note : ''}`;
    $('hClock').textContent = spec.kind === 'closed' ? '—' : fmtClock(G.t);
    $('hRep').textContent = Math.round(G.rep);
    $('hAw').textContent = `${Math.round(G.aw * 100)}%`;
    $('hToday').textContent = yen(G.today ? G.today.revenue : 0);
  }

  function updateMissionBar() {
    const m = MISSIONS[G.missionIdx];
    const lap = G.prestige && G.prestige.count > 0 ? `🏛${G.prestige.count + 1}周目 ` : '';
    const vis = MISSIONS.filter(missionApplies);
    $('missionText').textContent = lap + (m ? `MISSION ${vis.indexOf(m) + 1}/${vis.length}: ${m.title}` : '🏆 全ミッション制覇。街いちばんの医療法人だ — 殿堂入りはいつでも(経営タブ)');
  }

  function renderTodo() {
    const el = $('todoBody');
    if (!el) return;
    const m = MISSIONS[G.missionIdx];
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
    el.innerHTML = `
      ${m ? `<div class="todo-row"><span class="todo-tag mission">🎯 ミッション</span><p>${m.title}</p></div>` : ''}
      <div class="todo-row"><span class="todo-tag daily">📅 依頼</span><div class="req-body">${reqRow}</div></div>
      <div class="todo-row"><span class="todo-tag quiz">🧠 クイズ</span><p>${G.daily && G.daily.quizDone === today ? '<b class="daily-done">✅ 本日の算定クイズはクリア済み</b>' : '<button class="fix-chip" id="quizBtn">算定◯×クイズに挑戦(🪙+1)</button>'}</p></div>
      <div class="todo-row"><span class="todo-tag">🔍 いまの詰まり</span><p>${bn.text}</p></div>
      ${bn.fixes.length ? `<div class="fix-row">${bn.fixes.map((f) => `<button class="fix-chip" data-goto="${f.tab}|${f.sel}">${f.label} →</button>`).join('')}</div>` : ''}`;
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
