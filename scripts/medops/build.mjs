#!/usr/bin/env node
/* ================================================================
   医療管理実務ライブラリ — サイト生成スクリプト
   使い方: node scripts/medops/build.mjs
   medops/data/*.mjs を唯一の情報源として、medops/ 配下の全HTMLを
   静的生成し、ルートの sitemap.xml のマーカー区間を更新する。
   公開物は純粋な静的ファイル(実行時のビルドはない)。
   コンテンツ追加の手順は medops/README.md を参照。
   ================================================================ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE, ROLES, PHASES, FORMATS, fmtPrice } from '../../medops/data/site.mjs';
import { CATEGORIES } from '../../medops/data/categories.mjs';
import { TEMPLATES, publishedTemplates } from '../../medops/data/templates.mjs';
import { ARTICLES, publishedArticles } from '../../medops/data/articles.mjs';
import {
  esc, page, breadcrumbs, breadcrumbLd, tplCard, artCard, catCard,
  contentHtml, priceHtml, formatLabel, catName, dateJp,
} from './html.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = (path, html) => {
  const abs = join(repo, 'medops', path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, html);
  written.push(path);
};
const written = [];

const tpls = publishedTemplates();
const arts = publishedArticles();
const paidTpls = tpls.filter((t) => !t.isFree);
const catCount = (id) => tpls.filter((t) => t.categoryId === id).length + arts.filter((a) => a.categoryId === id).length;
const tplById = (id) => tpls.find((t) => t.id === id);
const artById = (id) => arts.find((a) => a.id === id);
const E = SITE.events;

/* 関連コンテンツ(公開中のものだけを描画。draftへのリンクは作らない) */
const relatedSection = (root, tplIds = [], artIds = []) => {
  const ts = (tplIds || []).map(tplById).filter(Boolean);
  const as = (artIds || []).map(artById).filter(Boolean);
  if (!ts.length && !as.length) return '';
  return `
  <section class="related wrap">
    ${ts.length ? `<div class="h">関連するテンプレート</div><div class="grid c2">${ts.map((t) => tplCard(t, root)).join('')}</div>` : ''}
    ${as.length ? `<div class="h" style="margin-top:22px">関連する記事</div><div class="grid c2">${as.map((a) => artCard(a, root)).join('')}</div>` : ''}
  </section>`;
};

