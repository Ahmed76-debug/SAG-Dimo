@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "NODE_EXE="
if exist "%~dp0..\desktop-shell\runtime\node.exe" set "NODE_EXE=%~dp0..\desktop-shell\runtime\node.exe"
if not defined NODE_EXE if exist "%~dp0..\..\desktop-shell\runtime\node.exe" set "NODE_EXE=%~dp0..\..\desktop-shell\runtime\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_EXE=node"
)
if not defined NODE_EXE (
  echo Node.js was not found. Install Node.js 22+ or keep desktop-shell\runtime\node.exe.
  pause
  exit /b 1
)

"%NODE_EXE%" "%~dp0..\tools\launch-web.mjs" --project baraka-market
if errorlevel 1 pause
endlocal
