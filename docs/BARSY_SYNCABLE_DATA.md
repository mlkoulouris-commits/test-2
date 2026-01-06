# Barsy API - Syncable Raw Data

## Overview
Complete catalog of raw data available from Barsy API for syncing to Memento system.

---

## 🎯 PRIORITY DATA TO SYNC

### 1. **Store Loads (Storeloads_getlist)** - INVENTORY PURCHASES ✅ RECOMMENDED
**Purpose:** Track actual COGS, supplier invoices, and inventory costs

**API Method:** `Storeloads_getlist`

**Key Data Fields:**
- `store_load_id` - Unique purchase ID
- `supplier_id`, `supplier_name` - Supplier information
- `doc_num` - Invoice/document number
- `doc_date` - Invoice date
- `date` - Creation date in system
- `close_date` - Completion date
- `total_sum` - Total purchase amount
- `total_paid` - Amount paid
- `paid_due_date` - Payment due date
- `status` - [0=Open, 1=Closed]
- `depot_id` - Warehouse/location
- `barsy_id` - Business location
- `has_tax` - Tax included flag
- `price_mode` - Price includes VAT flag
- `currency_id`, `currency_rate` - Currency info
- `total_costs` - Additional costs
- **Details** (via `extra_properties: ['details']`) - Line items:
  - Article ID, name
  - Quantity purchased
  - Unit price
  - Total price per item

**Filters Available:**
- Date range (`$date`, `$doc_date`)
- Location (`$barsy_id`)
- Warehouse (`$depot_id`)
- Status (`$status`)
- Supplier

**Use Cases:**
- Calculate actual COGS
- Track supplier spending
- Monitor payment due dates
- Analyze purchase patterns
- Reconcile inventory costs

---

### 2. **Store Outs (Storeouts_getlist)** - INVENTORY WRITE-OFFS ✅ ALREADY SYNCED
**Purpose:** Track waste, spoilage, and inventory adjustments

**API Method:** `Storeouts_getlist`

**Key Data:**
- Write-off type (waste, damage, theft, etc.)
- Articles and quantities
- Reason codes
- Dates and user who performed action

**Status:** ✅ Already implemented in `barsy-storeouts-sync.ts`

---

### 3. **Sales Reports** - AGGREGATED SALES DATA

#### A. **Reports_sales_by_articles** - Product Performance
**Purpose:** Analyze sales by product with totals

**Key Data:**
- Article ID and name
- Total quantity sold
- Total revenue
- Number of transactions
- Average price
- By date range and location

#### B. **Reports_sales_by_accounts** - Bill/Tab Analysis
**Purpose:** Detailed account/bill breakdown

**Key Data:**
- Account/bill details
- Payment methods
- Staff member
- Table/location
- Time opened/closed
- Total amounts

#### C. **Reports_sales_by_orders** - Sales Summary
**Purpose:** Aggregated order data

**Key Data:**
- Total orders
- Total revenue
- By payment method
- By location
- Date ranges

#### D. **Reports_sales_by_orders_details** - Detailed Orders
**Purpose:** Line-by-line order breakdown

**Key Data:**
- Each order with line items
- Product details
- Quantities and prices
- Modifiers/add-ons
- Timestamps

#### E. **Reports_sales_by_tax_groups** - Tax Breakdown
**Purpose:** VAT/tax reporting

**Key Data:**
- Sales by tax rate
- Tax amounts collected
- Net vs gross amounts

---

### 4. **Payments (Payments_getlist)** - PAYMENT TRACKING
**Purpose:** Track all payment transactions

**API Method:** `Payments_getlist`

**Key Data:**
- Payment ID
- Amount
- Payment method
- Associated account/order
- Date and time
- User who processed
- Associated store load (for supplier payments)
- Client information

**Use Cases:**
- Reconcile cash vs card
- Track supplier payments
- Payment method analysis
- Cash flow tracking

---

### 5. **Accounts (Accounts_getlist)** - BILLS/TABS ✅ ALREADY SYNCED
**Purpose:** Detailed bill/tab data

**API Method:** `Accounts_getlist`

**Key Data:**
- Account details with orders
- Payment history
- Table/location
- Open/close times
- Staff assignments

**Status:** ✅ Already implemented in `barsy-accounts-sync.ts`

---

### 6. **Store Amounts (Store_amounts)** - CURRENT INVENTORY
**Purpose:** Current stock levels

**Key Data:**
- Article ID
- Current quantity
- Depot/warehouse
- Cost value
- Last update date

**Already Available:** Can be synced on-demand

---

### 7. **Suppliers (Suppliers_getlist)** - SUPPLIER MASTER DATA
**Purpose:** Supplier information

**Key Data:**
- Supplier ID and name
- Contact information
- Payment terms
- Associated articles
- Active status

