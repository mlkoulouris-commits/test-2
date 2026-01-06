# Quick Start Guide

## Testing the Application

### Start Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000

### Access Points

1. **Home Page**: http://localhost:3000
   - Redirects to `/admin`

2. **Admin Login**: http://localhost:3000/admin/login
   - Password: `Memento!`

3. **Admin Dashboard**: http://localhost:3000/admin
   - User Management
   - Brand Management
   - Location Management
   - Product Management
   - Vendor Management

4. **Main Dashboard**: http://localhost:3000/dashboard
   - Requires authenticated user
   - Sales, Transactions, Schedule, Inventory, Expenses, Reports

## Testing Workflow

### 1. Admin Access
```
1. Go to http://localhost:3000/admin/login
2. Enter password: Memento!
3. You should see the Admin Dashboard
```

### 2. Create Your First User
```
1. Click "User Management" or go to /admin/users
2. Click "Create User"
3. Fill in:
   - Email: test@example.com
   - Password: password123
   - First Name: John
   - Last Name: Doe
   - Role: Admin (or any role)
4. Click "Create User"
5. User should appear in the table
```

### 3. Create a Brand
```
1. Go to /admin/brands
2. Click "Create Brand"
3. Fill in:
   - Name: Sofia Restaurants
   - Description: Restaurant group in Sofia
4. Click "Create Brand"
5. Brand should appear in the table
```

### 4. Create a Location
```
1. Go to /admin/locations
2. Click "Create Location"
3. Fill in:
   - Name: Downtown Bar
   - Brand: Sofia Restaurants
   - Category: Bar
   - Address: 123 Main St, Sofia
   - Phone: +359 2 xxx xxxx
4. Click "Create Location"
5. Location should appear in the table
```

### 5. Create a Vendor
```
1. Go to /admin/vendors
2. Click "Create Vendor"
3. Fill in:
   - Name: Sofia Beverages Ltd
   - Contact Name: Ivan Petrov
   - Contact Email: ivan@sofiabev.bg
   - Contact Phone: +359 888 123 456
   - Payment Terms: Net 30
4. Click "Create Vendor"
5. Vendor should appear in the table
```

### 6. Create Products
```
1. Go to /admin/products
2. Click "Products" tab
3. Click "Create Product"
4. Fill in:
   - Name: Espresso
   - SKU: ESPR-001
   - Price: 3.50
   - Category: (select from dropdown)
5. Click "Create"
6. Product should appear in the table

Repeat for Raw Materials:
1. Click "Raw Materials" tab
2. Click "Create Raw Material"
3. Fill in:
   - Name: Coffee Beans
   - Unit of Measure: kg
   - Reorder Level: 10
4. Click "Create"
```

### 7. Test Database Functions
```sql
-- Via Supabase SQL Editor or MCP

-- Check business date calculation
SELECT calculate_business_date(NOW());
SELECT current_business_date();

-- Test audit logs
SELECT * FROM audit_logs ORDER BY changed_at DESC LIMIT 10;

-- View user profiles
SELECT p.*, u.email 
FROM profiles p 
JOIN auth.users u ON p.user_id = u.id;
```

## Database Access via MCP

You have access to the Supabase database via the `memento` MCP server:

```bash
# List all tables
mcp_memento_list_tables

# Execute SQL
mcp_memento_execute_sql "SELECT * FROM brands;"

# Apply migration
mcp_memento_apply_migration "migration_name" "SQL_QUERY"
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://nhzorpugwaeonrehtllx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_PASSWORD=Memento!
```

**Note**: The service role key is required for creating users in the admin panel.

## Common Issues

### Issue: Can't log in to admin
- **Solution**: Check that `ADMIN_PASSWORD` is set in `.env.local`
- Default password is `Memento!`

### Issue: User creation fails
- **Solution**: Check Supabase connection
- Verify that the Supabase URL and key are correct
- Check if auth.users table exists

### Issue: Database functions not working
- **Solution**: Ensure all migrations have been applied
- Check that database functions were created successfully

### Issue: Build fails
- **Solution**: Run `npm run build` to see specific errors
- Check TypeScript errors
- Verify all imports are correct

## Features Available Now

✅ **Working Features:**
- Admin authentication
- User management (create, list, activate/deactivate)
- Brand management (create, list, toggle status)
- Location management (create, list, toggle status)
- Vendor management (create, list, toggle status)
- Product management (create, list, toggle status)
- Raw materials (create, list)
- Product categories (create, list)
- Complete audit trail
- Business date calculation
- Sofia timezone support

🚧 **Coming Soon:**
- Daily sales entry
- Transaction recording
- Staff scheduling
- Inventory management
- Expense tracking
- Reporting & analytics

## Next Development Steps

To continue building:

1. **Sales Entry**: Implement `/dashboard/sales` page
2. **Transactions**: Build transaction recording UI
3. **Scheduling**: Create shift management interface
4. **Reports**: Add basic charts and analytics

See `IMPLEMENTATION.md` for detailed feature breakdown.

