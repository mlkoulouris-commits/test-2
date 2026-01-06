-- ============================================================================
-- Vendor Master Consolidation - Create Vendor Masters
-- ============================================================================
-- Purpose: Create vendor master records from barsy_suppliers
-- Strategy: Bulstat match (exact) → Normalized name match (fuzzy)
-- ============================================================================

\echo '========================================='
\echo 'CREATING VENDOR MASTERS'
\echo '========================================='
\echo ''

-- ============================================================================
-- STEP 1: Add new columns to vendors table if they don't exist
-- ============================================================================

\echo 'Step 1: Adding new columns to vendors table...'

-- Add bulstat column for tax ID matching
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'bulstat'
  ) THEN
    ALTER TABLE vendors ADD COLUMN bulstat VARCHAR(20);
    RAISE NOTICE 'Added bulstat column';
  ELSE
    RAISE NOTICE 'bulstat column already exists';
  END IF;
END $$;

-- Add alternative_names column for name variations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'alternative_names'
  ) THEN
    ALTER TABLE vendors ADD COLUMN alternative_names JSONB;
    RAISE NOTICE 'Added alternative_names column';
  ELSE
    RAISE NOTICE 'alternative_names column already exists';
  END IF;
END $$;

-- Add merge_notes column for documentation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'merge_notes'
  ) THEN
    ALTER TABLE vendors ADD COLUMN merge_notes TEXT;
    RAISE NOTICE 'Added merge_notes column';
  ELSE
    RAISE NOTICE 'merge_notes column already exists';
  END IF;
END $$;

-- Add unique constraint on bulstat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vendors_bulstat_unique'
  ) THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_bulstat_unique UNIQUE (bulstat);
    RAISE NOTICE 'Added unique constraint on bulstat';
  ELSE
    RAISE NOTICE 'bulstat unique constraint already exists';
  END IF;
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'bulstat unique constraint already exists';
END $$;

\echo 'Step 1: Complete'
\echo ''

-- ============================================================================
-- STEP 2: Create vendor masters from bulstat groups
-- ============================================================================

\echo 'Step 2: Creating vendor masters from bulstat groups...'

WITH bulstat_groups AS (
  -- Group suppliers by bulstat
  SELECT 
    bulstat,
    COUNT(*) as supplier_count,
    -- Select best name (longest, most complete, with legal entity suffix)
    (array_agg(
      supplier_name 
      ORDER BY 
        CASE WHEN supplier_name ILIKE '%ООД%' OR supplier_name ILIKE '%ЕООД%' THEN 1 ELSE 2 END,
        LENGTH(supplier_name) DESC,
        supplier_name
    ))[1] as master_name,
    -- Collect all name variations
    array_agg(DISTINCT supplier_name ORDER BY supplier_name) as name_variations,
    -- Aggregate contact info (prefer non-null values)
    MAX(contact_person) FILTER (WHERE contact_person IS NOT NULL) as contact_person,
    MAX(phone) FILTER (WHERE phone IS NOT NULL) as phone,
    MAX(email) FILTER (WHERE email IS NOT NULL) as email,
    MAX(address) FILTER (WHERE address IS NOT NULL) as address,
    MAX(city) FILTER (WHERE city IS NOT NULL) as city,
    MAX(vat_number) FILTER (WHERE vat_number IS NOT NULL) as vat_number,
    MAX(payment_terms_days) as payment_terms_days,
    array_agg(DISTINCT supplier_id ORDER BY supplier_id) as supplier_ids
  FROM barsy_suppliers
  WHERE bulstat IS NOT NULL AND bulstat != ''
  GROUP BY bulstat
),
inserted_vendors AS (
  -- Insert vendor masters
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
    master_name,
    bulstat,
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
      'names', name_variations,
      'supplier_ids', supplier_ids
    ),
    'Auto-created from bulstat group. Merged ' || supplier_count || ' supplier records.',
    true,
    now(),
    now()
  FROM bulstat_groups
  ON CONFLICT (bulstat) DO UPDATE SET
    alternative_names = EXCLUDED.alternative_names,
    merge_notes = EXCLUDED.merge_notes,
    updated_at = now()
  RETURNING id, name, bulstat
)
SELECT 
  COUNT(*) as vendors_created,
  'from bulstat groups' as source
FROM inserted_vendors;

\echo 'Step 2: Complete'
\echo ''

-- ============================================================================
-- STEP 3: Create vendor masters from normalized name groups (no bulstat)
-- ============================================================================

\echo 'Step 3: Creating vendor masters from name groups (no bulstat)...'

WITH name_groups AS (
  -- Group suppliers without bulstat by normalized name
  SELECT 
    UPPER(TRIM(supplier_name)) as normalized_name,
    COUNT(*) as supplier_count,
    -- Select best name
    (array_agg(
      supplier_name 
      ORDER BY 
        CASE WHEN supplier_name ILIKE '%ООД%' OR supplier_name ILIKE '%ЕООД%' THEN 1 ELSE 2 END,
        LENGTH(supplier_name) DESC,
        supplier_name
    ))[1] as master_name,
    array_agg(DISTINCT supplier_name ORDER BY supplier_name) as name_variations,
    MAX(contact_person) FILTER (WHERE contact_person IS NOT NULL) as contact_person,
    MAX(phone) FILTER (WHERE phone IS NOT NULL) as phone,
    MAX(email) FILTER (WHERE email IS NOT NULL) as email,
    MAX(address) FILTER (WHERE address IS NOT NULL) as address,
    MAX(city) FILTER (WHERE city IS NOT NULL) as city,
    MAX(payment_terms_days) as payment_terms_days,
    array_agg(DISTINCT supplier_id ORDER BY supplier_id) as supplier_ids
  FROM barsy_suppliers
  WHERE bulstat IS NULL OR bulstat = ''
  GROUP BY UPPER(TRIM(supplier_name))
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
    master_name,
    NULL,
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
      'names', name_variations,
      'supplier_ids', supplier_ids,
      'normalized_name', normalized_name
    ),
    'Auto-created from normalized name group. Merged ' || supplier_count || ' supplier records. No bulstat available.',
    true,
    now(),
    now()
  FROM name_groups
  RETURNING id, name, bulstat
)
SELECT 
  COUNT(*) as vendors_created,
  'from name groups' as source
FROM inserted_vendors;

\echo 'Step 3: Complete'
\echo ''

-- ============================================================================
-- STEP 4: Summary of created vendor masters
-- ============================================================================

\echo 'Step 4: Summary of created vendor masters...'
\echo ''

SELECT 
  'Total Vendor Masters' as metric,
  COUNT(*) as count
FROM vendors
UNION ALL
SELECT 
  'With Bulstat',
  COUNT(*)
FROM vendors
WHERE bulstat IS NOT NULL
UNION ALL
SELECT 
  'Without Bulstat',
  COUNT(*)
FROM vendors
WHERE bulstat IS NULL
UNION ALL
SELECT 
  'Auto-created (this migration)',
  COUNT(*)
FROM vendors
WHERE merge_notes LIKE '%Auto-created%';

\echo ''
\echo '========================================='
\echo 'VENDOR MASTERS CREATED SUCCESSFULLY'
\echo '========================================='
\echo ''
\echo 'Next Step: Run 03_link_suppliers.sql to link barsy_suppliers to vendor masters'
\echo ''

