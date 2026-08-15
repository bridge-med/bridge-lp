/* =========================================================================
 * 砂庭 — store.js
 * 端末内(localStorage)の保存だけを受け持つ。外部送信はしない。
 *
 * 残すのは石だけである。
 *   石 : 置いたという選択そのもの。次に開いても残っている
 *   紋 : 砂に引いた線。時間が経てば消える(app.js側の寿命管理)。保存しない
 * 枯山水は掃かれるものであり、紋が残らないことを欠損として扱わない。
 *
 * 型:
 *   Stone : { x, y, r, seed }   x/y/r は画面短辺を1とした正規化座標
 * ========================================================================= */
(function (global) {
  'use strict';

  var KEY = 'sunaniwa:v1';
  var MAX_STONES = 24;

  var state = { stones: [], hinted: false };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.stones)) {
        state.stones = saved.stones.filter(function (s) {
          return s && isFinite(s.x) && isFinite(s.y) && isFinite(s.r);
        }).slice(-MAX_STONES);
      }
      state.hinted = !!(saved && saved.hinted);
    } catch (e) { /* 壊れていたら空の庭から始める */ }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) { /* 保存できなくても庭は使える */ }
  }

  load();

  global.Store = {
    /** 置かれている石(参照をそのまま渡す。描画側は読むだけ) */
    stones: function () { return state.stones; },

    /** 石を置く。上限を超えたら最も古い石が土に還る */
    addStone: function (stone) {
      state.stones.push(stone);
      if (state.stones.length > MAX_STONES) state.stones.shift();
      save();
      return stone;
    },

    /** 石を持ち上げる */
    removeStone: function (stone) {
      var i = state.stones.indexOf(stone);
      if (i < 0) return false;
      state.stones.splice(i, 1);
      save();
      return true;
    },

    /** 手がかりの文を出し終えたか(一度触れたら二度と出さない) */
    hinted: function () { return state.hinted; },
    markHinted: function () {
      if (state.hinted) return;
      state.hinted = true;
      save();
    }
  };
})(window);
