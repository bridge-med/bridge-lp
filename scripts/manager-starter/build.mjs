#!/usr/bin/env node
/* ================================================================
   医療管理職スターター — サイト生成スクリプト
   使い方: node scripts/manager-starter/build.mjs
   manager-starter/data/*.mjs を唯一の情報源として全HTMLを静的生成し、
   ルートの sitemap.xml のマーカー区間を更新する。
   公開物は純粋な静的ファイル(実行時のビルドはない)。
   ================================================================ */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE, PROFESSIONS, EXPERIENCE, FORMATS, fmtPrice } from '../../manager-starter/data/site.mjs';
import { CATEGORIES } from '../../manager-starter/data/categories.mjs';
import { publishedTemplates, packTemplates, getTemplate } from '../../manager-starter/data/templates.mjs';
import { publishedArticles } from '../../manager-starter/data/articles.mjs';
import { PRODUCT } from '../../manager-starter/data/product.mjs';
import { DIAG } from '../../manager-starter/data/diagnosis.mjs';
import { publishedProfessions } from '../../manager-starter/data/professions.mjs';
import {
  esc, page, breadcrumbs, breadcrumbLd, tplCard, artCard, contentHtml,
  formatLabel, profLabel, expLabel, catName, catShort, dateJp,
} from './html.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const written = [];
const out = (path, html) => {
  const abs = join(repo, 'manager-starter', path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, html);
  written.push(path);
};

const tpls = publishedTemplates();
const arts = publishedArticles();
const packItems = packTemplates();
const profs = publishedProfessions();
const tplById = (id) => tpls.find((t) => t.id === id);
const artById = (id) => arts.find((a) => a.id === id);
const E = SITE.events;
const P = SITE.pricing.pack;

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

const packAvailable = PRODUCT.status === 'published';

