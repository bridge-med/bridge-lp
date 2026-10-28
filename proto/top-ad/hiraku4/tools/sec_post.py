# 病院の断面の仕上げ: 階ごとの時刻を継ぐ(上=昼・中=昼と夕の間・下=夕)、切り口の藍を --indigo に、屋根と1階の床も藍で塗って枠を閉じる、余白を整えて書き出す
# 道具の画面(写し)の画素は動かさない: 藍の置き換えは切り口とその縁(2px)だけにし、道具の画面の枠(st)の中は除く。終わりに、枠の中が継いだ絵と同じかを確かめて書き出す
# python3 -I sec_post.py <day.png> <mid.png> <dusk.png> <outdir> <prefix> '<st の JSON>' [--two|--single]
#   --two: 継ぎ目は3階と2階の間の1本(上=昼、下=夕。いまの版)/ --single: 昼の1枚だけ(比べるための版)。枠の外(左右の外の柱)は描かない
import sys, json
import numpy as np
from PIL import Image
day, mid, dusk, outdir, prefix = sys.argv[1:6]; single = '--single' in sys.argv; two = '--two' in sys.argv   # --two: 継ぎ目は3階と2階の間の1本(上=昼、下=夕)
A = [np.array(Image.open(p).convert('RGBA')).astype(np.float32) for p in (day, mid, dusk)]
H, W = A[0].shape[:2]
a0 = A[0].astype(int)
NAVY = np.array([4, 18, 46]); IND = np.array([22, 35, 62])   # 描いたときの藍と、--indigo(#16233E)
ind = (a0[..., 3] > 200) & (np.abs(a0[..., :3] - NAVY).sum(-1) < 24)
# 縦の切り口(左右): 2階の高さの行で、いちばん左と右の藍の連なり
def runs(v):
    idx = np.where(v)[0]; out = []
    for i in idx:
        if out and i == out[-1][1] + 1: out[-1][1] = i
        else: out.append([i, i])
    return out
