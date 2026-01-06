# Vendor Consolidation - Execution Guide

## Quick Start

This guide walks you through executing the vendor master consolidation migration safely.

## Prerequisites

- Database access with write permissions
- Backup of database (recommended)
- 30-60 minutes for execution and review

## Step-by-Step Execution

### Step 0: Generate Preview Report (REQUIRED)

```bash
cd /Users/apple/Dev/memento/migrations/vendor_consolidation

# Generate analysis report
psql -d your_database -f analysis_report.sql > preview_report.txt

# Review the report
cat preview_report.txt
```

**IMPORTANT:** Review the preview report carefully before proceeding!

### Step 1: Run Analysis (Dry Run)

```bash
# This shows what will be consolidated without making changes
psql -d your_database -f 01_analyze_duplicates.sql > analysis_output.txt

# Review the output
less analysis_output.txt
```

**Check for:**
- Unexpected groupings
- Suppliers that shouldn't be merged
- Missing suppliers
- Data quality issues

### Step 2: Create Vendor Masters

```bash
# This creates the vendor master records
psql -d your_database -f 02_create_vendor_masters.sql

# Expected output: Number of vendors created
```

**What happens:**
- Adds columns to `vendors` table (bulstat, alternative_names, merge_notes)
- Creates vendor masters from bulstat groups
- Creates vendor masters from name groups
- Creates vendor masters for remaining unlinked suppliers

### Step 3: Link Suppliers to Vendors

```bash
# This links barsy_suppliers to vendor masters
psql -d your_database -f 03_link_suppliers.sql

# Expected output: Number of suppliers linked
```

**What happens:**
- Links by bulstat (exact match)
- Links by normalized name
- Links by supplier_id pattern
- Creates vendors for any remaining unlinked suppliers

### Step 4: Backfill Historical Data

```bash
# This updates purchase orders with vendor_id
psql -d your_database -f 04_backfill_store_loads.sql

# Expected output: Number of records updated
```

**What happens:**
- Adds `vendor_id` column to `barsy_store_loads`
- Backfills vendor_id from barsy_suppliers
- Handles orphaned suppliers
- Updates `barsy_store_load_items` with vendor_id

### Step 5: Validate Results

```bash
# This runs comprehensive validation checks
psql -d your_database -f 05_validation.sql

# Review all validation results
```

**Validation checks:**
1. All suppliers linked
2. No orphaned references
3. Store loads backfilled
4. Store load items backfilled
5. Vendor data quality
6. Consolidation effectiveness
7. Bulstat matching accuracy
8. Historical data integrity
9. Top vendors by activity
10. Alternative names validation

**Expected results:**
- 100% or near 100% supplier linking
- No orphaned references
- High backfill percentage for store loads
- Consolidation ratio > 1.5:1

### Step 6: Monitor (24-48 hours)

After successful validation:

1. **Test in application:**
   - Verify vendor reports work
   - Check purchase order displays
   - Test vendor selection dropdowns

2. **Monitor for issues:**
   - Incorrect groupings
   - Missing vendors
   - Broken relationships

3. **Keep rollback ready:**
   - Don't delete rollback script
   - Can undo if major issues found

## Rollback (If Needed)

```bash
# ONLY if serious issues found
psql -d your_database -f 06_rollback.sql

# You will be prompted to confirm
# Type YES to proceed with rollback
```

**Rollback will:**
- Clear all vendor_id links
- Delete auto-created vendors
- Remove added columns
- Create backup tables for recovery

## Common Issues & Solutions

### Issue: Some suppliers not linking

**Solution:**
- Check if they have unusual characters in names
- Verify bulstat format is correct
- May need manual linking via SQL

### Issue: Wrong suppliers grouped together

**Solution:**
- If caught before validation: Adjust grouping logic
- If caught after: Manually split vendors in database

### Issue: Store loads not backfilling

**Solution:**
- Check if supplier_id matches between tables
- Verify barsy_location_id is consistent
- May need manual mapping for orphaned suppliers

## Manual Adjustments

### Split a vendor that was incorrectly merged:

```sql
-- Create new vendor
INSERT INTO vendors (name, bulstat, ...)
VALUES ('Correct Name', '123456', ...);

-- Relink specific suppliers
UPDATE barsy_suppliers
SET vendor_id = [new_vendor_id]
WHERE id IN (supplier_ids_to_move);

-- Update store loads
UPDATE barsy_store_loads sl
SET vendor_id = [new_vendor_id]
FROM barsy_suppliers bs
WHERE sl.supplier_id = bs.supplier_id
  AND bs.vendor_id = [new_vendor_id];
```

### Merge two vendors that should be one:

```sql
-- Update all references to use target vendor
UPDATE barsy_suppliers
SET vendor_id = [target_vendor_id]
WHERE vendor_id = [source_vendor_id];

UPDATE barsy_store_loads
SET vendor_id = [target_vendor_id]
WHERE vendor_id = [source_vendor_id];

-- Delete source vendor
DELETE FROM vendors WHERE id = [source_vendor_id];
```

## Post-Migration Cleanup

After 48 hours with no issues:

```sql
-- Drop backup tables created by rollback script
DROP TABLE IF EXISTS vendors_backup_rollback;
DROP TABLE IF EXISTS barsy_suppliers_backup_rollback;
DROP TABLE IF EXISTS barsy_store_loads_backup_rollback;
DROP TABLE IF EXISTS barsy_store_load_items_backup_rollback;
```

## Support Queries

### Find unlinked suppliers:

```sql
SELECT * FROM barsy_suppliers WHERE vendor_id IS NULL;
```

### Find vendor by name:

```sql
SELECT * FROM vendors WHERE name ILIKE '%search_term%';
```

### See all suppliers for a vendor:

```sql
SELECT bs.* 
FROM barsy_suppliers bs
JOIN vendors v ON bs.vendor_id = v.id
WHERE v.name = 'Vendor Name';
```

### Check purchase history for vendor:

```sql
SELECT 
  v.name,
  COUNT(*) as order_count,
  SUM(sl.total_sum) as total_amount
FROM vendors v
JOIN barsy_store_loads sl ON v.id = sl.vendor_id
WHERE v.id = [vendor_id]
GROUP BY v.name;
```

## Timeline

- **Analysis & Review:** 15-30 minutes
- **Execution:** 5-10 minutes
- **Validation:** 10-15 minutes
- **Testing:** 15-30 minutes
- **Monitoring:** 24-48 hours

**Total time commitment:** ~1 hour + monitoring

## Success Criteria

✅ All suppliers linked to vendors (>95%)
✅ No orphaned references
✅ Store loads backfilled (>90%)
✅ Consolidation ratio > 1.5:1
✅ Application functions normally
✅ Reports show correct vendor data

## Contact

For issues or questions during migration, document:
- Which step failed
- Error messages
- Number of affected records
- Output from validation script

