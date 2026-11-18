@echo off
setlocal
title RumiStack - Start
cd /d "%~dp0"

echo.
echo  ================================================
echo       RumiStack  ^|  START
echo  ================================================
echo.
echo  Starting the local dashboard.
echo  This launcher does not update or pull from GitHub.
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Windows PowerShell was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-Workspace.ps1" %*
set "RESULT=%ERRORLEVEL%"

echo.
if not "%RESULT%"=="0" (
  echo [FAILED] RumiStack could not be started.
  echo Review the message above. No Git update was attempted.
) else (
  echo [OK] RumiStack session ended.
)
echo.
pause
exit /b %RESULT%
