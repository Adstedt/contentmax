-- ============================================================================
-- SHOW ALL PROBLEMS FROM AUDIT
-- ============================================================================
-- Run this AFTER running the main audit query to see what needs fixing
-- ============================================================================

-- Show only errors and warnings
SELECT 
    CASE status
        WHEN 'ERROR' THEN '❌'
        WHEN 'WARNING' THEN '⚠️'
        WHEN 'NEEDS_FIX' THEN '🔧'
    END as "!",
    section as "Section",
    item as "Item",
    details as "Details",
    status as "Status"
FROM audit_report
WHERE status IN ('ERROR', 'WARNING', 'NEEDS_FIX')
ORDER BY 
    CASE status
        WHEN 'ERROR' THEN 1
        WHEN 'WARNING' THEN 2
        WHEN 'NEEDS_FIX' THEN 3
    END,
    section,
    item;

-- If the above doesn't work because temp table was dropped, 
-- run this simpler check for the most common issues:

-- Check if products table exists and has data
SELECT 
    'Products Table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products')
        THEN 'Table exists'
        ELSE 'TABLE MISSING!'
    END as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM products LIMIT 1)
        THEN (SELECT COUNT(*) || ' products found' FROM products)
        ELSE 'No products in table'
    END as data_status;

-- Check if product_categories table exists and has data  
SELECT 
    'Product Categories Table' as check_item,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_categories')
        THEN 'Table exists'
        ELSE 'TABLE MISSING!'
    END as status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM product_categories LIMIT 1)
        THEN (SELECT COUNT(*) || ' links found' FROM product_categories)
        ELSE 'No product-category links'
    END as data_status;

-- Check if product_categories has the problematic user_id column
SELECT 
    'Product Categories Schema' as check_item,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'product_categories' 
            AND column_name = 'user_id'
        )
        THEN '❌ ERROR: Has user_id column (should not exist)'
        ELSE '✅ OK: No user_id column'
    END as status;

-- List all columns in product_categories if it exists
SELECT 
    'product_categories.' || column_name as column,
    data_type,
    CASE 
        WHEN column_name = 'user_id' THEN '❌ SHOULD REMOVE'
        WHEN column_name IN ('product_id', 'category_id', 'created_at') THEN '✅ OK'
        ELSE '⚠️ UNEXPECTED'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'product_categories'
ORDER BY ordinal_position;

-- Check taxonomy_nodes for data
SELECT 
    'Taxonomy Nodes' as check_item,
    COUNT(*) || ' categories' as count,
    COUNT(CASE WHEN product_count > 0 THEN 1 END) || ' have products' as with_products,
    COUNT(CASE WHEN product_count = 0 THEN 1 END) || ' empty' as empty_categories
FROM taxonomy_nodes;

-- Show first few products to verify structure
SELECT 
    'Sample Products' as check_item,
    id,
    title,
    CASE 
        WHEN price IS NOT NULL THEN '$' || price::text
        ELSE 'No price'
    END as price,
    CASE 
        WHEN brand IS NOT NULL THEN brand
        ELSE 'No brand'
    END as brand
FROM products
LIMIT 5;