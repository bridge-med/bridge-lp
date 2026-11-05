---
name: ship
description: BRIDGEの出荷手順。コミット・公開の前に必ずこのスキルを通す。段階(Light/Standard/Critical)を機械で決め→機械検査(check-site)→段階に応じた領分の照合(editor/designer/qa)→PM総合判定→shiplog記録→台帳更新→コミット、の順で漏れなく実行する。ページ・プロダクト・文書に変更を加えてコミットしようとするとき、指示がなくても使うこと。
---

# 出荷手順

CLAUDE.mdの流れ（pm→制作→qa＋領分照合→pm総合判定→社長）の出荷部分を固定したもの。
憲法第34条（公開前照合の義務）と第9条4号（意志の強さを前提にしない）の実装である。
以下を順に実行する。段を飛ばさない。唯一の順序変更は末尾「stop-hook発火時の先行コミット」に定める。

## 0. 段階を決める

```
node scripts/ship-tier.mjs
```

変更したファイルから Light / Standard / Critical を機械的に決める（2026-11-05 社長承認）。現場が決めるのは「上げる」だけで、下げない。段階は shiplog の `tier` に書く。

| 段階 | 目安 | 呼ぶもの |
|---|---|---|
| Light | 公開 HTML/CSS/JS に差分なし（cockpit・docs・.claude・scripts・.github・notes・テスト・文書） | 機械検査 + 自己レビュー。editor/designer/qa/pm は呼ばない。第34条の項目のうち当たるもの（主に第4章）は現場が自分で照合する。動くもの（scripts・workflows）は現場が実地で動かし、結果を notes に書く |
| Standard | 既存のページ・プロダクトの中の変更 | 機械検査 + qa。文言の差分があれば editor、見た目の差分があれば designer。pm は、どこかの領分が要修正・条件つきを返したときと、完成の定義が変わったときだけ。それ以外は現場が pm.md 3 の第34条の項目を自分で照合し、notes に一言書く |
| Critical | 新ページ・新プロダクト、NAV/PRODUCTS/sitemap、`shared/`、sw.js、憲法・design-system・ia・context、legal・services・starter-kits、トップ（町）、deploy.yml | 現行どおり全段。着手前 pm → editor/designer/qa → pm 総合判定 → Artifact → 社長 |

第34条の照合はどの段階でも行う。Light でも機械検査は省かない（第19条の機械化分＝ブランドの面の見出しの句点と「!」、sw.js の版名、shiplog の形を含む）。社長の公開判断は段階に関わらず最後にある。

## 1. 機械検査

```
node scripts/check-site.mjs
```

落ちたらここで終了。違反を直してから再実行する。直せない事情がある場合のみ
`scripts/check-site.allowlist.json` に理由付きで登録し、社長への報告に含める。
同じ検査と既存テストを `.github/workflows/check.yml` が PR と master で独立に走らせる。hook を通らない経路（GitHub MCP の `push_files` 等）は使わない。CI が網を張るが、手元で落とす方が安い。

## 2. 領分の照合

`git status` と `git diff` で変更範囲を特定し、§0 の段階に従って関与するエージェントを決める。

| 変更範囲 | 呼ぶエージェント |
|---|---|
| 公開ページの文言・記事 | `editor`（第17〜20条の照合） |
| 見た目・レイアウト・UX | `designer`（ブランドの面は第21〜29条、プロダクトの画面は前提・共通の品質基準（design-system §5）・第7章の趣旨。区分は §0） |
| 公開物に触れた変更すべて（Standard・Critical） | `qa`（技術検証） |
| Light | 呼ばない。動くものは現場が実地で動かす |

各エージェントには変更範囲と段階を伝え、合否と根拠を受け取る。designer に見た目を頼むときは、幅・高さ・はみ出し・行数の数値を現場が先に取って依頼文に添える(designer は計測を起動しない=designer.md「計測の作法」)。
検証のためにファイルを一時改変させる場合は「`cp` で退避→改変→検証→退避コピーから復元」を指示する。未コミット変更を含むファイルへの `git checkout --` を復元手段に指定しない（正規の変更まで巻き戻る）。

PWA（sw.jsを持つプロダクト）に触れたら、`CACHE` の版名を上げる（上げ忘れは check-site の 9 項が落とす）。

## 3. PM総合判定

Critical は必ず `pm` に 1 と 2 の結果を渡し、第34条チェックリストに照らした総合判定（出荷可否）を受け取る。
Standard は、領分が要修正・条件つきを返したときと、完成の定義が変わったときだけ `pm` を呼ぶ。Light は呼ばない。
不合格なら差し戻し。修正後は1からやり直す。

