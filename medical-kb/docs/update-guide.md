# 更新手順

## 0. 前提

- Node 22+(build_db.mjs は `node:sqlite` を使用。実行時のExperimental警告は無害)
- curl・unzip が使えること
- **このリポジトリの通常の開発環境(リモート実行環境)は外向きHTTPSが制限されており、
  厚労省等へ到達できない場合がある。取得作業はネットワーク許可のある環境で行う**

## 1. 原典の取得

```
node medical-kb/scripts/fetch_sources.mjs --rev r08
```

- 直URLのある文書は取得され、`data/manifest/retrieval-log.json` に sha256 が記録される
- ポータル(fetch: crawl)はHTMLを保存し、`crawl-report.r08.json` にPDF/ZIPリンク候補を列挙する。
  **リンクの採否は人が判断**し、正式URLを `sources.r08.json` の `urls` に追記して再実行する
- 取得後、**各文書の実物を開き、表題・文書番号・日付をマニフェストと照合**して
  `verified: true` に更新する。ここまでやって初めて「一次資料がある」状態になる

## 2. マスターの取込

```
unzip -o data/sources/r08/masters/master_ika_shinryokoi.zip -d data/sources/r08/masters/
node medical-kb/scripts/parse_masters.mjs --inspect --file <CSVパス>   # 列構成の確認
# マスターファイル仕様説明書と照合し scripts/config/master-layout.json を埋め、verified: true にする
node medical-kb/scripts/parse_masters.mjs --file <CSVパス> --rev r08
```

安全装置: layout が `verified: false` の間は変換されない。仕様書と照合せずに外さないこと。

## 3. 告示・通知からの構造化(人手+照合)

1. 対象項目の告示本文(点数)と留意事項通知(算定条件)を原典PDFで確認する
2. `data/kb/r08/items.json` にレコードを追加。points を入れる場合は
   `evidence.json` に document_id・page・quote(原文抜粋)を必ず追加し、`confidence: "verified"` にする
3. 併算定・包括の記述を見つけたら `billing_rules.json` へ rule_type と根拠付きで登録する
4. 施設基準は `facility_standards.json` へ。項目との対応を `item_facility_standard.json` に張る
5. 4/2の訂正事務連絡(r08-teisei-20260402)と突き合わせ、訂正対象でないか確認する

**禁止**: 記憶・二次資料(まとめサイト等)からの点数転記。二次資料は所在の手がかりにのみ使う。

## 4. 疑義解釈の追加(改定後も随時)

1. 新しい事務連絡が出たら `sources.r08.json` の documents に追記(id: `r08-qa-YYYYMMDD`)して取得
2. 問答を `qa_entries.json` へ登録し、関連項目の related_items を張る
3. 算定可否に影響する問答は billing_rules / items の条件へ反映し、evidence を張る

## 5. 検証とDB構築

```
node medical-kb/scripts/validate_kb.mjs --rev r08   # 不合格ならコミットしない
node medical-kb/scripts/build_db.mjs --rev r08      # data/db/kb.sqlite を再生成
```

python3 で構築する場合(node:sqliteが使えない環境):
`python3 -c "import sqlite3;db=sqlite3.connect('data/db/kb.sqlite');db.executescript(open('data/schema/schema.sql').read())"`
のあと、build_db.mjs 相当の投入を行う(現状はNode経路を正とする)。

## 6. 人手レビュー(機械化できない品質チェック)

- 留意事項通知の「注」の取りこぼしがないか、対象区分の通知本文を通読して確認
- 解釈が分かれる記述は、items の conditions に事実のみを書き、解釈は notes へ分離。
  確認が必要な事項は issues.md へ起票
- 重大な矛盾(告示と通知の不一致等)も issues.md へ

## 7. 次回改定(令和10年度)の追加

1. `data/manifest/sources.r10.json` を新規作成(r08のものを雛形に)
2. `data/kb/r10/` を作成し、revision.json に施行日を記載
3. r08 の revision.json の `effective_to` を r10 施行日の前日で埋める
4. 以降は本手順の1〜6と同じ。r08のデータは削除せず併存させる(履歴として保持)
