-- Add vendor_id foreign key to barsy_store_loads if not exists
-- This links bills to the vendors table

DO $$ 
BEGIN
    -- Check if vendor_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'barsy_store_loads' 
        AND column_name = 'vendor_id'
    ) THEN
        ALTER TABLE barsy_store_loads ADD COLUMN vendor_id INT;
    END IF;

    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'barsy_store_loads_vendor_id_fkey'
        AND table_name = 'barsy_store_loads'
    ) THEN
        ALTER TABLE barsy_store_loads 
        ADD CONSTRAINT barsy_store_loads_vendor_id_fkey 
        FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
    END IF;

    -- Create index if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_barsy_store_loads_vendor'
    ) THEN
        CREATE INDEX idx_barsy_store_loads_vendor ON barsy_store_loads(vendor_id);
    END IF;
END $$;

