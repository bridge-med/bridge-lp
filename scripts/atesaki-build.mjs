#!/usr/bin/env node
/* ================================================================
   宛先しらべ — 記事の取り込み(note → 判定 → atesaki-76a805/data/)
   note.com はブラウザからの読み込み(CORS)を許していないため、判定は取り込みの時点で行い、
   ページは同じオリジンの JSON を読むだけにする。判定は atesaki-76a805/app/engine.js(画面と同じファイル)。

   取りに行くのは note.com/robots.txt が許しているパスだけ(2026-09-25 確認)。
     新着の発見   https://note.com/{user}/rss(最新 25 本)
     本文ほか     https://note.com/{user}/n/{key}(記事ページ。本文・タグ・公開日時・スキ・有料かどうか)
   /api/* は robots.txt で禁じられているので使わない。
   ※ 2026-09-25 の初回の 174 本は、この決まりに気づく前に /api から一度だけ取得した(PR に記載)。

   書き出すもの(本文そのものは書き出さない。記事の再配布にしないため):
     data/archive.json    記事ごとの題・日付・タグ・宛先の要約、定型文の一覧、物語を除いた記事の平均の割合
     data/evidence.json   結果画面の根拠(宛先の職種・関心それぞれ1文まで。物語は持たない)と割合。1記事1行
     data/likes.json      記事ごとのスキの数と、数えた日

   ふだん(引数なし・GitHub Actions): RSS の新着と題の変わった記事だけ、記事ページを読んで足す。
     スキは LIKES_EVERY 日に一度、公開から LIKES_DAYS 日以内の記事だけ読み直す(それより古い記事は前の値のまま)。
     判定の版(FINGERPRINT)が焼いたデータと違うときは、取り直さずに止める(note に全件を取りに行かない)。
   --cache <dir>  <dir>/list.json と <dir>/raw/{key}.json から全件を焼き直す(通信しない。定型文の一覧も作り直す)
   --rebuild      記事ページを全件読み直して焼き直す(辞書を直したとき。WAIT_MS 間隔で 1 本ずつ。手元で実行する)
   --force-likes  スキの読み直しを日数に関係なく行う
   ================================================================ */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const E = require(join(repo, 'atesaki-76a805', 'app', 'engine.js'));

const NOTE_USER = 'prime_duck4944';
const UA = 'Mozilla/5.0 (compatible; BRIDGE-feed/1.0; +https://bridge-med.github.io/bridge-lp/)';
const WAIT_MS = 1500;       // 1本ごとに間をあける(note への負荷を小さく)
const LIKES_EVERY = 7;      // スキを読み直す間隔(日)
const LIKES_DAYS = 60;      // スキを読み直す記事(公開からの日数)

const DATA = join(repo, 'atesaki-76a805', 'data');
const argv = process.argv.slice(2);
const cacheDir = argv.includes('--cache') ? argv[argv.indexOf('--cache') + 1] : null;
// --cache のあとにフォルダがないとき、ふだんの取り込み(通信)に落ちないように止める
if (argv.includes('--cache') && (!cacheDir || cacheDir.startsWith('--'))) { console.error('--cache <dir> のフォルダがない。何もしない'); process.exit(1); }
const rebuild = argv.includes('--rebuild');
const forceLikes = argv.includes('--force-likes');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; } };
// 1記事1行(差分が記事単位で読めるように)
const writeLines = (p, head, items) =>
  writeFileSync(p, JSON.stringify(head).replace(/}$/, ',"items":[\n') + items.map(it => JSON.stringify(it)).join(',\n') + '\n]}\n');
