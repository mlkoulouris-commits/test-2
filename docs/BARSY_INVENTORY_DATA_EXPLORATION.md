# Barsy Inventory Data Exploration

## Summary

This document summarizes what data is available from Barsy API for inventory tracking and valuation.

---

## 1. Current Inventory (`barsy_store_amounts`)

**Status:** ❌ No data synced yet - table is empty

**Expected Fields (from code):**

- `barsy_article_id` (integer)
- `article_name` (string)
- `quantity` (numeric) - mapped from `amount` field
- `unit` (string) - mapped from `amount_unit`
- `depot_id` (integer, nullable)
- `depot_name` (string, nullable)
- `cost_price` (numeric, nullable) - **Key for valuation**
- `total_value` (numeric, nullable) - **Key for valuation**
- `raw_data` (JSONB) - Full API response

**API Method:** `Store_amounts` (current) or `Store_amounts_by_date` (historical)

**Action Needed:** Run `syncBarsyStoreAmounts()` to populate this table

---

## 2. Purchases/Store Loads (`barsy_store_load_items`)

**Status:** ✅ Has data (2,563 records found)

**Fields Available:**

- `barsy_article_id` (integer)
- `article_name` (string)
- `quantity` (numeric) - mapped from `amount`
- `unit_price` (numeric) - mapped from `delivery_price` or `current_price`
- `total_price` (numeric)
- `raw_data` (JSONB)

**Raw Data Structure (from Barsy API):**

```json
{
  "article_id": 78,
  "article_name": "Разтворимо Кафе",
  "amount": 12, // Quantity
  "delivery_price": 21.006666667, // Unit price (preferred)
  "current_price": 21.006666667, // Fallback unit price
  "store_load_id": 25737,
  "store_load_row_id": 113050,
  "tax": 20,
  "discount": 0,
  "sale_current_price": 4.8,
  "original_article_name": "Разтворимо Кафе",
  "uuid": "c7e5974b-a389-11f0-8c68-30b5c2029033",
  "remote_ref_id": null
}
```

**Key Observations:**

- ✅ Quantity available (`amount`)
- ✅ Unit price available (`delivery_price` preferred, `current_price` fallback)
- ✅ Total price available (calculated or provided)
- ✅ Linked to `barsy_store_loads` via `store_load_id` (has `doc_date` for date filtering)

**Use Case:** Track inventory increases from purchases

---

## 3. Write-offs (`barsy_store_outs`)

**Status:** ⚠️ Minimal data (1 record found, mostly nulls)

**Fields Available:**

- `barsy_article_id` (integer)
- `article_name` (string)
- `quantity` (numeric) - mapped from `amount`
- `unit` (string) - mapped from `amount_unit`
- `depot_id` (integer)
- `depot_name` (string)
- `reason_id` (integer)
- `reason_name` (string)
- `store_out_date` (timestamp)
- `raw_data` (JSONB)

**Key Observations:**

- ✅ Quantity available
- ✅ Date available for filtering
- ⚠️ Limited sample data - need to sync more

**Use Case:** Track inventory decreases from waste/spoilage/write-offs

---

## 4. Sales Depletion (`barsy_inventory_depletion_log`)

**Status:** ✅ Has data

**Fields Available:**

- `barsy_article_id` (integer) - Finished product sold
- `barsy_ingredient_article_id` (integer) - Ingredient depleted
- `quantity_sold` (numeric) - Quantity of finished product
- `quantity_depleted` (numeric) - Quantity of ingredient used
- `unit` (string, nullable)
- `order_date` (timestamp)

**Sample Data:**

```
barsy_article_id: 598 (finished product)
barsy_ingredient_article_id: 103 (ingredient)
quantity_sold: 1.0000
quantity_depleted: 0.0000  ⚠️ Note: This is 0 in sample - may need investigation
order_date: 2025-10-01
```

**Key Observations:**

