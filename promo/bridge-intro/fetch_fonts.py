"""動画に出てくる文字だけを含むフォントを Google Fonts から取ってきて fonts/ に置く。

書き出し用のブラウザは外に出られない前提で、フォントは手元のファイルから読む。
文言(timeline.js の texts / montage)を変えたら、もう一度これを走らせる。
"""
import json
import os
import re
import subprocess
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fonts")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"

FACES = [  # (family, weight) — 憲法第23条:思想=明朝、構造=Noto Sans JP + Inter
    ("Shippori Mincho B1", 600),
    ("Noto Sans JP", 500),
    ("Noto Sans JP", 700),
    ("Inter", 500),
    ("Inter", 600),
]

src = open(os.path.join(HERE, "timeline.js"), encoding="utf-8").read()
src = re.sub(r"^\s*//.*$", "", src, flags=re.M)
TL = json.loads(src[src.index("{"): src.rindex("}") + 1])
words = TL["texts"] + [m["name"] for m in TL["montage"]] + [m.get("t", "") for m in TL["montage"]]
chars = "".join(sorted(set("".join(words) + "0123456789")))


def curl(url, *extra):
    return subprocess.run(["curl", "-sS", "-f", "-m", "60", "-A", UA, *extra, url],
                          check=True, capture_output=True).stdout


os.makedirs(OUT, exist_ok=True)
css_out = []
for family, weight in FACES:
    q = urllib.parse.urlencode({"family": f"{family}:wght@{weight}", "text": chars, "display": "block"})
    css = curl("https://fonts.googleapis.com/css2?" + q).decode()
    url = re.search(r"url\((https://[^)]+)\)", css).group(1)
    name = f"{family.replace(' ', '')}-{weight}.woff2"
    with open(os.path.join(OUT, name), "wb") as fh:
        fh.write(curl(url))
    css_out.append(
        f"@font-face{{font-family:'{family}';font-weight:{weight};font-style:normal;"
        f"font-display:block;src:url(fonts/{name}) format('woff2')}}"
    )
    print(name)

with open(os.path.join(HERE, "fonts.css"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(css_out) + "\n")
