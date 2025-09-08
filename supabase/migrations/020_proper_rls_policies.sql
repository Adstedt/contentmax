-- Proper RLS policies that allow authenticated users to work with data

-- First, ensure RLS is enabled
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
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

-- TAXONOMY_NODES policies
CREATE POLICY "Enable read access for all users"
    ON taxonomy_nodes FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users"
    ON taxonomy_nodes FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
    ON taxonomy_nodes FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
    ON taxonomy_nodes FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- PRODUCTS policies
CREATE POLICY "Enable read access for all users"
    ON products FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users"
    ON products FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
    ON products FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
    ON products FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- PRODUCT_CATEGORIES policies (junction table)
CREATE POLICY "Enable read access for all users"
    ON product_categories FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users"
    ON product_categories FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
    ON product_categories FOR UPDATE
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
    ON product_categories FOR DELETE
    USING (auth.uid() IS NOT NULL);

-- Grant necessary permissions
GRANT ALL ON taxonomy_nodes TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_categories TO authenticated;