const nonzero = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v > 0));
const jstDate = d => new Date(new Date(d).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const todayJst = () => jstDate(Date.now());
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const decode = s => E.htmlToText(String(s || '').replace(/\n/g, ' '));

// 404(削除・非公開にした記事)は再試行せず、status を持たせて呼び出し側で扱う。ほかの失敗は3回まで試す
async function getText(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) { const e = new Error(res.status + ' ' + url); e.status = res.status; throw e; }
      return await res.text();
    } catch (e) {
      last = e;
      if (e.status === 404) break;
      if (i < 2) await sleep(3000 * 2 ** i);
    }
  }
  throw last;
}
const gone = e => e && e.status === 404;

/* ---- RSS: 最新 25 本の key・題・公開日 ---- */
async function fetchRss() {
  const xml = await getText(`https://note.com/${NOTE_USER}/rss`);
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const x = m[1];
    const link = (x.match(/<link>([^<]+)<\/link>/) || [])[1] || '';
    const p = E.parseNoteUrl(link);
    if (!p) continue;
    const title = decode((x.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]);
    const pub = (x.match(/<pubDate>([^<]+)<\/pubDate>/) || [])[1];
    items.push({ key: p.key, title, date: pub ? jstDate(pub) : '' });
  }
  if (!items.length) throw new Error('RSS に記事が1本もない。note 側の不調とみなして止める');
  return items;
}

/* ---- 記事ページ: 本文・タグ・公開日時・更新日時・スキ・有料かどうか ---- */
function sliceElement(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return '';
  const start = html.lastIndexOf('<', at);
  const tag = (html.slice(start).match(/^<(\w+)/) || [])[1];
  if (!tag) return '';
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'g');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return '';
}
async function fetchPage(key) {
  const html = await getText(`https://note.com/${NOTE_USER}/n/${key}`);
  const body = sliceElement(html, 'data-name="body"');
  if (!body) throw new Error('本文が見つからない: ' + key);
  let post = {};
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      const found = [].concat(d['@graph'] || d).find(x => x && x['@type'] === 'BlogPosting');
      if (found) { post = found; break; }
    } catch { /* 読めない JSON-LD は飛ばす */ }
  }
  // スキ: 数の要素がなければ0(スキ0の記事には数が出ない)。スキの部品そのものがなければ、ページの作りが
  // 変わったとみなして null(前の値を残す)
  const m = html.match(/o-noteLikeV3__count[^>]*>\s*([0-9,]+)/);
  const likes = m ? Number(m[1].replace(/,/g, '')) : (/o-noteLikeV3/.test(html) ? 0 : null);
  if (!post.headline || !post.datePublished) throw new Error('題か公開日が読めない(JSON-LD): ' + key);
  return {
    key,
    title: decode(post.headline),
    date: jstDate(post.datePublished),
    modified: post.dateModified || '',
    tags: String(post.keywords || '').split(',').map(s => s.trim()).filter(Boolean).map(s => '#' + s),
    likes,
    paid: /class="[^"]*\bo-paywall\b/.test(html),
    body,
  };
}

/* ---- 手元の写し(--cache): 2026-09-25 の初回取得のもの ---- */
function readCache() {
  const list = JSON.parse(readFileSync(join(cacheDir, 'list.json'), 'utf8'));   // 読めなければここで止まる
  if (!Array.isArray(list) || !list.length) throw new Error('写しの一覧が空: ' + cacheDir);
  return list.map(c => {
    const r = readJson(join(cacheDir, 'raw', c.key + '.json'), null);
    if (!r) throw new Error('写しに本文がない: ' + c.key);
    return { key: c.key, title: c.name, date: String(c.publishAt).slice(0, 10), modified: '', tags: c.hashtags || [], likes: c.likeCount, paid: (c.price || 0) > 0, body: r.body || '' };
  });
}

