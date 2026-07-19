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

import { SITE, ROLES, SCENES, FREQUENCY, FORMATS, fmtPrice } from '../../medops/data/site.mjs';
import { CATEGORIES } from '../../medops/data/categories.mjs';
import { TEMPLATES, publishedTemplates } from '../../medops/data/templates.mjs';
import { ARTICLES, publishedArticles } from '../../medops/data/articles.mjs';
import { PRODUCT } from '../../medops/data/product.mjs';
import {
  esc, page, breadcrumbs, breadcrumbLd, tplCard, artCard, catCard, contentHtml,
  formatLabel, sceneLabel, freqLabel, catName, catShort, dateJp,
} from './html.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const written = [];
const out = (path, html) => {
  const abs = join(repo, 'medops', path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, html);
  written.push(path);
};

const tpls = publishedTemplates();
const arts = publishedArticles();
const catCount = (id) => tpls.filter((t) => t.categoryId === id).length + arts.filter((a) => a.categoryId === id).length;
const tplById = (id) => tpls.find((t) => t.id === id);
const artById = (id) => arts.find((a) => a.id === id);
const E = SITE.events;
const P = SITE.pricing.recruitPack;
const packAvailable = PRODUCT.status === 'published';

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
   トップページ(実務カテゴリと資料プレビュー中心。管理職訴求は置かない)
   ================================================================ */
{
  const root = '';
  const featured = tpls.filter((t) => t.isFeatured).slice(0, 6);
  const featuredA = arts.filter((a) => a.isFeatured).slice(0, 4);
  const worries = [
    '採用面接の評価表が担当者ごとに違う',
    '退職者のアカウント停止を忘れそうになる',
    '研修記録がどこにあるか分からない',
    '施設基準の更新期限を担当者しか把握していない',
    '行政へ何を聞けばよいか整理できない',
    '医療機器の点検期限を一覧で見られない',
    '返戻対応の進捗が分からない',
    '毎回同じ案内文をゼロから作っている',
  ];
  const features = [
    ['案件ごとに必要な項目が分かる', '業務ごとに確認事項・担当者・期限を整理しています。急に任された業務でも、確認先から始められます。'],
    ['Excel・Wordですぐ使える', '自院の運用に合わせて編集する前提のひな形です。項目を削るのも編集です。'],
    ['確認先を分けて整理できる', '院内・行政・厚生局・ベンダー・業者を分けて管理できます。誰へ聞くかで迷いません。'],
    ['進捗と未対応が見える', '対応済み・確認中・未対応を一覧で管理し、「誰かがやっているはず」をなくします。'],
    ['文例まで用意している', '行政・ベンダー・職員・患者・連携先への連絡文をゼロから作らずに済みます。'],
    ['医療機関の実務に合わせている', '一般企業向けの雛形ではなく、医療機関で実際に発生する業務を前提にしています。'],
  ];
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${esc(SITE.name)}</p>
      <h1>${esc(SITE.tagline)}</h1>
      <p class="sub">${esc(SITE.description)}すべて無料で使えるところから始められます。</p>
      <div class="hero-tags">
        <span>医療機関の実務専用</span><span>チェックリスト・台帳・進捗表・文例</span><span>編集して使う前提</span>
      </div>
      <div class="hero-cta">
        <a class="btn cta" href="#categories">実務カテゴリから探す</a>
        <a class="btn ghost" href="templates/index.html">無料テンプレートを見る</a>
      </div>
      <p style="font-size:11.5px;color:var(--ink-3);margin-top:12px">登録不要・無料ですぐ使えます</p>
    </div>
    <div class="hero-minis" aria-label="実務資料の例">
      <div class="mini">
        <div class="mt">退職時対応チェックリスト</div>
        <ul>
          <li><span class="bx on" aria-hidden="true"></span><span>カルテ停止をベンダーへ予約</span></li>
          <li><span class="bx on" aria-hidden="true"></span><span>鍵・カードの回収</span></li>
          <li><span class="bx" aria-hidden="true"></span><span>翌営業日に停止確認</span></li>
        </ul>
      </div>
      <div class="mini">
        <div class="mt">採用進捗管理表</div>
        <ul>
          <li><span class="st">選考中</span><span>看護師(常勤) 応募3</span></li>
          <li><span class="st">内定</span><span>医療事務 入職6/1</span></li>
          <li><span class="st warn">停滞</span><span>PT 一次から1週間</span></li>
        </ul>
      </div>
      <div class="mini wide">
        <div class="mt">施設基準管理台帳</div>
        <ul>
          <li><span class="st">毎月</span><span>人員要件の確認 — 担当: 事務長</span></li>
          <li><span class="st warn">2か月前</span><span>研修要件の期限 9/30 — 出席簿を確認</span></li>
          <li><span class="st">保管</span><span>根拠資料: 共有/施設基準/2026</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Worries</p>
    <h2 class="sec-h">毎回、前回のExcelを探すところから始めていませんか</h2>
    <div class="rows text-wrap" style="margin-top:22px">
      ${worries.map((w, i) => `<div class="row"><span class="m">${String(i + 1).padStart(2, '0')}</span><span class="b">${esc(w)}</span></div>`).join('\n      ')}
    </div>
    <p class="text-wrap" style="font-size:13.5px;color:var(--ink-2);margin-top:18px;line-height:2">原因は担当者の能力ではなく、業務ごとの確認事項と資料の形式が決まっていないことです。このサイトは、医療機関で繰り返し発生する業務を「何を確認するか・誰へ聞くか・どこまで終わったか」が分かる資料に整理しています。</p>
  </div>
</section>

<section class="sec" id="categories" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Categories</p>
    <h2 class="sec-h">実務カテゴリから探す</h2>
    <div class="grid c3" style="margin-top:22px">
      ${CATEGORIES.map((c) => catCard(c, root, catCount(c.id))).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Free</p>
    <h2 class="sec-h">よく使われる無料テンプレート</h2>
    <p class="sec-lead">すべてページ上でそのまま使えます。コピーして、自院の運用に合わせて書き換えてください。</p>
    <div class="grid c3" style="margin-top:22px">
      ${featured.map((t) => tplCard(t, root)).join('\n      ')}
    </div>
    <p class="sec-more"><a class="btn ghost small" href="templates/index.html">テンプレートをすべて見る</a></p>
  </div>
</section>

${packAvailable ? `
<section class="sec">
  <div class="wrap">
    <div class="pack-band">
      <div>
        <p class="eyebrow">Pack</p>
        <h2>${esc(PRODUCT.title)}</h2>
        <p class="lead">${esc(PRODUCT.heading)}。担当者が替わっても、採用〜入職〜退職を同じ形式で回せます。</p>
        <div class="price-row">
          <span class="now">${fmtPrice(P.list)}</span>
          <span class="tax">税込・買い切り</span>
        </div>
        <div class="chips"><span>収録${PRODUCT.items.length}ファイル</span><span>マスター管理表つき</span><span>記入例・失敗事例集つき</span><span>決済準備中</span></div>
        <p><a class="btn cta" href="pack/index.html">パックの内容を見る</a></p>
      </div>
      <div class="inc">
        <div class="h">収録テンプレート(一部)</div>
        <ul>
          <li>採用要件整理シート・面接評価シート(完全版)</li>
          <li>内定・不採用・辞退対応の連絡文例</li>
          <li>入職前準備チェックリスト・アカウント発行一覧</li>
          <li>退職時対応チェックリスト・停止確認表</li>
          <li>採用・入退職進捗管理表</li>
        </ul>
        <div class="more">など全${PRODUCT.items.length}点。<a href="pack/index.html#files" style="text-decoration:underline;color:var(--band-ink)">収録一覧をすべて見る</a></div>
      </div>
    </div>
  </div>
</section>` : ''}

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Features</p>
    <h2 class="sec-h">このサイトの資料の作り方</h2>
    <div class="grid c3" style="margin-top:22px">
      ${features.map(([t, d]) => `<div class="cat-card" style="cursor:default"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">How to</p>
    <h2 class="sec-h">初めての方へ — 3ステップ</h2>
    <div class="steps" style="margin-top:22px">
      <div class="step"><div class="t">発生した業務のカテゴリを開く</div><div class="d">「急に面接を任された」「退職者が出た」など、いま起きている案件のカテゴリから入ってください。</div></div>
      <div class="step"><div class="t">記事で確認事項をつかむ</div><div class="d">各カテゴリの記事に、確認する項目・確認先・よくある抜け漏れを書いています。</div></div>
      <div class="step"><div class="t">テンプレートを自院用に編集する</div><div class="d">チェックリスト・台帳をコピーし、担当者と期限を自院の内容に書き換えて使ってください。</div></div>
    </div>
    <p class="sec-more"><a href="guide/index.html" class="btn ghost small">使い方をくわしく見る</a></p>
  </div>
</section>

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Articles</p>
    <h2 class="sec-h">実務記事</h2>
    <div class="grid c2" style="margin-top:22px">
      ${featuredA.map((a) => artCard(a, root)).join('\n      ')}
    </div>
    <p class="sec-more"><a class="btn ghost small" href="articles/index.html">記事をすべて見る</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap text-wrap">
    <p class="eyebrow">Author</p>
    <h2 class="sec-h">医療機関の実務の現場で使っている形を、そのまま公開しています</h2>
    <p style="font-size:13.5px;color:var(--ink-2);margin-top:12px;line-height:2">${esc(SITE.operator.background)}このサイトの資料は、支援先の実務で実際に使っている構成をもとにしています。生成AIも使いますが、一般論のまま公開せず、現場で通用した粒度に直してから出しています。<a href="about/index.html" style="text-decoration:underline">運営者について</a></p>
  </div>
</section>

<div class="closing">
  <div class="wrap">
    <p class="stmt">その業務、前回の資料を探すところから<br>始めなくてよくなります</p>
    <div class="hero-cta" style="justify-content:center;margin-top:22px">
      <a class="btn cta" href="#categories">実務カテゴリから探す</a>
      <a class="btn ghost" href="templates/index.html">無料テンプレートを見る</a>
    </div>
  </div>
</div>

<section class="sec" style="padding-top:28px">
  <div class="wrap text-wrap">
    <div class="notice">
      <div class="h">ご利用にあたって</div>
      本サイトの資料は、実務の整理を助けるひな形であり、行政・法律・労務・診療報酬上の最終判断を代替しません。個別の案件は所管の保健所・厚生局・自治体・専門家・ベンダーにご確認ください。制度や地域により対応が異なる場合があります。テンプレートに患者情報・職員の機微情報を記入する際は、自院の規程に従ってください。くわしくは<a href="legal/disclaimer.html" style="text-decoration:underline">免責事項</a>をご覧ください。
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
   テンプレート一覧(実務カテゴリ・利用場面・頻度・対象者で絞り込み)
   ================================================================ */
{
  const root = '../';
  const chip = (fkey, fval, label, pressed) =>
    `<button class="fchip" data-fkey="${fkey}" data-fval="${fval}" aria-pressed="${pressed ? 'true' : 'false'}">${esc(label)}</button>`;
  const usedCats = CATEGORIES.filter((c) => tpls.some((t) => t.categoryId === c.id));
  const body = `
${breadcrumbs(root, [['テンプレート', null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:6px">
  <p class="eyebrow">Templates</p>
  <h1>テンプレート一覧</h1>
  <p class="lead">公開中のテンプレートです。すべて無料で、ページ上でそのまま使えます。${packAvailable ? '採用・入退職の完全版一式はパックにまとめています。' : ''}</p>
</div>
<div class="wrap">
  <div class="filters" aria-label="絞り込み">
    <div class="frow">
      <span class="flabel">カテゴリ</span>
      ${chip('cat', 'all', 'すべて', true)}
      ${usedCats.map((c) => chip('cat', c.id, c.short)).join('')}
    </div>
    <div class="frow">
      <span class="flabel">検索</span>
      <input type="search" id="fQ" placeholder="例: 退職 アカウント / 面接 / 返戻" aria-label="キーワードで絞り込む">
      <label class="flabel" for="fSort" style="min-width:auto">並び順</label>
      <select id="fSort" aria-label="並び替え">
        <option value="reco">おすすめ順</option>
        <option value="new">新着順</option>
        <option value="upd">更新順</option>
      </select>
      <span class="fcount" id="fCount" aria-live="polite"></span>
      <button class="freset" id="fReset">条件をリセット</button>
    </div>
    <details class="fmore">
      <summary>くわしい条件(利用場面・発生頻度・対象者・形式)</summary>
      <div class="frow" style="margin-top:10px">
        <label class="flabel" for="f-scene">利用場面</label>
        <select id="f-scene"><option value="">指定しない</option>${SCENES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select>
        <label class="flabel" for="f-freq">発生頻度</label>
        <select id="f-freq"><option value="">指定しない</option>${FREQUENCY.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select>
        <label class="flabel" for="f-role">対象者</label>
        <select id="f-role"><option value="">指定しない</option>${ROLES.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select>
        <label class="flabel" for="f-format">形式</label>
        <select id="f-format"><option value="">指定しない</option>${FORMATS.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join('')}</select>
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
  <p style="font-size:12px;color:var(--ink-3);margin:26px 0 40px">${packAvailable ? `採用・入退職の完全版一式は<a href="${root}pack/index.html" style="text-decoration:underline">${esc(PRODUCT.shortTitle)}</a>にまとめています(決済準備中)。` : ''}1on1・上司報告など管理職としての進め方は<a href="${root}../manager-starter/index.html" style="text-decoration:underline">${esc(SITE.sibling.name)}</a>で扱っています。</p>
</div>`;

  out('templates/index.html', page({
    path: 'templates/index.html',
    title: 'テンプレート一覧',
    description: '医療機関の実務テンプレート一覧。採用・入退職・施設基準・研修記録・返戻管理・機器点検などのチェックリスト・台帳・進捗表・文例を、カテゴリ・利用場面・頻度で絞り込めます。',
    pageId: 'templates',
    event: E.VIEW_TEMPLATE,
    body,
    ld: [breadcrumbLd([['テンプレート', 'templates/index.html']])],
  }));
}

/* ================================================================
   テンプレート詳細(場面・確認先・抜け漏れ・変更点まで表示)
   ================================================================ */
for (const t of tpls) {
  const root = '../../';
  const path = `templates/${t.slug}/index.html`;
  const cautions = [t.notes, t.regionalDifferences, t.requiresExpertConfirmation, t.reviewNote].filter(Boolean);
  const packNudge = packAvailable && ['recruiting', 'staffing'].includes(t.categoryId);
  const body = `
${breadcrumbs(root, [['テンプレート', 'templates/index.html'], [t.shortTitle || t.title, null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:0">
  <p><span class="badge free">無料</span> <span class="badge cat">${esc(catName(t.categoryId))}</span> ${(t.scenes || []).map((s) => `<span class="chip">${esc(sceneLabel(s))}</span>`).join(' ')}</p>
  <h1>${esc(t.title)}</h1>
  <p class="lead">${esc(t.summary)}</p>
  <div class="meta-bar">
    ${t.version ? `<span>バージョン <b>${esc(t.version)}</b></span>` : ''}
    <span>公開 <b>${dateJp(t.publishedAt)}</b></span>
    <span>更新 <b>${dateJp(t.updatedAt)}</b></span>
    ${t.effectiveDate ? `<span>制度基準日 <b>${dateJp(t.effectiveDate)}</b></span>` : ''}
  </div>
</div>
<div class="wrap detail">
  <div class="prose">
    <p>${esc(t.description)}</p>
    <h2 id="scene">このような場面で使います</h2>
    <ul>
      ${t.triggerEvent ? `<li><strong>使うタイミング</strong> — ${esc(t.triggerEvent)}</li>` : ''}
      ${t.deadlineNote ? `<li><strong>期限の目安</strong> — ${esc(t.deadlineNote)}</li>` : ''}
      ${(t.confirmationTargets || []).length ? `<li><strong>確認する相手</strong> — ${t.confirmationTargets.map(esc).join(' / ')}</li>` : ''}
      ${t.completionCriteria ? `<li><strong>完了の条件</strong> — ${esc(t.completionCriteria)}</li>` : ''}
    </ul>
    ${!t.content && (t.includedItems || []).length ? `
    <h2 id="items">含まれる項目</h2>
    <ul>${t.includedItems.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <p style="font-size:12.5px;color:var(--ink-3)">この項目構成をもとに、自院のExcel・Wordで表を作ってそのまま使えます。ファイルのダウンロード提供は準備中です。</p>` : ''}
    ${contentHtml(t)}
    ${(t.usageSteps || []).length ? `<h2 id="usage">使い方</h2><ol>${t.usageSteps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${(t.commonOmissions || []).length ? `
    <h2 id="omissions">よくある抜け漏れ</h2>
    <div class="point"><ul>${t.commonOmissions.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
    ${(t.customizationPoints || []).length ? `
    <h2 id="custom">自院向けに変更する部分</h2>
    <ul>${t.customizationPoints.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
    ${cautions.length ? `<div class="notice"><div class="h">注意事項</div>${cautions.map(esc).join('<br>')}</div>` : ''}
  </div>
  <aside class="detail-side" aria-label="資料情報">
    <div class="buy-card">
      <span class="badge free" style="align-self:flex-start">無料</span>
      <p class="note">登録なしで使えます。内容をコピーし、自院の運用に合わせて編集してください。Excel・Word版のダウンロード提供は準備中です。</p>
      ${packNudge ? `<a class="btn primary" href="${root}pack/index.html">完全版を含む採用・入退職パックを見る</a>` : ''}
      <a class="btn ghost" href="${root}templates/index.html">他のテンプレートを探す</a>
    </div>
    <div class="side-box">
      <div class="h">この資料について</div>
      <dl>
        <dt>カテゴリ</dt><dd>${esc(catName(t.categoryId))}</dd>
        <dt>対象</dt><dd>${(t.targetRoles || []).map((r) => esc((ROLES.find((x) => x.id === r) || {}).label || r)).join('、')}</dd>
        ${(t.scenes || []).length ? `<dt>利用場面</dt><dd>${t.scenes.map((s) => esc(sceneLabel(s))).join('、')}</dd>` : ''}
        ${(t.frequency || []).length ? `<dt>発生頻度</dt><dd>${t.frequency.map((f) => esc(freqLabel(f))).join('、')}</dd>` : ''}
        <dt>形式</dt><dd>${(t.formats || []).map((f) => esc(formatLabel(f))).join('、')}</dd>
        ${(t.fileFormats || []).length ? `<dt>ファイル</dt><dd>${t.fileFormats.map((f) => esc(f === 'excel' ? 'Excel' : f === 'word' ? 'Word' : f)).join('・')}(準備中)</dd>` : ''}
      </dl>
    </div>
  </aside>
</div>
${relatedSection(root, (t.relatedTemplateIds || []).filter((id) => id !== t.id), t.relatedArticleIds)}`;

  out(path, page({
    path,
    title: t.title,
    description: t.summary + ' 無料で使えます。',
    pageId: 'templates',
    event: E.VIEW_TEMPLATE,
    body,
    ld: [{
      '@context': 'https://schema.org', '@type': 'CreativeWork',
      name: t.title, description: t.summary, inLanguage: 'ja',
      isAccessibleForFree: true, datePublished: t.publishedAt, dateModified: t.updatedAt,
      author: { '@type': 'Person', name: '橋本渉' },
      url: SITE.baseUrl + path.replace(/index\.html$/, ''),
    }, breadcrumbLd([['テンプレート', 'templates/index.html'], [t.title, path]])],
  }));
}

/* ================================================================
   採用・入退職実務パック(status=published のときのみ生成)
   価格表示: 通常価格の単一表示(2026-07-19 社長決定。二重価格の枠組みは使わない)
   (実績のない二重価格に見せない — PM条件 2026-07-18)
   ================================================================ */
if (packAvailable) {
  const root = '../';
  const path = 'pack/index.html';
  const groups = [...new Set(PRODUCT.items.map((i) => i.cat))];
  const body = `
${breadcrumbs(root, [[PRODUCT.shortTitle, null]])}
<div class="pack-hero">
  <div class="wrap">
    <p><span class="badge paid">有料</span> <span class="badge prep">決済準備中</span></p>
    <p class="eyebrow" style="margin-top:10px">${esc(PRODUCT.title)}</p>
    <h1 style="font-size:clamp(21px,3.4vw,30px);font-weight:700;margin-top:8px">${esc(PRODUCT.heading)}</h1>
    <p class="lead" style="font-size:13.5px;color:var(--ink-2);margin-top:10px;max-width:var(--text-max)">${esc(PRODUCT.shortDescription)}</p>
    <div class="pack-meta">
      <span>収録 <b>${PRODUCT.items.length}ファイル</b>(記入例・失敗事例集つき)</span>
      <span>形式 <b>Excel・Word(スプレッドシート取込可)</b></span>
      <span>価格 <b>${fmtPrice(P.list)}</b> <span style="color:var(--ink-3)">税込・買い切り</span></span>
      <span>更新 <b>${dateJp(PRODUCT.updatedAt)}</b></span>
    </div>
  </div>
</div>
<div class="wrap detail">
  <div class="prose">
    <p>${esc(PRODUCT.longDescription)}</p>
    <h2 id="target">このような方向け</h2>
    <ul>${PRODUCT.targetUsers.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="problems">こんな状態のときに</h2>
    <ul>${PRODUCT.problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="outcomes">このパックでできること</h2>
    <ul>${PRODUCT.outcomes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="files">含まれるファイル(全${PRODUCT.items.length}点)</h2>
    ${groups.map((g) => `
    <div class="pack-group">
      <div class="h">${esc(g)}</div>
      <ul class="files">
        ${PRODUCT.items.filter((i) => i.cat === g).map((i, n) => `<li><span class="n">${String(n + 1).padStart(2, '0')}</span><span class="fn">${esc(i.title)}</span><span class="fp">${esc(i.purpose)}</span><span class="chip">${esc(i.format)}</span></li>`).join('\n        ')}
      </ul>
    </div>`).join('')}
    <h2 id="sample">サンプル</h2>
    <div class="sample-table">
      <div class="cap">${esc(PRODUCT.sample.title)} — ${esc(PRODUCT.sample.note)}</div>
      <div class="scroll"><table>
        <thead><tr>${PRODUCT.sample.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${PRODUCT.sample.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('\n        ')}</tbody>
      </table></div>
    </div>
    <p>無料テンプレート(<a href="${root}templates/onboarding-checklist/index.html">入職前準備チェックリスト</a>・<a href="${root}templates/offboarding-checklist/index.html">退職時対応チェックリスト</a>など)が、各シートの縮小版になっています。まず無料版で使い勝手を確かめてください。</p>
    <h2 id="flow">利用イメージ — 導入後の流れ</h2>
    <ol>${PRODUCT.usageFlow.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <h2 id="notincluded">このパックに含まれないもの</h2>
    <ul>${PRODUCT.notIncluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="faq">よくある質問</h2>
    <div class="faq">
      ${PRODUCT.faq.map((f) => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('\n      ')}
    </div>
    <h2 id="price">価格</h2>
    <ul>
      <li>価格: <strong>${fmtPrice(P.list)}(税込・買い切り)</strong></li>
    </ul>
    <h2 id="license">利用条件</h2>
    <ul>
      <li>利用範囲: ${esc(PRODUCT.license.scope)}</li>
      <li>再配布・転売・SNS等への転載: できません</li>
      <li>テンプレートの編集・自院規程に合わせた改変: できます(むしろ前提です)</li>
    </ul>
    <div class="notice"><div class="h">ご利用にあたって</div>本パックは実務の整理を支援するひな形であり、労務・法律・診療報酬上の専門判断を代替しません。雇用契約・保険手続きは社会保険労務士等へ確認してください。記入する職員・候補者の個人情報は必要最小限にし、保管場所の閲覧範囲を確認してください。</div>
  </div>
  <aside class="detail-side" aria-label="価格と購入">
    <div class="buy-card">
      <span><span class="badge paid">有料</span> <span class="badge prep">決済準備中</span></span>
      <div>
        <div class="price-now">${fmtPrice(P.list)} <small>税込・買い切り</small></div>
      </div>
      <button class="btn primary" data-buy="${PRODUCT.id}">購入方法を問い合わせる</button>
      <a class="btn ghost" href="#sample">サンプルを確認する</a>
      <p class="note">オンライン決済は準備中です。先行して利用したい場合は、お問い合わせから連絡してください。個別に案内します。</p>
    </div>
    <div class="side-box">
      <div class="h">この商品について</div>
      <dl>
        <dt>収録</dt><dd>${PRODUCT.items.length}ファイル(Excel 9・Word 5・PDF 3)</dd>
        <dt>形式</dt><dd>Excel・Word</dd>
        <dt>バージョン</dt><dd>${esc(PRODUCT.version)}</dd>
        <dt>更新</dt><dd>${dateJp(PRODUCT.updatedAt)}</dd>
        <dt>更新版</dt><dd>購入から1年間利用(方針)</dd>
      </dl>
    </div>
  </aside>
</div>
${relatedSection(root, ['recruit-requirements', 'onboarding-checklist', 'offboarding-checklist'], ['offboarding-accounts', 'interview-eval-items'])}
<div class="sticky-cta">
  <span class="p">${fmtPrice(P.launch)} <span style="font-weight:500;color:var(--ink-3)">税込</span></span>
  <a class="btn ghost small" href="#sample">サンプル</a>
  <button class="btn primary small" data-buy="${PRODUCT.id}">購入を問い合わせる</button>
</div>
<dialog class="mo-dialog" id="buyDialog" aria-labelledby="buyDialogTitle">
  <div class="dh"><span id="buyDialogTitle">オンライン決済は準備中です</span><button data-close aria-label="閉じる">✕</button></div>
  <div class="db">
    <p>このパックの構成は確定していますが、オンライン決済と実ファイルの提供体制をまだ用意できていません。</p>
    <p>先行して利用したい場合は、お問い合わせからその旨を送ってください。提供時期と支払い方法を個別に案内します。販売開始の告知は${esc(SITE.parent.name)}のnote・Xで行います。</p>
  </div>
  <div class="df">
    <a class="btn primary small" href="${root}../community/index.html">お問い合わせへ</a>
    <a class="btn ghost small" href="${SITE.parent.note}" target="_blank" rel="noopener noreferrer">noteを見る ↗</a>
  </div>
</dialog>`;

  out(path, page({
    path,
    title: PRODUCT.title,
    description: PRODUCT.shortDescription + ' 収録' + PRODUCT.items.length + 'ファイル・' + fmtPrice(P.launch) + '(税込・決済準備中)。',
    pageId: 'pack',
    event: E.VIEW_PRODUCT,
    body,
    hasSticky: true,
    ld: [{
      '@context': 'https://schema.org', '@type': 'CreativeWork',
      name: PRODUCT.title, description: PRODUCT.shortDescription, inLanguage: 'ja',
      isAccessibleForFree: false, dateModified: PRODUCT.updatedAt,
      author: { '@type': 'Person', name: '橋本渉' },
      url: SITE.baseUrl + 'pack/',
      /* 決済開始前のため Offer(価格)の構造化データは載せない */
    }, breadcrumbLd([[PRODUCT.shortTitle, 'pack/index.html']])],
  }));
}

/* ================================================================
   法人・複数拠点での利用
   ================================================================ */
{
  const root = '../';
  const points = [
    ['拠点ごとの資料形式を揃えられる', '施設ごとに違うExcelの形式を、同じテンプレートに統一できます。本部での取りまとめが楽になります。'],
    ['担当者交代に耐える', '台帳・チェックリスト・記録の形式が決まっていれば、引き継ぎ資料を都度作らずに済みます。'],
    ['入退職・研修記録の標準化', '拠点をまたいで同じチェックリスト・出席簿を使うことで、監査対応の水準が揃います。'],
    ['無料から試せる', '公開中のテンプレートはすべて無料で、法人内で自由に共有できます。まず1拠点で試してください。'],
  ];
  const body = `
${breadcrumbs(root, [['法人・複数拠点での利用', null]])}
<div class="wrap page-head">
  <p class="eyebrow">For Organizations</p>
  <h1>法人・複数拠点での利用</h1>
  <p class="lead">医療法人本部・複数拠点の運営担当・経営支援の方向けのご案内です。</p>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div class="text-wrap prose">
    <p>拠点ごとに資料の形式が違う、担当者ごとにExcelの作りが違う、前任者がいないと業務が止まる——複数拠点の運営で伺う悩みの多くは、実務資料の形式が法人として決まっていないことに起因します。本サイトのテンプレートは、その「法人共通の形式」の土台として使えます。</p>
  </div>
  <div class="grid c2" style="margin:22px 0">
    ${points.map(([t, d]) => `<div class="cat-card" style="cursor:default"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></div>`).join('\n    ')}
  </div>
  <div class="text-wrap prose">
    <h2>利用の形</h2>
    <ul>
      <li><strong>いますぐ(無料)</strong> — 公開中のテンプレート・記事は法人内で自由に共有できます。<a href="${root}templates/index.html">テンプレート一覧</a>から必要な資料を各拠点へ案内してください。</li>
      ${packAvailable ? `<li><strong>${esc(PRODUCT.shortTitle)}(決済準備中)</strong> — 採用〜入退職の完全版一式。法人購入では1法人内の共有・複数拠点での利用を想定しています。<a href="${root}pack/index.html">内容はこちら</a>。</li>` : ''}
      <li><strong>法人会員(構想中)</strong> — 複数名利用・更新通知・利用ガイドを含む年間契約を構想しています(<a href="${root}pricing/index.html">料金の考え方</a>)。導入のご相談をいただきながら固めていく段階です。</li>
    </ul>
    <h2>お引き受けできないこと</h2>
    <ul>
      <li>労務・法律・診療報酬の個別判断の代行(専門家の領域です)</li>
      <li>基幹システム(電子カルテ・勤怠等)の導入・代替</li>
    </ul>
    <p>導入を急ぐ必要はありません。まず無料テンプレートを1拠点で使って、現場の反応を見るだけでも十分です。</p>
    <p style="margin-top:18px"><a class="btn primary" href="${root}../community/index.html">法人利用について問い合わせる</a></p>
    <p style="font-size:12px;color:var(--ink-3)">お問い合わせは${esc(SITE.parent.name)}の窓口で受け付けています。法人名・拠点数・使いたい業務をお書き添えください。</p>
  </div>
</div>`;
  out('corporate/index.html', page({
    path: 'corporate/index.html',
    title: '法人・複数拠点での利用',
    description: '医療法人本部・複数拠点の運営担当向け。拠点ごとに違う実務資料の形式を、共通のテンプレート(採用・入退職・施設基準・研修記録)に統一できます。',
    pageId: '',
    event: E.CORP_INQUIRY,
    body,
    ld: [breadcrumbLd([['法人・複数拠点での利用', 'corporate/index.html']])],
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
  <p class="lead">具体的な業務の進め方を、結論と確認項目から書いています。読み終えたときに次の行動が決まる構成を目指しています。</p>
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
    description: '医療機関の実務記事一覧。退職時のアカウント停止、面接評価、施設基準の期限管理、返戻の進捗管理などの具体的な業務を、結論と確認項目から解説します。',
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
   初めての方へ(スターターとの違い・案内はここに限定)
   ================================================================ */
{
  const root = '../';
  const body = `
${breadcrumbs(root, [['初めての方へ', null]])}
<div class="wrap page-head">
  <p class="eyebrow">Guide</p>
  <h1>初めての方へ</h1>
  <p class="lead">このサイトが何をするもので、どんな場面で使うのかをまとめています。</p>
</div>
<div class="wrap text-wrap prose" style="padding-bottom:50px">
  <h2>${esc(SITE.name)}とは</h2>
  <p>医療機関で具体的な業務や案件が発生したときに、「何を・誰が・いつ・どの順番で処理するか」を確認できる実務ライブラリです。採用、入退職、施設基準、研修記録、レセプト返戻、医療機器管理など、繰り返し発生する業務のチェックリスト・台帳・進捗表・文例を揃えています。</p>
  <h2>どのような場面で使うか</h2>
  <ul>
    <li>急に採用面接を任された → 採用・面接カテゴリの評価シートと記事へ</li>
    <li>退職者が出た → 退職時対応チェックリストでアカウント停止・返却を管理</li>
    <li>施設基準の管理を引き継いだ → 管理台帳と更新期限管理表で一覧化</li>
    <li>研修の記録を整えたい → 実施記録・出席簿・未受講者フォロー表へ</li>
    <li>案内文・問い合わせ文を書く → 院内文書・対外文書カテゴリの文例へ</li>
  </ul>
  <h2>医療管理職スターターとの違い</h2>
  <p>姉妹サイト<a href="${root}../manager-starter/index.html">${esc(SITE.sibling.name)}</a>は、初めて管理職になった方向けに「管理職としての振る舞い」(1on1・上司報告・チーム運営・最初の90日)を扱います。本サイトが扱うのは「具体的な実務の処理」です。迷ったら次の基準で選んでください。</p>
  <ul>
    <li>管理職としてどう進めるかを知りたい → ${esc(SITE.sibling.name)}</li>
    <li>目の前の案件(採用・入退職・施設基準など)を処理したい → 本サイト</li>
  </ul>
  <h2>テンプレートの探し方</h2>
  <ol>
    <li><strong>案件から</strong> — トップの「実務カテゴリから探す」で、発生している業務のカテゴリを開く</li>
    <li><strong>条件から</strong> — <a href="${root}templates/index.html">テンプレート一覧</a>で、利用場面・発生頻度・対象者・形式で絞り込む</li>
    <li><strong>キーワードから</strong> — 上部の検索窓に「退職 アカウント」「返戻」のように入力する(テンプレートと記事を横断して探せます)</li>
  </ol>
  <h2>無料資料と有料資料の違い</h2>
  <p>公開中のテンプレートはすべて無料で、ページ上でそのまま使えます。${packAvailable ? `有料の<a href="${root}pack/index.html">${esc(PRODUCT.shortTitle)}</a>は、採用〜入職〜退職の完全版(進捗欄・複数人管理つき)と連絡文例を一式にしたものです(決済準備中)。` : ''}会員プランの構想は<a href="${root}pricing/index.html">料金のページ</a>にまとめています。</p>
  <h2>自院向けの編集方法</h2>
  <ol>
    <li>関連する記事で、確認項目と確認先の全体像をつかむ</li>
    <li>テンプレートをコピーし、担当者・期限・システム名を自院の内容に書き換える</li>
    <li>不要な項目は削る(削るのも編集です)。1〜2回使って、抜けていた項目を足す</li>
  </ol>
  <h2>制度や地域差がある場合</h2>
  <p>届出・施設基準・様式は、制度改定や自治体・厚生局によって取り扱いが異なることがあります。各資料には制度基準日と注意事項を明記しています。個別の要件は、所管の保健所・厚生局・自治体へ確認してください。労務・法律・税務に関わる判断は、社会保険労務士・弁護士・税理士等の専門家への確認が必要です。</p>
  <h2>個人情報の取り扱いとAI利用</h2>
  <p>台帳・記録には職員・患者の個人情報が含まれ得ます。記入は業務に必要な最小限にし、保管場所の閲覧範囲を自院の規程に合わせてください。生成AIと組み合わせて使う場合は、患者情報・職員の個人情報・公表前の経営情報を入力せず、AIの出力をそのまま行政提出や人事判断に使わないでください。</p>
</div>`;
  out('guide/index.html', page({
    path: 'guide/index.html',
    title: '初めての方へ',
    description: SITE.name + 'の使い方。どんな場面で使うか、医療管理職スターターとの違い、テンプレートの探し方と自院向けの編集方法をまとめています。',
    pageId: 'guide',
    body,
    ld: [breadcrumbLd([['初めての方へ', 'guide/index.html']])],
  }));
}

/* ================================================================
   料金・プラン(ナビ非掲載。パック・ガイドからの導線のみ)
   ================================================================ */
{
  const root = '../';
  const plans = SITE.pricing.plans;
  const body = `
${breadcrumbs(root, [['プランと料金', null]])}
<div class="wrap page-head">
  <p class="eyebrow">Pricing</p>
  <h1>プランと料金の考え方</h1>
  <p class="lead">現在使えるのは無料コンテンツです。${packAvailable ? '採用・入退職パックは決済準備中、' : ''}会員・法人プランは構想段階のため、内容と価格は変わる可能性があります。</p>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div class="plans c4" style="margin-top:10px">
    ${plans.map((p) => `
    <div class="plan${p.id === 'pack' ? ' hl' : ''}">
      <div class="pn">${esc(p.name)}</div>
      <div class="pp">${p.price === 0 ? '0円' : fmtPrice(p.price) + `<small> / ${esc(p.unit)}</small>`}</div>
      <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <p class="note">${esc(p.note)}</p>
    </div>`).join('')}
  </div>
  <div class="text-wrap" style="margin-top:30px">
    <div class="notice">
      <div class="h">販売開始前です</div>
      いま使える資料は<a href="${root}templates/index.html" style="text-decoration:underline">無料テンプレート</a>と記事です。${packAvailable ? `パックの内容は<a href="${root}pack/index.html" style="text-decoration:underline">商品ページ</a>で公開しており、先行利用の相談は<a href="${root}../community/index.html" style="text-decoration:underline">お問い合わせ</a>で受け付けています。` : ''}開始時期・確定価格は決まり次第、このページと${esc(SITE.parent.name)}のnote・Xで告知します。
    </div>
  </div>
</div>`;
  out('pricing/index.html', page({
    path: 'pricing/index.html',
    title: 'プランと料金',
    description: SITE.name + 'の料金の考え方。無料コンテンツ、採用・入退職実務パック(準備中)、個人会員・法人会員(構想中)について説明します。',
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
    ['医療機関の経営支援', '訪問診療クリニックの経営支援、業務改善、業務フローと管理資料の整備に携わっています。'],
    ['採用・入退職の実務', '医師・看護師・医療事務などの採用、求人票・面接評価の設計、入退職対応の仕組み化を支援しています。'],
    ['行政手続き・施設基準', '管理医師変更、施設基準・診療報酬の整理など、保健所・厚生局への対応を実務として行っています。'],
    ['システム移行・運用', '電子カルテ・ORCA・レセプトの移行と日常運用の整理。ベンダー調整と現場の間をつなぐ役回りです。'],
    ['クリニック統合・PMI', 'クリニック統合や承継の実務支援。行政・職員・システムを含む段取り全体を扱います。'],
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
    <p>私は理学療法士として病院で働いたあと、いまは医療機関の経営支援を仕事にしています。採用、入退職の対応、施設基準の整理、研修記録、電子カルテの移行——このサイトで扱っているのは、私が支援先で日々段取りしている業務そのものです。</p>
    <h2>経験している領域</h2>
  </div>
  <div class="rows" style="margin:14px 0 26px">
    ${exps.map(([t, d]) => `<div class="row" style="flex-direction:column;gap:3px"><span style="font-weight:700;font-size:13.5px">${esc(t)}</span><span class="b" style="font-size:12.5px">${esc(d)}</span></div>`).join('\n    ')}
  </div>
  <div class="prose">
    <h2>このサイトを作った理由</h2>
    <p>医療機関の実務には、制度の解説はたくさんあるのに、「では明日、何を確認して、誰に聞けばよいのか」に落とした資料がほとんどありません。退職者が出るたびに、面接を任されるたびに、みんな前回のExcelを探し、見つからずにゼロから作っています。</p>
    <p>私自身、支援先で同じ資料を何度も作り直してきました。その資料を、同じ場面で困っている人がそのまま使える形に整えて公開する。それがこのサイトです。</p>
    <h2>AIの使い方について</h2>
    <p>資料の作成に生成AIも使っています。ただし、AIの出力は一般論になりやすく、そのままでは現場で使えません。項目を現場で使う単位に削り、確認先と期限を足し、実際の案件で通用した粒度に直してから公開しています。</p>
    <h2>${esc(SITE.parent.name)}について</h2>
    <p>${esc(SITE.parent.name)}は「人が、自ら選び、納得して生きられる社会をつくる」ための個人プロジェクトです。このサイトはその道具のひとつで、医療機関の担当者が前任者に頼らず、自分で実務を進められる状態をつくることを目指しています。管理職としての進め方は姉妹サイト<a href="${root}../manager-starter/index.html">${esc(SITE.sibling.name)}</a>で扱っています。<a href="${root}../about/index.html">プロジェクト全体について</a>もご覧ください。</p>
  </div>
</div>`;
  out('about/index.html', page({
    path: 'about/index.html',
    title: '運営者について',
    description: SITE.name + 'の運営者について。医療機関の経営支援・採用・行政手続き・電子カルテ移行の実務経験をもとに、実際に使っている資料を公開しています。',
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
    ['テンプレートは編集できますか', 'できます。むしろ自院の運用・規程に合わせて編集して使う前提です。項目を削ることも編集です。'],
    ['ExcelやWordが必要ですか', '無料テンプレートはWebページ上でそのまま読め、テキストとしてコピーできます。項目構成をもとに自院のExcel・Wordで表を作れます。ファイルのダウンロード提供は準備中です。'],
    ['Googleスプレッドシートでも使えますか', '使えます。Excel形式のファイルを提供する際も、スプレッドシートに取り込める形(複雑なマクロなし)にします。'],
    ['行政への提出書類そのものですか', '違います。本サイトの資料は、検討・管理・確認のための実務資料です。届出の公式様式は所管の保健所・厚生局・自治体で入手してください。'],
    ['内容は法的判断を保証しますか', '保証しません。一般的な進め方の整理であり、個別案件の要否・要件は所管窓口や専門家への確認が必要です。資料には確認先を明記するようにしています。'],
    ['最新の制度に対応していますか', '制度に関わる資料には「制度基準日」を明記しています。制度変更があった場合は内容を見直し、更新日を記録します。基準日が古い資料は、利用前に最新の取り扱いを確認してください。'],
    ['テンプレートを法人内で共有できますか', '無料テンプレートは院内・法人内で自由に共有できます。有料パックは1法人内での共有・複数拠点での利用を想定しています(法人外への配布・転売は不可)。'],
    ['管理職の仕事の進め方も学べますか', '本サイトは具体的な実務の処理に特化しています。1on1・上司報告・チーム運営など管理職としての進め方は、姉妹サイト「' + SITE.sibling.name + '」をご覧ください。'],
    ['台帳や記録に個人情報を書いてもよいですか', '業務に必要な最小限に留め、保管場所の閲覧範囲を自院の規程に合わせてください。外部に共有する場合や生成AIに入力する場合は、個人情報を必ず除いてください。'],
    ['AIへ患者情報や職員情報を入力してよいですか', '入力しないでください。文面の下書きにAIを使う場合は、固有名詞を置き換えた抽象的な形で使い、出力をそのまま行政提出・人事判断に使わないでください。'],
    ['購入後に更新版は利用できますか', '有料パックは購入から1年間、更新版を追加費用なしで利用できる方針です。提供方法は販売開始時に案内します。'],
    ['返金はできますか', 'デジタル資料の性質上、提供後の返金は原則お受けしない方針です。販売開始時に、サンプルと「含まれないもの」を購入前に確認できるようにし、正式な条件を利用規約に明記します。'],
    ['法人契約はできますか', '法人会員プランを構想中です。先行して相談したい場合はお問い合わせからご連絡ください。'],
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
    description: SITE.name + 'のよくある質問。テンプレートの編集・法人内共有・制度対応・個人情報の扱い・返金の方針などをまとめています。',
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
