/* 宛先しらべ 取り込み(scripts/atesaki-build.mjs)のテスト
 * 実行: node --test atesaki-76a805/tests/*.test.mjs
 * note には通信しない。一時フォルダにリポジトリの必要な部分を写し、偽の fetch(--import で差し込む)で走らせる。
 * 確かめること: 404 の記事は外して続ける / スキの部品が読めないページがあれば書き換えない /
 * --cache のフォルダがないときは通信せずに止める。 */
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

// 偽の fetch。opts.gone: 404 を返す key / opts.noLikes: スキの部品を出さない / 呼ばれた URL は calls.json に残す
function stub(dir, opts) {
  const path = join(dir, 'stub.mjs');
  writeFileSync(path, `
import { readFileSync, writeFileSync } from 'node:fs';
const A = JSON.parse(readFileSync(${JSON.stringify(join(dir, 'atesaki-76a805', 'data', 'archive.json'))}, 'utf8'));
const opts = ${JSON.stringify(opts)};
const calls = [];
process.on('exit', () => writeFileSync(${JSON.stringify(join(dir, 'calls.json'))}, JSON.stringify(calls)));
const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
globalThis.fetch = async url => {
  url = String(url); calls.push(url);
  const ok = body => ({ ok: true, status: 200, text: async () => body });
  if (url.endsWith('/rss')) {
    const it = A.items[0];
    return ok('<rss><channel><item><title>' + it.title + '</title><pubDate>Fri, 25 Sep 2026 19:00:00 +0900</pubDate><link>https://note.com/' + A.user + '/n/' + it.key + '</link></item></channel></rss>');
  }
  const key = url.split('/n/')[1];
  if (opts.gone === key) return { ok: false, status: 404, text: async () => '' };
  const it = A.items.find(i => i.key === key);
  const ld = { '@type': 'BlogPosting', headline: it.title, datePublished: it.date + 'T07:00:00+09:00', dateModified: it.date + 'T07:00:00+09:00', keywords: '看護師,キャリア' };
  const likes = opts.noLikes ? '' : '<button class="o-noteLikeV3"><span class="o-noteLikeV3__count">7</span></button>';
  return ok('<script type="application/ld+json">' + JSON.stringify(ld) + '</script>' + likes + '<div data-name="body" class="x"><p>看護師として働いて、転職を考えた。</p></div>');
};
`);
  return path;
}

// 公開から60日以内の記事がスキの読み直しの対象になるよう、記事の日付を今日の近くにずらす
function recentDates(dir) {
  const p = join(dir, 'atesaki-76a805', 'data', 'archive.json');
  const a = JSON.parse(readFileSync(p, 'utf8'));
  const day = new Date(Date.now() + 9 * 3600e3 - 3 * 86400e3).toISOString().slice(0, 10);
  a.items.slice(0, 3).forEach(it => { it.date = day; });
  writeFileSync(p, JSON.stringify(a));
  const l = join(dir, 'atesaki-76a805', 'data', 'likes.json');
  const likes = JSON.parse(readFileSync(l, 'utf8'));
  likes.updated = '2000-01-01';   // 読み直しの日にする
  writeFileSync(l, JSON.stringify(likes));
  return a.items.slice(0, 3).map(it => it.key);
}

const run = (dir, stubPath, args = []) => spawnSync(process.execPath,
  [...(stubPath ? ['--import', pathToFileURL(stubPath).href] : []), join(dir, 'scripts', 'atesaki-build.mjs'), ...args], { encoding: 'utf8' });
const read = (dir, f) => readFileSync(join(dir, 'atesaki-76a805', 'data', f), 'utf8');

test('スキの読み直しで 404 の記事は外し、残りは書き直す', () => {
  const dir = sandbox();
  try {
    const keys = recentDates(dir);
    const r = run(dir, stub(dir, { gone: keys[1] }));
    assert.equal(r.status, 0, r.stderr);
    const a = JSON.parse(read(dir, 'archive.json'));
    assert.ok(!a.items.some(it => it.key === keys[1]), '404 の記事が残っている');
    assert.ok(a.items.some(it => it.key === keys[0]));
    const ev = JSON.parse(read(dir, 'evidence.json'));
    assert.deepEqual(ev.items.map(d => d.key), a.items.map(it => it.key));
    assert.notEqual(JSON.parse(read(dir, 'likes.json')).updated, '2000-01-01');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('スキの部品が読めないページがあれば、何も書き換えずに止める', () => {
  const dir = sandbox();
  try {
    recentDates(dir);
    const before = [read(dir, 'archive.json'), read(dir, 'likes.json')];
    const r = run(dir, stub(dir, { noLikes: true }));
    assert.notEqual(r.status, 0);
    assert.deepEqual([read(dir, 'archive.json'), read(dir, 'likes.json')], before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('--cache のフォルダがないときは、通信せずに止める', () => {
  const dir = sandbox();
  try {
    const r = run(dir, stub(dir, {}), ['--cache']);
    assert.notEqual(r.status, 0);
    let calls = [];
    try { calls = JSON.parse(readFileSync(join(dir, 'calls.json'), 'utf8')); } catch { /* 呼ばれていなければファイルもない */ }
    assert.equal(calls.length, 0, '通信した: ' + calls.join(', '));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
