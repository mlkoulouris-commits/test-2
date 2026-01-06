# ✅ Barsy Integration - Setup Complete

## What's Ready

### 1. Database Schema ✅
All tables created in Supabase:
- `barsy_locations` - 2 locations configured (Vitosha, NDK)
- `barsy_orders` - Ready for October 2025 sales data
- `barsy_articles` - Ready for products
- `barsy_users` - Ready for staff data
- `barsy_categories` - Ready for product categories
- `barsy_sync_log` - Tracks all operations

### 2. API Service ✅
**File:** `lib/services/barsy-api.ts`
- Multi-location support
- HTTP Basic Auth
- Methods: getOrders, getArticles, getUsers, getCategories

### 3. Server Actions ✅
**File:** `lib/actions/barsy-sync.ts`
- `syncBarsyOrders()` - Pull sales for date range
- `syncBarsyArticles()` - Pull products
- `syncBarsyUsers()` - Pull staff
- `syncBarsyCategories()` - Pull categories
- Proper error handling & logging

### 4. Admin UI ✅
**File:** `app/admin/barsy-sync/page.tsx`
- Location selector
- One-click sync buttons
- Sync history viewer
- Progress tracking

## Location IDs (for API calls)
```
Vitosha: dca56dbc-b084-41d3-a578-3648c278504f
NDK:     382064d5-1542-487a-a566-db269d83526d
```

## Next Steps - TEST THE SYNC

### Option 1: Via Admin UI (Recommended)
1. Navigate to: `http://localhost:3000/admin/barsy-sync`
2. Select "Vitosha" or "NDK"
3. Click **"Sync All (October 2025)"**
4. Wait 30-60 seconds
5. Check results

### Option 2: Via SQL (Test Database)
```sql
-- Check if data synced
SELECT 
  l.name as location,
  COUNT(o.id) as total_orders,
  MIN(o.order_date) as first_order,
  MAX(o.order_date) as last_order,
  SUM(o.current_price * o.amount) as total_revenue
FROM barsy_orders o
JOIN barsy_locations l ON l.id = o.location_id
WHERE o.order_date >= '2025-10-01' 
  AND o.order_date < '2025-11-01'
GROUP BY l.name;

-- Check products synced
SELECT l.name, COUNT(*) as product_count
FROM barsy_articles a
JOIN barsy_locations l ON l.id = a.location_id
GROUP BY l.name;

-- Check sync log
SELECT 
  l.name,
  sl.sync_type,
  sl.status,
  sl.records_synced,
  sl.error_message,
  sl.completed_at
FROM barsy_sync_log sl
JOIN barsy_locations l ON l.id = sl.location_id
ORDER BY sl.created_at DESC
LIMIT 10;
```

## Architecture Highlights

### Location Segregation
Each Barsy location maintains **completely separate data**:
- Same product in Vitosha & NDK = 2 different records
- Different `barsy_article_id` per location
- Different prices, names, configurations possible
- No conflicts, no overwrites

### Data Flow
```
Barsy API → API Service → Server Actions → Supabase Tables
```

### Raw Data Storage
Every record stores complete JSON in `raw_data` field:
- Full audit trail
- Can re-process later
- Nothing lost from original API response

## Scaling to 14+ Locations

### Add New Location
```sql
INSERT INTO barsy_locations (name, barsy_url, username, password_encrypted)
VALUES ('Location Name', 'https://locationX.barsy.bg', 'username', 'password');
```

Then sync via admin UI or call `syncBarsyOrders(location_id, '2025-10-01', '2025-10-31')`.

### Automated Daily Sync (Future)
```typescript
// Run as cron job
async function dailySync() {
  const { data: locations } = await getBarsyLocations();
  const today = new Date().toISOString().split('T')[0];
  
  for (const loc of locations) {
    await syncBarsyOrders(loc.id, today, today);
  }
}
```

## Data Unification (Phase 2)

When ready to merge data across locations:

```sql
-- Unified sales view
CREATE VIEW unified_barsy_sales AS
SELECT 
  DATE(o.order_date) as sale_date,
  l.name as location,
  o.article_name,
  SUM(o.amount) as qty_sold,
  SUM(o.current_price * o.amount) as revenue,
  AVG(o.current_price) as avg_price
FROM barsy_orders o
JOIN barsy_locations l ON l.id = o.location_id
GROUP BY DATE(o.order_date), l.name, o.article_name
ORDER BY sale_date DESC, revenue DESC;
```

## What Each Table Stores

### `barsy_orders` (Sales Transactions)
- Individual line items from orders
- Timestamps, amounts, prices
- Staff who served
- POS/stream info
- Complete raw JSON

### `barsy_articles` (Products)
- Product details per location
- Current & actual prices
- Categories, streams
- Stock flags
- Complete raw JSON

### `barsy_users` (Staff)
- Staff members per location
- Names, roles
- Active/inactive status

### `barsy_categories` (Product Categories)
- Category hierarchy
- Paths (e.g., "Memento > Топли напитки > Dairy Alternatives")

## Security Notes

⚠️ **For Production:**
1. Move credentials to environment variables
2. Encrypt passwords (use Supabase Vault)
3. Use read-only Barsy API accounts
4. Implement rate limiting
5. Add authentication to admin UI

## Testing Checklist

- [ ] Access `/admin/barsy-sync`
- [ ] See both locations (Vitosha, NDK)
- [ ] Click "Sync All (October 2025)"
- [ ] Wait for completion (check sync history)
- [ ] Verify data in database (use SQL queries above)
- [ ] Check for errors in sync log
- [ ] Test individual syncs (categories, articles, users)
- [ ] Verify location segregation (same product = 2 records)

## Support Queries

### Debug Failed Sync
```sql
SELECT * FROM barsy_sync_log 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

### Sample Order Data
```sql
SELECT 
  o.order_date,
  o.article_name,
  o.amount,
  o.current_price,
  o.user_name,
  o.raw_data->>'order_status_title' as status
FROM barsy_orders o
WHERE o.location_id = 'dca56dbc-b084-41d3-a578-3648c278504f'
LIMIT 10;
```

### Check API Connectivity
The sync functions will test connectivity automatically. Check sync log for errors.

---

**Ready to sync!** Navigate to `/admin/barsy-sync` and pull October 2025 data. 🚀

