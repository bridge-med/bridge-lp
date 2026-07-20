#!/usr/bin/env bash
# 合成 — 録画webm + ナレーション + BGM → 1080x1920 mp4
# 使い方: mix.sh <workdir> <出力mp4> <seg開始秒をスペース区切りで> <終了秒>
set -euo pipefail
WORK="$1"; OUT="$2"; OFFSETS=($3); END="$4"

REC=$(ls "$WORK"/rec/capture.mp4 2>/dev/null || ls "$WORK"/rec/*.webm | head -1)
# x11キャプチャはページ表示前の頭が映っているので、record.jsが記録したリード秒を切る
LEAD=0
[ -f "$WORK/rec/lead.txt" ] && LEAD=$(cat "$WORK/rec/lead.txt")
INPUTS=(-ss "$LEAD" -i "$REC")
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
STREAMS=$n
if [ -f "$WORK/bgm.wav" ]; then
  INPUTS+=(-i "$WORK/bgm.wav")
  FILTERS+="[$((n+1))]volume=0.16[bg];"
  LABELS+="[bg]"
  STREAMS=$((n+1))
fi
if [ "$STREAMS" -gt 0 ]; then
  FILTERS+="${LABELS}amix=inputs=$STREAMS:normalize=0,alimiter=limit=0.89[aout];"
else
  # 完全無音でも音声トラックは載せる(プラットフォーム互換)
  INPUTS+=(-f lavfi -t "$END" -i anullsrc=r=44100:cl=mono)
  FILTERS+="[1]acopy[aout];"
fi
# 全編にわたる知覚できない速さのプッシュイン(29秒で1.00→1.06)。静止画面の間ももたせる
FILTERS+="[0:v]fps=30,scale=1188:2112:flags=lanczos,"
FILTERS+="zoompan=z='min(zoom+0.00007,1.06)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30[vout]"

ffmpeg -y -v error "${INPUTS[@]}" -filter_complex "$FILTERS" \
  -map "[vout]" -map "[aout]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 128k -t "$END" "$OUT"
echo "$OUT ok"
