import { describe, expect, it } from "vitest";
import { parseQuestions } from "@/lib/parser/questionParser";
import { matchChoice, matchHeader } from "@/lib/parser/patterns";

const lines = (text: string) => text.trim().split("\n").map((t) => ({ text: t, frameIds: ["f1"] }));

describe("matchHeader", () => {
  it.each([
    ["問12", 12],
    ["問 3 次のうち", 3],
    ["第5問", 5],
    ["問題7", 7],
    ["Q1", 1],
    ["Q.10", 10],
    ["【問４】", 4],
    ["問十二", 12],
    ["間8", 8], // 「問」の読み誤り
  ])("%s → %d", (line, n) => {
    expect(matchHeader(line)?.number).toBe(n);
  });

  it.each(["第3条に定める", "問題文を読んで", "問診票", "間違っているものを選べ", "2025年"])("%s は番号ではない", (line) => {
    expect(matchHeader(line)).toBeNull();
  });
});

describe("matchChoice", () => {
  it.each([
    ["1. 2年", "1", 1],
    ["２．３年", "2", 2],
    ["3) 5年", "3", 3],
    ["(4) 10年", "4", 4],
    ["① 永年", "①", 1],
    ["イ 新入院患者数", "イ", 2],
    ["ウ．退院患者数", "ウ", 3],
  ])("%s", (line, label, order) => {
    expect(matchChoice(line)).toMatchObject({ label, order });
  });
});

describe("parseQuestions", () => {
  it("問XX + 1.〜5. を問題と選択肢に分け、折り返しをつなぐ", () => {
    const { questions, warnings } = parseQuestions(
      lines(`
問1
診療録の保存期間として、正しいものを
1つ選べ。
1. 2年
2. 3年
3. 5年
4. 開示の可否は担当医師の個人的な判断
のみで決める
5. 永年
問2
次のうち正しいものを1つ選べ。
1. A
2. B
`),
    );
    expect(warnings).toEqual([]);
    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      questionNumber: 1,
      questionText: "診療録の保存期間として、正しいものを1つ選べ。",
    });
    expect(questions[0].choices.map((c) => c.text)).toEqual([
      "2年",
      "3年",
      "5年",
      "開示の可否は担当医師の個人的な判断のみで決める",
      "永年",
    ]);
    expect(questions[0].rawText).toContain("問1\n診療録の保存期間として");
    expect(questions[1].choices).toHaveLength(2);
  });

  it("問題文中のア〜エの列挙は問題文に残し、後の 1.〜 を選択肢にする", () => {
    const { questions } = parseQuestions(
      lines(`
問7
正しい組み合わせを1つ選べ。
ア 在院患者延日数
イ 新入院患者数
1.アとイ
2.イとウ
`),
    );
    expect(questions[0].questionText).toBe("正しい組み合わせを1つ選べ。\nア 在院患者延日数\nイ 新入院患者数");
    expect(questions[0].choices.map((c) => c.label)).toEqual(["1", "2"]);
  });

  it("正解・解説を拾い、作らない", () => {
    const { questions } = parseQuestions(
      lines(`
問1
正しいものを選べ。
1. A
2. B
正解 2
解説
Bが正しい。
理由は〜。
問2
正しいものを選べ。
1. C
2. D
`),
    );
    expect(questions[0].answer).toBe("2");
    expect(questions[0].explanation).toBe("Bが正しい。\n理由は〜。");
    expect(questions[1].answer).toBeUndefined();
    expect(questions[1].explanation).toBeUndefined();
  });

  it("番号の順に並ばない選択肢記号は本文の続きとして扱う", () => {
    const { questions } = parseQuestions(lines("問1\n本文\n1. 平成\n3. 年に改正された\n2. 令和"));
    expect(questions[0].choices.map((c) => c.text)).toEqual(["平成3. 年に改正された", "令和"]);
  });

  it("OCR が読み落とした選択肢は飛ばして続け、警告を出す", () => {
    const { questions, warnings } = parseQuestions(lines("問16\n誤っているものを選べ。\n1.ab\n3.bc\n4.cd\n5.de"));
    expect(questions[0].choices.map((c) => c.label)).toEqual(["1", "3", "4", "5"]);
    expect(warnings.map((w) => w.message)).toEqual(["問16 の選択肢2を読み取れていません"]);
  });

  it("同じ番号の見直しは1問にまとめ、欠けた番号を知らせる", () => {
    const { questions, warnings } = parseQuestions(
      lines("問1\n正しいものを選べ。\n1. A\n問3\n正しいものを選べ。\n1. C\n問1\n正しいものを選べ。\n1. A"),
    );
    expect(questions.map((q) => q.questionNumber)).toEqual([1, 3]);
    expect(warnings.map((w) => w.code)).toEqual(["missing-number"]);
    expect(warnings[0].message).toContain("問2");
  });

  it("番号がなければ全体を1問にする", () => {
    const { questions } = parseQuestions(lines("次のうち正しいものを選べ。\n1. A\n2. B"));
    expect(questions).toHaveLength(1);
    expect(questions[0].questionNumber).toBeUndefined();
    expect(questions[0].choices).toHaveLength(2);
  });
});
