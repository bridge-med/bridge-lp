/* UI: 通知の部品(バナー・トースト・モーダル)。game.js から抽出(v86 便AM-2)。挙動・文言は不変 */
(function (root) {
  'use strict';
  function create(ctx) {
    const $ = ctx.$;
    let bannerTimer = null;
  function banner(html) {
    const el = $('banner');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 5000);
  }
    let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function showModal(title, bodyHtml, btnLabel) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHtml;
    $('modalBtn').textContent = btnLabel || 'OK';
    $('modal').classList.add('show');
  }
    $('modalBtn').addEventListener('click', () => $('modal').classList.remove('show'));
    return { banner, toast, showModal };
  }
  root.UI_EVENTS = { create };
})(window);
