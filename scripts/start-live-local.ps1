$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
if (-not (Test-Path -LiteralPath ".env")) { throw ".env tidak ditemukan" }
Copy-Item -LiteralPath ".env" -Destination "apps/web/.env.local" -Force
if (-not (Get-NetTCPConnection -LocalPort 5433 -State Listen -ErrorAction SilentlyContinue)) {
  $tunnel = Start-Process -FilePath "C:\Windows\System32\OpenSSH\ssh.exe" -ArgumentList @("-N","-L","127.0.0.1:5433:127.0.0.1:5432","-o","ServerAliveInterval=30","root@76.13.17.122") -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath ".ssh-tunnel.pid" -Value $tunnel.Id
  Start-Sleep -Seconds 2
}
$workerRunning = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*apps/worker/src/meta-ads-worker.ts*" }
if (-not $workerRunning) {
  $worker = Start-Process -FilePath "npm.cmd" -ArgumentList @("run","worker:meta-ads") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput "$projectRoot\meta-ads-worker.log" -RedirectStandardError "$projectRoot\meta-ads-worker.err.log" -PassThru
  Set-Content -LiteralPath ".meta-ads-worker.pid" -Value $worker.Id
}
Write-Output "Live Meta Ads ready. Start/restart web with: npm run dev"