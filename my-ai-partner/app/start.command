#!/bin/bash
# Mac用: ダブルクリックで「わたしのAIパートナー」を起動する
cd "$(dirname "$0")"
echo "わたしのAIパートナーを起動しています…(このウィンドウは開いたままにしてください)"
exec node server.mjs
