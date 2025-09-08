-- Add performance metrics columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ctr DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Add performance metrics columns to taxonomy_nodes table
ALTER TABLE taxonomy_nodes
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ctr DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_position DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS performance_score INTEGER DEFAULT 50;

-- Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_products_performance ON products(impressions, clicks, revenue);
CREATE INDEX IF NOT EXISTS idx_taxonomy_performance ON taxonomy_nodes(impressions, clicks, revenue);

-- Create google_integrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS google_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scope TEXT,
    merchant_id TEXT,
    account_email TEXT,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create performance_history table for tracking metrics over time
CREATE TABLE IF NOT EXISTS performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'category')),
    entity_id UUID NOT NULL,
    date DATE NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    ctr DECIMAL(5,2) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(entity_type, entity_id, date)
);

-- Create index for performance history queries
CREATE INDEX IF NOT EXISTS idx_performance_history_entity ON performance_history(entity_type, entity_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_history_date ON performance_history(date DESC);

-- Add RLS policies for google_integrations
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Google integrations"
    ON google_integrations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Google integrations"
    ON google_integrations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Google integrations"
    ON google_integrations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Google integrations"
    ON google_integrations FOR DELETE
    USING (auth.uid() = user_id);

-- Add RLS policies for performance_history
ALTER TABLE performance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own performance history"
    ON performance_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own performance history"
    ON performance_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to calculate performance score based on metrics
CREATE OR REPLACE FUNCTION calculate_performance_score(
    p_impressions INTEGER,
    p_clicks INTEGER,
    p_conversions INTEGER,
    p_revenue DECIMAL
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 50; -- Base score
    ctr_score INTEGER;
    conversion_score INTEGER;
    revenue_score INTEGER;
BEGIN
    -- CTR component (0-30 points)
    IF p_impressions > 0 THEN
        ctr_score := LEAST(30, FLOOR((p_clicks::DECIMAL / p_impressions) * 300));
        score := score + ctr_score;
    END IF;
    
    -- Conversion rate component (0-30 points)
    IF p_clicks > 0 THEN
        conversion_score := LEAST(30, FLOOR((p_conversions::DECIMAL / p_clicks) * 150));
        score := score + conversion_score;
    END IF;
    
    -- Revenue component (0-40 points based on relative performance)
    IF p_revenue > 0 THEN
        revenue_score := LEAST(40, FLOOR(LOG(p_revenue + 1) * 5));
        score := score + revenue_score;
    END IF;
    
    RETURN LEAST(100, score);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update performance score when metrics change
CREATE OR REPLACE FUNCTION update_performance_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.performance_score := calculate_performance_score(
        NEW.impressions,
        NEW.clicks,
        NEW.conversions,
        NEW.revenue
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taxonomy_performance_score
    BEFORE INSERT OR UPDATE OF impressions, clicks, conversions, revenue
    ON taxonomy_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_score();

-- Add comments for documentation
COMMENT ON COLUMN products.impressions IS 'Number of times product appeared in search results';
COMMENT ON COLUMN products.clicks IS 'Number of clicks on the product';
COMMENT ON COLUMN products.ctr IS 'Click-through rate percentage';
COMMENT ON COLUMN products.conversions IS 'Number of purchases';
COMMENT ON COLUMN products.conversion_rate IS 'Conversion rate percentage';
COMMENT ON COLUMN products.revenue IS 'Total revenue generated';
COMMENT ON COLUMN products.last_synced_at IS 'Last time performance data was synced';

COMMENT ON COLUMN taxonomy_nodes.performance_score IS 'Calculated score 0-100 based on performance metrics';
COMMENT ON TABLE google_integrations IS 'Stores Google OAuth tokens and integration details';
COMMENT ON TABLE performance_history IS 'Historical performance metrics for tracking trends';