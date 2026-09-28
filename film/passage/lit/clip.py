# python3 clip.py frames_dir scene_dir out.mp4 t0 t1 fps : t*.png を並べて mp4 に。12.8 以降は最後のコマを保持し、署名を重ねる
import json, os, subprocess, sys, glob, shutil
FF = '/tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/ffx/node_modules/@ffmpeg-installer/linux-x64/ffmpeg'
fdir, sdir, out, t0, t1, fps = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), int(sys.argv[6])
frames = sorted(glob.glob(os.path.join(fdir, 't*.png')), key=lambda p: float(os.path.basename(p)[1:-4]))
byT = {round(float(os.path.basename(p)[1:-4]), 3): p for p in frames}
seq = os.path.join(fdir, '_seq'); shutil.rmtree(seq, ignore_errors=True); os.makedirs(seq)
n = int(round((t1 - t0) * fps)); last = None
for i in range(n + 1):
    t = round(t0 + i / fps, 3)
    cand = [k for k in byT if k <= t + 1e-6]
    src = byT[max(cand)] if cand else frames[0]
    os.symlink(src, os.path.join(seq, f'{i:05d}.png'))
W = int(subprocess.run([FF, '-i', frames[0]], capture_output=True, text=True).stderr.split('Video:')[1].split(',')[2].split('x')[0])
k = W / 1920
lk = json.load(open(os.path.join(sdir, 'lockup.json')))
S = json.load(open(os.path.join(sdir, 'scene.json')))
starts = [S['T_WM'] - t0, S['T_TG'] - t0]
cmd = [FF, '-loglevel', 'error', '-y', '-framerate', str(fps), '-i', os.path.join(seq, '%05d.png')]
flt = []; cur = '[0]'
for j, l in enumerate(lk):
    cmd += ['-loop', '1', '-framerate', str(fps), '-i', os.path.join(sdir, f'lockup{j}.png')]
    flt.append(f"[{j+1}]scale=iw*{k}:ih*{k},format=rgba,fade=in:st={starts[j]}:d=0.3:alpha=1[l{j}]")
    flt.append(f"{cur}[l{j}]overlay={round(l['x']*k)}:{round(l['y']*k)}:enable='gte(t,{starts[j]})':shortest=1[o{j}]"); cur = f'[o{j}]'
cmd += ['-filter_complex', ';'.join(flt), '-map', cur, '-frames:v', str(n + 1), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True); print('wrote', out)
