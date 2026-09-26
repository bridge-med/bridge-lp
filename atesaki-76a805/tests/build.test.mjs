/* 宛先しらべ 取り込み(scripts/atesaki-build.mjs)のテスト
 * 実行: node --test atesaki-76a805/tests/*.test.mjs
 * note には通信しない。一時フォルダにリポジトリの必要な部分を写し、偽の fetch(--import で差し込む)で走らせる。
 * 確かめること: 404 が1回出ても記事は外さない(missing に記録して1日1回確かめ直す)/ 7日以上・3回以上続いたら外す /
 * 開けたら記録を消す / 新しく 404 になった記事が多すぎる回は書き換えない / スキの部品が読めないページがあれば書き換えない /
 * --rebuild の 404 は最後にもう一度確かめる / 知らない引数(廃止した --cache など)は通信せずに止める。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'atesaki-build-'));
  mkdirSync(join(dir, 'scripts'));
  cpSync(join(REPO, 'atesaki-76a805'), join(dir, 'atesaki-76a805'), { recursive: true });
  // 待ち時間だけ短くした写し
  writeFileSync(join(dir, 'scripts', 'atesaki-build.mjs'),
    readFileSync(join(REPO, 'scripts', 'atesaki-build.mjs'), 'utf8').replace(/const WAIT_MS = \d+;/, 'const WAIT_MS = 0;'));
  return dir;
}

// 偽の fetch。opts.gone: 404 を返す key の配列 / opts.goneFirst: 先頭 N 本は 404 / opts.goneOnce: 最初の1回だけ 404 /
// opts.noLikes: スキの部品を出さない / opts.rssNew: RSS に足す(記事ページは 404 の)新しい key /
// opts.paywall: { key: 'ここから先は' の字数(文字列。null なら字数の行なし) } の有料の部品を出す / 呼ばれた URL は calls.json に残す
function stub(dir, opts) {
  const path = join(dir, 'stub.mjs');
  writeFileSync(path, `
import { readFileSync, writeFileSync } from 'node:fs';
const A = JSON.parse(readFileSync(${JSON.stringify(join(dir, 'atesaki-76a805', 'data', 'archive.json'))}, 'utf8'));
const opts = ${JSON.stringify(opts)};
const calls = [];
process.on('exit', () => writeFileSync(${JSON.stringify(join(dir, 'calls.json'))}, JSON.stringify(calls)));
const asked = new Map();
globalThis.fetch = async url => {
  url = String(url); calls.push(url);
  const ok = body => ({ ok: true, status: 200, text: async () => body });
  const notFound = { ok: false, status: 404, text: async () => '' };
  if (url.endsWith('/rss')) {
    const it = A.items[0];
    const item = (key, title) => '<item><title>' + title + '</title><pubDate>Fri, 25 Sep 2026 19:00:00 +0900</pubDate><link>https://note.com/' + A.user + '/n/' + key + '</link></item>';
    return ok('<rss><channel>' + item(it.key, it.title) + (opts.rssNew ? item(opts.rssNew, '新しい記事') : '') + '</channel></rss>');
  }
  const key = url.split('/n/')[1];
  asked.set(key, (asked.get(key) || 0) + 1);
  if ((opts.gone || []).includes(key) || key === opts.rssNew) return notFound;
  if (opts.goneFirst && A.items.slice(0, opts.goneFirst).some(i => i.key === key)) return notFound;
  if ((opts.goneOnce || []).includes(key) && asked.get(key) === 1) return notFound;
  const it = A.items.find(i => i.key === key);
  const ld = { '@type': 'BlogPosting', headline: it.title, datePublished: it.date + 'T07:00:00+09:00', dateModified: it.modified || (it.date + 'T07:00:00+09:00'), keywords: '看護師,キャリア' };
  const likes = opts.noLikes ? '' : '<button class="o-noteLikeV3"><span class="o-noteLikeV3__count">7</span></button>';
  const rest = (opts.paywall || {})[key];
  // 本物のページと同じく、先に(離れたところの)<style> に同じ名前が出る
  const wall = rest === undefined ? '' : '<style>.m-paywallHeader__label[data-v-2]{font-size:12px}' + '.x{margin:0}'.repeat(300) + '</style><div class="p-article__paywall" data-v-1><div class="note-paywall o-paywall" data-v-1><h2 class="m-paywallHeader"><span class="m-paywallHeader__label" data-v-2>\\n      ここから先は\\n    </span></h2> <div class="text-center py-2"><div class="text-text-secondary text-xs"><!----> <!---->' + (rest === null ? '' : '\\n    ' + rest + '字\\n  ') + '</div></div></div></div>';
  return ok('<script type="application/ld+json">' + JSON.stringify(ld) + '</script>' + likes + '<div data-name="body" class="x"><p>看護師として働いて、転職を考えた。</p></div>' + wall);
};
`);
  return path;
}

const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const daysAgo = n => new Date(Date.now() + 9 * 3600e3 - n * 86400e3).toISOString().slice(0, 10);
const dataPath = (dir, f) => join(dir, 'atesaki-76a805', 'data', f);
const edit = (dir, f, fn) => { const o = JSON.parse(readFileSync(dataPath(dir, f), 'utf8')); fn(o); writeFileSync(dataPath(dir, f), JSON.stringify(o)); };

// 先頭 n 本を公開から3日の記事にし、スキの読み直しの日にする(公開から60日以内の記事だけが読み直しの対象)
function recentDates(dir, n = 3) {
  const day = daysAgo(3);
  let keys;
  edit(dir, 'archive.json', a => { a.items.slice(0, n).forEach(it => { it.date = day; }); keys = a.items.slice(0, n).map(it => it.key); });
  edit(dir, 'likes.json', l => { l.updated = '2000-01-01'; });
  return keys;
}
// スキの読み直しの日ではない回にする(日付に左右されないように、数えた日を今日にしておく)
const notLikesDay = dir => edit(dir, 'likes.json', l => { l.updated = today(); });
// 記事に 404 の記録を付ける。返り値はその key
function withMissing(dir, missing, at = 5) {
  let key;
  edit(dir, 'archive.json', a => { a.items[at].missing = missing; key = a.items[at].key; });
  return key;
}

const run = (dir, stubPath, args = []) => spawnSync(process.execPath,
  [...(stubPath ? ['--import', pathToFileURL(stubPath).href] : []), join(dir, 'scripts', 'atesaki-build.mjs'), ...args], { encoding: 'utf8' });
const read = (dir, f) => readFileSync(join(dir, 'atesaki-76a805', 'data', f), 'utf8');

const json = (dir, f) => JSON.parse(read(dir, f));
const has = (dir, key) => ({
  archive: json(dir, 'archive.json').items.some(it => it.key === key),
  evidence: json(dir, 'evidence.json').items.some(d => d.key === key),
  likes: key in json(dir, 'likes.json').likes,
});
const item = (dir, key) => json(dir, 'archive.json').items.find(it => it.key === key);
const calls = dir => { try { return JSON.parse(readFileSync(join(dir, 'calls.json'), 'utf8')); } catch { return []; } };
const inSandbox = fn => () => { const dir = sandbox(); try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); } };

test('スキの読み直しで 404 が1回出ても、記事は外さずに残し、404 の記録だけ付ける', inSandbox(dir => {
  const keys = recentDates(dir);
  const likesBefore = json(dir, 'likes.json').likes[keys[1]];
  const r = run(dir, stub(dir, { gone: [keys[1]] }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(has(dir, keys[1]), { archive: true, evidence: true, likes: true });
  assert.equal(json(dir, 'likes.json').likes[keys[1]], likesBefore, 'スキは前の値のまま');
  assert.deepEqual(item(dir, keys[1]).missing, { since: today(), last: today(), n: 1 });
  assert.equal(item(dir, keys[0]).missing, undefined);
  const a = json(dir, 'archive.json');
  assert.deepEqual(json(dir, 'evidence.json').items.map(d => d.key), a.items.map(it => it.key));
  assert.equal(a.count, a.items.length);
  assert.notEqual(json(dir, 'likes.json').updated, '2000-01-01');
}));

test('同じ日の2回目の回では、404 の記録を数え直さず、note にも取りに行かない(1日1回)', inSandbox(dir => {
  const keys = recentDates(dir);
  assert.equal(run(dir, stub(dir, { gone: [keys[1]] })).status, 0);
  const after1 = read(dir, 'archive.json');
  const r = run(dir, stub(dir, { gone: [keys[1]] }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'archive.json'), after1, '2回目で書き換わった');
  assert.ok(!calls(dir).some(u => u.endsWith('/n/' + keys[1])), '同じ日にもう一度取りに行った');
}));

test('404 が続いても、最初の 404 から7日たつまでは外さない', inSandbox(dir => {
  notLikesDay(dir);
  const key = withMissing(dir, { since: daysAgo(5), last: daysAgo(1), n: 5 });
  const r = run(dir, stub(dir, { gone: [key] }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(has(dir, key), { archive: true, evidence: true, likes: true });
  assert.deepEqual(item(dir, key).missing, { since: daysAgo(5), last: today(), n: 6 });
}));

test('7日たっていても、続けて 404 だった回数が3回に届かなければ外さない', inSandbox(dir => {
  notLikesDay(dir);
  const key = withMissing(dir, { since: daysAgo(10), last: daysAgo(10), n: 1 });
  const r = run(dir, stub(dir, { gone: [key] }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(has(dir, key), { archive: true, evidence: true, likes: true });
  assert.equal(item(dir, key).missing.n, 2);
}));

test('最初の 404 から7日以上・3回以上続けて 404 なら、そのとき初めて外す', inSandbox(dir => {
  notLikesDay(dir);
  const key = withMissing(dir, { since: daysAgo(7), last: daysAgo(2), n: 2 });
  const r = run(dir, stub(dir, { gone: [key] }));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(has(dir, key), { archive: false, evidence: false, likes: false });
  const a = json(dir, 'archive.json');
  assert.equal(a.count, a.items.length);
  assert.match(r.stderr, new RegExp(key));
}));

test('404 の記録がある記事が開けたら、記録を消してデータは元のまま残す', inSandbox(dir => {
  notLikesDay(dir);
  const key = withMissing(dir, { since: daysAgo(8), last: daysAgo(1), n: 6 });
  edit(dir, 'archive.json', a => { a.items[5].modified = '2026-09-01T07:00:00+09:00'; });   // 本文は更新されていない記事にする
  const before = item(dir, key);
  const r = run(dir, stub(dir, {}));
  assert.equal(r.status, 0, r.stderr);
  const after = item(dir, key);
  assert.equal(after.missing, undefined);
  delete before.missing;
  assert.deepEqual(after, before);
}));

test('新しく 404 になった記事が上限(5本)を超えた回は、何も書き換えずに止める', inSandbox(dir => {
  const keys = recentDates(dir, 6);
  const before = [read(dir, 'archive.json'), read(dir, 'evidence.json'), read(dir, 'likes.json')];
  const r = run(dir, stub(dir, { gone: keys }));
  assert.notEqual(r.status, 0);
  assert.deepEqual([read(dir, 'archive.json'), read(dir, 'evidence.json'), read(dir, 'likes.json')], before);
}));

test('RSS の新着の記事ページが 404 なら、今回は足さずに続ける', inSandbox(dir => {
  notLikesDay(dir);
  const before = read(dir, 'archive.json');
  const r = run(dir, stub(dir, { rssNew: 'n0000000000ff' }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'archive.json'), before);
}));

test('スキの部品が読めないページがあれば、何も書き換えずに止める', inSandbox(dir => {
  recentDates(dir);
  const before = [read(dir, 'archive.json'), read(dir, 'likes.json')];
  const r = run(dir, stub(dir, { noLikes: true }));
  assert.notEqual(r.status, 0);
  assert.deepEqual([read(dir, 'archive.json'), read(dir, 'likes.json')], before);
}));

test('知らない引数(廃止した --cache など)は、通信せずに止める', inSandbox(dir => {
  for (const args of [['--cache'], ['--cache', 'x'], ['--rebiuld']]) {
    const r = run(dir, stub(dir, {}), args);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.equal(calls(dir).length, 0, '通信した: ' + calls(dir).join(', '));
  }
}));

test('--rebuild は全件を記事ページから焼き直し、その日を rebuilt に残す', inSandbox(dir => {
  const n = json(dir, 'archive.json').items.length;
  const r = run(dir, stub(dir, {}), ['--rebuild']);
  assert.equal(r.status, 0, r.stderr);
  const a = json(dir, 'archive.json');
  assert.equal(a.items.length, n);
  assert.equal(a.rebuilt, today());
  assert.equal(json(dir, 'likes.json').updated, today());
  assert.ok(!calls(dir).some(u => u.includes('/api/')), '/api を使った');
}));

test('有料は、読めない部分があるときだけ(マガジンに入っているだけで全文が読める「ここから先は 0字」は無料)', inSandbox(dir => {
  const [a, b, c, d] = json(dir, 'archive.json').items.slice(0, 4).map(it => it.key);
  const r = run(dir, stub(dir, { paywall: { [a]: '0', [b]: '3,025', [c]: null } }), ['--rebuild']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual([a, b, c, d].map(k => item(dir, k).paid), [false, true, true, false]);
}));

test('--rebuild で 404 が一度だけ出た記事は、最後の確かめ直しで開ければ外さない', inSandbox(dir => {
  const key = json(dir, 'archive.json').items[4].key;
  const r = run(dir, stub(dir, { goneOnce: [key] }), ['--rebuild']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(has(dir, key), { archive: true, evidence: true, likes: true });
}));

test('--rebuild で2回とも 404 の記事は外し、外したことを知らせる', inSandbox(dir => {
  const key = json(dir, 'archive.json').items[4].key;
  const r = run(dir, stub(dir, { gone: [key] }), ['--rebuild']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(has(dir, key), { archive: false, evidence: false, likes: false });
  assert.match(r.stderr, new RegExp('外した記事: ' + key));
}));

test('--rebuild で見つからない(404)記事が上限を超えたら、何も書き換えずに止める', inSandbox(dir => {
  const before = read(dir, 'archive.json');
  const r = run(dir, stub(dir, { goneFirst: 6 }), ['--rebuild']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /見つからない/);
  assert.equal(read(dir, 'archive.json'), before);
}));

test('ふだんの取り込みは rebuilt(全件を記事ページから焼き直した日)を引き継ぐ', inSandbox(dir => {
  const keys = recentDates(dir);
  edit(dir, 'archive.json', a => { a.rebuilt = '2026-09-26'; });
  const r = run(dir, stub(dir, { gone: [keys[0]] }));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(json(dir, 'archive.json').rebuilt, '2026-09-26');
}));
