import type { OCRResult } from "@/types/ocr";

/**
 * OCR エンジンの差し替え口。
 * Google Cloud Vision / Azure / Vision 系 API などを足すときは、これを実装したクラスを作り
 * lib/ocr/index.ts の createOCRProvider で切り替える。
 * 外部サービスに画像を送る実装は、利用者データを外へ出す変更になるため既定にしない。
 */
export interface OCRProvider {
  readonly name: string;
  recognize(imagePath: string): Promise<OCRResult>;
  /** ワーカー等の後片付け。何度呼んでもよい */
  dispose(): Promise<void>;
}
