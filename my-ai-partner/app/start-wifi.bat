@echo off
rem Windows用: 同じWi-Fiのスマホからも使えるモードで起動する(自宅Wi-Fi限定で使うこと)
cd /d %~dp0
echo わたしのAIパートナー(家庭内共有モード)を起動しています…
set AIP_LAN=1
node server.mjs
pause
