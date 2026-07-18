#!/usr/bin/env bash
# 一括実行 — 台本(scenario.js)からショート動画を生成する
set -euo pipefail
cd "$(dirname "$0")"
WORK="$PWD/work"
SITE_ROOT="$PWD/../.."
DIC=/var/lib/mecab/dic/open-jtalk/naist-jdic
VOICE="$PWD/voices/mei_normal.htsvoice"

mkdir -p "$WORK/vo"
rm -rf "$WORK/rec"

# scenario.js からタイムラインと台本を取り出す
readarray -t META < <(node -e '
  const s = require("./scenario.js");
  const keys = Object.keys(s.T).filter(k => k !== "end");
  console.log(s.name);
  console.log(s.T.end);
  console.log(keys.map(k => s.T[k]).join(" "));
  s.lines.forEach(l => console.log(l));
')
NAME="${META[0]}"; END="${META[1]}"; OFFSETS="${META[2]}"
LINES=("${META[@]:3}")

echo "== ナレーション音声化 (${#LINES[@]}文) =="
i=0
for line in "${LINES[@]}"; do
  echo "$line" | open_jtalk -x "$DIC" -m "$VOICE" -r 1.0 -ow "$WORK/vo/seg$i.wav"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/vo/seg$i.wav")
  echo "  seg$i: ${d}s"
  i=$((i+1))
done

# 各セグメントが次のスロットに収まるか実測で確認
node -e '
  const { execSync } = require("child_process");
  const s = require("./scenario.js");
  const keys = Object.keys(s.T).filter(k => k !== "end");
  const starts = keys.map(k => s.T[k]).concat([s.T.end]);
  let ng = 0;
  keys.forEach((k, i) => {
    const d = parseFloat(execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 work/vo/seg${i}.wav`));
    if (starts[i] + d > starts[i + 1]) {
      console.error(`警告: seg${i}(${d.toFixed(2)}s)が次のセグメント開始(${starts[i+1]}s)にかぶる`);
      ng = 1;
    }
  });
  process.exit(ng);
'

echo "== BGM生成 =="
python3 make-bgm.py "$WORK/bgm.wav" "$END"

echo "== 画面録画 =="
python3 -m http.server 8123 --directory "$SITE_ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
node record.js "$WORK"

echo "== 合成 =="
bash mix.sh "$WORK" "$WORK/$NAME.mp4" "$OFFSETS" "$END"
echo "完成: $WORK/$NAME.mp4"
