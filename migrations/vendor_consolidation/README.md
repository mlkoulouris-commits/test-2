# Vendor Master Consolidation Migration

## Overview

This migration consolidates duplicate suppliers from Barsy locations into a vendor master system. The same supplier may exist across multiple locations with different IDs and name variations. This system creates vendor masters and links all supplier sub-accounts to them.

## Problem Statement

Current state:
- **169 total suppliers** in `barsy_suppliers`
- **98 unique supplier_ids** (same supplier across locations)
- **148 unique supplier_names** (name variations)
- **Only 1 vendor** currently linked

Duplicates exist due to:
- Same supplier across multiple Barsy locations
- Name variations (case, spelling: "DREKKA" vs "ДРЕКА - ООД")
- Missing/inconsistent bulstat (tax ID) values

## Solution

**Hybrid Matching System:**
1. **Bulstat matching** (exact) - Most reliable, uses tax ID
2. **Normalized name matching** (fuzzy) - For suppliers without bulstat
3. **Manual review** - Edge cases and conflicts

**Data Preservation:**
- Keep original supplier names in `barsy_suppliers`
- Link to vendor master via `vendor_id`
- Store name variations in vendor master `alternative_names`

## Migration Scripts

Execute in order:

### 1. `01_analyze_duplicates.sql`
**Purpose:** Generate analysis report of all duplicates
**Output:** Shows what will be merged, grouped by matching strategy
**Action:** Review output before proceeding

### 2. `02_create_vendor_masters.sql`
**Purpose:** Create vendor master records
**Logic:**
- Group suppliers by bulstat (if available)
- Group remaining by normalized name
- Select best name as master (longest, most complete)
- Store all variations in `alternative_names`

### 3. `03_link_suppliers.sql`
**Purpose:** Link `barsy_suppliers.vendor_id` to vendor masters
**Preserves:** Original `supplier_name` and `supplier_id`

### 4. `04_backfill_store_loads.sql`
**Purpose:** Backfill vendor_id in historical purchase data
**Updates:**
- `barsy_store_loads.vendor_id`
- `barsy_store_load_items.vendor_id` (if needed)

### 5. `05_validation.sql`
**Purpose:** Verify data integrity
**Checks:**
- All suppliers linked
- No orphaned records
- Historical data correctly backfilled
- Vendor names appropriate

### 6. `06_rollback.sql`
**Purpose:** Undo changes if issues found
**Keep ready for 24-48h after migration**

## Execution Instructions

```bash
# 1. Review analysis
psql -f 01_analyze_duplicates.sql > analysis_output.txt
cat analysis_output.txt  # Review carefully

# 2. Execute migrations (one at a time)
psql -f 02_create_vendor_masters.sql
psql -f 03_link_suppliers.sql
psql -f 04_backfill_store_loads.sql

# 3. Validate
psql -f 05_validation.sql

# 4. If issues found, rollback
psql -f 06_rollback.sql
```

## Database Schema Changes

### `vendors` table additions:
- `bulstat` - Tax ID for matching
- `alternative_names` - JSONB array of name variations
- `merge_notes` - Documentation of manual merges

### `barsy_store_loads` table additions:
- `vendor_id` - Link to vendor master (if not exists)

### `barsy_store_load_items` table additions:
- `vendor_id` - Link to vendor master (if needed)

## Matching Rules

### Priority 1: Bulstat Match (Exact)
```sql
GROUP BY bulstat WHERE bulstat IS NOT NULL AND bulstat != ''
```

### Priority 2: Normalized Name Match (Fuzzy)
```sql
GROUP BY UPPER(TRIM(supplier_name))
```

### Priority 3: Manual Review
- Conflicting bulstat values
- Ambiguous name matches
- Edge cases

## Master Name Selection

Choose the "best" name from variations:
1. Has bulstat → more official
2. Longest name → more complete
3. Has "ООД", "ЕООД" suffix → legal entity name
4. Most recent record

## Post-Migration

### New Supplier Workflow:
1. Sync from Barsy → `barsy_suppliers`
2. Auto-match to existing vendor by bulstat
3. If no match, create new vendor master
4. Link supplier to vendor

### Monitoring:
- Check `v_vendor_consolidation_status` view
- Review unlinked suppliers weekly
- Use `fn_suggest_vendor_match()` for suggestions

## Rollback Strategy

The rollback script will:
1. Clear `vendor_id` from `barsy_suppliers`
2. Clear `vendor_id` from `barsy_store_loads`
3. Delete newly created vendor records
4. Restore to pre-migration state

**Keep rollback ready for 24-48h after migration**

## Support

For issues or questions:
- Review validation output
- Check for unlinked suppliers
- Verify historical data integrity
- Test reporting queries

