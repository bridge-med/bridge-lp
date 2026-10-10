#!/bin/sh
# job4.sh <light|dark> <wide|tall> [shots] : one variant of P3 v2 for the products hub (2026-10-10).
#   light wide = job2.sh (the master definitions, 1920x1080). dark = --theme dark on every shot whose product has a dark display
#   (S5 clinic-flow-3d has none: its copy stays light). tall = 1080x1350, the tall cameras of shots2.mjs (same pages, order, timing).
#   Frames: work/frames/<theme>-<fmt>/, film: out/p3-v2-<theme>-<fmt>.mp4, posters: out/p3-v2-<theme>-<fmt>-t*.webp (+ .png).
set -e
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
theme=${1:-light}; fmt=${2:-wide}; tag="$theme-$fmt"
shots=${3:-s1,s2,s2b,s3,s4,s5,m1,m2,m3,m4,m5,s6,s7}
echo start $tag $(date)
node run2.mjs --shots "$shots" --fmt "$fmt" --theme "$theme" --tag "$tag"
./compose67.sh "$tag"
OUT="${FILM_OUT:-out}"; mkdir -p "$OUT"
ORDER="s1 s2 s2b s3 s4 s5 m1 m2 m3 m4 m5 x67" CRF=16 ./assemble.sh "$tag" "$OUT/p3-v2-$tag.mp4"
./posters.sh "$tag" "p3-v2-$tag" >/dev/null
echo encoded "$OUT/p3-v2-$tag.mp4" $(date)
