-- ============================================================================
-- BILLS TABLE ARCHITECTURE
-- Separates staging (barsy_store_loads) from operational bills
-- ============================================================================
-- Purpose: Create clean bills table for both Barsy and manually entered bills
-- Source tracking: 'barsy' | 'manual'
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE BILLS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  
  -- Source tracking
  source VARCHAR(20) NOT NULL CHECK (source IN ('barsy', 'manual')),
  barsy_store_load_id INT REFERENCES barsy_store_loads(id) ON DELETE SET NULL,
  
  -- Core bill information
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  -- Document details
  doc_num VARCHAR(100),
  doc_date DATE,
  due_date DATE,
  
  -- Financial
  total_amount NUMERIC(12,2) NOT NULL,
  total_paid NUMERIC(12,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'partially_paid', 'paid', 'voided')),
  
  -- Additional details
  description TEXT,
  notes TEXT,
  
  -- Metadata
  created_by VARCHAR(255),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bills_location ON bills(location_id);
CREATE INDEX idx_bills_vendor ON bills(vendor_id);
CREATE INDEX idx_bills_source ON bills(source);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_doc_date ON bills(doc_date);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_barsy_store_load ON bills(barsy_store_load_id);

-- Unique constraint for Barsy bills
CREATE UNIQUE INDEX idx_bills_unique_barsy_source 
ON bills(barsy_store_load_id) 
WHERE source = 'barsy' AND barsy_store_load_id IS NOT NULL;

-- ============================================================================
-- STEP 2: CREATE BILL ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  
  -- Item details
  barsy_article_id INT,
  article_name VARCHAR(255),
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  
  -- Additional
  amount_type VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_bill_items_article ON bill_items(barsy_article_id);

-- ============================================================================
-- STEP 3: UPDATE PAYMENT TABLES TO REFERENCE BILLS
-- ============================================================================

-- Add new bill_id column to bill_payment_applications
ALTER TABLE bill_payment_applications 
ADD COLUMN IF NOT EXISTS new_bill_id INT REFERENCES bills(id) ON DELETE CASCADE;

-- Create index on new column
CREATE INDEX IF NOT EXISTS idx_bill_payment_applications_new_bill 
ON bill_payment_applications(new_bill_id);

-- ============================================================================
-- STEP 4: UPDATE TRIGGER FOR BILL TOTAL_PAID
-- ============================================================================

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_insert ON bill_payment_applications;
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_update ON bill_payment_applications;
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_delete ON bill_payment_applications;

-- Update function to work with both old and new bill references
CREATE OR REPLACE FUNCTION update_bill_total_paid()
RETURNS TRIGGER AS $$
DECLARE
  target_bill_id INT;
  new_total_paid NUMERIC(12,2);
BEGIN
  -- Determine which bill_id to update (new or old system)
  target_bill_id := COALESCE(NEW.new_bill_id, OLD.new_bill_id);
  
  IF target_bill_id IS NOT NULL THEN
    -- Calculate new total_paid
    SELECT COALESCE(SUM(amount_applied), 0) INTO new_total_paid
    FROM bill_payment_applications
    WHERE new_bill_id = target_bill_id;
    
    -- Update bills table
    UPDATE bills
    SET 
      total_paid = new_total_paid,
      status = CASE
        WHEN new_total_paid = 0 THEN 'approved'
        WHEN new_total_paid >= total_amount THEN 'paid'
        ELSE 'partially_paid'
      END,
      updated_at = NOW()
    WHERE id = target_bill_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for new system
CREATE TRIGGER trigger_update_bill_total_paid_insert
AFTER INSERT ON bill_payment_applications
FOR EACH ROW
WHEN (NEW.new_bill_id IS NOT NULL)
EXECUTE FUNCTION update_bill_total_paid();

CREATE TRIGGER trigger_update_bill_total_paid_update
AFTER UPDATE ON bill_payment_applications
FOR EACH ROW
WHEN (NEW.new_bill_id IS NOT NULL)
EXECUTE FUNCTION update_bill_total_paid();

CREATE TRIGGER trigger_update_bill_total_paid_delete
AFTER DELETE ON bill_payment_applications
FOR EACH ROW
WHEN (OLD.new_bill_id IS NOT NULL)
EXECUTE FUNCTION update_bill_total_paid();

-- ============================================================================
-- STEP 5: UPDATE VALIDATION FUNCTION FOR NEW BILLS TABLE
-- ============================================================================

-- Drop old validation trigger
DROP TRIGGER IF EXISTS trigger_validate_payment_location ON bill_payment_applications;

-- Update validation function
CREATE OR REPLACE FUNCTION validate_payment_location()
RETURNS TRIGGER AS $$
DECLARE
  payment_location UUID;
  bill_location UUID;
