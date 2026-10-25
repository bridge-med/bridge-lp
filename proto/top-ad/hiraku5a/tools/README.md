# 案A の止めた画像を撮り直す道具

案A は、立体が動かないとき(動きを減らす設定・WebGL なし・データ節約・立体に替わる前)だけ、ひらいた病院ぜんたいの止めた画像(`img/open-<時刻>-<sp|pc>.webp`)を町の止めた画像に重ねて替えます。町や病院の中(world.js・buildings.js・interiors.js)を変えたら撮り直します。

1. リポジトリのルートを `http://localhost:8097/` で配信する(例: `http-server . -p 8097 -s -c-1`)
2. 撮る(時刻 3 × スマホ・PC の 6 枚。透明の地の PNG)

   ```
   PW=/opt/node22/lib/node_modules/playwright/index.mjs OUT=<出力先> node capture-open.mjs
   ```
   出力の JSON は、道具の画面の位置(画像の %: 左上 x0,y0 と右下 x1,y1)。`hiraku.js` の `ST_SP`・`ST_PC` に写す
3. webp にする(品質 82 くらい)。大きさは変えない(スマホ 786×1448・PC 1600×1000。`hiraku.js` の `OPEN_STILL` の w・h と同じ)

撮る見え方は live.js の capture の `cutaway` に足した引数で決める: `el`(見下ろす角。立体の「ひらいた病院ぜんたい」と同じ 30 度)・`dim`(まわりの建物を暗く)・`box=1`(倒れた壁を含めずに建物の箱で収める)・`fx0`〜`fy1`(収める範囲。ページの上の見出しと下の入口を避ける)
