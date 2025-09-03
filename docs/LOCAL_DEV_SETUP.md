# Local Development Environment Setup

This guide ensures Docker and Supabase are properly configured for local development.

## Prerequisites

### 1. Docker Desktop
- **Windows/Mac**: Download from [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: Install Docker Engine via your package manager
- Docker Desktop must be running before starting Supabase

### 2. Node.js & npm
- Node.js 20.0.0 or higher
- npm or pnpm package manager

### 3. Supabase CLI
Will be installed automatically by the startup scripts if not present.

## Quick Start

### Windows (PowerShell)
```powershell
npm run local:start
```

### macOS/Linux/Git Bash
```bash
npm run local:start:bash
```

This single command will:
1. ✅ Check and start Docker Desktop if needed
2. ✅ Install Supabase CLI if not present
3. ✅ Start all Supabase services
4. ✅ Apply database migrations
5. ✅ Display connection URLs

## Manual Setup (if scripts don't work)

### Step 1: Start Docker Desktop
- **Windows**: Open Docker Desktop from Start Menu
- **macOS**: Open Docker from Applications
- **Linux**: `sudo systemctl start docker`

Wait for Docker to fully start (icon shows "Docker Desktop is running")

### Step 2: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 3: Start Supabase
```bash
cd /path/to/contentmachine
supabase start
```

This will download and start these Docker containers:
- PostgreSQL database (port 54322)
- Supabase Studio (port 54323)
- Auth service (port 54321)
- Storage service
- Realtime service
- Email testing (Inbucket)

### Step 4: Apply Migrations
```bash
supabase db push
```

## Available Commands

### Database Management
```bash
# Start local Supabase
npm run local:start

# Stop Supabase services
npm run local:stop

# Reset database (warning: deletes all data!)
npm run db:reset

# Apply migrations
npm run db:push

# Create new migration
npm run db:migration:new migration_name

# Apply specific migration
npm run db:migration:up

# Generate TypeScript types from database
npm run db:types
```

### Testing Migrations
```bash
# Test the latest migration
npm run test:migration

# Run all tests
npm test
```

## Service URLs

Once running, these services are available:

| Service | URL | Description |
|---------|-----|-------------|
| **Supabase Studio** | http://localhost:54323 | Database management UI |
| **PostgreSQL** | postgresql://postgres:postgres@localhost:54322/postgres | Direct database connection |
| **Supabase API** | http://localhost:54321 | REST API endpoint |
| **Inbucket Email** | http://localhost:54324 | Email testing interface |
| **Next.js App** | http://localhost:3000 | Your application (run `npm run dev`) |

## Environment Variables

Create a `.env.local` file with:

```env
# Supabase Local Development
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start-output
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-supabase-start-output

# Get these keys from the output of `supabase start`
```

## Troubleshooting

### Docker not starting
1. **Windows**: Ensure virtualization is enabled in BIOS
2. **All platforms**: Check Docker Desktop settings → Resources → ensure adequate RAM (4GB minimum)

### Supabase start fails
```bash
# Stop and clean up
supabase stop --backup
docker system prune -a  # Warning: removes all unused Docker data

# Try again
supabase start
```

### Port conflicts
If you see "port already in use" errors:
1. Check what's using the port: 
   - Windows: `netstat -ano | findstr :54321`
   - Mac/Linux: `lsof -i :54321`
2. Stop the conflicting service or change Supabase ports in `supabase/config.toml`

### Migration fails
1. Check migration syntax: `supabase db lint`
2. Check logs: `supabase db logs`
3. Reset if needed: `supabase db reset`

### Types out of sync
After schema changes, regenerate types:
```bash
npm run db:types
```

## Docker Management

### Check Docker status
```bash
docker ps  # Show running containers
docker logs supabase_db_contentmachine  # View database logs
```

### Clean up Docker resources
```bash
# Stop all containers
docker stop $(docker ps -q)

# Remove unused resources (safe)
docker system prune

# Remove everything including volumes (warning: deletes data!)
docker system prune -a --volumes
```

## Best Practices

1. **Always start Docker first** before running Supabase commands
2. **Keep migrations small** - one logical change per migration
3. **Test migrations locally** before applying to production
4. **Backup before reset**: `supabase db dump -f backup.sql`
5. **Regenerate types** after schema changes: `npm run db:types`

## CI/CD Considerations

For CI environments, use these environment variables:
```bash
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_PROJECT_ID=your-project-id
```

## Getting Help

- Supabase Docs: https://supabase.com/docs
- Docker Docs: https://docs.docker.com
- Project Issues: https://github.com/Adstedt/contentmax/issues