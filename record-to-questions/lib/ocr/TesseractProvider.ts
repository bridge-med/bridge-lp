import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { createScheduler, createWorker, type Line, type Scheduler } from "tesseract.js";
import type { OCRLine, OCRResult } from "@/types/ocr";
import type { OCRProvider } from "./OCRProvider";

type Options = { lang: string; workers: number; cacheDir: string };

/**
 * サーバー内で動く Tesseract(WebAssembly)。画像は外部に送らない。
 * 初回だけ言語データ(jpn 約2MB)を取得し、cacheDir に保存して以降は再利用する。
 */
export class TesseractProvider implements OCRProvider {
  readonly name = "tesseract";
  private scheduler: Scheduler | null = null;
  private starting: Promise<Scheduler> | null = null;

  constructor(private readonly options: Options) {}

  private async start(): Promise<Scheduler> {
    const cachePath = path.resolve(process.cwd(), this.options.cacheDir);
    await mkdir(cachePath, { recursive: true });
    const scheduler = createScheduler();
    const workers = await Promise.all(
      Array.from({ length: this.options.workers }, () =>
        createWorker(this.options.lang, 1, { cachePath }),
      ),
    );
    for (const w of workers) {
      // 日本語の行間に空白が入るのを抑える
      await w.setParameters({ preserve_interword_spaces: "1" });
      scheduler.addWorker(w);
    }
    this.scheduler = scheduler;
    return scheduler;
  }

  private ready(): Promise<Scheduler> {
    if (this.scheduler) return Promise.resolve(this.scheduler);
    this.starting ??= this.start().catch((e) => {
      this.starting = null;
      throw e;
    });
    return this.starting;
  }

  async recognize(imagePath: string): Promise<OCRResult> {
    const scheduler = await this.ready();
    const image = await readFile(imagePath);
    const { width, height } = pngSize(image);
    const { data } = await scheduler.addJob("recognize", image, {}, { blocks: true, text: true });
    const lines: OCRLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) lines.push(toLine(line));
      }
    }
    return { text: data.text, lines, confidence: data.confidence, width, height };
  }

  async dispose(): Promise<void> {
    const scheduler = this.scheduler ?? (this.starting ? await this.starting.catch(() => null) : null);
    this.scheduler = null;
    this.starting = null;
    if (scheduler) await scheduler.terminate();
  }
}

function toLine(line: Line): OCRLine {
  return { text: line.text.replace(/\n$/, ""), confidence: line.confidence, bbox: line.bbox };
}

/** PNG の IHDR から画素数を読む(行の位置を画面に対する割合で扱うため) */
function pngSize(buf: Buffer): { width: number; height: number } {
  const isPng = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("ascii", 12, 16) === "IHDR";
  if (!isPng) throw new Error("OCR の入力は PNG 画像を想定しています");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
