/* 宛先しらべ 判定ロジックのテスト
 * 実行: node --test atesaki-76a805/tests/*.test.mjs
 * 数え方の性質(文で数える・職種の列挙・英字の境目・全角の正規化)、宛先の一文、タイトルと本文のずれ、
 * URL の読み取り、スキから見た目安の三分法、焼いたデータと判定の版の一致を確かめる。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const E = require(join(ROOT, 'app', 'engine.js'));
const LX = require(join(ROOT, 'app', 'lexicon.js'));

const para = (...lines) => lines.join('\n');

test('看護師の場面が多い文章は、看護師に届く', () => {
  const r = E.analyze({
    title: '夜勤明けの看護師が、転職を考えるとき',
    text: para('夜勤明けの更衣室で、看護師の同期と話した。', '申し送りが終わると、病棟の廊下はもう静かだった。',
      '看護師として10年働いて、転職を考え始めた。', '履歴書に何を書けばいいのか分からない。', '師長には、まだ言えていない。'),
  });
  assert.equal(r.top.who[0], 'nurse');
  assert.equal(r.top.topic[0], 'career');
  assert.equal(r.reader.text, '看護師で、キャリアの選び方が気になっている人');
});

test('語の回数ではなく文で数える: 例を並べた1文が主題に勝たない', () => {
  const r = E.analyze({
    title: 'キャリアを考える',
    text: para('キャリアのことを考える。', '転職するかどうか、キャリアの選択肢を並べる。', 'キャリアは職種の中だけではない。',
      '後輩指導、新人教育、育成、マネジメント、リーダーシップ、1on1。'),
  });
  assert.equal(r.top.topic[0], 'career');
});

test('3職種以上を並べた文は「職種を問わず医療職」として数える', () => {
  const r = E.analyze({
    title: '医療職の経験は、外でも通じる',
    text: para('看護師でも、医療事務でも、理学療法士でも、介護職でも同じです。', '医療職の経験は、言いかえれば外でも通じます。',
      '医療職として働いていると、職種の中で考えがちです。', 'キャリアの選択肢は、思っているより広い。',
      '転職だけがキャリアではありません。', 'キャリアを職種の外まで広げて考える。'),
  });
  assert.equal(r.generalLead, true);
  assert.ok(r.reader.text.startsWith('職種を問わず医療職で、'), r.reader.text);
  assert.ok(r.raw.nurse < E.MIN_RAW && r.raw.nurse < r.raw.general / 3, '列挙の文は各職種に少ししか入らない');
});

test('英字の語は単語の境目だけ: PTA や STEP に当たらない。全角の ＰＴ は数える', () => {
  assert.equal(E.scan('PTAの役員とSTEPの話').length, 0);
  const hits = E.scan(E.normalize('ＰＴとして働く'));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].key, 'pt');
});

test('長い語を先に取る: 看護師 は 看護 と二重に数えない。学生時代 は学生の読み手にほぼ入らない', () => {
  const hits = E.scan('看護師の看護');
  assert.deepEqual(hits.map(h => h.key), ['看護師', '看護']);
  const r = E.analyze({ title: '', text: '学生時代の話。学生時代は遊んでいた。学生時代の友人。' });
  assert.ok(r.raw.student < E.MIN_RAW);
});

test('手がかりが少ない文章は、読み手を言わない', () => {
  const r = E.analyze({ title: '雨の帰り道', text: '傘を忘れた。駅まで歩いた。コンビニで温かい飲み物を買った。' });
  assert.equal(r.reader.found, false);
  assert.equal(r.reader.text, '');
});

test('読み手の一文に、句点・感嘆符・数字が入らない', () => {
  const samples = [
    { title: '28歳、PT、本業420万円', text: '理学療法士として年収420万円。手取りは少ない。給料の話をする。副業も考えた。' },
    { title: 'AIに仕事を奪われる前に', text: 'ChatGPTを使う。生成AIで記録を書く。医療職こそAIを使う。' },
  ];
  for (const s of samples) {
    const t = E.analyze(s).reader.text;
    assert.ok(t.length > 0);
    assert.ok(!/[。!!0-9]/.test(t), t);
  }
});

test('根拠の引用: 印の位置が辞書の語を指し、88字(+省略記号)を超えない', () => {
  const long = '僕はこれまで、いろいろな場所で働いてきたけれど、' + 'とても長い前置きが続く文章で、'.repeat(6) + '最後にようやく転職の話になった。';
  const r = E.analyze({ title: '働き方', text: para(long, '転職の話をする。', 'キャリアの話もする。', '転職するか迷っている。') });
  for (const q of r.evidence.career) {
    assert.ok(q.text.length <= 90, q.text);
    for (const [a, b] of q.marks) assert.ok(E.scan(q.text.slice(a, b)).length === 1, q.text.slice(a, b));
  }
});

test('note の URL から key を読む', () => {
  const k = 'n93e712e88e58';
  assert.deepEqual(E.parseNoteUrl(`https://note.com/prime_duck4944/n/${k}`), { key: k, user: 'prime_duck4944' });
  assert.equal(E.parseNoteUrl(`https://note.com/prime_duck4944/n/${k}?magazine_key=m123`).key, k);
  assert.equal(E.parseNoteUrl(`  note.com/someone/n/${k}#comment  `).user, 'someone');
  assert.equal(E.parseNoteUrl(`https://example.com/n/${k}`).user, null);
  assert.equal(E.parseNoteUrl(k).key, k);
  assert.equal(E.parseNoteUrl('https://note.com/prime_duck4944'), null);
  assert.equal(E.parseNoteUrl(''), null);
});

test('HTML → 文字: 段落は改行、実体参照は文字に', () => {
  const t = E.htmlToText('<p name="a">看護師&amp;PT</p><p>1&lt;2<br>次の行</p><figure><img src="x"></figure>');
  assert.equal(t, '看護師&PT\n1<2\n次の行');
});

test('スキから見た目安: 本数が足りなければ「まだ判定できない」。多め/少なめは向きがそろうときだけ', () => {
  assert.equal(E.verdictOf(E.MIN_N - 1, 3, E.MIN_N - 1), 'unknown');
  const n = E.MIN_N + 6;
  assert.equal(E.verdictOf(n, 1.5, n - 4), 'more');
  assert.equal(E.verdictOf(n, 1.5, n / 2), 'same', '中央値が高くても、半分しか上回っていなければ言わない');
  assert.equal(E.verdictOf(n, 0.6, 4), 'less');
  assert.equal(E.verdictOf(n, 1.05, n / 2), 'same');
});

test('相対スキ: 物語・有料・公開から7日未満の記事は数えない。窓がその読み手で埋まる記事も数えない', () => {
  const items = [];
  const likes = {};
  // 80日にわたって、ai と career を交互に出す(ai はスキが多い)
  for (let i = 0; i < 80; i++) {
    const key = 'k' + i;
    const topic = i % 2 ? 'ai' : 'career';
    const d = new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10);
    items.push({ key, date: d, top: { who: [], topic: [topic] }, generalLead: false });
    likes[key] = topic === 'ai' ? 20 : 5;
  }
  items.push({ key: 'new', date: '2026-09-24', top: { who: [], topic: ['ai'] }, generalLead: false });
  items.push({ key: 'story', date: '2026-07-10', story: true, top: { who: [], topic: ['ai'] }, generalLead: false });
  items.push({ key: 'paid', date: '2026-07-11', paid: true, top: { who: [], topic: ['ai'] }, generalLead: false });
  Object.assign(likes, { new: 0, story: 100, paid: 0 });
  const c = E.calibrate(items, likes, '2026-09-25');
  assert.equal(c.rel.new, undefined);
  assert.equal(c.rel.story, undefined);
  assert.equal(c.rel.paid, undefined);
  assert.equal(c.settling, 1);
  assert.equal(c.bySeg.ai.n, 40);
  assert.equal(c.bySeg.ai.verdict, 'more');
  assert.equal(c.bySeg.career.verdict, 'less');
  assert.equal(c.bySeg.study.verdict, 'unknown');

  // 同じ話題だけを続けた時期: 比べる相手がいないので数えない
  const same = [];
  const l2 = {};
  for (let i = 0; i < 40; i++) { const key = 's' + i; same.push({ key, date: new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10), top: { who: [], topic: ['biz'] } }); l2[key] = 10; }
  assert.equal(E.calibrate(same, l2, '2026-09-25').bySeg.biz.n, 0);
});

test('辞書: 重みは 0〜3、同じ読み手の中で語が重ならない、一文の呼び名に句読点・感嘆符がない', () => {
  for (const id of E.SEG_IDS) {
    const seg = E.SEGS[id];
    const seen = new Set();
    for (const [term, w] of seg.terms) {
      assert.ok(w > 0 && w <= 3, `${id}: ${term} の重み ${w}`);
      assert.ok(!seen.has(term), `${id}: ${term} が重複`);
      seen.add(term);
    }
    assert.ok(seg.phrase && !/[。、!!]/.test(seg.phrase), id);
    assert.ok(seg.short && seg.label, id);
  }
  assert.deepEqual(LX.AXES.map(a => a.id), ['who', 'topic']);
});

/* ---- 焼いたデータ(atesaki-76a805/data)と判定の版 ---- */
const DATA = join(ROOT, 'data');
const archive = JSON.parse(readFileSync(join(DATA, 'archive.json'), 'utf8'));

