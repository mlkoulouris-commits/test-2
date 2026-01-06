# Barsy Data Sync Guide

## Overview

This system syncs sales, products, users, and categories from multiple Barsy API locations into Memento's Supabase database. Each location's data is kept completely separate to avoid conflicts.

## Architecture

### Database Schema

**Location-Segregated Tables:**
- `barsy_locations` - Stores API credentials for each location (Vitosha, NDK, future locations)
- `barsy_orders` - Sales transactions, segregated by `location_id`
- `barsy_articles` - Products/menu items, segregated by `location_id`
- `barsy_users` - Staff members, segregated by `location_id`
- `barsy_categories` - Product categories, segregated by `location_id`
- `barsy_sync_log` - Tracks all sync operations

**Key Design:**
- Each location has unique `barsy_article_id`, `barsy_user_id`, etc.
- Same product at different locations = different records
- Data unification happens later via business logic
- Raw JSON stored in `raw_data` field for complete audit trail

### API Service

**File:** `lib/services/barsy-api.ts`

```typescript
const client = createBarsyClient('vitosha');
await client.getOrders('2025-10-01', '2025-10-31');
```

**Supported Operations:**
- `getOrders(dateFrom, dateTo)` - Fetch sales for date range
- `getArticles()` - Fetch all products
- `getUsers()` - Fetch all staff
- `getCategories()` - Fetch all categories
- `getArticle(id)` - Fetch single product

### Server Actions

**File:** `lib/actions/barsy-sync.ts`

All sync operations are server actions with proper error handling and logging.

## Setup Instructions

### 1. Run Database Migrations

```bash
# In Supabase SQL Editor or via CLI
psql $DATABASE_URL -f supabase_barsy_schema.sql
psql $DATABASE_URL -f setup_barsy_locations.sql
```

### 2. Access Admin Interface

Navigate to `/admin/barsy-sync` in your browser.

### 3. Sync October 2025 Data

**Option 1: Sync All Data**
- Select location (Vitosha or NDK)
- Click "Sync All (October 2025)"
- Wait for completion

**Option 2: Granular Sync**
- Sync Categories first
- Sync Articles
- Sync Users
- Sync October Orders

### 4. Verify Data

```sql
-- Check orders synced for Vitosha
SELECT 
  COUNT(*) as total_orders,
  SUM(current_price * amount) as total_sales
FROM barsy_orders
WHERE location_id = (SELECT id FROM barsy_locations WHERE name = 'Vitosha')
  AND order_date >= '2025-10-01'
  AND order_date < '2025-11-01';

-- Check articles count by location
SELECT 
  l.name,
  COUNT(a.id) as article_count
FROM barsy_locations l
LEFT JOIN barsy_articles a ON a.location_id = l.id
GROUP BY l.name;
```

## Data Structure Examples

### Orders (Sales)
```json
{
  "location_id": "uuid-of-vitosha",
  "barsy_order_id": 1903463,
  "order_date": "2025-10-18T14:04:12Z",
  "barsy_article_id": 14,
  "article_name": "Капучино Гранде",
  "amount": 1,
  "current_price": 3.60,
  "actual_price": 6.90,
  "order_status": 2,
  "order_status_title": "Изпълнено",
  "barsy_user_id": 2,
  "user_name": "Бар 1 смяна",
  "raw_data": { /* complete Barsy API response */ }
}
```

### Articles (Products)
```json
{
  "location_id": "uuid-of-ndk",
  "barsy_article_id": 1350,
  "article_name": "Rive Di Santo Stefano",
  "current_price": 63.00,
  "actual_price": 63.00,
  "stream_name": "Bar",
  "is_for_sale": true,
  "tax": 20,
  "raw_data": { /* complete Barsy API response */ }
}
```

## Scaling to 14+ Locations

### Adding New Locations

1. **Insert Location Config:**
```sql
INSERT INTO barsy_locations (name, barsy_url, username, password_encrypted)
VALUES ('New Location', 'https://newlocation.barsy.bg', 'username', 'password');
```

2. **Sync Data:**
- Go to `/admin/barsy-sync`
- Select new location
- Click "Sync All"

### Automated Syncing (Future)

Create cron job or scheduled function:
```typescript
// Run daily at 2 AM
export async function scheduledSync() {
  const locations = await getBarsyLocations();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  for (const location of locations.data) {
    await syncBarsyOrders(
      location.id,
      yesterday.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
  }
}
```

## Data Unification (Phase 2)

When ready to unify data across locations:

```sql
-- Create unified products view
CREATE VIEW unified_products AS
SELECT 
  article_name,
  AVG(current_price) as avg_price,
  COUNT(DISTINCT location_id) as location_count,
  ARRAY_AGG(DISTINCT l.name) as locations
FROM barsy_articles a
JOIN barsy_locations l ON l.id = a.location_id
WHERE a.is_for_sale = true
GROUP BY article_name;

-- Create unified sales view
CREATE VIEW unified_sales AS
SELECT 
  DATE(order_date) as sale_date,
  l.name as location,
  article_name,
  SUM(amount) as total_quantity,
  SUM(current_price * amount) as total_revenue
FROM barsy_orders o
JOIN barsy_locations l ON l.id = o.location_id
GROUP BY DATE(order_date), l.name, article_name;
```

## Monitoring & Maintenance

### Check Sync Status
```sql
SELECT 
  l.name,
  sl.sync_type,
  sl.status,
  sl.records_synced,
  sl.completed_at
FROM barsy_sync_log sl
JOIN barsy_locations l ON l.id = sl.location_id
ORDER BY sl.created_at DESC
LIMIT 20;
```

### Find Failed Syncs
```sql
SELECT * FROM barsy_sync_log
WHERE status = 'failed'
ORDER BY created_at DESC;
```

## Security Notes

⚠️ **Important:** Current implementation stores passwords in plain text. For production:

1. Use environment variables for credentials
2. Encrypt passwords using Supabase Vault or similar
3. Rotate credentials regularly
4. Use read-only API accounts where possible

## Support & Troubleshooting

### Common Issues

**Issue:** Sync fails with "Location not found"
- **Solution:** Ensure location exists in `barsy_locations` table

**Issue:** Duplicate orders
- **Solution:** System uses `UNIQUE(location_id, barsy_order_id)` - duplicates are updated, not inserted

**Issue:** Missing data for October
- **Solution:** Check if Barsy API returned data for that date range

### Debug Mode

Enable verbose logging by checking `raw_data` field:
```sql
SELECT raw_data FROM barsy_orders LIMIT 1;
```

## Next Steps

1. ✅ Database schema created
2. ✅ API service built
3. ✅ Sync functions implemented
4. ✅ Admin UI available
5. 🔄 Test October 2025 sync
6. 📊 Build analytics dashboard
7. 🔗 Create data unification layer
8. 🤖 Automate daily syncs

