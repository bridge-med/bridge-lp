export type BBox = { x0: number; y0: number; x1: number; y1: number };

export type OCRLine = {
  text: string;
  /** 0〜100 */
  confidence: number;
  bbox: BBox;
};

export type OCRResult = {
  /** エンジンが返した全文(無加工) */
  text: string;
  lines: OCRLine[];
  /** 0〜100 */
  confidence: number;
  width: number;
  height: number;
};
