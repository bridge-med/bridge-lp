#!/usr/bin/env node
/**
 * 1枚のページで完結する版を standalone/dist/ に組み立てる。
 *   index.html  画面と処理(JS は埋め込み)
 *   tesseract/  OCR エンジン(worker・本体・日本語データ)。ページと同じ場所から読む
 *   fonts/      PDF 用の日本語フォント
 * 使い方: npm run standalone   (先に npm run setup と、OCR データの取得が要る)
 */
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(here, "dist");

const LANG = path.join(root, ".cache/tessdata/jpn.traineddata");
if (!existsSync(LANG)) {
  console.log("downloading jpn.traineddata ...");
  const res = await fetch("https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz");
  if (!res.ok) throw new Error(`OCR データの取得に失敗しました: ${res.status}`);
  const { gunzipSync } = await import("node:zlib");
  mkdirSync(path.dirname(LANG), { recursive: true });
  writeFileSync(LANG, gunzipSync(Buffer.from(await res.arrayBuffer())));
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [path.join(here, "main.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["safari16", "chrome110"],
  minify: true,
  write: false,
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const page = readFileSync(path.join(here, "page.html"), "utf8");
const marker = "<script>/*BUNDLE*/</script>";
if (!page.includes(marker)) throw new Error("page.html に埋め込み位置がありません");
const html = page.replace(marker, () => `<script>${js}</script>`);
writeFileSync(path.join(dist, "index.html"), html);

// OCR の worker。言語データ(.traineddata)は公開先で配れない拡張子なので、gzip して .wasm の名前で置き、
// worker の fetch でその名前に読み替える(中身は tesseract が gzip を見て展開する)
const { gzipSync } = await import("node:zlib");
mkdirSync(path.join(dist, "tesseract/lang"), { recursive: true });
writeFileSync(path.join(dist, "tesseract/lang/jpn.traineddata.wasm"), gzipSync(readFileSync(LANG), { level: 9 }));
const shim =
  "(()=>{const f=self.fetch.bind(self);self.fetch=(u,o)=>{const s=String(u);return f(s.replace(/\\.traineddata(\\.gz)?$/,'.traineddata.wasm'),o)}})();\n";
writeFileSync(
  path.join(dist, "tesseract/worker.js"),
  shim + readFileSync(path.join(root, "node_modules/tesseract.js/dist/worker.min.js"), "utf8"),
);

const copies = [
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract/core/tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract/core/tesseract-core-lstm.wasm.js"],
  ["public/fonts/BIZUDGothic-Regular.ttf", "fonts/BIZUDGothic-Regular.ttf"],
];
for (const [from, to] of copies) {
  const dest = path.join(dist, to);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(path.join(root, from), dest);
}

// 手元確認用: viewer が付ける外枠を足したページ(公開には使わない)
writeFileSync(
  path.join(dist, "preview.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}img{max-width:100%}</style></head><body>${html}</body></html>`,
);
console.log(`standalone/dist: index.html ${(html.length / 1024).toFixed(0)}KB + ${copies.length} files`);
