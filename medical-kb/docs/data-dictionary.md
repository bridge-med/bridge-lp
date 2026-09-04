# データ辞書

カラムの意味・型は `data/schema/schema.sql` のコメントが正。ここではファイル配置・ID規約・enumを定める。

## ファイル配置

| パス | 内容 | 性質 |
|---|---|---|
| data/manifest/sources.{rev}.json | 取得対象の一次資料マニフェスト | 手動管理。編集時は既存のインデントを保つ(全面リフォーマットは実変更を差分に埋めるため禁止=v46) |
| data/manifest/retrieval-log.json | 取得台帳(sha256・日時・使用URL) | fetch_sources.mjs が追記 |
| data/manifest/crawl-report.{rev}.json | ポータルから抽出したリンク候補 | 生成物 |
| data/sources/{rev}/** | 原典(無加工) | fetch_sources.mjs が保存・上書き禁止 |
| data/kb/common/specialties.json | 診療科マスター(年度非依存) | 手動管理 |
| data/kb/{rev}/revision.json | 改定メタ(施行日等) | 手動管理 |
| data/kb/{rev}/items.json | 診療報酬項目(編集済みKB) | 手動+抽出 |
| data/kb/{rev}/facility_standards.json | 施設基準 | 手動+抽出 |
| data/kb/{rev}/billing_rules.json | 併算定ルール | 手動+抽出 |
| data/kb/{rev}/item_specialty.json | 項目×診療科の関連 | 手動+抽出 |
| data/kb/{rev}/item_facility_standard.json | 項目×施設基準のリンク | 手動+抽出 |
| data/kb/{rev}/qa_entries.json | 疑義解釈の問答 | extract_qa.mjs が機械抽出(draft)。verified昇格のみ手動 |
| data/sources/{rev}/masters/*.zip | マスター・電子点数表の原典 | fetch/手動取得。build_dbが *_x へ展開しDBへ直接取込 |
| data/kb/{rev}/evidence.json | 根拠(資料・ページ・引用) | 手動+抽出 |
| data/kb/{rev}/scenarios/*.json | 診療シナリオ | 手動管理 |
| data/db/kb.sqlite | 派生DB | build_db.mjs が生成。コミットしない |
| data/validation-report.json | 検証結果 | validate_kb.mjs が生成 |

## ID規約

- revision: `r08`, `r10` …(令和年度の偶数年)
- items.id: `{rev}-{区分番号}` 例 `r08-A000`。同一区分の枝は `r08-A001-2` のように告示の枝番をそのまま使う。
  区分番号を持たない項目(マスターのみの行為)は `{rev}-c{診療行為コード}`
- items.id の区分内階層(v43の運用をv44で明文化): 区分番号の後ろに告示の階層を上から順にハイフンで連結する。
  項=数字(`-2`)、イ/ロ/ハ/ニ=`-i`/`-ro`/`-ha`/`-ni`、(1)(2)…=数字、注=`-n{注番号}`(例
  `r08-D215-2-ro-3` = D215の項2のロの(3))。ただし注の直下のイロハだけは既存idが数字表記で
  残っている(`r08-A001-n10-1`〜`-4` = A001注10のイ〜ニ)。新規はイロハ表記に寄せ、既存は据え置く。
  セルをさらに特定する接尾語は英語小文字(`-lipid`、`-lumbar`)
- **衝突予防(v44制定)**: 「区分内の項」と「枝番付きの別区分番号」は同じ字面になりうる
  (例: `D215-2` は「D215の項2」とも「区分番号D215-2 肝硬度測定」とも読める)。新規idを作る前に、
  その字面が別の実在区分番号(枝番付き)として読めないかを医科マスターの区分番号で確認する。
  衝突する場合、**枝番付き区分番号の側**をアンダースコアで書く(肝硬度測定を登録するなら
  `r08-D215_2`、血流予備量比CT解析なら `r08-E200_2`)。区分内の項は従来どおりハイフン。
  既存idは変更しない(ゲームコードが参照するため。`r08-E202-2` = E202の項2 は据え置き)
- 特定保険医療材料は `{rev}-t{特定器材コード}` 例 `r08-t710010929`(ダイアライザーIa型)。
  点数は「材料価格を10円で除して得た点数」(J400等)で、材料価格(円)と価格基準の別表・区分は
  conditionsとevidenceに明記する(v45制定)
- 薬剤は `{rev}-y{医薬品コード}[-数量接尾語]` 例 `r08-y620004641`(アルツ1筒)・
  `r08-y641210099-5ml`(キシロカイン1%を5mL使う想定のセル)。同一薬剤の使用量違いは数量接尾語で
  分ける。項目に `yakka_yen`(使用量あたり薬価)・`yakka_units`(マスター単位の数)・
  `yakka_formula`(G100/L200等)を持たせ、validate_kbが単価×使用量と算式で点数を検算する。
  使用量が臨床上固定でないものは「ゲーム上の仮定」とunit/conditionsに明記する(v47制定)
- facility_standards.id: `{rev}-fs-{slug}` 例 `r08-fs-undokiriha-1`
- billing_rules.id: `{rev}-rule-{連番4桁}`
- qa_entries.id: `{document_id}-q{連番}` 例 `r08-qa-20260323-q005`
- scenarios.id: `{rev}-scn-{slug}`
- evidence: entity_type + entity_id で対象レコードを指す(entity_typeは 'item' / 'facility_standard' / 'billing_rule' / 'qa_entry' / 'scenario')
- evidence.page はPDFの通し番号を基本とし、鑑(頭書)が無番で印刷面とずれる文書は
  `PDF p.3(I-2-006(2))` のように「PDF」接頭辞+条番号の明示形で書く(v45制定)

## enum

- confidence: `verified`(一次資料の実物で照合済) / `search-located`(所在のみ把握) / `draft`(構造上の下書き) / `unknown`
  - **pointsを持つitemはverified以外を許さない**(validate_kb E2)
- item_specialty.relevance: `primary` / `secondary` / `possible`
- billing_rules.rule_type: `mutually_exclusive`(併算定不可) / `same_day_ng`(同日不可) / `same_month_ng`(同月不可) / `same_week_ng`(1週間につき不可) / `simultaneous_ng`(同時不可) / `included`(包括される) / `major_only`(主たるもののみ) / `conditional`(条件付き併算定可)
- edt_haihan.haihan_type: `same_day` / `same_month` / `simultaneous` / `same_week`(背反テーブル1〜4に対応。定義は00ファイル一覧表・活用の手引き)
- edt_haihan.haihan_kbn: `1`=コード①を算定 / `2`=コード②を算定 / `3`=いずれか一方を算定
- scenario_billing.kind: `candidate`(算定候補) / `excluded`(算定不可) / `facility_req`(必要施設基準) / `note`(注意・確認論点)
- scenario_billing.status: `unresolved` / `resolved`(items.idへ解決済み。resolvedでpointsを持つにはevidenceが前提)
- documents.doc_type: `kokuji`(告示) / `tsuchi`(通知) / `jimu_renraku`(事務連絡) / `master` / `spec` / `setsumei` / `portal` / `reference`

## 記法メモ

- 様式番号の表記(v50・保留#24の決着): KBの `form_no` は原典どおり「別添2 様式◯」まで書く。
  ゲームが自前で書くプレイヤー可視文言(hint・note等)は「様式◯」の短形に統一する(先例: MRIヒント)。
  form_noは施設基準不足の却下行「必要条件(届出: …)」としてプレイヤー画面に原文のまま出るので、
  1文・40字以内を上限とし、経緯・傍証・他類型の様式はevidenceのnoteに置く
- 注の分類(v50・PM裁定): conditionsに必ず書くのは「登録した点数そのものを変える注」
  (減算・セル置換・その項目と不可分な加算)。単独で算定される加算の注は独立itemまたはruleとして
  別掲し、conditionsには「別項目として扱う」の一文だけを置く(点数の書き写しは二重管理になる)
- 引用の忠実さと表示(v57・PM裁定): KB(billing_rules/evidence)のquoteは原典の逐語(全角数字・漢数字も原文のまま)。
  ゲームpackは表示正規化(NFKC)して配信する=意味は変えない。一次資料の忠実さはKB側で担保する
- quoteの注番号は原文どおり(v58・PM裁定): 注の冒頭から起こすときは番号ごと写し、番号と本文の間は半角空白1つに揃える(例「４ 別に厚生労働大臣が…」。
  原典の字下げ・多重空白は再現しない)、ただし書き等の途中から起こすときは付けない(原文にない位置に番号を立てない)。
  validate_kbのE8は「数字+空白」で始まる本文を注番号と誤認しうる(先例: J038注6「１から３までの場合にあっては」)=誤検出時は
  source_pageの注番号と原文を突き合わせて判断する
- quoteの中略と合成(v59・編集長裁定。billing_rules.quote と evidence.quote の両方に掛かる=どちらもプレイヤーに「」付きで出る):
  quoteは原典の一箇所から連続して取れる文に限る。複数の注・項・号をつないで1本のquoteにしない(告示のどこにも無い文が「」で
  プレイヤーに出るため)。複数の注が根拠のruleは、中心となる1注だけをquoteにし、残りは source_page に注番号を残して
  condition に自分の言葉で書く。中間の省略は、一つの注・項・号の内側で、かつ省略部が残した文の意味を変えないときに限り
  「（中略）」で示す(全角括弧。「…」は使わない=原文の三点リーダと区別がつかないため。packのNFKCで表示は半角括弧になる)。
  冒頭・末尾の省略は無標。括弧の内側は原則として中略せず全文写す。ただし括弧の中身が同種の列挙(「Ａ、Ｂ、…及びＺを除く。」)で、
  先頭と末尾を残して「〜を除く。）」の枠が保たれる場合に限り「（中略）」を用いてよい(v60・編集長補正: 列挙の一部を落としても残した語の意味は
  変わらず、別表の中略と同じ理屈。先例rule-0003)。引用を括弧の手前で切って文が成立しなくなる形は採らない。
  既存分の是正: billing_rules 10本は便Z(v60・roadmap 13l)、evidence 29本(一意28)は便Z'(v61・13l②)で完了。validate_kb E9①は両方に掛かる
- rule.quoteには告示・通知の本文だけを置く(v57・PM裁定)。届出様式(用紙)の文言は evidence.json の field=condition・note に置く
- 不明は必ず null。「0」「なし」と「不明」を混同しない
- 複数値カラム(related_additions等)はJSON配列文字列
- 日付は `YYYY-MM-DD`
