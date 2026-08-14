@echo off
rem Windows用セットアップ。最初に1回だけダブルクリックする。
rem (青い警告が出たら:「詳細情報」→「実行」)
cd /d %~dp0
chcp 65001 >nul
echo ==============================================
echo  わたしのAIパートナー セットアップ
echo ==============================================

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ① Node.js^(アプリの土台^)が必要です。いまダウンロードページを開きます。
  echo    緑の「LTS」ボタンからダウンロード → インストールが終わったら、
  echo    このファイルをもう一度ダブルクリックしてください。
  start https://nodejs.org/ja
  echo.
  pause
  exit /b
)
echo ① Node.js … OK

set "PATH=%USERPROFILE%\.local\bin;%PATH%"
where claude >nul 2>nul
if errorlevel 1 (
  echo ② Claude Code^(AIの本体^)を入れています…そのままお待ちください
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://claude.ai/install.ps1 | iex"
  set "PATH=%USERPROFILE%\.local\bin;%PATH%"
)
where claude >nul 2>nul
if errorlevel 1 (
  echo Claude Codeのインストールに失敗しました。この画面の文章をそのままAIに貼って相談してください。
  pause
  exit /b
)
echo ② Claude Code … OK

echo.
echo ③ 最後にログインです。この後Claudeの画面が開くので、
echo    案内に従って いつものClaudeアカウント でログインしてください。
echo    ログインが済んだら、その画面はそのまま閉じてOKです。
pause
claude

echo.
echo ==============================================
echo  セットアップ完了！
echo  次からは「2-アプリ起動.bat」をダブルクリックするだけです。
echo ==============================================
pause
