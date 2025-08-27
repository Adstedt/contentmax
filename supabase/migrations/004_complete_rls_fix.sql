-- Drop ALL existing policies to start fresh
DO $$
BEGIN
    -- Drop all policies on each table
    DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
    DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
    DROP POLICY IF EXISTS "Users can view their own profile" ON users;
    DROP POLICY IF EXISTS "Users can view organization members" ON users;
    DROP POLICY IF EXISTS "Users can update their own profile" ON users;
    DROP POLICY IF EXISTS "Users can view their organization's projects" ON projects;
    DROP POLICY IF EXISTS "Editors can create projects" ON projects;
    DROP POLICY IF EXISTS "Editors can update projects" ON projects;
    DROP POLICY IF EXISTS "Users can view taxonomy nodes" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Editors can manage taxonomy nodes" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Users can view content items" ON content_items;
    DROP POLICY IF EXISTS "Editors can manage content items" ON content_items;
    DROP POLICY IF EXISTS "Users can view organization templates" ON templates;
    DROP POLICY IF EXISTS "Editors can manage templates" ON templates;
    DROP POLICY IF EXISTS "Users can view their generation queue" ON generation_queue;
    DROP POLICY IF EXISTS "Editors can manage generation queue" ON generation_queue;
    DROP POLICY IF EXISTS "Users can view scraped content" ON scraped_content;
    DROP POLICY IF EXISTS "Editors can manage scraped content" ON scraped_content;
    DROP POLICY IF EXISTS "Users can view their organization's audit logs" ON audit_logs;
END $$;

-- For now, let's use simpler policies that definitely won't cause recursion

-- 1. Users table - most basic policy
CREATE POLICY "Users can read own record"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own record"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- 2. Organizations - allow authenticated users to read
CREATE POLICY "Authenticated users can view organizations"
    ON organizations FOR SELECT
    USING (auth.role() = 'authenticated');

-- 3. Projects - allow authenticated users to read
CREATE POLICY "Authenticated users can view projects"
    ON projects FOR SELECT
    USING (auth.role() = 'authenticated');

-- 4. Other tables - allow authenticated users full access for now
CREATE POLICY "Authenticated users can manage taxonomy_nodes"
    ON taxonomy_nodes FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage content_items"
    ON content_items FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage templates"
    ON templates FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage generation_queue"
    ON generation_queue FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage scraped_content"
    ON scraped_content FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view audit_logs"
    ON audit_logs FOR SELECT
    USING (auth.role() = 'authenticated');