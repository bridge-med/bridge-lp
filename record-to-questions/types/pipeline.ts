import type { ProcessResult } from "./project";

export const STAGES = ["upload", "extract", "dedupe", "ocr", "structure"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  upload: "動画読み込み",
  extract: "フレーム抽出",
  dedupe: "重複除去",
  ocr: "OCR解析",
  structure: "問題整理",
};

/** /api/process が NDJSON で1行ずつ返すイベント */
export type PipelineEvent =
  | { type: "stage"; stage: Stage; status: "active" | "done"; detail?: string }
  | { type: "progress"; stage: Stage; current: number; total: number }
  | { type: "result"; result: ProcessResult }
  | { type: "error"; message: string };
