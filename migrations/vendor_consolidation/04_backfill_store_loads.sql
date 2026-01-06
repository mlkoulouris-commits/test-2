-- ============================================================================
-- Vendor Master Consolidation - Backfill Store Loads
-- ============================================================================
-- Purpose: Backfill vendor_id in historical purchase data
-- Updates: barsy_store_loads and barsy_store_load_items
-- ============================================================================

\echo '========================================='
\echo 'BACKFILLING VENDOR IDS IN STORE LOADS'
\echo '========================================='
\echo ''

-- ============================================================================
-- STEP 1: Add vendor_id column to barsy_store_loads if not exists
-- ============================================================================

\echo 'Step 1: Adding vendor_id column to barsy_store_loads...'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'barsy_store_loads' 
    AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE barsy_store_loads ADD COLUMN vendor_id INTEGER;
    RAISE NOTICE 'Added vendor_id column to barsy_store_loads';
  ELSE
    RAISE NOTICE 'vendor_id column already exists in barsy_store_loads';
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'barsy_store_loads_vendor_id_fkey'
  ) THEN
    ALTER TABLE barsy_store_loads 
    ADD CONSTRAINT barsy_store_loads_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    RAISE NOTICE 'Added foreign key constraint to vendors';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Foreign key constraint already exists';
END $$;

-- Add index for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_barsy_store_loads_vendor_id'
  ) THEN
    CREATE INDEX idx_barsy_store_loads_vendor_id ON barsy_store_loads(vendor_id);
    RAISE NOTICE 'Created index on vendor_id';
  ELSE
    RAISE NOTICE 'Index already exists';
  END IF;
END $$;

\echo 'Step 1: Complete'
\echo ''

-- ============================================================================
-- STEP 2: Backfill vendor_id in barsy_store_loads from barsy_suppliers
-- ============================================================================

\echo 'Step 2: Backfilling vendor_id in barsy_store_loads...'

-- Strategy: Match by supplier_id and barsy_location_id
WITH updated AS (
  UPDATE barsy_store_loads sl
  SET 
    vendor_id = bs.vendor_id,
    updated_at = now()
  FROM barsy_suppliers bs
  WHERE sl.supplier_id = bs.supplier_id
    AND sl.barsy_location_id = bs.barsy_location_id
    AND bs.vendor_id IS NOT NULL
    AND sl.vendor_id IS NULL
  RETURNING sl.id
)
SELECT 
  COUNT(*) as store_loads_updated,
  'matched by supplier_id and location' as method
FROM updated;

\echo 'Step 2: Complete'
\echo ''

-- ============================================================================
-- STEP 3: Handle store loads with suppliers not in barsy_suppliers
-- ============================================================================

\echo 'Step 3: Handling orphaned suppliers in store_loads...'

-- Find suppliers in store_loads that don't exist in barsy_suppliers
-- Match them to vendors by supplier_id or name
WITH orphaned_suppliers AS (
  SELECT DISTINCT
    sl.supplier_id,
    sl.supplier_name,
    sl.barsy_location_id
  FROM barsy_store_loads sl
  LEFT JOIN barsy_suppliers bs 
    ON sl.supplier_id = bs.supplier_id 
    AND sl.barsy_location_id = bs.barsy_location_id
  WHERE bs.id IS NULL
    AND sl.supplier_id IS NOT NULL
    AND sl.vendor_id IS NULL
),
matched_vendors AS (
  -- Try to match by supplier_id from other locations
  SELECT DISTINCT
    os.supplier_id,
    os.barsy_location_id,
    bs.vendor_id
  FROM orphaned_suppliers os
  JOIN barsy_suppliers bs ON os.supplier_id = bs.supplier_id
  WHERE bs.vendor_id IS NOT NULL
),
updated AS (
  UPDATE barsy_store_loads sl
  SET 
    vendor_id = mv.vendor_id,
    updated_at = now()
  FROM matched_vendors mv
  WHERE sl.supplier_id = mv.supplier_id
    AND sl.barsy_location_id = mv.barsy_location_id
    AND sl.vendor_id IS NULL
  RETURNING sl.id
)
SELECT 
  COUNT(*) as store_loads_updated,
  'orphaned suppliers matched by supplier_id' as method
FROM updated;

\echo 'Step 3: Complete'
\echo ''

