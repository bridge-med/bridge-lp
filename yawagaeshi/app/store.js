/* =========================================================================
 * やわ返 — store.js
 * データモデル・ローカル永続化・履歴/お気に入り・状態購読(pub/sub)。
 * UI(app.js)はこの層だけを通じてデータを読み書きする。
 * 返信文の「生成」は store ではなく replyService.js が担当（責務分離）。
 *
 * 型(参考・JSDocで表現):
 *   Relationship   : "取引先"|"上司"|"同僚"|"部下"|"友人"|"家族"|"その他"
 *   ReplyChannel   : "メール"|"Slack"|"LINE"|"DM"|"その他"
 *   ReplyTone      : "やわらかく"|"丁寧に"|"短く"|"きっぱり"|"催促"|"断る"|"謝る"|"感情を抜く"
 *   ReplyLength    : "短め"|"普通"|"丁寧に長め"
 *   ReplySuggestion: { id, label:"やわらかめ"|"ちょうどいい"|"短め", text, note?, isFavorite? }
 *   ReplyRiskCheck : { coldness, pressure, length, comment }   // 各 1〜3
 *   ReplyHistoryItem:{ id, createdAt, originalMessage?, userIntent, relationship?,
 *                      channel, tones[], length, suggestions[], selectedText?, riskCheck? }
 * ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'yawagaeshi:v1';

  /** 相手との関係 */
  var RELATIONSHIPS = ['取引先', '上司', '同僚', '部下', '友人', '家族', 'その他'];
  /** 利用チャネル */
  var CHANNELS = ['メール', 'Slack', 'LINE', 'DM', 'その他'];
  /** トーン（複数選択） */
  var TONES = ['やわらかく', '丁寧に', '短く', 'きっぱり', '催促', '断る', '謝る', '感情を抜く'];
  /** 文章の長さ（単一選択） */
  var LENGTHS = ['短め', '普通', '丁寧に長め'];

  /** 関係・チャネルの簡易アイコン（一覧やプレビューで利用） */
  var REL_ICONS = {
    '取引先': '🤝', '上司': '👔', '同僚': '🧑‍💼', '部下': '🌱',
    '友人': '🙆', '家族': '🏠', 'その他': '✉️'
  };
  var CHANNEL_ICONS = {
    'メール': '✉️', 'Slack': '💬', 'LINE': '💚', 'DM': '📩', 'その他': '🗨️'
  };
  var TONE_ICONS = {
    'やわらかく': '☁️', '丁寧に': '🎀', '短く': '✂️', 'きっぱり': '⚡',
    '催促': '⏰', '断る': '🙏', '謝る': '🍵', '感情を抜く': '🧊'
  };

  // ---- 内部状態 ------------------------------------------------------------
  var state = { history: [] };
  var listeners = [];

  // ---- ユーティリティ ------------------------------------------------------
  function uid(prefix) {
    return (prefix || 'y_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---- 永続化 --------------------------------------------------------------
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.history)) {
          state.history = parsed.history;
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
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ history: state.history, v: 1 }));
    } catch (e) {
      /* ストレージ不可(プライベートモード等)でも UI は動かす */
    }
  }

  // ---- サンプルデータ（初回のみ・触ってすぐ体験できるように） --------------
  function seed() {
    var now = Date.now();
    var DAY = 24 * 60 * 60 * 1000;
    state.history = [
      {
        id: uid(),
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        originalMessage: 'まだですか？',
        userIntent: '本日中は難しく、明日午前なら対応できると伝えたい',
        relationship: '取引先',
        channel: 'メール',
        tones: ['やわらかく', '丁寧に'],
        length: '普通',
        suggestions: [
          { id: uid('s_'), label: 'やわらかめ', text: 'お世話になっております。\nご連絡ありがとうございます。\n恐れ入りますが、本日中の対応は難しい状況です。明日午前であれば対応可能です。\nどうぞよろしくお願いいたします。', note: 'クッション言葉を添えて、やわらかい印象に。', isFavorite: true },
          { id: uid('s_'), label: 'ちょうどいい', text: 'お世話になっております。\n本日中の対応は難しいのですが、明日午前に対応可能です。\nよろしくお願いいたします。', note: 'ていねいさと簡潔さのバランス。' },
          { id: uid('s_'), label: '短め', text: '本日中は難しいため、明日午前に対応いたします。\nよろしくお願いします。', note: '要点だけ、すっきり短く。' }
        ],
        selectedText: 'お世話になっております。\n本日中の対応は難しいのですが、明日午前に対応可能です。\nよろしくお願いいたします。',
        riskCheck: { coldness: 1, pressure: 1, length: 2, comment: 'やわらかく整っています。そのまま送れそうです。' }
      },
      {
        id: uid(),
        createdAt: new Date(now - 1 * DAY).toISOString(),
        originalMessage: '今週中にお返事いただけますか？',
        userIntent: '今回は見送らせてほしいと丁寧に断りたい',
        relationship: '取引先',
        channel: 'メール',
        tones: ['断る', '丁寧に'],
        length: '丁寧に長め',
        suggestions: [
          { id: uid('s_'), label: 'やわらかめ', text: 'お世話になっております。\nご提案いただきありがとうございます。\n大変申し訳ないのですが、今回は見送らせていただきます。\nまたの機会がございましたら、ぜひよろしくお願いいたします。', note: 'お礼とお詫びを添えて、角を立てずに。', isFavorite: false },
          { id: uid('s_'), label: 'ちょうどいい', text: 'お世話になっております。\n申し訳ありませんが、今回は見送らせていただきます。\n何卒ご理解いただけますと幸いです。', note: 'ていねいさと簡潔さのバランス。' },
          { id: uid('s_'), label: '短め', text: '申し訳ありませんが、今回は見送らせていただきます。\nよろしくお願いします。', note: '要点だけ、すっきり短く。' }
        ],
        selectedText: 'お世話になっております。\nご提案いただきありがとうございます。\n大変申し訳ないのですが、今回は見送らせていただきます。\nまたの機会がございましたら、ぜひよろしくお願いいたします。',
        riskCheck: { coldness: 2, pressure: 1, length: 3, comment: '少しかしこまった印象。相手や場面に合わせて調整しても。' }
      },
      {
        id: uid(),
        createdAt: new Date(now - 3 * DAY).toISOString(),
        originalMessage: '',
        userIntent: '先日お願いした資料、いつ頃いただけるか確認したい',
        relationship: '同僚',
        channel: 'Slack',
        tones: ['催促', 'やわらかく'],
        length: '短め',
        suggestions: [
          { id: uid('s_'), label: 'やわらかめ', text: 'おつかれさまです。\nお忙しいところ恐れ入りますが、先日お願いした資料の進み具合はいかがでしょうか。\nお手すきの際にご確認いただけますと助かります。', note: 'やわらかく、急かしすぎない催促。' },
          { id: uid('s_'), label: 'ちょうどいい', text: 'おつかれさまです。\n先日お願いした資料、進み具合はいかがでしょうか。\nご確認のほどよろしくお願いします。', note: 'ていねいさと簡潔さのバランス。' },
          { id: uid('s_'), label: '短め', text: '先日の資料、進み具合いかがでしょうか？\nご確認お願いします。', note: '要点だけ、すっきり短く。' }
        ],
        selectedText: '',
        riskCheck: { coldness: 1, pressure: 2, length: 1, comment: '少し急かす印象があるかもしれません。一言そえると印象がやわらぎます。' }
      }
    ];
    save();
  }

  // ---- 取得 ----------------------------------------------------------------
  /** 履歴（新しい順） */
  function history() {
    return state.history.slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getHistory(id) {
    for (var i = 0; i < state.history.length; i++) if (state.history[i].id === id) return state.history[i];
    return null;
  }

  /** お気に入りに入れた返信案を、親情報つきで横断的に集める */
  function favorites() {
    var out = [];
    history().forEach(function (h) {
      (h.suggestions || []).forEach(function (s) {
        if (s.isFavorite) {
          out.push({
            suggestion: s,
            historyId: h.id,
            createdAt: h.createdAt,
            channel: h.channel,
            relationship: h.relationship,
            tones: h.tones
          });
        }
      });
    });
    return out;
  }

  /** タイトル（履歴一覧の見出し）を内容から導出 */
  function deriveTitle(it) {
    var t = it.tones || [];
    if (t.indexOf('謝る') >= 0) return '謝罪文';
    if (t.indexOf('断る') >= 0) return '断り文';
    if (t.indexOf('催促') >= 0) return '催促文';
    var s = (it.userIntent || '').replace(/\s+/g, ' ').trim();
    if (s) return s.length > 14 ? s.slice(0, 14) + '…' : s;
    return '返信文';
  }

  /** 履歴一覧用の抜粋（選択文 or 1案目の先頭） */
  function excerptOf(it) {
    var base = it.selectedText || (it.suggestions && it.suggestions[0] && it.suggestions[0].text) || '';
    base = base.replace(/\s+/g, ' ').trim();
    return base.length > 48 ? base.slice(0, 48) + '…' : base;
  }

  /** 履歴検索（意図・相手の文・本文・タイトル・チャネルを対象） */
  function searchHistory(query) {
    var q = (query || '').trim().toLowerCase();
    var list = history();
    if (!q) return list;
    return list.filter(function (h) {
      var hay = [
        deriveTitle(h), h.userIntent, h.originalMessage, h.channel, h.relationship,
        (h.tones || []).join(' '),
        (h.suggestions || []).map(function (s) { return s.text; }).join(' ')
      ].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  // ---- 変更系 --------------------------------------------------------------
  /**
   * 生成結果を履歴に保存する。
   * @param {object} request ReplyRequest
   * @param {object} result  ReplyGenerateResult（suggestions, riskCheck）
   * @returns {string} 作成された履歴ID
   */
  function addGeneration(request, result) {
    var item = {
      id: uid(),
      createdAt: new Date().toISOString(),
      originalMessage: request.originalMessage || '',
      userIntent: request.userIntent || '',
      relationship: request.relationship || '',
      channel: request.channel || 'その他',
      tones: (request.tones || []).slice(),
      length: request.length || '普通',
      suggestions: (result.suggestions || []).map(function (s) {
        return { id: uid('s_'), label: s.label, text: s.text, note: s.note || '', isFavorite: false };
      }),
      selectedText: '',
      riskCheck: result.riskCheck || null
    };
    state.history.unshift(item);
    save();
    emit();
    return item.id;
  }

  /** 返信案のテキスト等を差し替える（「もっと丁寧に / もっと短く」用） */
  function updateSuggestion(historyId, suggestionId, patch) {
    var h = getHistory(historyId);
    if (!h) return;
    (h.suggestions || []).forEach(function (s) {
      if (s.id === suggestionId) {
        if (patch.text != null) s.text = patch.text;
        if (patch.note != null) s.note = patch.note;
      }
    });
    save();
    emit();
  }

  /** お気に入りの ON/OFF を切り替える */
  function toggleFavorite(historyId, suggestionId) {
    var h = getHistory(historyId);
    if (!h) return false;
    var now = false;
    (h.suggestions || []).forEach(function (s) {
      if (s.id === suggestionId) { s.isFavorite = !s.isFavorite; now = s.isFavorite; }
    });
    save();
    emit();
    return now;
  }

  /** 送信前チェック用に「採用した文」を保存する */
  function setSelected(historyId, text, riskCheck) {
    var h = getHistory(historyId);
    if (!h) return;
    h.selectedText = text;
    if (riskCheck) h.riskCheck = riskCheck;
    save();
    emit();
  }

  function removeHistory(id) {
    state.history = state.history.filter(function (h) { return h.id !== id; });
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
    return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
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
    RELATIONSHIPS: RELATIONSHIPS,
    CHANNELS: CHANNELS,
    TONES: TONES,
    LENGTHS: LENGTHS,
    REL_ICONS: REL_ICONS,
    CHANNEL_ICONS: CHANNEL_ICONS,
    TONE_ICONS: TONE_ICONS,
    init: init,
    history: history,
    getHistory: getHistory,
    favorites: favorites,
    deriveTitle: deriveTitle,
    excerptOf: excerptOf,
    searchHistory: searchHistory,
    addGeneration: addGeneration,
    updateSuggestion: updateSuggestion,
    toggleFavorite: toggleFavorite,
    setSelected: setSelected,
    removeHistory: removeHistory,
    resetAll: resetAll,
    subscribe: subscribe
  };
})(window);
