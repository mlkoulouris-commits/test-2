-- ============================================================================
-- Vendor Master Consolidation - Validation Queries
-- ============================================================================
-- Purpose: Verify data integrity after vendor consolidation
-- Run after: 02, 03, and 04 migration scripts
-- ============================================================================

\echo '========================================='
\echo 'VENDOR CONSOLIDATION VALIDATION'
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 1: All suppliers should be linked to vendors
-- ============================================================================

\echo 'VALIDATION 1: Supplier Linking Completeness'
\echo '--------------------------------------------'

DO $$
DECLARE
  unlinked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unlinked_count
  FROM barsy_suppliers
  WHERE vendor_id IS NULL;
  
  IF unlinked_count > 0 THEN
    RAISE WARNING 'Found % unlinked suppliers - review required', unlinked_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All suppliers are linked to vendors';
  END IF;
END $$;

SELECT 
  COUNT(*) as total_suppliers,
  COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) as linked,
  COUNT(*) FILTER (WHERE vendor_id IS NULL) as unlinked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) / COUNT(*), 2) as linked_percentage
FROM barsy_suppliers;

\echo ''

-- Show unlinked suppliers if any
SELECT 
  id,
  supplier_id,
  supplier_name,
  bulstat,
  barsy_location_id
FROM barsy_suppliers
WHERE vendor_id IS NULL
LIMIT 10;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 2: No orphaned vendor references
-- ============================================================================

\echo 'VALIDATION 2: No Orphaned Vendor References'
\echo '--------------------------------------------'

DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM barsy_suppliers bs
  LEFT JOIN vendors v ON bs.vendor_id = v.id
  WHERE bs.vendor_id IS NOT NULL AND v.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned vendor references - data integrity issue!', orphaned_count;
  ELSE
    RAISE NOTICE 'SUCCESS: No orphaned vendor references';
  END IF;
END $$;

SELECT 
  COUNT(*) as orphaned_references
FROM barsy_suppliers bs
LEFT JOIN vendors v ON bs.vendor_id = v.id
WHERE bs.vendor_id IS NOT NULL AND v.id IS NULL;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 3: Store loads backfill completeness
-- ============================================================================

\echo 'VALIDATION 3: Store Loads Backfill Completeness'
\echo '------------------------------------------------'

SELECT 
  COUNT(*) as total_store_loads,
  COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) as with_vendor,
  COUNT(*) FILTER (WHERE vendor_id IS NULL) as without_vendor,
  ROUND(100.0 * COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) / COUNT(*), 2) as backfill_percentage
FROM barsy_store_loads;

\echo ''

-- Check if store loads without vendor_id have valid reasons
SELECT 
  'Store loads with NULL supplier_id' as reason,
  COUNT(*) as count
FROM barsy_store_loads
WHERE vendor_id IS NULL AND supplier_id IS NULL
UNION ALL
SELECT 
  'Store loads with supplier not in barsy_suppliers',
  COUNT(*)
FROM barsy_store_loads sl
LEFT JOIN barsy_suppliers bs 
  ON sl.supplier_id = bs.supplier_id 
  AND sl.barsy_location_id = bs.barsy_location_id
WHERE sl.vendor_id IS NULL 
  AND sl.supplier_id IS NOT NULL
  AND bs.id IS NULL;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 4: Store load items backfill completeness
-- ============================================================================

\echo 'VALIDATION 4: Store Load Items Backfill Completeness'
\echo '-----------------------------------------------------'

SELECT 
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) as with_vendor,
  COUNT(*) FILTER (WHERE vendor_id IS NULL) as without_vendor,
  ROUND(100.0 * COUNT(*) FILTER (WHERE vendor_id IS NOT NULL) / COUNT(*), 2) as backfill_percentage
FROM barsy_store_load_items;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 5: Vendor master data quality
-- ============================================================================

\echo 'VALIDATION 5: Vendor Master Data Quality'
\echo '-----------------------------------------'

-- Check for vendors without any linked suppliers
SELECT 
  'Vendors without linked suppliers' as issue,
  COUNT(*) as count
FROM vendors v
LEFT JOIN barsy_suppliers bs ON v.id = bs.vendor_id
WHERE bs.id IS NULL
UNION ALL
-- Check for vendors with bulstat duplicates
SELECT 
  'Vendors with duplicate bulstat',
  COUNT(*) - COUNT(DISTINCT bulstat)
FROM vendors
WHERE bulstat IS NOT NULL
UNION ALL
-- Check for vendors without names
SELECT 
  'Vendors without names',
  COUNT(*)
FROM vendors
WHERE name IS NULL OR TRIM(name) = '';

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 6: Consolidation effectiveness
-- ============================================================================

\echo 'VALIDATION 6: Consolidation Effectiveness'
\echo '------------------------------------------'

