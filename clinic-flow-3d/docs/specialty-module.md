# 診療科モジュールの追加方法

診療科固有ロジックは `app/specialties/` に1ファイル1科で置き、`SPECIALTIES.register()` で登録する。
整形外科(`orthopedics.js`)がReference Implementation。

## 手順

1. medical-kb側: 対象科の診療報酬項目を evidence 付きで登録し、
   `node medical-kb/scripts/build_game_pack.mjs` でゲームパックを再生成する
2. `app/specialties/<id>.js` を作成(下のモジュール規約)
3. `index.html` に `<script src="app/specialties/<id>.js"></script>` を追加(game.jsより前)
4. `status: 'basic'` で登録 → 法人タブの診療科モジュール一覧に出る。
   臨床フロー(Layer 2)を実装したら `status: 'full'`
5. エンジンテストに科のシナリオを1件追加する

## モジュール規約

| フィールド | 内容 |
|---|---|
| id / name / icon / status | 識別子・表示名・'full'/'basic' |
| patientProfiles | 患者セグメントと主要疾患 |
| workflows | 患者導線(文字列でよい。fullでは実装) |
| equipment / staffing | 必要設備・職種(表示用) |
| reimbursementMappings | ゲーム内行為ID → `{itemId(KBのid), units?}`。**制度情報をここに書かない** |
| buildProcedures(report) | 診療レポート→エンジン入力への変換 |
| facilityStandards | 科の代表的な施設基準ID(任意) |
| managementParameters | 需要・紹介元などゲーム上の仮定(制度と分離) |
| todo | 次の実装メモ(basicのみ) |

## してはいけないこと

- モジュール内に点数・施設基準の内容を書く(KB経由のみ)
- KBに無い制度項目をでっち上げる(必要ならまずmedical-kbに一次資料付きで登録)
- 他科のモジュールやgame.js本体を書き換える(共通化が必要ならregistryへ)

## 現在の実装状態

- 整形外科: full(会計・施設基準・学習モードまで統合)
- 一般内科・眼科・人工透析・在宅: basic(KB項目・患者像・導線・パラメータ骨格。
  各モジュールの `todo` に次の実装が書いてある)
- 在宅は3Dタウンを診療フィールドにする将来設計(townSites / visitPatientSchema / routeModel)を持つ
