-- Migration: Fix barsy_accounts created_at to match close_date
-- This updates all existing records where created_at doesn't match the actual transaction date

-- Update created_at to match close_date for all records where close_date exists
UPDATE barsy_accounts
SET created_at = close_date
WHERE close_date IS NOT NULL
  AND created_at != close_date;

-- Verify the update (comment this out for production)
-- SELECT
--   location_id,
--   COUNT(*) as total_records,
--   MAX(created_at) as latest_created_at,
--   MAX(close_date) as latest_close_date
-- FROM barsy_accounts
-- GROUP BY location_id;

