-- Verification script for migration 009_node_centric_model
-- Run this in Supabase SQL Editor to verify the migration was successful

-- 1. Check if new tables exist
SELECT 'Checking tables...' as status;
SELECT 
    table_name,
    CASE 
        WHEN table_name IS NOT NULL THEN '✅ Table exists'
        ELSE '❌ Table missing'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('node_metrics', 'opportunities');

-- 2. Check new columns in taxonomy_nodes
SELECT 'Checking taxonomy_nodes columns...' as status;
SELECT 
    column_name,
    data_type,
    CASE 
        WHEN column_name IS NOT NULL THEN '✅ Column exists'
        ELSE '❌ Column missing'
    END as status
FROM information_schema.columns 
WHERE table_name = 'taxonomy_nodes' 
  AND column_name IN (
    'opportunity_score', 
    'revenue_potential', 
    'optimization_status',
    'last_scored_at',
    'metrics_updated_at'
);

-- 3. Check indexes
SELECT 'Checking indexes...' as status;
SELECT 
    indexname,
    CASE 
        WHEN indexname IS NOT NULL THEN '✅ Index exists'
        ELSE '❌ Index missing'
    END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname IN (
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
);

-- 4. Check RLS policies
SELECT 'Checking RLS policies...' as status;
SELECT 
    tablename,
    policyname,
    CASE 
        WHEN policyname IS NOT NULL THEN '✅ Policy exists'
        ELSE '❌ Policy missing'
    END as status
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('node_metrics', 'opportunities');

-- 5. Summary
SELECT 'Migration Summary:' as status;
SELECT 
    'Migration 009_node_centric_model' as migration,
    CURRENT_TIMESTAMP as checked_at,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'node_metrics')
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'opportunities')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'taxonomy_nodes' AND column_name = 'opportunity_score')
        THEN '✅ Migration appears successful!'
        ELSE '⚠️ Migration may be incomplete'
    END as overall_status;