@echo off
chcp 65001 >nul
title مفتاح ستوديو — تثبيت الاختصار على سطح المكتب
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-desktop.ps1"
if errorlevel 1 pause
endlocal
