#!/usr/bin/env node
/* ================================================================
   販売経路の検査。売り物ごとに「購入ボタンが定義どおりの行き先を指しているか」
   「価格がページ間で一致しているか」「行き先が生きているか」を機械で確かめ、
   note の最後の投稿日と合わせて cockpit-76a805/funnel.json に書く。
   契機は 2026-08-20 の実害(購入ボタン3本が死んだ行き先を指したまま公開されていた)。

   定義: cockpit-76a805/funnel.config.json(唯一の情報源)
   使い方: node scripts/check-funnel.mjs            (検査だけ。外の URL も確かめる)
           node scripts/check-funnel.mjs --offline  (リポジトリの中だけ。外へは出ない)
           node scripts/check-funnel.mjs --write    (結果を funnel.json に書く。週次の bot が使う)
   終了コード: 0 = 通っている / 1 = 切れている(違う行き先・価格の食い違い・404/410)
   外の URL に届かなかったとき(ネットワーク・403 など)は「確かめられなかった」と書き、落とさない。
   テスト: node --test scripts/tests/check-funnel.test.mjs
   ================================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

export const yen = (n) => Number(n).toLocaleString('en-US');

/** html の中から data-link="<link>" を持つ a 要素の href を全部返す(属性の順番に依らない) */
export function buttonHrefs(html, link) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*>/g)) {
    const tag = m[0];
    const dl = tag.match(/\bdata-link="([^"]*)"/);
    if (!dl || dl[1] !== link) continue;
    const href = tag.match(/\bhref="([^"]*)"/);
    out.push(href ? href[1] : '');
  }
  return out;
}

/** html の中の価格表記(¥1,980 と、¥ と数字を別の span に分けた形)を全部返す。表の数字(単位数など)は拾わない */
export function pricesIn(html) {
  const out = [];
  for (const m of html.matchAll(/¥(?:\s*|<\/span>\s*<span\b[^>]*>)(\d{1,3}(?:,\d{3})+)(?!\d)/g)) out.push(Number(m[1].replace(/,/g, '')));
  return out;
}

/** 販売記事のような、同じサイトの個別ページへのリンクか(プロフィールの入口は除く) */
function sameSiteArticle(href, buyUrl) {
  try {
    const a = new URL(href), b = new URL(buyUrl);
    return a.host === b.host && a.pathname.split('/').filter(Boolean).length > 1;
  } catch { return false; }
}

