#requires -Version 5.1
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::InputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$port = if ($env:PORT) { [int]$env:PORT } else { 4781 }
$url = "http://127.0.0.1:$port"
$health = "$url/api/v1/health"

function Test-Miftah {
  try {
    $r = Invoke-RestMethod -Uri $health -TimeoutSec 2
    return ($r.ok -eq $true -and $r.data.service -eq 'miftah-activation-api')
  } catch {
    return $false
  }
}

Write-Host ''
Write-Host '  مفتاح · Miftah Studio' -ForegroundColor Cyan
Write-Host '  استوديو التراخيص الاحترافي' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host '  تثبيت الحزم لأول مرة...' -ForegroundColor Yellow
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw 'فشل تثبيت الحزم. تأكد من تثبيت Node.js 22.13 أو أحدث.' }
}

if (-not (Test-Path (Join-Path $root 'dist\index.html'))) {
  Write-Host '  بناء الواجهة...' -ForegroundColor Yellow
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'فشل بناء الواجهة.' }
}

if (-not (Test-Miftah)) {
  Write-Host '  تشغيل الخادم...' -ForegroundColor Yellow
  $dataDir = Join-Path $root 'data'
  New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
  $stdout = Join-Path $dataDir 'server.log'
  $stderr = Join-Path $dataDir 'server.error.log'

  Start-Process -FilePath 'node' `
    -ArgumentList @('server/index.mjs') `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Miftah) { $ready = $true; break }
  }
  if (-not $ready) {
    Write-Host ''
    Write-Host '  تعذر تشغيل الخادم على المنفذ ' -NoNewline -ForegroundColor Red
    Write-Host $port -ForegroundColor Red
    Write-Host '  راجع السجل: data\server.log و data\server.error.log' -ForegroundColor DarkGray
    Write-Host '  إن كان المنفذ مشغولاً، أغلق العملية أو غيّر PORT.' -ForegroundColor DarkGray
    exit 1
  }
} else {
  Write-Host '  الخادم يعمل بالفعل — سيتم فتح نافذة التطبيق.' -ForegroundColor Green
}

Write-Host ''
Write-Host "  الواجهة: $url" -ForegroundColor Green
Write-Host '  لإيقاف الخادم: Get-Process node | Stop-Process' -ForegroundColor DarkGray
Write-Host ''

$edgeCandidates = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($NoBrowser) {
  Write-Host '  تم تخطي فتح المتصفح (NoBrowser).' -ForegroundColor DarkGray
} elseif ($edge) {
  Start-Process -FilePath $edge -ArgumentList @("--app=$url", '--window-size=1440,940')
} else {
  Start-Process $url
}
