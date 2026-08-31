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

- 不明は必ず null。「0」「なし」と「不明」を混同しない
- 複数値カラム(related_additions等)はJSON配列文字列
- 日付は `YYYY-MM-DD`
