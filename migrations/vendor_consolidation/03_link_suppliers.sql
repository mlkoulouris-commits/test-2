-- ============================================================================
-- Vendor Master Consolidation - Link Suppliers to Vendor Masters
-- ============================================================================
-- Purpose: Update barsy_suppliers.vendor_id to link to vendor masters
-- Preserves: Original supplier_name and supplier_id
-- ============================================================================

\echo '========================================='
\echo 'LINKING SUPPLIERS TO VENDOR MASTERS'
\echo '========================================='
\echo ''

-- ============================================================================
-- STEP 1: Link suppliers by bulstat (exact match)
-- ============================================================================

\echo 'Step 1: Linking suppliers by bulstat (exact match)...'

WITH updated AS (
  UPDATE barsy_suppliers bs
  SET 
    vendor_id = v.id,
    updated_at = now()
  FROM vendors v
  WHERE bs.bulstat IS NOT NULL 
    AND bs.bulstat != ''
    AND bs.bulstat = v.bulstat
    AND bs.vendor_id IS NULL
  RETURNING bs.id
)
SELECT 
  COUNT(*) as suppliers_linked,
  'by bulstat match' as method
FROM updated;

\echo 'Step 1: Complete'
\echo ''

-- ============================================================================
-- STEP 2: Link suppliers by normalized name (for those without bulstat)
-- ============================================================================

\echo 'Step 2: Linking suppliers by normalized name...'

WITH name_matches AS (
  -- Find vendor masters that were created from name groups
  SELECT 
    v.id as vendor_id,
    v.name,
    v.alternative_names->>'normalized_name' as normalized_name
  FROM vendors v
  WHERE v.bulstat IS NULL
    AND v.alternative_names->>'normalized_name' IS NOT NULL
),
updated AS (
  UPDATE barsy_suppliers bs
  SET 
    vendor_id = nm.vendor_id,
    updated_at = now()
  FROM name_matches nm
  WHERE bs.vendor_id IS NULL
    AND (bs.bulstat IS NULL OR bs.bulstat = '')
    AND UPPER(TRIM(bs.supplier_name)) = nm.normalized_name
  RETURNING bs.id
)
SELECT 
  COUNT(*) as suppliers_linked,
  'by normalized name match' as method
FROM updated;

\echo 'Step 2: Complete'
\echo ''

-- ============================================================================
-- STEP 3: Handle edge cases - suppliers with same supplier_id
-- ============================================================================

\echo 'Step 3: Linking remaining suppliers by supplier_id pattern...'

-- For suppliers that share the same supplier_id across locations,
-- link them to the same vendor master
WITH supplier_id_groups AS (
  -- Find supplier_ids that are already linked to a vendor
  SELECT DISTINCT
    bs.supplier_id,
    bs.vendor_id
  FROM barsy_suppliers bs
  WHERE bs.vendor_id IS NOT NULL
    AND bs.supplier_id IS NOT NULL
),
updated AS (
  UPDATE barsy_suppliers bs
  SET 
    vendor_id = sig.vendor_id,
    updated_at = now()
  FROM supplier_id_groups sig
  WHERE bs.supplier_id = sig.supplier_id
    AND bs.vendor_id IS NULL
  RETURNING bs.id
)
SELECT 
  COUNT(*) as suppliers_linked,
  'by supplier_id pattern' as method
FROM updated;

\echo 'Step 3: Complete'
\echo ''

-- ============================================================================
-- STEP 4: Create vendor masters for remaining unlinked suppliers
-- ============================================================================

\echo 'Step 4: Creating vendor masters for remaining unlinked suppliers...'

