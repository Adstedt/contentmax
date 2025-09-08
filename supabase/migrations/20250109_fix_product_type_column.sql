-- ============================================================================
-- FIX PRODUCT_TYPE COLUMN MIGRATION
-- ============================================================================
-- This migration changes the product_type column from TEXT[] to TEXT
-- to match the Google Merchant feed format which provides a hierarchical string
-- ============================================================================

BEGIN;

-- Step 1: Drop the existing products table if it exists (since it has no data)
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Step 2: Recreate products table with correct schema
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID,
  
  -- Core product fields
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Product identifiers
  external_id TEXT,
  gtin TEXT,
  mpn TEXT,
  brand TEXT,
  
  -- URLs and images
  link TEXT,
  image_link TEXT,
  additional_images TEXT[],
  
  -- Availability and condition
  availability VARCHAR(50),
  condition VARCHAR(50),
  
  -- Categories - IMPORTANT: product_type is TEXT, not TEXT[]
  product_type TEXT,  -- This stores "Category > Subcategory > Item" format
  google_product_category TEXT,
  category_path TEXT,
  
  -- Performance metrics (from Google Merchant)
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Recreate indexes
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_project_id ON products(project_id);
CREATE INDEX idx_products_category_path ON products(category_path);
CREATE INDEX idx_products_product_type ON products(product_type);
CREATE UNIQUE INDEX idx_products_user_id_id ON products(user_id, id);

-- Step 4: Recreate product_categories junction table
CREATE TABLE product_categories (
  product_id TEXT NOT NULL,
  category_id TEXT NOT NULL,  -- Changed from UUID to TEXT to match taxonomy_nodes.id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (product_id, category_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES taxonomy_nodes(id) ON DELETE CASCADE
);

-- Create indexes for product_categories
CREATE INDEX idx_product_categories_product ON product_categories(product_id);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);

-- Step 5: Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own products"
  ON products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (auth.uid() = user_id);

-- Step 6: Enable RLS on product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own product categories"
  ON product_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_categories.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own product categories"
  ON product_categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_categories.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own product categories"
  ON product_categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_categories.product_id 
      AND products.user_id = auth.uid()
    )
  );

-- Step 7: Create or replace the trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running this migration:
-- 1. The products table will have product_type as TEXT (not TEXT[])
-- 2. Products can be imported directly from Google Merchant feeds
-- 3. The hierarchical string format is preserved ("Category > Subcategory > Item")
-- ============================================================================