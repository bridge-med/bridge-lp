#!/usr/bin/env bash
# 医療雑学ショート動画を一つのコマンドで作る: 台本 → 音声 → 時間割 → Blender シーン → 描画 → 字幕 → 合成 → 品質チェック
# 使い方: make.sh <episode_dir> [--skip-render] [--rate 1.12]
#   環境: bash tools/medical-shorts/setup.sh を先に(bpy・ffmpeg・フォント・Open JTalk)。
#         VOICEVOX は VOICEVOX_URL(既定 http://127.0.0.1:50021。公開エンジンの URL も可)。届かなければ Open JTalk に落ちる
#   各段は失敗したら 1 回だけやり直す(無限リトライはしない)。描画は途中から再開できる
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; EP="$(cd "$1" && pwd)"; shift
RATE="${UGC_TTS_RATE:-1.12}"; SKIP_RENDER=0; RES="${SHORTS_RES:-720x1280}"; TL="${SHORTS_TIMELIMIT:-5}"; SAMPLES="${SHORTS_SAMPLES:-16}"
while [ $# -gt 0 ]; do case "$1" in --skip-render) SKIP_RENDER=1;; --rate) RATE="$2"; shift;; esac; shift; done
LOG="$EP/work/make.log"; mkdir -p "$EP/work" "$EP/out"; T0=$(date +%s); RETRIES=0
step() {  # step <名前> <コマンド...>: 失敗したら 1 回だけやり直す
  local name="$1"; shift
  echo "== $name ==" | tee -a "$LOG"
  if "$@" >>"$LOG" 2>&1; then return 0; fi
  echo "   失敗。1 回だけやり直す" | tee -a "$LOG"; RETRIES=$((RETRIES+1))
  if "$@" >>"$LOG" 2>&1; then return 0; fi
  echo "   2 回失敗: $name。ログ $LOG" | tee -a "$LOG"; exit 1
}
step "音声と時間割(timeline.py)" python3 "$HERE/timeline.py" "$EP" --rate "$RATE" --reuse
step "Blender シーン(scene.py)" python3 "$EP/scene.py" "$EP"
if [ "$SKIP_RENDER" = 0 ]; then
  step "描画(render.py $RES, ${TL}s/コマ上限)" python3 "$HERE/render.py" "$EP" --res "$RES" --timelimit "$TL" --samples "$SAMPLES"
fi
step "字幕(subs.py)" python3 "$HERE/subs.py" "$EP"
step "合成(mux.sh)" bash "$HERE/mux.sh" "$EP"
echo "== 品質チェック(qa.py) ==" | tee -a "$LOG"
python3 "$HERE/qa.py" "$EP" 2>&1 | tee -a "$LOG"; QA=${PIPESTATUS[0]}
T1=$(date +%s)
python3 - "$EP" "$((T1-T0))" "$RETRIES" "$QA" <<'PY'
import json, sys, pathlib
ep, sec, retries, qa = pathlib.Path(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
rs = ep / "work" / "render_stats.json"; r = json.load(open(rs)) if rs.exists() else {}
json.dump({"make_seconds": sec, "step_retries": retries, "qa_exit": qa, "render": r}, open(ep / "out" / "make-stats.json", "w"), indent=1)
print(f"make: {sec}s, やり直し {retries} 回, qa exit {qa}, 描画 {r.get('seconds','-')}s/{r.get('rendered','-')}コマ")
PY
exit $QA
