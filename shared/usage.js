/* ================================================================
   BRIDGE Usage Log v1.0 — 利用ログ単機能版
   bridge.js(サイト共通基盤)を読まないプロダクトページ用。
   この端末でいつ開いたかを localStorage に記録するだけ。外部送信なし。
   cockpit(運営の台帳)が「自分が最後に使った日」として読む。
   使い方: <script src="../shared/usage.js" defer></script>
   ================================================================ */
(function () {
  'use strict';
  try {
    var sc = document.currentScript || document.querySelector('script[src*="shared/usage.js"]');
    var base = sc ? new URL(sc.src, location.href).pathname.replace(/shared\/usage\.js.*$/, '') : '/';
    var rel = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : location.pathname;
    var id = (rel.split('/')[0] || '').replace(/\.html?$/, '');
    if (!id || id === 'index') id = 'home';
    var KEY = 'bridge-usage';
    var log = JSON.parse(localStorage.getItem(KEY) || '{}');
    var today = new Date().toLocaleDateString('sv-SE');
    if (log[id] !== today) { log[id] = today; localStorage.setItem(KEY, JSON.stringify(log)); }
  } catch (e) {}
})();
