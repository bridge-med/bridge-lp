#!/usr/bin/env node
/**
 * 起動に必要な素材を取得する(初回のみ。既にあれば何もしない)。
 * - PDF 用の日本語フォント BIZ UDゴシック(SIL Open Font License)→ public/fonts/
 * OCR の言語データ(jpn)は初回の解析時に tesseract.js が .cache/tessdata に取得する。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = [
  {
    file: "public/fonts/BIZUDGothic-Regular.ttf",
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/bizudgothic/BIZUDGothic-Regular.ttf",
  },
];

for (const { file, url } of assets) {
  const dest = path.join(root, file);
  if (existsSync(dest)) continue;
  process.stdout.write(`downloading ${file} ... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} の取得に失敗しました: ${res.status}`);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log("done");
}
