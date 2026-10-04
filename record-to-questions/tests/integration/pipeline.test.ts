/**
 * 合成した画面録画を、API と同じ処理に通す(OCR を動かすので数十秒かかる)。
 *   node tests/fixtures/make-sample-video.mjs && npm run test:e2e
 * RTQ_VIDEO=/path/to/your.mp4 を渡すと、手元の録画で結果を確かめられる(判定はせず、結果を
 * tests/fixtures/out/report.md に書き出す)。
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createOCRProvider } from "@/lib/ocr";
import { processVideo } from "@/lib/pipeline/processVideo";
import { RuleBasedStructurer } from "@/lib/structurer/RuleBasedStructurer";
import { comparable, similarity } from "@/lib/ocr/normalize";

const fixture = path.join(__dirname, "../fixtures/out/sample-recording.mp4");
const video = process.env.RTQ_VIDEO ?? fixture;
// 正解の問題 JSON。RTQ_VIDEO だけを渡したときは判定せず、結果を書き出すだけ
const expectedFile = process.env.RTQ_EXPECTED ?? (process.env.RTQ_VIDEO ? null : path.join(__dirname, "../fixtures/sample-questions.json"));

describe.skipIf(!existsSync(video))("画面録画 → 問題", () => {
  it("問題を欠落・重複・順序崩れなく取り出す", async () => {
    const workDir = await mkdtemp(path.join(os.tmpdir(), "rtq-test-"));
    const ocr = createOCRProvider();
    try {
      const result = await processVideo(video, workDir, {
        ocr,
        structurer: new RuleBasedStructurer(),
        emit: () => {},
      });
      const report = [`stats: ${JSON.stringify(result.stats)}`, ...result.warnings.map((w) => `warning: ${w.message}`)];
      for (const q of result.questions) {
        report.push("", `## 問${q.questionNumber ?? "?"} (frames: ${q.sourceFrameIds?.length ?? 0})`, q.questionText);
        for (const c of q.choices) report.push(`  ${c.label}. ${c.text}`);
      }
      report.push("", "# 結合した全文", result.mergedText);
      const out = path.join(__dirname, "../fixtures/out");
      mkdirSync(out, { recursive: true });
      writeFileSync(path.join(out, "report.md"), report.join("\n"));
      if (!expectedFile) return;

      const { questions: expected } = JSON.parse(await readFile(expectedFile, "utf8")) as { questions: { n: number; text: string; choices: string[] }[] };
      expect(result.questions.map((q) => q.questionNumber)).toEqual(expected.map((q) => q.n));
      // 多少の OCR ミスは許容する(仕様)。番号の欠落・重複・順序崩れは許さない。
      // 選択肢の数と問題文は、同梱の10問は全問、それ以外(長い録画)は9割以上で合っていること
      const strict = expectedFile.endsWith("sample-questions.json");
      let choicesOk = 0;
      let textOk = 0;
      for (const [i, q] of result.questions.entries()) {
        const want = expected[i];
        if (q.choices.length === want.choices.length) choicesOk++;
        if (similarity(comparable(q.questionText), comparable(want.text.replace(/\n/g, ""))) > 0.85) textOk++;
        expect(q.rawText.length).toBeGreaterThan(0);
      }
      const need = strict ? expected.length : Math.ceil(expected.length * 0.9);
      expect(choicesOk, "選択肢の数が合った問題数").toBeGreaterThanOrEqual(need);
      expect(textOk, "問題文が合った問題数").toBeGreaterThanOrEqual(need);
    } finally {
      await ocr.dispose();
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
