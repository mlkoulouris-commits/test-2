# Barsy Accounts (Bills/Tabs) Integration Guide

## Overview

Your Barsy data shows that **each `barsy_orders` record is a single line item**, not a grouped transaction. To properly view customer bills/receipts, we've integrated the **Barsy Accounts API** which provides the actual bills/tabs.

## What Changed

### 1. New Sync Action
- **File**: `/lib/actions/barsy-accounts-sync.ts`
- **Function**: `syncBarsyAccounts(dateFrom, dateTo)`
  - Fetches accounts (bills/tabs) from Barsy API
  - Handles pagination automatically (10k batch size)
  - Syncs across all active Barsy locations

### 2. New Transaction View
- **File**: `/lib/actions/barsy-accounts-sync.ts`
- **Function**: `getBarsyAccountTransactions(...)`
  - Groups orders by their parent account (bill)
  - Shows account open/close times
  - Displays all line items per bill
  - Supports pagination, date range, and location filtering

### 3. Admin Sync UI
- **File**: `/app/admin/barsy-sync/page.tsx`
- **New Button**: "Sync Accounts (Bills)"
  - Syncs October 2025 accounts
  - Shows sync progress and results

### 4. Dashboard Transactions Page
- **File**: `/app/dashboard/transactions/page.tsx`
- **New View Mode**: "Accounts (Bills)"
  - Three view modes now available:
    1. **Individual Orders** - Each line item separately
    2. **Grouped by Transaction** - Heuristic grouping (same POS+time)
    3. **Accounts (Bills)** - Actual customer bills from Barsy API ✨ NEW

## How to Use

### Step 1: Sync Barsy Accounts

1. Navigate to **Admin → Barsy Sync** (`/admin/barsy-sync`)
2. Select your location (Vitosha or NDK)
3. Click **"Sync Accounts (Bills)"**
4. Wait for sync to complete (~30-60 seconds)

This will populate the `barsy_accounts` table with actual bills/tabs from Barsy.

### Step 2: View Grouped Transactions

1. Navigate to **Dashboard → Transactions** (`/dashboard/transactions`)
2. Select date range (default: last month)
3. Choose **"Accounts (Bills)"** from the view mode dropdown
4. See properly grouped customer bills with:
   - Account number
   - Open/close times
   - Location
   - Status (open/closed)
   - All line items
   - Total amount

## Database Structure

### `barsy_accounts` Table
```sql
- id (UUID)
- location_id (UUID → barsy_locations)
- barsy_account_id (INTEGER)
- account_number (TEXT)
- open_date (TIMESTAMPTZ)
- close_date (TIMESTAMPTZ)
- status (TEXT)
- total_amount (NUMERIC)
- paid_amount (NUMERIC)
- client_id (INTEGER) -- for customer loyalty
- place_id (INTEGER) -- table number
- user_id (INTEGER) -- staff who opened the bill
- raw_data (JSONB)
```

### How Accounts Link to Orders

The `getBarsyAccountTransactions` function links accounts to orders by:
1. Same `location_id`
2. Order `order_date` between account `open_date` and `close_date`
3. This captures all items on that bill

## Data Analysis Results

Your `barsy_orders` data analysis revealed:
- **50,437 total orders**
- **50,437 unique `order_id`s** (1:1 ratio)
- **No `account_id` field in orders**
- **Each order = 1 line item**

This confirms that the Orders API doesn't contain bill groupings. The **Accounts API is required** for proper transaction grouping.

## View Mode Comparison

| View Mode | Data Source | Shows | Best For |
|-----------|-------------|-------|----------|
| **Individual Orders** | `barsy_orders` | Each line item separately | Detailed product analysis |
| **Grouped by Transaction** | `barsy_orders` grouped by POS+time | Approximate bills (heuristic) | Quick estimates when accounts aren't synced |
| **Accounts (Bills)** ✨ | `barsy_accounts` + `barsy_orders` | Actual customer bills | Accurate transaction history |

## Performance Notes

- **Accounts sync**: ~1-2 minutes for 1 month of data
- **Transaction loading**: ~1-2 seconds per page
- **Pagination**: 25 accounts per page
- **Stats calculation**: Fetches all accounts for accurate totals

## Troubleshooting

### No accounts showing?
1. Check if accounts were synced: Admin → Barsy Sync
2. Verify date range matches synced period
3. Check if location filter is applied

### Accounts have no line items?
This can happen if:
- Account times don't match order times
- Orders were deleted/modified
- Data sync timing mismatch

**Solution**: Re-sync both orders and accounts for the same date range.

### Empty stats cards?
Stats only show when data is loaded. If seeing 0/0:
- Check date range filters
- Verify location has data
- Try "Individual Orders" view first to confirm orders exist

## Future Enhancements

Potential improvements:
1. **Auto-sync**: Schedule daily account syncs
2. **Payment tracking**: Sync `barsy_payments` for payment methods
3. **Customer linking**: Connect accounts to `barsy_clients` for loyalty data
4. **Real-time sync**: Webhook integration for live updates
5. **Bill splitting**: Handle split payments across multiple accounts

## API Endpoints Used

- **Accounts**: `Accounts_getlist` with `ref_date` filter
- **Pagination**: `offset` and `length` parameters
- **Max batch size**: 10,000 accounts per request

## Support

If accounts aren't grouping correctly:
1. Check raw account data in database
2. Verify `open_date` and `close_date` are populated
3. Confirm orders fall within account time windows
4. Check Barsy API documentation for account structure changes

