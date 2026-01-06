-- ============================================================================
-- Add VAT fields for Barsy bills + store loads
-- ============================================================================
-- Goal:
-- - Persist VAT breakdown (rate + amount) for approved bills (`bills` / `bill_items`)
-- - Persist computed VAT + net/gross totals for staged Barsy store loads
--   (`barsy_store_loads` / `barsy_store_load_items`)
--
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================================

-- Bills (operational)
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS has_vat BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2);

ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2);

-- Barsy staging (store loads)
ALTER TABLE barsy_store_loads
  ADD COLUMN IF NOT EXISTS has_vat BOOLEAN,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_sum_net NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_sum_gross NUMERIC(12,2);

ALTER TABLE barsy_store_load_items
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2);
