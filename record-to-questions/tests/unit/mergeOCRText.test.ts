import { describe, expect, it } from "vitest";
import { mergeOCRText, type FrameText } from "@/lib/parser/mergeOCRText";
import { cleanLine } from "@/lib/ocr/normalize";

/** 行を上から等間隔に並べた OCR 結果を作る */
function frame(frameId: string, texts: string[], height = 1000): FrameText {
  const step = height / (texts.length + 2);
  return {
    frameId,
    ocr: {
      text: texts.join("\n"),
      confidence: 90,
      width: 500,
      height,
      lines: texts.map((text, i) => ({
        text,
        confidence: 90,
        bbox: { x0: 0, x1: 500, y0: step * (i + 1), y1: step * (i + 1) + 20 },
      })),
    },
  };
}

describe("cleanLine", () => {
  it("日本語の文字間の空白を取り、選択肢記号の後の空白は残す", () => {
    expect(cleanLine("診 療 録 の 保 存")).toBe("診療録の保存");
    expect(cleanLine("ア 在 院 患 者")).toBe("ア 在院患者");
    expect(cleanLine("ICD-10 の 章")).toBe("ICD-10 の章");
  });
});

describe("mergeOCRText", () => {
  it("スクロールで重なった行を1回だけ残してつなぐ", () => {
    const merged = mergeOCRText([
      frame("a", ["問12", "診療録管理について正しいものを選べ。", "1. 診療録は5年保存する", "2. 電子保存は認められない", "3. 訂正は修正液で行う"]),
      frame("b", ["2. 電子保存は認められない", "3. 訂正は修正液で行う", "4. 署名は不要である", "5. 略語は自由に使う"]),
    ]);
    expect(merged.map((l) => l.text)).toEqual([
      "問12",
      "診療録管理について正しいものを選べ。",
      "1. 診療録は5年保存する",
      "2. 電子保存は認められない",
      "3. 訂正は修正液で行う",
      "4. 署名は不要である",
      "5. 略語は自由に使う",
    ]);
    expect(merged[3].frameIds).toEqual(["a", "b"]);
    expect(merged[5].frameIds).toEqual(["b"]);
  });

  it("OCR の揺れがあっても重なりを見つける", () => {
    const merged = mergeOCRText([
      frame("a", ["問1", "開示の可否は担当医師の個人的な判断", "のみで決める", "5. 手数料を徴収することは一切認められ"]),
      frame("b", ["開示の可否は担当医師の個人的な選断", "のみで決める", "5. 手数料を徴収することは一切認められ", "ない"]),
    ]);
    expect(merged.map((l) => l.text)).toEqual([
      "問1",
      "開示の可否は担当医師の個人的な判断",
      "のみで決める",
      "5. 手数料を徴収することは一切認められ",
      "ない",
    ]);
  });

  it("同じ画面の見直しは足さない", () => {
    const q4 = ["問4", "届け出る先として正しいものを選べ。", "1. 厚生労働大臣", "2. 市町村長"];
    const q5 = ["問5", "医療資源を最も投入した傷病名の説明として", "1. 入院の契機", "2. 治療を行った傷病"];
    const merged = mergeOCRText([frame("a", q4), frame("b", q5), frame("c", q4), frame("d", q5)]);
    expect(merged.map((l) => l.text)).toEqual([...q4, ...q5]);
  });

  it("文面が似ていても、新しい問題番号の画面は捨てない(組み合わせ問題)", () => {
    const body = ["次の記述のうち正しいものを1つ選べ。", "a 記録の作成者と日時を残す", "b 本人の同意を原則とする", "1. a b", "2. a e", "3. b c"];
    const merged = mergeOCRText([frame("a", ["問4", ...body]), frame("b", ["問8", ...body])]);
    expect(merged.filter((l) => /^問/.test(l.text)).map((l) => l.text)).toEqual(["問4", "問8"]);
    expect(merged).toHaveLength(14);
  });

  it("番号の映らないスクロール途中の画面は、前の問題と同じ選択肢でも足す", () => {
    const choices = ["1. a b", "2. a e", "3. b c", "4. c d", "5. d e"];
    const merged = mergeOCRText([
      frame("a", ["問3", "次の記述のうち正しいものを選べ。", "a 記録を残す", ...choices]),
      frame("b", ["問4", "次の記述のうち誤っているものを選べ。", "a 同意を得る", "b 保存期間を守る"]),
      frame("c", choices), // 問4 をスクロールした先。問4 の選択肢はまだ読んでいない
    ]);
    expect(merged.slice(-5).map((l) => l.text)).toEqual(choices);
    expect(merged).toHaveLength(8 + 4 + 5);
  });

  it("固定帯の行と、信頼度の低い行を除く", () => {
    const f = frame("a", ["9:41 アプリ", "問1", "本文です。", "1. A", "< 前へ 次へ >"]);
    f.ocr.lines[2].confidence = 0;
    const merged = mergeOCRText([f], { top: 0.2, bottom: 0.3 });
    expect(merged.map((l) => l.text)).toEqual(["問1", "1. A"]);
  });
});
