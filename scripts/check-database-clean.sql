-- Comprehensive Database Structure Check
-- Run this in Supabase SQL Editor to verify everything is correct

-- ========================================
-- 1. CHECK NEW TABLES FROM MIGRATION 009
-- ========================================
SELECT '=== CHECKING NEW TABLES ===' as section;

WITH expected_tables AS (
    SELECT unnest(ARRAY['node_metrics', 'opportunities']) as table_name
)
SELECT 
    e.table_name,
    CASE 
        WHEN t.table_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status,
    t.table_type
FROM expected_tables e
LEFT JOIN information_schema.tables t 
    ON t.table_name = e.table_name 
    AND t.table_schema = 'public';

-- ========================================
-- 2. CHECK TAXONOMY_NODES NEW COLUMNS
-- ========================================
SELECT '=== CHECKING TAXONOMY_NODES COLUMNS ===' as section;

WITH expected_columns AS (
    SELECT column_name, expected_type FROM (VALUES
        ('opportunity_score', 'numeric'),
        ('revenue_potential', 'numeric'),
        ('optimization_status', 'character varying'),
        ('last_scored_at', 'timestamp with time zone'),
        ('metrics_updated_at', 'timestamp with time zone')
    ) AS t(column_name, expected_type)
)
SELECT 
    e.column_name,
    e.expected_type,
    c.data_type as actual_type,
    CASE 
        WHEN c.column_name IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM expected_columns e
LEFT JOIN information_schema.columns c
    ON c.table_name = 'taxonomy_nodes' 
    AND c.column_name = e.column_name
    AND c.table_schema = 'public';

-- ========================================
-- 3. CHECK NODE_METRICS TABLE STRUCTURE
-- ========================================
SELECT '=== NODE_METRICS TABLE STRUCTURE ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'node_metrics'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- 4. CHECK OPPORTUNITIES TABLE STRUCTURE
-- ========================================
SELECT '=== OPPORTUNITIES TABLE STRUCTURE ===' as section;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'opportunities'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- ========================================
-- 5. CHECK CONSTRAINTS
-- ========================================
SELECT '=== CHECKING CONSTRAINTS ===' as section;

SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
    AND tc.table_name IN ('node_metrics', 'opportunities', 'taxonomy_nodes')
    AND tc.constraint_type IN ('CHECK', 'UNIQUE', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type;

-- ========================================
-- 6. CHECK INDEXES
-- ========================================
SELECT '=== CHECKING INDEXES ===' as section;

WITH expected_indexes AS (
    SELECT unnest(ARRAY[
        'idx_taxonomy_nodes_score',
        'idx_taxonomy_nodes_status',
        'idx_taxonomy_nodes_revenue',
        'idx_node_metrics_node_date',
        'idx_node_metrics_date',
        'idx_node_metrics_source',
        'idx_opportunities_score',
        'idx_opportunities_priority',
        'idx_opportunities_revenue',
        'idx_opportunities_valid'
    ]) as index_name
)
SELECT 
    e.index_name,
    CASE 
        WHEN i.indexname IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as status
FROM expected_indexes e
LEFT JOIN pg_indexes i
    ON i.indexname = e.index_name
    AND i.schemaname = 'public';

-- ========================================
-- 7. CHECK RLS STATUS
-- ========================================
SELECT '=== CHECKING RLS STATUS ===' as section;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN 'ENABLED'
        ELSE 'DISABLED'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('node_metrics', 'opportunities');

-- ========================================
-- 8. CHECK RLS POLICIES
-- ========================================
SELECT '=== CHECKING RLS POLICIES ===' as section;

SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('node_metrics', 'opportunities')
ORDER BY tablename, policyname;

-- ========================================
-- 9. CHECK TRIGGERS
-- ========================================
SELECT '=== CHECKING TRIGGERS ===' as section;

SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation as event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND event_object_table IN ('node_metrics', 'opportunities')
ORDER BY event_object_table, trigger_name;

-- ========================================
-- 10. FINAL SUMMARY
-- ========================================
SELECT '=== MIGRATION STATUS SUMMARY ===' as section;

WITH checks AS (
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema = 'public' 
         AND table_name IN ('node_metrics', 'opportunities')) as tables_count,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'taxonomy_nodes'
         AND column_name IN ('opportunity_score', 'revenue_potential', 'optimization_status', 'last_scored_at', 'metrics_updated_at')) as new_columns_count,
        (SELECT COUNT(*) FROM pg_indexes 
         WHERE schemaname = 'public' 
         AND indexname LIKE 'idx_%' 
         AND tablename IN ('taxonomy_nodes', 'node_metrics', 'opportunities')) as indexes_count
)
SELECT 
    'Tables: ' || tables_count || '/2 - ' || 
        CASE WHEN tables_count = 2 THEN 'OK' ELSE 'ERROR' END as tables_status,
    'New Columns: ' || new_columns_count || '/5 - ' || 
        CASE WHEN new_columns_count = 5 THEN 'OK' ELSE 'ERROR' END as columns_status,
    'Indexes: ' || indexes_count || '/10+ - ' || 
        CASE WHEN indexes_count >= 10 THEN 'OK' ELSE 'WARNING' END as indexes_status,
    CASE 
        WHEN tables_count = 2 AND new_columns_count = 5 THEN 'MIGRATION SUCCESSFUL'
        WHEN tables_count > 0 OR new_columns_count > 0 THEN 'PARTIALLY APPLIED'
        ELSE 'MIGRATION FAILED'
    END as overall_status
FROM checks;