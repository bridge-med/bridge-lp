/* UI: タブのナビゲーション。game.js から抽出(v86 便AM-2)。挙動は不変(描画の呼び分けは ctx.onSwitch) */
(function (root) {
  'use strict';
  function create(ctx) {
    function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('show', p.id === `tab-${tab}`));
      ctx.onSwitch(tab);
    }
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.addEventListener('click', () => switchTab(b.dataset.tab));
    });
    function setTabVisible(tab, visible) {
      const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
      if (btn) btn.style.display = visible ? '' : 'none';
    }
    return { switchTab, setTabVisible };
  }
  root.UI_NAV = { create };
})(window);
