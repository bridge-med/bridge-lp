/* ================================================================
   BRIDGE Site Runtime v3.2 — 正式ロゴ準拠
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
    { id: 'philosophy', en: 'Philosophy', jp: '考え方',          d: 'BRIDGEが何を大切にし、なぜこの活動をしているのか。', href: 'philosophy/index.html' },
    { id: 'projects',   en: 'Projects',   jp: '活動',            d: 'PMI、AI、教育、研究。いま動いていること。',           href: 'projects/index.html' },
    { id: 'products',   en: 'Products',   jp: 'プロダクト',       d: '実際に使えるもの。すべて公開しています。',             href: 'products/index.html' },
    { id: 'stories',    en: 'Stories',    jp: '物語',            d: '現場で実際にあったことを、一人称で。',                 href: 'stories/index.html' },
    { id: 'journal',    en: 'Journal',    jp: '手記',            d: '完成していない考えも、そのまま公開しています。',       href: 'journal/index.html' },
    { id: 'about',      en: 'About',      jp: 'BRIDGEについて', d: '名前の由来と、これまでの歩み。',                     href: 'about/index.html' },
  ];
  const CTA = { id: 'community', en: 'Contact', jp: '話をする', d: '共感も、異論も、相談も。', href: 'community/index.html' };

  /* ---- 正式ロゴ(交差する二本の線。接続はしない) ---- */
  const MARK =
    '<svg class="logo-mark" viewBox="0 0 240 110" aria-hidden="true">' +
    '<path class="l-navy" stroke-width="6" d="M8 74 C 62 16, 118 24, 176 84"/>' +
    '<path class="l-sand" stroke-width="6" d="M58 94 C 118 60, 158 22, 232 12"/>' +
    '</svg>';

  /* ---- faviconを正式ロゴへ統一 ---- */
  const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23FBFAF7'/%3E%3Cpath d='M8 40 C 22 18, 36 22, 50 42' stroke='%2316233E' stroke-width='3.2' fill='none' stroke-linecap='round'/%3E%3Cpath d='M20 47 C 34 36, 44 22, 58 17' stroke='%23A98F63' stroke-width='3.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    document.head.appendChild(icon);
  }
  icon.href = FAVICON;

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

  /* ---- Philosophyページの言語・Manifesto表現を調整 ---- */
  if (PAGE === 'philosophy') {
    document.title = 'Philosophy — BRIDGE';

    const heroTitle = document.querySelector('.page-hero h1');
    if (heroTitle) heroTitle.innerHTML = 'Philosophy<span class="period">.</span>';

    const heroLead = document.querySelector('.page-hero .lead');
    if (heroLead) heroLead.textContent = 'BRIDGEが何を大切にし、なぜこの活動を続けているのかを書いたページです。気になる章から読んでもらって構いません。';

    const principleEyebrow = document.querySelector('#principles .eyebrow');
    if (principleEyebrow) principleEyebrow.textContent = 'Principles — 大切にしていること';

    const principleHeading = document.querySelector('#principles .sec-h');
    if (principleHeading) principleHeading.textContent = '迷ったときに、ここへ戻ります。';

    const manifestoEyebrow = document.querySelector('#manifesto .eyebrow');
    if (manifestoEyebrow) manifestoEyebrow.textContent = 'Manifesto';

    const manifestoStage = document.querySelector('#manifesto .mani-stage');
    if (manifestoStage) {
      const lines = [
        ['Human First', '病気ではなく、人を見る。'],
        ['Expand Choices', '正解を与えるのではなく、選択肢を増やす。'],
        ['Believe Potential', '現状ではなく、可能性を見る。'],
        ['Build Systems', '努力だけに頼らず、続けられる仕組みを作る。'],
        ['Keep Learning', '実践し、検証し、改善し続ける。'],
        ['For Society', 'リハビリテーションの価値を、社会へ広げる。'],
      ];
      manifestoStage.innerHTML = lines.map(([key, text]) =>
        '<p class="mani-line" data-reveal><span class="mani-key">' + key + '</span><span>' + text + '</span></p>'
      ).join('') +
        '<p class="mani-final" data-reveal>選べる未来を、<br>増やしていく<span class="period">。</span></p>';

      const style = document.createElement('style');
      style.textContent =
        '#manifesto .mani-line{display:grid;grid-template-columns:minmax(112px,150px) 1fr;gap:28px;align-items:baseline}' +
        '#manifesto .mani-key{font:600 10px/1.5 var(--en);letter-spacing:.15em;text-transform:uppercase;color:var(--dawn)}' +
        '@media(max-width:640px){#manifesto .mani-line{grid-template-columns:1fr;gap:8px}#manifesto .mani-key{font-size:9px}}';
      document.head.appendChild(style);
    }

    const signature = document.querySelector('#manifesto .mani-sig');
    if (signature) signature.textContent = 'BRIDGE — EXPAND CHOICES.';
  }

  /* ---- Projects: 対立ではなく、価値を広げる表現へ ---- */
  if (PAGE === 'projects') {
    document.querySelectorAll('.road-p').forEach(el => {
      if (el.textContent.includes('医療の枠を超えて')) {
        el.textContent = '医療で培った価値を、社会のさまざまな場所へ届ける。';
      }
    });
  }

  /* ---- About: 肩書きを盛らず、実務と思想の接点を伝える ---- */
  if (PAGE === 'about') {
    const role = Array.from(document.querySelectorAll('.founder-roles span')).find(el => el.textContent.trim() === '医療経営コンサル');
    if (role) role.textContent = '医療経営支援・PMI';

    const quote = document.querySelector('.founder-q');
    if (quote) {
      quote.innerHTML = '臨床で身につけた見方を、研究、経営、プロダクトへ持ち込んでいます。対象は変わっても、選べる状態をつくるという目的は変わりません。';
    }
  }

  /* ---- Research: 「準備中」より、現在地を具体的に伝える ---- */
  if (PAGE === 'research') {
    const heading = Array.from(document.querySelectorAll('.sec-h')).find(el => el.textContent.trim() === '業績。');
    if (heading) heading.textContent = 'これまでの研究と、これから確かめたいこと。';

    const intro = Array.from(document.querySelectorAll('.body-p')).find(el => el.textContent.includes('書誌情報は現在整理中'));
    if (intro) intro.textContent = '査読付き英語論文や学会発表を含め、これまでの研究実績を順次整理しています。掲載できる情報から更新していきます。';
  }

  /* ---- Community: 勧誘ではなく、関わり方を選べるページへ ---- */
  if (PAGE === 'community') {
    const heroTitle = document.querySelector('.page-hero h1');
    if (heroTitle) heroTitle.innerHTML = '関わり方は、<br>ひとつではありません<span class="period">。</span>';

    const heroLead = document.querySelector('.page-hero .lead');
    if (heroLead) heroLead.textContent = '読む、使う、話す、一緒に作る。BRIDGEとの関わり方は、どれでも構いません。共感だけでなく、異論や現場の困りごとも歓迎しています。';

    const enough = document.querySelector('.enough .stmt');
    if (enough) {
      enough.innerHTML = '読んで、少しでも<br>「リハビリテーションには、<span class="nowrap">こんな見方もあるのか</span>」と感じてもらえたら、<br><span class="h">まずは十分です。</span>';
    }

    const enoughNote = document.querySelector('.enough .stmt + p');
    if (enoughNote) enoughNote.textContent = 'そこから先を選ぶのは、あなたです。';
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
        col('Philosophy', [
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

  /* ---- Reveal(共通) ---- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  const observeAll = () => document.querySelectorAll('[data-reveal]:not(.on)').forEach(el => io.observe(el));
  observeAll();
  window.BRIDGE = { ROOT: ROOT, MARK: MARK, observeReveal: observeAll };
})();