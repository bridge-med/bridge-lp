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
const isFixture = !process.env.RTQ_VIDEO;

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
      if (!isFixture) return;

      const { questions: expected } = JSON.parse(
        await readFile(path.join(__dirname, "../fixtures/sample-questions.json"), "utf8"),
      ) as { questions: { n: number; text: string; choices: string[] }[] };
      expect(result.questions.map((q) => q.questionNumber)).toEqual(expected.map((q) => q.n));
      for (const [i, q] of result.questions.entries()) {
        const want = expected[i];
        expect(q.choices.length, `問${want.n} の選択肢数`).toBe(want.choices.length);
        const textScore = similarity(comparable(q.questionText), comparable(want.text.replace(/\n/g, "")));
        expect(textScore, `問${want.n} の問題文`).toBeGreaterThan(0.85);
        expect(q.rawText.length).toBeGreaterThan(0);
      }
    } finally {
      await ocr.dispose();
      await rm(workDir, { recursive: true, force: true });
    }
  });
});
