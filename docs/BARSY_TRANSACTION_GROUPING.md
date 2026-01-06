# Barsy Transaction Grouping - How Receipts Work

## Overview
In Barsy's POS system, transactions are grouped into **Accounts** (bills/receipts), where each account contains multiple **Orders** (line items).

---

## Data Structure

### 1. **Account (Сметка)** = Bill/Receipt/Tab
- Represents one complete transaction (e.g., a table's bill at a restaurant)
- Contains: account_id, account_number, open_date, close_date, total_amount, paid_amount
- Associated with: client, place (table), user (server/bartender)
- API: `Accounts_getlist` (17 methods available)

### 2. **Order (Поръчка)** = Line Item
- Represents one product on a bill
- Contains: order_id, article_name, amount (quantity), actual_price, order_date
- Links to parent account via `account_id` field
- API: `Orders_getlist` with `extra_properties: { account_data: true }`

---

## Example Transaction

```
Account #456789 (Table 12, Server: Maria)
├── Order #4160498: Campari x2 @ €6.90 = €13.80
├── Order #4160531: Beer x1 @ €6.50 = €6.50
├── Order #4160541: Campari x2 @ €6.90 = €13.80
├── Order #4160542: Vermouth x2 @ €7.90 = €15.80
└── Order #4160543: Vodka Lime Soda x1 @ €13.90 = €13.90
────────────────────────────────────────────────────
Total: €63.80
```

---

## API Integration

### Fetching Orders WITH Account Data

**Previous Implementation** (Missing account_id):
```json
{
  "Orders_getlist": {
    "filters": {
      "ref_date": ["2025-10-01", "2025-10-31"]
    }
  }
}
```

**Updated Implementation** ✅ (Includes account_id):
```json
{
  "Orders_getlist": {
    "filters": {
      "ref_date": ["2025-10-01", "2025-10-31"]
    },
    "extra_properties": {
      "account_data": true,
      "client_data": true
    }
  }
}
```

### Response Structure

```json
{
  "Orders_getlist": [
    {
      "order_id": 4160498,
      "article_name": "Campari",
      "amount": 2.000,
      "actual_price": 6.90,
      "order_date": "2025-10-28 19:45:00",
      "account_id": 456789,  // ← Links to parent bill
      "account_data": {
        "account_number": "T12-001",
        "open_date": "2025-10-28 19:30:00",
        "close_date": "2025-10-28 21:15:00",
        "total_amount": 63.80,
        "place_id": 12,
        "user_id": 5
      },
      "client_data": {
        "client_id": 123,
        "name": "John Doe"
      }
    }
  ]
}
```

---

## Database Changes

### Updated barsy_orders Table
After re-syncing with `extra_properties`, each order will now include:
```sql
SELECT 
  barsy_order_id,
  article_name,
  amount,
  actual_price,
  raw_data->>'account_id' as account_id,  -- Now populated! ✅
  raw_data->'account_data' as account_info
FROM barsy_orders;
```

### Grouping Orders by Account
```sql
SELECT 
  raw_data->>'account_id' as account_id,
  raw_data->'account_data'->>'account_number' as account_number,
  raw_data->'account_data'->>'open_date' as bill_opened,
  COUNT(*) as line_items,
  SUM((amount::numeric) * (actual_price::numeric)) as total_amount,
  jsonb_agg(
    jsonb_build_object(
      'article', article_name,
      'qty', amount,
      'price', actual_price
    )
  ) as items
FROM barsy_orders
WHERE raw_data->>'account_id' IS NOT NULL
GROUP BY 
  raw_data->>'account_id',
  raw_data->'account_data'->>'account_number',
  raw_data->'account_data'->>'open_date'
ORDER BY bill_opened DESC;
```

---

## Implementation Status

### ✅ Completed
1. **Updated Orders API** - Now requests `account_data` and `client_data`
2. **Accounts Sync** - Can sync full account/bill data via `syncBarsyAccounts`
3. **Transaction Views** - Dashboard supports:
   - Individual Orders view
   - Grouped Transactions view (by account_id)
   - Accounts (Bills) view

### 📋 Next Steps
1. **Re-sync Orders** - Re-run order sync to populate `account_id` field
   ```
   Navigate to: http://localhost:3001/admin/barsy-sync
   Select date range
   Click "Sync Orders"
   ```

2. **Verify Grouping** - Check that orders now have account_id:
   ```sql
   SELECT 
     COUNT(*) as total_orders,
     COUNT(DISTINCT raw_data->>'account_id') as unique_bills,
     AVG(items_per_bill) as avg_items_per_bill
   FROM (
     SELECT 
       raw_data->>'account_id' as account_id,
       COUNT(*) as items_per_bill
     FROM barsy_orders
     WHERE raw_data->>'account_id' IS NOT NULL
     GROUP BY raw_data->>'account_id'
   ) stats;
   ```

3. **View Transactions** - Use the dashboard at `http://localhost:3001/dashboard/transactions`
   - Switch between "Individual Orders", "Grouped Transactions", or "Accounts (Bills)"
   - Filter by location and date range

---

## Key Insights

### Why Orders Didn't Have account_id Initially
- The Barsy API doesn't return `account_id` by default
- Must explicitly request via `extra_properties: { account_data: true }`
- This is documented in their API but easy to miss

### Transaction Lifecycle
1. Customer sits at table → Account opens
2. Customer orders drinks → Orders added to account
3. Customer orders more → More orders added to same account
4. Customer asks for check → Account closes
5. Customer pays → Payment linked to account

### Benefits of Proper Grouping
- **Accurate analytics**: See true transaction counts vs individual item counts
- **Better insights**: Average bill size, items per transaction
- **Correct reporting**: Match POS reports exactly
- **Customer tracking**: See full purchase history per visit

---

## Documentation References

- **Barsy API Docs**: https://docs.lukanet.com/barsy.api/
- **Orders API**: https://docs.lukanet.com/barsy.api/methods/Orders_getlist.html
- **Accounts API**: https://docs.lukanet.com/barsy.api/methods/Accounts_getlist.html
- **Postman Collection**: https://www.postman.com/lukanet/lukanet-public/documentation/pm1rtc4/barsy-api

---

*Last Updated: November 5, 2025*

