@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "NODE_EXE="
if exist "runtime\node.exe" set "NODE_EXE=%CD%\runtime\node.exe"
if not defined NODE_EXE if exist "..\desktop-shell\runtime\node.exe" set "NODE_EXE=%CD%\..\desktop-shell\runtime\node.exe"
if not defined NODE_EXE if exist "..\..\desktop-shell\runtime\node.exe" set "NODE_EXE=%CD%\..\..\desktop-shell\runtime\node.exe"
if not defined NODE_EXE if exist "..\..\..\desktop-shell\runtime\node.exe" set "NODE_EXE=%CD%\..\..\..\desktop-shell\runtime\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_EXE=node"
)

if not defined NODE_EXE (
  echo لم يتم العثور على Node.js.
  echo ضع ملف node.exe الرسمي داخل مجلد runtime أو ثبّت Node.js (>= 22.13).
  pause
  exit /b 1
)

echo تشغيل مفتاح ستوديو (Path C)...
"%NODE_EXE%" "pathc\launcher.mjs"
if errorlevel 1 pause
endlocal
