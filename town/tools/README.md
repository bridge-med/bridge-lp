# トップ(町)の止めた画像を撮り直す道具と、検査用の引数

トップ(ルートの `index.html`)は、立体が動かないとき・動く前・動きを減らす設定のために、事前に撮った止めた画像(`town/img/`)を使います。町や建物の中(`town/world.js`・`town/buildings.js`・`town/interiors.js`)や、到着の画の決め方(`town/live.js` の `arriveFrame`)を変えたら、変えた物が写る画像を撮り直します。画像の中の名前の札の置き場・押せる範囲・外形(`index.html` の `.hit` の `data-tag`・`data-box`・`data-nudge` と `:root` の `--cl`〜`--cb`)は、撮ったときの出力から写します。

準備: リポジトリのルートを `http://localhost:8097/` で配信する(例: `http-server . -p 8097 -s -c-1`。別の場所なら `BASE` で渡す)。Playwright の場所を `PW` で渡す(例: `PW=/opt/node22/lib/node_modules/playwright/index.mjs`)。撮る道具は訪問の計測(GoatCounter)を読まない。

撮る見え方は `index.html?capture=<種類>&…`(`town/live.js` の `capture`)で決まる。1枚ずつ撮るのは `cap.mjs`:

```
PW=… node cap.mjs '<?capture= の後ろ>' <出力.png>
```

撮るのは透明の地の PNG。webp にするときの大きさと品質は下のとおり。

## 最初の画面の町(`img/town-<時刻>[-mid][-1000].webp`)

- `poster&w=1600&h=1440&tod=<day|dusk|night>` → `town-<時刻>.webp`(PC が描く高の段。品質 72)
- `poster&w=1600&h=1440&tod=<時刻>&q=mid` → `town-<時刻>-mid.webp`(スマホが描く中の段。影 1024。品質 72)
- それぞれを 1000×900 に縮めた `-1000.webp`(品質 74)。時刻 3 × 段 2 × 幅 2 の 12 枚
- 出力の `pins` が建物ごとの名前の札(`tag`)・押せる範囲(`box`)・気づきの輪(`nudge`)・外形(`ob`)。どれも画像の %。`tag`・`box`・`nudge` を `.hit` に写す。`--cl`〜`--cb` は公園を除く7つ(6棟と広場)の `ob` を合わせた外形(左・右・上・下)

## 建物の肖像(`img/b-<建物>.webp`。パネルの建物の一覧)

- `portrait&id=<建物>&w=480&h=420&dpr=1` → 480×420(品質 80)。建物は hospital・observatory・clinic・office・library・park・atelier・plaza

## 建物の中(`img/cut-<建物>[-800].webp`。動かないときのパネル)

- `cutaway&id=<建物>&w=1200&h=900` → 地の色 (232,226,214) に重ねてから 1200×900(品質 80)と、800×600 に縮めた `-800`(品質 62)。広場にはない

## ひらいた病院(`img/open-<時刻>-<sp|pc>.webp`。舞台を止めた画像でたどるとき)

`capture-open.mjs` が時刻 3 × スマホ・PC の 6 枚を撮る(透明の地の PNG)。

```
PW=… OUT=<出力先> node capture-open.mjs
```

出力の JSON は、道具の札の置き場(`band`。その道具の階の天井の前の切り口の上で、横は物が画面に映る位置。live.js の `bandAt`)、階の印(`marks.fl`。3F・2F・1F)、正面の地面の線(`marks.gy`)。どれも画像の %。`hiraku.js` の `STILL_SP`・`STILL_PC` に写す。webp は品質 82 くらいで、大きさは変えない(スマホ 786×1448・PC 1600×1000)。

撮る見え方は `cutaway&id=hospital&arrive=1`。立体の到着の画と同じ式(`arriveFrame`)で、同じ大きさの画面(`cw`・`ch`。スマホ 393×724・PC 1440×900)の枠を求め、その2倍(PC は 1600/1440 倍)で描く:
- 視点: turn −16°・el 11°(`turn`・`el` で変えられる)
- 屋根を残し、前の壁は外し(沈んだ後)、広場の弧は消す。外枠の太い切り口つき
- 町は暗くせず、主棟のほかをその時刻の空気の色へ(`uAir` = 1)。正面の広場には人を立たせない
- 一個の物として切り出す(live.js の `mainAir`。立体の舞台と同じ): 主棟の外形に重なる物と 8px 以内に接する物のうち、手前の物と病院の主棟の外の部分(右の翼・救急口)は消し、奥と脇の物は空気の色へ .85 まで。夜は右の側面に月の光

閉じ(病院の外)は新しい止めた画像を持たない。立体が動かないとき・動きを減らす設定の閉じは、最初の画面の止めた画像を、7つの建物の外形(`--cl`〜`--cb`)が閉じの島の範囲に収まるように寄せて使い回す(`hiraku.js` の `stillClose`)。島の上の3つの札は `.hit` の `data-tag` から置く。

## 検査用の引数(ページの URL に付ける)

ふつうの人は使わない。見た目や重さを確かめるためのもので、外に出す案内には書かない。

| 引数 | すること |
|---|---|
| `?perf=1`・`#perf` | 左下に重さの表示(こまの間隔・手番の時間・品質の段・描く回数・三角形)。`window.__perf` |
| `?slow=1`・`#slow` | 低性能の端末と同じく、舞台を止めた画像でたどる |
| `?still=1` | 動きを減らす設定と同じ畳んだ区画 |
| `?static=1` | 立体に替えない(WebGL なしと同じ止めた画像のまま) |
| `?q=<high\|mid\|low>` | 立体の品質の段を決める(ふだんは端末から決め、`localStorage` の `bridge-hiraku-q` に残す) |
| `?tod=<day\|dusk\|night>` | 最初の時刻(保存したテーマ・OS の設定・見る人の時刻より先に効く) |
| `?nudge=0` | 最初の訪問の気づきの輪を出さない(撮るとき) |
| `?clock=manual` | 立体の時計を手で進める(撮って比べるとき。`window.__ctl.advance(ms)`・`scrubTo(q, true)`) |
| `?stub=1` | 建物の中を簡単な形にする(`interiors-stub.js`) |
| `?compile=<none\|split\|async>` | 立体の準備の仕方を比べる |
| `?el1=<度>`・`?turn=<度>`・`?wall=keep` | 病院ぜんたいを見る角度(既定 11)・横の面を見せる回し(既定 −16)・倒れた壁を沈めない |
| `?capture=<poster\|portrait\|cutaway\|section>&…` | 止めた画像を撮る(上の各節。`w`・`h`・`dpr`・`tod`・`q`・`id`・`t`・`clouds=0`・`haze=0`・`shadow`・`arrive`・`cw`・`ch`) |

`perf` と `slow` は `#perf`・`#slow` でも受ける(共有のページの中では `?…` がページに届かないため)。
