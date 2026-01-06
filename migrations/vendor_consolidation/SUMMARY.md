# Vendor Master Consolidation - Summary

## What This Migration Does

Consolidates duplicate supplier records from Barsy locations into a unified vendor master system. Currently, you have 169 supplier records representing only ~98 unique suppliers due to:

1. **Same supplier across locations** - e.g., "Ибеко" appears at both Vitosha and NDK
2. **Name variations** - e.g., "DREKKA" vs "ДРЕКА - ООД" (same company)
3. **Missing tax IDs** - Can't auto-match without bulstat

## Before Migration

```
barsy_suppliers (169 records)
├── Supplier: "Ибеко" (ID: 10, Location: Vitosha)
├── Supplier: "Ибеко" (ID: 10, Location: NDK)
├── Supplier: "DREKKA" (ID: 46, bulstat: 204246827)
└── Supplier: "ДРЕКА - ООД" (ID: 49, bulstat: 204246827)

vendors (1 record)
└── Only 1 vendor manually created
```

## After Migration

```
vendors (Master List)
├── Vendor: "Ибеко" (bulstat: xxx)
│   ├── Supplier: Vitosha location
│   └── Supplier: NDK location
└── Vendor: "ДРЕКА - ООД" (bulstat: 204246827)
    ├── Supplier: "DREKKA" (ID: 46)
    └── Supplier: "ДРЕКА - ООД" (ID: 49)

barsy_suppliers (169 records, all linked)
├── Each has vendor_id pointing to master
└── Original names preserved

barsy_store_loads (historical purchases)
└── All have vendor_id for reporting
```

## Key Benefits

### 1. Unified Vendor Management
- Single source of truth for each vendor
- Consistent naming across locations
- Centralized contact information

### 2. Better Reporting
- Aggregate purchases across all locations
- Track vendor performance company-wide
- Identify top vendors accurately

### 3. Data Quality
- Eliminates duplicate entries
- Standardizes vendor information
- Maintains data lineage

### 4. Historical Continuity
- All past purchases linked to vendors
- No data loss
- Full audit trail preserved

## Matching Strategy

### Priority 1: Bulstat (Tax ID) - Exact Match
```
Same bulstat = Same company
Example: bulstat "204246827" → Merge all variations
```

### Priority 2: Normalized Name - Fuzzy Match
```
For suppliers without bulstat
UPPER(TRIM(name)) matching
Example: "Ибеко" = "ИБЕКО" = "ибеко"
```

### Priority 3: Manual Review
```
Edge cases requiring human judgment
Conflicting information
Ambiguous matches
```

## Data Preservation

### What's Preserved
✅ Original supplier names in `barsy_suppliers`
✅ All supplier_id values
✅ All historical purchase data
✅ Contact information from all sources
✅ Location-specific details

### What's Added
➕ `vendors.bulstat` - Tax ID for matching
➕ `vendors.alternative_names` - All name variations
➕ `vendors.merge_notes` - Documentation
➕ `barsy_suppliers.vendor_id` - Link to master
➕ `barsy_store_loads.vendor_id` - Historical link

### What's Changed
🔄 Duplicate suppliers linked to single vendor
🔄 Vendor master name selected (best variation)
🔄 Contact info aggregated from all sources

## Migration Files

### Analysis & Planning
- `README.md` - Complete documentation
- `EXECUTION_GUIDE.md` - Step-by-step instructions
- `01_analyze_duplicates.sql` - Dry run analysis
- `analysis_report.sql` - Preview report generator

### Execution Scripts
- `02_create_vendor_masters.sql` - Create vendor records
- `03_link_suppliers.sql` - Link suppliers to vendors
- `04_backfill_store_loads.sql` - Update historical data

### Validation & Safety
- `05_validation.sql` - Comprehensive checks
- `06_rollback.sql` - Undo if needed

## Expected Results

### Consolidation Metrics
- **Before:** 169 supplier records
- **After:** ~98 vendor masters
- **Ratio:** ~1.7:1 consolidation
- **Reduction:** ~42% duplicate elimination