test('焼いたデータの判定の版が、いまの辞書・判定と一致する(違えば node scripts/atesaki-build.mjs --rebuild で焼き直す)', () => {
  assert.equal(archive.fingerprint, E.FINGERPRINT);
});

test('一覧と根拠が同じ記事を同じ順で持ち、スキがそろっている', () => {
  const ev = JSON.parse(readFileSync(join(DATA, 'evidence.json'), 'utf8'));
  assert.equal(ev.fingerprint, E.FINGERPRINT);
  assert.equal(archive.count, archive.items.length);
  assert.deepEqual(ev.items.map(d => d.key), archive.items.map(it => it.key));
  assert.equal(new Set(archive.items.map(it => it.key)).size, archive.items.length, 'key の重複');
  const likes = JSON.parse(readFileSync(join(DATA, 'likes.json'), 'utf8'));
  for (const it of archive.items) assert.ok(Number.isInteger(likes.likes[it.key]), 'スキがない ' + it.key);
  for (const axis of ['who', 'topic']) {
    const sum = Object.values(archive.baseline[axis]).reduce((a, b) => a + b, 0);
    assert.ok(sum > 0.9 && sum <= 1.01, axis + ' の基準の割合の合計 ' + sum);
  }
});

test('焼いたデータに本文の全文を持たない(引用は1読み手2文・90字まで)。物語は宛先の一文を持たない', () => {
  const ev = JSON.parse(readFileSync(join(DATA, 'evidence.json'), 'utf8'));
  for (const d of ev.items) {
    for (const qs of Object.values(d.evidence)) {
      assert.ok(qs.length <= 2);
      for (const q of qs) assert.ok(q.text.length <= 90, d.key);
    }
    assert.equal(d.text, undefined);
    assert.equal(d.body, undefined);
  }
  for (const it of archive.items.filter(it => it.story)) assert.equal(it.reader.text, '', it.title);
});

