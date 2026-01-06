# Barsy Transactions Sync Guide - SIMPLIFIED

This guide explains how to sync transaction data from Barsy to the Memento transactions page using existing tables.

## Overview

The **simplified** Barsy Transactions Sync directly transforms `barsy_orders` into Memento `transactions`:
- ✅ Uses existing `barsy_orders` table (already synced)
- ✅ Uses existing `transactions` and `transaction_line_items` tables
- ❌ No need for intermediate `barsy_accounts` or `barsy_payments` tables

## Database Setup

### Step 1: Run the Migration

Execute the migration SQL to link products to Barsy articles:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase_barsy_transactions_migration.sql
```

This adds:
- `barsy_article_id` column to `products` (enables line item mapping)

### Step 2: Map Products to Barsy Articles

Before syncing transactions, ensure your products are linked to Barsy articles:

1. Go to Admin > Products
2. For each product, set the `barsy_article_id` to match the corresponding article from Barsy
3. Or run a bulk update query if you have a mapping:

```sql
-- Example: Update product barsy_article_id based on SKU or name matching
UPDATE products p
SET barsy_article_id = ba.barsy_article_id
FROM barsy_articles ba
WHERE p.name = ba.article_name
  AND ba.location_id = 'YOUR_BARSY_LOCATION_ID';
```

## How to Sync Transactions

### Option 1: Admin UI (Recommended)

1. Navigate to **Admin > Barsy Sync** (`/admin/barsy-sync`)
2. Select your Barsy location (Vitosha, NDK, etc.)
3. First click **"Sync October Orders"** (if not done already)
4. Then click **"Sync Transactions"** button

This will:
- Group `barsy_orders` by date
- Create one transaction per day with all items
- Map line items from `barsy_orders` to `transaction_line_items` via `barsy_article_id`

### Option 2: Programmatic

```typescript
import { syncBarsyTransactions } from '@/lib/actions/barsy-transactions-sync';

const result = await syncBarsyTransactions(
  'barsy-location-uuid',  // Barsy location ID
  1,                       // Memento location ID
  '2025-10-01',           // Date from
  '2025-10-31'            // Date to
);
```

## Data Flow

```
Already Synced
──────────────
barsy_orders → (already in Supabase from Barsy API sync)

Transformation → Memento
────────────────────────
barsy_orders (grouped by date) → transactions
  - order_date → actual_timestamp, business_date
  - SUM(amount * actual_price) → total_amount
  - date → transaction_number (BARSY-2025-10-01)

barsy_orders (individual items) → transaction_line_items
  - barsy_article_id → product_id (via products.barsy_article_id)
  - amount → quantity
  - actual_price → unit_price
```

## Transaction Grouping

Currently, orders are grouped **by date** to create one transaction per day. This means:
- All orders from October 1st → 1 transaction
- All orders from October 2nd → 1 transaction
- etc.

You can modify the grouping logic in `barsy-transactions-sync.ts` if needed (e.g., group by account_id from raw_data).

## Viewing Synced Transactions

1. Navigate to **Dashboard > Transactions** (`/dashboard/transactions`)
2. Click the **"Transaction History"** tab
3. View all transactions including those synced from Barsy

Transactions synced from Barsy will have:
- Transaction number formatted as `BARSY-2025-10-01` (date-based)
- Line items properly mapped to products via `barsy_article_id`
- One transaction per day containing all orders for that day

## Sync Frequency

**Recommended Schedule:**
- **Daily**: Sync previous day's orders, then transform to transactions
- **Weekly**: Full sync for the current week
- **Monthly**: Full sync at month end

**Important Notes:**
- Transactions are grouped by **date** (one per day)
- Modify grouping logic in code if you need per-account or per-order transactions
- Products must have `barsy_article_id` set to appear in line items

## Troubleshooting

### No transactions appearing after sync

1. Ensure `barsy_orders` are synced first:
   ```sql
   SELECT COUNT(*) FROM barsy_orders 
   WHERE order_date >= '2025-10-01' AND order_date <= '2025-10-31';
   ```

2. Verify products have `barsy_article_id` set:
   ```sql
   SELECT COUNT(*) FROM products WHERE barsy_article_id IS NOT NULL;
   ```

3. Check for unmapped products (warnings in console):
   ```sql
   SELECT DISTINCT bo.barsy_article_id, bo.article_name
   FROM barsy_orders bo
   LEFT JOIN products p ON p.barsy_article_id = bo.barsy_article_id
   WHERE p.id IS NULL
   LIMIT 20;
   ```

### Line items not appearing

Ensure:
- `barsy_orders` have been synced for the same date range
- Products have matching `barsy_article_id`
- Run the product mapping query above to find missing mappings

### Update product mappings

```sql
-- Example: Bulk update products with barsy_article_id
UPDATE products p
SET barsy_article_id = ba.barsy_article_id
FROM barsy_articles ba
WHERE LOWER(p.name) = LOWER(ba.article_name)
  AND ba.location_id = 'YOUR_BARSY_LOCATION_UUID';
```

## API Methods Used

- `Orders_getlist` - Fetch all orders (already implemented)
- No additional API calls needed!

## Future Enhancements

- [ ] Group by account_id instead of date (requires account_id in barsy_orders.raw_data)
- [ ] Support for comp transactions
- [ ] Payment method detection from barsy_orders
- [ ] Tax calculation from Barsy tax groups
- [ ] Customer/client linking
- [ ] Automatic product mapping via fuzzy name matching

---

*Last Updated: November 4, 2025 (Simplified version)*

