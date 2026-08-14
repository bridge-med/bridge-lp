#!/bin/bash
# Mac用セットアップ。最初に1回だけダブルクリックする。
# (「開発元を確認できません」と出たら: このファイルを右クリック→「開く」)
cd "$(dirname "$0")"
echo "=============================================="
echo " わたしのAIパートナー セットアップ"
echo "=============================================="

# ① Node.js
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "① Node.js（アプリの土台）が必要です。いまダウンロードページを開きます。"
  echo "   緑の「LTS」ボタンからダウンロード → インストールが終わったら、"
  echo "   このファイルをもう一度ダブルクリックしてください。"
  open "https://nodejs.org/ja"
  echo ""
  read -r -p "Enterキーでこの画面を閉じます..."
  exit 0
fi
echo "① Node.js … OK"

# ② Claude Code
export PATH="$HOME/.local/bin:$PATH"
if ! command -v claude >/dev/null 2>&1; then
  echo "② Claude Code（AIの本体）を入れています…そのままお待ちください"
  curl -fsSL https://claude.ai/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Codeのインストールに失敗しました。この画面の文章をそのままAIに貼って相談してください。"
  read -r -p "Enterキーで閉じます..."
  exit 1
fi
echo "② Claude Code … OK"

# ③ ログイン
echo ""
echo "③ 最後にログインです。この後Claudeの画面が開くので、"
echo "   案内に従って いつものClaudeアカウント でログインしてください。"
echo "   ログインが済んだら、その画面はそのまま閉じてOKです。"
echo "   （すでにログイン済みなら、開いた画面をすぐ閉じてOK）"
read -r -p "Enterキーで進みます..."
claude || true

echo ""
echo "=============================================="
echo " セットアップ完了！"
echo " 次からは「2-アプリ起動.command」をダブルクリックするだけです。"
echo "=============================================="
read -r -p "Enterキーで閉じます..."