/* ================================================================
   トップページ
   ================================================================ */
{
  const root = '';
  const featured = tpls.filter((t) => t.isFeatured).slice(0, 4);
  const free = tpls.filter((t) => t.isFree);
  const flagship = tplById('integration-pack');
  const worries = [
    '突然、クリニック統合を任された',
    '行政に何を確認すればよいか分からない',
    'タスク一覧を作ったが、前後関係が見えないと言われた',
    '引き継ぎ資料がなく、前任者しか分からない業務が多い',
    '医療職出身で、管理業務を体系的に学んだことがない',
    'AIに聞いても、一般論しか返ってこない',
  ];
  const features = [
    ['実務経験をもとに作成', 'クリニック統合・行政手続き・採用・電子カルテ移行の支援実務で使っている構成をもとにしています。'],
    ['タスク・期限・確認先まで整理', '「何をするか」だけでなく、誰に確認し、いつまでにやるかまで書ける形にしています。'],
    ['編集して使う前提', 'チェックリストや文例はそのままコピーでき、自院の状況に合わせて書き換えて使えます。'],
    ['必要以上に細かくしない', '網羅的な一覧より、現場で実際に使う単位に絞っています。項目を減らすことも整理のうちです。'],
  ];
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${esc(SITE.name)}</p>
      <h1>${esc(SITE.tagline)}</h1>
      <p class="sub">クリニック統合、管理医師変更、採用、業務分担。医療管理職が迷いやすい実務を、担当者・期限・確認先まで整理したテンプレートと進め方にまとめています。${paidTpls.length ? 'チェックリストと文例は無料で使えます。' : '公開中のテンプレートは、すべて無料で使えます。'}</p>
      <div class="hero-tags">
        <span>医療管理職向け</span><span>チェックリスト・${paidTpls.length ? 'WBS' : '記入シート'}・文例</span><span>コピーして編集する前提</span>
      </div>
      <div class="hero-cta">
        <a class="btn primary" href="templates/index.html${paidTpls.length ? '?free=1' : ''}">無料テンプレートを見る</a>
        <a class="btn ghost" href="#themes">実務テーマから探す</a>
      </div>
    </div>
    ${paidTpls.length ? `<div class="hero-preview" aria-label="テンプレートのイメージ(統合実務パックのWBS抜粋)">
      <div class="bar"><b>統合全体WBS</b><span>— 担当・確認先・期限まで1枚で</span></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th></th><th>タスク</th><th>担当</th><th>確認先</th><th>期限</th></tr></thead>
        <tbody>
          <tr><td><span class="ph on"></span></td><td>保健所へ統合の事前相談</td><td>事務長</td><td>保健所</td><td>3か月前</td></tr>
          <tr><td><span class="ph on"></span></td><td>カルテ移行データの範囲確認</td><td>事務長</td><td>ベンダー</td><td>2.5か月前</td></tr>
          <tr><td><span class="ph"></span></td><td>職員への業務ヒアリング</td><td>本部</td><td>各職種</td><td>2か月前</td></tr>
          <tr><td><span class="ph"></span></td><td>患者・施設への案内文の発送</td><td>事務</td><td>院長承認</td><td>1か月前</td></tr>
        </tbody>
      </table></div>
      <div class="cap">有料パック「統合全体WBS」より抜粋</div>
    </div>` : `<div class="hero-preview" aria-label="テンプレートのイメージ(クリニック統合の初動チェックリスト抜粋)">
      <div class="bar"><b>統合の初動チェックリスト</b><span>— 最初の1週間ぶん</span></div>
      <div style="overflow-x:auto"><table>
        <thead><tr><th></th><th>確認すること</th><th>確認先</th></tr></thead>
        <tbody>
          <tr><td><span class="ph on"></span></td><td>統合予定日を仮でも日付で持つ</td><td>院長・理事長</td></tr>
          <tr><td><span class="ph on"></span></td><td>存続する保険医療機関コードの確認</td><td>院長・理事長</td></tr>
          <tr><td><span class="ph"></span></td><td>施設基準の届出控えを集める(両院分)</td><td>院内</td></tr>
          <tr><td><span class="ph"></span></td><td>保健所(医務担当)へ事前相談</td><td>保健所</td></tr>
        </tbody>
      </table></div>
      <div class="cap">無料テンプレート「クリニック統合の初動チェックリスト」より抜粋</div>
    </div>`}
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Worries</p>
    <h2 class="sec-h">制度は調べたのに、次に何をすればよいか分からない</h2>
    <p class="sec-lead">医療の管理業務は、制度・行政・現場・ベンダーが絡み合います。このサイトは、情報を読むだけで終わらせず、実行できる形の資料に整理して提供します。</p>
    <div class="rows text-wrap" style="margin-top:22px">
      ${worries.map((w, i) => `<div class="row"><span class="m">${String(i + 1).padStart(2, '0')}</span><span class="b">${esc(w)}</span></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec" id="themes" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Themes</p>
    <h2 class="sec-h">実務テーマから探す</h2>
    <div class="grid c3" style="margin-top:22px">
      ${CATEGORIES.map((c) => catCard(c, root, catCount(c.id))).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Templates</p>
    <h2 class="sec-h">テンプレート</h2>
    <p class="sec-lead">${paidTpls.length ? 'まず無料のチェックリストから使えます。有料パックは、内容とサンプルを確認してから検討してください。' : 'チェックリスト・記入シート・文例を公開しています。ページ上でそのまま使えます。'}</p>
    <div class="grid c2" style="margin-top:22px">
      ${featured.map((t) => tplCard(t, root)).join('\n      ')}
    </div>
    <p class="sec-more"><a class="btn ghost small" href="templates/index.html">テンプレートをすべて見る</a></p>
  </div>
</section>

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">How to</p>
    <h2 class="sec-h">初めての方へ — 3ステップ</h2>
    <div class="steps" style="margin-top:22px">
      <div class="step"><div class="t">困っているテーマを選ぶ</div><div class="d">「統合を任された」「管理医師が変わる」など、いまの状況に近いテーマから入ってください。</div></div>
      <div class="step"><div class="t">記事${paidTpls.length ? 'とサンプル' : ''}で進め方を確認する</div><div class="d">各テーマの記事に、全体像と確認先を書いています。${paidTpls.length ? '有料パックはサンプルを公開しています。' : 'テンプレートを使う前に、まず記事で段取りをつかんでください。'}</div></div>
      <div class="step"><div class="t">テンプレートを自院用に編集する</div><div class="d">チェックリストや文例をコピーし、日付や担当者を自院の内容に書き換えて使ってください。</div></div>
    </div>
    <p class="sec-more"><a href="guide/index.html" class="btn ghost small">使い方をくわしく見る</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Free</p>
    <h2 class="sec-h">無料で使える資料</h2>
    <div class="grid c3" style="margin-top:22px">
      ${free.slice(0, 6).map((t) => tplCard(t, root)).join('\n      ')}
    </div>
    <p class="sec-more"><a class="btn ghost small" href="templates/index.html${paidTpls.length ? '?free=1' : ''}">無料テンプレートをすべて見る</a></p>
  </div>
</section>

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Features</p>
    <h2 class="sec-h">このサイトの資料の作り方</h2>
    <div class="grid c2" style="margin-top:22px">
      ${features.map(([t, d]) => `<div class="cat-card" style="cursor:default"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></div>`).join('\n      ')}
    </div>
    <div class="text-wrap" style="margin-top:26px">
      <h3 style="font-size:15px;font-weight:700;margin-bottom:6px">AIが作っただけの資料ではありません</h3>
      <p style="font-size:13px;color:var(--ink-2)">資料の作成に生成AIも使っていますが、一般論のまま公開はしていません。医療現場と経営支援の実務経験をもとに、内容と粒度を整えています。<a href="about/index.html" style="text-decoration:underline">運営者について</a></p>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap text-wrap">
    <div class="notice">
      <div class="h">ご利用にあたって</div>
      本サイトの資料は、実務の整理を助けるひな形であり、法的・医療的・行政的な最終判断を代替するものではありません。個別の案件は所管の保健所・厚生局・自治体・専門家・ベンダーにご確認ください。テンプレートに患者情報・個人情報を入力する場合は、各機関の情報管理規程に従ってください。
      くわしくは<a href="legal/disclaimer.html" style="text-decoration:underline">免責事項</a>をご覧ください。
    </div>
  </div>
</section>`;

  out('index.html', page({
    path: 'index.html',
    title: '',
    isHome: true,
    description: SITE.description,
    pageId: 'home',
    event: E.VIEW_HOME,
    body,
    ld: [{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE.name,
      url: SITE.baseUrl,
      description: SITE.description,
      publisher: { '@type': 'Organization', name: SITE.parent.name },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: SITE.baseUrl + 'templates/index.html?q={search_term_string}' },
        'query-input': 'required name=search_term_string',
      },
    }],
  }));
}