/* ================================================================
   トップページ
   ================================================================ */
{
  const root = '';
  const featuredT = tpls.filter((t) => t.isFeatured).slice(0, 4);
  const featuredA = arts.filter((a) => a.isFeatured).slice(0, 4);
  const worries = [
    'メンバーとの面談で何を話せばよいか分からない',
    '上司へチーム状況をうまく報告できない',
    '会議をしても何も決まらない',
    '誰が何をしているか把握できていない',
    '数字で説明するよう言われても分からない',
    '自分で対応した方が早く、仕事を任せられない',
  ];
  const features = [
    ['最初に確認することが分かる', '最初の7日・30日・90日で確認する項目を、チェックリストと計画表にしています。'],
    ['メンバーとの対話を整える', '初回1on1の質問、面談の記録、次回確認することまで、対話の型を用意しています。'],
    ['チームの課題を見える化する', '口頭で流れやすい問題を、6列の課題一覧で管理できるようにします。'],
    ['上司への報告を短くする', '状況・課題・対応・相談の4項目で、週次報告もトラブル報告も同じ型で書けます。'],
    ['業務分担を見直す', '自分や特定の職員へ偏った仕事を書き出し、任せる手順へつなげます。'],
    ['AIを安全に活用する', '個人情報を入力しない線引きを決めたうえで、議事メモや報告文の下書きに使います。'],
  ];
  const profHref = (id) => {
    const p = profs.find((x) => x.id === id);
    return p ? `professions/${p.slug}/index.html` : null;
  };
  const profCards = [
    ['リハビリ職の管理職', '臨床を続けながら実績管理・教育・会議が積み重なりやすい立場です。単位数などの数字と新人教育の割り当てが最初の壁になります。', profHref('reha')],
    ['看護管理職', '業務分担と勤務調整の悩みが集中します。看護師が物品や雑務まで抱えている構造の整理が最初のテーマになりがちです。', profHref('nurse')],
    ['訪問看護管理者', '訪問を続けながら採用・教育・請求・シフトまで。管理業務の種類が最も多く、月1回の型に収める工夫が必要です。', profHref('homon')],
    ['医療事務責任者', '他部署・他職種との調整と新人教育が課題になりやすい立場です。決定事項の記録が特に効きます。', profHref('jimu')],
    ['クリニックの管理職', '院長との距離が近く、報告と相談の型があるだけで運営が変わります。少人数ゆえの属人化も課題です。', null],
    ['管理職を育てる上司・法人', '新任管理職へ「何を渡して何から始めてもらうか」の共通の型として使えます。法人利用のご相談も受け付けています。', 'corporate/index.html'],
  ];
  const body = `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">${esc(SITE.name)}</p>
      <h1>${SITE.taglineLines.map(esc).join('<br>')}</h1>
      <p class="sub">${esc(SITE.description)}無料のチェックリストとセルフチェックから始められます。</p>
      <div class="hero-tags">
        <span>医療専門職の新任管理職向け</span><span>記入して使う実務シート</span><span>無料で試せる</span>
      </div>
      <div class="hero-cta">
        <a class="btn cta" href="templates/first-7days-checklist/index.html">最初の7日チェックリストを見る</a>
        <a class="btn ghost" href="check/index.html">管理職の現在地を確認する</a>
      </div>
      <p style="font-size:11.5px;color:var(--ink-3);margin-top:12px">登録不要・無料ですぐ使えます</p>
    </div>
    <div class="hero-minis" aria-label="テンプレートの例">
      <div class="mini">
        <div class="mt">1on1質問シート(例)</div>
        <ul>
          <li><span class="bx on" aria-hidden="true"></span><span>今の業務量は率直にどうですか</span></li>
          <li><span class="bx on" aria-hidden="true"></span><span>困っていることは何ですか</span></li>
          <li><span class="bx" aria-hidden="true"></span><span>手伝ってほしいことは</span></li>
        </ul>
      </div>
      <div class="mini">
        <div class="mt">チーム課題ボード</div>
        <ul>
          <li><span class="bx on" aria-hidden="true"></span><span>情報共有が漏れる — 対応中</span></li>
          <li><span class="bx" aria-hidden="true"></span><span>新人の教え方に差 — 今週</span></li>
          <li><span class="bx" aria-hidden="true"></span><span>発注の属人化 — 待ち</span></li>
        </ul>
      </div>
      <div class="mini wide">
        <div class="mt">90日アクションプラン</div>
        <ul>
          <li><span class="bx on" aria-hidden="true"></span><span>0-30日: 全員と1on1・数字を集める</span></li>
          <li><span class="bx" aria-hidden="true"></span><span>31-60日: 課題を一覧化して優先順位</span></li>
          <li><span class="bx" aria-hidden="true"></span><span>61-90日: 1つ仕組みにして手を離す</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Worries</p>
    <h2 class="sec-h">こんなお悩みはありませんか</h2>
    <div class="grid c3" style="margin-top:22px">
      ${worries.map((w) => `<div class="worry-card"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg><span class="d">${esc(w)}</span></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Why</p>
    <h2 class="sec-h">なぜ、医療専門職の管理職は難しいのか</h2>
    <div class="shift" style="margin-top:22px">
      <div class="col">
        <div class="h">臨床経験で身についたこと</div>
        <ul>
          <li>専門知識・技術</li>
          <li>患者さんへの直接的な支援</li>
          <li>後輩指導・チームでの協働</li>
          <li>現場の状況把握力</li>
        </ul>
      </div>
      <div class="arrow" aria-hidden="true"><span>役割の</span><span>シフト</span><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
      <div class="col after">
        <div class="h">管理職に求められること</div>
        <ul>
          <li>目標設定と進捗管理</li>
          <li>業務分担・人材育成・評価</li>
          <li>数字での説明と上司・他部門との調整</li>
          <li>会議設計・採用</li>
        </ul>
      </div>
    </div>
    <p class="text-wrap" style="font-size:13.5px;color:var(--ink-2);margin-top:18px;line-height:2">この2つは別の技能です。学ぶ機会がないまま任されるから難しいのであって、できなくて当然の状態から始まります。学べば身につきます。このサイトは、その学びを講義ではなく「記入して使う道具」の形で提供します。</p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">What</p>
    <h2 class="sec-h">${esc(SITE.name)}の特徴</h2>
    <div class="grid c3" style="margin-top:22px">
      ${features.map(([t, d]) => `<div class="cat-card" style="cursor:default"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Check</p>
    <h2 class="sec-h">${esc(DIAG.title)}</h2>
    <p class="sec-lead">${esc(DIAG.lead)}結果に合わせて、最初に使う資料を提案します。</p>
    <p style="margin-top:18px"><a class="btn primary" href="check/index.html">現在地チェックを始める</a></p>
    <p style="font-size:11.5px;color:var(--ink-3);margin-top:10px">医学的・心理学的な診断ではありません。回答は保存されません。</p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Free</p>
    <h2 class="sec-h">無料で使える資料</h2>
    <p class="sec-lead">すべてページ上でそのまま使えます。コピーして、自分の職場に合わせて書き換えてください。</p>
    <div class="grid c3" style="margin-top:22px">
      ${tpls.slice().sort((a, b) => (a.priority || 99) - (b.priority || 99)).slice(0, 6).map((t) => `
      <a class="tpl-card" href="templates/${t.slug}/index.html">
        <span class="top"><span class="pill-free">FREE</span><span class="badge cat">${esc(catShort(t.categoryId))}</span></span>
        <span class="t">${esc(t.title)}</span>
        <span class="d">${esc(t.summary)}</span>
        <span class="meta"><span class="btn ghost small" style="pointer-events:none">無料で見る</span></span>
      </a>`).join('')}
    </div>
    <p class="sec-more"><a class="btn ghost small" href="templates/index.html">すべての無料資料を見る</a></p>
  </div>
</section>

${packAvailable ? `
<section class="sec">
  <div class="wrap">
    <div class="pack-band">
      <div>
        <p class="eyebrow">Starter Pack</p>
        <h2>${esc(PRODUCT.title)}</h2>
        <p class="lead">${esc(PRODUCT.heading)}。管理業務をゼロから考えずに済むよう、就任からの流れに沿って整理した実務テンプレート集です。</p>
        <div class="price-row">
          <span class="now">${fmtPrice(P.launch)}</span>
          <span class="tax">税込・初期販売価格</span>
        </div>
        <div class="chips"><span>収録${packItems.length}ファイル</span><span>Excel / Word 編集可</span><span>AIプロンプト付き</span><span>決済準備中</span></div>
        <p><a class="btn cta" href="pack/index.html">スターターパックを詳しく見る</a></p>
        <p style="font-size:11.5px;color:var(--band-dim);margin-top:10px">オンライン決済は準備中です。内容とサンプルは商品ページで公開しています。</p>
      </div>
      <div class="inc">
        <div class="h">収録テンプレート(一部)</div>
        <ul>
          <li>新任管理職の最初の30日チェックリスト</li>
          <li>1on1質問シート(定例版)・1on1記録シート</li>
          <li>チーム課題管理表・会議アジェンダ</li>
          <li>上司報告フォーマット(週次・月次・緊急)</li>
          <li>KPI候補整理シート・採用面接評価シート</li>
          <li>管理職90日アクションプラン</li>
        </ul>
        <div class="more">など全${packItems.length}点。<a href="pack/index.html#files" style="text-decoration:underline;color:var(--band-ink)">収録一覧をすべて見る</a></div>
      </div>
    </div>
  </div>
</section>` : ''}

<section class="sec"${packAvailable ? '' : ' style="background:var(--bg-2)"'}>
  <div class="wrap">
    <p class="eyebrow">Professions</p>
    <h2 class="sec-h">職種別に見る</h2>
    <p class="sec-lead">同じ「管理職」でも、最初の壁は職種で違います。</p>
    <div class="grid c3" style="margin-top:22px">
      ${profCards.map(([t, d, href]) => href
        ? `<a class="prof-card" href="${href}"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span><span style="font-size:11.5px;color:var(--blue);font-weight:700;margin-top:2px">くわしく見る</span></a>`
        : `<div class="prof-card plain"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="sec"${packAvailable ? ' style="background:var(--bg-2)"' : ''}>
  <div class="wrap">
    <p class="eyebrow">How to</p>
    <h2 class="sec-h">初めての方へ — 3ステップ</h2>
    <div class="steps" style="margin-top:22px">
      <div class="step"><div class="t">無料チェックで現在地を確認する</div><div class="d">12問のセルフチェックで、いま整えると効きやすい領域を確認します。</div></div>
      <div class="step"><div class="t">必要なシートを一つ使ってみる</div><div class="d">全部やる必要はありません。今週の困りごとに近い1枚から始めてください。</div></div>
      <div class="step"><div class="t">管理の型を少しずつ整える</div><div class="d">記事で進め方を確認しながら、報告・面談・課題管理の型を自分の職場に合わせます。</div></div>
    </div>
    <p class="sec-more"><a href="guide/index.html" class="btn ghost small">使い方をくわしく見る</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow">Articles</p>
    <h2 class="sec-h">記事</h2>
    <div class="grid c2" style="margin-top:22px">
      ${featuredA.map((a) => artCard(a, root)).join('\n      ')}
    </div>
    <p class="sec-more"><a class="btn ghost small" href="articles/index.html">記事をすべて見る</a></p>
  </div>
</section>

<section class="sec" style="background:var(--bg-2)">
  <div class="wrap">
    <p class="eyebrow">Author</p>
    <h2 class="sec-h">作っている人も、臨床しか知らない状態から管理職になりました</h2>
    <div class="author-cols" style="margin-top:20px">
      <div class="col"><div class="h">臨床経験</div><div class="d">理学療法士として病院で臨床・後輩指導・多職種連携を経験。現場の言葉で書いています。</div></div>
      <div class="col"><div class="h">管理職経験</div><div class="d">約40名規模のリハビリ部門をマネジメント。1on1も報告も、教わらないまま現場で覚えました。</div></div>
      <div class="col"><div class="h">医療機関支援</div><div class="d">現在は医療機関の経営支援・業務改善・採用支援に従事。支援先の管理職と一緒に道具を磨いています。</div></div>
    </div>
    <p style="font-size:13px;color:var(--ink-2);margin-top:16px">現場と経営の両方を知る立場から、本当に使う道具だけを残しています。<a href="about/index.html" style="text-decoration:underline">運営者についてくわしく</a></p>
  </div>
</section>

<section class="sec">
  <div class="wrap text-wrap">
    <p class="eyebrow">FAQ</p>
    <h2 class="sec-h">よくあるご質問</h2>
    <div class="faq" style="margin-top:12px">
      <details><summary>Excelやパソコンが苦手でも使えますか</summary><div class="a">使えます。無料テンプレートはページ上でそのまま読め、コピーして使えます。関数の知識は不要で、印刷して手書きでも機能します。</div></details>
      <details><summary>どの職種でも使えますか</summary><div class="a">看護師・リハビリ職・医療事務・訪問看護など医療専門職に共通の構造で作っています。職種で変わる部分(数字・教育項目など)は記入式です。</div></details>
      <details><summary>法人内で共有できますか</summary><div class="a">無料テンプレートは院内・法人内で自由に共有できます。有料パックは1法人内での共有・複数拠点での利用を想定しています。</div></details>
      <details><summary>返金はできますか</summary><div class="a">デジタル資料の性質上、提供後の返金は原則お受けしない方針です。販売開始時に、サンプルを購入前に確認できるようにし、正式な条件を利用規約に明記します。</div></details>
    </div>
    <p class="sec-more"><a class="btn ghost small" href="faq/index.html">すべての質問を見る</a></p>
  </div>
</section>

<div class="closing">
  <div class="wrap">
    <p class="stmt">全部を一度に変える必要はありません<br>まずは、最初の7日で確認することから</p>
    <div class="hero-cta" style="justify-content:center;margin-top:22px">
      <a class="btn cta" href="templates/first-7days-checklist/index.html">最初の7日チェックリストを見る(無料)</a>
      <a class="btn ghost" href="check/index.html">管理職の現在地を確認する(無料)</a>
    </div>
  </div>
</div>

<section class="sec" style="padding-top:28px">
  <div class="wrap text-wrap">
    <div class="notice">
      <div class="h">ご利用にあたって</div>
      本サイトの資料は管理業務の整理を助けるひな形であり、労務・法律・医療・人事の専門判断を代替しません。就業規則や法人規程に関わる判断は専門部署・専門家へ、メンタル不調やハラスメントに関わる対応は自己判断だけで進めず、上司・人事・産業医・専門窓口へ相談してください。くわしくは<a href="legal/disclaimer.html" style="text-decoration:underline">免責事項</a>をご覧ください。
    </div>
  </div>
</section>`;

  out('index.html', page({
    path: 'index.html',
    title: '',
    isHome: true,
    description: SITE.description,
    pageId: 'home',
    event: E.PAGE_VIEW,
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
   現在地チェック
   ================================================================ */
{
  const root = '../';
  /* 結果からおすすめする資料のカードを事前に描画しておく(JSが結果画面で流用) */
  const recTplIds = [...new Set(DIAG.results.flatMap((r) => r.recommendedTemplateIds || []))];
  const recArtIds = [...new Set(DIAG.results.flatMap((r) => r.recommendedArticleIds || []))];
  const recHtml = recTplIds.map((id) => {
    const t = tplById(id);
    return t ? tplCard(t, root).replace('<a class="tpl-card"', `<a data-tpl="${t.id}" class="tpl-card"`) : '';
  }).join('') + recArtIds.map((id) => {
    const a = artById(id);
    return a ? artCard(a, root, ` data-art="${a.id}"`) : '';
  }).join('');

  const body = `
${breadcrumbs(root, [[DIAG.title, null]])}
<div class="wrap page-head" style="border-bottom:none">
  <p class="eyebrow">Self Check</p>
  <h1>${esc(DIAG.title)}</h1>
  <p class="lead">${esc(DIAG.lead)}</p>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div id="diagApp" data-root="${root}">
    <div class="diag-box" style="text-align:center">
      <p style="font-size:13.5px;color:var(--ink-2);line-height:2;margin-bottom:6px">質問は12問、選択肢は「できている/一部できている/まだできていない」の3つです。正直に選ぶほど、結果が使いものになります。</p>
      <button class="btn primary" id="diagStart" style="margin-top:12px">チェックを始める(約3分)</button>
    </div>
    <p class="diag-note">${esc(DIAG.notice)}</p>
  </div>
  <noscript><p style="font-size:13px;color:var(--ink-3);max-width:640px;margin:20px auto">このチェックの実行にはJavaScriptが必要です。質問の一覧は<a href="${root}guide/index.html" style="text-decoration:underline">初めての方へ</a>からもご覧いただけます。</p></noscript>
  <div id="diagRec" hidden aria-hidden="true"><div class="grid c2">${recHtml}</div></div>
</div>`;
  out('check/index.html', page({
    path: 'check/index.html',
    title: DIAG.title,
    description: '新任管理職向けのセルフチェック(12問・約3分)。現状把握・対話・仕組み・数字の4領域で現在地を確認し、最初に使う資料を提案します。登録不要・結果は保存されません。',
    pageId: 'diagnosis',
    event: E.PAGE_VIEW,
    body,
    ld: [breadcrumbLd([[DIAG.title, 'check/index.html']])],
  }));
}

/* ================================================================
   テンプレート一覧
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
  <p class="lead">公開中のテンプレートです。すべて無料で、ページ上でそのまま使えます。${packAvailable ? 'まとめて使うならスターターパックもご覧ください。' : ''}</p>
</div>
<div class="wrap">
  <div class="filters" aria-label="絞り込み">
    <div class="frow">
      <span class="flabel">テーマ</span>
      ${chip('cat', 'all', 'すべて', true)}
      ${usedCats.map((c) => chip('cat', c.id, c.short)).join('')}
    </div>
    <div class="frow">
      <span class="flabel">検索</span>
      <input type="search" id="fQ" placeholder="例: 1on1 / 報告 / 会議" aria-label="キーワードで絞り込む">
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
      <summary>くわしい条件(職種・管理職歴・形式)</summary>
      <div class="frow" style="margin-top:10px">
        <label class="flabel" for="f-prof">職種</label>
        <select id="f-prof"><option value="">指定しない</option>${PROFESSIONS.filter((p) => p.id !== 'all').map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('')}</select>
        <label class="flabel" for="f-exp">管理職歴</label>
        <select id="f-exp"><option value="">指定しない</option>${EXPERIENCE.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join('')}</select>
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
  <p style="font-size:12px;color:var(--ink-3);margin:26px 0 40px">${packAvailable ? `20種の実務シート一式は<a href="${root}pack/index.html" style="text-decoration:underline">スターターパック</a>にまとめています(決済準備中)。` : '案件全体をまとめて整える有料パックは準備中です。'}施設運営・行政手続きの資料は<a href="${root}../medops/index.html" style="text-decoration:underline">${esc(SITE.sibling.name)}</a>にあります。</p>
</div>`;
  out('templates/index.html', page({
    path: 'templates/index.html',
    title: 'テンプレート一覧',
    description: '医療専門職の新任管理職向けテンプレート一覧。7日チェックリスト・初回1on1質問シート・課題整理・上司報告フォーマットなどを、テーマ・職種・管理職歴で絞り込めます。',
    pageId: 'templates',
    event: E.PAGE_VIEW,
    body,
    ld: [breadcrumbLd([['テンプレート', 'templates/index.html']])],
  }));
}

/* ================================================================
   テンプレート詳細(無料)
   ================================================================ */
for (const t of tpls) {
  const root = '../../';
  const path = `templates/${t.slug}/index.html`;
  const body = `
${breadcrumbs(root, [['テンプレート', 'templates/index.html'], [t.shortTitle || t.title, null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:0">
  <p><span class="badge free">無料</span> <span class="badge cat">${esc(catName(t.categoryId))}</span></p>
  <h1>${esc(t.title)}</h1>
  <p class="lead">${esc(t.summary)}</p>
  <div class="meta-bar">
    <span>バージョン <b>${esc(t.version)}</b></span>
    <span>公開 <b>${dateJp(t.publishedAt)}</b></span>
    <span>更新 <b>${dateJp(t.updatedAt)}</b></span>
  </div>
</div>
<div class="wrap detail">
  <div class="prose">
    <p>${esc(t.description)}</p>
    ${contentHtml(t)}
  </div>
  <aside class="detail-side" aria-label="資料情報">
    <div class="buy-card">
      <span class="badge free" style="align-self:flex-start">無料</span>
      <p class="note">登録なしで使えます。内容をコピーし、職場に合わせて編集してください。Excel・Word版のダウンロード提供は準備中です。</p>
      ${packAvailable ? `<a class="btn primary" href="${root}pack/index.html">20種まとめて使う: スターターパック</a>` : ''}
      <a class="btn ghost" href="${root}templates/index.html">他のテンプレートを探す</a>
    </div>
    <div class="side-box">
      <div class="h">この資料について</div>
      <dl>
        <dt>テーマ</dt><dd>${esc(catName(t.categoryId))}</dd>
        <dt>対象</dt><dd>${(t.targetProfessions || []).map((p) => esc(profLabel(p))).join('、')}</dd>
        <dt>管理職歴</dt><dd>${(t.experience || []).map((e) => esc(expLabel(e))).join('、')}</dd>
        <dt>形式</dt><dd>${(t.formats || []).map((f) => esc(formatLabel(f))).join('、')}</dd>
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
    event: E.FREE_TPL_VIEW,
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
   スターターパック詳細(status=published のときのみ生成)
   ================================================================ */
if (packAvailable) {
  const root = '../';
  const path = 'pack/index.html';
  const groups = [...new Set(packItems.map((i) => i.packCategory))];
  const body = `
${breadcrumbs(root, [[PRODUCT.shortTitle, null]])}
<div class="pack-hero">
  <div class="wrap">
    <p><span class="badge paid">有料</span> <span class="badge prep">決済準備中</span></p>
    <p class="eyebrow" style="margin-top:10px">${esc(PRODUCT.title)}</p>
    <h1 style="font-size:clamp(21px,3.4vw,30px);font-weight:700;margin-top:8px">${esc(PRODUCT.heading)}</h1>
    <p class="lead" style="font-size:13.5px;color:var(--ink-2);margin-top:10px;max-width:var(--text-max)">${esc(PRODUCT.shortDescription)}</p>
    <div class="pack-meta">
      <span>収録 <b>${packItems.length}ファイル</b></span>
      <span>形式 <b>Excel・Word(スプレッドシート取込可)</b></span>
      <span>価格 <b>${fmtPrice(P.launch)}</b> <span style="color:var(--ink-3)">税込・初期販売価格</span></span>
      <span>更新 <b>${dateJp(PRODUCT.updatedAt)}</b></span>
    </div>
  </div>
</div>
<div class="wrap detail">
  <div class="prose">
    <p>${esc(PRODUCT.longDescription)}</p>
    <h2 id="target">このような人向け</h2>
    <ul>${PRODUCT.targetUsers.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="problems">こんな状態のときに</h2>
    <ul>${PRODUCT.problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="outcomes">このパックでできること</h2>
    <ul>${PRODUCT.outcomes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="files">含まれるファイル(全${packItems.length}点)</h2>
    ${groups.map((g) => `
    <div class="pack-group">
      <div class="h">${esc(g)}</div>
      <ul class="files">
        ${packItems.filter((i) => i.packCategory === g).map((i, n) => `<li><span class="n">${String(n + 1).padStart(2, '0')}</span><span class="fn">${esc(i.title)}</span><span class="fp">${esc(i.purpose)} / 使うタイミング: ${esc(i.timing)}</span><span class="chip">${(i.formats || []).map(formatLabel).map(esc).join('・')}</span></li>`).join('\n        ')}
      </ul>
    </div>`).join('')}
    <h2 id="sample">サンプル</h2>
    <div class="sample-kv">
      <div class="cap">${esc(PRODUCT.sample.title)} — ${esc(PRODUCT.sample.note)}</div>
      <dl>${PRODUCT.sample.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    </div>
    <p>無料テンプレート(<a href="${root}templates/first-7days-checklist/index.html">7日チェックリスト</a>・<a href="${root}templates/boss-report-format/index.html">上司報告フォーマット</a>など)が、そのまま各シートの縮小版になっています。まず無料版で使い勝手を確かめてください。</p>
    <h2 id="flow">利用イメージ — 購入後の流れ</h2>
    <ol>${PRODUCT.usageFlow.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    <h2 id="byprof">職種別の使い方</h2>
    <ul>${PRODUCT.byProfession.map((x) => `<li><strong>${esc(x.label)}</strong> — ${esc(x.d)}</li>`).join('')}</ul>
    <h2 id="notincluded">このパックに含まれないもの</h2>
    <ul>${PRODUCT.notIncluded.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h2 id="faq">よくある質問</h2>
    <div class="faq">
      ${PRODUCT.faq.map((f) => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('\n      ')}
    </div>
    <h2 id="license">利用条件</h2>
    <ul>
      <li>利用範囲: ${esc(PRODUCT.license.scope)}</li>
      <li>再配布・転売・SNS等への転載: できません</li>
      <li>テンプレートの編集・職場規程に合わせた改変: できます(むしろ前提です)</li>
    </ul>
    <div class="notice"><div class="h">ご利用にあたって</div>本パックは管理業務の整理を支援するひな形であり、労務・法律・人事制度の専門判断を代替しません。記入する職員情報は必要最小限にし、保管場所の閲覧範囲を確認してください。生成AIに職員の個人情報を入力しないでください。</div>
  </div>
  <aside class="detail-side" aria-label="価格と購入">
    <div class="buy-card">
      <span><span class="badge paid">有料</span> <span class="badge prep">決済準備中</span></span>
      <div>
        <div class="price-now">${fmtPrice(P.launch)} <small>税込・初期販売価格</small></div>
      </div>
      <button class="btn primary" data-buy="${PRODUCT.id}">購入方法を問い合わせる</button>
      <a class="btn ghost" href="#sample">サンプルを確認する</a>
      <p class="note">オンライン決済は準備中です。先行して利用したい場合は、お問い合わせから連絡してください。個別に案内します。</p>
    </div>
    <div class="side-box">
      <div class="h">この商品について</div>
      <dl>
        <dt>収録</dt><dd>${packItems.length}ファイル</dd>
        <dt>形式</dt><dd>Excel・Word</dd>
        <dt>バージョン</dt><dd>${esc(PRODUCT.version)}</dd>
        <dt>更新</dt><dd>${dateJp(PRODUCT.updatedAt)}</dd>
        <dt>更新版</dt><dd>購入から1年間利用(方針)</dd>
      </dl>
    </div>
  </aside>
</div>
${relatedSection(root, ['first-7days', 'first-oneonone-questions', 'boss-report-format'], ['first-30days-manager'])}
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
    description: PRODUCT.shortDescription + ' 収録' + packItems.length + 'ファイル・' + fmtPrice(P.launch) + '(税込・初期価格・決済準備中)。',
    pageId: 'pack',
    event: E.PRODUCT_VIEW,
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
   記事一覧・記事詳細
   ================================================================ */
{
  const root = '../';
  const cats = CATEGORIES.filter((c) => arts.some((a) => a.categoryId === c.id));
  const body = `
${breadcrumbs(root, [['記事', null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:6px">
  <p class="eyebrow">Articles</p>
  <h1>記事一覧</h1>
  <p class="lead">管理業務の進め方を、結論と「今週やること」から書いています。読み終えたときに次の行動が決まる構成を目指しています。</p>
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
    description: '医療専門職の新任管理職向けの記事一覧。最初の30日、初めての1on1、上司報告、課題管理、任せ方などを、結論と今週やることから解説します。',
    pageId: 'articles',
    event: E.ARTICLE_VIEW,
    body,
    ld: [breadcrumbLd([['記事', 'articles/index.html']])],
  }));
}

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
    event: E.ARTICLE_VIEW,
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
   初めての方へ
   ================================================================ */
{
  const root = '../';
  const body = `
${breadcrumbs(root, [['初めての方へ', null]])}
<div class="wrap page-head">
  <p class="eyebrow">Guide</p>
  <h1>初めての方へ</h1>
  <p class="lead">このサイトができること・できないことと、最初の使い方をまとめています。</p>
</div>
<div class="wrap text-wrap prose" style="padding-bottom:50px">
  <h2>このサイトが生まれた理由</h2>
  <p>運営者自身が、理学療法士として臨床だけをしてきた状態から管理職になり、1on1も報告も会議も、誰にも教わらないまま始めた経験があります。書籍は一般企業向けで自分の職場に当てはめられず、研修を受ける時間もない。そのとき欲しかった「そのまま使える道具」を、いまの経営支援の実務で使っている形に整えて公開しています。</p>
  <h2>誰向けか</h2>
  <p>看護師・リハビリ職・医療事務・訪問看護師などの医療専門職から、初めて管理職(主任・リーダー・師長・部門責任者・管理者)になった方、または就任を控えている方が主な対象です。就任から時間が経っていても、管理方法を整理し直したい方に使えます。</p>
  <h2>誰向けではないか</h2>
  <ul>
    <li>経営幹部向けの経営戦略や、大企業の管理職研修を探している方</li>
    <li>人事評価制度・勤怠管理システムそのものを探している方</li>
    <li>労務・法律の個別判断を求めている方(専門家への相談が必要です)</li>
  </ul>
  <h2>最初に何を使えばよいか</h2>
  <ol>
    <li><strong>状況を知りたい</strong> — <a href="${root}check/index.html">現在地チェック</a>(12問・約3分)で、いま整えると効きやすい領域を確認してください。</li>
    <li><strong>明日の予定が決まっている</strong> — 明日1on1があるなら<a href="${root}templates/first-oneonone-questions/index.html">初回1on1質問シート</a>、報告があるなら<a href="${root}templates/boss-report-format/index.html">上司報告フォーマット</a>と、直近の予定から逆引きしてください。</li>
    <li><strong>就任したばかり</strong> — <a href="${root}templates/first-7days-checklist/index.html">最初の7日チェックリスト</a>から順番にどうぞ。</li>
  </ol>
  <h2>無料と有料の違い</h2>
  <p>無料テンプレートは、各テーマの入口になる1枚もので、ページ上でそのまま使えます。${packAvailable ? `有料の<a href="${root}pack/index.html">スターターパック</a>は、20種の実務シートを就任からの流れに沿って一式にしたものです(オンライン決済は準備中のため、当面はお問い合わせから個別に案内します)。` : '有料のスターターパックは準備中です。'}会員プランの構想は<a href="${root}pricing/index.html">プランのページ</a>にまとめています。</p>
  <h2>テンプレートの使い方</h2>
  <ol>
    <li>関連する記事で、進め方の全体像を確認する</li>
    <li>テンプレートをコピーし、自分の職場に合わせて項目を書き換える(削るのも編集です)</li>
    <li>1〜2週間使ってみて、続かない項目は減らす</li>
  </ol>
  <h2>管理職業務は職場ごとに違います</h2>
  <p>同じ役職名でも、任される範囲は法人・施設ごとに大きく異なります。テンプレートの項目はあくまでひな形です。自分の職場の規程・慣行・上司の期待に合わせて調整し、判断に迷う場合は上司へ確認してください。</p>
  <h2>専門家への確認が必要なこと</h2>
  <p>労務(労働時間・処遇・懲戒など)、法律、医療上の判断、ハラスメントへの対応、メンタル不調が疑われる職員への対応は、このサイトの資料だけで判断せず、所属法人の担当部署・社会保険労務士・産業医・専門窓口へ相談してください。緊急性がある場合は、まず上司と人事へ。</p>
  <h2>個人情報の取り扱いとAI利用</h2>
  <p>面談記録やメンバー情報には個人情報が含まれます。記入は業務に必要な最小限にし、保管場所の閲覧範囲を確認してください。生成AIを使う場合は、職員の実名・評価・健康情報・患者情報を入力しないでください。線引きの決め方は<a href="${root}templates/ai-rules-for-managers/index.html">AI利用ルール(1枚版)</a>にまとめています。</p>
</div>`;
  out('guide/index.html', page({
    path: 'guide/index.html',
    title: '初めての方へ',
    description: SITE.name + 'の使い方。誰向けのサービスか、最初に何を使えばよいか、無料と有料の違い、個人情報とAI利用の注意をまとめています。',
    pageId: 'guide',
    body,
    ld: [breadcrumbLd([['初めての方へ', 'guide/index.html']])],
  }));
}

/* ================================================================
   運営者について
   ================================================================ */
{
  const root = '../';
  const body = `
${breadcrumbs(root, [['運営者について', null]])}
<div class="wrap page-head">
  <p class="eyebrow">About</p>
  <h1>運営者について</h1>
  <p class="lead">${esc(SITE.name)}は、${esc(SITE.parent.name)}(運営: 橋本渉)が個人で運営しています。</p>
</div>
<div class="wrap text-wrap prose" style="padding-bottom:50px">
  <h2>臨床しか知らない状態から、管理職になりました</h2>
  <p>私は理学療法士です。病院で臨床を続けるなかでチームの責任者になり、最終的に約40名規模の部門のマネジメントをしていました。管理職としての研修は受けていません。1on1も、会議の回し方も、上司への報告も、業務分担も、やりながら覚えました。</p>
  <p>最初の頃の失敗はひととおり経験しています。面談が雑談で終わる。課題を口頭で管理して、問題が大きくなってから気づく。自分でやった方が早いと引き取り続けて、自分が休むと止まるチームを作る。上司から「もっと早く相談して」と言われる。このサイトの資料は、その失敗から作った道具が原型です。</p>
  <h2>いまの仕事</h2>
  <p>現在は医療機関の経営支援を仕事にしています。クリニックや訪問診療の業務改善、採用・面接の設計、業務分担の整理、管理職の伴走支援など、立場を変えていまも管理の実務に触れ続けています。看護・医療事務・訪問看護の管理職の方々とは、この経営支援の立場で一緒に働いてきました。自分が当事者だったのはリハビリ部門の管理職で、他職種については伴走者としての経験に基づいています。この立場の違いは、各資料でも正直に書くようにしています。</p>
  <h2>情報提供の方針</h2>
  <ul>
    <li>精神論やリーダー論ではなく、記入して使える道具の形で提供します</li>
    <li>断定しすぎません。管理職業務は職場ごとに違うため、資料は編集して使う前提です</li>
    <li>労務・法律・メンタルヘルスは専門家の領域です。資料には確認先を書き、代替しません</li>
    <li>生成AIも使いますが、一般論のまま公開せず、実務で通用した粒度に直してから出します</li>
  </ul>
  <h2>${esc(SITE.parent.name)}について</h2>
  <p>${esc(SITE.parent.name)}は「人が、自ら選び、納得して生きられる社会をつくる」ための個人プロジェクトです。このサイトはその道具のひとつで、新任管理職が管理の仕方を自分で選べる状態をつくることを目指しています。施設運営・行政手続きの実務は姉妹サイト<a href="${root}../medops/index.html">${esc(SITE.sibling.name)}</a>で扱っています。<a href="${root}../about/index.html">プロジェクト全体について</a>もご覧ください。</p>
</div>`;
  out('about/index.html', page({
    path: 'about/index.html',
    title: '運営者について',
    description: SITE.name + 'の運営者について。理学療法士として約40名規模のチームマネジメントを経験し、現在は医療機関の経営支援・業務改善に携わっています。',
    pageId: 'about',
    body,
    ld: [breadcrumbLd([['運営者について', 'about/index.html']])],
  }));
}

/* ================================================================
   FAQ
   ================================================================ */
{
  const root = '../';
  const faqs = [
    ['管理職になる前でも使えますか', '使えます。「管理職就任前に確認したい10項目」は打診を受けた段階向けです。就任前に7日チェックリストへ目を通しておくと、初週の動きが変わります。'],
    ['医療職以外でも使えますか', '介護・福祉など近い領域であれば多くの資料は使えます。ただし例や数字は医療現場を前提にしているため、読み替えが必要です。'],
    ['看護師とリハビリ職で同じ資料を使えますか', '使えます。シートの構造は職種共通で、職種によって変わる部分は記入式にしています。'],
    ['Excelが苦手でも使えますか', '使えます。無料テンプレートはページ上でそのまま読め、コピーして使えます。関数の知識は不要で、印刷して手書きでも機能します。'],
    ['スマートフォンだけで利用できますか', 'できます。全ページをスマートフォン前提で作っています。シートに記入する段階では、印刷またはPCでの編集が現実的です。'],
    ['テンプレートは編集できますか', 'できます。むしろ職場の規程・実態に合わせて編集して使う前提です。項目を削ることも編集です。'],
    ['法人内で共有できますか', '無料テンプレートは院内・法人内で自由に共有できます。有料パックは1法人内での共有・複数拠点での利用を想定しています(法人外への配布・転売は不可)。'],
    ['人事評価へそのまま使えますか', 'そのままは使えません。評価制度は法人ごとに定められているためです。面談記録や業務分担表は、評価の際の事実確認の材料として使えます。'],
    ['1on1記録へ個人情報を書いてもよいですか', '業務に必要な最小限に留めてください。健康・家庭の情報は、本人が業務調整のために共有した事実のみを必要最小限で記録し、保管場所の閲覧範囲を確認する運用をおすすめします。'],
    ['AIへ部下の情報を入力してよいですか', '入力しないでください。職員の実名・評価・健康情報・面談記録は入力禁止が原則です。固有名詞を置き換えた抽象的な形での利用方法をAI利用ルール(1枚版)にまとめています。'],
    ['管理職の悩みを個別相談できますか', 'このサイト自体は資料の提供サービスですが、運営者は医療機関の経営支援を本業としています。個別支援の相談は' + SITE.parent.name + 'の「仕事のご依頼」からどうぞ。'],
    ['更新版は利用できますか', '有料パックは購入から1年間、更新版を追加費用なしで利用できる方針です。提供方法は販売開始時に案内します。'],
    ['返金はできますか', 'デジタル資料の性質上、提供後の返金は原則お受けしない方針です。販売開始時に、サンプルと「含まれないもの」を購入前に確認できるようにし、正式な条件を利用規約に明記します。'],
    ['法人契約はできますか', '法人プランを構想中です。新任管理職教育への利用を先行して相談したい場合は、お問い合わせからご連絡ください。'],
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
    description: SITE.name + 'のよくある質問。対象者、テンプレートの編集・法人内共有、1on1記録の個人情報、AI利用の線引きなどをまとめています。',
    pageId: 'faq',
    body,
    ld: [breadcrumbLd([['よくある質問', 'faq/index.html']]), {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    }],
  }));
}

/* ================================================================
   料金(ナビ非掲載。ガイド・パックからの導線のみ)
   ================================================================ */
{
  const root = '../';
  const plans = SITE.pricing.plans;
  const body = `
${breadcrumbs(root, [['プランと料金', null]])}
<div class="wrap page-head">
  <p class="eyebrow">Pricing</p>
  <h1>プランと料金の考え方</h1>
  <p class="lead">現在使えるのは無料コンテンツです。スターターパックは決済準備中、会員・法人プランは構想段階のため、内容と価格は変わる可能性があります。</p>
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
      <div class="h">スターターパックは決済準備中です</div>
      いま使える資料は<a href="${root}templates/index.html" style="text-decoration:underline">無料テンプレート</a>と記事です。${packAvailable ? `スターターパックの内容は<a href="${root}pack/index.html" style="text-decoration:underline">商品ページ</a>で公開しており、先行利用の相談は<a href="${root}../community/index.html" style="text-decoration:underline">お問い合わせ</a>で受け付けています。` : ''}開始時期・確定価格は決まり次第、このページと${esc(SITE.parent.name)}のnote・Xで告知します。
    </div>
  </div>
</div>`;
  out('pricing/index.html', page({
    path: 'pricing/index.html',
    title: 'プランと料金',
    description: SITE.name + 'の料金の考え方。無料コンテンツ、スターターパック(準備中)、個人会員・法人プラン(構想中)について説明します。',
    pageId: '',
    event: E.PRICING_VIEW,
    body,
    ld: [breadcrumbLd([['プランと料金', 'pricing/index.html']])],
  }));
}

/* ================================================================
   職種別ページ
   ================================================================ */
for (const pr of profs) {
  const root = '../../';
  const path = `professions/${pr.slug}/index.html`;
  const others = profs.filter((x) => x.id !== pr.id);
  const recT = (pr.recommendedTemplateIds || []).map(tplById).filter(Boolean);
  const recA = (pr.recommendedArticleIds || []).map(artById).filter(Boolean);
  const body = `
${breadcrumbs(root, [['職種別', null], [pr.title, null]])}
<div class="wrap page-head" style="border-bottom:none;padding-bottom:0">
  <p class="eyebrow">Professions</p>
  <h1>${esc(pr.heading)}</h1>
  <p class="standpoint">${esc(pr.standpointText)}</p>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div class="text-wrap prose">
    <p>${esc(pr.background)}</p>
    <h2>よくある悩み</h2>
  </div>
  <div class="rows text-wrap" style="margin:12px 0 6px">
    ${pr.pains.map((p, i) => `<div class="row"><span class="m">${String(i + 1).padStart(2, '0')}</span><span class="b">${esc(p)}</span></div>`).join('\n    ')}
  </div>
  <div class="text-wrap prose">
    <h2>最初に確認すること</h2>
    <ol>${pr.firstChecks.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
    ${packAvailable && pr.packNote ? `<h2>スターターパックの使い方</h2><p>${esc(pr.packNote)}<a href="${root}pack/index.html" style="text-decoration:underline">パックの内容を見る</a></p>` : ''}
    <h2>よくある質問</h2>
    <div class="faq">
      ${(pr.faq || []).map((f) => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('\n      ')}
    </div>
  </div>
  <section class="related">
    <div class="h">まず使う無料テンプレート</div>
    <div class="grid c2">${recT.map((t) => tplCard(t, root)).join('')}</div>
    <div class="h" style="margin-top:22px">あわせて読む記事</div>
    <div class="grid c2">${recA.map((a) => artCard(a, root)).join('')}</div>
  </section>
  <p style="font-size:13px;margin-top:26px">ほかの職種: ${others.map((o) => `<a class="fchip" style="display:inline-flex;margin:3px 4px 3px 0" href="${root}professions/${o.slug}/index.html">${esc(o.title)}</a>`).join('')}</p>
</div>`;
  out(path, page({
    path,
    title: pr.title,
    description: pr.seoDescription,
    pageId: 'templates',
    event: E.PROFESSION_VIEW,
    body,
    ld: [breadcrumbLd([[pr.title, path]]), (pr.faq && pr.faq.length) ? {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: pr.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    } : null],
  }));
}

/* ================================================================
   法人・教育担当の方へ
   ================================================================ */
{
  const root = '../';
  const points = [
    ['新任管理職教育の共通の型になる', '管理職ごとにばらついていた1on1・会議・報告のやり方を、同じシートと言葉で揃えられます。'],
    ['配布して終わらない', '読む教材ではなく記入して使うシートなので、研修後にそのまま現場の運用に残ります。'],
    ['職種横断で使える', '看護・リハビリ・医療事務・訪問看護に共通の構造で、職種で変わる部分は記入式です。'],
    ['研修の事前・事後課題に使える', '現在地チェック(12問)を事前課題に、就任後の振り返りシートを事後課題にする使い方ができます。'],
  ];
  const body = `
${breadcrumbs(root, [['法人・教育担当の方へ', null]])}
<div class="wrap page-head">
  <p class="eyebrow">For Organizations</p>
  <h1>法人・教育担当の方へ</h1>
  <p class="lead">病院・医療法人・訪問看護/介護事業者・リハビリ部門で、新任管理職の教育を担当されている方向けのご案内です。</p>
</div>
<div class="wrap" style="padding-bottom:50px">
  <div class="text-wrap prose">
    <p>新任管理職が増えても、研修を毎回外注する予算はない。研修をしても、現場で何を実践するかまで落ちない。管理職によって基礎知識に差があり、1on1や評価の品質がばらつく——法人の教育担当の方から伺う悩みは、おおむねこの3つに集約されます。本サイトの資料は、この「研修と現場のあいだ」を埋めるために使えます。</p>
  </div>
  <div class="grid c2" style="margin:22px 0">
    ${points.map(([t, d]) => `<div class="cat-card" style="cursor:default"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></div>`).join('\n    ')}
  </div>
  <div class="text-wrap prose">
    <h2>利用の形</h2>
    <ul>
      <li><strong>いますぐ(無料)</strong> — 無料テンプレートと記事は法人内で自由に共有できます。新任管理職に<a href="${root}templates/first-7days-checklist/index.html">7日チェックリスト</a>と<a href="${root}check/index.html">現在地チェック</a>を案内するところから始められます。</li>
      ${packAvailable ? `<li><strong>スターターパック(決済準備中)</strong> — 20種の実務シート一式。法人購入では1法人内の共有・複数拠点での利用を想定しています。<a href="${root}pack/index.html">内容はこちら</a>。</li>` : ''}
      <li><strong>法人プラン(構想中)</strong> — 複数名利用・研修利用・導入ガイドを含む年間契約を構想しています(<a href="${root}pricing/index.html">料金の考え方</a>)。内容は導入のご相談をいただきながら固めていく段階です。</li>
    </ul>
    <h2>お引き受けできないこと</h2>
    <ul>
      <li>人事評価制度の設計・労務判断の代行(専門家の領域です)</li>
      <li>既製の集合研修パッケージの販売(現時点では提供していません)</li>
    </ul>
    <p>導入を急ぐ必要はありません。まず無料テンプレートを新任管理職の方に配って、現場の反応を見るだけでも十分です。</p>
    <p style="margin-top:18px"><a class="btn primary" href="${root}../community/index.html">法人利用について問い合わせる</a></p>
    <p style="font-size:12px;color:var(--ink-3)">お問い合わせは${esc(SITE.parent.name)}の窓口で受け付けています。法人名・想定人数・使いたい場面をお書き添えください。</p>
  </div>
</div>`;
  out('corporate/index.html', page({
    path: 'corporate/index.html',
    title: '法人・教育担当の方へ',
    description: '病院・医療法人・訪問看護/介護事業者向け。新任管理職教育の共通の型として、1on1・会議・上司報告のシートを法人内で活用いただけます。複数名利用のご相談も受付中。',
    pageId: '',
    event: E.CORP_INQUIRY,
    body,
    ld: [breadcrumbLd([['法人・教育担当の方へ', 'corporate/index.html']])],
  }));
}

/* ================================================================
   法務3枚(medopsと同一水準の仮文面。専門家確認は両サイト分を
   1回で行う——台帳の申し送り参照)
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
<!-- 仮文面。本番公開(決済開始)前に弁護士等の専門家確認が必要(medops法務3枚と同時に) -->
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
<p>本サービスは、医療機関等の管理職業務に関する記事・テンプレート・セルフチェック等を提供するものです。コンテンツは一般的な実務の整理であり、労務・法律・医療・人事に関する専門判断を提供するものではありません。</p>
<h2>第2条(知的財産権と利用範囲)</h2>
<ul>
<li>本サービスのコンテンツの著作権は当方に帰属します。</li>
<li>無料テンプレートは、利用者の所属する施設・法人内での業務利用の範囲で、複製・編集して利用できます。</li>
<li>有料コンテンツは、購入時に示す利用条件(個人購入=購入者の所属施設内、法人購入=1法人内)の範囲で利用できます。</li>
<li>形式を問わず、第三者への再配布・転売・公衆送信(SNS・ブログ等への転載を含む)はできません。</li>
</ul>
<h2>第3条(禁止事項)</h2>
<ul>
<li>コンテンツの再配布・転売・翻案物の販売</li>
<li>本サービスの運営を妨害する行為</li>
<li>法令または公序良俗に反する利用</li>
</ul>
<h2>第4条(セルフチェックの位置づけ)</h2>
<p>本サービスのセルフチェックは、管理職業務の整理を目的とするものであり、医学的・心理学的な診断ではありません。回答内容は利用者の端末上で処理され、当方は取得しません。</p>
<h2>第5条(有料コンテンツ)</h2>
<p>有料コンテンツの価格・提供方法・返金条件は、各商品ページおよび決済時の案内に定めます。オンライン決済の開始時に、特定商取引法に基づく表記を本サービス上に掲載します。</p>
<h2>第6条(免責)</h2>
<p>当方は、コンテンツの正確性・最新性・特定目的への適合性を保証しません。コンテンツの利用により生じた損害について、当方は故意または重過失がある場合を除き責任を負いません。くわしくは<a href="disclaimer.html">免責事項</a>をご覧ください。</p>
<h2>第7条(規約の変更)</h2>
<p>本規約は必要に応じて変更することがあります。重要な変更は本サービス上で告知します。</p>`);

legalPage('privacy.html', 'プライバシーポリシー',
  SITE.name + 'のプライバシーポリシー。取得する情報と利用目的について定めています。', `
<p>${esc(SITE.parent.name)}(以下「当方」)は、「${esc(SITE.name)}」(以下「本サービス」)における利用者の情報を、次のとおり取り扱います。</p>
<h2>1. 現在取得している情報</h2>
<ul>
<li><strong>表示設定(ライト/ダークテーマ等)</strong> — お使いの端末のローカルストレージにのみ保存され、外部には送信されません。</li>
<li><strong>セルフチェックの回答</strong> — 端末上でのみ処理され、保存も送信もされません。</li>
<li><strong>お問い合わせ内容</strong> — お問い合わせは${esc(SITE.parent.name)}の窓口を通じて受け付け、回答のためにのみ利用します。</li>
</ul>
<p>本サービスは現時点で、アクセス解析ツール・広告配信・会員登録の仕組みを導入していません。</p>
<h2>2. 今後導入する場合の方針</h2>
<p>アクセス解析・会員機能・決済を導入する場合は、取得する情報・利用目的・委託先を本ポリシーに追記してから運用を開始します。</p>
<h2>3. 利用者への注意</h2>
<p>テンプレートに記入する職員・患者の情報を本サービスへ送信する必要はありません。生成AIと組み合わせて利用する場合は、個人情報を入力しないでください。</p>
<h2>4. お問い合わせ</h2>
<p>本ポリシーに関する連絡は、<a href="../../community/index.html">${esc(SITE.parent.name)}のお問い合わせ</a>からお願いします。</p>`);

legalPage('disclaimer.html', '免責事項',
  SITE.name + 'の免責事項。情報の性質と、利用にあたって確認が必要な事項をまとめています。', `
<h2>1. 情報の性質</h2>
<p>本サービスの記事・テンプレート・セルフチェックは、管理職業務に関する一般的な進め方を整理したものです。労務・法律・医療・人事に関する助言ではなく、内容の正確性・完全性・最新性を保証するものでもありません。</p>
<h2>2. 専門判断が必要な事項</h2>
<p>労働時間・処遇・懲戒などの労務判断、法令の解釈、ハラスメントへの対応、メンタル不調が疑われる職員への対応は、本サービスの資料だけで判断せず、所属法人の規程と担当部署、社会保険労務士・弁護士・産業医等の専門家に確認してください。緊急性がある場合は、上司・人事・専門窓口へすみやかに相談してください。</p>
<h2>3. テンプレートの利用</h2>
<p>テンプレートは職場の規程に合わせて編集して利用する前提のひな形です。利用の結果について、当方は故意または重過失がある場合を除き責任を負いません。記入する職員情報は必要最小限とし、保管・共有の範囲は各法人の規程に従ってください。</p>
<h2>4. セルフチェックについて</h2>
<p>本サービスのセルフチェックは管理職業務の整理を目的としたもので、医学的・心理学的な診断ではありません。結果は目安であり、人事上の判断・評価の根拠として利用しないでください。</p>
<h2>5. 生成AIの利用について</h2>
<p>本サービスの資料を生成AIと組み合わせて利用する場合、職員の実名・評価・健康情報、患者情報、公表前の経営情報を入力しないでください。AIの出力をそのまま人事判断に利用しないでください。</p>`);

/* ================================================================
   sitemap.xml のマーカー区間を更新
   ================================================================ */
{
  const sitemapPath = join(repo, 'sitemap.xml');
  let xml = readFileSync(sitemapPath, 'utf8');
  const START = '  <!-- manager-starter:auto:start (scripts/manager-starter/build.mjs が生成。手で編集しない) -->';
  const END = '  <!-- manager-starter:auto:end -->';
  const urls = written
    .filter((p) => p.endsWith('.html'))
    .map((p) => SITE.baseUrl + p.replace(/index\.html$/, ''))
    .map((u) => `  <url><loc>${u}</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`)
    .join('\n');
  const block = `${START}\n${urls}\n${END}`;
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (xml.includes(START)) {
    xml = xml.replace(new RegExp(escRe(START) + '[\\s\\S]*?' + escRe(END)), block);
  } else {
    xml = xml.replace('</urlset>', block + '\n</urlset>');
  }
  writeFileSync(sitemapPath, xml);
}

console.log(`manager-starter: ${written.length}ページを生成しました`);
written.forEach((p) => console.log('  manager-starter/' + p));
console.log('sitemap.xml のmanager-starter区間を更新しました');
