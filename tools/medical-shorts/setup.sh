#!/usr/bin/env bash
# セットアップ(セッションごとに 1 回): bpy(Blender を Python モジュールとして)・ffmpeg・日本語フォント・Open JTalk(予備の音声)
# VOICEVOX 本体は GitHub Releases / Docker Hub の配布で、遮断・制限のある環境では取れないことがある。
# 取れないときは VOICEVOX_URL に、公式エンジンを公開している HTTP エンドポイントを指す(tts.sh が同じ API で使う)。
set -euo pipefail
cd "$(dirname "$0")"
echo "== apt: ffmpeg / フォント / Open JTalk / GL =="
apt-get update -q || true
apt-get install -y -q ffmpeg fonts-noto-cjk open-jtalk open-jtalk-mecab-naist-jdic hts-voice-nitech-jp-atr503-m001 \
  libgl1 libglu1-mesa libxi6 libxrender1 libxkbcommon0 libsm6 libxxf86vm1 libxfixes3 libegl1 xvfb
echo "== pip: bpy(Blender) / Pillow =="
python3 -c 'import bpy' 2>/dev/null || pip3 install -q bpy
python3 -c 'import PIL' 2>/dev/null || pip3 install -q Pillow
echo "== Open JTalk の女声(Mei)を tools/ugc-video と同じ手順で =="
if [ ! -f ../ugc-video/voices/mei_normal.htsvoice ]; then
  mkdir -p ../ugc-video/voices /tmp/pjt_pkg
  pip3 download pyopenjtalk --no-deps -q -d /tmp/pjt_pkg
  tar -xzf /tmp/pjt_pkg/pyopenjtalk-*.tar.gz -C /tmp/pjt_pkg
  cp /tmp/pjt_pkg/pyopenjtalk-*/pyopenjtalk/htsvoice/mei_normal.htsvoice /tmp/pjt_pkg/pyopenjtalk-*/pyopenjtalk/htsvoice/LICENSE_mei_normal.htsvoice ../ugc-video/voices/
fi
python3 -c 'import bpy; print("bpy", bpy.app.version_string)'
echo "setup ok"
