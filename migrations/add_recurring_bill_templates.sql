-- ============================================================================
-- RECURRING BILL TEMPLATES
-- Allows setting up recurring bills for specific location/vendor combinations
-- ============================================================================

CREATE TABLE IF NOT EXISTS recurring_bill_templates (
  id SERIAL PRIMARY KEY,
  location_id INT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  vendor_id INT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

  -- Scheduling
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'bimonthly')),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),  -- For weekly (0=Sunday, 6=Saturday)
  day_of_month INT CHECK (day_of_month BETWEEN 1 AND 28), -- For monthly/bimonthly (max 28 to handle Feb)

  -- Bill defaults
  default_amount NUMERIC(12,2) DEFAULT 0, -- 0 = user edits after creation
  description TEXT,
  due_date_offset INT DEFAULT 0, -- Days after period end for due date
  account_id INT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMP,
  next_generation_date DATE,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),

  -- Prevent duplicate templates for same location/vendor/frequency
  UNIQUE(location_id, vendor_id, frequency)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_templates_location ON recurring_bill_templates(location_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_vendor ON recurring_bill_templates(vendor_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_active ON recurring_bill_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_next_date ON recurring_bill_templates(next_generation_date);

-- Comments
COMMENT ON TABLE recurring_bill_templates IS 'Templates for auto-generating recurring bills';
COMMENT ON COLUMN recurring_bill_templates.frequency IS 'Billing frequency: weekly, monthly, or bimonthly';
COMMENT ON COLUMN recurring_bill_templates.day_of_week IS 'Day of week for weekly bills (0=Sunday, 6=Saturday)';
COMMENT ON COLUMN recurring_bill_templates.day_of_month IS 'Day of month for monthly/bimonthly bills (1-28)';
COMMENT ON COLUMN recurring_bill_templates.default_amount IS 'Default bill amount (0 means user must enter amount)';
COMMENT ON COLUMN recurring_bill_templates.due_date_offset IS 'Days after period end to set due date';
COMMENT ON COLUMN recurring_bill_templates.next_generation_date IS 'Next date when bill should be generated';
