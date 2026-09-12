# 診療科モジュールの追加方法

診療科固有ロジックは `app/specialties/` に1ファイル1科で置き、`SPECIALTIES.register()` で登録する。
整形外科(`orthopedics.js`)がReference Implementation。

## 手順

1. medical-kb側: 対象科の診療報酬項目を evidence 付きで登録し、
   `node medical-kb/scripts/build_game_pack.mjs` でゲームパックを再生成する
2. `app/specialties/<id>.js` を作成(下のモジュール規約)
3. `index.html` に `<script src="app/specialties/<id>.js"></script>` を追加(game.jsより前)
4. `status: 'basic'` で登録 → 法人タブの診療科モジュール一覧に出る。
   臨床フロー(Layer 2)を実装したら `status: 'full'`
5. エンジンテストに科のシナリオを1件追加する

## モジュール規約

| フィールド | 内容 |
|---|---|
| id / name / icon / status | 識別子・表示名・'full'/'basic' |
| patientProfiles | 患者セグメントと主要疾患 |
| workflows | 患者導線(文字列でよい。fullでは実装) |
| equipment / staffing | 必要設備・職種(表示用) |
| reimbursementMappings | ゲーム内行為ID → `{itemId(KBのid), units?}`。**制度情報をここに書かない** |
| buildProcedures(report) | 診療レポート→エンジン入力への変換 |
| facilityStandards | 科の代表的な施設基準ID(任意) |
| managementParameters | 需要・紹介元などゲーム上の仮定(制度と分離) |
| todo | 次の実装メモ(basicのみ) |

### fullモジュールの追加フィールド(部門として経営可能にする)

| フィールド | 内容 |
|---|---|
| deptDefaults | 部門状態の初期値 `{staff, equip, policy}` |
| open | 開設条件 `{cost, repMin, needPlan, condDesc}` |
| staffDef | 人員UI定義 `[key, 表示名, 最小, 最大, 採用費]` の配列 |
| fsDefs | 施設基準の充足判定 `[{fsId, check(dept)→{ok, missing[]}, note}]`。内容はKBを参照し要件文を書かない |
| deptInit(dept, day) | 開設時フック(引き継ぎ患者の生成など) |
| runDay(dept, ctx, api, agg) | 日次シム本体。収益は必ず `api.evalVisit`(エンジン)か `api.approx`(概算明示)で計上 |
| deptBadge(d) | 索引行に出す方針バッジ(任意) |

### 本院候補にするための追加フィールド(開始の扉に出す・v66〜v73)

