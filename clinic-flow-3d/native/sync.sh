#!/usr/bin/env bash
# Webアプリ本体(親ディレクトリ)を www/ にコピーする。native/ 自身は除外。
set -euo pipefail
cd "$(dirname "$0")"
rm -rf www
mkdir -p www
rsync -a --exclude 'native' --exclude '.DS_Store' ../ www/
echo "synced -> www/ ($(find www -type f | wc -l) files)"
