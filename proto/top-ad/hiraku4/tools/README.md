# ひらく町 v4 の絵を作り直す道具

v4 の下の幕の絵は、事前に撮った止めた絵です。次のときに撮り直します。

- 町や病院の中(world.js・buildings.js・interiors.js)を変えたとき → 第2幕の断面(`img/sect-*.webp`)と、終幕の夜の島(`img/night-far-*.webp`)
- クリニックタウン3D の版が上がったとき → 第3幕の相談の画面(`img/ct3d-consult-*.webp`)と、`index.html` の「いまの版 v99.3」

準備: リポジトリのルートを `http://localhost:8097/` で配信する(例: `http-server . -p 8097 -s -c-1`)。Playwright の場所を `PW` で渡す(例: `PW=/opt/node22/lib/node_modules/playwright/index.mjs`)。

## 第2幕 病院の断面(`img/sect-*.webp`・`img/sect-day-*.webp`)

1. 昼と夕を撮る(主棟だけ・前の壁を外し屋根は残す・地と空なし。画素は 2400×2600)

   ```
   VW=2500 VH=2700 node capture.mjs hiraku4 'capture=section&id=hospital&tod=0&w=2400&h=2600&el=8&m=0.03&shadow=4096' s-0.png
   VW=2500 VH=2700 node capture.mjs hiraku4 'capture=section&id=hospital&tod=1&w=2400&h=2600&el=8&m=0.03&shadow=4096' s-1.png
   ```
   出力の `st` が、道具の画面の位置(撮った枠の %)
2. 仕上げる(3階=昼、2階と1階=夕を、床の切り口の中で継ぐ。切り口の藍を --indigo に、屋根と1階の床も藍で塗って枠を閉じ、枠の外は描かない)。藍の置き換えは、光を受けない切り口の藍そのものとその縁(2px)だけで、道具の画面の枠(`st`)の中は除く。書き出す前に、3つの画面の画素が撮った絵と同じかを確かめる(違えば止まる。`st` を渡さなくても止まる)

   ```
   python3 -I sec_post.py s-0.png s-1.png s-1.png <出力先> sect '<st の JSON>' --two
   python3 -I sec_post.py s-0.png s-0.png s-0.png <出力先> sect-day '<st の JSON>' --single
   ```
   出力の `pos`(道具の画面の位置。切り抜いた絵の %)と `rooms`(各階の部屋の左上)を、`index.html` の `.pin` と `.sect-tags li` の `--x`・`--y`・`--rx`・`--ry` に写す。1階の線は受付の人の頭の上を通すため、画面の上の端の近く(いまは 82.35)にしている

## 終幕 夜の島(`img/night-far-*.webp`)

```
VW=1700 VH=1500 node capture.mjs hiraku4 'capture=poster&tod=night&clouds=0&haze=0&w=1600&h=1440&shadow=4096' night.png
```
透明の外側を切り、幅 1200 と 800 の webp にする(雲と島の下のもやは外す。絵の四角で切れないように)

## 第3幕 クリニックタウン3D の相談の画面(`img/ct3d-consult-*.webp`)

ゲームを実際に操作して、6日目の相談(市民総合病院 地域連携室 岡部からの相談)を開いたまま撮る。写しは加工しない(切り出しだけ)。

```
OUT=<出力先> node ct3d-consult.mjs pc3 8 3    # PC 1440×900・画素比3
OUT=<出力先> node ct3d-consult.mjs sp 12 3    # スマホ 390×844・画素比2
```
- 手順はスクリプトの冒頭のとおり(5日目の相談を開いた画面のまま閉じると、6日目に回る)。相談の種類はページを開いた時刻で決まる(2つのうち1つ)ので、合うまで新しい文脈でやり直す
- PC: `pc3-raw.png`(4320×2700)の x 1230〜3090・y 840〜2700 を切り出し、1860 と 1240 の webp(`ct3d-consult-sq.webp`・`ct3d-consult-sq-1240.webp`)
- スマホ: `sp-raw.png`(780×1688)の相談の枠を 4:5(780×975)で切り出す(`ct3d-consult-sp45.webp`)
- `index.html` の figcaption の撮影日と版を直す
