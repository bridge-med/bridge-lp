import { FRAME_SELECTION } from "../config";

type Thumb = Uint8Array;

/** 2枚の平均絶対差(0〜1) */
export function frameDifference(a: Thumb, b: Thumb): number {
  if (a.length !== b.length) throw new Error("サイズの違うフレームは比較できません");
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / (a.length * 255);
}

/**
 * b が a を縦に shift 行ずらしたもの(上へスクロールした分だけ正)と仮定したときの差。
 * 重なる範囲だけを比べる。
 */
function shiftedDifference(a: Thumb, b: Thumb, width: number, height: number, shift: number): number {
  const rows = height - Math.abs(shift);
  if (rows <= 0) return 1;
  const aStart = shift > 0 ? shift : 0;
  const bStart = shift > 0 ? 0 : -shift;
  let sum = 0;
  for (let r = 0; r < rows; r++) {
    const ao = (aStart + r) * width;
    const bo = (bStart + r) * width;
    for (let x = 0; x < width; x++) sum += Math.abs(a[ao + x] - b[bo + x]);
  }
  return sum / (rows * width * 255);
}

/** 縦方向のずれ(行数)を推定する。最も差が小さくなるずれと、そのときの差を返す */
export function estimateScroll(a: Thumb, b: Thumb, width: number, height: number): { shift: number; diff: number } {
  const maxShift = Math.floor(height * 0.6);
  let best = { shift: 0, diff: shiftedDifference(a, b, width, height, 0) };
  for (let s = 1; s <= maxShift; s++) {
    for (const shift of [s, -s]) {
      const diff = shiftedDifference(a, b, width, height, shift);
      if (diff < best.diff) best = { shift, diff };
    }
  }
  return best;
}

export type FixedBands = {
  /** 画面上端から、固定表示が続く割合(0〜1) */
  top: number;
  /** 画面下端から、固定表示が続く割合(0〜1) */
  bottom: number;
};

/**
 * 動画全体を通して変わらない上下の帯(ステータスバー・アプリのヘッダー・下部のボタン)を求める。
 * OCR の読み揺れに左右されないよう、画素で判定する。
 * 画面がほとんど動かない録画では判定できないので 0 を返す。
 */
export function detectFixedBands(
  frames: Thumb[],
  width: number,
  height: number,
  options: Pick<typeof FRAME_SELECTION, "fixedRowDiff" | "maxFixedBand"> = FRAME_SELECTION,
): FixedBands {
  const none = { top: 0, bottom: 0 };
  if (frames.length < 2) return none;
  const rowIsFixed = (row: number) => {
    const o = row * width;
    for (let f = 1; f < frames.length; f++) {
      let sum = 0;
      for (let x = 0; x < width; x++) sum += Math.abs(frames[f][o + x] - frames[0][o + x]);
      if (sum / (width * 255) > options.fixedRowDiff) return false;
    }
    return true;
  };
  const limit = Math.floor(height * options.maxFixedBand);
  let top = 0;
  while (top <= limit && rowIsFixed(top)) top++;
  let bottom = 0;
  while (bottom <= limit && rowIsFixed(height - 1 - bottom)) bottom++;
  if (top > limit || bottom > limit) return none;
  return { top: top / height, bottom: bottom / height };
}

/** 固定帯を除いた本文部分だけを切り出す(スクロール量や差分を本文だけで測るため) */
export function cropToContent(
  frames: Thumb[],
  width: number,
  height: number,
  bands: FixedBands,
): { frames: Thumb[]; height: number } {
  const top = Math.round(bands.top * height);
  const bottom = Math.round(bands.bottom * height);
  const rows = height - top - bottom;
  if (rows <= 0 || (top === 0 && bottom === 0)) return { frames, height };
  return { frames: frames.map((f) => f.subarray(top * width, (top + rows) * width)), height: rows };
}

export type KeyFrameReason = "first" | "scroll" | "settled" | "scene";
export type KeyFrame = { index: number; reason: KeyFrameReason };

type Options = Pick<
  typeof FRAME_SELECTION,
  "stillDiff" | "scrollMatchDiff" | "scrollGainRatio" | "keepScrollRatio" | "settleScrollRatio" | "duplicateDiff"
>;

/**
 * OCR にかけるフレームを選ぶ。
 * - 最初に止まった画面
 * - スクロール中は画面の keepScrollRatio 分動くごとに1枚(文字の取りこぼしを防ぐ)
 * - スクロールが止まった画面
 * - 画面が切り替わった(問題が変わった)あと、落ち着いた画面
 * 最後に、すでに残したフレームとほぼ同じものを捨てる。
 */
export function selectKeyFrames(
  frames: Thumb[],
  width: number,
  height: number,
  options: Options = FRAME_SELECTION,
): KeyFrame[] {
  if (frames.length === 0) return [];
  const candidates: KeyFrame[] = [];
  let scrolledSinceKeep = 0;
  let pendingScene = true; // 先頭は「最初に落ち着いた画面」を待つ
  let lastKept = -1;

  const keep = (index: number, reason: KeyFrameReason) => {
    if (index === lastKept) return;
    candidates.push({ index, reason });
    lastKept = index;
    scrolledSinceKeep = 0;
  };

  for (let i = 1; i <= frames.length; i++) {
    const atEnd = i === frames.length;
    const diff = atEnd ? 0 : frameDifference(frames[i - 1], frames[i]);

    if (diff <= options.stillDiff) {
      // i-1 → i で動いていない = i-1 は落ち着いた画面
      if (pendingScene) {
        keep(i - 1, lastKept < 0 ? "first" : "scene");
        pendingScene = false;
      } else if (scrolledSinceKeep >= height * options.settleScrollRatio) {
        keep(i - 1, "settled");
      }
      continue;
    }

    const { shift, diff: residual } = estimateScroll(frames[i - 1], frames[i], width, height);
    const isScroll = shift !== 0 && residual <= options.scrollMatchDiff && residual <= diff * options.scrollGainRatio;
    if (isScroll) {
      scrolledSinceKeep += Math.abs(shift);
      if (!pendingScene && scrolledSinceKeep >= height * options.keepScrollRatio) keep(i, "scroll");
    } else {
      // 画面遷移。遷移前に読み残しがあれば、遷移直前の画面を残す
      if (!pendingScene && scrolledSinceKeep >= height * options.settleScrollRatio) keep(i - 1, "settled");
      pendingScene = true;
    }
  }
  // 最後まで落ち着かなかった場合も、最後の画面は読む
  if (pendingScene) keep(frames.length - 1, lastKept < 0 ? "first" : "scene");

  const kept: KeyFrame[] = [];
  for (const c of candidates) {
    const dup = kept.some((k) => frameDifference(frames[k.index], frames[c.index]) <= options.duplicateDiff);
    if (!dup) kept.push(c);
  }
  return kept;
}
