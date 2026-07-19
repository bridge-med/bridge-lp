#!/usr/bin/env bash
# 合成 — 録画webm + ナレーション + BGM → 1080x1920 mp4
# 使い方: mix.sh <workdir> <出力mp4> <seg開始秒をスペース区切りで> <終了秒>
set -euo pipefail
WORK="$1"; OUT="$2"; OFFSETS=($3); END="$4"

REC=$(ls "$WORK"/rec/*.webm | head -1)
INPUTS=(-i "$REC")
FILTERS=""
LABELS=""
n=0
for off in "${OFFSETS[@]}"; do
  INPUTS+=(-i "$WORK/vo/seg$n.wav")
  ms=$(python3 -c "print(int($off*1000))")
  FILTERS+="[$((n+1))]volume=1.6,adelay=${ms}[a$n];"
  LABELS+="[a$n]"
  n=$((n+1))
done
INPUTS+=(-i "$WORK/bgm.wav")
FILTERS+="[$((n+1))]volume=0.16[bg];"
FILTERS+="${LABELS}[bg]amix=inputs=$((n+1)):normalize=0,alimiter=limit=0.95[aout];"
FILTERS+="[0:v]scale=1080:1920:flags=lanczos,fps=30[vout]"

ffmpeg -y -v error "${INPUTS[@]}" -filter_complex "$FILTERS" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -t "$END" "$OUT"
echo "$OUT ok"
