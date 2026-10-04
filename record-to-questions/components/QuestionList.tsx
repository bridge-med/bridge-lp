"use client";

import { useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { IconPlus } from "./ui/icons";
import { questionTitle } from "@/lib/questions";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/question";

type Props = {
  questions: Question[];
  selectedId: string | null;
  flaggedIds: Set<string>;
  onSelect: (id: string) => void;
  onAdd: () => void;
};

/** スマートフォンでは横に流れる帯、広い画面では縦の一覧 */
export function QuestionList({ questions, selectedId, flaggedIds, onSelect, onAdd }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId]);

  return (
    <nav aria-label="問題一覧" className="flex flex-col gap-2">
      <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {questions.map((q, i) => {
          const selected = q.id === selectedId;
          return (
            <li key={q.id} className="shrink-0">
              <button
                ref={selected ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(q.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm transition-colors",
                  selected ? "bg-accent font-medium text-primary" : "hover:bg-muted",
                )}
              >
                <span className="whitespace-nowrap tabular-nums">{questionTitle(q, i)}</span>
                <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground lg:block">
                  {q.questionText}
                </span>
                {flaggedIds.has(q.id) && (
                  <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="要確認" />
                )}
              </button>
            </li>
          );
        })}
        <li className="shrink-0">
          <Button variant="ghost" size="sm" onClick={onAdd} className="w-full justify-start text-muted-foreground">
            <IconPlus />
            問題を追加
          </Button>
        </li>
      </ol>
    </nav>
  );
}
