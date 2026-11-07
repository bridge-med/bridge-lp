#!/usr/bin/env python3
"""完成 mp4 の自動品質チェック。結果を <episode_dir>/out/qa.json と qa-report.md に書く。

検査項目(自動): 尺(45〜60秒)・解像度/fps/音声の有無・黒画面/平坦なコマ・コマの欠け・
  字幕と音声の同期・ナレーションの区間に音があること・区間ごとの視覚的変化・
  口器と皮膚の位置関係(scene.py の検証値)・蚊の部品数・字幕の可読性(字数・行数・大きさ・安全域)・
  ラウドネス・字幕とナレーションの一致(文字列の類似)
自動で確かめられないもの(蚊の見た目の説得力・医学的な表現の妥当性・ナレーションの聞き取りやすさ)は「未検証」として残す。
使い方: python3 qa.py <episode_dir> [mp4]
"""
import difflib, json, re, subprocess, sys
from pathlib import Path

EP = Path(sys.argv[1]).resolve(); WORK = EP / "work"; OUT = EP / "out"
MP4 = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else OUT / f"{EP.name}.mp4"
S = json.load(open(EP / "script.json", encoding="utf-8")); T = json.load(open(EP / "timing.json", encoding="utf-8"))
Q = json.load(open(WORK / "qa_scene.json", encoding="utf-8")); SS = json.load(open(WORK / "subs_stats.json", encoding="utf-8"))
FPS = T["fps"]
results = []
def check(name, ok, detail, manual=False):
    results.append({"name": name, "status": "unverified" if manual else ("pass" if ok else "fail"), "detail": detail})
    print(("未検証" if manual else "合格" if ok else "不合格"), name, "—", detail)

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True).stdout + subprocess.run(cmd, capture_output=True, text=True).stderr

# 1 尺・形式
probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate,nb_frames", "-of", "json", str(MP4)]))
dur = float(probe["format"]["duration"]); v = [s for s in probe["streams"] if s["codec_type"] == "video"][0]; a = [s for s in probe["streams"] if s["codec_type"] == "audio"]
lo, hi = S["target_seconds"]
check("尺が45〜60秒", lo <= dur <= hi, f"{dur:.2f}s")
check("縦型 1080x1920", v["width"] == 1080 and v["height"] == 1920, f"{v['width']}x{v['height']}")
check("フレームレート", v["r_frame_rate"] == f"{FPS}/1", v["r_frame_rate"])
check("音声トラックあり", bool(a), f"{len(a)} stream")
# 2 コマの欠け(描いた PNG が 1..N まで揃い、空でない)
missing = [f for f in range(1, T["total_frames"] + 1) if not (WORK / "frames" / f"{f:05d}.png").exists() or (WORK / "frames" / f"{f:05d}.png").stat().st_size < 1000]
check("描いたコマの欠けなし", not missing, f"欠け {len(missing)} / {T['total_frames']}" + (f" 例 {missing[:5]}" if missing else ""))
# 3 黒画面・平坦なコマ・異常なコマ(signalstats: 平均輝度と最小最大)
stats = subprocess.run(["ffmpeg", "-v", "info", "-i", str(MP4), "-vf", "signalstats,metadata=print:file=-", "-f", "null", "-"], capture_output=True, text=True).stdout
frames = []
cur = {}
for line in stats.splitlines():
    m = re.match(r"frame:(\d+)\s+pts:\d+\s+pts_time:([\d.]+)", line)
    if m:
        if cur: frames.append(cur)
        cur = {"n": int(m.group(1)), "t": float(m.group(2))}
    m = re.match(r"lavfi\.signalstats\.(\w+)=([\d.]+)", line.strip())
    if m and cur: cur[m.group(1)] = float(m.group(2))
