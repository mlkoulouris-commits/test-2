-- ============================================================================
-- Add Uncategorized Revenue and COGS Accounts
-- ============================================================================
-- This migration adds accounts for uncategorized articles/products:
-- - Revenue: 1800 (Other) -> 1801 (Uncategorized Sales)
-- - COGS: 2800 (Other) -> 2802 (Uncategorized COGS)
-- ============================================================================

-- Add "Other" revenue category (Level 2)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1800', 'Other Revenue', 'Други приходи', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1000'), 2, 8, true)
ON CONFLICT (code) DO NOTHING;

-- Add "Uncategorized Sales" revenue account (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('1801', 'Uncategorized Sales', 'Некласифицирани продажби', 'revenue',
  (SELECT id FROM chart_of_accounts WHERE code = '1800'), 3, 1, true)
ON CONFLICT (code) DO NOTHING;

-- Add "Other" COGS category (Level 2) if it doesn't exist
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2800', 'Other COGS', 'Други разходи за стоки', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2000'), 2, 8, true)
ON CONFLICT (code) DO NOTHING;

-- Add "Uncategorized COGS" account (Level 3)
INSERT INTO chart_of_accounts (code, name, name_bg, account_type, parent_id, level, sort_order, is_active)
VALUES ('2802', 'Uncategorized COGS', 'Некласифицирана себестойност', 'cogs',
  (SELECT id FROM chart_of_accounts WHERE code = '2800'), 3, 2, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Map Uncategorized Barsy Categories to Uncategorized Accounts
-- ============================================================================
-- Map barsy_cat_id = -1 (Некатегоризирани) to uncategorized accounts for all locations

INSERT INTO barsy_category_account_mapping (barsy_location_id, barsy_category_id, revenue_account_id, cogs_account_id, created_at, updated_at)
SELECT
  bl.id AS barsy_location_id,
  -1 AS barsy_category_id,
  (SELECT id FROM chart_of_accounts WHERE code = '1801') AS revenue_account_id,
  (SELECT id FROM chart_of_accounts WHERE code = '2802') AS cogs_account_id,
  NOW() AS created_at,
  NOW() AS updated_at
FROM barsy_locations bl
WHERE bl.is_active = true
ON CONFLICT (barsy_location_id, barsy_category_id) DO UPDATE SET
  revenue_account_id = EXCLUDED.revenue_account_id,
  cogs_account_id = EXCLUDED.cogs_account_id,
  updated_at = NOW();
