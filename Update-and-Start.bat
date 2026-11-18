@echo off
setlocal
title RumiStack - Update and Start

cd /d "%~dp0"
if errorlevel 1 (
  echo [ERROR] Could not open the RumiStack folder.
  pause
  exit /b 1
)

echo.
echo  ==========================================
echo       RumiStack - Update and Start
echo  ==========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git is not installed or not available in PATH.
  echo Install Git for Windows, then run this file again.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not available in PATH.
  echo Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available. Reinstall Node.js 20 or newer.
  pause
  exit /b 1
)

echo [1/3] Checking Node.js version...
node -e "const v=process.versions.node.split('.')[0]; if(Number(v)<20){console.error('RumiStack requires Node.js 20 or newer.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo [2/3] Pulling the latest RumiStack version from GitHub...
git pull --ff-only origin main
if errorlevel 1 (
  echo.
  echo [ERROR] Update could not be completed.
  echo Your local changes have NOT been overwritten.
  echo If you have local edits, back them up or commit them before updating.
  pause
  exit /b 1
)

echo.
echo Installing/updating required packages...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo [ERROR] Dependency installation failed.
  pause
  exit /b 1
)

echo.
echo [3/3] Starting RumiStack...
echo Open http://127.0.0.1:47821 in your browser.
echo Press Ctrl+C in this window to stop RumiStack.
echo.
call npm start

echo.
echo RumiStack has stopped.
pause
endlocal
