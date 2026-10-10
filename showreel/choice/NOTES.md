# 選ぶ瞬間 — products ハブの版

実物の製品ページだけで組む 15 秒の映像(30fps・H.264・無音)。制作一式と絵コンテは `film/choice/`(README.md・NOTES-v2.md)。2026-10-10、社長の「3か所に映像を」の 2 本目として、**プロダクト一覧(`products/index.html`)の末尾(用途の節の後・Where to next の直前)に、独立した節**で置いた(designer 2026-10-10: 「初めてなら、この3つ」の直下では3つの1つと読み違えるため。署名が「次は、どこへ歩きますか」へ受け渡す)。

- 版: テーマ × 画角の 4 本(`{light,dark}-{wide,tall}.mp4`)とポスター 4 枚(`.webp`)。wide=1920×1080、tall=1080×1350。`film/choice/job4.sh <light|dark> <wide|tall>` で撮り直し、`film/choice/out/p3-v2-<版>.mp4` を crf 28 に再圧縮して置く(1.07〜1.17MB。§4 の 1 版 2MB 以下)
- ダーク版は製品のダーク表示で撮る。クリニックタウン3D(S5)だけダーク非対応なので写しはライトのまま(加工しない。第22条の写しの但し書き)
- ポスターは 11.2 秒(Compass の結果の地図=現在地と三つの橋)。designer の判断で変えられる(候補は 0.0 秒の S1・14.0 秒の署名。`film/choice/out/p3-v2-<版>-t*.webp`)
- 写しの規律: 無加工・ハードカット(S6→S7 の 2 コマの重ねだけ)・写しの上に何も描かない・砂は製品自身の印とマークの砂の線だけ
- tall は 4:5 の縦の余りで wide にない画面が入る(S1 の隣の選択肢・S4 の紙の上のタブ=製品自身の画面なので可。S6 はサイトのナビが入ったので 2.6 倍に寄せて撮り直した=2026-10-10)。S6 tall の下端の実ページの罫線は B-13 の切り出しで外した(下の 2026-10-10)

```sh
for th in light dark; do for ly in wide tall; do
  ffmpeg -y -i film/choice/out/p3-v2-$th-$ly.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -profile:v high -tune animation -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart showreel/choice/$th-$ly.mp4
done; done
```

## 2026-10-10 写しを引いて地を空ける

窓を縁なしにした(社長「境界線が無い方が見やすい」・design-system v1.4)。写しが窓いっぱいだと、外周の 100% が地と違う長方形として見え、カードや上端の字が見えない箱で切れる(designer)。撮った画を縦横同じ倍率で 90% に縮め(B-13: 寄る・引くは加工ではない)、四辺に節の地(ライト #FBFAF7・ダーク #111521)を 5% ずつ空けた。写しの縁は写し自身の縁で見える。ダークの S4(暗い部屋)だけは写しの地と節の地の差が ΔRGB 3〜4 で縁が溶けるが、前後の拍で写しの全体が見えているので許す(designer)。

```sh
# 元の PNG 連番(film/choice/work/frames/<版>/_all。job4.sh が作る)から書き出す。mp4 からだと写しの地が ΔRGB 3 ずれる
for th in light dark; do for ly in wide tall; do
  [ $th = light ] && C=0xFBFAF7 || C=0x111521; [ $ly = wide ] && WH=1920:1080 || WH=1080:1350
  CROP=""; [ $ly = tall ] && CROP="drawbox=x=0:y=1000:w=iw:h=ih-1000:color=$C:t=fill:enable='between(n,331,346)',"
  ffmpeg -y -framerate 30 -i film/choice/work/frames/$th-$ly/_all/%04d.png -vf "format=rgb24,${CROP}scale=iw*0.9:ih*0.9:flags=lanczos,pad=$WH:(ow-iw)/2:(oh-ih)/2:color=$C,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p" -c:v libx264 -preset slow -crf 28 -x264-params aq-mode=3:aq-strength=1.2 -profile:v high -tune animation -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart showreel/choice/$th-$ly.mp4
done; done
```

- 色の変換を RGB で明示しないと、pad の地が ΔRGB 3〜4 ずれた(yuv のまま pad すると bt601 で変換されるため)。film/choice/out の mp4 は行列の印のない bt601 で、写しの地も ΔRGB 2〜3 ずれているので、PNG 連番から書き出す
- tall の S6(Compass の地図)は、写しの下端に実ページの罫線が入り、縁なしの窓では地の上に孤立した線(シークバーにも見える)になった。罫線が画に入るコマ(331〜346)だけ、写しの下端を地図と罫線の間(写しの y=1000)で切り上げた(B-13 の切り出し。倍率は変えない。その間の地図の最下は y=719 で、切り口に触れない。designer 2026-10-10)。ポスターも同じ
- ポスターは 11.2 秒の png に同じ縮小と地を掛けて webp に
