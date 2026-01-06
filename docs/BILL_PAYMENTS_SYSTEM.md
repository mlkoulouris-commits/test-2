# Bill Payments System Documentation

## Overview

The system now supports recording payments that can be applied to multiple bills with full support for partial payments. Each payment is tracked separately and can be applied to one or more bills.

## Database Schema

### Tables

#### `bill_payments`
Stores individual payment transactions.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| payment_number | VARCHAR(50) | Auto-generated unique payment number (PAY-YYYYMMDD-XXXX) |
| payment_date | DATE | Date the payment was made |
| total_amount | NUMERIC(12,2) | Total payment amount |
| payment_method | VARCHAR(100) | Payment method (cash, bank_transfer, check, credit_card, other) |
| reference_number | VARCHAR(100) | Transaction/check number |
| notes | TEXT | Additional notes about the payment |
| created_by | VARCHAR(255) | Email of user who recorded the payment |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Record update timestamp |

#### `bill_payment_applications`
Links payments to bills (many-to-many relationship).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| payment_id | INT | Foreign key to bill_payments |
| bill_id | INT | Foreign key to barsy_store_loads (bills) |
| amount_applied | NUMERIC(12,2) | Amount of payment applied to this bill |
| created_at | TIMESTAMP | Record creation timestamp |

**Constraints:**
- UNIQUE(payment_id, bill_id) - A payment can only be applied once to each bill
- CHECK(amount_applied > 0) - Applied amounts must be positive

### Automatic Calculations

The `total_paid` field on bills is automatically calculated from payment applications using database triggers:
- When a payment application is added, the bill's `total_paid` is updated
- When a payment application is modified, the bill's `total_paid` is recalculated
- When a payment application is deleted, the bill's `total_paid` is reduced

**Important:** Never update `total_paid` directly - it's managed automatically by the system.

## Features

### 1. Multi-Bill Payments
- A single payment can be applied to multiple bills
- Useful when a vendor receives one check/transfer for multiple invoices

### 2. Partial Payments
- Any bill can receive multiple partial payments over time
- The system tracks each payment application separately
- Balance is automatically calculated as: `total_sum - total_paid`

### 3. Payment Tracking
- Each payment gets a unique auto-generated number (e.g., PAY-20241117-0001)
- Full audit trail with timestamps and user tracking
- Payment history viewable for each bill

### 4. Payment Methods
Supported payment methods:
- Cash
- Bank Transfer
- Check
- Credit Card
- Other

## User Interface

### Recording Payments

**Location:** Admin Bills Page → "Record Payment" button (top right)

**Workflow:**
1. Click "Record Payment"
2. Select payment date and method
3. Enter reference number (optional)
4. Select a vendor to see their unpaid bills
5. Add bills to the payment by clicking the "+" button
6. Adjust the amount to apply to each bill (defaults to full balance)
7. Add notes if needed (optional)
8. Review total payment amount
9. Click "Record Payment" to save

**Features:**
- Smart defaults: Amount defaults to full bill balance
- Validation: Ensures amounts don't exceed bill balances
- Real-time totals: Shows running total as you add bills
- Flexible: Apply full or partial payments to any bill

### Viewing Payment History

**Location:** Bills table → "History" button (for bills with payments)

**Shows:**
- All payments applied to the bill
- Payment number, date, and method
- Total payment amount vs. amount applied to this specific bill
- Reference numbers and who created the payment
- Payment notes
- Running total of all payments for the bill

### Bills Table Updates

The bills table now shows:
- **Amount**: Total bill amount
- **Paid**: Total amount paid (in green)
- **Balance**: Remaining balance (in orange)
- **History Button**: Available for bills with payments

## API / Server Actions

### `recordBillPayment`
Records a new payment and applies it to bills.

```typescript
recordBillPayment(
  paymentDate: string,
  totalAmount: number,
  applications: BillPaymentApplication[],
  paymentMethod?: string,
  referenceNumber?: string,
  notes?: string
)
```

**Parameters:**
- `paymentDate`: Date of payment (YYYY-MM-DD)
- `totalAmount`: Total payment amount
- `applications`: Array of `{ billId, amountApplied }`
- `paymentMethod`: Optional payment method
- `referenceNumber`: Optional transaction reference
- `notes`: Optional notes

**Returns:**
- `{ success: true, paymentId, paymentNumber }` on success
- `{ error: string }` on failure

