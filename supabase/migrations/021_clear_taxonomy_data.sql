-- Clear existing taxonomy data to re-import with fixed capitalization
-- WARNING: This will delete all existing taxonomy data!

-- Delete in correct order due to foreign key constraints
DELETE FROM product_categories;
DELETE FROM products;
DELETE FROM taxonomy_nodes;

-- Verify cleanup
SELECT 
  'taxonomy_nodes' as table_name, COUNT(*) as row_count FROM taxonomy_nodes
UNION ALL
SELECT 
  'products' as table_name, COUNT(*) as row_count FROM products
UNION ALL
SELECT 
  'product_categories' as table_name, COUNT(*) as row_count FROM product_categories;