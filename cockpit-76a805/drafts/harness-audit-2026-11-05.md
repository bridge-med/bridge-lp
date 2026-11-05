# ハーネス監査 2026-11-05 — 品質を保ったまま実行効率を上げる

対象: bridge-lp の CLAUDE.md・.claude/agents・.claude/skills・hooks(.claude/settings.json → scripts/pre-commit-gate.mjs)・scripts・cockpit-76a805/shiplog.jsonl・.github/workflows。bridge-hq は参照のみ(ハーネスは持っていない)。
この文書は監査結果と改善案。2026-11-05 に社長が P1〜P5 を承認し、同じ PR(#182)で実装した(§6 の順)。
数値はすべてこのセッションで実測したもの。記録が無い数値(トークン・実行時間)は「無い」と書き、推測で埋めていない。

## 1. 現行設計の全体像

```
依頼 → dev-loop(種別判定→理解→調査→計画→実装→自己レビュー→検査→修正→照合)
    → ship(1 機械検査 → 2 領分照合 editor/designer/qa → 3 pm 総合判定 → 4 shiplog 1行 → 5 台帳+commit → 6 実物を渡す)
    → draft PR → 社長が master へマージ → deploy.yml(Pages)
```

- 機械のゲートは1つ: PreToolUse hook(matcher: Bash)が `git commit` を含むコマンドのときだけ `check-site.mjs` を走らせ、違反なら exit 2 でブロック
- 判断のゲートは4つ: editor / designer / qa / pm(すべてサブエージェント)
- 記録は shiplog.jsonl(1出荷1行)と ledger.json(週次 bot が焼き直し)

## 2. 強み(残すもの)

1. **機械検査が本物で、速い。** check-site は HTML 160 ファイル・リンク 7,141 本を 2.4 秒で検査し、allowlist は 0 件、revert コミットは 0 件(全 1,815 コミット中)。hook は Bash 経由の `git commit` を漏らさず捕まえる(`git -C`・`cd && git commit`・`;` 連結も検査対象になることを確認)
2. **権限の線が崩れていない。** コミットはブランチ(draft PR)まで、master へのマージは社長。shiplog の「held → 社長『マージして』→ shipped」の記録が残っている
3. **リスク分岐の芽がすでにある。** ship §2 の表(「内部文書・scripts・.claude のみ → editor/designer を呼ばない」)、dev-loop の種別(bugfix は 8 を軽く、refactor は 8 省略可)、pm.md 6項(モデルの采配)。今回の3段階はこれを明文化・機械化するもので、新しい思想ではない
4. **学びが残っている。** notes に「学び」を書いた行は 72。そこから規程に昇格した例: qa の fixed 配下はみ出し走査(v46)、update-ledger の浅いクローン防止(2026-10-11)、sw.js の CACHE 版名、designer の計測の作法(v74)
5. **自動化は無料の範囲に収まっている。** Actions は Pages デプロイ・note フィード・週次台帳・週次 note 素材の4本(EAS は休眠)。外部有料サービスなし

## 3. 弱み(直すもの)

### 3-1. 品質ゲートが Claude Code の中にしかない
- master のブランチ保護: **なし**(`protected: false`。リポジトリ ruleset の有無は今回のツールでは確認できず、未検証)
- PR をトリガーにする workflow: **なし**。deploy.yml は master への push で即デプロイし、check-site を走らせない
- hook を通らない経路がある: GitHub MCP の `push_files`(ship スキル自身が「使わない」と注意書きで塞いでいる)、`git merge`・`git cherry-pick`(regex の対象外)、bot の直接 push(note フィード 284 回・daily 258 回・worklog 54 回・台帳 16 回 = 履歴の 34%)
- つまり「機械検査を通らずに本番へ出る」経路は、規程で塞いであるだけで、仕組みでは塞がっていない(第9条4号「意志の強さを前提にしない」に照らして弱い)

### 3-2. shiplog が集計できない形になっている
- スキーマが3系統に割れている: 標準(194行)/ `checks.pm` 入り(184行)/ `check-site`+`tests` キー(20行)。さらに最上位 `pm` キーが 20 行
- 値が自由記述: qa 欄の値の種類は約 50、editor 約 40、designer 約 40(「合格(sonnet。…)」など)。`verdict` が無い行 14、`"ship"`・`"note"` という値も各1
- `"n/a"` が「対象外」と「未実施」の両方を意味する(notes に「未実施」と書き添える運用。75 行)
- shiplog を読むものが無い(cockpit/index.html の参照 0、ledger は読まない)。1行の中央値 577 バイト、最大 5,649 バイト、全体 504 KB
- 実行時間・トークン使用量: **記録なし**

### 3-3. stop-hook が出荷の形を歪めている
- `verdict: held` が 212 行(53%)、`shipped` は 170 行(43%)。held のうち stop-hook に言及する行が 51、「未実施」64、「wip」20、社長待ち 19
- held の 160 行は 3 行以内に shipped が続く(同日 132・翌日以降 28)。つまり「1出荷 = held 行 + 判定行」の二重記録が常態で、「nコミットで1出荷」と書いた行が 55
- ship スキルの「stop-hook 発火時の先行コミット」節(4条件)は、この歪みを規程で吸収したもの。節自体は正しいが、記録の集計を壊している

### 3-4. 固定費が大きく、規程どおりには回っていない
- 毎回の読み込み(文字数、日本語の文字で数えたもの): CONSTITUTION 19,898 / design-system 47,541 / ia 11,375 / context 11,192 / bridge.css 21,063 / bridge.js 18,654
  - pm は「呼ばれたら CONSTITUTION 全文(未決事項・改定履歴まで)」+ ia(UI なら design-system も)を毎回読む指示: 約 31k〜79k 文字
  - designer モード A は 憲法第6・7章 + design-system + ia + bridge.css + bridge.js: 約 100k 文字
  - qa は design-system(+ ia 10章): 約 50k 文字
- 一方、実態: `checks.pm` が pass の行 47・n/a 51・無記入 214。「毎コミット pm 総合判定」の規程は半分以下しか守られていない。qa/editor/designer がすべて n/a の行は 173(43%)
- 言い換えると、現場はすでにリスクで呼ぶ相手を選んでいる。規程がそれに追いついていないので「規程違反の常態化」になっている。3段階の明文化は、規程と実務の距離を縮める

### 3-5. 学びが回帰テストに変わっていない
- 自動テストは compass(22 件・0.2 秒)と clinic-flow-3d(9 ファイル・1.2 秒)だけ。CI では一度も走っていない(workflow が無い)
- 記録された取りこぼし: 「拾えなかった/見落とし/漏れ」15 行、「公開後に」3 行。代表例は v88 の登録漏れを v94〜v98 の照合が拾えず v99.1 で直した件(2026-09-21)。対策は「qa の依頼文に『採用 ＋ を1回押す』を足す」で、テストにはなっていない
- 機械で見られるのに人が見ている項目: 見出しの句点(第19条5号。editor が 200 件精読して 4 件を見つけた記録あり)、「!」(第19条4号)、タップ領域 44px(複数の便で指摘)、sw.js の CACHE 版名の上げ忘れ
- `checks.*` に `fail` が記録された行は 4(1%)。差し戻しは起きている(notes に「差し戻し」15・「不合格」11・「回帰」14)のに、集計欄には現れない

### 3-6. 冗長な記述
- 組織表が CLAUDE.md と pm.md に二重にある。UI 変更の流れが CLAUDE.md・pm.md 3の2・dev-loop・bridge-design・designer.md の5か所に書かれている
- 完了報告の形が ship §6 と dev-loop §9 に分かれている
- bridge-hq/CLAUDE.md(2026-05 時点)は別の組織図(「本部長」)と別のデザイン規則(「Quiet Atelier」)を持つ。bridge-lp の憲法と矛盾するが、今回の対象外。auditor の議題として残す

## 4. 実測できた数値(まとめ)

| 項目 | 値 | 出典 |
|---|---|---|
| shiplog 行数 / 期間 | 398 行 / 2026-07-16〜11-01(記録のある日 57、1日の中央値 4 行、最大 41 行=08-31) | shiplog.jsonl |
| verdict | shipped 170・held 212・その他/無記入 16 | 同上 |
| held のうち stop-hook / 未実施 / wip / 社長待ち | 51 / 64 / 20 / 19 | notes の文字列 |
| held → 3行以内に shipped | 160(同日 132) | 同上 |
| 機械検査のみ(qa/editor/designer 全部 n/a) | 173 行(43%) | 同上 |
| 3領分すべて pass | 93 行(23%) | 同上 |
| checks に fail | 4 行(1%) | 同上 |
| 取りこぼしの記録 / 公開後の発覚 | 15 行 / 3 行 | notes の文字列 |
| rate limit で qa を現場が代行 | 2 行 | 同上 |
| コミット総数 / 作者 | 1,815 / Claude 1,001・bot 612・社長 202 | git log |
| 「fix・修正・回帰」を含む件名 | 244(13%) | git log |
| revert / allowlist | 0 / 0 | git log・allowlist |
| check-site / compass tests / cf3d tests | 2.4 秒 / 0.2 秒 / 1.2 秒 | 実行 |
| hook の空振りコスト(commit 以外の Bash) | 約 49 ms/回 | 実行 |
| master 保護 / PR 必須チェック | なし / なし | GitHub API |
| 直近 50 回の deploy | success 47・cancelled 3・failure 0 | Actions |
| 直近 100 PR | merged 80・open(draft)15・closed 未マージ 5 | GitHub API |
| 実行時間・トークン使用量 | 記録なし | — |

## 5. 改善の優先順位と最小実装案

原則: 新しいエージェントを増やさない。規程は足すより減らす。機械で見られるものは機械へ、判断が要るものだけ人(エージェント)へ。社長の公開判断(第34条・CLAUDE.md)と第33条の改定手続きは変えない。

### P1. 独立した品質ゲート(GitHub Actions + ブランチ保護)
- `.github/workflows/check.yml` を1本追加。トリガーは `pull_request` と `push: master`。中身は `node scripts/check-site.mjs` と `node --test compass/tests/*.test.mjs clinic-flow-3d/tests/*.test.mjs`、それに P3 の shiplog 検査。所要は 4 秒前後、公開リポジトリなので無料
- master に「status check 必須 + PR 経由」のブランチ保護を社長が設定(Settings → Rules)。bot の直接 push は bot 用の bypass を許すか、bot の push 先を PR に変えるかのどちらか。推奨は bypass(運用を変えない)
- deploy.yml は触らない(既存と重複させない)。hook は残す(手元で早く落ちる方が安い)
- 効果: hook を通らない経路(MCP push・merge・cherry-pick・bot)がすべて同じ検査を通る。第9条4号を仕組みで満たす

### P2. リスク3段階(ship §2〜3 の置き換え)
- 段階は `git diff --name-only` から機械的に決める(`scripts/ship-tier.mjs`、60 行程度)。現場が決めるのは「上げる」だけで、下げられない
  - **Light**: 差分が cockpit/・docs/・.claude/・scripts/・notes/・README・テストだけ(公開 HTML/CSS/JS に差分なし)→ 機械検査 + 自己レビュー。editor/designer/qa/pm を呼ばない。shiplog に `tier: light` で記録
  - **Standard**: 既存のページ・プロダクトの中の変更 → 機械検査 + 差分の種類で呼ぶ(文言差分 → editor、CSS/見た目差分 → designer、公開物なら qa)。pm は「どこかの領分が要修正・条件つきを返したとき」と「完成の定義が変わったとき」だけ。それ以外は現場が第34条の項目(pm.md 3 のチェックリスト)を自分で照合して記録
  - **Critical**: 新ページ・新プロダクト、NAV/PRODUCTS/sitemap、shared/bridge.*、sw.js、CONSTITUTION/design-system/ia、売上導線・legal、トップ → 現行どおり全段(着手前 pm → 全領分 → pm 総合判定 → Artifact → 社長)
- 憲法との整合: 第34条は「公開者が照合する」義務で、誰が照合するかは定めていない。Light でも機械検査(第19条の機械化分を含む)は省かない。社長の判断は Critical でも Light でも最後にある
- 期待: 実態(機械のみ 43%・pm 記録 25%)を規程に合わせる。固定費の削減幅は P3 の記録で測ってから言う(今は言わない)

### P3. shiplog v2(集計できる記録)と集計スクリプト
- 新しい行だけに適用する検査(`scripts/check-shiplog.mjs`、check-site から呼ぶ)。既存 398 行は書き換えない(履歴は履歴のまま)
- 固定する項目: `date` `tier` `scope` `checks.{machine,qa,editor,designer,pm}` は `pass|fail|n/a|skipped` のみ。`verdict` は `shipped|held|wip`(stop-hook の先行コミットは `wip`、社長待ちは `held` + `held_for: owner`)。所見は `notes` へ。任意: `pr`、`started_at`/`finished_at`(現場が ISO 時刻を書く=実行時間の代替)、`fixes`(再発なら元の行の日付)
- トークン: クラウドセッションから取れる記録が無いので欄を作らない。取れるようになったら足す
- `scripts/shiplog-stats.mjs`(80 行程度): 月別に 失敗率(checks に fail)・差し戻し率(held→shipped の組)・再発率(`fixes` 付き行)・held 率・段階ごとの件数を出す。週次台帳 workflow の末尾で走らせ、cockpit の drafts に数字だけ置く
- ship §4 の「held行→判定行の2行で1出荷」は `wip` 1行 + `shipped` 1行に単純化。「stop-hook 発火時の先行コミット」節は P1 の CI があれば4条件のうち 1(機械検査通過)と 4(master へ出ない)が仕組みで担保されるので、2 行に縮める

### P4. 学びを機械へ(Learning Loop)
- check-site に足す(それぞれ 10〜20 行、allowlist 対応): (a) ブランドの面(design-system §0 の一覧)の h1〜h3 の末尾句点と「!」(第19条4・5号)、(b) sw.js を持つディレクトリに差分があるのに sw.js の CACHE 版名が変わっていない(CI では base との比較)。(c) 44px は Playwright が要るので check-site には入れず、qa の既存項目のまま
- CI で既存テストを毎 PR 走らせる(P1 に含む)。v88 型の「ボタンの click 登録漏れ」は clinic-flow-3d のテストに1本足せるかを、次に clinic-flow-3d を触る便で見る(今回は触らない)
- 読み込みの削減: pm.md「最初にやること」を「段階に応じた条文だけ」に(Light/Standard は第4章・第8条・第19条・第30条の2・第34条 + 未決事項。全文は Critical と計画のとき)。designer の bridge.css/bridge.js 読み込みは「モード A かつ CSS 差分あり」に限定。qa は §0・§5 のみを既定に。組織表は pm.md から外して CLAUDE.md を参照
- 効果の薄い規程の見直し候補(削除ではなく縮約): ship §6 と dev-loop §9 の完了報告を1か所に。UI の流れの5重記述を CLAUDE.md 1か所 + 参照に

### P5. 小さな後始末(任意)
- weekly-note-material の「今週の出荷」から bot コミットを除く(`--author` で除外。現状は bot の feed 更新が「出荷」に混ざる)
- bridge-hq/CLAUDE.md の組織図・デザイン規則の矛盾を auditor の議題に登録(今回は触らない)

## 6. 着手の順番と規模

| 順 | 内容 | 変更ファイル | 規模 |
|---|---|---|---|
| 1 | P1 check.yml + ブランチ保護(設定は社長) | .github/workflows/check.yml(新規) | 30 行 |
| 2 | P3 shiplog 検査・集計 + ship §4 の書き換え | scripts/check-shiplog.mjs・scripts/shiplog-stats.mjs(新規)、ship/SKILL.md | 150 行 + 規程 20 行 |
| 3 | P2 段階判定 + ship §2〜3 の置き換え + CLAUDE.md 1段落 | scripts/ship-tier.mjs(新規)、ship/SKILL.md、CLAUDE.md | 60 行 + 規程 30 行 |
| 4 | P4 check-site 追加(a)(b) + pm/designer/qa の読み込み縮小 | scripts/check-site.mjs、agents/pm.md・designer.md・qa.md | 40 行 + 規程 −15 行 |
| 5 | P5 | weekly-note-material.yml | 1 行 |

1〜4 で1本の draft PR にできる(Light 段階相当: 公開 HTML/CSS/JS の差分なし)。検証は check-site と新スクリプトの実行、既存 398 行への非破壊(旧行を検査対象にしない)の確認。

## 7. 今回検証できなかったこと

- リポジトリ ruleset の有無(classic branch protection は「なし」を確認。ruleset は API を叩けず未検証)
- deploy の失敗率(直近 50 回のみ確認。全 356 回は未集計)
- 各エージェント呼び出しの実時間・トークン(記録が無い)
- editor/designer の「pass」行の指摘件数(自由記述で構造化されていない)
