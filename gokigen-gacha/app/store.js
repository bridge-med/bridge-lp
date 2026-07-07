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
  // カプセル制: 1日ぶんの抽選回数。乱発でのコンプリートを防ぎ、
  // 「引く」より「やってみる」に価値を置くためのゆるい制限。
  var CAPSULES_PER_DAY = 5;  // 毎朝この数まで補充
  var CAPSULES_MAX = 8;      // 「やってみた」で戻る分の上限
  var D = global.GACHA_DATA;

  var state = defaults();
  var listeners = [];

  function defaults() {
    return {
      history: [],
      favorites: [],
      discovered: [],
      recent: [],
      lastRunAt: null, // 最後に「やってみた」した日時(ISO)
      capsules: { day: '', count: CAPSULES_PER_DAY },
      dailyFree: { day: '', used: false }, // 今日の1枚(1日1回、カプセル消費なしの抽選)
      settings: { notifyEnabled: false, notifyTime: '21:00', showPote: true, sound: true, seasonal: true }
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
        lastRunAt: typeof parsed.lastRunAt === 'string' ? parsed.lastRunAt : null,
        capsules: (parsed.capsules && typeof parsed.capsules.count === 'number' && typeof parsed.capsules.day === 'string')
          ? { day: parsed.capsules.day, count: Math.max(0, Math.min(CAPSULES_MAX, Math.round(parsed.capsules.count))) }
          : d.capsules,
        dailyFree: (parsed.dailyFree && typeof parsed.dailyFree.day === 'string')
          ? { day: parsed.dailyFree.day, used: !!parsed.dailyFree.used }
          : d.dailyFree,
        settings: Object.assign(d.settings, parsed.settings || {})
      };
      // 旧バージョンのデータには lastRunAt がないので履歴から補完する
      if (!state.lastRunAt && state.history.length > 0) state.lastRunAt = state.history[0].at;
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

  /* ---- カプセル(1日ぶんの抽選回数) --------------------------------------- */
  // 日付が変わっていたら今日ぶんに補充する
  function ensureDailyCapsules() {
    var today = dayKey(new Date());
    var changed = false;
    if (state.capsules.day !== today) {
      state.capsules = { day: today, count: CAPSULES_PER_DAY };
      changed = true;
    }
    if (state.dailyFree.day !== today) {
      state.dailyFree = { day: today, used: false };
      changed = true;
    }
    if (changed) save();
  }

  /** 今日の1枚(カプセルなしの抽選)がまだ残っているか */
  function dailyFreeAvailable() {
    ensureDailyCapsules();
    return !state.dailyFree.used;
  }

  /** 今日まだガチャを引けるか(今日の1枚 or カプセル残あり) */
  function canDraw() {
    ensureDailyCapsules();
    return !state.dailyFree.used || state.capsules.count > 0;
  }

  function capsuleCount() {
    ensureDailyCapsules();
    return state.capsules.count;
  }

  // 「やってみた」のごほうびとして1個戻す(上限あり)
  function refillCapsule() {
    ensureDailyCapsules();
    if (state.capsules.count < CAPSULES_MAX) {
      state.capsules.count += 1;
      save();
      return true;
    }
    return false;
  }

  /* ---- ガチャ抽選 ---------------------------------------------------------- */
  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /** その状態で実行したことのあるカードの回数({ cardId: count }) */
  function stateAffinity(stateId) {
    var counts = {};
    state.history.forEach(function (e) {
      if (e.stateId === stateId) counts[e.cardId] = (counts[e.cardId] || 0) + 1;
    });
    return counts;
  }

  /** このカードをこの状態で何回実行したか */
  function runsForCardInState(cardId, stateId) {
    if (!stateId) return 0;
    return stateAffinity(stateId)[cardId] || 0;
  }

  /**
   * 重み付きランダム抽選。
   * 状態選択時、その状態で実行実績のあるカードを少しだけ出やすくする
   * (基礎1 + 実行回数、最大3)。学習は控えめにして偏りすぎを防ぐ。
   */
  function pickWeighted(list, stateId) {
    if (!stateId) return pickRandom(list);
    var affinity = stateAffinity(stateId);
    var weights = list.map(function (c) {
      return Math.min(3, 1 + (affinity[c.id] || 0));
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }

  /**
   * カードを1枚抽選する。カプセルが尽きていたら null を返す。
   * @param {Object} opts { stateId?, excludeCardId?, excludeCategory?, free? }
   *   stateId         … 選択された状態(合うカードを優先)
   *   excludeCardId   … 「今はちがう」時に直前のカード自体を除外
   *   excludeCategory … 候補が少ないときのフォールバックでカテゴリごと除外
   *   free            … カプセルを消費しない(お気に入りからの抽選など)
   */
  function draw(opts) {
    opts = opts || {};
    ensureDailyCapsules();
    // 今日最初の1回は「今日の1枚」としてカプセルを使わない
    var useFree = !opts.free && !state.dailyFree.used;
    if (!opts.free && !useFree && state.capsules.count <= 0) return null; // 今日のカプセル切れ
    var pool = D.CARDS.slice();

    if (opts.stateId) {
      var suited = pool.filter(function (c) { return c.suitedStates.indexOf(opts.stateId) >= 0; });
      if (suited.length > 0) pool = suited; // 合うカードがなければ全カードから
    }
    if (opts.excludeCardId) {
      var without = pool.filter(function (c) { return c.id !== opts.excludeCardId; });
      if (without.length > 0) pool = without;
      // 同じ状態に合う候補がほぼ残らない場合は、同カテゴリ以外の全カードへ広げる
      if (pool.length < 2 && opts.excludeCategory) {
        var widened = D.CARDS.filter(function (c) {
          return c.category !== opts.excludeCategory && c.id !== opts.excludeCardId;
        });
        if (widened.length > 0) pool = widened;
      }
    } else if (opts.excludeCategory) {
      var other = pool.filter(function (c) { return c.category !== opts.excludeCategory; });
      if (other.length > 0) pool = other;
    }
    // 直近3回に出たカードは避ける(避けると空になる場合はそのまま)
    var fresh = pool.filter(function (c) { return state.recent.indexOf(c.id) < 0; });
    if (fresh.length > 0) pool = fresh;

    // 状態選択時は「その状態で効いた実績のあるカード」を少しだけ優先する
    var card = pickWeighted(pool, opts.stateId);

    if (useFree) state.dailyFree.used = true;      // 今日の1枚を使う
    else if (!opts.free) state.capsules.count -= 1; // カプセルを1個使う
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
    state.lastRunAt = entry.at;
    // やってみたごほうび: カプセルを1個戻す(上限あり)
    ensureDailyCapsules();
    var refilled = state.capsules.count < CAPSULES_MAX;
    if (refilled) state.capsules.count += 1;
    save();
    emit();
    entry.capsuleRefilled = refilled;
    return entry;
  }

  /** 最後に実行してから何日経ったか(未実行なら null) */
  function daysSinceLastRun() {
    if (!state.lastRunAt) return null;
    var last = new Date(state.lastRunAt);
    var lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - lastDay) / (24 * 60 * 60 * 1000));
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

  /** カード別の累計実行回数 */
  function cardRunCounts() {
    var counts = {};
    state.history.forEach(function (e) {
      counts[e.cardId] = (counts[e.cardId] || 0) + 1;
    });
    return counts;
  }

  /** 今週(直近7日間)のまとめ。「今週の足あと」カードに使う */
  function weeklySummary() {
    var to = new Date();
    var from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);

    var catCounts = {};
    var cardCounts = {};
    var days = {};
    var count = 0;
    state.history.forEach(function (e) {
      if (new Date(e.at) < from) return;
      var card = D.CARDS.find(function (c) { return c.id === e.cardId; });
      if (!card) return;
      count += 1;
      days[dayKey(e.at)] = true;
      catCounts[card.category] = (catCounts[card.category] || 0) + 1;
      cardCounts[card.id] = (cardCounts[card.id] || 0) + 1;
    });

    function topOf(counts) {
      var top = null;
      Object.keys(counts).forEach(function (k) {
        if (!top || counts[k] > top.count) top = { id: k, count: counts[k] };
      });
      return top;
    }
    return {
      from: from,
      to: to,
      count: count,
      activeDays: Object.keys(days).length,
      topCategory: topOf(catCounts),
      topCard: topOf(cardCounts)
    };
  }

  /** 直近7日間でいちばんよく引いたカテゴリ({ categoryId, count } | null) */
  function topCategory7d() {
    var limit = new Date();
    limit.setDate(limit.getDate() - 6);
    limit.setHours(0, 0, 0, 0);
    var counts = {};
    state.history.forEach(function (e) {
      if (new Date(e.at) < limit) return;
      var card = D.CARDS.find(function (c) { return c.id === e.cardId; });
      if (card) counts[card.category] = (counts[card.category] || 0) + 1;
    });
    var top = null;
    Object.keys(counts).forEach(function (catId) {
      if (!top || counts[catId] > top.count) top = { categoryId: catId, count: counts[catId] };
    });
    return top;
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

  /** お気に入りカード一覧(よく実行しているものが先頭) */
  function favoriteCards() {
    var runs = cardRunCounts();
    return state.favorites
      .map(function (id) { return D.CARDS.find(function (c) { return c.id === id; }); })
      .filter(Boolean)
      .sort(function (a, b) { return (runs[b.id] || 0) - (runs[a.id] || 0); });
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

  /** カテゴリごとの発見数({ catId: { found, total } }) */
  function dexCategoryCounts() {
    var out = {};
    D.CATEGORIES.forEach(function (cat) { out[cat.id] = { found: 0, total: 0 }; });
    D.CARDS.forEach(function (c) {
      if (!out[c.category]) return;
      out[c.category].total += 1;
      if (isDiscovered(c.id)) out[c.category].found += 1;
    });
    return out;
  }

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
    daysSinceLastRun: daysSinceLastRun,
    last7Days: last7Days,
    categoryCounts: categoryCounts,
    cardRunCounts: cardRunCounts,
    topCategory7d: topCategory7d,
    weeklySummary: weeklySummary,
    runsForCardInState: runsForCardInState,
    capsuleCount: capsuleCount,
    dailyFreeAvailable: dailyFreeAvailable,
    canDraw: canDraw,
    CAPSULES_PER_DAY: CAPSULES_PER_DAY,
    CAPSULES_MAX: CAPSULES_MAX,
    dexCategoryCounts: dexCategoryCounts,
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
