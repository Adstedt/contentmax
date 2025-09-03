#!/bin/bash

# Bash Script to Start Local Development Environment
# This script ensures Docker and Supabase are properly running for local development

echo -e "\033[36mContentMax Local Development Environment Startup\033[0m"
echo -e "\033[36m================================================\033[0m"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if Docker is running
docker_running() {
    docker version >/dev/null 2>&1
}

# Function to start Docker Desktop on Windows
start_docker_desktop_windows() {
    echo -e "\033[33mStarting Docker Desktop...\033[0m"
    
    # Try to start Docker Desktop using Windows command
    cmd.exe /c "start \"\" \"%ProgramFiles%\\Docker\\Docker\\Docker Desktop.exe\"" 2>/dev/null
    
    # Wait for Docker to be ready (max 60 seconds)
    local timeout=60
    local elapsed=0
    
    while ! docker_running && [ $elapsed -lt $timeout ]; do
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    echo ""
    
    if [ $elapsed -ge $timeout ]; then
        echo -e "\033[31mERROR: Docker Desktop failed to start within $timeout seconds\033[0m"
        return 1
    fi
    
    echo -e "\033[32mDocker Desktop started successfully!\033[0m"
    return 0
}

# Function to start Docker on Linux/Mac
start_docker_unix() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo -e "\033[33mStarting Docker Desktop...\033[0m"
        open -a Docker
    else
        # Linux
        echo -e "\033[33mStarting Docker service...\033[0m"
        sudo systemctl start docker
    fi
    
    # Wait for Docker to be ready
    local timeout=30
    local elapsed=0
    
    while ! docker_running && [ $elapsed -lt $timeout ]; do
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    echo ""
    
    if [ $elapsed -ge $timeout ]; then
        echo -e "\033[31mERROR: Docker failed to start within $timeout seconds\033[0m"
        return 1
    fi
    
    echo -e "\033[32mDocker started successfully!\033[0m"
    return 0
}

# 1. Check Docker
echo -e "\n\033[36m1. Checking Docker...\033[0m"

if ! command_exists docker; then
    echo -e "\033[31mDocker command not found. Please install Docker Desktop.\033[0m"
    echo -e "\033[33mDownload from: https://www.docker.com/products/docker-desktop\033[0m"
    exit 1
fi

if ! docker_running; then
    # Detect OS and start Docker accordingly
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows (Git Bash)
        start_docker_desktop_windows || exit 1
    else
        # macOS or Linux
        start_docker_unix || exit 1
    fi
else
    echo -e "\033[32mDocker is already running!\033[0m"
fi

# 2. Check Supabase CLI
echo -e "\n\033[36m2. Checking Supabase CLI...\033[0m"

if ! command_exists supabase; then
    echo -e "\033[33mSupabase CLI not found. Installing via npm...\033[0m"
    npm install -g supabase
    if [ $? -ne 0 ]; then
        echo -e "\033[31mERROR: Failed to install Supabase CLI\033[0m"
        exit 1
    fi
    echo -e "\033[32mSupabase CLI installed successfully!\033[0m"
else
    echo -e "\033[32mSupabase CLI is installed!\033[0m"
fi

# 3. Start Supabase services
echo -e "\n\033[36m3. Starting Supabase services...\033[0m"

# Check if Supabase is already running
if supabase status >/dev/null 2>&1; then
    echo -e "\033[32mSupabase services are already running!\033[0m"
else
    echo -e "\033[33mStarting Supabase...\033[0m"
    supabase start
    
    if [ $? -ne 0 ]; then
        echo -e "\033[31mERROR: Failed to start Supabase services\033[0m"
        echo -e "\033[33mTry running 'supabase stop --backup' and then re-run this script\033[0m"
        exit 1
    fi
    
    echo -e "\033[32mSupabase services started successfully!\033[0m"
fi

# 4. Run migrations
echo -e "\n\033[36m4. Checking database migrations...\033[0m"

if supabase migration list >/dev/null 2>&1; then
    echo -e "\033[33mRunning pending migrations...\033[0m"
    supabase db push
    
    if [ $? -eq 0 ]; then
        echo -e "\033[32mMigrations applied successfully!\033[0m"
    else
        echo -e "\033[33mWARNING: Some migrations may have failed. Check the output above.\033[0m"
    fi
else
    echo -e "\033[33mCould not check migration status\033[0m"
fi

# 5. Display connection information
echo -e "\n\033[32m5. Local Development Environment Ready!\033[0m"
echo -e "\033[32m========================================\033[0m"
echo ""
echo -e "Supabase Studio: \033[36mhttp://localhost:54323\033[0m"
echo -e "Supabase URL:    \033[36mhttp://localhost:54321\033[0m"
echo -e "Database URL:    \033[36mpostgresql://postgres:postgres@localhost:54322/postgres\033[0m"
echo -e "Inbucket Email:  \033[36mhttp://localhost:54324\033[0m"
echo ""
echo -e "Next.js dev server will run on: \033[36mhttp://localhost:3000\033[0m"
echo ""
echo -e "To start the Next.js dev server, run: \033[33mnpm run dev\033[0m"
echo ""
echo -e "To stop Supabase services later, run: \033[33msupabase stop\033[0m"
echo ""