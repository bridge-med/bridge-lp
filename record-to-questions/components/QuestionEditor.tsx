"use client";

import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/field";
import { IconDown, IconPlus, IconTrash, IconUp } from "./ui/icons";
import { nextChoiceLabel, questionTitle } from "@/lib/questions";
import type { Choice, Question } from "@/types/question";

type Props = {
  question: Question;
  index: number;
  total: number;
  onChange: (q: Question) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
};

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">
      {children}
    </label>
  );
}

export function QuestionEditor({ question: q, index, total, onChange, onMove, onDelete }: Props) {
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const setChoice = (i: number, patch: Partial<Choice>) =>
    set({ choices: q.choices.map((c, ci) => (ci === i ? { ...c, ...patch } : c)) });
  const id = (name: string) => `${q.id}-${name}`;

  return (
    <article className="flex flex-col gap-6" aria-label={questionTitle(q, index)}>
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{questionTitle(q, index)}</h2>
        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="前へ移動">
            <IconUp />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="後ろへ移動">
            <IconDown />
          </Button>
          <Button variant="destructive" size="icon" onClick={onDelete} aria-label="この問題を削除">
            <IconTrash />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={id("number")}>問題番号</Label>
        <div className="w-24">
          <Input
          id={id("number")}
          inputMode="numeric"
          value={q.questionNumber ?? ""}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value.normalize("NFKC"), 10);
            set({ questionNumber: Number.isFinite(n) ? n : undefined });
          }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={id("text")}>問題文</Label>
        <Textarea id={id("text")} value={q.questionText} onChange={(e) => set({ questionText: e.target.value })} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-muted-foreground">選択肢</legend>
        {q.choices.map((c, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-14 shrink-0">
              <Input
                aria-label={`選択肢${i + 1}の記号`}
                className="px-1 text-center"
                value={c.label}
                onChange={(e) => setChoice(i, { label: e.target.value })}
              />
            </div>
            <Textarea
              aria-label={`選択肢${i + 1}`}
              value={c.text}
              onChange={(e) => setChoice(i, { text: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`選択肢${i + 1}を削除`}
              onClick={() => set({ choices: q.choices.filter((_, ci) => ci !== i) })}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => set({ choices: [...q.choices, { label: nextChoiceLabel(q.choices.map((c) => c.label)), text: "" }] })}
        >
          <IconPlus />
          選択肢を追加
        </Button>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-[8rem_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("answer")}>正解</Label>
          <Input id={id("answer")} value={q.answer ?? ""} onChange={(e) => set({ answer: e.target.value || undefined })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("explanation")}>解説</Label>
          <Textarea
            id={id("explanation")}
            value={q.explanation ?? ""}
            onChange={(e) => set({ explanation: e.target.value || undefined })}
          />
        </div>
      </div>

      <details className="rounded-lg border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-muted-foreground">
          読み取った原文
        </summary>
        <pre className="overflow-x-auto whitespace-pre-wrap border-t border-border px-3 py-2 font-sans text-sm leading-relaxed">
          {q.rawText || "(なし)"}
        </pre>
      </details>
    </article>
  );
}
