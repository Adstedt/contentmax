-- ============================================================================
-- COMPLETE SCHEMA FIX MIGRATION
-- ============================================================================
-- This migration ensures both products and product_categories work correctly
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Ensure products table has user_id column
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'user_id') THEN
        ALTER TABLE products ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- Set user_id for any existing products (if any)
        -- This assumes you have at least one user in the system
        UPDATE products 
        SET user_id = (SELECT id FROM auth.users LIMIT 1)
        WHERE user_id IS NULL;
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Fix product_categories table
-- ============================================================================

-- Drop the existing product_categories table with wrong schema
DROP TABLE IF EXISTS product_categories CASCADE;

-- Recreate with correct schema
CREATE TABLE product_categories (
    product_id TEXT NOT NULL,
    category_id TEXT NOT NULL,  -- TEXT to match taxonomy_nodes.id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES taxonomy_nodes(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_product_categories_product ON product_categories(product_id);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Create correct RLS policies (checking ownership through products table)
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

CREATE POLICY "Users can update their own product categories"
    ON product_categories FOR UPDATE
    USING (
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

-- ============================================================================
-- STEP 3: Ensure products table has RLS policies
-- ============================================================================

-- Enable RLS on products if not already enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own products" ON products;
DROP POLICY IF EXISTS "Users can insert their own products" ON products;
DROP POLICY IF EXISTS "Users can update their own products" ON products;
DROP POLICY IF EXISTS "Users can delete their own products" ON products;

-- Create policies for products
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

-- ============================================================================
-- STEP 4: Verify the schema
-- ============================================================================
DO $$
DECLARE
    v_has_user_id BOOLEAN;
    v_products_count INTEGER;
BEGIN
    -- Check if products has user_id now
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'user_id'
    ) INTO v_has_user_id;
    
    IF v_has_user_id THEN
        RAISE NOTICE '✅ Products table has user_id column';
    ELSE
        RAISE WARNING '❌ Products table is missing user_id column!';
    END IF;
    
    -- Check product count
    SELECT COUNT(*) INTO v_products_count FROM products;
    RAISE NOTICE 'Products table has % rows', v_products_count;
    
    -- Check if product_categories has correct schema
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_categories' AND column_name = 'user_id'
    ) THEN
        RAISE NOTICE '✅ product_categories correctly has no user_id column';
    ELSE
        RAISE WARNING '❌ product_categories still has user_id column!';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After this migration:
-- 1. Products table will have user_id column
-- 2. Product_categories will have correct schema
-- 3. RLS policies will work correctly
-- 4. You can re-import your feed and products will be saved!
-- ============================================================================