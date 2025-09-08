-- ============================================================================
-- ADD URL TO PRODUCTS TABLE
-- ============================================================================

BEGIN;

-- Add url column if it doesn't exist (renaming link to url for clarity)
DO $$
BEGIN
    -- Check if 'url' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'url') THEN
        -- Check if we have 'link' column and rename it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' AND column_name = 'link') THEN
            ALTER TABLE products RENAME COLUMN link TO url;
        ELSE
            -- Add new url column
            ALTER TABLE products ADD COLUMN url TEXT;
        END IF;
    END IF;
END $$;

-- Create index on url for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);

COMMIT;