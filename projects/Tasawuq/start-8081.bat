@echo off
setlocal
cd /d "%~dp0"

rem ------------------------------------------------------------------
rem  Tasawuq (تسوق)  |  يعمل على المنفذ 8081 حتى لا يتعارض مع ديليفري (8080)
rem  Site : http://localhost:8081/
rem  Admin: http://localhost:8081/admin.html
rem ------------------------------------------------------------------

set PORT=8081
set LOGDIR=%~dp0logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

powershell -NoProfile -Command "try{ $r=Invoke-WebRequest 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 3; if($r.StatusCode -eq 200){exit 0} }catch{exit 1}" >nul 2>&1
if %errorlevel%==0 (
  echo [i] Tasawuq already running on port %PORT%.
  start "" "http://localhost:%PORT%/"
  exit /b 0
)

echo [i] Starting Tasawuq on port %PORT%...
start "tasawuq-8081" /min cmd /c "set PORT=%PORT%&& node server.js >> \"%LOGDIR%\server.log\" 2>&1"

for /l %%i in (1,1,15) do (
  powershell -NoProfile -Command "try{ $r=Invoke-WebRequest 'http://localhost:%PORT%/' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0} }catch{exit 1}" >nul 2>&1
  if not errorlevel 1 goto ready
  timeout /t 1 >nul
)

echo [x] Tasawuq did not start. Check logs\server.log
pause
exit /b 1

:ready
echo [ok] Tasawuq site : http://localhost:%PORT%/
echo [ok] Tasawuq admin: http://localhost:%PORT%/admin.html
start "" "http://localhost:%PORT%/"
exit /b 0
