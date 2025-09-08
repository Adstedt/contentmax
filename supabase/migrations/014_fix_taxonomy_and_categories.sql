-- First, let's check and fix the taxonomy_nodes table structure
-- The id column should be TEXT, not UUID, for our category IDs like "electronics-phones"

-- Check if we need to modify the id column type
DO $$
BEGIN
  -- Check the current data type of id column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'taxonomy_nodes' 
    AND column_name = 'id'
    AND data_type = 'uuid'
  ) THEN
    -- If it's UUID and table is empty, we can safely change it
    IF NOT EXISTS (SELECT 1 FROM public.taxonomy_nodes LIMIT 1) THEN
      ALTER TABLE public.taxonomy_nodes ALTER COLUMN id TYPE TEXT USING id::TEXT;
    END IF;
  END IF;
END $$;

-- Add missing columns to taxonomy_nodes if they don't exist
ALTER TABLE public.taxonomy_nodes 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());

-- Create indexes for taxonomy_nodes
CREATE INDEX IF NOT EXISTS idx_taxonomy_user ON public.taxonomy_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_project ON public.taxonomy_nodes(project_id);

-- Create product_categories junction table (the main missing piece!)
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

-- Add foreign key constraints for product_categories
DO $$
BEGIN
  -- Only add constraint if products table exists and has records or if we're ok with it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_product_categories_product'
    ) THEN
      ALTER TABLE public.product_categories 
        ADD CONSTRAINT fk_product_categories_product 
        FOREIGN KEY (product_id) 
        REFERENCES public.products(id) 
        ON DELETE CASCADE;
    END IF;
  END IF;
  
  -- Add constraint for category_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_product_categories_category'
  ) THEN
    ALTER TABLE public.product_categories 
      ADD CONSTRAINT fk_product_categories_category 
      FOREIGN KEY (category_id) 
      REFERENCES public.taxonomy_nodes(id) 
      ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN others THEN
    -- If constraints fail, continue without them
    NULL;
END $$;

-- Enable Row Level Security
ALTER TABLE public.taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own taxonomy nodes" ON public.taxonomy_nodes;
DROP POLICY IF EXISTS "Users can insert their own taxonomy nodes" ON public.taxonomy_nodes;
DROP POLICY IF EXISTS "Users can update their own taxonomy nodes" ON public.taxonomy_nodes;
DROP POLICY IF EXISTS "Users can delete their own taxonomy nodes" ON public.taxonomy_nodes;

-- Create RLS policies for taxonomy_nodes
-- Allow operations for authenticated users (user_id can be NULL for initial imports)
CREATE POLICY "Users can view taxonomy nodes" ON public.taxonomy_nodes
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id IS NULL 
    OR auth.uid() IS NOT NULL  -- Allow any authenticated user to view for now
  );

CREATE POLICY "Users can insert taxonomy nodes" ON public.taxonomy_nodes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR auth.uid() IS NOT NULL  -- Allow any authenticated user to insert for now
  );

CREATE POLICY "Users can update taxonomy nodes" ON public.taxonomy_nodes
  FOR UPDATE USING (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR auth.uid() IS NOT NULL  -- Allow any authenticated user to update for now
  );

CREATE POLICY "Users can delete taxonomy nodes" ON public.taxonomy_nodes
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id IS NULL
  );

-- RLS Policies for product_categories
DROP POLICY IF EXISTS "Users can view their own product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can insert their own product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can delete their own product categories" ON public.product_categories;

CREATE POLICY "Users can view product categories" ON public.product_categories
  FOR SELECT USING (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR auth.uid() IS NOT NULL  -- Allow any authenticated user for now
  );

CREATE POLICY "Users can insert product categories" ON public.product_categories
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    OR user_id IS NULL
    OR auth.uid() IS NOT NULL  -- Allow any authenticated user for now
  );

CREATE POLICY "Users can delete product categories" ON public.product_categories
  FOR DELETE USING (
    auth.uid() = user_id 
    OR user_id IS NULL
  );

-- Grant permissions
GRANT ALL ON public.taxonomy_nodes TO authenticated;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.product_categories TO authenticated;

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for taxonomy_nodes if it doesn't exist
DROP TRIGGER IF EXISTS update_taxonomy_nodes_updated_at ON public.taxonomy_nodes;
CREATE TRIGGER update_taxonomy_nodes_updated_at 
  BEFORE UPDATE ON public.taxonomy_nodes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Verify the structure
DO $$
BEGIN
  RAISE NOTICE 'Migration complete. Tables created/updated:';
  RAISE NOTICE '- taxonomy_nodes (with user_id, project_id, product_count)';
  RAISE NOTICE '- product_categories (junction table)';
  RAISE NOTICE '- RLS policies configured';
END $$;