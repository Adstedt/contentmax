-- Create products table
CREATE TABLE IF NOT EXISTS products (
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
  
  -- Categories
  product_type TEXT,
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

-- Create indexes for products table
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_project_id ON products(project_id);
CREATE INDEX IF NOT EXISTS idx_products_category_path ON products(category_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_id_id ON products(user_id, id);

-- Drop existing product_categories table if it exists (to handle schema changes)
DROP TABLE IF EXISTS product_categories CASCADE;

-- Create product_categories junction table with correct schema
CREATE TABLE product_categories (
  product_id TEXT NOT NULL,
  category_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (product_id, category_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES taxonomy_nodes(id) ON DELETE CASCADE
);

-- Create indexes for product_categories table
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

-- Add RLS policies for products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own products" ON products;
DROP POLICY IF EXISTS "Users can insert their own products" ON products;
DROP POLICY IF EXISTS "Users can update their own products" ON products;
DROP POLICY IF EXISTS "Users can delete their own products" ON products;

-- Create new policies
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

-- Add RLS policies for product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can insert their own product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can delete their own product categories" ON product_categories;
DROP POLICY IF EXISTS "Users can manage their own product categories" ON product_categories;

-- Create new policies
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();