-- Simple RLS fix - temporarily allow all operations for authenticated users
-- This is a development/testing configuration

-- Disable RLS temporarily (simplest solution for development)
ALTER TABLE taxonomy_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled but make it permissive
-- Uncomment the following and comment out the DISABLE lines above:

/*
-- Enable RLS
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('taxonomy_nodes', 'products', 'product_categories')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Create simple permissive policies for authenticated users
CREATE POLICY "Allow all for authenticated users"
  ON taxonomy_nodes
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users"
  ON products
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all for authenticated users"
  ON product_categories
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
*/

-- Grant permissions
GRANT ALL ON taxonomy_nodes TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_categories TO authenticated;