/* ---- 1記事ぶんの判定 → 一覧の行と根拠の行 ---- */
function build(page, ignore) {
  const a = E.analyze({ title: page.title, text: E.htmlToText(page.body), tags: page.tags }, { ignore });
  const item = {
    key: page.key,
    url: `https://note.com/${NOTE_USER}/n/${page.key}`,
    title: page.title, date: page.date, modified: page.modified, paid: page.paid, tags: page.tags,
    story: a.story, chars: a.chars,
    reader: a.reader, main: a.main, top: a.top, generalLead: a.generalLead, focus: a.focus, publicRule: a.publicRule,
    titleRead: a.titleRead, gap: a.gap,
  };
  // 根拠の引用は、宛先の一文に出す職種と関心について1文ずつだけ持つ(本文の再配布を小さくする)。物語は持たない
  const evidence = {};
  if (!a.story) {
    for (const id of [a.main.who, a.main.topic]) if (id && a.evidence[id] && a.evidence[id].length) evidence[id] = a.evidence[id].slice(0, 1);
  }
  const detail = { key: page.key, share: { who: nonzero(a.share.who), topic: nonzero(a.share.topic) }, raw: nonzero(a.raw), words: a.words, evidence };
  return { item, detail };
}

function write(items, details, boilerplate, likes, likesUpdated) {
  const order = (a, b) => (b.date.localeCompare(a.date)) || a.key.localeCompare(b.key);
  items.sort(order);
  const pos = new Map(items.map((it, i) => [it.key, i]));
  details.sort((a, b) => pos.get(a.key) - pos.get(b.key));
  const storyKeys = new Set(items.filter(it => it.story).map(it => it.key));
  const baseline = E.baselineOf(details.filter(d => !storyKeys.has(d.key)).map(d => d.share));
  const today = todayJst();
  writeLines(join(DATA, 'archive.json'), { generated: today, fingerprint: E.FINGERPRINT, user: NOTE_USER, count: items.length, baseline, boilerplate }, items);
  writeLines(join(DATA, 'evidence.json'), { fingerprint: E.FINGERPRINT, count: details.length }, details);
  writeFileSync(join(DATA, 'likes.json'), JSON.stringify({ updated: likesUpdated, likes }) + '\n');
}

