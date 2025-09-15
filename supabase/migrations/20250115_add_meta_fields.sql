-- ============================================================================
-- ADD META FIELDS FOR SEO
-- ============================================================================
-- This migration adds meta_title and meta_description fields to products table
-- and ensures taxonomy_nodes has proper URL and meta fields
-- ============================================================================

BEGIN;

-- Add meta fields to products table if they don't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Add URL and meta fields to taxonomy_nodes if they don't exist
ALTER TABLE taxonomy_nodes
ADD COLUMN IF NOT EXISTS url TEXT,
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT;

-- Create indexes for faster SEO-related queries
CREATE INDEX IF NOT EXISTS idx_products_meta_title ON products(meta_title);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_url ON taxonomy_nodes(url);

-- Add comment explaining the fields
COMMENT ON COLUMN products.meta_title IS 'SEO meta title for product pages';
COMMENT ON COLUMN products.meta_description IS 'SEO meta description for product pages';
COMMENT ON COLUMN taxonomy_nodes.url IS 'Full URL for the category page';
COMMENT ON COLUMN taxonomy_nodes.meta_title IS 'SEO meta title for category pages';
COMMENT ON COLUMN taxonomy_nodes.meta_description IS 'SEO meta description for category pages';

COMMIT;

-- ============================================================================
-- After running this migration:
-- 1. Products will have meta_title and meta_description fields for SEO
-- 2. Taxonomy nodes will have URL and meta fields for category SEO
-- 3. These can be populated during import or fetched from actual pages
-- ============================================================================