/* BRIDGE Compass 判定ロジックのテスト
 * 実行: node --test compass/tests/*.test.mjs
 * persona ごとに「どの橋が見えるか」と、判定の性質(関心だけで決まらない・Q5は減点しない・
 * 自由記述は判定にも共有文にも入らない・禁止表現がない・リンク先が実在する)を確かめる。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');
const D = require(join(APP, 'data.js'));
const E = require(join(APP, 'engine.js'));

const ids = r => r.bridges.map(b => b.bridge.id);
const slot = (r, s) => r.bridges.find(b => b.slot.id === s).bridge.id;

const PERSONAS = {
  // 専門性を深めたい臨床職
  specialist:  { profession: 'pt', q1: 'a', q2: 'a', q3: 'a', q4: ['deep', 'cause'], q5: ['none'], q6: 'a', q7: ['expertise', 'stability'], q8: 'a' },
  // 教育経験が強い人
  educator:    { profession: 'nurse', q1: 'c', q2: 'c', q3: 'c', q4: ['teach', 'listen'], q5: ['data'], q6: 'b', q7: ['growth', 'impact'], q8: 'b' },
  // マネジメント/改善経験が強い人
  mgmtImprove: { profession: 'ot', q1: 'd', q2: 'd', q3: 'e', q4: ['improve', 'data'], q5: ['deep'], q6: 'c', q7: ['income', 'autonomy'], q8: 'c' },
  // DXへの興味が強い人
  dx:          { profession: 'st', q1: 'd', q2: 'e', q3: 'e', q4: ['data', 'improve'], q5: ['none'], q6: 'f', q7: ['novelty', 'growth'], q8: 'g' },
  // 新規事業への興味が強い人
  newbiz:      { profession: 'judo', q1: 'e', q2: 'f', q3: 'f', q4: ['create', 'listen'], q5: ['deep'], q6: 'e', q7: ['autonomy', 'income'], q8: 'f' },
  // 行政/政策への興味が強い人
  policy:      { profession: 'other', q1: 'c', q2: 'd', q3: 'b', q4: ['cause', 'data'], q5: ['teach'], q6: 'g', q7: ['impact', 'stability'], q8: 'h' },
};

test('どの persona でも、橋は3つ・重複なし・3つの見出しの順', () => {
  for (const [name, a] of Object.entries(PERSONAS)) {
    const r = E.buildResult(a);
    assert.equal(r.bridges.length, 3, name);
    assert.equal(new Set(ids(r)).size, 3, name + ': 同じ橋が複数の枠に出ている');
    assert.deepEqual(r.bridges.map(b => b.slot.id), ['experience', 'interest', 'hidden'], name);
    for (const b of r.bridges) {
      assert.ok(b.reason.length > 0, name + ': 理由が空');
      assert.ok(b.basis.assets.length > 0, name + ': つながっている経験が空');
    }
  }
});

test('専門性を深めたい臨床職: 経験の橋は臨床スペシャリスト', () => {
  const r = E.buildResult(PERSONAS.specialist);
  assert.equal(slot(r, 'experience'), 'clinical');
  assert.ok(r.tags.includes('専門性'));
});

test('教育経験が強い人: 経験の橋は教育 / 人材育成', () => {
  const r = E.buildResult(PERSONAS.educator);
  assert.equal(slot(r, 'experience'), 'education');
  assert.equal(r.tags[0], '教育');
});

test('マネジメント/改善経験が強い人: 医療経営とマネジメントが見える', () => {
  const r = E.buildResult(PERSONAS.mgmtImprove);
  assert.equal(slot(r, 'experience'), 'bizops');
  assert.equal(slot(r, 'interest'), 'management');
});

test('DXへの興味が強い人: 医療DXが見える', () => {
  const r = E.buildResult(PERSONAS.dx);
  assert.ok(ids(r).includes('dx'));
});

test('新規事業への興味が強い人: 事業をつくる側の橋が見える', () => {
  const r = E.buildResult(PERSONAS.newbiz);
  const newBiz = ['product', 'startup', 'bizdev'];
  assert.ok(newBiz.includes(slot(r, 'interest')));
  assert.ok(ids(r).filter(id => newBiz.includes(id)).length >= 2);
});

test('行政/政策への興味が強い人: 行政 / 医療政策が見える', () => {
  const r = E.buildResult(PERSONAS.policy);
  assert.ok(ids(r).includes('policy'));
});

test('関心(Q6/Q8)が同じでも、経験が違えば見える橋が変わる', () => {
  const interest = { q6: 'f', q7: ['novelty', 'growth'], q8: 'g' };
  const improver = E.buildResult({ ...PERSONAS.dx, ...interest });
  const clinician = E.buildResult({ profession: 'pt', q1: 'a', q2: 'b', q3: 'a', q4: ['deep', 'teach'], q5: ['none'], ...interest });
  assert.notDeepEqual(ids(improver), ids(clinician));
  assert.notEqual(slot(improver, 'experience'), slot(clinician, 'experience'));
  assert.equal(slot(clinician, 'experience'), 'clinical');
});

test('関心が二方向に割れたとき、どちらを「渡ってみる橋」にするかは経験で決まる', () => {
  // Q6=AI・テクノロジー / Q8=医療政策。関心の強さは同じ
  const split = { q6: 'f', q7: ['novelty', 'impact'], q8: 'h' };
  const dataPerson = E.buildResult({ profession: 'pt', q1: 'a', q2: 'f', q3: 'f', q4: ['create', 'data'], q5: ['none'], ...split });
  const coordinator = E.buildResult({ profession: 'pt', q1: 'c', q2: 'd', q3: 'd', q4: ['listen', 'cause'], q5: ['none'], ...split });
  const picked = r => ['dx', 'policy'].filter(id => ids(r).includes(id) && slot(r, 'interest') === id);
  assert.deepEqual(picked(dataPerson), ['dx']);
  assert.deepEqual(picked(coordinator), ['policy']);
});

test('価値観(Q7)だけでは橋が決まらない', () => {
  const base = PERSONAS.specialist;
  const a = E.buildResult({ ...base, q7: ['income', 'autonomy'] });
  const b = E.buildResult({ ...base, q7: ['impact', 'novelty'] });
  assert.equal(slot(a, 'experience'), slot(b, 'experience'));
  assert.equal(slot(a, 'interest'), slot(b, 'interest'));
});

test('Q5(やりたくない)は経験資産を減点しない。関わりの強い役割だけを少し下げる', () => {
  const base = PERSONAS.educator;
  const withAvoid = { ...base, q5: ['teach'] };
  const a0 = E.computeAssets(base), a1 = E.computeAssets(withAvoid);
  assert.deepEqual(a0.scores, a1.scores);
  const r0 = E.buildResult(base)._debug.roles, r1 = E.buildResult(withAvoid)._debug.roles;
  assert.ok(r1.educator.total < r0.educator.total);
  assert.equal(r1.specialist.total, r0.specialist.total);
});

test('Q4とQ5の重なりはエラーにせず、「できるが、やりたいとは限らない」として返す', () => {
  const r = E.buildResult({ ...PERSONAS.educator, q5: ['teach'] });
  assert.deepEqual(r.overlaps, ['人に教える']);
  assert.match(r.bridges[0].reason, /今後あまりやりたくない/);
});

test('自由記述(Q9/Q10)は判定に使わず、共有文にも入らない', () => {
  const words = { q9: '病棟の申し送りの型を作った', q10: '地元で小さな店を開く' };
  const plain = E.buildResult(PERSONAS.newbiz);
  const withText = E.buildResult({ ...PERSONAS.newbiz, ...words });
  assert.deepEqual(ids(plain), ids(withText));
  assert.equal(withText.made, words.q9);
  assert.equal(withText.wish, words.q10);
  const share = E.shareText(withText);
  assert.ok(!share.includes(words.q9) && !share.includes(words.q10));
  for (const b of withText.bridges) assert.ok(share.includes('『' + b.bridge.name + '』'));
  assert.match(share, /#BRIDGECompass/);
});

test('職種は言いかえの選択だけに使い、橋を変えない', () => {
  const pt = E.buildResult({ ...PERSONAS.mgmtImprove, profession: 'pt' });
  const judo = E.buildResult({ ...PERSONAS.mgmtImprove, profession: 'judo' });
  assert.deepEqual(ids(pt), ids(judo));
  assert.notDeepEqual(pt.translations, judo.translations);
  for (const p of D.PROFESSIONS) {
    const r = E.buildResult({ ...PERSONAS.dx, profession: p.id });
    assert.ok(r.translations.length >= 1 && r.translations.length <= 2, p.id);
  }
});

test('見出しは回答で変わる', () => {
  const heads = new Set(Object.values(PERSONAS).map(a => E.buildResult(a).headline));
  assert.ok(heads.size >= 4);
});

test('見出しは2行の短い言いかえ。「あなたは○○な人です」の形にしない', () => {
  for (const [name, a] of Object.entries(PERSONAS)) {
    const r = E.buildResult(a);
    assert.ok(r.headlineLines.length >= 1 && r.headlineLines.length <= 2, name);
    assert.equal(r.headline, r.headlineLines.join(''), name);
    assert.match(r.headline, /力$/, name);
    assert.ok(!/あなたは|な人|です|。/.test(r.headline), name + ': ' + r.headline);
  }
  for (const [key, lines] of Object.entries(D.HEADLINES)) {
    assert.equal(lines.length, 2, key);
    for (const k of key.split('+')) assert.ok(D.ASSETS[k], key);
    assert.equal(key, key.split('+').sort().join('+'), key + ' はアルファベット順で書く');
  }
});

test('Q10(本人が見つけた橋)は、内容が政策の話でも Compass の橋を行政/政策に変えない', () => {
  // PR #123 の確認 persona(PT)。Q10 の中身で判定し直さず、独立した「本人の橋」として返す
  const base = { profession: 'pt', q1: 'b', q2: 'd', q3: 'f', q4: ['teach', 'listen'], q5: ['deep'], q6: 'e', q7: ['income', 'growth'], q8: 'g',
    q9: '組織が崩壊しかけているところで、自分のチームだけは保つことができた' };
  const wish = '政治家というか、厚生労働省のリハビリテーションみたいな感じで関わってみたい';
  const without = E.buildResult(base), withWish = E.buildResult({ ...base, q10: wish });
  assert.deepEqual(ids(withWish), ids(without));
  assert.deepEqual(withWish.headlineLines, without.headlineLines);
  assert.deepEqual(withWish.tags, without.tags);
  assert.equal(withWish.wish, wish);
  assert.equal(without.wish, '');
});

test('3つの橋に入らなかった関心は「気になっている方向」として残る。橋の選び方は変えない', () => {
  // 依頼 persona(PT): Q6=新しい企画 / Q8=AI・テクノロジー。AI は3つの橋に入らないが、結果から消さない
  const persona = { profession: 'pt', q1: 'b', q2: 'd', q3: 'f', q4: ['teach', 'listen'], q5: ['deep'], q6: 'e', q7: ['income', 'growth'], q8: 'g' };
  const r = E.buildResult(persona);
  assert.ok(!ids(r).includes('dx'));
  assert.deepEqual(r.openInterests, ['AI・テクノロジー']);
  // 関心がどれかの橋に入っているときは何も出さない
  assert.deepEqual(E.buildResult(PERSONAS.dx).openInterests, []);
  assert.deepEqual(E.buildResult(PERSONAS.specialist).openInterests, []);
  // 関心の残し方は、橋の顔ぶれに影響しない(同じ回答で engine の選定結果と一致)
  const again = E.buildResult({ ...persona });
  assert.deepEqual(ids(again), ids(r));
});

test('経験資産の名前と橋の名前を同じ言葉にしない(資産→橋の階層が分かるように)', () => {
  const bridgeNames = new Set(D.BRIDGES.map(b => b.name));
  for (const [k, a] of Object.entries(D.ASSETS)) {
    assert.ok(!bridgeNames.has(a.tag) && !bridgeNames.has(a.label), k + ': ' + a.tag);
  }
});

test('マスターの整合: 役割・橋の重みは合計1、参照先の役割・資産が実在する', () => {
  for (const [r, def] of Object.entries(D.ROLES)) {
    const sum = Object.values(def.weights).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, r + ' の重みの合計が1でない');
    for (const a of Object.keys(def.weights)) assert.ok(D.ASSETS[a], r + ': ' + a);
  }
  for (const b of D.BRIDGES) {
    const sum = Object.values(b.roles).reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, b.id + ' の重みの合計が1でない');
    for (const r of Object.keys(b.roles)) assert.ok(D.ROLES[r], b.id + ': ' + r);
  }
  for (const q of D.QUESTIONS) for (const o of q.options || []) {
    for (const r of Object.keys(o.interest || {})) assert.ok(D.ROLES[r], q.id + '/' + o.id + ': ' + r);
  }
  for (const [r, def] of Object.entries(D.ROLES)) assert.ok(def.interest, r + ' に「気になっている方向」の呼び名がない');
  for (const [p, list] of Object.entries(D.TRANSLATIONS)) {
    for (const t of list) for (const a of t.assets) assert.ok(D.ASSETS[a], p + ': ' + a);
  }
});

test('既存コンテンツへのリンク先が実在する', () => {
  for (const b of D.BRIDGES) for (const l of b.links) {
    assert.ok(existsSync(resolve(HERE, '..', l.href)), b.id + ' → ' + l.href);
  }
});

test('禁止表現を画面の文言に使っていない', () => {
  const banned = [/診断/, /適職/, /向いて(い|る)/, /べきです/, /適性/, /[!!]/];
  const jp = /[\u3040-\u30ff\u4e00-\u9fff]/;
  const files = readdirSync(APP).filter(f => f.endsWith('.js')).map(f => join(APP, f)).concat(join(HERE, '..', 'index.html'));
  for (const f of files) {
    /* コメントは開発者向けの説明なので対象外。日本語を含む文字列リテラルと本文だけを見る */
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
    const strings = f.endsWith('.html')
      ? src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').split('\n')
      : (src.match(/'[^'\n]*'/g) || []);
    for (const s of strings.filter(x => jp.test(x))) for (const re of banned) {
      assert.ok(!re.test(s), f + ': ' + s.trim().slice(0, 60) + ' ← ' + re);
    }
  }
});
