-- ============================================================================
-- COMPREHENSIVE PERFORMANCE INDEXES
-- Optimizes queries across the application, especially for profit-loss reports
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PROFIT & LOSS CRITICAL INDEXES
-- These indexes are specifically optimized for the P&L page queries
-- ============================================================================

-- 1. CHART_OF_ACCOUNTS - Used heavily in P&L structure building
-- Query pattern: .eq('is_active', true).order('code')
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_active_code
ON chart_of_accounts(is_active, code);

-- Query pattern: Find accounts by account_type and level (for building sections)
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type_level
ON chart_of_accounts(account_type, level, is_active);

-- Query pattern: Find children by parent_id
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent
ON chart_of_accounts(parent_id);

-- Query pattern: Find accounts by code prefix (like '31%')
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_code
ON chart_of_accounts(code);


-- 2. BARSY_CATEGORY_ACCOUNT_MAPPING - Revenue mapping lookups
-- Query pattern: .select(...).not('revenue_account_id', 'is', null)
CREATE INDEX IF NOT EXISTS idx_barsy_category_mapping_location_category
ON barsy_category_account_mapping(barsy_location_id, barsy_category_id);

CREATE INDEX IF NOT EXISTS idx_barsy_category_mapping_revenue
ON barsy_category_account_mapping(revenue_account_id)
WHERE revenue_account_id IS NOT NULL;


-- 3. BARSY_ARTICLE_ACCOUNT_MAPPING - Article override lookups
-- Query pattern: .select(...).not('revenue_account_id', 'is', null)
CREATE INDEX IF NOT EXISTS idx_barsy_article_mapping_location_article
ON barsy_article_account_mapping(barsy_location_id, barsy_article_id);

CREATE INDEX IF NOT EXISTS idx_barsy_article_mapping_revenue
ON barsy_article_account_mapping(revenue_account_id)
WHERE revenue_account_id IS NOT NULL;


-- 4. BARSY_ARTICLES - Category lookup for sales aggregation
-- Query pattern: Get all articles with category_id for mapping
CREATE INDEX IF NOT EXISTS idx_barsy_articles_location_article_category
ON barsy_articles(location_id, barsy_article_id, category_id);


-- 5. BARSY_ORDERS - Critical for revenue calculation
-- Query pattern: .gte('order_date', dateFrom).lte('order_date', dateTo).eq('location_id', ...)
-- This composite index covers date range + location filtering
CREATE INDEX IF NOT EXISTS idx_barsy_orders_date_range_location
ON barsy_orders(order_date, location_id);

-- Covering index for the P&L select (location_id, barsy_article_id, actual_price)
CREATE INDEX IF NOT EXISTS idx_barsy_orders_pl_lookup
ON barsy_orders(order_date, location_id, barsy_article_id, actual_price);


-- 6. BARSY_LOCATIONS - No additional index needed
-- Note: barsy_locations uses 'id' as primary key which is already indexed


-- 7. BILLS - Expense aggregation
-- Query pattern: .gte('doc_date', dateFrom).lte('doc_date', dateTo).neq('status', 'voided').eq('location_id', ...)
CREATE INDEX IF NOT EXISTS idx_bills_doc_date_location_status
ON bills(doc_date, location_id, status);

-- Partial index for non-voided bills (most common query)
CREATE INDEX IF NOT EXISTS idx_bills_active_doc_date
ON bills(doc_date, location_id)
WHERE status != 'voided';

-- Composite for vendor lookup during expense categorization
CREATE INDEX IF NOT EXISTS idx_bills_vendor_doc_date
ON bills(vendor_id, doc_date);


-- 8. BILL_ITEMS - Line item lookups
-- Query pattern: .in('bill_id', billIds)
-- The primary index on bill_id exists, but add covering index for account lookups
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_account
ON bill_items(bill_id, account_id, total_price);


-- 9. LABOR_COSTS - Personnel expense aggregation
-- Query pattern: .gte('period_start', dateFrom).lte('period_end', dateTo).eq('location_id', ...)
CREATE INDEX IF NOT EXISTS idx_labor_costs_period_location
ON labor_costs(period_start, period_end, location_id);

-- For filtering by profile/employee
CREATE INDEX IF NOT EXISTS idx_labor_costs_profile
ON labor_costs(profile_id);

-- For cost type reporting
CREATE INDEX IF NOT EXISTS idx_labor_costs_type_period
ON labor_costs(cost_type, period_start);

-- Covering index for amount lookups
CREATE INDEX IF NOT EXISTS idx_labor_costs_period_account
ON labor_costs(period_start, period_end, account_id, amount);


-- ============================================================================
-- LOCATIONS TABLE - Used across all reports
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_locations_active
ON locations(is_active);

CREATE INDEX IF NOT EXISTS idx_locations_active_name
ON locations(is_active, name);


-- ============================================================================
-- VENDORS TABLE - Bill vendor lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_name
ON vendors(name);

