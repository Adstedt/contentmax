-- Create scraped_content table for storing comprehensive scraping results
CREATE TABLE IF NOT EXISTS scraped_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_category TEXT NOT NULL CHECK (url_category IN ('category', 'brand', 'product', 'blog', 'other')),
  
  -- SEO Data
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  og_data JSONB,
  schema_markup JSONB,
  
  -- Content Data
  content JSONB NOT NULL,
  word_count INTEGER DEFAULT 0,
  unique_word_count INTEGER DEFAULT 0,
  content_depth TEXT CHECK (content_depth IN ('none', 'thin', 'moderate', 'rich')),
  
  -- Category/Brand Specific
  product_count INTEGER,
  subcategories JSONB,
  brand_data JSONB,
  
  -- Trust Signals
  trust_signals JSONB,
  
  -- Quality Metrics
  has_unique_content BOOLEAN DEFAULT false,
  is_templatized BOOLEAN DEFAULT false,
  content_to_code_ratio DECIMAL(5,2),
  
  -- Gap Analysis
  content_gaps JSONB NOT NULL,
  gap_score INTEGER CHECK (gap_score >= 0 AND gap_score <= 100),
  
  -- Pagination
  page_number INTEGER DEFAULT 1,
  total_pages INTEGER DEFAULT 1,
  is_paginated BOOLEAN DEFAULT false,
  
  -- Metadata
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed TIMESTAMPTZ,
  scrape_duration_ms INTEGER,
  
  -- Ensure unique URL per project and page
  UNIQUE(project_id, url, page_number)
);

-- Create indexes for efficient querying
CREATE INDEX idx_scraped_content_project ON scraped_content(project_id);
CREATE INDEX idx_scraped_content_category ON scraped_content(url_category);
CREATE INDEX idx_scraped_content_gaps ON scraped_content(gap_score);
CREATE INDEX idx_scraped_content_depth ON scraped_content(content_depth);
CREATE INDEX idx_scraped_content_paginated ON scraped_content(is_paginated, page_number);
CREATE INDEX idx_scraped_content_url ON scraped_content(url);
CREATE INDEX idx_scraped_content_scraped_at ON scraped_content(scraped_at DESC);

-- Create a view for gap analysis summary
CREATE OR REPLACE VIEW content_gap_summary AS
SELECT 
  project_id,
  url_category,
  COUNT(*) as total_pages,
  AVG(gap_score) as avg_gap_score,
  SUM(CASE WHEN gap_score >= 70 THEN 1 ELSE 0 END) as critical_gaps,
  SUM(CASE WHEN gap_score >= 50 AND gap_score < 70 THEN 1 ELSE 0 END) as high_gaps,
  SUM(CASE WHEN gap_score >= 30 AND gap_score < 50 THEN 1 ELSE 0 END) as medium_gaps,
  SUM(CASE WHEN gap_score < 30 THEN 1 ELSE 0 END) as low_gaps,
  AVG(word_count) as avg_word_count,
  SUM(CASE WHEN is_templatized = true THEN 1 ELSE 0 END) as template_pages,
  SUM(CASE WHEN content_depth = 'thin' OR content_depth = 'none' THEN 1 ELSE 0 END) as thin_content_pages
FROM scraped_content
GROUP BY project_id, url_category;

-- Create a function to calculate content quality score
CREATE OR REPLACE FUNCTION calculate_content_quality_score(
  p_word_count INTEGER,
  p_unique_word_count INTEGER,
  p_has_unique_content BOOLEAN,
  p_is_templatized BOOLEAN,
  p_content_depth TEXT,
  p_gap_score INTEGER
) RETURNS INTEGER AS $$
DECLARE
  quality_score INTEGER := 0;
BEGIN
  -- Word count score (0-25 points)
  IF p_word_count >= 500 THEN
    quality_score := quality_score + 25;
  ELSIF p_word_count >= 300 THEN
    quality_score := quality_score + 15;
  ELSIF p_word_count >= 100 THEN
    quality_score := quality_score + 5;
  END IF;
  
  -- Unique word count score (0-15 points)
  IF p_unique_word_count >= 200 THEN
    quality_score := quality_score + 15;
  ELSIF p_unique_word_count >= 100 THEN
    quality_score := quality_score + 10;
  ELSIF p_unique_word_count >= 50 THEN
    quality_score := quality_score + 5;
  END IF;
  
  -- Unique content bonus (20 points)
  IF p_has_unique_content THEN
    quality_score := quality_score + 20;
  END IF;
  
  -- Template penalty (-20 points)
  IF p_is_templatized THEN
    quality_score := quality_score - 20;
  END IF;
  
  -- Content depth score (0-20 points)
  CASE p_content_depth
    WHEN 'rich' THEN quality_score := quality_score + 20;
    WHEN 'moderate' THEN quality_score := quality_score + 10;
    WHEN 'thin' THEN quality_score := quality_score + 0;
    ELSE quality_score := quality_score + 0;
  END CASE;
  
  -- Gap score inverse (0-20 points)
  -- Lower gap score = better quality
  quality_score := quality_score + GREATEST(0, 20 - (p_gap_score / 5));
  
  -- Ensure score is between 0 and 100
  RETURN GREATEST(0, LEAST(100, quality_score));
END;
$$ LANGUAGE plpgsql;

-- Add quality score column and trigger to auto-calculate
ALTER TABLE scraped_content ADD COLUMN IF NOT EXISTS quality_score INTEGER;

-- Create trigger to auto-calculate quality score
CREATE OR REPLACE FUNCTION update_quality_score() RETURNS TRIGGER AS $$
BEGIN
  NEW.quality_score := calculate_content_quality_score(
    NEW.word_count,
    NEW.unique_word_count,
    NEW.has_unique_content,
    NEW.is_templatized,
    NEW.content_depth,
    NEW.gap_score
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scraped_content_quality_score
  BEFORE INSERT OR UPDATE ON scraped_content
  FOR EACH ROW
  EXECUTE FUNCTION update_quality_score();

-- Create a materialized view for performance analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS scraping_analytics AS
SELECT 
  project_id,
  DATE(scraped_at) as scrape_date,
  COUNT(*) as pages_scraped,
  AVG(scrape_duration_ms) as avg_duration_ms,
  AVG(word_count) as avg_word_count,
  AVG(gap_score) as avg_gap_score,
  AVG(quality_score) as avg_quality_score,
  COUNT(DISTINCT url) as unique_urls,
  SUM(CASE WHEN is_paginated THEN 1 ELSE 0 END) as paginated_urls
FROM scraped_content
GROUP BY project_id, DATE(scraped_at);

-- Create index on materialized view
CREATE INDEX idx_scraping_analytics_project_date 
  ON scraping_analytics(project_id, scrape_date DESC);

-- Row Level Security
ALTER TABLE scraped_content ENABLE ROW LEVEL SECURITY;

-- Policy for users to manage their own project's scraped content
CREATE POLICY "Users can manage their project's scraped content"
  ON scraped_content
  FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN organizations o ON p.organization_id = o.id
      JOIN users u ON u.organization_id = o.id
      WHERE u.id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON scraped_content TO authenticated;
GRANT SELECT ON content_gap_summary TO authenticated;
GRANT SELECT ON scraping_analytics TO authenticated;