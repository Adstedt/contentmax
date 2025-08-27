-- TEMPORARY: Disable RLS to test connection
-- This is safe and reversible - it doesn't delete anything

-- Disable RLS on all tables temporarily
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE content_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_content DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- After testing, you can re-enable with:
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- etc...