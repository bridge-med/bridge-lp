# 現在地(clinic-flow-3d)

版: `ct3d-v93`(sw.js の VER)。公開URL: https://bridge-med.github.io/bridge-lp/clinic-flow-3d/

## 主要システム

- 本院候補4科(開始の扉で選ぶ): 整形外科(v66)/一般内科(v66)/眼科(v73)/精神科・心療内科(v82)
- 法人の部門(本院候補とは別枠): 人工透析・在宅ほか
- ナビ5カテゴリ(v88): 🏥院内/👥スタッフ/🗺タウン/📊経営/📚学び(Bottom Nav)。開く日は院内 Day1・学び Day2・スタッフ/タウン Day4・経営 Day8(開く前は「Day N」)
- 導入シナリオ Day1〜7(v89): 「今日の経営」の1行目に1日1つの操作(app/ui/onboarding.js・セーブは G.onboard)。Day 8 に「ここからは自由経営」。❓ は「はじめの7日」の一覧。旧セーブには出さない
- 重要イベント(v90): 締めのモーダルは1日1つ(緊急融資>解放>改定>月間決算>週次>リーグ>特別依頼>結果。出せなかった演出は翌日へ)。「昨日の結果」カード常設。達成はバナー
- 経営判断カード(v92): 院内の打ち手/採用/大型投資/自費/アイテムの全行と分岐点の見込みが 費用/効果/リスク の3行型。数値は既存の算出値だけ(UI に点数を書かない)
- デザイン統一(v93): Level クラス lv1(各タブで最初に押す1枚・藍レール+淡藍地)/lv2(白)/lv3(枠なし)。--amber は「いま決める場所」だけ(今日の経営の現在行・分岐点の決めること)。緑=結果として良い・青=これから押す。経営タブの判断カード10枚は既定で畳む(app/ui/fold.js・開閉は保存しない)
- トップ3秒(v87): HUD 1段6値(Day/資金/来院/売上/評判/医療)・速度4ボタン(×4 以上は Day 4 から)・「今日の経営」カード(ミッション/詰まり/依頼の1〜3行・タップで該当操作へ)。通知/効果音/はじめからは ⚙
- 2レーン「まず動かす」/「根拠から読む」(v81)。説明は「📖 くわしく」でカード単位に開閉(既定はレーンに従う)
- 経営の分岐点205件(app/decisions/、分類1〜10)
- 分院の自費(v84): 本院が隠す運動器の自費メニューも、整形外科の分院があれば分院の実績として計上
- 医療(適切な算定)スコア(v41): 要件どおりの算定60+判定の保留20+理解(クイズ)20の100点満点
- 地域リーグ(町→市→県→地方→全国)・PWA(sw.js network-first、更新はVER bump)

## app/ ファイル一覧

| ファイル | 役割 |
|---|---|
| app.js | 未使用の旧プロトタイプ(index.html未読込) |
| clinic.js | 院内シム(受付→待合→診察→処置/リハ→会計) |
| decisions.js | 経営の分岐点エンジン(発生条件・選択肢評価) |
| decisions/cases-01〜10-*.js | 分岐点205件の分類別データ(採用/運用/給与/集患/患者対応/資金/連携/安全/設備/組織) |
| departments.js | 診療科部門の共通基盤(患者パネル型日次シム) |
| game.js | 本体(経済モデル・法人経営・KPI・ミッション・UI) |
| ui/events.js | 通知の部品(バナー・トースト・モーダル)と日次イベントキュー(v90)。v86 で game.js から抽出 |
| ui/dashboard.js | HUD・「今日の経営」・「昨日の結果」(v86 抽出・v87 で再設計・v90) |
| ui/nav.js | タブのナビゲーション(v86 抽出・v88 で5カテゴリ) |
| ui/onboarding.js | 導入シナリオ Day1〜7(v89) |
| ui/fold.js | カード単位の畳み(v93・経営タブ) |
| iso.js | 共有アイソメトリック描画エンジン |
| kasan.js | 体制加算の計上・届出ゲーティング |
| persona.js | 患者・関係機関・スタッフの人格生成 |
| reimbursement.js | 診療報酬エンジン(算定可否・点数・根拠) |
| specialties/registry.js | 診療科モジュール登録・本院候補の選別 |
| specialties/orthopedics.js | 整形外科(本院候補1枚目) |
| specialties/internal-medicine.js | 一般内科(本院候補2枚目・部門) |
| specialties/ophthalmology.js | 眼科(本院候補3枚目・部門) |
| specialties/psychiatry.js | 精神科・心療内科(本院候補4枚目・部門) |
| specialties/dialysis.js | 人工透析(部門) |
| specialties/homecare.js | 在宅(部門・タウン地区が診療フィールド) |
| staff.js | 現場スタッフのキャラクター |
| styles.css | スタイル一式 |
| town.js | タウンマップ(商圏・営業先) |
| walk3d.js | 3D視察モード(Three.js一人称) |
| zaisokan.js | 在医総管の単一建物人数セル選択 |

セーブキー: `clinicTown_v3`(殿堂引き継ぎは `clinicTown_prestige`)

## テスト

- `for f in clinic-flow-3d/tests/*.test.mjs; do node $f; done`(node に glob を1つで渡すと最初の1本しか走らない。reimbursement/departments/kasan/zaisokan/town-map/decisions/main-internal/main-ophtha/main-psych の9本)
- `node scripts/check-site.mjs`(リポジトリ直下)
- `node clinic-flow-3d/scripts/check-decisions.mjs`(分岐点205件の到達可能性・評価の機械検査)

## docsの役割と正誤範囲

- architecture.md・game-design.md・specialty-module.md: 実装の解説。本ファイルの現在地に追随、版番号は持たない
- ROADMAP.md・docs/roadmap.md: 履歴ログ専用。出荷当時の記述のまま(現行仕様の根拠にしない)
- docs/ux-audit-v85.md: 便AMのUX監査・改善案・実装計画(v85〜v93)
- docs/first-look-test.md: 初見テスト(便AM 完成条件⑰)の観察の型。実施は社長の人選後

## 次の一手

docs/ux-audit-v85.md の「3. 実装計画」表(v86〜v93・3PR)を参照
