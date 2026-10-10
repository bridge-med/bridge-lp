# 選ぶ瞬間 — products ハブの版

実物の製品ページだけで組む 15 秒の映像(30fps・H.264・無音)。制作一式と絵コンテは `film/choice/`(README.md・NOTES-v2.md)。2026-10-10、社長の「3か所に映像を」の 2 本目として、**プロダクト一覧(`products/index.html`)の「初めてなら、この3つ」の見出しの直下**に置いた。

- 版: テーマ × 画角の 4 本(`{light,dark}-{wide,tall}.mp4`)とポスター 4 枚(`.webp`)。wide=1920×1080、tall=1080×1350。`film/choice/job4.sh <light|dark> <wide|tall>` で撮り直し、`film/choice/out/p3-v2-<版>.mp4` を crf 28 に再圧縮して置く(1.07〜1.17MB。§4 の 1 版 2MB 以下)
- ダーク版は製品のダーク表示で撮る。クリニックタウン3D(S5)だけダーク非対応なので写しはライトのまま(加工しない。第22条の写しの但し書き)
- ポスターは 11.2 秒(Compass の結果の地図=現在地と三つの橋)。designer の判断で変えられる(候補は 0.0 秒の S1・14.0 秒の署名。`film/choice/out/p3-v2-<版>-t*.webp`)
- 写しの規律: 無加工・ハードカット(S6→S7 の 2 コマの重ねだけ)・写しの上に何も描かない・砂は製品自身の印とマークの砂の線だけ
- tall は 4:5 の縦の余りで wide にない画面が入る(S4 の紙の上のタブ・S6 の地図の上のナビなど)。designer の判断事項

```sh
for th in light dark; do for ly in wide tall; do
  ffmpeg -y -i film/choice/out/p3-v2-$th-$ly.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -profile:v high -tune animation -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart showreel/choice/$th-$ly.mp4
done; done
```
