# BRIDGE MEDICAL — 診療報酬 Knowledge Base

日本のクリニック経営シミュレーターの基盤となる、診療報酬の構造化Knowledge Base。
現在の対象は令和8年度改定(revision: r08、施行2026-06-01・一次資料照合済み)。
将来〔患者属性×診療科×診療行為×施設基準×人員配置×算定履歴×併算定ルール〕から
「何を算定できるか/何点か/なぜか」を判定するエンジンに発展させるための土台。

**最重要原則: 一次資料主義。** 点数・算定条件・併算定可否は、一次資料の実物と照合
(evidence付き)するまでKBに入れない。validate_kb.mjs が根拠なし点数を機械的に拒否し、
parse系は仕様書照合済みレイアウト(master-layout.json)以外では動かない。

## 現在の状態(2026-08-28)

| 成果物 | 状態 |
|---|---|
| 一次資料(告示69/70/71号・保医発0305第6/7/8号・疑義解釈その1〜11・訂正連絡・チェックリスト等) | **51文書取得済み**(全件sha256台帳付き)。うち規範文書・マスター等49件は番号・日付・出所をPDF実物等で照合しverified化。残り2件は取りこぼし検出用のポータルスナップショット(照合対象外) |
| 医科診療行為マスター(11,829件)・医薬品/特定器材/コメントマスター | 取得済み。列レイアウトは仕様書で照合済み |
| 医科電子点数表(支払基金・公式機械可読ルール) | **DB取込済み**: 背反77,998 / 包括248,141 / 算定回数6,349 / 入院基本料7,047 / 補助11,829 |
| 疑義解釈 qa_entries | **710問を機械抽出**(draft・目視照合は今後。issues #7) |
| 診療報酬項目(items・evidence付き) | 11件(整形外科シナリオ解決セット)。残り4科は今後(issues #8) |
| 施設基準(運動器リハI/II/III) | 人員・面積・機器・様式番号まで通知原文引用付きで登録 |
| 診療シナリオ | 整形外科は算定スロット解決済み(点数・除外理由・根拠付き)。他4科は骨格 |
| Knowledge Pack | 整形外科に[確定]記載を反映。他4科は骨格 |

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

1. キュレーション済みitemsは11件のみ。網羅はこれから(電子点数表・マスターは全項目分DBにある)
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
