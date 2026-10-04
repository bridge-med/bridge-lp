import type { Question } from "@/types/question";

/** 画面・書き出しで使う問題の見出し。番号を読めなかった問題は並び順で示す */
export function questionTitle(q: Question, index: number): string {
  return q.questionNumber !== undefined ? `問${q.questionNumber}` : `問題${index + 1}`;
}

/** 選択肢の見出し。数字は「1.」、①やアはそのまま */
export function choiceMarker(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "・";
  return /^[0-9A-Za-z]+$/.test(trimmed) ? `${trimmed}.` : trimmed;
}

/** 次の選択肢の記号(直前が 3 なら 4、ウ なら エ) */
export function nextChoiceLabel(labels: string[]): string {
  const last = labels.at(-1);
  if (last === undefined) return "1";
  if (/^\d+$/.test(last)) return String(Number(last) + 1);
  for (const series of ["①②③④⑤⑥⑦⑧⑨⑩", "アイウエオカキクケコ", "abcdefghij", "ABCDEFGHIJ"]) {
    const i = series.indexOf(last);
    if (i >= 0 && i < series.length - 1) return series[i + 1];
  }
  return String(labels.length + 1);
}
