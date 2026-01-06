-- Salary Payments System Migration
-- Enables recording salary payments and applying them to multiple labor cost entries
-- Also includes recurring salary templates for auto-generating salary entries

-- ============================================================================
-- MODIFICATIONS TO LABOR_COSTS TABLE
-- Add payment tracking columns
-- ============================================================================
ALTER TABLE labor_costs
ADD COLUMN IF NOT EXISTS total_paid NUMERIC(12,2) DEFAULT 0;

ALTER TABLE labor_costs
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Add check constraint for status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'labor_costs_status_check'
  ) THEN
    ALTER TABLE labor_costs
    ADD CONSTRAINT labor_costs_status_check
    CHECK (status IN ('pending', 'partially_paid', 'paid'));
  END IF;
END $$;

COMMENT ON COLUMN labor_costs.total_paid IS 'Auto-calculated from salary_payment_applications. Do not update directly.';
COMMENT ON COLUMN labor_costs.status IS 'Payment status: pending, partially_paid, paid';

-- ============================================================================
-- SALARY PAYMENTS TABLE
-- Stores salary payment transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(50) UNIQUE,
  payment_date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  bank_account_id INT REFERENCES bank_accounts(id),
  location_id INT NOT NULL REFERENCES locations(id),
  reference_number VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON salary_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_number ON salary_payments(payment_number);
CREATE INDEX IF NOT EXISTS idx_salary_payments_location ON salary_payments(location_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_bank_account ON salary_payments(bank_account_id);

COMMENT ON TABLE salary_payments IS 'Stores salary payment transactions that can be applied to multiple labor cost entries';

-- ============================================================================
-- SALARY PAYMENT APPLICATIONS
-- Links payments to labor_costs (many-to-many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS salary_payment_applications (
  id SERIAL PRIMARY KEY,
  payment_id INT NOT NULL REFERENCES salary_payments(id) ON DELETE CASCADE,
  labor_cost_id INT NOT NULL REFERENCES labor_costs(id) ON DELETE CASCADE,
  amount_applied NUMERIC(12,2) NOT NULL CHECK (amount_applied > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(payment_id, labor_cost_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_payment_applications_payment ON salary_payment_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_salary_payment_applications_labor_cost ON salary_payment_applications(labor_cost_id);

COMMENT ON TABLE salary_payment_applications IS 'Links salary payments to labor cost entries with specific amounts applied';

-- ============================================================================
-- RECURRING SALARY TEMPLATES
-- Templates for auto-generating salary entries
-- ============================================================================
CREATE TABLE IF NOT EXISTS recurring_salary_templates (
  id SERIAL PRIMARY KEY,
  location_id INT NOT NULL REFERENCES locations(id),
  profile_id INT NOT NULL REFERENCES profiles(id),
  cost_type VARCHAR(20) NOT NULL DEFAULT 'salary' CHECK (cost_type IN ('salary', 'bonus', 'overtime', 'benefits', 'taxes', 'other')),
  default_amount NUMERIC(12,2) DEFAULT 0,
  frequency VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'bimonthly')),
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INT CHECK (day_of_month >= 1 AND day_of_month <= 28),
  description TEXT,
  account_id INT REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT TRUE,
  next_generation_date DATE,
  last_generated_at TIMESTAMP,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, profile_id, cost_type, frequency)
);

CREATE INDEX IF NOT EXISTS idx_recurring_salary_templates_location ON recurring_salary_templates(location_id);
CREATE INDEX IF NOT EXISTS idx_recurring_salary_templates_profile ON recurring_salary_templates(profile_id);
CREATE INDEX IF NOT EXISTS idx_recurring_salary_templates_next_date ON recurring_salary_templates(next_generation_date);
CREATE INDEX IF NOT EXISTS idx_recurring_salary_templates_active ON recurring_salary_templates(is_active);

COMMENT ON TABLE recurring_salary_templates IS 'Templates for auto-generating recurring salary entries';
COMMENT ON COLUMN recurring_salary_templates.day_of_week IS 'Day of week for weekly frequency (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN recurring_salary_templates.day_of_month IS 'Day of month for monthly/bimonthly frequency (1-28)';

-- ============================================================================
-- FUNCTION TO UPDATE LABOR COST TOTAL_PAID AND STATUS
-- Automatically calculates total_paid from payment applications
-- ============================================================================
CREATE OR REPLACE FUNCTION update_labor_cost_total_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_labor_cost_id INT;
  v_total_paid NUMERIC(12,2);
  v_amount NUMERIC(12,2);
  v_new_status VARCHAR(20);
BEGIN
  v_labor_cost_id := COALESCE(NEW.labor_cost_id, OLD.labor_cost_id);

  -- Calculate total paid
  SELECT COALESCE(SUM(amount_applied), 0)
  INTO v_total_paid
  FROM salary_payment_applications
  WHERE labor_cost_id = v_labor_cost_id;

  -- Get the labor cost amount
  SELECT amount INTO v_amount
  FROM labor_costs
  WHERE id = v_labor_cost_id;

  -- Determine status based on payment
  IF v_total_paid >= v_amount THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Update labor cost
  UPDATE labor_costs
  SET
    total_paid = v_total_paid,
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_labor_cost_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR LABOR COST PAYMENT TRACKING
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_labor_cost_total_paid_insert ON salary_payment_applications;
CREATE TRIGGER trigger_update_labor_cost_total_paid_insert
AFTER INSERT ON salary_payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_labor_cost_total_paid();

DROP TRIGGER IF EXISTS trigger_update_labor_cost_total_paid_update ON salary_payment_applications;
CREATE TRIGGER trigger_update_labor_cost_total_paid_update
AFTER UPDATE ON salary_payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_labor_cost_total_paid();

DROP TRIGGER IF EXISTS trigger_update_labor_cost_total_paid_delete ON salary_payment_applications;
CREATE TRIGGER trigger_update_labor_cost_total_paid_delete
AFTER DELETE ON salary_payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_labor_cost_total_paid();

-- ============================================================================
-- FUNCTION TO GENERATE SALARY PAYMENT NUMBER
-- Format: SAL-YYYYMMDD-XXXX
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_salary_payment_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  today_date VARCHAR(8);
  next_sequence INT;
  payment_num VARCHAR(50);
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 14) AS INT)), 0) + 1
  INTO next_sequence
  FROM salary_payments
  WHERE payment_number LIKE 'SAL-' || today_date || '-%';

  payment_num := 'SAL-' || today_date || '-' || LPAD(next_sequence::TEXT, 4, '0');

  RETURN payment_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION TO UPDATE BANK ACCOUNT BALANCE ON SALARY PAYMENT
