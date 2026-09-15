Write-Host "Stopping stale Aqua Nexus local artifacts..." -ForegroundColor Cyan

if (Test-Path ".next") {
  Remove-Item -Recurse -Force ".next"
}

if (Test-Path "node_modules\.cache") {
  Remove-Item -Recurse -Force "node_modules\.cache"
}

Write-Host "Local Next.js build cache cleared." -ForegroundColor Green
Write-Host "Now run: npm run dev" -ForegroundColor Yellow