/* ---- 全件を焼き直す(--cache / --rebuild) ---- */
async function rebuildAll(pages) {
  if (!pages.length) throw new Error('0本。何も書き換えない');
  const texts = pages.map(p => E.htmlToText(p.body));
  const boilerplate = E.boilerplateOf(texts);
  const ignore = new Set(boilerplate);
  const items = [];
  const details = [];
  for (const p of pages) { const b = build(p, ignore); items.push(b.item); details.push(b.detail); }
  const likes = Object.fromEntries(pages.filter(p => p.likes != null).map(p => [p.key, p.likes]));
  write(items, details, boilerplate, likes, todayJst());
  console.log(`全件を焼き直した: ${items.length} 本 / 定型文 ${boilerplate.length} 行`);
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  if (cacheDir) return rebuildAll(readCache());

  const prev = readJson(join(DATA, 'archive.json'), null);
  const prevEv = readJson(join(DATA, 'evidence.json'), null);
  const prevLikes = readJson(join(DATA, 'likes.json'), { updated: '', likes: {} });

  if (rebuild) {
    const keys = new Set([...(prev ? prev.items.map(it => it.key) : []), ...(await fetchRss()).map(r => r.key)]);
    const pages = [];
    const skipped = [];
    for (const key of keys) {
      try { pages.push(await fetchPage(key)); } catch (e) { if (!gone(e)) throw e; skipped.push(key); }
      await sleep(WAIT_MS);
    }
    if (skipped.length) console.error('見つからない(404)ので外した記事: ' + skipped.join(', '));
    return rebuildAll(pages);
  }

  if (!prev || !prevEv) throw new Error('焼いたデータがない。先に --cache か --rebuild で全件を焼く');
  if (prev.fingerprint !== E.FINGERPRINT || prevEv.fingerprint !== E.FINGERPRINT) {
    console.error('判定の版が焼いたデータと違う。note に全件を取りに行かず、ここで止める。手元で --rebuild して焼き直したデータをコミットする');
    process.exit(3);
  }

  const ignore = new Set(prev.boilerplate || []);
  const items = prev.items.slice();
  const details = prevEv.items.slice();
  const byKey = new Map(items.map((it, i) => [it.key, i]));
  const likes = Object.assign({}, prevLikes.likes);
  let added = 0;
  let redone = 0;
  let first = true;
  const seen = new Map();   // 同じ回で同じ記事を二度取りに行かない
  const visit = async key => {
    if (seen.has(key)) return seen.get(key);
    if (!first) await sleep(WAIT_MS);
    first = false;
    const page = await fetchPage(key);
    seen.set(key, page);
    return page;
  };
  const removed = [];
  const drop = key => {
    const i = items.findIndex(it => it.key === key);
    if (i >= 0) items.splice(i, 1);
    const j = details.findIndex(d => d.key === key);
    if (j >= 0) details.splice(j, 1);
    delete likes[key];
    byKey.clear();
    items.forEach((it, k) => byKey.set(it.key, k));
    removed.push(key);
  };
  const put = page => {
    const b = build(page, ignore);
    if (byKey.has(page.key)) { const i = byKey.get(page.key); items[i] = b.item; details[details.findIndex(d => d.key === page.key)] = b.detail; redone++; }
    else { byKey.set(page.key, items.length); items.push(b.item); details.push(b.detail); added++; }
    if (page.likes != null) likes[page.key] = page.likes;
  };

  // 新着と、題の変わった記事
  for (const r of await fetchRss()) {
    const i = byKey.get(r.key);
    if (i != null && items[i].title === r.title) continue;
    try { put(await visit(r.key)); } catch (e) { if (!gone(e)) throw e; if (i != null) drop(r.key); }
  }

  // スキ: LIKES_EVERY 日に一度、公開から LIKES_DAYS 日以内の記事だけ読み直す。本文が更新されていれば判定も直す
  const today = todayJst();
  let likesUpdated = prevLikes.updated;
  let likesRead = false;
  if (forceLikes || !likesUpdated || daysBetween(likesUpdated, today) >= LIKES_EVERY) {
    const recent = items.filter(x => daysBetween(x.date, today) <= LIKES_DAYS);
    const read = [];
    let unreadable = 0;
    for (const it of recent) {
      let page;
      try { page = await visit(it.key); } catch (e) { if (!gone(e)) throw e; drop(it.key); continue; }
      if (page.modified && page.modified !== it.modified) put(page);
      else if (page.likes != null) likes[it.key] = page.likes;
      if (page.likes != null) read.push([it.key, page.likes]); else unreadable++;
    }
    // スキの部品が読めないページがあれば、数えた日(likes.updated)を進めない。古い値を今日の値として比べに入れないため
    if (unreadable) throw new Error(`スキの部品が読めないページが ${unreadable} 本。ページの作りが変わった可能性があるので書き換えない`);
    // 読み直したスキが全部0で、前は0でなかったなら、ページの作りが変わったとみなして止める
    const before = read.filter(([k]) => (prevLikes.likes[k] || 0) > 0);
    if (before.length >= 3 && read.every(([, v]) => v === 0)) throw new Error('読み直したスキがすべて0。ページの作りが変わった可能性があるので書き換えない');
    likesUpdated = today;
    likesRead = true;
  }
  if (removed.length) console.error('見つからない(404)ので外した記事: ' + removed.join(', '));
  if (removed.length > 5) throw new Error('1回で6本以上が見つからない。note 側の不調とみなして書き換えない');

  const same = added === 0 && redone === 0 && !likesRead && !removed.length;
  if (same) { console.log('新着なし・スキの読み直しは次の回。書き換えない'); return; }
  write(items, details, prev.boilerplate || [], likes, likesUpdated);
  console.log(`新着 ${added} 本 / 読み直し ${redone} 本 / 外した ${removed.length} 本 / スキ ${likesRead ? '読み直した' : 'そのまま'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
