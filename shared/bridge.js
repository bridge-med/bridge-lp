/* ================================================================
   BRIDGE Site Runtime v3.0 — 正式ロゴ準拠
   全ページ共通:ヘッダー/フッター描画・テーマ・Reveal・メニュー
   使い方:
     <body data-root="../" data-page="philosophy">
     <script src="../shared/bridge.js" defer></script>
   ================================================================ */
(function () {
  'use strict';
  const ROOT = document.body.dataset.root || './';
  const PAGE = document.body.dataset.page || '';

  /* ---- サイトマップ(唯一の情報源。ページが増えたらここに足す) ---- */
  const NAV = [
    { id: 'philosophy', en: 'Philosophy', jp: '考え方',      d: 'BRIDGEが何を大切にし、なぜこの活動をしているのか。', href: 'philosophy/index.html' },
    { id: 'projects',   en: 'Projects',   jp: '活動',        d: 'PMI、AI、教育、研究。いま動いていること。',           href: 'projects/index.html' },
    { id: 'products',   en: 'Products',   jp: 'プロダクト',   d: '実際に使えるもの。すべて公開しています。',             href: 'products/index.html' },
    { id: 'stories',    en: 'Stories',    jp: '物語',        d: '現場で実際にあったことを、一人称で。',                 href: 'stories/index.html' },
    { id: 'journal',    en: 'Journal',    jp: '手記',        d: '完成していない考えも、そのまま公開しています。',       href: 'journal/index.html' },
    { id: 'about',      en: 'About',      jp: 'BRIDGEについて', d: '名前の由来と、これまでの歩み。',                    href: 'about/index.html' },
  ];
  const CTA = { id: 'community', en: 'Contact', jp: '話をする', d: '共感も、異論も、相談も。', href: 'community/index.html' };

  /* ---- 正式ロゴ(交差する二本の線。接続はしない) ---- */
  const MARK =
    '<svg class="logo-mark" viewBox="0 0 240 110" aria-hidden="true">' +
    '<path class="l-navy" stroke-width="6" d="M8 74 C 62 16, 118 24, 176 84"/>' +
    '<path class="l-sand" stroke-width="6" d="M58 94 C 118 60, 158 22, 232 12"/>' +
    '</svg>';

  /* ---- ヘッダー ---- */
  const navEl = document.querySelector('.site-nav');
  if (navEl) {
    navEl.innerHTML =
      '<a class="nav-logo" href="' + ROOT + 'index.html" aria-label="BRIDGE ホームへ">' + MARK + 'BRIDGE</a>' +
      '<div class="nav-right">' +
        '<div class="nav-links">' +
          NAV.map(n => '<a href="' + ROOT + n.href + '"' + (n.id === PAGE ? ' class="active" aria-current="page"' : '') + '>' + n.en + '</a>').join('') +
        '</div>' +
        '<a class="nav-cta" href="' + ROOT + CTA.href + '">' + CTA.en + '</a>' +
        '<button class="theme-btn" id="themeBtn" aria-label="ライト/ダークモード切り替え">' +
          '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>' +
          '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
        '</button>' +
        '<button class="nav-burger" id="navBurger" aria-label="メニューを開く" aria-expanded="false"><span></span><span></span></button>' +
      '</div>';

    // モバイル・探索メニュー(全ページ+一言の説明)
    const drawer = document.createElement('div');
    drawer.className = 'nav-drawer';
    drawer.setAttribute('aria-label', 'サイト内メニュー');
    const all = NAV.concat([CTA]);
    drawer.innerHTML = '<nav class="drawer-list">' +
      all.map((n, i) =>
        '<a class="drawer-item" style="transition-delay:' + (0.05 + i * 0.05) + 's" href="' + ROOT + n.href + '">' +
          '<span class="t"><span class="en">' + n.en + '</span>' + n.jp + '</span>' +
          '<span class="d">' + (n.d || '') + '</span>' +
        '</a>').join('') +
      '</nav>';
    document.body.appendChild(drawer);

    const burger = document.getElementById('navBurger');
    burger.addEventListener('click', () => {
      const open = document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    });

    const onScroll = () => navEl.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.getElementById('themeBtn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('bridge-theme', next); } catch (e) {}
    });
  }

  /* ---- フッター(最後にもう一度、地図を渡す) ---- */
  const footEl = document.querySelector('.site-footer');
  if (footEl) {
    const col = (h, links) =>
      '<div class="footer-col"><div class="h">' + h + '</div>' +
      links.map(l => '<a href="' + (l.ext ? '' : ROOT) + l.href + '"' + (l.ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + l.t + (l.ext ? ' ↗' : '') + '</a>').join('') +
      '</div>';
    footEl.innerHTML =
      '<div class="footer-grid">' +
        '<div><div class="footer-brand">' + MARK + '<span>BRIDGE<span class="tg">EXPAND CHOICES.</span></span></div>' +
        '<p class="footer-tagline">選択肢を増やし、人と社会の可能性を広げるプロジェクト。</p></div>' +
        col('思想', [
          { t: 'Philosophy', href: 'philosophy/index.html' },
          { t: 'Manifesto', href: 'philosophy/index.html#manifesto' },
          { t: 'Stories', href: 'stories/index.html' },
        ]) +
        col('活動', [
          { t: 'Projects', href: 'projects/index.html' },
          { t: 'Journal', href: 'journal/index.html' },
          { t: 'About', href: 'about/index.html' },
        ]) +
        col('つくったもの', [
          { t: 'Products', href: 'products/index.html' },
          { t: 'キャリアログ', href: 'daily-app/index.html' },
          { t: 'Starter Kits', href: 'starter-kits/index.html' },
        ]) +
        col('つながる', [
          { t: 'Contact', href: 'community/index.html' },
          { t: 'note', href: 'https://note.com/prime_duck4944', ext: true },
          { t: 'X', href: 'https://x.com/WataruPT1013', ext: true },
        ]) +
      '</div>' +
      '<div class="footer-base">' +
        '<span>© 2026 BRIDGE. All rights reserved.</span>' +
        '<span><a href="' + ROOT + 'legal/privacy.html">Privacy</a></span>' +
      '</div>';
  }

  /* ---- 日本語の改行制御(BudouX)----
     word-break:auto-phrase はChrome限定のため、Safari等でも
     文節単位で折り返すよう、テキストに改行機会(ZWSP)を挿入する。 ---- */
  const BX_SELECTOR = 'h1,h2,h3,p,q,blockquote,.stmt,.pull,.hero-h,.hero-sub,.sec-h,.card-t,.path-t,.way-t,.story-t,.road-t,.tf-t,.tl-t,.mani-line,.mani-final,.closing-h,.princ-jp,.pj .t,.prod-name,.prod-jp,.j-t,.proj-name,.drawer-item .t,.walk-card .t,.story-q,.belief-t,.story-after,.branch-cap,.founder-q,.info-row .v,.pub-t,.pub-m';
  let bxParser = null;
  const applyBudoux = (root) => {
    if (!bxParser) return;
    (root || document).querySelectorAll(BX_SELECTOR).forEach(el => {
      if (el.dataset.bx || el.closest('.site-nav')) return;
      el.dataset.bx = '1';
      try { bxParser.applyToElement(el); } catch (e) {}
    });
  };
  const bxScript = document.createElement('script');
  bxScript.src = ROOT + 'shared/budoux-ja.min.js';
  bxScript.onload = () => {
    if (!window.budoux) return;
    bxParser = window.budoux.loadDefaultJapaneseParser();
    applyBudoux();
  };
  document.head.appendChild(bxScript);

  /* ---- Reveal(共通) ---- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  const observeAll = () => {
    document.querySelectorAll('[data-reveal]:not(.on)').forEach(el => io.observe(el));
    applyBudoux(); // 動的描画されたカード等にも文節改行を適用
  };
  observeAll();
  window.BRIDGE = { ROOT: ROOT, MARK: MARK, observeReveal: observeAll, applyBudoux: applyBudoux };
})();
