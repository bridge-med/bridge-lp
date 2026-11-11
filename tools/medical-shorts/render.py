#!/usr/bin/env python3
"""scene.blend を Cycles(CPU)で 1 コマずつ描く。途中再開できる(既にあるコマは飛ばす)。

使い方: python3 render.py <episode_dir> [--from 1] [--to N] [--samples 16] [--percent 100] [--res 720x1280] [--timelimit 5] [--probe f1,f2,...]
  - 出力: <episode_dir>/work/frames/%05d.png
  - --probe は指定コマだけ描いて 1 コマの所要時間を出す(全体の見積もり用)
"""
import json, sys, time
from pathlib import Path
import bpy

EP = Path(sys.argv[1]).resolve(); ARGS = sys.argv[2:]
def arg(n, d=None): return ARGS[ARGS.index(n) + 1] if n in ARGS else d
WORK = EP / "work"; FRAMES = WORK / "frames"; FRAMES.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(WORK / "scene.blend"))
sc = bpy.context.scene
sc.cycles.samples = int(arg("--samples", sc.cycles.samples))
sc.render.resolution_percentage = int(arg("--percent", 100))
if arg("--res"):  # 例 720x1280(ffmpeg で最終の 1080x1920 に拡大する)
    sc.render.resolution_x, sc.render.resolution_y = (int(v) for v in arg("--res").split("x")); sc.render.resolution_percentage = 100
sc.cycles.time_limit = float(arg("--timelimit", 0))
sc.render.use_persistent_data = True  # コマ間でシーンのデータ(BVH 等)を持ち越し、1 コマごとの準備を減らす  # 1 コマの上限秒(0=なし)。超えたら打ち切って denoise する
sc.render.image_settings.file_format = "PNG"
probe = arg("--probe")
frames = [int(f) for f in probe.split(",")] if probe else list(range(int(arg("--from", sc.frame_start)), int(arg("--to", sc.frame_end)) + 1))
log = open(WORK / ("probe.log" if probe else "render.log"), "a")
t_all = time.time(); done = 0
for f in frames:
    out = FRAMES / (f"probe_{f:05d}.png" if probe else f"{f:05d}.png")
    if out.exists() and not probe: continue
    sc.frame_set(f); sc.render.filepath = str(out)
    t = time.time(); bpy.ops.render.render(write_still=True); dt = time.time() - t
    done += 1
    log.write(f"{f} {dt:.2f}s\n"); log.flush()
    if probe: print(f"frame {f}: {dt:.1f}s", flush=True)
json.dump({"frames": len(frames), "rendered": done, "seconds": round(time.time() - t_all, 1), "samples": sc.cycles.samples, "percent": sc.render.resolution_percentage, "res": [sc.render.resolution_x, sc.render.resolution_y], "timelimit": sc.cycles.time_limit},
          open(WORK / ("probe.json" if probe else "render_stats.json"), "w"))
print("render ok:", done, "frames in", round(time.time() - t_all), "s")
