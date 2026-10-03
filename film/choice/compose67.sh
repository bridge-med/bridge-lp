#!/bin/sh
# compose67.sh <tag> : S6 (34 page frames) + S7 (85 card frames) -> x67 (117 frames).
# The last 2 page frames (solid 現在地 navy) and the first 2 card frames (solid navy of the mark's arc) are cross-dissolved 1/3, 2/3.
set -e
cd "$(dirname "$0")"
WORK="${FILM_WORK:-work}"; FF="${FFMPEG:-ffmpeg}"
tag=$1; d=$WORK/frames/$tag; o=$d/x67
rm -rf $o; mkdir -p $o; n=0
for i in $(seq 0 31); do cp $d/s6/$(printf %04d $i).png $o/$(printf %04d $n).png; n=$((n+1)); done
for j in 0 1; do
  a=$d/s6/$(printf %04d $((32+j))).png; b=$d/s7/$(printf %04d $j).png; w=$(echo "($j+1)/3" | bc -l)
  "$FF" -y -loglevel error -i $a -i $b -filter_complex "[0]format=rgb24[a];[1]format=rgb24[b];[a][b]blend=all_expr='A*(1-$w)+B*$w'" -frames:v 1 $o/$(printf %04d $n).png; n=$((n+1))
done
for i in $(seq 2 84); do cp $d/s7/$(printf %04d $i).png $o/$(printf %04d $n).png; n=$((n+1)); done
echo x67 $n
