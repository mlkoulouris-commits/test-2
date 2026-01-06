-- Automatically update bank account balance when payments are recorded or deleted
-- This ensures the current_balance field accurately reflects the account state

-- ============================================================================
-- FUNCTION TO UPDATE BANK ACCOUNT BALANCE
-- Deducts payment amount from bank account when payment is recorded
-- ============================================================================
CREATE OR REPLACE FUNCTION update_bank_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Deduct payment amount from bank account
    UPDATE bank_accounts
    SET current_balance = current_balance - NEW.total_amount,
        updated_at = NOW()
    WHERE id = NEW.bank_account_id;
    
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Add payment amount back to bank account when payment is deleted
    UPDATE bank_accounts
    SET current_balance = current_balance + OLD.total_amount,
        updated_at = NOW()
    WHERE id = OLD.bank_account_id;
    
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Handle account change or amount change
    IF OLD.bank_account_id != NEW.bank_account_id THEN
      -- Add back to old account
      UPDATE bank_accounts
      SET current_balance = current_balance + OLD.total_amount,
          updated_at = NOW()
      WHERE id = OLD.bank_account_id;
      
      -- Deduct from new account
      UPDATE bank_accounts
      SET current_balance = current_balance - NEW.total_amount,
          updated_at = NOW()
      WHERE id = NEW.bank_account_id;
    ELSIF OLD.total_amount != NEW.total_amount THEN
      -- Amount changed, adjust the difference
      UPDATE bank_accounts
      SET current_balance = current_balance + OLD.total_amount - NEW.total_amount,
          updated_at = NOW()
      WHERE id = NEW.bank_account_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO UPDATE BANK ACCOUNT BALANCE
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_bank_account_balance ON bill_payments;
CREATE TRIGGER trigger_update_bank_account_balance
AFTER INSERT OR UPDATE OR DELETE ON bill_payments
FOR EACH ROW
EXECUTE FUNCTION update_bank_account_balance();

-- ============================================================================
-- FUNCTION TO RECALCULATE BANK ACCOUNT BALANCE FROM PAYMENT HISTORY
-- Use this to fix balances or calculate them for the first time
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_bank_account_balance(account_id INT)
RETURNS VOID AS $$
DECLARE
  total_payments NUMERIC(10,2);
BEGIN
  -- Calculate total payments from this account
  SELECT COALESCE(SUM(total_amount), 0)
  INTO total_payments
  FROM bill_payments
  WHERE bank_account_id = account_id;
  
  -- Note: This assumes you want to track how much has been spent
  -- If you want to track remaining balance, you need to set initial balance first
  -- and this would show: initial_balance - total_payments
  
  -- For now, we just show the total spent (negative balance)
  UPDATE bank_accounts
  SET current_balance = -total_payments,
      updated_at = NOW()
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECALCULATE ALL BANK ACCOUNT BALANCES
-- Run this once after adding the trigger to sync existing data
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_all_bank_account_balances()
RETURNS TABLE(account_id INT, account_name VARCHAR, old_balance NUMERIC, new_balance NUMERIC) AS $$
DECLARE
  account_record RECORD;
  old_bal NUMERIC;
  new_bal NUMERIC;
BEGIN
  FOR account_record IN 
    SELECT id, account_name, current_balance 
    FROM bank_accounts 
    WHERE is_active = true
  LOOP
    old_bal := account_record.current_balance;
    
    -- Calculate total payments
    SELECT COALESCE(SUM(total_amount), 0)
    INTO new_bal
    FROM bill_payments
    WHERE bank_account_id = account_record.id;
    
    -- Update with negative of total spent (deducted from balance)
    new_bal := -new_bal;
    
    UPDATE bank_accounts
    SET current_balance = new_bal,
        updated_at = NOW()
    WHERE id = account_record.id;
    
    account_id := account_record.id;
    account_name := account_record.account_name;
    old_balance := old_bal;
    new_balance := new_bal;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION update_bank_account_balance() IS 'Automatically updates bank account balance when payments are recorded, updated, or deleted';
COMMENT ON FUNCTION recalculate_bank_account_balance(INT) IS 'Recalculates balance for a specific bank account from payment history';
COMMENT ON FUNCTION recalculate_all_bank_account_balances() IS 'Recalculates balances for all bank accounts - run once after migration';

-- To recalculate all balances after migration, run:
-- SELECT * FROM recalculate_all_bank_account_balances();

