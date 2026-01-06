-- Add bank account tracking to payment system
-- Enforce that payments can only be made for bills from a single location

-- ============================================================================
-- BANK ACCOUNTS TABLE
-- Each location has one or more bank accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  bank_name VARCHAR(255),
  currency VARCHAR(10) DEFAULT 'BGN',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_location ON bank_accounts(location_id);
CREATE INDEX idx_bank_accounts_active ON bank_accounts(is_active);

-- Ensure only one default account per location
CREATE UNIQUE INDEX idx_bank_accounts_default_per_location 
ON bank_accounts(location_id, is_default) 
WHERE is_default = true;

-- ============================================================================
-- UPDATE BILL PAYMENTS TABLE
-- Add location and bank account tracking
-- ============================================================================
ALTER TABLE bill_payments 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES barsy_locations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bank_account_id INT REFERENCES bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bill_payments_location ON bill_payments(location_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bank_account ON bill_payments(bank_account_id);

-- ============================================================================
-- VALIDATION FUNCTION
-- Ensures all bills in a payment are from the same location
-- ============================================================================
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
  
  -- Get the location from the bill
  SELECT barsy_location_id INTO bill_location
  FROM barsy_store_loads
  WHERE id = NEW.bill_id;
  
  -- Ensure they match
  IF payment_location IS NOT NULL AND bill_location IS NOT NULL THEN
    IF payment_location != bill_location THEN
      RAISE EXCEPTION 'Payment can only be applied to bills from the same location (Location ID: %)', payment_location;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO VALIDATE LOCATION MATCHING
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_validate_payment_location ON bill_payment_applications;
CREATE TRIGGER trigger_validate_payment_location
BEFORE INSERT OR UPDATE ON bill_payment_applications
FOR EACH ROW
EXECUTE FUNCTION validate_payment_location();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE bank_accounts IS 'Bank accounts for each location - each location is its own company';
COMMENT ON COLUMN bill_payments.location_id IS 'Location/company making the payment';
COMMENT ON COLUMN bill_payments.bank_account_id IS 'Bank account the payment comes from';

