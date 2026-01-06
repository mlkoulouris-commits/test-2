# Barsy API Integration - Implementation Plan

## 📋 EXECUTIVE SUMMARY

Successfully accessed Barsy API documentation and cataloged **all available methods** across 40+ categories. Ready to implement comprehensive data sync for 16 locations (starting with Vitosha and NDK).

**Current Status**: ✅ Orders sync implemented for October 2025

---

## 🎯 PHASE 1: CORE SALES DATA (Priority: Highest) ⬅️ START HERE

### 1.1 Orders (COMPLETED ✅)
- **Status**: Implemented and tested
- **Method**: `Orders_getlist`
- **Pagination**: 10,000 records/request
- **Features**: 
  - Date range filtering
  - Client-side date validation
  - Automatic pagination handling
  - Per-location segregation

### 1.2 Articles (Products) - NEXT
```typescript
// Method: Articles_getlist
// Pagination: 1,000 records/request (note: different from Orders!)
// Important fields:
- article_id, article_name, barcode
- price, cost_price
- category_id
- is_active, is_for_sale
- recipe data (if semi-prepared)
- images, descriptions
```

**Database Schema**:
```sql
CREATE TABLE barsy_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id),
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT NOT NULL,
  barcode TEXT,
  price NUMERIC(10,2),
  cost_price NUMERIC(10,2),
  category_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  is_for_sale BOOLEAN DEFAULT true,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_article_id)
);
```

### 1.3 Categories
```typescript
// Method: Categories_getlist (flat) or Categories_gettree (hierarchical)
// No pagination limits mentioned
```

**Database Schema**:
```sql
CREATE TABLE barsy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id),
  barsy_category_id INTEGER NOT NULL,
  category_name TEXT NOT NULL,
  parent_id INTEGER,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_category_id)
);
```

### 1.4 Users (Staff)
```typescript
// Method: Users_getlist
// Key fields: user_id, username, first_name, last_name, role
```

**Database Schema**:
```sql
CREATE TABLE barsy_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id),
  barsy_user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role_name TEXT,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_user_id)
);
```

---

## 🎯 PHASE 2: SALES ANALYTICS (Priority: High)

### 2.1 Sales Reports
```typescript
// Reports_sales_by_articles - Aggregated sales by product
// Reports_sales_by_accounts - Sales by account/bill
// Reports_sales_by_orders_details - Detailed order breakdown
```

**Use Case**: Pre-aggregated data for faster analytics without processing raw orders

### 2.2 Accounts (Bills/Tabs)
```typescript
// Method: Accounts_getlist
// Key fields: account_id, open_date, close_date, total_amount, status
// Includes: orders, payments, client info
```

### 2.3 Payments
```typescript
// Method: Payments_getlist  
// Key fields: payment_id, amount, payment_method, date
// Links to: accounts, client_orders
```

---

## 🎯 PHASE 3: CUSTOMER DATA (Priority: Medium)

### 3.1 Clients (Customers)
```typescript
// Method: Clients_getlist
// Key fields: client_id, name, phone, email, points
// Unique by: name/phone/email (configurable)
```

### 3.2 Client Orders (Delivery/Takeout)
```typescript
// Method: Clientorders_getlist
// Different from POS accounts - for delivery orders
```

---

## 🎯 PHASE 4: INVENTORY (Priority: Medium-Low)

### 4.1 Current Stock Levels
```typescript
// Method: Store_amounts or Reports_store_amounts_by_date_and_barsys
```

### 4.2 Store Movements
```typescript
// Storeloads_getlist - Incoming inventory
// Storemoves_getlist - Internal transfers  
// Storeouts_getlist - Outgoing/waste
```

---

## 🔧 TECHNICAL IMPLEMENTATION

### File Structure
```
lib/services/
  barsy-api.ts              ✅ (exists)
  
lib/actions/
  barsy-sync.ts             ✅ (exists - orders only)
  barsy-articles-sync.ts    ⬜ (new)
  barsy-categories-sync.ts  ⬜ (new)
  barsy-users-sync.ts       ⬜ (new)
  barsy-reports-sync.ts     ⬜ (new)

app/admin/barsy-sync/
  page.tsx                  ✅ (exists)
```

### Barsy API Service Expansion
```typescript
// lib/services/barsy-api.ts - Add methods:

async getArticles(filters: any, offset?: number, length?: number)
async getAllArticles(filters?: any) // Auto-paginate (1000/batch)

async getCategories(filters?: any) 
async getCategoriesTree()

async getUsers(filters?: any)

async getSalesByArticles(dateFrom: string, dateTo: string)
async getSalesByAccounts(dateFrom: string, dateTo: string)

async getClients(filters?: any)
async getAccounts(filters?: any)
async getPayments(filters?: any)
```

### Database Migrations
```sql
-- Run in Supabase SQL Editor:
-- 1. barsy_articles table (see Phase 1.2)
-- 2. barsy_categories table (see Phase 1.3)
-- 3. barsy_staff table (see Phase 1.4)
-- 4. Future: clients, accounts, payments, inventory
```

