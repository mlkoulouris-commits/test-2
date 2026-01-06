-- Performance indexes for Barsy transactions page
-- Run this in Supabase SQL Editor

-- =====================================================
-- BARSY_ORDERS INDEXES
-- =====================================================

-- 1. Index for void filtering (positive vs negative amounts)
-- Used when filtering by "Positive Only", "All Voided", etc.
CREATE INDEX IF NOT EXISTS idx_barsy_orders_amount
ON barsy_orders (amount);

-- 2. Partial index for voided orders only (amount < 0)
-- Speeds up queries that specifically look for voided items
CREATE INDEX IF NOT EXISTS idx_barsy_orders_voided
ON barsy_orders (order_date, barsy_article_id, amount)
WHERE amount < 0;

-- 3. Index for transfer detection self-join
-- The transfer detection query joins on (barsy_article_id, order_date, amount)
CREATE INDEX IF NOT EXISTS idx_barsy_orders_transfer_lookup
ON barsy_orders (barsy_article_id, order_date, amount);

-- 4. Index for user_name filtering (currently only barsy_user_id is indexed)
CREATE INDEX IF NOT EXISTS idx_barsy_orders_user_name
ON barsy_orders (user_name);

-- 5. Composite index for common filter pattern: date range + location
-- Covers the most common query pattern with INCLUDE for commonly selected columns
CREATE INDEX IF NOT EXISTS idx_barsy_orders_date_location_amount
ON barsy_orders (order_date DESC, location_id, amount);

-- 6. Index on order_date alone (without location) for date-only filtering
CREATE INDEX IF NOT EXISTS idx_barsy_orders_date_desc
ON barsy_orders (order_date DESC);

-- 7. Index for account grouping with date (for grouped transactions view)
CREATE INDEX IF NOT EXISTS idx_barsy_orders_account_date
ON barsy_orders ((raw_data->>'account_id'), order_date DESC);

-- =====================================================
-- BARSY_ACCOUNTS INDEXES
-- =====================================================

-- 8. Index for looking up accounts by barsy_account_id (for payment method lookup)
CREATE INDEX IF NOT EXISTS idx_barsy_accounts_barsy_id
ON barsy_accounts (barsy_account_id);

-- 9. Composite index for account date range queries with location
CREATE INDEX IF NOT EXISTS idx_barsy_accounts_open_date_location
ON barsy_accounts (open_date DESC, location_id);

-- =====================================================
-- ANALYZE TABLES
-- =====================================================

-- Update statistics for query planner
ANALYZE barsy_orders;
ANALYZE barsy_accounts;







