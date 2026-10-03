#!/bin/sh
# assemble.sh <tag> <out.mp4> : concatenates work/frames/<tag>/<ORDER...> into one numbered sequence (_all) and encodes
set -e
cd "$(dirname "$0")"
WORK="${FILM_WORK:-work}"; FF="${FFMPEG:-ffmpeg}"
tag=$1; out=$2; base=$(cd "$WORK/frames/$tag" && pwd); seq=$base/_all
rm -rf $seq; mkdir -p $seq; n=0
for s in ${ORDER:-s1 s2 s2b s3 s4 s5 m1 m2 m3 m4 m5 x67}; do
  [ -d $base/$s ] || { echo missing $s; exit 1; }
  for f in $(ls $base/$s/*.png | sort); do ln -s $f $seq/$(printf %04d $n).png; n=$((n+1)); done
done
[ $n = 450 ] || { echo "frame count $n != 450"; exit 1; }
echo frames $n
"$FF" -y -loglevel error -framerate 30 -i $seq/%04d.png -c:v libx264 -preset slow -crf ${CRF:-18} -pix_fmt yuv420p -movflags +faststart "$out"
