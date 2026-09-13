/* UI: ダッシュボード(HUD・ミッション帯・今日やること)。game.js から抽出(v86 便AM-2)。挙動・文言は不変 */
(function (root) {
  'use strict';
  function create(ctx) {
    const { $, yen, yenShort, G, MISSIONS, onboard, TEXTBOOK, learnBtn, foldAttr, applyLearn, WEEKDAYS, weekdayOf, specOf, ensureWeather, fmtClock, missionApplies, bottleneckInfo, todayKey, pickChallenge, requestHtml, bindGoto, showQuizModal, toast, save, SND } = ctx;
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
    const hm = $('hMedal'); if (hm) hm.innerHTML = `<i data-ic="coin"></i>${G.coins || 0}`;
    const ha = $('hAw'); if (ha) ha.textContent = `${Math.round(G.aw * 100)}%`;
  }

  function updateMissionBar() {
    if (!$('missionText')) return; // v87: ミッション帯は廃止(決裁②)。ミッションは「今日の経営」の1行目
    const m = MISSIONS[G.missionIdx];
    const lap = G.prestige && G.prestige.count > 0 ? `<i data-ic="hall"></i>${G.prestige.count + 1}周目 ` : '';
    const vis = MISSIONS.filter(missionApplies);
    $('missionText').innerHTML = lap + (m ? `MISSION ${vis.indexOf(m) + 1}/${vis.length}: ${m.title}` : '<i data-ic="trophy"></i>全ミッション制覇。街いちばんの医療法人だ — 殿堂入りはいつでも(経営タブ)');
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
      reqRow = `<p>${requestHtml(ch, 20)} — <b class="daily-done"><i data-ic="check"></i>クリア済み</b></p>`;
    } else if (chState === 'ok') {
      reqRow = `<p>${requestHtml(ch, 20)} — <b class="req-on"><i data-ic="clipboard"></i>受注中(今日の診療で達成を)</b></p>`;
    } else if (chState === 'pass') {
      reqRow = `<p class="req-passed">今日はパスしました。${typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[ch.char].name : ''}「わかりました、また明日相談しますね」</p>`;
    } else {
      reqRow = `<p>${requestHtml(ch, 20)}</p><div class="fix-row"><button class="fix-chip" data-chact="ok">受ける</button><button class="fix-chip ghost" data-chact="pass">今日はパス</button></div>`;
    }
    const rows = [];
    const ob = onboard && onboard.row(); // 導入 Day1〜7 の1行(新規セーブだけ・v89)
    if (ob) rows.push(ob);
    if (m) rows.push({ tag: '<i data-ic="target"></i>', text: m.title, sub: m.prog ? m.prog(h) : '', goto: m.goto || 'mgmt|#missionCard', now: !ob }); // 導入行があるときは導入行だけが「今日の本命」(designer v89)
    if (bn.fixes.length) rows.push({ tag: '<i data-ic="search"></i>', text: bn.fixes[0].label, sub: firstSentence(bn.text), goto: `${bn.fixes[0].tab}|${bn.fixes[0].sel}` });
    // 行の識別は番号でなくタグ(<i data-ic="target"></i>/<i data-ic="search"></i>/<i data-ic="calendar"></i>)。番号は詰まりの有無で日ごとに動くため置かない(designer v87)
    const onb = !!(onboard && onboard.active());
    const shown = rows.slice(0, onb ? 3 : 2); // 行は最大3(導入中は3・通常は2+依頼)
    const rowHtml = shown.map((r) => `<button class="td-row${r.now ? ' now' : ''}${r.done ? ' done' : ''}" data-goto="${r.goto}"><span class="td-num">${r.tag}</span><span class="td-body"><span class="td-text">${r.text}</span>${r.sub ? `<small class="td-sub">${r.sub}</small>` : ''}</span><span class="td-go">→</span></button>`).join('');
    const reqHtml = `<div class="td-row td-req"><span class="td-num"><i data-ic="calendar"></i></span><div class="td-body"><span class="todo-tag daily">依頼</span><div class="req-body">${reqRow}</div></div></div>`;
    // 導入中(Day1〜7)は依頼とクイズを出さない=1日1つに絞る(文字量・第8条)
    el.innerHTML = onb ? rowHtml : `${rowHtml}${reqHtml}<div class="td-foot"><span class="todo-tag quiz"><i data-ic="brain"></i>クイズ</span>${G.daily && G.daily.quizDone === today ? '<b class="daily-done"><i data-ic="check"></i>本日の算定クイズはクリア済み</b>' : '<button class="fix-chip" id="quizBtn">算定◯×クイズに挑戦(<i data-ic="coin"></i>+1)</button>'}</div>`;
    bindGoto(el);
    const qb = $('quizBtn');
    if (qb) qb.addEventListener('click', () => { SND.click(); showQuizModal(); });
    el.querySelectorAll('[data-chact]').forEach((b) => b.addEventListener('click', () => {
      G.daily.chDay = today;
      G.daily.chState = b.dataset.chact;
      const name = typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[ch.char].name : 'スタッフ';
      toast(b.dataset.chact === 'ok' ? `<i data-ic="clipboard"></i>${name}「ありがとうございます! お願いします!」` : `<i data-ic="chat"></i>${name}「了解です、無理は禁物ですから」`);
      renderTodo(); save();
    }));
  }
    // 昨日の結果カード(v90 便AM-6): 常設。3行(患者数/売上/平均待ち)+「くわしく」(損益・評判・新患・混雑帰り・詰まり・声・学び)。結果モーダルと同じ元データ
    function renderYesterday() {
      const card = $('yesterdayCard'), el = $('yesterdayBody');
      if (!card || !el) return;
      const opens = G.history.filter((x) => x.kind !== 'closed');
      const h = opens[opens.length - 1], prev = opens[opens.length - 2];
      if (!h) { card.hidden = true; return; }
      card.hidden = false;
      const delta = (now, before, isYen, goodUp) => {
        if (!prev) return '';
        const diff = now - before;
        if (Math.abs(diff) < (isYen ? 1000 : 1)) return '<small class="rs-flat">前日並み</small>';
        const good = goodUp ? diff > 0 : diff < 0;
        const v = isYen ? yen(Math.round(diff)) : String(Math.round(diff));
        return `<small class="rs-delta ${good ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${v}</small>`;
      };
      const corp = h.profit + (h.brProfit || 0), corpPrev = prev ? prev.profit + (prev.brProfit || 0) : 0;
      const bn = bottleneckInfo();
      const dv = (G.voiceFeed || []).filter((v) => v.kind === 'daily' && v.day === h.day).slice(-1)[0];
      const st = dv && typeof STAFF_UI !== 'undefined' ? STAFF_UI.STAFF[dv.char] : null;
      const lr = G.lastResult && G.lastResult.day === h.day ? G.lastResult : null;
      const tb = TEXTBOOK[(h.day - 1) % TEXTBOOK.length];
      const tools = $('yesterdayTools'); if (tools) tools.innerHTML = learnBtn('result', '損益・評判・新患・詰まり・スタッフの声・学び');
      $('yesterdayTitle').innerHTML = `<i data-ic="clipboard"></i>昨日の結果 Day ${h.day}(${WEEKDAYS[weekdayOf(h.day)]})`;
      el.innerHTML = `
        <div class="rs-grid rs-3">
          <div class="rs-item"><small>患者数</small><b>${h.patients}人</b>${delta(h.patients, prev ? prev.patients : 0, false, true)}</div>
          <div class="rs-item"><small>売上(本院)</small><b>${yenShort(h.revenue)}</b>${delta(h.revenue, prev ? prev.revenue : 0, true, true)}</div>
          <div class="rs-item"><small>平均待ち</small><b>${Math.round(h.avgWait)}分</b>${delta(h.avgWait, prev ? prev.avgWait : 0, false, false)}</div>
        </div>
        <div class="rs-more"${foldAttr('result')}>
          <div class="rs-grid rs-3">
            <div class="rs-item"><small>損益(法人)</small><b class="${corp >= 0 ? 'pos-t' : 'neg-t'}">${corp >= 0 ? '+' : ''}${yenShort(corp)}</b>${delta(corp, corpPrev, true, true)}</div>
            <div class="rs-item"><small>評判</small><b>${h.rep != null ? h.rep : Math.round(G.rep)}</b>${lr ? `<small class="rs-delta ${lr.repDelta >= 0 ? 'up' : 'down'}">${lr.repDelta >= 0 ? '+' : ''}${lr.repDelta}</small>` : ''}</div>
            <div class="rs-item"><small>新患</small><b>${h.newCount || 0}人</b>${delta(h.newCount || 0, prev ? prev.newCount || 0 : 0, false, true)}</div>
          </div>
          ${lr && lr.wx && lr.wx.note ? `<div class="rs-bottle">${lr.wx.icon} <b>${lr.wx.label}</b> — ${lr.wx.note}</div>` : ''}
          ${h.balked ? `<div class="rs-bottle rs-balk"><i data-ic="door"></i>混雑で <b>${h.balked}人</b> が入口で帰った(機会損失 約${yen(h.balked * 3500)})</div>` : ''}
          <div class="rs-bottle"><i data-ic="search"></i>${bn.text}</div>
          ${st ? `<div class="voice-row rs-voice">${STAFF_UI.faceSVG(dv.char, 'normal', 40)}<div class="voice-txt"><small>${st.title} ${st.name}</small><p>${dv.text}</p></div></div>` : ''}
          ${bn.fixes.length ? `<div class="fix-row">${bn.fixes.map((f) => `<button class="fix-chip" data-goto="${f.tab}|${f.sel}">${f.label} →</button>`).join('')}</div>` : ''}
          <div class="rs-learn"><i data-ic="book"></i><b>${tb.t}</b><br><small>${tb.b}</small></div>
        </div>`;
      bindGoto(el);
    }
    return { updateHeader, updateMissionBar, renderTodo, renderYesterday };
  }
  root.UI_DASH = { create };
})(window);
