/**
 * make-ogp.mjs — プロダクトページのOGPカード(1200×630)を生成する。
 *
 * 2026-07-13 に作られた思想ハブ9枚(images/ogp/*.jpg)は生成元が残っていない。
 * 同じ「家族」を今後も増やせるように、こちらは版下をリポジトリに残す。
 * 新しいプロダクトのカードが要るときは CARDS に1行足して再実行する。
 *
 * 構図(思想ハブ9枚から実測して合わせてある。数字を動かすと家族が壊れる):
 *   左余白 100px / ロゴ 交差する二本の線+BRIDGE / 砂の小見出し / 大きな名前 / 一行
 *   背景を横切る二本の線は第24条の署名そのもの。藍(炭)の弧と砂の直線が
 *   (720, 300) 付近で交差するが、接続はしない。
 *
 * 色は第22条の4系統のみ。砂は「線」と「現在地の小見出し」だけに置く。
 * 文言は各ページの実物(h1 / og:title / products の PRODUCTS 配列)から採る。創作しない。
 *
 * 依存: playwright(chromium)と日本語ゴシック(IPAGothic 等)。
 *   本文フォントは Shippori Mincho / Noto Sans JP を第一候補に書いてあるが、
 *   生成環境に無ければ IPAGothic へ落ちる。落ちても崩れない字送りにしてある。
 *
 * 使い方: node scripts/make-ogp.mjs [--out <dir>] [--only <slug>]
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---- 版面(1200×630) ---------------------------------------------------- */
const SAND_D = 'M -20 645 L 40 622.1 L 100 600.2 L 160 577.9 L 220 554.4 L 280 529 L 340 501.6 L 400 472.2 L 460 441.2 L 520 409 L 580 376.1 L 640 343.2 L 700 310.7 L 760 279.2 L 820 248.9 L 880 219.8 L 940 191.9 L 1000 164.6 L 1060 136.9 L 1120 107.4 L 1180 74.3 L 1220 51.2';
const INK_D = 'M -20 484.2 L 40 425.2 L 100 377.4 L 160 338.2 L 220 306 L 280 280 L 340 259.9 L 400 246 L 460 238.9 L 490 238.2 L 520 239.4 L 580 248.2 L 640 265.9 L 700 292.7 L 760 328.4 L 820 372.2 L 880 422.3 L 940 476.2 L 1000 530 L 1060 578.7 L 1120 615.8 L 1150 630.6 L 1170 640';

/* ---- 5枚。すべて各ページの実文言 ---------------------------------------- */
const CARDS = [
  {
    slug: 'rehaboard',
    // 現在地。products/index.html のカタログに載っている道具
    eyebrow: 'PRODUCTS',
    // products/index.html PRODUCTS[].name
    title: 'RehaBoard',
    lang: 'en',
    // rehaboard/index.html の h1
    line: 'ブラウザで動く、リハ運営の道具',
  },
  {
    slug: 'starter-kits',
    // このページ自身が section。ハブ9枚と同じ「節の名前」の使い方
    eyebrow: 'STARTER KITS',
    // starter-kits/index.html の h1 強調部
    title: '小さな道具屋',
    // og:title の一行
    line: '買い切り・無料配布の道具',
  },
  {
    slug: 'nidodema',
    eyebrow: 'PRODUCTS',
    title: '二度手間さがし',
    line: '部署の手作業を、数えられる形に',
  },
  {
    slug: 'keiji',
    eyebrow: 'PRODUCTS',
    title: '掲示じたく',
    line: '院内の貼り紙を、毎回ゼロから書かない',
  },
  {
    slug: 'tanaoroshi',
    eyebrow: 'PRODUCTS',
    title: '経験の棚卸し',
    line: '面接の前に、思い出せなかった経験を、ひとつずつ',
  },
  {
    slug: 'madoakari',
    // products/index.html PRODUCTS[].cat 'work'(作品)の一枚
    eyebrow: 'WORK',
    // madoakari/index.html の h1
    title: '窓あかり',
    // og:title の一行
    line: '病院の一日を眺めるだけの作品',
  },
];

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function html(card) {
  // 大きな名前の墨面は y349–414 に収める。ハブ9枚がすべてこの高さで、
  // 家族の背丈はここで決まっている。字数ではなく墨の高さを合わせる
  const size = card.lang === 'en' ? 80 : 74;
  const top = card.lang === 'en' ? 341 : 343;
  const track = card.lang === 'en' ? '-0.01em' : '0.02em';
  // 欧文名も和文名と同じ顔で組む。ここだけ別のゴシックにすると家族が割れる
  const family = card.lang === 'en'
    ? "'Noto Sans JP','IPAPGothic','IPAGothic',sans-serif"
    : "'Noto Sans JP','IPAGothic','IPAPGothic',sans-serif";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px}
  body{background:#FBFAF7;position:relative;overflow:hidden;
       -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
  svg.bg{position:absolute;inset:0;width:1200px;height:630px}
  .mark{position:absolute;left:100px;top:203px;width:88px;height:40px}
  .word{position:absolute;left:207px;top:214px;
        font:400 21px/1 'Shippori Mincho B1','Liberation Serif','DejaVu Serif',serif;
        letter-spacing:.45em;color:#1B1B1E}
  .eye{position:absolute;left:101px;top:303px;
       font:400 15px/1 'Shippori Mincho B1','Liberation Serif','DejaVu Serif',serif;
       letter-spacing:.34em;color:#7D6845}
  .title{position:absolute;left:100px;top:${top}px;
         font-family:${family};font-weight:700;font-size:${size}px;line-height:1;
         letter-spacing:${track};color:#1B1B1E;white-space:nowrap}
  .line{position:absolute;left:101px;top:540px;
        font:400 28px/1 'Noto Sans JP','IPAGothic','IPAPGothic',sans-serif;
        letter-spacing:.04em;color:#45464C;white-space:nowrap}
</style></head><body>
<svg class="bg" viewBox="0 0 1200 630" fill="none">
  <path d="${INK_D}"  stroke="#1B1B1E" stroke-opacity=".175" stroke-width="1"/>
  <path d="${SAND_D}" stroke="#A98F63" stroke-opacity=".33" stroke-width="1"/>
</svg>
<svg class="mark" viewBox="0 0 240 110" fill="none">
  <path d="M8 74 C 62 16, 118 24, 176 84" stroke="#16233E" stroke-width="10" stroke-linecap="round"/>
  <path d="M58 94 C 118 60, 158 22, 232 12" stroke="#A98F63" stroke-width="10" stroke-linecap="round"/>
</svg>
<div class="word">BRIDGE</div>
<div class="eye">${esc(card.eyebrow)}</div>
<div class="title">${esc(card.title)}</div>
<div class="line">${esc(card.line)}</div>
</body></html>`;
}

const argv = process.argv.slice(2);
const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : path.join(ROOT, 'images/ogp');
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;

const launch = {};
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });

for (const card of CARDS) {
  if (only && card.slug !== only) continue;
  await page.setContent(html(card), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(outDir, `${card.slug}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 90, scale: 'css' });
  console.log('wrote', file);
}
await browser.close();
