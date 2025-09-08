-- ============================================================================
-- FIX PRODUCTS SCHEMA MIGRATION
-- ============================================================================
-- This migration fixes the issues found in the database audit:
-- 1. Fixes product_categories table schema
-- 2. Ensures products can be saved properly
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Fix product_categories table
-- ============================================================================

-- Drop the existing product_categories table with wrong schema
DROP TABLE IF EXISTS product_categories CASCADE;

-- Recreate with correct schema
CREATE TABLE product_categories (
    product_id TEXT NOT NULL,
    category_id TEXT NOT NULL,  -- Must be TEXT to match taxonomy_nodes.id which is TEXT
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
-- STEP 2: Ensure products table has all necessary columns
-- ============================================================================

-- Add any missing columns to products table
DO $$
BEGIN
    -- Add external_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'external_id') THEN
        ALTER TABLE products ADD COLUMN external_id TEXT;
    END IF;
    
    -- Add project_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'project_id') THEN
        ALTER TABLE products ADD COLUMN project_id UUID;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Fix the FeedTaxonomyBuilder to handle product IDs correctly
-- ============================================================================
-- Note: The code fix is needed in the TypeScript file, but we'll add a helper function

-- Function to safely insert products with generated IDs if needed
CREATE OR REPLACE FUNCTION insert_product_with_id(
    p_user_id UUID,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_price DECIMAL DEFAULT NULL,
    p_image_link TEXT DEFAULT NULL,
    p_link TEXT DEFAULT NULL,
    p_brand TEXT DEFAULT NULL,
    p_availability VARCHAR DEFAULT NULL,
    p_product_type TEXT DEFAULT NULL,
    p_google_product_category TEXT DEFAULT NULL,
    p_external_id TEXT DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_product_id TEXT;
BEGIN
    -- Generate a product ID if external_id is not provided
    v_product_id := COALESCE(p_external_id, 'prod_' || gen_random_uuid()::text);
    
    -- Insert the product
    INSERT INTO products (
        id, user_id, title, description, price, image_link, link, 
        brand, availability, product_type, google_product_category,
        external_id, project_id, created_at, updated_at
    ) VALUES (
        v_product_id, p_user_id, p_title, p_description, p_price, p_image_link, p_link,
        p_brand, p_availability, p_product_type, p_google_product_category,
        p_external_id, p_project_id, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        updated_at = NOW();
    
    RETURN v_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 4: Verify the fixes
-- ============================================================================

-- Check if tables are correctly structured now
DO $$
DECLARE
    v_products_count INTEGER;
    v_categories_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_products_count FROM products;
    SELECT COUNT(*) INTO v_categories_count FROM product_categories;
    
    RAISE NOTICE 'Products table has % rows', v_products_count;
    RAISE NOTICE 'Product_categories table has % rows', v_categories_count;
    
    -- Check product_categories columns
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'product_categories' AND column_name = 'user_id') THEN
        RAISE WARNING 'product_categories still has user_id column!';
    ELSE
        RAISE NOTICE 'product_categories schema is correct (no user_id column)';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running this migration:
-- 1. The product_categories table will have the correct schema
-- 2. RLS policies will work correctly
-- 3. Products can be properly saved and linked to categories
-- 
-- Next step: Re-import your feed to populate the products table
-- ============================================================================