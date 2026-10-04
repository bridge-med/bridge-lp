import { choiceMarker, questionTitle } from "../questions";
import type { Question } from "@/types/question";

export function toPlainText(title: string, questions: Question[]): string {
  const parts = [title];
  questions.forEach((q, i) => {
    const lines = [questionTitle(q, i), q.questionText.trim()];
    for (const c of q.choices) lines.push(`${choiceMarker(c.label)} ${c.text}`.trim());
    if (q.answer?.trim()) lines.push(`正解 ${q.answer.trim()}`);
    if (q.explanation?.trim()) lines.push(`解説 ${q.explanation.trim()}`);
    parts.push(lines.join("\n"));
  });
  return parts.join("\n\n") + "\n";
}
