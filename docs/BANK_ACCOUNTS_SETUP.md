# Bank Accounts Setup Guide

## Overview

The payment system now tracks which bank account payments are made from. **Each location has its own bank accounts** since each location is its own company. Payments can only be made for bills from the same location.

## Key Changes

### 1. Bank Account Tracking
- Each location (company) has one or more bank accounts
- Payments now require both a location and a bank account selection
- Only bills from the selected location can be included in a payment

### 2. Location-Based Payments
- **Important**: All bills in a single payment must be from the same location
- This enforces the business rule that each location is its own company
- Database triggers validate location matching automatically

### 3. Database Schema

#### New Table: `bank_accounts`
```sql
CREATE TABLE bank_accounts (
  id SERIAL PRIMARY KEY,
  location_id UUID NOT NULL,              -- Links to barsy_locations
  account_name VARCHAR(255) NOT NULL,      -- e.g., "Main Operating Account"
  account_number VARCHAR(100),             -- Optional account number
  bank_name VARCHAR(255),                  -- e.g., "First Investment Bank"
  currency VARCHAR(10) DEFAULT 'BGN',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,        -- One default per location
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### Updated: `bill_payments`
- Added `location_id UUID` - Which location/company is paying
- Added `bank_account_id INT` - Which bank account payment comes from

## Setup Instructions

### Step 1: Create Bank Accounts for Each Location

You need to add at least one bank account for each location before you can record payments.

**SQL Example:**
```sql
-- For Location 1 (e.g., Sofia Bar)
INSERT INTO bank_accounts (location_id, account_name, bank_name, is_default)
VALUES 
  ('your-sofia-location-uuid', 'Sofia Main Account', 'First Investment Bank', true);

-- For Location 2 (e.g., Plovdiv Bar)
INSERT INTO bank_accounts (location_id, account_name, bank_name, is_default)
VALUES 
  ('your-plovdiv-location-uuid', 'Plovdiv Operating Account', 'DSK Bank', true);
```

**How to Get Location IDs:**
```sql
SELECT id, name FROM barsy_locations WHERE is_active = true;
```

### Step 2: Recording Payments

#### New Payment Workflow:
1. **Select Location** - Choose which company is making the payment
2. **Select Bank Account** - Choose which account the money comes from (auto-selected if default exists)
3. **Filter Bills** - Only bills from the selected location will appear
4. **Optional Vendor Filter** - Further filter by specific vendor
5. **Add Bills** - Select bills and apply amounts
6. **Submit** - Payment is recorded with location and bank account tracking

## Validation Rules

### Automatic Enforcement:
1. ✅ All bills must be from the same location as the payment
2. ✅ Bank account must belong to the selected location  
3. ✅ Only one default account per location
4. ✅ Applied amounts cannot exceed bill balances

### Database Triggers:
- `validate_payment_location()` - Prevents cross-location bill payments
- Triggers on INSERT/UPDATE of `bill_payment_applications`

## Payment Recording Examples

### Example 1: Single Location Payment
Sofia location pays 3 bills for a total of 5,000 лв.

1. Select "Sofia Bar" location
2. Select "Sofia Main Account" bank account
3. Bills filtered to Sofia only
4. Add 3 bills with amounts
5. Payment recorded ✅

### Example 2: Invalid Cross-Location (Blocked)
Trying to pay Sofia and Plovdiv bills together:

1. Select "Sofia Bar" location
2. Select bills from Sofia
3. Try to add a Plovdiv bill
4. ❌ **Error**: "All bills must be from the same location"

## API / Functions

### `getBankAccountsByLocation(locationId)`
Gets all active bank accounts for a location.

```typescript
const { data: accounts } = await getBankAccountsByLocation(locationId);
```

### `recordBillPayment(..., locationId, bankAccountId, ...)`
Updated to require location and bank account.

```typescript
await recordBillPayment(
  paymentDate,
  totalAmount,
  billApplications,
  locationId,        // NEW: Required
  bankAccountId,     // NEW: Required
  paymentMethod,
  referenceNumber,
  notes
);
```

### `getUnpaidBillsByLocation(locationId, vendorId?)`
Gets unpaid bills for a specific location only.

```typescript
const { data: bills } = await getUnpaidBillsByLocation(locationId);
```

## Admin Bank Account Management

Currently, bank accounts must be created via SQL. Future enhancements could include:
- Admin UI for creating/editing bank accounts
- Bank account assignment during location setup
- Bank account transaction history
- Bank reconciliation features

## Migration Applied

✅ **Migration**: `add_bank_accounts_to_payments`
- Creates `bank_accounts` table
- Adds location and bank account columns to `bill_payments`
- Creates validation trigger for location matching
- Adds necessary indexes

## Important Notes

⚠️ **Before Recording Payments**: Make sure each active location has at least one bank account configured

⚠️ **Location Separation**: This enforces proper accounting separation between locations (companies)

⚠️ **Existing Payments**: Existing payments without location/bank account data will still show in history but won't have location tracking

---

*Last Updated: November 17, 2024*