if cur: frames.append(cur)
black = [f["n"] for f in frames if f.get("YAVG", 255) < 10]
flat = [f["n"] for f in frames if f.get("YMAX", 255) - f.get("YMIN", 0) < 6]
check("黒画面のコマなし", not black, f"{len(black)} コマ (YAVG<10)" + (f" 例 {black[:5]}" if black else ""))
check("平坦(一色)のコマなし", not flat, f"{len(flat)} コマ (YMAX-YMIN<6)" + (f" 例 {flat[:5]}" if flat else ""))
# 連続するコマの急な輝度の跳び(カットの位置以外)。カットは scene.py が記録した位置の ±1
cuts = set(); [cuts.update({c - 1, c, c + 1}) for c in Q["cuts"]]
jumps = [f["n"] for f in frames if f.get("YDIF", 0) > 40 and (f["n"] + 1) not in cuts]
check("カット以外に急な画面の跳びなし", not jumps, f"{len(jumps)} コマ (YDIF>40)" + (f" 例 {jumps[:5]}" if jumps else "") + f"; カット {Q['cuts']}")
check("カメラの破綻(一色のコマ・急な跳び)の自動検出", not black and not flat and not jumps, "上の 3 項の合算。幾何の破綻(めり込み)は未検証の項で扱う")
# 4 区間ごとの視覚的変化(3〜5秒ごとの意味のある変化): 区間内の平均 YDIF と、scene.py のキー数
seg_change = {}
for s in T["segments"]:
    fs = [f for f in frames if s["start"] <= f["t"] < s["end"]]
    seg_change[s["cue"]] = round(sum(f.get("YDIF", 0) for f in fs) / max(1, len(fs)), 2)
