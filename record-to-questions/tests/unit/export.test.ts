import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toMarkdown } from "@/lib/export/markdown";
import { toPlainText } from "@/lib/export/text";
import { toPdf } from "@/lib/export/pdf";
import type { Question } from "@/types/question";

const questions: Question[] = [
  {
    id: "a",
    questionNumber: 1,
    questionText: "医師法に定められている診療録の保存期間として、正しいものを1つ選べ。",
    choices: [
      { label: "1", text: "2年" },
      { label: "2", text: "5年" },
    ],
    answer: "2",
    rawText: "",
  },
  { id: "b", questionText: "番号のない問題", choices: [{ label: "ア", text: "選択肢" }], rawText: "" },
];

describe("export", () => {
  it("Markdown", () => {
    expect(toMarkdown("問題集", questions)).toBe(
      "# 問題集\n\n## 問1\n\n医師法に定められている診療録の保存期間として、正しいものを1つ選べ。\n\n1. 2年\n2. 5年\n\n**正解** 2\n\n## 問題2\n\n番号のない問題\n\nア 選択肢\n",
    );
  });

  it("TXT", () => {
    expect(toPlainText("問題集", questions)).toBe(
      "問題集\n\n問1\n医師法に定められている診療録の保存期間として、正しいものを1つ選べ。\n1. 2年\n2. 5年\n正解 2\n\n問題2\n番号のない問題\nア 選択肢\n",
    );
  });

  const font = path.join(__dirname, "../../public/fonts/BIZUDGothic-Regular.ttf");
  it.skipIf(!existsSync(font))("PDF(日本語フォントを埋め込み、ページをまたぐ)", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...questions[0], id: String(i), questionNumber: i + 1 }));
    const bytes = await toPdf("問題集", many, readFileSync(font).buffer as ArrayBuffer);
    const head = Buffer.from(bytes.slice(0, 5)).toString();
    expect(head).toBe("%PDF-");
    // サブセット化して小さく保つ(フォント全体は 4.6MB)
    expect(bytes.length).toBeLessThan(300_000);
  });
});