-- ============================================================================
-- STEP 4: Add vendor_id column to barsy_store_load_items if needed
-- ============================================================================

\echo 'Step 4: Adding vendor_id to barsy_store_load_items (if beneficial)...'

-- Check if we want to add vendor_id to line items for easier reporting
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'barsy_store_load_items' 
    AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE barsy_store_load_items ADD COLUMN vendor_id INTEGER;
    RAISE NOTICE 'Added vendor_id column to barsy_store_load_items';
    
    -- Add foreign key
    ALTER TABLE barsy_store_load_items 
    ADD CONSTRAINT barsy_store_load_items_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES vendors(id);
    RAISE NOTICE 'Added foreign key constraint';
    
    -- Add index
    CREATE INDEX idx_barsy_store_load_items_vendor_id 
    ON barsy_store_load_items(vendor_id);
    RAISE NOTICE 'Created index';
  ELSE
    RAISE NOTICE 'vendor_id column already exists in barsy_store_load_items';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint or index already exists';
END $$;

\echo 'Step 4: Complete'
\echo ''

-- ============================================================================
-- STEP 5: Backfill vendor_id in barsy_store_load_items
-- ============================================================================

\echo 'Step 5: Backfilling vendor_id in barsy_store_load_items...'

WITH updated AS (
  UPDATE barsy_store_load_items sli
  SET 
    vendor_id = sl.vendor_id
  FROM barsy_store_loads sl
  WHERE sli.store_load_id = sl.id
    AND sl.vendor_id IS NOT NULL
    AND sli.vendor_id IS NULL
  RETURNING sli.id
)
SELECT 
  COUNT(*) as line_items_updated,
  'from parent store_load' as method
FROM updated;

\echo 'Step 5: Complete'
\echo ''

-- ============================================================================
-- STEP 6: Summary of backfill results
-- ============================================================================

\echo 'Step 6: Summary of backfill results...'
\echo ''

-- Store Loads Summary
SELECT 
  'Total Store Loads' as metric,
  COUNT(*) as count
FROM barsy_store_loads
UNION ALL
SELECT 
  'With Vendor ID',
  COUNT(*)
FROM barsy_store_loads
WHERE vendor_id IS NOT NULL
UNION ALL
SELECT 
  'Without Vendor ID',
  COUNT(*)
FROM barsy_store_loads
WHERE vendor_id IS NULL
UNION ALL
SELECT 
  'Unique Vendors in Store Loads',
  COUNT(DISTINCT vendor_id)
FROM barsy_store_loads
WHERE vendor_id IS NOT NULL;

\echo ''

-- Store Load Items Summary
SELECT 
  'Total Store Load Items' as metric,
  COUNT(*) as count
FROM barsy_store_load_items
UNION ALL
SELECT 
  'With Vendor ID',
  COUNT(*)
FROM barsy_store_load_items
WHERE vendor_id IS NOT NULL
UNION ALL
SELECT 
  'Without Vendor ID',
  COUNT(*)
FROM barsy_store_load_items
WHERE vendor_id IS NULL;

\echo ''

-- Show store loads without vendor_id for review
\echo 'Store Loads Without Vendor ID (if any):'
\echo '----------------------------------------'

SELECT 
  id,
  store_load_id,
  supplier_id,
  supplier_name,
  doc_num,
  doc_date,
  total_sum
FROM barsy_store_loads
WHERE vendor_id IS NULL
ORDER BY doc_date DESC
LIMIT 20;

\echo ''

-- Show purchase volume by vendor
\echo 'Top 10 Vendors by Purchase Volume:'
\echo '-----------------------------------'

SELECT 
  v.id,
  v.name,
  v.bulstat,
  COUNT(DISTINCT sl.id) as purchase_count,
  SUM(sl.total_sum) as total_amount,
  MIN(sl.doc_date) as first_purchase,
  MAX(sl.doc_date) as last_purchase
FROM vendors v
JOIN barsy_store_loads sl ON v.id = sl.vendor_id
GROUP BY v.id, v.name, v.bulstat
ORDER BY SUM(sl.total_sum) DESC
LIMIT 10;

\echo ''
\echo '========================================='
\echo 'BACKFILL COMPLETE'
\echo '========================================='
\echo ''
\echo 'Next Step: Run 05_validation.sql to verify data integrity'
\echo ''

