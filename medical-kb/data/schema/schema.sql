-- ============================================================
-- BRIDGE MEDICAL 診療報酬 Knowledge Base スキーマ
-- SQLite用DDL。正規データは data/kb/**/*.json であり、
-- このDBは scripts/build_db.mjs が生成する派生物(再生成可能)。
--
-- 設計原則
--  1. 年度をハードコードしない。全レコードは revisions を参照し、
--     effective_from / effective_to で適用期間を持つ
--  2. 重要データは evidence 経由で「どの資料のどこか」まで追跡できる
--  3. 資料に無い情報は埋めない。NULL = 不明。confidence で確度を明示
--  4. 複数値は JSON 文字列カラム(SQLite JSON1 で参照可能)
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---- 改定(年度)マスター --------------------------------------
CREATE TABLE IF NOT EXISTS revisions (
  id             TEXT PRIMARY KEY,       -- 'r08' / 'r10' ...
  name           TEXT NOT NULL,          -- '令和8年度診療報酬改定'
  effective_from TEXT,                   -- 'YYYY-MM-DD' 施行日
  effective_to   TEXT,                   -- 次改定の前日。現行はNULL
  notes          TEXT
);

-- ---- 原典資料レジストリ --------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id             TEXT PRIMARY KEY,       -- manifest の id と一致
  revision       TEXT REFERENCES revisions(id),
  category       TEXT,                   -- A本体/B算定/C施設基準/D疑義解釈/Eマスター/F参考
  title          TEXT NOT NULL,
  doc_type       TEXT,                   -- kokuji/tsuchi/jimu_renraku/master/spec/setsumei/portal/reference
  issuer         TEXT,
  doc_number     TEXT,                   -- '令和8年厚生労働省告示第69号' 等。未確認はNULL
  issued_date    TEXT,
  url            TEXT,
  local_path     TEXT,                   -- data/sources/ 以下の相対パス
  sha256         TEXT,
  retrieved_at   TEXT,
  status         TEXT NOT NULL DEFAULT 'not_retrieved',  -- not_retrieved/retrieved/parsed
  confidence     TEXT NOT NULL DEFAULT 'unknown',        -- verified/search-located/unknown
  notes          TEXT
);

-- ---- 根拠(全テーブル共通の追跡) ------------------------------
-- entity_type + entity_id で任意のレコードに根拠を紐づける。
-- ゲーム側の「根拠を見る」はここを辿って documents.url / local_path に到達する。
CREATE TABLE IF NOT EXISTS evidence (
  id           INTEGER PRIMARY KEY,
  entity_type  TEXT NOT NULL,            -- 'item'/'facility_standard'/'billing_rule'/'qa_entry'/'scenario'...
  entity_id    TEXT NOT NULL,
  field        TEXT,                     -- どの属性の根拠か(例: 'points')。NULL=レコード全体
  document_id  TEXT NOT NULL REFERENCES documents(id),
  page         TEXT,                     -- ページ・区分・別添などの位置
  quote        TEXT,                     -- 根拠文章(原文の抜粋)
  note         TEXT
);
CREATE INDEX IF NOT EXISTS idx_evidence_entity ON evidence(entity_type, entity_id);

