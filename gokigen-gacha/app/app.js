/* =========================================================================
 * ごきげん回復ガチャ — app.js
 * 画面遷移・レンダリング・イベント処理。データの読み書きは GachaStore、
 * 静的データは GACHA_DATA を参照する。
 *
 * state.screen:
 *   'home' | 'select' | 'spin' | 'result' | 'done'
 *   | 'history' | 'favorites' | 'dex' | 'settings'
 * ========================================================================= */
(function () {
  'use strict';

  var D = window.GACHA_DATA;
  var Store = window.GachaStore;

  var screenEl = document.getElementById('screen');
  var tabbarEl = document.getElementById('tabbar');
  var toastEl = document.getElementById('toast');

  var state = {
    screen: 'home',
    stateId: null,      // 選択中の状態(null = 選ばずに回す)
    card: null,         // 表示中のカード
    resultContext: 'gacha', // 'gacha' | 'favorite' | 'dex'
    dexFilter: 'all',
    lastPraise: '',
    lastWord: ''
  };

  /* ---------- ユーティリティ ---------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function findCard(id) {
    return D.CARDS.find(function (c) { return c.id === id; }) || null;
  }

  var toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
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

  /* ---------- 効果音(小さなポップ音・設定でOFF可) ---------- */

  var audioCtx = null;
  function playPop(freq) {
    try {
      if (!Store.settings().sound) return;
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      var t = audioCtx.currentTime;
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq || 620, t);
      osc.frequency.exponentialRampToValueAtTime((freq || 620) * 1.5, t + 0.08);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) { /* 音が出なくても進行に影響なし */ }
  }

  /* ---------- 紙吹雪(実行完了時の軽い演出) ---------- */

  function confetti() {
    try {
      var colors = ['#F59B54', '#7FBB92', '#8FBEDC', '#F5C34B', '#F2B8C6'];
      for (var i = 0; i < 18; i++) {
        var dot = document.createElement('div');
        dot.className = 'confetti-dot';
        var size = 6 + Math.random() * 6;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dot.style.left = Math.random() * 100 + 'vw';
        dot.style.background = pick(colors);
        dot.style.animationDuration = 1.4 + Math.random() * 1.2 + 's';
        dot.style.animationDelay = Math.random() * 0.3 + 's';
        document.body.appendChild(dot);
        setTimeout(function (el) { el.remove(); }.bind(null, dot), 3200);
      }
    } catch (e) { /* 演出は失敗しても無視 */ }
  }

  /* ---------- SVGパーツ ---------- */

  // ぽて(柴犬風のゆるい回復係)。mood: 'normal' | 'happy'
  function poteSvg(mood) {
    if (!Store.settings().showPote) return '';
    var eyes = mood === 'happy'
      ? '<path d="M39 47 q4 -5 8 0" stroke="#4A3F33" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M61 47 q4 -5 8 0" stroke="#4A3F33" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<circle cx="43" cy="47" r="3" fill="#4A3F33"/><circle cx="65" cy="47" r="3" fill="#4A3F33"/>';
    return '' +
      '<svg viewBox="0 0 110 100" role="img" aria-label="ぽて">' +
      '<ellipse cx="55" cy="93" rx="30" ry="5" fill="rgba(0,0,0,0.06)"/>' +
      // 体
      '<ellipse cx="55" cy="72" rx="27" ry="22" fill="#F3BE7C"/>' +
      '<ellipse cx="55" cy="78" rx="17" ry="13" fill="#FBEED9"/>' +
      // 前足
      '<ellipse cx="40" cy="88" rx="8" ry="5" fill="#F3BE7C"/>' +
      '<ellipse cx="70" cy="88" rx="8" ry="5" fill="#F3BE7C"/>' +
      // しっぽ
      '<circle cx="84" cy="70" r="9" fill="#F3BE7C"/><circle cx="86" cy="68" r="5" fill="#FBEED9"/>' +
      // 耳
      '<path d="M30 26 L40 10 L48 24 Z" fill="#F3BE7C"/><path d="M35 23 L40 15 L44 22 Z" fill="#F2A9A0"/>' +
      '<path d="M80 26 L70 10 L62 24 Z" fill="#F3BE7C"/><path d="M75 23 L70 15 L66 22 Z" fill="#F2A9A0"/>' +
      // 顔
      '<circle cx="55" cy="42" r="26" fill="#F3BE7C"/>' +
      '<ellipse cx="55" cy="52" rx="15" ry="12" fill="#FBEED9"/>' +
      eyes +
      '<ellipse cx="54" cy="52" rx="3.4" ry="2.6" fill="#4A3F33"/>' +
      '<path d="M54 55 q0 4 -4 5 M54 55 q0 4 4 5" stroke="#4A3F33" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="35" cy="53" r="4" fill="#F6C9C0" opacity="0.85"/>' +
      '<circle cx="75" cy="53" r="4" fill="#F6C9C0" opacity="0.85"/>' +
      // マグカップ
      '<rect x="46" y="64" width="18" height="14" rx="4" fill="#9FC7A8"/>' +
      '<path d="M64 67 q6 2 0 8" stroke="#9FC7A8" stroke-width="3" fill="none"/>' +
      '<path d="M51 60 q1 -3 0 -5 M57 60 q1 -3 0 -5" stroke="#C9BBA5" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  // ガチャマシン
  function machineSvg() {
    return '' +
      '<svg viewBox="0 0 90 112" role="img" aria-label="ガチャマシン">' +
      '<rect x="16" y="58" width="58" height="44" rx="10" fill="#F59B54"/>' +
      '<rect x="16" y="58" width="58" height="10" fill="#E8813A"/>' +
      '<circle cx="45" cy="80" r="9" fill="#FBEED9"/><rect x="41" y="76" width="8" height="8" rx="2" fill="#E8813A"/>' +
      '<rect x="30" y="94" width="30" height="8" rx="4" fill="#C96A2E"/>' +
      '<circle cx="45" cy="34" r="26" fill="#FDF6EC" stroke="#E8CDA8" stroke-width="2.5"/>' +
      '<circle cx="36" cy="30" r="8" fill="#9FC7A8"/>' +
      '<circle cx="52" cy="26" r="8" fill="#F2B8C6"/>' +
      '<circle cx="48" cy="42" r="8" fill="#A8CFE0"/>' +
      '<circle cx="34" cy="44" r="7" fill="#F5C34B"/>' +
      '<rect x="38" y="2" width="14" height="8" rx="3" fill="#E8813A"/>' +
      '</svg>';
  }

  // カプセル
  function capsuleSvg() {
    return '' +
      '<svg viewBox="0 0 60 60" role="img" aria-label="カプセル">' +
      '<path d="M6 30 a24 24 0 0 1 48 0 Z" fill="#FDF6EC" stroke="#E8CDA8" stroke-width="2"/>' +
      '<path d="M6 30 a24 24 0 0 0 48 0 Z" fill="#F59B54"/>' +
      '<circle cx="22" cy="20" r="5" fill="#FFF" opacity="0.7"/>' +
      '</svg>';
  }

  var TAB_ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V21 H19 V10"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15.5 14"/></svg>',
    favorites: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5 C7 16.5 3.5 13.5 3.5 9.5 A4.5 4.5 0 0 1 12 6.5 A4.5 4.5 0 0 1 20.5 9.5 C20.5 13.5 17 16.5 12 20.5 Z"/></svg>',
    dex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5 C10 3.8 7 3.5 4 4.5 V19 C7 18 10 18.3 12 20 C14 18.3 17 18 20 19 V4.5 C17 3.5 14 3.8 12 5.5 Z"/><path d="M12 5.5 V20"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 L13.2 5.6 L16.2 4.9 L16.9 7.9 L19.8 8.8 L18.6 11.6 L20.5 14 L18 15.8 L18.4 18.9 L15.3 19 L13.9 21.8 L12 20 L10.1 21.8 L8.7 19 L5.6 18.9 L6 15.8 L3.5 14 L5.4 11.6 L4.2 8.8 L7.1 7.9 L7.8 4.9 L10.8 5.6 Z" opacity="0.55"/></svg>'
  };

  function heartSvg(filled) {
    return filled ? '♥' : '♡';
  }

  function stars(difficulty) {
    var s = '';
    for (var i = 1; i <= 3; i++) {
      s += i <= difficulty ? '★' : '<span class="off">☆</span>';
    }
    return '<span class="stars">' + s + '</span>';
  }

  function difficultyLabel(d) {
    return d === 1 ? 'ほぼ何もしない' : d === 2 ? '少しだけ動く' : 'ちょっと整える';
  }

  function categoryChip(catId) {
    var cat = D.categoryById[catId];
    if (!cat) return '';
    return '<span class="chip tone-' + cat.tone + '">' + cat.emoji + ' ' + esc(cat.label) + '</span>';
  }

  function poteRow(text, opts) {
    opts = opts || {};
    if (!Store.settings().showPote) {
      return '<div class="pote-row"><div class="pote-bubble">' + text + '</div></div>';
    }
    return '' +
      '<div class="pote-row' + (opts.className ? ' ' + opts.className : '') + '">' +
      '<div class="pote-avatar' + (opts.small ? ' small' : '') + '">' + poteSvg(opts.mood || 'normal') + '</div>' +
      '<div class="pote-bubble">' + text + '</div>' +
      '</div>';
  }

  /* ---------- レンダリング ---------- */

  var TABS = [
    { id: 'home', label: 'ホーム' },
    { id: 'history', label: '履歴' },
    { id: 'favorites', label: 'お気に入り' },
    { id: 'dex', label: '図鑑' },
    { id: 'settings', label: '設定' }
  ];

  function activeTab() {
    if (['select', 'spin', 'result', 'done'].indexOf(state.screen) >= 0) return 'home';
    return state.screen;
  }

  function renderTabbar() {
    var active = activeTab();
    tabbarEl.innerHTML = TABS.map(function (t) {
      return '<button class="tab-btn' + (t.id === active ? ' active' : '') + '" data-action="tab" data-tab="' + t.id + '" aria-label="' + t.label + '">' +
        TAB_ICONS[t.id] + '<span>' + t.label + '</span></button>';
    }).join('');
  }

  function render() {
    var screens = {
      home: renderHome,
      select: renderSelect,
      spin: renderSpin,
      result: renderResult,
      done: renderDone,
      history: renderHistory,
      favorites: renderFavorites,
      dex: renderDex,
      settings: renderSettings
    };
    screenEl.innerHTML = (screens[state.screen] || renderHome)();
    renderTabbar();
    screenEl.classList.remove('screen');
    void screenEl.offsetWidth; // 画面切替アニメーションを再生し直す
    screenEl.classList.add('screen');
    window.scrollTo(0, 0);
    bind();
  }

  /* ---- 1. ホーム ---- */
  function renderHome() {
    var favs = Store.favoriteCards().slice(0, 2);
    var favHtml = favs.length === 0 ? '' :
      '<div class="section-label">⭐ 最近のお気に入り <button class="right" data-action="tab" data-tab="favorites">すべて見る ›</button></div>' +
      '<div class="fav-shortcuts">' +
      favs.map(function (c) {
        return '<button class="card fav-shortcut" data-action="open-favorite" data-card="' + c.id + '">' +
          '<span class="heart">♥</span>' +
          '<span class="emoji">' + c.emoji + '</span>' +
          '<span class="ttl">' + esc(c.title) + '</span>' +
          categoryChip(c.category) +
          '</button>';
      }).join('') +
      '</div>';

    return '' +
      '<header class="app-head">' +
      '<div class="machine">' + machineSvg() + '</div>' +
      '<h1>' + esc(D.APP.name) + '</h1>' +
      '</header>' +
      '<p class="app-sub">' + esc(D.APP.subcopy) + '</p>' +
      poteRow(esc(pick(D.POTE.home))) +
      '<div class="card status-card">' +
      '<h3>🌱 今日の回復ステータス</h3>' +
      '<div class="status-grid">' +
      '<div class="status-item orange"><div class="ico">🧡</div><div class="lbl">今日の回復</div><div class="val">' + Store.todayCount() + '<small>回</small></div></div>' +
      '<div class="status-item green"><div class="ico">📅</div><div class="lbl">連続回復</div><div class="val">' + Store.streakDays() + '<small>日</small></div></div>' +
      '</div>' +
      '</div>' +
      '<button class="btn btn-primary" data-action="go-select">🎯 今の状態を選ぶ</button>' +
      '<button class="btn btn-secondary" data-action="spin-now">🎰 すぐガチャを回す</button>' +
      favHtml +
      '<button class="card today-link" data-action="tab" data-tab="history">' +
      '<span>🃏</span><span class="ttl">今日実行したカード</span>' +
      '<span class="num">' + Store.todayCount() + '<small> 枚</small></span><span class="arrow">›</span>' +
      '</button>';
  }

  /* ---- 2. 状態選択 ---- */
  function renderSelect() {
    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="tab" data-tab="home" aria-label="戻る">‹</button>' +
      '<h2>今の状態を教えてください</h2>' +
      '</div>' +
      '<p class="page-desc">近いものを1つ選ぶだけで大丈夫です。</p>' +
      poteRow(esc(pick(D.POTE.select)), { small: true }) +
      '<div class="state-grid">' +
      D.STATES.map(function (s) {
        var sel = state.stateId === s.id;
        return '<button class="card state-card' + (sel ? ' selected' : '') + '" data-action="pick-state" data-state="' + s.id + '">' +
          '<span class="check">✓</span>' +
          '<span class="emoji">' + s.emoji + '</span>' +
          '<span class="ttl">' + esc(s.label) + '</span>' +
          '<span class="desc">' + esc(s.desc) + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<div class="select-footer">' +
      '<button class="btn btn-primary" data-action="spin-with-state"' + (state.stateId ? '' : ' disabled') + '>🎰 この状態でガチャを回す</button>' +
      '<button class="btn btn-ghost" data-action="spin-now">選ばずに回す</button>' +
      '</div>';
  }

  /* ---- 3. ガチャ演出 ---- */
  function renderSpin() {
    return '' +
      '<div class="spin-screen">' +
      '<div class="spin-machine">' + machineSvg() + '</div>' +
      '<div class="spin-capsule">' + capsuleSvg() + '</div>' +
      '<p class="spin-text">' + esc(pick(D.POTE.spinning)) + '<span class="spin-dots"></span></p>' +
      '</div>';
  }

  /* ---- 4. 回復カード結果 ---- */
  function renderResult() {
    var c = state.card;
    if (!c) return renderHome();
    var stateNames = c.suitedStates.map(function (id) {
      var s = D.stateById[id];
      return s ? s.label : '';
    }).filter(Boolean).join(' / ');
    var fav = Store.isFavorite(c.id);
    var fromDex = state.resultContext === 'dex';

    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="' + (fromDex ? 'tab' : 'go-home') + '"' + (fromDex ? ' data-tab="dex"' : '') + ' aria-label="戻る">‹</button>' +
      '<h2>回復カード</h2>' +
      '</div>' +
      '<p class="result-note">✨ ぽてがカードを持ってきました ✨</p>' +
      '<div class="card result-card">' +
      '<div class="result-top">' +
      '<div class="emoji">' + c.emoji + '</div>' +
      '<h2>' + esc(c.title) + '</h2>' +
      '</div>' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><div class="k">🌱 カテゴリ</div><div class="v green">' + esc(D.categoryById[c.category].label) + '</div></div>' +
      '<div class="meta-item"><div class="k">🕐 時間の目安</div><div class="v green">' + c.durationMinutes + '分</div></div>' +
      '<div class="meta-item"><div class="k">⭐ むずかしさ</div><div class="v">' + stars(c.difficulty) + ' <small style="font-weight:600;color:var(--ink-soft);font-size:0.72rem">' + difficultyLabel(c.difficulty) + '</small></div></div>' +
      '<div class="meta-item"><div class="k">😌 向いている状態</div><div class="v blue" style="font-size:0.82rem">' + esc(stateNames) + '</div></div>' +
      '<div class="meta-item wide"><div class="k">🧡 回復タイプ</div><div class="v"><span class="chip tone-green">' + esc(c.recoveryType) + '</span></div></div>' +
      '</div>' +
      '<div class="result-block"><div class="k">✨ 今日のメッセージ</div><p>' + esc(c.mainMessage) + '</p></div>' +
      '<div class="result-block"><div class="k">☕ やること</div><p>' + esc(c.action) + '</p></div>' +
      '<div class="result-pote">' +
      (Store.settings().showPote ? '<div class="pote-avatar small">' + poteSvg('normal') + '</div>' : '') +
      '<div class="pote-bubble">' + esc(c.poteMessage) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="did-it">✓ やってみた</button>' +
      '<div class="btn-row">' +
      '<button class="btn btn-secondary btn-sm" data-action="not-now">今は違う</button>' +
      '<button class="btn btn-secondary btn-sm" data-action="respin">もう一回まわす</button>' +
      '</div>' +
      '<div class="btn-row">' +
      '<button class="btn btn-secondary btn-sm' + (fav ? '' : '') + '" data-action="toggle-fav">' + heartSvg(fav) + ' お気に入り' + (fav ? '済み' : '') + '</button>' +
      '<button class="btn btn-secondary btn-sm" data-action="copy-share">📋 シェア文をコピー</button>' +
      '</div>' +
      (navigator.share ? '<button class="btn btn-ghost" data-action="webshare">共有する</button>' : '') +
      '</div>';
  }

  /* ---- 5. 実行完了 ---- */
  function renderDone() {
    var c = state.card;
    var fav = c ? Store.isFavorite(c.id) : false;
    return '' +
      '<div class="done-screen">' +
      '<h2 class="done-title"><span class="leaf">🌿</span> 回復完了 <span class="leaf">🌿</span></h2>' +
      poteRow('<strong>' + esc(state.lastPraise) + '</strong><span class="sub">' + esc(c ? '「' + c.title + '」ができました' : '') + '</span>', { mood: 'happy', className: 'done-pote' }) +
      '<div class="card status-card">' +
      '<h3>🌱 今日の回復ステータス</h3>' +
      '<div class="status-grid">' +
      '<div class="status-item orange"><div class="ico">🧡</div><div class="lbl">今日の実行数</div><div class="val">' + Store.todayCount() + '<small>回</small></div></div>' +
      '<div class="status-item green"><div class="ico">📅</div><div class="lbl">連続回復日数</div><div class="val">' + Store.streakDays() + '<small>日</small></div></div>' +
      '</div>' +
      '</div>' +
      '<div class="card done-word">' +
      '<div class="ico">📋</div>' +
      '<div><div class="k">今日のひとこと</div><p>' + esc(state.lastWord) + '</p></div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="spin-again">🎰 もう1枚引く</button>' +
      '<button class="btn btn-secondary" data-action="go-home">🏠 ホームに戻る</button>' +
      (c && !fav ? '<button class="btn btn-ghost orange" data-action="toggle-fav">♡ お気に入りに追加</button>' : '') +
      '<button class="btn btn-ghost" data-action="copy-share">📋 シェア文をコピー</button>' +
      '</div>' +
      '</div>';
  }

  /* ---- 6. 履歴 ---- */
  function renderHistory() {
    var history = Store.history();
    var week = Store.last7Days();
    var maxCount = Math.max(1, Math.max.apply(null, week.map(function (d) { return d.count; })));
    var todayKey = Store.dayKey(new Date());

    var chart = '<div class="section-label">📊 過去7日間の回復</div>' +
      '<div class="card week-chart">' +
      week.map(function (d) {
        var h = d.count === 0 ? 4 : Math.round((d.count / maxCount) * 68);
        return '<div class="week-col' + (d.count === 0 ? ' zero' : '') + (d.key === todayKey ? ' today' : '') + '">' +
          '<div class="bar-track"><div class="bar" style="height:' + h + 'px"></div></div>' +
          '<div class="num">' + d.count + '</div>' +
          '<div class="day">' + d.weekday + '</div>' +
          '</div>';
      }).join('') +
      '</div>';

    if (history.length === 0) {
      return '<div class="page-head"><h2>回復の履歴</h2></div>' +
        '<p class="page-desc">何で少し戻ったかが、ここに残ります。</p>' +
        chart +
        '<div class="card empty-state">' +
        (Store.settings().showPote ? '<div class="pote-avatar">' + poteSvg('normal') + '</div>' : '') +
        '<p>' + esc(D.POTE.emptyHistory) + '</p>' +
        '<button class="btn btn-primary btn-sm" data-action="spin-now">🎰 1枚引いてみる</button>' +
        '</div>';
    }

    // 日付ごとにグループ化(履歴は新しい順で保存されている)
    var groups = [];
    var lastKey = null;
    history.slice(0, 60).forEach(function (e) {
      var k = Store.dayKey(e.at);
      if (k !== lastKey) {
        groups.push({ key: k, items: [] });
        lastKey = k;
      }
      groups[groups.length - 1].items.push(e);
    });

    function dayLabel(key) {
      if (key === todayKey) return '今日';
      var y = new Date();
      y.setDate(y.getDate() - 1);
      if (key === Store.dayKey(y)) return '昨日';
      var parts = key.split('-');
      return Number(parts[1]) + '月' + Number(parts[2]) + '日';
    }

    var listHtml = groups.map(function (g) {
      return '<div class="history-day-label">' + dayLabel(g.key) + '</div>' +
        g.items.map(function (e) {
          var c = findCard(e.cardId);
          if (!c) return '';
          var st = e.stateId ? D.stateById[e.stateId] : null;
          var time = new Date(e.at);
          var hm = time.getHours() + ':' + (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
          var fav = Store.isFavorite(c.id);
          return '<div class="card history-item">' +
            '<div class="emoji">' + c.emoji + '</div>' +
            '<div class="body">' +
            '<div class="ttl">' + esc(c.title) + '</div>' +
            '<div class="meta"><span>' + hm + '</span>' +
            (st ? '<span>' + st.emoji + ' ' + esc(st.label) + '</span>' : '') +
            '<span>' + esc(c.recoveryType) + '</span></div>' +
            '</div>' +
            '<button class="icon-btn' + (fav ? ' active' : '') + '" data-action="fav-card" data-card="' + c.id + '" aria-label="お気に入り">' + heartSvg(fav) + '</button>' +
            '<button class="icon-btn danger" data-action="del-history" data-id="' + e.id + '" aria-label="削除">✕</button>' +
            '</div>';
        }).join('');
    }).join('');

    return '<div class="page-head"><h2>回復の履歴</h2></div>' +
      '<p class="page-desc">何で少し戻ったかが、ここに残ります。</p>' +
      chart +
      '<div class="section-label">🃏 実行したカード</div>' +
      listHtml;
  }

  /* ---- 7. お気に入り ---- */
  function renderFavorites() {
    var favs = Store.favoriteCards();
    if (favs.length === 0) {
      return '<div class="page-head"><h2>お気に入り</h2></div>' +
        '<p class="page-desc">自分に効きやすいカードを保存しておけます。</p>' +
        '<div class="card empty-state">' +
        (Store.settings().showPote ? '<div class="pote-avatar">' + poteSvg('normal') + '</div>' : '') +
        '<p>' + esc(D.POTE.emptyFavorites) + '</p>' +
        '<button class="btn btn-primary btn-sm" data-action="spin-now">🎰 1枚引いてみる</button>' +
        '</div>';
    }

    // カテゴリ別に表示(カテゴリ定義順)
    var groups = D.CATEGORIES.map(function (cat) {
      return { cat: cat, cards: favs.filter(function (c) { return c.category === cat.id; }) };
    }).filter(function (g) { return g.cards.length > 0; });

    return '<div class="page-head"><h2>お気に入り</h2></div>' +
      '<p class="page-desc">自分に効きやすい回復行動のストックです。</p>' +
      '<button class="btn btn-primary" data-action="spin-favorite">🎲 お気に入りから1枚引く</button>' +
      groups.map(function (g) {
        return '<div class="section-label">' + g.cat.emoji + ' ' + esc(g.cat.label) + '</div>' +
          g.cards.map(function (c) {
            return '<div class="card history-item fav-item">' +
              '<div class="emoji">' + c.emoji + '</div>' +
              '<div class="body">' +
              '<div class="ttl">' + esc(c.title) + '</div>' +
              '<div class="meta"><span>🕐 ' + c.durationMinutes + '分</span><span>' + esc(c.recoveryType) + '</span></div>' +
              '</div>' +
              '<div class="fav-actions">' +
              '<button class="icon-btn active" data-action="unfav-card" data-card="' + c.id + '" aria-label="お気に入り解除">♥</button>' +
              '<button class="icon-btn" data-action="open-favorite" data-card="' + c.id + '" aria-label="このカードをやる">▶</button>' +
              '</div>' +
              '</div>';
          }).join('');
      }).join('');
  }

  /* ---- 8. カード図鑑 ---- */
  function renderDex() {
    var filters = [{ id: 'all', label: 'すべて', emoji: '' }].concat(D.CATEGORIES);
    var cards = state.dexFilter === 'all'
      ? D.CARDS
      : D.CARDS.filter(function (c) { return c.category === state.dexFilter; });

    return '' +
      '<div class="card dex-head-card">' +
      '<div class="body"><h2>カード図鑑 📖</h2><p>カードを集めて、あなたの回復の引き出しを増やそう。</p></div>' +
      '<div class="dex-count"><div class="k">発見済み</div><div class="v">' + Store.discoveredCount() + '<small> / ' + D.CARDS.length + '</small></div></div>' +
      '</div>' +
      '<div class="filter-row">' +
      filters.map(function (f) {
        return '<button class="filter-chip' + (state.dexFilter === f.id ? ' active' : '') + '" data-action="dex-filter" data-filter="' + f.id + '">' +
          (f.emoji ? f.emoji + ' ' : '') + esc(f.label) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="dex-grid">' +
      cards.map(function (c) {
        var found = Store.isDiscovered(c.id);
        if (!found) {
          return '<div class="card dex-card locked">' +
            '<span class="emoji">' + c.emoji + '</span>' +
            '<span class="ttl">???</span>' +
            '<span class="sub">まだ見ぬカード</span>' +
            '</div>';
        }
        var fav = Store.isFavorite(c.id);
        return '<button class="card dex-card" data-action="open-dex-card" data-card="' + c.id + '">' +
          (fav ? '<span class="heart">♥</span>' : '') +
          '<span class="emoji">' + c.emoji + '</span>' +
          '<span class="ttl">' + esc(c.title) + '</span>' +
          categoryChip(c.category) +
          '</button>';
      }).join('') +
      '</div>' +
      (Store.discoveredCount() < D.CARDS.length
        ? poteRow(esc(D.POTE.dex), { small: true, className: 'done-pote' })
        : poteRow('全部集まりました。すごいコレクションです。', { small: true, mood: 'happy', className: 'done-pote' }));
  }

  /* ---- 9. 設定 ---- */
  function renderSettings() {
    var s = Store.settings();
    function toggle(key, on) {
      return '<span class="toggle' + (on ? ' on' : '') + '" data-action="toggle-setting" data-key="' + key + '" role="switch" aria-checked="' + on + '"></span>';
    }
    return '' +
      '<div class="page-head"><h2>設定</h2></div>' +
      '<p class="page-desc">通知や表示を、自分に合う形に調整できます。</p>' +

      '<div class="section-label">🔔 通知</div>' +
      '<div class="card setting-group">' +
      '<div class="setting-row"><span class="ico">🔔</span><span class="lbl">毎日のリマインダー<small>「少し戻る時間です」とお知らせします</small></span>' + toggle('notifyEnabled', s.notifyEnabled) + '</div>' +
      '<div class="setting-row"><span class="ico">🕘</span><span class="lbl">リマインダー時刻</span><input type="time" class="time-input" id="notifyTime" value="' + esc(s.notifyTime) + '"' + (s.notifyEnabled ? '' : ' disabled') + '></div>' +
      '</div>' +

      '<div class="section-label">🎨 表示・サウンド</div>' +
      '<div class="card setting-group">' +
      '<div class="setting-row"><span class="ico">🐕</span><span class="lbl">ぽてを表示する</span>' + toggle('showPote', s.showPote) + '</div>' +
      '<div class="setting-row"><span class="ico">🔈</span><span class="lbl">効果音</span>' + toggle('sound', s.sound) + '</div>' +
      '</div>' +

      '<div class="section-label">🗂️ データ</div>' +
      '<div class="card setting-group">' +
      '<button class="setting-row danger" data-action="reset-data"><span class="ico">🗑️</span><span class="lbl">データをリセット<small>履歴・お気に入り・図鑑をすべて消します</small></span></button>' +
      '</div>' +

      '<div class="section-label">ℹ️ このアプリについて</div>' +
      '<div class="card">' +
      '<p class="about-text"><strong>' + esc(D.APP.name) + '</strong><br>' +
      '疲れたとき、やる気が出ないときに、今の自分に合った小さな回復行動を1枚だけ提案するアプリです。頑張らせません。少し戻れたら十分です。</p>' +
      '</div>' +
      '<div class="section-label">⚠️ 注意事項</div>' +
      '<div class="card"><p class="about-text">' + esc(D.APP.disclaimer) + '</p></div>';
  }

  /* ---------- ガチャフロー ---------- */

  var spinTimer = null;
  function startSpin(drawFn) {
    state.screen = 'spin';
    render();
    playPop(520);
    clearTimeout(spinTimer);
    spinTimer = setTimeout(function () {
      var card = drawFn();
      if (!card) {
        state.screen = 'home';
        render();
        showToast('カードを引けませんでした');
        return;
      }
      state.card = card;
      state.resultContext = 'gacha';
      state.screen = 'result';
      render();
      playPop(760);
    }, 1400);
  }

  /* ---------- イベント ---------- */

  function bind() {
    document.querySelectorAll('[data-action]').forEach(function (el) {
      if (el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('click', function () { handle(el.dataset.action, el); });
    });
    var timeInput = document.getElementById('notifyTime');
    if (timeInput) {
      timeInput.addEventListener('change', function () {
        Store.updateSettings({ notifyTime: timeInput.value || '21:00' });
        showToast('リマインダー時刻を保存しました');
      });
    }
  }

  function handle(action, el) {
    switch (action) {
      case 'tab':
        state.screen = el.dataset.tab;
        if (state.screen === 'select') state.stateId = null;
        render();
        break;

      case 'go-home':
        state.screen = 'home';
        render();
        break;

      case 'go-select':
        state.stateId = null;
        state.screen = 'select';
        render();
        break;

      case 'pick-state':
        state.stateId = state.stateId === el.dataset.state ? null : el.dataset.state;
        render();
        break;

      case 'spin-with-state':
        if (!state.stateId) return;
        startSpin(function () { return Store.draw({ stateId: state.stateId }); });
        break;

      case 'spin-now':
        state.stateId = null;
        startSpin(function () { return Store.draw({}); });
        break;

      case 'respin':
      case 'spin-again':
        startSpin(function () { return Store.draw({ stateId: state.stateId }); });
        break;

      case 'not-now': {
        // 同じカテゴリ以外から再抽選する
        var exclude = state.card ? state.card.category : null;
        startSpin(function () { return Store.draw({ stateId: state.stateId, excludeCategory: exclude }); });
        break;
      }

      case 'did-it':
        if (!state.card) return;
        Store.addHistory(state.card.id, state.stateId);
        state.lastPraise = pick(D.POTE.praise);
        // 褒め言葉と「今日のひとこと」が同じ文にならないようにする
        var words = D.POTE.todayWord.filter(function (w) {
          return w.indexOf(state.lastPraise) < 0;
        });
        state.lastWord = pick(words.length > 0 ? words : D.POTE.todayWord);
        state.screen = 'done';
        render();
        playPop(880);
        confetti();
        break;

      case 'toggle-fav': {
        if (!state.card) return;
        var added = Store.toggleFavorite(state.card.id);
        showToast(added ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
        render();
        break;
      }

      case 'copy-share': {
        if (!state.card) return;
        copyText(state.card.shareText)
          .then(function () { showToast('シェア文をコピーしました'); })
          .catch(function () { showToast('コピーできませんでした'); });
        break;
      }

      case 'webshare':
        if (!state.card || !navigator.share) return;
        navigator.share({ text: state.card.shareText }).catch(function () { /* キャンセルは無視 */ });
        break;

      case 'open-favorite': {
        var favCard = findCard(el.dataset.card);
        if (!favCard) return;
        state.card = favCard;
        state.stateId = null;
        state.resultContext = 'favorite';
        state.screen = 'result';
        render();
        break;
      }

      case 'spin-favorite':
        startSpin(function () { return Store.drawFromFavorites(); });
        break;

      case 'fav-card': {
        var addedFav = Store.toggleFavorite(el.dataset.card);
        showToast(addedFav ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
        render();
        break;
      }

      case 'unfav-card':
        Store.toggleFavorite(el.dataset.card);
        showToast('お気に入りを解除しました');
        render();
        break;

      case 'del-history':
        Store.removeHistory(el.dataset.id);
        showToast('履歴を削除しました');
        render();
        break;

      case 'dex-filter':
        state.dexFilter = el.dataset.filter;
        render();
        break;

      case 'open-dex-card': {
        var dexCard = findCard(el.dataset.card);
        if (!dexCard) return;
        state.card = dexCard;
        state.stateId = null;
        state.resultContext = 'dex';
        state.screen = 'result';
        render();
        break;
      }

      case 'toggle-setting': {
        var key = el.dataset.key;
        var cur = Store.settings();
        var next = !cur[key];
        Store.updateSettings((function () { var p = {}; p[key] = next; return p; })());
        if (key === 'notifyEnabled' && next) {
          // 端末通知はUIのみ(静的ホスティングのため)。設定は保存され、将来の実装で使える。
          showToast('リマインダーをONにしました(端末通知は準備中です)');
        }
        render();
        break;
      }

      case 'reset-data':
        if (window.confirm('履歴・お気に入り・図鑑の記録をすべて消します。よろしいですか?')) {
          Store.resetAll();
          state = { screen: 'settings', stateId: null, card: null, resultContext: 'gacha', dexFilter: 'all', lastPraise: '', lastWord: '' };
          render();
          showToast('データをリセットしました');
        }
        break;
    }
  }

  /* ---------- 初期化 ---------- */

  Store.init();
  render();
})();
