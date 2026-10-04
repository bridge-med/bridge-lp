import { readdir } from "node:fs/promises";
import path from "node:path";
import { run } from "./ffmpeg";

export type Thumbnails = {
  width: number;
  height: number;
  /** グレースケール(1px=1byte)のサムネイル。sampleFps ごとに1枚 */
  frames: Uint8Array[];
};

export async function probeDuration(videoPath: string, signal?: AbortSignal): Promise<number> {
  const out = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", videoPath],
    { signal },
  );
  const duration = Number.parseFloat(out.toString().trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("動画の長さを読み取れませんでした。ファイルが壊れていないか確認してください");
  }
  return duration;
}

/** 比較用の小さなグレースケール画像を一定間隔で取り出す(回転情報は ffmpeg が反映する) */
export async function extractThumbnails(
  videoPath: string,
  { fps, width }: { fps: number; width: number },
  signal?: AbortSignal,
): Promise<Thumbnails> {
  const filter = `fps=${fps},scale=${width}:-2:flags=area,format=gray`;
  const first = await run(
    "ffmpeg",
    ["-v", "error", "-i", videoPath, "-vf", filter, "-frames:v", "1", "-f", "rawvideo", "pipe:1"],
    { signal },
  );
  if (first.length === 0 || first.length % width !== 0) {
    throw new Error("動画からフレームを取り出せませんでした");
  }
  const height = first.length / width;
  const raw = await run("ffmpeg", ["-v", "error", "-i", videoPath, "-vf", filter, "-f", "rawvideo", "pipe:1"], {
    signal,
  });
  const size = width * height;
  const frames: Uint8Array[] = [];
  for (let offset = 0; offset + size <= raw.length; offset += size) {
    frames.push(new Uint8Array(raw.buffer, raw.byteOffset + offset, size));
  }
  return { width, height, frames };
}

/**
 * サンプル番号で指定したフレームだけを原寸の PNG で書き出す。
 * 戻り値は indices と同じ順のファイルパス。
 */
export async function extractFramesAt(
  videoPath: string,
  { fps, indices, outDir }: { fps: number; indices: number[]; outDir: string },
  signal?: AbortSignal,
): Promise<string[]> {
  if (indices.length === 0) return [];
  const select = indices.map((i) => `eq(n\\,${i})`).join("+");
  await run(
    "ffmpeg",
    [
      "-v", "error", "-i", videoPath,
      "-vf", `fps=${fps},select='${select}'`,
      "-fps_mode", "passthrough",
      path.join(outDir, "frame_%04d.png"),
    ],
    { signal },
  );
  const files = (await readdir(outDir)).filter((f) => /^frame_\d{4}\.png$/.test(f)).sort();
  if (files.length !== indices.length) {
    throw new Error(`フレームの書き出し枚数が合いません(期待 ${indices.length} / 実際 ${files.length})`);
  }
  return files.map((f) => path.join(outDir, f));
}

/** 確認用の縮小 JPEG を作り、data URL で返す */
export async function makePreview(pngPath: string, maxWidth: number, signal?: AbortSignal): Promise<string> {
  const jpeg = await run(
    "ffmpeg",
    [
      "-v", "error", "-i", pngPath,
      "-vf", `scale='min(${maxWidth},iw)':-2`,
      "-q:v", "5", "-f", "image2", "-c:v", "mjpeg", "pipe:1",
    ],
    { signal },
  );
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
