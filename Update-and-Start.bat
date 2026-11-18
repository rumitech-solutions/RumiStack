@echo off
setlocal
title RumiStack - Smart Update & Start
cd /d "%~dp0"

echo.
echo  ==================================================
echo       RumiStack  ^|  SMART UPDATE  ^&  START
echo  ==================================================
echo.
echo  Safely checks GitHub, protects local changes,
echo  validates the workspace, then starts the dashboard.
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Windows PowerShell was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Update-and-Start.ps1" %*
set "RESULT=%ERRORLEVEL%"

echo.
if not "%RESULT%"=="0" (
  echo [FAILED] RumiStack could not be updated or started.
  echo Review the message above. Your local work was not discarded.
) else (
  echo [SUCCESS] RumiStack is ready.
)
echo.
pause
exit /b %RESULT%
