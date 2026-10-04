"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ExportMenu } from "@/components/ExportMenu";
import { QuestionEditor } from "@/components/QuestionEditor";
import { QuestionList } from "@/components/QuestionList";
import { SourcePreview } from "@/components/SourcePreview";
import { IconBack } from "@/components/ui/icons";
import { useProject, type SaveState } from "@/lib/client/useProject";
import { newId } from "@/lib/id";
import { questionTitle } from "@/lib/questions";
import type { Question } from "@/types/question";

const SAVE_LABEL: Record<SaveState, string> = { saved: "保存済み", saving: "保存中", error: "保存できませんでした" };

function emptyQuestion(after?: Question): Question {
  return {
    id: newId(),
    questionNumber: after?.questionNumber !== undefined ? after.questionNumber + 1 : undefined,
    questionText: "",
    choices: [1, 2, 3, 4, 5].map((n) => ({ label: String(n), text: "" })),
    rawText: "",
    sourceFrameIds: [],
  };
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project, loadError, saveState, update } = useProject(id);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const questions = useMemo(() => project?.questions ?? [], [project]);
  const index = Math.max(0, questions.findIndex((q) => q.id === selectedId));
  const current = questions[index] ?? null;

  const flaggedIds = useMemo(
    () => new Set((project?.warnings ?? []).map((w) => w.questionId).filter((x): x is string => !!x)),
    [project],
  );
  const currentFrames = useMemo(() => {
    if (!project || !current) return [];
    const ids = new Set(current.sourceFrameIds ?? []);
    return project.frames.filter((f) => ids.has(f.id));
  }, [project, current]);

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <p>{loadError}</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-primary underline">
          トップへ戻る
        </Link>
      </main>
    );
  }
  if (!project) return <main className="px-4 py-20 text-center text-muted-foreground">読み込み中</main>;

  const setQuestions = (fn: (qs: Question[]) => Question[]) => update((p) => ({ ...p, questions: fn(p.questions) }));

  const addQuestion = () => {
    const q = emptyQuestion(current ?? undefined);
    setQuestions((qs) => {
      const at = current ? qs.findIndex((x) => x.id === current.id) + 1 : qs.length;
      return [...qs.slice(0, at), q, ...qs.slice(at)];
    });
    setSelectedId(q.id);
  };

  const move = (direction: -1 | 1) => {
    if (!current) return;
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === current.id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = () => {
    if (!current) return;
    if (!window.confirm(`${questionTitle(current, index)} を削除しますか`)) return;
    const neighbor = questions[index + 1] ?? questions[index - 1] ?? null;
    setQuestions((qs) => qs.filter((q) => q.id !== current.id));
    setSelectedId(neighbor?.id ?? null);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <Link
            href="/"
            className="-ml-2 flex size-11 items-center justify-center rounded-lg hover:bg-muted"
            aria-label="トップへ戻る"
          >
            <IconBack />
          </Link>
          <input
            aria-label="問題集の名前"
            value={project.title}
            onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
            className="min-h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base font-semibold hover:bg-muted focus:bg-surface focus:outline-none"
          />
          <span
            className={saveState === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
            aria-live="polite"
          >
            {SAVE_LABEL[saveState]}
          </span>
          <div className="flex w-full justify-end sm:w-auto">
            <ExportMenu title={project.title} questions={questions} />
          </div>
        </div>
      </header>

      {project.warnings.length > 0 && (
        <details className="mx-auto mt-3 max-w-7xl px-4">
          <summary className="flex min-h-11 cursor-pointer items-center rounded-lg bg-warning-bg px-3 text-sm text-warning">
            確認したほうがよい点が {project.warnings.length} 件あります
          </summary>
          <ul className="mt-2 list-disc pl-8 text-sm text-muted-foreground">
            {project.warnings.map((w, i) => (
              <li key={i}>
                {w.questionId ? (
                  <button type="button" className="cursor-pointer underline" onClick={() => setSelectedId(w.questionId!)}>
                    {w.message}
                  </button>
                ) : (
                  w.message
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[13rem_minmax(0,1fr)_minmax(0,22rem)] lg:gap-8">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
          <QuestionList
            questions={questions}
            selectedId={current?.id ?? null}
            flaggedIds={flaggedIds}
            onSelect={setSelectedId}
            onAdd={addQuestion}
          />
        </aside>

        <main className="min-w-0">
          {current ? (
            <QuestionEditor
              key={current.id}
              question={current}
              index={index}
              total={questions.length}
              onChange={(q) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? q : x)))}
              onMove={move}
              onDelete={remove}
            />
          ) : (
            <p className="py-10 text-muted-foreground">問題がありません。「問題を追加」から作れます</p>
          )}
        </main>

        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <SourcePreview frames={currentFrames} allFrames={project.frames} mergedText={project.mergedText} />
        </aside>
      </div>
    </div>
  );
}
