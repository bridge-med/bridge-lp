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
data/sources/r08/**(原典) ── retrieval-log.json(取得台帳)
   │ parse_masters.mjs(マスターCSV。レイアウト照合済みが前提)
   │ +人手の抽出(告示・通知PDF → items/facility_standards/billing_rules/qa_entries)
   ▼
data/kb/r08/*.json(正規データ・gitで履歴管理) + data/kb/common/(診療科等の年度非依存)
   │ validate_kb.mjs(品質ゲート: 根拠なし点数の混入をここで止める)
   │ build_db.mjs
   ▼
data/db/kb.sqlite(派生物・コミットしない) → 将来のWebアプリ/エンジンが読む
```

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

## 既知の制約

- この構築環境は外向きHTTPSが組織ポリシーで制限されており、mhlw.go.jp 等へ到達できない。
  原典取得はネットワーク許可のある環境で fetch_sources.mjs を実行する(issues.md #1)
- 告示・通知PDFからの構造化抽出は自動化しきれない。PDFテキスト抽出は補助に留め、
  点数・要件の転記は人(またはAI+人の照合)が evidence 付きで行う運用とする
