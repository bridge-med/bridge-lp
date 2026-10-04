import { describe, expect, it } from "vitest";
import { cropToContent, detectFixedBands, estimateScroll, frameDifference, selectKeyFrames } from "@/lib/image/deduplicateFrames";

const W = 20;
const H = 60;

/** 縦長の「ページ」(行ごとに文字のような濃淡を持つ)。seed ごとに別の内容 */
function page(seed: number, length = 400): Uint8Array[] {
  let x = seed * 9301 + 49297;
  const rand = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length }, () => {
    const ink = rand() < 0.5;
    return Uint8Array.from({ length: W }, () => (ink && rand() < 0.4 ? 20 : 235));
  });
}
/** ページを offset 行目から切り出した画面。上下 6 行は固定バー */
function screen(content: Uint8Array[], offset: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const fixed = y < 6 || y >= H - 6;
    out.set(fixed ? new Uint8Array(W).fill(120) : content[offset + y], y * W);
  }
  return out;
}

describe("frame comparison", () => {
  it("同じ画面の差は 0", () => {
    const a = screen(page(1), 0);
    expect(frameDifference(a, a)).toBe(0);
  });

  it("スクロール量を推定する", () => {
    const p = page(1);
    const bands = { top: 6 / H, bottom: 6 / H };
    const c = cropToContent([screen(p, 0), screen(p, 8)], W, H, bands);
    const { shift, diff } = estimateScroll(c.frames[0], c.frames[1], W, c.height);
    expect(shift).toBe(8);
    expect(diff).toBeLessThan(0.05);
  });

  it("固定帯を検出する", () => {
    const p = page(1);
    const bands = detectFixedBands([screen(p, 0), screen(p, 30), screen(page(2), 0)], W, H);
    expect(bands.top).toBe(6 / H);
    expect(bands.bottom).toBe(6 / H);
  });

  it("画面が動かない録画では固定帯を判定しない", () => {
    const a = screen(page(1), 0);
    expect(detectFixedBands([a, a, a], W, H)).toEqual({ top: 0, bottom: 0 });
  });
});

describe("selectKeyFrames", () => {
  it("止まっている間は1枚、別の画面に変われば1枚ずつ残す", () => {
    const a = screen(page(1), 0);
    const b = screen(page(2), 0);
    const frames = [a, a, a, a, b, b, b, a, a];
    const kept = selectKeyFrames(frames, W, H);
    expect(kept.map((k) => k.index)).toEqual([0, 4]); // 最後の a は先頭の a と同一なので捨てる
  });

  it("長いスクロールの途中も、読み残しが出ない間隔で残す", () => {
    const p = page(1);
    const frames = [0, 0, 0, 10, 20, 30, 40, 50, 60, 70, 80, 80, 80].map((o) => screen(p, o));
    const bands = detectFixedBands(frames, W, H);
    const c = cropToContent(frames, W, H, bands);
    const kept = selectKeyFrames(c.frames, W, c.height).map((k) => k.index);
    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(10); // 止まった画面
    for (let i = 1; i < kept.length; i++) {
      // 連続して残したフレームのずれは画面の高さ未満(重なりがある)
      const offset = (idx: number) => [0, 0, 0, 10, 20, 30, 40, 50, 60, 70, 80, 80, 80][idx];
      expect(offset(kept[i]) - offset(kept[i - 1])).toBeLessThan(H - 12);
    }
  });
});
