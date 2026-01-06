-- Performance Indexes for Memento
-- Run this to optimize common query patterns

-- ============================================
-- BARSY ACCOUNTS - Heavy usage in sales reports
-- ============================================

-- Composite index for date range + amount queries (zero transaction reports)
CREATE INDEX IF NOT EXISTS idx_barsy_accounts_date_amount 
ON barsy_accounts(close_date, total_amount) 
WHERE close_date IS NOT NULL;

-- Composite index for location + date queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_barsy_accounts_location_close_date 
ON barsy_accounts(location_id, close_date DESC) 
WHERE close_date IS NOT NULL;

-- Index for finding zero-amount transactions
CREATE INDEX IF NOT EXISTS idx_barsy_accounts_zero_amount 
ON barsy_accounts(location_id, close_date) 
WHERE total_amount = 0 AND close_date IS NOT NULL;

-- ============================================
-- BARSY ORDERS - Frequent JSONB queries
-- ============================================

-- JSONB index for account_id lookups (used in transaction grouping)
CREATE INDEX IF NOT EXISTS idx_barsy_orders_account_id 
ON barsy_orders((raw_data->>'account_id'));

-- Composite for location + date range queries
CREATE INDEX IF NOT EXISTS idx_barsy_orders_location_date_desc 
ON barsy_orders(location_id, order_date DESC);

-- ============================================
-- PROFILES - User management queries
-- ============================================

-- For user listings and active user filters
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_active_created 
ON profiles(is_active, created_at DESC);

-- ============================================
-- SCHEDULED SHIFTS - Schedule views
-- ============================================

-- Most common: location + date range
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_location_date 
ON scheduled_shifts(location_id, business_date);

-- For user schedule lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_user_date 
ON scheduled_shifts(user_id, business_date);

-- For skill-based scheduling
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_skill 
ON scheduled_shifts(skill_required) 
WHERE skill_required IS NOT NULL;

-- Composite for location + date + skill queries
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_location_date_skill 
ON scheduled_shifts(location_id, business_date, skill_required);

-- ============================================
-- ACTUAL SHIFTS - Clock in/out tracking
-- ============================================

-- Find currently clocked-in users
CREATE INDEX IF NOT EXISTS idx_actual_shifts_clock_out_null 
ON actual_shifts(user_id, location_id) 
WHERE clock_out IS NULL;

-- User shift history
CREATE INDEX IF NOT EXISTS idx_actual_shifts_user_location_date 
ON actual_shifts(user_id, location_id, clock_in DESC);

-- Location shift tracking
CREATE INDEX IF NOT EXISTS idx_actual_shifts_location_clock_in 
ON actual_shifts(location_id, clock_in DESC);

-- ============================================
-- USER LOCATIONS - Access control
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_locations_user 
ON user_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_locations_location 
ON user_locations(location_id);

-- ============================================
-- USER SKILLS - Skills management
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_skills_user 
ON user_skills(user_id);

CREATE INDEX IF NOT EXISTS idx_user_skills_skill 
ON user_skills(skill_id);

-- ============================================
-- BARSY PAYMENTS - Financial reports
-- ============================================

-- Already has idx_barsy_payments_date but add composite
CREATE INDEX IF NOT EXISTS idx_barsy_payments_location_date_desc 
ON barsy_payments(location_id, payment_date DESC);

-- ============================================
-- Comments
-- ============================================

COMMENT ON INDEX idx_barsy_accounts_date_amount IS 'Optimizes zero-amount transaction queries';
COMMENT ON INDEX idx_barsy_accounts_location_close_date IS 'Optimizes sales report date range queries';
COMMENT ON INDEX idx_barsy_orders_account_id IS 'Optimizes transaction grouping by account_id';
COMMENT ON INDEX idx_scheduled_shifts_location_date IS 'Optimizes schedule calendar views';
COMMENT ON INDEX idx_actual_shifts_clock_out_null IS 'Optimizes finding currently clocked-in users';

