#!/usr/bin/env bash
# 撮ったコマ(run.mjs)を書き出す: compass = A(Q8 を選ぶ)+ B(翻訳中 → 結果の地図)/ town = 経営の相談で選ぶ。
# どちらも最後のコマを HOLD 秒そのまま止め、そのコマをポスター(webp)にする。無音・H.264・yuv420p・faststart
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/.."
fr="${FILM_WORK:-$here/../../../../film/choice/work}/frames"
HOLD=1.3
CRF="${CRF:-20}"
enc() { # $1 = 入力の連番の一覧(concat)  $2 = 出力名
  local list="$1" name="$2"
  ffmpeg -loglevel error -y -f concat -safe 0 -r 30 -i "$list" \
    -vf "fps=30,tpad=stop_mode=clone:stop_duration=$HOLD,format=yuv420p" \
    -c:v libx264 -preset slow -crf "$CRF" -profile:v high -movflags +faststart -an "$out/$name.mp4"
}
for fmt in tall wide; do
  tmp="$(mktemp -d)"
  ls "$fr/top-$fmt/ca/"*.png "$fr/top-$fmt/cb/"*.png | sed "s/^/file '/; s/$/'/" > "$tmp/compass.txt"
  ls "$fr/top-$fmt/town/"*.png | sed "s/^/file '/; s/$/'/" > "$tmp/town.txt"
  enc "$tmp/compass.txt" "compass-$fmt"
  enc "$tmp/town.txt" "town-$fmt"
  cwebp -quiet -q "${WEBPQ:-62}" "$(ls "$fr/top-$fmt/cb/"*.png | tail -1)" -o "$out/compass-$fmt.webp" 2>/dev/null \
    || ffmpeg -loglevel error -y -i "$(ls "$fr/top-$fmt/cb/"*.png | tail -1)" -quality "${WEBPQ:-62}" "$out/compass-$fmt.webp"
  cwebp -quiet -q "${WEBPQ:-62}" "$(ls "$fr/top-$fmt/town/"*.png | tail -1)" -o "$out/town-$fmt.webp" 2>/dev/null \
    || ffmpeg -loglevel error -y -i "$(ls "$fr/top-$fmt/town/"*.png | tail -1)" -quality "${WEBPQ:-62}" "$out/town-$fmt.webp"
  rm -rf "$tmp"
done
ls -l "$out"/*.mp4 "$out"/*.webp
