-- ============================================================================
-- DATABASE AUDIT QUERY - RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- This query will show you the ACTUAL current state of your database
-- Copy and run this entire script in your Supabase SQL Editor
-- ============================================================================

-- Create temporary audit results table
CREATE TEMP TABLE IF NOT EXISTS audit_report (
    section TEXT,
    item TEXT,
    details TEXT,
    status TEXT
);

-- ============================================================================
-- 1. CHECK WHICH TABLES EXIST
-- ============================================================================
INSERT INTO audit_report
SELECT 
    '1. TABLES',
    tablename,
    'Table exists in schema: ' || schemaname,
    'EXISTS'
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'taxonomy_nodes',
    'products', 
    'product_categories',
    'google_integrations',
    'performance_history'
);

-- Check for unexpected tables
INSERT INTO audit_report
SELECT 
    '1. TABLES',
    tablename,
    'UNEXPECTED TABLE in schema: ' || schemaname,
    'WARNING'
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename NOT IN (
    'taxonomy_nodes',
    'products', 
    'product_categories',
    'google_integrations',
    'performance_history'
)
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE '_prisma%';

-- ============================================================================
-- 2. CHECK COLUMNS FOR EACH TABLE
-- ============================================================================

-- Check taxonomy_nodes columns
INSERT INTO audit_report
SELECT 
    '2. COLUMNS',
    'taxonomy_nodes.' || column_name,
    data_type || CASE 
        WHEN is_nullable = 'NO' THEN ' NOT NULL' 
        ELSE ' NULLABLE' 
    END,
    CASE 
        WHEN column_name IN ('id', 'user_id', 'title', 'path', 'depth', 'parent_id', 'product_count', 'created_at', 'updated_at')
        THEN 'EXPECTED'
        ELSE 'EXTRA'
    END
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'taxonomy_nodes'
ORDER BY ordinal_position;

-- Check products columns (if table exists)
INSERT INTO audit_report
SELECT 
    '2. COLUMNS',
    'products.' || column_name,
    data_type || CASE 
        WHEN is_nullable = 'NO' THEN ' NOT NULL' 
        ELSE ' NULLABLE' 
    END,
    CASE 
        WHEN column_name IN ('id', 'user_id', 'title', 'description', 'price', 'image_link', 'brand', 'availability', 'created_at', 'updated_at')
        THEN 'EXPECTED'
        ELSE 'OK'
    END
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'products'
ORDER BY ordinal_position;

-- Check product_categories columns (if table exists)
INSERT INTO audit_report
SELECT 
    '2. COLUMNS',
    'product_categories.' || column_name,
    data_type || CASE 
        WHEN is_nullable = 'NO' THEN ' NOT NULL' 
        ELSE ' NULLABLE' 
    END,
    CASE 
        WHEN column_name IN ('product_id', 'category_id', 'created_at')
        THEN 'EXPECTED'
        WHEN column_name = 'user_id'
        THEN 'SHOULD_REMOVE'
        ELSE 'EXTRA'
    END
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'product_categories'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. CHECK FOREIGN KEY CONSTRAINTS
-- ============================================================================
INSERT INTO audit_report
SELECT 
    '3. FOREIGN KEYS',
    conname,
    'FROM ' || 
    (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name::regclass = conrelid) ||
    ' TO ' ||
    (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name::regclass = confrelid),
    'EXISTS'
FROM pg_constraint
WHERE contype = 'f'
AND connamespace = 'public'::regnamespace;

-- ============================================================================
-- 4. CHECK INDEXES
-- ============================================================================
INSERT INTO audit_report
SELECT 
    '4. INDEXES',
    indexname,
    'ON ' || tablename || ' - ' || indexdef,
    CASE 
        WHEN indexname LIKE 'idx_%' THEN 'CUSTOM'
        WHEN indexname LIKE '%_pkey' THEN 'PRIMARY'
        ELSE 'SYSTEM'
    END
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('taxonomy_nodes', 'products', 'product_categories', 'google_integrations');

-- ============================================================================
-- 5. CHECK RLS POLICIES
-- ============================================================================
INSERT INTO audit_report
SELECT 
    '5. RLS POLICIES',
    tablename || '.' || policyname,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN 'PERMISSIVE ' 
        ELSE 'RESTRICTIVE ' 
    END || cmd,
    CASE 
        WHEN tablename IN ('taxonomy_nodes', 'products', 'product_categories', 'google_integrations')
        THEN 'OK'
        ELSE 'UNEXPECTED'
    END
FROM pg_policies
WHERE schemaname = 'public';

-- ============================================================================
-- 6. CHECK RLS STATUS
-- ============================================================================
INSERT INTO audit_report
SELECT 
    '6. RLS STATUS',
    tablename,
    CASE 
        WHEN rowsecurity = true THEN 'RLS ENABLED'
        ELSE 'RLS DISABLED - WARNING!'
    END,
    CASE 
        WHEN rowsecurity = true THEN 'OK'
        ELSE 'NEEDS_FIX'
    END
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('taxonomy_nodes', 'products', 'product_categories', 'google_integrations');

