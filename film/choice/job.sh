#!/bin/sh
# job.sh <tag> <shots>  : render (1920) + assemble p3-<tag>.mp4 + stills; meant to run under flock
cd /tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/pat-ui
echo start $(date)
node run.mjs --shots $2 --w 1920 --tag $1 2>&1 | grep -v Fontconfig | grep -E "done|rror"
CRF=16 ./assemble.sh $1 p3-$1.mp4 && ./stills.sh $1 >/dev/null && echo encoded
echo end $(date)
