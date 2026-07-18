/* ================================================================
   医療管理実務ライブラリ — 生成用の共通レイアウト・部品
   ここを変更したら `node scripts/medops/build.mjs` で全ページ再生成。
   ブランド名・価格・ナビは medops/data/site.mjs から取る(直書き禁止)。
   ================================================================ */
import { SITE, NAV, FOOTER_LINKS, FORMATS, fmtPrice } from '../../medops/data/site.mjs';
import { CATEGORIES } from '../../medops/data/categories.mjs';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const formatLabel = (id) => (FORMATS.find((f) => f.id === id) || {}).label || id;
export const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || '';
export const dateJp = (iso) => iso ? iso.replace(/-/g, '/') : '';
export const dateNum = (iso) => iso ? Number(iso.replace(/-/g, '')) : 0;

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23FBFAF7'/%3E%3Crect x='16' y='12' width='32' height='40' rx='5' fill='none' stroke='%2316233E' stroke-width='3.4'/%3E%3Cpath d='M23 26h12M23 34h18M23 42h9' stroke='%2316233E' stroke-width='3.2' stroke-linecap='round'/%3E%3Cpath d='M38 24l4 4 7-8' stroke='%23A98F63' stroke-width='3.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

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
    <div class="sub">実務テーマ</div>
    ${CATEGORIES.map((c) => `<a href="${root}categories/${c.slug}/index.html">${esc(c.name)}</a>`).join('\n    ')}
    <div class="sub">その他</div>
    <a href="${root}about/index.html">運営者について</a>
    <a href="${root}faq/index.html">よくある質問</a>
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
        <div class="fh">実務テーマ</div>
        ${CATEGORIES.map((c) => `<a href="${root}categories/${c.slug}/index.html">${esc(c.short)}</a>`).join('\n        ')}
      </div>
      <div>
        <div class="fh">サイトについて</div>
        ${FOOTER_LINKS.about.map((l) => `<a href="${root}${l.href}">${esc(l.label)}</a>`).join('\n        ')}
        ${FOOTER_LINKS.legal.map((l) => `<a href="${root}${l.href}">${esc(l.label)}</a>`).join('\n        ')}
      </div>
    </div>
    <div class="base">
      <span>© 2026 ${esc(SITE.parent.name)}. All rights reserved.</span>
      <span>本サイトの資料は編集して利用する前提のひな形です。個別の判断は所管窓口・専門家へご確認ください。</span>
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

/* ---- ページ全体のシェル ----
   path は medops/ からの相対パス。root は自動計算。 */
export function page({ path, title, description, pageId, event, body, ld = [], hasSticky = false, isHome = false }) {
  const depth = path.split('/').length - 1;
  const root = '../'.repeat(depth);
  const url = SITE.baseUrl + path.replace(/index\.html$/, '');
  const fullTitle = isHome
    ? `${SITE.name} — ${SITE.tagline}`
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
<link rel="stylesheet" href="${root}assets/medops.css">
<link rel="icon" type="image/svg+xml" href="${FAVICON}">
${jsonld(ld)}
</head>
<body${pageId ? ` data-page="${pageId}"` : ''}${event ? ` data-event="${event}"` : ''}${hasSticky ? ' class="has-sticky"' : ''}>
${header(root, pageId)}
<main>
${body}
</main>
${footer(root)}
<script src="${root}assets/medops.js" defer></script>
</body>
</html>
`;
}

/* ---- カード部品 ---- */

export const priceHtml = (t) => {
  if (t.isFree) return '<span class="price">無料</span>';
  const p = SITE.pricing.flagship;
  if (t.useFlagshipPrice) {
    return `<span class="price"><span class="was">${fmtPrice(p.list)}</span>${fmtPrice(p.launch)} <small>税込・初期価格</small></span>`;
  }
  return '<span class="price">価格未定</span>';
};

export const tplCard = (t, root) => {
  const text = [t.title, t.summary, catName(t.categoryId), (t.formats || []).map(formatLabel).join(' ')].join(' ').toLowerCase();
  return `<a class="tpl-card" href="${root}templates/${t.slug}/index.html"
   data-cat="${t.categoryId}" data-free="${t.isFree ? 1 : 0}"
   data-roles="${(t.targetRoles || []).join(' ')}" data-formats="${(t.formats || []).join(' ')}"
   data-phases="${(t.phases || []).join(' ')}" data-text="${esc(text)}"
   data-priority="${t.priority || 99}" data-pub="${dateNum(t.publishedAt)}" data-upd="${dateNum(t.updatedAt)}"
   data-price="${t.isFree ? 0 : SITE.pricing.flagship.launch}">
    <span class="top">
      ${t.isFree ? '<span class="badge free">無料</span>' : '<span class="badge paid">有料</span><span class="badge prep">決済準備中</span>'}
      <span class="badge cat">${esc(catName(t.categoryId))}</span>
    </span>
    <span class="t">${esc(t.title)}</span>
    <span class="d">${esc(t.summary)}</span>
    <span class="meta">
      ${(t.formats || []).slice(0, 3).map((f) => `<span class="chip">${esc(formatLabel(f))}</span>`).join('')}
      <span>更新 ${dateJp(t.updatedAt)}</span>
      ${t.isFree ? '<span class="price">無料</span>' : priceHtml(t)}
    </span>
  </a>`;
};

export const artCard = (a, root) => `<a class="art-card" href="${root}articles/${a.slug}/index.html" data-cat="${a.categoryId}">
    <span class="meta"><span class="badge cat">${esc(catName(a.categoryId))}</span></span>
    <span class="t">${esc(a.title)}</span>
    <span class="d">${esc(a.description)}</span>
    <span class="meta"><span>更新 ${dateJp(a.updatedAt)}</span>${a.effectiveDate ? `<span>制度基準日 ${dateJp(a.effectiveDate)}</span>` : ''}</span>
  </a>`;

const CAT_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';

export const catCard = (c, root, count) => `<a class="cat-card" href="${root}categories/${c.slug}/index.html">
    <span class="t">${CAT_ICON}${esc(c.name)}</span>
    <span class="d">${esc(c.description)}</span>
    <span class="n">公開中 ${count}件</span>
  </a>`;

/* ---- 無料テンプレ本文(チェックリスト/文例)の描画 ---- */
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
  if (c.letters) {
    html += c.letters.map((l, i) => `
      <div class="letter">
        <div class="lh"><span>${esc(l.title)}</span><button class="btn ghost small" data-copy-target="letter-${t.id}-${i}">コピー</button></div>
        <pre id="letter-${t.id}-${i}">${esc(l.body)}</pre>
      </div>`).join('');
  }
  return html;
};
