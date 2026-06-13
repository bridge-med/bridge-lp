#!/usr/bin/env python3
"""Veo 3 ショート動画 試作スクリプト (Gemini REST API / SDK・ffmpeg 不要)

使い方:
    export GEMINI_API_KEY="あなたの鍵"          # または GOOGLE_API_KEY
    python3 video/veo_trial.py "プロンプト文" \
        --aspect 9:16 --model veo-3.0-fast-generate-001 --out video/out.mp4

Veo 3 は音声・効果音込みの完成MP4を返すので、これ単体でショート動画が成立します。
依存は requests のみ。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import requests

API_ROOT = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_PROMPT = (
    "A warm, hopeful 8-second vertical clip for a medical recruitment brand: "
    "soft morning light in a modern Japanese clinic, a friendly nurse smiling at "
    "the camera, gentle cinematic motion, calm uplifting background music."
)


def get_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY (または GOOGLE_API_KEY) が未設定です。")
    return key


def submit(key: str, model: str, prompt: str, aspect: str, negative: str | None) -> str:
    url = f"{API_ROOT}/models/{model}:predictLongRunning?key={key}"
    params: dict = {"aspectRatio": aspect}
    if negative:
        params["negativePrompt"] = negative
    body = {"instances": [{"prompt": prompt}], "parameters": params}
    r = requests.post(url, json=body, timeout=60)
    if r.status_code != 200:
        sys.exit(f"submit 失敗 [{r.status_code}]: {r.text}")
    name = r.json().get("name")
    if not name:
        sys.exit(f"operation name が取れません: {r.text}")
    print(f"[submit] OK -> {name}")
    return name


def poll(key: str, op_name: str, interval: int = 10, timeout: int = 600) -> dict:
    url = f"{API_ROOT}/{op_name}?key={key}"
    waited = 0
    while waited < timeout:
        r = requests.get(url, timeout=60)
        if r.status_code != 200:
            sys.exit(f"poll 失敗 [{r.status_code}]: {r.text}")
        data = r.json()
        if data.get("done"):
            if "error" in data:
                sys.exit(f"生成エラー: {json.dumps(data['error'], ensure_ascii=False)}")
            print("[poll] 生成完了")
            return data
        print(f"[poll] 生成中... ({waited}s)")
        time.sleep(interval)
        waited += interval
    sys.exit("タイムアウト: 生成が時間内に終わりませんでした。")


def extract_uri(data: dict) -> str:
    # 期待構造: response.generateVideoResponse.generatedSamples[0].video.uri
    try:
        resp = data["response"]
        samples = (
            resp.get("generateVideoResponse", {}).get("generatedSamples")
            or resp.get("generatedSamples")
            or resp.get("videos")
        )
        sample = samples[0]
        video = sample.get("video", sample)
        uri = video.get("uri") or video.get("videoUri")
        if uri:
            return uri
    except Exception:
        pass
    sys.exit("動画URIが取れませんでした。レスポンス全体:\n" + json.dumps(data, ensure_ascii=False, indent=2))


def download(key: str, uri: str, out: str) -> None:
    sep = "&" if "?" in uri else "?"
    url = f"{uri}{sep}key={key}" if "key=" not in uri else uri
    r = requests.get(url, timeout=300, stream=True)
    if r.status_code != 200:
        sys.exit(f"ダウンロード失敗 [{r.status_code}]: {r.text[:300]}")
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "wb") as f:
        for chunk in r.iter_content(chunk_size=1 << 16):
            f.write(chunk)
    size = os.path.getsize(out)
    print(f"[done] 保存しました: {out} ({size/1_000_000:.2f} MB)")


def main() -> None:
    p = argparse.ArgumentParser(description="Veo 3 ショート動画 試作")
    p.add_argument("prompt", nargs="?", default=DEFAULT_PROMPT, help="生成プロンプト")
    p.add_argument("--model", default="veo-3.0-fast-generate-001",
                   help="veo-3.0-generate-001 / veo-3.0-fast-generate-001 / veo-2.0-generate-001")
    p.add_argument("--aspect", default="9:16", help="9:16 (縦/ショート) または 16:9")
    p.add_argument("--negative", default=None, help="ネガティブプロンプト")
    p.add_argument("--out", default="video/out.mp4", help="出力先")
    args = p.parse_args()

    key = get_key()
    print(f"[config] model={args.model} aspect={args.aspect}")
    print(f"[config] prompt={args.prompt[:80]}...")
    op = submit(key, args.model, args.prompt, args.aspect, args.negative)
    data = poll(key, op)
    uri = extract_uri(data)
    download(key, uri, args.out)


if __name__ == "__main__":
    main()
