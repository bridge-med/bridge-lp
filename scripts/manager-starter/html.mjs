/* ================================================================
   医療管理職スターター — 生成用の共通レイアウト・部品
   scripts/medops/html.mjs をフォーク。変更したら
   `node scripts/manager-starter/build.mjs` で全ページ再生成。
   ブランド名・価格・ナビは manager-starter/data/site.mjs から取る。
   ================================================================ */
import { SITE, NAV, FOOTER_LINKS, FORMATS, PROFESSIONS, EXPERIENCE, fmtPrice } from '../../manager-starter/data/site.mjs';
import { CATEGORIES } from '../../manager-starter/data/categories.mjs';
import { publishedProfessions } from '../../manager-starter/data/professions.mjs';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const formatLabel = (id) => (FORMATS.find((f) => f.id === id) || {}).label || id;
export const profLabel = (id) => (PROFESSIONS.find((p) => p.id === id) || {}).label || id;
export const expLabel = (id) => (EXPERIENCE.find((e) => e.id === id) || {}).label || id;
export const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || '';
export const catShort = (id) => (CATEGORIES.find((c) => c.id === id) || {}).short || '';
export const dateJp = (iso) => iso ? iso.replace(/-/g, '/') : '';
export const dateNum = (iso) => iso ? Number(iso.replace(/-/g, '')) : 0;

/* ノート+チェックのファビコン(medopsのクリップボードとは別図案) */
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23FBFAF7'/%3E%3Cpath d='M14 14h30a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H14z' fill='none' stroke='%2316233E' stroke-width='3.4'/%3E%3Cpath d='M14 14v40M22 24h18M22 32h18M22 40h10' stroke='%2316233E' stroke-width='3' stroke-linecap='round'/%3E%3Cpath d='M40 40l4 5 8-10' stroke='%23A98F63' stroke-width='3.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const THEME_SCRIPT = "(function(){var t=null;try{t=localStorage.getItem('bridge-theme')}catch(e){}if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)})();";

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&family=Inter:wght@500;600;700&display=swap" rel="stylesheet">';

const ICON_SEARCH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const ICON_MOON = '<svg class="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
const ICON_SUN = '<svg class="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

const searchForm = (root, id) =>
  `<form class="mo-search-form" data-search action="${root}templates/index.html" method="get" role="search">
    <input type="search" name="q" placeholder="困りごとで検索" aria-label="サイト内検索" id="${id}">
    <button type="submit" aria-label="検索する">${ICON_SEARCH}</button>
  </form>`;

const header = (root, page) => `
<header class="mo-header">
  <div class="mo-header-in">
    <a class="mo-brand" href="${root}index.html" aria-label="${esc(SITE.name)} トップへ">
      <span class="name">${esc(SITE.name)}</span>
      <span class="by">by ${esc(SITE.parent.name)}</span>
    </a>
    <nav class="mo-nav" aria-label="メインナビゲーション">
      ${NAV.map((n) => `<a href="${root}${n.href}"${n.id === page ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('\n      ')}
    </nav>
    ${searchForm(root, 'hSearch')}
    <button class="mo-theme" id="moTheme" aria-label="ライト/ダークモード切り替え">${ICON_MOON}${ICON_SUN}</button>
    <button class="mo-burger" id="moBurger" aria-label="メニューを開く" aria-expanded="false"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
  </div>
  <nav class="mo-drawer" aria-label="モバイルメニュー">
    ${searchForm(root, 'dSearch')}
    ${NAV.map((n) => `<a href="${root}${n.href}">${esc(n.label)}</a>`).join('\n    ')}
    <a href="${root}guide/index.html">初めての方へ</a>
    ${publishedProfessions().length ? '<div class="sub">職種別</div>\n    ' + publishedProfessions().map((p) => `<a href="${root}professions/${p.slug}/index.html">${esc(p.title)}</a>`).join('\n    ') : ''}
    <div class="sub">その他</div>
    <a href="${root}about/index.html">運営者について</a>
    <a href="${root}faq/index.html">よくある質問</a>
    <a href="${root}../medops/index.html">${esc(SITE.sibling.name)}</a>
    <a href="${root}../index.html">${esc(SITE.parent.name)}(運営プロジェクト)</a>
  </nav>
</header>`;

const footer = (root) => `
<footer class="mo-footer">
  <div class="wrap">
    <div class="mo-footer-grid">
      <div class="fb">
        <div class="name">${esc(SITE.name)}</div>
        <p>${esc(SITE.description)}</p>
      </div>
      <div>
        <div class="fh">コンテンツ</div>
        ${FOOTER_LINKS.content.map((l) => `<a href="${root}${l.href}">${esc(l.label)}</a>`).join('\n        ')}
      </div>
      <div>
        <div class="fh">テーマ</div>
        ${CATEGORIES.map((c) => `<a href="${root}templates/index.html?cat=${c.id}">${esc(c.short)}</a>`).join('\n        ')}
      </div>
      <div>
        <div class="fh">サイトについて</div>
        ${FOOTER_LINKS.about.map((l) => `<a href="${root}${l.href}">${esc(l.label)}</a>`).join('\n        ')}
        ${FOOTER_LINKS.legal.map((l) => `<a href="${root}${l.href}">${esc(l.label)}</a>`).join('\n        ')}
      </div>
    </div>
    <div class="base">
      <span>© 2026 ${esc(SITE.parent.name)}. All rights reserved.</span>
      <span>本サイトの資料は編集して使う前提のひな形です。労務・法律・人事の個別判断は所属法人の規程と専門家へご確認ください。</span>
    </div>
  </div>
