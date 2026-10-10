/* ================================================================
   BRIDGE Site Runtime v3.0 — 正式ロゴ準拠
   全ページ共通:ヘッダー/フッター描画・テーマ・Reveal・メニュー
   使い方:
     <body data-root="../" data-page="philosophy">
     <script src="../shared/bridge.js" defer></script>
   映像の窓(Reel)の約束: <figure class="reel" data-reel="../showreel/<名前>/"> > .reel-frame > video.reel-v(muted playsinline preload="none" controls poster=light-wide.webp + <source> light-wide.mp4) + button.motion-toggle[hidden](.i-pause/.i-play の svg) / figcaption.sr-only(流れを一文で)
     版は data-reel の下の {light,dark}-{wide,tall}.mp4 と同名の .webp。JS がなければライト横長をネイティブの操作盤で再生できる。挙動は下の「Reel」の節
   ================================================================ */
/* JSが動く環境でだけ data-reveal を隠す(CSSは html.js 配下に限定)。
 * JS無効環境で恒久的に不可視になる既存不具合の解消。先頭・同期実行 */
document.documentElement.classList.add('js');
(function () {
  'use strict';
  const ROOT = document.body.dataset.root || './';
  const PAGE = document.body.dataset.page || '';

  /* ---- サイトマップ(唯一の情報源。ページが増えたらここに足す)
     primary: ヘッダーに常時表示する主要入口(増やしすぎない)
     それ以外はメニュー(ドロワー)とフッターから辿れる ---- */
  const NAV = [
    { id: 'products',   en: 'Products',   jp: 'プロダクト',   d: '仕事に使える道具と、経営を体験するゲーム。',            href: 'products/index.html', primary: true },
    { id: 'philosophy', en: 'Philosophy', jp: '考え方',      d: 'BRIDGEが何を大切にし、なぜこの活動をしているのか。', href: 'philosophy/index.html', primary: true },
    { id: 'journal',    en: 'Journal',    jp: '手記',        d: '完成していない考えも、そのまま公開しています。',       href: 'journal/index.html', primary: true },
    { id: 'about',      en: 'About',      jp: 'BRIDGEについて', d: '名前の由来と、運営者のこれまでの歩み。',              href: 'about/index.html', primary: true },
    { id: 'projects',   en: 'Projects',   jp: '活動',        d: 'PMI、AI、教育、研究。いま動いていること。',           href: 'projects/index.html' },
    { id: 'stories',    en: 'Stories',    jp: '物語',        d: '現場で実際にあったことを、一人称で。',                 href: 'stories/index.html' },
    { id: 'services',   en: 'Services',   jp: '仕事のご依頼',  d: '医療機関向けの経営支援・PMI伴走、ツール開発、講演。', href: 'services/index.html' },
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
          NAV.filter(n => n.primary).map(n => '<a href="' + ROOT + n.href + '"' + (n.id === PAGE ? ' class="active" aria-current="page"' : '') + '>' + n.en + '</a>').join('') +
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

    // 下層ページのヒーローの線と点は CSS(.page-hero h1 の ::after / ::before)が描く

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
          { t: 'Services', href: 'services/index.html' },
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

  /* ---- 利用ログ(第12条・第15条の最小実装) ----
     この端末でどのページをいつ開いたかを localStorage に記録する。
     外部送信はしない。cockpit(運営の台帳)が「自分が最後に使った日」として読む。 ---- */
  try {
    const sc = document.currentScript || document.querySelector('script[src*="shared/bridge.js"]');
    const base = sc ? new URL(sc.src, location.href).pathname.replace(/shared\/bridge\.js.*$/, '') : '/';
    const rel = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : location.pathname;
    let id = (rel.split('/')[0] || '').replace(/\.html?$/, '');
    if (!id || id === 'index') id = 'home';
    const KEY = 'bridge-usage';
    const log = JSON.parse(localStorage.getItem(KEY) || '{}');
    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD(端末のローカル日付)
    if (log[id] !== today) { log[id] = today; localStorage.setItem(KEY, JSON.stringify(log)); }
  } catch (e) {}

  /* ---- 訪問者計測(未計測) ----
     GOATCOUNTER_CODE にサイトコード(例: 'bridge-med')を入れるとGoatCounterの計測が始まる。
     空文字のままなら何も読み込まない=未計測。手順と選定理由は docs/analytics.md。
     有効化する同じコミットで legal/privacy.html に計測の一文(analytics.mdに用意済み)を
     追記すること(第32条)。それまで cockpit には「未計測」と正直に表示する。 ---- */
  const GOATCOUNTER_CODE = 'wataru';
  if (GOATCOUNTER_CODE) {
    const gc = document.createElement('script');
    gc.dataset.goatcounter = 'https://' + GOATCOUNTER_CODE + '.goatcounter.com/count';
    gc.src = 'https://gc.zgo.at/count.js'; gc.async = true;
    document.head.appendChild(gc);
  }
  const ANALYTICS_ENDPOINT = '';
  if (ANALYTICS_ENDPOINT && navigator.sendBeacon) {
    try { navigator.sendBeacon(ANALYTICS_ENDPOINT, JSON.stringify({ p: location.pathname, r: document.referrer })); } catch (e) {}
  }

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

  /* ---- Reel(映像の窓・共通。型は docs/design-system.md §4「映像」) ----
     版はテーマ(html の data-theme)× 画角(≤760px は tall=4:5)の4本から1本だけを、近づいてから読む(それまではポスターだけ)。
     画面に半分入ったら一度だけ再生(無音・ループなし)。画面外・非表示のタブで止め、戻ったら続きから。人が止めたら再開しない。
     動きを減らす設定では自動で再生せず、ポスターと再生ボタン。テーマ・画角が変わったら版を差し替え、再生位置と再生中かどうかを保つ。
     ページ内で同時に再生するのは1本だけ(designer 2026-10-09): 1本が再生を始めたら、ほかは画面外で止めたときと同じ扱いで止める。
     状態: 自動で一度だけ再生した(autoDone)/人が止めた(userPaused)/画面外・非表示・ほかの1本のために止めた(autoPaused) ---- */
  const reels = document.querySelectorAll('figure.reel[data-reel]');
  if (reels.length && 'IntersectionObserver' in window && window.matchMedia) {   // 古い環境ではネイティブの操作盤のまま
    const html = document.documentElement;
    const reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)'), spQ = window.matchMedia('(max-width: 760px)');
    const name = () => (html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light') + '-' + (spQ.matches ? 'tall' : 'wide');
    const units = [];
    reels.forEach(fig => {
      const v = fig.querySelector('.reel-v'), btn = fig.querySelector('.motion-toggle');
      if (!v || !btn) return;
      fig.classList.add('reel-js');                      // 窓を JS ありの組み(≤760px は 4:5)にする
      const DIR = fig.getAttribute('data-reel');
      let near = false, inView = false, autoDone = false, userPaused = false, autoPaused = false, cur = '';

      // ネイティブの操作盤をしまい、自前のボタンを出す。<source> は外して、版を JS で選ぶ
      v.removeAttribute('controls');
      v.querySelectorAll('source').forEach(s => s.remove());
      btn.hidden = false;

      const label = () => {
        const playing = !v.paused && !v.ended;
        btn.setAttribute('aria-pressed', String(!playing));
        btn.setAttribute('aria-label', playing ? '映像を止める' : v.ended ? 'もう一度再生する' : '映像を再生する');
      };
      const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => { label(); }); };
      const stop = () => { if (!v.paused && !v.ended) { autoPaused = true; v.pause(); } };   // 自動で止める(戻ったら続きから)
      // 版の差し替え(テーマ・画角が変わったとき)。再生位置と、再生中かどうかを保つ
      const pick = () => {
        const n = name();
        if (n === cur) return;
        const t = v.currentTime || 0, was = !v.paused && !v.ended, ended = v.ended;
        cur = n; v.poster = DIR + n + '.webp';
        if (!near) return;                                 // 近づくまで映像は読まない(ポスターだけ)
        v.src = DIR + n + '.mp4';
        if (t > 0) v.addEventListener('loadedmetadata', function f() { v.removeEventListener('loadedmetadata', f); v.currentTime = ended ? v.duration : t; }, { once: true });
        if (was) play();
      };
      const load = () => { if (near) return; near = true; cur = ''; pick(); v.preload = 'auto'; };
      const unit = { v, stop };
      units.push(unit);

      pick();
      new IntersectionObserver(es => { if (es[0].isIntersecting) load(); }, { rootMargin: '600px 0px' }).observe(v);
      new IntersectionObserver(es => {
        const r = es[0].intersectionRatio;
        if (r >= 0.5) {
          inView = true;
          if (document.hidden) return;
          if (!autoDone && !reduceQ.matches) { autoDone = true; load(); play(); }
          else if (autoPaused && !userPaused) { autoPaused = false; play(); }
        } else if (!es[0].isIntersecting) {
          inView = false;
          stop();
        }
      }, { threshold: [0, 0.5] }).observe(v);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else if (autoPaused && inView && !userPaused) { autoPaused = false; play(); }
      });
      btn.addEventListener('click', () => {
        load(); autoDone = true; autoPaused = false;
        if (!v.paused && !v.ended) { userPaused = true; v.pause(); }
        else { userPaused = false; if (v.ended) v.currentTime = 0; play(); }
      });
      v.addEventListener('play', () => { units.forEach(u => { if (u !== unit) u.stop(); }); });   // 同時に1本だけ
      ['play', 'pause', 'ended'].forEach(e => v.addEventListener(e, label));
      new MutationObserver(pick).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
      if (spQ.addEventListener) spQ.addEventListener('change', pick); else if (spQ.addListener) spQ.addListener(pick);
      label();
    });
  }

  window.BRIDGE = { ROOT: ROOT, MARK: MARK, observeReveal: observeAll, applyBudoux: applyBudoux };
  document.documentElement.classList.add('js-ready'); // 安全弁(bridge.css の rv-safe)を解除
})();
