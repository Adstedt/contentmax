# Database Setup Instructions

Your Supabase connection is working! Now we need to create the database tables.

## Quick Setup Steps

1. **Open your Supabase Dashboard**
   - Go to: https://zjtrssubwocvooygfxbj.supabase.co
   - Or go to https://supabase.com/dashboard and select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Run the Migration Script**
   - Click "New query"
   - Copy ALL the contents from: `supabase/migrations/001_initial_schema.sql`
   - Paste it into the SQL Editor
   - Click "Run" or press Ctrl+Enter

4. **Verify Tables Created**
   - Go to "Table Editor" in the left sidebar
   - You should see these tables:
     - organizations
     - users
     - projects
     - taxonomy_nodes
     - content_items
     - templates
     - generation_queue
     - scraped_content
     - audit_logs

5. **(Optional) Add Sample Data**
   - If you want sample data for testing:
   - Go back to SQL Editor
   - Create a new query
   - Copy contents from: `supabase/seed.sql`
   - Run the query

## Test the Connection

After running the migration, test the connection again:

```bash
curl http://localhost:3000/api/test-connection
```

You should see:

```json
{
  "success": true,
  "message": "Successfully connected to Supabase",
  "timestamp": "..."
}
```

## Troubleshooting

If you get errors:

- Make sure you're logged into the correct Supabase project
- Check that ALL the SQL from the migration file was copied
- Look for any error messages in the SQL Editor output
- The migration includes triggers and RLS policies which might show warnings (these are OK)

## Next Steps

Once the database is set up:

1. The authentication system can be implemented (Story 1.3)
2. You can start using the database in your app
3. RLS policies are already configured for security
