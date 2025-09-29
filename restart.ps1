Write-Host "🔄 Restarting Development Server..." -ForegroundColor Cyan

# Kill all Node.js processes
Write-Host "Killing Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Stop-Process -Name node -Force
    Write-Host "✅ Node processes killed" -ForegroundColor Green
} else {
    Write-Host "No Node processes running" -ForegroundColor Gray
}

# Clean Next.js cache
Write-Host "Cleaning Next.js cache..." -ForegroundColor Yellow
if (Test-Path .next) {
    Remove-Item -Path .next -Recurse -Force
    Write-Host "✅ Cache cleared" -ForegroundColor Green
} else {
    Write-Host "No cache to clear" -ForegroundColor Gray
}

# Start the development server
Write-Host "Starting development server..." -ForegroundColor Cyan
npm run dev