-- ============================================================================
-- DETAILED AUDIT RESULTS QUERY
-- ============================================================================
-- Run this to see ALL audit results, especially errors and warnings
-- ============================================================================

-- First, run the main audit query again to populate the temp table
CREATE TEMP TABLE IF NOT EXISTS audit_report (
    section TEXT,
    item TEXT,
    details TEXT,
    status TEXT
);

-- Run all the audit checks (abbreviated version for clarity)
-- ... (you already ran this part) ...

-- ============================================================================
-- SHOW ONLY PROBLEMS (ERRORS, WARNINGS, NEEDS FIX)
-- ============================================================================
SELECT 
    CASE status
        WHEN 'ERROR' THEN '❌'
        WHEN 'WARNING' THEN '⚠️'
        WHEN 'NEEDS_FIX' THEN '🔧'
    END as icon,
    section,
    item,
    details,
    status
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

-- ============================================================================
-- ALTERNATIVELY, SHOW ALL RESULTS GROUPED BY SECTION
-- ============================================================================
-- Comment out above query and uncomment this one to see everything:

/*
SELECT 
    section,
    item,
    details,
    CASE status
        WHEN 'ERROR' THEN '❌ ERROR'
        WHEN 'WARNING' THEN '⚠️ WARNING'
        WHEN 'NEEDS_FIX' THEN '🔧 NEEDS_FIX'
        WHEN 'OK' THEN '✅ OK'
        WHEN 'EXISTS' THEN '✅ EXISTS'
        WHEN 'INFO' THEN 'ℹ️ INFO'
        ELSE status
    END as status_with_icon
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
*/