/* ================================================================
   テンプレート一覧(絞り込み・並び替え・横断検索の受け口)
   ================================================================ */
{
  const root = '../';
  const chip = (fkey, fval, label, pressed) =>
    `<button class="fchip" data-fkey="${fkey}" data-fval="${fval}" aria-pressed="${pressed ? 'true' : 'false'}">${esc(label)}</button>`;
  const body = `
${breadcrumbs(root, [['テンプレート', null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:6px">
  <p class="eyebrow">Templates</p>
  <h1>テンプレート一覧</h1>
  <p class="lead">${paidTpls.length ? '公開中のテンプレートです。無料のものはページ上でそのまま使えます。有料パックはサンプルを確認してから検討してください。' : '公開中のテンプレートです。すべて無料で、ページ上でそのまま使えます。'}</p>
</div>
<div class="wrap">
  <div class="filters" aria-label="絞り込み">
    <div class="frow">
      <span class="flabel">テーマ</span>
      ${chip('cat', 'all', 'すべて', true)}
      ${CATEGORIES.filter((c) => tpls.some((t) => t.categoryId === c.id)).map((c) => chip('cat', c.id, c.short)).join('')}
    </div>
    <div class="frow">
      ${paidTpls.length ? `<span class="flabel">料金</span>${chip('price', 'all', 'すべて', true)}${chip('price', 'free', '無料')}${chip('price', 'paid', '有料')}` : ''}
      <span class="fcount" id="fCount" aria-live="polite"></span>
      <button class="freset" id="fReset">条件をリセット</button>
    </div>
    <div class="frow">
      <span class="flabel">検索</span>
      <input type="search" id="fQ" placeholder="例: 統合 チェックリスト / 管理医師" aria-label="キーワードで絞り込む">
      <label class="flabel" for="fSort" style="min-width:auto">並び順</label>
      <select id="fSort" aria-label="並び替え">
        <option value="reco">おすすめ順</option>
        <option value="new">新着順</option>
        <option value="upd">更新順</option>
        <option value="price">価格が安い順</option>
      </select>
    </div>
    <details class="fmore">
      <summary>くわしい条件(対象者・形式・業務フェーズ)</summary>
      <div class="frow" style="margin-top:10px">
        <label class="flabel" for="f-role">対象者</label>
        <select id="f-role"><option value="">指定しない</option>${ROLES.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select>
        <label class="flabel" for="f-format">形式</label>
        <select id="f-format"><option value="">指定しない</option>${FORMATS.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select>
        <label class="flabel" for="f-phase">フェーズ</label>
        <select id="f-phase"><option value="">指定しない</option>${PHASES.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select>
      </div>
    </details>
  </div>
  <noscript><p style="font-size:12px;color:var(--ink-3);margin-bottom:12px">絞り込みにはJavaScriptが必要です。一覧はこのままご覧いただけます。</p></noscript>
  <div class="grid c2" id="tplList">
    ${tpls.map((t) => tplCard(t, root)).join('\n    ')}
  </div>
  <div class="empty" id="fEmpty" hidden>
    <div class="t">条件に合うテンプレートが見つかりませんでした</div>
    条件を減らすか、キーワードを短くしてみてください。お探しの資料がなければ<a href="${root}../community/index.html" style="text-decoration:underline">リクエスト</a>も歓迎です。
  </div>
  <section id="artResults" hidden style="margin-top:30px">
    <div class="related" style="border-top:1px solid var(--line-soft);padding-top:24px"><div class="h">記事の検索結果</div><div class="grid c2"></div></div>
  </section>
  <p style="font-size:12px;color:var(--ink-3);margin:26px 0 40px">${paidTpls.length ? `有料テンプレートは現在「${esc(paidTpls[0].title)}」の1本です。管理医師変更・電子カルテ移行などのパックを順次追加していきます。` : '現在公開しているのはすべて無料テンプレートです。案件全体を管理する有料の実務パックは、資料を整えてから公開します。'}</p>
</div>`;

  out('templates/index.html', page({
    path: 'templates/index.html',
    title: 'テンプレート一覧',
    description: '医療管理職向けの実務テンプレート一覧。クリニック統合・管理医師変更・採用・業務分担などのチェックリスト・WBS・文例を、テーマ・対象者・形式で絞り込めます。',
    pageId: 'templates',
    event: E.VIEW_TEMPLATE,
    body,
    ld: [breadcrumbLd([['テンプレート', 'templates/index.html']])],
  }));
}

/* ================================================================
   テンプレート詳細
   ================================================================ */
