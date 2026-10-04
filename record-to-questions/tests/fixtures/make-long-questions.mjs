#!/usr/bin/env node
/**
 * 長い録画(50問)の検証用に、架空の練習問題を組み立てる。実在の問題集・過去問の転載ではない。
 * 組み合わせ問題(選択肢が「a b」「a e」…で毎問同じ)を混ぜ、似た画面が続く場合を試す。
 * 使い方: node tests/fixtures/make-long-questions.mjs > tests/fixtures/out/long-questions.json
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const base = JSON.parse(readFileSync(path.join(here, "sample-questions.json"), "utf8")).questions;
const topics = [
  "退院時要約", "診療録の電子保存", "がん登録", "DPCコーディング", "ICD-10の分類規則", "医療情報システム",
  "個人情報の保護", "病院統計", "クリニカルパス", "医療安全管理", "診療報酬請求", "医療法の病床区分",
  "感染症の届出", "死亡診断書の記載", "地域医療連携", "病歴管理委員会", "医療監査", "情報セキュリティ",
  "標準病名マスター", "電子カルテの監査証跡",
];
const verbs = ["正しいものを1つ選べ。", "誤っているものを1つ選べ。", "最も適切なものを1つ選べ。"];
const combos = ["a b", "a e", "b c", "c d", "d e"];

const questions = [];
for (let n = 1; n <= 50; n++) {
  const topic = topics[(n * 7) % topics.length];
  if (n % 4 === 0) {
    questions.push({
      n,
      text: [
        `${topic}について、次の記述のうち${verbs[n % 3]}`,
        "a 記録の作成者と日時を残す",
        "b 第三者への提供は本人の同意を原則とする",
        "c 保存期間を過ぎた記録は直ちに破棄する",
        "d 修正の履歴を残さずに上書きする",
        "e 院内の規程で運用方法を定める",
      ].join("\n"),
      choices: combos,
    });
  } else {
    const b = base[(n - 1) % base.length];
    questions.push({
      n,
      text: `【${topic}】${b.text.replace(/\n/g, "")}`.slice(0, 120),
      choices: b.choices.map((c, i) => (i === (n % 5) ? `${c}(${topic})` : c)),
    });
  }
}
process.stdout.write(JSON.stringify({ _note: "検証用に組み立てた架空の練習問題", questions }, null, 1));
