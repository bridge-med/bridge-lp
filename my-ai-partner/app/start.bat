@echo off
rem Windows用: ダブルクリックで「わたしのAIパートナー」を起動する
cd /d %~dp0
echo わたしのAIパートナーを起動しています…(このウィンドウは開いたままにしてください)
node server.mjs
pause
