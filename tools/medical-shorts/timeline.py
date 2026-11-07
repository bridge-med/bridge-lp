#!/usr/bin/env python3
"""台本 → ナレーション音声(tools/ugc-video/tts.sh を再利用) → 実測の長さから時間割(timing.json)を作る。

使い方: python3 timeline.py <episode_dir> [--work <dir>] [--rate 1.0] [--reuse](既存の vo/*.wav を使い、音声化をしない)
  - 各文の音声は <work>/vo/segN.wav。長さは ffprobe で実測する
  - 各文の区間 = max(音声の長さ + gap_after_line, min)。区間の先頭で音声と字幕が同時に始まる
  - 合計が target_seconds に収まらなければ話速を変えて作り直す(最大2回。無限リトライはしない)
"""
import json, os, re, subprocess, sys, shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
TTS = HERE.parent / "ugc-video" / "tts.sh"

def dur(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(out.decode().strip())

def synth(lines, work, rate):
    vo = work / "vo"
    if vo.exists(): shutil.rmtree(vo)
    env = dict(os.environ, UGC_TTS_RATE=f"{rate:.2f}")
    for attempt in range(2):
        try:
            out = subprocess.run(["bash", str(TTS), str(work), *lines], check=True, env=env, timeout=900, capture_output=True, text=True).stdout
            m = re.search(r"エンジン: (\w+)", out)
            (work / "engine.txt").write_text(m.group(1) if m else "", encoding="utf-8")
            if all((vo / f"seg{i}.wav").exists() for i in range(len(lines))): return
        except subprocess.CalledProcessError as e:
            print(f"  tts.sh 失敗 (試行{attempt+1}):", e, file=sys.stderr)
        except subprocess.TimeoutExpired:
            print(f"  tts.sh タイムアウト (試行{attempt+1})", file=sys.stderr)
    raise SystemExit("ナレーション音声化に2回失敗。エンジン(VOICEVOX_URL / Open JTalk)を確認してください")

def main():
    ep = Path(sys.argv[1]).resolve()
    args = sys.argv[2:]
    work = Path(args[args.index("--work") + 1]).resolve() if "--work" in args else ep / "work"
    rate = float(args[args.index("--rate") + 1]) if "--rate" in args else float(os.environ.get("UGC_TTS_RATE", "1.0"))
    work.mkdir(parents=True, exist_ok=True)
    script = json.load(open(ep / "script.json", encoding="utf-8"))
    lines = [l["text"] for l in script["lines"]]
    lo, hi = script["target_seconds"]
    gap, hold = script["gap_after_line"], script["end_hold"]
    attempts = []
    for attempt in range(3):
        if "--reuse" in args and all((work / "vo" / f"seg{i}.wav").exists() for i in range(len(lines))):
            print("== 既存の音声を使う(--reuse) ==")
        else:
            print(f"== 音声化 (話速 {rate:.2f}) ==")
            synth(lines, work, rate)
        durs = [dur(work / "vo" / f"seg{i}.wav") for i in range(len(lines))]
        segs, t = [], 0.0
        for l, d in zip(script["lines"], durs):
            length = max(d + gap, l.get("min", 0))
            segs.append({"id": l["id"], "start": round(t, 3), "end": round(t + length, 3), "voice": round(d, 3), "cue": l["cue"]})
            t += length
        total = t + hold
        attempts.append({"rate": rate, "total": round(total, 2), "voice_total": round(sum(durs), 2)})
        print(f"  音声 {sum(durs):.1f}s / 区間合計 {t:.1f}s / 尺 {total:.1f}s (目標 {lo}〜{hi})")
        if lo <= total <= hi: break
        # 収まらなければ話速で調整(上げる=短く)。min の合計が下限を超える場合は hold で足す
        if total > hi: rate = round(min(1.3, rate * (sum(durs) + (total - hi)) / max(sum(durs), 1e-6) + 0.03), 2)
        else:
            hold += (lo - total); total = t + hold; print(f"  下限に届かないので終わりの静止を {hold:.1f}s に"); break
    else:
        print("警告: 3回で目標に収まらなかった。現状で続行(品質チェックで報告)", file=sys.stderr)
    fps = script["fps"]
    timing = {
        "episode": script["id"], "fps": fps, "rate": rate, "gap_after_line": gap, "end_hold": round(hold, 3),
        "total": round(total, 3), "total_frames": int(round(total * fps)),
        "segments": segs, "attempts": attempts,
        "engine": open(work / "engine.txt").read().strip() if (work / "engine.txt").exists() else "",
    }
    json.dump(timing, open(ep / "timing.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("timing.json ok:", timing["total"], "s", timing["total_frames"], "frames")

if __name__ == "__main__":
    main()
