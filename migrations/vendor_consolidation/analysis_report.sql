-- ============================================================================
-- Vendor Master Consolidation - Analysis Report Generator
-- ============================================================================
-- Purpose: Generate a detailed preview report for review before migration
-- Output: Human-readable report showing what will be consolidated
-- ============================================================================

\pset border 2
\pset format wrapped

\echo '╔════════════════════════════════════════════════════════════════════════╗'
\echo '║         VENDOR MASTER CONSOLIDATION - PREVIEW REPORT                  ║'
\echo '╚════════════════════════════════════════════════════════════════════════╝'
\echo ''

-- ============================================================================
-- EXECUTIVE SUMMARY
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'EXECUTIVE SUMMARY'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

WITH summary AS (
  SELECT 
    COUNT(*) as total_suppliers,
    COUNT(DISTINCT supplier_id) as unique_supplier_ids,
    COUNT(DISTINCT supplier_name) as unique_names,
    COUNT(DISTINCT bulstat) FILTER (WHERE bulstat IS NOT NULL AND bulstat != '') as unique_bulstats,
    COUNT(*) FILTER (WHERE bulstat IS NOT NULL AND bulstat != '') as suppliers_with_bulstat,
    COUNT(*) FILTER (WHERE bulstat IS NULL OR bulstat = '') as suppliers_without_bulstat,
    COUNT(DISTINCT barsy_location_id) as locations
  FROM barsy_suppliers
),
consolidation_estimate AS (
  SELECT 
    COUNT(DISTINCT bulstat) as bulstat_groups
  FROM barsy_suppliers
  WHERE bulstat IS NOT NULL AND bulstat != ''
  UNION ALL
  SELECT 
    COUNT(DISTINCT UPPER(TRIM(supplier_name)))
  FROM barsy_suppliers
  WHERE bulstat IS NULL OR bulstat = ''
)
SELECT 
  '📊 Current State' as section,
  '' as detail
UNION ALL
SELECT 
  '  • Total Supplier Records',
  total_suppliers::text
FROM summary
UNION ALL
SELECT 
  '  • Unique Supplier IDs',
  unique_supplier_ids::text
FROM summary
UNION ALL
SELECT 
  '  • Unique Supplier Names',
  unique_names::text
FROM summary
UNION ALL
SELECT 
  '  • Suppliers with Tax ID (bulstat)',
  suppliers_with_bulstat::text || ' (' || ROUND(100.0 * suppliers_with_bulstat / total_suppliers, 1)::text || '%)'
FROM summary
UNION ALL
SELECT 
  '  • Suppliers without Tax ID',
  suppliers_without_bulstat::text || ' (' || ROUND(100.0 * suppliers_without_bulstat / total_suppliers, 1)::text || '%)'
FROM summary
UNION ALL
SELECT 
  '  • Barsy Locations',
  locations::text
FROM summary
UNION ALL
SELECT '', ''
UNION ALL
SELECT 
  '🎯 After Consolidation',
  ''
UNION ALL
SELECT 
  '  • Estimated Vendor Masters',
  (SELECT SUM(bulstat_groups)::text FROM consolidation_estimate)
UNION ALL
SELECT 
  '  • Consolidation Ratio',
  ROUND(s.total_suppliers::numeric / (SELECT SUM(bulstat_groups) FROM consolidation_estimate)::numeric, 2)::text || ':1'
FROM summary s
UNION ALL
SELECT 
  '  • Duplicate Reduction',
  ROUND(100.0 * (s.total_suppliers - (SELECT SUM(bulstat_groups) FROM consolidation_estimate))::numeric / s.total_suppliers::numeric, 1)::text || '%'
FROM summary s;

\echo ''
\echo ''

-- ============================================================================
-- TOP CONSOLIDATION OPPORTUNITIES
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TOP CONSOLIDATION OPPORTUNITIES (By Tax ID)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'These suppliers will be merged into single vendor masters:'
\echo ''

SELECT 
  ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as "#",
  bulstat as "Tax ID",
  (array_agg(DISTINCT supplier_name ORDER BY LENGTH(supplier_name) DESC))[1] as "Master Name",
  COUNT(*) as "Records",
  COUNT(DISTINCT supplier_id) as "IDs",
  COUNT(DISTINCT supplier_name) as "Names",
  array_to_string(
    (SELECT array_agg(DISTINCT name ORDER BY name) 
     FROM (SELECT DISTINCT supplier_name as name FROM barsy_suppliers WHERE bulstat = bs.bulstat) sub),
    ', '
  ) as "Name Variations"
FROM barsy_suppliers bs
WHERE bulstat IS NOT NULL AND bulstat != ''
GROUP BY bulstat
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 15;

\echo ''
\echo ''

-- ============================================================================
-- NAME-BASED CONSOLIDATION (No Tax ID)
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'NAME-BASED CONSOLIDATION (Suppliers without Tax ID)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'These will be consolidated by normalized name matching:'
\echo ''

SELECT 
  ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as "#",
  (array_agg(DISTINCT supplier_name ORDER BY LENGTH(supplier_name) DESC))[1] as "Master Name",
  COUNT(*) as "Records",
  COUNT(DISTINCT supplier_id) as "IDs",
  array_to_string(
    (SELECT array_agg(DISTINCT name ORDER BY name) 
     FROM (SELECT DISTINCT supplier_name as name FROM barsy_suppliers 
           WHERE (bulstat IS NULL OR bulstat = '') 
           AND UPPER(TRIM(supplier_name)) = UPPER(TRIM(bs.supplier_name))) sub),
    ', '
  ) as "Name Variations"
