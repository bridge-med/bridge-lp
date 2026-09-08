# 便AF-3 設計(本院・精神科/心療内科) — designer

## 1. 結論(論点=診察時間の二重操作系)

**A案を採る。examMean スライダーは精神科本院では出さない。timePlan の3択が唯一の時間レバーで、examMean はそこから導出する。**

決め手は3つ。

| 根拠 | 内容 |
|---|---|
| 同じ量を二度置かない(第27条) | 本院の診察キャパは `doctors×(480/(examMean+1.5))×0.72`。両辺を掛ければ **examMean は「1日の診察分数の予算」そのもの**。timePlan も分数予算。単位違いの同じレバーを並べるのは「同じ顔の分岐」 |
| C案は物理的に不可(決定的) | スライダーは 3〜12分。精神科の主役は **30分の段**。範囲を科ごとに書き換えると共用部品が科ごとに別の意味を持つ。連続量スライダーは「時間区分=段」という制度を誤って伝える |
| 第8条・第14条は文言でなくUIで満たす | examMean を消しても判断材料は減らさない。3択の各行に **「1日に診られる目安 約N人」** を出す。これは examMean が本来担っていた情報そのもの。空室にはならない(レバーは3択が埋める) |

導出値(managementParameters から算出。数字はモジュール内1箇所に置く `mainExamMean(policy)`)

| timePlan | 平均診察分 | examMean | 診察キャパ/医師・終日 |
|---|---|---|---|
| std(30分未満が基本) | 12.0 | 12 | 約25人 |
| mix(約3割に30分以上) | 16.4 | 16 | 約19人 |
| long(全員30分以上) | 26.8 | 27 | 約12人 |

※ examMean は settings 上の数値で、スライダー範囲外でも成立する(UIを隠すので clamp されない)。examMean は満足度に直接効かず、キャパ→待ち時間経由でのみ効く(game.js 1668/2122/5110/5279 の4箇所のみ)。

**代案(採らない): B案(両方出し役割で割る)。** examMean=一般診察・timePlan=通院精神療法、と文言で割っても、両方が同じ分数予算を削り合う二重計上になる。文章で割った時点で「実装の都合を世界観に押し出した」ことになる。

### A案で見つかった副作用(要判定・重要)

分院は「長く診る→中断が減る(churnMonthly .05→.02)」。本院は「examMean 上げる→待ち時間↑→sat↓→定着↓・評判↓」。**同じレバーの符号が逆**。このままだと long は純粋に不利=選ぶ意味のない分岐(第27条違反)。
→ 本院にも定着側の応答を足す:`mod.mainLoyalty(policy)` を onDischargeDept の `loyalty`(game.js 817行)に掛ける。値は churnMonthly から導出しモジュール内に1箇所。効き幅は計測で決める(§5-3)。

---

## 2. 扉の1行(2案・editor が磨く)

主語は既存3枚と割る(整形=天井は / 内科=柱は / 眼科=単価は)。

| 案 | 文 | 字数 | 主語 |
|---|---|---|---|
| 1 | 話を聴いて診る。点数は時間の区分 | 16 | 点数は |
| 2 | 一人に長く向き合う。分かれ目は30分 | 17 | 分かれ目は |

どちらも制度上の事実のみ(通院精神療法は時間区分で点数が変わる)。後便の機能(デイケア・訪問看護等)を約束しない。

---

## 3. preset の当たり

| 項目 | 中身 |
|---|---|
| line / order / fsTitle | §2の採用案 / `4` / `精神科の届出` |
| settings | `pInj:0, pTrig:0, pPhysio:0, pReha:0, pTreat:0, rehaLevel:0, machines:0, physio:0, pts:0, rehaAides:0, dexa:false, echo:false, examMean:12`(=std の導出値。以後は timePlan 変更時に上書き) |
| policy | `{ timePlan:'std', ippanmei:true, renkei:false }` |
| shopHide | `['pt','rehaAide','machines','physio','echo','dexa','mri']`(内科・眼科と同一。beds/nurse は残す) |
| jihiHide | `['selfReha','prpOn']` — PRPは運動器の自費。**保留③**: 眼科・内科にも同時に足すか(筋は3科横断)、精神科だけか |
| actionHide | なし(連携協定は本院でも要る=加算3の要件) |
| relHide | `['sports']` のみ。school/company/caremane/rouken/houkatsu は文言差し替えで成立 |
| rel 差し替え | hospital(effect+desc: 精神科救急・退院後の通院)/ company(desc: 産業医・復職)/ school(name+effect+desc: 学校との連携)/ caremane・rouken・houkatsu(desc)。**効果の数値は既定のまま、文言だけ** |
| keywords | ①「◯◯町 心療内科」②「眠れない・気分が落ち込む」③「職場復帰 精神科」(hint の数値は内科・眼科と同一) |
| textbook | ③=単価は初再診料+通院精神療法(時間区分)+処方 / ⑥=通院は年単位、途切れないことが生涯価値 / ⑨=本体に届出必須の基準はなく、届出で増えるのは加算 / ⑩=精神保健福祉士を分院に兼務させられない / ⑫=投資は機器でなく人と時間。制度上の数値は書かない(KBのみ) |

