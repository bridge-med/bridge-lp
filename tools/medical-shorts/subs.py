#!/usr/bin/env python3
"""timing.json + script.json + anchors.json → 字幕(ASS)。

  字幕(Sub)   … 各文の区間の先頭で音声と同時に出る。2 行まで・1 行 18 字まで・下の安全域(Shorts の UI を避ける)
  題(Title)   … script.json の title を持つ文で上に出す(フックと結論)
  札(Label)   … 断面の構造名。anchors.json の 1 コマごとの画面座標に置く(カメラが動いても対象に付いていく)
使い方: python3 subs.py <episode_dir>  → <episode_dir>/work/subs.ass と subs_stats.json
"""
import json, sys
from pathlib import Path

EP = Path(sys.argv[1]).resolve(); WORK = EP / "work"
S = json.load(open(EP / "script.json", encoding="utf-8")); T = json.load(open(EP / "timing.json", encoding="utf-8"))
A = json.load(open(WORK / "anchors.json", encoding="utf-8")) if (WORK / "anchors.json").exists() else {}
W, H, FPS = S["width"], S["height"], T["fps"]
SAFE = {"left": 110, "right": W - 110, "top": 240, "bottom": H - 420}   # Shorts/TikTok の UI と重ならない範囲
LABEL_BOTTOM = H - 700   # 札は字幕(下 2 行)の上に収める
FONT = "Noto Sans CJK JP"
SUB_SIZE, TITLE_SIZE, LABEL_SIZE = 64, 96, 48
MAX_CHARS, MAX_LINES = 18, 2

def ts(t):
    t = max(0.0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def ev(style, t0, t1, text, layer=0):
    return f"Dialogue: {layer},{ts(t0)},{ts(t1)},{style},,0,0,0,,{text}"

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{FONT},{SUB_SIZE},&H00FFFFFF,&H00FFFFFF,&H00202A3C,&H80000000,1,0,0,0,100,100,1,0,1,4,0,2,{SAFE['left']},{W - SAFE['right']},{H - SAFE['bottom']},1
Style: Title,{FONT},{TITLE_SIZE},&H00FFFFFF,&H00FFFFFF,&H00202A3C,&H80000000,1,0,0,0,100,100,2,0,1,5,0,8,{SAFE['left']},{W - SAFE['right']},{SAFE['top']},1
Style: Label,{FONT},{LABEL_SIZE},&H00FFFFFF,&H00FFFFFF,&H9A202A3C,&H9A202A3C,1,0,0,0,100,100,1,0,3,12,0,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
events, stats = [], {"subs": [], "labels": {}, "titles": []}
seg_by_id = {s["id"]: s for s in T["segments"]}
lines = S["lines"]
for i, line in enumerate(lines):
    seg = seg_by_id[line["id"]]
    t0 = seg["start"]; t1 = seg["end"] - 0.08
    text = line["sub"].replace("\n", "\\N")
    rows = line["sub"].split("\n")
    stats["subs"].append({"id": line["id"], "start": t0, "end": t1, "lines": len(rows), "max_chars": max(len(r) for r in rows), "text": line["sub"]})
    assert len(rows) <= MAX_LINES and all(len(r) <= MAX_CHARS for r in rows), f"字幕が長い: {line['id']} {rows}"
    events.append(ev("Sub", t0, t1, "{\\fad(120,120)}" + text))
    if line.get("title"):
        later_title = any(l.get("title") for l in lines[i + 1:])
        # 題は、その文の区間 + 次の文の区間まで残す(フック: 着地〜刺入)。最後の題(結論)は動画の終わりまで残す
        tt1 = (seg_by_id[lines[i + 1]["id"]]["end"] if i + 1 < len(lines) else T["total"]) if later_title else T["total"]
        events.append(ev("Title", t0 + 0.25, tt1 - 0.1, "{\\fad(200,200)}" + line["title"].replace("\n", "\\N"), layer=1))
        stats["titles"].append({"id": line["id"], "start": t0 + 0.25, "end": tt1 - 0.1, "text": line["title"]})
# 札: 1 コマごとの \pos。錨の少し上に置き、安全域に収める
for lab, a in A.items():
    frames = sorted(((int(k), v) for k, v in a["frames"].items()), key=lambda kv: kv[0])
    placed = 0
    for f, (x, y, z) in frames:
        if z <= 0: continue
        px = min(max(x, SAFE["left"] + 120), SAFE["right"] - 120); py = min(max(y - 70, SAFE["top"] + 40), LABEL_BOTTOM)
        t0 = (f - 1) / FPS; t1 = f / FPS
        fade = ""
        if f - a["start"] < 4: fade = "{\\alpha&H%02X&}" % int(255 * (1 - (f - a["start"] + 1) / 5))
        events.append(ev("Label", t0, t1, fade + "{\\pos(%d,%d)}%s" % (px, py, lab), layer=2)); placed += 1
    stats["labels"][lab] = {"frames": placed, "start": a["start"] / FPS, "end": a["end"] / FPS}
(WORK / "subs.ass").write_text(header + "\n".join(events) + "\n", encoding="utf-8")
stats.update({"font": FONT, "sub_size": SUB_SIZE, "title_size": TITLE_SIZE, "label_size": LABEL_SIZE, "safe": SAFE, "max_chars": MAX_CHARS, "max_lines": MAX_LINES, "events": len(events)})
json.dump(stats, open(WORK / "subs_stats.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("subs ok:", len(events), "events;", len(stats["subs"]), "subs;", len(A), "labels;", len(stats["titles"]), "titles")
