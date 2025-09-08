-- Create taxonomy_nodes table for storing category hierarchy
CREATE TABLE IF NOT EXISTS public.taxonomy_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT REFERENCES public.taxonomy_nodes(id) ON DELETE CASCADE,
  product_count INTEGER DEFAULT 0,
  source TEXT CHECK (source IN ('merchant', 'google', 'hybrid')) DEFAULT 'merchant',
  metadata JSONB DEFAULT '{}',
  
  -- User and project association
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Performance metrics (optional, can be updated later)
  traffic INTEGER DEFAULT 0,
  revenue DECIMAL(10, 2) DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Indexes for performance
  UNIQUE(id, user_id), -- Ensure unique nodes per user
  INDEX idx_taxonomy_user (user_id),
  INDEX idx_taxonomy_project (project_id),
  INDEX idx_taxonomy_parent (parent_id),
  INDEX idx_taxonomy_depth (depth)
);

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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Indexes
  INDEX idx_products_user (user_id),
  INDEX idx_products_project (project_id),
  INDEX idx_products_brand (brand),
  INDEX idx_products_availability (availability)
);

-- Create product_categories junction table
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES public.taxonomy_nodes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  PRIMARY KEY (product_id, category_id),
  INDEX idx_product_cat_product (product_id),
  INDEX idx_product_cat_category (category_id),
  INDEX idx_product_cat_user (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for taxonomy_nodes
CREATE POLICY "Users can view their own taxonomy nodes" ON public.taxonomy_nodes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own taxonomy nodes" ON public.taxonomy_nodes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own taxonomy nodes" ON public.taxonomy_nodes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own taxonomy nodes" ON public.taxonomy_nodes
  FOR DELETE USING (auth.uid() = user_id);

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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_taxonomy_nodes_updated_at BEFORE UPDATE ON public.taxonomy_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.taxonomy_nodes TO authenticated;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.product_categories TO authenticated;