import { OCR } from "../config";
import type { OCRProvider } from "./OCRProvider";
import { TesseractProvider } from "./TesseractProvider";

export type { OCRProvider } from "./OCRProvider";

/** 環境変数 OCR_PROVIDER で切り替える。今は tesseract のみ */
export function createOCRProvider(name = process.env.OCR_PROVIDER ?? "tesseract"): OCRProvider {
  switch (name) {
    case "tesseract":
      return new TesseractProvider({ lang: OCR.lang, workers: OCR.workers, cacheDir: OCR.cacheDir });
    default:
      throw new Error(`未対応の OCR_PROVIDER です: ${name}`);
  }
}
