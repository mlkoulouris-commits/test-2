-- ============================================================================
-- MIGRATION: Disable RLS for Attachments and Storage
-- ============================================================================
-- Since we use Supabase only via server-side API with service role key,
-- RLS is not needed and can cause issues
-- ============================================================================

-- Disable RLS on attachments table
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies on attachments
DROP POLICY IF EXISTS "Users can view attachments for their locations" ON attachments;
DROP POLICY IF EXISTS "Users can insert attachments" ON attachments;
DROP POLICY IF EXISTS "Users can delete own attachments" ON attachments;

-- Drop all storage policies
DROP POLICY IF EXISTS "Users can upload files to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can update files in documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from documents bucket" ON storage.objects;

-- Disable RLS on storage.objects (if enabled)
-- Note: This affects the entire storage.objects table, not just documents bucket
-- If you have other buckets with RLS, this will affect them too

