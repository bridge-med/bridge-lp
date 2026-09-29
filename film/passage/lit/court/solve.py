import sys, json
from PIL import Image
import numpy as np
def lin(c): c = c / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def Ystar(Y): Y = min(max(Y, 1e-6), 10); return 116 * Y ** (1 / 3) - 16 if Y > 0.008856 else 903.3 * Y
CL = {'court-back sun': (90, 170, 230), 'blade-front sun': (230, 200, 120), 'parapet sun': (120, 200, 120), 'court-right sun': (60, 200, 200),
      'court-left shade': (18, 54, 54), 'blade-front shade': (103, 90, 54), 'blade-side shade': (54, 40, 90), 'twin shade': (90, 36, 36), 'hall shade': (76, 76, 76), 'parapet shade': (54, 90, 54)}
res = {}
for t in ('10.800', '12.800'):
    a = np.asarray(Image.open(f'runs/r2/sun-t{t}.png').convert('RGB')).astype(float); b = np.asarray(Image.open(f'runs/r2/sky-t{t}.png').convert('RGB')).astype(float)
    Ya = (lin(a) @ np.array([0.2126, 0.7152, 0.0722])) * 8; Yb = (lin(b) @ np.array([0.2126, 0.7152, 0.0722])) * 8
    cm = np.asarray(Image.open(f'aud/H/audit-t{t}.png').convert('RGB').resize((a.shape[1], a.shape[0]), Image.NEAREST)).astype(int)
    for n, col in CL.items():
        m = np.all(np.abs(cm - np.array(col)) <= 2, -1)
        e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
        if e.sum() < 30: continue
        B = float(np.median(Yb[e])); A = (float(np.median(Ya[e])) - B) / 3.4
        res[(t, n)] = (A, B)
        print(t, f'{n:18s} per-sun {A:.4f}  per-sky {B:.4f}   (clip check sun-render max {Ya[e].max():.2f})')
court = res[('12.800', 'court-back sun')]
for K in (0.6, 1.0, 1.5, 2.0, 2.5):
    S = (0.955 - K * court[1]) / court[0]
    row = ' '.join(f'{n.split()[0][:10]}{"*" if "shade" in n else ""}@{t[:4]}={Ystar(S * A + K * B):.0f}' for (t, n), (A, B) in res.items())
    print(f'sky {K:.1f} -> sun {S:.2f} | {row}')
