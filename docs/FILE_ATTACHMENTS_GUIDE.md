# File Attachments System Implementation Guide

## Overview
Universal file attachment system for bills (and any future entities like vendors). Files are organized by location in Supabase Storage and tracked in a PostgreSQL table.

## Features Implemented

### 1. Database Schema
- **Universal attachments table** with RLS policies
- Track files for any entity type (bills, vendors, etc.)
- Efficient indexing for fast queries
- Automatic timestamp management

### 2. Storage Organization
Files organized by location for better management:
```
documents/
  ├── {location_id}/
  │   ├── bill/
  │   │   ├── {bill_id}/
  │   │   │   ├── {timestamp}_{filename}
  │   │   │   └── ...
  │   └── vendor/
  │       └── {vendor_id}/
  │           └── ...
```

### 3. UI Components
- **Drag & Drop Upload** - Intuitive file upload with progress
- **File Preview** - View PDF and images directly in browser
- **File List** - Manage attached files with download/delete
- **Attachment Indicator** - Paperclip icon with count in bills table

### 4. Security
- Row Level Security (RLS) policies
- User can only access files for their locations
- Signed URLs (1-hour validity) for secure file access
- File size limit: 50MB

## Setup Instructions

### 1. Run Database Migration
```bash
# Connect to your Supabase database and run:
psql YOUR_DATABASE_URL -f migrations/attachments_system.sql
```

Or use Supabase CLI:
```bash
supabase db push migrations/attachments_system.sql
```

### 2. Configure Storage Bucket
The bucket "documents" should already exist. Configure RLS policies:

```sql
-- In Supabase Dashboard > Storage > documents > Policies

-- Policy: Users can upload files
CREATE POLICY "Users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM user_locations
  )
);

-- Policy: Users can read files for their locations
CREATE POLICY "Users can read files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM user_locations
  )
);

-- Policy: Users can delete their own uploaded files
CREATE POLICY "Users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM user_locations
  )
);
```

### 3. Install Dependencies
Already installed: `sonner` for toast notifications

## Usage Guide

### Attaching Files to Bills

1. Navigate to `/admin/bills`
2. Click on any bill to open details dialog
3. Switch to **"Files"** tab
4. **Upload Files:**
   - Drag & drop files onto the upload area, OR
   - Click to browse and select files
   - Supported: PDF, Images, Documents (Max 50MB)
   - Click "Upload File" button

5. **View Attached Files:**
   - Files listed with name, size, upload date
   - Click eye icon to preview (PDF/Images)
   - Click download icon to download
   - Click trash icon to delete

### File Preview
- **PDF Files:** Opens in embedded viewer
- **Images:** Shows full-size preview
- **Other Files:** Download to view

### Bills Table
Bills with attachments show:
- Paperclip icon (📎)
- Number of attached files

## Technical Details

### Server Actions
Located in `lib/actions/attachments.ts`:
- `uploadAttachment()` - Upload file and create record
- `getAttachments()` - Get all files for entity
- `getAttachmentUrl()` - Get signed URL for viewing
- `deleteAttachment()` - Delete file and record
- `getAttachmentCount()` - Get count for entity

### Components
- `file-upload.tsx` - Drag & drop upload component
- `attachments-list.tsx` - Display and manage files
- `file-preview-dialog.tsx` - Preview PDF/images
- `bill-items-dialog.tsx` - Updated with Files tab

### Database Structure
```sql
attachments (
  id UUID PRIMARY KEY,
  entity_type TEXT, -- 'bill', 'vendor', etc.
  entity_id UUID,   -- ID of related entity
  file_name TEXT,
  file_path TEXT,   -- Storage path
  file_type TEXT,   -- MIME type
  file_size BIGINT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ
)
```

## Extending to Other Entities

To add file attachments to vendors or other entities:

1. **No database changes needed** - System is universal

2. **Add to entity page:**
```tsx
import { FileUpload } from '@/components/admin/file-upload'
import { AttachmentsList } from '@/components/admin/attachments-list'

// In your dialog/page:
<FileUpload
  entityType="vendor"
  entityId={vendor.id.toString()}
  locationId={vendor.location_id}
  onUploadComplete={() => setRefresh(prev => prev + 1)}
/>

<AttachmentsList
  entityType="vendor"
  entityId={vendor.id.toString()}
  refreshTrigger={refresh}
/>
```

3. **Update RLS policies if needed** (optional):
```sql
-- Add vendor access logic to attachments RLS policy
```

## File Types Supported

### Fully Previewed
- PDF (`.pdf`)
- Images (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`)

### Upload Only (Download to View)
- Word Documents (`.doc`, `.docx`)
- Excel Spreadsheets (`.xls`, `.xlsx`)
- Other document types

## Performance Considerations

1. **Attachment counts** are fetched efficiently with bills
2. **Signed URLs** cached for 1 hour
3. **Indexed queries** for fast file lookups
4. **Lazy loading** - files loaded only when tab opened

## Security Best Practices

1. ✅ Files organized by location for isolation
2. ✅ RLS policies enforce access control
3. ✅ Signed URLs expire after 1 hour
4. ✅ File size limits prevent abuse
5. ✅ User ownership tracked for uploads

## Troubleshooting

### Files not uploading
- Check Supabase storage bucket exists
- Verify RLS policies are configured
- Check file size < 50MB
- Verify user has location access

### Files not displaying
- Check RLS policies on storage.objects
- Verify attachments table permissions
- Check browser console for errors

### Preview not working
- PDF preview requires browser support
- Images must be valid formats
- Check signed URL generation

## Next Steps

To extend this system:

1. Add file attachments to vendors:
   - Update vendor detail page/dialog
   - Add FileUpload and AttachmentsList components

2. Add file attachments to other entities:
   - Products
   - Locations
   - Suppliers

3. Additional features to consider:
   - Bulk file upload
   - File categories/tags
   - Image thumbnails
   - Version control
   - OCR for invoices

## Files Modified/Created

### New Files
- `/migrations/attachments_system.sql`
- `/lib/actions/attachments.ts`
- `/components/admin/file-upload.tsx`
- `/components/admin/attachments-list.tsx`
- `/components/admin/file-preview-dialog.tsx`

### Modified Files
- `/components/admin/bill-items-dialog.tsx` - Added Files tab
- `/components/admin/bills-table.tsx` - Added attachment indicator
- `/lib/actions/bills.ts` - Added attachment_count to bills
- `/app/layout.tsx` - Added Toaster for notifications
- `/package.json` - Added sonner dependency

