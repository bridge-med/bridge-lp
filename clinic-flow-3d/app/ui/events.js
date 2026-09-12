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
    if (ctx.bindGoto) ctx.bindGoto($('modalBody')); // 本文の data-goto はここで束ねる(キュー経由でも効く・v90)
  }
    $('modalBtn').addEventListener('click', () => { $('modal').classList.remove('show'); if (pendingBanner) { const h = pendingBanner; pendingBanner = null; banner(h); } });
    // 日次の重要イベント(v90 便AM-6): 1日の締めで出るモーダルを集め、優先度の最上位だけを出す(1日1モーダル)。
    // 優先度: 緊急融資・年次 100 > 打ち手の解放 90 > 改定 85 > 月間決算 80 > 30日レビュー 75 > 週次サマリー 70 > リーグ 60 > 特別依頼 50 > 結果 10
    // 収集中でなければ従来どおり即時に出す(締め以外の経路=購入・訪問など)
    const queue = [];
    let collecting = false;
    let carry = []; // 出せなかった上位以外の演出は翌日に持ち越す(結果だけは捨てる=カードにある)
    let pendingBanner = null; // モーダルと同時に出さないバナーは、閉じた後に出す
    function beginDay() { collecting = true; queue.length = 0; for (const q of carry) queue.push(q); carry = []; }
    function queueModal(kind, pri, title, body, btn) {
      if (!collecting) { showModal(title, body, btn); return; }
      queue.push({ kind, pri, title, body, btn });
    }
    function pendingAbove(pri) { return queue.some((q) => q.pri > pri); }
    // 締めで1つだけ出す。skipResult=分岐点が開いた日は結果モーダルを出さない(結果は「昨日の結果」カードにある)
    function flushDay(opts) {
      collecting = false;
      if (!queue.length) return null;
      queue.sort((x, y) => y.pri - x.pri);
      const top = queue[0];
      carry = queue.slice(1).filter((q) => q.kind !== 'result');
      queue.length = 0;
      if (top.kind === 'result' && opts && opts.skipResult) return null;
      showModal(top.title, top.body, top.btn);
      const b = $('banner');
      if (b.classList.contains('show')) { pendingBanner = b.innerHTML; b.classList.remove('show'); clearTimeout(bannerTimer); } // バナーとモーダルは同時に出さない。閉じた後に出す
      return top.kind;
    }
    function modalOpen() { return $('modal').classList.contains('show'); }
    return { banner, toast, showModal, beginDay, queueModal, pendingAbove, flushDay, modalOpen };
  }
  root.UI_EVENTS = { create };
})(window);
