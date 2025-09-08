-- Create products table for storing full product details
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Basic product info
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  image_link TEXT,
  
  -- Pricing
  price DECIMAL(10, 2),
  sale_price DECIMAL(10, 2),
  currency TEXT DEFAULT 'USD',
  
  -- Product attributes
  brand TEXT,
  gtin TEXT,
  mpn TEXT,
  condition TEXT,
  availability TEXT,
  
  -- Categories
  product_type TEXT,
  google_product_category TEXT,
  
  -- Additional data
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for products
CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_project ON public.products(project_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_availability ON public.products(availability);

-- Create product_categories junction table
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id TEXT,
  category_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  PRIMARY KEY (product_id, category_id)
);

-- Create indexes for product_categories
CREATE INDEX IF NOT EXISTS idx_product_cat_product ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_cat_category ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_cat_user ON public.product_categories(user_id);

-- Add foreign key constraints after table creation
ALTER TABLE public.product_categories 
  ADD CONSTRAINT fk_product_categories_product 
  FOREIGN KEY (product_id) 
  REFERENCES public.products(id) 
  ON DELETE CASCADE;

ALTER TABLE public.product_categories 
  ADD CONSTRAINT fk_product_categories_category 
  FOREIGN KEY (category_id) 
  REFERENCES public.taxonomy_nodes(id) 
  ON DELETE CASCADE;

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Users can view their own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for product_categories
CREATE POLICY "Users can view their own product categories" ON public.product_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product categories" ON public.product_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product categories" ON public.product_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for products updated_at
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON public.products
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.product_categories TO authenticated;

-- Add missing columns to taxonomy_nodes if they don't exist
DO $$
BEGIN
  -- Add user_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'taxonomy_nodes' 
                 AND column_name = 'user_id') THEN
    ALTER TABLE public.taxonomy_nodes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE INDEX idx_taxonomy_user ON public.taxonomy_nodes(user_id);
  END IF;
  
  -- Add project_id if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'taxonomy_nodes' 
                 AND column_name = 'project_id') THEN
    ALTER TABLE public.taxonomy_nodes ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;
    CREATE INDEX idx_taxonomy_project ON public.taxonomy_nodes(project_id);
  END IF;
  
  -- Add product_count if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'taxonomy_nodes' 
                 AND column_name = 'product_count') THEN
    ALTER TABLE public.taxonomy_nodes ADD COLUMN product_count INTEGER DEFAULT 0;
  END IF;
  
  -- Add source if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'taxonomy_nodes' 
                 AND column_name = 'source') THEN
    ALTER TABLE public.taxonomy_nodes ADD COLUMN source TEXT DEFAULT 'merchant';
  END IF;
END $$;