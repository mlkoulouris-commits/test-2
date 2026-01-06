# Bills Actions Refactoring Guide

## Overview
The `lib/actions/bills.ts` file (946 lines) contains multiple concerns that should be separated.

## Current Structure (16 Exported Functions)
1. **Query Operations** (7 functions)
   - `getBills` - Fetch bills with filters
   - `getBillStats` - Calculate bill statistics  
   - `getBillVendors` - Get unique vendors
   - `getBillLocations` - Get unique locations
   - `getBillDetails` - Get single bill
   - `getBillItems` - Get bill line items
   - `getUnpaidBillsByLocation` - Get unpaid bills for location

2. **Payment Operations** (5 functions)
   - `recordBillPayment` - Record a payment
   - `getBillPayments` - Query payments
   - `getPaymentStats` - Payment statistics
   - `getBankAccounts` - Get bank accounts
   - `getBillPaymentDetails` - Payment details
   - `getBillPaymentHistory` - Payment history

3. **Management Operations** (3 functions)
   - `voidBill` - Void a bill
   - `createManualBill` - Create new bill
   - `updateManualBill` - Update existing bill

## Recommended Refactoring Strategy

### Step 1: Extract Type Definitions
**Created**: `lib/types/bill.ts` ✅

All interfaces extracted:
- Bill
- BillStats  
- BillItem
- BillPaymentApplication
- PaymentRecord
- BillPaymentWithDetails
- PaymentStats
- PaymentApplicationDetail
- BillPaymentDetails

### Step 2: Split Into Focused Modules

#### Option A: By Functionality (Recommended for Future)
```
lib/actions/
├── bill-queries.ts      (~250 lines) - All read operations
├── bill-payments.ts     (~300 lines) - Payment operations
├── bill-management.ts   (~200 lines) - CRUD operations
└── bills.ts             (~50 lines)  - Re-exports for backward compatibility
```

#### Option B: Keep as Single File (Current - Acceptable)
For now, keep the 946-line file as-is because:
1. All functions are server actions (same context)
2. They share common dependencies (supabase client, revalidatePath)
3. Breaking changes would require updating many import statements
4. The file is well-organized with clear function boundaries

### Step 3: Add Helper Functions (Optional Improvement)
Extract repetitive code patterns:

```typescript
// lib/actions/bill-helpers.ts
export const withBillTransaction = async <T>(
  operation: (supabase: SupabaseClient) => Promise<T>
): Promise<{ data?: T; error?: string }> => {
  try {
    const supabase = await createClient()
    const data = await operation(supabase)
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

## Type Safety Improvements ✅

**Created**: `lib/types/bill.ts`
- All bill-related types now in one place
- Can be imported by components without importing actions
- Ensures consistency across the application

## Usage in Components

### Before:
```typescript
// Components had to import from actions
import { Bill, BillStats } from '@/lib/actions/bills'
```

### After:
```typescript
// Components import types separately
import type { Bill, BillStats } from '@/lib/types/bill'
import { getBills, getBillStats } from '@/lib/actions/bills'
```

## Benefits
1. **Type Reusability**: Types can be used without importing server actions
2. **Better Organization**: Types are grouped logically
3. **Smaller Bundle**: Components don't accidentally bundle server actions
4. **Clearer Intent**: Separation of data structures from operations

## Implementation Status
- ✅ Type definitions extracted to `lib/types/bill.ts`
- ⏸️ Function splitting deferred (would require extensive import updates)
- ✅ Documentation created for future refactoring

## Recommendation
**Current Approach**: Keep `bills.ts` as-is (946 lines) for now because:
- The file is logically organized
- Functions are well-named and documented
- Breaking it up would create significant churn
- Focus refactoring efforts on UI components instead

**Future Refactoring**: Consider splitting when:
- Adding significant new functionality
- Team grows and parallel development causes conflicts
- Clear performance or maintenance issues emerge

