# Barsy Complete Data Sync - Implementation Guide

## ✅ What Was Implemented

Comprehensive raw data sync from Barsy API to Memento system, enabling:
- **COGS Tracking**: Actual purchase costs from supplier invoices
- **Cash Reconciliation**: Payment tracking and reconciliation
- **Complete Master Data**: All configuration and reference data
- **Full Transaction History**: Complete audit trail

---

## 📊 Implemented Sync Features

### 1. **Master Data Syncs**

#### Suppliers (`barsy_suppliers`)
- Supplier information
- Contact details
- Payment terms
- **Use**: Track vendor relationships and payment schedules

#### Depots/Warehouses (`barsy_depots`)
- Warehouse locations
- Storage areas
- **Use**: Multi-location inventory management

#### Places (`barsy_places`)
- Tables and service areas
- Seating capacity
- Position mapping
- **Use**: Table management and order routing

#### POSes/Cash Registers (`barsy_poses`)
- Terminal information
- Fiscal device data
- **Use**: Cash register reconciliation

#### Payment Methods (`barsy_payment_methods`)
- Cash, card, online, etc.
- **Use**: Payment method analysis

#### Tax Groups (`barsy_tax_groups`)
- VAT rates
- Tax categories
- **Use**: Tax reporting and compliance

---

### 2. **Transaction Data Syncs**

#### Store Loads (`barsy_store_loads` + `barsy_store_load_items`) ⭐ CRITICAL
**Purpose:** Track supplier purchases and actual COGS

**Data Structure:**
- **Header**: Invoice details, supplier, dates, totals
- **Line Items**: Individual products, quantities, costs

**Key Fields:**
- `doc_num`: Invoice number
- `doc_date`: Invoice date
- `supplier_id`, `supplier_name`
- `total_sum`: Total purchase amount
- `total_paid`: Amount paid
- `paid_due_date`: Payment due date
- `status`: 0=Open, 1=Closed

**Use Cases:**
- Calculate actual COGS per product
- Track supplier spending
- Monitor payment due dates
- Analyze purchase patterns
- Calculate profitability margins

#### Payments (`barsy_payments`) 💰
**Purpose:** Cash and payment reconciliation

**Data Structure:**
- Payment type (income/expense)
- Amount and method
- Associated order/bill
- Timestamp and user

**Use Cases:**
- Daily cash reconciliation
- Payment method analysis
- Supplier payment tracking
- Cash flow management

---

### 3. **Already Synced (Enhanced)**

These were previously implemented and are still available:
- ✅ Orders/Sales
- ✅ Accounts (bills/tabs)
- ✅ Store Outs (waste/write-offs)
- ✅ Articles & Categories
- ✅ Recipes (BOM)
- ✅ Users

---

## 🗄️ Database Schema

### Master Data Tables
```sql
- barsy_suppliers
- barsy_depots
- barsy_places
- barsy_poses
- barsy_payment_methods
- barsy_tax_groups
- barsy_currencies
```

### Transaction Tables
```sql
- barsy_store_loads (header)
- barsy_store_load_items (line items)
- barsy_payments
- barsy_store_moves (transfers)
- barsy_store_productions (prep)
- barsy_store_revisions (audits)
```

### Customer Data
```sql
- barsy_clients
```

### Tracking
```sql
- barsy_sync_status (sync history per type)
```

---

## 🚀 How to Use

### Step 1: Run Database Migration

```bash
# Connect to your Supabase database and run:
psql <connection_string> < supabase_barsy_complete_sync_schema.sql
```

### Step 2: Access Sync Interface

Navigate to: `http://localhost:3000/admin/barsy-sync`

### Step 3: Sync Master Data (First Time)

Click the "🎯 All Master Data" button to sync:
- Suppliers
- Depots
- Places
- POSes
- Payment Methods
- Tax Groups

**Frequency**: Weekly or when changes occur in Barsy

### Step 4: Sync Store Loads (Purchases)

1. Select date range (e.g., last month)
2. Click "💰 Store Loads (Purchases)" button
3. Wait for sync to complete (may take 1-2 minutes for large datasets)

**Frequency**: Weekly or after receiving supplier invoices

### Step 5: Sync Payments

1. Select date range
2. Click "💵 Payments" button

**Frequency**: Daily for cash reconciliation

### Step 6: Sync Transaction Data

Continue syncing other data types as needed:
- Orders
- Accounts
- Store Outs

---

## 📈 Reporting & Analysis

### Calculate COGS

```sql
-- Daily COGS from store loads
SELECT 
  doc_date as date,
  SUM(total_sum) as total_purchases,
  COUNT(*) as invoice_count
FROM barsy_store_loads
WHERE status = 1  -- closed/completed
  AND doc_date BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY doc_date
ORDER BY doc_date;
```

### Product Purchase Costs

```sql
-- Average cost per product
SELECT 
  bli.article_name,
  COUNT(*) as purchase_count,
  SUM(bli.quantity) as total_quantity,
  AVG(bli.unit_price) as avg_cost,
  SUM(bli.total_price) as total_spent
FROM barsy_store_load_items bli
JOIN barsy_store_loads bl ON bli.store_load_id = bl.id
WHERE bl.doc_date >= '2025-01-01'
GROUP BY bli.article_name
ORDER BY total_spent DESC;
```

