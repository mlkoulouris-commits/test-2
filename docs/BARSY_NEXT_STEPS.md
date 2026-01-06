# Barsy Integration - Next Steps

## ✅ COMPLETED

### 1. API Client Enhanced ✅
- **File**: `lib/services/barsy-api.ts`
- **Features Added**:
  - `getAllArticles()` - Auto-pagination (1000/batch)
  - `getCategories()` - Flat or tree structure
  - `getUsers()` - Staff list
  - `getClients()` - Customer data
  - `getAccounts()` - Bills/tabs
  - `getPayments()` - Payment transactions

### 2. Database Schema ✅
- **File**: `supabase_barsy_extended_schema.sql`
- **Tables Created**:
  - `barsy_articles` - Products/menu items
  - `barsy_categories` - Product categories
  - `barsy_staff` - Users/employees
  - `barsy_clients` - Customers
  - `barsy_accounts` - Bills/tabs
  - `barsy_payments` - Payment transactions

### 3. Sync Actions ✅
- **File**: `lib/actions/barsy-sync.ts`
- **Functions Updated**:
  - `syncBarsyArticles()` - With pagination support
  - `syncBarsyCategories()` - Enhanced schema
  - `syncBarsyUsers()` - Maps to barsy_staff table
  - `syncBarsyOrders()` - Already working ✅

### 4. Admin UI ✅
- **File**: `app/admin/barsy-sync/page.tsx`
- **Features**:
  - Location selector
  - Individual sync buttons (Categories, Articles, Users, Orders)
  - "Sync All" button - syncs everything in sequence
  - Sync history display
  - Loading states with progress messages

---

## 🚀 IMMEDIATE NEXT STEPS

### Step 1: Run Database Migration (REQUIRED)

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

2. Run the extended schema:
```bash
# Copy contents from:
supabase_barsy_extended_schema.sql
```

3. Verify tables created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'barsy_%'
ORDER BY table_name;
```

**Expected tables**:
- barsy_locations
- barsy_articles
- barsy_categories
- barsy_staff
- barsy_clients
- barsy_accounts
- barsy_payments
- barsy_orders
- barsy_sync_log

### Step 2: Insert Location Configurations (REQUIRED)

Run the setup script:
```bash
# Copy contents from:
setup_barsy_locations.sql
```

This inserts:
- Vitosha (memento4.barsy.bg)
- NDK (memento3.barsy.bg)

### Step 3: Test Sync (READY TO RUN)

Navigate to: `http://localhost:3000/admin/barsy-sync`

#### Test Sequence:

**3.1 Test Categories First** (No dependencies)
```
1. Select "Vitosha" location
2. Click "Sync Categories"
3. Should sync ~50-100 categories
```

**3.2 Test Articles** (Depends on categories)
```
1. Click "Sync Articles"
2. Should sync ~500-2000 products
3. May take 30-60 seconds due to pagination
```

**3.3 Test Users** (No dependencies)
```
1. Click "Sync Users"
2. Should sync ~10-50 staff members
```

**3.4 Test Orders** (Already working)
```
1. Click "Sync October Orders"
2. Should sync October 2025 data
3. May take 1-2 minutes for large datasets
```

**3.5 Test "Sync All"**
```
1. Click "Sync All (October 2025)"
2. Syncs in sequence: Categories → Articles → Users → Orders
3. Total time: 2-4 minutes
```

**3.6 Repeat for NDK**
```
1. Select "NDK" location
2. Run same tests
3. Verify data segregation
```

---

## 📊 VERIFICATION QUERIES

### Check Synced Data

```sql
-- Articles count by location
SELECT 
  l.name,
  COUNT(*) as article_count
FROM barsy_articles a
JOIN barsy_locations l ON l.id = a.location_id
GROUP BY l.name;

-- Categories count by location
SELECT 
  l.name,
  COUNT(*) as category_count
FROM barsy_categories c
JOIN barsy_locations l ON l.id = c.location_id
GROUP BY l.name;

-- Staff count by location
SELECT 
  l.name,
  COUNT(*) as staff_count
FROM barsy_staff s
JOIN barsy_locations l ON l.id = s.location_id
GROUP BY l.name;

-- Orders count by location (October 2025)
SELECT 
  l.name,
  COUNT(*) as order_count,
  MIN(order_date) as first_order,
  MAX(order_date) as last_order
FROM barsy_orders o
JOIN barsy_locations l ON l.id = o.location_id
WHERE order_date >= '2025-10-01' AND order_date < '2025-11-01'
GROUP BY l.name;

-- Sync history
SELECT 
  l.name,
  sync_type,
  records_synced,
  success,
  synced_at
FROM barsy_sync_log sl
JOIN barsy_locations l ON l.id = sl.location_id
ORDER BY synced_at DESC
LIMIT 20;
```

