/* =========================================================================
 * RoundNote — store.js
 * データモデル・ローカル永続化・集計ロジック・状態購読(pub/sub)。
 * UI(app.js)はこの層だけを通じてデータを読み書きする。
 *
 * 型(参考・JSDocで表現):
 *   FacilityKind : "クリニック" | "リハ部門" | "デイサービス" | "訪問看護" | "介護施設" | "その他"
 *   ItemType     : "task"(宿題) | "decision"(決定事項) | "note"(気づき)
 *   TaskOwner    : "site"(施設側) | "hq"(本部側)
 *   Facility     : { id, name, leader, kind, createdAt }
 *   Item         : { id, facilityId, type, text, owner?, due?, done, doneAt?, createdAt }
 *
 * 注: due は日付のみの文字列("YYYY-MM-DD")。期限判定はローカル日付で行う。
 *     owner / due / done は type === "task" のときのみ意味を持つ。
 * ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'round-note:v1';

  /** 施設種別(追加フォームで共有) */
  var KINDS = ['クリニック', 'リハ部門', 'デイサービス', '訪問看護', '介護施設', 'その他'];

  /** アイテム種別の表示定義 */
  var TYPES = {
    task: { label: '宿題', icon: '📌' },
    decision: { label: '決定事項', icon: '🤝' },
    note: { label: '気づき', icon: '👀' }
  };

  /** 宿題の担当 */
  var OWNERS = {
    site: { label: '施設側' },
    hq: { label: '本部側' }
  };

  // ---- 内部状態 ------------------------------------------------------------
  var state = { facilities: [], items: [] };
  var listeners = [];

  // ---- ユーティリティ ------------------------------------------------------
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** ローカル日付を "YYYY-MM-DD" で返す */
  function dateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function todayStr() { return dateStr(new Date()); }

  /** 今日から n 日後の "YYYY-MM-DD" */
  function daysFromToday(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }

  /** "YYYY-MM-DD" → 表示用 "M/D(曜)" */
  function dueLabel(due) {
    if (!due) return '期限なし';
    var parts = due.split('-');
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var youbi = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return (+parts[1]) + '/' + (+parts[2]) + '(' + youbi + ')';
  }

  /** 期限超過か(日付のみ比較) */
  function isOverdue(item) {
    return item.type === 'task' && !item.done && !!item.due && item.due < todayStr();
  }

  /** 7日以内に期限が来るか(今日を含む) */
  function isDueSoon(item) {
    if (item.type !== 'task' || item.done || !item.due) return false;
    return item.due >= todayStr() && item.due <= daysFromToday(7);
  }

  // ---- 永続化 --------------------------------------------------------------
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.facilities) && Array.isArray(parsed.items)) {
          state.facilities = parsed.facilities;
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
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        facilities: state.facilities,
        items: state.items,
        v: 1
      }));
    } catch (e) {
      /* ストレージ不可(プライベートモード等)でも UI は動かす */
    }
  }

  function emit() {
    save();
    for (var i = 0; i < listeners.length; i++) listeners[i](state);
  }

  // ---- 施設 ----------------------------------------------------------------
  function addFacility(data) {
    var f = {
      id: uid('f'),
      name: (data.name || '').trim(),
      leader: (data.leader || '').trim(),
      kind: KINDS.indexOf(data.kind) >= 0 ? data.kind : 'その他',
      createdAt: new Date().toISOString()
    };
    if (!f.name) return null;
    state.facilities.push(f);
    emit();
    return f;
  }

  function updateFacility(id, data) {
    var f = facility(id);
    if (!f) return;
    if (data.name != null && data.name.trim()) f.name = data.name.trim();
    if (data.leader != null) f.leader = data.leader.trim();
    if (data.kind != null && KINDS.indexOf(data.kind) >= 0) f.kind = data.kind;
    emit();
  }

  /** 施設削除(紐づくアイテムも削除) */
  function removeFacility(id) {
    state.facilities = state.facilities.filter(function (f) { return f.id !== id; });
    state.items = state.items.filter(function (it) { return it.facilityId !== id; });
    emit();
  }

  function facility(id) {
    for (var i = 0; i < state.facilities.length; i++) {
      if (state.facilities[i].id === id) return state.facilities[i];
    }
    return null;
  }

  function facilities() { return state.facilities.slice(); }

  // ---- アイテム ------------------------------------------------------------
  function addItem(data) {
    var type = TYPES[data.type] ? data.type : 'note';
    var it = {
      id: uid('i'),
      facilityId: data.facilityId,
      type: type,
      text: (data.text || '').trim(),
      createdAt: new Date().toISOString()
    };
    if (!it.text || !facility(it.facilityId)) return null;
    if (type === 'task') {
      it.owner = data.owner === 'hq' ? 'hq' : 'site';
      it.due = data.due || null;
      it.done = false;
    }
    state.items.push(it);
    emit();
    return it;
  }

  function toggleTask(id) {
    var it = item(id);
    if (!it || it.type !== 'task') return;
    it.done = !it.done;
    it.doneAt = it.done ? new Date().toISOString() : null;
    emit();
  }

  function removeItem(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
    emit();
  }

  function item(id) {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === id) return state.items[i];
    }
    return null;
  }

  // ---- 集計・クエリ ----------------------------------------------------------
  /** 施設のアイテム(新しい順) */
  function itemsFor(facilityId, type) {
    return state.items.filter(function (it) {
      return it.facilityId === facilityId && (!type || it.type === type);
    }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }

  /** 施設の未完了宿題(期限が近い順、期限なしは最後) */
  function openTasks(facilityId) {
    return state.items.filter(function (it) {
      return it.type === 'task' && !it.done && (!facilityId || it.facilityId === facilityId);
    }).sort(function (a, b) {
      if (!a.due && !b.due) return a.createdAt < b.createdAt ? -1 : 1;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due < b.due ? -1 : 1;
    });
  }

  /** 全施設横断の「要フォロー」= 期限超過 + 7日以内 */
  function followUps() {
    return openTasks(null).filter(function (it) { return isOverdue(it) || isDueSoon(it); });
  }

  /** 施設の最終記録日時(ISO)。なければ null */
  function lastActivity(facilityId) {
    var latest = null;
    state.items.forEach(function (it) {
      if (it.facilityId !== facilityId) return;
      var t = it.doneAt && it.doneAt > it.createdAt ? it.doneAt : it.createdAt;
      if (!latest || t > latest) latest = t;
    });
    return latest;
  }

  function counts() {
    var open = openTasks(null);
    return {
      facilities: state.facilities.length,
      openTasks: open.length,
      overdue: open.filter(isOverdue).length
    };
  }

  function hasData() { return state.facilities.length > 0 || state.items.length > 0; }

  // ---- サンプルデータ --------------------------------------------------------
  function seedSamples() {
    var f1 = addFacilityRaw('青葉台整形外科クリニック', '田中', 'クリニック');
    var f2 = addFacilityRaw('みどりの丘デイサービス', '佐藤', 'デイサービス');
    var f3 = addFacilityRaw('こかげ訪問看護ステーション', '山本', '訪問看護');

    addItemRaw(f1, 'task', 'リハ室の予約枠見直し案を作る', 'site', daysFromToday(-3));
    addItemRaw(f1, 'task', '新人PTの面談日程を調整する', 'hq', daysFromToday(2));
    addItemRaw(f1, 'decision', '朝礼では単位数ではなく実施率を共有する');
    addItemRaw(f1, 'note', '受付の掲示物が古いまま。次回、更新ルールを相談');

    addItemRaw(f2, 'task', '送迎ルート再編の試算を出す', 'hq', daysFromToday(6));
    addItemRaw(f2, 'task', '稼働率レポートのフォーマットを統一する', 'site', daysFromToday(10));
    addItemRaw(f2, 'decision', '月次レビューは第2火曜 16時に固定する');
    addItemRaw(f2, 'note', '佐藤さん、採用の相談をしたそうだった。次回30分とる');

    addItemRaw(f3, 'task', 'オンコール手当の規程を確認して回答する', 'hq', daysFromToday(3));
    addItemRaw(f3, 'decision', '新規依頼の受け入れ基準を明文化する');
    addItemRaw(f3, 'note', '記録ソフトの入力に時間がかかっている、と現場から');

    emit();

    function addFacilityRaw(name, leader, kind) {
      var f = { id: uid('f'), name: name, leader: leader, kind: kind, createdAt: new Date().toISOString() };
      state.facilities.push(f);
      return f.id;
    }
    function addItemRaw(facilityId, type, text, owner, due) {
      var it = { id: uid('i'), facilityId: facilityId, type: type, text: text, createdAt: new Date().toISOString() };
      if (type === 'task') { it.owner = owner; it.due = due || null; it.done = false; }
      state.items.push(it);
    }
  }

  function clearAll() {
    state.facilities = [];
    state.items = [];
    emit();
  }

  // ---- 初期化・公開 API -------------------------------------------------------
  load();

  global.Store = {
    KINDS: KINDS,
    TYPES: TYPES,
    OWNERS: OWNERS,
    subscribe: function (fn) { listeners.push(fn); },
    todayStr: todayStr,
    daysFromToday: daysFromToday,
    dueLabel: dueLabel,
    isOverdue: isOverdue,
    isDueSoon: isDueSoon,
    addFacility: addFacility,
    updateFacility: updateFacility,
    removeFacility: removeFacility,
    facility: facility,
    facilities: facilities,
    addItem: addItem,
    toggleTask: toggleTask,
    removeItem: removeItem,
    item: item,
    itemsFor: itemsFor,
    openTasks: openTasks,
    followUps: followUps,
    lastActivity: lastActivity,
    counts: counts,
    hasData: hasData,
    seedSamples: seedSamples,
    clearAll: clearAll
  };
})(window);
