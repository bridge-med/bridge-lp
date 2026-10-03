#!/bin/sh
# job2.sh [tag] [shots] : one command rebuilds the whole P3 v2 film from this repo.
#   1) renders every shot at 1920 from shots2.mjs (S2, S5, M1-M5 are the f5/v1 definitions, unchanged in shots2.mjs),
#   2) composes the S6->S7 handover (x67), 3) encodes out/p3-<tag>.mp4, 4) writes the stills out/p3v2-t*.png.
# tag defaults to v2; shots defaults to all. Frames go to work/frames/<tag>/, the mp4 and stills to out/ (both ignored by git).
# Env: FFMPEG (default: ffmpeg on PATH), PLAYWRIGHT_MODULE, PLAYWRIGHT_BROWSERS_PATH (default /opt/pw-browsers), FILM_WORK, FILM_OUT.
set -e
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
tag=${1:-v2}
shots=${2:-s1,s2,s2b,s3,s4,s5,m1,m2,m3,m4,m5,s6,s7}
echo start $(date)
node run2.mjs --shots "$shots" --w 1920 --tag "$tag"
./compose67.sh "$tag"
OUT="${FILM_OUT:-out}"; mkdir -p "$OUT"
ORDER="s1 s2 s2b s3 s4 s5 m1 m2 m3 m4 m5 x67" CRF=16 ./assemble.sh "$tag" "$OUT/p3-$tag.mp4"
./stills2.sh "$tag" >/dev/null
echo encoded "$OUT/p3-$tag.mp4"
echo end $(date)