---

## 4. 分院と同じ関数を本院で使うために足りない部品

| # | 部品 | 内容 | 無いとどうなる |
|---|---|---|---|
| 1 | `pickProfile(rand)` | patientProfiles の weight で mood/anxiety/shinshin を抽選。pr が i002/i004 の別を担う | 本院の常連に主病が付かない |
| 2 | `planVisit(p,policy,fs,rand,hasDept,equip)` | runDay 内側の抽出。戻り値に **`needMin`(この来院の診察分数)** を足す。乱数順=①long判定(`plan==='mix'` のときだけ引く)→②presc。runDay は planVisit を呼ぶ形に書き換え、同値をテストで固定 | 本院で会計経路が通らない |
| 3 | `mainExamMean(policy)` | 分数予算を本院の唯一の時間表現(examMean)へ翻訳。applyMainSpecialty と afterLeverChange の2箇所で代入 | 3択がキャパに効かない=飾り |
| 4 | `mainLoyalty(policy)` | §1の符号問題の解消。onDischargeDept の loyalty に掛ける | long が純粋に不利=選ぶ意味のない分岐 |
| 5 | 本院の精神保健福祉士 | `settings.psws` + SHOP 1行(`preset.shopAdd:['psw']`)+ `mainStaffCost` 1項 + `mainDeptShim.staff.psws` | 加算3の missing が永久に埋まらない=施設基準カードが行き止まり(第26条) |
| 6 | `deptLeverHtml` の1行を `d.isMain` で割る | 分院=「翌日へN件」/ 本院=「診られず帰ったK人」(前日 history.balked)。各3択行に「1日に診られる目安 約N人」を出す | 本院で `d.last` が無く情報行が消える(第8条の判断材料が落ちる) |

**「1回の来院」と「1日の予算」の切り方**: 来院1回=planVisit(何をするか・needMin)。1日の予算=呼び出し側(分院=runDay の budget ループ、本院=examCapDay)。眼科の planVisit/cataractDay と同型で、モジュールは日付を持たない。

### 本院 #policyCard の最終形(A案)

```
🩺 診療方針
  診察時間の方針 — 時間区分がそのまま点数になる(通院精神療法)
  [ 30分未満が基本   ○点。1日に診られる目安 約25人 ]
  [ 必要に応じて30分以上 ○点。目安 約19人 ]
  [ 全員30分以上     ○点。目安 約12人 ]
  昨日 N人・診られず帰った K人
  [連携病院と協定を結ぶ]
  [一般名処方 ON/OFF]
```

---

## 5. 現場に取ってほしい計測(着手前・数値)

1. **基準線**: 現行のまま psychiatry を本院にして Day30。1日平均 患者数 / 月商 / 平均待ち時間 / 評判 / balked。
2. **キャパ実測**: examMean=12/16/27 × 医師1・2人 × 終日/午前 の `examCapDay`(計算値と実測到達数)。
3. **符号の確認(#4-4 の効き幅を決める)**: timePlan 3値 × Day30 で、月商・平均待ち時間・評判・`G.regulars` の visits>=5 人数。**long/std の月商比**と**定着比**を出す。long が std の 60% を割るなら mainLoyalty の補正が要る。
4. **カード高さ**: #policyCard の高さ(px)を A案(3択のみ)と B案(examMean 併置)で比較。375px 幅での 3択行の折返し行数・タップ領域の高さ(44px以上)。
5. **施設基準カード**: 本院での加算3の missing 行数(psws 実装前/後)。
6. **レセプト**: 再診(通院精神療法・30分未満)で A001注8 外来管理加算の却下が1件出るか。

---

## 6. 保留(社長判断)

1. 扉の1行 — §2 の案1/案2 どちら(designer 推奨=案1。「点数は時間の区分」が制度の言い方に最も近い)。
2. 本院に「長く診るほど定着が上がる」というゲーム上の仮定を足すこと(#4-4)。足さないなら3択は成立しない。
3. `prpOn` を jihiHide に入れる範囲(精神科だけ / 眼科・内科も同時)。
