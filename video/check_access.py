#!/usr/bin/env python3
"""Veo / メディアモデルのアクセス確認 (生成しない＝課金なし)

使い方:
    export GEMINI_API_KEY="あなたの鍵"   # または GOOGLE_API_KEY
    python3 video/check_access.py

models 一覧を取得し、veo / imagen 系が利用可能かを判定する。
"""
from __future__ import annotations

import os
import sys

import requests

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"


def main() -> None:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY (または GOOGLE_API_KEY) が未設定です。")

    r = requests.get(f"{API_ROOT}/models?key={key}&pageSize=200", timeout=60)
    if r.status_code != 200:
        sys.exit(f"models 取得失敗 [{r.status_code}]: {r.text[:300]}\n"
                 "→ キーが無効、またはプロジェクト設定を確認してください。")

    models = r.json().get("models", [])
    names = [m.get("name", "").split("/")[-1] for m in models]
    veo = sorted(n for n in names if "veo" in n.lower())
    imagen = sorted(n for n in names if "imagen" in n.lower())

    print(f"[OK] キー有効。利用可能モデル {len(names)} 件")
    print(f"\nVeo 系: {veo or '（なし）'}")
    print(f"Imagen 系: {imagen or '（なし）'}")

    if veo:
        print("\n✅ Veo が利用可能です。`python3 video/veo_trial.py` で試作できます。")
    else:
        print("\n⚠️ Veo が一覧にありません。考えられる原因:")
        print("   - プロジェクトの課金(Paid tier)が未有効 … Veo は無料枠不可")
        print("   - リージョン/アカウントで未提供")
        print("   → 代替: TTS音声＋画像(Imagen)＋字幕で組む構成も可能です。")


if __name__ == "__main__":
    main()
