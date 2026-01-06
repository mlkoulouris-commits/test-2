-- Create cash accounts for all locations that don't have one
-- Run this after adding the account_type column

INSERT INTO bank_accounts (location_id, account_name, account_type, is_active, is_default, current_balance, currency)
SELECT 
  bl.id,
  bl.name || ' - Cash',
  'cash',
  true,
  false,
  0,
  'BGN'
FROM barsy_locations bl
WHERE bl.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM bank_accounts ba 
    WHERE ba.location_id = bl.id 
    AND ba.account_type = 'cash'
  );

-- Report what was created
SELECT 
  'Created cash accounts for ' || COUNT(*) || ' locations' as status
FROM barsy_locations bl
WHERE bl.is_active = true
  AND EXISTS (
    SELECT 1 
    FROM bank_accounts ba 
    WHERE ba.location_id = bl.id 
    AND ba.account_type = 'cash'
  );

