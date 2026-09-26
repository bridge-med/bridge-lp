"""index.html を画面なしの Chrome で 1 コマずつ描かせ、そのまま ffmpeg へ流して MP4 にする。

使い方: python3 render.py [--frames 0-749] [--out video.mp4]
音を重ねるのは make_audio.py のあと(最後に mux する)。
"""
import argparse
import base64
import functools
import http.server
import os
import subprocess
import sys
import threading
import time

import imageio_ffmpeg
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))  # 実画面は images/products/thumbs/ から読むので、リポジトリの根から配る
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    handler = functools.partial(Quiet, directory=REPO)
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", default=None, help="例: 0-99 / 120")
    ap.add_argument("--out", default=os.path.join(HERE, "video.mp4"))
    ap.add_argument("--png-dir", default=None, help="指定すると MP4 ではなく PNG を書き出す(確認用)")
    args = ap.parse_args()

    httpd = serve()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/promo/bridge-intro/index.html?render"

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(url)
        page.evaluate("window.ready")
        total = page.evaluate("window.TOTAL_FRAMES")
        fps = page.evaluate("TL.fps")

        if args.frames:
            a, _, b = args.frames.partition("-")
            frames = range(int(a), int(b or a) + 1)
        else:
            frames = range(total)

        ff = None
        if args.png_dir:
            os.makedirs(args.png_dir, exist_ok=True)
        else:
            ff = subprocess.Popen(
                [FFMPEG, "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps),
                 "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
                 "-pix_fmt", "yuv420p", "-movflags", "+faststart", args.out],
                stdin=subprocess.PIPE,
            )

        t0 = time.time()
        for i in frames:
            data = page.evaluate(f"window.renderFrame({i})")
            png = base64.b64decode(data.split(",", 1)[1])
            if ff:
                ff.stdin.write(png)
            else:
                with open(os.path.join(args.png_dir, f"f{i:04d}.png"), "wb") as fh:
                    fh.write(png)
            if i % 50 == 0:
                print(f"frame {i}/{total}  {time.time() - t0:.0f}s", file=sys.stderr, flush=True)
        if ff:
            ff.stdin.close()
            ff.wait()
        browser.close()
    httpd.shutdown()
    print(f"done in {time.time() - t0:.0f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
