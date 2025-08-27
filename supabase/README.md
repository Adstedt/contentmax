# Supabase Setup Guide

## Prerequisites

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project in Supabase dashboard
3. Wait for the project to be provisioned

## Configuration

### 1. Environment Variables

Copy your Supabase project credentials to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
```

You can find these values in your Supabase project dashboard under Settings > API.

### 2. Database Schema Setup

#### Option A: Using Supabase Dashboard (Recommended for initial setup)

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the SQL in the editor
4. Verify all tables are created under Database > Tables

#### Option B: Using Supabase CLI (For local development)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref [YOUR_PROJECT_REF]

# Run migrations
supabase db push
```

### 3. Seed Data (Optional)

To add sample data for development:

1. Open SQL Editor in Supabase dashboard
2. Copy contents of `supabase/seed.sql`
3. Update the user IDs to match your auth.users records
4. Run the SQL

### 4. Authentication Setup

#### Enable Email/Password Auth:
1. Go to Authentication > Providers in Supabase dashboard
2. Enable Email provider
3. Configure email templates as needed

#### Enable Google OAuth:
1. Go to Authentication > Providers
2. Enable Google provider
3. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
4. Add redirect URLs to Google Console:
   - `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`

### 5. Storage Setup (Future)

When ready to handle file uploads:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('avatars', 'avatars', true),
  ('content-images', 'content-images', true),
  ('templates', 'templates', false);
```

## Testing the Connection

Run the development server and test the connection:

```bash
npm run dev
```

Visit `http://localhost:3000/api/test-connection` to verify the database connection.

## Database Schema Overview

### Core Tables

- **organizations**: Multi-tenant organizations
- **users**: User profiles (extends auth.users)
- **projects**: Projects within organizations
- **taxonomy_nodes**: Hierarchical content structure
- **content_items**: Generated content
- **templates**: Content generation templates
- **generation_queue**: AI generation job queue
- **scraped_content**: Web scraping results
- **audit_logs**: Activity tracking

### Row Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only access data from their organization
- Role-based permissions (admin, editor, viewer)
- Soft delete support (deleted_at timestamp)

### Key Features

- UUID primary keys for better distribution
- JSONB columns for flexible metadata
- Automatic updated_at timestamps via triggers
- Comprehensive indexes for query performance
- Audit logging for all major operations

## Type Safety

TypeScript types are generated in `types/database.types.ts`. 

To regenerate types after schema changes:

```bash
npx supabase gen types typescript --project-id [YOUR_PROJECT_ID] > types/database.types.ts
```

## Utility Functions

The `lib/supabase/utils.ts` file provides helper functions:

- `getCurrentUser()`: Get authenticated user profile
- `getCurrentOrganization()`: Get user's organization
- `hasRole()`: Check user permissions
- `createAuditLog()`: Log user actions
- `softDelete()`: Soft delete records
- `getPaginated()`: Paginated queries

## Security Best Practices

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY` to the client
2. **Always use RLS** policies for data access control
3. **Validate all inputs** before database operations
4. **Use prepared statements** (handled by Supabase client)
5. **Implement rate limiting** for API endpoints
6. **Regular backups** via Supabase dashboard

## Troubleshooting

### Connection Issues
- Verify environment variables are set correctly
- Check if project is active in Supabase dashboard
- Ensure RLS policies aren't blocking access

### Migration Errors
- Check for syntax errors in SQL
- Ensure extensions are enabled (uuid-ossp)
- Verify foreign key relationships

### Type Errors
- Regenerate types after schema changes
- Ensure @/types path alias is configured

## Next Steps

1. Set up authentication flows (Story 1.3)
2. Create dashboard UI (Story 1.4)
3. Implement real-time subscriptions
4. Add data validation schemas with Zod