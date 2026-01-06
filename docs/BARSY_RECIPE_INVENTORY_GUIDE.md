# Barsy Recipe & Inventory Depletion System

## Overview

Complete implementation for syncing recipes (Bill of Materials) and inventory from Barsy, with automatic inventory depletion when items are sold.

## Features Implemented

### 1. Database Tables

**`barsy_recipes`** - Product recipes/BOM
- Maps finished products to ingredients
- Stores quantity needed per unit
- Links to `barsy_articles`

**`barsy_store_outs`** - Manual inventory write-offs
- Tracks inventory depletion/waste
- Includes reason codes
- Depot/warehouse specific

**`barsy_store_amounts`** - Current inventory levels
- Real-time stock quantities
- Cost price tracking
- Multi-depot support

**`barsy_inventory_depletion_log`** - Automatic depletion tracking
- Logs auto deductions when sales occur
- Audit trail for inventory changes
- Links orders to ingredient usage

### 2. API Methods

Added to `lib/services/barsy-api.ts`:

```typescript
getArticleRecipe(articleId)       // Get recipe for a product
getStoreAmounts(depotId?)          // Current inventory levels
getStoreAmountsByDate(date)        // Historical inventory
getStoreOuts(filters)              // Inventory write-offs
getAllStoreOuts(dateFrom, dateTo)  // Paginated store outs
```

### 3. Sync Actions

**`barsy-recipes-sync.ts`**
- Syncs all product recipes from Barsy
- Fetches recipe for each article
- Maps ingredients to finished products

**`barsy-storeouts-sync.ts`**
- Syncs manual inventory write-offs
- Syncs current inventory levels
- Date-range filtering for store outs

**`barsy-transactions-sync.ts` (Enhanced)**
- Now includes automatic inventory depletion
- When transaction created → recipes applied → inventory reduced
- Logs all depletion for audit trail

### 4. UI Updates

Updated `/admin/barsy-sync` page with new sections:

**Master Data**
- Categories
- Articles
- Users
- **Recipes (BOM)** ← NEW

**Inventory** ← NEW SECTION
- **Current Stock** - Sync inventory levels
- **Store Outs (Write-offs)** - Sync manual depletion

**Sales & Transactions**
- Orders
- Accounts (Bills)
- Create Transactions (now with auto inventory depletion)

## How It Works

### Sync Flow

```
1. Sync Recipes
   ↓
   Fetches recipe for each article (Mojito = Rum + Mint + Lime)
   ↓
   Stores in barsy_recipes table

2. Sync Store Amounts
   ↓
   Gets current inventory levels for all ingredients
   ↓
   Stores in barsy_store_amounts table

3. Sync Orders → Create Transactions
   ↓
   When Mojito sold (quantity: 2)
   ↓
   Looks up recipe: 50ml Rum, 10g Mint, 30ml Lime per Mojito
   ↓
   Calculates depletion: 100ml Rum, 20g Mint, 60ml Lime
   ↓
   Updates barsy_store_amounts (reduces quantities)
   ↓
   Logs depletion in barsy_inventory_depletion_log
```

### Automatic Inventory Depletion

When `syncBarsyTransactions()` is called:

1. Creates transaction from orders
2. For each order line item:
   - Looks up recipe in `barsy_recipes`
   - Calculates ingredient depletion (quantity sold × recipe quantity)
   - Updates `barsy_store_amounts` (reduces stock)
   - Logs in `barsy_inventory_depletion_log`

### Example

**Scenario:** 3 Mojitos sold on Nov 5, 2025

**Recipe in Barsy:**
```
Mojito (article_id: 123)
├── Rum (50ml)
├── Mint (10g)
├── Lime juice (30ml)
└── Soda water (100ml)
```

**When synced:**
```sql
-- Transaction created
INSERT INTO transactions (total_amount: 45.00, quantity: 3)

-- Inventory depleted
UPDATE barsy_store_amounts 
SET quantity = quantity - 150 WHERE barsy_article_id = 234 -- Rum (-150ml)

UPDATE barsy_store_amounts 
SET quantity = quantity - 30 WHERE barsy_article_id = 235 -- Mint (-30g)

-- Depletion logged
INSERT INTO barsy_inventory_depletion_log
(barsy_article_id: 123, barsy_ingredient_article_id: 234, quantity_sold: 3, quantity_depleted: 150)
```

## Database Migration

Run this SQL in Supabase:

```bash
supabase_barsy_recipes_storeouts_migration.sql
```

Creates all 4 new tables with proper indexes and foreign keys.

## API Documentation

Barsy API methods used:

- `Articles_getrecipearticles` - Get recipe ingredients
- `Store_amounts` - Current inventory
- `Storeouts_getlist` - Inventory write-offs
- [Store Outs Documentation](https://docs.lukanet.com/barsy.api/methods/storeouts/index.html)

## Usage

### Via UI

1. Go to `/admin/barsy-sync`
2. Select location
3. Click **"Sync Recipes (BOM)"** - Fetches all recipes
4. Click **"Current Stock"** - Syncs inventory levels
5. Click **"Sync All Data"** - Full sync with auto depletion

### Programmatically

```typescript
import { syncBarsyRecipes } from '@/lib/actions/barsy-recipes-sync';
import { syncBarsyStoreAmounts } from '@/lib/actions/barsy-storeouts-sync';

// Sync recipes first
await syncBarsyRecipes(locationId);

// Sync inventory levels
await syncBarsyStoreAmounts(locationId);

// Then sync transactions (will auto-deplete inventory)
await syncBarsyTransactions(locationId, mementoLocationId, dateFrom, dateTo);
```

## Benefits

✅ **Automatic Inventory Tracking** - No manual deduction needed
✅ **Recipe-Based Depletion** - Accurate ingredient usage
✅ **Audit Trail** - Complete log of all depletion
✅ **Multi-Depot Support** - Track inventory per location
✅ **Historical Data** - See inventory over time
✅ **Write-off Tracking** - Manual depletion (spoilage, waste)

## Next Steps

1. Run the database migration
2. Sync recipes for your products
3. Sync current inventory levels
4. Sync transactions - inventory will auto-deplete
5. View `barsy_inventory_depletion_log` for audit trail

## Notes

- Recipes must be synced before transactions for depletion to work
- Inventory won't go below 0 (protected with `Math.max(0, quantity)`)
- Each sale logs depletion for audit compliance
- Store outs track manual write-offs separately

---

**Implementation Date:** November 5, 2025
**Status:** ✅ Complete

