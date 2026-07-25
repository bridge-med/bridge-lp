#!/usr/bin/env bash
# セットアップ — apt/PyPI/npmのみ使用(GitHub不要)。セッションごとに1回実行する。
set -euo pipefail
cd "$(dirname "$0")"

echo "== apt: open-jtalk / ffmpeg / 日本語フォント / xvfb(ロスレス録画用) =="
apt-get update -q || true
apt-get install -y -q open-jtalk open-jtalk-mecab-naist-jdic \
  hts-voice-nitech-jp-atr503-m001 ffmpeg fonts-noto-cjk xvfb

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

echo "== ニューラルTTS(任意): Style-Bert-VITS2 =="
# Hugging Face に到達できるセッションでのみモデルを取得する。
# 取得できない環境では tts.sh が自動で Open JTalk にフォールバックする。
if [ -f ../voices/sbv2/config.json ]; then
  echo "  導入済み(voices/sbv2)"
elif curl -fsS -m 8 -o /dev/null https://huggingface.co 2>/dev/null; then
  # システムpip(Debianパッチ済みsetuptools)は依存の旧式sdistのビルドに失敗するためvenvを使う。
  # tts.sh もこのvenv(work/venv)を見る。
  [ -x venv/bin/python ] || python3 -m venv venv
  # setuptoolsは81未満に固定(pyopenjtalkが要求するpkg_resourcesが82で削除された)
  venv/bin/pip install -q -U pip wheel 'setuptools<81'
  # torchはCPU版を明示(既定のCUDA版は数GB大きく、この環境では不要)
  venv/bin/pip install -q torch --index-url https://download.pytorch.org/whl/cpu \
    || venv/bin/pip install -q torch
  # numpyは2未満に固定(pyopenjtalk-dictのwheelがnumpy 1.x向けビルド)
  # transformersは5未満に固定(v5はBERT configのfloat16指定を尊重し型不一致で推論が落ちる)
  venv/bin/pip install -q style-bert-vits2 huggingface_hub 'numpy<2' 'transformers<5'
  venv/bin/python - <<'EOF'
from pathlib import Path
from huggingface_hub import snapshot_download

dst = Path("../voices/sbv2")
# JVNVコーパス由来の女声モデル(モデルはSBV2既定配布・コーパスはCC BY-SA 4.0)
snapshot_download(
    "litagin/style_bert_vits2_jvnv",
    allow_patterns=["jvnv-F1-jp/*"],
    local_dir=dst.parent / "sbv2_dl",
)
src = dst.parent / "sbv2_dl" / "jvnv-F1-jp"
dst.mkdir(parents=True, exist_ok=True)
for f in src.iterdir():
    f.rename(dst / f.name)
# 日本語BERT(推論に必須・約1.3GB)
# .binはsafetensorsと重複する同内容の旧形式(1.3GB)なので除外
snapshot_download(
    "ku-nlp/deberta-v2-large-japanese-char-wwm",
    local_dir=dst / "bert",
    ignore_patterns=["*.bin"],
)
EOF
  echo "  Style-Bert-VITS2 導入完了"
else
  echo "  スキップ(Hugging Faceに到達できない。tts.shはOpen JTalkにフォールバック)"
fi

# VOICEVOX(ニューラル・商用可)は配布がGitHub Releasesのみ:
#   https://github.com/VOICEVOX/voicevox_engine/releases の linux-cpu 版を展開し
#   ./run --host 127.0.0.1 --port 50021 で起動しておけば tts.sh が自動で使う。
#   AivisSpeech等のVOICEVOX互換エンジンも VOICEVOX_URL 指定で利用可。

echo "setup ok"
