$projectRoot = Split-Path -Parent $PSScriptRoot
foreach ($file in @(".meta-ads-worker.pid", ".ssh-tunnel.pid")) {
  $path = Join-Path $projectRoot $file
  if (Test-Path -LiteralPath $path) {
    $processId = [int](Get-Content -LiteralPath $path)
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $path -Force
  }
}
Write-Output "Local Meta Ads worker and SSH tunnel stopped."