# BRIDGE MEDICAL — 診療報酬 Knowledge Base

日本のクリニック経営シミュレーターの基盤となる、診療報酬の構造化Knowledge Base。
現在の対象は令和8年度改定(revision: r08、施行2026-06-01・一次資料照合済み)。
将来〔患者属性×診療科×診療行為×施設基準×人員配置×算定履歴×併算定ルール〕から
「何を算定できるか/何点か/なぜか」を判定するエンジンに発展させるための土台。

**最重要原則: 一次資料主義。** 点数・算定条件・併算定可否は、一次資料の実物と照合
(evidence付き)するまでKBに入れない。validate_kb.mjs が根拠なし点数を機械的に拒否し、
parse系は仕様書照合済みレイアウト(master-layout.json)以外では動かない。

## 現在の状態

固定の件数はここに書かない(便ごとに乖離するため)。正は次の2つ:

- 登録件数と検査結果: `node medical-kb/scripts/validate_kb.mjs --rev r08` の出力(items・施設基準・併算定ルール・疑義解釈・evidenceの件数と合格/不合格)
- 一次資料の台帳と取込状況(文書数・sha256・マスター・電子点数表): `docs/data-sources.md`
- 進捗と各便の判断: `../clinic-flow-3d/docs/roadmap.md` と `../cockpit-76a805/shiplog.jsonl`

## データ構造

- 正規データ(手動キュレーション): `data/kb/common/` + `data/kb/r08/` のJSON。
  points を持つレコードは evidence(資料ID・ページ・原文引用)が必須
- 機械可読一次データ: `data/sources/r08/masters/` の原典CSV(ZIP)から
  build_db.mjs が直接 `master_items` / `edt_*` テーブルへ取込む(JSONを介さない)
- 派生DB: `data/db/kb.sqlite`(約63MB・全35万行。コミットせず数秒で再生成)
- スキーマ: `data/schema/schema.sql` / 詳細: `docs/architecture.md`・`docs/data-dictionary.md`

## 更新方法(要点。詳細は docs/update-guide.md)

```
node medical-kb/scripts/fetch_sources.mjs --rev r08   # 原典取得(新規疑義解釈の追加もここ)
node medical-kb/scripts/parse_masters.mjs --rev r08   # マスター読込の目視確認
node medical-kb/scripts/extract_qa.mjs --rev r08      # 疑義解釈の機械抽出
node medical-kb/scripts/validate_kb.mjs --rev r08     # 品質ゲート(不合格ならコミットしない)
node medical-kb/scripts/build_db.mjs --rev r08        # SQLite再生成(マスター・電子点数表込み)
```

ネットワーク要件: 実行環境の許可ドメインに mhlw.go.jp / *.mhlw.go.jp /
shinryohoshu.mhlw.go.jp / www.ssk.or.jp が必要(2026-08-28に環境設定へ追加済み)。

## 精度上の限界(必読)

1. キュレーション済みitemsは重点5科のシナリオが要る範囲に限る(件数は validate_kb の出力を正とする)。網羅はこれから(電子点数表・マスターは全項目分DBにある)
2. 疑義解釈710問は機械抽出のdraft。引用時は原典ページで確認(issues #7)
3. ポータル掲載PDF(訂正反映後版)を正とし、訂正の時系列差分は追っていない(issues #9)
4. マスターの日付系列(経過措置等)は項番対応未確定のため未使用(issues #6)
5. 背反・包括・算定回数テーブルは「レセプト審査の機械チェック水準」であり、
   通知の文章条件(留意事項)のすべてを表現しない。エンジン化では両者の併用が前提

## 今後の作業(優先順)

1. 在宅・眼科・透析・内科のシナリオ解決セットを同手順で登録(issues #8)
2. 重点5科に関わる疑義解釈の目視照合とverified昇格(issues #7)
3. 基本診療料の体制加算群(機能強化・医療DX等)と施設基準DBの拡充(告示70号・0305第7号)
4. 判定エンジンのプロトタイプ(items＋edt_haihan/hokatsu/santei_kaisuの併用判定)
5. Knowledge Pack残り4科の[確定]化、改定ポイント(概要版PDF)の反映
