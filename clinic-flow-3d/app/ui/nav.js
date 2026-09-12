/* UI: タブのナビゲーション。game.js から抽出(v86 便AM-2)。v88 便AM-4: 5カテゴリ(クリニック/スタッフ/タウン/経営/学び)・開く日を書いた鍵タブ・旧 corp は mgmt へ */
(function (root) {
  'use strict';
  const ALIAS = { corp: 'mgmt' }; // 法人タブは経営タブ内のセクションに(決裁①)
  function create(ctx) {
    const state = {}; // tab -> { open, day }
    function switchTab(tab) {
      tab = ALIAS[tab] || tab;
      const st = state[tab];
      if (st && !st.open) { if (ctx.onLocked) ctx.onLocked(tab, st.day); return; }
      document.querySelectorAll('.tab-btn').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('show', p.id === `tab-${tab}`));
      ctx.onSwitch(tab);
    }
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.addEventListener('click', () => switchTab(b.dataset.tab));
    });
    // 開く前のタブは隠さず「開く日」を書く(第14条: 空室でなく予告)。開いたら本来の名に戻す
    function setTabOpen(tab, open, day) {
      const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
      if (!btn) return;
      state[tab] = { open, day };
      btn.classList.toggle('locked', !open);
      btn.setAttribute('aria-disabled', open ? 'false' : 'true');
      btn.textContent = open ? `${btn.dataset.icon} ${btn.dataset.label}` : `${btn.dataset.icon} Day ${day}`;
      btn.title = open ? btn.dataset.label : `${btn.dataset.label}は Day ${day} から`;
    }
    function setTabVisible(tab, visible) {
      const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
      if (btn) btn.style.display = visible ? '' : 'none';
    }
    return { switchTab, setTabOpen, setTabVisible, alias: (tab) => ALIAS[tab] || tab };
  }
  root.UI_NAV = { create };
})(window);
