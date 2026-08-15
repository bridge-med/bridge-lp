/* =========================================================================
 * ふたつめの波 — store.js
 * 端末内(localStorage)の保存だけを受け持つ。外部送信はしない。
 *
 * 残すのは「どこまで行ったか」だけである。
 * 手数も、かかった時間も、失敗の回数も数えない。数えれば追い立てる道具になる。
 * ========================================================================= */
(function (global) {
  'use strict';

  var KEY = 'futatsume:v1';
  var state = { reached: 0, hinted: false };

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      if (isFinite(saved.reached) && saved.reached >= 0) state.reached = saved.reached | 0;
      state.hinted = !!saved.hinted;
    }
  } catch (e) { /* 壊れていたら最初の面から始める */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できなくても遊べる */ }
  }

  global.Store = {
    /** 前に開いたとき、どこまで進んでいたか */
    reached: function () { return state.reached; },

    /** ここまで来た、と記録する。戻ることはない */
    reach: function (i) {
      if (i <= state.reached) return;
      state.reached = i;
      save();
    },

    /** はじめから遊び直す */
    reset: function () { state.reached = 0; save(); },

    hinted: function () { return state.hinted; },
    markHinted: function () {
      if (state.hinted) return;
      state.hinted = true;
      save();
    }
  };
})(window);
