#!/bin/sh
# posters.sh <tag> <name> : poster candidates for the products hub, out/<name>-t<sec>.webp (and the same frame as png).
# Three t's for the designer to choose from (no grading, no overlay: the frame as shot):
#   0.0  S1 the choice line 「○ 人に教えること」(v2 thumbnail)   11.2  S6 the map: 現在地 and the three bridges   14.0  S7 the signature
set -e
cd "$(dirname "$0")"
WORK="${FILM_WORK:-work}"; OUT="${FILM_OUT:-out}"; FF="${FFMPEG:-ffmpeg}"; mkdir -p "$OUT"
for t in ${POSTER_T:-0.0 11.2 14.0}; do
  f=$(node -e "console.log(String(Math.round($t*30)).padStart(4,'0'))")
  cp -L "$WORK/frames/$1/_all/$f.png" "$OUT/$2-t$t.png"
  "$FF" -y -loglevel error -i "$OUT/$2-t$t.png" -c:v libwebp -lossless 0 -quality 90 -compression_level 6 "$OUT/$2-t$t.webp"
done
ls -la "$OUT"/$2-t*
