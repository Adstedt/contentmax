# Copy migration to clipboard for manual application
$migrationFile = ".\supabase\migrations\009_node_centric_model.sql"

if (Test-Path $migrationFile) {
    $content = Get-Content $migrationFile -Raw
    $content | Set-Clipboard
    
    Write-Host "Migration SQL copied to clipboard!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now:" -ForegroundColor Cyan
    Write-Host "1. Open Supabase SQL Editor: " -NoNewline
    Write-Host "https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/sql/new" -ForegroundColor Yellow
    Write-Host "2. Paste (Ctrl+V) the SQL" -ForegroundColor Cyan
    Write-Host "3. Click 'Run' or press Ctrl+Enter" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The migration will:" -ForegroundColor White
    Write-Host "- Add 5 columns to taxonomy_nodes table" -ForegroundColor Gray
    Write-Host "- Create node_metrics table" -ForegroundColor Gray
    Write-Host "- Create opportunities table" -ForegroundColor Gray
    Write-Host "- Add indexes and RLS policies" -ForegroundColor Gray
} else {
    Write-Host "Migration file not found!" -ForegroundColor Red
}