/* =========================================================================
 * ごきげん回復ガチャ — app.js
 * 画面遷移・レンダリング・イベント処理。データの読み書きは GachaStore、
 * 静的データは GACHA_DATA を参照する。
 *
 * 中心の価値:「疲れているときに、考えなくても今できる小さな回復を1つだけ決める」
 * 最短フロー: 今の状態を選ぶ → カードが1枚出る → 少しやってみる → 少し戻れた
 *
 * 画面の役割:
 *   onboarding = 初回の3画面(スキップ可)
 *   home       = いま、どんな感じ?(1画面1アクション)
 *   select     = 今の状態をえらぶ(上位4 + ほかの気分)
 *   spin       = ガチャ演出(約1秒)
 *   result     = 出てきた1枚(行動を先出し)
 *   done       = 少し戻れました
 *   myrecovery = マイ回復(最近・お気に入り・ふりかえり・よく合う)
 *   dex        = 回復カード図鑑
 *   settings   = じぶんに合わせる(歯車から開く)
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
    stateId: null,          // 選択中の状態(null = おまかせ)
    card: null,             // 表示中のカード
    resultContext: 'gacha', // 'gacha' | 'favorite' | 'dex'
    dexFilter: 'all',
    showAllStates: false,   // 状態選択で「ほかの気分」を開いているか
    redrawCount: 0,         // 続けて引き直した回数(探しすぎ防止のやさしい合図)
    resultExpanded: false,  // 結果画面の「くわしく」を開いているか
    onboardStep: 0,
    lastPraise: '',
    lastWord: '',
    lastHeading: ''
  };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 利用計測(端末内のみ・個人特定情報は送らない) ---------- */
  function track(name) {
    try {
      var KEY = 'gokigenGacha:events';
      var log = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(log)) log = [];
      log.push({ e: name, at: Date.now() });
      if (log.length > 200) log = log.slice(log.length - 200);
      window.localStorage.setItem(KEY, JSON.stringify(log));
    } catch (e) { /* 保存できなくても進行に影響なし */ }
    try { window.dispatchEvent(new CustomEvent('gokigen:track', { detail: { event: name } })); } catch (e) {}
  }

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

  function cardNo(card) { return D.CARDS.indexOf(card) + 1; }

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

  /* ---------- 時間帯・文脈に応じたぽての一言 ---------- */

  function timeSlot() {
    var h = new Date().getHours();
    if (h >= 5 && h <= 10) return 'morning';
    if (h >= 11 && h <= 15) return 'noon';
    if (h >= 16 && h <= 18) return 'evening';
    return 'night';
  }

  function homePoteMessage() {
    var since = Store.daysSinceLastRun();
    if (since !== null && since >= 3) return pick(D.POTE.comeback);   // 久しぶり
    if (Store.todayCount() > 0) return pick(D.POTE.doneToday);        // 今日すでに回復済み
    var lines = D.POTE.timeOfDay[timeSlot()] || [];
    return pick(lines.concat(pick(D.POTE.home)));                     // 時間帯 + たまに定番
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
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) { /* 音が出なくても進行に影響なし */ }
  }

  /* ---------- 紙吹雪(実行完了時の控えめな演出) ---------- */

  function confetti() {
    if (reduceMotion) return; // 動きを抑える設定では出さない
    try {
      var colors = ['#16233E', '#24365C', '#8B9BBC', '#A98F63', '#EAE2D3'];
      for (var i = 0; i < 12; i++) {
        var dot = document.createElement('div');
        dot.className = 'confetti-dot';
        var size = 5 + Math.random() * 6;
        dot.style.width = size + 'px';
        dot.style.height = size + 'px';
        dot.style.left = Math.random() * 100 + 'vw';
        dot.style.background = pick(colors);
        dot.style.animationDuration = 1.5 + Math.random() * 1.2 + 's';
        dot.style.animationDelay = Math.random() * 0.3 + 's';
        document.body.appendChild(dot);
        setTimeout(function (el) { el.remove(); }.bind(null, dot), 3200);
      }
    } catch (e) { /* 演出は失敗しても無視 */ }
  }

  /* ---------- SVGパーツ ---------- */

  // 季節の小物(月で自動的に衣替え。設定でOFF可)
  function seasonAccessory() {
    if (!Store.settings().seasonal) return '';
    var m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) {
      return '<ellipse cx="16" cy="18" rx="4" ry="2.6" fill="#F2EADB" transform="rotate(-25 16 18)"/>' +
        '<ellipse cx="96" cy="30" rx="3.4" ry="2.2" fill="#F2EADB" transform="rotate(20 96 30)"/>' +
        '<ellipse cx="88" cy="12" rx="3" ry="2" fill="#EAE2D3" transform="rotate(-10 88 12)"/>';
    }
    if (m >= 6 && m <= 8) {
      return '<path d="M55 12 q-1 -7 -7 -9 q7 -1 9 6" fill="#16233E"/>' +
        '<path d="M57 9 q3 -6 9 -6 q-3 6 -8 8" fill="#8B9BBC"/>' +
        '<path d="M55 15 q1 -4 2 -6" stroke="#24365C" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    }
    if (m >= 9 && m <= 11) {
      return '<ellipse cx="15" cy="90" rx="5" ry="3" fill="#A98F63" transform="rotate(-30 15 90)"/>' +
        '<ellipse cx="97" cy="93" rx="4" ry="2.5" fill="#8B7250" transform="rotate(25 97 93)"/>';
    }
    return '<path d="M33 57 q22 10 44 0 l-1 7 q-21 9 -42 0 Z" fill="#A98F63"/>' +
      '<rect x="30" y="60" width="8" height="16" rx="3" fill="#A98F63"/>' +
      '<path d="M31 66 h6 M31 71 h6" stroke="#8B7250" stroke-width="1.4"/>';
  }

  // ぽて(柴犬風のゆるい回復係)。mood: 'normal' | 'happy' | 'sleepy'
  function poteSvg(mood) {
    if (!Store.settings().showPote) return '';
    var eyes;
    if (mood === 'happy') {
      eyes = '<path d="M39 46 q4 -5 8 0" stroke="#1B1B1E" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
             '<path d="M61 46 q4 -5 8 0" stroke="#1B1B1E" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    } else if (mood === 'sleepy') {
      eyes = '<path d="M39 47 q4 3 8 0" stroke="#1B1B1E" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
             '<path d="M61 47 q4 3 8 0" stroke="#1B1B1E" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<circle cx="43" cy="46" r="3" fill="#1B1B1E"/><circle cx="65" cy="46" r="3" fill="#1B1B1E"/>';
    }
    return '' +
      '<svg viewBox="0 0 110 102" role="img" aria-label="ぽて">' +
      '<ellipse cx="55" cy="94" rx="40" ry="6" fill="#16233E" opacity="0.28"/>' +
      '<ellipse cx="55" cy="72" rx="27" ry="22" fill="#CDBEA2"/>' +
      '<ellipse cx="55" cy="78" rx="17" ry="13" fill="#FBFAF7"/>' +
      '<ellipse cx="40" cy="88" rx="8" ry="5" fill="#CDBEA2"/>' +
      '<ellipse cx="70" cy="88" rx="8" ry="5" fill="#CDBEA2"/>' +
      '<circle cx="84" cy="70" r="9" fill="#CDBEA2"/><circle cx="86" cy="68" r="5" fill="#FBFAF7"/>' +
      '<path d="M30 25 L40 9 L48 23 Z" fill="#CDBEA2"/><path d="M35 22 L40 14 L44 21 Z" fill="#A98F63"/>' +
      '<path d="M80 25 L70 9 L62 23 Z" fill="#CDBEA2"/><path d="M75 22 L70 14 L66 21 Z" fill="#A98F63"/>' +
      '<circle cx="55" cy="41" r="26" fill="#CDBEA2"/>' +
      '<ellipse cx="55" cy="51" rx="15" ry="12" fill="#FBFAF7"/>' +
      eyes +
      '<ellipse cx="54" cy="51" rx="3.4" ry="2.6" fill="#1B1B1E"/>' +
      '<path d="M54 54 q0 4 -4 5 M54 54 q0 4 4 5" stroke="#1B1B1E" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="35" cy="52" r="4" fill="#F2EADB" opacity="0.8"/>' +
      '<circle cx="75" cy="52" r="4" fill="#F2EADB" opacity="0.8"/>' +
      '<rect x="46" y="63" width="18" height="14" rx="4" fill="#16233E"/>' +
      '<path d="M64 66 q6 2 0 8" stroke="#16233E" stroke-width="3" fill="none"/>' +
      '<circle cx="53" cy="69" r="1.7" fill="#FBFAF7"/><circle cx="57" cy="69" r="1.7" fill="#FBFAF7"/><circle cx="55" cy="72" r="1.7" fill="#FBFAF7"/>' +
      '<path d="M51 59 q1 -3 0 -5 M57 59 q1 -3 0 -5" stroke="#B6B3AB" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      seasonAccessory() +
      '</svg>';
  }

  // 小さな鉢植え(シーンの隅に置く)
  function plantSvg() {
    return '' +
      '<svg viewBox="0 0 30 42" aria-hidden="true">' +
      '<path d="M15 24 q-1 -10 -8 -13 q8 0 10 9 q2 -12 11 -14 q-7 6 -9 18" fill="none" stroke="#16233E" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="7" cy="11" r="2.4" fill="#16233E"/><circle cx="28" cy="6" r="2.4" fill="#8B9BBC"/>' +
      '<path d="M8 26 h14 l-2 13 h-10 Z" fill="#EAE2D3"/>' +
      '<rect x="7" y="24" width="16" height="4" rx="2" fill="#B6B3AB"/>' +
      '</svg>';
  }

  // ガチャマシン(藍)
  function machineSvg() {
    return '' +
      '<svg viewBox="0 0 90 112" role="img" aria-label="ガチャマシン">' +
      '<rect x="16" y="58" width="58" height="44" rx="10" fill="#16233E"/>' +
      '<rect x="16" y="58" width="58" height="10" fill="#24365C"/>' +
      '<circle cx="45" cy="80" r="9" fill="#FBFAF7"/><rect x="41" y="76" width="8" height="8" rx="2" fill="#24365C"/>' +
      '<rect x="30" y="94" width="30" height="8" rx="4" fill="#24365C"/>' +
      '<circle cx="45" cy="34" r="26" fill="#FFFFFF" stroke="#EAE2D3" stroke-width="2.5"/>' +
      '<circle cx="36" cy="30" r="8" fill="#16233E"/>' +
      '<circle cx="52" cy="26" r="8" fill="#A98F63"/>' +
      '<circle cx="48" cy="42" r="8" fill="#8B9BBC"/>' +
      '<circle cx="34" cy="44" r="7" fill="#24365C"/>' +
      '<rect x="38" y="2" width="14" height="8" rx="3" fill="#24365C"/>' +
      '</svg>';
  }

  // カプセル(演出用)
  function capsuleSvg() {
    return '' +
      '<svg viewBox="0 0 60 60" role="img" aria-label="カプセル">' +
      '<path d="M6 30 a24 24 0 0 1 48 0 Z" fill="#FFFFFF" stroke="#EAE2D3" stroke-width="2"/>' +
      '<path d="M6 30 a24 24 0 0 0 48 0 Z" fill="#16233E"/>' +
      '<circle cx="22" cy="20" r="5" fill="#FFF" opacity="0.6"/>' +
      '</svg>';
  }

  var TAB_ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V21 H19 V10"/></svg>',
    myrecovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 20 a7.5 7.5 0 0 1 15 0"/></svg>',
    dex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5 C10 3.8 7 3.5 4 4.5 V19 C7 18 10 18.3 12 20 C14 18.3 17 18 20 19 V4.5 C17 3.5 14 3.8 12 5.5 Z"/><path d="M12 5.5 V20"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 L13.2 5.6 L16.2 4.9 L16.9 7.9 L19.8 8.8 L18.6 11.6 L20.5 14 L18 15.8 L18.4 18.9 L15.3 19 L13.9 21.8 L12 20 L10.1 21.8 L8.7 19 L5.6 18.9 L6 15.8 L3.5 14 L5.4 11.6 L4.2 8.8 L7.1 7.9 L7.8 4.9 L10.8 5.6 Z" opacity="0.5"/></svg>'
  };

  function heart(filled) { return filled ? '♥' : '♡'; }

  function stars(difficulty) {
    var s = '';
    for (var i = 1; i <= 3; i++) s += i <= difficulty ? '★' : '<span class="off">☆</span>';
    return '<span class="stars" aria-hidden="true">' + s + '</span>';
  }

  function difficultyLabel(d) {
    return d === 1 ? 'ほぼ何もしない' : d === 2 ? '少しだけ動く' : 'ちょっと整える';
  }

  function catOf(card) { return D.categoryById[card.category]; }

  function categoryTag(catId, useEffectLabel) {
    var cat = D.categoryById[catId];
    if (!cat) return '';
    return '<span class="tag t-' + cat.tone + '">' + esc(useEffectLabel ? cat.effectLabel : cat.label) + '</span>';
  }

  function poteRow(html, opts) {
    opts = opts || {};
    var avatar = Store.settings().showPote
      ? '<div class="pote-avatar' + (opts.small ? ' small' : '') + '">' + poteSvg(opts.mood || 'normal') + '</div>'
      : '';
    var shelf = opts.plant && Store.settings().showPote ? '<div class="shelf">' + plantSvg() + '</div>' : '';
    return '<div class="pote-scene' + (opts.className ? ' ' + opts.className : '') + '">' +
      avatar + '<div class="pote-bubble">' + html + '</div>' + shelf + '</div>';
  }

  function gearButton() {
    return '<button class="gear-btn" data-action="tab" data-tab="settings" aria-label="設定を開く">' + TAB_ICONS.settings + '</button>';
  }

  /* ---------- 集計ヘルパー(マイ回復) ---------- */

  // 今月、回復を記録できた日数
  function daysThisMonth() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var set = {};
    Store.history().forEach(function (e) {
      var d = new Date(e.at);
      if (d.getFullYear() === y && d.getMonth() === m) set[Store.dayKey(e.at)] = 1;
    });
    return Object.keys(set).length;
  }

  // 「自分によく合う回復」= これまでよく実行したカード(上位)
  function suitedCards(limit) {
    var runs = Store.cardRunCounts();
    return Object.keys(runs)
      .sort(function (a, b) { return runs[b] - runs[a]; })
      .map(findCard)
      .filter(Boolean)
      .slice(0, limit || 3);
  }

  /* ---------- レンダリング ---------- */

  var TABS = [
    { id: 'home', label: 'ホーム' },
    { id: 'myrecovery', label: 'マイ回復' },
    { id: 'dex', label: '図鑑' }
  ];

  function activeTab() {
    if (['select', 'spin', 'result', 'done'].indexOf(state.screen) >= 0) return 'home';
    if (state.screen === 'settings') return '';   // 設定はタブに属さない
    return state.screen;
  }

  function renderTabbar() {
    // オンボーディングと演出中はタブを隠して迷いを減らす
    if (state.screen === 'onboarding' || state.screen === 'spin') {
      tabbarEl.hidden = true;
      return;
    }
    tabbarEl.hidden = false;
    var active = activeTab();
    tabbarEl.innerHTML = TABS.map(function (t) {
      return '<button class="tab-btn' + (t.id === active ? ' active' : '') + '" data-action="tab" data-tab="' + t.id + '" aria-label="' + t.label + '"' +
        ' aria-current="' + (t.id === active ? 'page' : 'false') + '">' +
        TAB_ICONS[t.id] + '<span>' + t.label + '</span></button>';
    }).join('');
  }

  function render() {
    var screens = {
      onboarding: renderOnboarding,
      home: renderHome,
      select: renderSelect,
      spin: renderSpin,
      result: renderResult,
      done: renderDone,
      myrecovery: renderMyRecovery,
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

  /* ---- 0. 初回オンボーディング(3画面・スキップ可) ---- */
  function renderOnboarding() {
    var steps = D.ONBOARDING;
    var i = Math.max(0, Math.min(steps.length - 1, state.onboardStep));
    var s = steps[i];
    var last = i === steps.length - 1;
    var dots = steps.map(function (_, n) {
      return '<span class="ob-dot' + (n === i ? ' on' : '') + '" aria-hidden="true"></span>';
    }).join('');
    var stepList = s.steps
      ? '<ol class="ob-steps">' + s.steps.map(function (t, n) {
          return '<li><span class="n">' + (n + 1) + '</span>' + esc(t) + '</li>';
        }).join('') + '</ol>'
      : '';
    var body = s.body ? '<p class="ob-body">' + esc(s.body) + '</p>' : '';

    return '' +
      '<div class="onboarding">' +
      '<div class="ob-top"><button class="ob-skip" data-action="onboard-skip">スキップ</button></div>' +
      '<div class="ob-body-wrap">' +
      (Store.settings().showPote ? '<div class="ob-pote">' + poteSvg(last ? 'happy' : 'normal') + '</div>' : '<div class="ob-emoji" aria-hidden="true">' + s.emoji + '</div>') +
      '<h1 class="ob-title">' + esc(s.title) + '</h1>' +
      body +
      stepList +
      '</div>' +
      '<div class="ob-foot">' +
      '<div class="ob-dots" role="progressbar" aria-valuemin="1" aria-valuemax="' + steps.length + '" aria-valuenow="' + (i + 1) + '">' + dots + '</div>' +
      '<button class="btn btn-primary" data-action="' + (last ? 'onboard-done' : 'onboard-next') + '">' + (last ? 'はじめる' : '次へ') + '</button>' +
      '</div>' +
      '</div>';
  }

  /* ---- 1. ホーム = いま、どんな感じ? ---- */
  function renderHome() {
    track('gokigen_home_view');
    var hasHistory = Store.history().length > 0;
    var last = hasHistory ? findCard(Store.history()[0].cardId) : null;
    var todayN = Store.todayCount();

    var quiet = '';
    if (hasHistory && last) {
      var lead = todayN > 0 ? '今日やった回復' : '最近やった回復';
      quiet = '' +
        '<div class="home-quiet">' +
        '<button class="quiet-strip" data-action="tab" data-tab="myrecovery" aria-label="マイ回復をひらく">' +
        '<span class="q-emoji" aria-hidden="true">' + last.emoji + '</span>' +
        '<span class="q-body"><span class="q-k">' + lead + '</span><span class="q-ttl">' + esc(last.title) + '</span></span>' +
        (todayN > 0 ? '<span class="q-badge">今日 ' + todayN + '回</span>' : '') +
        '<span class="q-arrow" aria-hidden="true">›</span>' +
        '</button>' +
        (todayN > 0 ? '<p class="home-note">' + esc(pick(D.POTE.doneToday)) + '</p>' : '') +
        '</div>';
    }

    return '' +
      '<div class="home-top">' +
      '<span class="home-brand">' + esc(D.APP.name) + '</span>' +
      gearButton() +
      '</div>' +
      '<h1 class="home-h1">いま、どんな感じ?</h1>' +
      '<p class="home-sub">' + esc(D.APP.subcopy) + '</p>' +
      '<div class="home-hero">' +
      '<div class="home-machine">' + machineSvg() + '</div>' +
      (Store.settings().showPote ? '<div class="home-pote">' + poteSvg(timeSlot() === 'night' ? 'sleepy' : 'normal') + '</div>' : '') +
      '</div>' +
      (Store.settings().showPote ? '<p class="home-pote-line">' + esc(homePoteMessage()) + '</p>' : '') +
      '<div class="home-cta">' +
      '<button class="btn btn-primary" data-action="go-select">今の状態から引く<span class="btn-arrow" aria-hidden="true">›</span></button>' +
      '<button class="btn btn-secondary" data-action="spin-now">おまかせで引く</button>' +
      '</div>' +
      quiet;
  }

  /* ---- 2. 状態選択 = 今の自分をえらぶ ---- */
  function renderSelect() {
    var primary = D.PRIMARY_STATES.map(function (id) { return D.stateById[id]; }).filter(Boolean);
    var rest = D.STATES.filter(function (s) { return D.PRIMARY_STATES.indexOf(s.id) < 0; });

    function stateCard(s, big) {
      return '<button class="state-card t-' + s.tone + (big ? ' big' : '') + '" data-action="pick-state" data-state="' + s.id + '" aria-label="' + esc(s.label) + '。' + esc(s.desc) + '">' +
        '<span class="emoji" aria-hidden="true">' + s.emoji + '</span>' +
        '<span class="ttl">' + esc(s.label) + '</span>' +
        '<span class="desc">' + esc(s.desc) + '</span>' +
        '</button>';
    }

    var moreBlock = state.showAllStates
      ? '<div class="state-grid more">' + rest.map(function (s) { return stateCard(s, false); }).join('') + '</div>'
      : '<button class="btn btn-ghost more-btn" data-action="show-all-states" aria-expanded="false">ほかの気分も見る<span aria-hidden="true"> ▾</span></button>';

    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="tab" data-tab="home" aria-label="ホームに戻る">‹</button>' +
      '<h2>いま、どんな感じ?</h2>' +
      '</div>' +
      '<p class="select-hint">迷ったら「疲れた」で大丈夫です。</p>' +
      '<div class="state-grid primary">' + primary.map(function (s) { return stateCard(s, true); }).join('') + '</div>' +
      moreBlock +
      poteRow(esc(pick(D.POTE.select)), { small: true, className: 'select-pote' }) +
      '<button class="btn btn-ghost quiet omakase" data-action="spin-now">選ばずに、おまかせで引く</button>';
  }

  /* ---- 3. ガチャ演出(約1秒) ---- */
  function renderSpin() {
    return '' +
      '<div class="spin-screen">' +
      '<div class="spin-stage">' +
      '<div class="spin-machine">' + machineSvg() + '</div>' +
      (Store.settings().showPote ? '<div class="spin-pote">' + poteSvg('normal') + '</div>' : '') +
      '<div class="spin-capsule">' + capsuleSvg() + '</div>' +
      '</div>' +
      '<p class="spin-text" aria-live="polite">' + esc(pick(D.POTE.spinning)) + '<span class="spin-dots"></span></p>' +
      '</div>';
  }

  /* ---- 4. 結果カード = 出てきた1枚(行動を先出し) ---- */
  function renderResult() {
    var c = state.card;
    if (!c) return renderHome();
    track('gokigen_card_view');
    var cat = catOf(c);
    var fav = Store.isFavorite(c.id);
    var fromGacha = state.resultContext === 'gacha';
    var fromDex = state.resultContext === 'dex';
    var expanded = state.resultExpanded || fromDex;

    var statePills = c.suitedStates.map(function (id) {
      var s = D.stateById[id];
      return s ? '<span class="tag t-' + s.tone + '">' + esc(s.label) + '</span>' : '';
    }).join('');

    var details = '' +
      '<div class="result-details"' + (expanded ? '' : ' hidden') + '>' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><div class="k">カテゴリ</div><div class="v">' + categoryTag(c.category) + '</div></div>' +
      '<div class="meta-item"><div class="k">むずかしさ</div><div class="v">' + stars(c.difficulty) + ' <small>' + difficultyLabel(c.difficulty) + '</small></div></div>' +
      '<div class="meta-item"><div class="k">回復タイプ</div><div class="v"><span class="tag t-' + cat.tone + '">' + esc(c.recoveryType) + '</span></div></div>' +
      '<div class="meta-item"><div class="k">向いている状態</div><div class="state-pills">' + statePills + '</div></div>' +
      '</div>' +
      '<div class="result-msg"><p>' + esc(c.mainMessage) + '</p></div>' +
      '<div class="result-pote">' +
      (Store.settings().showPote ? '<div class="pote-avatar small">' + poteSvg('normal') + '</div>' : '') +
      '<div class="pote-bubble">' + esc(c.poteMessage) + '</div>' +
      '</div>' +
      '<div class="result-sub-actions">' +
      '<button class="btn btn-outline btn-sm' + (fav ? ' isfav' : '') + '" data-action="toggle-fav" aria-pressed="' + fav + '">' + heart(fav) + ' お気に入り' + (fav ? '済み' : '') + '</button>' +
      '<button class="btn btn-outline btn-sm" data-action="share-card">⤴ シェア</button>' +
      '</div>' +
      '</div>';

    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="' + (fromDex ? 'tab' : 'go-home') + '"' + (fromDex ? ' data-tab="dex"' : '') + ' aria-label="戻る">‹</button>' +
      '<h2>今日の回復</h2>' +
      '</div>' +
      '<div class="paper result-card">' +
      '<span class="tape t-' + cat.tone + '"></span>' +
      '<div class="result-emoji t-' + cat.tone + '" aria-hidden="true">' + c.emoji + '</div>' +
      '<h2 class="result-title">' + esc(c.title) + '</h2>' +
      '<div class="result-duration"><span aria-hidden="true">🕐</span> 約' + c.durationMinutes + '分</div>' +
      '<p class="result-action">' + esc(c.action) + '</p>' +
      '</div>' +
      (fromGacha && state.redrawCount >= 3 ? '<p class="redraw-note">' + esc(D.POTE.redrawNote) + '</p>' : '') +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="did-it">少しやってみる<span class="btn-arrow" aria-hidden="true">›</span></button>' +
      (fromGacha
        ? '<button class="btn btn-outline" data-action="not-now">今はちがう</button>'
        : '<button class="btn btn-outline" data-action="' + (fromDex ? 'tab" data-tab="dex' : 'go-home') + '">' + (fromDex ? '図鑑にもどる' : 'ホームにもどる') + '</button>') +
      '</div>' +
      '<button class="details-toggle" data-action="toggle-details" aria-expanded="' + expanded + '">' +
      (expanded ? 'とじる' : 'くわしく見る') + '<span aria-hidden="true">' + (expanded ? ' ▴' : ' ▾') + '</span></button>' +
      details;
  }

  /* ---- 5. 実行完了 = 少し戻れました ---- */
  function renderDone() {
    var c = state.card;
    var fav = c ? Store.isFavorite(c.id) : false;
    return '' +
      '<div class="done-screen">' +
      poteRow(
        '<strong class="done-head">' + esc(state.lastHeading) + '</strong>' +
        '<span class="sub">' + esc(state.lastPraise) + '</span>',
        { mood: 'happy', className: 'done-pote' }
      ) +
      (c ? '<div class="paper done-card">' +
        '<span class="done-emoji" aria-hidden="true">' + c.emoji + '</span>' +
        '<div class="done-card-body"><span class="k">やってみた回復</span><span class="ttl">' + esc(c.title) + '</span></div>' +
        '</div>' : '') +
      '<p class="done-count">今日は ' + Store.todayCount() + ' 回、自分をいたわれました</p>' +
      '<div class="paper done-word">' +
      '<div class="ic" aria-hidden="true">📎</div>' +
      '<div><div class="k">今日のひとこと</div><p>' + esc(state.lastWord) + '</p></div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="go-home">ホームにもどる</button>' +
      '<div class="btn-row">' +
      '<button class="btn btn-outline btn-sm" data-action="spin-again">もう1枚引く</button>' +
      (c ? '<button class="btn btn-outline btn-sm' + (fav ? ' isfav' : '') + '" data-action="toggle-fav">' + heart(fav) + ' お気に入り' + (fav ? '済み' : '') + '</button>' : '') +
      '</div>' +
      '<p class="done-enough">今日はここまででも、十分です。</p>' +
      '</div>' +
      '</div>';
  }

  /* ---- 6. マイ回復 = 最近・お気に入り・ふりかえり・よく合う ---- */
  function renderMyRecovery() {
    track('gokigen_my_recovery_view');
    var history = Store.history();
    var favs = Store.favoriteCards();

    if (history.length === 0 && favs.length === 0) {
      return '' +
        '<div class="page-head with-gear"><h2>マイ回復</h2>' + gearButton() + '</div>' +
        '<div class="paper empty-state">' +
        (Store.settings().showPote ? '<div class="pote-avatar">' + poteSvg('normal') + '</div>' : '') +
        '<p>' + esc(D.POTE.emptyMyRecovery) + '</p>' +
        '<button class="btn btn-primary btn-sm" data-action="go-select">1枚引いてみる</button>' +
        '</div>';
    }

    /* --- セクション1: 最近やった回復 --- */
    var recent = history.slice(0, 6);
    var recentHtml = '<div class="eyebrow">最近やった回復</div>' +
      (recent.length === 0
        ? '<div class="paper soft-empty">' + esc(D.POTE.emptyRecent) + '</div>'
        : '<div class="my-recent">' + recent.map(function (e) {
            var c = findCard(e.cardId);
            if (!c) return '';
            var st = e.stateId ? D.stateById[e.stateId] : null;
            var t = new Date(e.at);
            var when = (t.getMonth() + 1) + '/' + t.getDate();
            var fav = Store.isFavorite(c.id);
            return '<button class="paper recent-item" data-action="open-card" data-card="' + c.id + '">' +
              '<span class="r-emoji tag t-' + catOf(c).tone + '" aria-hidden="true">' + c.emoji + '</span>' +
              '<span class="r-body"><span class="r-ttl">' + esc(c.title) + '</span>' +
              '<span class="r-meta">' + (st ? esc(st.label) + ' · ' : '') + when + '</span></span>' +
              (fav ? '<span class="r-fav" aria-hidden="true">♥</span>' : '') +
              '</button>';
          }).join('') + '</div>');

    /* --- セクション2: お気に入り --- */
    var favHtml = '<div class="eyebrow">お気に入り</div>' +
      (favs.length === 0
        ? '<div class="paper soft-empty">' + esc(D.POTE.emptyFavorites) + '</div>'
        : '<div class="my-fav">' + favs.slice(0, 8).map(function (c) {
            return '<button class="paper fav-item" data-action="open-card" data-card="' + c.id + '">' +
              '<span class="emoji tag t-' + catOf(c).tone + '" aria-hidden="true">' + c.emoji + '</span>' +
              '<div class="body"><div class="ttl">' + esc(c.title) + '</div>' +
              '<div class="meta">約' + c.durationMinutes + '分</div></div>' +
              '<span class="icon-btn active" data-action="unfav-card" data-card="' + c.id + '" role="button" aria-label="お気に入り解除">♥</span>' +
              '</button>';
          }).join('') + '</div>');

    /* --- セクション3: 今週のふりかえり(数字より文章) --- */
    var w = Store.weeklySummary();
    var topCat = w.topCategory ? D.categoryById[w.topCategory.id] : null;
    var topCard = w.topCard ? findCard(w.topCard.id) : null;
    var reflectLines = [];
    if (w.count > 0) {
      reflectLines.push('今週は' + w.activeDays + '日、自分をいたわれました');
      if (topCat) reflectLines.push('「' + topCat.label + '」のカードをよく使っています');
      if (topCard) reflectLines.push('「' + topCard.title + '」が、最近よく合っています');
    } else {
      reflectLines.push('今週はこれからです。1枚戻れたら十分です');
    }
    // 小さな週グラフ(管理画面らしくしない)
    var week = Store.last7Days();
    var maxC = Math.max(1, Math.max.apply(null, week.map(function (d) { return d.count; })));
    var todayKey = Store.dayKey(new Date());
    var miniChart = '<div class="mini-week" aria-hidden="true">' + week.map(function (d) {
      var h = d.count === 0 ? 5 : Math.round((d.count / maxC) * 40) + 5;
      return '<div class="mw-col' + (d.count === 0 ? ' zero' : '') + (d.key === todayKey ? ' today' : '') + '">' +
        '<div class="mw-bar" style="height:' + h + 'px"></div>' +
        '<div class="mw-day">' + d.weekday + '</div></div>';
    }).join('') + '</div>';

    var reflectHtml = '<div class="eyebrow">今週のふりかえり</div>' +
      '<div class="paper reflect-card">' +
      reflectLines.map(function (l, i) { return '<p class="reflect-line' + (i === 0 ? ' lead' : '') + '">' + esc(l) + '</p>'; }).join('') +
      miniChart +
      '</div>';

    /* --- 控えめな数字 --- */
    var topCatRecent = Store.topCategory7d();
    var topCatRecentLabel = topCatRecent ? D.categoryById[topCatRecent.categoryId].label : '—';
    var quietStats = '<div class="paper quiet-stats">' +
      '<div class="qs-cell"><span class="qs-k">今月いたわれた日</span><span class="qs-v">' + daysThisMonth() + '<small>日</small></span></div>' +
      '<div class="qs-cell"><span class="qs-k">最近やった回数</span><span class="qs-v">' + w.count + '<small>回</small></span></div>' +
      '<div class="qs-cell"><span class="qs-k">よく使うカテゴリ</span><span class="qs-v small">' + esc(topCatRecentLabel) + '</span></div>' +
      '</div>';

    /* --- セクション4: 自分によく合う回復 --- */
    var suited = suitedCards(3);
    var suitedHtml = '<div class="eyebrow">自分によく合う回復</div>' +
      (suited.length === 0
        ? '<div class="paper soft-empty">' + esc(D.POTE.emptySuited) + '</div>'
        : '<div class="my-suited">' + suited.map(function (c) {
            var n = Store.cardRunCounts()[c.id] || 0;
            return '<button class="paper suited-item" data-action="open-card" data-card="' + c.id + '">' +
              '<span class="emoji tag t-' + catOf(c).tone + '" aria-hidden="true">' + c.emoji + '</span>' +
              '<div class="body"><div class="ttl">' + esc(c.title) + '</div>' +
              '<div class="meta">約' + c.durationMinutes + '分' + (n > 0 ? ' · ' + n + '回やってみた' : '') + '</div></div>' +
              '<span class="arrow" aria-hidden="true">›</span>' +
              '</button>';
          }).join('') + '</div>');

    return '' +
      '<div class="page-head with-gear"><h2>マイ回復</h2>' + gearButton() + '</div>' +
      '<p class="page-desc">' + esc(D.POTE.myRecovery) + '</p>' +
      recentHtml +
      favHtml +
      reflectHtml +
      quietStats +
      suitedHtml;
  }

  /* ---- 7. 図鑑 = 回復カードのコレクション ---- */
  function renderDex() {
    track('gokigen_dex_view');
    var filters = [{ id: 'all', label: 'すべて' }].concat(D.CATEGORIES);
    var cards = state.dexFilter === 'all'
      ? D.CARDS
      : D.CARDS.filter(function (c) { return c.category === state.dexFilter; });
    var found = Store.discoveredCount();

    return '' +
      '<div class="page-head with-gear"><h2>回復カード図鑑</h2></div>' +
      '<p class="dex-lead">これまでに <b>' + found + '</b> 種類の回復を見つけました。</p>' +
      '<div class="filter-row" role="tablist">' +
      filters.map(function (f) {
        return '<button class="filter-chip' + (state.dexFilter === f.id ? ' active' : '') + '" data-action="dex-filter" data-filter="' + f.id + '" aria-pressed="' + (state.dexFilter === f.id) + '">' +
          esc(f.label) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="dex-grid">' +
      cards.map(function (c) {
        var isFound = Store.isDiscovered(c.id);
        var no = cardNo(c);
        if (!isFound) {
          return '<div class="dex-card locked" aria-label="まだ見ぬカード">' +
            '<span class="no">' + no + '</span>' +
            '<span class="emoji" aria-hidden="true">' + c.emoji + '</span>' +
            '<span class="ttl">？</span>' +
            '<span class="sub">これから</span>' +
            '</div>';
        }
        var fav = Store.isFavorite(c.id);
        var cat = catOf(c);
        return '<button class="dex-card" data-action="open-dex-card" data-card="' + c.id + '" aria-label="' + esc(c.title) + '">' +
          '<span class="tape t-' + cat.tone + (no % 2 === 0 ? ' tilt-r' : '') + '"></span>' +
          '<span class="no">' + no + '</span>' +
          (fav ? '<span class="heart" aria-hidden="true">♥</span>' : '') +
          '<span class="emoji" aria-hidden="true">' + c.emoji + '</span>' +
          '<span class="ttl">' + esc(c.title) + '</span>' +
          '<span class="dex-meta">約' + c.durationMinutes + '分</span>' +
          categoryTag(c.category) +
          '</button>';
      }).join('') +
      '</div>' +
      poteRow(esc(found >= D.CARDS.length ? '全部集まりました。すごい引き出しです' : D.POTE.dex), { small: true, className: 'done-pote' });
  }

  /* ---- 8. 設定 = じぶんに合わせる ---- */
  function renderSettings() {
    var s = Store.settings();
    function toggle(key, on) {
      return '<button class="toggle' + (on ? ' on' : '') + '" data-action="toggle-setting" data-key="' + key + '" role="switch" aria-checked="' + on + '" aria-label="切り替え"></button>';
    }
    var legal = 'legal.html';
    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="tab" data-tab="home" aria-label="ホームに戻る">‹</button>' +
      '<h2>じぶんに合わせる</h2>' +
      '</div>' +

      '<div class="eyebrow">表示・サウンド</div>' +
      '<div class="paper setting-group">' +
      '<div class="setting-row"><span class="ic" aria-hidden="true">🐕</span><span class="lbl">ぽてを表示する</span>' + toggle('showPote', s.showPote) + '</div>' +
      '<div class="setting-row"><span class="ic" aria-hidden="true">🍂</span><span class="lbl">季節の小物<small>ぽてが月ごとに小さく衣替えします</small></span>' + toggle('seasonal', s.seasonal) + '</div>' +
      '<div class="setting-row"><span class="ic" aria-hidden="true">🔈</span><span class="lbl">効果音</span>' + toggle('sound', s.sound) + '</div>' +
      '</div>' +

      '<div class="eyebrow">通知</div>' +
      '<div class="paper setting-group">' +
      '<div class="setting-row"><span class="ic" aria-hidden="true">🔔</span><span class="lbl">毎日のリマインダー<small>「少し戻る時間です」とお知らせします</small></span>' + toggle('notifyEnabled', s.notifyEnabled) + '</div>' +
      '<div class="setting-row"><span class="ic" aria-hidden="true">🕘</span><label class="lbl" for="notifyTime">リマインダー時刻</label><input type="time" class="time-input" id="notifyTime" value="' + esc(s.notifyTime) + '"' + (s.notifyEnabled ? '' : ' disabled') + '></div>' +
      '</div>' +

      '<div class="eyebrow">データ</div>' +
      '<div class="paper setting-group">' +
      '<div class="setting-row info"><span class="ic" aria-hidden="true">🔒</span><span class="lbl">データの保存について<small>' + esc(D.APP.dataNote) + '</small></span></div>' +
      '<button class="setting-row danger" data-action="reset-data"><span class="ic" aria-hidden="true">🧹</span><span class="lbl">データを削除する<small>履歴・お気に入り・図鑑をすべて消します</small></span></button>' +
      '</div>' +

      '<div class="eyebrow">このアプリについて</div>' +
      '<div class="paper setting-group">' +
      '<div class="about-block"><strong>' + esc(D.APP.name) + '</strong>' +
      '<p>疲れたとき、やる気が出ないときに、今の自分に合った小さな回復行動を1枚だけ提案するアプリです。少し戻れたら十分です。</p></div>' +
      '<a class="setting-row link" href="' + legal + '"><span class="ic" aria-hidden="true">🔐</span><span class="lbl">プライバシーポリシー</span><span class="chev" aria-hidden="true">›</span></a>' +
      '<a class="setting-row link" href="' + legal + '#terms"><span class="ic" aria-hidden="true">📜</span><span class="lbl">利用規約</span><span class="chev" aria-hidden="true">›</span></a>' +
      '<a class="setting-row link" href="' + legal + '#disclaimer"><span class="ic" aria-hidden="true">⚠️</span><span class="lbl">免責事項</span><span class="chev" aria-hidden="true">›</span></a>' +
      '<a class="setting-row link" href="mailto:' + esc(D.APP.contact) + '"><span class="ic" aria-hidden="true">✉️</span><span class="lbl">お問い合わせ</span><span class="chev" aria-hidden="true">›</span></a>' +
      '</div>' +

      '<div class="paper disclaimer-note"><p>' + esc(D.APP.disclaimer) + '</p></div>' +
      '<button class="btn btn-ghost quiet replay-ob" data-action="replay-onboarding">はじめての説明をもう一度見る</button>';
  }

  /* ---------- ガチャフロー ---------- */

  var spinTimer = null;
  function startSpin(drawFn) {
    track('gokigen_gacha_start');
    state.screen = 'spin';
    render();
    playPop(520);
    clearTimeout(spinTimer);
    var wait = reduceMotion ? 260 : 950; // 演出は約1秒。動きを抑える設定では大幅に短縮
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
      state.resultExpanded = false;
      state.screen = 'result';
      render();
      playPop(760);
    }, wait);
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

  function shareCard(c) {
    track('gokigen_share');
    if (navigator.share) {
      navigator.share({ text: c.shareText }).catch(function () { /* キャンセルは無視 */ });
    } else {
      copyText(c.shareText)
        .then(function () { showToast('シェア文をコピーしました'); })
        .catch(function () { showToast('コピーできませんでした'); });
    }
  }

  function handle(action, el) {
    switch (action) {
      /* --- オンボーディング --- */
      case 'onboard-next':
        state.onboardStep = Math.min(D.ONBOARDING.length - 1, state.onboardStep + 1);
        render();
        break;
      case 'onboard-skip':
      case 'onboard-done':
        Store.markOnboarded();
        if (action === 'onboard-done') track('gokigen_onboarding_complete');
        state.screen = 'home';
        state.onboardStep = 0;
        render();
        break;
      case 'replay-onboarding':
        state.screen = 'onboarding';
        state.onboardStep = 0;
        render();
        break;

      /* --- ナビ --- */
      case 'tab':
        state.screen = el.dataset.tab;
        if (state.screen === 'select') { state.stateId = null; state.showAllStates = false; state.redrawCount = 0; }
        render();
        break;

      case 'go-home':
        state.screen = 'home';
        render();
        break;

      case 'go-select':
        track('gokigen_state_select_open');
        state.stateId = null;
        state.showAllStates = false;
        state.redrawCount = 0;
        state.screen = 'select';
        render();
        break;

      case 'show-all-states':
        state.showAllStates = true;
        render();
        break;

      /* --- 状態タップ → そのままガチャ(確認操作を増やさない) --- */
      case 'pick-state': {
        var sid = el.dataset.state;
        state.stateId = sid;
        state.redrawCount = 0;
        track('gokigen_state_selected');
        startSpin(function () { return Store.draw({ stateId: sid }); });
        break;
      }

      case 'spin-now':
        state.stateId = null;
        state.redrawCount = 0;
        startSpin(function () { return Store.draw({}); });
        break;

      case 'spin-again':
        state.stateId = null;
        state.redrawCount = 0;
        startSpin(function () { return Store.draw({}); });
        break;

      case 'not-now': {
        state.redrawCount += 1;
        var current = state.card;
        startSpin(function () {
          return Store.draw({
            stateId: state.stateId,
            excludeCardId: current ? current.id : null,
            excludeCategory: current ? current.category : null
          });
        });
        break;
      }

      case 'toggle-details':
        state.resultExpanded = !state.resultExpanded;
        render();
        break;

      /* --- 実行(少しやってみる) --- */
      case 'did-it': {
        if (!state.card) return;
        track('gokigen_try_action');
        Store.addHistory(state.card.id, state.stateId);
        state.lastHeading = pick(D.POTE.doneHeading);
        state.lastPraise = pick(D.POTE.praise);
        var words = D.POTE.todayWord.filter(function (w) { return w.indexOf(state.lastPraise) < 0; });
        state.lastWord = pick(words.length > 0 ? words : D.POTE.todayWord);
        state.screen = 'done';
        render();
        playPop(880);
        confetti();
        break;
      }

      /* --- お気に入り --- */
      case 'toggle-fav': {
        if (!state.card) return;
        var added = Store.toggleFavorite(state.card.id);
        if (added) track('gokigen_favorite_add');
        showToast(added ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
        render();
        break;
      }

      case 'unfav-card':
        Store.toggleFavorite(el.dataset.card);
        showToast('お気に入りを解除しました');
        render();
        break;

      /* --- シェア --- */
      case 'share-card':
        if (state.card) shareCard(state.card);
        break;

      /* --- カードを開く(マイ回復から) --- */
      case 'open-card': {
        var oc = findCard(el.dataset.card);
        if (!oc) return;
        state.card = oc;
        state.stateId = null;
        state.resultContext = 'favorite';
        state.resultExpanded = true;
        state.screen = 'result';
        render();
        break;
      }

      /* --- 図鑑 --- */
      case 'dex-filter':
        state.dexFilter = el.dataset.filter;
        render();
        break;

      case 'open-dex-card': {
        var dc = findCard(el.dataset.card);
        if (!dc) return;
        state.card = dc;
        state.stateId = null;
        state.resultContext = 'dex';
        state.resultExpanded = true;
        state.screen = 'result';
        render();
        break;
      }

      /* --- 設定 --- */
      case 'toggle-setting': {
        var key = el.dataset.key;
        var cur = Store.settings();
        var next = !cur[key];
        Store.updateSettings((function () { var p = {}; p[key] = next; return p; })());
        if (key === 'notifyEnabled' && next) {
          showToast('リマインダーをONにしました(端末通知は準備中です)');
        }
        render();
        break;
      }

      case 'reset-data':
        if (window.confirm('履歴・お気に入り・図鑑の記録をすべて消します。よろしいですか?')) {
          Store.resetAll();
          Store.markOnboarded(); // 既に使っている人には再度オンボを出さない
          state = {
            screen: 'settings', stateId: null, card: null, resultContext: 'gacha',
            dexFilter: 'all', showAllStates: false, redrawCount: 0, resultExpanded: false,
            onboardStep: 0, lastPraise: '', lastWord: '', lastHeading: ''
          };
          render();
          showToast('データを削除しました');
        }
        break;
    }
  }

  /* ---------- 初期化 ---------- */

  Store.init();
  if (!Store.isOnboarded()) state.screen = 'onboarding';
  render();
})();
