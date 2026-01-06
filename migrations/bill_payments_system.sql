-- Bill Payments System Migration
-- Enables recording payments and applying them to multiple bills with partial payment support

-- ============================================================================
-- BILL PAYMENTS TABLE
-- Stores individual payment transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS bill_payments (
  id SERIAL PRIMARY KEY,
  payment_number VARCHAR(50) UNIQUE,
  payment_date DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(100),
  reference_number VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bill_payments_date ON bill_payments(payment_date);
CREATE INDEX idx_bill_payments_number ON bill_payments(payment_number);

-- ============================================================================
-- BILL PAYMENT APPLICATIONS
-- Links payments to bills (many-to-many relationship)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bill_payment_applications (
  id SERIAL PRIMARY KEY,
  payment_id INT NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
  bill_id INT NOT NULL REFERENCES barsy_store_loads(id) ON DELETE CASCADE,
  amount_applied NUMERIC(12,2) NOT NULL CHECK (amount_applied > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(payment_id, bill_id)
);

CREATE INDEX idx_bill_payment_applications_payment ON bill_payment_applications(payment_id);
CREATE INDEX idx_bill_payment_applications_bill ON bill_payment_applications(bill_id);

-- ============================================================================
-- FUNCTION TO UPDATE BILL TOTAL_PAID
-- Automatically calculates total_paid from payment applications
-- ============================================================================
CREATE OR REPLACE FUNCTION update_bill_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE barsy_store_loads
  SET 
    total_paid = COALESCE((
      SELECT SUM(amount_applied)
      FROM bill_payment_applications
      WHERE bill_id = COALESCE(NEW.bill_id, OLD.bill_id)
    ), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_insert ON bill_payment_applications;
CREATE TRIGGER trigger_update_bill_total_paid_insert
AFTER INSERT ON bill_payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_bill_total_paid();

DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_update ON bill_payment_applications;
CREATE TRIGGER trigger_update_bill_total_paid_update
AFTER UPDATE ON bill_payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_bill_total_paid();

DROP TRIGGER IF EXISTS trigger_update_bill_total_paid_delete ON bill_payment_applications;
CREATE TRIGGER trigger_update_bill_total_paid_delete
AFTER DELETE ON bill_payment_applications
FOR EACH ROW
EXECUTE FUNCTION update_bill_total_paid();

-- ============================================================================
-- FUNCTION TO GENERATE PAYMENT NUMBER
-- Format: PAY-YYYYMMDD-XXXX
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_payment_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  today_date VARCHAR(8);
  next_sequence INT;
  payment_num VARCHAR(50);
BEGIN
  today_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM 14) AS INT)), 0) + 1
  INTO next_sequence
  FROM bill_payments
  WHERE payment_number LIKE 'PAY-' || today_date || '-%';
  
  payment_num := 'PAY-' || today_date || '-' || LPAD(next_sequence::TEXT, 4, '0');
  
  RETURN payment_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE bill_payments IS 'Stores payment transactions that can be applied to multiple bills';
COMMENT ON TABLE bill_payment_applications IS 'Links payments to bills with specific amounts applied';
COMMENT ON COLUMN barsy_store_loads.total_paid IS 'Auto-calculated from bill_payment_applications. Do not update directly.';

