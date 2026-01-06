# Barsy Void & Transfer Detection

## Overview

When items are moved between tables/bills in Barsy, the system creates **voided entries** (negative amounts) on the source account. This document explains how to distinguish between:

1. **Transfers** - Items moved to another table/bill
2. **Pure Voids** - Items cancelled without being reassigned

## Key Finding

**Barsy does NOT provide an explicit flag** to indicate why an item was voided. There is no:

- `storno_reason` field
- `transfer_to_account_id` reference
- `void_type` enum

However, **transfers can be reliably detected** through timestamp matching.

## How Barsy Handles Transfers

When an item is transferred from one account to another:

1. A **negative amount entry** is created on the source account (void)
2. A **positive amount entry** is created on the destination account
3. **Both entries have the exact same timestamp** (0 seconds difference)

This timestamp matching is the key to distinguishing transfers from pure voids.

## Detection Logic

### Identifying a Transfer

A voided item is a **transfer** if:

- `amount < 0` (negative/void entry)
- There exists another order with:
  - Same `barsy_article_id`
  - Same absolute quantity (`amount = ABS(void_amount)`)
  - Different `account_id`
  - **Exact same `order_date` timestamp**

### SQL Query: Classify Void Type

```sql
SELECT
  o.barsy_order_id,
  o.article_name,
  o.amount as void_qty,
  o.raw_data->>'account_id' as source_account,
  o.order_date,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM barsy_orders o2
      WHERE o2.barsy_article_id = o.barsy_article_id
      AND o2.amount::numeric = ABS(o.amount::numeric)
      AND o2.raw_data->>'account_id' != o.raw_data->>'account_id'
      AND o2.order_date = o.order_date  -- Same timestamp = transfer
    ) THEN 'TRANSFER'
    ELSE 'PURE_VOID'
  END as void_type
FROM barsy_orders o
WHERE o.amount::numeric < 0;
```

### SQL Query: Find Transfer Destination

```sql
WITH voided_items AS (
  SELECT
    o.barsy_order_id,
    o.raw_data->>'account_id' as source_account,
    o.barsy_article_id,
    o.article_name,
    ABS(o.amount::numeric) as qty,
    o.order_date as void_date,
    o.raw_data->>'user_name' as void_user
  FROM barsy_orders o
  WHERE o.amount::numeric < 0
)
SELECT
  vi.barsy_order_id as void_order_id,
  vi.source_account,
  vi.article_name,
  vi.qty,
  vi.void_date,
  vi.void_user,
  o2.barsy_order_id as dest_order_id,
  o2.raw_data->>'account_id' as dest_account,
  o2.raw_data->>'user_name' as dest_user
FROM voided_items vi
JOIN barsy_orders o2 ON
  o2.barsy_article_id = vi.barsy_article_id
  AND o2.amount::numeric = vi.qty
  AND o2.raw_data->>'account_id' != vi.source_account
  AND o2.order_date = vi.void_date;
```

### SQL Query: Analyze Zero-Total Accounts

```sql
WITH zero_accounts AS (
  SELECT barsy_account_id
  FROM barsy_accounts
  WHERE total_amount = 0
),
zero_account_analysis AS (
  SELECT
    za.barsy_account_id,
    SUM(CASE WHEN o.amount::numeric > 0 THEN 1 ELSE 0 END) as positive_items,
    SUM(CASE WHEN o.amount::numeric < 0 THEN 1 ELSE 0 END) as negative_items,
    SUM(CASE
      WHEN o.amount::numeric < 0 AND EXISTS (
        SELECT 1 FROM barsy_orders o2
        WHERE o2.barsy_article_id = o.barsy_article_id
        AND o2.amount::numeric = ABS(o.amount::numeric)
        AND o2.raw_data->>'account_id' != za.barsy_account_id::text
        AND o2.order_date = o.order_date
      ) THEN 1 ELSE 0
    END) as transferred_items
  FROM zero_accounts za
  LEFT JOIN barsy_orders o ON o.raw_data->>'account_id' = za.barsy_account_id::text
  GROUP BY za.barsy_account_id
)
SELECT
  barsy_account_id,
  positive_items,
  negative_items,
  transferred_items,
  CASE
    WHEN negative_items > 0 AND transferred_items = negative_items THEN 'FULLY_TRANSFERRED'
    WHEN negative_items > 0 AND transferred_items > 0 THEN 'PARTIALLY_TRANSFERRED'
    WHEN negative_items > 0 AND transferred_items = 0 THEN 'VOIDED_ONLY'
    ELSE 'EMPTY'
  END as account_type
FROM zero_account_analysis;
```

