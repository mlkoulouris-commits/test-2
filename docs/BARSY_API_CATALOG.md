# Barsy API - Complete Method Catalog

## Overview
The Barsy API provides comprehensive access to all business data including sales, inventory, products, users, and reports.

---

## 🔥 CORE DATA CATEGORIES

### 1. SALES & TRANSACTIONS

#### **Orders (Поръчки)** - 1 method
- `Orders_getlist` - List of orders with pagination (limit: 10,000/request)
  - Filters: date_from, date_to, account_id, barsy_ids, period_id, etc.
  - Extra properties: account_data, client_data, modificators, article_attributes
  - Returns: OrderData with full order details

#### **Accounts (Сметки)** - 17 methods
- Account management (bills/tabs)
- Create, retrieve, update accounts
- Associate with clients, places, tables
- Close accounts and process payments

#### **Payments (Плащания)** - 2 methods
- `Payments_create` - Create new payment (income/expense)
- `Payments_getlist` - List payments with filters
- Can be associated with accounts, client orders, reservations, or store loads

#### **Reports (Справки)** - 9 methods
- `Reports_sales_by_accounts` - Sales by accounts
- `Reports_sales_by_articles` - Sales by articles
- `Reports_sales_by_orders` - Sales by orders (summary)
- `Reports_sales_by_orders_details` - Sales by orders (detailed)
- `Reports_sales_by_tax_groups` - Sales by tax groups
- `Reports_store_amounts_by_date_and_barsys` - Store amounts by date and location
- `Reports_store_list_details` - Store movements
- `Reports_storeloads_details` - Store loads detailed
- `Reports_lot_list_details` - Lot list details

---

### 2. PRODUCTS & CATALOG

#### **Articles (Артикули)** - 11 methods
- `Articles_getlist` - List all articles with filters
- `Articles_get` - Get detailed article data
- `Articles_create` - Create new article
- `Articles_update` - Update article
- `Articles_search` - Search articles by name, synonyms
- `Articles_checkbarcode` - Test barcodes
- `Articles_getrecipearticles` - Get recipe articles
- `Articles_save_recipe` - Save article recipe
- `Articles_setcats` - Categorize article
- `Articles_pricelists_save` - Save article to price list
- `Articles_getlistobject` - List articles (alternative)

#### **Categories (Категории)** - 7 methods
- Category management
- Tree structure support
- Article categorization

#### **Modificators (Модификатори)** - 2 methods
- Article modifiers/add-ons
- Custom modifications

#### **Article Details (Артикули характеристики)** - 3 methods
- Article attributes and characteristics

#### **Article Attribute Groups (Артикули атрибутни групи)** - 2 methods
- Grouped attributes for articles

#### **Article Combo Groups (Артикули комбо групи)** - 1 method
- Combo/bundle management

#### **Amount Types (Типове количества)** - 1 method
- Units of measurement (kg, l, pcs, etc.)

---

### 3. INVENTORY & WAREHOUSE

#### **Store (Склад)** - 2 methods
- `Store_amounts` - Current store amounts
- `Store_amounts_by_date` - Store amounts by specific date

#### **Store Loads (Склад зареждане)** - 5 methods
- Incoming inventory
- Stock replenishment

#### **Store Moves (Склад прехвърляне)** - 6 methods
- Transfer between warehouses
- Internal movements

#### **Store Outs (Склад изписвания)** - 4 methods
- Outgoing inventory
- Write-offs and removals

#### **Store Productions (Склад производство)** - 2 methods
- Production tracking
- Manufactured goods

#### **Store Revisions (Склад ревизии)** - 1 method
- Inventory audits
- Stock taking

#### **Depots (Складове)** - 4 methods
- Warehouse management
- Multiple depot support

#### **Packages (Разфасовки)** - 2 methods
- Packaging units
- Bulk/retail conversions

---

### 4. CUSTOMERS & RELATIONSHIPS

#### **Clients (Клиенти)** - 8 methods
- `Clients_create` - Create new client
- `Clients_getlist` - List clients
- `Clients_get` - Get client details
- `Clients_update` - Update client
- `Clients_search` - Search clients
- Unique by: name, phone, email, or username

#### **Client Groups (Клиентски групи)** - 1 method
- Customer segmentation
- Group-based pricing

#### **Client Orders (Клиентски заявки)** - 7 methods
- `Clientorders_create` - Create client order
- Order management separate from POS accounts
- Include orders, payments, client data

#### **Reservations (Резервации)** - 4 methods
- Table/resource reservations
- Booking management

---

### 5. USERS & STAFF

#### **Users (Потребители)** - 10 methods
- `Users_getlist` - List all users
- `Users_get` - Get user details
- `Users_create` - Create new user
- `Users_save` - Create/update user
- `Users_getcurrent` - Get current user
- `Users_getbyusername` - Get user by username
- `Users_setposes` - Set user POS access
- `Users_unsetposes` - Remove user POS access
- `Users_getrecentvisited` - Get user recent pages
- `Users_getlistenc` - List users (encrypted)

#### **Persons (Представители)** - 8 methods
- Sales representatives
- Person management

#### **Roles (Роли)** - 1 method
- User roles and permissions

