-- Create taxonomy_nodes table if not exists
CREATE TABLE IF NOT EXISTS taxonomy_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES taxonomy_nodes(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  content_status TEXT NOT NULL DEFAULT 'pending',
  has_content BOOLEAN DEFAULT false,
  sku_count INTEGER DEFAULT 0,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(project_id, url)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON taxonomy_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_project ON taxonomy_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON taxonomy_nodes(content_status);
CREATE INDEX IF NOT EXISTS idx_nodes_url ON taxonomy_nodes(url);
CREATE INDEX IF NOT EXISTS idx_nodes_depth ON taxonomy_nodes(depth);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_nodes_search ON taxonomy_nodes
  USING GIN(to_tsvector('english', title || ' ' || url));

-- Create materialized view for fast hierarchy queries
DROP MATERIALIZED VIEW IF EXISTS taxonomy_hierarchy CASCADE;
CREATE MATERIALIZED VIEW taxonomy_hierarchy AS
WITH RECURSIVE tree AS (
  -- Root nodes (nodes without parents)
  SELECT
    id,
    project_id,
    parent_id,
    url,
    title,
    depth,
    content_status,
    has_content,
    sku_count,
    last_modified,
    ARRAY[id]::UUID[] as path,
    url as full_path,
    title as breadcrumb
  FROM taxonomy_nodes
  WHERE parent_id IS NULL

  UNION ALL

  -- Recursive part: child nodes
  SELECT
    n.id,
    n.project_id,
    n.parent_id,
    n.url,
    n.title,
    n.depth,
    n.content_status,
    n.has_content,
    n.sku_count,
    n.last_modified,
    t.path || n.id,
    t.full_path || ' > ' || n.url,
    t.breadcrumb || ' > ' || n.title
  FROM taxonomy_nodes n
  INNER JOIN tree t ON n.parent_id = t.id
  WHERE NOT n.id = ANY(t.path) -- Prevent circular references
)
SELECT 
  *,
  array_length(path, 1) - 1 as calculated_depth,
  path[array_length(path, 1)] as leaf_id
FROM tree;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_hierarchy_id ON taxonomy_hierarchy(id);
CREATE INDEX idx_hierarchy_project ON taxonomy_hierarchy(project_id);
CREATE INDEX idx_hierarchy_depth ON taxonomy_hierarchy(calculated_depth);
CREATE INDEX idx_hierarchy_path ON taxonomy_hierarchy USING GIN(path);
CREATE INDEX idx_hierarchy_status ON taxonomy_hierarchy(content_status);

-- Create materialized view for node statistics
DROP MATERIALIZED VIEW IF EXISTS taxonomy_statistics CASCADE;
CREATE MATERIALIZED VIEW taxonomy_statistics AS
SELECT
  project_id,
  COUNT(*) as total_nodes,
  COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as root_nodes,
  COUNT(CASE WHEN has_content = true THEN 1 END) as nodes_with_content,
  COUNT(CASE WHEN content_status = 'processed' THEN 1 END) as processed_nodes,
  COUNT(CASE WHEN content_status = 'error' THEN 1 END) as error_nodes,
  COUNT(CASE WHEN content_status = 'pending' THEN 1 END) as pending_nodes,
  MAX(depth) as max_depth,
  AVG(depth)::NUMERIC(10,2) as avg_depth,
  SUM(sku_count) as total_skus,
  AVG(sku_count)::NUMERIC(10,2) as avg_skus_per_node,
  MIN(last_modified) as oldest_content,
  MAX(last_modified) as newest_content
FROM taxonomy_nodes
GROUP BY project_id;

-- Create index on statistics view
CREATE UNIQUE INDEX idx_statistics_project ON taxonomy_statistics(project_id);

-- Create materialized view for content gaps
DROP MATERIALIZED VIEW IF EXISTS content_gaps CASCADE;
CREATE MATERIALIZED VIEW content_gaps AS
SELECT
  n.id,
  n.project_id,
  n.url,
  n.title,
  n.depth,
  n.parent_id,
  CASE 
    WHEN n.has_content = false THEN 'missing'
    WHEN n.content_status = 'error' THEN 'error'
    WHEN n.last_modified < NOW() - INTERVAL '180 days' THEN 'outdated'
    WHEN n.sku_count = 0 AND NOT EXISTS (SELECT 1 FROM taxonomy_nodes WHERE parent_id = n.id) THEN 'thin'
    ELSE 'ok'
  END as gap_type,
  CASE 
    WHEN n.has_content = false THEN 1.0
    WHEN n.content_status = 'error' THEN 0.9
    WHEN n.last_modified < NOW() - INTERVAL '180 days' THEN 0.6
    WHEN n.sku_count = 0 AND NOT EXISTS (SELECT 1 FROM taxonomy_nodes WHERE parent_id = n.id) THEN 0.4
    ELSE 0.0
  END as priority_score,
  n.last_modified,
  n.sku_count,
  (SELECT COUNT(*) FROM taxonomy_nodes WHERE parent_id = n.id) as child_count
FROM taxonomy_nodes n
WHERE n.has_content = false 
   OR n.content_status = 'error'
   OR n.last_modified < NOW() - INTERVAL '180 days'
   OR (n.sku_count = 0 AND NOT EXISTS (SELECT 1 FROM taxonomy_nodes WHERE parent_id = n.id));

-- Create indexes on gaps view
CREATE INDEX idx_gaps_project ON content_gaps(project_id);
CREATE INDEX idx_gaps_type ON content_gaps(gap_type);
CREATE INDEX idx_gaps_priority ON content_gaps(priority_score DESC);

-- Create materialized view for sibling relationships
DROP MATERIALIZED VIEW IF EXISTS taxonomy_siblings CASCADE;
CREATE MATERIALIZED VIEW taxonomy_siblings AS
SELECT
  n1.id as node1_id,
  n2.id as node2_id,
  n1.parent_id,
  n1.project_id,
  n1.title as node1_title,
  n2.title as node2_title,
  n1.url as node1_url,
  n2.url as node2_url,
  ABS(n1.sku_count - n2.sku_count) as sku_diff,
  CASE 
    WHEN n1.content_status = n2.content_status THEN 1
    ELSE 0
  END as same_status
FROM taxonomy_nodes n1
INNER JOIN taxonomy_nodes n2 ON n1.parent_id = n2.parent_id
WHERE n1.id < n2.id -- Avoid duplicates
  AND n1.parent_id IS NOT NULL;

-- Create indexes on siblings view
CREATE INDEX idx_siblings_project ON taxonomy_siblings(project_id);
CREATE INDEX idx_siblings_parent ON taxonomy_siblings(parent_id);
CREATE INDEX idx_siblings_nodes ON taxonomy_siblings(node1_id, node2_id);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_taxonomy_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY taxonomy_hierarchy;
  REFRESH MATERIALIZED VIEW CONCURRENTLY taxonomy_statistics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY content_gaps;
  REFRESH MATERIALIZED VIEW CONCURRENTLY taxonomy_siblings;
END;
$$ LANGUAGE plpgsql;

-- Function to get node ancestors
CREATE OR REPLACE FUNCTION get_node_ancestors(node_id UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  url TEXT,
  depth INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestors AS (
    SELECT n.id, n.title, n.url, n.depth, n.parent_id
    FROM taxonomy_nodes n
    WHERE n.id = node_id
    
    UNION ALL
    
    SELECT n.id, n.title, n.url, n.depth, n.parent_id
    FROM taxonomy_nodes n
    INNER JOIN ancestors a ON n.id = a.parent_id
  )
  SELECT a.id, a.title, a.url, a.depth
  FROM ancestors a
  ORDER BY a.depth;
END;
$$ LANGUAGE plpgsql;

-- Function to get node descendants
CREATE OR REPLACE FUNCTION get_node_descendants(node_id UUID)
RETURNS TABLE(
  id UUID,
  title TEXT,
  url TEXT,
  depth INTEGER,
  has_content BOOLEAN,
  content_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE descendants AS (
    SELECT n.id, n.title, n.url, n.depth, n.has_content, n.content_status
    FROM taxonomy_nodes n
    WHERE n.parent_id = node_id
    
    UNION ALL
    
    SELECT n.id, n.title, n.url, n.depth, n.has_content, n.content_status
    FROM taxonomy_nodes n
    INNER JOIN descendants d ON n.parent_id = d.id
  )
  SELECT d.id, d.title, d.url, d.depth, d.has_content, d.content_status
  FROM descendants d
  ORDER BY d.depth, d.title;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job to refresh views (requires pg_cron extension)
-- Note: This is commented out as pg_cron may not be available in all environments
-- Uncomment if pg_cron is available
/*
SELECT cron.schedule(
  'refresh-taxonomy-views',
  '0 */1 * * *', -- Every hour
  'SELECT refresh_taxonomy_views();'
);
*/

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taxonomy_nodes_updated_at
  BEFORE UPDATE ON taxonomy_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON taxonomy_hierarchy TO authenticated;
GRANT SELECT ON taxonomy_statistics TO authenticated;
GRANT SELECT ON content_gaps TO authenticated;
GRANT SELECT ON taxonomy_siblings TO authenticated;
GRANT ALL ON taxonomy_nodes TO authenticated;

-- Row Level Security
ALTER TABLE taxonomy_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their project taxonomy nodes"
  ON taxonomy_nodes
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert taxonomy nodes for their projects"
  ON taxonomy_nodes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their project taxonomy nodes"
  ON taxonomy_nodes
  FOR UPDATE
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their project taxonomy nodes"
  ON taxonomy_nodes
  FOR DELETE
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.user_id = auth.uid()
    )
  );