# ひらく町 v5 案B の断面の絵を撮り直す

案B の「病院の中」の区画は、立体(`sect.js`)が動くまでと、動きを減らす設定・WebGL が使えないとき(`?static=1`)に、止めた絵 `img/in-{day,dusk,night}-{1200,800}.webp` を見せます。町や病院の中(`world.js`・`buildings.js`・`interiors.js`)か、`sect.js` の構図(`VIEW`・`SLAB`)と一切れの小物(`slice`)を変えたら撮り直します。

準備: リポジトリのルートを `http://localhost:8097/` で配信する(例: `http-server . -p 8097 -s -c-1`)。Playwright の場所を `PW` で渡す(例: `PW=/opt/node22/lib/node_modules/playwright/index.mjs`)。

1. 時刻ごとに撮る(透明の地。前の壁は沈みきって、中の灯りがついた姿)

   ```
   node capture.mjs 'capture=inside&tod=day&w=1200' <撮る所>/in-day.png
   node capture.mjs 'capture=inside&tod=dusk&w=1200' <撮る所>/in-dusk.png
   node capture.mjs 'capture=inside&tod=night&w=1200' <撮る所>/in-night.png
   ```
   出力の `ar` は枠の 高さ / 幅、`st` は道具の札の位置、`fl` は階の札の位置(どちらも枠の %)
2. webp にする(幅 1200 と 800)

   ```
   python3 -I in_webp.py <撮る所> ../img
   ```
3. 出力の値が変わったときだけ、ページに写す
   - `ar` → `index.html` の `:root` の `--ar`、`#inStill` の `height`(1200 × ar)と `sizes` の割る数
   - `st`・`fl` → `hiraku.js` の `IN_POS`
4. スマホ(393×724)と PC(1440×900)で、止めた絵と立体が同じ位置に重なり、札がずれないことを見る
