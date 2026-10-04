export type Choice = {
  label: string;
  text: string;
};

export type Question = {
  id: string;
  questionNumber?: number;
  questionText: string;
  choices: Choice[];
  answer?: string;
  explanation?: string;
  /** 構造化する前のOCR文字列。編集しても上書きしない */
  rawText: string;
  /** この問題の文字が読み取られたフレームのID(元画像との照合用) */
  sourceFrameIds?: string[];
};
