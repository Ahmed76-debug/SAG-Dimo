@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "NODE_EXE="
if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"
if not defined NODE_EXE if exist "%~dp0..\مشروعات ويب\desktop-shell\runtime\node.exe" set "NODE_EXE=%~dp0..\مشروعات ويب\desktop-shell\runtime\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE_EXE=node"
)
if not defined NODE_EXE (
  echo [!] Node.js 22+ غير موجود. ثبته أو ضع node.exe داخل مجلد runtime\.
  pause
  exit /b 1
)

if not exist "%~dp0projects\auto-car\server.js" (
  echo [*] أول تشغيل: جاري تجهيز نسخ المشروعات...
  "%NODE_EXE%" "%~dp0setup-demo.mjs"
)

set "DEMO_DIRECT_PORTS=1"
echo.
echo  ==========================================
echo   Smart Activity Group / مجموعة الأنشطه الذكيه - نسخ تجريبية كاملة
echo   البوابة: http://localhost:8000/
echo  ==========================================
echo.
"%NODE_EXE%" "%~dp0demo-server.mjs"
if errorlevel 1 pause
endlocal
