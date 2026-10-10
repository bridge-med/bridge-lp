# 交差 — 制作ノート(about「名前の由来」の版)

一点から生まれた筆の軌跡が、すべてロゴの二本の線に収束する 15 秒のモーショングラフィックス(60fps・H.264・無音)。交差するが接続しない(第24条)=BRIDGE という名前の由来そのもの。2026-10-04 の 20 秒版(PR #143・held)を、2026-10-09 の社長指示「3か所に映像を」と designer の条件で作り直し、**about(`about/index.html`)の「The Name — 名前の由来」の節の、橋の弧の図(`.name-fig`)を置き換えて置いた**(2026-10-10)。

20 秒版からの変更(designer 2026-10-09 の条件):

- **地の転換をやめた**。夜→生成りの転換は退けた「夜明け」の世界観を呼び戻し、ライトでは 2 本目の夜の面になる。ページ用は §2 に従い、ライトは生成り(`--bg`)のまま、ダークは夜(`--bg`)のまま。周辺を沈める vignette も外して平らな `--bg` にした(§1・§4。designer 2026-10-10)
- **20 秒 → 15 秒**。流れの立ち上がり(2.2〜5.2 秒)・見出し(6.3〜9.8 秒)・収束(9.0〜12.6 秒)・ロゴと署名(11.9〜13.5 秒)・静止(13.5〜15.0 秒=1.5 秒)
- **見出しはこのページの言葉**。「分かれてしまったものの間に、橋を架ける」(about の stmt と同じ。20 秒版の「その経験に、次の可能性を」はトップの言葉なので使わない)。wide は一行、tall は本文と同じ二行
- **版はテーマ × 画角の 4 本**(`{light,dark}-{wide,tall}.mp4`)とポスター 4 枚(`.webp`・15.0 秒の完成形=ロゴと署名)。wide=1920×1080、tall=1080×1350(文字とロゴは 0.75 倍。re + habilis と同じ)
- 色はトークンの値だけ。ライト: 奥 `--blue-soft`・中 `--blue`・手前と収束の藍 `--navy`(=`--mark-line`)・砂 `--dawn`。ダーク: 奥 `--blue-soft`・中 `--blue`・手前と収束の藍 `--ink`(=`--mark-line` のダーク)・砂 `--dawn` のダーク値。文字は `--ink`、署名の EXPAND CHOICES. は `--ink-2`
- 書体は第23条の役割: 見出し=明朝(Shippori Mincho B1 600・wide 64px / tall 52px)、署名=Inter

## 書き出し

```sh
D=showreel/kousa; M=/tmp/kousa-master
for th in light dark; do for ly in wide tall; do
  node showreel/render.mjs --page $D/reel.html --query "theme=$th&layout=$ly" --fps 30 --samples 4 --noaudio 1 --crf 23 --out $M/$th-$ly.mp4   # 原板
  node showreel/render.mjs --page $D/reel.html --query "theme=$th&layout=$ly" --stills 14.9 --samples 1 --outdir /tmp/kousa-$th-$ly
  ffmpeg -y -i /tmp/kousa-$th-$ly/t14.900.png -c:v libwebp -quality 88 -compression_level 6 $D/$th-$ly.webp
done; done
# ページ用(1版 2MB 以下・§4): wide は 1440×810・crf 32、tall は 900×1126・crf 31 に再圧縮
for th in light dark; do
  ffmpeg -y -i $M/$th-wide.mp4 -vf scale=1440:-2:flags=lanczos -c:v libx264 -preset slow -crf 32 -x264-params aq-mode=3:aq-strength=1.2 -pix_fmt yuv420p -profile:v high -tune animation -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart $D/$th-wide.mp4
  ffmpeg -y -i $M/$th-tall.mp4 -vf scale=900:-2:flags=lanczos  -c:v libx264 -preset slow -crf 31 -x264-params aq-mode=3:aq-strength=1.2 -pix_fmt yuv420p -profile:v high -tune animation -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart $D/$th-tall.mp4
done
```

- 要るもの: node 22、playwright(chromium)、ffmpeg(libx264・libwebp)。`playwright` がリポジトリの `node_modules` から見つからないときは `ln -s /opt/node-tools/node_modules/playwright node_modules/playwright`
- 容量(B-21・§4「1版 2MB 以下」): 筆の軌跡は絵の情報量が多く、1800 粒・60fps・crf 20 では 1 版 14MB だった。粒を 1200 に減らし、30fps(シャッター 180° のぼけは fps に対して相対)、原板 crf 23 から wide 1440×810・crf 32、tall 900×1126・crf 31 に再圧縮して、wide 1.67〜1.82MB・tall 1.77〜1.88MB。ポスターは原寸(1920×1080 / 1080×1350)の webp

## 絵コンテ(確定値・秒)

| 秒 | 場面 | 画面 |
|---|---|---|
| 0.00–2.6 | 1 | 左の中央から一点の筆が生まれ、束が追いつく(先導の粒は 0.3 秒までゆっくり) |
| 2.2–5.2 | 1 | 流れ場の乱れと速さが増し、全粒が生まれる。カメラは 2.5〜5.0 秒で 1.2 倍へ寄る |
| 4.0–7.6 | 2 | 流れの向きが二度変わる(4.0 と 6.0 秒) |
| 6.0–6.6 | 2 | 見出しの矩形の中の手前の粒を薄くする(見出しが読める) |
| 6.4–8.5 | 2 | 見出しが一文字ずつ(0.12 秒おき)、筆で書くように左から現れる |
| 9.4–9.8 | 2 | 見出しが消える |
| 9.0–12.6 | 3 | 粒が曲線上の u の順(左→右)に収束を始め(9.8 秒までに全粒)、各粒は 2.2 秒でロゴの線に吸い込まれる。85% は藍の線、15% は砂の線へ。ロゴは 6.2 倍から 2.2 倍へ引く(9.4〜13.0 秒) |
| 11.9–12.7 | 4 | 収束した二本の線(藍・砂)が清書される |
| 12.0–13.1 | 4 | 軌跡が奥→手前の順に消える |
| 12.4–13.5 | 4 | BRIDGE(Inter 800・84px)、EXPAND CHOICES.(Inter 500・26px・字間 0.32em) |
| 13.5–15.0 | 4 | 完全に静止(1.5 秒) |

## 正直に弱いところ

1. 20 秒版の「10 秒付近で見出し末尾の字が筆のクリップで遅れて出る」は、見出しの矩形を字の高さに合わせて広げたが、重なりの濃い瞬間には残りうる
2. 粒の流れ場は wide の座標で設計したもので、tall は同じ場を縦長の面で見ている(粒の密度は wide より高い)
3. 容量が大きい(上記)
4. ロゴの曲線は近似のまま(未決 #7)

## 2026-10-10 線の端を地へ溶かす

about の窓を縁なしにした(社長「境界線が無い方が見やすい」・design-system v1.4)。流れの区間(4〜9 秒)で筆の線が窓の端を外周の最大 4 割の長さで横切り、縁がないと見えない箱で線が切れて見えたので、筆の線と文字を層に描き、窓の端から 14%(1080 で 151px)の帯で 1→0 に地へ溶かしてから平らな地に重ねる(地にはグラデーションを足さない)。

- 2026-10-10: 縁なしの窓の条件(外周の 98% 以上が地と ΔRGB 2 以下)に、暗い地の圧縮ノイズ(ΔRGB 3)が 450 コマ中 53 コマで掛かったので、暗部を細かく量子化する aq-mode=3 で再圧縮した(容量は増えない。1.44〜1.49MB)
- 例外(designer 2026-10-10): ダーク縦長の 450 コマ中 1 コマだけ、外周の 2% 超が節の地と ΔRGB 3(目では見分けられない圧縮ノイズ)。他の 15 本は全フレームで条件を満たす
