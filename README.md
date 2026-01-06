# Memento - Restaurant Management System

A comprehensive multi-location restaurant and bar management system built with Next.js 15, Supabase, and Shadcn UI.

## Features

### User Management
- Multi-role system: Admin, Manager, Location Manager, Staff Member
- User profiles with first/last name
- Location-based access control

### Location & Brand Management
- Multi-brand support
- Location categories (Bar, Cafe, Nightclub, Restaurant, Lounge)
- Location details (address, phone, hours of operation)
- Track location closures

### Sales Tracking
- Daily cash and card sales per location
- Multiple POS terminal support
- Business date calculation (8am cutoff - sales before 8am count for previous day)
- Transaction recording with line items
- Payment methods: Cash, Card, Invoice, Comp
- Comp tracking with approval workflow

### Inventory Management
- Product catalog with categories
- Raw materials tracking
- Recipe management (COGS calculation)
- Inventory audits with variance tracking
- Supplier invoice management
- Location-specific product pricing

### Vendor Management
- Supplier database
- Contact information
- Payment terms tracking

### Staff Scheduling
- Shift scheduling per location
- Clock in/out functionality
- Manual entry support for managers
- Hours worked calculation

### Expense Tracking
- Expense categories
- Capital vs consumable assets
- Invoice tracking
- Location-specific expenses

### Audit Trail
- Complete audit logging for all changes
- Track who changed what and when
- Historical record keeping

## Tech Stack

- **Framework**: Next.js 15 (App Router, React 19 RC)
- **Database**: Supabase (PostgreSQL)
- **UI**: Shadcn UI with Vercel theme
- **Styling**: Tailwind CSS v4
- **Forms**: React Hook Form + Zod
- **Date Handling**: date-fns with Sofia timezone support

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ADMIN_PASSWORD=Memento!
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Admin Access

- Navigate to `/admin/login`
- Enter the admin password (default: `Memento!`)

## Database Schema

The database uses integer IDs for all tables except `auth.users` (which uses UUIDs). Key tables include:

- `profiles` - User profiles with roles
- `brands` - Restaurant/bar brands
- `locations` - Physical locations
- `products` - Menu items
- `raw_materials` - Ingredients and supplies
- `vendors` - Suppliers
- `daily_sales` - Sales tracking
- `transactions` - Individual transactions
- `scheduled_shifts` / `actual_shifts` - Staff scheduling
- `supplier_invoices` - Inventory purchases
- `expenses` - Operational expenses
- `audit_logs` - Complete audit trail

## Key Concepts

### Business Date Calculation
- All timestamps stored in UTC
- Displayed in Europe/Sofia timezone
- Sales before 8am count for the previous business day
- Helps handle late-night operations accurately

### Access Control
- No RLS policies (API-only access)
- Role-based access control in application layer
- Users can be assigned to multiple locations

### Audit Trail
- Automatic logging via database triggers
- Tracks INSERT, UPDATE, DELETE operations
- Stores old and new values as JSONB
- Links changes to users and timestamps

## Development Notes

- All Supabase access goes through server actions (no direct client access)
- Server Components used by default
- Client Components only for interactivity
- Zod schemas for input validation
- Early returns for better readability

## License

Proprietary - All rights reserved
