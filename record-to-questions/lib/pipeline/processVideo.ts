import { FRAME_SELECTION, OCR } from "../config";
import { cropToContent, detectFixedBands, selectKeyFrames } from "../image/deduplicateFrames";
import type { OCRProvider } from "../ocr/OCRProvider";
import { mergeOCRText } from "../parser/mergeOCRText";
import { newId } from "../id";
import type { QuestionStructurer } from "../structurer/QuestionStructurer";
import { extractFramesAt, extractThumbnails, makePreview, probeDuration } from "../video/extractFrames";
import type { PipelineEvent } from "@/types/pipeline";
import type { ProcessResult, SourceFrame } from "@/types/project";

type Deps = {
  ocr: OCRProvider;
  structurer: QuestionStructurer;
  emit: (event: PipelineEvent) => void;
  signal?: AbortSignal;
};

/**
 * 動画1本 → 問題データ。workDir は呼び出し側が作って消す(このあと必ず削除される前提)。
 */
export async function processVideo(videoPath: string, workDir: string, deps: Deps): Promise<ProcessResult> {
  const { ocr, structurer, emit, signal } = deps;
  const fps = FRAME_SELECTION.sampleFps;

  emit({ type: "stage", stage: "extract", status: "active" });
  const durationSec = await probeDuration(videoPath, signal);
  const thumbs = await extractThumbnails(videoPath, { fps, width: FRAME_SELECTION.thumbWidth }, signal);
  emit({ type: "stage", stage: "extract", status: "done", detail: `${thumbs.frames.length}枚` });

  emit({ type: "stage", stage: "dedupe", status: "active" });
  const bands = detectFixedBands(thumbs.frames, thumbs.width, thumbs.height);
  const content = cropToContent(thumbs.frames, thumbs.width, thumbs.height, bands);
  const keyFrames = selectKeyFrames(content.frames, thumbs.width, content.height);
  const indices = keyFrames.map((k) => k.index);
  const paths = await extractFramesAt(videoPath, { fps, indices, outDir: workDir }, signal);
  emit({ type: "stage", stage: "dedupe", status: "done", detail: `${paths.length}枚を解析` });

  emit({ type: "stage", stage: "ocr", status: "active" });
  let done = 0;
  emit({ type: "progress", stage: "ocr", current: 0, total: paths.length });
  // OCR ワーカー数に合わせて並べる(長い録画で ffmpeg を一度に何十も起動しない)
  const frames: SourceFrame[] = await mapWithConcurrency(paths, OCR.workers, async (p, i) => {
    signal?.throwIfAborted();
    const [result, image] = await Promise.all([ocr.recognize(p), makePreview(p, OCR.previewWidth, signal)]);
    emit({ type: "progress", stage: "ocr", current: ++done, total: paths.length });
    return { id: newId("f"), timestamp: indices[i] / fps, image, ocr: result };
  });
  emit({ type: "stage", stage: "ocr", status: "done" });

  emit({ type: "stage", stage: "structure", status: "active" });
  const merged = mergeOCRText(frames.map((f) => ({ frameId: f.id, ocr: f.ocr })), bands);
  const { questions, warnings } = await structurer.structure(merged);
  emit({ type: "stage", stage: "structure", status: "done", detail: `${questions.length}問` });

  return {
    frames,
    mergedText: merged.map((l) => l.text).join("\n"),
    questions,
    warnings,
    stats: { durationSec, sampledFrames: thumbs.frames.length, keptFrames: frames.length },
  };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
