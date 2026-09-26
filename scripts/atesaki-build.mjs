#!/usr/bin/env node
/* ================================================================
   宛先しらべ — 記事の取り込み(note → 判定 → atesaki-76a805/data/)
   note.com はブラウザからの読み込み(CORS)を許していないため、判定は取り込みの時点で行い、
   ページは同じオリジンの JSON を読むだけにする。判定は atesaki-76a805/app/engine.js(画面と同じファイル)。

   取りに行くのは note.com/robots.txt が許しているパスだけ(2026-09-25 確認・2026-09-26 再確認)。
     新着の発見   https://note.com/{user}/rss(最新 25 本)
     本文ほか     https://note.com/{user}/n/{key}(記事ページ。本文・タグ・公開日時・スキ・有料かどうか)
   /api/* は robots.txt で禁じられているので使わない。
   ※ 2026-09-25 の初回の 174 本は、この決まりに気づく前に /api から一度だけ取得した。2026-09-26 に全件を記事ページから
     読み直して焼き直した(--rebuild。その日付を archive.json の rebuilt に残す)。いまのデータの中身は、すべて上の2つの経路から
     作ったもの。読みに行く記事の URL の一覧だけは、初回に知ったものを引き継いでいる(note には、許された経路で全件の一覧を
     得る方法がない。RSS は最新 25 本、プロフィールのページは最新 19 本まで、サイトマップは直近の数日ぶんだけ)。

   書き出すもの(本文そのものは書き出さない。記事の再配布にしないため):
     data/archive.json    記事ごとの題・日付・タグ・宛先の要約、定型文の一覧、物語を除いた記事の平均の割合
     data/evidence.json   結果画面の根拠(宛先の職種・関心それぞれ1文まで。物語は持たない)と割合。1記事1行
     data/likes.json      記事ごとのスキの数と、数えた日

   ふだん(引数なし・GitHub Actions): RSS の新着と題の変わった記事だけ、記事ページを読んで足す。
     スキは LIKES_EVERY 日に一度、公開から LIKES_DAYS 日以内の記事だけ読み直す(それより古い記事は前の値のまま)。
     判定の版(FINGERPRINT)が焼いたデータと違うときは、取り直さずに止める(note に全件を取りに行かない)。
     記事ページが 404 を返しても、その場では外さない(note 側の一時的な不調のことがあるため)。記事の行に missing
     (最初と最後に 404 だった日・続けて 404 だった回数)を付けてデータはそのまま残し、1日1回だけ確かめ直す。
     最初の 404 から MISSING_DAYS 日以上たち、MISSING_TIMES 回以上続けて 404 だったときに、初めて外す。
     途中で1回でも開けたら missing を消す。新しく 404 になった記事が1回で GONE_MAX 本を超えたら、何も書き換えずに止める。
   --rebuild      記事ページを全件読み直して焼き直す(辞書を直したとき。WAIT_MS 間隔で 1 本ずつ。手元で実行する)
                  404 だった記事は、全件を回り終えてからもう一度だけ確かめ、それでも 404 なら外して知らせる
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
const GONE_MAX = 5;         // 1回で新しく見つからなくなった(404)記事がこれを超えたら、note 側の不調とみなして止める
const MISSING_DAYS = 7;     // 404 の記事を外すのは、最初の 404 からこの日数以上たち、
const MISSING_TIMES = 3;    // この回数以上(1日1回まで数える)続けて 404 だったときだけ

const DATA = join(repo, 'atesaki-76a805', 'data');
const argv = process.argv.slice(2);
// 知らない引数(廃止した --cache や打ち間違い)は、ふだんの取り込み(通信)に落ちないように止める
const unknown = argv.filter(a => a !== '--rebuild' && a !== '--force-likes');
if (unknown.length) { console.error('知らない引数: ' + unknown.join(' ') + '(使えるのは --rebuild と --force-likes)。何もしない'); process.exit(1); }
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
// 有料: 有料の部品(o-paywall)があり、読めない部分(見出し「ここから先は N字」の N)が 0 より多いとき。
// 定期購読マガジンに入っているだけで全文が読める記事(N=0)は、無料と同じに扱う。N が読めないときは有料とみなす
function paidOf(html) {
  if (!/class="[^"]*\bo-paywall\b/.test(html)) return false;
  const at = html.search(/class="[^"]*\bm-paywallHeader__label\b/);   // 先に <style> にも同じ名前が出るので、要素の class で探す
  if (at < 0) return true;
  const head = html.slice(html.lastIndexOf('<', at), at + 1500).replace(/<[^>]*>/g, ' ');
  const m = head.match(/ここから先は\s*([0-9,]+)\s*字/);
  return m ? Number(m[1].replace(/,/g, '')) > 0 : true;
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
    paid: paidOf(html),
    body,
  };
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

// rebuilt: 全件を記事ページから読み直して焼いた日。ふだんの取り込みは前の値を引き継ぐ
function write(items, details, boilerplate, likes, likesUpdated, rebuilt) {
  const order = (a, b) => (b.date.localeCompare(a.date)) || a.key.localeCompare(b.key);
  items.sort(order);
  const pos = new Map(items.map((it, i) => [it.key, i]));
  details.sort((a, b) => pos.get(a.key) - pos.get(b.key));
  const storyKeys = new Set(items.filter(it => it.story).map(it => it.key));
  const baseline = E.baselineOf(details.filter(d => !storyKeys.has(d.key)).map(d => d.share));
  const today = todayJst();
  writeLines(join(DATA, 'archive.json'), { generated: today, rebuilt, fingerprint: E.FINGERPRINT, user: NOTE_USER, count: items.length, baseline, boilerplate }, items);
  writeLines(join(DATA, 'evidence.json'), { fingerprint: E.FINGERPRINT, count: details.length }, details);
  writeFileSync(join(DATA, 'likes.json'), JSON.stringify({ updated: likesUpdated, likes }) + '\n');
}

/* ---- 全件を記事ページから焼き直す(--rebuild) ---- */
async function rebuildAll(pages) {
  if (!pages.length) throw new Error('0本。何も書き換えない');
  // スキの部品が読めないページがあれば、ページの作りが変わったとみなして書き換えない(スキのない記事を作らない)
  const noLikes = pages.filter(p => p.likes == null).map(p => p.key);
  if (noLikes.length) throw new Error('スキの部品が読めないページがある: ' + noLikes.join(', ') + '。書き換えない');
  const texts = pages.map(p => E.htmlToText(p.body));
  const boilerplate = E.boilerplateOf(texts);
  const ignore = new Set(boilerplate);
  const items = [];
  const details = [];
  for (const p of pages) { const b = build(p, ignore); items.push(b.item); details.push(b.detail); }
  const likes = Object.fromEntries(pages.map(p => [p.key, p.likes]));
  const today = todayJst();
  write(items, details, boilerplate, likes, today, today);
  console.log(`全件を記事ページから焼き直した: ${items.length} 本 / 定型文 ${boilerplate.length} 行`);
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  const prev = readJson(join(DATA, 'archive.json'), null);
  const prevEv = readJson(join(DATA, 'evidence.json'), null);
  const prevLikes = readJson(join(DATA, 'likes.json'), { updated: '', likes: {} });

  if (rebuild) {
    const keys = [...new Set([...(prev ? prev.items.map(it => it.key) : []), ...(await fetchRss()).map(r => r.key)])];
    const pages = new Map();
    const notFound = [];
    for (const key of keys) {
      await sleep(WAIT_MS);
      try { pages.set(key, await fetchPage(key)); } catch (e) { if (!gone(e)) throw e; notFound.push(key); }
      // 上限を超えた時点で止める(note が落ちているときに、残りへ取りに行き続けない)
      if (notFound.length > GONE_MAX) throw new Error(`1回で${notFound.length}本が見つからない。note 側の不調とみなして書き換えない`);
    }
    // 404 だった記事は、全件を回り終えてからもう一度だけ確かめる(一時的な 404 で外さないため)
    const still = [];
    for (const key of notFound) {
      await sleep(WAIT_MS);
      try { pages.set(key, await fetchPage(key)); } catch (e) { if (!gone(e)) throw e; still.push(key); }
    }
    if (still.length) console.error('2回確かめて見つからない(404)ので外した記事: ' + still.join(', '));
    return rebuildAll(keys.filter(k => pages.has(k)).map(k => pages.get(k)));
  }

  if (!prev || !prevEv) throw new Error('焼いたデータがない。先に --rebuild で全件を焼く');
  if (prev.fingerprint !== E.FINGERPRINT || prevEv.fingerprint !== E.FINGERPRINT) {
    console.error('判定の版が焼いたデータと違う。note に全件を取りに行かず、ここで止める。手元で --rebuild して焼き直したデータをコミットする');
    process.exit(3);
  }

  const today = todayJst();
  const ignore = new Set(prev.boilerplate || []);
  const items = prev.items.map(it => ({ ...it }));   // missing を書き足すので写しを持つ
  const details = prevEv.items.slice();
  const byKey = new Map(items.map((it, i) => [it.key, i]));
  const likes = Object.assign({}, prevLikes.likes);
  let added = 0;
  let redone = 0;
  let first = true;
  const seen = new Map();   // 同じ回で同じ記事を二度取りに行かない(404 だったことも覚える)
  const visit = async key => {
    if (seen.has(key)) { const s = seen.get(key); if (s.error) throw s.error; return s.page; }
    if (!first) await sleep(WAIT_MS);
    first = false;
    try { const page = await fetchPage(key); seen.set(key, { page }); return page; }
    catch (e) { if (gone(e)) seen.set(key, { error: e }); throw e; }
  };
  const put = page => {
    const b = build(page, ignore);   // 作り直した行には missing がない(開けたので)
    if (byKey.has(page.key)) { const i = byKey.get(page.key); items[i] = b.item; details[details.findIndex(d => d.key === page.key)] = b.detail; redone++; }
    else { byKey.set(page.key, items.length); items.push(b.item); details.push(b.detail); added++; }
    if (page.likes != null) likes[page.key] = page.likes;
  };

  // 404 の記録。データはそのまま残し、続けて 404 だった回数を1日1回まで数える
  const newlyMissing = [];
  const recovered = [];
  let missingChanged = false;
  const markMissing = key => {
    const it = items[byKey.get(key)];
    if (!it.missing) { it.missing = { since: today, last: today, n: 1 }; newlyMissing.push(key); missingChanged = true; }
    else if (it.missing.last !== today) { it.missing = { since: it.missing.since, last: today, n: it.missing.n + 1 }; missingChanged = true; }
  };

  // 1) 404 を記録している記事を、1日1回だけ確かめ直す。開けたら記録を消す
  for (const it of items.filter(x => x.missing && x.missing.last !== today)) {
    let page;
    try { page = await visit(it.key); } catch (e) { if (!gone(e)) throw e; markMissing(it.key); continue; }
    delete it.missing;
    missingChanged = true;
    recovered.push(it.key);
    if (page.modified && page.modified !== it.modified) put(page);
  }

  // 2) 新着と、題の変わった記事
  for (const r of await fetchRss()) {
    const i = byKey.get(r.key);
    if (i != null && items[i].title === r.title) continue;
    try { put(await visit(r.key)); } catch (e) {
      if (!gone(e)) throw e;
      if (i != null) markMissing(r.key);
      else console.error('RSS にあるが記事ページが 404。今回は足さない(次の回にまた確かめる): ' + r.key);
    }
  }

  // 3) スキ: LIKES_EVERY 日に一度、公開から LIKES_DAYS 日以内の記事だけ読み直す。本文が更新されていれば判定も直す
  let likesUpdated = prevLikes.updated;
  let likesRead = false;
  if (forceLikes || !likesUpdated || daysBetween(likesUpdated, today) >= LIKES_EVERY) {
    const recent = items.filter(x => !x.missing && daysBetween(x.date, today) <= LIKES_DAYS);
    const read = [];
    let unreadable = 0;
    for (const it of recent) {
      let page;
      try { page = await visit(it.key); } catch (e) { if (!gone(e)) throw e; markMissing(it.key); continue; }
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

  // 4) 新しく 404 になった記事が多すぎる回は、note 側の不調とみなして何も書き換えない
  if (newlyMissing.length > GONE_MAX) throw new Error(`1回で${newlyMissing.length}本が新しく見つからない(404)。note 側の不調とみなして書き換えない`);
  if (newlyMissing.length) console.error('404 だった(データは残し、1日1回確かめ直す): ' + newlyMissing.join(', '));
  if (recovered.length) console.log('404 の記録があったが開けた(記録を消した): ' + recovered.join(', '));

  // 5) 外すのは、最初の 404 から MISSING_DAYS 日以上たち、MISSING_TIMES 回以上続けて 404 だった記事だけ
  const expired = items.filter(x => x.missing && x.missing.n >= MISSING_TIMES && daysBetween(x.missing.since, x.missing.last) >= MISSING_DAYS).map(x => x.key);
  if (expired.length > GONE_MAX) throw new Error(`外す条件を満たした記事が${expired.length}本ある。多すぎるので書き換えない`);
  const drop = new Set(expired);
  const keptItems = items.filter(it => !drop.has(it.key));
  const keptDetails = details.filter(d => !drop.has(d.key));
  for (const key of expired) delete likes[key];
  if (expired.length) console.error(`${MISSING_DAYS}日以上・${MISSING_TIMES}回以上続けて 404 だったので外した記事: ` + expired.join(', '));
  const stillMissing = keptItems.filter(it => it.missing).map(it => `${it.key}(${it.missing.since}から${it.missing.n}回)`);
  if (stillMissing.length) console.error('404 が続いている記事(まだ外さない): ' + stillMissing.join(', '));

  const same = added === 0 && redone === 0 && !likesRead && !missingChanged && !expired.length;
  if (same) { console.log('新着なし・スキの読み直しは次の回。書き換えない'); return; }
  write(keptItems, keptDetails, prev.boilerplate || [], likes, likesUpdated, prev.rebuilt || '');
  console.log(`新着 ${added} 本 / 読み直し ${redone} 本 / 404 の記録 ${stillMissing.length} 本 / 外した ${expired.length} 本 / スキ ${likesRead ? '読み直した' : 'そのまま'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