mid_row = int(H * .5)
r = [q for q in runs(ind[mid_row]) if q[1] - q[0] > 15]
L0, L1, R0, R1 = r[0][0], r[0][1], r[-1][0], r[-1][1]
col = runs(ind[:, (L1 + R0) // 2])
slabs = [q for q in col if q[1] - q[0] > 15]                       # 中の2枚の床の切り口
top = runs(ind[:, (L0 + L1) // 2])[0][0]; bot = runs(ind[:, (L0 + L1) // 2])[-1][1]   # 縦の切り口の上端と下端
T = slabs[0][1] - slabs[0][0] + 1
print('frame', dict(L=(L0, L1), R=(R0, R1), slabs=slabs, top=top, bot=bot, T=T))
# 継ぐ: 継ぎ目は2枚の床の切り口の真ん中。枠の中はせまく、外(外の柱)は広くぼかす
out = A[0].copy()
if not single:
    ys = np.arange(H)[:, None].astype(np.float32); xs = np.arange(W)[None, :].astype(np.float32)
    inside = (xs >= L0) & (xs <= R1)
    def step(y0):
        f = np.where(inside, 9.0, 70.0)
        return np.clip((ys - y0) / (2 * f) + .5, 0, 1)
    s1 = step((slabs[0][0] + slabs[0][1]) / 2); s2 = step((slabs[1][0] + slabs[1][1]) / 2)
    w0 = 1 - s1; w1 = s1 * (1 - s2); w2 = s2
    if two: w1 = np.zeros_like(w1); w2 = s1
    out = A[0] * w0[..., None] + A[1] * w1[..., None] + A[2] * w2[..., None]
# 藍を --indigo へ(縁のなじみは、近さで按分)。切り口(藍そのもの)から 2px の内だけ・道具の画面の枠の中は除く
st = json.loads(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6].startswith('{') else {}
assert st, '道具の画面の位置(capture の出力の st の JSON)を渡す。ないと画面を守れない'
def grow(m, r):
    o = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r: o |= np.roll(np.roll(m, dy, 0), dx, 1)
    return o
boxes = []
for v in st.values():
    x0, x1 = sorted((v[0] * W / 100, v[2] * W / 100)); y0, y1 = sorted((v[1] * H / 100, v[3] * H / 100))
    boxes.append((max(0, int(y0) - 4), min(H, int(np.ceil(y1)) + 4), max(0, int(x0) - 4), min(W, int(np.ceil(x1)) + 4)))
keep = np.zeros((H, W), bool)
for y0, y1, x0, x1 in boxes: keep[y0:y1, x0:x1] = True
before = out.copy()
d = np.abs(out[..., :3] - NAVY).sum(-1)
near = grow((out[..., 3] > 200) & (d <= 3), 2)   # 切り口は光を受けない藍そのもの(d ≤ 3)。服などの暗い色(d 14〜)は種にしない
k = (np.clip(1 - d / 70.0, 0, 1) * (out[..., 3] / 255.0) * (near & ~keep))[..., None]
out[..., :3] = out[..., :3] + (IND - NAVY) * k
# 枠を閉じる: 屋根の床(縦の切り口の上端の上)と1階の床(下端から)を、中の床と同じ太さで
out[top - T: top, L0: R1 + 1] = [*IND, 255]
out[bot - 2: bot - 2 + T, L0: R1 + 1] = [*IND, 255]
out[:, :L0, 3] = 0; out[:, R1 + 1:, 3] = 0   # 切り口の枠の外(左右の外の柱)は描かない: 枠そのものを建物の輪郭にする
img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
bb = img.split()[-1].getbbox(); pad = 24
crop = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(W, bb[2] + pad), min(H, bb[3] + pad))
img = img.crop(crop); cw, ch = img.size
moved = {k2: float(np.abs(out[y0:y1, x0:x1] - before[y0:y1, x0:x1]).max()) for k2, (y0, y1, x0, x1) in zip(st, boxes)}   # 道具の画面の画素が、継いだ絵のままか
print('screens moved (0 = 写しのまま)', moved); assert not any(moved.values())
# 道具の画面の位置を、切り抜いた絵の % に直す(capture の値は、撮った枠の %)
pos ={k: [round((v[0] * W / 100 - crop[0]) / cw * 100, 2), round((v[1] * H / 100 - crop[1]) / ch * 100, 2), round((v[2] * W / 100 - crop[0]) / cw * 100, 2), round((v[3] * H / 100 - crop[1]) / ch * 100, 2)] for k, v in st.items()}
rooms = [[round((L1 + 1 - crop[0]) / cw * 100, 2), round((y - crop[1]) / ch * 100, 2)] for y in (top, slabs[0][1] + 1, slabs[1][1] + 1)]   # 各階の部屋の左上(左の切り口の内側・床の切り口のすぐ下)
frame = {'L': round((L0 - crop[0]) / cw * 100, 2), 'R': round((R1 - crop[0]) / cw * 100, 2), 'top': round((top - T - crop[1]) / ch * 100, 2), 'bot': round((bot - 2 + T - crop[1]) / ch * 100, 2), 'slabs': [round(((s[0] + s[1]) / 2 - crop[1]) / ch * 100, 2) for s in slabs]}
sizes = []
for w in (1600, 1200, 800):
    h = round(ch * w / cw); im = img.resize((w, h), Image.LANCZOS)
    p = f'{outdir}/{prefix}-{w}.webp'; im.save(p, 'WEBP', quality=86, method=6); sizes.append((w, h, p))
import os
print(json.dumps({'crop': crop, 'size': [cw, ch], 'pos': pos, 'rooms': rooms, 'frame': frame, 'files': [(w, h, os.path.getsize(p) // 1024) for w, h, p in sizes]}, ensure_ascii=False))
img.save(f'{outdir}/{prefix}-full.png')
