/* UI: カード単位の畳み(v93 便AM-9)。経営タブの判断カードは既定で畳み、題+1行要約だけを見せる。
 * 開閉はモジュール内に持ち、セーブには書かない(新キー0)。data-goto で中のカードへ飛ぶときは reveal() で開く。 */
(function (root) {
  'use strict';
  function setOpen(card, open) {
    const head = card.querySelector('.fold-head'); const body = card.querySelector('.fold-body');
    if (!head || !body) return;
    card.classList.toggle('open', open);
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.hidden = !open;
  }
  function reveal(el) {
    const card = el && el.closest ? el.closest('.fold') : null;
    if (card && !card.classList.contains('open')) setOpen(card, true);
  }
  document.addEventListener('click', (e) => {
    const head = e.target.closest ? e.target.closest('.fold-head') : null;
    if (!head) return;
    const card = head.closest('.fold');
    setOpen(card, !card.classList.contains('open'));
  });
  root.UI_FOLD = { setOpen, reveal };
})(window);
