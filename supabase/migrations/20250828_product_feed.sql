-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  sale_price DECIMAL(10, 2),
  availability VARCHAR(20) DEFAULT 'out of stock',
  brand TEXT,
  image_url TEXT,
  additional_images JSONB,
  gtin TEXT,
  mpn TEXT,
  product_type TEXT[],
  google_category TEXT,
  custom_attributes JSONB,
  condition VARCHAR(20),
  channel VARCHAR(20),
  content_language VARCHAR(10),
  target_country VARCHAR(2),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category-Product relationship
CREATE TABLE IF NOT EXISTS category_products (
  category_id UUID REFERENCES taxonomy_nodes(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (category_id, product_id)
);

-- Feed sync history
CREATE TABLE IF NOT EXISTS feed_sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id TEXT NOT NULL,
  merchant_id TEXT,
  sync_type VARCHAR(20), -- 'full' or 'delta'
  status VARCHAR(20), -- 'running', 'success', 'failed', 'partial'
  products_processed INTEGER DEFAULT 0,
  products_added INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_removed INTEGER DEFAULT 0,
  products_failed INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feed configuration
CREATE TABLE IF NOT EXISTS feed_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_name TEXT NOT NULL,
  feed_type VARCHAR(50) NOT NULL, -- 'google_merchant', 'xml', 'json'
  merchant_id TEXT,
  account_id TEXT,
  feed_url TEXT,
  auth_credentials JSONB, -- Encrypted OAuth tokens
  sync_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  delta_sync_enabled BOOLEAN DEFAULT true,
  auto_sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  next_sync_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product changes tracking (for delta sync)
CREATE TABLE IF NOT EXISTS product_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL,
  change_type VARCHAR(20) NOT NULL, -- 'created', 'updated', 'deleted'
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  sync_id UUID REFERENCES feed_sync_history(id),
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update SKU counts in taxonomy nodes
CREATE OR REPLACE FUNCTION update_category_sku_counts()
RETURNS void AS $$
BEGIN
  -- Update SKU counts for all categories
  UPDATE taxonomy_nodes tn
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{sku_count}',
    to_jsonb(sub.count)
  )
  FROM (
    SELECT
      category_id,
      COUNT(DISTINCT product_id) as count
    FROM category_products cp
    JOIN products p ON cp.product_id = p.id
    WHERE p.availability = 'in stock'
    GROUP BY category_id
  ) sub
  WHERE tn.id = sub.category_id;

  -- Set zero for categories with no products
  UPDATE taxonomy_nodes
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{sku_count}',
    '0'::jsonb
  )
  WHERE id NOT IN (
    SELECT DISTINCT category_id FROM category_products
  );
END;
$$ LANGUAGE plpgsql;

-- Function to calculate category metrics
CREATE OR REPLACE FUNCTION recalculate_taxonomy_metrics(
  include_sku_counts BOOLEAN DEFAULT true,
  include_revenue BOOLEAN DEFAULT false,
  include_availability BOOLEAN DEFAULT true
)
RETURNS void AS $$
BEGIN
  IF include_sku_counts THEN
    PERFORM update_category_sku_counts();
  END IF;

  IF include_availability THEN
    -- Update availability percentages
    UPDATE taxonomy_nodes tn
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{availability_rate}',
      to_jsonb(sub.rate)
    )
    FROM (
      SELECT
        category_id,
        ROUND(
          COUNT(CASE WHEN p.availability = 'in stock' THEN 1 END)::numeric * 100 / 
          NULLIF(COUNT(*), 0),
          2
        ) as rate
      FROM category_products cp
      JOIN products p ON cp.product_id = p.id
      GROUP BY category_id
    ) sub
    WHERE tn.id = sub.category_id;
  END IF;

  IF include_revenue THEN
    -- Update potential revenue (sum of prices)
    UPDATE taxonomy_nodes tn
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{total_value}',
      to_jsonb(sub.total)
    )
    FROM (
      SELECT
        category_id,
        SUM(COALESCE(p.sale_price, p.price, 0)) as total
      FROM category_products cp
      JOIN products p ON cp.product_id = p.id
      WHERE p.availability = 'in stock'
      GROUP BY category_id
    ) sub
    WHERE tn.id = sub.category_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to mark stale products
CREATE OR REPLACE FUNCTION mark_stale_products(
  active_product_ids TEXT[],
  stale_threshold INTERVAL DEFAULT '7 days'
)
RETURNS INTEGER AS $$
DECLARE
  stale_count INTEGER;
BEGIN
  -- Mark products not in the active list as potentially stale
  UPDATE products
  SET custom_attributes = jsonb_set(
    COALESCE(custom_attributes, '{}'::jsonb),
    '{stale}',
    'true'::jsonb
  )
  WHERE id NOT IN (SELECT unnest(active_product_ids))
    AND last_updated < NOW() - stale_threshold;

  GET DIAGNOSTICS stale_count = ROW_COUNT;
  RETURN stale_count;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_availability ON products(availability);
CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);
CREATE INDEX IF NOT EXISTS idx_products_last_updated ON products(last_updated);
CREATE INDEX IF NOT EXISTS idx_category_products_category ON category_products(category_id);
CREATE INDEX IF NOT EXISTS idx_category_products_product ON category_products(product_id);
CREATE INDEX IF NOT EXISTS idx_feed_sync_history_feed ON feed_sync_history(feed_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_sync_history_status ON feed_sync_history(status);
CREATE INDEX IF NOT EXISTS idx_product_changes_product ON product_changes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_changes_sync ON product_changes(sync_id);

-- Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_changes ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
CREATE POLICY "Products are editable by authenticated users" ON products FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Category products are viewable by everyone" ON category_products FOR SELECT USING (true);
CREATE POLICY "Category products are editable by authenticated users" ON category_products FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Feed sync history is viewable by authenticated users" ON feed_sync_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Feed sync history is editable by authenticated users" ON feed_sync_history FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Feed config is viewable by authenticated users" ON feed_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Feed config is editable by authenticated users" ON feed_config FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Product changes are viewable by authenticated users" ON product_changes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Product changes are editable by authenticated users" ON product_changes FOR ALL USING (auth.role() = 'authenticated');