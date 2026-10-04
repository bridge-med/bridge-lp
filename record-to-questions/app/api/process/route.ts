import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { UPLOAD } from "@/lib/config";
import { createOCRProvider } from "@/lib/ocr";
import { processVideo } from "@/lib/pipeline/processVideo";
import { FfmpegError } from "@/lib/video/ffmpeg";
import { RuleBasedStructurer } from "@/lib/structurer/RuleBasedStructurer";
import type { PipelineEvent } from "@/types/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

/**
 * 動画を受け取り、解析の進み具合を NDJSON(1行1イベント)で返す。
 * 動画とフレーム画像は一時ディレクトリにだけ置き、成功・失敗・中断のどれでも最後に消す。
 */
export async function POST(request: Request) {
  let fileName: string;
  try {
    fileName = decodeURIComponent(request.headers.get("x-file-name") ?? "video");
  } catch {
    return Response.json({ error: "ファイル名を読み取れませんでした" }, { status: 400 });
  }
  const ext = path.extname(fileName).toLowerCase();
  if (!(UPLOAD.acceptedExtensions as readonly string[]).includes(ext)) {
    return Response.json({ error: `対応していない形式です(${UPLOAD.acceptedExtensions.join(" / ")})` }, { status: 415 });
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > UPLOAD.maxBytes) {
    return Response.json({ error: "ファイルが大きすぎます(上限 1GB)" }, { status: 413 });
  }
  if (!request.body) {
    return Response.json({ error: "動画が空です" }, { status: 400 });
  }

  const body = request.body;
  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PipelineEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // 接続が切れたあとは送れない。処理は abort で止まる
        }
      };
      const workDir = await mkdtemp(path.join(os.tmpdir(), "rtq-"));
      const ocr = createOCRProvider();
      try {
        emit({ type: "stage", stage: "upload", status: "active" });
        const videoPath = path.join(workDir, `input${ext}`);
        let received = 0;
        const limit = new Transform({
          transform(chunk: Buffer, _enc, cb) {
            received += chunk.length;
            cb(received > UPLOAD.maxBytes ? new Error("ファイルが大きすぎます(上限 1GB)") : null, chunk);
          },
        });
        await pipeline(
          Readable.fromWeb(body as unknown as NodeReadableStream),
          limit,
          createWriteStream(videoPath),
          { signal: abort.signal },
        );
        if (received === 0) throw new Error("動画が空です");
        emit({ type: "stage", stage: "upload", status: "done", detail: `${(received / 1024 / 1024).toFixed(1)}MB` });

        const result = await processVideo(videoPath, workDir, {
          ocr,
          structurer: new RuleBasedStructurer(),
          emit,
          signal: abort.signal,
        });
        emit({ type: "result", result });
      } catch (e) {
        const message = abort.signal.aborted ? "解析を中断しました" : e instanceof Error ? e.message : String(e);
        console.error("[process]", e, e instanceof FfmpegError ? e.stderr : "");
        emit({ type: "error", message });
      } finally {
        await ocr.dispose().catch((e) => console.error("[process] OCR の後片付けに失敗", e));
        await rm(workDir, { recursive: true, force: true }).catch((e) =>
          console.error("[process] 一時ファイルの削除に失敗", workDir, e),
        );
        try {
          controller.close();
        } catch {
          // 既に閉じている
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
