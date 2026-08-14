#!/bin/bash
# Mac用: ふだんはこれをダブルクリックするだけ。ブラウザで画面が開く。
cd "$(dirname "$0")/app"
export PATH="$HOME/.local/bin:$PATH"
echo "わたしのAIパートナーを起動しています…(このウィンドウは開いたままにしてください)"
exec node server.mjs
