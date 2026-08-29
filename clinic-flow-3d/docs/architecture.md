# クリニックタウン3D — システム構造(v33・診療報酬KB統合)

静的サイト(ビルドなし)。`<script>`直読みのモジュール群で、5レイヤーに責務を分離する。

```
Layer 1  3D Simulation      iso.js / clinic.js / town.js / walk3d.js / persona.js / staff.js
                            (見える世界: 院内・街・人・車。診療報酬を知らない)
Layer 2  Clinical Ops       game.js の患者フロー(受付→診察→検査→処置→リハ→会計)
                            (何が行われたかを決める。金額を決めない)
Layer 3  Reimbursement      app/reimbursement.js + data/kb-r08.js
         Engine             (行われた行為から算定可否・点数・理由・根拠を判定。UI/3Dから独立)
Layer 4  Management Sim     game.js のP&L・KPI・スタッフ・施設基準・法人・リーグ
Layer 5  Learning           レシートの算定詳細・学習モード・教科書・クイズ・Reimbursement Debugger
```

## データの流れ(会計1件)

```
患者レポート(Layer 2: 何をしたか)
  → 診療科モジュール(app/specialties/*)が KB項目ID列(procedures)へ変換
  → REIMB.evaluateEncounter(procedures, 施設基準, 履歴, 実施カテゴリ)
  → { billableItems(点数+根拠), rejectedItems(理由+条文引用), warnings(needs_review) }
  → game.js が売上計上・レシート描画(Layer 4/5)
```

## 原則

- **点数をUIコードに書かない**。唯一の情報源は `data/kb-r08.js`(medical-kb正規データからの生成物。
  `node medical-kb/scripts/build_game_pack.mjs` で再生成)
- **制度上の事実とゲーム上の仮定を分離する**。KB由来の行(レシートで青)は令和8年度の実点数+出典。
  KB未登録の行為(関節注の薬剤込み概算・物療等)は「概算」タグ付きで、順次KB登録して置き換える
- **KBに無いルールは補完しない**。エンジンは unknown/needs_review をwarningsで返し、ゲームは止まらない
- **エラー時フォールバック**: KBが読めない環境では従来の簡略ロジックで動作し続ける(KBI=false)

## 既存機能との関係

v32までの全機能(3D視察・ペルソナ・常連・天気・リーグ・分院・ミッション)は無変更。
変更したのは会計の点数源(ハードコード→KB)・レシートUI(詳細追加)・施設基準UI(KB要件表示)のみ。
セーブ互換: 新フィールド(settings.learnMode / settings.specialty)は未定義時デフォルトで補完。

## 告示準拠で修正したゲーム仕様(v33)

- 再診料 75点→**76点**(R8告示)
- **関節腔内注射(第6部注射)は外来管理加算を妨げない**(A001注8の列挙は検査の一部・リハ・精神・処置・
  手術・麻酔・放射線であり注射を含まない)。トリガーポイント注射・神経ブロックは第11部麻酔なので妨げる。
  旧実装は「注射全般で加算消滅」でありR8条文と不一致だったため修正(教科書⑯も更新)
