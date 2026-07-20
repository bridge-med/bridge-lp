# 録画用の静的サーバ — 拡張子なしのルートを .html へ書き換えて配信する
# (Expo書き出しアプリのルーティングは /path 形式のため、GitHub Pages相当の解決を再現する)
# 使い方: python3 serve.py <port> <docroot>
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
ROOT = sys.argv[2] if len(sys.argv) > 2 else '.'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_head(self):
        path = self.translate_path(self.path.split('?')[0])
        # ディレクトリでもファイルでもない拡張子なしパスは .html を試す
        if not os.path.exists(path) and not os.path.splitext(path)[1]:
            if os.path.exists(path + '.html'):
                self.path = self.path.split('?')[0] + '.html'
        return super().send_head()

    def log_message(self, *args):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
