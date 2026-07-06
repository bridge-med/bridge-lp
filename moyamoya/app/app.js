/* 職場モヤモヤ診断 — 画面遷移・状態管理・診断ロジック */

'use strict';

(function () {
  const STORAGE_KEY = 'moyamoyaShindan_v1';
  const TOTAL = MOYA_QUESTIONS.length;

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
      const valid = data.answers.every((t) => MOYA_TYPES[t]);
      if (!valid || data.answers.length === 0 || data.answers.length >= TOTAL) return null;
      return data.answers;
    } catch (e) {
      return null;
    }
  }

  /* ---------- 診断ロジック ---------- */

  // 各回答で該当タイプに1点加算し、最高点タイプを返す。
  // 同点時は「最後に選んだタイプ」を優先。
  // 3タイプ以上が同点の場合は複合モヤモヤ型(上位2タイプの組み合わせ)と判定する。
  function computeResult(answers) {
    const scores = {};
    MOYA_TYPE_ORDER.forEach((id) => { scores[id] = 0; });
    answers.forEach((t) => { scores[t] += 1; });

    const max = Math.max(...Object.values(scores));
    const tied = MOYA_TYPE_ORDER.filter((id) => scores[id] === max);
    // 最後に選んだものほど優先(最高点タイプは必ず1回以上選ばれている)
    tied.sort((a, b) => answers.lastIndexOf(b) - answers.lastIndexOf(a));

    return {
      primaryId: tied[0],
      secondaryId: tied.length >= 3 ? tied[1] : null,
      isComposite: tied.length >= 3,
      scores
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

  function list(items) {
    return items.map((i) => `<li>${esc(i)}</li>`).join('');
  }

  function shareText(result) {
    const type = MOYA_TYPES[result.primaryId];
    const name = result.isComposite
      ? `${MOYA_COMPOSITE.typeName}(${type.name} × ${MOYA_TYPES[result.secondaryId].name})`
      : type.shareName;
    return `職場モヤモヤ診断をやってみたら、私は『${name}』でした。\n\n職場で感じる“なんとなくしんどい”の正体が少し見えた気がします。\n\n${MOYA_APP.url}`;
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
          <circle cx="26" cy="30" r="15" fill="#DCEDF6" stroke="#5B93B8" stroke-width="2.5"/>
          <circle cx="41" cy="26" r="11" fill="#DFF2EA" stroke="#5AA88F" stroke-width="2.5"/>
          <circle cx="35" cy="41" r="9" fill="#FBEBD9" stroke="#D99A55" stroke-width="2.5"/>
        </svg>
      </div>
      <p class="quest-eyebrow">WORKPLACE MOYAMOYA CHECK</p>
      <h1 class="top-title">${esc(MOYA_APP.title)}</h1>
      <p class="top-sub">${esc(MOYA_APP.subcopy)}</p>
      <div class="card top-lead"><p>${esc(MOYA_APP.lead)}</p></div>
      <div class="top-meta">
        <span>所要時間 約${MOYA_APP.minutes}分</span>
        <span>全${TOTAL}問</span>
        <span>登録不要</span>
      </div>
      <button class="btn btn-primary" data-action="start">診断スタート</button>
      ${saved ? `<button class="btn btn-ghost" data-action="resume">続きから再開する(${saved.length}問回答済み)</button>` : ''}
      <p class="top-note">${esc(MOYA_APP.disclaimer)}</p>
    </section>`;
  }

  function renderStory() {
    return `
    <section class="screen screen-story">
      <p class="quest-eyebrow">BEFORE YOU START</p>
      <h2 class="story-title">そのモヤモヤ、正体を見てみませんか</h2>
      <div class="card story-card">
        ${MOYA_APP.story.map((p) => `<p>${nl2br(p)}</p>`).join('')}
      </div>
      <button class="btn btn-primary" data-action="begin">診断を始める</button>
      <button class="btn btn-ghost" data-action="home">トップに戻る</button>
    </section>`;
  }

  function renderQuiz() {
    const index = state.answers.length;
    const q = MOYA_QUESTIONS[index];
    const letters = ['A', 'B', 'C', 'D'];
    return `
    <section class="screen screen-quiz">
      <div class="quiz-head">
        <span class="scene-chip">SCENE ${index + 1}</span>
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
      <button class="btn btn-ghost btn-back" data-action="back">← ${index === 0 ? '説明に戻る' : '前の問題に戻る'}</button>
    </section>`;
  }

  function resultHero(result) {
    const type = MOYA_TYPES[result.primaryId];
    if (!result.isComposite) {
      return `
      <div class="card result-hero">
        <div class="result-emblem" aria-hidden="true">${type.emblem}</div>
        <h2 class="result-type">${esc(type.typeName)}</h2>
        <p class="result-catch">${esc(type.catch)}</p>
        <p class="result-desc">${esc(type.description)}</p>
      </div>`;
    }
    const second = MOYA_TYPES[result.secondaryId];
    return `
    <div class="card result-hero">
      <div class="result-emblem" aria-hidden="true">${MOYA_COMPOSITE.emblem}</div>
      <h2 class="result-type">${esc(MOYA_COMPOSITE.typeName)}</h2>
      <p class="result-combo">${esc(type.name)} × ${esc(second.name)}</p>
      <p class="result-catch">${esc(MOYA_COMPOSITE.catch)}</p>
      <p class="result-desc">${esc(MOYA_COMPOSITE.description)}</p>
    </div>`;
  }

  function renderResult() {
    const result = computeResult(state.answers);
    const type = MOYA_TYPES[result.primaryId];

    const maxScore = Math.max(1, ...Object.values(result.scores));
    const bars = MOYA_TYPE_ORDER.map((id) => {
      const t = MOYA_TYPES[id];
      const isTop = id === result.primaryId || id === result.secondaryId;
      return `
      <div class="score-row${isTop ? ' is-top' : ''}">
        <span class="score-name">${esc(t.name)}</span>
        <span class="score-bar"><i style="width:${(result.scores[id] / maxScore) * 100}%"></i></span>
        <span class="score-num">${result.scores[id]}</span>
      </div>`;
    }).join('');

    const compositeSecond = result.isComposite ? MOYA_TYPES[result.secondaryId] : null;
    const secondCard = compositeSecond ? `
      <div class="card result-sec result-second">
        <h3><span class="sec-ico">${compositeSecond.emblem}</span>もうひとつの傾向:${esc(compositeSecond.name)}</h3>
        <p class="sec-text">${esc(compositeSecond.catch)}</p>
        <p class="sec-text">${esc(compositeSecond.description)}</p>
      </div>` : '';

    const primaryLabel = result.isComposite ? `(特に強く出ている「${esc(type.name)}」より)` : '';

    return `
    <section class="screen screen-result">
      <p class="quest-eyebrow">YOUR RESULT — あなたのモヤモヤタイプ</p>
      ${resultHero(result)}
      ${secondCard}
      ${primaryLabel ? `<p class="result-primary-label">${primaryLabel}</p>` : ''}

      <div class="card result-sec">
        <h3><span class="sec-ico">🌟</span>あなたが大事にしていること</h3>
        <ul>${list(type.values)}</ul>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🌫️</span>モヤモヤしやすい場面</h3>
        <ul>${list(type.scenes)}</ul>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🏡</span>本当は求めている環境</h3>
        <p class="sec-text">${esc(type.environment)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">☀️</span>明日からできる小さな行動</h3>
        <ol class="action-list">${list(type.actions)}</ol>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🧭</span>転職・異動を考える前に整理したいこと</h3>
        <p class="sec-text">${esc(type.beforeMove)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🤝</span>相性の良い働き方</h3>
        <p class="sec-text">${esc(type.workstyle)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🌱</span>伸ばすと楽になるスキル</h3>
        <p class="sec-text">${esc(type.skills)}</p>
      </div>

      <div class="card result-sec">
        <h3><span class="sec-ico">🔍</span>回答の傾向</h3>
        <div class="score-chart">${bars}</div>
      </div>

      <div class="card result-sec share-sec">
        <h3><span class="sec-ico">🕊️</span>結果をシェアする</h3>
        <pre class="share-text" id="shareText">${esc(shareText(result))}</pre>
        <div class="share-btns">
          <button class="btn btn-primary btn-sm" data-action="copy">シェア文をコピー</button>
          ${navigator.share ? '<button class="btn btn-secondary btn-sm" data-action="webshare">シェアする</button>' : ''}
          <a class="btn btn-secondary btn-sm" data-action="tweet" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(result))}" target="_blank" rel="noopener">Xでポスト</a>
        </div>
      </div>

      <button class="btn btn-primary" data-action="retry">もう一度診断する</button>
      <p class="result-note">※ ${esc(MOYA_APP.disclaimer)}</p>
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
