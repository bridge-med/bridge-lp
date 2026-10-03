#!/bin/bash
# 「名前になる」を書き出す: 撮影 → 描いた層 → カメラ → 合成 → 音 → showreel/namae/showreel.mp4
# 依存: node(playwright の chromium)・python3(numpy・Pillow)・ffmpeg・curl(フォントのキャッシュ。既定は OS の一時領域、BRIDGE_FONTCACHE で替えられる)
# 途中のもの(撮った画・コマ・音)は showreel/namae/work/ に置く(.gitignore)。撮った画があれば撮り直さない(撮り直すときは work/cap を消す)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; W="$HERE/work"
FC="${BRIDGE_FONTCACHE:-${TMPDIR:-/tmp}/bridge-showreel-fonts}"   # フォントのキャッシュ(同じ字形で書き出し直すには、前と同じキャッシュを渡す)
mkdir -p "$W"
# 1. 実物の iikae/ を撮る(shots.mjs の 4 本の take。入力はタップとなぞりだけ)
[ -f "$W/cap/frames.json" ] || node "$HERE/capture.mjs" "$HERE/shots.mjs" "$W/cap" --fontcache "$FC" > "$W/capture.log"
# 2. 描いた層: 0〜246(夜の帯と拭い)と 760〜899(finale)を、サブフレーム 64 で
T=$(python3 -c "print(','.join(f'{n/60:.6f}' for n in list(range(0, 247)) + list(range(760, 900))))")
rm -rf "$W/canvas-raw" "$W/canvas"; node "$HERE/render.mjs" --stills "$T" --samples 64 --outdir "$W/canvas-raw" --fontcache "$FC" > "$W/render.log"
python3 - "$W" <<'PY'
import os, sys
w = sys.argv[1]; os.makedirs(f'{w}/canvas', exist_ok=True)
for f in os.listdir(f'{w}/canvas-raw'):
    n = round(float(f[1:-4]) * 60); os.replace(f'{w}/canvas-raw/{f}', f'{w}/canvas/f{n:04d}.png')
PY
# 3. 写しの区間のカメラ(reel.js から)
node "$HERE/cams.mjs" --work "$W" --fontcache "$FC"
# 4. 写しの区間 226〜759 を合成(切り出し・縮小・サブフレームの平均。226〜246 は拭い)
rm -rf "$W/frames"; python3 "$HERE/compose.py" "$W/frames" "$W/canvas" 226-759 --work "$W"
# 5. 音(音量合わせは gain.json に固定)
node "$HERE/sound.mjs" --fix "$HERE/gain.json" --out "$W/sound.wav"
# 6. 並べて mp4 に(RGB→YUV は bt709 の行列で。v3 の render.mjs と同じ)
rm -rf "$W/all"; mkdir -p "$W/all"
python3 - "$W" <<'PY'
import os, sys
w = sys.argv[1]
for n in range(900):
    src = f'{w}/frames/f{n:04d}.png' if 226 <= n <= 759 else f'{w}/canvas/f{n:04d}.png'
    assert os.path.exists(src), src
    os.link(src, f'{w}/all/f{n:04d}.png')
PY
ffmpeg -y -loglevel error -framerate 60 -i "$W/all/f%04d.png" -i "$W/sound.wav" -map 0:v -map 1:a \
  -vf 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int' \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -profile:v high -tune animation \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart \
  -c:a aac -b:a 256k -shortest -metadata title="名前になる — BRIDGE" "$HERE/showreel.mp4"
cp "$W/cap/capture-log.json" "$HERE/capture-log.json"
ls -la "$HERE/showreel.mp4"
