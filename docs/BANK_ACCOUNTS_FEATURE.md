# Bank Accounts Management Feature

## Overview

The bank accounts management system allows you to track bank and cash accounts for each location, manage account balances, and automatically select the appropriate account when making bill payments.

## Key Features

### 1. Bank Account Types
- **Bank Account**: Regular bank accounts with account numbers and bank names
- **Cash Account**: Cash accounts for tracking cash payments at each location

### 2. Account Management Page (`/admin/banks`)

The Banks page provides a centralized view of all accounts grouped by location:

- **Location Filter**: Filter accounts by specific location
- View all bank and cash accounts for each location
- See current balance for each account (automatically updated with payments)
- Identify default accounts (marked with ⭐)
- Create, edit, and manage accounts
- Toggle account status (active/inactive)

### 3. Automatic Balance Tracking

The system automatically tracks account balances:
- When a payment is recorded, the amount is **deducted** from the selected bank account
- When a payment is deleted, the amount is **added back** to the account
- When a payment is updated, the balance adjusts accordingly
- All balance updates happen automatically via database triggers

### 4. Account Properties

Each account has the following properties:
- **Account Name**: Descriptive name (e.g., "Main Operating Account", "Location Name - Cash")
- **Account Type**: Bank or Cash
- **Current Balance**: The current balance in the account
- **Bank Name**: Name of the bank (for bank accounts only)
- **Account Number**: Account/IBAN number (for bank accounts only)
- **Currency**: BGN, EUR, or USD
- **Status**: Active or Inactive
- **Default**: One account can be marked as default per location

### 5. Bill Payment Integration

When recording a bill payment:
- Select a location first, then choose from that location's accounts
- When "Cash" is selected as the payment method, the system automatically selects the location's cash account
- Cash accounts are indicated with a 💵 emoji in the dropdown
- Default accounts are marked with ⭐

## Setup Instructions

### Step 1: Run Database Migrations

Run the following migrations in order:

```sql
-- 1. Add account_type and current_balance columns
\i migrations/add_account_type_and_balance.sql

-- 2. Create cash accounts for all locations
\i migrations/create_cash_accounts_for_locations.sql

-- 3. Add automatic balance update triggers
\i migrations/auto_update_bank_account_balance.sql
```

### Step 2: Recalculate Existing Balances (First Time Setup)

After running the migrations, recalculate balances for all accounts based on existing payment history:

```sql
-- This will show the old and new balances for all accounts
SELECT * FROM recalculate_all_bank_account_balances();
```

**Note:** The balance calculation assumes:
- Positive balance = Available funds
- Negative balance = Total spent (if no initial balance was set)
- Each payment automatically deducts from the account balance

### Step 3: Configure Accounts

1. Navigate to `/admin/banks`
2. Use the location filter to view accounts by location
3. For each location, verify or create:
   - At least one bank account (if paying bills via bank transfer)
   - One cash account (automatically created by migration)
4. Set appropriate initial balances for each account
5. Mark one account as default per location

### Step 4: Verify Bill Payment Flow

1. Go to `/admin/bills`
2. Click "Record Payment"
3. Select a location
4. Select payment method as "Cash"
5. Verify that the cash account is auto-selected

## Database Schema

### Bank Accounts Table

```sql
CREATE TABLE bank_accounts (
  id SERIAL PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES barsy_locations(id),
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  bank_name VARCHAR(255),
  account_type VARCHAR(20) DEFAULT 'bank' CHECK (account_type IN ('bank', 'cash')),
  current_balance NUMERIC(10,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'BGN',
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Functions

### Bank Account Actions (`lib/actions/bank-accounts.ts`)

- `getAllBankAccounts()` - Get all active accounts with location info
- `getBankAccountsByLocation(locationId)` - Get accounts for a specific location
- `getCashAccountByLocation(locationId)` - Get the cash account for a location
- `createBankAccount(...)` - Create a new account
- `updateBankAccount(...)` - Update an existing account
- `toggleBankAccountStatus(...)` - Activate/deactivate an account
- `setDefaultBankAccount(...)` - Set an account as default for its location
- `deleteBankAccount(...)` - Delete an account

## Components

### Admin Components
- `BanksTable` - Display accounts grouped by location
- `CreateBankAccountDialog` - Create new bank or cash accounts
- `EditBankAccountDialog` - Edit existing accounts
- `LocationBankAccounts` - Manage accounts for a specific location (used in location details)

### Bill Payment Components
- `RecordMultiBillPaymentDialog` - Enhanced to support cash account auto-selection

## How Balance Calculation Works

### Automatic Updates
The system uses database triggers to automatically update balances:

```sql
-- When a payment is recorded:
new_balance = current_balance - payment_amount

-- When a payment is deleted:
new_balance = current_balance + payment_amount
```

### Manual Balance Adjustment
If you need to adjust an account balance (e.g., to match bank statement):
1. Navigate to `/admin/banks`
2. Click "Edit" on the account
3. Update the "Current Balance" field
4. Save changes

### Recalculating from History
To recalculate a specific account's balance from payment history:

```sql
SELECT recalculate_bank_account_balance(account_id);
```

To recalculate all accounts:

```sql
SELECT * FROM recalculate_all_bank_account_balances();
```

## Best Practices

1. **Initial Balances**: Set accurate initial balances when creating accounts
2. **Cash Accounts**: Each location should have exactly one cash account
3. **Default Account**: Set one default account per location for convenience
4. **Regular Reconciliation**: Periodically compare system balances with actual bank statements
5. **Deactivation**: Instead of deleting accounts with payment history, deactivate them
6. **Naming Convention**: Use clear names like "Location Name - Cash" for cash accounts

## Future Enhancements

Potential future features:
- Account transaction history view
- Bank statement import and reconciliation
- Multi-currency exchange rate support
- Balance alerts and low-balance notifications
- Integration with accounting systems (QuickBooks, Xero)
- Scheduled payment reminders

## Troubleshooting

### No cash account appears when selecting "Cash" payment method
- Verify a cash account exists for the location
- Check that the cash account is active
- Run the migration to create missing cash accounts

### Cannot create account
- Ensure the location exists and is active
- Check that account name is unique for the location
- Verify currency is valid (BGN, EUR, or USD)

### Default account not working
- Only one account can be default per location
- Setting a new default automatically unsets the previous one

## Related Files

- `/app/admin/banks/page.tsx` - Banks management page
- `/components/admin/banks-table.tsx` - Banks table component
- `/components/admin/create-bank-account-dialog.tsx` - Create dialog
- `/components/admin/edit-bank-account-dialog.tsx` - Edit dialog
- `/components/admin/location-bank-accounts.tsx` - Location-specific accounts
- `/components/admin/record-multi-bill-payment-dialog.tsx` - Bill payment dialog
- `/lib/actions/bank-accounts.ts` - Bank account server actions
- `/migrations/add_account_type_and_balance.sql` - Schema migration
- `/migrations/create_cash_accounts_for_locations.sql` - Cash accounts setup

