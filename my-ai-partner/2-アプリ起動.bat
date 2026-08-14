@echo off
rem Windows用: ふだんはこれをダブルクリックするだけ。ブラウザで画面が開く。
cd /d %~dp0app
chcp 65001 >nul
set "PATH=%USERPROFILE%\.local\bin;%PATH%"
echo わたしのAIパートナーを起動しています…(このウィンドウは開いたままにしてください)
node server.mjs
pause
