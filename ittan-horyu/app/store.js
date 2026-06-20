/* =========================================================================
 * いったん保留 — store.js
 * データモデル・ローカル永続化・集計ロジック・状態購読(pub/sub)。
 * UI(app.js)はこの層だけを通じてデータを読み書きする。
 *
 * 型(参考・JSDocで表現):
 *   ItemStatus    : "holding" | "ready" | "purchased" | "skipped"
 *   DesireReason  : "必要" | "欲しい" | "勢い"
 *   CoolingPeriod : "24h" | "3d" | "7d"
 *   ItemCategory  : "ガジェット" | "服" | "サブスク" | "本" | "家電" | "その他"
 *   HoldItem      : { id, name, price, category, reason, coolingPeriod,
 *                     createdAt, reviewAt, status, memo?, decidedAt? }
 *
 * 注: "ready" は永続化された状態ではなく、holding かつ reviewAt を過ぎた
 *     アイテムを表示上「判断待ち」として扱う動的な状態。保存値は holding のまま。
 *     decidedAt は買う/見送るを判断した時刻(今月集計の基準)。
 * ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'ittan-horyu:v1';

  /** カテゴリー一覧（追加画面・集計で共有） */
  var CATEGORIES = ['ガジェット', '服', 'サブスク', '本', '家電', 'その他'];
  /** 欲しい理由 */
  var REASONS = ['必要', '欲しい', '勢い'];
  /** クールダウン期間定義 */
  var PERIODS = [
    { key: '24h', label: '24時間', ms: 24 * 60 * 60 * 1000 },
    { key: '3d', label: '3日', ms: 3 * 24 * 60 * 60 * 1000 },
    { key: '7d', label: '7日', ms: 7 * 24 * 60 * 60 * 1000 }
  ];
  /** カテゴリー別の簡易アイコン（絵文字プレースホルダー） */
  var CATEGORY_ICONS = {
    'ガジェット': '🎧',
    '服': '👕',
    'サブスク': '📺',
    '本': '📚',
    '家電': '🔌',
    'その他': '🎁'
  };

  // ---- 内部状態 ------------------------------------------------------------
  var state = { items: [] };
  var listeners = [];

  // ---- ユーティリティ ------------------------------------------------------
  function uid() {
    return 'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function periodMs(key) {
    for (var i = 0; i < PERIODS.length; i++) if (PERIODS[i].key === key) return PERIODS[i].ms;
    return PERIODS[1].ms;
  }

  function periodLabel(key) {
    for (var i = 0; i < PERIODS.length; i++) if (PERIODS[i].key === key) return PERIODS[i].label;
    return key;
  }

  // ---- 永続化 --------------------------------------------------------------
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          state.items = parsed.items;
          return true;
        }
      }
    } catch (e) {
      /* 壊れていたら初期化にフォールバック */
    }
    return false;
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items, v: 1 }));
    } catch (e) {
      /* ストレージ不可(プライベートモード等)でも UI は動かす */
    }
  }

  // ---- サンプルデータ（初回のみ） ------------------------------------------
  function seed() {
    var now = Date.now();
    var DAY = 24 * 60 * 60 * 1000;
    var HOUR = 60 * 60 * 1000;
    var items = [
      // 保留中（残り時間あり）
      mk('ワイヤレスイヤホン', 19800, 'ガジェット', '欲しい', '3d', now - 1 * DAY, 'holding'),
      mk('バックパック', 12800, 'その他', '欲しい', '7d', now - 2 * DAY, 'holding'),
      // 判断待ち（クールダウン終了済み・holding のまま）
      mk('コーヒーメーカー', 8900, '家電', '必要', '3d', now - 4 * DAY, 'holding'),
      // 見送り済み（今月）
      mkDecided('ビジネス書', 1650, '本', '勢い', '24h', now - 6 * DAY, 'skipped', now - 5 * DAY),
      mkDecided('サブスク追加', 980, 'サブスク', '勢い', '3d', now - 9 * DAY, 'skipped', now - 5 * DAY),
      // 参考: 買った実績（今月）
      mkDecided('キーボード', 6500, 'ガジェット', '必要', '3d', now - 12 * DAY, 'purchased', now - 8 * DAY)
    ];

    function mk(name, price, category, reason, period, createdAt, status) {
      return {
        id: uid(),
        name: name,
        price: price,
        category: category,
        reason: reason,
        coolingPeriod: period,
        createdAt: new Date(createdAt).toISOString(),
        reviewAt: new Date(createdAt + periodMs(period)).toISOString(),
        status: status
      };
    }
    function mkDecided(name, price, category, reason, period, createdAt, status, decidedAt) {
      var it = mk(name, price, category, reason, period, createdAt, status);
      it.decidedAt = new Date(decidedAt).toISOString();
      return it;
    }

    state.items = items;
    save();
  }

  // ---- 派生状態 ------------------------------------------------------------
  // 保存値は holding でも、reviewAt を過ぎていれば表示上は "ready"(判断待ち)。
  function effectiveStatus(item, nowMs) {
    if (item.status === 'holding' && new Date(item.reviewAt).getTime() <= nowMs) {
      return 'ready';
    }
    return item.status;
  }

  /** 表示用に派生情報を付与したアイテムを返す */
  function decorate(item, nowMs) {
    var reviewMs = new Date(item.reviewAt).getTime();
    var remaining = reviewMs - nowMs;
    return {
      raw: item,
      id: item.id,
      name: item.name,
      price: item.price,
      category: item.category,
      reason: item.reason,
      coolingPeriod: item.coolingPeriod,
      periodLabel: periodLabel(item.coolingPeriod),
      createdAt: item.createdAt,
      reviewAt: item.reviewAt,
      memo: item.memo || '',
      status: effectiveStatus(item, nowMs),
      storedStatus: item.status,
      remainingMs: remaining,
      isReady: effectiveStatus(item, nowMs) === 'ready'
    };
  }

  function allDecorated(nowMs) {
    nowMs = nowMs || Date.now();
    return state.items.map(function (it) { return decorate(it, nowMs); });
  }

  function find(id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  // ---- 集計 ----------------------------------------------------------------
  function sameMonth(iso, ref) {
    if (!iso) return false;
    var d = new Date(iso);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }

  /**
   * 月次サマリーを計算する。
   * @param {Date} [refDate] 集計対象の月（既定: 今月）
   */
  function monthlySummary(refDate) {
    var now = Date.now();
    var ref = refDate || new Date();
    var prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);

    var savedThis = 0, savedPrev = 0, skippedCount = 0, purchasedCount = 0;
    var byCategory = {}; // category -> 見送り金額
    CATEGORIES.forEach(function (c) { byCategory[c] = 0; });

    state.items.forEach(function (it) {
      if (it.status === 'skipped') {
        if (sameMonth(it.decidedAt, ref)) {
          savedThis += it.price;
          skippedCount += 1;
          byCategory[it.category] = (byCategory[it.category] || 0) + it.price;
        }
        if (sameMonth(it.decidedAt, prev)) savedPrev += it.price;
      } else if (it.status === 'purchased') {
        if (sameMonth(it.decidedAt, ref)) purchasedCount += 1;
      }
    });

    var holdingCount = state.items.filter(function (it) {
      return effectiveStatus(it, now) === 'holding';
    }).length;
    var readyCount = state.items.filter(function (it) {
      return effectiveStatus(it, now) === 'ready';
    }).length;

    return {
      ref: ref,
      savedThisMonth: savedThis,
      savedPrevMonth: savedPrev,
      diff: savedThis - savedPrev,
      skippedCount: skippedCount,
      purchasedCount: purchasedCount,
      holdingCount: holdingCount,
      readyCount: readyCount,
      byCategory: byCategory
    };
  }

  /** 累計の「守れた金額」（全期間の見送り合計） */
  function totalSaved() {
    return state.items.reduce(function (sum, it) {
      return it.status === 'skipped' ? sum + it.price : sum;
    }, 0);
  }

  // ---- 変更系 --------------------------------------------------------------
  function addItem(input) {
    var now = Date.now();
    var item = {
      id: uid(),
      name: String(input.name || '').trim(),
      price: Math.max(0, Math.round(Number(input.price) || 0)),
      category: CATEGORIES.indexOf(input.category) >= 0 ? input.category : 'その他',
      reason: REASONS.indexOf(input.reason) >= 0 ? input.reason : '欲しい',
      coolingPeriod: input.coolingPeriod || '3d',
      createdAt: new Date(now).toISOString(),
      reviewAt: new Date(now + periodMs(input.coolingPeriod || '3d')).toISOString(),
      status: 'holding'
    };
    if (input.memo) item.memo = String(input.memo).trim();
    state.items.unshift(item);
    save();
    emit();
    return item.id;
  }

  function decide(id, decision) {
    var it = find(id);
    if (!it) return;
    it.status = decision === 'buy' ? 'purchased' : 'skipped';
    it.decidedAt = new Date().toISOString();
    save();
    emit();
  }

  function removeItem(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
    save();
    emit();
  }

  function resetAll() {
    seed();
    emit();
  }

  // ---- 購読 ----------------------------------------------------------------
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }
  function emit() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  // ---- 初期化 --------------------------------------------------------------
  function init() {
    if (!load()) seed();
  }

  // ---- 公開API -------------------------------------------------------------
  global.Store = {
    CATEGORIES: CATEGORIES,
    REASONS: REASONS,
    PERIODS: PERIODS,
    CATEGORY_ICONS: CATEGORY_ICONS,
    init: init,
    all: allDecorated,
    find: function (id) { var it = find(id); return it ? decorate(it, Date.now()) : null; },
    addItem: addItem,
    decide: decide,
    removeItem: removeItem,
    resetAll: resetAll,
    monthlySummary: monthlySummary,
    totalSaved: totalSaved,
    periodLabel: periodLabel,
    subscribe: subscribe
  };
})(window);