### Supplier Analysis

```sql
-- Spending by supplier
SELECT 
  supplier_name,
  COUNT(*) as invoice_count,
  SUM(total_sum) as total_spending,
  SUM(total_sum - total_paid) as outstanding_amount
FROM barsy_store_loads
WHERE doc_date >= '2025-01-01'
GROUP BY supplier_name
ORDER BY total_spending DESC;
```

### Payment Reconciliation

```sql
-- Daily cash vs card
SELECT 
  DATE(payment_date) as date,
  paymethod_name,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount
FROM barsy_payments
WHERE payment_type = 1  -- income
  AND payment_date >= '2025-01-01'
GROUP BY DATE(payment_date), paymethod_name
ORDER BY date, paymethod_name;
```

---

## 🔄 Sync Frequency Recommendations

| Data Type | Frequency | Priority | Reason |
|-----------|-----------|----------|---------|
| **Store Loads** | Weekly | 🔴 Critical | COGS tracking |
| **Payments** | Daily | 🔴 Critical | Cash reconciliation |
| Master Data | Weekly | 🟡 Medium | Changes infrequent |
| Orders | Daily | 🟢 High | Sales tracking |
| Store Outs | Daily | 🟢 High | Waste tracking |
| Inventory Levels | Weekly | 🟡 Medium | On-demand |

---

## 🎯 Key Use Cases Enabled

### 1. **Actual COGS Calculation**
- Sync store loads with line items
- Match purchased articles to sold items
- Calculate profit margins per product
- Track COGS trends over time

### 2. **Cash Reconciliation**
- Sync payments daily
- Compare to POS totals
- Identify discrepancies
- Track payment methods

### 3. **Supplier Management**
- Track purchase history
- Monitor payment schedules
- Analyze spending patterns
- Identify best suppliers

### 4. **Profitability Analysis**
```
Revenue (from Orders) - COGS (from Store Loads) - Labor (from schedule) = Gross Profit
```

### 5. **Inventory Valuation**
- Current stock levels
- Average purchase costs
- Inventory value calculation

---

## 📁 File Structure

```
lib/
├── services/
│   └── barsy-api.ts                    ✅ Enhanced with new methods
├── actions/
│   ├── barsy-master-data-sync.ts       ✅ NEW: All master data
│   ├── barsy-storeloads-sync.ts        ✅ NEW: Purchase invoices
│   ├── barsy-payments-sync.ts          ✅ NEW: Payment tracking
│   ├── barsy-sync.ts                   ✅ Existing
│   ├── barsy-transactions-sync.ts      ✅ Existing
│   ├── barsy-accounts-sync.ts          ✅ Existing
│   ├── barsy-recipes-sync.ts           ✅ Existing
│   └── barsy-storeouts-sync.ts         ✅ Existing

app/admin/barsy-sync/
└── page.tsx                            ✅ Enhanced UI

supabase_barsy_complete_sync_schema.sql ✅ NEW: Complete schema
```

---

## 🔍 Debugging & Monitoring

### Check Sync Status

```sql
SELECT 
  sync_type,
  last_sync_at,
  records_synced,
  last_sync_success,
  error_message
FROM barsy_sync_status
WHERE barsy_location_id = 1
ORDER BY last_sync_at DESC;
```

### Verify Data

```sql
-- Check store loads
SELECT COUNT(*), MIN(doc_date), MAX(doc_date)
FROM barsy_store_loads;

-- Check store load items
SELECT COUNT(*)
FROM barsy_store_load_items;

-- Check payments
SELECT COUNT(*), MIN(payment_date), MAX(payment_date)
FROM barsy_payments;
```

---

## ⚠️ Important Notes

1. **Date Ranges**: Store loads and payments require date ranges - use appropriate ranges for your needs

2. **Large Datasets**: First sync may take several minutes for large date ranges (10,000+ records)

3. **Master Data First**: Always sync master data before transaction data for proper foreign key relationships

4. **Incremental Sync**: After initial full sync, use shorter date ranges (e.g., last week) for regular updates

5. **Raw Data**: All synced data includes `raw_data` JSONB field with complete Barsy response for audit trail

---

## 🎉 What's Next?

### Immediate Benefits
- ✅ Calculate actual COGS
- ✅ Track supplier invoices
- ✅ Reconcile daily cash
- ✅ Analyze purchase patterns
- ✅ Monitor payment schedules

### Future Enhancements
- 📊 Automated profitability reports
- 🔔 Payment due date alerts
- 📈 COGS trend analysis
- 💰 Supplier spending insights
- 📉 Inventory valuation reports

---

## 📞 Support

**Documentation**: See `BARSY_SYNCABLE_DATA.md` for complete data catalog

**API Docs**: https://docs.lukanet.com/barsy.api/
- Email: janny.stamenov@gmail.com
- Password: janny.stamenov621

---

*Last Updated: November 5, 2025*
*Implementation: Complete Barsy Data Sync*

