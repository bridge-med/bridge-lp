import type { PipelineEvent } from "@/types/pipeline";
import type { ProcessResult } from "@/types/project";

/** 動画を /api/process に送り、進み具合を onEvent で受け取る */
export async function requestProcessing(
  file: File,
  onEvent: (event: PipelineEvent) => void,
  signal?: AbortSignal,
): Promise<ProcessResult> {
  const res = await fetch("/api/process", {
    method: "POST",
    body: file,
    signal,
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `解析を開始できませんでした(${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let result: ProcessResult | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as PipelineEvent;
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "result") result = event.result;
      onEvent(event);
    }
    if (done) break;
  }
  if (!result) throw new Error("解析が途中で終わりました。もう一度お試しください");
  return result;
}
