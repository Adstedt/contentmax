-- ============================================================================
-- DATABASE AUDIT AND CLEANUP MIGRATION
-- ============================================================================
-- This migration performs a complete audit and cleanup of the database schema
-- to ensure consistency and proper structure for the ContentMax application
-- ============================================================================

-- Start transaction
BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES (Clean slate for RLS)
-- ============================================================================

-- Drop policies on taxonomy_nodes if they exist
DO $$ 
BEGIN
    -- Drop all existing policies on taxonomy_nodes
    DROP POLICY IF EXISTS "Users can view their own taxonomy nodes" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Users can insert their own taxonomy nodes" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Users can update their own taxonomy nodes" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Users can delete their own taxonomy nodes" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Enable read access for all users" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Enable update for users based on user_id" ON taxonomy_nodes;
    DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON taxonomy_nodes;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop policies on products if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own products" ON products;
    DROP POLICY IF EXISTS "Users can insert their own products" ON products;
    DROP POLICY IF EXISTS "Users can update their own products" ON products;
    DROP POLICY IF EXISTS "Users can delete their own products" ON products;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop policies on product_categories if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own product categories" ON product_categories;
    DROP POLICY IF EXISTS "Users can insert their own product categories" ON product_categories;
    DROP POLICY IF EXISTS "Users can delete their own product categories" ON product_categories;
    DROP POLICY IF EXISTS "Users can manage their own product categories" ON product_categories;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Drop policies on google_integrations if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own integrations" ON google_integrations;
    DROP POLICY IF EXISTS "Users can insert their own integrations" ON google_integrations;
    DROP POLICY IF EXISTS "Users can update their own integrations" ON google_integrations;
    DROP POLICY IF EXISTS "Users can delete their own integrations" ON google_integrations;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- ============================================================================
-- STEP 2: CREATE/UPDATE CORE TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- TAXONOMY_NODES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxonomy_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID,
    
    -- Core fields
    title TEXT NOT NULL,
    path TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    parent_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
    
    -- Metrics
    product_count INTEGER DEFAULT 0,
    traffic INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    performance_score INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    source VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, path)
);

-- Create indexes for taxonomy_nodes
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_user_id ON taxonomy_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_project_id ON taxonomy_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_parent_id ON taxonomy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_path ON taxonomy_nodes(path);
CREATE INDEX IF NOT EXISTS idx_taxonomy_nodes_depth ON taxonomy_nodes(depth);

-- -----------------------------------------------------------------------------
-- PRODUCTS TABLE
-- -----------------------------------------------------------------------------
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
    
    -- Performance metrics
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

-- Create indexes for products
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_project_id ON products(project_id);
CREATE INDEX IF NOT EXISTS idx_products_category_path ON products(category_path);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_id_id ON products(user_id, id);

-- -----------------------------------------------------------------------------
-- PRODUCT_CATEGORIES JUNCTION TABLE
-- -----------------------------------------------------------------------------
-- Drop and recreate to ensure correct schema
DROP TABLE IF EXISTS product_categories CASCADE;

CREATE TABLE product_categories (
    product_id TEXT NOT NULL,
    category_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES taxonomy_nodes(id) ON DELETE CASCADE
);

-- Create indexes for product_categories
CREATE INDEX idx_product_categories_product ON product_categories(product_id);
CREATE INDEX idx_product_categories_category ON product_categories(category_id);

-- -----------------------------------------------------------------------------
-- GOOGLE_INTEGRATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS google_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- OAuth tokens
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Account info
    email TEXT,
    scope TEXT,
    merchant_id TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- Create index for google_integrations
CREATE INDEX IF NOT EXISTS idx_google_integrations_user_id ON google_integrations(user_id);

-- -----------------------------------------------------------------------------
-- PERFORMANCE_HISTORY TABLE (for tracking metrics over time)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
    
    -- Metrics snapshot
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per entity per day
    UNIQUE(node_id, date),
    UNIQUE(product_id, date)
);

