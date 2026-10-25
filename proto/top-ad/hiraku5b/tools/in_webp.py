# 撮った断面の PNG(透明の地)を、幅 1200 と 800 の webp にする。使い方は README.md
# python3 -I in_webp.py <in-day.png などのある所> <書き出す所(hiraku5b/img)>
import os
import sys

from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
for t in ('day', 'dusk', 'night'):
    im = Image.open(os.path.join(src, 'in-%s.png' % t))
    for w in (1200, 800):
        s = im if im.size[0] == w else im.resize((w, round(im.size[1] * w / im.size[0])), Image.LANCZOS)
        path = os.path.join(dst, 'in-%s-%d.webp' % (t, w))
        s.save(path, 'WEBP', quality=86, method=6)
        print(path, s.size, os.path.getsize(path))