### Sync Actions Pattern
```typescript
// Standard pattern for all sync actions:

export async function syncBarsyArticles(
  locationId: string,
  filters?: any
) {
  try {
    // 1. Get location config
    const location = await getLocation(locationId);
    
    // 2. Initialize API client
    const client = new BarsyApiClient(location.barsy_url, ...);
    
    // 3. Fetch all data (with pagination)
    const response = await client.getAllArticles(filters);
    
    // 4. Transform and insert
    const articles = response.data.map(transformArticle);
    await upsertArticles(locationId, articles);
    
    // 5. Log sync
    await logSync('articles', articles.length, locationId);
    
    return { success: true, recordsSynced: articles.length };
  } catch (error) {
    await logSyncError('articles', error, locationId);
    throw error;
  }
}
```

---

## 📊 UI ENHANCEMENTS

### Admin Sync Page (`app/admin/barsy-sync/page.tsx`)

**Current**: Orders only
**Proposed**:

```tsx
// Tabs for each data type:
<Tabs>
  <Tab value="orders" label="Orders" />        ✅
  <Tab value="articles" label="Articles" />    ⬜
  <Tab value="categories" label="Categories" /> ⬜
  <Tab value="users" label="Staff" />          ⬜
  <Tab value="reports" label="Reports" />      ⬜
  <Tab value="clients" label="Customers" />    ⬜
  <Tab value="inventory" label="Inventory" />  ⬜
</Tabs>

// Each tab shows:
- Last sync time
- Record count
- Sync button (with date range picker for dated data)
- View synced data button
- Status indicators
```

### Data Viewing Pages
```
app/admin/barsy-data/
  articles/page.tsx         - View synced products
  categories/page.tsx       - View category tree
  staff/page.tsx            - View staff list
  orders/page.tsx           - View synced orders (enhanced)
  reports/page.tsx          - View analytics
```

---

## ⚙️ CONFIGURATION & SETTINGS

### Sync Frequency Recommendations
- **Orders**: Hourly or on-demand
- **Articles**: Daily (or when menu changes)
- **Categories**: Weekly (rarely changes)
- **Users**: Weekly (staff changes)
- **Reports**: Daily (for analytics)
- **Inventory**: Daily (if tracked)

### Location Management
```typescript
// Current locations:
1. Vitosha (memento4.barsy.bg)
2. NDK (memento3.barsy.bg)

// Future: 14 more locations
// Each needs entry in barsy_locations table
```

### Error Handling
- Retry logic for transient failures
- Detailed error logging
- Email/Slack notifications for sync failures
- Manual re-sync capability
- Partial sync rollback on critical errors

---

## 📈 METRICS & MONITORING

### Sync Dashboard (Future)
```
- Total records synced (all locations)
- Last sync time per location/data type
- Sync success rate
- Average sync duration
- Error frequency
- Data freshness indicators
```

### Alerts
```
- Sync failure > 2 consecutive attempts
- Sync duration > threshold
- Large data discrepancies
- API connection issues
```

---

## 🚀 ROLLOUT PLAN

### Week 1: Core Master Data
- [ ] Implement Articles sync
- [ ] Implement Categories sync
- [ ] Implement Users sync
- [ ] Test with Vitosha & NDK
- [ ] Verify data accuracy

### Week 2: Sales Analytics
- [ ] Implement Reports sync
- [ ] Implement Accounts sync
- [ ] Implement Payments sync
- [ ] Build viewing interfaces

### Week 3: Customer Data
- [ ] Implement Clients sync
- [ ] Implement Client Orders sync
- [ ] Build customer analytics

### Week 4: Inventory (Optional)
- [ ] Implement inventory sync
- [ ] Build inventory reports

### Week 5+: Scale & Optimize
- [ ] Add remaining 14 locations
- [ ] Implement automated scheduling
- [ ] Build unified reporting
- [ ] Optimize query performance

---

## 🔒 SECURITY CONSIDERATIONS

- [ ] Credentials encrypted in database
- [ ] API keys in environment variables
- [ ] Role-based access to sync functions
- [ ] Audit log for all sync operations
- [ ] Data retention policies
- [ ] PII handling compliance

---

## 📝 NEXT IMMEDIATE STEPS

1. **Test Current Orders Sync** - Verify October 2025 data is accurate
2. **Implement Articles Sync** - Most critical for menu management
3. **Implement Categories Sync** - Needed for article organization
4. **Test with Both Locations** - Ensure data segregation works
5. **Build Data Viewing UI** - Allow verification of synced data

---

## 📞 SUPPORT & DOCUMENTATION

- **API Docs**: https://docs.lukanet.com/barsy.api/
- **Postman**: https://www.postman.com/lukanet/lukanet-public/documentation/pm1rtc4/barsy-api
- **Documentation Access**: janny.stamenov@gmail.com / janny.stamenov621
- **Implementation Guide**: See BARSY_API_CATALOG.md

---

*Created: November 4, 2025*
*Status: Phase 1.1 Complete (Orders) | Phase 1.2 Ready to Start (Articles)*

