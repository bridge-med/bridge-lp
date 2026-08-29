# データ辞書

カラムの意味・型は `data/schema/schema.sql` のコメントが正。ここではファイル配置・ID規約・enumを定める。

## ファイル配置

| パス | 内容 | 性質 |
|---|---|---|
| data/manifest/sources.{rev}.json | 取得対象の一次資料マニフェスト | 手動管理 |
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
- facility_standards.id: `{rev}-fs-{slug}` 例 `r08-fs-undokiriha-1`
- billing_rules.id: `{rev}-rule-{連番4桁}`
- qa_entries.id: `{document_id}-q{連番}` 例 `r08-qa-20260323-q005`
- scenarios.id: `{rev}-scn-{slug}`
- evidence: entity_type + entity_id で対象レコードを指す(entity_typeは 'item' / 'facility_standard' / 'billing_rule' / 'qa_entry' / 'scenario')

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
