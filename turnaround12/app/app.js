/* ターンアラウンド12 — ゲーム進行・状態管理・リザルト判定 */

'use strict';

(function () {
  const STORAGE_KEY = 'turnaround12_v1';
  const BEST_KEY = 'turnaround12_best_v1';

  const appEl = document.getElementById('app');
  const trackEl = document.getElementById('progressTrack');
  const fillEl = document.getElementById('progressFill');
  const toastEl = document.getElementById('toast');

  // state.screen: 'top' | 'story' | 'play' | 'gameover' | 'clear'
  // state.phase:  'choose' | 'result'(playのみ)
  // state.deck:   第2〜11週に出るイベントID(毎プレイ抽選)
  let state = { screen: 'top' };

  /* ---------- 山札 ---------- */

  function buildDeck() {
    const ids = TA_EVENTS.map((e) => e.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, TA_TOTAL_WEEKS - 2);
  }

  function eventForWeek(week) {
    if (week === 1) return TA_FIRST_EVENT;
    if (week === TA_TOTAL_WEEKS) return TA_LAST_EVENT;
    const id = state.deck[week - 2];
    return TA_EVENTS.find((e) => e.id === id);
  }

  /* ---------- 途中保存・自己ベスト ---------- */

  function saveState() {
    try {
      if (state.screen === 'play') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else if (state.screen === 'gameover' || state.screen === 'clear') {
        // 決着がついたらクリア(トップ・ストーリー表示では途中データを残す)
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) { /* プライベートモード等では保存しない */ }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.screen !== 'play' || !s.stats || !Array.isArray(s.deck)) return null;
      if (!s.deck.every((id) => TA_EVENTS.some((e) => e.id === id))) return null;
      if (!(s.week >= 1 && s.week <= TA_TOTAL_WEEKS)) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (!raw) return null;
      const b = JSON.parse(raw);
      return (typeof b.score === 'number' && b.rank) ? b : null;
    } catch (e) {
      return null;
    }
  }

  function saveBest(score, rank) {
    try {
      const cur = loadBest();
      if (!cur || score > cur.score) {
        localStorage.setItem(BEST_KEY, JSON.stringify({ score, rank }));
        return !cur ? false : true; // 更新があったか(初回はfalse扱いにしない)
      }
    } catch (e) { /* noop */ }
    return false;
  }

  /* ---------- ゲームロジック ---------- */

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function settlementFor(repu) {
    return Math.round((repu - TA_BREAKEVEN_REPU) * TA_PROFIT_PER_REPU);
  }

  // 選択を適用し、result フェーズ用の情報を state.last に載せる
  function applyChoice(choice) {
    let effects = choice.effects;
    let resultText = choice.result;
    let gambleOutcome = null;

    if (choice.gamble) {
      const win = Math.random() < choice.gamble.p;
      const branch = win ? choice.gamble.success : choice.gamble.fail;
      effects = branch.effects;
      resultText = branch.result;
      gambleOutcome = win ? 'success' : 'fail';
    }

    const s = state.stats;
    s.cash += effects.cash;
    s.trust = clamp(s.trust + effects.trust, 0, 100);
    s.morale = clamp(s.morale + effects.morale, 0, 100);
    s.repu = clamp(s.repu + effects.repu, 0, 100);

    const settlement = settlementFor(s.repu);
    s.cash += settlement;

    state.last = {
      scene: eventForWeek(state.week).scene,
      choiceLabel: choice.label,
      resultText,
      effects,
      settlement,
      gambleOutcome
    };
    state.log.push({ week: state.week, scene: state.last.scene, choiceLabel: choice.label });

    // 敗北判定(資金 → 信頼 → 士気 → 評判の順)
    if (s.cash < 0) return 'cash';
    if (s.trust <= 0) return 'trust';
    if (s.morale <= 0) return 'morale';
    if (s.repu <= 0) return 'repu';
    return null;
  }

  function computeScore(stats) {
    return Math.round(stats.trust + stats.morale + stats.repu + clamp(stats.cash, 0, 600) / 6);
  }

  function rankFor(score) {
    return TA_RANKS.find((r) => score >= r.min);
  }

  // 講評用に4指標を0〜100スケールで比較する
  function meterScale(stats) {
    return {
      cash: clamp(stats.cash, 0, 600) / 6,
      trust: stats.trust,
      morale: stats.morale,
      repu: stats.repu
    };
  }

  /* ---------- ユーティリティ ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  function signed(n, unit) {
    if (n === 0) return `±0${unit}`;
    return `${n > 0 ? '+' : ''}${n}${unit}`;
  }

  function shareText(rank, stats) {
    return `『ターンアラウンド12』で赤字クリニックの事務長を12週やり切って、ランク${rank.rank}『${rank.title}』でした。\n\n最終資金 ${stats.cash}万円 / 院長信頼 ${stats.trust} / スタッフ士気 ${stats.morale} / 患者評判 ${stats.repu}\n\n毎週の一手で4つのメーターをやりくりする経営ゲーム。どれかが尽きたら終わりです。\n\n${TA_APP.url}`;
  }

  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  /* ---------- 画面部品 ---------- */

  function metersHTML(stats) {
    const bar = (key) => {
      const m = TA_METERS[key];
      const v = stats[key];
      const danger = v <= 20 ? ' is-danger' : v <= 35 ? ' is-warn' : '';
      return `
      <div class="meter${danger}">
        <div class="meter-head"><span class="meter-name">${m.icon} ${esc(m.name)}</span><span class="meter-val">${v}</span></div>
        <div class="meter-track"><i style="width:${v}%"></i></div>
      </div>`;
    };
    const cashDanger = stats.cash <= 60 ? ' is-danger' : stats.cash <= 150 ? ' is-warn' : '';
    return `
    <div class="meters card">
      <div class="meter meter-cash${cashDanger}">
        <div class="meter-head"><span class="meter-name">${TA_METERS.cash.icon} 資金</span><span class="meter-val meter-cash-val">${stats.cash}<small>万円</small></span></div>
      </div>
      ${bar('trust')}${bar('morale')}${bar('repu')}
    </div>`;
  }

  function deltaChips(effects, settlement) {
    const chips = [];
    const push = (label, n, unit) => {
      if (n === 0) return;
      chips.push(`<span class="delta${n > 0 ? ' plus' : ' minus'}">${esc(label)} ${signed(n, unit)}</span>`);
    };
    push(TA_METERS.cash.name, effects.cash, '万円');
    push(TA_METERS.trust.name, effects.trust, '');
    push(TA_METERS.morale.name, effects.morale, '');
    push(TA_METERS.repu.name, effects.repu, '');
    if (chips.length === 0) chips.push('<span class="delta zero">変化なし</span>');
    chips.push(`<span class="delta settle${settlement >= 0 ? ' plus' : ' minus'}">今週の収支 ${signed(settlement, '万円')}</span>`);
    return `<div class="deltas">${chips.join('')}</div>`;
  }

  /* ---------- 画面描画 ---------- */

  function setProgress() {
    if (state.screen === 'play') {
      trackEl.hidden = false;
      const done = state.week - (state.phase === 'result' ? 0 : 1);
      fillEl.style.width = `${(done / TA_TOTAL_WEEKS) * 100}%`;
    } else {
      trackEl.hidden = true;
    }
  }

  function render() {
    setProgress();
    saveState();
    const screens = { top: renderTop, story: renderStory, play: renderPlay, gameover: renderGameover, clear: renderClear };
    appEl.innerHTML = screens[state.screen]();
    appEl.classList.remove('enter');
    void appEl.offsetWidth; // アニメーション再生のためのreflow
    appEl.classList.add('enter');
    window.scrollTo(0, 0);
    bind();
  }

  function renderTop() {
    const saved = loadSaved();
    const best = loadBest();
    return `
    <section class="screen screen-top">
      <div class="crest" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <path class="crest-fall" d="M5 44 C 12 16, 24 12, 55 51"/>
          <path class="crest-rise" d="M15 54 C 29 50, 38 22, 59 11"/>
        </svg>
      </div>
      <p class="quest-eyebrow">TURNAROUND TWELVE</p>
      <h1 class="top-title">${esc(TA_APP.title)}</h1>
      <p class="top-sub">${esc(TA_APP.subcopy)}</p>
      <div class="card top-lead"><p>${esc(TA_APP.lead)}</p></div>
      <div class="top-rules card">
        <div class="rule"><span>💴</span>資金が尽きたら<b>資金ショート</b></div>
        <div class="rule"><span>🩺</span>院長信頼が尽きたら<b>解任</b></div>
        <div class="rule"><span>🧑‍🤝‍🧑</span>士気が尽きたら<b>一斉退職</b></div>
        <div class="rule"><span>⭐</span>評判が尽きたら<b>患者離れ</b></div>
      </div>
      <div class="top-meta">
        <span>1プレイ 約${TA_APP.minutes}分</span>
        <span>全${TA_TOTAL_WEEKS}週</span>
        <span>イベントは毎回変わる</span>
        <span>登録不要</span>
      </div>
      ${best ? `<p class="best-badge">自己ベスト: ランク${esc(best.rank)}(スコア ${best.score})</p>` : ''}
      <button class="btn btn-primary" data-action="start">着任する</button>
      ${saved ? `<button class="btn btn-ghost" data-action="resume">続きから再開する(第${saved.week}週)</button>` : ''}
    </section>`;
  }

  function renderStory() {
    return `
    <section class="screen screen-story">
      <p class="quest-eyebrow">PROLOGUE</p>
      <h2 class="story-title">辞令 — 12週間の再建</h2>
      <div class="card story-card">
        ${TA_APP.story.map((p) => `<p>${nl2br(p)}</p>`).join('')}
      </div>
      <button class="btn btn-primary" data-action="begin">第1週を始める</button>
      <button class="btn btn-ghost" data-action="home">トップに戻る</button>
    </section>`;
  }

  function renderPlay() {
    return state.phase === 'result' ? renderTurnResult() : renderChoose();
  }

  function renderChoose() {
    const ev = eventForWeek(state.week);
    const letters = ['A', 'B', 'C'];
    return `
    <section class="screen screen-play">
      <div class="quiz-head">
        <span class="day-chip">WEEK ${state.week} <small>/ ${TA_TOTAL_WEEKS}</small></span>
      </div>
      ${metersHTML(state.stats)}
      <h2 class="scene-title">${esc(ev.scene)}</h2>
      <div class="card situation-card"><p>${esc(ev.situation)}</p></div>
      <p class="question-text">あなたの一手は?</p>
      <div class="choices">
        ${ev.choices.map((c, i) => `
          <button class="choice" data-action="choose" data-index="${i}">
            <span class="choice-letter">${letters[i]}</span>
            <span class="choice-label">${esc(c.label)}${c.gamble ? ' <span class="gamble-tag">🎲 賭け</span>' : ''}</span>
          </button>`).join('')}
      </div>
    </section>`;
  }

  function renderTurnResult() {
    const last = state.last;
    const isFinal = state.week === TA_TOTAL_WEEKS;
    const gambleBadge = last.gambleOutcome
      ? `<span class="gamble-badge ${last.gambleOutcome}">${last.gambleOutcome === 'success' ? '🎲 賭けに勝った' : '🎲 賭けに負けた'}</span>`
      : '';
    return `
    <section class="screen screen-play">
      <div class="quiz-head">
        <span class="day-chip">WEEK ${state.week} <small>/ ${TA_TOTAL_WEEKS}</small></span>
        <span class="quiz-count">結果</span>
      </div>
      ${metersHTML(state.stats)}
      <h2 class="scene-title">${esc(last.scene)}</h2>
      <div class="card choice-echo"><span class="echo-label">あなたの一手</span>${esc(last.choiceLabel)}</div>
      <div class="card result-card">
        ${gambleBadge}
        <p>${nl2br(last.resultText)}</p>
        ${deltaChips(last.effects, last.settlement)}
      </div>
      <button class="btn btn-primary" data-action="next">${isFinal ? '12週間の結果を見る' : `第${state.week + 1}週へ`}</button>
    </section>`;
  }

  function renderGameover() {
    const over = TA_GAMEOVER[state.cause];
    const last = state.last;
    return `
    <section class="screen screen-result">
      <p class="quest-eyebrow gameover-eyebrow">GAME OVER — 第${state.week}週</p>
      <div class="card result-hero gameover-hero">
        <div class="result-emblem" aria-hidden="true">${over.emblem}</div>
        <h2 class="result-type">${esc(over.title)}</h2>
        <p class="result-desc gameover-last">${esc(last.scene)}での一手 —「${esc(last.choiceLabel)}」</p>
        <p class="result-desc">${nl2br(over.text)}</p>
      </div>
      ${metersHTML(state.stats)}
      <button class="btn btn-primary" data-action="retry">もう一度、着任する</button>
      <button class="btn btn-ghost" data-action="home">トップに戻る</button>
    </section>`;
  }

  function renderClear() {
    const stats = state.stats;
    const score = computeScore(stats);
    const rank = rankFor(score);
    const scale = meterScale(stats);
    const keys = Object.keys(scale);
    const bestKey = keys.reduce((a, b) => (scale[b] > scale[a] ? b : a));
    const worstKey = keys.reduce((a, b) => (scale[b] < scale[a] ? b : a));

    const logRows = state.log.map((l) => `
      <div class="log-row">
        <span class="log-week">W${l.week}</span>
        <span class="log-body"><b>${esc(l.scene)}</b><br>${esc(l.choiceLabel)}</span>
      </div>`).join('');

    return `
    <section class="screen screen-result">
      <p class="quest-eyebrow">TURNAROUND COMPLETE — 12週間、生き残った</p>
      <div class="card result-hero">
        <div class="result-emblem" aria-hidden="true">${rank.emblem}</div>
        <p class="rank-line">RANK <b class="rank-letter rank-${rank.rank}">${rank.rank}</b></p>
        <h2 class="result-type">${esc(rank.title)}</h2>
        <p class="result-catch">スコア ${score} / 400</p>
        <p class="result-desc">${esc(rank.comment)}</p>
      </div>

      ${metersHTML(stats)}

      <div class="card result-sec">
        <h3><span class="sec-ico">🔍</span>この12週間の講評</h3>
        <p class="sec-text">${esc(TA_METER_REVIEWS.best[bestKey])}</p>
        <p class="sec-text">${esc(TA_METER_REVIEWS.worst[worstKey])}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🗓️</span>12週間の一手</h3>
        <div class="log-list">${logRows}</div>
      </div>

      <div class="card result-sec share-sec">
        <h3><span class="sec-ico">🕊️</span>結果をシェアする</h3>
        <pre class="share-text" id="shareText">${esc(shareText(rank, stats))}</pre>
        <div class="share-btns">
          <button class="btn btn-primary btn-sm" data-action="copy">シェア文をコピー</button>
          ${navigator.share ? '<button class="btn btn-secondary btn-sm" data-action="webshare">シェアする</button>' : ''}
          <a class="btn btn-secondary btn-sm" data-action="tweet" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(rank, stats))}" target="_blank" rel="noopener">Xでポスト</a>
        </div>
      </div>

      <button class="btn btn-primary" data-action="retry">もう一度、着任する(イベントは変わります)</button>
      <p class="result-note">※ 本作はエンタメを含むフィクションです。実在のクリニック再建は、数字・人・制度をチームで、もっとゆっくり丁寧に。</p>
    </section>`;
  }

  /* ---------- イベント ---------- */

  function bind() {
    appEl.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = el.dataset.action;
        if (action === 'tweet') return; // aタグはそのまま遷移
        e.preventDefault();
        handle(action, el);
      });
    });
  }

  function newGame() {
    return {
      screen: 'play',
      phase: 'choose',
      week: 1,
      stats: Object.assign({}, TA_START),
      deck: buildDeck(),
      log: [],
      last: null,
      cause: null
    };
  }

  function handle(action, el) {
    switch (action) {
      case 'start':
        state = { screen: 'story' };
        render();
        break;
      case 'resume': {
        const saved = loadSaved();
        state = saved || { screen: 'story' };
        render();
        break;
      }
      case 'begin':
      case 'retry':
        state = newGame();
        render();
        break;
      case 'home':
        state = { screen: 'top' };
        render();
        break;
      case 'choose': {
        const ev = eventForWeek(state.week);
        const choice = ev.choices[Number(el.dataset.index)];
        const cause = applyChoice(choice);
        if (cause) {
          state.cause = cause;
          state.screen = 'gameover';
        } else {
          state.phase = 'result';
        }
        render();
        break;
      }
      case 'next':
        if (state.week >= TA_TOTAL_WEEKS) {
          state.screen = 'clear';
          const score = computeScore(state.stats);
          const rank = rankFor(score);
          if (saveBest(score, rank.rank)) showToast('自己ベストを更新しました!');
        } else {
          state.week += 1;
          state.phase = 'choose';
        }
        render();
        break;
      case 'copy': {
        const text = document.getElementById('shareText').textContent;
        copyText(text)
          .then(() => showToast('シェア文をコピーしました'))
          .catch(() => showToast('コピーできませんでした'));
        break;
      }
      case 'webshare': {
        const text = document.getElementById('shareText').textContent;
        navigator.share({ text }).catch(() => { /* ユーザーキャンセルは無視 */ });
        break;
      }
    }
  }

  render();
})();