WITH stats AS (
  SELECT 
    COUNT(DISTINCT bs.id) as total_supplier_records,
    COUNT(DISTINCT bs.vendor_id) as unique_vendors,
    COUNT(DISTINCT bs.supplier_id) as unique_supplier_ids,
    COUNT(DISTINCT bs.supplier_name) as unique_supplier_names
  FROM barsy_suppliers bs
  WHERE bs.vendor_id IS NOT NULL
)
SELECT 
  total_supplier_records,
  unique_vendors,
  unique_supplier_ids,
  unique_supplier_names,
  ROUND(total_supplier_records::numeric / unique_vendors::numeric, 2) as consolidation_ratio,
  ROUND(100.0 * (total_supplier_records - unique_vendors)::numeric / total_supplier_records::numeric, 2) as reduction_percentage
FROM stats;

\echo ''
\echo 'Consolidation ratio: Average number of supplier records per vendor master'
\echo 'Reduction percentage: How much we reduced duplicate records'
\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 7: Bulstat matching accuracy
-- ============================================================================

\echo 'VALIDATION 7: Bulstat Matching Accuracy'
\echo '----------------------------------------'

-- Check if suppliers with same bulstat are linked to same vendor
WITH bulstat_check AS (
  SELECT 
    bs.bulstat,
    COUNT(DISTINCT bs.vendor_id) as vendor_count,
    array_agg(DISTINCT v.name) as vendor_names
  FROM barsy_suppliers bs
  JOIN vendors v ON bs.vendor_id = v.id
  WHERE bs.bulstat IS NOT NULL AND bs.bulstat != ''
  GROUP BY bs.bulstat
  HAVING COUNT(DISTINCT bs.vendor_id) > 1
)
SELECT 
  COUNT(*) as bulstat_with_multiple_vendors
FROM bulstat_check;

\echo ''

-- Show details if any issues found
SELECT 
  bulstat,
  vendor_count,
  vendor_names
FROM (
  SELECT 
    bs.bulstat,
    COUNT(DISTINCT bs.vendor_id) as vendor_count,
    array_agg(DISTINCT v.name) as vendor_names
  FROM barsy_suppliers bs
  JOIN vendors v ON bs.vendor_id = v.id
  WHERE bs.bulstat IS NOT NULL AND bs.bulstat != ''
  GROUP BY bs.bulstat
  HAVING COUNT(DISTINCT bs.vendor_id) > 1
) issues
LIMIT 10;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 8: Historical data integrity
-- ============================================================================

\echo 'VALIDATION 8: Historical Data Integrity'
\echo '----------------------------------------'

-- Verify store loads can be traced to vendors
WITH store_load_stats AS (
  SELECT 
    COUNT(*) as total_loads,
    COUNT(DISTINCT vendor_id) as unique_vendors,
    SUM(total_sum) as total_amount,
    MIN(doc_date) as earliest_date,
    MAX(doc_date) as latest_date
  FROM barsy_store_loads
  WHERE vendor_id IS NOT NULL
)
SELECT * FROM store_load_stats;

\echo ''

-- Check for data consistency between store_loads and suppliers
SELECT 
  'Store loads with vendor not in vendors table' as issue,
  COUNT(*) as count
FROM barsy_store_loads sl
LEFT JOIN vendors v ON sl.vendor_id = v.id
WHERE sl.vendor_id IS NOT NULL AND v.id IS NULL
UNION ALL
SELECT 
  'Store load items with vendor not in vendors table',
  COUNT(*)
FROM barsy_store_load_items sli
LEFT JOIN vendors v ON sli.vendor_id = v.id
WHERE sli.vendor_id IS NOT NULL AND v.id IS NULL;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 9: Top vendors by activity
-- ============================================================================

\echo 'VALIDATION 9: Top Vendors by Activity'
\echo '--------------------------------------'

SELECT 
  v.id,
  v.name,
  v.bulstat,
  COUNT(DISTINCT bs.id) as supplier_records,
  COUNT(DISTINCT sl.id) as purchase_orders,
  COALESCE(SUM(sl.total_sum), 0) as total_purchase_amount,
  array_agg(DISTINCT bs.supplier_name ORDER BY bs.supplier_name) as supplier_name_variations
FROM vendors v
LEFT JOIN barsy_suppliers bs ON v.id = bs.vendor_id
LEFT JOIN barsy_store_loads sl ON v.id = sl.vendor_id
GROUP BY v.id, v.name, v.bulstat
ORDER BY COUNT(DISTINCT bs.id) DESC
LIMIT 15;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- VALIDATION 10: Alternative names validation
-- ============================================================================

\echo 'VALIDATION 10: Alternative Names Validation'
\echo '--------------------------------------------'

SELECT 
  'Vendors with alternative names' as metric,
  COUNT(*) as count
FROM vendors
WHERE alternative_names IS NOT NULL
UNION ALL
SELECT 
  'Vendors without alternative names',
  COUNT(*)
FROM vendors
WHERE alternative_names IS NULL;

\echo ''

-- Sample of alternative names
SELECT 
  id,
  name,
  bulstat,
  alternative_names->>'names' as name_variations,
  merge_notes
FROM vendors
WHERE alternative_names IS NOT NULL
ORDER BY jsonb_array_length(alternative_names->'names') DESC
LIMIT 10;

\echo ''
\echo '========================================='
\echo 'VALIDATION COMPLETE'
\echo '========================================='
\echo ''
\echo 'Review the validation results above.'
\echo 'If any issues found, investigate and fix before proceeding.'
\echo 'If all validations pass, the migration is successful!'
\echo ''

