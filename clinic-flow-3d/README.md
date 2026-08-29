# クリニックタウン3D

遊ぶだけで外来経営が身につくSimCity風シミュレーション。静的Web(ビルドなし)+PWA。
遊びの柱・出荷履歴・PM判断ログは `ROADMAP.md`、拡張計画は `docs/roadmap.md`。

## v33: 診療報酬Knowledge Base統合

会計の点数がハードコードから**令和8年度診療報酬KB(告示・通知の一次資料照合済み)**に切り替わった。

- 点数の唯一の情報源: `data/kb-r08.js`(medical-kbからの生成物。
  再生成: `node medical-kb/scripts/build_game_pack.mjs`)
- 算定可否の判定: `app/reimbursement.js`(Reimbursement Engine。UI/3Dから独立)
- 診療科モジュール: `app/specialties/`(整形外科=完全、一般内科・眼科・透析・在宅=基本構造)
- レシートの「📖 算定詳細」/「🎓 学習モード」で、算定理由・未算定の理由・条文引用・出典・
  施設基準の増収余地が見られる。`?debug=1` で評価トレース(Reimbursement Debugger)
- テスト: `node clinic-flow-3d/tests/reimbursement.test.mjs`(32件)

構造の詳細は `docs/architecture.md`、エンジン仕様は `docs/reimbursement-engine.md`、
診療科の追加方法は `docs/specialty-module.md`、データ出典は `docs/data-sources.md`。

## 開発メモ

- 出荷時は `sw.js` の `VER` を上げる(network-first PWA)
- 点数・施設基準をUIコードに書かない。KB未登録の項目は「概算」タグで明示する
- 動作確認: リポジトリルートで `python3 -m http.server` → `/clinic-flow-3d/`