| フィールド | 内容 |
|---|---|
| main | `{ line, order, fsTitle, preset }`。あれば `SPECIALTIES.mainCandidates()` に載り、開始の扉に並ぶ(order 順)。line=扉の1行(16字目安・制度上の事実だけ・手術など後便の機能を約束しない)。fsTitle=経営タブ施設基準カード上段の見出し(既定=「{科名}の施設基準」) |
| `mainExamMean(policy)` / `mainLoyalty(policy)`(任意・v82) | 本院だけが使う導出。`mainExamMean` があると本院の `settings.examMean` を方針から導き、診察時間スライダーを出さない(精神科=通院精神療法の時間区分が唯一の時間レバー)。`mainLoyalty` は本院の再来(定着)に掛ける倍率で、分院の中断率(churnMonthly)から導く。どちらも値はモジュール内の1箇所に置く |
| main.preset | `settings`(整形専用レバーのゼロ化など。settings に上書き)/`policy`(settings.mainPolicy の初期値)/`equip`(settings.mainEquip の初期値。無ければ deptDefaults.equip)/`shopHide`(SHOPで出さない項目キー)/`actionHide`(本院では出さない actions の id。例: 眼科の手術)/`relHide`(本院では出さない営業先キー)/`rel`(営業先の name/effect/desc の科別上書き。数値は既定と同じにし文言だけ)/`keywords`(広告キーワード3本。hint の数値は既定と同じ)/`shopShow`(その科の本院にだけ出すSHOPの行。既定は出さない。例: 精神科の精神保健福祉士)/`textbook`(キホン集の科別差し替え。index→{t,b}) |
| pickProfile(rand) | 常連の主病の抽選。本院の常連レコード(G.regulars の mc/wc/lb/fb/pr)に pr を与える |
| planVisit(p, policy, fs, rand, hasDept, equip) | 1回の来院で何をするかを決める(会計はしない)。`{ report, isFirst, ... }` を返し、部門の runDay と本院の onDischargeDept が同じ経路で `DEPT.evalVisit` へ渡す。乱数を引く順を旧 runDay と同じにして同値をテストで固定する(tests/main-*.test.mjs) |
| planVisit の第7引数 env(任意・v82) | 1回の来院の決定に日付や枠の情報が要る科だけが受ける `{ day, fits(needMin) }`。精神科は day=加算の年数窓の判定、fits=1日の診察分数の予算に収まるかの判定に使い、収まらない来院は `{ deferred: true, needMin }` を返して以降の乱数を引かない(予算そのものは呼び出し側が持つ)。他科は渡さない |
| cataractOnVisit(queue, equip, rand, pr) / cataractDay(queue, equip, staff, day, api) / queueLine(q) | 日ごとのキュー(眼科の白内障パイプライン・v74)。来院1回ごとの候補化と、1日の締めの術前→手術(手術日)→術後を、部門の runDay と本院の endDay(`mainSpecialtyDay`)が同じ関数で回す。api=`{ frac, rand, visit(hist, report, label, slot), cost(yen) }`。本院のキューは `G.mainQueue`(部門の dept.queue と同形・保存・科を替えたら空)。本院の初診は分院の一見(acute)に相当させる |

本院側の状態は `settings.specialty / mainPolicy / mainFs / mainEquip` だけ。`mainDeptShim(mod)` がそれらを部門と同じ形(`{policy, fs, staff, equip, pt, isMain}`)に見せるので、`deptLeverHtml`/`deptActionsHtml`/`deptFsHtml`/`[data-dact]` は部門と共用(`deptOf(id)` が本院なら shim を返す)。
日ごとのキュー(眼科の白内障パイプライン)は per-visit の planVisit に乗らないので、本院では endDay の `mainSpecialtyDay()` が科のモジュールの日次関数(眼科=cataractDay)を呼ぶ(v74)。他科で日次キューを足すときも、同じ「モジュールの関数を部門と本院が共用する」形にする。

## してはいけないこと

- モジュール内に点数・施設基準の内容を書く(KB経由のみ)
- KBに無い制度項目をでっち上げる(必要ならまずmedical-kbに一次資料付きで登録)
- 他科のモジュールやgame.js本体を書き換える(共通化が必要ならregistryへ)

## 現在の実装状態

- 整形外科: full(本院。3D会計・施設基準・学習モードまで統合)。開始の扉1枚目
- 一般内科: full(部門+本院候補2枚目 v66。患者パネル・管理料(I)/(II)の方針・体制要件・代表レセプト)
- 眼科: full(部門+本院候補3枚目 v73=外来と検査設備投資まで。白内障の術前→手術→術後パイプラインは v74(便AF-2)で本院にも=cataractOnVisit/cataractDay を部門と共用、
  屈折×矯正視力の条件付き併算定はエンジン判定)
- 精神科・心療内科: full(部門+本院候補4枚目 v82。mainExamMean が診察時間の方針(timePlan)から本院の examMean を導出、
  mainLoyalty が分院の中断率(churnMonthly)から本院の再来倍率を導出。精神保健福祉士(psws)は本院にだけ出す shopShow 項目)
- 人工透析: full(部門。ベッド×クール×稼働率、施設区分1・導入期加算1・水質確保の
  届出ゲート、月14回/外来医学管理料月1回は患者単位でエンジン判定)
- 在宅: full(部門。タウンの患者宅地区12箇所+訪問ルート、移動時間→訪問枠、
  月2回パターンの定期訪問+在医総管、週3回制限・訪問日の往診料却下はエンジン判定)
