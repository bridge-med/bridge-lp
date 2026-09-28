#!/bin/sh
# stills.sh <tag> : copies p3-t{...}.png from the assembled sequence of <tag>
PAT=/tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/pat-ui
for t in 0.0 2.5 5.0 8.0 11.0 14.0; do
  f=$(node -e "console.log(String(Math.round($t*30)).padStart(4,'0'))")
  cp -L $PAT/frames/$1/_all/$f.png $PAT/p3-t$t.png
done
ls -la $PAT/p3-t*.png
