/* クリニックPMIクエスト — 画面遷移・状態管理・診断ロジック */

'use strict';

(function () {
  const STORAGE_KEY = 'pmiQuest_v1';
  const TOTAL = PMI_QUESTIONS.length;

  const appEl = document.getElementById('app');
  const trackEl = document.getElementById('progressTrack');
  const fillEl = document.getElementById('progressFill');
  const toastEl = document.getElementById('toast');

  // state.screen: 'top' | 'story' | 'quiz' | 'result'
  // state.answers: 回答済み設問のタイプID配列(answers.length が現在の設問index)
  let state = { screen: 'top', answers: [] };

  /* ---------- 途中保存 ---------- */

  function saveState() {
    try {
      if (state.screen === 'quiz' && state.answers.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: state.answers }));
      } else if (state.screen === 'result' || state.screen === 'quiz') {
        // 診断完了時と設問リセット時のみクリア(トップ表示では保存データを残す)
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) { /* プライベートモード等では保存しない */ }
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.answers)) return null;
      const valid = data.answers.every((t) => PMI_TYPES[t]);
      if (!valid || data.answers.length === 0 || data.answers.length >= TOTAL) return null;
      return data.answers;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 診断ロジック ---------- */

  function computeResult(answers) {
    const scores = {};
    Object.keys(PMI_TYPES).forEach((id) => { scores[id] = 0; });
    answers.forEach((t) => { scores[t] += 1; });

    const max = Math.max(...Object.values(scores));

    // 回答が複数タイプに分散している場合は全体バランス型と判定
    if (max <= PMI_BALANCER_THRESHOLD) {
      return { typeId: 'balancer', scores };
    }
    // 最高点タイプを、同点時は PMI_TIE_PRIORITY の順で採用
    const typeId = PMI_TIE_PRIORITY.find((id) => scores[id] === max);
    return { typeId, scores };
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

  function list(items) {
    return items.map((i) => `<li>${esc(i)}</li>`).join('');
  }

  // 設問indexを30日間のストーリー上の日数に割り当てる(Q1=1日目、最終問=30日目)
  function questDay(index) {
    if (TOTAL <= 1) return 1;
    return Math.round(1 + index * (29 / (TOTAL - 1)));
  }

  function shareText(type) {
    return `クリニックPMIクエストをやってみたら、私は『${type.shareName}』でした。\n\n承継直後のクリニックで、どこから立て直すか。\n選択にその人の医療経営スタイルが出るのが面白いです。\n\n${PMI_APP.url}`;
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

  /* ---------- 画面描画 ---------- */

  function setProgress() {
    if (state.screen === 'quiz') {
      trackEl.hidden = false;
      fillEl.style.width = `${(state.answers.length / TOTAL) * 100}%`;
    } else {
      trackEl.hidden = true;
    }
  }

  function render() {
    setProgress();
    saveState();
    const screens = { top: renderTop, story: renderStory, quiz: renderQuiz, result: renderResult };
    appEl.innerHTML = screens[state.screen]();
    appEl.classList.remove('enter');
    void appEl.offsetWidth; // アニメーション再生のためのreflow
    appEl.classList.add('enter');
    window.scrollTo(0, 0);
    bind();
  }

  function renderTop() {
    const saved = loadSaved();
    return `
    <section class="screen screen-top">
      <div class="crest" aria-hidden="true">
        <svg viewBox="0 0 64 64" fill="none">
          <path d="M32 4 L56 12 V32 C56 46 46 56 32 60 C18 56 8 46 8 32 V12 Z" fill="#fff" stroke="#5B93B8" stroke-width="2.5"/>
          <path d="M32 20 V44 M20 32 H44" stroke="#5AA88F" stroke-width="6" stroke-linecap="round"/>
        </svg>
      </div>
      <p class="quest-eyebrow">CLINIC PMI QUEST</p>
      <h1 class="top-title">${esc(PMI_APP.title)}</h1>
      <p class="top-sub">${esc(PMI_APP.subcopy)}</p>
      <div class="card top-lead"><p>${esc(PMI_APP.lead)}</p></div>
      <div class="top-meta">
        <span>所要時間 約${PMI_APP.minutes}分</span>
        <span>全${TOTAL}問</span>
        <span>登録不要</span>
      </div>
      <button class="btn btn-primary" data-action="start">診断スタート</button>
      ${saved ? `<button class="btn btn-ghost" data-action="resume">続きから再開する(${saved.length}問回答済み)</button>` : ''}
    </section>`;
  }

  function renderStory() {
    return `
    <section class="screen screen-story">
      <p class="quest-eyebrow">PROLOGUE</p>
      <h2 class="story-title">着任 — 最初の30日</h2>
      <div class="card story-card">
        ${PMI_APP.story.map((p) => `<p>${nl2br(p)}</p>`).join('')}
      </div>
      <button class="btn btn-primary" data-action="begin">診断を始める</button>
      <button class="btn btn-ghost" data-action="home">トップに戻る</button>
    </section>`;
  }

  function renderQuiz() {
    const index = state.answers.length;
    const q = PMI_QUESTIONS[index];
    const letters = ['A', 'B', 'C', 'D'];
    return `
    <section class="screen screen-quiz">
      <div class="quiz-head">
        <span class="day-chip">DAY ${questDay(index)} <small>/ 30</small></span>
        <span class="quiz-count">Q${index + 1} <small>/ ${TOTAL}</small></span>
      </div>
      <h2 class="scene-title">${esc(q.scene)}</h2>
      <div class="card situation-card"><p>${esc(q.situation)}</p></div>
      <p class="question-text">${esc(q.question)}</p>
      <div class="choices">
        ${q.choices.map((c, i) => `
          <button class="choice" data-action="choose" data-type="${c.type}">
            <span class="choice-letter">${letters[i]}</span>
            <span class="choice-label">${esc(c.label)}</span>
          </button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-back" data-action="back">← ${index === 0 ? 'ストーリーに戻る' : '前の問題に戻る'}</button>
    </section>`;
  }

  function renderResult() {
    const { typeId, scores } = computeResult(state.answers);
    const type = PMI_TYPES[typeId];
    const maxScore = Math.max(1, ...Object.values(scores));
    const bars = PMI_TIE_PRIORITY.slice().reverse().map((id) => {
      const t = PMI_TYPES[id];
      return `
      <div class="score-row${id === typeId ? ' is-top' : ''}">
        <span class="score-name">${esc(t.name)}</span>
        <span class="score-bar"><i style="width:${(scores[id] / maxScore) * 100}%"></i></span>
        <span class="score-num">${scores[id]}</span>
      </div>`;
    }).join('');

    return `
    <section class="screen screen-result">
      <p class="quest-eyebrow">QUEST CLEAR — あなたの医療経営スタイル</p>
      <div class="card result-hero">
        <div class="result-emblem" aria-hidden="true">${type.emblem}</div>
        <h2 class="result-type">${esc(type.typeName)}</h2>
        <p class="result-catch">${esc(type.catch)}</p>
        <p class="result-desc">${esc(type.description)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">💪</span>強み</h3>
        <ul>${list(type.strengths)}</ul>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">⚠️</span>注意点</h3>
        <ul>${list(type.cautions)}</ul>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">📈</span>最初に見るべきKPI</h3>
        <div class="kpi-tags">${type.kpis.map((k) => `<span class="kpi-tag">${esc(k)}</span>`).join('')}</div>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🗓️</span>初月にやるべきアクション</h3>
        <ol class="action-list">${list(type.actions)}</ol>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🧩</span>相性の良い役割</h3>
        <p class="sec-text">${esc(type.roles)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🌱</span>伸ばすと良いスキル</h3>
        <p class="sec-text">${esc(type.skills)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🔍</span>回答の傾向</h3>
        <div class="score-chart">${bars}</div>
      </div>

      <div class="card result-sec share-sec">
        <h3><span class="sec-ico">🕊️</span>結果をシェアする</h3>
        <pre class="share-text" id="shareText">${esc(shareText(type))}</pre>
        <div class="share-btns">
          <button class="btn btn-primary btn-sm" data-action="copy">シェア文をコピー</button>
          ${navigator.share ? '<button class="btn btn-secondary btn-sm" data-action="webshare">シェアする</button>' : ''}
          <a class="btn btn-secondary btn-sm" data-action="tweet" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(type))}" target="_blank" rel="noopener">Xでポスト</a>
        </div>
      </div>

      <button class="btn btn-primary" data-action="retry">もう一度診断する</button>
      <p class="result-note">※ 本診断はエンタメを含む簡易セルフチェックです。実際のPMIは、数字・人・制度をチームで見ていきましょう。</p>
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

  function handle(action, el) {
    switch (action) {
      case 'start':
        state = { screen: 'story', answers: [] };
        render();
        break;
      case 'resume': {
        const saved = loadSaved();
        state = saved ? { screen: 'quiz', answers: saved } : { screen: 'story', answers: [] };
        render();
        break;
      }
      case 'begin':
        state = { screen: 'quiz', answers: [] };
        render();
        break;
      case 'home':
        state = { screen: 'top', answers: [] };
        render();
        break;
      case 'choose':
        state.answers.push(el.dataset.type);
        state.screen = state.answers.length >= TOTAL ? 'result' : 'quiz';
        render();
        break;
      case 'back':
        if (state.answers.length === 0) {
          state.screen = 'story';
        } else {
          state.answers.pop();
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
      case 'retry':
        state = { screen: 'quiz', answers: [] };
        render();
        break;
    }
  }

  render();
})();
