import type { Question } from "@/types/question";
import type { ProcessWarning } from "@/types/project";
import { newId } from "../id";
import { comparable, similarity } from "../ocr/normalize";
import type { MergedLine } from "./mergeOCRText";
import { matchAnswer, matchChoice, matchExplanation, matchHeader, type ChoiceMatch } from "./patterns";

export type ParseResult = { questions: Question[]; warnings: ProcessWarning[] };

type Block = { number?: number; lines: MergedLine[]; headerRest: string };


/** 問題番号の行で区切る。番号が一度も出なければ全体を1問として扱う */
function splitBlocks(lines: MergedLine[]): Block[] {
  const blocks: Block[] = [];
  let current: Block = { lines: [], headerRest: "" };
  for (const line of lines) {
    const header = matchHeader(line.text);
    if (header) {
      if (current.lines.length > 0 || current.number !== undefined) blocks.push(current);
      current = { number: header.number, lines: [line], headerRest: header.rest };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0) blocks.push(current);

  // 最初の番号より前の行は、アプリの見出し等であることが多い。
  // ただし録画が問題の途中から始まった場合に備え、選択肢があるか3行以上なら残す
  if (blocks.length > 1 && blocks[0].number === undefined) {
    const pre = blocks[0];
    const looksLikeQuestion = pre.lines.length >= 3 || pre.lines.some((l) => matchChoice(l.text));
    if (!looksLikeQuestion) blocks.shift();
  }
  return blocks;
}

function isNextChoice(m: ChoiceMatch, prev: ChoiceMatch | undefined): boolean {
  if (!prev) return m.order === 1;
  return m.family === prev.family && m.order === prev.order + 1;
}

/**
 * OCR が短い選択肢の行(「2. a e」等)を丸ごと読み落とすことがあるので、
 * 選択肢の途中で番号が1つだけ飛んだ行も選択肢とみなす(飛んだ番号は警告で知らせる)
 */
function isChoiceAfterGap(m: ChoiceMatch, prev: ChoiceMatch | undefined): boolean {
  return !!prev && m.family === prev.family && m.order === prev.order + 2;
}

function joinText(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  // 英数字どうしの改行だけ空白でつなぎ、日本語はそのままつなぐ
  return /[A-Za-z0-9]$/.test(a) && /^[A-Za-z0-9]/.test(b) ? `${a} ${b}` : `${a}${b}`;
}

/** 問題文の中の「ア 〜」「① 〜」「・〜」のような列挙は、改行を残す */
function startsListItem(text: string): boolean {
  return (
    matchChoice(text) !== null ||
    /^[・●○■□◆◇※]/.test(text) ||
    /^[ア-オ](?=[\u4e00-\u9fff])/.test(text) ||
    /^[a-eA-Eａ-ｅ]\s/.test(text)
  );
}

function blockToQuestion(block: Block): Question {
  const body = block.number !== undefined ? block.lines.slice(1) : block.lines;
  let questionText = block.headerRest;
  const choices: { label: string; text: string; match: ChoiceMatch }[] = [];
  let answer: string | undefined;
  let explanation: string | undefined;
  let mode: "question" | "choices" | "explanation" = "question";

  for (const [lineIndex, { text }] of body.entries()) {
    const exp = matchExplanation(text);
    if (exp !== null) {
      mode = "explanation";
      explanation = joinText(explanation ?? "", exp);
      continue;
    }
    if (mode === "explanation") {
      explanation = explanation ? `${explanation}\n${text}` : text;
      continue;
    }
    const ans = matchAnswer(text);
    if (ans !== null && choices.length > 0) {
      answer = ans || answer;
      continue;
    }
    const choice = matchChoice(text);
    const last = choices.at(-1)?.match;
    // 「ア〜エ」の列挙のあとに「1.〜5.」が来たら、前の列挙は問題文の一部(組み合わせ問題)
    if (choice && last && choice.order === 1 && choice.family !== last.family) {
      const items = choices.splice(0).map((c) => `${c.label} ${c.text}`);
      questionText = [questionText, ...items].filter(Boolean).join("\n");
      answer = undefined;
    }
    const prev = choices.at(-1)?.match;
    // 番号が飛んでいても、すぐ次の行が飛ばした番号なら、この行は前の選択肢の折り返し
    const nextLine = body[lineIndex + 1] ? matchChoice(body[lineIndex + 1].text) : null;
    const gapFilledNext = !!prev && nextLine?.family === prev.family && nextLine.order === prev.order + 1;
    if (
      choice &&
      (isNextChoice(choice, prev) || (mode === "choices" && !gapFilledNext && isChoiceAfterGap(choice, prev)))
    ) {
      mode = "choices";
      choices.push({ label: choice.label, text: choice.text, match: choice });
      continue;
    }
    if (mode === "choices") {
      const last = choices[choices.length - 1];
      last.text = joinText(last.text, text);
    } else if (questionText && startsListItem(text)) {
      questionText = `${questionText}\n${text}`;
    } else {
      questionText = joinText(questionText, text);
    }
  }

  const frameIds = [...new Set(block.lines.flatMap((l) => l.frameIds))];
  return {
    id: newId(),
    questionNumber: block.number,
    questionText,
    choices: choices.map(({ label, text }) => ({ label, text })),
    answer,
    explanation,
    rawText: block.lines.map((l) => l.text).join("\n"),
    sourceFrameIds: frameIds,
  };
}

/** 同じ番号の問題が2回出たとき、中身がほぼ同じなら後のほうを捨てる(見直し・戻るスクロール) */
function dropRepeats(questions: Question[]): { kept: Question[]; repeated: Question[] } {
  const kept: Question[] = [];
  const repeated: Question[] = [];
  for (const q of questions) {
    const same = kept.find(
      (k) =>
        k.questionNumber !== undefined &&
        k.questionNumber === q.questionNumber &&
        similarity(comparable(k.rawText).slice(0, 200), comparable(q.rawText).slice(0, 200)) >= 0.6,
    );
    if (!same) {
      kept.push(q);
      continue;
    }
    // 長く読めているほうの本文を採る(スクロールで後から全体が見えた場合)
    if (q.rawText.length > same.rawText.length) {
      Object.assign(same, { ...q, id: same.id, sourceFrameIds: [...new Set([...(same.sourceFrameIds ?? []), ...(q.sourceFrameIds ?? [])])] });
    }
    repeated.push(q);
  }
  return { kept, repeated };
}

function collectWarnings(questions: Question[]): ProcessWarning[] {
  const warnings: ProcessWarning[] = [];
  if (questions.length === 0) {
    warnings.push({ code: "no-questions", message: "問題を見つけられませんでした。元の全文から手で追加してください" });
    return warnings;
  }
  const numbers = questions.map((q) => q.questionNumber).filter((n): n is number => n !== undefined);
  const seen = new Map<number, number>();
  for (const n of numbers) seen.set(n, (seen.get(n) ?? 0) + 1);
  for (const [n, count] of seen) {
    if (count > 1) warnings.push({ code: "duplicate-number", message: `問${n} が ${count} 回あります` });
  }
  if (numbers.length > 1) {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    const missing: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      for (let n = sorted[i - 1] + 1; n < sorted[i] && missing.length < 20; n++) missing.push(n);
    }
    if (missing.length > 0) {
      warnings.push({ code: "missing-number", message: `問${missing.join("・問")} が見つかりません` });
    }
  }
  for (const q of questions) {
    const name = q.questionNumber !== undefined ? `問${q.questionNumber}` : "番号のない問題";
    if (q.choices.length === 0) {
      warnings.push({ code: "no-choices", message: `${name} の選択肢を読み取れませんでした`, questionId: q.id });
      continue;
    }
    const orders = q.choices.map((c) => matchChoice(`${c.label}. x`)?.order ?? matchChoice(c.label)?.order);
    const gaps: string[] = [];
    for (let i = 1; i < orders.length; i++) {
      const a = orders[i - 1];
      const b = orders[i];
      if (a !== undefined && b === a + 2) gaps.push(String(a + 1));
    }
    if (gaps.length > 0) {
      warnings.push({ code: "missing-choice", message: `${name} の選択肢${gaps.join("・")}を読み取れていません`, questionId: q.id });
    }
  }
  return warnings;
}

/** 結合済みの行を問題単位に分ける(ルールベース) */
export function parseQuestions(lines: MergedLine[]): ParseResult {
  const blocks = splitBlocks(lines.filter((l) => l.text.trim() !== ""));
  const { kept } = dropRepeats(blocks.map(blockToQuestion));
  return { questions: kept, warnings: collectWarnings(kept) };
}