-- ============================================================================
-- 7. CHECK DATA COUNTS
-- ============================================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check taxonomy_nodes
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'taxonomy_nodes') THEN
        SELECT COUNT(*) INTO v_count FROM taxonomy_nodes;
        INSERT INTO audit_report VALUES('7. DATA', 'taxonomy_nodes', v_count || ' rows', 'INFO');
    ELSE
        INSERT INTO audit_report VALUES('7. DATA', 'taxonomy_nodes', 'TABLE DOES NOT EXIST', 'ERROR');
    END IF;
    
    -- Check products
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') THEN
        SELECT COUNT(*) INTO v_count FROM products;
        INSERT INTO audit_report VALUES('7. DATA', 'products', v_count || ' rows', 
            CASE WHEN v_count = 0 THEN 'WARNING - No products!' ELSE 'INFO' END);
    ELSE
        INSERT INTO audit_report VALUES('7. DATA', 'products', 'TABLE DOES NOT EXIST', 'ERROR');
    END IF;
    
    -- Check product_categories
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_categories') THEN
        SELECT COUNT(*) INTO v_count FROM product_categories;
        INSERT INTO audit_report VALUES('7. DATA', 'product_categories', v_count || ' rows', 
            CASE WHEN v_count = 0 THEN 'WARNING - No product-category links!' ELSE 'INFO' END);
    ELSE
        INSERT INTO audit_report VALUES('7. DATA', 'product_categories', 'TABLE DOES NOT EXIST', 'ERROR');
    END IF;
    
    -- Check google_integrations
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'google_integrations') THEN
        SELECT COUNT(*) INTO v_count FROM google_integrations;
        INSERT INTO audit_report VALUES('7. DATA', 'google_integrations', v_count || ' rows', 'INFO');
    END IF;
END $$;

-- ============================================================================
-- 8. CHECK FOR COMMON ISSUES
-- ============================================================================

-- Check if product_categories has incorrect user_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'product_categories' 
        AND column_name = 'user_id'
    ) THEN
        INSERT INTO audit_report VALUES(
            '8. ISSUES',
            'product_categories.user_id',
            'This column should not exist - causes RLS policy errors',
            'ERROR'
        );
    END IF;
END $$;

-- Check for orphaned products (products without category assignments)
DO $$
DECLARE
    v_orphaned INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products')
       AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_categories') THEN
        SELECT COUNT(*) INTO v_orphaned
        FROM products p
        LEFT JOIN product_categories pc ON p.id = pc.product_id
        WHERE pc.product_id IS NULL;
        
        IF v_orphaned > 0 THEN
            INSERT INTO audit_report VALUES(
                '8. ISSUES',
                'Orphaned Products',
                v_orphaned || ' products not assigned to any category',
                'WARNING'
            );
        END IF;
    END IF;
END $$;

-- Check for categories without products (leaf nodes)
DO $$
DECLARE
    v_empty_leaves INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'taxonomy_nodes') THEN
        SELECT COUNT(*) INTO v_empty_leaves
        FROM taxonomy_nodes t1
        WHERE NOT EXISTS (
            SELECT 1 FROM taxonomy_nodes t2 WHERE t2.parent_id = t1.id
        )
        AND t1.product_count = 0;
        
        IF v_empty_leaves > 0 THEN
            INSERT INTO audit_report VALUES(
                '8. ISSUES',
                'Empty Leaf Categories',
                v_empty_leaves || ' leaf categories with no products',
                'INFO'
            );
        END IF;
    END IF;
END $$;

-- ============================================================================
-- DISPLAY FINAL REPORT
-- ============================================================================
SELECT 
    section,
    item,
    details,
    CASE status
        WHEN 'ERROR' THEN '❌ ' || status
        WHEN 'WARNING' THEN '⚠️  ' || status
        WHEN 'NEEDS_FIX' THEN '🔧 ' || status
        WHEN 'OK' THEN '✅ ' || status
        WHEN 'EXISTS' THEN '✅ ' || status
        WHEN 'INFO' THEN 'ℹ️  ' || status
        ELSE status
    END as status_icon
FROM audit_report
ORDER BY 
    section,
    CASE status
        WHEN 'ERROR' THEN 1
        WHEN 'WARNING' THEN 2
        WHEN 'NEEDS_FIX' THEN 3
        WHEN 'INFO' THEN 4
        ELSE 5
    END,
    item;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
    '==== SUMMARY ====' as report,
    COUNT(CASE WHEN status = 'ERROR' THEN 1 END) || ' ERRORS' as errors,
    COUNT(CASE WHEN status = 'WARNING' THEN 1 END) || ' WARNINGS' as warnings,
    COUNT(CASE WHEN status = 'NEEDS_FIX' THEN 1 END) || ' NEEDS FIX' as needs_fix,
    COUNT(CASE WHEN status IN ('OK', 'EXISTS') THEN 1 END) || ' OK' as ok
FROM audit_report;

-- Clean up
DROP TABLE audit_report;