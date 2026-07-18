#!/usr/bin/env bash
# セットアップ — apt/PyPI/npmのみ使用(GitHub不要)。セッションごとに1回実行する。
set -euo pipefail
cd "$(dirname "$0")"

echo "== apt: open-jtalk / ffmpeg / 日本語フォント =="
apt-get update -q || true
apt-get install -y -q open-jtalk open-jtalk-mecab-naist-jdic \
  hts-voice-nitech-jp-atr503-m001 ffmpeg fonts-noto-cjk

echo "== npm: playwright (ブラウザ本体はプリインストール品を使用) =="
mkdir -p work && cd work
[ -f package.json ] || npm init -y >/dev/null
npm install playwright --no-fund --no-audit

echo "== PyPI: pyopenjtalk から女声Meiモデルを抽出 =="
if [ ! -f ../voices/mei_normal.htsvoice ]; then
  mkdir -p ../voices pjt_pkg
  pip download pyopenjtalk --no-deps -q -d pjt_pkg
  tar -xzf pjt_pkg/pyopenjtalk-*.tar.gz -C pjt_pkg
  cp pjt_pkg/pyopenjtalk-*/pyopenjtalk/htsvoice/mei_normal.htsvoice ../voices/
  cp pjt_pkg/pyopenjtalk-*/pyopenjtalk/htsvoice/LICENSE_mei_normal.htsvoice ../voices/
fi

# TODO(VOICEVOX): GitHubアクセスが開いたセッションでは、以下でニューラル音声に差し替える
#   https://github.com/VOICEVOX/voicevox_engine/releases の linux-cpu 版を取得・展開し、
#   ./run --host 127.0.0.1 --port 50021 で起動。mix側は /audio_query → /synthesis で生成。

echo "setup ok"
