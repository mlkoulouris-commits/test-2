-- Migration: Barsy Cost and Payment Data Improvements
-- Date: 2024-12-12
-- Purpose: Add cost price columns and payment method tracking from Barsy API
-- This file documents the migrations applied via MCP

-- ============================================================================
-- PART 1: Schema Changes for Cost Data
-- ============================================================================

-- 1.1 Add cost columns to barsy_articles
ALTER TABLE barsy_articles
ADD COLUMN IF NOT EXISTS avg_delivery_price NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_price_last NUMERIC;

COMMENT ON COLUMN barsy_articles.avg_delivery_price IS 'Weighted average cost price (without VAT) - COGS';
COMMENT ON COLUMN barsy_articles.delivery_price_last IS 'Last purchase/delivery price (without VAT)';

-- 1.2 Add cost_price to transaction_line_items for margin analysis
ALTER TABLE transaction_line_items
ADD COLUMN IF NOT EXISTS cost_price NUMERIC;

COMMENT ON COLUMN transaction_line_items.cost_price IS 'Cost price at time of sale for margin calculation';

-- 1.3 Add indexes for cost-based queries
CREATE INDEX IF NOT EXISTS idx_barsy_articles_cost ON barsy_articles(barsy_article_id, avg_delivery_price) WHERE avg_delivery_price IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_line_items_cost ON transaction_line_items(cost_price) WHERE cost_price IS NOT NULL;

-- ============================================================================
-- PART 2: Schema Changes for Payment Method Tracking
-- ============================================================================

-- 2.1 Add payment method columns to barsy_accounts
ALTER TABLE barsy_accounts
ADD COLUMN IF NOT EXISTS paymethod_id INTEGER,
ADD COLUMN IF NOT EXISTS payment_method_name TEXT,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC;

COMMENT ON COLUMN barsy_accounts.paymethod_id IS 'Payment method ID from Barsy';
COMMENT ON COLUMN barsy_accounts.payment_method_name IS 'Payment method name (e.g., В брой, Карта)';
COMMENT ON COLUMN barsy_accounts.discount_percent IS 'Bill-level discount percentage';

CREATE INDEX IF NOT EXISTS idx_barsy_accounts_paymethod ON barsy_accounts(paymethod_id);

-- ============================================================================
-- PART 3: New Reference Tables
-- ============================================================================

-- 3.1 Payment methods reference table
CREATE TABLE IF NOT EXISTS barsy_payment_methods (
  id SERIAL PRIMARY KEY,
  barsy_location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  paymethod_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  is_cash BOOLEAN DEFAULT false,
  is_card BOOLEAN DEFAULT false,
  is_fiscal BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(barsy_location_id, paymethod_id)
);

COMMENT ON TABLE barsy_payment_methods IS 'Payment methods from Barsy (cash, card, invoice, etc.)';

-- 3.2 Tax groups reference table
CREATE TABLE IF NOT EXISTS barsy_tax_groups_ref (
  id SERIAL PRIMARY KEY,
  barsy_location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  tax_group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  tax_rate NUMERIC,
  is_default BOOLEAN DEFAULT false,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(barsy_location_id, tax_group_id)
);

COMMENT ON TABLE barsy_tax_groups_ref IS 'Tax groups/VAT rates from Barsy';

-- 3.3 Depots reference table (warehouses)
CREATE TABLE IF NOT EXISTS barsy_depots (
  id SERIAL PRIMARY KEY,
  barsy_location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  depot_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  barsy_id INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(barsy_location_id, depot_id)
);

COMMENT ON TABLE barsy_depots IS 'Warehouses/depots from Barsy';

-- 3.4 Places reference table (tables/areas)
CREATE TABLE IF NOT EXISTS barsy_places (
  id SERIAL PRIMARY KEY,
  barsy_location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  place_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  place_type INTEGER,
  place_type_name TEXT,
  salon_name TEXT,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(barsy_location_id, place_id)
);

COMMENT ON TABLE barsy_places IS 'Tables/areas/places from Barsy';

-- ============================================================================
-- PART 4: Store-out Details Improvements
-- ============================================================================

-- 4.1 Add unique constraint for store_out_details if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'barsy_store_out_details_location_storeout_article_unique'
  ) THEN
    ALTER TABLE barsy_store_out_details
    ADD CONSTRAINT barsy_store_out_details_location_storeout_article_unique
    UNIQUE (location_id, barsy_store_out_id, barsy_article_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 4.2 Add index for efficient cost lookups
CREATE INDEX IF NOT EXISTS idx_barsy_store_out_details_costs
ON barsy_store_out_details(location_id, store_out_date, avg_delivery_price)
WHERE avg_delivery_price IS NOT NULL;

-- ============================================================================
-- PART 5: Data Backfill from raw_data columns
-- ============================================================================

-- 5.1 Backfill barsy_articles with cost prices from raw_data
UPDATE barsy_articles
SET
  avg_delivery_price = (raw_data->>'avg_delivery_price')::numeric,
  delivery_price_last = (raw_data->>'delivery_price')::numeric
WHERE raw_data IS NOT NULL
  AND (raw_data->>'avg_delivery_price' IS NOT NULL OR raw_data->>'delivery_price' IS NOT NULL);

-- 5.2 Backfill barsy_accounts with payment method from raw_data
UPDATE barsy_accounts
SET
  paymethod_id = (raw_data->>'paymethod_id')::integer,
  payment_method_name = raw_data->>'payment_name',
  discount_percent = (raw_data->>'discount')::numeric
WHERE raw_data IS NOT NULL;

-- 5.3 Backfill transaction_line_items with cost_price from barsy_articles
UPDATE transaction_line_items tli
SET cost_price = ba.avg_delivery_price
FROM barsy_articles ba
WHERE tli.barsy_article_id = ba.barsy_article_id
  AND tli.cost_price IS NULL
  AND ba.avg_delivery_price IS NOT NULL;