test('タイトルと本文を分けて読む: タイトルが医療職全体、本文がリハ職ならずれとして返す', () => {
  const r = E.analyze({
    title: '資格を増やせば、医療職の市場価値は上がるのか',
    text: para('理学療法士として働いてきた。', '理学療法士の資格を持っている。', 'PTとして10年。', '理学療法士の勉強会に出た。',
      '資格を取る。', '大学院に行った。', '研究もした。', '論文を書いた。'),
  });
  assert.equal(r.titleRead.who, 'general');
  assert.equal(r.main.who, 'rehab');
  assert.equal(r.gap.who, true);
  assert.ok(r.reader.text.startsWith('リハ職で、'), '宛先の一文は本文で決める: ' + r.reader.text);
});

test('タイトルは弱い語で決めない。末尾のシリーズ名は読まない', () => {
  assert.equal(E.readTitle('病棟で考えたこと').who, null, '病棟(重み1)では看護師と読まない');
  assert.equal(E.readTitle('研究を選ばなかった理由 – キャリア探求シリーズ').topic, 'study');
  assert.equal(E.readTitle('研究との出会い – キャリア探求シリーズ(番外編)').topic, 'study');
  assert.equal(E.readTitle('PT出身の僕が、医療職のキャリアを考える').who, 'general');
});

