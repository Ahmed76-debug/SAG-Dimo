$ErrorActionPreference = 'Stop'
$root = 'C:\Users\CONNECT\Documents\Default Project\muraqib-financial-platform'
$folders = @($root, (Join-Path $root 'docs'))
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) { continue }
    Get-ChildItem -LiteralPath $folder -Filter '*.docx' -File | ForEach-Object {
      $dst = [IO.Path]::ChangeExtension($_.FullName, '.doc')
      $doc = $word.Documents.Open($_.FullName, $false, $true)
      try {
        $doc.SaveAs2($dst, 0)
      } finally {
        $doc.Close($false)
      }
      Write-Output "CONVERTED: $dst"
    }
  }
} finally {
  $word.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
