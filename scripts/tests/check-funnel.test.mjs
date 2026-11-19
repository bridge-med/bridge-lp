import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buttonHrefs, checkOfferLocal, classifyHttp, latestFromRss, pricesIn, yen } from '../check-funnel.mjs';

const offer = {
  id: 'kit', name: 'Kit', price: 2980, buyUrl: 'https://note.com/x/n/abc',
  buttons: [{ file: 'kit/index.html', link: 'purchase-kit' }],
  pricePages: ['kit/index.html', 'hub/index.html'],
};
const reader = (files) => (p) => (p in files ? files[p] : null);
const good = {
  'kit/index.html': '<p>¥2,980</p><a class="b" href="https://note.com/x/n/abc" data-link="purchase-kit">買う</a>',
  'hub/index.html': '<span class="yen">¥</span><span class="num">2,980</span>',
};

test('yen は桁区切りで書く', () => {
  assert.equal(yen(1980), '1,980');
});

test('buttonHrefs は属性の順番に依らず、別の data-link は拾わない', () => {
  const html = '<a data-link="a" href="/x">x</a><a href="/y" class="k" data-link="b">y</a><a href="/z">z</a>';
  assert.deepEqual(buttonHrefs(html, 'a'), ['/x']);
  assert.deepEqual(buttonHrefs(html, 'b'), ['/y']);
  assert.deepEqual(buttonHrefs(html, 'c'), []);
});

test('通っている経路は指摘なし', () => {
  assert.deepEqual(checkOfferLocal(offer, reader(good)), []);
});

test('購入ボタンが死んだアンカーを指していたら落とす(2026-08-20 の再発防止)', () => {
  const files = { ...good, 'kit/index.html': '<p>¥2,980</p><a href="#buy" data-link="purchase-kit">買う</a>' };
  const issues = checkOfferLocal(offer, reader(files));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /ページに無い場所\(#buy\)/);
});

test('ページ内の購入欄へ降りるボタンは、id があれば通す', () => {
  const files = { ...good, 'kit/index.html': '<a href="#buy" data-link="purchase-kit">購入する</a><section id="buy">¥2,980 <a href="https://note.com/x/n/abc" data-link="purchase-kit">買う</a></section>' };
  assert.deepEqual(checkOfferLocal(offer, reader(files)), []);
});

test('定義と違う行き先は落とす', () => {
  const files = { ...good, 'kit/index.html': '<p>¥2,980</p><a href="https://note.com/x/n/old" data-link="purchase-kit">買う</a>' };
  assert.match(checkOfferLocal(offer, reader(files))[0], /行き先が定義と違う/);
});

test('購入ボタンが消えていたら落とす', () => {
  const files = { ...good, 'kit/index.html': '<p>¥2,980</p>' };
  assert.match(checkOfferLocal(offer, reader(files))[0], /購入ボタン.*が無い/);
});

test('1ページだけ価格が違えば落とす', () => {
  const files = { ...good, 'hub/index.html': '<span class="yen">¥</span><span class="num">3,980</span>' };
  const issues = checkOfferLocal(offer, reader(files));
  assert.match(issues[0], /hub\/index\.html に価格 ¥2,980 の表記が無い/);
  assert.match(issues[1], /定義に無い価格 ¥3,980/);
});

test('同じページの2か所のうち1か所だけ書き換えても落とす(qa 2026-11-19)', () => {
  const files = { ...good, 'hub/index.html': '<li>買い切り(¥2,980)</li><span class="yen">¥</span><span class="num">2,780</span>' };
  assert.deepEqual(checkOfferLocal(offer, reader(files)), ['hub/index.html に、定義に無い価格 ¥2,780 がある']);
});

test('ほかの売り物の価格と otherPrices は通す。部分一致(¥12,980)は通さない', () => {
  const files = { ...good, 'hub/index.html': '¥2,980 / ¥1,980 / ¥20,000' };
  assert.deepEqual(checkOfferLocal(offer, reader(files), [2980, 1980, 20000]), []);
  assert.match(checkOfferLocal(offer, reader({ ...good, 'hub/index.html': '¥12,980' }))[0], /¥2,980 の表記が無い/);
});

test('pricesIn は ¥ の付いた金額だけを拾い、表の数字は拾わない', () => {
  assert.deepEqual(pricesIn('<td class="num">4,212</td> ¥1,980 <span class="yen">¥</span><span class="num">2,980</span> ¥0'), [1980, 2980]);
});

test('data-link の無いリンクが別の販売記事を指していたら落とす(qa 2026-11-19)', () => {
  const files = { ...good, 'kit/index.html': good['kit/index.html'] + '<a href="https://note.com/x/n/old">購入</a><a href="https://note.com/x">Note</a>' };
  assert.deepEqual(checkOfferLocal(offer, reader(files)), ['kit/index.html に、定義と違う販売先へのリンクがある(https://note.com/x/n/old)']);
});

test('リポジトリの中の購入先は、ファイルが無ければ落とす', () => {
  const local = { ...offer, buyUrl: '../community/index.html' };
  const files = {
    'kit/index.html': '<p>¥2,980</p><a href="../community/index.html" data-link="purchase-kit">申し込む</a>',
    'hub/index.html': '¥2,980',
  };
  assert.match(checkOfferLocal(local, reader(files))[0], /購入先 community\/index\.html が無い/);
  assert.deepEqual(checkOfferLocal(local, reader({ ...files, 'community/index.html': 'ok' })), []);
});

test('切れていると言い切るのは 404 と 410 だけ', () => {
  assert.equal(classifyHttp(200), 'alive');
  assert.equal(classifyHttp(404), 'dead');
  assert.equal(classifyHttp(410), 'dead');
  assert.equal(classifyHttp(403), 'unknown');
  assert.equal(classifyHttp(503), 'unknown');
  assert.equal(classifyHttp(0), 'unknown');
});

test('RSS の最新の1本を日本時間の日付で取る', () => {
  const xml = '<rss><channel><item><title><![CDATA[最終話]]></title><pubDate>Wed, 04 Nov 2026 19:00:00 +0900</pubDate></item><item><title>古い</title><pubDate>Mon, 02 Nov 2026 19:00:00 +0900</pubDate></item></channel></rss>';
  assert.deepEqual(latestFromRss(xml), { date: '2026-11-04', title: '最終話' });
  // UTC では前日でも、日本時間では翌日
  assert.equal(latestFromRss('<item><title>t</title><pubDate>Tue, 03 Nov 2026 20:00:00 GMT</pubDate></item>').date, '2026-11-04');
  assert.equal(latestFromRss('<rss></rss>'), null);
});