/** リポジトリの中だけで分かること。read(path) は文字列か null を返す。known は、ページに出てよい価格の一覧 */
export function checkOfferLocal(offer, read, known = [offer.price]) {
  const issues = [];
  const external = /^https?:/.test(offer.buyUrl);
  for (const b of offer.buttons || []) {
    const html = read(b.file);
    if (html == null) { issues.push(`${b.file} が無い`); continue; }
    const hrefs = buttonHrefs(html, b.link);
    if (!hrefs.length) { issues.push(`${b.file} に購入ボタン(data-link="${b.link}")が無い`); continue; }
    for (const h of hrefs) {
      if (h === offer.buyUrl) continue;
      // ページ内の購入欄へ降りるボタン(#purchase など)は、その id が同じページにあれば通す
      if (/^#[\w-]+$/.test(h)) {
        if (!new RegExp(`(?<![\\w-])id=["']${h.slice(1)}["']`).test(html)) issues.push(`${b.file} の購入ボタンが、ページに無い場所(${h})を指している`);
        continue;
      }
      issues.push(`${b.file} の購入ボタンの行き先が定義と違う(${h || '空'})`);
    }
    // data-link の無いリンクでも、同じサイトの別の記事を指していたら拾う(古い販売記事の取り残し)
    if (external) {
      for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        if (m[1] !== offer.buyUrl && sameSiteArticle(m[1], offer.buyUrl)) issues.push(`${b.file} に、定義と違う販売先へのリンクがある(${m[1]})`);
      }
    }
  }
  for (const p of offer.pricePages || []) {
    const html = read(p);
    if (html == null) { issues.push(`${p} が無い`); continue; }
    const found = pricesIn(html);
    if (!found.includes(offer.price)) issues.push(`${p} に価格 ¥${yen(offer.price)} の表記が無い`);
    // 1か所だけ書き換えた食い違いを拾う。定義に無い価格がページにあれば落とす
    for (const n of new Set(found)) if (!known.includes(n)) issues.push(`${p} に、定義に無い価格 ¥${yen(n)} がある`);
  }
  // リポジトリの中の行き先は、ファイルがあるかまで見る
  if (!external && offer.buttons?.length) {
    const target = posix.normalize(posix.join(posix.dirname(offer.buttons[0].file), offer.buyUrl.split(/[?#]/)[0]));
    if (read(target) == null) issues.push(`購入先 ${target} が無い`);
  }
  return issues;
}

/** HTTP の結果を3つに分ける。切れていると言い切るのは 404 と 410 だけ */
export function classifyHttp(status) {
  if (status >= 200 && status < 400) return 'alive';
  if (status === 404 || status === 410) return 'dead';
  return 'unknown';
}

/** RSS から最新の1本(題と日付)を取る。読めなければ null */
export function latestFromRss(xml) {
  const item = xml.match(/<item>([\s\S]*?)<\/item>/);
  if (!item) return null;
  const pick = (tag) => {
    const m = item[1].match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
    return m ? m[1].trim() : '';
  };
  const d = new Date(pick('pubDate'));
  if (Number.isNaN(d.getTime())) return null;
  // 日付は日本時間で数える(note の投稿日と同じ見え方にする)
  const date = new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return { date, title: pick('title') };
}

async function httpStatus(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'bridge-funnel-check' } });
    return res.status;
  } catch {
    return 0;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const offline = args.has('--offline');
  const read = (p) => (existsSync(join(repo, p)) ? readFileSync(join(repo, p), 'utf8') : null);
  const config = JSON.parse(read('cockpit-76a805/funnel.config.json'));
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  // ページに出てよい価格 = 全部の売り物の価格 + 定義の otherPrices(売り物以外の金額)
  const known = [...config.offers.map((o) => o.price), ...(config.otherPrices || [])];
  const offers = [];
  for (const o of config.offers) {
    const issues = checkOfferLocal(o, read, known);
    let reach = 'local';
    if (/^https?:/.test(o.buyUrl)) {
      if (offline) reach = 'skipped';
      else {
        const status = await httpStatus(o.buyUrl);
        reach = classifyHttp(status);
        if (reach === 'dead') issues.push(`購入先が開かない(HTTP ${status})`);
      }
    }
    offers.push({ id: o.id, name: o.name, href: o.href, price: o.price, route: o.route, buyUrl: o.buyUrl, reach, issues });
  }

  // note の最後の投稿。RSS が読めなければ、取り込み済みの feed.json で代える
  let lastPost = null;
  if (!offline) {
    try {
      const res = await fetch(config.feed.rss, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'bridge-funnel-check' } });
      if (res.ok) { const l = latestFromRss(await res.text()); if (l) lastPost = { ...l, source: 'rss' }; }
    } catch { /* 下の代替へ */ }
  }
  if (!lastPost) {
    try {
      const f = JSON.parse(read(config.feed.fallback));
      const top = f.items?.[0];
      if (top) lastPost = { date: top.date, title: top.title, source: 'feed.json' };
    } catch { /* 分からないものは書かない */ }
  }

  const ok = offers.every((o) => !o.issues.length);
  const result = { checkedAt: today, online: !offline, ok, lastPost, offers };

  for (const o of offers) {
    const mark = o.issues.length ? '✗' : o.reach === 'unknown' ? '?' : '✓';
    console.log(`${mark} ${o.name} ¥${yen(o.price)} → ${o.buyUrl}${o.reach === 'unknown' ? '(届かず、確かめられなかった)' : ''}`);
    for (const i of o.issues) console.log(`    ${i}`);
  }
  if (lastPost) console.log(`note の最後の投稿: ${lastPost.date}「${lastPost.title}」(${lastPost.source})`);
  console.log(ok ? 'check-funnel: 販売経路は通っている' : 'check-funnel: 販売経路に切れている所がある');

  if (args.has('--write')) {
    writeFileSync(join(repo, 'cockpit-76a805', 'funnel.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
  }
  process.exit(ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
