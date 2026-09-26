"""台本(timeline.js の voice)を Gemini 3.8 Flash TTS で読み上げ、voice/ に WAV で置く。

APIキーは環境変数 GEMINI_API_KEY から読む(チャット・ファイル・コマンドラインに書かない)。
同じ文・声・演出の組は作り直さない(voice/ にある WAV を使い回す)。
前後の無音は切り落とすので、置いた拍から声が始まる。

使い方:
  python3 make_voice.py                                  台本の全行を作り、長さを拍で一覧する
  python3 make_voice.py --samples Sulafat,Schedar,Charon  声の聞き比べ(voice/samples/ に1行目を各声で)
"""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "voice")
URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

src = open(os.path.join(HERE, "timeline.js"), encoding="utf-8").read()
src = re.sub(r"^\s*//.*$", "", src, flags=re.M)
TL = json.loads(src[src.index("{"): src.rindex("}") + 1])
V = TL["voice"]
BEAT = 60 / TL["bpm"]


def tts(text, voice, style):
    """1行を読み上げて WAV のバイト列を返す。"""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY が環境変数にありません。環境の設定に足してから、新しいセッションで走らせてください。")
    content = {"type": "text", "text": text}
    if style:
        content["annotations"] = [{"type": "speech_metadata", "style": style}]
    body = {
        "model": V["model"],
        "input": [{"type": "user_input", "content": [content]}],
        "response_format": {"type": "audio", "mime_type": "audio/wav"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }
    # キーはコマンドラインに載せない(ヘッダーを 0600 の一時ファイルから読ませる)
    fd, hdr = tempfile.mkstemp()
    try:
        with os.fdopen(fd, "w") as fh:
            fh.write(f"x-goog-api-key: {key}\n")
        r = subprocess.run(
            ["curl", "-sS", "-m", "180", "-H", f"@{hdr}", "-H", "Content-Type: application/json",
             "--data-binary", "@-", URL],
            input=json.dumps(body).encode(), capture_output=True,
        )
    finally:
        os.unlink(hdr)
    if r.returncode:
        sys.exit(f"curl failed: {r.stderr.decode()[:300]}")
    resp = json.loads(r.stdout)
    if "error" in resp:
        sys.exit(f"TTS error: {resp['error'].get('status')} {resp['error'].get('message')}")
    audio = [c for s in resp.get("steps", []) if s.get("type") == "model_output"
             for c in s.get("content", []) if c.get("type") == "audio"]
    if not audio:
        sys.exit("応答に音声がありません: " + json.dumps(resp, ensure_ascii=False)[:400])
    data = base64.b64decode(audio[-1]["data"])
    if data[:4] != b"RIFF":  # 生の PCM(24kHz・モノラル・16bit)で返ったときは WAV に包む
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(data)
        data = buf.getvalue()
    return data


def trim(wav_bytes, pad=0.03):
    """前後の無音を切る。戻り値は (WAV バイト列, 秒)。"""
    with wave.open(io.BytesIO(wav_bytes)) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, ch)
    mono = np.abs(x.astype(np.float32)).max(axis=1)
    loud = np.where(mono > mono.max() * 0.02)[0]
    a = max(0, loud[0] - int(pad * sr)) if len(loud) else 0
    b = min(len(x), loud[-1] + int(pad * sr)) if len(loud) else len(x)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(sw)
        w.setframerate(sr)
        w.writeframes(x[a:b].tobytes())
    return buf.getvalue(), (b - a) / sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--samples", default=None, help="聞き比べる声の名前(カンマ区切り)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    if args.samples:
        line = V["lines"][0]
        d = os.path.join(OUT, "samples")
        os.makedirs(d, exist_ok=True)
        for name in args.samples.split(","):
            data, sec = trim(tts(line.get("say", line["text"]), name.strip(), line.get("style", V["style"])))
            open(os.path.join(d, f"{name.strip()}.wav"), "wb").write(data)
            print(f"{name.strip():14s} {sec:5.2f}s")
        return

    manifest = {}
    for line in V["lines"]:
        say, style = line.get("say", line["text"]), line.get("style", V["style"])
        h = hashlib.sha1(json.dumps([V["model"], V["name"], style, say], ensure_ascii=False).encode()).hexdigest()[:8]
        name = f"{line['id']}-{h}.wav"
        path = os.path.join(OUT, name)
        if not os.path.exists(path):
            data, _ = trim(tts(say, V["name"], style))
            open(path, "wb").write(data)
            for old in os.listdir(OUT):  # 同じ行の古い版は消す
                if old.startswith(line["id"] + "-") and old != name:
                    os.remove(os.path.join(OUT, old))
        with wave.open(path) as w:
            sec = w.getnframes() / w.getframerate()
        manifest[line["id"]] = {"file": name, "beat": line["beat"], "seconds": round(sec, 3),
                                "end_beat": round(line["beat"] + sec / BEAT, 2)}

    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), ensure_ascii=False, indent=1)
    # 拍の一覧と重なり(次の行が始まる前に読み終わるか)
    rows = sorted(manifest.items(), key=lambda kv: kv[1]["beat"])
    for i, (k, m) in enumerate(rows):
        nxt = rows[i + 1][1]["beat"] if i + 1 < len(rows) else TL["beats"]
        flag = "" if m["end_beat"] <= nxt else f"  ← 次の行({nxt}拍)と {m['end_beat'] - nxt:.2f}拍重なる"
        print(f"{k:10s} {m['beat']:6.2f} → {m['end_beat']:6.2f}拍 ({m['seconds']:.2f}s){flag}")


if __name__ == "__main__":
    main()
