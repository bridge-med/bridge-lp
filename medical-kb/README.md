# BRIDGE MEDICAL — 診療報酬 Knowledge Base

日本のクリニック経営シミュレーターの基盤となる、診療報酬の構造化Knowledge Base。
現在の対象は令和8年度改定(revision: r08)。単なる点数表の転載ではなく、
将来〔患者属性×診療科×診療行為×施設基準×人員配置×算定履歴×併算定ルール〕から
「何を算定できるか/何点か/なぜか」を判定するエンジンに発展させるための土台。

**最重要原則: 一次資料主義。** 点数・算定条件・併算定可否は、厚生労働省等の一次資料の
実物と照合(evidence付き)するまでKBに入れない。この原則はスクリプトの安全装置として実装されている
(validate_kb.mjs が根拠なし点数を拒否 / parse_masters.mjs は仕様書照合前に動かない)。

## 現在の状態(2026-08-28)

| 成果物 | 状態 |
|---|---|
| 一次資料の所在マニフェスト(告示・通知・疑義解釈・マスター) | 作成済み。URL・文書番号はWeb検索由来で**実物未照合** |
| 原典(data/sources/) | **未取得**。構築環境の外向き通信制限のため(issues.md #1) |
| スキーマ・取得/解析/構築/検証スクリプト | 実装済み・動作確認済み |
| 診療報酬項目・施設基準・併算定ルールの実データ | **0件**(推測で埋めない方針のため) |
| 診療科マスター(15科)・診療シナリオ5本(整形/眼科/透析/内科/在宅) | 作成済み。算定スロットは全て未解決 |
| 診療科別Knowledge Pack(重点5科) | 骨格作成済み。[確定]記載はまだ無い |

## 何を取得するか

`data/manifest/sources.r08.json` が一覧。カテゴリは A:本体(告示・点数表) / B:算定ルール(留意事項通知) /
C:施設基準(告示・届出手続き・チェックリスト) / D:疑義解釈(事務連絡・随時追加) /
E:マスター(医科診療行為・医薬品・特定器材・コメント) / F:参考(支払基金・厚生局ポータル)。

## データ構造

- 正規データ: `data/kb/common/`(年度非依存) + `data/kb/r08/`(改定単位) のJSON。gitで差分管理
- 派生DB: `data/db/kb.sqlite`(build_db.mjsで再生成。コミットしない)
- スキーマ: `data/schema/schema.sql`(revisions / documents / evidence / items /
  facility_standards / billing_rules / specialties / item_specialty / qa_entries / scenarios ほか)
- 詳細: `docs/architecture.md`(設計) / `docs/data-dictionary.md`(ID規約・enum・配置)

## 更新方法

`docs/update-guide.md` を参照。要点:

```
node medical-kb/scripts/fetch_sources.mjs --rev r08   # 原典取得(要ネットワーク許可環境)
node medical-kb/scripts/parse_masters.mjs ...          # マスター取込(仕様書照合後)
node medical-kb/scripts/validate_kb.mjs --rev r08      # 品質ゲート
node medical-kb/scripts/build_db.mjs --rev r08         # SQLite再生成
```

疑義解釈の追加はマニフェストへの1エントリ追加で取り込める。令和10年度改定は
`data/kb/r10/` と `sources.r10.json` の並置で追加する(年度ハードコードなし)。

## 精度上の限界(必読)

1. **実データ未投入**。原典未取得のため、点数・要件・併算定の全テーブルが空。現状は「器と手順」まで
2. マニフェストの文書番号・施行日(2026-06-01)は検索由来(search-located)。実物照合前に信用しない
3. Knowledge Pack・シナリオの記述は[一般整理]と[未検証]のみで構成され、算定可否・点数を断定していない
4. 告示・通知PDFからの構造化は人手照合が前提。全自動抽出は精度上採らない
5. 未解決事項・矛盾は `issues.md` に集約(現在 open 5件)

## 今後の作業(優先順)

1. ネットワーク許可環境での原典取得と、マニフェストの実物照合(issues.md #1・#2)
2. マスター仕様書照合→医科診療行為マスター取込(items.master.json)
3. 重点5科(整形・在宅・眼科・透析・内科)の頻出項目から items / facility_standards /
   billing_rules を evidence 付きで構築、シナリオの算定スロットを解決
4. 疑義解釈のqa_entries化と関連項目への反映
5. 品質チェック(validate + 人手レビュー)→ Knowledge Packの[確定]昇格
6. 一定品質到達後、判定エンジン設計とClinic Town 3D統合の検討(別フェーズ)
