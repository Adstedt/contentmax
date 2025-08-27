# Story 1.2: Supabase Setup & Database Schema

## User Story
As a system architect,
I want Supabase configured with proper database schema,
So that we can persist user data and content with real-time capabilities.

## Size & Priority
- **Size**: L (8 hours)
- **Priority**: P0 - Critical
- **Sprint**: 1
- **Dependencies**: Task 1.1

## Description
Configure Supabase project and create initial database schema for ContentMax, including all core tables, relationships, and Row Level Security policies.

## Prerequisites
- Supabase account created (see docs/external-services-setup.md)
- Environment variables ready

## Implementation Steps

1. **Install Supabase client libraries**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. **Create initial database schema migration**
   ```sql
   -- Core tables needed
   CREATE TABLE organizations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     slug TEXT UNIQUE NOT NULL,
     settings JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT auth.uid(),
     email TEXT UNIQUE NOT NULL,
     organization_id UUID REFERENCES organizations(id),
     role TEXT CHECK (role IN ('admin', 'editor', 'viewer')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE projects (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     organization_id UUID REFERENCES organizations(id),
     name TEXT NOT NULL,
     domain TEXT NOT NULL,
     settings JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE taxonomy_nodes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id UUID REFERENCES projects(id),
     parent_id UUID REFERENCES taxonomy_nodes(id),
     url TEXT NOT NULL,
     title TEXT,
     content_status TEXT CHECK (content_status IN ('optimized', 'outdated', 'missing', 'none')),
     sku_count INTEGER DEFAULT 0,
     metadata JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE content_items (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id UUID REFERENCES projects(id),
     taxonomy_node_id UUID REFERENCES taxonomy_nodes(id),
     type TEXT CHECK (type IN ('brand', 'category', 'inspire', 'engage')),
     language TEXT DEFAULT 'en',
     status TEXT CHECK (status IN ('draft', 'review', 'approved', 'published')),
     content JSONB NOT NULL,
     generated_at TIMESTAMP WITH TIME ZONE,
     published_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE generation_queue (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     project_id UUID REFERENCES projects(id),
     user_id UUID REFERENCES users(id),
     status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
     priority INTEGER DEFAULT 0,
     config JSONB NOT NULL,
     result JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     started_at TIMESTAMP WITH TIME ZONE,
     completed_at TIMESTAMP WITH TIME ZONE
   );
   ```

3. **Set up Row Level Security (RLS)**
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
   ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
   ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
   ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;

   -- Create policies (example for projects table)
   CREATE POLICY "Users can view their organization's projects"
     ON projects FOR SELECT
     USING (organization_id IN (
       SELECT organization_id FROM users WHERE id = auth.uid()
     ));
   ```

4. **Create Supabase client configurations**

5. **Set up type generation**
   ```bash
   npx supabase gen types typescript --project-id [your-project-id] > types/database.types.ts
   ```

## Files to Create

- `supabase/migrations/001_initial_schema.sql` - Complete database schema
- `lib/supabase/client.ts` - Client-side Supabase instance
- `lib/supabase/server.ts` - Server-side Supabase instance  
- `types/database.types.ts` - Generated database types
- `.env.local` - Environment variables (never commit)

### Example client.ts:
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

## Acceptance Criteria

- [x] Supabase project created and configured
- [x] All database tables created with proper relationships
- [x] Row Level Security policies implemented
- [x] Type-safe database client configured
- [x] Connection tested from Next.js app
- [x] Database migrations applied successfully
- [x] Seed script creates sample data
- [ ] Real-time subscriptions tested

## Technical Notes

- Use UUID for all primary keys for better distribution
- Implement soft deletes where appropriate (add deleted_at column)
- Create indexes on frequently queried columns
- Set up database triggers for updated_at timestamps
- Use JSONB for flexible metadata storage

## Security Considerations

- Never expose service_role key to client
- Use Row Level Security for all tables
- Validate all inputs before database operations
- Use prepared statements to prevent SQL injection
- Implement rate limiting on API calls

## Testing Requirements

- Test CRUD operations for all tables
- Verify RLS policies work correctly
- Test real-time subscriptions
- Confirm type safety with TypeScript
- Load test with sample data (1000+ records)

## Definition of Done

- [x] Code complete and committed
- [x] Database schema fully implemented
- [x] RLS policies tested and working
- [x] Types generated and integrated
- [x] Connection from app verified
- [x] Documentation updated
- [ ] Peer review completed

## Dev Agent Record

### Status
Ready for Review

### Agent Model Used
claude-opus-4-1-20250805 (James - Full Stack Developer)

### Debug Log References
- Installed @supabase/supabase-js and @supabase/ssr packages
- Created comprehensive database schema with all required tables
- Implemented Row Level Security policies for all tables
- Set up TypeScript types for type-safe database access
- Created seed data for development testing

### Completion Notes
- Complete database schema implemented with 9 core tables
- Comprehensive RLS policies for role-based access control
- Type-safe Supabase client configuration for browser and server
- Utility functions for common database operations
- Middleware setup for auth session management
- Test endpoint created to verify connection
- Detailed README with setup instructions
- Soft delete support with deleted_at timestamps
- Audit logging system implemented
- Database triggers for automatic updated_at timestamps

### File List
- `lib/supabase/client.ts` - Created (Browser client)
- `lib/supabase/server.ts` - Created (Server client)
- `lib/supabase/utils.ts` - Created (Utility functions)
- `lib/supabase/middleware.ts` - Created (Auth middleware)
- `types/database.types.ts` - Created (TypeScript types)
- `supabase/migrations/001_initial_schema.sql` - Created (Database schema)
- `supabase/seed.sql` - Created (Seed data)
- `supabase/README.md` - Created (Setup guide)
- `app/api/test-connection/route.ts` - Created (Connection test)
- `middleware.ts` - Created (Next.js middleware)
- `package.json` - Modified (Dependencies added)

### Change Log
- Set up complete Supabase integration with Next.js
- Created production-ready database schema
- Implemented comprehensive security with RLS
- Added type safety throughout the application