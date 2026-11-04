@echo off
rem Double-click to start RumiStack. Opens http://127.0.0.1:47821 in your browser.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\Start-Workspace.ps1" %*
pause
