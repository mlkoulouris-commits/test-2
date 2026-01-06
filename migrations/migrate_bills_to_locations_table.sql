-- Migration: Migrate bills from barsy_locations to locations table
-- This standardizes all location references to use the integer-based locations table

BEGIN;

-- Step 1: Add new column for integer location_id
ALTER TABLE bills 
ADD COLUMN IF NOT EXISTS location_id_new INTEGER;

-- Step 2: Migrate data by mapping barsy_locations UUID to locations INTEGER
UPDATE bills b
SET location_id_new = l.id
FROM barsy_locations bl
INNER JOIN locations l ON bl.name = l.name
WHERE b.location_id = bl.id;

-- Step 3: Verify all bills were mapped
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bills WHERE location_id_new IS NULL) THEN
    RAISE EXCEPTION 'Some bills could not be mapped to locations table. Migration aborted.';
  END IF;
END $$;

-- Step 4: Drop old foreign key constraint
ALTER TABLE bills 
DROP CONSTRAINT IF EXISTS bills_location_id_fkey;

-- Step 5: Rename columns
ALTER TABLE bills 
DROP COLUMN location_id;

ALTER TABLE bills 
RENAME COLUMN location_id_new TO location_id;

-- Step 6: Make new location_id NOT NULL
ALTER TABLE bills 
ALTER COLUMN location_id SET NOT NULL;

-- Step 7: Add new foreign key constraint to locations table
ALTER TABLE bills 
ADD CONSTRAINT bills_location_id_fkey 
FOREIGN KEY (location_id) 
REFERENCES locations(id) 
ON DELETE CASCADE;

-- Step 8: Create index for performance
CREATE INDEX IF NOT EXISTS idx_bills_location_id ON bills(location_id);

COMMIT;

