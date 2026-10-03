# 「名前になる」の写しの区間(226〜759): <work>/cam.json のカメラで撮った画(clip の範囲)を縦横同じ倍率に切り出し(LANCZOS)、サブフレームを線形光で平均する。
# 226〜246 は拭い: 描いた層(render の出力)と写しを、縁の曲線の左右で合わせる(縁の左が写し。写しの上には何も描かない)。
# 画素は切り出しと縮小と、縁での入れ替えだけ。禁止の矩形に枠が触れたら止める
# usage: python3 showreel/namae/compose.py <outframes> <canvasframes> [n0-n1] [--size 960x540] [--one] [--work showreel/namae/work]
# 依存: numpy・Pillow(書き出しの時だけ使う。サイトの公開物からは読まれない)
import sys, os, json
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
_skip = {i + 1 for i, a in enumerate(sys.argv) if a in ('--size', '--work')}
args = [a for i, a in enumerate(sys.argv) if i >= 1 and not a.startswith('--') and i not in _skip]
OUT, CANVAS = args[0], args[1]; RNG = args[2] if len(args) > 2 else None
SIZE = (1920, 1080); ONE = '--one' in sys.argv
for i, a in enumerate(sys.argv):
    if a == '--size': SIZE = tuple(map(int, sys.argv[i + 1].split('x')))
os.makedirs(OUT, exist_ok=True)
WORK = os.path.join(HERE, 'work')
for i, a in enumerate(sys.argv):
    if a == '--work': WORK = os.path.abspath(sys.argv[i + 1])
FR = json.load(open(os.path.join(WORK, 'cam.json')))
if RNG: a, b = map(int, RNG.split('-')); FR = [f for f in FR if a <= f['n'] <= b]
OPEN_N = 267                                          # 4.453125 に行を開く。それまでは何も開いていない(7 行目「入浴拒否…」の字が 780.6 にある)
def check(f, x, y, z):
    L, T, R, B = x - 960 / z, y - 540 / z, x + 960 / z, y + 540 / z
    if f['take'] == 'list9':
        if L <= 440: assert T >= 417, ('件数に触れる', f['n'], T)
        assert B <= (779 if f['n'] <= OPEN_N else 880.5), ('7 行目以降の字に入る', f['n'], B)
    else:
        assert B <= 441.0, ('注意の一文(面接。字の上端 441.9)に触れる', f['n'], B)
_cache = {}
def img(f):
    k = os.path.join(f['dir'], f['image'])           # 撮った画の場所ごとに引く(名前だけだと、別の撮影の同じ名前の画と取り違える)
    if k not in _cache: _cache.clear(); _cache[k] = Image.open(k).convert('RGB')
    return _cache[k]
def lin(a): a = a / 255.0; return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
def enc(l): l = np.clip(l, 0, 1); return np.where(l <= 0.0031308, l * 12.92, 1.055 * l ** (1 / 2.4) - 0.055)
def shot(f, x, y, z):
    im, d, c = img(f), f['dpr'], f['clip']
    box = (d * (x - 960 / z - c['x']), d * (y - 540 / z - c['y']), d * (x + 960 / z - c['x']), d * (y + 540 / z - c['y']))
    assert box[0] >= -1e-6 and box[1] >= -1e-6 and box[2] <= im.width + 1e-6 and box[3] <= im.height + 1e-6, ('枠が撮った範囲の外に出る', f['n'], box)
    return im.resize(SIZE, Image.LANCZOS, box=box)
def edge_mask(x0):                                    # 縁の曲線 [[x0,-40],[x0+70,330],[x0+70,750],[x0,1120]] の左が 1
    P = np.array([[x0, -40], [x0 + 70, 330], [x0 + 70, 750], [x0, 1120]], dtype=np.float64)
    u = np.linspace(0, 1, 2000)[:, None]
    q = (1 - u) ** 3 * P[0] + 3 * (1 - u) ** 2 * u * P[1] + 3 * (1 - u) * u ** 2 * P[2] + u ** 3 * P[3]
    ys = np.arange(1080) + 0.5
    xb = np.interp(ys, q[:, 1], q[:, 0])
    xs = np.arange(1920) + 0.5
    m = np.clip(xb[:, None] - xs[None, :] + 0.5, 0, 1)
    if SIZE != (1920, 1080): m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize(SIZE, Image.BILINEAR)) / 255.0
    return m
def work(f):
    mid = len(f['cams']) // 2
    cams = f['cams'][mid:mid + 1] if ONE else f['cams']        # --one: 真ん中のサブフレーム(描いた層の 1 枚と同じ時刻)
    for c in cams: check(f, *c)
    dst = os.path.join(OUT, f"f{f['n']:04d}.png")
    acc = sum(lin(np.asarray(shot(f, *c), dtype=np.float64)) for c in cams) / len(cams)
    if f.get('wipe'):
        wx = f['wipe'][mid:mid + 1] if ONE else f['wipe']
        m = (sum(edge_mask(x) for x in wx) / len(wx))[:, :, None]
        cv = Image.open(os.path.join(CANVAS, f"f{f['n']:04d}.png")).convert('RGB')
        if cv.size != SIZE: cv = cv.resize(SIZE, Image.LANCZOS)
        acc = m * acc + (1 - m) * lin(np.asarray(cv, dtype=np.float64))
    Image.fromarray((enc(acc) * 255 + 0.5).astype(np.uint8)).save(dst)
    return f['n'], len(cams)
if __name__ == '__main__':
    FR.sort(key=lambda f: (f['dir'], f['image']))
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as ex:
        done = list(ex.map(work, FR, chunksize=4))
    print('frames', len(done), 'multi', sum(1 for _, k in done if k > 1), 'max', max(k for _, k in done))
