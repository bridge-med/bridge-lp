/**
 * ブラウザだけで動く解析(サーバー不要)。
 * ffmpeg の代わりに <video> と canvas でフレームを取り出し、OCR も端末の中で動かす。
 * フレーム選択・行の結合・問題への分割は、サーバー版と同じ lib の関数を使う。
 */
import { createWorker, type Line, type Worker } from "tesseract.js";
import { FRAME_SELECTION, OCR } from "@/lib/config";
import { newId } from "@/lib/id";
import { cropToContent, detectFixedBands, selectKeyFrames } from "@/lib/image/deduplicateFrames";
import { mergeOCRText } from "@/lib/parser/mergeOCRText";
import { parseQuestions } from "@/lib/parser/questionParser";
import type { OCRLine, OCRResult } from "@/types/ocr";
import type { ProcessResult, SourceFrame } from "@/types/project";

export type Progress =
  | { stage: "load" | "extract" | "dedupe" | "ocr-init" | "structure"; current?: number; total?: number }
  | { stage: "ocr"; current: number; total: number };

/** OCR 用に縮める最大幅(px)。iPhone の録画は 1179px 等。これで十分読める */
const OCR_MAX_WIDTH = 1200;

const asset = (path: string) => new URL(path, document.baseURI).href;

function loadVideo(file: File): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // 画面外に置く(DOM に無いと、フレームを描けないブラウザがある)
  Object.assign(video.style, { position: "fixed", left: "-10000px", top: "0", width: "2px", height: "2px" });
  document.body.appendChild(video);
  video.src = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve(video);
    video.onerror = () =>
      reject(new Error("この動画を読み込めませんでした。iPhone の画面収録(MP4 / MOV)を選んでください"));
    // iOS は再生を一度始めないとフレームを読み込まないことがある
    video.play().then(() => video.pause(), () => {});
  });
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("このブラウザでは画像を処理できません");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function toLine(line: Line): OCRLine {
  return { text: line.text.replace(/\n$/, ""), confidence: line.confidence, bbox: line.bbox };
}

let workerPromise: Promise<Worker> | null = null;

/** OCR エンジンを用意する(初回だけ言語データ約3MBを読み込み、以降は端末に保存したものを使う) */
function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const worker = await createWorker(OCR.lang, 1, {
      workerPath: asset("tesseract/worker.js"),
      corePath: asset("tesseract/core"),
      langPath: asset("tesseract/lang"),
      workerBlobURL: false,
    });
    await worker.setParameters({ preserve_interword_spaces: "1" });
    return worker;
  })().catch((e) => {
    workerPromise = null;
    throw e;
  });
  return workerPromise;
}

export async function processInBrowser(
  file: File,
  onProgress: (p: Progress) => void,
  signal: AbortSignal,
): Promise<ProcessResult> {
  onProgress({ stage: "load" });
  const video = await loadVideo(file);
  try {
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("動画の長さを読み取れませんでした");
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // 1. 比較用の小さなグレースケール画像を一定間隔で取る
    const fps = FRAME_SELECTION.sampleFps;
    const tw = FRAME_SELECTION.thumbWidth;
    const th = Math.max(2, Math.round((tw * vh) / vw / 2) * 2);
    const thumb = canvas(tw, th);
    const count = Math.max(1, Math.floor(duration * fps));
    const thumbs: Uint8Array[] = [];
    for (let i = 0; i < count; i++) {
      signal.throwIfAborted();
      await seek(video, Math.min(i / fps, duration - 0.05));
      thumb.ctx.drawImage(video, 0, 0, tw, th);
      const { data } = thumb.ctx.getImageData(0, 0, tw, th);
      const gray = new Uint8Array(tw * th);
      for (let p = 0; p < gray.length; p++) {
        gray[p] = (data[p * 4] * 299 + data[p * 4 + 1] * 587 + data[p * 4 + 2] * 114) / 1000;
      }
      thumbs.push(gray);
      onProgress({ stage: "extract", current: i + 1, total: count });
    }

    // 2. 固定ヘッダー/フッターを除いて、読むべきフレームを選ぶ
    onProgress({ stage: "dedupe" });
    const bands = detectFixedBands(thumbs, tw, th);
    const content = cropToContent(thumbs, tw, th, bands);
    const indices = selectKeyFrames(content.frames, tw, content.height).map((k) => k.index);

    // 3. OCR
    onProgress({ stage: "ocr-init" });
    const worker = await getWorker();
    const scale = Math.min(1, OCR_MAX_WIDTH / vw);
    const full = canvas(Math.round(vw * scale), Math.round(vh * scale));
    const pw = Math.min(OCR.previewWidth, full.c.width);
    const preview = canvas(pw, Math.round((full.c.height * pw) / full.c.width));
    const frames: SourceFrame[] = [];
    for (const [n, index] of indices.entries()) {
      signal.throwIfAborted();
      onProgress({ stage: "ocr", current: n, total: indices.length });
      await seek(video, Math.min(index / fps, duration - 0.05));
      full.ctx.drawImage(video, 0, 0, full.c.width, full.c.height);
      preview.ctx.drawImage(full.c, 0, 0, preview.c.width, preview.c.height);
      const { data } = await worker.recognize(full.c, {}, { blocks: true, text: true });
      const lines: OCRLine[] = [];
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) for (const line of paragraph.lines) lines.push(toLine(line));
      }
      const ocr: OCRResult = { text: data.text, lines, confidence: data.confidence, width: full.c.width, height: full.c.height };
      frames.push({ id: newId("f"), timestamp: index / fps, image: preview.c.toDataURL("image/jpeg", 0.7), ocr });
    }
    onProgress({ stage: "ocr", current: indices.length, total: indices.length });

    // 4. つないで、問題に分ける
    onProgress({ stage: "structure" });
    const merged = mergeOCRText(frames.map((f) => ({ frameId: f.id, ocr: f.ocr })), bands);
    const { questions, warnings } = parseQuestions(merged);
    return {
      frames,
      mergedText: merged.map((l) => l.text).join("\n"),
      questions,
      warnings,
      stats: { durationSec: duration, sampledFrames: thumbs.length, keptFrames: frames.length },
    };
  } finally {
    URL.revokeObjectURL(video.src);
    video.remove();
  }
}
