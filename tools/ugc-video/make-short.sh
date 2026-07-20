#!/usr/bin/env bash
# 一括実行 — 台本からショート動画を生成する
# 使い方: make-short.sh [台本.js]   (省略時は scenario.js。量産はプロダクトごとに
#         scenarios/xxx.js を書いて渡すだけ)
set -euo pipefail
cd "$(dirname "$0")"
SCENARIO="$(realpath "${1:-scenario.js}")"
export UGC_SCENARIO="$SCENARIO"
WORK="$PWD/work"
SITE_ROOT="$PWD/../.."

mkdir -p "$WORK/vo"
rm -rf "$WORK/rec"

# 台本からタイムラインとナレーションを取り出す
readarray -t META < <(node -e '
  const s = require(process.env.UGC_SCENARIO);
  const keys = Object.keys(s.T).filter(k => k !== "end");
  console.log(s.name);
  console.log(s.T.end);
  console.log(keys.map(k => s.T[k]).join(" "));
  console.log(s.serverRoot || ".");
  console.log(s.bgm === false ? "off" : "on");
  (s.lines || []).forEach(l => console.log(l));
')
NAME="${META[0]}"; END="${META[1]}"; OFFSETS="${META[2]}"
SERVER_ROOT="$(realpath "$SITE_ROOT/${META[3]}")"
BGM="${META[4]}"
LINES=("${META[@]:5}")

if [ ${#LINES[@]} -gt 0 ]; then
  echo "== ナレーション音声化 (${#LINES[@]}文) =="
  bash tts.sh "$WORK" "${LINES[@]}"
  i=0
  for line in "${LINES[@]}"; do
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/vo/seg$i.wav")
    echo "  seg$i: ${d}s"
    i=$((i+1))
  done
else
  echo "== ナレーションなし(声なし台本) =="
  OFFSETS=""
fi

# 各セグメントが次のスロットに収まるか実測で確認(ナレーションがある時だけ)
[ ${#LINES[@]} -gt 0 ] && node -e '
  const { execSync } = require("child_process");
  const s = require(process.env.UGC_SCENARIO);
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

if [ "$BGM" = "on" ]; then
  echo "== BGM生成 =="
  python3 make-bgm.py "$WORK/bgm.wav" "$END"
else
  echo "== BGMなし(台本指定) =="
  rm -f "$WORK/bgm.wav"
fi

echo "== 画面録画 =="
python3 serve.py 8123 "$SERVER_ROOT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
if command -v xvfb-run >/dev/null; then
  # ロスレスキャプチャ(Xvfb + x11grab)。Playwright内蔵録画のVP8圧縮を避ける
  UGC_CAPTURE=x11 xvfb-run -a -s "-screen 0 1080x1920x24" node record.js "$WORK"
else
  node record.js "$WORK"
fi

echo "== 合成 =="
bash mix.sh "$WORK" "$WORK/$NAME.mp4" "$OFFSETS" "$END"
echo "完成: $WORK/$NAME.mp4"
