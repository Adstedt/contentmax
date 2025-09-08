-- Fix the taxonomy_nodes table ID type issue
-- The problem: id is UUID but we need TEXT for category IDs like "electronics-phones"
-- parent_id references id, so we need to fix both

-- First, check if the table has any data
DO $$
DECLARE
  row_count INTEGER;
  id_type TEXT;
BEGIN
  -- Get the current data type
  SELECT data_type INTO id_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'taxonomy_nodes' 
  AND column_name = 'id';
  
  -- Count rows
  SELECT COUNT(*) INTO row_count FROM public.taxonomy_nodes;
  
  RAISE NOTICE 'Current id type: %, Row count: %', id_type, row_count;
  
  -- Only proceed if we need to change from uuid to text
  IF id_type = 'uuid' THEN
    IF row_count = 0 THEN
      -- Table is empty, we can safely change the structure
      
      -- Drop the foreign key constraint first
      ALTER TABLE public.taxonomy_nodes 
        DROP CONSTRAINT IF EXISTS taxonomy_nodes_parent_id_fkey;
      
      -- Change parent_id to TEXT first (it references id)
      ALTER TABLE public.taxonomy_nodes 
        ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;
      
      -- Change id to TEXT
      ALTER TABLE public.taxonomy_nodes 
        ALTER COLUMN id TYPE TEXT USING id::TEXT;
      
      -- Recreate the foreign key constraint with TEXT types
      ALTER TABLE public.taxonomy_nodes 
        ADD CONSTRAINT taxonomy_nodes_parent_id_fkey 
        FOREIGN KEY (parent_id) 
        REFERENCES public.taxonomy_nodes(id) 
        ON DELETE CASCADE;
      
      RAISE NOTICE 'Successfully changed id and parent_id from UUID to TEXT';
    ELSE
      RAISE NOTICE 'Table has data, cannot change ID type. Please truncate table first if needed.';
    END IF;
  ELSE
    RAISE NOTICE 'ID column is already TEXT type, no change needed';
  END IF;
END $$;

-- Add missing columns to taxonomy_nodes if they don't exist
ALTER TABLE public.taxonomy_nodes 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW());

-- Add path and depth columns if missing
ALTER TABLE public.taxonomy_nodes
  ADD COLUMN IF NOT EXISTS path TEXT,
  ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;

-- Create indexes for taxonomy_nodes
CREATE INDEX IF NOT EXISTS idx_taxonomy_user ON public.taxonomy_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_project ON public.taxonomy_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_parent ON public.taxonomy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_depth ON public.taxonomy_nodes(depth);

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

-- Add foreign key constraints for product_categories (with error handling)
DO $$
BEGIN
  -- Try to add constraint for category_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_product_categories_category'
  ) THEN
    BEGIN
      ALTER TABLE public.product_categories 
        ADD CONSTRAINT fk_product_categories_category 
        FOREIGN KEY (category_id) 
        REFERENCES public.taxonomy_nodes(id) 
        ON DELETE CASCADE;
      RAISE NOTICE 'Added foreign key constraint for category_id';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Could not add foreign key for category_id: %', SQLERRM;
    END;
  END IF;
  
  -- Try to add constraint for product_id (only if products table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_product_categories_product'
    ) THEN
      BEGIN
        ALTER TABLE public.product_categories 
          ADD CONSTRAINT fk_product_categories_product 
          FOREIGN KEY (product_id) 
          REFERENCES public.products(id) 
          ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint for product_id';
      EXCEPTION
        WHEN others THEN
          RAISE NOTICE 'Could not add foreign key for product_id: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies for taxonomy_nodes
DROP POLICY IF EXISTS "Users can view taxonomy nodes" ON public.taxonomy_nodes;
DROP POLICY IF EXISTS "Users can insert taxonomy nodes" ON public.taxonomy_nodes;
DROP POLICY IF EXISTS "Users can update taxonomy nodes" ON public.taxonomy_nodes;
DROP POLICY IF EXISTS "Users can delete taxonomy nodes" ON public.taxonomy_nodes;

-- Permissive policies for testing (tighten these later)
CREATE POLICY "Allow authenticated users to view taxonomy" ON public.taxonomy_nodes
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert taxonomy" ON public.taxonomy_nodes
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update taxonomy" ON public.taxonomy_nodes
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete taxonomy" ON public.taxonomy_nodes
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- RLS Policies for product_categories
DROP POLICY IF EXISTS "Users can view product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can insert product categories" ON public.product_categories;
DROP POLICY IF EXISTS "Users can delete product categories" ON public.product_categories;

CREATE POLICY "Allow authenticated users to view product categories" ON public.product_categories
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert product categories" ON public.product_categories
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete product categories" ON public.product_categories
  FOR DELETE 
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Grant permissions
GRANT ALL ON public.taxonomy_nodes TO authenticated;
GRANT ALL ON public.product_categories TO authenticated;

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for taxonomy_nodes
DROP TRIGGER IF EXISTS update_taxonomy_nodes_updated_at ON public.taxonomy_nodes;
CREATE TRIGGER update_taxonomy_nodes_updated_at 
  BEFORE UPDATE ON public.taxonomy_nodes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Final verification
DO $$
DECLARE
  id_type TEXT;
  parent_type TEXT;
  cat_exists BOOLEAN;
BEGIN
  -- Check final types
  SELECT data_type INTO id_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'taxonomy_nodes' 
  AND column_name = 'id';
  
  SELECT data_type INTO parent_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'taxonomy_nodes' 
  AND column_name = 'parent_id';
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'product_categories'
  ) INTO cat_exists;
  
  RAISE NOTICE '=== Migration Complete ===';
  RAISE NOTICE 'taxonomy_nodes.id type: %', id_type;
  RAISE NOTICE 'taxonomy_nodes.parent_id type: %', parent_type;
  RAISE NOTICE 'product_categories table exists: %', cat_exists;
  RAISE NOTICE '';
  RAISE NOTICE 'Ready to import taxonomy data!';
END $$;