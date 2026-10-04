import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { choiceMarker, questionTitle } from "../questions";
import type { Question } from "@/types/question";

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = { x: 56, top: 60, bottom: 60 };
const SIZE = { title: 17, heading: 13, body: 11 };
const LEADING = 1.7;
const QUESTION_GAP = 26;
const TEXT = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);

// 行頭に来てはいけない文字(簡易の禁則)
const NO_LINE_START = "、。，．・：；？！ー）」』】〕｝〉》ゝゞぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ,.:;)]}";

/** 1文字ずつ幅を測って折り返す(日本語は単語の区切りがないため) */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const ch of Array.from(paragraph)) {
      const candidate = line + ch;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (NO_LINE_START.includes(ch)) {
          // 句読点はぶら下げて、前の行に収める
          out.push(candidate);
          line = "";
          continue;
        }
        out.push(line);
        line = ch;
      } else {
        line = candidate;
      }
    }
    out.push(line);
  }
  return out;
}

type Block = { text: string; size: number; color: ReturnType<typeof rgb>; indent: number; gapBefore: number };

export async function toPdf(title: string, questions: Question[], fontBytes: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const width = PAGE.width - MARGIN.x * 2;

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN.top;
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN.top;
  };
  const layout = (b: Block) => wrapText(b.text, font, b.size, width - b.indent);
  const heightOf = (blocks: Block[]) =>
    blocks.reduce((h, b) => h + b.gapBefore + layout(b).length * b.size * LEADING, 0);
  const draw = (b: Block) => {
    y -= b.gapBefore;
    for (const line of layout(b)) {
      if (y - b.size * LEADING < MARGIN.bottom) newPage();
      y -= b.size * LEADING;
      page.drawText(line, { x: MARGIN.x + b.indent, y: y + b.size * 0.35, size: b.size, font, color: b.color });
    }
  };

  draw({ text: title, size: SIZE.title, color: TEXT, indent: 0, gapBefore: 0 });
  y -= 8;

  questions.forEach((q, i) => {
    const blocks: Block[] = [
      { text: questionTitle(q, i), size: SIZE.heading, color: TEXT, indent: 0, gapBefore: i === 0 ? 10 : QUESTION_GAP },
      { text: q.questionText.trim(), size: SIZE.body, color: TEXT, indent: 0, gapBefore: 4 },
      ...q.choices.map((c, ci) => ({
        text: `${choiceMarker(c.label)} ${c.text}`.trim(),
        size: SIZE.body,
        color: TEXT,
        indent: 12,
        gapBefore: ci === 0 ? 6 : 0,
      })),
    ];
    if (q.answer?.trim()) blocks.push({ text: `正解 ${q.answer.trim()}`, size: SIZE.body, color: MUTED, indent: 0, gapBefore: 8 });
    if (q.explanation?.trim()) {
      blocks.push({ text: `解説\n${q.explanation.trim()}`, size: SIZE.body, color: MUTED, indent: 0, gapBefore: 4 });
    }
    // 1ページに収まる問題は、途中でページをまたがせない
    const needed = heightOf(blocks);
    const usable = PAGE.height - MARGIN.top - MARGIN.bottom;
    if (needed <= usable && y - needed < MARGIN.bottom) newPage();
    blocks.forEach(draw);
  });

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `${i + 1} / ${pages.length}`;
    const w = font.widthOfTextAtSize(label, 9);
    p.drawText(label, { x: (PAGE.width - w) / 2, y: 30, size: 9, font, color: MUTED });
  });
  return doc.save();
}
