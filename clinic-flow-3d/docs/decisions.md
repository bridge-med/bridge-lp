# 経営の分岐点(意思決定イベント) — 設計メモ(v70)

「相談が届く → 状況を読む → 選択肢を比較 → 方針を決める → 結果 → 振り返り → 次の判断」を、既存の経営状態に接続して回す。
ケースの書き方は `decisions-authoring.md`、ケースの一覧は `decisions-list.md`(`node clinic-flow-3d/scripts/check-decisions.mjs --write-doc` で生成)。

## 置き場所
- `app/decisions.js` — エンジン(DOM非依存。Node/ブラウザ両対応。`tests/decisions.test.mjs`)
- `app/decisions/cases-NN-*.js` — 10分類×1ファイル。ブラウザでは `DECISIONS.register()`、Nodeでは配列を export
- `game.js` の接続 — `decCtx()`(状況の読み取り)・`decisionAfterDay()`(1日の締め)・`openDecision/renderDecision/confirmDecision`(画面)・`renderDecCard()`(経営タブ)・`decSnapshot/decAskRewind`(やり直し)
- 状態は `G.dec` に置き、セーブに含める(旧セーブは `ensureState` で補完。フィールドが無ければ初期値)

## 時間と発生
- 1日=1ターン。相談は `endDay` の末尾(`G.day++` の後)で開く。開いている間は `decOpen` でシム(loop)・日送り(skipBtn/autoDay)・デイリーボーナスを止める
- 通常枠は Day 5 から。決めたら次は4〜7日後(決定論)。連続イベントは `fx.next` の日付に届き、期日が来れば最優先
- 選び方: 存在条件(`spec`/`needs`/話者) → 段階(`tier`: 1=Day5〜 2=Day20〜 3=Day45〜or分院・部門あり) → `once`/クールダウン → `cond` → 状況優先度 `prio`(0..3)を重みに足し、上位層から決定論で抽選。既出は重み0.35倍
- 条件を満たすケースが無い日は何も起きない(ゲームは止まらない)

## 数字の接続(二重計上しない)
| 効果 | 反映先 | 単位 |
|---|---|---|
| `money` | `G.money` に即時 | 円(一時費用) |
| `dailyCost` | `dayCost()` に毎日加算(`DECISIONS.dailyCost`)。負は削減。期間または恒久 | 円/日 |
| `staff` | `settings.doctors/nurses/receptionists/pts/rehaAides` を増減。日給は既存 `COSTS` で毎日計上。医師は1人・他は0人を割らない | 人 |
| `slack`(職員の余力) | `G.dec.slack` −3〜+3。`planDay` で `evExamDelta` に −0.3分/段(余力があるほど診察が速い) | 段 |
| `trust`(地域の信頼) | `G.dec.trust` −3〜+3。新患倍率 ±2%/段。正なら紹介 +0.3人/日/段 | 段 |
| `rep` / `aw` / `coins` / `rel` | 既存の評判・認知・コイン・営業関係Lv | 既存単位 |
| `newMul` / `examDelta` | 期間つきの継続効果(`G.dec.mods`)。`planDay` の新患数と診察時間に乗る | 倍率 / 分 |
| `delayed` | `G.dec.pending` に予約。`tick()` が期日に1回だけ適用し、bannerと声フィードで知らせる | — |
| `next` | `G.dec.chainDue` に予約。期日に最優先で開く | — |

## 見込みと確定
- `evaluate(case, choice, ctx, state)` が唯一の計算。選択肢を押したときの見込みも、確定時の適用も、同じ戻り値を使う
- 乱数は `(seed, ケースID, 選択肢ID, 日)` から作る(mulberry32)。表示を更新しても結果は変わらない。確率つきの結果は見込みに p と両側を出し、確定側は確定後に見せる
- `when`(条件で変わる結果)は判断時点の ctx で決まるので見込みに含めて出し、理由(`why`)も見せる。後出しの罰にしない
- `req` を満たさない選択肢は押せない(理由を表示)

## 履歴・やり直し・セーブ
- 履歴は `G.dec.log`(直近60件)。経営タブ「🔀 経営の分岐点」に、余力・信頼の今、続いている効果、あとで来る結果、判断の履歴を出す
- 確定の直前に `savePayload()` を `localStorage[clinicTown_v3_dec{n}]` に残す(直近8件)。「ここからやり直す」で、いまの進行を「控えに残して戻る」か「捨てて戻る」かを選ぶ(明示)。控えは1つ(`clinicTown_v3_keep`)で、カードから戻れる
- スナップショットには開いている相談(`G.dec.open`)が含まれるので、戻った直後に同じ相談が同じ見込みで開く(乱数は日・ケース・選択肢から決まるので整合する)
- 判断の途中でページを閉じても、再開時に同じ相談が開く
- `hardReset` はスナップショットと控えも消す

## 品質の線
- 文字量は短く(say 60字・bg 80字・note 50字・reflect 60字)。名称は正式名称。「!」を使わない。題に句点を付けない
- 制度の数値・要件は創作しない。必要なら架空の経営上の条件として書く。法令・医療上の違反を利益との交換として勧めない
- 「常に真ん中が正解」「お金を使えば有利」「話し合えば全部良くなる」にならないよう、`when` と `chance` と `req` で状況依存にする