</footer>`;

export const breadcrumbs = (root, items) =>
  `<nav class="crumbs wrap" aria-label="パンくず">` +
  [`<a href="${root}index.html">ホーム</a>`,
    ...items.map(([label, href]) => href ? `<a href="${root}${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`),
  ].join('<span class="sep" aria-hidden="true">/</span>') + `</nav>`;

export const breadcrumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [['ホーム', '']].concat(items).map(([name, path], i) => ({
    '@type': 'ListItem', position: i + 1, name,
    item: SITE.baseUrl + (path || '').replace(/index\.html$/, ''),
  })),
});

const jsonld = (objs) => objs.filter(Boolean).map((o) =>
  `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');

export function page({ path, title, description, pageId, event, body, ld = [], hasSticky = false, isHome = false }) {
  const depth = path.split('/').length - 1;
  const root = '../'.repeat(depth);
  const url = SITE.baseUrl + path.replace(/index\.html$/, '');
  const fullTitle = isHome
    ? `${SITE.name} — 医療専門職の新任管理職のための実務サービス`
    : `${title} | ${SITE.name}`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${isHome ? 'website' : 'article'}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta name="twitter:card" content="summary">
<script>${THEME_SCRIPT}</script>
${FONTS}
<link rel="stylesheet" href="${root}assets/ms.css">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
${jsonld(ld)}
</head>
<body${pageId ? ` data-page="${pageId}"` : ''}${event ? ` data-event="${event}"` : ''}${hasSticky ? ' class="has-sticky"' : ''}>
${header(root, pageId)}
<main>
${body}
</main>
${footer(root)}
<script src="${root}assets/ms.js" defer></script>
</body>
</html>
`;
}

/* ---- カード部品 ---- */

export const tplCard = (t, root) => {
  const text = [t.title, t.summary, catName(t.categoryId), (t.formats || []).map(formatLabel).join(' ')].join(' ').toLowerCase();
  return `<a class="tpl-card" href="${root}templates/${t.slug}/index.html"
   data-cat="${t.categoryId}" data-free="1"
   data-profs="${(t.targetProfessions || []).join(' ')}" data-exp="${(t.experience || []).join(' ')}"
   data-formats="${(t.formats || []).join(' ')}" data-text="${esc(text)}"
   data-priority="${t.priority || 99}" data-pub="${dateNum(t.publishedAt)}" data-upd="${dateNum(t.updatedAt)}">
    <span class="top">
      <span class="badge free">無料</span>
      <span class="badge cat">${esc(catShort(t.categoryId))}</span>
    </span>
    <span class="t">${esc(t.title)}</span>
    <span class="d">${esc(t.summary)}</span>
    <span class="meta">
      ${(t.formats || []).slice(0, 2).map((f) => `<span class="chip">${esc(formatLabel(f))}</span>`).join('')}
      <span>更新 ${dateJp(t.updatedAt)}</span>
    </span>
  </a>`;
};

export const artCard = (a, root, attrs = '') => `<a class="art-card" href="${root}articles/${a.slug}/index.html" data-cat="${a.categoryId}"${attrs}>
    <span class="meta"><span class="badge cat">${esc(catShort(a.categoryId))}</span><span class="badge free">記事</span></span>
    <span class="t">${esc(a.title)}</span>
    <span class="d">${esc(a.description)}</span>
    <span class="meta"><span>更新 ${dateJp(a.updatedAt)}</span></span>
  </a>`;

/* ---- 無料テンプレ本文(チェックリスト)の描画 ---- */
export const contentHtml = (t) => {
  const c = t.content;
  if (!c) return '';
  let html = c.intro ? `<p>${esc(c.intro)}</p>` : '';
  if (c.groups) {
    html += `<div id="tpl-body-${t.id}">` + c.groups.map((g) => `
      <div class="cl-group">
        <div class="h">${esc(g.title)}</div>
        <ul class="cl">
          ${g.items.map((it) => {
            const item = typeof it === 'string' ? { t: it } : it;
            return `<li><span class="box" aria-hidden="true"></span><span>${esc(item.t)}${item.note ? `<span class="note">${esc(item.note)}</span>` : ''}</span></li>`;
          }).join('\n          ')}
        </ul>
      </div>`).join('') + '</div>';
    html += `<p style="margin-top:18px"><button class="btn ghost small" data-copy-target="tpl-body-${t.id}">この内容をテキストでコピー</button></p>`;
  }
  return html;
};
