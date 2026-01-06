-- ============================================================================
-- Vendor Master Consolidation - Analysis Script
-- ============================================================================
-- Purpose: Analyze duplicate suppliers and generate consolidation report
-- Run this first to review what will be merged
-- ============================================================================

\echo '========================================='
\echo 'VENDOR MASTER CONSOLIDATION ANALYSIS'
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 1: Current State Overview
-- ============================================================================

\echo '1. CURRENT STATE OVERVIEW'
\echo '-------------------------'

SELECT 
  'Total Suppliers' as metric,
  COUNT(*) as count
FROM barsy_suppliers
UNION ALL
SELECT 
  'Unique Supplier IDs',
  COUNT(DISTINCT supplier_id)
FROM barsy_suppliers
UNION ALL
SELECT 
  'Unique Supplier Names',
  COUNT(DISTINCT supplier_name)
FROM barsy_suppliers
UNION ALL
SELECT 
  'Suppliers with Bulstat',
  COUNT(*)
FROM barsy_suppliers
WHERE bulstat IS NOT NULL AND bulstat != ''
UNION ALL
SELECT 
  'Suppliers without Bulstat',
  COUNT(*)
FROM barsy_suppliers
WHERE bulstat IS NULL OR bulstat = ''
UNION ALL
SELECT 
  'Currently Linked to Vendors',
  COUNT(*)
FROM barsy_suppliers
WHERE vendor_id IS NOT NULL
UNION ALL
SELECT 
  'Unlinked Suppliers',
  COUNT(*)
FROM barsy_suppliers
WHERE vendor_id IS NULL;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 2: Duplicates by Bulstat (Exact Match)
-- ============================================================================

\echo '2. DUPLICATES BY BULSTAT (Tax ID - Exact Match)'
\echo '------------------------------------------------'
\echo 'These are the same legal entity with different names/IDs'
\echo ''

SELECT 
  bulstat,
  COUNT(*) as supplier_count,
  COUNT(DISTINCT supplier_id) as unique_supplier_ids,
  COUNT(DISTINCT supplier_name) as name_variations,
  COUNT(DISTINCT barsy_location_id) as locations,
  array_agg(DISTINCT supplier_name ORDER BY supplier_name) as all_names,
  array_agg(DISTINCT supplier_id ORDER BY supplier_id) as all_supplier_ids
FROM barsy_suppliers
WHERE bulstat IS NOT NULL AND bulstat != ''
GROUP BY bulstat
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, bulstat;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 3: Duplicates by Normalized Name (Fuzzy Match)
-- ============================================================================

\echo '3. DUPLICATES BY NORMALIZED NAME (Fuzzy Match)'
\echo '-----------------------------------------------'
\echo 'Suppliers without bulstat, matched by normalized name'
\echo ''

WITH normalized_suppliers AS (
  SELECT 
    id,
    supplier_id,
    supplier_name,
    UPPER(TRIM(supplier_name)) as normalized_name,
    bulstat,
    barsy_location_id
  FROM barsy_suppliers
  WHERE bulstat IS NULL OR bulstat = ''
)
SELECT 
  normalized_name,
  COUNT(*) as supplier_count,
  COUNT(DISTINCT supplier_id) as unique_supplier_ids,
  COUNT(DISTINCT barsy_location_id) as locations,
  array_agg(DISTINCT supplier_name ORDER BY supplier_name) as name_variations,
  array_agg(DISTINCT supplier_id ORDER BY supplier_id) as all_supplier_ids
FROM normalized_suppliers
GROUP BY normalized_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, normalized_name;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 4: Same Supplier ID Across Locations
-- ============================================================================

\echo '4. SAME SUPPLIER ID ACROSS MULTIPLE LOCATIONS'
\echo '----------------------------------------------'
\echo 'Same supplier_id used at different Barsy locations'
\echo ''

SELECT 
  supplier_id,
  supplier_name,
  COUNT(DISTINCT barsy_location_id) as location_count,
  array_agg(DISTINCT barsy_location_id::text ORDER BY barsy_location_id) as location_ids,
  COUNT(*) as total_records,
  MAX(bulstat) as bulstat
FROM barsy_suppliers
GROUP BY supplier_id, supplier_name
HAVING COUNT(DISTINCT barsy_location_id) > 1
ORDER BY COUNT(DISTINCT barsy_location_id) DESC, supplier_id;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 5: Proposed Vendor Masters (Bulstat Groups)
-- ============================================================================

\echo '5. PROPOSED VENDOR MASTERS - BULSTAT GROUPS'
\echo '--------------------------------------------'
\echo 'Vendor masters that will be created from bulstat matching'
\echo ''

WITH bulstat_groups AS (
  SELECT 
    bulstat,
    COUNT(*) as supplier_count,
    array_agg(DISTINCT supplier_name ORDER BY LENGTH(supplier_name) DESC, supplier_name) as name_variations,
    -- Select the best name (longest, most complete)
    (array_agg(DISTINCT supplier_name ORDER BY LENGTH(supplier_name) DESC, supplier_name))[1] as master_name,
    array_agg(DISTINCT supplier_id ORDER BY supplier_id) as supplier_ids,
    MAX(contact_person) as contact_person,
    MAX(phone) as phone,
    MAX(email) as email,
    MAX(payment_terms_days) as payment_terms_days
  FROM barsy_suppliers
  WHERE bulstat IS NOT NULL AND bulstat != ''
  GROUP BY bulstat
)
SELECT 
  bulstat,
  master_name,
  supplier_count,
  name_variations,
  supplier_ids,
  contact_person,
  phone,
  email,
  payment_terms_days