#### **Working Shift (Работен график)** - 1 method
- Employee schedule management

---

### 6. PRICING & FINANCIAL

#### **Price Lists (Ценови правила)** - 15 methods
- Complex pricing rules
- Client-specific pricing
- Group pricing
- Time-based pricing
- Article-specific prices

#### **Tax Groups (Данъчни групи)** - 1 method
- VAT/Tax configuration
- Tax rate management

#### **Payment Methods (Начини на плащане)** - 1 method
- Cash, card, online, etc.
- Payment type configuration

#### **Currencies (Валути)** - 1 method
- Multi-currency support

#### **Invoices (Фактури)** - 4 methods
- Invoice generation
- Fiscal documents

---

### 7. CONFIGURATION & SETTINGS

#### **Barsys (Търговски обект)** - 2 methods
- Location/establishment info
- Business unit configuration

#### **Places (Места)** - 4 methods
- Tables, rooms, zones
- Service areas

#### **POS (Каси)** - 3 methods
- Cash register management
- POS terminal configuration

#### **Streams (Потоци)** - 1 method
- Order routing (kitchen, bar, etc.)
- Workflow management

#### **Reasons (Причини)** - 2 methods
- Void reasons
- Discount reasons

#### **Languages (Езици)** - 1 method
- Multi-language support
- Translations

#### **Destinations (Дестинации)** - 2 methods
- Delivery destinations

---

### 8. SUPPLIERS & PROCUREMENT

#### **Suppliers (Доставчици)** - 5 methods
- Supplier management
- Supplier articles
- Purchase tracking

#### **Speditors (Спедитори)** - 4 methods
- Shipping companies
- Delivery tracking

#### **Deals (Сделки)** - 1 method
- Business deals/contracts

---

### 9. DOCUMENTS & INTEGRATION

#### **E-Documents (Е-документи)** - 5 methods
- Electronic documents
- Document management

#### **Files (Файлове)** - 3 methods
- File uploads
- Attachments

#### **Forms (Форми)** - 1 method
- Custom forms

#### **Import (Импорт)** - 3 methods
- Bulk data import
- Data migration

#### **Messages (Съобщения)** - 1 method
- System messaging

#### **Webhooks** - 12 methods
- `Webhooks_subscribe` - Create webhook subscription
- Real-time event notifications
- External system integration

#### **Remote Systems** - 1 method
- External system connections

---

### 10. MISC

#### **Cards (Пакетни карти/Ваучери)** - 6 methods
- Gift cards
- Vouchers
- Loyalty cards

#### **Subscriptions (Абонаменти)** - 1 method
- Recurring services

#### **Misc (Разни)** - 3 methods
- Miscellaneous utilities

---

## 🎯 RECOMMENDED SYNC STRATEGY

### Priority 1: Core Sales Data
1. **Orders** (`Orders_getlist`) - All order/sales data ✅ IMPLEMENTED
2. **Accounts** - Account/bill data
3. **Payments** - Payment transactions
4. **Reports_sales_by_articles** - Aggregated sales by product

### Priority 2: Master Data
5. **Articles** (`Articles_getlist`) - Product catalog
6. **Categories** (`Categories_getlist`) - Product categories
7. **Users** (`Users_getlist`) - Staff/employees
8. **Clients** (`Clients_getlist`) - Customer database

### Priority 3: Configuration
9. **Places** - Tables/locations
10. **Payment Methods** - Payment types
11. **Tax Groups** - Tax configuration

### Priority 4: Inventory (if needed)
12. **Store amounts** - Current inventory levels
13. **Store loads** - Incoming inventory
14. **Store movements** - Inventory transactions

---

## 📊 DATA STRUCTURE

### Pagination
- Default limit: **10,000 records** per request
- Use `offset` and `length` parameters for pagination
- Client-side date filtering recommended for accuracy

### Authentication
- HTTP Basic Auth (username:password)
- Base64 encoded in Authorization header

### Date Formats
- ISO 8601: `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS`
- Timezone: Server time (typically Europe/Sofia)

### Request Format
```json
{
  "MethodName_action": {
    "param1": "value1",
    "filters": {...},
    "extra_properties": {...},
    "offset": 0,
    "length": 10000
  }
}
```

---

## 🔗 DOCUMENTATION LINKS

- **Full Documentation**: https://docs.lukanet.com/barsy.api/
- **Methods Index**: https://docs.lukanet.com/barsy.api/methods/index.html
- **Postman Collection**: https://www.postman.com/lukanet/lukanet-public/documentation/pm1rtc4/barsy-api
- **Integration Guide**: https://docs.lukanet.com/barsy.api/integrations/index.html

### Documentation Portal Login
- **Email**: janny.stamenov@gmail.com
- **Password**: janny.stamenov621

---

## 📝 NOTES

- Each location (Vitosha, NDK, etc.) has separate API endpoint
- Data is location-specific - sync separately per location
- Store raw JSON responses for future reference
- Monitor API response times for large datasets
- Consider implementing incremental syncs after initial full sync

---

*Last Updated: November 4, 2025*
*Documentation Access: janny.stamenov@gmail.com*