**Validations:**
- Applications must sum to total amount (within 0.01 tolerance)
- Each application amount must be > 0
- Each application amount must be ≤ bill balance

### `getBillPaymentHistory`
Gets all payments applied to a specific bill.

```typescript
getBillPaymentHistory(billId: number)
```

**Returns:**
Array of payment applications with full payment details.

### `getUnpaidBillsByVendor`
Gets all unpaid bills for a vendor.

```typescript
getUnpaidBillsByVendor(vendorId?: number)
```

**Returns:**
Array of bills with outstanding balances, optionally filtered by vendor.

## Examples

### Example 1: Single Full Payment
Vendor has one bill for 1,500.00 лв. You receive a payment for the full amount.

1. Record payment for 1,500.00 лв
2. Apply full amount to the bill
3. Bill status changes to "Paid"

### Example 2: Partial Payment
Vendor has one bill for 5,000.00 лв. They pay 2,000.00 лв now.

1. Record payment for 2,000.00 лв
2. Apply 2,000.00 лв to the bill
3. Bill shows:
   - Amount: 5,000.00 лв
   - Paid: 2,000.00 лв
   - Balance: 3,000.00 лв
   - Status: "Partially Paid"

### Example 3: Multiple Partial Payments
Same bill, later they pay another 1,500.00 лв.

1. Record second payment for 1,500.00 лв
2. Apply 1,500.00 лв to the bill
3. Bill now shows:
   - Amount: 5,000.00 лв
   - Paid: 3,500.00 лв (2,000 + 1,500)
   - Balance: 1,500.00 лв
   - Status: "Partially Paid"
4. Payment history shows both payments

### Example 4: One Payment, Multiple Bills
Vendor has 3 bills: 500 лв, 750 лв, 1,200 лв. They send one payment of 2,450 лв.

1. Record payment for 2,450.00 лв
2. Add all three bills
3. Apply:
   - 500.00 лв to Bill #1
   - 750.00 лв to Bill #2
   - 1,200.00 лв to Bill #3
4. All three bills are marked as "Paid"
5. Payment history for each bill shows the same payment number

### Example 5: One Payment, Partial on Multiple Bills
Vendor has 2 bills: 2,000 лв and 3,000 лв. They pay 2,500 лв.

1. Record payment for 2,500.00 лв
2. Add both bills
3. Apply:
   - 2,000.00 лв to Bill #1 (full payment)
   - 500.00 лв to Bill #2 (partial payment)
4. Bill #1: Paid (balance: 0)
5. Bill #2: Partially Paid (balance: 2,500 лв)

## Migration

### Applied Migrations

1. **add_vendor_fk_to_bills** - Adds vendor_id foreign key to bills table
2. **bill_payments_system** - Creates payment tracking tables, triggers, and functions

### Database Functions

#### `generate_payment_number()`
Auto-generates sequential payment numbers in format PAY-YYYYMMDD-XXXX.
- Called automatically when creating a new payment
- Ensures unique numbers per day

#### `update_bill_total_paid()`
Trigger function that auto-updates bill's `total_paid` field.
- Triggered on INSERT, UPDATE, DELETE of payment applications
- Sums all applications for a bill
- Updates bill's updated_at timestamp

## Technical Notes

### Transaction Safety
The payment recording process uses error handling to maintain data integrity:
- If payment applications fail to insert, the payment record is deleted (rollback)
- Database triggers ensure total_paid is always accurate

### Data Validation
Multiple layers of validation:
- Frontend: Form validation, amount checking
- Backend: Business logic validation
- Database: Constraints and CHECK conditions

### Performance
Indexed columns for fast queries:
- `bill_payments.payment_date`
- `bill_payments.payment_number`
- `bill_payment_applications.payment_id`
- `bill_payment_applications.bill_id`
- `barsy_store_loads.vendor_id`

## Testing Checklist

- [ ] Record single bill payment (full amount)
- [ ] Record single bill payment (partial amount)
- [ ] Record multiple partial payments on same bill
- [ ] Record one payment applied to multiple bills
- [ ] View payment history for paid bill
- [ ] Verify bill totals update correctly
- [ ] Test payment method selection
- [ ] Test reference number and notes fields
- [ ] Verify payment number generation
- [ ] Test validation (overpayment prevention)
- [ ] Test multi-bill payment where amounts sum correctly
- [ ] Verify paid bills show as "Paid" status
- [ ] Verify partially paid bills show correct status

---

*Created: November 17, 2024*
*Version: 1.0*