-- ---- 診療報酬項目 --------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id                    TEXT PRIMARY KEY,   -- '{revision}-{区分番号}-{枝番}' 例 'r08-A000'
  revision              TEXT NOT NULL REFERENCES revisions(id),
  code                  TEXT,               -- レセ電の診療行為コード(9桁)。マスター取込で充足
  kubun_no              TEXT,               -- 区分番号 'A000' 'B001-2' 等
  name                  TEXT NOT NULL,
  short_name            TEXT,               -- 略称(マスター由来)
  category_l            TEXT,               -- 大分類(基本診療料/特掲診療料 等)
  category_m            TEXT,               -- 中分類(初・再診料/医学管理等/検査/リハビリテーション 等)
  category_s            TEXT,               -- 小分類
  points                REAL,               -- 点数。不明はNULL(0と区別する)
  unit                  TEXT,               -- '1回につき' '1日につき' '週1回' 等
  patient_scope         TEXT,               -- 算定対象患者
  conditions            TEXT,               -- 算定条件(要約テキスト。原文はevidence)
  exclusions            TEXT,               -- 除外条件
  age_condition         TEXT,               -- 年齢条件(例 '6歳未満')
  disease_condition     TEXT,               -- 疾患条件
  inpatient             INTEGER,            -- 入院で算定可 1/0/NULL不明
  outpatient            INTEGER,            -- 外来で算定可
  homecare              INTEGER,            -- 在宅で算定可
  visit_type            TEXT,               -- 'first'初診時/'revisit'再診時/'both'/NULL
  count_limit           TEXT,               -- 算定回数制限(例 '月1回' '週3回'。構造化はlimits_json)
  period_limit          TEXT,               -- 算定期間制限(例 '発症から150日')
  monthly_limit         TEXT,               -- 月単位制限
  same_day_limit        TEXT,               -- 同日算定制限
  limits_json           TEXT,               -- 制限の構造化JSON {"per":"month","max":1,...}
  package_scope         TEXT,               -- 包括対象(この項目に包括される範囲の説明)
  is_packaged_by        TEXT,               -- 包括される側の場合、包括する項目のid群(JSON配列)
  fee_for_service       INTEGER,            -- 出来高対象 1/0/NULL
  facility_standard_req INTEGER,            -- 施設基準要否 1/0/NULL
  notification_req      INTEGER,            -- 届出要否 1/0/NULL
  staffing_req          TEXT,               -- 必要人員(要約。詳細はfacility_standards)
  equipment_req         TEXT,               -- 必要設備
  record_req            TEXT,               -- 実績要件
  system_req            TEXT,               -- 体制要件
  documentation_req     TEXT,               -- 記録要件(カルテ記載等)
  patient_explain_req   TEXT,               -- 患者説明要件(文書同意等)
  related_additions     TEXT,               -- 関連する加算(JSON配列: item id or 名称)
  related_reductions    TEXT,               -- 関連する減算(JSON配列)
  transitional_measure  TEXT,               -- 経過措置
  effective_from        TEXT,
  effective_to          TEXT,
  updated_at            TEXT,
  confidence            TEXT NOT NULL DEFAULT 'unknown'  -- verified/search-located/draft/unknown
);
CREATE INDEX IF NOT EXISTS idx_items_revision ON items(revision);
CREATE INDEX IF NOT EXISTS idx_items_kubun ON items(revision, kubun_no);
CREATE INDEX IF NOT EXISTS idx_items_code ON items(code);

-- ---- 施設基準 ------------------------------------------------
CREATE TABLE IF NOT EXISTS facility_standards (
  id               TEXT PRIMARY KEY,      -- '{revision}-fs-{slug}'
  revision         TEXT NOT NULL REFERENCES revisions(id),
  name             TEXT NOT NULL,
  short_name       TEXT,
  ryo_type         TEXT,                  -- 'kihon'基本診療料/'tokkei'特掲診療料
  notification_req INTEGER,               -- 届出要否 1/0/NULL
  staffing_req     TEXT,                  -- 人員要件
  equipment_req    TEXT,                  -- 設備要件
  record_req       TEXT,                  -- 実績要件
  system_req       TEXT,                  -- 体制要件
  ict_req          TEXT,                  -- ICT要件
  training_req     TEXT,                  -- 研修要件
  reporting_duty   TEXT,                  -- 報告義務
  periodic_report  TEXT,                  -- 定期報告
  self_check       TEXT,                  -- 自己点検
  transitional     TEXT,                  -- 経過措置
  form_no          TEXT,                  -- 届出様式番号(例 '様式87の3')
  source_notice    TEXT,                  -- 根拠通知(documents.id)
  source_page      TEXT,
  effective_from   TEXT,
  effective_to     TEXT,
  updated_at       TEXT,
  confidence       TEXT NOT NULL DEFAULT 'unknown'
);

-- 診療報酬項目 ←→ 施設基準
CREATE TABLE IF NOT EXISTS item_facility_standard (
  item_id     TEXT NOT NULL REFERENCES items(id),
  fs_id       TEXT NOT NULL REFERENCES facility_standards(id),
  relation    TEXT NOT NULL DEFAULT 'required',  -- required/optional_addon(加算側)/related
  PRIMARY KEY (item_id, fs_id)
);

