-- Extended Barsy Integration Schema
-- Run this in Supabase SQL Editor after the initial barsy schema

-- ============================================================================
-- ARTICLES (Products/Menu Items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT NOT NULL,
  article_name_public TEXT,
  barcode TEXT,
  price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  category_id INTEGER,
  amount_type_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_for_sale BOOLEAN DEFAULT true,
  is_semifinished BOOLEAN DEFAULT false,
  sort_order INTEGER,
  description TEXT,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_article_id)
);

CREATE INDEX idx_barsy_articles_location ON barsy_articles(location_id);
CREATE INDEX idx_barsy_articles_category ON barsy_articles(category_id);
CREATE INDEX idx_barsy_articles_active ON barsy_articles(is_active, is_for_sale);
CREATE INDEX idx_barsy_articles_barcode ON barsy_articles(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_barsy_articles_synced ON barsy_articles(synced_at);

-- ============================================================================
-- CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_category_id INTEGER NOT NULL,
  category_name TEXT NOT NULL,
  parent_id INTEGER,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  color TEXT,
  icon TEXT,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_category_id)
);

CREATE INDEX idx_barsy_categories_location ON barsy_categories(location_id);
CREATE INDEX idx_barsy_categories_parent ON barsy_categories(parent_id);
CREATE INDEX idx_barsy_categories_active ON barsy_categories(is_active, is_visible);
CREATE INDEX idx_barsy_categories_synced ON barsy_categories(synced_at);

-- ============================================================================
-- STAFF/USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role_id INTEGER,
  role_name TEXT,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_user_id)
);

CREATE INDEX idx_barsy_staff_location ON barsy_staff(location_id);
CREATE INDEX idx_barsy_staff_active ON barsy_staff(is_active);
CREATE INDEX idx_barsy_staff_username ON barsy_staff(username);
CREATE INDEX idx_barsy_staff_synced ON barsy_staff(synced_at);

-- ============================================================================
-- CLIENTS/CUSTOMERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_client_id INTEGER NOT NULL,
  client_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  points NUMERIC(10,2) DEFAULT 0,
  discount_percent NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_client_id)
);

CREATE INDEX idx_barsy_clients_location ON barsy_clients(location_id);
CREATE INDEX idx_barsy_clients_phone ON barsy_clients(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_barsy_clients_email ON barsy_clients(email) WHERE email IS NOT NULL;
CREATE INDEX idx_barsy_clients_active ON barsy_clients(is_active);
CREATE INDEX idx_barsy_clients_synced ON barsy_clients(synced_at);

-- ============================================================================
-- ACCOUNTS (Bills/Tabs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_account_id INTEGER NOT NULL,
  account_number TEXT,
  open_date TIMESTAMPTZ,
  close_date TIMESTAMPTZ,
  status TEXT,
  total_amount NUMERIC(10,2),
  paid_amount NUMERIC(10,2),
  client_id INTEGER,
  place_id INTEGER,
  user_id INTEGER,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_account_id)
);

CREATE INDEX idx_barsy_accounts_location ON barsy_accounts(location_id);
CREATE INDEX idx_barsy_accounts_dates ON barsy_accounts(open_date, close_date);
CREATE INDEX idx_barsy_accounts_status ON barsy_accounts(status);
CREATE INDEX idx_barsy_accounts_client ON barsy_accounts(client_id);
CREATE INDEX idx_barsy_accounts_synced ON barsy_accounts(synced_at);

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_payment_id INTEGER NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method_id INTEGER,
  payment_method_name TEXT,
  account_id INTEGER,
  client_id INTEGER,
  user_id INTEGER,
  notes TEXT,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_payment_id)
);

CREATE INDEX idx_barsy_payments_location ON barsy_payments(location_id);
CREATE INDEX idx_barsy_payments_date ON barsy_payments(payment_date);
CREATE INDEX idx_barsy_payments_account ON barsy_payments(account_id);
CREATE INDEX idx_barsy_payments_method ON barsy_payments(payment_method_id);
CREATE INDEX idx_barsy_payments_synced ON barsy_payments(synced_at);

-- ============================================================================
-- Update sync log to track all types
-- ============================================================================
ALTER TABLE barsy_sync_log 
  DROP CONSTRAINT IF EXISTS barsy_sync_log_sync_type_check;

ALTER TABLE barsy_sync_log
  ADD CONSTRAINT barsy_sync_log_sync_type_check 
  CHECK (sync_type IN ('orders', 'articles', 'categories', 'users', 'clients', 'accounts', 'payments', 'reports'));

-- ============================================================================
-- RLS Policies (if needed)
-- ============================================================================
ALTER TABLE barsy_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE barsy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE barsy_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE barsy_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE barsy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE barsy_payments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on barsy_articles" ON barsy_articles FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on barsy_categories" ON barsy_categories FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on barsy_staff" ON barsy_staff FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on barsy_clients" ON barsy_clients FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on barsy_accounts" ON barsy_accounts FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on barsy_payments" ON barsy_payments FOR ALL TO service_role USING (true);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Get article count by location
CREATE OR REPLACE FUNCTION get_barsy_article_count(loc_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM barsy_articles WHERE location_id = loc_id;
$$ LANGUAGE SQL;

-- Get category count by location
CREATE OR REPLACE FUNCTION get_barsy_category_count(loc_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM barsy_categories WHERE location_id = loc_id;
$$ LANGUAGE SQL;

-- Get staff count by location
CREATE OR REPLACE FUNCTION get_barsy_staff_count(loc_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM barsy_staff WHERE location_id = loc_id;
$$ LANGUAGE SQL;

-- Get sync status for all types
CREATE OR REPLACE FUNCTION get_barsy_sync_status(loc_id UUID)
RETURNS TABLE (
  sync_type TEXT,
  last_sync TIMESTAMPTZ,
  record_count INTEGER,
  success BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH sync_summary AS (
    SELECT 
      sl.sync_type,
      sl.synced_at as last_sync,
      sl.records_synced as record_count,
      sl.success
    FROM barsy_sync_log sl
    WHERE sl.location_id = loc_id
      AND sl.synced_at = (
        SELECT MAX(synced_at) 
        FROM barsy_sync_log 
        WHERE location_id = loc_id AND sync_type = sl.sync_type
      )
  )
  SELECT * FROM sync_summary ORDER BY sync_type;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE barsy_articles IS 'Products and menu items from Barsy';
COMMENT ON TABLE barsy_categories IS 'Product categories from Barsy';
COMMENT ON TABLE barsy_staff IS 'Staff/users from Barsy';
COMMENT ON TABLE barsy_clients IS 'Customers from Barsy';
COMMENT ON TABLE barsy_accounts IS 'Bills/tabs from Barsy';
COMMENT ON TABLE barsy_payments IS 'Payment transactions from Barsy';

