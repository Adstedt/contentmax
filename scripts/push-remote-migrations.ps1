# PowerShell Script to Push Migrations to Remote Supabase
# This script helps push local migrations to your remote Supabase instance

param(
    [Parameter(Mandatory=$false)]
    [string]$Password
)

Write-Host "Supabase Remote Migration Push" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$projectRef = "zjtrssubwocvooygfxbj"

# Check if already linked
if (Test-Path ".supabase/project-ref") {
    $linkedProject = Get-Content ".supabase/project-ref"
    if ($linkedProject -eq $projectRef) {
        Write-Host "Project already linked to $projectRef" -ForegroundColor Green
    }
    else {
        Write-Host "WARNING: Project linked to different instance: $linkedProject" -ForegroundColor Yellow
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y") {
            exit 0
        }
    }
}
else {
    Write-Host "Linking to Supabase project: $projectRef" -ForegroundColor Yellow
    
    if (-not $Password) {
        Write-Host ""
        Write-Host "Database password required. You can find it in:" -ForegroundColor Yellow
        Write-Host "1. Supabase Dashboard > Settings > Database" -ForegroundColor Cyan
        Write-Host "2. Or reset it at: https://supabase.com/dashboard/project/$projectRef/settings/database" -ForegroundColor Cyan
        Write-Host ""
        $securePassword = Read-Host "Enter database password" -AsSecureString
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
    }
    
    # Link the project
    $env:SUPABASE_DB_PASSWORD = $Password
    npx supabase link --project-ref $projectRef --password $Password
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to link project. Please check your password." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Project linked successfully!" -ForegroundColor Green
}

# List migrations
Write-Host "`nChecking migrations..." -ForegroundColor Cyan
npx supabase migration list

# Push migrations
Write-Host "`nPushing migrations to remote database..." -ForegroundColor Yellow
npx supabase db push

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMigrations pushed successfully!" -ForegroundColor Green
    
    # Show migration status
    Write-Host "`nCurrent migration status:" -ForegroundColor Cyan
    npx supabase migration list
}
else {
    Write-Host "`nERROR: Failed to push migrations" -ForegroundColor Red
    Write-Host "Please check the error messages above" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nDone! Your remote database schema is now updated." -ForegroundColor Green
Write-Host "View your database at: https://supabase.com/dashboard/project/$projectRef/editor" -ForegroundColor Cyan