FROM barsy_suppliers bs
WHERE (bulstat IS NULL OR bulstat = '')
GROUP BY UPPER(TRIM(supplier_name))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 15;

\echo ''
\echo ''

-- ============================================================================
-- CROSS-LOCATION DUPLICATES
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'CROSS-LOCATION DUPLICATES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Same supplier appearing at multiple locations:'
\echo ''

SELECT 
  supplier_id as "Supplier ID",
  supplier_name as "Name",
  bulstat as "Tax ID",
  COUNT(DISTINCT barsy_location_id) as "Locations",
  COUNT(*) as "Records"
FROM barsy_suppliers
GROUP BY supplier_id, supplier_name, bulstat
HAVING COUNT(DISTINCT barsy_location_id) > 1
ORDER BY COUNT(DISTINCT barsy_location_id) DESC, supplier_name
LIMIT 20;

\echo ''
\echo ''

-- ============================================================================
-- PURCHASE ORDER IMPACT
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'PURCHASE ORDER IMPACT ANALYSIS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  'Total Purchase Orders' as "Metric",
  COUNT(*)::text as "Count"
FROM barsy_store_loads
UNION ALL
SELECT 
  'With Supplier ID',
  COUNT(*)::text
FROM barsy_store_loads
WHERE supplier_id IS NOT NULL
UNION ALL
SELECT 
  'Unique Suppliers',
  COUNT(DISTINCT supplier_id)::text
FROM barsy_store_loads
WHERE supplier_id IS NOT NULL
UNION ALL
SELECT 
  'Total Purchase Amount',
  TO_CHAR(SUM(total_sum), 'FM999,999,999.00')
FROM barsy_store_loads
UNION ALL
SELECT 
  'Date Range',
  MIN(doc_date)::text || ' to ' || MAX(doc_date)::text
FROM barsy_store_loads;

\echo ''
\echo ''

-- ============================================================================
-- TOP SUPPLIERS BY PURCHASE VOLUME
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TOP 10 SUPPLIERS BY PURCHASE VOLUME'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  ROW_NUMBER() OVER (ORDER BY SUM(sl.total_sum) DESC) as "#",
  bs.supplier_name as "Supplier Name",
  bs.bulstat as "Tax ID",
  COUNT(DISTINCT sl.id) as "Orders",
  TO_CHAR(SUM(sl.total_sum), 'FM999,999.00') as "Total Amount",
  MIN(sl.doc_date) as "First",
  MAX(sl.doc_date) as "Last"
FROM barsy_store_loads sl
LEFT JOIN barsy_suppliers bs 
  ON sl.supplier_id = bs.supplier_id 
  AND sl.barsy_location_id = bs.barsy_location_id
WHERE sl.supplier_id IS NOT NULL
GROUP BY bs.supplier_name, bs.bulstat
ORDER BY SUM(sl.total_sum) DESC
LIMIT 10;

\echo ''
\echo ''

-- ============================================================================
-- POTENTIAL ISSUES
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '⚠️  POTENTIAL ISSUES TO REVIEW'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Same bulstat, different names (should be same company)
WITH bulstat_name_conflicts AS (
  SELECT 
    bulstat,
    COUNT(DISTINCT supplier_name) as name_count,
    array_agg(DISTINCT supplier_name ORDER BY supplier_name) as names
  FROM barsy_suppliers
  WHERE bulstat IS NOT NULL AND bulstat != ''
  GROUP BY bulstat
  HAVING COUNT(DISTINCT supplier_name) > 1
)
SELECT 
  'Same Tax ID, Different Names' as "Issue Type",
  COUNT(*)::text as "Count"
FROM bulstat_name_conflicts
UNION ALL
-- Orphaned suppliers in store_loads
SELECT 
  'Suppliers in POs but not in master',
  COUNT(DISTINCT sl.supplier_id)::text
FROM barsy_store_loads sl
LEFT JOIN barsy_suppliers bs 
  ON sl.supplier_id = bs.supplier_id 
  AND sl.barsy_location_id = bs.barsy_location_id
WHERE bs.id IS NULL AND sl.supplier_id IS NOT NULL
UNION ALL
-- Suppliers without contact info
SELECT 
  'Suppliers without contact info',
  COUNT(*)::text
FROM barsy_suppliers
WHERE (phone IS NULL OR phone = '') 
  AND (email IS NULL OR email = '')
  AND (contact_person IS NULL OR contact_person = '');

\echo ''

-- Show bulstat conflicts in detail
\echo 'Tax ID Conflicts (same ID, different names):'
\echo '---------------------------------------------'

SELECT 
  bulstat as "Tax ID",
  COUNT(DISTINCT supplier_name) as "Name Count",
  array_to_string(array_agg(DISTINCT supplier_name ORDER BY supplier_name), ', ') as "All Names"
FROM barsy_suppliers
WHERE bulstat IS NOT NULL AND bulstat != ''
GROUP BY bulstat
HAVING COUNT(DISTINCT supplier_name) > 2
ORDER BY COUNT(DISTINCT supplier_name) DESC
LIMIT 10;

\echo ''
\echo ''

-- ============================================================================
-- RECOMMENDATIONS
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ RECOMMENDATIONS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo '1. Review the consolidation opportunities above'
\echo '2. Check that name variations make sense for each group'
\echo '3. Verify tax ID conflicts are legitimate (same company, different names)'
\echo '4. If satisfied, proceed with migration scripts in order:'
\echo '   - 02_create_vendor_masters.sql'
\echo '   - 03_link_suppliers.sql'
\echo '   - 04_backfill_store_loads.sql'
\echo '   - 05_validation.sql'
\echo '5. Keep 06_rollback.sql ready for 24-48h'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Report generated: ' `date`
\echo ''