BEGIN
  -- Get the location from the payment
  SELECT location_id INTO payment_location
  FROM bill_payments
  WHERE id = NEW.payment_id;

  -- Get the location from the bill (use new_bill_id if available)
  IF NEW.new_bill_id IS NOT NULL THEN
    SELECT location_id INTO bill_location
    FROM bills
    WHERE id = NEW.new_bill_id;
  ELSIF NEW.bill_id IS NOT NULL THEN
    -- Fallback to old system
    SELECT barsy_location_id INTO bill_location
    FROM barsy_store_loads
    WHERE id = NEW.bill_id;
  END IF;

  -- Ensure they match
  IF payment_location IS NOT NULL AND bill_location IS NOT NULL THEN
    IF payment_location != bill_location THEN
      RAISE EXCEPTION 'Payment can only be applied to bills from the same location (Location ID: %)', payment_location;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new validation trigger
CREATE TRIGGER trigger_validate_payment_location
BEFORE INSERT OR UPDATE ON bill_payment_applications
FOR EACH ROW
EXECUTE FUNCTION validate_payment_location();

-- ============================================================================
-- STEP 6: DATA MIGRATION - Copy approved bills from barsy_store_loads
-- ============================================================================

-- Migrate approved bills (status = 0) from barsy_store_loads to bills
INSERT INTO bills (
  source,
  barsy_store_load_id,
  location_id,
  vendor_id,
  doc_num,
  doc_date,
  due_date,
  total_amount,
  total_paid,
  status,
  description,
  created_by,
  created_at,
  updated_at
)
SELECT 
  'barsy' as source,
  bsl.id as barsy_store_load_id,
  bsl.barsy_location_id as location_id,
  COALESCE(bsl.vendor_id, (
    SELECT v.id FROM vendors v 
    WHERE v.name = bsl.supplier_name 
    LIMIT 1
  )) as vendor_id,
  bsl.doc_num,
  bsl.doc_date,
  bsl.paid_due_date as due_date,
  bsl.total_sum as total_amount,
  COALESCE(bsl.total_paid, 0) as total_paid,
  CASE
    WHEN COALESCE(bsl.total_paid, 0) = 0 THEN 'approved'
    WHEN COALESCE(bsl.total_paid, 0) >= bsl.total_sum THEN 'paid'
    ELSE 'partially_paid'
  END as status,
  bsl.description,
  bsl.user_name as created_by,
  bsl.created_at,
  bsl.updated_at
FROM barsy_store_loads bsl
WHERE bsl.status = 0 -- Only approved bills
  AND bsl.status != -1 -- Exclude voided
  AND NOT EXISTS (
    SELECT 1 FROM bills b WHERE b.barsy_store_load_id = bsl.id
  );

-- Migrate bill items
INSERT INTO bill_items (
  bill_id,
  barsy_article_id,
  article_name,
  quantity,
  unit_price,
  total_price,
  amount_type,
  created_at
)
SELECT 
  b.id as bill_id,
  bsli.barsy_article_id,
  bsli.article_name,
  bsli.quantity,
  bsli.unit_price,
  bsli.total_price,
  bsli.amount_type,
  bsli.created_at
FROM barsy_store_load_items bsli
INNER JOIN bills b ON b.barsy_store_load_id = bsli.store_load_id
WHERE NOT EXISTS (
  SELECT 1 FROM bill_items bi 
  WHERE bi.bill_id = b.id 
  AND bi.barsy_article_id = bsli.barsy_article_id
);

-- ============================================================================
-- STEP 7: MIGRATE PAYMENT APPLICATIONS
-- ============================================================================

-- Update bill_payment_applications to reference new bills table
UPDATE bill_payment_applications bpa
SET new_bill_id = b.id
FROM bills b
WHERE b.barsy_store_load_id = bpa.bill_id
  AND bpa.new_bill_id IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bills IS 'Operational bills table - contains both Barsy synced and manually entered bills';
COMMENT ON TABLE bill_items IS 'Line items for bills';
COMMENT ON COLUMN bills.source IS 'Source of bill: barsy (synced) or manual (user-entered)';
COMMENT ON COLUMN bills.barsy_store_load_id IS 'Reference to original Barsy staging record (null for manual bills)';
COMMENT ON COLUMN bills.status IS 'Bill payment status: approved, partially_paid, paid, voided';
COMMENT ON COLUMN bill_payment_applications.new_bill_id IS 'Reference to bills table (replaces bill_id which references barsy_store_loads)';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check migration results
DO $$
DECLARE
  barsy_approved_count INT;
  bills_count INT;
  payment_apps_migrated INT;
BEGIN
  SELECT COUNT(*) INTO barsy_approved_count FROM barsy_store_loads WHERE status = 0 AND status != -1;
  SELECT COUNT(*) INTO bills_count FROM bills WHERE source = 'barsy';
  SELECT COUNT(*) INTO payment_apps_migrated FROM bill_payment_applications WHERE new_bill_id IS NOT NULL;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'MIGRATION VERIFICATION';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Approved bills in barsy_store_loads: %', barsy_approved_count;
  RAISE NOTICE 'Bills migrated to bills table: %', bills_count;
  RAISE NOTICE 'Payment applications migrated: %', payment_apps_migrated;
  RAISE NOTICE '==============================================';
END $$;

