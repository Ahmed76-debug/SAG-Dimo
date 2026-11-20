#requires -Version 5.1
<#
  Creates a desktop shortcut for Miftah Studio and optionally launches it.
  Usage:  powershell -ExecutionPolicy Bypass -File .\install-desktop.ps1
          powershell -ExecutionPolicy Bypass -File .\install-desktop.ps1 -NoLaunch
#>
param(
  [switch]$NoLaunch,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::InputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$launcher = Join-Path $root 'launch.cmd'
$icon = Join-Path $root 'public\miftah.ico'

Write-Host ''
Write-Host '  مفتاح ستوديو — إنشاء اختصار سطح المكتب' -ForegroundColor Cyan
Write-Host '  Miftah Studio — Desktop shortcut' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path -LiteralPath $launcher)) {
  Write-Host '  لم يتم العثور على launch.cmd بجوار هذا الملف.' -ForegroundColor Red
  Write-Host "  المسار المتوقع: $launcher" -ForegroundColor DarkGray
  if (-not $NoPause) { Read-Host 'اضغط Enter للخروج' | Out-Null }
  exit 1
}

$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path -LiteralPath $desktop)) {
  $desktop = Join-Path $env:USERPROFILE 'Desktop'
}
if (-not (Test-Path -LiteralPath $desktop)) {
  New-Item -ItemType Directory -Force -Path $desktop | Out-Null
}

$shortcutPath = Join-Path $desktop 'مفتاح ستوديو.lnk'
$tempShortcutPath = Join-Path $desktop 'Miftah Studio.lnk'
$iconLocation = if (Test-Path -LiteralPath $icon) { "$icon,0" } else { "$env:SystemRoot\System32\shell32.dll,43" }

try {
  # WScript.Shell cannot save a .lnk whose path contains Arabic characters in
  # Windows PowerShell 5.1, so save with an ASCII name first, then rename it.
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($tempShortcutPath)
  $shortcut.TargetPath = $launcher
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = 'Miftah Studio - License & Activation Studio'
  $shortcut.IconLocation = $iconLocation
  $shortcut.WindowStyle = 1
  $shortcut.Save()

  try {
    if (Test-Path -LiteralPath $shortcutPath) { Remove-Item -LiteralPath $shortcutPath -Force }
    Move-Item -LiteralPath $tempShortcutPath -Destination $shortcutPath -Force
  } catch {
    # Keep the English-named shortcut if the Arabic rename is not possible.
    $shortcutPath = $tempShortcutPath
  }
} catch {
  Write-Host '  تعذر إنشاء الاختصار على سطح المكتب.' -ForegroundColor Red
  Write-Host "  $($_.Exception.Message)" -ForegroundColor DarkGray
  Write-Host '  جرّب تشغيل الملف كمسؤول، أو استخدم launch.cmd مباشرة.' -ForegroundColor DarkGray
  if (-not $NoPause) { Read-Host 'اضغط Enter للخروج' | Out-Null }
  exit 1
}

Write-Host '  ✓ تم إنشاء الاختصار بنجاح:' -ForegroundColor Green
Write-Host "    $shortcutPath" -ForegroundColor White
Write-Host ''
Write-Host '  انقر نقراً مزدوجاً على أيقونة «مفتاح ستوديو» على سطح المكتب لتشغيل التطبيق.' -ForegroundColor Gray
Write-Host '  في أول تشغيل قد يستغرق التثبيت/البناء دقيقة أو دقيقتين.' -ForegroundColor DarkGray
Write-Host ''

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host '  تنبيه: Node.js غير مثبت أو غير موجود في PATH.' -ForegroundColor Yellow
  Write-Host '  ثبّت Node.js 22.13 أو أحدث من https://nodejs.org ثم شغّل الاختصار.' -ForegroundColor DarkGray
  Write-Host ''
  if (-not $NoPause) { Read-Host 'اضغط Enter للخروج' | Out-Null }
  exit 0
}

if (-not $NoLaunch) {
  Write-Host '  تشغيل التطبيق الآن…' -ForegroundColor Cyan
  Start-Process -FilePath $launcher -WorkingDirectory $root | Out-Null
} else {
  Write-Host '  تم تخطي التشغيل (NoLaunch).' -ForegroundColor DarkGray
}

if (-not $NoPause) {
  Start-Sleep -Milliseconds 600
  Read-Host 'اضغط Enter لإغلاق هذه النافذة' | Out-Null
}