-- These are suppliers that didn't match any existing group
-- Create individual vendor masters for them
WITH unlinked_suppliers AS (
  SELECT DISTINCT ON (bs.supplier_id, bs.supplier_name)
    bs.supplier_id,
    bs.supplier_name,
    bs.bulstat,
    bs.contact_person,
    bs.phone,
    bs.email,
    bs.address,
    bs.city,
    bs.vat_number,
    bs.payment_terms_days
  FROM barsy_suppliers bs
  WHERE bs.vendor_id IS NULL
  ORDER BY bs.supplier_id, bs.supplier_name, bs.id
),
inserted_vendors AS (
  INSERT INTO vendors (
    name,
    bulstat,
    contact_name,
    contact_phone,
    contact_email,
    payment_terms,
    notes,
    alternative_names,
    merge_notes,
    is_active,
    created_at,
    updated_at
  )
  SELECT 
    supplier_name,
    NULLIF(bulstat, ''),
    contact_person,
    phone,
    email,
    CASE 
      WHEN payment_terms_days IS NOT NULL 
      THEN payment_terms_days || ' days'
      ELSE NULL 
    END,
    'Address: ' || COALESCE(address, 'N/A') || ', City: ' || COALESCE(city, 'N/A'),
    jsonb_build_object(
      'supplier_ids', ARRAY[supplier_id],
      'names', ARRAY[supplier_name]
    ),
    'Auto-created for unlinked supplier. Single supplier record.',
    true,
    now(),
    now()
  FROM unlinked_suppliers
  RETURNING id, name, bulstat
)
SELECT 
  COUNT(*) as vendors_created,
  'for unlinked suppliers' as reason
FROM inserted_vendors;

\echo 'Step 4: Complete'
\echo ''

-- ============================================================================
-- STEP 5: Link the newly created vendor masters
-- ============================================================================

\echo 'Step 5: Linking newly created vendor masters...'

-- Link by bulstat first
WITH updated_bulstat AS (
  UPDATE barsy_suppliers bs
  SET 
    vendor_id = v.id,
    updated_at = now()
  FROM vendors v
  WHERE bs.vendor_id IS NULL
    AND bs.bulstat IS NOT NULL 
    AND bs.bulstat != ''
    AND bs.bulstat = v.bulstat
  RETURNING bs.id
)
SELECT 
  COUNT(*) as linked_by_bulstat
FROM updated_bulstat;

-- Then link by name for those without bulstat
WITH updated_name AS (
  UPDATE barsy_suppliers bs
  SET 
    vendor_id = v.id,
    updated_at = now()
  FROM vendors v
  WHERE bs.vendor_id IS NULL
    AND (bs.bulstat IS NULL OR bs.bulstat = '')
    AND bs.supplier_name = v.name
  RETURNING bs.id
)
SELECT 
  COUNT(*) as linked_by_name
FROM updated_name;

\echo 'Step 5: Complete'
\echo ''

-- ============================================================================
-- STEP 6: Summary of linking results
-- ============================================================================

\echo 'Step 6: Summary of linking results...'
\echo ''

SELECT 
  'Total Suppliers' as metric,
  COUNT(*) as count
FROM barsy_suppliers
UNION ALL
SELECT 
  'Linked to Vendors',
  COUNT(*)
FROM barsy_suppliers
WHERE vendor_id IS NOT NULL
UNION ALL
SELECT 
  'Still Unlinked',
  COUNT(*)
FROM barsy_suppliers
WHERE vendor_id IS NULL
UNION ALL
SELECT 
  'Unique Vendors Used',
  COUNT(DISTINCT vendor_id)
FROM barsy_suppliers
WHERE vendor_id IS NOT NULL;

\echo ''

-- Show any remaining unlinked suppliers for manual review
\echo 'Remaining Unlinked Suppliers (if any):'
\echo '--------------------------------------'

SELECT 
  id,
  supplier_id,
  supplier_name,
  bulstat,
  barsy_location_id
FROM barsy_suppliers
WHERE vendor_id IS NULL
ORDER BY supplier_name
LIMIT 20;

\echo ''
\echo '========================================='
\echo 'SUPPLIER LINKING COMPLETE'
\echo '========================================='
\echo ''
\echo 'Next Step: Run 04_backfill_store_loads.sql to update historical purchase data'
\echo ''

