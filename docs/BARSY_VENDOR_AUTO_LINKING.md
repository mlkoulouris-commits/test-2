# Barsy Bills Vendor Auto-Linking

## Overview
When syncing bills from Barsy, the system now automatically links them to vendors if a supplier-vendor mapping already exists.

## How It Works

### 1. Vendor Mapping Table
The `barsy_suppliers` table stores the mapping between Barsy suppliers and your vendor masters:

```sql
barsy_suppliers (
  supplier_id INT,
  barsy_location_id,
  vendor_id INT REFERENCES vendors(id)
)
```

### 2. Auto-Linking During Sync
When bills are synced from Barsy (`lib/actions/barsy-storeloads-sync.ts`):

1. **Pre-fetch vendor mappings** - Batch lookup of all supplier-vendor relationships for the location
2. **Set vendor_id** - Automatically populate `vendor_id` in `barsy_store_loads` if mapping exists
3. **Ready for approval** - Bills with vendor links appear ready to approve

### 3. Performance Optimization
- Single batch query fetches all vendor mappings upfront
- Map stored in memory for instant lookups
- No N+1 query problem
- Logs show how many mappings were found

### 4. Approval Flow

**With Auto-Linking:**
```
Sync from Barsy → vendor_id set automatically → Review & Approve → Creates bill
```

**Without Vendor Link:**
```
Sync from Barsy → No vendor_id → Shows "No Vendor Linked" badge → Manual linking required
```

## Benefits

### ✅ Automatic Processing
- Bills from known suppliers are ready to approve immediately
- No manual vendor selection needed
- Faster approval workflow

### ✅ Consistency
- Same supplier always links to same vendor
- Reduces human error
- Maintains data integrity

### ✅ Performance
- Batch fetching of vendor mappings
- Single query per sync operation
- Efficient for large bill volumes

## Setting Up Vendor Mappings

### Method 1: Use Link Suppliers Dialog
In `/admin/barsy-sync`:
1. View barsy suppliers list
2. Click "Link Suppliers" button
3. Select vendor for each supplier
4. Save mappings

### Method 2: Run Vendor Consolidation Scripts
For bulk setup, run migration scripts in order:

```bash
# 1. Create vendor master records
psql -f migrations/vendor_consolidation/02_create_vendor_masters.sql

# 2. Link suppliers to vendors
psql -f migrations/vendor_consolidation/03_link_suppliers.sql

# 3. Backfill existing bills
psql -f migrations/vendor_consolidation/04_backfill_store_loads.sql
```

### Method 3: Manual Database Insert
```sql
-- Link a supplier to a vendor
UPDATE barsy_suppliers 
SET vendor_id = 123, updated_at = NOW()
WHERE supplier_id = 456 
  AND barsy_location_id = 'location-uuid';
```

## Monitoring

### Check Vendor Mappings
```sql
-- See all supplier-vendor mappings
SELECT 
  bs.supplier_id,
  bs.supplier_name,
  v.id as vendor_id,
  v.name as vendor_name,
  bl.name as location_name
FROM barsy_suppliers bs
JOIN vendors v ON bs.vendor_id = v.id
JOIN barsy_locations bl ON bs.barsy_location_id = bl.id
ORDER BY bs.supplier_name;
```

### Check Auto-Linked Bills
```sql
-- See store loads with auto-linked vendors
SELECT 
  sl.doc_num,
  sl.supplier_name,
  v.name as vendor_name,
  sl.total_sum,
  sl.doc_date
FROM barsy_store_loads sl
JOIN vendors v ON sl.vendor_id = v.id
WHERE sl.created_at > NOW() - INTERVAL '7 days'
ORDER BY sl.doc_date DESC;
```

### Find Unmapped Suppliers
```sql
-- Suppliers without vendor mapping
SELECT DISTINCT
  supplier_id,
  supplier_name,
  COUNT(*) as bill_count
FROM barsy_store_loads
WHERE vendor_id IS NULL
  AND supplier_id IS NOT NULL
GROUP BY supplier_id, supplier_name
ORDER BY bill_count DESC;
```