-- Decreases bank account balance when a salary payment is recorded
-- ============================================================================
CREATE OR REPLACE FUNCTION update_bank_balance_on_salary_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = current_balance - NEW.total_amount,
        updated_at = NOW()
    WHERE id = NEW.bank_account_id;
  ELSIF TG_OP = 'DELETE' AND OLD.bank_account_id IS NOT NULL THEN
    UPDATE bank_accounts
    SET current_balance = current_balance + OLD.total_amount,
        updated_at = NOW()
    WHERE id = OLD.bank_account_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle bank account change or amount change
    IF OLD.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance + OLD.total_amount,
          updated_at = NOW()
      WHERE id = OLD.bank_account_id;
    END IF;
    IF NEW.bank_account_id IS NOT NULL THEN
      UPDATE bank_accounts
      SET current_balance = current_balance - NEW.total_amount,
          updated_at = NOW()
      WHERE id = NEW.bank_account_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bank_balance_salary_insert ON salary_payments;
CREATE TRIGGER trigger_update_bank_balance_salary_insert
AFTER INSERT ON salary_payments
FOR EACH ROW
EXECUTE FUNCTION update_bank_balance_on_salary_payment();

DROP TRIGGER IF EXISTS trigger_update_bank_balance_salary_update ON salary_payments;
CREATE TRIGGER trigger_update_bank_balance_salary_update
AFTER UPDATE ON salary_payments
FOR EACH ROW
EXECUTE FUNCTION update_bank_balance_on_salary_payment();

DROP TRIGGER IF EXISTS trigger_update_bank_balance_salary_delete ON salary_payments;
CREATE TRIGGER trigger_update_bank_balance_salary_delete
AFTER DELETE ON salary_payments
FOR EACH ROW
EXECUTE FUNCTION update_bank_balance_on_salary_payment();

-- ============================================================================
-- INITIALIZE EXISTING LABOR COSTS STATUS
-- Set all existing entries to 'pending' if they don't have a status
-- ============================================================================
UPDATE labor_costs SET status = 'pending' WHERE status IS NULL;
UPDATE labor_costs SET total_paid = 0 WHERE total_paid IS NULL;
