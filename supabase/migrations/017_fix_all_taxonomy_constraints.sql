-- Complete fix for taxonomy_nodes table and ALL related tables
-- This handles all foreign key constraints that reference taxonomy_nodes.id

-- First, check if the tables have any data
DO $$
DECLARE
  row_count INTEGER;
  content_count INTEGER;
  metrics_count INTEGER;
  id_type TEXT;
  r RECORD;
BEGIN
  -- Get the current data type
  SELECT data_type INTO id_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'taxonomy_nodes' 
  AND column_name = 'id';
  
  -- Count rows in all affected tables
  SELECT COUNT(*) INTO row_count FROM public.taxonomy_nodes;
  SELECT COUNT(*) INTO content_count FROM public.content_items;
  
  -- Check if node_metrics exists and count rows
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_metrics') THEN
    SELECT COUNT(*) INTO metrics_count FROM public.node_metrics;
  ELSE
    metrics_count := 0;
  END IF;
  
  RAISE NOTICE 'Current id type: %, taxonomy_nodes: %, content_items: %, node_metrics: %', 
    id_type, row_count, content_count, metrics_count;
  
  -- Only proceed if we need to change from uuid to text
  IF id_type = 'uuid' THEN
    IF row_count = 0 AND content_count = 0 AND metrics_count = 0 THEN
      -- All tables are empty, we can safely change the structure
      
      -- Step 1: Drop ALL foreign key constraints that reference taxonomy_nodes.id
      RAISE NOTICE 'Dropping foreign key constraints...';
      
      -- Drop constraint from content_items
      ALTER TABLE public.content_items 
        DROP CONSTRAINT IF EXISTS content_items_taxonomy_node_id_fkey;
      
      -- Drop constraint from node_metrics if it exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_metrics') THEN
        ALTER TABLE public.node_metrics 
          DROP CONSTRAINT IF EXISTS node_metrics_node_id_fkey;
      END IF;
      
      -- Drop self-referencing constraint from taxonomy_nodes
      ALTER TABLE public.taxonomy_nodes 
        DROP CONSTRAINT IF EXISTS taxonomy_nodes_parent_id_fkey;
      
      -- Check for any other tables with foreign keys to taxonomy_nodes
      FOR r IN (
        SELECT DISTINCT
          tc.table_name,
          kcu.column_name,
          tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'taxonomy_nodes'
          AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
      ) LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
          r.table_name, r.constraint_name);
        RAISE NOTICE 'Dropped constraint % from table %', r.constraint_name, r.table_name;
      END LOOP;
      
      -- Step 2: Change column types
      RAISE NOTICE 'Changing column types to TEXT...';
      
      -- Change taxonomy_nodes columns
      ALTER TABLE public.taxonomy_nodes 
        ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;
      
      ALTER TABLE public.taxonomy_nodes 
        ALTER COLUMN id TYPE TEXT USING id::TEXT;
      
      -- Change content_items.taxonomy_node_id
      ALTER TABLE public.content_items 
        ALTER COLUMN taxonomy_node_id TYPE TEXT USING taxonomy_node_id::TEXT;
      
      -- Change node_metrics.node_id if it exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_metrics') THEN
        ALTER TABLE public.node_metrics 
          ALTER COLUMN node_id TYPE TEXT USING node_id::TEXT;
      END IF;
      
      -- Step 3: Recreate foreign key constraints
      RAISE NOTICE 'Recreating foreign key constraints...';
      
      -- Recreate self-referencing constraint for taxonomy_nodes
      ALTER TABLE public.taxonomy_nodes 
        ADD CONSTRAINT taxonomy_nodes_parent_id_fkey 
        FOREIGN KEY (parent_id) 
        REFERENCES public.taxonomy_nodes(id) 
        ON DELETE CASCADE;
      
      -- Recreate constraint from content_items
      ALTER TABLE public.content_items 
        ADD CONSTRAINT content_items_taxonomy_node_id_fkey 
        FOREIGN KEY (taxonomy_node_id) 
        REFERENCES public.taxonomy_nodes(id) 
        ON DELETE SET NULL;
      
      -- Recreate constraint from node_metrics if it exists
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_metrics') THEN
        ALTER TABLE public.node_metrics 
          ADD CONSTRAINT node_metrics_node_id_fkey 
          FOREIGN KEY (node_id) 
          REFERENCES public.taxonomy_nodes(id) 
          ON DELETE CASCADE;
      END IF;
      
      RAISE NOTICE 'Successfully changed all ID columns from UUID to TEXT';
    ELSE
      RAISE NOTICE 'Tables have data, cannot change ID type.';
      RAISE NOTICE 'Row counts - taxonomy_nodes: %, content_items: %, node_metrics: %', 
        row_count, content_count, metrics_count;
      RAISE NOTICE 'Please truncate all tables first if you want to proceed.';
    END IF;
  ELSE
    RAISE NOTICE 'ID column is already TEXT type, no change needed';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error during type conversion: %', SQLERRM;
    RAISE;
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

