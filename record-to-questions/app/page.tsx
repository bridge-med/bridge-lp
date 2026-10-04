"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { initialProgress, ProcessingStatus, type ProgressState } from "@/components/ProcessingStatus";
import { VideoUploader } from "@/components/VideoUploader";
import { Button } from "@/components/ui/button";
import { requestProcessing } from "@/lib/client/processVideo";
import { newId } from "@/lib/id";
import { getProjectRepository } from "@/lib/storage";
import type { PipelineEvent } from "@/types/pipeline";
import type { Project, ProjectSummary } from "@/types/project";

type Phase = { kind: "idle" } | { kind: "processing"; progress: ProgressState } | { kind: "error"; message: string };

function reduce(progress: ProgressState, event: PipelineEvent): ProgressState {
  if (event.type === "stage") {
    return { ...progress, [event.stage]: { ...progress[event.stage], status: event.status, detail: event.detail } };
  }
  if (event.type === "progress" && event.stage === "ocr") {
    return { ...progress, ocr: { ...progress.ocr, current: event.current, total: event.total } };
  }
  return progress;
}

function titleFrom(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || "問題集";
}

export default function Home() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    getProjectRepository()
      .list()
      .then(setRecent)
      .catch((e) => console.error("保存した問題集を読み込めませんでした", e));
    return () => abort.current?.abort();
  }, []);

  const start = async (file: File) => {
    abort.current = new AbortController();
    let progress = initialProgress();
    setPhase({ kind: "processing", progress });
    try {
      const result = await requestProcessing(
        file,
        (event) => {
          progress = reduce(progress, event);
          setPhase({ kind: "processing", progress });
        },
        abort.current.signal,
      );
      const now = new Date().toISOString();
      const project: Project = {
        id: newId("p"),
        title: titleFrom(file.name),
        sourceFileName: file.name,
        createdAt: now,
        updatedAt: now,
        frames: result.frames,
        mergedText: result.mergedText,
        questions: result.questions,
        warnings: result.warnings,
      };
      await getProjectRepository().save(project);
      router.push(`/projects/${project.id}`);
    } catch (e) {
      if (abort.current?.signal.aborted) {
        setPhase({ kind: "idle" });
        return;
      }
      console.error(e);
      setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-12 sm:py-20">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Record to Questions</h1>
        <p className="mt-2 text-muted-foreground">画面録画を、問題集に。</p>
      </header>

      {phase.kind === "idle" && <VideoUploader onStart={start} />}

      {phase.kind === "processing" && (
        <div className="flex flex-col gap-3">
          <ProcessingStatus progress={phase.progress} />
          <Button variant="ghost" size="sm" className="self-center" onClick={() => abort.current?.abort()}>
            中止する
          </Button>
        </div>
      )}

      {phase.kind === "error" && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
          <p className="font-medium">解析できませんでした</p>
          <p className="text-sm text-muted-foreground">{phase.message}</p>
          <Button className="self-start" onClick={() => setPhase({ kind: "idle" })}>
            やり直す
          </Button>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        動画は解析後にサーバーから削除します。結果はこのブラウザにだけ保存します。
      </p>

      {phase.kind === "idle" && recent.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">保存した問題集</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-muted">
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">{p.questionCount}問</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
