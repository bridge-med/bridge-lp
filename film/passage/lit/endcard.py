# python3 endcard.py frame.png scene_dir out.png : 止まった画に署名(BRIDGE・EXPAND CHOICES.)を重ねる
import json, os, subprocess, sys
FF = '/tmp/claude-0/-home-user-bridge-lp/7026e837-db39-5167-aac1-2cd70f309c8c/scratchpad/ffx/node_modules/@ffmpeg-installer/linux-x64/ffmpeg'
frame, sdir, out = sys.argv[1:4]
W = int(subprocess.run([FF, '-i', frame], capture_output=True, text=True).stderr.split('Video:')[1].split(',')[2].split('x')[0])
k = W / 1920; lk = json.load(open(os.path.join(sdir, 'lockup.json')))
cmd = [FF, '-loglevel', 'error', '-y', '-i', frame]; flt = []; cur = '[0]'
for j, l in enumerate(lk):
    cmd += ['-i', os.path.join(sdir, f'lockup{j}.png')]
    flt.append(f"[{j+1}]scale=iw*{k}:ih*{k}[l{j}]"); flt.append(f"{cur}[l{j}]overlay={round(l['x']*k)}:{round(l['y']*k)}[o{j}]"); cur = f'[o{j}]'
subprocess.run(cmd + ['-filter_complex', ';'.join(flt), '-map', cur, out], check=True)
