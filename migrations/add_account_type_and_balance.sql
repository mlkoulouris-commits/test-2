-- Add account type to distinguish between bank and cash accounts
-- Add current_balance field to track account balances

ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash')),
ADD COLUMN IF NOT EXISTS current_balance NUMERIC(10,2) DEFAULT 0;

-- Create an index for account type
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type ON bank_accounts(account_type);

-- Create a function to calculate balance from payments
CREATE OR REPLACE FUNCTION get_account_balance(account_id INT)
RETURNS NUMERIC AS $$
DECLARE
  total_payments NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(total_amount), 0)
  INTO total_payments
  FROM bill_payments
  WHERE bank_account_id = account_id;
  
  RETURN total_payments;
END;
$$ LANGUAGE plpgsql;

-- Ensure each location has a cash account
-- Run this after creating the table structure
COMMENT ON COLUMN bank_accounts.account_type IS 'Type of account: bank or cash';
COMMENT ON COLUMN bank_accounts.current_balance IS 'Current balance in the account. Decreases with payments.';

-- Example: Create cash accounts for existing locations
-- INSERT INTO bank_accounts (location_id, account_name, account_type, is_active, is_default, current_balance)
-- SELECT id, name || ' - Cash', 'cash', true, false, 0
-- FROM barsy_locations
-- WHERE NOT EXISTS (
--   SELECT 1 FROM bank_accounts 
--   WHERE bank_accounts.location_id = barsy_locations.id 
--   AND bank_accounts.account_type = 'cash'
-- );