## Console Output

During sync, you'll see:
```
Fetched 25 store loads
Found 18 vendor mappings for 20 unique suppliers
Synced 25 store loads with 150 line items
```

This tells you:
- 25 bills fetched from Barsy
- 18 of 20 suppliers have vendor mappings
- 2 suppliers need manual linking

## Fallback Behavior

If no vendor mapping exists during sync:
1. `vendor_id` remains NULL in `barsy_store_loads`
2. Bill appears in Barsy Bills Approval page
3. Shows "No Vendor Linked" badge
4. Approval process tries name matching as fallback
5. If still no match, approval blocked until manual link

## Edge Cases

### New Supplier
**First bill from new supplier:**
- No mapping exists yet
- Must link supplier to vendor before approval
- Future bills will auto-link

### Multiple Locations
**Same supplier across locations:**
- Each location has separate mapping
- Supplier ID 123 at Location A → Vendor X
- Supplier ID 123 at Location B → Vendor Y (different contract terms)

### Supplier Changes Vendor
**If supplier switches to different vendor:**
```sql
-- Update the mapping
UPDATE barsy_suppliers 
SET vendor_id = new_vendor_id, updated_at = NOW()
WHERE supplier_id = xxx AND barsy_location_id = 'yyy';

-- Future syncs will use new vendor
-- Past bills keep original vendor
```

## Related Files

**Sync Logic:**
- `/lib/actions/barsy-storeloads-sync.ts` - Auto-linking implementation

**Approval Logic:**
- `/lib/actions/barsy-bills-approval.ts` - Uses vendor_id from store load

**UI Components:**
- `/components/admin/barsy-bills-table.tsx` - Shows vendor status
- `/components/admin/link-suppliers-dialog.tsx` - Manual linking interface

**Database Schema:**
- `barsy_suppliers` - Supplier-vendor mappings
- `barsy_store_loads` - Bills with vendor_id
- `vendors` - Master vendor records

**Migrations:**
- `/migrations/vendor_consolidation/` - Setup scripts
- `/migrations/add_vendor_fk_to_bills.sql` - Adds vendor_id column

## Testing

After setup, test the auto-linking:

1. **Verify mapping exists:**
   ```sql
   SELECT * FROM barsy_suppliers 
   WHERE supplier_id = XXX AND vendor_id IS NOT NULL;
   ```

2. **Sync bills:**
   - Go to `/admin/barsy-sync`
   - Click "Sync Barsy Bills"
   - Check console output

3. **Verify auto-link:**
   ```sql
   SELECT doc_num, supplier_name, vendor_id 
   FROM barsy_store_loads 
   WHERE created_at > NOW() - INTERVAL '5 minutes';
   ```

4. **Approve bill:**
   - Go to `/admin/barsy-bills`
   - Bill should show vendor name
   - Click to approve
   - Should succeed without vendor error

## Troubleshooting

### Bills Not Auto-Linking

**Check 1: Mapping exists?**
```sql
SELECT * FROM barsy_suppliers 
WHERE supplier_id = XXX 
  AND barsy_location_id = 'YYY';
```

**Check 2: vendor_id populated?**
```sql
SELECT vendor_id FROM barsy_suppliers 
WHERE supplier_id = XXX 
  AND barsy_location_id = 'YYY';
```

**Check 3: Supplier ID matches?**
- Barsy API returns supplier_id
- Must match exactly in barsy_suppliers table

### Performance Issues

If sync is slow:
- Check if batch query is running (look for log message)
- Verify index exists: `idx_barsy_suppliers_lookup`
- Check number of unique suppliers per sync

```sql
-- Add index if missing
CREATE INDEX IF NOT EXISTS idx_barsy_suppliers_lookup 
ON barsy_suppliers(barsy_location_id, supplier_id, vendor_id);
```

## Future Enhancements

Potential improvements:
- [ ] Auto-create vendors for new suppliers
- [ ] Machine learning for supplier name matching
- [ ] Bulk re-linking interface for historical bills
- [ ] Vendor confidence scoring
- [ ] Alert when unmapped suppliers appear



