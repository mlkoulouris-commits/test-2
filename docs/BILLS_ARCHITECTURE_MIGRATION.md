# Bills Table Architecture Migration

## Overview
Migrated from using `barsy_store_loads` as both staging and operational table to a clean two-table architecture that separates Barsy synced bills from manually entered bills.

## Architecture

### Before:
```
barsy_store_loads (single table)
├── Raw Barsy sync data
├── Approved bills
└── Payments attached directly
```

### After:
```
barsy_store_loads (staging)
└── Raw Barsy sync data
    └── Pending approval

bills (operational)
├── Approved Barsy bills (source='barsy')
├── Manual bills (source='manual')
└── Payments attached here
```

## Key Changes

### 1. New Tables
- **`bills`** - Operational bills table
  - `source` field: `'barsy'` | `'manual'`
  - `status` field: `'approved'` | `'partially_paid'` | `'paid'` | `'voided'`
  - References `barsy_store_loads.id` for Barsy bills
  - Direct foreign keys to `vendors` and `barsy_locations`

- **`bill_items`** - Line items for bills
  - Replaces reading from `barsy_store_load_items`
  - Same structure but references `bills.id`

### 2. Payment System Updates
- `bill_payment_applications` now has `new_bill_id` column
- References `bills` table instead of `barsy_store_loads`
- Triggers updated to work with new structure
- Old `bill_id` column kept for backwards compatibility during migration

### 3. Database Functions & Triggers
- `update_bill_total_paid()` - Updates `total_paid` and `status` automatically
- `validate_payment_location()` - Ensures payments only apply to bills from same location
- Auto-updates bill status: `approved` → `partially_paid` → `paid`

## Migration Process

### Data Migration
1. All approved bills (`status = 0`) copied from `barsy_store_loads` to `bills`
2. Bill items copied from `barsy_store_load_items` to `bill_items`
3. Payment applications updated to reference new `bills.id`

### Code Changes
1. **`lib/actions/bills.ts`**
   - All queries now use `bills` table
   - New `createManualBill()` function
   - Updated interfaces to match new structure

2. **UI Components**
   - `bills-table.tsx` - Updated Bill interface
   - `bill-items-dialog.tsx` - Updated to use new fields
   - `record-multi-bill-payment-dialog.tsx` - Updated UnpaidBill interface

3. **Status Management**
   - Changed from numeric (`0`, `1`, `-1`) to string enums
   - Better type safety and readability

## Benefits

### Separation of Concerns
- `barsy_store_loads` remains pure staging/sync data
- `bills` is clean operational table
- Clear distinction between synced and manual data

### Source Tracking
- Every bill has `source` field
- Easy to filter/report by source
- "Manual" badge shown in UI for manually entered bills

### Extensibility
- Easy to add manual bill entry
- Can approve/reject Barsy bills before they become operational
- Future: workflow for bill approval from Barsy staging

### Data Integrity
- Automatic status updates via triggers
- Location validation for payments
- Proper foreign key relationships

## Testing Checklist

- [ ] View existing bills on `/admin/bills`
- [ ] Bill details modal displays correctly
- [ ] Payment history shows for bills with payments
- [ ] Record new payment applies correctly
- [ ] Bill status updates automatically after payment
- [ ] Filter bills by status/location/vendor
- [ ] Manual bill entry (to be implemented)

## Next Steps

1. **Manual Bill Entry UI** - Create dialog to manually enter bills
2. **Barsy Bill Approval** - Add UI to review/approve bills from `barsy_store_loads`
3. **Migration Cleanup** - After verification, can remove old `bill_id` column
4. **Reporting** - Add reports showing Barsy vs Manual bill breakdown

## Rollback Plan

If issues arise:
1. Payments still reference old `barsy_store_loads` via `bill_id` column
2. Can temporarily revert UI to use `barsy_store_loads`
3. Data preserved in both tables during transition period