## 4. 判定の記録

`cockpit-76a805/shiplog.jsonl` に1行追記する（1出荷=1行のJSONL）。形は `scripts/check-shiplog.mjs` が強制する（2026-11-05 以降の行。それより前は履歴のまま）。

```json
{"date":"YYYY-MM-DD","tier":"light|standard|critical","scope":"変更の一言要約","checks":{"machine":"pass|fail|n/a|skipped","qa":"…","editor":"…","designer":"…","pm":"…"},"verdict":"shipped|held|wip","held_for":"owner|review|fix|external","pr":182,"started_at":"2026-11-05T09:30:00+09:00","finished_at":"2026-11-05T10:10:00+09:00","fixes":"YYYY-MM-DD","notes":"所見・違反・allowlist登録・保留事項。なければ空文字"}
```

- `checks` の値は4語だけ。`n/a` は差分の種類から対象外（段階の規則で呼ばない領分も `n/a`）、`skipped` は対象だが未実施（wip・先行コミット）。所見は `notes` へ書き、欄に文章を書かない
- `verdict`: `shipped`＝出荷可、`held`＝止めている（`held_for` が必須。`owner`＝社長の入力待ち、`review`＝領分の再照合待ち、`fix`＝差し戻し、`external`＝外部待ち）、`wip`＝先行コミット（notes に未実施の照合を挙げる）
- `commit` は任意。空文字は「この行を含むコミット自身」。過去の出荷を指すときだけ短縮ハッシュ。`pr` は PR 番号
- `started_at` / `finished_at` は任意だが、書けるときは書く（所要時間の唯一の記録。トークンは記録できないので欄を作らない）
- `fixes` は再発の修正のとき、元の不具合を出荷した行の日付。再発率はここから数える
- 月別の集計は `node scripts/shiplog-stats.mjs`（週次の bot が `cockpit-76a805/drafts/shiplog-stats.md` に置く）

## 5. 台帳更新とコミット

```
node scripts/update-ledger.mjs
git add <変更ファイル> && git commit
```

公開（masterへのマージ・デプロイ）の最終判断は常に社長にある。

## 6. 社長に見せるものを渡す

出荷報告には、**社長がその場で見られる実物**を必ず添える。「見てください」だけで終わらせない。
2026-07-25の社長指示（「見てくださいっていう割にURLが無い。出したタイミングで見せるものを出せ。徹底して」）による恒久ルール。

- ページ・見た目の変更 → **Artifactとして発行し、URLを渡す**（第一の手段。ファイル送付は環境により開けないことがあった）。単体で動かないページは主要画面のスクリーンショット（ライト/ダーク・モバイルなど判断に必要な状態を選ぶ）。あわせてマージ後の本番URL（https://bridge-med.github.io/bridge-lp/...）を明記する
- 内部文書のみの変更 → 差分の要点を本文に書く（ファイル送付は不要）

完了報告は context.md 15章の形式で簡潔に：何を変えたか／なぜ／体験がどう変わるか／確認したこと／残課題。変更行数や技術説明だけで終わらせない。
再利用できる学び（ハマった原因、次も使えるパターン、bugfixの再発条件）があれば、shiplog の `notes` に1行で残す。学びの台帳を別ファイルに増やさない。機械で見られる学びは check-site に足すことを検討する。

これを済ませるまで、出荷報告は完了ではない。

## stop-hook発火時の先行コミット

stop-hookが未コミット変更のコミットを求めたときは、照合（2〜3）の完了を待たずにコミットしてよい。
hookと押し合う手順は第9条4号に反するため、これは例外ではなく手順の一部である。発生回数は数えない。条件は2つ。

1. 機械検査（1）を通過していること（hook と CI が強制する）。出荷物と作業中（wip）は別コミットに分け、wip はコミットメッセージに「wip・未結線（公開ページから読み込まれない）」と明示する
2. shiplog に `verdict:"wip"` の行を書き、未実施の欄を `skipped` にして、notes に未実施の照合を挙げること。照合が済んだら `shipped` の行を追記する（wip 行→shipped 行で1出荷）。wip の判定が済むまで次の便の出荷に進まない。ただし社長の入力を待つ `held`（`held_for: owner`）は次便を止めない

先行コミットが到達してよいのはブランチ（draft PR）まで。master へのマージ・公開の判断は従来どおり社長にある。