- ✅ Tracks automatic inventory depletion from sales
- ✅ Has date for filtering
- ⚠️ `quantity_depleted` is 0 in samples - may indicate recipe sync issue or sample data

**Use Case:** Track inventory decreases from sales (via recipes)

---

## 5. Cost Price & Valuation

### Current State:

- **Store Amounts:** `cost_price` and `total_value` fields exist but no data yet
- **Store Load Items:** Has `unit_price` (from `delivery_price`) but no aggregated cost price per article

### Strategy for Valuation:

**Option 1: Use Barsy's Calculated Cost Price** (Recommended)

- Fetch `cost_price` from `Store_amounts_by_date` API for historical dates
- Barsy calculates this using their costing method (likely weighted average)
- Most accurate for valuation

**Option 2: Calculate from Store Loads**

- Calculate weighted average cost from `barsy_store_load_items`
- Formula: `SUM(quantity * unit_price) / SUM(quantity)` per article
- More complex but gives us control

**Option 3: Use Last Purchase Price**

- Use `unit_price` from most recent `barsy_store_load_items` per article
- Simplest but least accurate

**Recommendation:** Use Option 1 (Barsy's cost_price) for comparison, Option 2 for calculated values

---

## 6. Data Availability Summary

| Data Source                    | Status           | Quantity | Price | Date | Notes                     |
| ------------------------------ | ---------------- | -------- | ----- | ---- | ------------------------- |
| **Store Amounts (Current)**    | ❌ Empty         | ✅       | ✅    | ✅   | Need to sync              |
| **Store Amounts (Historical)** | ❓ Unknown       | ✅       | ✅    | ✅   | API available, not tested |
| **Store Load Items**           | ✅ 2,563 records | ✅       | ✅    | ✅   | Linked via store_loads    |
| **Store Outs**                 | ⚠️ Minimal       | ✅       | ❌    | ✅   | No price data             |
| **Depletion Log**              | ✅ Has data      | ✅       | ❌    | ✅   | No price data             |

---

## 7. Next Steps

1. **Sync Current Inventory:**

   ```typescript
   await syncBarsyStoreAmounts(locationId);
   ```

   This will populate `barsy_store_amounts` with current levels and cost prices.

2. **Test Historical Inventory API:**

   - Call `getStoreAmountsByDate(date)` for a past date
   - Verify structure matches current inventory
   - Check if `cost_price` and `total_value` are populated

3. **Verify Depletion Log:**

   - Check why `quantity_depleted` is 0 in samples
   - May need to review recipe sync or depletion calculation

4. **Create Baseline Snapshot:**
   - After syncing current inventory, create a snapshot
   - Use this as starting point for historical calculations

---

## 8. Field Mapping Reference

### Barsy API → Database Mapping

**Store Amounts:**

- `amount` → `quantity`
- `amount_unit` → `unit`
- `cost_price` → `cost_price` (direct)
- `total_value` → `total_value` (direct)

**Store Load Items:**

- `amount` → `quantity`
- `delivery_price` or `current_price` → `unit_price`
- `total_price` → `total_price` (direct)

**Store Outs:**

- `amount` → `quantity`
- `amount_unit` → `unit`
- `ref_date` or `date` → `store_out_date`

---

## 9. Questions to Answer

1. ✅ **What fields does Barsy return?** → Documented above
2. ❓ **Does `Store_amounts_by_date` return same structure?** → Need to test API
3. ❓ **Is `cost_price` always populated?** → Need to check after sync
4. ❓ **Why is `quantity_depleted` 0?** → Need to investigate
5. ❓ **Do we need to handle multiple depots?** → Yes, `depot_id` is available

---

## Files Created

1. `explore-barsy-inventory-data.ts` - TypeScript script to explore data (can be run with `npx tsx`)
2. `explore-barsy-inventory.sql` - SQL queries to inspect database
3. `BARSY_INVENTORY_DATA_EXPLORATION.md` - This document




