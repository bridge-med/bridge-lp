#!/bin/sh
# assemble.sh <tag> <out.mp4>   : concatenates frames/<tag>/s1..s7 into one numbered sequence and encodes
PAT=/tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/pat-ui
FF=/tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/ffx/node_modules/@ffmpeg-installer/linux-x64/ffmpeg
tag=$1; out=$2; seq=$PAT/frames/$tag/_all
rm -rf $seq; mkdir -p $seq; n=0
for s in ${ORDER:-s1 s2 s3 s4 s5 m1 m2 m3 m4 m5 s6 s7}; do for d in $PAT/frames/$tag/$s; do [ -d $d ] || { echo missing $s; exit 1; }; done;  for f in $(ls $PAT/frames/$tag/$s/*.png | sort); do ln -s $f $seq/$(printf %04d $n).png; n=$((n+1)); done; done
[ $n = 450 ] || { echo "frame count $n != 450"; exit 1; }
echo frames $n
$FF -y -loglevel error -framerate 30 -i $seq/%04d.png -c:v libx264 -preset slow -crf ${CRF:-18} -pix_fmt yuv420p -movflags +faststart $out
