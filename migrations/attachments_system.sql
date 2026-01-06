-- ============================================================================
-- MIGRATION: Attachments System
-- ============================================================================
-- Universal file attachment system for bills and other entities
-- Files are organized by location in Supabase Storage
-- ============================================================================

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bill', 'vendor', 'product', 'location')),
  entity_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at DESC);

-- Enable Row Level Security
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view attachments for their locations
CREATE POLICY "Users can view attachments for their locations"
ON attachments
FOR SELECT
TO authenticated
USING (
  -- Allow access if user has access to any location
  EXISTS (
    SELECT 1 FROM user_locations
    WHERE user_locations.user_id = auth.uid()
  )
);

-- RLS Policy: Users can insert attachments for their locations
CREATE POLICY "Users can insert attachments"
ON attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM user_locations
    WHERE user_locations.user_id = auth.uid()
  )
);

-- RLS Policy: Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON attachments
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
);

-- Add comments
COMMENT ON TABLE attachments IS 'Universal file attachment system for bills, vendors, and other entities';
COMMENT ON COLUMN attachments.entity_type IS 'Type of entity: bill, vendor, product, location';
COMMENT ON COLUMN attachments.entity_id IS 'ID of the related entity (stored as text for flexibility)';
COMMENT ON COLUMN attachments.file_path IS 'Path in Supabase Storage bucket';
COMMENT ON COLUMN attachments.file_type IS 'MIME type of the file';
COMMENT ON COLUMN attachments.file_size IS 'File size in bytes';