-- ---- 併算定ルール --------------------------------------------
CREATE TABLE IF NOT EXISTS billing_rules (
  id              TEXT PRIMARY KEY,
  revision        TEXT NOT NULL REFERENCES revisions(id),
  source_item     TEXT NOT NULL,          -- items.id または区分番号
  target_item     TEXT NOT NULL,          -- 相手方。'*'は包括範囲などの集合を表しnoteで補足
  rule_type       TEXT NOT NULL,          -- mutually_exclusive併算定不可 / same_day_ng同日不可 /
                                          -- same_month_ng同月不可 / same_week_ng週内不可 /
                                          -- simultaneous_ng同時不可 / included包括される /
                                          -- major_only主たるもののみ / conditional条件付き併算定可
  condition       TEXT,                   -- 条件(conditional等の内容)
  period          TEXT,                   -- 'same_day'/'same_month'/'same_week'/など
  priority        TEXT,                   -- major_only時にどちらを算定するかの規定
  bidirectional   INTEGER DEFAULT 1,      -- 1=双方向に効く
  source_document TEXT REFERENCES documents(id),
  source_page     TEXT,
  quote           TEXT,                   -- 根拠文章
  effective_from  TEXT,
  effective_to    TEXT,
  confidence      TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_rules_source ON billing_rules(revision, source_item);
CREATE INDEX IF NOT EXISTS idx_rules_target ON billing_rules(revision, target_item);

-- ---- レセ電マスター・医科電子点数表(機械可読一次データの取込先) ----
-- 原典: 医科診療行為マスター(診療報酬情報提供サービス) / 医科電子点数表テーブル(支払基金)。
-- build_db.mjs が data/sources/ の原典CSVから直接投入する(手で編集しない)。
-- 列の意味の根拠は scripts/config/master-layout.json とそこに記載の仕様書。

CREATE TABLE IF NOT EXISTS master_items (
  revision        TEXT NOT NULL REFERENCES revisions(id),
  code            TEXT NOT NULL,          -- 診療行為コード(9桁)
  short_name      TEXT,                   -- 省略漢字名称(レセプト表示名)
  name_kana       TEXT,
  name_official   TEXT,                   -- 基本漢字名称(告示名称に対応)
  data_kikaku_code TEXT,                  -- 数量データの単位コード
  points_kbn      TEXT,                   -- 点数識別(1金額/3点数/5%加算/6%減算 等)
  points_raw      REAL,                   -- 新又は現点数(点数識別に従って解釈する)
  inout_kbn       TEXT,                   -- 入外適用区分(0両方/1入院のみ/2入院外のみ)
  kouki_kbn       TEXT,                   -- 後期高齢者医療適用区分
  source_file     TEXT,
  PRIMARY KEY (revision, code)
);

CREATE TABLE IF NOT EXISTS edt_hojo (      -- 補助マスターテーブル(各テーブルとの連結)
  revision        TEXT NOT NULL,
  code            TEXT NOT NULL,
  short_name      TEXT,
  hokatsu_unit1   TEXT, hokatsu_group1 TEXT,
  hokatsu_unit2   TEXT, hokatsu_group2 TEXT,
  hokatsu_unit3   TEXT, hokatsu_group3 TEXT, -- 包括単位: 1=1日/2=同一月/3=同時/5=手術前1週間/6=1手術
  haihan_day      INTEGER,                -- 背反(1日につき)関連あり
  haihan_month    INTEGER,
  haihan_simul    INTEGER,
  haihan_week     INTEGER,
  nyuin_group     TEXT,                   -- 入院基本料テーブル参照グループ
  santei_kaisu_rel INTEGER,               -- 算定回数テーブル関連あり
  start_date      TEXT, end_date TEXT,
  PRIMARY KEY (revision, code)
);

CREATE TABLE IF NOT EXISTS edt_hokatsu (   -- 包括・被包括テーブル
  revision   TEXT NOT NULL,
  group_no   TEXT NOT NULL,               -- 例 'A000001'。補助マスターの包括グループから参照される
  code       TEXT NOT NULL,               -- 包括される側(被包括)の診療行為コード
  short_name TEXT,
  tokurei    INTEGER,                     -- 特例条件あり(内容は通知の本文で確認)
  start_date TEXT, end_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_hokatsu_group ON edt_hokatsu(revision, group_no);
CREATE INDEX IF NOT EXISTS idx_hokatsu_code ON edt_hokatsu(revision, code);

CREATE TABLE IF NOT EXISTS edt_haihan (    -- 背反関連テーブル(併算定不可)
  revision    TEXT NOT NULL,
  haihan_type TEXT NOT NULL,              -- same_day/same_month/simultaneous/same_week
  code1       TEXT NOT NULL,
  name1       TEXT,
  code2       TEXT NOT NULL,
  name2       TEXT,
  haihan_kbn  TEXT,                       -- 1=①を算定/2=②を算定/3=いずれか一方
  tokurei     INTEGER,
  start_date  TEXT, end_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_haihan_c1 ON edt_haihan(revision, code1);
CREATE INDEX IF NOT EXISTS idx_haihan_c2 ON edt_haihan(revision, code2);

CREATE TABLE IF NOT EXISTS edt_nyuin_kasan ( -- 入院基本料テーブル(入院基本料×加算の可否)
  revision   TEXT NOT NULL,
  group_no   TEXT NOT NULL,
  code       TEXT NOT NULL,
  short_name TEXT,
  kasan_id   TEXT,
  start_date TEXT, end_date TEXT
);

CREATE TABLE IF NOT EXISTS edt_santei_kaisu ( -- 算定回数テーブル(算定単位ごとの上限回数)
  revision   TEXT NOT NULL,
  code       TEXT NOT NULL,
  short_name TEXT,
  unit_code  TEXT,                        -- 算定単位コード(手引き付表1)
  unit_name  TEXT,                        -- '日','月','初診時' 等
  max_count  INTEGER,
  tokurei    INTEGER,
  start_date TEXT, end_date TEXT
);
CREATE INDEX IF NOT EXISTS idx_santei_code ON edt_santei_kaisu(revision, code);

-- ---- 診療科 --------------------------------------------------
CREATE TABLE IF NOT EXISTS specialties (
  id             TEXT PRIMARY KEY,        -- 'orthopedics' 等
  name_ja        TEXT NOT NULL,
  name_en        TEXT,
  priority_phase INTEGER,                 -- 1=第一段階の重点診療科
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS item_specialty (
  item_id      TEXT NOT NULL REFERENCES items(id),
  specialty_id TEXT NOT NULL REFERENCES specialties(id),
  relevance    TEXT NOT NULL,             -- primary/secondary/possible
  rationale    TEXT,                      -- 関連づけの理由
  confidence   TEXT NOT NULL DEFAULT 'draft',
  PRIMARY KEY (item_id, specialty_id)
);

-- ---- 疑義解釈 ------------------------------------------------
CREATE TABLE IF NOT EXISTS qa_entries (
  id            TEXT PRIMARY KEY,         -- '{document_id}-q{連番}'
  revision      TEXT NOT NULL REFERENCES revisions(id),
  document_id   TEXT NOT NULL REFERENCES documents(id),
  batch_label   TEXT,                     -- 'その1' 等(実物で確認できた場合のみ)
  q_no          TEXT,                     -- 問番号(例 '問5')
  section       TEXT,                     -- 別添・区分
  question      TEXT,
  answer        TEXT,
  related_items TEXT,                     -- 関連 items.id / 区分番号 のJSON配列
  page          TEXT,
  confidence    TEXT NOT NULL DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_qa_revision ON qa_entries(revision);

-- ---- 診療シナリオ --------------------------------------------
CREATE TABLE IF NOT EXISTS scenarios (
  id           TEXT PRIMARY KEY,
  revision     TEXT NOT NULL REFERENCES revisions(id),
  specialty_id TEXT REFERENCES specialties(id),
  title        TEXT NOT NULL,
  patient_json TEXT,                      -- {"age":72,"chief_complaint":"膝痛","visit":"first"}
  notes        TEXT,
  confidence   TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE IF NOT EXISTS scenario_steps (
  scenario_id TEXT NOT NULL REFERENCES scenarios(id),
  step_no     INTEGER NOT NULL,
  day_offset  INTEGER,                    -- 初診日=0
  action      TEXT NOT NULL,              -- 診療行為(臨床上の行為の記述)
  PRIMARY KEY (scenario_id, step_no)
);

CREATE TABLE IF NOT EXISTS scenario_billing (
  id           INTEGER PRIMARY KEY,
  scenario_id  TEXT NOT NULL REFERENCES scenarios(id),
  step_no      INTEGER,
  kind         TEXT NOT NULL,             -- candidate算定候補/excluded算定不可/facility_req必要施設基準/note注意
  item_id      TEXT,                      -- 解決済みならitems.id。未解決はNULL
  label        TEXT NOT NULL,             -- 項目の呼称(未解決時の手がかり)
  points       REAL,                      -- 解決済みかつ根拠ありのときのみ
  reason       TEXT,                      -- 算定可/不可の理由・注意
  status       TEXT NOT NULL DEFAULT 'unresolved',  -- unresolved/resolved
  confidence   TEXT NOT NULL DEFAULT 'draft'
);
CREATE INDEX IF NOT EXISTS idx_scen_billing ON scenario_billing(scenario_id);
