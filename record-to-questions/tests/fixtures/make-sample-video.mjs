#!/usr/bin/env node
/**
 * 検証用の「問題演習アプリの画面録画」を合成する。
 * 架空の問題演習画面(固定ヘッダー・フッター付き)を Chromium で表示し、
 * 問題の表示 → 数秒止まる → 長い問題はスクロール → 次の問題へ、を1コマずつ撮って mp4 にする。
 *
 * 使い方: node tests/fixtures/make-sample-video.mjs [出力先.mp4]
 * 必要: ffmpeg、Chromium(PLAYWRIGHT_BROWSERS_PATH か CHROMIUM_PATH)
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, "out", "sample-recording.mp4"));
const { questions } = JSON.parse(readFileSync(path.join(here, "sample-questions.json"), "utf8"));
const FPS = 10;

const executablePath =
  process.env.CHROMIUM_PATH ??
  ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/opt/pw-browsers/chromium"].find((p) => existsSync(p));

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;font-family:"Noto Sans CJK JP","WenQuanYi Zen Hei",sans-serif;background:#f4f5f7;color:#1d1d1f}
  header{position:fixed;top:0;left:0;right:0;height:64px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:flex-end;justify-content:space-between;padding:0 16px 8px;font-size:15px;z-index:2}
  header .clock{position:absolute;top:6px;left:20px;font-size:13px;font-weight:600}
  footer{position:fixed;bottom:0;left:0;right:0;height:60px;background:#fff;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:center;padding:0 20px;font-size:16px;color:#0a64d6;z-index:2}
  main{padding:84px 18px 90px}
  .no{font-size:20px;font-weight:700;margin-bottom:10px}
  .text{font-size:18px;line-height:1.8;white-space:pre-wrap}
  .pad{height:var(--pad,0px)}
  ol{list-style:none;padding:0;margin:18px 0 0}
  li{background:#fff;border:1px solid #d9dbe0;border-radius:10px;padding:14px 14px;margin-bottom:12px;font-size:17px;line-height:1.6}
</style></head><body>
<header><span class="clock">9:41</span><span>診療情報管理 問題演習</span><span>10問</span></header>
<main id="m"></main>
<footer><span>&lt; 前へ</span><span>次へ &gt;</span></footer>
<script>
  window.show = (q, pad) => {
    document.getElementById('m').innerHTML =
      '<div class="no">問' + q.n + '</div><div class="text">' + q.text + '</div>' +
      '<div class="pad" style="--pad:' + pad + 'px"></div>' +
      '<ol>' + q.choices.map((c, i) => '<li>' + (i + 1) + '. ' + c + '</li>').join('') + '</ol>';
    window.scrollTo(0, 0);
  };
</script></body></html>`;

const work = mkdtempSync(path.join(os.tmpdir(), "rtq-fixture-"));
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  let n = 0;
  const shot = async (count = 1) => {
    const file = path.join(work, `s_${String(n).padStart(5, "0")}.png`);
    await page.screenshot({ path: file });
    for (let i = 1; i < count; i++) {
      execFileSync("cp", [file, path.join(work, `s_${String(n + i).padStart(5, "0")}.png`)]);
    }
    n += count;
  };
  for (const q of questions) {
    // 問3と問7は画面に収まらない長さにして、スクロールを含める
    const pad = q.n === 3 ? 520 : q.n === 7 ? 380 : 0;
    await page.evaluate(([q, pad]) => window.show(q, pad), [q, pad]);
    await shot(FPS * 2); // 2秒読む
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    if (max > 0) {
      for (let y = 0; y < max; y += 18) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await shot();
      }
      await page.evaluate((y) => window.scrollTo(0, y), max);
      await shot(FPS * 2);
    }
    // 問5のあとで一度問4に戻り、また進む(見直しの重複)
    if (q.n === 5) {
      await page.evaluate(([q]) => window.show(q, 0), [questions[3]]);
      await shot(FPS);
      await page.evaluate(([q]) => window.show(q, 0), [q]);
      await shot(FPS);
    }
  }
  execFileSync("mkdir", ["-p", path.dirname(out)]);
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(work, "s_%05d.png"),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", out,
  ]);
  console.log(`${out} (${n} コマ / ${(n / FPS).toFixed(1)} 秒)`);
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
