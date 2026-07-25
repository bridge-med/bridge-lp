#!/usr/bin/env bash
# ナレーション音声化 — 使えるエンジンを自動選択して <workdir>/vo/segN.wav を生成する
# 使い方: tts.sh <workdir> <文1> <文2> ...
#
# エンジンの優先順(UGC_TTS=voicevox|sbv2|openjtalk で固定も可):
#   1. voicevox  — VOICEVOX互換エンジン(AivisSpeech等も可)が VOICEVOX_URL で応答するとき
#   2. sbv2      — Style-Bert-VITS2 のモデルが voices/sbv2/ に配置済みのとき
#   3. openjtalk — フォールバック(HMM方式・機械感あり)
set -euo pipefail
cd "$(dirname "$0")"
WORK="$1"; shift
LINES=("$@")

RATE="${UGC_TTS_RATE:-1.0}"                       # 話速。1.0が標準、上げると速い
VV_URL="${VOICEVOX_URL:-http://127.0.0.1:50021}"
VV_SPEAKER="${VOICEVOX_SPEAKER:-2}"               # 2 = 四国めたん(ノーマル)
SBV2_DIR="${UGC_SBV2_MODEL:-$PWD/voices/sbv2}"
SBV2_PY="$PWD/work/venv/bin/python"          # setup.shが作るvenv(無ければsystem python)
[ -x "$SBV2_PY" ] || SBV2_PY=python3
DIC=/var/lib/mecab/dic/open-jtalk/naist-jdic
MEI="$PWD/voices/mei_normal.htsvoice"

mkdir -p "$WORK/vo"

pick_engine() {
  if [ -n "${UGC_TTS:-}" ]; then echo "$UGC_TTS"; return; fi
  if curl -fsS -m 2 "$VV_URL/version" >/dev/null 2>&1; then echo voicevox; return; fi
  if [ -f "$SBV2_DIR/config.json" ] && "$SBV2_PY" -c 'import style_bert_vits2' 2>/dev/null; then
    echo sbv2; return
  fi
  echo openjtalk
}

ENGINE=$(pick_engine)
echo "  エンジン: $ENGINE"

case "$ENGINE" in
  voicevox)
    i=0
    for line in "${LINES[@]}"; do
      q=$(curl -fsS -X POST "$VV_URL/audio_query" \
            --url-query "text=$line" --url-query "speaker=$VV_SPEAKER")
      q=$(UGC_TTS_RATE="$RATE" python3 -c '
import json, os, sys
d = json.load(sys.stdin)
d["speedScale"] = float(os.environ["UGC_TTS_RATE"])
print(json.dumps(d))' <<<"$q")
      curl -fsS -X POST "$VV_URL/synthesis" --url-query "speaker=$VV_SPEAKER" \
        -H 'Content-Type: application/json' -d "$q" -o "$WORK/vo/seg$i.wav"
      i=$((i+1))
    done
    ;;
  sbv2)
    UGC_SBV2_MODEL="$SBV2_DIR" UGC_TTS_RATE="$RATE" \
      "$SBV2_PY" tts-sbv2.py "$WORK/vo" "${LINES[@]}"
    ;;
  openjtalk)
    i=0
    for line in "${LINES[@]}"; do
      echo "$line" | open_jtalk -x "$DIC" -m "$MEI" -r "$RATE" -ow "$WORK/vo/seg$i.wav"
      i=$((i+1))
    done
    ;;
  *)
    echo "不明なエンジン: $ENGINE" >&2; exit 1
    ;;
esac
