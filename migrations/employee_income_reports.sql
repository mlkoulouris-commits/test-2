-- Employee Income Reports System
-- Enables staff to report income per shift/day with bill denominations
-- Managers approve reports before they update bank account balances

CREATE TABLE IF NOT EXISTS employee_income_reports (
  id SERIAL PRIMARY KEY,
  
  -- Core fields
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  shift_id INTEGER REFERENCES scheduled_shifts(id) ON DELETE SET NULL,
  
  -- Income amounts (calculated from bill_breakdown for cash_sales)
  cash_sales NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cash_tips NUMERIC(10, 2) NOT NULL DEFAULT 0,
  card_sales NUMERIC(10, 2) NOT NULL DEFAULT 0,
  card_tips NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Bill denomination breakdown (JSONB)
  -- Structure: {
  --   "under_5_total": 23.50,
  --   "count_5": 10,
  --   "count_10": 5,
  --   "count_20": 3,
  --   "count_50": 2,
  --   "count_100": 1,
  --   "count_200": 0
  -- }
  bill_breakdown JSONB NOT NULL DEFAULT '{}',
  
  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_reason TEXT,
  
  -- Destination for approved funds
  bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate submissions per employee/location/day
  CONSTRAINT unique_employee_location_date UNIQUE (user_id, location_id, business_date)
);

-- Indexes for performance
CREATE INDEX idx_employee_income_reports_user_id ON employee_income_reports(user_id);
CREATE INDEX idx_employee_income_reports_location_id ON employee_income_reports(location_id);
CREATE INDEX idx_employee_income_reports_business_date ON employee_income_reports(business_date);
CREATE INDEX idx_employee_income_reports_status ON employee_income_reports(status);
CREATE INDEX idx_employee_income_reports_location_status ON employee_income_reports(location_id, status);

-- Composite index for common queries
CREATE INDEX idx_employee_income_reports_lookup ON employee_income_reports(location_id, business_date, status);

-- Add comment for documentation
COMMENT ON TABLE employee_income_reports IS 'Stores employee income reports with bill denominations. Requires manager approval before updating bank accounts.';
COMMENT ON COLUMN employee_income_reports.bill_breakdown IS 'JSONB containing bill counts: under_5_total, count_5, count_10, count_20, count_50, count_100, count_200';
COMMENT ON COLUMN employee_income_reports.cash_sales IS 'Calculated from bill_breakdown. Total cash from sales.';
COMMENT ON COLUMN employee_income_reports.status IS 'Approval status: pending, approved, or rejected';
