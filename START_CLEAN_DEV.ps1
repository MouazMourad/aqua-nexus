$ErrorActionPreference = "Stop"

Write-Host "Aqua Nexus clean development start" -ForegroundColor Cyan

$parentLock = "C:\projects\package-lock.json"
$parentPackage = "C:\projects\package.json"

if ((Test-Path $parentLock) -and -not (Test-Path $parentPackage)) {
    Write-Host "Removing stray C:\projects\package-lock.json that confuses Next.js workspace-root detection..." -ForegroundColor Yellow
    Remove-Item $parentLock -Force
}

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
}

Write-Host "Starting Aqua Nexus..." -ForegroundColor Green
npm run dev