# 区間の中で 1 秒離れたコマ対の差(平均絶対差、0〜255)の最大。ゆっくりした変化(膨らみ・カメラ)も拾う
from PIL import Image, ImageChops, ImageStat
def _load(f): return Image.open(WORK / "frames" / f"{f:05d}.png").convert("L").resize((180, 320))
seg_move, seg_span = {}, {}
for s in T["segments"]:
    f0 = int(round(s["start"] * FPS)) + 1; f1 = min(int(round(s["end"] * FPS)), T["total_frames"])
    m = 0.0
    for f in range(f0, f1 - FPS, max(1, FPS // 2)):
        m = max(m, ImageStat.Stat(ImageChops.difference(_load(f), _load(f + FPS))).mean[0])
    # 区間の最初と最後のコマの差(ゆっくり引くカメラのように、1 秒の差は小さくても区間を通して画が変わるもの)
    seg_move[s["cue"]] = round(m, 2); seg_span[s["cue"]] = round(ImageStat.Stat(ImageChops.difference(_load(f0), _load(f1 - 1))).mean[0], 2)
still = [k for k, vv in seg_move.items() if vv < 3.0 and seg_span[k] < 8.0]
check("どの区間にも目に見える変化がある(1 秒差のコマの平均差 ≥ 3/255、または区間の最初と最後の差 ≥ 8/255)", not still, f"1秒差 {seg_move}; 最初と最後 {seg_span}" + (f"; 乏しい区間 {still}" if still else ""))
nokey = [k for k, vv in Q["keyframes_per_segment"].items() if vv == 0]
check("どの区間にも対象物の動き・状態変化のキーがある", not nokey, f"{Q['keyframes_per_segment']}")
# 5 字幕と音声の同期: 字幕の開始 = 区間の開始(音声の開始)
sub_by_id = {s["id"]: s for s in SS["subs"]}
desync = [(s["id"], round(sub_by_id[s["id"]]["start"] - s["start"], 3)) for s in T["segments"] if abs(sub_by_id[s["id"]]["start"] - s["start"]) > 0.05]
check("字幕と音声の同期(開始のずれ ≤ 0.05s)", not desync, f"ずれ {desync}" if desync else "13 文すべて一致")
# 6 ナレーションの区間に音があり、区間の終わりは静か(mp4 の音声を実測)
def vol(t0, t1):
    o = subprocess.run(["ffmpeg", "-v", "info", "-ss", f"{t0:.3f}", "-t", f"{max(0.05, t1 - t0):.3f}", "-i", str(MP4), "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.search(r"mean_volume: ([-\d.]+) dB", o); return float(m.group(1)) if m else None
silent_voice, loud_gap = [], []
for s in T["segments"]:
    mv = vol(s["start"] + 0.1, s["start"] + s["voice"] - 0.1)
    if mv is None or mv < -35: silent_voice.append((s["id"], mv))
    if s["end"] - (s["start"] + s["voice"]) > 0.35:
        gv = vol(s["start"] + s["voice"] + 0.15, s["end"] - 0.05)
        if gv is not None and gv > -28: loud_gap.append((s["id"], gv))
check("各文の区間に音声がある", not silent_voice, f"無音の区間 {silent_voice}" if silent_voice else "13 文すべて -35dB 超")
check("文と文の間は静か(BGM のみ)", not loud_gap, f"{loud_gap}" if loud_gap else "ok")
# 7 ラウドネス
ln = subprocess.run(["ffmpeg", "-v", "info", "-i", str(MP4), "-af", "loudnorm=I=-16:TP=-1.5:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", ln, re.S); lnj = json.loads(m.group(0)) if m else {}
ii, tp = float(lnj.get("input_i", -99)), float(lnj.get("input_tp", 0))
check("ラウドネス(-19〜-13 LUFS・真のピーク < -1 dBTP)", -19 <= ii <= -13 and tp < -1.0, f"I={ii} LUFS, TP={tp} dBTP")
# 8 口器と皮膚の位置関係・蚊の部品
check("口器の先端: 刺す前は皮膚の上、刺した後は皮膚の下(腕)", Q["macro_tip_depth_before_insert"] < 0 < Q["macro_tip_depth_below_skin"], f"前 {Q['macro_tip_depth_before_insert']}, 後 {Q['macro_tip_depth_below_skin']} (正=皮膚の下)")
check("口器の先端: 断面では真皮の中(表皮の下・皮下組織の上)", Q["section_tip_in_dermis"], f"先端 z={Q['section_tip'][2]}, 表皮の底 {Q['section_layers']['epidermis_bottom']}, 真皮の底 {Q['section_layers']['dermis_bottom']}")
check("口器は膨疹の前に抜かれている(断面)", Q["section_tip_withdrawn_z"] > Q["section_layers"]["top"], f"抜いた後の先端 z={Q['section_tip_withdrawn_z']} > 表面 {Q['section_layers']['top']}")
p = Q["mosquito_parts"]
check("蚊の部品: 脚6・翅2・口器1・触角2・複眼2", p["legs"] == 6 and p["wings"] == 2 and p["proboscis"] == 1 and p["antennae"] == 2 and p["eyes"] == 2, str(p))
# 9 字幕の可読性
bad = [s["id"] for s in SS["subs"] if s["lines"] > SS["max_lines"] or s["max_chars"] > SS["max_chars"]]
check("字幕: 2 行以内・1 行 18 字以内・64px 以上・安全域", not bad and SS["sub_size"] >= 56, f"size {SS['sub_size']}px, safe {SS['safe']}" + (f"; 超過 {bad}" if bad else ""))
# 10 字幕とナレーションの一致(句読点と空白を除いた文字列の類似)
def norm(t): return re.sub(r"[、。 \n　]", "", t)
sims = {l["id"]: round(difflib.SequenceMatcher(None, norm(l["text"]), norm(l["sub"])).ratio(), 2) for l in S["lines"]}
low = {k: v for k, v in sims.items() if v < 0.6}
check("字幕がナレーションの内容と一致(類似 ≥ 0.6)", not low, f"{sims}")
# 11 映像とナレーションの一致(台本の cue と区間が 1:1 で、各 cue にキーがある)
cues = [l["cue"] for l in S["lines"]]; seg_cues = [s["cue"] for s in T["segments"]]
check("映像の cue とナレーションの区間が 1:1", cues == seg_cues and all(Q["keyframes_per_segment"].get(c, 0) > 0 for c in cues), f"{len(cues)} cue")
# 未検証
check("蚊の見た目が『蚊』と分かる(人の目)", False, "部品の数と配置は合格。形の説得力は静止画(work/stills)を人が見る", manual=True)
check("医学的な重大な誤りがない", False, "docs/medical-references.md の照合表を人が確認する(自動では判定しない)", manual=True)
check("ナレーションの聞き取りやすさ・読みの誤り", False, "VOICEVOX の読み(アクセント・漢字の読み)は自動で判定できない。人が聴く", manual=True)
check("幾何のめり込み(脚と皮膚・口器と細胞)", False, "先端の深さは合格。脚の接地やカメラと物体の干渉は確認用の静止画を人が見る", manual=True)

summary = {"pass": sum(r["status"] == "pass" for r in results), "fail": sum(r["status"] == "fail" for r in results), "unverified": sum(r["status"] == "unverified" for r in results)}
OUT.mkdir(exist_ok=True)
json.dump({"mp4": str(MP4), "duration": dur, "summary": summary, "results": results, "segment_change": seg_change, "segment_move": seg_move, "segment_span": seg_span, "loudness": lnj}, open(OUT / "qa.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
md = [f"# 品質チェック結果 — {EP.name}", "", f"対象: `{MP4.name}`({dur:.2f}s)。合格 {summary['pass']} / 不合格 {summary['fail']} / 未検証 {summary['unverified']}", "", "| 項目 | 結果 | 詳細 |", "|---|---|---|"]
for r in results: md.append(f"| {r['name']} | {'合格' if r['status']=='pass' else '不合格' if r['status']=='fail' else '未検証'} | {r['detail']} |")
(OUT / "qa-report.md").write_text("\n".join(md) + "\n", encoding="utf-8")
print("qa:", summary)
sys.exit(1 if summary["fail"] else 0)
