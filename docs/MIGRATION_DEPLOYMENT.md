# Migration Deployment Guide

This guide explains how to deploy the database migrations to your Supabase instance.

## Migration Files

The latest migration (`009_node_centric_model.sql`) adds:
- New columns to `taxonomy_nodes` table
- New `node_metrics` table for performance data
- New `opportunities` table for scoring
- Required indexes and RLS policies

## Method 1: Using Supabase CLI (Recommended)

### Prerequisites
- Database password from Supabase Dashboard
- Supabase CLI installed (`npm install -g supabase`)

### Steps

1. **Run the migration script**:
```powershell
# Windows PowerShell
.\scripts\push-remote-migrations.ps1
```

2. **Enter your database password** when prompted
   - Find it in: [Supabase Dashboard > Settings > Database](https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/settings/database)
   - Or reset it if forgotten

3. The script will:
   - Link your local project to remote Supabase
   - Push all pending migrations
   - Show migration status

## Method 2: Manual via Supabase Dashboard

If the CLI method doesn't work, apply migrations manually:

1. **Open SQL Editor**:
   - Go to [Supabase Dashboard](https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/sql)
   - Click on "SQL Editor"

2. **Copy the migration content**:
   - Open `supabase/migrations/009_node_centric_model.sql`
   - Copy the entire contents

3. **Execute the migration**:
   - Paste the SQL into the editor
   - Click "Run" or press `Ctrl+Enter`

4. **Verify the migration**:
   - Check for any errors in the output
   - Verify tables exist in Table Editor

## Method 3: Using npm Commands

If you have the database password:

```bash
# Set password as environment variable (Windows)
set SUPABASE_DB_PASSWORD=your-password-here

# Set password as environment variable (Mac/Linux)
export SUPABASE_DB_PASSWORD=your-password-here

# Link and push
npx supabase link --project-ref zjtrssubwocvooygfxbj
npx supabase db push
```

## Verification

After applying migrations, verify they worked:

### Via Dashboard
1. Go to [Table Editor](https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/editor)
2. Check that these exist:
   - `node_metrics` table
   - `opportunities` table
   - New columns in `taxonomy_nodes`:
     - `opportunity_score`
     - `revenue_potential`
     - `optimization_status`
     - `last_scored_at`
     - `metrics_updated_at`

### Via SQL Query
Run this in SQL Editor:
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('node_metrics', 'opportunities');

-- Check new columns in taxonomy_nodes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'taxonomy_nodes' 
  AND column_name IN ('opportunity_score', 'revenue_potential', 'optimization_status');
```

## Rollback (if needed)

If you need to rollback the migration:

1. Open SQL Editor in Supabase Dashboard
2. Copy contents of `supabase/migrations/009_node_centric_model_rollback.sql`
3. Execute the rollback script

⚠️ **Warning**: Rollback will delete all data in the new tables!

## Troubleshooting

### "Password authentication failed"
- Reset password in Dashboard > Settings > Database
- Make sure you're using the database password, not your account password

### "Permission denied"
- Ensure you're using the correct project reference
- Check that your user has admin privileges

### "Table already exists"
- Migration may have been partially applied
- Check existing schema before re-running

### "Cannot find migration files"
- Ensure you're in the project root directory
- Check that migration files exist in `supabase/migrations/`

## Production Considerations

Before applying to production:
1. **Backup your database** via Dashboard > Settings > Backups
2. **Test on staging** if available
3. **Apply during low-traffic period**
4. **Monitor for errors** after deployment

## Getting Help

- Project URL: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj
- Database Settings: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/settings/database
- SQL Editor: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/sql
- Table Editor: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/editor