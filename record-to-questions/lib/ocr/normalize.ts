/**
 * OCR の行を「読める形」にそろえる。中身は変えず、OCR が入れた余計な空白だけを取る。
 * (Tesseract の jpn は日本語の文字と文字の間に空白を入れることが多い)
 */
const CJK = "\\u3000-\\u303f\\u3040-\\u30ff\\u3400-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
const SPACE_BETWEEN_CJK = new RegExp(`(?<=[${CJK}])[ \\t]+(?=[${CJK}])`, "g");
const SPACE_AROUND_CJK_PUNCT = /[ \t]+(?=[、。，．）」』】〕！？：；])|(?<=[（「『【〔])[ \t]+/g;

// 行頭の「ア 」「イ 」は選択肢の記号なので、後ろの空白を残す
const LEADING_KANA_LABEL = /^([ア-コ])[ \t]+/;

export function cleanLine(text: string): string {
  const label = text.trim().match(LEADING_KANA_LABEL);
  const body = label ? text.trim().slice(label[0].length) : text;
  const cleaned = body
    .replace(/\r?\n/g, " ")
    .replace(SPACE_BETWEEN_CJK, "")
    .replace(SPACE_AROUND_CJK_PUNCT, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return label ? `${label[1]} ${cleaned}` : cleaned;
}

/** 比較専用の正規化(全角半角・空白・記号の揺れを吸収)。表示には使わない */
export function comparable(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

/** 0〜1 の類似度(レーベンシュタイン距離ベース) */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const maxLen = Math.max(a.length, b.length);
  // 長さが大きく違えば計算するまでもない
  if (Math.abs(a.length - b.length) / maxLen > 0.5) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[b.length] / maxLen;
}
