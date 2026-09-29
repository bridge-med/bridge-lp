# measure.py render.png audit-map.png(240x135 class map of the same time) scene.json : L* per surface class (unpainted), stroke cores vs tokens, lockup boxes, clipping
import sys, json, math
from PIL import Image, ImageDraw
import numpy as np
rp, mp, sp = sys.argv[1:4]
im = np.asarray(Image.open(rp).convert('RGB')).astype(float); H, W, _ = im.shape
cm = np.asarray(Image.open(mp).convert('RGB').resize((W, H), Image.NEAREST)).astype(int)
S = json.load(open(sp)); M = S['mark']; k = W / 1920
def lin(c): c = c / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lab(rgb):
    r, g, b = lin(rgb[..., 0]), lin(rgb[..., 1]), lin(rgb[..., 2])
    X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    return np.stack([116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))], -1)
L = lab(im)
# stroke mask (dilated) to exclude paint from surface stats, and core mask for colour checks
sm = Image.new('L', (W, H), 0); core = {'N': Image.new('L', (W, H), 0), 'S': Image.new('L', (W, H), 0)}
for key in ('N', 'S1', 'S2'):
    pts = [(k * (M['cx'] + M['s'] * (u - 120)), k * (M['cy'] + M['s'] * (v - 50))) for u, v in M[key]]
    ImageDraw.Draw(sm).line(pts, fill=255, width=max(3, int(2 * M['hw'] * M['s'] * k + 8 * k)))
    ImageDraw.Draw(core['N' if key == 'N' else 'S']).line(pts, fill=255, width=max(1, int(M['hw'] * M['s'] * k * 0.8)))
sm = np.asarray(sm) > 0
CL = {'court-back sun': (90, 170, 230), 'blade-front sun': (230, 200, 120), 'parapet sun': (120, 200, 120), 'court-right sun': (60, 200, 200),
      'court-left shade': (int(40 * .45), int(120 * .45), int(120 * .45)), 'blade-front shade': (int(230 * .45), int(200 * .45), int(120 * .45)),
      'blade-side shade': (int(120 * .45), int(90 * .45), int(200 * .45)), 'twin shade': (int(200 * .45), int(80 * .45), int(80 * .45)), 'hall shade': (int(170 * .45),) * 3,
      'parapet shade': (int(120 * .45), int(200 * .45), int(120 * .45)), 'court-back shade': (int(90 * .45), int(170 * .45), int(230 * .45))}
out = {}
# erode class regions by comparing with 4-neighbours so edges are excluded
def region(col):
    m = np.all(np.abs(cm - np.array(col)) <= 2, -1)
    e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]
    return e & ~sm
for name, col in CL.items():
    r = region(col)
    if r.sum() > 30: out[name] = {'n': int(r.sum()), 'L*med': round(float(np.median(L[..., 0][r])), 1), 'p10': round(float(np.percentile(L[..., 0][r], 10)), 1), 'p90': round(float(np.percentile(L[..., 0][r], 90)), 1),
                                'b*med': round(float(np.median(L[..., 2][r])), 1), 'rgb': [int(v) for v in np.median(im[r], 0)]}
# mark box / upper band
mb = [int(k * (min(M['cx'] + M['s'] * (u - 120) for key in ('N', 'S1', 'S2') for u, v in M[key]) - 15)), int(k * (max(M['cx'] + M['s'] * (u - 120) for key in ('N', 'S1', 'S2') for u, v in M[key]) + 15)),
      int(k * (min(M['cy'] + M['s'] * (v - 50) for key in ('N', 'S1', 'S2') for u, v in M[key]) - 15)), int(k * (max(M['cy'] + M['s'] * (v - 50) for key in ('N', 'S1', 'S2') for u, v in M[key]) + 15))]
out['markbox L*mean'] = round(float(L[mb[2]:mb[3], mb[0]:mb[1], 0].mean()), 1)
out['upper L*mean'] = round(float(L[:int(0.52 * H), :, 0].mean()), 1)
out['frame L*mean'] = round(float(L[..., 0].mean()), 1)
out['clipped>253 %'] = round(float((im.max(-1) > 253).mean() * 100), 3)
def de00(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cb = (C1 + C2) / 2; G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2; C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1 = math.degrees(math.atan2(b1, a1p)) % 360; h2 = math.degrees(math.atan2(b2, a2p)) % 360
    dL = L2 - L1; dC = C2p - C1p; dh = h2 - h1
    if C1p * C2p == 0: dh = 0
    elif dh > 180: dh -= 360
    elif dh < -180: dh += 360
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2)); Lb = (L1 + L2) / 2; Cbp = (C1p + C2p) / 2
    hb = (h1 + h2) / 2 if abs(h1 - h2) <= 180 else (h1 + h2 + 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb)) + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.2 * math.cos(math.radians(4 * hb - 63))
    SL = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2); SC = 1 + 0.045 * Cbp; SH = 1 + 0.015 * Cbp * T
    RT = -2 * math.sin(math.radians(60 * math.exp(-((hb - 275) / 25) ** 2))) * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    return math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
tok = {'N': '#16233E', 'S': '#A98F63'}
import os
for key, mf in (('N', 'maskN.png'), ('S', 'maskS.png')):
    mk = Image.open(os.path.join(os.path.dirname(sp), mf)).convert('L').resize((W, H), Image.BOX)
    c = np.asarray(mk) > 250
    e = c.copy(); e[1:] &= c[:-1]; e[:-1] &= c[1:]; e[:, 1:] &= c[:, :-1]; e[:, :-1] &= c[1:, :] if False else e[:, :-1] & c[:, 1:]
    c = e
    if c.sum() < 5: continue
    labs = lab(im[c].reshape(-1, 1, 3)).reshape(-1, 3); med = np.median(labs, 0)
    h = tok[key].lstrip('#'); t = lab(np.array([[[int(h[i:i + 2], 16) for i in (0, 2, 4)]]], float)).reshape(3)
    d = [de00(t, l) for l in labs]
    out[f'stroke {key}'] = {'n': int(c.sum()), 'median Lab': [round(float(v), 1) for v in med], 'token Lab': [round(float(v), 1) for v in t], 'dE00 of median': round(de00(t, med), 2), 'dE00 p90': round(float(np.percentile(d, 90)), 2), 'L* p10-p90': [round(float(np.percentile(labs[:, 0], 10)), 1), round(float(np.percentile(labs[:, 0], 90)), 1)]}
lk = json.load(open(sp.replace('scene.json', 'lockup.json')))
for j, l in enumerate(lk):
    b = L[int(k * l['y']):int(k * (l['y'] + l['h'])), int(k * l['x']):int(k * (l['x'] + l['w'])), 0]
    out[f'lockup{j} L*'] = [round(float(b.mean()), 1), 'range', round(float(np.percentile(b, 2)), 1), round(float(np.percentile(b, 98)), 1)]
print(json.dumps(out, ensure_ascii=False, indent=0))
