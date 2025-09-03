# PowerShell Script to Start Local Development Environment
# This script ensures Docker and Supabase are properly running for local development

Write-Host "ContentMax Local Development Environment Startup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Function to check if a command exists
function Test-CommandExists {
    param($CommandName)
    $null = Get-Command $CommandName -ErrorAction SilentlyContinue
    return $?
}

# Function to check if Docker Desktop is running
function Test-DockerRunning {
    try {
        docker version | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to start Docker Desktop
function Start-DockerDesktop {
    $dockerDesktopPath = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    
    if (Test-Path $dockerDesktopPath) {
        Write-Host "Starting Docker Desktop..." -ForegroundColor Yellow
        Start-Process "$dockerDesktopPath"
        
        # Wait for Docker to be ready (max 60 seconds)
        $timeout = 60
        $elapsed = 0
        while (-not (Test-DockerRunning) -and $elapsed -lt $timeout) {
            Start-Sleep -Seconds 2
            $elapsed += 2
            Write-Host "." -NoNewline
        }
        Write-Host ""
        
        if ($elapsed -ge $timeout) {
            Write-Host "ERROR: Docker Desktop failed to start within $timeout seconds" -ForegroundColor Red
            return $false
        }
        
        Write-Host "Docker Desktop started successfully!" -ForegroundColor Green
        return $true
    }
    else {
        Write-Host "ERROR: Docker Desktop not found at $dockerDesktopPath" -ForegroundColor Red
        Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
        return $false
    }
}

# 1. Check Docker Desktop
Write-Host "`n1. Checking Docker Desktop..." -ForegroundColor Cyan

if (-not (Test-CommandExists "docker")) {
    Write-Host "Docker command not found. Please install Docker Desktop." -ForegroundColor Red
    Write-Host "Download from: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-DockerRunning)) {
    if (-not (Start-DockerDesktop)) {
        exit 1
    }
}
else {
    Write-Host "Docker Desktop is already running!" -ForegroundColor Green
}

# 2. Check Supabase CLI
Write-Host "`n2. Checking Supabase CLI..." -ForegroundColor Cyan

if (-not (Test-CommandExists "supabase")) {
    Write-Host "Supabase CLI not found. Installing via npm..." -ForegroundColor Yellow
    npm install -g supabase
    if (-not $?) {
        Write-Host "ERROR: Failed to install Supabase CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "Supabase CLI installed successfully!" -ForegroundColor Green
}
else {
    Write-Host "Supabase CLI is installed!" -ForegroundColor Green
}

# 3. Start Supabase services
Write-Host "`n3. Starting Supabase services..." -ForegroundColor Cyan

# Check if Supabase is already running
$supabaseStatus = supabase status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Supabase services are already running!" -ForegroundColor Green
}
else {
    Write-Host "Starting Supabase..." -ForegroundColor Yellow
    supabase start
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to start Supabase services" -ForegroundColor Red
        Write-Host "Try running 'supabase stop --backup' and then re-run this script" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Supabase services started successfully!" -ForegroundColor Green
}

# 4. Run migrations
Write-Host "`n4. Checking database migrations..." -ForegroundColor Cyan

$migrationOutput = supabase migration list 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Running pending migrations..." -ForegroundColor Yellow
    supabase db push
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migrations applied successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "WARNING: Some migrations may have failed. Check the output above." -ForegroundColor Yellow
    }
}
else {
    Write-Host "Could not check migration status" -ForegroundColor Yellow
}

# 5. Display connection information
Write-Host "`n5. Local Development Environment Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Supabase Studio: " -NoNewline
Write-Host "http://localhost:54323" -ForegroundColor Cyan
Write-Host "Supabase URL:    " -NoNewline
Write-Host "http://localhost:54321" -ForegroundColor Cyan
Write-Host "Database URL:    " -NoNewline
Write-Host "postgresql://postgres:postgres@localhost:54322/postgres" -ForegroundColor Cyan
Write-Host "Inbucket Email:  " -NoNewline
Write-Host "http://localhost:54324" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next.js dev server will run on: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the Next.js dev server, run: " -NoNewline
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "To stop Supabase services later, run: " -NoNewline
Write-Host "supabase stop" -ForegroundColor Yellow
Write-Host ""