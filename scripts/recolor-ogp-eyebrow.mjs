/**
 * recolor-ogp-eyebrow.mjs — 思想ハブ9枚(2026-07-13生成)の砂色の小見出しを
 * --dawn #A98F63 から --dawn-deep #7D6845 へ差し替える。**一度限りの移行**。
 *
 * 背景: #A98F63 は白面3.09:1でAA未達。shared/bridge.css のトークン注記自身が
 *   「小さい文字は --dawn-deep」と定めている。実際、9枚をタイムライン相当まで
 *   縮小すると PHILOSOPHY / PRODUCTS などの小見出しはほぼ消える。
 *   2026-08-09にプロダクト5枚のOGPを #7D6845 で焼いたため、9枚も揃える
 *   (社長裁可 2026-08-09)。
 *
 * なぜ焼き直しではなく画素の再着色か:
 *   9枚の生成元は残っておらず、再生成すると書体まで変わる(生成環境に
 *   Shippori Mincho / Noto Sans JP が無い)。目的は色だけなので、書体を保つ
 *   再着色を選んだ。触るのは小見出しの帯(y288–332)の中の「砂の画素」だけ。
 *
 * 判定: 生成り比で暖色(warm>=6)、かつ 生成り→砂 の直線上に乗っている
 *   (残差<=20)画素のみを対象にする。交差線の弧は中性色なので暖色判定で
 *   外れる(小見出しが x205 に届かない4枚で被り0件を実測して確認済み)。
 *   ロゴの砂線(y205–240)と交差線の砂(この x では y>500)は帯の外。
 *
 * 被覆率 alpha を最小二乗で解き、生成り→#7D6845 で組み直す。
 * アンチエイリアスの中間色は alpha に比例してそのまま濃くなる。
 *
 * !! 再実行しないこと。二重適用でさらに暗くなる。
 *    (適用済みかは自動判定して中止する)
 *
 * 使い方: node scripts/recolor-ogp-eyebrow.mjs [--out <dir>] [--dry]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'images/ogp');
const FILES = ['about', 'community', 'journal', 'philosophy',
  'products', 'projects', 'research', 'services', 'stories'];

const argv = process.argv.slice(2);
const outDir = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : SRC;
const dry = argv.includes('--dry');

const launch = {};
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1300, height: 700 } });

let aborted = 0;
for (const name of FILES) {
  const b64 = fs.readFileSync(path.join(SRC, `${name}.jpg`)).toString('base64');
  await page.setContent(`<img id="i" src="data:image/jpeg;base64,${b64}">`);
  await page.waitForFunction(() => document.getElementById('i').complete);

  const res = await page.evaluate(() => {
    const BG = [251, 250, 246];   // 生成り
    const S  = [169, 143, 99];    // --dawn
    const D  = [125, 104, 69];    // --dawn-deep
    const BOX = { x0: 70, x1: 520, y0: 288, y1: 332 };  // 小見出しの帯だけ

    const img = document.getElementById('i');
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, 1200, 630);
    const d = id.data;

    const fitAlpha = (p, target) => {
      let num = 0, den = 0;
      for (let k = 0; k < 3; k++) { const dv = BG[k] - target[k]; num += dv * (BG[k] - p[k]); den += dv * dv; }
      return num / den;
    };
    const resid = (p, target, a) => {
      let m = 0;
      for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(p[k] - (BG[k] + (target[k] - BG[k]) * a)));
      return m;
    };

    // 適用済みなら中止 — 濃い砂によく当てはまる画素が多数あれば移行後
    let fitS = 0, fitD = 0;
    for (let x = BOX.x0; x < BOX.x1; x++) for (let y = BOX.y0; y < BOX.y1; y++) {
      const i = (y * 1200 + x) * 4; const p = [d[i], d[i + 1], d[i + 2]];
      if ((p[0] - p[2]) - (BG[0] - BG[2]) < 6) continue;
      const aS = fitAlpha(p, S), aD = fitAlpha(p, D);
      if (aS > 0.55 && resid(p, S, Math.min(1, aS)) <= 20) fitS++;
      if (aD > 0.55 && resid(p, D, Math.min(1, aD)) <= 20) fitD++;
    }
    // 移行後は濃い砂にほぼ全画素が当てはまり、薄い砂には当てはまらなくなる。
    // 元画像でも濃い側に当たる画素はあるので、決定的な差(1.5倍)を要求する
    if (fitD > fitS * 1.5 + 20) return { already: true, fitS, fitD };

    let hit = 0, skipped = 0;
    for (let x = BOX.x0; x < BOX.x1; x++) for (let y = BOX.y0; y < BOX.y1; y++) {
      const i = (y * 1200 + x) * 4;
      const p = [d[i], d[i + 1], d[i + 2]];
      if ((p[0] - p[2]) - (BG[0] - BG[2]) < 6) continue;   // 中性色(交差線の弧)は触らない
      let a = fitAlpha(p, S);
      if (a < 0.05) continue;
      if (resid(p, S, Math.min(1, a)) > 20) { skipped++; continue; }  // 砂の直線から外れる画素
      a = Math.min(1, a);
      for (let k = 0; k < 3; k++) d[i + k] = Math.round(BG[k] + (D[k] - BG[k]) * a);
      hit++;
    }
    ctx.putImageData(id, 0, 0);
    return { already: false, hit, skipped, url: c.toDataURL('image/jpeg', 0.9) };
  });

  if (res.already) {
    console.log(`${name}: 適用済みと判定。中止(fitS=${res.fitS} fitD=${res.fitD})`);
    aborted++;
    continue;
  }
  const buf = Buffer.from(res.url.split(',')[1], 'base64');
  if (!dry) fs.writeFileSync(path.join(outDir, `${name}.jpg`), buf);
  console.log(`${name}: 再着色 ${res.hit}px / 除外 ${res.skipped}px → ${buf.length}B${dry ? ' (dry)' : ''}`);
}
await browser.close();
if (aborted) process.exitCode = 1;
