# film/passage — 15秒の映像「PASSAGE」(仮題)の制作一式

絵コンテ・規則・判断の記録は [STORYBOARD.md](STORYBOARD.md)。公開ページからは読み込まれず、NAV・sitemap にも載らない(film.html は noindex)。

## 動かし方

```sh
# 準備(リポジトリの根で一度だけ)
ln -s "$(npm root -g)" node_modules                 # playwright を使う(node_modules は .gitignore 済み)
export FFMPEG=/path/to/ffmpeg                       # libx264 と libwebp が要る(例: npm の @ffmpeg-installer/ffmpeg)

# 確認
node film/passage/render.mjs --stills 0,5.4,12.8 --outdir /tmp/stills     # 止め絵(既定 8 サンプル)
node film/passage/render.mjs --query top=1 --stills 3 --outdir /tmp/top   # 真上からの見取り図
node film/passage/render.mjs --metrics /tmp/m.json                        # 読ませる拍の数値・同時に見える写しの数

# 書き出し(film/passage/out/ に出る。out/ は .gitignore 済み)
node film/passage/render.mjs --fps 30 --samples 4 --crf 20                # 確認版(約 10 分)
node film/passage/render.mjs --samples 12                                 # 本番 60fps・12 サンプル(30〜40 分)

# 写しの撮り直し(実物のページから。加工しない)
node film/passage/capture.mjs --date 2026-09-27
```

ブラウザで見るときは、リポジトリの根を静的サーバーで配って `film/passage/film.html` を開く。

| 引数 | 効果 |
|---|---|
| `?t=5.4` | その時刻の止め絵 |
| `?top=1` | 真上からの見取り図 |
| `?compass=light` | Compass の写しをライト表示にする(判断待ち) |
| `?copy=1` | 和文の一文を入れる(判断待ち) |
| `?w=1080&h=1920` | 縦(鍵は横用のまま。縦用は未着手) |
