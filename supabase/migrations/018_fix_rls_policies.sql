-- Fix RLS policies for taxonomy and product tables
-- This migration updates RLS policies to allow authenticated users to manage their own data

-- Enable RLS on all relevant tables
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all taxonomy nodes" ON taxonomy_nodes;
DROP POLICY IF EXISTS "Users can insert their own taxonomy nodes" ON taxonomy_nodes;
DROP POLICY IF EXISTS "Users can update their own taxonomy nodes" ON taxonomy_nodes;
DROP POLICY IF EXISTS "Users can delete their own taxonomy nodes" ON taxonomy_nodes;

DROP POLICY IF EXISTS "Users can view all products" ON products;
DROP POLICY IF EXISTS "Users can insert their own products" ON products;
DROP POLICY IF EXISTS "Users can update their own products" ON products;
DROP POLICY IF EXISTS "Users can delete their own products" ON products;

DROP POLICY IF EXISTS "Users can view all product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can insert product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can update product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can delete product categories" ON product_categories;

-- Taxonomy nodes policies
CREATE POLICY "Users can view all taxonomy nodes"
  ON taxonomy_nodes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own taxonomy nodes"
  ON taxonomy_nodes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own taxonomy nodes"
  ON taxonomy_nodes FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own taxonomy nodes"
  ON taxonomy_nodes FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Products policies
CREATE POLICY "Users can view all products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL)
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (user_id = auth.uid() OR user_id IS NULL)
  );

-- Product categories policies (junction table)
CREATE POLICY "Users can view all product categories"
  ON product_categories FOR SELECT
  USING (true);

CREATE POLICY "Users can insert product categories"
  ON product_categories FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update product categories"
  ON product_categories FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete product categories"
  ON product_categories FOR DELETE
  USING (
    auth.uid() IS NOT NULL
  );

-- Also ensure service role can bypass RLS (for server-side operations)
-- Service role automatically bypasses RLS, but let's ensure the tables are set up correctly

-- Grant necessary permissions
GRANT ALL ON taxonomy_nodes TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_categories TO authenticated;

-- Note: These tables use TEXT IDs, not sequences, so no sequence grants needed