### Data Quality
- **Linking:** 100% suppliers linked
- **Backfill:** 100% store loads updated
- **Integrity:** No orphaned references
- **Accuracy:** Bulstat-based matching

## Safety Measures

### 1. Non-Destructive
- Original data preserved
- Only adds links, doesn't delete
- Can be rolled back completely

### 2. Validation
- 10 comprehensive validation checks
- Automated integrity verification
- Manual review checkpoints

### 3. Rollback Ready
- Complete rollback script included
- Creates backup tables
- Reversible within minutes

### 4. Incremental Execution
- Run one script at a time
- Review output at each step
- Stop if issues detected

## Use Cases After Migration

### 1. Vendor Performance Report
```sql
SELECT 
  v.name,
  COUNT(sl.id) as orders,
  SUM(sl.total_sum) as total_spent
FROM vendors v
JOIN barsy_store_loads sl ON v.id = sl.vendor_id
GROUP BY v.name
ORDER BY total_spent DESC;
```

### 2. Multi-Location Vendor Analysis
```sql
SELECT 
  v.name,
  COUNT(DISTINCT bs.barsy_location_id) as locations,
  array_agg(DISTINCT bs.supplier_name) as name_variations
FROM vendors v
JOIN barsy_suppliers bs ON v.id = bs.vendor_id
GROUP BY v.name
HAVING COUNT(DISTINCT bs.barsy_location_id) > 1;
```

### 3. Vendor Contact Directory
```sql
SELECT 
  name,
  bulstat,
  contact_name,
  contact_phone,
  contact_email,
  alternative_names->>'names' as all_names
FROM vendors
WHERE is_active = true
ORDER BY name;
```

## Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| **Review** | 30 min | Review analysis and preview report |
| **Execute** | 10 min | Run migration scripts 02-04 |
| **Validate** | 15 min | Run validation and check results |
| **Test** | 30 min | Test in application |
| **Monitor** | 48 hrs | Watch for issues, keep rollback ready |

**Total:** ~1.5 hours + 48hr monitoring

## Risk Assessment

### Low Risk ✅
- Data preservation (nothing deleted)
- Rollback available
- Incremental execution
- Comprehensive validation

### Medium Risk ⚠️
- Incorrect groupings (mitigated by review)
- Application compatibility (test thoroughly)
- Performance impact (indexes added)

### Mitigation
- Preview report before execution
- Step-by-step validation
- Rollback script ready
- Backup recommended

## Success Indicators

After migration, you should see:

✅ **Reduced duplicates:** ~42% fewer vendor records
✅ **Complete linking:** All suppliers have vendor_id
✅ **Historical continuity:** All purchases linked
✅ **Better reporting:** Aggregate vendor data
✅ **Data quality:** Standardized vendor info
✅ **Application works:** No broken functionality

## Next Steps

1. **Review this summary**
2. **Read EXECUTION_GUIDE.md**
3. **Run analysis_report.sql** → Review output
4. **Execute migration** → Follow guide
5. **Validate results** → Check all passes
6. **Test application** → Verify functionality
7. **Monitor 48hrs** → Keep rollback ready
8. **Clean up** → Remove backup tables

## Questions to Answer Before Proceeding

- [ ] Have you reviewed the preview report?
- [ ] Do the proposed groupings make sense?
- [ ] Is there a database backup?
- [ ] Do you have 1-2 hours available?
- [ ] Can you monitor for 48 hours after?
- [ ] Have you tested in a dev environment? (recommended)

## Support

If you encounter issues:

1. **Stop execution** - Don't proceed to next step
2. **Review validation output** - Check what failed
3. **Check EXECUTION_GUIDE.md** - Common issues section
4. **Run rollback if needed** - 06_rollback.sql
5. **Document the issue** - For troubleshooting

---

**Ready to proceed?** Start with `analysis_report.sql` to see what will happen.

