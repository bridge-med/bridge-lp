/* =========================================================================
 * ごきげん回復ガチャ — app.js
 * 画面遷移・レンダリング・イベント処理。データの読み書きは GachaStore、
 * 静的データは GACHA_DATA を参照する。
 *
 * 画面の役割:
 *   home      = 回復ステーション
 *   select    = 今の自分を選ぶ棚
 *   result    = ぽてが持ってきた1枚
 *   history   = 回復の足あと
 *   dex       = 回復カードのコレクション
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
    stateId: null,          // 選択中の状態(null = 選ばずに回す)
    card: null,             // 表示中のカード
    resultContext: 'gacha', // 'gacha' | 'favorite' | 'dex'
    dexFilter: 'all',
    historyFilter: 'all',
    favFilter: 'all',
    lastPraise: '',
    lastWord: '',
    capsuleRefilled: false // 直前の「やってみた」でカプセルが戻ったか
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

  function cardNo(card) {
    return D.CARDS.indexOf(card) + 1;
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

  /* ---------- 時間帯・文脈に応じたぽての一言 ---------- */

  function timeSlot() {
    var h = new Date().getHours();
    if (h >= 5 && h <= 10) return 'morning';
    if (h >= 11 && h <= 15) return 'noon';
    if (h >= 16 && h <= 18) return 'evening';
    return 'night';
  }

  function homePoteMessage() {
    if (Store.capsuleCount() === 0) return pick(D.POTE.capsuleEmpty); // 今日のカプセル切れ
    var since = Store.daysSinceLastRun();
    if (since !== null && since >= 3) return pick(D.POTE.comeback);   // 久しぶり
    if (Store.todayCount() > 0) return pick(D.POTE.doneToday);        // 今日すでに回復済み
    var lines = D.POTE.timeOfDay[timeSlot()] || [];
    return pick(lines.concat(pick(D.POTE.home)));                     // 時間帯 + たまに定番
  }

  function streakNote() {
    var streak = Store.streakDays();
    if (streak === 0) return D.POTE.streakNote.zero;
    if (streak === 1) return D.POTE.streakNote.one;
    return D.POTE.streakNote.more;
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
    try {
      var colors = ['#D96038', '#7E9977', '#7C99AE', '#E9C46A', '#EFB08C'];
      for (var i = 0; i < 14; i++) {
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
      // 春: 舞う桜の花びら
      return '<ellipse cx="16" cy="18" rx="4" ry="2.6" fill="#EFB8C8" transform="rotate(-25 16 18)"/>' +
        '<ellipse cx="96" cy="30" rx="3.4" ry="2.2" fill="#EFB8C8" transform="rotate(20 96 30)"/>' +
        '<ellipse cx="88" cy="12" rx="3" ry="2" fill="#F5CDD9" transform="rotate(-10 88 12)"/>';
    }
    if (m >= 6 && m <= 8) {
      // 夏: 頭の上に小さな若葉
      return '<path d="M55 12 q-1 -7 -7 -9 q7 -1 9 6" fill="#7E9977"/>' +
        '<path d="M57 9 q3 -6 9 -6 q-3 6 -8 8" fill="#9BB394"/>' +
        '<path d="M55 15 q1 -4 2 -6" stroke="#5D7757" stroke-width="1.4" fill="none" stroke-linecap="round"/>';
    }
    if (m >= 9 && m <= 11) {
      // 秋: 足元に落ち葉
      return '<ellipse cx="15" cy="90" rx="5" ry="3" fill="#D98E4A" transform="rotate(-30 15 90)"/>' +
        '<ellipse cx="97" cy="93" rx="4" ry="2.5" fill="#C97B3D" transform="rotate(25 97 93)"/>';
    }
    // 冬: あたたかいマフラー(垂れは左側・マグと重ねない)
    return '<path d="M33 57 q22 10 44 0 l-1 7 q-21 9 -42 0 Z" fill="#C0574A"/>' +
      '<rect x="30" y="60" width="8" height="16" rx="3" fill="#C0574A"/>' +
      '<path d="M31 66 h6 M31 71 h6" stroke="#A94537" stroke-width="1.4"/>';
  }

  // ぽて(柴犬風のゆるい回復係)。mood: 'normal' | 'happy' | 'sleepy'
  function poteSvg(mood) {
    if (!Store.settings().showPote) return '';
    var eyes;
    if (mood === 'happy') {
      eyes = '<path d="M39 46 q4 -5 8 0" stroke="#46372B" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
             '<path d="M61 46 q4 -5 8 0" stroke="#46372B" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    } else if (mood === 'sleepy') {
      eyes = '<path d="M39 47 q4 3 8 0" stroke="#46372B" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
             '<path d="M61 47 q4 3 8 0" stroke="#46372B" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<circle cx="43" cy="46" r="3" fill="#46372B"/><circle cx="65" cy="46" r="3" fill="#46372B"/>';
    }
    return '' +
      '<svg viewBox="0 0 110 102" role="img" aria-label="ぽて">' +
      // 小さなラグ
      '<ellipse cx="55" cy="94" rx="40" ry="6" fill="#7E9977" opacity="0.28"/>' +
      // 体
      '<ellipse cx="55" cy="72" rx="27" ry="22" fill="#E8B478"/>' +
      '<ellipse cx="55" cy="78" rx="17" ry="13" fill="#F8ECD7"/>' +
      // 前足
      '<ellipse cx="40" cy="88" rx="8" ry="5" fill="#E8B478"/>' +
      '<ellipse cx="70" cy="88" rx="8" ry="5" fill="#E8B478"/>' +
      // しっぽ
      '<circle cx="84" cy="70" r="9" fill="#E8B478"/><circle cx="86" cy="68" r="5" fill="#F8ECD7"/>' +
      // 耳
      '<path d="M30 25 L40 9 L48 23 Z" fill="#E8B478"/><path d="M35 22 L40 14 L44 21 Z" fill="#E7A091"/>' +
      '<path d="M80 25 L70 9 L62 23 Z" fill="#E8B478"/><path d="M75 22 L70 14 L66 21 Z" fill="#E7A091"/>' +
      // 顔
      '<circle cx="55" cy="41" r="26" fill="#E8B478"/>' +
      '<ellipse cx="55" cy="51" rx="15" ry="12" fill="#F8ECD7"/>' +
      eyes +
      '<ellipse cx="54" cy="51" rx="3.4" ry="2.6" fill="#46372B"/>' +
      '<path d="M54 54 q0 4 -4 5 M54 54 q0 4 4 5" stroke="#46372B" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
      '<circle cx="35" cy="52" r="4" fill="#EFB8AC" opacity="0.8"/>' +
      '<circle cx="75" cy="52" r="4" fill="#EFB8AC" opacity="0.8"/>' +
      // マグカップ(クローバー入り)
      '<rect x="46" y="63" width="18" height="14" rx="4" fill="#7E9977"/>' +
      '<path d="M64 66 q6 2 0 8" stroke="#7E9977" stroke-width="3" fill="none"/>' +
      '<circle cx="53" cy="69" r="1.7" fill="#F8ECD7"/><circle cx="57" cy="69" r="1.7" fill="#F8ECD7"/><circle cx="55" cy="72" r="1.7" fill="#F8ECD7"/>' +
      '<path d="M51 59 q1 -3 0 -5 M57 59 q1 -3 0 -5" stroke="#C9B08A" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      seasonAccessory() +
      '</svg>';
  }

  // 小さな鉢植え(シーンの隅に置く)
  function plantSvg() {
    return '' +
      '<svg viewBox="0 0 30 42" aria-hidden="true">' +
      '<path d="M15 24 q-1 -10 -8 -13 q8 0 10 9 q2 -12 11 -14 q-7 6 -9 18" fill="none" stroke="#7E9977" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="7" cy="11" r="2.4" fill="#7E9977"/><circle cx="28" cy="6" r="2.4" fill="#9BB394"/>' +
      '<path d="M8 26 h14 l-2 13 h-10 Z" fill="#C9A87F"/>' +
      '<rect x="7" y="24" width="16" height="4" rx="2" fill="#B8916A"/>' +
      '</svg>';
  }

  // ガチャマシン(柿色)
  function machineSvg() {
    return '' +
      '<svg viewBox="0 0 90 112" role="img" aria-label="ガチャマシン">' +
      '<rect x="16" y="58" width="58" height="44" rx="10" fill="#D96038"/>' +
      '<rect x="16" y="58" width="58" height="10" fill="#BC4E2A"/>' +
      '<circle cx="45" cy="80" r="9" fill="#F8ECD7"/><rect x="41" y="76" width="8" height="8" rx="2" fill="#BC4E2A"/>' +
      '<rect x="30" y="94" width="30" height="8" rx="4" fill="#96401F"/>' +
      '<circle cx="45" cy="34" r="26" fill="#FBF5E7" stroke="#D6C4A0" stroke-width="2.5"/>' +
      '<circle cx="36" cy="30" r="8" fill="#7E9977"/>' +
      '<circle cx="52" cy="26" r="8" fill="#EFB08C"/>' +
      '<circle cx="48" cy="42" r="8" fill="#7C99AE"/>' +
      '<circle cx="34" cy="44" r="7" fill="#E9C46A"/>' +
      '<rect x="38" y="2" width="14" height="8" rx="3" fill="#BC4E2A"/>' +
      '</svg>';
  }

  // カプセル
  function capsuleSvg() {
    return '' +
      '<svg viewBox="0 0 60 60" role="img" aria-label="カプセル">' +
      '<path d="M6 30 a24 24 0 0 1 48 0 Z" fill="#FBF5E7" stroke="#D6C4A0" stroke-width="2"/>' +
      '<path d="M6 30 a24 24 0 0 0 48 0 Z" fill="#D96038"/>' +
      '<circle cx="22" cy="20" r="5" fill="#FFF" opacity="0.6"/>' +
      '</svg>';
  }

  var TAB_ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 L12 3 L21 11"/><path d="M5 10 V21 H19 V10"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15.5 14"/></svg>',
    favorites: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5 C7 16.5 3.5 13.5 3.5 9.5 A4.5 4.5 0 0 1 12 6.5 A4.5 4.5 0 0 1 20.5 9.5 C20.5 13.5 17 16.5 12 20.5 Z"/></svg>',
    dex: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5 C10 3.8 7 3.5 4 4.5 V19 C7 18 10 18.3 12 20 C14 18.3 17 18 20 19 V4.5 C17 3.5 14 3.8 12 5.5 Z"/><path d="M12 5.5 V20"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8 L13.2 5.6 L16.2 4.9 L16.9 7.9 L19.8 8.8 L18.6 11.6 L20.5 14 L18 15.8 L18.4 18.9 L15.3 19 L13.9 21.8 L12 20 L10.1 21.8 L8.7 19 L5.6 18.9 L6 15.8 L3.5 14 L5.4 11.6 L4.2 8.8 L7.1 7.9 L7.8 4.9 L10.8 5.6 Z" opacity="0.5"/></svg>'
  };

  function heart(filled) { return filled ? '♥' : '♡'; }

  function stars(difficulty) {
    var s = '';
    for (var i = 1; i <= 3; i++) s += i <= difficulty ? '★' : '<span class="off">☆</span>';
    return '<span class="stars">' + s + '</span>';
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

  /* ---------- カプセル(1日の抽選回数)UI ---------- */

  function capsuleMeter() {
    var count = Store.capsuleCount();
    var per = Store.CAPSULES_PER_DAY;
    var slots = Math.max(per, count);
    var dots = '';
    for (var i = 0; i < slots; i++) {
      dots += '<span class="cap-dot' + (i < count ? ' on' : '') + (i >= per ? ' bonus' : '') + '" aria-hidden="true"></span>';
    }
    return '<div class="capsule-meter" role="status" aria-label="今日のカプセル 残り' + count + '個">' +
      '<span class="cap-label">きょうのカプセル</span>' +
      '<span class="cap-dots">' + dots + '</span>' +
      '<span class="cap-note">' + (count === 0 ? 'あしたの朝に補充されます' : esc(D.POTE.capsuleNote)) + '</span>' +
      '</div>';
  }

  function capsulesLeft() { return Store.capsuleCount() > 0; }

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
      return '<button class="tab-btn' + (t.id === active ? ' active' : '') + '" data-action="tab" data-tab="' + t.id + '" aria-label="' + t.label + '"' +
        ' aria-current="' + (t.id === active ? 'page' : 'false') + '">' +
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

  /* ---- 1. ホーム = 回復ステーション ---- */
  function renderHome() {
    var favs = Store.favoriteCards().slice(0, 2);
    var favHtml = favs.length === 0 ? '' :
      '<div class="eyebrow">♥ 最近のお気に入り <button class="right" data-action="tab" data-tab="favorites">すべて見る ›</button></div>' +
      '<div class="fav-shortcuts">' +
      favs.map(function (c) {
        return '<button class="fav-shortcut" data-action="open-favorite" data-card="' + c.id + '">' +
          '<span class="heart">♥</span>' +
          '<span class="emoji">' + c.emoji + '</span>' +
          '<span class="ttl">' + esc(c.title) + '</span>' +
          categoryTag(c.category, true) +
          '</button>';
      }).join('') +
      '</div>';

    return '' +
      '<header class="app-head">' +
      '<div class="machine">' + machineSvg() + '</div>' +
      '<h1 class="title-multi"><span class="w1">ごきげん</span><br><span class="w2">回復</span><span class="w3">ガチャ</span></h1>' +
      '</header>' +
      '<p class="app-sub">' + esc(D.APP.subcopy) + '</p>' +
      poteRow(esc(homePoteMessage()), { plant: true, mood: timeSlot() === 'night' ? 'sleepy' : 'normal' }) +
      '<div class="paper station-status">' +
      '<h3>🌿 今日の回復ステータス</h3>' +
      '<div class="status-grid">' +
      '<div class="status-cell c1"><span class="ic">🌱</span><span class="k">今日の回復</span><span class="v">' + Store.todayCount() + '<small>回</small></span></div>' +
      '<div class="status-cell c2"><span class="ic">📅</span><span class="k">連続</span><span class="v">' + Store.streakDays() + '<small>日</small></span></div>' +
      '<button class="status-cell c3" data-action="tab" data-tab="dex"><span class="ic">📖</span><span class="k">みつけた</span><span class="v">' + Store.discoveredCount() + '<small>枚</small></span></button>' +
      '</div>' +
      '<p class="status-note">' + esc(streakNote()) + '</p>' +
      '</div>' +
      capsuleMeter() +
      '<button class="btn btn-primary" data-action="go-select"' + (capsulesLeft() ? '' : ' disabled') + '>今の状態を選ぶ</button>' +
      '<button class="btn btn-secondary" data-action="spin-now"' + (capsulesLeft() ? '' : ' disabled') + '>そのまま回す</button>' +
      favHtml +
      '<button class="paper today-strip" data-action="tab" data-tab="history">' +
      '<span>🗂️</span><span class="ttl">今日実行したカード</span>' +
      '<span class="num">' + Store.todayCount() + '<small> 枚</small></span><span class="arrow">›</span>' +
      '</button>';
  }

  /* ---- 2. 状態選択 = 今の自分を選ぶ棚 ---- */
  function renderSelect() {
    var selected = state.stateId ? D.stateById[state.stateId] : null;
    var ctaLabel = selected ? '「' + selected.label + '」の状態で回す' : 'この状態で回す';
    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="tab" data-tab="home" aria-label="ホームに戻る">‹</button>' +
      '<h2>今の状態をえらぶ</h2>' +
      '</div>' +
      '<p class="page-desc">いちばん近い気分を、ひとつ選ぶだけで大丈夫です。</p>' +
      poteRow(esc(pick(D.POTE.select)), { small: true }) +
      '<div class="state-shelf">' +
      D.STATES.map(function (s) {
        var sel = state.stateId === s.id;
        return '<button class="state-card t-' + s.tone + (sel ? ' selected' : '') + '" data-action="pick-state" data-state="' + s.id + '" aria-pressed="' + sel + '">' +
          '<span class="check" aria-hidden="true">✓</span>' +
          '<span class="emoji">' + s.emoji + '</span>' +
          '<span class="ttl">' + esc(s.label) + '</span>' +
          '<span class="desc">' + esc(s.desc) + '</span>' +
          '</button>';
      }).join('') +
      '</div>' +
      '<div class="select-footer">' +
      '<button class="btn btn-primary" data-action="spin-with-state"' + (state.stateId && capsulesLeft() ? '' : ' disabled') + '>' + esc(ctaLabel) + '</button>' +
      '<button class="btn btn-ghost" data-action="spin-now"' + (capsulesLeft() ? '' : ' disabled') + '>選ばずに回す</button>' +
      '<p class="select-note">' + esc(capsulesLeft() ? D.POTE.selectNote : pick(D.POTE.capsuleEmpty)) + '</p>' +
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

  /* ---- 4. 回復カード = ぽてが持ってきた1枚 ---- */
  function renderResult() {
    var c = state.card;
    if (!c) return renderHome();
    var cat = catOf(c);
    var statePills = c.suitedStates.map(function (id) {
      var s = D.stateById[id];
      return s ? '<span class="tag t-' + s.tone + '">' + esc(s.label) + '</span>' : '';
    }).join('');
    var fav = Store.isFavorite(c.id);
    var fromDex = state.resultContext === 'dex';

    return '' +
      '<div class="page-head">' +
      '<button class="back" data-action="' + (fromDex ? 'tab' : 'go-home') + '"' + (fromDex ? ' data-tab="dex"' : '') + ' aria-label="戻る">‹</button>' +
      '<h2>回復カード</h2>' +
      '</div>' +
      '<p class="result-note">ぽてがカードを持ってきました</p>' +
      '<div class="paper result-card">' +
      '<span class="tape t-' + cat.tone + '"></span>' +
      '<div class="result-top">' +
      '<div class="emoji t-' + cat.tone + '">' + c.emoji + '</div>' +
      '<div><h2>' + esc(c.title) + '</h2>' +
      // 履歴からの控えめな学習: 同じ状態で2回以上実行していたら添える
      (Store.runsForCardInState(c.id, state.stateId) >= 2
        ? '<span class="tag t-' + cat.tone + ' aff-tag">♥ この状態でよく効いています</span>' : '') +
      '</div>' +
      '</div>' +
      '<hr class="result-divider">' +
      '<div class="meta-grid">' +
      '<div class="meta-item"><div class="k">🏷️ カテゴリ</div><div class="v">' + categoryTag(c.category) + '</div></div>' +
      '<div class="meta-item"><div class="k">🕐 時間の目安</div><div class="v"><span class="big">' + c.durationMinutes + '</span> 分</div></div>' +
      '<div class="meta-item"><div class="k">⭐ むずかしさ</div><div class="v">' + stars(c.difficulty) + '<br><small style="font-weight:600;color:var(--cocoa-soft);font-size:0.7rem">' + difficultyLabel(c.difficulty) + '</small></div></div>' +
      '<div class="meta-item"><div class="k">👤 向いている状態</div><div class="state-pills">' + statePills + '</div></div>' +
      '<div class="meta-item wide"><div class="k">♥ 回復タイプ</div><div class="v"><span class="tag t-' + cat.tone + '">' + esc(c.recoveryType) + '</span></div></div>' +
      '</div>' +
      '<hr class="result-divider">' +
      '<div class="result-block"><div class="k">💬 今日のメッセージ</div><p>' + esc(c.mainMessage) + '</p></div>' +
      '<div class="result-block"><div class="k">📝 やること</div><p>' + esc(c.action) + '</p></div>' +
      '<div class="result-pote">' +
      (Store.settings().showPote ? '<div class="pote-avatar small">' + poteSvg('normal') + '</div>' : '') +
      '<div class="pote-bubble">' + esc(c.poteMessage) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="did-it">やってみた</button>' +
      '<button class="btn btn-outline" data-action="not-now"' + (capsulesLeft() ? '' : ' disabled') + '>今はちがう</button>' +
      '<div class="btn-row">' +
      '<button class="btn btn-outline btn-sm' + (fav ? ' isfav' : '') + '" data-action="toggle-fav" aria-pressed="' + fav + '">' + heart(fav) + ' お気に入り' + (fav ? '済み' : '') + '</button>' +
      '<button class="btn btn-outline btn-sm" data-action="respin"' + (capsulesLeft() ? '' : ' disabled') + '>もう一回まわす</button>' +
      '</div>' +
      (capsulesLeft() ? '' : '<p class="select-note">' + esc(pick(D.POTE.capsuleEmpty)) + '</p>') +
      '<div class="share-line"><button class="btn btn-ghost quiet" data-action="copy-share">⤴ シェア文をコピー</button>' +
      (navigator.share ? '<button class="btn btn-ghost quiet" data-action="webshare">共有する</button>' : '') +
      '</div>' +
      '</div>';
  }

  /* ---- 5. 実行完了 ---- */
  function renderDone() {
    var c = state.card;
    var fav = c ? Store.isFavorite(c.id) : false;
    return '' +
      '<div class="done-screen">' +
      '<div class="done-stamp" role="img" aria-label="回復完了">回復完了</div>' +
      poteRow('<strong>' + esc(state.lastPraise) + '</strong><span class="sub">' + esc(c ? '「' + c.title + '」ができました' : '') + '</span>', { mood: 'happy', className: 'done-pote' }) +
      '<div class="paper station-status">' +
      '<h3>🌿 今日の回復ステータス</h3>' +
      '<div class="status-grid" style="grid-template-columns:1fr 1fr">' +
      '<div class="status-cell c1"><span class="ic">🌱</span><span class="k">今日の実行数</span><span class="v">' + Store.todayCount() + '<small>回</small></span></div>' +
      '<div class="status-cell c2"><span class="ic">📅</span><span class="k">連続回復日数</span><span class="v">' + Store.streakDays() + '<small>日</small></span></div>' +
      '</div>' +
      '<p class="status-note">' + esc(streakNote()) + '</p>' +
      '</div>' +
      '<div class="paper done-word">' +
      '<div class="ic">📎</div>' +
      '<div><div class="k">今日のひとこと</div><p>' + esc(state.lastWord) + '</p></div>' +
      '</div>' +
      (state.capsuleRefilled ? '<p class="capsule-back">💊 カプセルが1個もどってきました</p>' : '') +
      '<div class="result-actions">' +
      '<button class="btn btn-primary" data-action="spin-again"' + (capsulesLeft() ? '' : ' disabled') + '>もう1枚引く</button>' +
      '<button class="btn btn-secondary" data-action="go-home">ホームに戻る</button>' +
      (c && !fav ? '<button class="btn btn-ghost" data-action="toggle-fav">♡ お気に入りに追加</button>' : '') +
      '<div class="share-line"><button class="btn btn-ghost quiet" data-action="copy-share">⤴ シェア文をコピー</button></div>' +
      '</div>' +
      '</div>';
  }

  /* ---- 6. 履歴 = 回復の足あと ---- */
  function renderHistory() {
    var history = Store.history();
    var week = Store.last7Days();
    var maxCount = Math.max(1, Math.max.apply(null, week.map(function (d) { return d.count; })));
    var todayKey = Store.dayKey(new Date());

    // 今週の足あと(週1でふり返るまとめカード)
    var w = Store.weeklySummary();
    var topCat = w.topCategory ? D.categoryById[w.topCategory.id] : null;
    var topCard = w.topCard ? findCard(w.topCard.id) : null;
    function md(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
    var summary = '' +
      '<div class="paper week-card">' +
      '<span class="tape t-butter tilt-r"></span>' +
      '<div class="week-card-head"><span class="ttl">🍂 今週の足あと</span><span class="range">' + md(w.from) + ' 〜 ' + md(w.to) + '</span></div>' +
      '<div class="week-card-grid">' +
      '<div class="cell n1"><div class="k">回復</div><div class="v">' + w.count + '<small>回</small></div></div>' +
      '<div class="cell n1"><div class="k">動いた日</div><div class="v">' + w.activeDays + '<small>日</small></div></div>' +
      '<div class="cell n3"><div class="k">連続</div><div class="v">' + Store.streakDays() + '<small>日</small></div></div>' +
      '</div>' +
      (w.count === 0
        ? '<p class="week-card-row empty">今週はこれからです。1枚戻れたら十分です。</p>'
        : '<div class="week-card-row"><span class="k">よく引いたカテゴリ</span>' + (topCat ? categoryTag(topCat.id) : '') + '</div>' +
          (topCard
            ? '<div class="week-card-row"><span class="k">いちばん頼ったカード</span><span class="v-card">' + topCard.emoji + ' ' + esc(topCard.title) + ' <small>(' + w.topCard.count + '回)</small></span></div>'
            : '') +
          '<div class="share-line"><button class="btn btn-ghost quiet" data-action="copy-week">⤴ 今週のまとめをコピー</button></div>'
      ) +
      '</div>';

    var chart = '' +
      '<div class="paper week-chart">' +
      week.map(function (d) {
        var h = d.count === 0 ? 4 : Math.round((d.count / maxCount) * 60);
        return '<div class="week-col' + (d.count === 0 ? ' zero' : '') + (d.key === todayKey ? ' today' : '') + '">' +
          '<div class="bar-track"><div class="bar" style="height:' + h + 'px"></div></div>' +
          '<div class="num">' + d.count + '</div>' +
          '<div class="day">' + d.weekday + '</div>' +
          '</div>';
      }).join('') +
      '</div>';

    if (history.length === 0) {
      return '<div class="page-head"><h2>回復の足あと</h2></div>' +
        '<p class="page-desc">これまでの回復ガチャを、やさしくふり返ります。</p>' +
        summary +
        '<div class="paper empty-state">' +
        (Store.settings().showPote ? '<div class="pote-avatar">' + poteSvg('normal') + '</div>' : '') +
        '<p>' + esc(D.POTE.emptyHistory) + '</p>' +
        '<button class="btn btn-primary btn-sm" data-action="spin-now">1枚引いてみる</button>' +
        '</div>';
    }

    // カテゴリフィルター
    var filters = [{ id: 'all', label: 'すべて' }].concat(D.CATEGORIES);
    var filterHtml = '<div class="filter-row" role="tablist">' +
      filters.map(function (f) {
        return '<button class="filter-chip' + (state.historyFilter === f.id ? ' active' : '') + '" data-action="history-filter" data-filter="' + f.id + '">' + esc(f.label) + '</button>';
      }).join('') + '</div>';

    var entries = history.slice(0, 80).filter(function (e) {
      if (state.historyFilter === 'all') return true;
      var c = findCard(e.cardId);
      return c && c.category === state.historyFilter;
    });

    // 日付ごとにグループ化(履歴は新しい順で保存されている)
    var groups = [];
    var lastKey = null;
    entries.forEach(function (e) {
      var k = Store.dayKey(e.at);
      if (k !== lastKey) { groups.push({ key: k, items: [] }); lastKey = k; }
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

    var listHtml = groups.length === 0
      ? '<div class="paper empty-state"><p>このカテゴリの履歴はまだありません。</p></div>'
      : groups.map(function (g) {
        return '<div class="day-label">' + dayLabel(g.key) + '</div>' +
          g.items.map(function (e) {
            var c = findCard(e.cardId);
            if (!c) return '';
            var st = e.stateId ? D.stateById[e.stateId] : null;
            var time = new Date(e.at);
            var hm = time.getHours() + ':' + (time.getMinutes() < 10 ? '0' : '') + time.getMinutes();
            var fav = Store.isFavorite(c.id);
            var cat = catOf(c);
            return '<div class="paper trail-item">' +
              '<div class="when"><span class="t">' + hm + '</span></div>' +
              '<span class="state-mini tag t-' + (st ? st.tone : 'cream') + '" title="' + (st ? esc(st.label) : '状態未選択') + '">' + (st ? st.emoji : '🎲') + '</span>' +
              '<span class="arr">→</span>' +
              '<div class="body">' +
              '<div class="ttl">' + esc(c.title) + '</div>' +
              categoryTag(c.category, true) +
              '</div>' +
              '<button class="icon-btn' + (fav ? ' active' : '') + '" data-action="fav-card" data-card="' + c.id + '" aria-label="お気に入り">' + heart(fav) + '</button>' +
              '<button class="icon-btn danger" data-action="del-history" data-id="' + e.id + '" aria-label="この履歴を削除">✕</button>' +
              '</div>';
          }).join('');
      }).join('');

    return '<div class="page-head"><h2>回復の足あと</h2></div>' +
      '<p class="page-desc">これまでの回復ガチャを、やさしくふり返ります。</p>' +
      summary +
      chart +
      '<div class="eyebrow">🗂️ 戻れた行動の記録</div>' +
      filterHtml +
      listHtml +
      poteRow(esc(D.POTE.history), { small: true, className: 'done-pote' });
  }

  /* ---- 7. お気に入り ---- */
  function renderFavorites() {
    var favs = Store.favoriteCards();
    if (favs.length === 0) {
      return '<div class="page-head"><h2>お気に入り</h2></div>' +
        '<p class="page-desc">自分に効きやすいカードを、ここにストックできます。</p>' +
        '<div class="paper empty-state">' +
        (Store.settings().showPote ? '<div class="pote-avatar">' + poteSvg('normal') + '</div>' : '') +
        '<p>' + esc(D.POTE.emptyFavorites) + '</p>' +
        '<button class="btn btn-primary btn-sm" data-action="spin-now">1枚引いてみる</button>' +
        '</div>';
    }

    var filters = [{ id: 'all', label: 'すべて' }].concat(
      D.CATEGORIES.filter(function (cat) {
        return favs.some(function (c) { return c.category === cat.id; });
      })
    );
    var filterHtml = filters.length > 2
      ? '<div class="filter-row">' + filters.map(function (f) {
          return '<button class="filter-chip' + (state.favFilter === f.id ? ' active' : '') + '" data-action="fav-filter" data-filter="' + f.id + '">' + esc(f.label) + '</button>';
        }).join('') + '</div>'
      : '';

    var shown = favs.filter(function (c) {
      return state.favFilter === 'all' || c.category === state.favFilter;
    });
    var runs = Store.cardRunCounts();

    return '<div class="page-head"><h2>お気に入り</h2></div>' +
      '<p class="page-desc">自分に効きやすい回復カードのストックです。よくやる順に並びます。</p>' +
      '<button class="btn btn-primary" data-action="spin-favorite">お気に入りから1枚引く</button>' +
      '<div style="height:14px"></div>' +
      filterHtml +
      (shown.length === 0
        ? '<div class="paper empty-state"><p>このカテゴリのお気に入りはまだありません。</p></div>'
        : shown.map(function (c) {
          var cat = catOf(c);
          var n = runs[c.id] || 0;
          return '<div class="paper fav-item">' +
            '<span class="emoji tag t-' + cat.tone + '">' + c.emoji + '</span>' +
            '<div class="body">' +
            '<div class="ttl">' + esc(c.title) + '</div>' +
            '<div class="meta">' + categoryTag(c.category, true) + '<span>🕐 ' + c.durationMinutes + '分</span>' +
            (n > 0 ? '<span class="runs">' + n + '回やってみた</span>' : '') + '</div>' +
            '</div>' +
            '<div class="fav-actions">' +
            '<button class="icon-btn active" data-action="unfav-card" data-card="' + c.id + '" aria-label="お気に入り解除">♥</button>' +
            '<button class="icon-btn" data-action="open-favorite" data-card="' + c.id + '" aria-label="このカードを開く">▶</button>' +
            '</div>' +
            '</div>';
        }).join(''));
  }

  /* ---- 8. 図鑑 = 回復カードのコレクション ---- */
  function renderDex() {
    var catCounts = Store.dexCategoryCounts();
    var filters = [{ id: 'all', label: 'すべて' }].concat(D.CATEGORIES);
    var cards = state.dexFilter === 'all'
      ? D.CARDS
      : D.CARDS.filter(function (c) { return c.category === state.dexFilter; });

    return '' +
      '<div class="paper dex-head">' +
      '<span class="tape t-sage tilt-r"></span>' +
      '<div class="body"><h2>回復<span class="w2">カード</span>図鑑</h2><p>カードを集めて、自分に合う回復の引き出しを増やそう。</p></div>' +
      '<div class="dex-count"><div class="k">発見済み</div><div class="v">' + Store.discoveredCount() + '<small> / ' + D.CARDS.length + '</small></div></div>' +
      '</div>' +
      '<div class="filter-row">' +
      filters.map(function (f) {
        var count = f.id === 'all' ? '' : '<small>' + catCounts[f.id].found + '/' + catCounts[f.id].total + '</small>';
        return '<button class="filter-chip' + (state.dexFilter === f.id ? ' active' : '') + '" data-action="dex-filter" data-filter="' + f.id + '">' +
          esc(f.label) + count + '</button>';
      }).join('') +
      '</div>' +
      '<div class="dex-grid">' +
      cards.map(function (c) {
        var found = Store.isDiscovered(c.id);
        var no = cardNo(c);
        if (!found) {
          return '<div class="dex-card locked">' +
            '<span class="no">' + no + '</span>' +
            '<span class="emoji">' + c.emoji + '</span>' +
            '<span class="ttl">???</span>' +
            '<span class="sub">まだ見ぬカード</span>' +
            '</div>';
        }
        var fav = Store.isFavorite(c.id);
        var cat = catOf(c);
        return '<button class="dex-card" data-action="open-dex-card" data-card="' + c.id + '">' +
          '<span class="tape t-' + cat.tone + (no % 2 === 0 ? ' tilt-r' : '') + '"></span>' +
          '<span class="no">' + no + '</span>' +
          (fav ? '<span class="heart">♥</span>' : '') +
          '<span class="emoji">' + c.emoji + '</span>' +
          '<span class="ttl">' + esc(c.title) + '</span>' +
          categoryTag(c.category) +
          '</button>';
      }).join('') +
      '</div>' +
      (Store.discoveredCount() < D.CARDS.length
        ? poteRow(esc(D.POTE.dex), { small: true, className: 'done-pote' })
        : poteRow('全部集まりました。すごい引き出しです。', { small: true, mood: 'happy', className: 'done-pote' }));
  }

  /* ---- 9. 設定 ---- */
  function renderSettings() {
    var s = Store.settings();
    function toggle(key, on) {
      return '<button class="toggle' + (on ? ' on' : '') + '" data-action="toggle-setting" data-key="' + key + '" role="switch" aria-checked="' + on + '" aria-label="切り替え"></button>';
    }
    return '' +
      '<div class="page-head"><h2>じぶんに合わせる</h2></div>' +
      '<p class="page-desc">通知や表示を、自分に合う形に調整できます。</p>' +

      '<div class="eyebrow">🔔 通知</div>' +
      '<div class="paper setting-group">' +
      '<div class="setting-row"><span class="ic">🔔</span><span class="lbl">毎日のリマインダー<small>「少し戻る時間です」とお知らせします</small></span>' + toggle('notifyEnabled', s.notifyEnabled) + '</div>' +
      '<div class="setting-row"><span class="ic">🕘</span><label class="lbl" for="notifyTime">リマインダー時刻</label><input type="time" class="time-input" id="notifyTime" value="' + esc(s.notifyTime) + '"' + (s.notifyEnabled ? '' : ' disabled') + '></div>' +
      '</div>' +

      '<div class="eyebrow">🎨 表示・サウンド</div>' +
      '<div class="paper setting-group">' +
      '<div class="setting-row"><span class="ic">🐕</span><span class="lbl">ぽてを表示する</span>' + toggle('showPote', s.showPote) + '</div>' +
      '<div class="setting-row"><span class="ic">🍂</span><span class="lbl">季節の小物<small>ぽてが月ごとに小さく衣替えします</small></span>' + toggle('seasonal', s.seasonal) + '</div>' +
      '<div class="setting-row"><span class="ic">🔈</span><span class="lbl">効果音</span>' + toggle('sound', s.sound) + '</div>' +
      '</div>' +

      '<div class="eyebrow">🗃️ データ</div>' +
      '<div class="paper setting-group">' +
      '<button class="setting-row danger" data-action="reset-data"><span class="ic">🧹</span><span class="lbl">データをリセット<small>履歴・お気に入り・図鑑をすべて消します</small></span></button>' +
      '</div>' +

      '<div class="eyebrow">📖 このアプリについて</div>' +
      '<div class="paper">' +
      '<p class="about-text"><strong>' + esc(D.APP.name) + '</strong><br>' +
      '疲れたとき、やる気が出ないときに、今の自分に合った小さな回復行動を1枚だけ提案するアプリです。頑張らせません。少し戻れたら十分です。</p>' +
      '</div>' +
      '<div class="eyebrow">📎 注意事項</div>' +
      '<div class="paper"><p class="about-text">' + esc(D.APP.disclaimer) + '</p></div>';
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
        // カプセル切れなどで引けなかったときは、責めずにホームへ戻す
        state.screen = 'home';
        render();
        showToast(Store.capsuleCount() === 0 ? '今日のカプセルはおしまいです' : 'カードを引けませんでした');
        return;
      }
      state.card = card;
      state.resultContext = 'gacha';
      state.screen = 'result';
      render();
      playPop(760);
    }, 1200);
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
        // 同じ状態に合う別カードを再抽選。候補が少なければ同カテゴリ以外へ広げる
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

      case 'did-it': {
        if (!state.card) return;
        var entry = Store.addHistory(state.card.id, state.stateId);
        state.capsuleRefilled = !!(entry && entry.capsuleRefilled);
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
      }

      case 'toggle-fav': {
        if (!state.card) return;
        var added = Store.toggleFavorite(state.card.id);
        showToast(added ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
        render();
        break;
      }

      case 'copy-week': {
        var ws = Store.weeklySummary();
        var wsCat = ws.topCategory ? D.categoryById[ws.topCategory.id] : null;
        var wsCard = ws.topCard ? findCard(ws.topCard.id) : null;
        var lines = ['今週のごきげん回復:' + ws.count + '回'];
        if (wsCat) lines.push('よく引いたカテゴリ:' + wsCat.label);
        if (wsCard) lines.push('いちばん頼ったカード:' + wsCard.title);
        lines.push('');
        lines.push('少し戻るだけでも、ちゃんと前進です。');
        copyText(lines.join('\n'))
          .then(function () { showToast('今週のまとめをコピーしました'); })
          .catch(function () { showToast('コピーできませんでした'); });
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

      case 'history-filter':
        state.historyFilter = el.dataset.filter;
        render();
        break;

      case 'fav-filter':
        state.favFilter = el.dataset.filter;
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
          state = {
            screen: 'settings', stateId: null, card: null, resultContext: 'gacha',
            dexFilter: 'all', historyFilter: 'all', favFilter: 'all',
            lastPraise: '', lastWord: '', capsuleRefilled: false
          };
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
