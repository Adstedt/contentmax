# Fix for Supabase CLI Migration Push Issues

## Problem Identified
The Supabase CLI is defaulting to the **pooler connection** which:
1. Doesn't have permissions for migration operations (can't create `cli_login_postgres` role)
2. Has connectivity issues (timeouts)
3. Is meant for application connections, NOT administrative tasks like migrations

## Solution Steps

### Step 1: Get Direct Database Connection
1. Go to: https://supabase.com/dashboard/project/zjtrssubwocvooygfxbj/settings/database
2. Find the **Direct connection** section (NOT Transaction pooler or Session pooler)
3. Copy the connection string that looks like:
   ```
   postgresql://postgres.zjtrssubwocvooygfxbj:[YOUR-PASSWORD]@db.zjtrssubwocvooygfxbj.supabase.co:5432/postgres
   ```

### Step 2: Get Your Database Password
- If you don't have it, reset it from the same settings page
- Click "Reset database password" if needed

### Step 3: Push Migrations Using Direct Connection
Use the `--db-url` flag to override the default pooler connection:

```bash
npx supabase db push --db-url "postgresql://postgres.zjtrssubwocvooygfxbj:[YOUR-PASSWORD]@db.zjtrssubwocvooygfxbj.supabase.co:5432/postgres"
```

**Important**: Replace `[YOUR-PASSWORD]` with your actual database password.

### Step 4: Alternative - Set Environment Variable
You can also set the database URL as an environment variable:

```bash
# Windows PowerShell
$env:POSTGRES_URL="postgresql://postgres.zjtrssubwocvooygfxbj:[YOUR-PASSWORD]@db.zjtrssubwocvooygfxbj.supabase.co:5432/postgres"

# Windows CMD
set POSTGRES_URL=postgresql://postgres.zjtrssubwocvooygfxbj:[YOUR-PASSWORD]@db.zjtrssubwocvooygfxbj.supabase.co:5432/postgres

# Then push
npx supabase db push --db-url $env:POSTGRES_URL
```

## Why This Works
- **Direct connection** (db.*.supabase.co) has full database permissions
- **Pooler connection** (aws-*.pooler.supabase.com) is limited for security and meant for app connections
- Migrations require admin-level permissions that only the direct connection provides

## Verify Success
After pushing, verify migrations were applied:
```bash
npx supabase db remote list --db-url "postgresql://postgres.zjtrssubwocvooygfxbj:[YOUR-PASSWORD]@db.zjtrssubwocvooygfxbj.supabase.co:5432/postgres"
```

## Note on Security
- Never commit the database password to git
- Consider using environment variables for the connection string in scripts
- The direct connection should only be used for migrations and admin tasks