-- Migration: Enhanced scraped_content table for sitemap-driven content analysis
-- Dependencies: Story 2.3 - Sitemap-Driven Content Scraper & Analyzer

-- Add new columns to scraped_content table
ALTER TABLE scraped_content 
ADD COLUMN IF NOT EXISTS url_category TEXT CHECK (url_category IN ('category', 'brand', 'product', 'blog', 'other')),
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS canonical_url TEXT,
ADD COLUMN IF NOT EXISTS og_data JSONB,
ADD COLUMN IF NOT EXISTS schema_markup JSONB,
ADD COLUMN IF NOT EXISTS content JSONB, -- Full extracted content structure
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS unique_word_count INTEGER,
ADD COLUMN IF NOT EXISTS content_depth TEXT CHECK (content_depth IN ('none', 'thin', 'moderate', 'rich')),
ADD COLUMN IF NOT EXISTS product_count INTEGER,
ADD COLUMN IF NOT EXISTS subcategories JSONB,
ADD COLUMN IF NOT EXISTS brand_data JSONB,
ADD COLUMN IF NOT EXISTS has_unique_content BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_templatized BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS content_to_code_ratio DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS content_gaps JSONB, -- Gap analysis results
ADD COLUMN IF NOT EXISTS gap_score INTEGER CHECK (gap_score >= 0 AND gap_score <= 100),
ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_paginated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_analyzed TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS scrape_duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS metadata JSONB; -- Additional flexible metadata

-- Update existing constraints
ALTER TABLE scraped_content 
DROP CONSTRAINT IF EXISTS scraped_content_project_id_url_key;

-- Add new unique constraint including page_number for pagination support
ALTER TABLE scraped_content 
ADD CONSTRAINT scraped_content_project_url_page_unique 
UNIQUE (project_id, url, page_number);

-- Create indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_scraped_content_category 
ON scraped_content(url_category) 
WHERE url_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_content_gaps 
ON scraped_content(gap_score) 
WHERE gap_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_content_depth 
ON scraped_content(content_depth) 
WHERE content_depth IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_content_paginated 
ON scraped_content(is_paginated, page_number) 
WHERE is_paginated = true;

CREATE INDEX IF NOT EXISTS idx_scraped_content_project_category 
ON scraped_content(project_id, url_category) 
WHERE project_id IS NOT NULL AND url_category IS NOT NULL;

-- Create index for content gap queries
CREATE INDEX IF NOT EXISTS idx_scraped_content_gaps_jsonb 
ON scraped_content USING gin(content_gaps) 
WHERE content_gaps IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN scraped_content.url_category IS 'URL category from sitemap parser: category, brand, product, blog, or other';
COMMENT ON COLUMN scraped_content.content IS 'Complete extracted content including hero text, descriptions, FAQs, etc.';
COMMENT ON COLUMN scraped_content.content_gaps IS 'JSON object containing identified content gaps and missing elements';
COMMENT ON COLUMN scraped_content.gap_score IS 'Score from 0-100 indicating content gaps (higher = more gaps)';
COMMENT ON COLUMN scraped_content.unique_word_count IS 'Word count excluding boilerplate and template text';
COMMENT ON COLUMN scraped_content.is_templatized IS 'True if content appears to be generic template text';
COMMENT ON COLUMN scraped_content.page_number IS 'Page number for paginated content (1-based)';

-- Create a view for content gap analysis
CREATE OR REPLACE VIEW content_gap_analysis AS
SELECT 
    sc.project_id,
    sc.url_category,
    COUNT(*) as total_urls,
    COUNT(*) FILTER (WHERE content_depth = 'none') as no_content_count,
    COUNT(*) FILTER (WHERE content_depth = 'thin') as thin_content_count,
    COUNT(*) FILTER (WHERE content_depth = 'moderate') as moderate_content_count,
    COUNT(*) FILTER (WHERE content_depth = 'rich') as rich_content_count,
    COUNT(*) FILTER (WHERE is_templatized = true) as template_content_count,
    COUNT(*) FILTER (WHERE gap_score > 70) as high_gap_count,
    AVG(gap_score) as avg_gap_score,
    AVG(word_count) as avg_word_count,
    AVG(unique_word_count) as avg_unique_word_count
FROM scraped_content sc
WHERE sc.page_number = 1 -- Only count first pages for statistics
GROUP BY sc.project_id, sc.url_category;

-- Create a view for pagination summary
CREATE OR REPLACE VIEW paginated_content_summary AS
SELECT 
    project_id,
    url,
    MAX(page_number) as total_pages,
    SUM(word_count) as total_word_count,
    AVG(gap_score) as avg_gap_score,
    ARRAY_AGG(page_number ORDER BY page_number) as scraped_pages
FROM scraped_content
WHERE is_paginated = true
GROUP BY project_id, url;

-- Update RLS policies for scraped_content
DROP POLICY IF EXISTS "Users can view scraped content" ON scraped_content;
DROP POLICY IF EXISTS "Editors can manage scraped content" ON scraped_content;

CREATE POLICY "Users can view their organization's scraped content"
    ON scraped_content FOR SELECT
    USING (project_id IN (
        SELECT p.id FROM projects p
        JOIN users u ON u.organization_id = p.organization_id
        WHERE u.id = auth.uid()
    ));

CREATE POLICY "Editors can manage their organization's scraped content"
    ON scraped_content FOR ALL
    USING (project_id IN (
        SELECT p.id FROM projects p
        JOIN users u ON u.organization_id = p.organization_id
        WHERE u.id = auth.uid() AND u.role IN ('admin', 'editor')
    ));

-- Create function to calculate gap score
CREATE OR REPLACE FUNCTION calculate_gap_score(content_gaps JSONB)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
BEGIN
    -- Each gap type contributes to the score
    IF content_gaps->>'missingMetaTitle' = 'true' THEN score := score + 15; END IF;
    IF content_gaps->>'missingMetaDescription' = 'true' THEN score := score + 15; END IF;
    IF content_gaps->>'missingHeroContent' = 'true' THEN score := score + 10; END IF;
    IF content_gaps->>'thinDescription' = 'true' THEN score := score + 20; END IF;
    IF content_gaps->>'noUSP' = 'true' THEN score := score + 10; END IF;
    IF content_gaps->>'noFAQ' = 'true' THEN score := score + 10; END IF;
    IF content_gaps->>'noBuyingGuide' = 'true' THEN score := score + 5; END IF;
    IF content_gaps->>'noSchemaMarkup' = 'true' THEN score := score + 10; END IF;
    IF content_gaps->>'templateOnly' = 'true' THEN score := score + 5; END IF;
    
    RETURN LEAST(score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to auto-calculate gap score
CREATE OR REPLACE FUNCTION update_gap_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.content_gaps IS NOT NULL THEN
        NEW.gap_score := calculate_gap_score(NEW.content_gaps);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_gap_score_trigger
BEFORE INSERT OR UPDATE OF content_gaps ON scraped_content
FOR EACH ROW
EXECUTE FUNCTION update_gap_score();