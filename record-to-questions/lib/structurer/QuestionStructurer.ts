import type { MergedLine } from "../parser/mergeOCRText";
import type { ParseResult } from "../parser/questionParser";

/**
 * OCR の生テキスト → Question[] の差し替え口。OCR とは切り離してある。
 *
 * AI(LLM)で整形する実装を足す場合の約束:
 * - してよいこと: OCR の誤字修正、不自然な改行の修正、問題番号・選択肢の認識、問題単位への分割
 * - してはいけないこと: 問題文・選択肢の内容の書き換え、正解・解説の創作(画面にないものは空のまま)
 * - rawText は OCR の文字列をそのまま入れる(AI の出力で上書きしない)
 * - 外部 API に送る実装は利用者データを外へ出す変更なので、既定にせず明示的に有効化する
 */
export interface QuestionStructurer {
  readonly name: string;
  structure(lines: MergedLine[]): Promise<ParseResult>;
}