-- Create indexes for performance_history
CREATE INDEX IF NOT EXISTS idx_performance_history_node_id ON performance_history(node_id);
CREATE INDEX IF NOT EXISTS idx_performance_history_product_id ON performance_history(product_id);
CREATE INDEX IF NOT EXISTS idx_performance_history_date ON performance_history(date);

-- ============================================================================
-- STEP 3: CREATE UPDATE TRIGGER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DROP TRIGGER IF EXISTS update_taxonomy_nodes_updated_at ON taxonomy_nodes;
CREATE TRIGGER update_taxonomy_nodes_updated_at
    BEFORE UPDATE ON taxonomy_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_google_integrations_updated_at ON google_integrations;
CREATE TRIGGER update_google_integrations_updated_at
    BEFORE UPDATE ON google_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY AND CREATE POLICIES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- TAXONOMY_NODES POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own taxonomy nodes"
    ON taxonomy_nodes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own taxonomy nodes"
    ON taxonomy_nodes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own taxonomy nodes"
    ON taxonomy_nodes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own taxonomy nodes"
    ON taxonomy_nodes FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- PRODUCTS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

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

-- -----------------------------------------------------------------------------
-- PRODUCT_CATEGORIES POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

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

-- -----------------------------------------------------------------------------
-- GOOGLE_INTEGRATIONS POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
    ON google_integrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
    ON google_integrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
    ON google_integrations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
    ON google_integrations FOR DELETE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- PERFORMANCE_HISTORY POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own performance history"
    ON performance_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM taxonomy_nodes 
            WHERE taxonomy_nodes.id = performance_history.node_id 
            AND taxonomy_nodes.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM products 
            WHERE products.id = performance_history.product_id 
            AND products.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own performance history"
    ON performance_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM taxonomy_nodes 
            WHERE taxonomy_nodes.id = performance_history.node_id 
            AND taxonomy_nodes.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM products 
            WHERE products.id = performance_history.product_id 
            AND products.user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 5: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get products for a category
CREATE OR REPLACE FUNCTION get_category_products(category_id UUID)
RETURNS TABLE(
    id TEXT,
    title TEXT,
    description TEXT,
    price DECIMAL,
    image_link TEXT,
    brand TEXT,
    availability VARCHAR,
    impressions INTEGER,
    clicks INTEGER,
    revenue DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.price,
        p.image_link,
        p.brand,
        p.availability,
        p.impressions,
        p.clicks,
        p.revenue
    FROM products p
    INNER JOIN product_categories pc ON pc.product_id = p.id
    WHERE pc.category_id = get_category_products.category_id
    AND p.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a category is a leaf node
CREATE OR REPLACE FUNCTION is_leaf_category(category_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM taxonomy_nodes 
        WHERE parent_id = is_leaf_category.category_id
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: VERIFY AND REPORT
-- ============================================================================

-- Create a temporary table to store audit results
CREATE TEMP TABLE audit_results (
    table_name TEXT,
    status TEXT,
    row_count BIGINT
);

-- Check each table
INSERT INTO audit_results 
SELECT 'taxonomy_nodes', 'exists', COUNT(*) FROM taxonomy_nodes;

INSERT INTO audit_results 
SELECT 'products', 'exists', COUNT(*) FROM products;

INSERT INTO audit_results 
SELECT 'product_categories', 'exists', COUNT(*) FROM product_categories;

INSERT INTO audit_results 
SELECT 'google_integrations', 'exists', COUNT(*) FROM google_integrations;

INSERT INTO audit_results 
SELECT 'performance_history', 'exists', COUNT(*) FROM performance_history;

-- Display results
SELECT * FROM audit_results;

-- Commit transaction
COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration ensures:
-- 1. All necessary tables exist with correct schema
-- 2. All indexes are in place for performance
-- 3. RLS is enabled with proper policies
-- 4. Update triggers are working
-- 5. Helper functions are available
-- ============================================================================