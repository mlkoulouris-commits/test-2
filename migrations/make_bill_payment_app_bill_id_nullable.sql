-- ============================================================================
-- MIGRATION: Make bill_id nullable in bill_payment_applications
-- ============================================================================
-- This allows new payment applications to use new_bill_id (references bills table)
-- while maintaining compatibility with existing records that reference barsy_store_loads
-- ============================================================================

-- Make bill_id nullable
ALTER TABLE bill_payment_applications 
ALTER COLUMN bill_id DROP NOT NULL;

-- Update triggers to work with new_bill_id primarily
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_insert ON bill_payment_applications;
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_update ON bill_payment_applications;
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_delete ON bill_payment_applications;

-- Update function to prioritize new_bill_id
CREATE OR REPLACE FUNCTION update_bill_total_paid()
RETURNS TRIGGER AS $$
DECLARE
  target_bill_id INT;
  new_total_paid NUMERIC(12,2);
BEGIN
  -- Prioritize new_bill_id over old bill_id
  target_bill_id := COALESCE(NEW.new_bill_id, OLD.new_bill_id);
  
  IF target_bill_id IS NOT NULL THEN
    -- Calculate total paid for this bill
    SELECT COALESCE(SUM(amount_applied), 0)
    INTO new_total_paid
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

-- Recreate triggers
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

-- Add comment
COMMENT ON COLUMN bill_payment_applications.bill_id IS 'Legacy column - references barsy_store_loads (deprecated). Use new_bill_id for new records.';
COMMENT ON COLUMN bill_payment_applications.new_bill_id IS 'Current column - references bills table. Use this for all new payment applications.';

