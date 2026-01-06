-- ============================================================================
-- UPDATE BILL PAYMENTS CREATED_BY TO USE NAMES
-- Updates any email addresses in created_by fields to use full names from profiles
-- ============================================================================

-- Update bill_payments.created_by from email to name
UPDATE bill_payments
SET created_by = CONCAT(p.first_name, ' ', p.last_name)
FROM profiles p
INNER JOIN auth.users u ON p.user_id = u.id
WHERE bill_payments.created_by = u.email
  AND p.first_name IS NOT NULL 
  AND p.last_name IS NOT NULL
  AND TRIM(p.first_name) != ''
  AND TRIM(p.last_name) != '';

-- Update bills.created_by from email to name
UPDATE bills
SET created_by = CONCAT(p.first_name, ' ', p.last_name)
FROM profiles p
INNER JOIN auth.users u ON p.user_id = u.id
WHERE bills.created_by = u.email
  AND p.first_name IS NOT NULL 
  AND p.last_name IS NOT NULL
  AND TRIM(p.first_name) != ''
  AND TRIM(p.last_name) != '';

-- Update bills.approved_by from email to name (in case any were missed)
UPDATE bills
SET approved_by = CONCAT(p.first_name, ' ', p.last_name)
FROM profiles p
INNER JOIN auth.users u ON p.user_id = u.id
WHERE bills.approved_by = u.email
  AND p.first_name IS NOT NULL 
  AND p.last_name IS NOT NULL
  AND TRIM(p.first_name) != ''
  AND TRIM(p.last_name) != '';

-- Verification queries (commented out - uncomment to check)
-- SELECT created_by, COUNT(*) as count 
-- FROM bill_payments 
-- WHERE created_by LIKE '%@%' 
-- GROUP BY created_by;

-- SELECT created_by, COUNT(*) as count 
-- FROM bills 
-- WHERE created_by LIKE '%@%' 
-- GROUP BY created_by;

