#!/bin/sh
# job2.sh <tag> <shots-to-render> : v2 build. Renders the changed shots at 1920, reuses f5 for unchanged ones (s2, s5, m1-m5),
# composes the S6->S7 handover (x67), encodes p3-<tag>.mp4 and the stills. Meant to run under flock.
cd /tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/pat-ui
echo start $(date)
[ -n "$2" ] && node run2.mjs --shots $2 --w 1920 --tag $1 2>&1 | grep -v Fontconfig | grep -E "done|rror"
for s in s2 s5 m1 m2 m3 m4 m5; do rm -rf frames/$1/$s; mkdir -p frames/$1/$s; for f in frames/f5/$s/*.png; do cp $f frames/$1/$s/; done; done
./compose67.sh $1
ORDER="s1 s2 s2b s3 s4 s5 m1 m2 m3 m4 m5 x67" CRF=16 ./assemble.sh $1 p3-$1.mp4 && ./stills2.sh $1 >/dev/null && echo encoded
echo end $(date)
