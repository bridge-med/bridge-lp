#!/usr/bin/env bash
# コマ(PNG) + ナレーション + BGM + 字幕(ASS) → 1080x1920 H.264/AAC の mp4
# 使い方: mux.sh <episode_dir> [出力mp4]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EP="$(cd "$1" && pwd)"; WORK="$EP/work"; OUT="${2:-$EP/out/$(basename "$EP").mp4}"
mkdir -p "$(dirname "$OUT")"
read -r FPS TOTAL N <<<"$(python3 -c '
import json,sys; t=json.load(open(sys.argv[1])); print(t["fps"], t["total"], len(t["segments"]))' "$EP/timing.json")"
OFFSETS=$(python3 -c '
import json,sys; t=json.load(open(sys.argv[1])); print(" ".join(str(int(round(s["start"]*1000))) for s in t["segments"]))' "$EP/timing.json")

# BGM(tools/ugc-video/make-bgm.py を再利用。長さは尺に合わせる)
[ -f "$WORK/bgm.wav" ] || python3 "$HERE/../ugc-video/make-bgm.py" "$WORK/bgm.wav" "$TOTAL" >/dev/null

INPUTS=(-framerate "$FPS" -i "$WORK/frames/%05d.png")
FILTERS=""; LABELS=""; n=0
for ms in $OFFSETS; do
  INPUTS+=(-i "$WORK/vo/seg$n.wav")
  FILTERS+="[$((n+1))]aresample=48000,adelay=${ms}|${ms}[a$n];"
  LABELS+="[a$n]"; n=$((n+1))
done
INPUTS+=(-i "$WORK/bgm.wav")
FILTERS+="[$((n+1))]aresample=48000,volume=0.07[bg];"
FILTERS+="${LABELS}amix=inputs=$n:normalize=0[vo];"
FILTERS+="[vo]loudnorm=I=-16:TP=-1.5:LRA=11[von];"
FILTERS+="[von][bg]amix=inputs=2:normalize=0:duration=longest,apad,alimiter=limit=0.85[aout];"
# 映像: 描いた解像度 → 1080x1920(lanczos)→ 字幕(libass)
FILTERS+="[0:v]scale=1080:1920:flags=lanczos,format=yuv420p,subtitles='$WORK/subs.ass':fontsdir=/usr/share/fonts[vout]"

ffmpeg -y -v error "${INPUTS[@]}" -filter_complex "$FILTERS" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -r "$FPS" \
  -c:a aac -b:a 160k -ar 48000 -movflags +faststart -t "$TOTAL" "$OUT"
echo "$OUT ok"
