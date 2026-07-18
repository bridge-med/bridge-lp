#!/usr/bin/env python3
# Style-Bert-VITS2 でナレーションを合成する(CPU)
# 使い方: tts-sbv2.py <出力dir> <文1> <文2> ...
#
# モデル配置(setup.shが行う):
#   voices/sbv2/            … config.json / *.safetensors / style_vectors.npy
#   voices/sbv2/bert/       … 日本語BERT(ku-nlp/deberta-v2-large-japanese-char-wwm)
# bert/ が無ければ Hugging Face から取得を試みる(要ネットワーク)。
import os
import sys
import wave
from pathlib import Path

import numpy as np

out = Path(sys.argv[1])
lines = sys.argv[2:]
base = Path(os.environ.get("UGC_SBV2_MODEL") or Path(__file__).parent / "voices" / "sbv2")
rate = float(os.environ.get("UGC_TTS_RATE") or 1.0)

from style_bert_vits2.constants import Languages
from style_bert_vits2.nlp import bert_models
from style_bert_vits2.tts_model import TTSModel

bert_dir = base / "bert"
bert_src = str(bert_dir) if bert_dir.is_dir() else "ku-nlp/deberta-v2-large-japanese-char-wwm"
bert_models.load_model(Languages.JP, bert_src)
bert_models.load_tokenizer(Languages.JP, bert_src)

model_file = next(base.glob("*.safetensors"))
model = TTSModel(
    model_path=model_file,
    config_path=base / "config.json",
    style_vec_path=base / "style_vectors.npy",
    device="cpu",
)

out.mkdir(parents=True, exist_ok=True)
for i, line in enumerate(lines):
    # length は「大きいほど遅い」パラメータなので話速の逆数を渡す
    sr, audio = model.infer(text=line, length=1.0 / rate)
    if audio.dtype != np.int16:
        audio = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open(str(out / f"seg{i}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(audio.tobytes())
