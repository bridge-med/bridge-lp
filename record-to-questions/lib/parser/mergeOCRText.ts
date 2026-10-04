import { MERGE } from "../config";
import type { FixedBands } from "../image/deduplicateFrames";
import { cleanLine, comparable, similarity } from "../ocr/normalize";
import type { OCRLine, OCRResult } from "@/types/ocr";

export type FrameText = { frameId: string; ocr: OCRResult };

/** 結合後の1行。どのフレームで読めたかを持つ(元画像との照合に使う) */
export type MergedLine = { text: string; frameIds: string[] };

type Line = { text: string; key: string; frameId: string };

const CLOCK = /^\d{1,2}[:：]\d{2}/;
const NO_BANDS: FixedBands = { top: 0, bottom: 0 };

function sameLine(a: string, b: string, threshold: number): boolean {
  return a === b || similarity(a, b) >= threshold;
}

/**
 * 画面の固定部分(ステータスバー・ヘッダー・「次へ」ボタン等)とノイズを除く。
 * 1) 画素で判定した固定帯(bands)に中心がある行
 * 2) 上下端の帯にあり、多くのフレームに同じ文字列で出る行(帯を判定できない短い録画向け)
 * 3) 信頼度が極端に低い行(固定バーに半分隠れた文字など)
 * 問題文の定型句(「正しいものを1つ選べ」)は画面の中ほどにあるので消さない。
 */
function stripChrome(frames: FrameText[], bands: FixedBands, options: typeof MERGE): Line[][] {
  const pos = (ocr: OCRResult, l: OCRLine) => {
    const h = ocr.height || 1;
    return { top: l.bbox.y0 / h, bottom: l.bbox.y1 / h, center: (l.bbox.y0 + l.bbox.y1) / 2 / h };
  };
  const inEdgeBand = (ocr: OCRResult, l: OCRLine) => {
    const p = pos(ocr, l);
    return p.bottom <= options.chromeBand || p.top >= 1 - options.chromeBand;
  };
  const inFixedBand = (ocr: OCRResult, l: OCRLine) => {
    const { center } = pos(ocr, l);
    return center < bands.top || center > 1 - bands.bottom;
  };

  const counts = new Map<string, number>();
  for (const f of frames) {
    const seen = new Set<string>();
    for (const l of f.ocr.lines) {
      if (!inEdgeBand(f.ocr, l)) continue;
      const key = comparable(l.text);
      if (key && !seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const minCount = Math.max(2, Math.ceil(frames.length * options.chromeMinRatio));

  return frames.map((f) =>
    f.ocr.lines
      .filter((l) => {
        if (l.confidence < options.minLineConfidence) return false;
        if (inFixedBand(f.ocr, l)) return false;
        const text = cleanLine(l.text);
        const key = comparable(text);
        if (!key) return false;
        if (!inEdgeBand(f.ocr, l)) return true;
        if (CLOCK.test(text.normalize("NFKC"))) return false;
        return frames.length < 2 || (counts.get(key) ?? 0) < minCount;
      })
      .map((l) => {
        const text = cleanLine(l.text);
        return { text, key: comparable(text), frameId: f.frameId };
      }),
  );
}

type Overlap = {
  /** 重なった行数 */
  k: number;
  /** doc の末尾から捨てる行数(読み崩れた端の行) */
  dropTail: number;
  /** next の先頭から読み飛ばす行数 */
  skipHead: number;
};

/**
 * doc の末尾と next の先頭が重なる位置を探す。
 * フレームの上下端の行は固定バーに隠れかけて読み崩れることがあるので、
 * 両端から edgeSkipLines 行までは読み飛ばしてよいことにする。
 */
function findOverlap(doc: Line[], next: Line[], options: typeof MERGE): Overlap | null {
  const threshold = options.lineSimilarity;
  let best: Overlap | null = null;
  for (let dropTail = 0; dropTail <= options.edgeSkipLines; dropTail++) {
    for (let skipHead = 0; skipHead <= options.edgeSkipLines; skipHead++) {
      const end = doc.length - dropTail;
      const max = Math.min(end, next.length - skipHead);
      for (let k = max; k >= 1; k--) {
        if (best && k <= best.k) break;
        const tail = doc.slice(end - k, end);
        const head = next.slice(skipHead, skipHead + k);
        // 1行だけの一致は偶然が多いので、ある程度長い行に限る
        if (k === 1 && tail[0].key.length < 4) continue;
        if (!sameLine(tail[0].key, head[0].key, threshold) || !sameLine(tail[k - 1].key, head[k - 1].key, threshold)) {
          continue;
        }
        let matched = 0;
        for (let i = 0; i < k; i++) if (sameLine(tail[i].key, head[i].key, threshold)) matched++;
        if (matched / k >= 0.8) {
          best = { k, dropTail, skipHead };
          break;
        }
      }
    }
  }
  return best;
}

/** next の行の大半がすでに doc の直近にあるか(同じ画面を見直した・スクロールで戻った) */
function isContained(doc: Line[], next: Line[], options: typeof MERGE): boolean {
  if (next.length === 0) return true;
  const recent = doc.slice(-options.lookbackLines);
  const found = next.filter((n) => recent.some((d) => sameLine(d.key, n.key, options.lineSimilarity))).length;
  return found / next.length >= options.containedRatio;
}

/**
 * フレームごとの OCR 結果を、重なりを除いて1本の文章にする。
 * スクロールで「上半分 → 下半分」と読んだ文章は、重なった行を1回だけ残してつなぐ。
 */
export function mergeOCRText(
  frames: FrameText[],
  bands: FixedBands = NO_BANDS,
  options: typeof MERGE = MERGE,
): MergedLine[] {
  const perFrame = stripChrome(frames, bands, options);
  const doc: Line[] = [];
  const sources: Set<string>[] = [];
  const append = (lines: Line[]) => {
    for (const l of lines) {
      doc.push(l);
      sources.push(new Set([l.frameId]));
    }
  };

  for (const lines of perFrame) {
    if (lines.length === 0) continue;
    const overlap = findOverlap(doc, lines, options);
    if (overlap) {
      const { k, dropTail, skipHead } = overlap;
      doc.splice(doc.length - dropTail, dropTail);
      sources.splice(sources.length - dropTail, dropTail);
      for (let i = 0; i < k; i++) sources[doc.length - k + i].add(lines[skipHead + i].frameId);
      append(lines.slice(skipHead + k));
      continue;
    }
    if (isContained(doc, lines, options)) continue;
    append(lines);
  }
  return doc.map((l, i) => ({ text: l.text, frameIds: [...sources[i]] }));
}