CREATE INDEX IF NOT EXISTS idx_vendors_active
ON vendors(is_active)
WHERE is_active = true;


-- ============================================================================
-- EMPLOYEE INCOME REPORTS - Cash flow and reporting
-- ============================================================================

-- Query pattern: Date range + location + status filtering
CREATE INDEX IF NOT EXISTS idx_employee_income_location_date_status
ON employee_income_reports(location_id, business_date, status);

-- For user-specific lookups
CREATE INDEX IF NOT EXISTS idx_employee_income_user_date
ON employee_income_reports(user_id, business_date);

-- For approval workflows
CREATE INDEX IF NOT EXISTS idx_employee_income_status_date
ON employee_income_reports(status, business_date DESC);


-- ============================================================================
-- BILL PAYMENTS - Payment tracking
-- ============================================================================

-- Query pattern: Date range + location filtering
CREATE INDEX IF NOT EXISTS idx_bill_payments_date_location
ON bill_payments(payment_date, location_id);

-- For bank account reconciliation
CREATE INDEX IF NOT EXISTS idx_bill_payments_bank_date
ON bill_payments(bank_account_id, payment_date);


-- ============================================================================
-- BANK ACCOUNTS - Financial reporting
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bank_accounts_location_active
ON bank_accounts(location_id, is_active);

-- For cash account lookups (account_type = 'cash')
CREATE INDEX IF NOT EXISTS idx_bank_accounts_type_location
ON bank_accounts(account_type, location_id);


-- ============================================================================
-- BANK ACCOUNT TRANSFERS - Transfer tracking
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bank_transfers_date
ON bank_account_transfers(transfer_date);

CREATE INDEX IF NOT EXISTS idx_bank_transfers_from_account
ON bank_account_transfers(from_account_id, transfer_date);

CREATE INDEX IF NOT EXISTS idx_bank_transfers_to_account
ON bank_account_transfers(to_account_id, transfer_date);


-- ============================================================================
-- BARSY STORE LOADS - Invoice/bill staging
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_barsy_store_loads_location_date_status
ON barsy_store_loads(barsy_location_id, doc_date, status);

CREATE INDEX IF NOT EXISTS idx_barsy_store_loads_pending
ON barsy_store_loads(barsy_location_id, status)
WHERE status = 1;


-- ============================================================================
-- BARSY STORE LOAD ITEMS - Invoice line items
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_barsy_store_load_items_load_article
ON barsy_store_load_items(store_load_id, barsy_article_id);


-- ============================================================================
-- BILL PAYMENT APPLICATIONS - Payment allocation
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bill_payment_apps_bill
ON bill_payment_applications(new_bill_id);


-- ============================================================================
-- PROFILES - User lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_names
ON profiles(first_name, last_name);


-- ============================================================================
-- RECURRING BILL TEMPLATES - Scheduled bills
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recurring_templates_location_active_next
ON recurring_bill_templates(location_id, is_active, next_generation_date);


-- ============================================================================
-- BARSY SYNC LOG - Sync tracking
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_barsy_sync_log_location_type
ON barsy_sync_log(location_id, sync_type, created_at);


-- ============================================================================
-- UPDATE TABLE STATISTICS
-- This helps the query planner make better decisions
-- ============================================================================

ANALYZE chart_of_accounts;
ANALYZE barsy_category_account_mapping;
ANALYZE barsy_article_account_mapping;
ANALYZE barsy_articles;
ANALYZE barsy_orders;
ANALYZE barsy_locations;
ANALYZE bills;
ANALYZE bill_items;
ANALYZE labor_costs;
ANALYZE locations;
ANALYZE vendors;
ANALYZE employee_income_reports;
ANALYZE bill_payments;
ANALYZE bank_accounts;
ANALYZE bank_account_transfers;
ANALYZE barsy_store_loads;
ANALYZE barsy_store_load_items;
ANALYZE bill_payment_applications;
ANALYZE profiles;
ANALYZE recurring_bill_templates;
ANALYZE barsy_sync_log;


-- ============================================================================
-- INDEX COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_chart_of_accounts_active_code IS 'Optimizes P&L chart of accounts lookup';
COMMENT ON INDEX idx_barsy_orders_date_range_location IS 'Critical for P&L revenue date range queries';
COMMENT ON INDEX idx_barsy_orders_pl_lookup IS 'Covering index for P&L sales aggregation';
COMMENT ON INDEX idx_bills_doc_date_location_status IS 'Optimizes P&L expense queries';
COMMENT ON INDEX idx_bills_active_doc_date IS 'Partial index for non-voided bills (common case)';
COMMENT ON INDEX idx_labor_costs_period_location IS 'Optimizes P&L labor cost aggregation';
COMMENT ON INDEX idx_employee_income_location_date_status IS 'Optimizes cash flow and income reports';


-- ============================================================================
-- VERIFICATION: Show index sizes and usage (run separately to check)
-- ============================================================================
/*
-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check index usage stats
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS times_used,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
*/
