# 選ぶ瞬間(仮題) — P3 v2 の制作一式

実物の製品ページだけで組む 15 秒の映像(1920×1080・30fps・H.264・無音)。2026-09-28 の夜の比較で作り(PR #132)、社長が v2 を採った。PR #132 そのものはマージしない。このディレクトリは v2 を作り直すのに要るものだけを master の上に移したもの。**wip・held。公開ページからは読み込まれない(NAV・サイトマップ・一覧に載せない)。**

- 絵コンテと審査の直し: `NOTES-v2.md`
- 撮影: `run2.mjs` がこのリポジトリを localhost で配り、Playwright(Chromium)で各ページを製品自身の操作で「使っている途中」まで進める。ページの時計を仮想の時計に置き換え、CDP で 1 コマずつ撮る(`engine.mjs`・`lib.mjs`)
- ショットの定義: `shots2.mjs`。S2・M1〜M5 は v1(f5)の定義を一字も変えずに持っている(PR #132 の `shots.mjs` と同一)。S5 は引きの時刻だけ変えた(2026-10-03・NOTES-v2.md「S5 の数値」)。v1 のコマを流用する代わりに、毎回この定義で撮り直す
- 署名の面: `card/index.html`。サイトのロゴ(`shared/bridge.js` の MARK と同じパス。近似の曲線・未決#7)と、`shared/bridge.css` のトークン(ライト)。撮影用で noindex
- 書き出し: `job2.sh`(撮影 → `compose67.sh`(S6→S7 のつなぎの合成)→ `assemble.sh` → `stills2.sh`)

## 作り直す(一つのコマンド)

```sh
film/choice/job2.sh            # 全 13 ショットを 1920 で撮り、合成し、out/p3-v2.mp4 と out/p3v2-t*.png を書き出す
film/choice/job2.sh v2 s4,s6   # 一部だけ撮り直す(他のショットのコマは work/frames/v2/ に残っているものを使う)
SUBMAX=1 node film/choice/run2.mjs --shots s1 --w 960 --tag probe   # 確認用の速い版(ぶれの副コマを 1 枚に)
```

- `p3-v2.mp4`(3.2MB)は 2026-10-03 に master の製品で撮り直した書き出しをコミットしたもの(同日、製品に「数値はゲーム上の仮定」を足した後に S5 だけ撮り直した)。作り直したら `out/p3-v2.mp4` を手で写す
- コマは `film/choice/work/frames/<tag>/`、mp4 と止め絵は `film/choice/out/` に出る(どちらも git の管理外)
- 要るもの: node 22、Playwright と Chromium、ffmpeg(libx264)、bc、curl(フォントと CDN のファイルを一度だけ取り、`work/netcache/` に置く)
- 環境変数: `FFMPEG`(既定は PATH の ffmpeg)、`PLAYWRIGHT_MODULE`(playwright の `index.mjs`。既定は `playwright` → `/opt/node22/lib/node_modules/playwright/index.mjs`)、`PLAYWRIGHT_BROWSERS_PATH`(既定 `/opt/pw-browsers`)、`FILM_WORK`、`FILM_OUT`
- クリニックタウン3D(S5)の経営の相談は回ごとの乱数で中身が変わる。撮り直すたびに S5 の画は変わる

## 流用ショット(v1 の絵コンテから)

| ショット | 画面(すべて実物) | カメラ |
|---|---|---|
| S2 経験の棚卸し(ダーク) | 職種「リハビリ職」、後輩指導・教育の問い「相手に合わせて、教え方を変えてみた場面はありますか」の「やったこと」。製品の入力例(data.js の同じ問いの看護師向けヒントから「例えば、」を外した文)が、日本語入力の確定の単位で 8 回に分けて入る | 7.5 倍で文の速さに合わせて右へ → 引き 2.6 倍(問いと記入欄) |
| S5 クリニックタウン3D(ライト) | 開始の扉から「1日」スキップで日を進め、経営の相談が開いたところで 2 つ目の選択肢を選ぶ。終わりの画に製品の表示「数値はゲーム上の仮定」が入る | 5.5 倍 → 引き 2.3 倍(決めること・3 つの選択肢・表示)→ 10 コマ静止 |
| M1〜M5(ライト) | 同じ点・同じ大きさで選ぶ瞬間が 5 回(6・5・4・4・4 コマ)。Compass「人に教える」/ 言いかえ帳の星「医者とリハの間に立ってた」/ Compass「成長」/ 言いかえ帳の星「カンファで発言してた」/ Compass「人を育てる仕事」。クリックから 0.12 秒後の製品自身の遷移から見せる | 静止 |