FROM bulstat_groups
ORDER BY supplier_count DESC, master_name;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 6: Proposed Vendor Masters (Name Groups)
-- ============================================================================

\echo '6. PROPOSED VENDOR MASTERS - NAME GROUPS'
\echo '-----------------------------------------'
\echo 'Vendor masters for suppliers without bulstat (normalized name match)'
\echo ''

WITH name_groups AS (
  SELECT 
    UPPER(TRIM(supplier_name)) as normalized_name,
    COUNT(*) as supplier_count,
    array_agg(DISTINCT supplier_name ORDER BY LENGTH(supplier_name) DESC, supplier_name) as name_variations,
    (array_agg(DISTINCT supplier_name ORDER BY LENGTH(supplier_name) DESC, supplier_name))[1] as master_name,
    array_agg(DISTINCT supplier_id ORDER BY supplier_id) as supplier_ids,
    MAX(contact_person) as contact_person,
    MAX(phone) as phone,
    MAX(email) as email,
    MAX(payment_terms_days) as payment_terms_days
  FROM barsy_suppliers
  WHERE bulstat IS NULL OR bulstat = ''
  GROUP BY UPPER(TRIM(supplier_name))
)
SELECT 
  normalized_name,
  master_name,
  supplier_count,
  name_variations,
  supplier_ids,
  contact_person,
  phone,
  email,
  payment_terms_days
FROM name_groups
ORDER BY supplier_count DESC, master_name;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 7: Impact Analysis - Store Loads
-- ============================================================================

\echo '7. IMPACT ANALYSIS - STORE LOADS (Purchase Orders)'
\echo '---------------------------------------------------'
\echo 'Historical purchase data that will be linked to vendor masters'
\echo ''

SELECT 
  'Total Store Loads' as metric,
  COUNT(*) as count
FROM barsy_store_loads
UNION ALL
SELECT 
  'Store Loads with Supplier ID',
  COUNT(*)
FROM barsy_store_loads
WHERE supplier_id IS NOT NULL
UNION ALL
SELECT 
  'Unique Suppliers in Store Loads',
  COUNT(DISTINCT supplier_id)
FROM barsy_store_loads
WHERE supplier_id IS NOT NULL
UNION ALL
SELECT 
  'Store Load Items',
  COUNT(*)
FROM barsy_store_load_items;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 8: Suppliers in Store Loads Not in barsy_suppliers
-- ============================================================================

\echo '8. ORPHANED SUPPLIERS IN STORE LOADS'
\echo '-------------------------------------'
\echo 'Supplier IDs in store_loads that do not exist in barsy_suppliers'
\echo ''

SELECT 
  sl.supplier_id,
  sl.supplier_name,
  COUNT(*) as store_load_count,
  MIN(sl.doc_date) as earliest_date,
  MAX(sl.doc_date) as latest_date,
  SUM(sl.total_sum) as total_amount
FROM barsy_store_loads sl
LEFT JOIN barsy_suppliers bs ON sl.supplier_id = bs.supplier_id 
  AND sl.barsy_location_id = bs.barsy_location_id
WHERE bs.id IS NULL
  AND sl.supplier_id IS NOT NULL
GROUP BY sl.supplier_id, sl.supplier_name
ORDER BY COUNT(*) DESC;

\echo ''
\echo '========================================='
\echo ''

-- ============================================================================
-- SECTION 9: Summary Statistics
-- ============================================================================

\echo '9. CONSOLIDATION SUMMARY'
\echo '------------------------'

WITH stats AS (
  SELECT 
    COUNT(DISTINCT bulstat) FILTER (WHERE bulstat IS NOT NULL AND bulstat != '') as bulstat_groups,
    COUNT(DISTINCT UPPER(TRIM(supplier_name))) FILTER (WHERE bulstat IS NULL OR bulstat = '') as name_groups,
    COUNT(*) as total_suppliers,
    COUNT(DISTINCT supplier_id) as unique_supplier_ids
  FROM barsy_suppliers
)
SELECT 
  'Vendor Masters to Create (Bulstat)' as metric,
  bulstat_groups as count
FROM stats
UNION ALL
SELECT 
  'Vendor Masters to Create (Name)',
  name_groups
FROM stats
UNION ALL
SELECT 
  'Total Vendor Masters',
  bulstat_groups + name_groups
FROM stats
UNION ALL
SELECT 
  'Total Suppliers to Link',
  total_suppliers
FROM stats
UNION ALL
SELECT 
  'Consolidation Ratio',
  ROUND((total_suppliers::numeric / (bulstat_groups + name_groups)::numeric), 2)
FROM stats;

\echo ''
\echo '========================================='
\echo 'ANALYSIS COMPLETE'
\echo '========================================='
\echo ''
\echo 'Next Steps:'
\echo '1. Review the proposed vendor masters above'
\echo '2. Check for any unexpected groupings'
\echo '3. If satisfied, proceed with 02_create_vendor_masters.sql'
\echo ''

