# Reimbursement Engine 仕様(app/reimbursement.js)

UI・3D・ゲーム状態から独立した純粋関数群。ブラウザ(`window.REIMB`)/Node(`require`)両対応。
別プロダクトからも `data/kb-r08.js` と共に読み込めば使える。

## API

```js
REIMB.init(KB_R08)                    // KBゲームパックを注入
REIMB.evaluateEncounter(input) → result
REIMB.pointsOf(itemId) / getItem / getFacilityStandard / itemsFor(specialtyId) / docOf(docId)
REIMB.estimateFacilityStandardUplift(fsId, currentItems, usage)  // 施設基準の推定月間増収
```

### evaluateEncounter 入力

| キー | 内容 |
|---|---|
| procedures | `[{itemId, units?}]` KBのitems.id列。診療科モジュールが行為→IDに変換する |
| facilityStandards | 適用中の施設基準ID配列(届出済み/充足済み) |
| history | `{month:{id:回数}, week:{id:回数}, monthsSince:{id:月数}, firstVisitBilled}` |
| encounter | `{visitType, conditions:{条件キー:bool}, performedCategories:[]}`。performedCategoriesはKB未登録の実施行為のカテゴリ申告(例: '処置','麻酔') |

### 戻り値

`billableItems`(点数・単位・出典引用付き) / `rejectedItems`(理由・条文引用・必要施設基準) /
`totalPoints` / `totalYen`(1点=10円) / `warnings`(needs_review等) / `trace`(デバッガ用評価ログ)

## 判定の順序

1. 未知ID → warnings(unknown_item)。算定しない・止まらない
2. 施設基準ゲート(item.facilityStandards ⊆ 適用中か)
3. 構造化上限(limit: 月1回・週3回・1日6単位・月14回・年1回等) — 機械化済みのもののみ。
   per は month / week / day / visit_first / year(最終算定から12月未満は却下・v53)。
   share(id配列)があれば月・週の回数をセル横断で合算する(例: 人工腎臓の区分1/2/3ロは「人工腎臓」として月14回・v55)。
   未機械化の回数制限文言は warnings(limit_unstructured)
4. 併算定ルール — KBのrules のうち machine ヒント付きのみ機械判定:
   same_day_ng_categories / same_day_ng_items / included_categories / excl_window_months / conditional_pair /
   same_month_group(グループで月1回+同一受診内は申請順の先頭1件。scope:'visit' なら同一受診内の排他だけ・v55) /
   condition_ng_item / handled_externally(受診単位の判定が不要とKBが明記したもの。警告を出さない)。
   ヒントの無いルールは該当時に warnings(rule_unmachined)。
   部分的に機械化できない条件(例: A001注8の「厚生労働大臣が定める検査」別表)は reviewCategories として
   needs_review 警告のみ(勝手に確定しない)
5. 親項目ゲート(requires_parent) — 「所定点数に加算する」加算は、同一受診で親(本体)が算定候補に残るときだけ通す。
   他の全判定の後に評価するので、ここで却下された加算は履歴に残らず月1回・年1回の枠を消費しない(v53)

machineヒントは `medical-kb/scripts/build_game_pack.mjs` にルールID単位で定義され、
内容の根拠はKBのrules.quote(告示・通知の原文)にある。エンジン側にルール内容を書かない。

## テスト

`node clinic-flow-3d/tests/reimbursement.test.mjs`(32件)。
正常算定 / 施設基準不足・充足 / 同日併算定不可 / 包括 / 月・週・単位上限 / 6月ウィンドウ /
条件付き併算定 / 未知項目 / needs_review / 増収試算。期待値の点数はKBから読む(直書き禁止)。

## 制限(現状)

- 曖昧な回数制限・文章条件は判定しない(warnings)。対象患者・年齢・疾患条件は未実装
- 履歴はゲーム側が渡す(エンジンは状態を持たない)
- 年度はKBパック単位。改定はパック差し替え(kb-r10.js)+revisionsで対応する設計
