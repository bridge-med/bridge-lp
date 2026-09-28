# film/passage — 15秒の映像「PASSAGE」(仮題)の制作一式

絵コンテ・規則・判断の記録は [STORYBOARD.md](STORYBOARD.md)。公開ページからは読み込まれず、NAV・sitemap にも載らない(film.html は noindex)。

## 動かし方

```sh
# 準備(リポジトリの根で一度だけ)
ln -s "$(npm root -g)" node_modules                 # playwright を使う(node_modules は .gitignore 済み)
export FFMPEG=/path/to/ffmpeg                       # libx264 と libwebp が要る(例: npm の @ffmpeg-installer/ffmpeg)

# 確認
node film/passage/render.mjs --stills 0,5.2,12.8 --outdir /tmp/stills     # 止め絵(既定 8 サンプル)
node film/passage/render.mjs --query top=1 --stills 3 --outdir /tmp/top   # 真上からの見取り図
node film/passage/render.mjs --metrics /tmp/m.json                        # 速さ・ヨー・写し・形成のずれ(全体・藍・砂)・塗りとクリア色の画素

# 書き出し(film/passage/out/ に出る。out/ は .gitignore 済み)
node film/passage/render.mjs --fps 30 --samples 4 --crf 20                # 確認版
node film/passage/render.mjs --samples 12                                 # 本番 60fps・12 サンプル

# 写しの撮り直し(実物のページから、使っている途中の状態で。撮る範囲は開口の比例)
node film/passage/capture.mjs --date 2026-09-28
```

ブラウザで見るときは、リポジトリの根を静的サーバーで配って `film/passage/film.html` を開く。

| 引数 | 効果 |
|---|---|
| `?t=5.2` | その時刻の止め絵 |
| `?top=1` | 真上からの見取り図 |
| `?labels=1` | 写しの名前を、開口のまぐさに刻む代案(判断待ち。既定は出さない) |
| `?dbgcam=x,z,yaw` | 視点を固定して確認する(世界の座標) |
| `?pard=`・`?bld=`・`?blw=`・`?bll=`・`?blp=`・`?blh=` | 形成の調整用(腰壁の距離・格子の距離・見付け・奥行き・間隔・上端の高さ) |
| `?sandd=`・`?fixd=`・`?hider=0` | 交点の砂の板の距離・見続ける点の距離(既定は断片の奥行きの調和平均)・V の右の柱を外す |
| `?ctz=`・`?cta=`・`?tpz=`・`?hwr=` | クリニックタウン3D ののこぎり状の壁の位置と角度・チームの仕切りの壁の位置・広間の入口の右の袖 |
| `?pcw=1920` | `FILM.paintCount` を等倍で数える(既定は 480px) |
| `?dbg=1` | `window.FILM_DBG` に場面とカメラを出す(光線を当てて調べる用) |
| `?w=1080&h=1920` | 縦(視点とマークの置き場は横用のまま。縦用は未着手) |
