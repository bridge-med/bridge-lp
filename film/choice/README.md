# 選ぶ瞬間(仮題) — P3「3D をやめる」の制作一式

2026-09-28 の夜の比較で作った、実物の製品ページだけで組む 15 秒の映像です。比較と審査の結果は、社長あての報告頁(非公開の Artifact)にあります。**wip・held。公開ページからは読み込まれません。**

- 作り方と絵コンテ: `NOTES.md`(v1)、`NOTES-v2.md`(審査の直しを入れた v2)
- 撮影: `run.mjs` / `run2.mjs` がこのリポジトリを localhost で配り、Playwright で各ページを製品自身の操作で「使っている途中」まで進めます。ページの時計を仮想の時計に置き換え、CDP で 1 コマずつ撮ります(`engine.mjs`・`lib.mjs`)
- ショットの定義: `shots.mjs`(v1)、`shots2.mjs`(v2)
- 署名の面: `card/index.html`(正式ロゴの幾何と BRIDGE のトークン。撮影用で noindex)
- 書き出し: `job.sh` / `job2.sh`(撮影から mp4 まで)、`assemble.sh`、`compose67.sh`(v2 の地図からマークへの合成)、`stills.sh` / `stills2.sh`

**そのままでは動きません。** `lib.mjs` の `PAT`・`FFMPEG` と各 `.sh` の先頭のパスは、夜の作業環境(`/tmp/claude-0/...`)を指しています。動かすときはこの二つを書き換えてください。重い処理は `flock` で一つずつ回す前提です。
