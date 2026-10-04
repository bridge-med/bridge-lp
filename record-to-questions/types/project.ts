import type { OCRResult } from "./ocr";
import type { Question } from "./question";

export type SourceFrame = {
  id: string;
  /** 動画の先頭からの秒数 */
  timestamp: number;
  /** 縮小したプレビュー画像(data URL)。ブラウザ内にのみ保存する */
  image: string;
  ocr: OCRResult;
};

export type ProcessWarning = {
  code: "missing-number" | "duplicate-number" | "no-choices" | "no-questions";
  message: string;
  questionId?: string;
};

/** サーバーの解析結果。ここから Project を作る */
export type ProcessResult = {
  frames: SourceFrame[];
  /** フレーム間で結合した、構造化前の全文 */
  mergedText: string;
  questions: Question[];
  warnings: ProcessWarning[];
  stats: {
    durationSec: number;
    sampledFrames: number;
    keptFrames: number;
  };
};

export type Project = {
  id: string;
  title: string;
  sourceFileName: string;
  createdAt: string;
  updatedAt: string;
  frames: SourceFrame[];
  mergedText: string;
  questions: Question[];
  warnings: ProcessWarning[];
};

export type ProjectSummary = Pick<Project, "id" | "title" | "createdAt" | "updatedAt"> & {
  questionCount: number;
};