## Statistics (as of Dec 2025)

### Voided Orders Breakdown

| Void Type  | Count | Percentage |
| ---------- | ----- | ---------- |
| Transfers  | 4,879 | 88.5%      |
| Pure Voids | 1,033 | 11.5%      |
| **Total**  | 5,518 | 100%       |

### Zero-Total Accounts Breakdown

| Category              | Count | Percentage |
| --------------------- | ----- | ---------- |
| Fully Transferred     | 1,457 | 75.2%      |
| Partially Transferred | 73    | 3.8%       |
| Voided Only           | 295   | 15.2%      |
| Empty (no items)      | 112   | 5.8%       |
| **Total**             | 1,937 | 100%       |

## Data Model Reference

### barsy_orders Table

Key fields for void/transfer detection:

| Field                     | Description                            |
| ------------------------- | -------------------------------------- |
| `barsy_order_id`          | Unique order line ID                   |
| `barsy_article_id`        | Article/product ID                     |
| `article_name`            | Product name                           |
| `amount`                  | Quantity (negative = void)             |
| `order_date`              | Timestamp of the order                 |
| `raw_data->>'account_id'` | The bill/account this order belongs to |
| `raw_data->>'user_name'`  | User who created/voided the order      |

### barsy_accounts Table

| Field              | Description                                      |
| ------------------ | ------------------------------------------------ |
| `barsy_account_id` | Unique account/bill ID                           |
| `total_amount`     | Total bill amount (0 = fully voided/transferred) |
| `status`           | Account status                                   |
| `raw_data`         | Full JSON from Barsy API                         |

## Implementation Notes

### For Filtering Reports

When calculating sales or generating reports, you may want to:

1. **Exclude pure voids** - Items that were cancelled
2. **Handle transfers correctly** - Don't double-count transferred items

### Recommended Approach

```sql
-- Get net sales (excluding all voids, which are balanced by transfers or cancellations)
SELECT
  article_name,
  SUM(amount::numeric * actual_price::numeric) as net_revenue
FROM barsy_orders
WHERE amount::numeric > 0  -- Only positive amounts
GROUP BY article_name;
```

### For Audit/Tracking Purposes

If you need to track WHY items were voided:

1. Check if it was a transfer using the timestamp matching logic
2. Log the source and destination accounts
3. Track the user who performed the void

## Limitations

1. **No explicit reason field** - Barsy API doesn't provide void reasons
2. **Timestamp precision** - Relies on exact timestamp match
3. **Manual voids** - Items voided for quality issues, customer complaints, etc. appear as "pure voids"

## UI Implementation

The transactions page (`/dashboard/transactions`) now shows void type indicators:

### Visual Indicators

| Status          | Badge                             | Row Color             |
| --------------- | --------------------------------- | --------------------- |
| Sale (positive) | Green "Sale" badge                | Default               |
| Transfer        | Blue "Transfer" badge with ↔ icon | Light blue background |
| Pure Void       | Red "Voided" badge with ✕ icon    | Light red background  |

### Filter Options

A new "Void Status" filter is available with these options:

- **All Orders** - Shows everything
- **Positive Only** - Only shows sales (positive amounts)
- **All Voided** - Shows all voided items (transfers + pure voids)
- **Transfers Only** - Only shows items moved to another table
- **Pure Voids Only** - Only shows cancelled items

### Views Supported

The void type detection works in all three transaction views:

1. **Individual Orders** - Each order row shows its status
2. **Grouped by Transaction** - Line items show void type
3. **Accounts (Bills)** - Line items show void type

## Related Files

- `/lib/services/barsy-api.ts` - Barsy API client
- `/lib/actions/barsy-orders.ts` - Order handling with void type detection
- `/lib/actions/barsy-transactions.ts` - Grouped transactions with void type
- `/lib/actions/barsy-accounts-sync.ts` - Account transactions with void type
- `/app/dashboard/transactions/page.tsx` - UI implementation

## Future Considerations

If Barsy adds a `storno_reason` or `transfer_account_id` field in their API:

1. Update the sync logic to capture this field
2. Add the field to `barsy_orders.raw_data` or as a dedicated column
3. Update detection queries to use the explicit field instead of timestamp matching


