-- ============================================================================
-- BILL ACCOUNT CATEGORIZATION
-- Adds chart of accounts support for bills and bill items
-- ============================================================================

-- Add account_id to bills table for bill-level account assignment
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS account_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL;

-- Add account_id to bill_items table for line-item level account assignment (if not exists)
ALTER TABLE bill_items
ADD COLUMN IF NOT EXISTS account_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL;

-- Add default_account_id to vendors table (if not exists)
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS default_account_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bills_account ON bills(account_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_account ON bill_items(account_id);
CREATE INDEX IF NOT EXISTS idx_vendors_default_account ON vendors(default_account_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN bills.account_id IS 'Chart of accounts for entire bill (used when no line item accounts specified)';
COMMENT ON COLUMN bill_items.account_id IS 'Chart of accounts for individual line item (overrides bill-level and vendor default)';
COMMENT ON COLUMN vendors.default_account_id IS 'Default chart of accounts for this vendor (used as fallback)';
