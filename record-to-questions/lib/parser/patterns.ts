/**
 * 問題番号・選択肢・正解・解説の見分け方。新しい形式に対応するときはここに足す。
 * 照合の前に NFKC で全角数字・全角記号をそろえる(元の文字列は書き換えない)。
 */

const KANJI_DIGITS: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

export function parseJapaneseNumber(s: string): number | undefined {
  if (/^\d+$/.test(s)) return Number(s);
  if (!/^[〇一二三四五六七八九十百]+$/.test(s)) return undefined;
  let total = 0;
  let current = 0;
  for (const ch of s) {
    if (ch === "百") {
      total += (current || 1) * 100;
      current = 0;
    } else if (ch === "十") {
      total += (current || 1) * 10;
      current = 0;
    } else {
      current = current * 10 + KANJI_DIGITS[ch];
    }
  }
  return total + current;
}

// 「問」は OCR で「間」「閂」と読まれやすい。行頭で数字が続くときに限り問題番号とみなす
const HEADER_PATTERNS: RegExp[] = [
  /^[【\[(〔]?\s*(?:問題|問|間)\s*(\d+|[一二三四五六七八九十百]+)\s*[】\])〕]?\s*[.:、]?\s*(.*)$/,
  // 「第3条」等と区別するため、「第」は「問」で閉じるときだけ
  /^[【\[(〔]?\s*第\s*(\d+|[一二三四五六七八九十百]+)\s*問\s*[】\])〕]?\s*[.:、]?\s*(.*)$/,
  /^[【\[(〔]?\s*Q\s*\.?\s*(\d+)\s*[】\])〕]?\s*[.:、]?\s*(.*)$/i,
];

export type HeaderMatch = { number?: number; rest: string };

export function matchHeader(line: string): HeaderMatch | null {
  const s = line.normalize("NFKC").trim();
  for (const re of HEADER_PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const number = parseJapaneseNumber(m[1]);
    // 「問題 1 2 3 4 5」のような表の見出しや年号を誤認しないよう、番号は 1〜999 に限る
    if (number === undefined || number < 1 || number > 999) continue;
    return { number, rest: m[2].trim() };
  }
  return null;
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
const KATAKANA = "アイウエオカキクケコ";
const ALPHA = "abcdefghij";

export type ChoiceMatch = {
  label: string;
  /** 並び順(1始まり)。1. と① と ア と a を同じ物差しで比べるため */
  order: number;
  family: "number" | "circled" | "katakana" | "alpha";
  text: string;
};

export function matchChoice(line: string): ChoiceMatch | null {
  const raw = line.trim();
  const first = raw[0];
  if (first && CIRCLED.includes(first)) {
    return { label: first, order: CIRCLED.indexOf(first) + 1, family: "circled", text: raw.slice(1).trim() };
  }
  const s = raw.normalize("NFKC");
  let m = s.match(/^\(?(\d{1,2})\s*[.)、:]\s*(.*)$/) ?? s.match(/^\((\d{1,2})\)\s*(.*)$/);
  if (m) return { label: m[1], order: Number(m[1]), family: "number", text: m[2].trim() };

  m = s.match(/^\(?([ア-コ])\s*[.)、:]\s*(.*)$/) ?? s.match(/^([ア-コ])\s+(.*)$/);
  if (m && KATAKANA.includes(m[1])) {
    return { label: m[1], order: KATAKANA.indexOf(m[1]) + 1, family: "katakana", text: m[2].trim() };
  }
  m = s.match(/^\(?([a-jA-J])\s*[.)]\s*(.*)$/);
  if (m) {
    const label = m[1].toLowerCase();
    return { label: m[1], order: ALPHA.indexOf(label) + 1, family: "alpha", text: m[2].trim() };
  }
  return null;
}

export function matchAnswer(line: string): string | null {
  const m = line.normalize("NFKC").trim().match(/^[【\[(]?\s*(?:正解|正答|解答|答え|答)\s*[】\])]?\s*[:は]?\s*(.*)$/);
  return m ? m[1].trim() : null;
}

export function matchExplanation(line: string): string | null {
  const m = line.normalize("NFKC").trim().match(/^[【\[(]?\s*解説\s*[】\])]?\s*[:]?\s*(.*)$/);
  return m ? m[1].trim() : null;
}
