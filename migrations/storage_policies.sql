-- ============================================================================
-- MIGRATION: Storage Bucket Policies for Documents
-- ============================================================================
-- Create RLS policies for the 'documents' storage bucket
-- Allows authenticated users to upload, read, and delete files
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload files to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can update files in documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from documents bucket" ON storage.objects;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Users can upload files to documents bucket"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Policy: Allow authenticated users to read files
CREATE POLICY "Users can read files from documents bucket"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Policy: Allow authenticated users to update files
CREATE POLICY "Users can update files in documents bucket"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete files from documents bucket"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid() IS NOT NULL
);