-- Handle the url column issue
DO $$
BEGIN
  -- Check if url column exists and has a NOT NULL constraint
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'taxonomy_nodes' 
    AND column_name = 'url'
  ) THEN
    -- Make url nullable or add a default value
    ALTER TABLE public.taxonomy_nodes 
      ALTER COLUMN url DROP NOT NULL,
      ALTER COLUMN url SET DEFAULT '';
    RAISE NOTICE 'Made url column nullable with empty string default';
  END IF;
END $$;

-- Create indexes for taxonomy_nodes
CREATE INDEX IF NOT EXISTS idx_taxonomy_user ON public.taxonomy_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_project ON public.taxonomy_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_parent ON public.taxonomy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_depth ON public.taxonomy_nodes(depth);
CREATE INDEX IF NOT EXISTS idx_taxonomy_path ON public.taxonomy_nodes(path);

-- Create product_categories junction table
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id TEXT,
  category_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  PRIMARY KEY (product_id, category_id)
);

-- Create indexes for product_categories
CREATE INDEX IF NOT EXISTS idx_product_cat_product ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_cat_category ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_cat_user ON public.product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_product_cat_project ON public.product_categories(project_id);

-- Add foreign key constraints for product_categories
DO $$
BEGIN
  -- Add constraint for category_id (after ensuring types match)
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
  
  -- Add constraint for product_id if products table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    -- Check if products.id is TEXT type
    DECLARE
      products_id_type TEXT;
    BEGIN
      SELECT data_type INTO products_id_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'products' 
      AND column_name = 'id';
      
      IF products_id_type = 'text' OR products_id_type = 'character varying' THEN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_product_categories_product'
        ) THEN
          ALTER TABLE public.product_categories 
            ADD CONSTRAINT fk_product_categories_product 
            FOREIGN KEY (product_id) 
            REFERENCES public.products(id) 
            ON DELETE CASCADE;
          RAISE NOTICE 'Added foreign key constraint for product_id';
        END IF;
      ELSE
        RAISE NOTICE 'Products.id is %, not adding foreign key', products_id_type;
      END IF;
    END;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.taxonomy_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Clean up old policies and create new ones
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all existing policies for taxonomy_nodes
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'taxonomy_nodes' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.taxonomy_nodes', r.policyname);
  END LOOP;
  
  -- Drop all existing policies for product_categories
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'product_categories' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_categories', r.policyname);
  END LOOP;
END $$;

-- Create new RLS policies for taxonomy_nodes
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

-- Create new RLS policies for product_categories
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

-- Final verification and summary
DO $$
DECLARE
  id_type TEXT;
  parent_type TEXT;
  content_id_type TEXT;
  metrics_id_type TEXT;
  cat_exists BOOLEAN;
  url_nullable TEXT;
  constraint_count INTEGER;
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
  
  SELECT data_type INTO content_id_type
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'content_items' 
  AND column_name = 'taxonomy_node_id';
  
  -- Check node_metrics if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_metrics') THEN
    SELECT data_type INTO metrics_id_type
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'node_metrics' 
    AND column_name = 'node_id';
  ELSE
    metrics_id_type := 'N/A';
  END IF;
  
  SELECT is_nullable INTO url_nullable
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'taxonomy_nodes' 
  AND column_name = 'url';
  
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'product_categories'
  ) INTO cat_exists;
  
  -- Count foreign key constraints referencing taxonomy_nodes
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'taxonomy_nodes'
    AND ccu.column_name = 'id';
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Migration Complete ===';
  RAISE NOTICE 'taxonomy_nodes.id type: %', id_type;
  RAISE NOTICE 'taxonomy_nodes.parent_id type: %', parent_type;
  RAISE NOTICE 'content_items.taxonomy_node_id type: %', content_id_type;
  RAISE NOTICE 'node_metrics.node_id type: %', metrics_id_type;
  RAISE NOTICE 'taxonomy_nodes.url nullable: %', url_nullable;
  RAISE NOTICE 'product_categories table exists: %', cat_exists;
  RAISE NOTICE 'Foreign key constraints to taxonomy_nodes: %', constraint_count;
  RAISE NOTICE '';
  
  IF id_type = 'text' OR id_type = 'character varying' THEN
    RAISE NOTICE '✅ Ready to import taxonomy data!';
  ELSE
    RAISE NOTICE '⚠️  ID columns still need to be converted to TEXT';
  END IF;
END $$;