for (const t of tpls) {
  const root = '../../';
  const path = `templates/${t.slug}/index.html`;
  const crumb = [['テンプレート', 'templates/index.html'], [t.shortTitle || t.title, null]];
  const metaBar = `
  <div class="meta-bar">
    ${t.version ? `<span>バージョン <b>${esc(t.version)}</b></span>` : ''}
    <span>公開 <b>${dateJp(t.publishedAt)}</b></span>
    <span>更新 <b>${dateJp(t.updatedAt)}</b></span>
    ${t.effectiveDate ? `<span>制度基準日 <b>${dateJp(t.effectiveDate)}</b></span>` : ''}
  </div>`;
  const sideMeta = `
    <div class="side-box">
      <div class="h">この資料について</div>
      <dl>
        <dt>テーマ</dt><dd>${esc(catName(t.categoryId))}</dd>
        <dt>対象</dt><dd>${(t.targetRoles || []).map((r) => esc((ROLES.find((x) => x.id === r) || {}).label || r)).join('、')}</dd>
        <dt>形式</dt><dd>${(t.formats || []).map((f) => esc(formatLabel(f))).join('、')}</dd>
        ${t.includedFiles ? `<dt>ファイル数</dt><dd>${t.includedFiles.length}ファイル</dd>` : ''}
        ${t.estimatedTime ? `<dt>所要時間</dt><dd>${esc(t.estimatedTime)}</dd>` : ''}
      </dl>
    </div>`;

  let main = '';
  let side = '';
  let ld;
  let hasSticky = false;
  let extra = '';

  if (t.isFree) {
    main = `
    <div class="prose">
      <p>${esc(t.description)}</p>
      ${contentHtml(t)}
      ${t.reviewNote ? `<div class="notice"><div class="h">確認のお願い</div>${esc(t.reviewNote)}</div>` : ''}
    </div>`;
    side = `
    <div class="buy-card">
      <span class="badge free" style="align-self:flex-start">無料</span>
      <p class="note">この資料は登録なしで使えます。内容をコピーし、自院用に編集してください。Excel・Word版のダウンロード提供は準備中です。</p>
      ${(t.relatedTemplateIds || []).map(tplById).filter((x) => x && !x.isFree).slice(0, 1).map((x) =>
        `<a class="btn primary" href="${root}templates/${x.slug}/index.html">有料版: ${esc(x.shortTitle)}を見る</a>`).join('')}
      <a class="btn ghost" href="${root}templates/index.html">他のテンプレートを探す</a>
    </div>
    ${sideMeta}`;
    ld = {
      '@context': 'https://schema.org', '@type': 'CreativeWork',
      name: t.title, description: t.summary, inLanguage: 'ja',
      isAccessibleForFree: true, datePublished: t.publishedAt, dateModified: t.updatedAt,
      author: { '@type': 'Person', name: '橋本渉' },
      url: SITE.baseUrl + path.replace(/index\.html$/, ''),
    };
  } else {
    const p = SITE.pricing.flagship;
    hasSticky = true;
    main = `
    <div class="prose">
      <p>${esc(t.description)}</p>
      <h2 id="problems">こんな状況のときに</h2>
      <ul>${(t.problems || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h2 id="outcomes">この資料でできること</h2>
      <ul>${(t.outcomes || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h2 id="limitations">解決できないこと</h2>
      <ul>${(t.limitations || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h2 id="files">含まれるファイル(全${t.includedFiles.length}点)</h2>
      <ul class="files">
        ${t.includedFiles.map((f, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="fn">${esc(f.name)}</span><span class="fp">${esc(f.purpose)}</span><span class="chip">${esc(f.format)}</span></li>`).join('\n        ')}
      </ul>
      <h2 id="sample">サンプル</h2>
      <div class="sample-table">
        <div class="cap">${esc(t.sample.title)} — ${esc(t.sample.note)}</div>
        <div class="scroll"><table>
          <thead><tr>${t.sample.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${t.sample.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n          ')}</tbody>
        </table></div>
      </div>
      <h2 id="usage">使い方</h2>
      <ol>${t.usageSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <h2 id="inputs">導入前に準備する情報</h2>
      <ul>${t.requiredInputs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <h2 id="faq">よくある質問</h2>
      <div class="faq">
        ${t.faq.map((f) => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('\n        ')}
      </div>
      <h2 id="license">利用条件</h2>
      <ul>
        <li>利用範囲: ${esc(t.license.scope)}</li>
        <li>再配布・転売: できません</li>
        <li>商用利用: ${esc(t.license.commercial)}</li>
      </ul>
      <div class="notice"><div class="h">確認のお願い</div>${esc(t.reviewNote)} テンプレートに患者情報・個人情報を記入する場合は、自院の情報管理規程に従い、外部への共有時は該当箇所を削除してください。</div>
    </div>`;
    side = `
    <div class="buy-card">
      <span><span class="badge paid">有料</span> <span class="badge prep">決済準備中</span></span>
      <div>
        <div class="price-was">通常価格 <s>${fmtPrice(p.list)}</s></div>
        <div class="price-now">${fmtPrice(p.launch)} <small>税込・初期価格</small></div>
      </div>
      <button class="btn primary" data-buy="${t.id}">購入方法を問い合わせる</button>
      <a class="btn ghost" href="#sample">サンプルを確認する</a>
      <p class="note">オンライン決済は現在準備中です。先行して利用したい場合は、お問い合わせから連絡してください。個別に案内します。</p>
    </div>
    ${sideMeta}`;
    extra = `
<div class="sticky-cta">
  <span class="p">${fmtPrice(p.launch)} <span style="font-weight:500;color:var(--ink-3)">税込</span></span>
  <a class="btn ghost small" href="#sample">サンプル</a>
  <button class="btn primary small" data-buy="${t.id}">購入を問い合わせる</button>
</div>
<dialog class="mo-dialog" id="buyDialog" aria-labelledby="buyDialogTitle">
  <div class="dh"><span id="buyDialogTitle">オンライン決済は準備中です</span><button data-close aria-label="閉じる">✕</button></div>
  <div class="db">
    <p>この資料の内容は確定していますが、オンライン決済の仕組みをまだ用意できていません。</p>
    <p>先行して利用したい場合は、お問い合わせからその旨を送ってください。提供方法と支払い方法を個別に案内します。販売開始の告知は${esc(SITE.parent.name)}のnote・Xで行います。</p>
  </div>
  <div class="df">
    <a class="btn primary small" href="${root}../community/index.html">お問い合わせへ</a>
    <a class="btn ghost small" href="${SITE.parent.note}" target="_blank" rel="noopener noreferrer">noteを見る ↗</a>
  </div>
</dialog>`;
    ld = {
      '@context': 'https://schema.org', '@type': 'CreativeWork',
      name: t.title, description: t.summary, inLanguage: 'ja',
      isAccessibleForFree: false, datePublished: t.publishedAt, dateModified: t.updatedAt,
      author: { '@type': 'Person', name: '橋本渉' },
      url: SITE.baseUrl + path.replace(/index\.html$/, ''),
      /* 決済開始前のため Offer(価格)の構造化データは載せない */
    };
  }

  const body = `
${breadcrumbs(root, crumb)}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:0">
  <p>${t.isFree ? '<span class="badge free">無料</span>' : '<span class="badge paid">有料</span> <span class="badge prep">決済準備中</span>'} <span class="badge cat">${esc(catName(t.categoryId))}</span></p>
  <h1>${esc(t.title)}</h1>
  <p class="lead">${esc(t.summary)}</p>
  ${metaBar}
</div>
<div class="wrap detail">
  <div>${main}</div>
  <aside class="detail-side" aria-label="購入と資料情報">${side}</aside>
</div>
${relatedSection(root, (t.relatedTemplateIds || []).filter((id) => id !== t.id), t.relatedArticleIds)}
${extra}`;

  out(path, page({
    path,
    title: t.title,
    description: t.summary + (t.isFree ? ' 無料で使えます。' : ''),
    pageId: 'templates',
    event: E.VIEW_TEMPLATE,
    body,
    hasSticky,
    ld: [ld, breadcrumbLd([['テンプレート', 'templates/index.html'], [t.title, path]])],
  }));
}

/* ================================================================
   記事一覧
   ================================================================ */
{
  const root = '../';
  const cats = CATEGORIES.filter((c) => arts.some((a) => a.categoryId === c.id));
  const body = `
${breadcrumbs(root, [['記事', null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:6px">
  <p class="eyebrow">Articles</p>
  <h1>記事一覧</h1>
  <p class="lead">実務の進め方を、結論と確認先から書いています。読み終えたときに次の行動が決まる構成を目指しています。</p>
</div>
<div class="wrap">
  <div class="filters"><div class="frow">
    <span class="flabel">テーマ</span>
    <button class="fchip" data-acat="all" aria-pressed="true">すべて</button>
    ${cats.map((c) => `<button class="fchip" data-acat="${c.id}" aria-pressed="false">${esc(c.short)}</button>`).join('')}
  </div></div>
  <div class="grid c2" id="artList">
    ${arts.map((a) => artCard(a, root)).join('\n    ')}
  </div>
  <div class="empty" id="aEmpty" hidden>
    <div class="t">このテーマの記事はまだありません</div>
    順次追加していきます。<a href="${root}templates/index.html" style="text-decoration:underline">テンプレート一覧</a>もあわせてご覧ください。
  </div>
</div>`;
  out('articles/index.html', page({
    path: 'articles/index.html',
    title: '記事一覧',
    description: '医療管理職向けの実務記事一覧。クリニック統合・管理医師変更・電子カルテ移行・新任事務長の初動などを、結論と確認先から解説します。',
    pageId: 'articles',
    event: E.VIEW_ARTICLE,
    body,
    ld: [breadcrumbLd([['記事', 'articles/index.html']])],
  }));
}

/* ================================================================
   記事詳細
   ================================================================ */
for (const a of arts) {
  const root = '../../';
  const path = `articles/${a.slug}/index.html`;
  const toc = a.body.map((s, i) => `<li><a href="#sec-${i + 1}">${esc(s.h)}</a></li>`).join('');
  const body = `
${breadcrumbs(root, [['記事', 'articles/index.html'], [a.title, null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:0">
  <p><span class="badge cat">${esc(catName(a.categoryId))}</span> ${(a.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join(' ')}</p>
  <h1>${esc(a.title)}</h1>
  <div class="meta-bar">
    <span>公開 <b>${dateJp(a.publishedAt)}</b></span>
    <span>更新 <b>${dateJp(a.updatedAt)}</b></span>
    ${a.effectiveDate ? `<span>制度基準日 <b>${dateJp(a.effectiveDate)}</b></span>` : ''}
    <span>執筆 <b>${esc(a.author)}</b></span>
  </div>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div class="text-wrap">
    <div class="lead-box">
      <div class="h">この記事で分かること</div>
      <ul>${a.lead.learn.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <div class="h">このような方向け</div>
      <p>${esc(a.lead.audience)}</p>
    </div>
    <nav class="toc" aria-label="目次">
      <div class="h">目次</div>
      <ol>${toc}</ol>
    </nav>
    <div class="prose">
      ${a.body.map((s, i) => `<h2 id="sec-${i + 1}">${esc(s.h)}</h2>\n${s.html}`).join('\n      ')}
      <div class="notice"><div class="h">注意事項</div>${esc(a.legalNotice)}</div>
    </div>
  </div>
</div>
${relatedSection(root, a.relatedTemplateIds, a.relatedArticleIds)}`;
  out(path, page({
    path,
    title: a.seoTitle || a.title,
    description: a.seoDescription || a.description,
    pageId: 'articles',
    event: E.VIEW_ARTICLE,
    body,
    ld: [{
      '@context': 'https://schema.org', '@type': 'Article',
      headline: a.title, description: a.description, inLanguage: 'ja',
      datePublished: a.publishedAt, dateModified: a.updatedAt,
      author: { '@type': 'Person', name: '橋本渉' },
      publisher: { '@type': 'Organization', name: SITE.parent.name },
      mainEntityOfPage: SITE.baseUrl + path.replace(/index\.html$/, ''),
    }, breadcrumbLd([['記事', 'articles/index.html'], [a.title, path]])],
  }));
}

/* ================================================================
   カテゴリ詳細(公開コンテンツのあるカテゴリのみ生成 — 第14条)
   ================================================================ */
for (const c of CATEGORIES) {
  if (catCount(c.id) === 0) continue;
  const root = '../../';
  const path = `categories/${c.slug}/index.html`;
  const ct = tpls.filter((t) => t.categoryId === c.id);
  const ca = arts.filter((a) => a.categoryId === c.id);
  const others = CATEGORIES.filter((x) => x.id !== c.id && catCount(x.id) > 0);
  const body = `
${breadcrumbs(root, [['実務テーマ', 'index.html#themes'], [c.name, null]])}
<div class="wrap page-head">
  <p class="eyebrow">Theme</p>
  <h1>${esc(c.name)}</h1>
  <p class="lead">${esc(c.description)}</p>
</div>
<div class="wrap">
  <section class="sec" style="padding-top:30px">
    <h2 class="sec-h" style="font-size:17px">このテーマでよくある困りごと</h2>
    <div class="rows text-wrap" style="margin-top:14px">
      ${c.pains.map((p, i) => `<div class="row"><span class="m">${String(i + 1).padStart(2, '0')}</span><span class="b">${esc(p)}</span></div>`).join('\n      ')}
    </div>
    <p style="margin-top:14px;font-size:12px;color:var(--ink-3)">扱う範囲: ${c.subThemes.map((s) => `<span class="chip">${esc(s)}</span>`).join(' ')}</p>
  </section>
  ${ct.length ? `
  <section class="sec" style="padding-top:0">
    <h2 class="sec-h" style="font-size:17px">テンプレート</h2>
    <div class="grid c2" style="margin-top:14px">${ct.map((t) => tplCard(t, root)).join('')}</div>
  </section>` : ''}
  ${ca.length ? `
  <section class="sec" style="padding-top:0">
    <h2 class="sec-h" style="font-size:17px">記事</h2>
    <div class="grid c2" style="margin-top:14px">${ca.map((a) => artCard(a, root)).join('')}</div>
  </section>` : ''}
  ${c.faq && c.faq.length ? `
  <section class="sec" style="padding-top:0">
    <h2 class="sec-h" style="font-size:17px">よくある質問</h2>
    <div class="faq text-wrap" style="margin-top:8px">
      ${c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('\n      ')}
    </div>
  </section>` : ''}
  <section class="sec" style="padding-top:0">
    <h2 class="sec-h" style="font-size:17px">ほかの実務テーマ</h2>
    <p style="margin-top:10px;font-size:13px">${others.map((o) => `<a class="fchip" style="display:inline-flex;margin:3px 4px 3px 0" href="${root}categories/${o.slug}/index.html">${esc(o.short)}</a>`).join('')}</p>
  </section>
</div>`;
  out(path, page({
    path,
    title: c.name,
    description: c.description,
    pageId: 'templates',
    event: E.VIEW_CATEGORY,
    body,
    ld: [
      breadcrumbLd([[c.name, path]]),
      c.faq && c.faq.length ? {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      } : null,
    ],
  }));
}

/* ================================================================
   初めての方へ
   ================================================================ */
{
  const root = '../';
  const body = `
${breadcrumbs(root, [['初めての方へ', null]])}
<div class="wrap page-head">
  <p class="eyebrow">Guide</p>
  <h1>初めての方へ</h1>
  <p class="lead">このサイトでできること・できないことと、資料の探し方をまとめています。</p>
</div>
<div class="wrap text-wrap prose" style="padding-bottom:50px">
  <h2>このサイトでできること</h2>
  <ul>
    <li>クリニック統合・管理医師変更・採用・業務分担など、医療管理職の実務の進め方を記事で確認する</li>
    <li>チェックリスト・ヒアリングシート・問い合わせ文例などの無料テンプレートを、そのままコピーして使う</li>
    <li>実務テーマごとに、記事とテンプレートを行き来しながら段取りを組む</li>
  </ul>
  <h2>できないこと</h2>
  <ul>
    <li>法的・行政的な判断の代行。届出の要否や要件の最終確認は、所管の保健所・厚生局・自治体・専門家に確認してください</li>
    <li>行政への提出書類そのものの提供。テンプレートは検討・管理用の資料で、公式様式は各窓口で入手してください</li>
    <li>個別コンサルティング。相談したい場合は<a href="${root}../services/index.html">${esc(SITE.parent.name)}の仕事のご依頼</a>をご覧ください</li>
  </ul>
  <h2>どのような人向けか</h2>
  <p>訪問診療クリニックの事務長・事務長補佐、医療法人本部のスタッフ、看護師長・リハビリ部門責任者などの新任管理職を想定しています。医療職出身で管理業務を体系的に学んでいない方が、迷わず進められることを優先しています。</p>
  <h2>資料の探し方</h2>
  <ol>
    <li><strong>状況が決まっている場合</strong> — トップページの「実務テーマから探す」で、いまの状況に近いテーマを選んでください。</li>
    <li><strong>資料の種類で探す場合</strong> — <a href="${root}templates/index.html">テンプレート一覧</a>で、対象者・形式・無料/有料で絞り込めます。</li>
    <li><strong>キーワードで探す場合</strong> — 上部の検索窓に「統合 チェックリスト」「管理医師」のように入力してください。テンプレートと記事を横断して探せます。</li>
  </ol>
  <h2>無料と有料の違い</h2>
  <p>無料テンプレートは、初動のチェックリスト・確認先一覧・文例など、まず動き出すための資料です。ページ上でそのまま使えます。${paidTpls.length
    ? '有料パックは、案件全体を管理するためのWBS・確認シート・文例を一式にしたもので、Excel・Wordファイルで提供します。オンライン決済は準備中のため、当面は<a href="' + root + '../community/index.html">お問い合わせ</a>から個別に案内します。'
    : '案件全体を管理する有料の実務パック(WBS・確認シート・文例の一式)は準備中です。公開時は' + esc(SITE.parent.name) + 'のnote・Xで告知します。'}会員プランの構想は<a href="${root}pricing/index.html">プランのページ</a>にまとめています。</p>
  <h2>テンプレートの使い方</h2>
  <ol>
    <li>関連する記事で全体像と確認先を確認する</li>
    <li>テンプレートをコピーし、日付・担当者・自院の状況に書き換える</li>
    <li>不明な欄は空欄のまま残し、「誰に確認するか」をメモする(空欄が確認タスクになります)</li>
  </ol>
  <h2>個別判断が必要な場合</h2>
  <p>行政手続きの要否・期限・様式は、自治体や厚生局によって取り扱いが異なることがあります。届出・労務・契約・税務に関わる判断は、必ず所管窓口または専門家(弁護士・社会保険労務士・税理士など)に確認してください。</p>
  <h2>AIを使うときの情報管理</h2>
  <p>テンプレートの内容を生成AIと組み合わせて使う場合は、患者情報・職員の個人情報・機微な経営情報を入力しないでください。施設名や個人名を伏せ、状況を抽象化してから使うのが原則です。自院でAI利用のルールがある場合はそちらに従ってください。</p>
</div>`;
  out('guide/index.html', page({
    path: 'guide/index.html',
    title: '初めての方へ',
    description: SITE.name + 'の使い方。できること・できないこと、無料と有料の違い、テンプレートの探し方と編集のしかたをまとめています。',
    pageId: 'guide',
    body,
    ld: [breadcrumbLd([['初めての方へ', 'guide/index.html']])],
  }));
}

/* ================================================================
   料金・プラン(ナビ非掲載。テンプレ詳細・ガイドからの導線のみ)
   ================================================================ */
{
  const root = '../';
  const plans = SITE.pricing.plans;
  const body = `
${breadcrumbs(root, [['プランと料金', null]])}
<div class="wrap page-head">
  <p class="eyebrow">Pricing</p>
  <h1>プランと料金の考え方</h1>
  <p class="lead">${paidTpls.length ? '現在は無料コンテンツと有料テンプレートの単品販売(決済準備中)のみです。' : '現在公開しているのは無料コンテンツのみです。有料テンプレートの単品販売と'}会員プランは構想段階のため、内容と価格は変わる可能性があります。</p>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div class="plans" style="margin-top:10px">
    ${plans.map((p) => `
    <div class="plan${p.id === 'personal' ? ' hl' : ''}">
      <div class="pn">${esc(p.name)}</div>
      <div class="pp">${p.price === 0 ? '0円' : fmtPrice(p.price) + `<small> / ${esc(p.unit)}</small>`}</div>
      ${p.yearly ? `<div style="font-size:11.5px;color:var(--ink-3)">年払い ${fmtPrice(p.yearly)}(想定)</div>` : ''}
      <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <p class="note">${esc(p.note)}</p>
    </div>`).join('')}
  </div>
  <div class="text-wrap" style="margin-top:30px">
    <div class="notice">
      <div class="h">会員プランは準備中です</div>
      いま使える資料は、${paidTpls.length ? `無料テンプレートと有料パック(<a href="${root}templates/${paidTpls[0].slug}/index.html" style="text-decoration:underline">${esc(paidTpls[0].shortTitle)}</a>)` : `<a href="${root}templates/index.html" style="text-decoration:underline">無料テンプレート</a>`}です。会員プランの開始時期・確定価格は、決まり次第このページと${esc(SITE.parent.name)}のnote・Xで告知します。先行して法人利用を相談したい場合は<a href="${root}../community/index.html" style="text-decoration:underline">お問い合わせ</a>からどうぞ。
    </div>
  </div>
</div>`;
  out('pricing/index.html', page({
    path: 'pricing/index.html',
    title: 'プランと料金',
    description: SITE.name + 'の料金の考え方。無料コンテンツ、有料テンプレートの単品販売、準備中の個人・法人会員プランについて説明します。',
    pageId: '',
    event: E.VIEW_PRICING,
    body,
    ld: [breadcrumbLd([['プランと料金', 'pricing/index.html']])],
  }));
}

/* ================================================================
   運営者について
   ================================================================ */
{
  const root = '../';
  const exps = [
    ['医療現場', '理学療法士として病院で臨床・チームマネジメント・教育を経験。現場の業務がどう回っているかを、中から知っています。'],
    ['医療機関の経営支援', '訪問診療クリニックの経営支援、業務改善、事務長・看護師・医師・リハビリ職の業務整理に携わっています。'],
    ['クリニック統合・PMI', 'クリニック統合や承継の実務支援。行政手続き・職員対応・システム移行を含む段取り全体を扱います。'],
    ['行政手続き・施設基準', '管理医師変更、標榜時間変更、施設基準・診療報酬の整理など、保健所・厚生局への対応を実務として行っています。'],
    ['採用・面接設計', '医師・看護師・医療事務などの採用。求人票の設計、面接評価、採用フローの整理を担当しています。'],
    ['システム移行', '電子カルテ・ORCA・レセプトの移行管理。ベンダー調整と現場の運用設計の間をつなぐ役回りです。'],
  ];
  const body = `
${breadcrumbs(root, [['運営者について', null]])}
<div class="wrap page-head">
  <p class="eyebrow">About</p>
  <h1>運営者について</h1>
  <p class="lead">${esc(SITE.name)}は、${esc(SITE.parent.name)}(運営: 橋本渉)が個人で運営しています。</p>
</div>
<div class="wrap text-wrap" style="padding-bottom:50px">
  <div class="prose">
    <p>私は理学療法士として病院で働いたあと、いまは医療機関の経営支援を仕事にしています。クリニックの統合、管理医師の変更、採用、電子カルテの移行——このサイトで扱っているのは、私が日々の仕事で実際に段取りしている業務です。</p>
    <h2>経験している領域</h2>
  </div>
  <div class="rows" style="margin:14px 0 26px">
    ${exps.map(([t, d]) => `<div class="row" style="flex-direction:column;gap:3px"><span style="font-weight:700;font-size:13.5px">${esc(t)}</span><span class="b" style="font-size:12.5px">${esc(d)}</span></div>`).join('\n    ')}
  </div>
  <div class="prose">
    <h2>このサイトを作った理由</h2>
    <p>医療の管理業務には、制度の解説はたくさんあるのに、「では明日、誰が何をするのか」に落とした資料がほとんどありません。統合を任された事務長が検索して見つかるのは制度の説明ばかりで、WBSやチェックリストは出てきません。結局、みんなExcelをゼロから作っています。</p>
    <p>私自身、支援先で同じ資料を何度も作り直してきました。その資料を、同じ場面で困っている人がそのまま使える形に整えて公開する。それがこのサイトです。</p>
    <h2>AIの使い方について</h2>
    <p>資料の作成に生成AIも使っています。ただし、AIの出力は一般論になりやすく、そのままでは現場で使えません。項目を現場で使う単位に削り、確認先と期限を足し、実際の案件で通用した粒度に直してから公開しています。</p>
    <h2>${esc(SITE.parent.name)}について</h2>
    <p>${esc(SITE.parent.name)}は「人が、自ら選び、納得して生きられる社会をつくる」ための個人プロジェクトです。このサイトはその道具のひとつで、医療管理職が自分で段取りを組み、納得して進められる状態をつくることを目指しています。<a href="${root}../about/index.html">プロジェクト全体について</a>もご覧ください。</p>
  </div>
</div>`;
  out('about/index.html', page({
    path: 'about/index.html',
    title: '運営者について',
    description: SITE.name + 'の運営者について。理学療法士としての医療現場経験と、クリニック統合・行政手続き・採用・電子カルテ移行などの経営支援実務をもとに資料を作っています。',
    pageId: 'about',
    body,
    ld: [breadcrumbLd([['運営者について', 'about/index.html']])],
  }));
}

/* ================================================================
   よくある質問
   ================================================================ */
{
  const root = '../';
  const faqs = [
    ['テンプレートは編集できますか', 'できます。むしろ編集して使う前提です。チェックリストや文例はコピーして、自院の日付・担当者・状況に書き換えてください。'],
    ['ExcelやWordがなくても使えますか', '無料テンプレートはWebページ上でそのまま読め、テキストとしてコピーできます。有料パックとして提供するファイルはExcel・Word形式の予定ですが、GoogleスプレッドシートやGoogleドキュメントに取り込んで使えます。'],
    ['行政への提出書類そのものですか', '違います。このサイトの資料は、検討・管理・確認のための実務資料です。届出の公式様式は所管の保健所・厚生局・自治体で入手してください。'],
    ['内容は法的判断を保証しますか', '保証しません。一般的な進め方の整理であり、個別案件の要否・要件は所管窓口や専門家への確認が必要です。資料には確認先を明記するようにしています。'],
    ['最新の制度に対応していますか', '各資料に「制度基準日」を明記しています。制度変更があった場合は内容を見直し、更新日を記録します。基準日が古い資料は、利用前に最新の取り扱いを確認してください。'],
    ['購入後に更新版は利用できますか', 'その方針です。同一バージョン系列の更新版は追加費用なしで提供する予定です。具体的な提供方法は販売開始時に案内します。'],
    ['テンプレートを法人内で共有できますか', '無料テンプレートは院内・法人内で自由に共有できます。今後販売する有料パックは、1法人内での共有・複数拠点での利用を想定しています。いずれも法人外への配布・転売はできません。'],
    ['再配布はできますか', 'できません。購入者の法人内利用に限ります。SNSやブログへの転載もご遠慮ください(記事へのリンクは歓迎です)。'],
    ['返金はできますか', 'デジタル資料の性質上、提供後の返金は原則お受けしない方針です。有料テンプレートの販売開始時に、サンプルと「解決できないこと」を購入前に確認できるようにし、正式な返金条件を利用規約に明記します。'],
    ['法人契約はできますか', '法人会員プランを準備中です。先行して相談したい場合はお問い合わせからご連絡ください。'],
    ['テンプレートに患者情報を入力してもよいですか', '自院の管理下で使う分には自院の情報管理規程に従ってください。外部に共有する場合や、生成AIに入力する場合は、患者情報・個人情報を必ず除いてください。'],
    ['コンサルティングは受けられますか', 'このサイト自体は資料の提供サービスですが、運営者は医療機関の経営支援を本業としています。個別支援の相談は' + SITE.parent.name + 'の「仕事のご依頼」からどうぞ。'],
  ];
  const body = `
${breadcrumbs(root, [['よくある質問', null]])}
<div class="wrap page-head">
  <p class="eyebrow">FAQ</p>
  <h1>よくある質問</h1>
</div>
<div class="wrap text-wrap" style="padding-bottom:50px">
  <div class="faq">
    ${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><div class="a">${esc(a)}</div></details>`).join('\n    ')}
  </div>
  <p style="margin-top:22px;font-size:13px">解決しない場合は<a href="${root}../community/index.html" style="text-decoration:underline">お問い合わせ</a>からご連絡ください。</p>
</div>`;
  out('faq/index.html', page({
    path: 'faq/index.html',
    title: 'よくある質問',
    description: SITE.name + 'のよくある質問。テンプレートの編集・法人内共有・制度対応・返金・再配布の可否などをまとめています。',
    pageId: 'faq',
    body,
    ld: [breadcrumbLd([['よくある質問', 'faq/index.html']]), {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    }],
  }));
}

/* ================================================================
   法務ページ(利用規約 / プライバシー / 免責)
   特定商取引法に基づく表記は決済開始時に必須(台帳のnote参照)。
   ================================================================ */
const legalPage = (file, title, description, bodyHtml) => {
  const root = '../';
  out(`legal/${file}`, page({
    path: `legal/${file}`,
    title,
    description,
    pageId: '',
    body: `
${breadcrumbs(root, [[title, null]])}
<div class="wrap page-head"><p class="eyebrow">Legal</p><h1>${esc(title)}</h1></div>
<div class="wrap text-wrap prose" style="padding-bottom:50px">
<!-- 仮文面。本番公開(決済開始)前に弁護士等の専門家確認が必要 -->
${bodyHtml}
<p style="font-size:12px;color:var(--ink-3)">制定日: 2026年7月18日</p>
</div>`,
    ld: [breadcrumbLd([[title, `legal/${file}`]])],
  }));
};

legalPage('terms.html', '利用規約',
  SITE.name + 'の利用規約。コンテンツの利用条件、禁止事項、免責について定めています。', `
<p>この利用規約(以下「本規約」)は、${esc(SITE.parent.name)}(以下「当方」)が提供する「${esc(SITE.name)}」(以下「本サービス」)の利用条件を定めるものです。本サービスを利用した時点で、本規約に同意したものとみなします。</p>
<h2>第1条(本サービスの内容)</h2>
<p>本サービスは、医療機関の管理業務に関する記事・テンプレート等の資料を提供するものです。資料は一般的な実務の整理であり、法的・医療的・行政的な判断を提供するものではありません。</p>
<h2>第2条(知的財産権と利用範囲)</h2>
<ul>
<li>本サービスのコンテンツの著作権は当方に帰属します。</li>
<li>無料テンプレートは、利用者の所属する施設・法人内での業務利用の範囲で、複製・編集して利用できます。</li>
<li>有料テンプレートは、購入した法人(個人購入の場合は購入者の所属施設)内での業務利用の範囲で、複製・編集して利用できます。</li>
<li>形式を問わず、第三者への再配布・転売・公衆送信(SNS・ブログ等への転載を含む)はできません。</li>
</ul>
<h2>第3条(禁止事項)</h2>
<ul>
<li>コンテンツの再配布・転売・翻案物の販売</li>
<li>本サービスの運営を妨害する行為</li>
<li>法令または公序良俗に反する利用</li>
</ul>
<h2>第4条(有料コンテンツ)</h2>
<p>有料コンテンツの価格・提供方法・返金条件は、各商品ページおよび決済時の案内に定めます。オンライン決済の開始時に、特定商取引法に基づく表記を本サービス上に掲載します。</p>
<h2>第5条(免責)</h2>
<p>当方は、コンテンツの正確性・最新性・特定目的への適合性を保証しません。コンテンツの利用により生じた損害について、当方は故意または重過失がある場合を除き責任を負いません。くわしくは<a href="disclaimer.html">免責事項</a>をご覧ください。</p>
<h2>第6条(規約の変更)</h2>
<p>本規約は必要に応じて変更することがあります。重要な変更は本サービス上で告知します。</p>`);

legalPage('privacy.html', 'プライバシーポリシー',
  SITE.name + 'のプライバシーポリシー。取得する情報と利用目的について定めています。', `
<p>${esc(SITE.parent.name)}(以下「当方」)は、「${esc(SITE.name)}」(以下「本サービス」)における利用者の情報を、次のとおり取り扱います。</p>
<h2>1. 現在取得している情報</h2>
<ul>
<li><strong>表示設定(ライト/ダークテーマ等)</strong> — お使いの端末のローカルストレージにのみ保存され、外部には送信されません。</li>
<li><strong>お問い合わせ内容</strong> — お問い合わせは${esc(SITE.parent.name)}の窓口を通じて受け付け、回答のためにのみ利用します。</li>
</ul>
<p>本サービスは現時点で、アクセス解析ツール・広告配信・会員登録の仕組みを導入していません。</p>
<h2>2. 今後導入する場合の方針</h2>
<p>アクセス解析・会員機能・決済を導入する場合は、取得する情報・利用目的・委託先を本ポリシーに追記してから運用を開始します。</p>
<h2>3. 利用者への注意</h2>
<p>テンプレートを編集して利用する際、患者情報・職員の個人情報を含む資料を本サービスに送信する必要はありません。生成AIと組み合わせて利用する場合は、個人情報を入力しないでください。</p>
<h2>4. お問い合わせ</h2>
<p>本ポリシーに関する連絡は、<a href="../../community/index.html">${esc(SITE.parent.name)}のお問い合わせ</a>からお願いします。</p>`);

legalPage('disclaimer.html', '免責事項',
  SITE.name + 'の免責事項。情報の性質と、利用にあたって確認が必要な事項をまとめています。', `
<h2>1. 情報の性質</h2>
<p>本サービスの記事・テンプレートは、医療機関の管理業務に関する一般的な進め方を整理したものです。法的助言・医学的助言・行政手続きの代行ではなく、内容の正確性・完全性・最新性を保証するものでもありません。</p>
<h2>2. 個別案件の確認</h2>
<p>行政手続きの要否・期限・様式は、自治体・厚生局によって取り扱いが異なる場合があります。個別の案件については、必ず所管の保健所・厚生局・自治体、または弁護士・社会保険労務士・税理士等の専門家に確認してください。</p>
<h2>3. 制度の変更</h2>
<p>診療報酬・施設基準・各種手続きは改定されます。各資料には制度基準日を明記していますが、利用時点の制度と異なる場合があります。</p>
<h2>4. テンプレートの利用</h2>
<p>テンプレートは編集して利用する前提のひな形です。利用の結果について、当方は故意または重過失がある場合を除き責任を負いません。</p>
<h2>5. 生成AIの利用について</h2>
<p>本サービスの資料を生成AIと組み合わせて利用する場合、患者情報・個人情報・機微な経営情報を入力しないでください。入力した情報の取り扱いは各AIサービスの規約に依存します。</p>`);

/* ================================================================
   sitemap.xml のマーカー区間を更新
   ================================================================ */
{
  const sitemapPath = join(repo, 'sitemap.xml');
  let xml = readFileSync(sitemapPath, 'utf8');
  const START = '  <!-- medops:auto:start (scripts/medops/build.mjs が生成。手で編集しない) -->';
  const END = '  <!-- medops:auto:end -->';
  const urls = written
    .filter((p) => p.endsWith('.html'))
    .map((p) => SITE.baseUrl + p.replace(/index\.html$/, ''))
    .map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`)
    .join('\n');
  const block = `${START}\n${urls}\n${END}`;
  if (xml.includes(START)) {
    xml = xml.replace(new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), block);
  } else {
    xml = xml.replace('</urlset>', block + '\n</urlset>');
  }
  writeFileSync(sitemapPath, xml);
}

console.log(`medops: ${written.length}ページを生成しました`);
written.forEach((p) => console.log('  medops/' + p));
console.log('sitemap.xml のmedops区間を更新しました');
