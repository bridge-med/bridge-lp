import { IconCheck } from "./ui/icons";
import { STAGES, STAGE_LABELS, type Stage } from "@/types/pipeline";
import { cn } from "@/lib/utils";

export type StageState = { status: "pending" | "active" | "done"; detail?: string };
export type ProgressState = Record<Stage, StageState> & { ocr: StageState & { current?: number; total?: number } };

export function initialProgress(): ProgressState {
  return Object.fromEntries(STAGES.map((s) => [s, { status: "pending" }])) as ProgressState;
}

export function ProcessingStatus({ progress }: { progress: ProgressState }) {
  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 font-semibold">動画解析中</h2>
      <ol className="flex flex-col gap-3" aria-live="polite">
        {STAGES.map((stage) => {
          const s = progress[stage];
          const count = stage === "ocr" && progress.ocr.total ? `${progress.ocr.current ?? 0} / ${progress.ocr.total}` : null;
          return (
            <li key={stage} className="flex items-center gap-3 text-[15px]">
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border",
                  s.status === "done" && "border-success text-success",
                  s.status === "active" && "border-primary",
                  s.status === "pending" && "border-border",
                )}
                aria-hidden
              >
                {s.status === "done" && <IconCheck width={14} height={14} />}
                {s.status === "active" && <span className="size-2 animate-pulse rounded-full bg-primary" />}
              </span>
              <span className={cn(s.status === "pending" && "text-muted-foreground", s.status === "active" && "font-medium")}>
                {STAGE_LABELS[stage]}
              </span>
              <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                {s.status === "active" ? count : s.status === "done" ? s.detail : null}
              </span>
              <span className="sr-only">{s.status === "done" ? "完了" : s.status === "active" ? "処理中" : "待機中"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