test('物語は宛先を出さない。体の仕組みの解説でタイトルが職種を呼ばなければ医療職以外', () => {
  const s = E.analyze({ title: '第3話 雨の帰り道', text: '看護師の彼女は、夜勤明けに病棟を出た。看護師長に呼ばれた。' });
  assert.equal(s.story, true);
  assert.equal(s.reader.found, false);
  assert.equal(s.reader.note, 'story');
  const b = E.analyze({
    title: 'なぜ寒いと体が震えるのか',
    text: para('寒いと筋肉が震えて体温を上げる。', '自律神経が体温を保つ。', '筋肉の震えは熱を作る。', '体温が下がると震えが起きる。', 'PTの僕も驚いた。'),
  });
  assert.equal(b.main.who, 'public');
  assert.equal(b.reader.text, '医療職以外で、体と健康の仕組みが気になっている人');
});

test('欄の中身が URL 1本なら URL、それ以外は本文として扱う', () => {
  assert.equal(E.looksLikeUrl('https://note.com/prime_duck4944/n/n93e712e88e58'), true);
  assert.equal(E.looksLikeUrl(' note.com/x/n/n93e712e88e58 '), true);
  assert.equal(E.looksLikeUrl('n93e712e88e58'), true);
  assert.equal(E.looksLikeUrl('今日は https://note.com/x を読んだ'), false);
  assert.equal(E.looksLikeUrl('看護師として働いて'), false);
});

test('いつもとの差: 平均より CONTRAST 以上多い・少ない読み手だけ', () => {
  const base = { who: { rehab: 0.7, nurse: 0.05 }, topic: { biz: 0.25, career: 0.1 } };
  const d = E.contrast({ who: { rehab: 0.3, nurse: 0.6 }, topic: { biz: 0.2, career: 0.5 } }, base);
  assert.deepEqual(d.more.map(x => x.id).sort(), ['career', 'nurse']);
  assert.deepEqual(d.less.map(x => x.id), ['rehab']);
});

test('名指しの呼びかけ(「院長・事務長の方」)は、その職種を重く数える', () => {
  const r = E.analyze({ title: '', text: para('整形外科クリニックを経営されている方へ。', '院長・事務長の方に読んでほしい。', 'PTの採用。', 'PTの単位数。', 'リハビリの点数。', '理学療法士の配置。', 'PTの教育。') });
  assert.equal(r.main.who, 'manager');
});

test('タイトルの枠に本文の裏付けがあれば主役にし、裏付けが弱いときだけずれとする', () => {
  const framed = E.analyze({ title: 'キャリアを考える', text: para('キャリアの話をする。', '転職も考えた。', '研究をした。', '論文を書いた。', '大学院に行った。', '学会で発表した。') });
  assert.equal(framed.main.topic, 'career');
  assert.equal(framed.gap.topic, false);
  const weak = E.analyze({ title: '年収の話', text: para('研究をした。', '論文を書いた。', '大学院に行った。', '学会で発表した。') });
  assert.equal(weak.main.topic, 'study');
  assert.equal(weak.gap.topic, true);
});
