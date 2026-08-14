#!/bin/bash
# Mac用: 同じWi-Fiのスマホからも使えるモードで起動する(自宅Wi-Fi限定で使うこと)
cd "$(dirname "$0")"
echo "わたしのAIパートナー(家庭内共有モード)を起動しています…"
AIP_LAN=1 exec node server.mjs
