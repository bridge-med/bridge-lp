#!/bin/sh
# stills2.sh <tag> : copies out/p3v2-t{...}.png from the assembled sequence of <tag>
set -e
cd "$(dirname "$0")"
WORK="${FILM_WORK:-work}"; OUT="${FILM_OUT:-out}"; mkdir -p "$OUT"
for t in 0.0 2.5 5.0 8.0 11.0 12.4 14.0; do
  f=$(node -e "console.log(String(Math.round($t*30)).padStart(4,'0'))")
  cp -L $WORK/frames/$1/_all/$f.png $OUT/p3v2-t$t.png
done
ls -la $OUT/p3v2-t*.png
