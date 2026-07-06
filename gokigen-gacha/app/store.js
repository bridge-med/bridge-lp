/* =========================================================================
 * ごきげん回復ガチャ — store.js
 * ローカル永続化・集計・ガチャ抽選ロジック。UI(app.js)はこの層を通して
 * データを読み書きする。
 *
 * 保存データ(localStorage 'gokigenGacha:v1'):
 *   history    : [{ id, cardId, stateId|null, at(ISO文字列) }]  新しい順
 *   favorites  : [cardId]
 *   discovered : [cardId]                     … 図鑑の発見済み
 *   recent     : [cardId]                     … 直近に出たカード(最大3件)
 *   settings   : { notifyEnabled, notifyTime, showPote, sound }
 * ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'gokigenGacha:v1';
  var RECENT_MAX = 3;
  var D = global.GACHA_DATA;

  var state = defaults();
  var listeners = [];

  function defaults() {
    return {
      history: [],
      favorites: [],
      discovered: [],
      recent: [],
      settings: { notifyEnabled: false, notifyTime: '21:00', showPote: true, sound: true }
    };
  }

  /* ---- 永続化 ------------------------------------------------------------ */
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      var d = defaults();
      state = {
        history: Array.isArray(parsed.history) ? parsed.history.filter(validEntry) : d.history,
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(validCardId) : d.favorites,
        discovered: Array.isArray(parsed.discovered) ? parsed.discovered.filter(validCardId) : d.discovered,
        recent: Array.isArray(parsed.recent) ? parsed.recent.filter(validCardId).slice(0, RECENT_MAX) : d.recent,
        settings: Object.assign(d.settings, parsed.settings || {})
      };
    } catch (e) {
      state = defaults(); // 壊れたデータは初期化にフォールバック
    }
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* プライベートモード等で保存できなくてもUIは動かす */
    }
  }

  function validCardId(id) { return !!D.CARDS.find(function (c) { return c.id === id; }); }
  function validEntry(e) {
    return e && typeof e === 'object' && validCardId(e.cardId) && typeof e.at === 'string';
  }

  function uid() {
    return 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---- 日付ユーティリティ -------------------------------------------------- */
  function dayKey(date) {
    var d = date instanceof Date ? date : new Date(date);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* ---- ガチャ抽選 ---------------------------------------------------------- */
  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * カードを1枚抽選する。
   * @param {Object} opts { stateId?: string, excludeCategory?: string }
   *   stateId         … 選択された状態(合うカードを優先)
   *   excludeCategory … 「今は違う」時に直前カードのカテゴリを除外
   */
  function draw(opts) {
    opts = opts || {};
    var pool = D.CARDS.slice();

    if (opts.stateId) {
      var suited = pool.filter(function (c) { return c.suitedStates.indexOf(opts.stateId) >= 0; });
      if (suited.length > 0) pool = suited; // 合うカードがなければ全カードから
    }
    if (opts.excludeCategory) {
      var other = pool.filter(function (c) { return c.category !== opts.excludeCategory; });
      if (other.length > 0) pool = other;
    }
    // 直近3回に出たカードは避ける(避けると空になる場合はそのまま)
    var fresh = pool.filter(function (c) { return state.recent.indexOf(c.id) < 0; });
    if (fresh.length > 0) pool = fresh;

    var card = pickRandom(pool);

    // 出現したカードは図鑑で発見済みにし、直近リストへ積む
    if (state.discovered.indexOf(card.id) < 0) state.discovered.push(card.id);
    state.recent = [card.id].concat(state.recent.filter(function (id) { return id !== card.id; })).slice(0, RECENT_MAX);
    save();
    emit();
    return card;
  }

  /* ---- 履歴 ---------------------------------------------------------------- */
  function addHistory(cardId, stateId) {
    if (!validCardId(cardId)) return null;
    var entry = { id: uid(), cardId: cardId, stateId: stateId || null, at: new Date().toISOString() };
    state.history.unshift(entry);
    save();
    emit();
    return entry;
  }

  function removeHistory(entryId) {
    state.history = state.history.filter(function (e) { return e.id !== entryId; });
    save();
    emit();
  }

  function todayCount() {
    var today = dayKey(new Date());
    return state.history.filter(function (e) { return dayKey(e.at) === today; }).length;
  }

  /** 今日(または昨日)から遡った連続回復日数 */
  function streakDays() {
    var days = {};
    state.history.forEach(function (e) { days[dayKey(e.at)] = true; });
    var cursor = new Date();
    if (!days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1); // 今日まだなら昨日から数える
    var streak = 0;
    while (days[dayKey(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  /** 過去7日間の日別実行数(古い日→今日の順) */
  function last7Days() {
    var counts = {};
    state.history.forEach(function (e) {
      var k = dayKey(e.at);
      counts[k] = (counts[k] || 0) + 1;
    });
    var out = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var k = dayKey(d);
      out.push({ key: k, label: (d.getMonth() + 1) + '/' + d.getDate(), weekday: '日月火水木金土'[d.getDay()], count: counts[k] || 0 });
    }
    return out;
  }

  /** カテゴリ別の累計実行回数 */
  function categoryCounts() {
    var counts = {};
    state.history.forEach(function (e) {
      var card = D.CARDS.find(function (c) { return c.id === e.cardId; });
      if (card) counts[card.category] = (counts[card.category] || 0) + 1;
    });
    return counts;
  }

  /* ---- お気に入り ----------------------------------------------------------- */
  function isFavorite(cardId) { return state.favorites.indexOf(cardId) >= 0; }

  function toggleFavorite(cardId) {
    if (!validCardId(cardId)) return false;
    var i = state.favorites.indexOf(cardId);
    if (i >= 0) state.favorites.splice(i, 1);
    else state.favorites.unshift(cardId);
    save();
    emit();
    return i < 0; // 追加したら true
  }

  function favoriteCards() {
    return state.favorites
      .map(function (id) { return D.CARDS.find(function (c) { return c.id === id; }); })
      .filter(Boolean);
  }

  function drawFromFavorites() {
    var favs = favoriteCards();
    if (favs.length === 0) return null;
    var notRecent = favs.filter(function (c) { return state.recent.indexOf(c.id) < 0; });
    var card = pickRandom(notRecent.length > 0 ? notRecent : favs);
    if (state.discovered.indexOf(card.id) < 0) state.discovered.push(card.id);
    state.recent = [card.id].concat(state.recent.filter(function (id) { return id !== card.id; })).slice(0, RECENT_MAX);
    save();
    emit();
    return card;
  }

  /* ---- 図鑑 ---------------------------------------------------------------- */
  function isDiscovered(cardId) { return state.discovered.indexOf(cardId) >= 0; }
  function discoveredCount() { return state.discovered.length; }

  /* ---- 設定 ---------------------------------------------------------------- */
  function updateSettings(patch) {
    state.settings = Object.assign({}, state.settings, patch || {});
    save();
    emit();
  }

  function resetAll() {
    state = defaults();
    save();
    emit();
  }

  /* ---- 購読 ---------------------------------------------------------------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }
  function emit() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  /* ---- 公開API -------------------------------------------------------------- */
  global.GachaStore = {
    init: load,
    draw: draw,
    drawFromFavorites: drawFromFavorites,
    addHistory: addHistory,
    removeHistory: removeHistory,
    history: function () { return state.history.slice(); },
    todayCount: todayCount,
    streakDays: streakDays,
    last7Days: last7Days,
    categoryCounts: categoryCounts,
    isFavorite: isFavorite,
    toggleFavorite: toggleFavorite,
    favoriteCards: favoriteCards,
    isDiscovered: isDiscovered,
    discoveredCount: discoveredCount,
    settings: function () { return Object.assign({}, state.settings); },
    updateSettings: updateSettings,
    resetAll: resetAll,
    subscribe: subscribe,
    dayKey: dayKey
  };
})(window);
