$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is required but was not found in PATH. Install Node.js from https://nodejs.org/.'
}
Write-Host 'Starting EduSphere...' -ForegroundColor Cyan
$proc = Start-Process -FilePath 'node' -ArgumentList 'server/index.js' -WorkingDirectory $PSScriptRoot -PassThru
Start-Sleep -Seconds 2
$port = if (Test-Path '.port') { (Get-Content '.port' -Raw).Trim() } else { '4173' }
Start-Process "http://localhost:$port"
Write-Host "EduSphere running at http://localhost:$port (PID $($proc.Id))"
