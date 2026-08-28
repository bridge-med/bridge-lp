# 設計 — BRIDGE MEDICAL 診療報酬 Knowledge Base

## 目的と位置づけ

クリニック経営シミュレーター(将来のClinic Town 3D)の基盤となる、令和8年度診療報酬の構造化KB。
最終的に〔患者属性×診療科×診療行為×施設基準×人員配置×算定履歴×併算定ルール〕から
「何を算定できるか/何点か/なぜか」を判定する診療報酬エンジンへ発展させる。
このフェーズはゲームを作らず、信頼できる知識基盤のみを作る。

## 最重要原則(実装に埋め込んだもの)

1. **一次資料主義** — 点数・要件・併算定可否は一次資料の照合なしにKBへ入れない。
   - validate_kb.mjs が「evidenceなしの点数」「verified以外のconfidenceの点数」をエラーにする
   - parse_masters.mjs は列マッピングが仕様書照合済み(verified: true)になるまで動かない
2. **根拠追跡** — 重要データは evidence テーブル経由で documents(資料レジストリ)の
   URL/ローカル原本/ページ/引用文まで辿れる。「根拠を見る」ボタンの実装前提
3. **年度非依存** — 年度は revisions テーブルと revision キーで管理。
   ファイルも data/kb/r08/ のように改定単位で分割し、r10 追加時は並置する
4. **原典無加工** — data/sources/ は取得したまま保存。加工結果は data/kb/(正規・手動含む)と
   data/db/(派生・再生成可能)に分離

## データフロー

```
sources.r08.json(取得マニフェスト)
   │ fetch_sources.mjs(curl経由・sha256記録・原典無加工保存)
   ▼
data/sources/r08/**(原典PDF/ZIP) ── retrieval-log.json(取得台帳)
   │
   ├─ 人手の照合・抽出(告示・通知PDF → items/facility_standards/billing_rules + evidence)
   │      → data/kb/r08/*.json(正規データ・gitで履歴管理・根拠引用必須)
   ├─ extract_qa.mjs(疑義解釈PDF → qa_entries.json。機械抽出・draft)
   │
   │ validate_kb.mjs(品質ゲート: 根拠なし点数・マスター不一致をここで止める)
   │ build_db.mjs ──(lib/edt.mjs: マスターZIP・電子点数表CSVを直接取込)
   ▼
data/db/kb.sqlite(派生物・コミットしない・数秒で再生成)
  ├ 正規データ由来: items / facility_standards / billing_rules / qa_entries / evidence / scenarios
  └ 原典CSV直接取込: master_items(11,829) / edt_hojo / edt_hokatsu(包括248,141) /
                     edt_haihan(背反77,998) / edt_nyuin_kasan / edt_santei_kaisu(6,349)
```

機械可読の一次データ(マスター・医科電子点数表)は JSON を介さず原典CSV→DBへ直接投入する。
列の意味は scripts/config/master-layout.json に仕様書照合の根拠付きで固定してある。

## なぜJSONを正規、SQLiteを派生にしたか

- 差分レビュー可能(点数1つの変更もPRで見える)。根拠のない変更の混入をレビューで防げる
- 静的サイト構成(このリポジトリ)と親和。Webアプリからは JSON を直接 fetch でも、SQLite(sql.js等)でも使える
- DBスキーマ変更時も schema.sql + build_db.mjs の再実行で全量再構築できる

## 併算定エンジンへの発展の道筋

billing_rules は「source_item × target_item × rule_type(排他/同日/同月/包括/主たるのみ/条件付き) × period × 根拠」の
独立テーブル。判定エンジンは〔算定候補集合 → 施設基準フィルタ(item_facility_standard) →
併算定ルール適用(rules) → 患者属性・履歴フィルタ(items の条件列+limits_json)〕の順で絞り込む設計を想定。
条件式の完全な形式化(limits_json のスキーマ確定)は、実データを一定量入れてから帰納的に決める(早すぎる抽象化を避ける)。

## 既存BRIDGEとの関係

- 全ファイルを `medical-kb/` 配下に隔離。共有基盤(shared/)・NAV・既存プロダクトには一切触れない
- 公開ページは作らない(サイトIAに影響なし)。プロダクト化する段階で products/ 登載を別途判断
- リポジトリの機械検査(scripts/check-site.mjs)はHTMLのみ対象のため干渉しない

## 併算定判定の二層構造(重要)

- **機械層**: 電子点数表(edt_haihan/edt_hokatsu/edt_santei_kaisu)は支払基金が公式に
  配布するレセプト審査水準の機械可読ルール。全診療行為ペアの背反(1日/同一月/同時/1週間)、
  包括グループ、算定単位別上限回数を持つ
- **文章層**: 留意事項通知・告示の「注」による条件(対象患者・起算日・体制等)は
  機械層に無い。curated billing_rules / items.conditions に evidence 付きで積む
- 判定エンジンは両層の AND で判定する設計(機械層で除外→文章層で条件判定)

## 既知の制約

- ネットワーク: 実行環境の許可ドメインに mhlw.go.jp / *.mhlw.go.jp /
  shinryohoshu.mhlw.go.jp / www.ssk.or.jp が必要(2026-08-28に環境設定へ追加済み)
- 告示・通知PDFからの構造化抽出は自動化しきれない。点数・要件の転記は
  人(またはAI+人の照合)が evidence 付きで行う運用とする(疑義解釈の機械抽出はdraft扱い)
