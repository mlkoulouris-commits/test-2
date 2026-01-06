-- ============================================================================
-- MIGRATION: Add period date range to bills
-- ============================================================================
-- Adds optional period_start and period_end dates to track billing periods
-- Useful for utility bills and recurring expenses
-- ============================================================================

-- Add period date columns to bills table
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS period_start DATE,
ADD COLUMN IF NOT EXISTS period_end DATE;

-- Add index for period queries
CREATE INDEX IF NOT EXISTS idx_bills_period_start ON bills(period_start);
CREATE INDEX IF NOT EXISTS idx_bills_period_end ON bills(period_end);

-- Add comments
COMMENT ON COLUMN bills.period_start IS 'Optional - Start date of the billing period (e.g., for utility bills)';
COMMENT ON COLUMN bills.period_end IS 'Optional - End date of the billing period (e.g., for utility bills)';