### Check Data Quality

```sql
-- Active articles with prices
SELECT 
  l.name,
  COUNT(*) FILTER (WHERE is_active = true) as active_articles,
  COUNT(*) FILTER (WHERE is_for_sale = true) as for_sale,
  COUNT(*) FILTER (WHERE price IS NOT NULL) as with_price,
  AVG(price) as avg_price
FROM barsy_articles a
JOIN barsy_locations l ON l.id = a.location_id
GROUP BY l.name;

-- Category tree depth
SELECT 
  l.name,
  COUNT(*) FILTER (WHERE parent_id IS NULL) as root_categories,
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) as sub_categories
FROM barsy_categories c
JOIN barsy_locations l ON l.id = c.location_id
GROUP BY l.name;

-- Active staff
SELECT 
  l.name,
  COUNT(*) FILTER (WHERE is_active = true) as active_staff,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_staff
FROM barsy_staff s
JOIN barsy_locations l ON l.id = s.location_id
GROUP BY l.name;
```

---

## 🔍 TROUBLESHOOTING

### Issue: Tables Don't Exist
```
Error: relation "barsy_articles" does not exist
```
**Solution**: Run `supabase_barsy_extended_schema.sql` in Supabase SQL Editor

### Issue: No Locations Found
```
Error: Location not found
```
**Solution**: Run `setup_barsy_locations.sql` to insert location configs

### Issue: Sync Returns 0 Records
**Possible Causes**:
1. API credentials incorrect
2. Barsy API endpoint down
3. No data in date range

**Debug**:
```typescript
// Check browser console for API responses
// Look for error messages in sync action
```

### Issue: Duplicate Key Violation
```
Error: duplicate key value violates unique constraint
```
**Solution**: This is normal - it means sync was run twice. Upsert will update existing records.

### Issue: Sync Taking Too Long
**Expected Times**:
- Categories: 5-10 seconds
- Articles: 30-60 seconds (1000+ items)
- Users: 5-10 seconds
- Orders: 60-120 seconds (10,000+ orders)

**If Longer**: Check network connection and API response times

---

## 📈 EXPECTED RESULTS

### Vitosha Location
```
✅ Categories: 50-150
✅ Articles: 500-2000
✅ Users: 10-30
✅ Orders (Oct 2025): 5,000-20,000
```

### NDK Location
```
✅ Categories: 50-150
✅ Articles: 500-2000
✅ Users: 10-30
✅ Orders (Oct 2025): 5,000-20,000
```

---

## 🎯 WHAT'S NEXT (After Testing)

1. **Schedule Automated Syncs**
   - Set up cron jobs or scheduled functions
   - Orders: Hourly
   - Articles: Daily
   - Categories: Weekly
   - Users: Weekly

2. **Build Data Viewing Pages**
   - `/admin/barsy-data/articles` - Browse products
   - `/admin/barsy-data/categories` - Category tree
   - `/admin/barsy-data/staff` - Staff list
   - `/admin/barsy-data/orders` - Order history

3. **Add Remaining 14 Locations**
   - Insert into `barsy_locations` table
   - Test sync for each
   - Verify data segregation

4. **Build Analytics Dashboards**
   - Sales by location
   - Top products
   - Staff performance
   - Revenue trends

5. **Implement Advanced Features**
   - Clients sync
   - Accounts (bills) sync
   - Payments sync
   - Inventory tracking

---

## 📞 SUPPORT

- **API Documentation**: https://docs.lukanet.com/barsy.api/
- **Method Catalog**: See `BARSY_API_CATALOG.md`
- **Implementation Plan**: See `BARSY_IMPLEMENTATION_PLAN.md`

---

*Ready to sync data from Barsy! 🚀*
*Start with Step 1: Run the database migration*