---

### 8. **Invoices (Invoices_*)** - FISCAL DOCUMENTS
**Purpose:** Official invoice data

**API Methods:**
- `Invoices_getlist` - List invoices
- `Invoices_get` - Get specific invoice
- `Invoices_create` - Create invoice (if needed)

**Key Data:**
- Invoice number
- Client information
- Line items
- Tax amounts
- Payment status
- Fiscal device info

---

### 9. **Clients (Clients_getlist)** - CUSTOMER DATA
**Purpose:** Customer database

**API Method:** `Clients_getlist`

**Key Data:**
- Client ID
- Name, email, phone
- Client group
- Purchase history
- Loyalty points
- Custom fields

---

### 10. **Store Productions (Storeproductions_*)** - PRODUCTION TRACKING
**Purpose:** Track in-house production/prep

**Key Data:**
- Production batches
- Raw materials used
- Finished goods produced
- Labor time
- Costs

---

### 11. **Store Moves (Storemoves_*)** - INTERNAL TRANSFERS
**Purpose:** Track inventory movement between locations

**Key Data:**
- Transfer ID
- From/to depot
- Articles transferred
- Quantities
- Dates
- Status

---

### 12. **Store Revisions (Revisions_*)** - INVENTORY AUDITS
**Purpose:** Physical inventory counts

**Key Data:**
- Audit date
- Expected vs actual quantities
- Variances
- Adjustment reasons
- User performing audit

---

## 📊 RECOMMENDED SYNC PRIORITY

### **Tier 1: Essential for COGS & Profitability**
1. ✅ **Store Loads** - Actual purchase costs (NOT YET SYNCED)
2. ✅ **Orders** - Sales data (ALREADY SYNCED)
3. ✅ **Store Outs** - Write-offs (ALREADY SYNCED)
4. ⚠️ **Payments** - Payment reconciliation

### **Tier 2: Enhanced Reporting**
5. **Reports_sales_by_articles** - Product performance
6. **Reports_sales_by_accounts** - Bill analysis
7. **Suppliers** - Supplier master data
8. **Store Amounts** - Inventory levels

### **Tier 3: Advanced Features**
9. **Store Productions** - Production tracking
10. **Store Revisions** - Inventory audits
11. **Store Moves** - Internal transfers
12. **Invoices** - Fiscal documents
13. **Clients** - Customer data

---

## 🔧 IMPLEMENTATION NOTES

### Date Filtering
All methods support date range filters:
- `$date` - Creation date
- `$doc_date` - Document date  
- `$last_update` - Last modification date

### Pagination
- Default limit: 10,000 records
- Use `$offset` and `$length` for pagination
- Recommend batch syncing for large datasets

### Extra Properties
Many methods support `$extra_properties` for additional data:
- `all` - All basic data
- `details` - Line items/detailed data
- Specific fields as needed

### Location Filtering
Filter by:
- `$barsy_id` - Business location
- `$depot_id` - Warehouse/storage location

---

## 💾 DATABASE SCHEMA NEEDED

### For Store Loads Sync
```sql
CREATE TABLE barsy_store_loads (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id),
  store_load_id INT NOT NULL,
  supplier_id INT,
  supplier_name VARCHAR(255),
  doc_num VARCHAR(100),
  doc_date DATE,
  date TIMESTAMP,
  close_date TIMESTAMP,
  total_sum DECIMAL(10,2),
  total_paid DECIMAL(10,2),
  paid_due_date DATE,
  status INT,
  depot_id INT,
  has_tax INT,
  price_mode INT,
  currency_id INT,
  currency_rate DECIMAL(10,4),
  description TEXT,
  creator_id INT,
  user_name VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, store_load_id)
);

CREATE TABLE barsy_store_load_items (
  id SERIAL PRIMARY KEY,
  store_load_id INT REFERENCES barsy_store_loads(id),
  article_id INT,
  article_name VARCHAR(255),
  quantity DECIMAL(10,3),
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### For Payments Sync
```sql
CREATE TABLE barsy_payments (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id),
  payment_id INT NOT NULL,
  amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  payment_date TIMESTAMP,
  account_id INT,
  store_load_id INT,
  user_id INT,
  user_name VARCHAR(255),
  description TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, payment_id)
);
```

---

## 🚀 NEXT STEPS

1. **Implement Store Loads Sync** - Critical for COGS tracking
2. **Add Payments Sync** - For cash reconciliation
3. **Implement Sales Reports** - For aggregated analytics
4. **Add Suppliers Master Data** - For vendor management
5. **Implement Store Productions** - For prep/production tracking

---

*Last Updated: November 5, 2025*
*Documentation: https://docs.lukanet.com/barsy.api/*
*Login: janny.stamenov@gmail.com / janny.stamenov621*

