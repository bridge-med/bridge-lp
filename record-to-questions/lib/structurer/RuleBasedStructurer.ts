import { parseQuestions } from "../parser/questionParser";
import type { MergedLine } from "../parser/mergeOCRText";
import type { QuestionStructurer } from "./QuestionStructurer";

export class RuleBasedStructurer implements QuestionStructurer {
  readonly name = "rule-based";
  async structure(lines: MergedLine[]) {
    return parseQuestions(lines);
  }
}
