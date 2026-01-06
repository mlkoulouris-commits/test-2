-- Complete Barsy Data Sync Schema
-- All raw data tables from Barsy API

-- ============================================
-- MASTER DATA TABLES
-- ============================================

-- Suppliers (Доставчици)
CREATE TABLE IF NOT EXISTS barsy_suppliers (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  supplier_id INT NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  bulstat VARCHAR(50),
  vat_number VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  contact_person VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  payment_terms_days INT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, supplier_id)
);

CREATE INDEX idx_barsy_suppliers_location ON barsy_suppliers(barsy_location_id);
CREATE INDEX idx_barsy_suppliers_name ON barsy_suppliers(supplier_name);

-- Depots/Warehouses (Складове)
CREATE TABLE IF NOT EXISTS barsy_depots (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  depot_id INT NOT NULL,
  depot_name VARCHAR(255) NOT NULL,
  barsy_id INT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  description TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, depot_id)
);

CREATE INDEX idx_barsy_depots_location ON barsy_depots(barsy_location_id);

-- Places (Tables/Areas - Места)
CREATE TABLE IF NOT EXISTS barsy_places (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  place_id INT NOT NULL,
  place_name VARCHAR(255) NOT NULL,
  place_number VARCHAR(50),
  barsy_id INT,
  place_type INT,
  capacity INT,
  is_active BOOLEAN DEFAULT true,
  position_x INT,
  position_y INT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, place_id)
);

CREATE INDEX idx_barsy_places_location ON barsy_places(barsy_location_id);
CREATE INDEX idx_barsy_places_active ON barsy_places(is_active);

-- POS/Cash Registers (Каси)
CREATE TABLE IF NOT EXISTS barsy_poses (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  pos_id INT NOT NULL,
  pos_name VARCHAR(255) NOT NULL,
  barsy_id INT,
  device_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_fiscal BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, pos_id)
);

CREATE INDEX idx_barsy_poses_location ON barsy_poses(barsy_location_id);

-- Payment Methods (Начини на плащане)
CREATE TABLE IF NOT EXISTS barsy_payment_methods (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  paymethod_id INT NOT NULL,
  paymethod_name VARCHAR(255) NOT NULL,
  paymethod_type VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, paymethod_id)
);

CREATE INDEX idx_barsy_payment_methods_location ON barsy_payment_methods(barsy_location_id);

-- Tax Groups (Данъчни групи)
CREATE TABLE IF NOT EXISTS barsy_tax_groups (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  tax_group_id INT NOT NULL,
  tax_group_name VARCHAR(255) NOT NULL,
  tax_rate DECIMAL(5,2),
  is_default BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, tax_group_id)
);

CREATE INDEX idx_barsy_tax_groups_location ON barsy_tax_groups(barsy_location_id);

-- Currencies (Валути)
CREATE TABLE IF NOT EXISTS barsy_currencies (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  currency_id INT NOT NULL,
  currency_code VARCHAR(10) NOT NULL,
  currency_name VARCHAR(100),
  currency_rate DECIMAL(10,4),
  is_default BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, currency_id)
);

CREATE INDEX idx_barsy_currencies_location ON barsy_currencies(barsy_location_id);

-- ============================================
-- TRANSACTION DATA TABLES
-- ============================================

-- Store Loads (Purchases/Supplier Invoices)
CREATE TABLE IF NOT EXISTS barsy_store_loads (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  store_load_id INT NOT NULL,
  barsy_id INT,
  depot_id INT,
  supplier_id INT,
  supplier_name VARCHAR(255),
  doc_type_id INT,
  doc_type_name VARCHAR(100),
  doc_num VARCHAR(100),
  doc_date DATE,
  date TIMESTAMP,
  close_date TIMESTAMP,
  status INT, -- 0=Open, 1=Closed
  operation_type INT, -- 1=Load, 2=Return
  price_mode INT, -- 0=Without VAT, 1=With VAT
  has_tax INT,
  total_sum DECIMAL(12,2),
  total_paid DECIMAL(12,2),
  total_costs DECIMAL(12,2),
  paid_due_date DATE,
  currency_id INT,
  currency_rate DECIMAL(10,4),
  paymethod_id INT,
  description TEXT,
  creator_id INT,
  user_name VARCHAR(255),
  last_update TIMESTAMP,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, store_load_id)
);

CREATE INDEX idx_barsy_store_loads_location ON barsy_store_loads(barsy_location_id);
CREATE INDEX idx_barsy_store_loads_supplier ON barsy_store_loads(supplier_id);
CREATE INDEX idx_barsy_store_loads_date ON barsy_store_loads(doc_date);
CREATE INDEX idx_barsy_store_loads_status ON barsy_store_loads(status);

-- Store Load Line Items
CREATE TABLE IF NOT EXISTS barsy_store_load_items (
  id SERIAL PRIMARY KEY,
  store_load_id INT REFERENCES barsy_store_loads(id) ON DELETE CASCADE,
  barsy_article_id INT,
  article_name VARCHAR(255),
  quantity DECIMAL(12,3),
  unit_price DECIMAL(12,2),
  total_price DECIMAL(12,2),
  amount_type VARCHAR(50),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_barsy_store_load_items_load ON barsy_store_load_items(store_load_id);
CREATE INDEX idx_barsy_store_load_items_article ON barsy_store_load_items(barsy_article_id);

-- Payments (Плащания)
CREATE TABLE IF NOT EXISTS barsy_payments (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  payment_id INT NOT NULL,
  barsy_id INT,
  payment_type INT, -- 1=Income, 2=Expense
  amount DECIMAL(12,2),
  paymethod_id INT,
  paymethod_name VARCHAR(255),
  payment_date TIMESTAMP,
  account_id INT,
  store_load_id INT,
  clientorder_id INT,
  reservation_id INT,
  user_id INT,
  user_name VARCHAR(255),
  description TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, payment_id)
);

CREATE INDEX idx_barsy_payments_location ON barsy_payments(barsy_location_id);
CREATE INDEX idx_barsy_payments_date ON barsy_payments(payment_date);
CREATE INDEX idx_barsy_payments_type ON barsy_payments(payment_type);
CREATE INDEX idx_barsy_payments_account ON barsy_payments(account_id);

-- Store Moves (Internal Transfers)
CREATE TABLE IF NOT EXISTS barsy_store_moves (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  store_move_id INT NOT NULL,
  barsy_id INT,
  from_depot_id INT,
  to_depot_id INT,
  doc_num VARCHAR(100),
  doc_date DATE,
  date TIMESTAMP,
  close_date TIMESTAMP,
  status INT,
  description TEXT,
  creator_id INT,
  user_name VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, store_move_id)
);

CREATE INDEX idx_barsy_store_moves_location ON barsy_store_moves(barsy_location_id);
CREATE INDEX idx_barsy_store_moves_date ON barsy_store_moves(doc_date);

-- Store Move Items
CREATE TABLE IF NOT EXISTS barsy_store_move_items (
  id SERIAL PRIMARY KEY,
  store_move_id INT REFERENCES barsy_store_moves(id) ON DELETE CASCADE,
  barsy_article_id INT,
  article_name VARCHAR(255),
  quantity DECIMAL(12,3),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_barsy_store_move_items_move ON barsy_store_move_items(store_move_id);

-- Store Productions (Production/Prep)
CREATE TABLE IF NOT EXISTS barsy_store_productions (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  store_production_id INT NOT NULL,
  barsy_id INT,
  depot_id INT,
  doc_num VARCHAR(100),
  doc_date DATE,
  date TIMESTAMP,
  close_date TIMESTAMP,
  status INT,
  description TEXT,
  creator_id INT,
  user_name VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, store_production_id)
);

CREATE INDEX idx_barsy_store_productions_location ON barsy_store_productions(barsy_location_id);
CREATE INDEX idx_barsy_store_productions_date ON barsy_store_productions(doc_date);

-- Store Production Items (ingredients used and products produced)
CREATE TABLE IF NOT EXISTS barsy_store_production_items (
  id SERIAL PRIMARY KEY,
  store_production_id INT REFERENCES barsy_store_productions(id) ON DELETE CASCADE,
  barsy_article_id INT,
  article_name VARCHAR(255),
  quantity DECIMAL(12,3),
  item_type VARCHAR(20), -- 'input' or 'output'
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_barsy_store_production_items_production ON barsy_store_production_items(store_production_id);

-- Store Revisions (Inventory Audits)
CREATE TABLE IF NOT EXISTS barsy_store_revisions (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  store_revision_id INT NOT NULL,
  barsy_id INT,
  depot_id INT,
  doc_num VARCHAR(100),
  doc_date DATE,
  date TIMESTAMP,
  close_date TIMESTAMP,
  status INT,
  description TEXT,
  creator_id INT,
  user_name VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, store_revision_id)
);

CREATE INDEX idx_barsy_store_revisions_location ON barsy_store_revisions(barsy_location_id);
CREATE INDEX idx_barsy_store_revisions_date ON barsy_store_revisions(doc_date);

-- Store Revision Items
CREATE TABLE IF NOT EXISTS barsy_store_revision_items (
  id SERIAL PRIMARY KEY,
  store_revision_id INT REFERENCES barsy_store_revisions(id) ON DELETE CASCADE,
  barsy_article_id INT,
  article_name VARCHAR(255),
  expected_quantity DECIMAL(12,3),
  actual_quantity DECIMAL(12,3),
  variance DECIMAL(12,3),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_barsy_store_revision_items_revision ON barsy_store_revision_items(store_revision_id);

-- ============================================
-- CUSTOMER DATA
-- ============================================

-- Clients (Customers)
CREATE TABLE IF NOT EXISTS barsy_clients (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  client_id INT NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  client_group_id INT,
  loyalty_points INT DEFAULT 0,
  total_purchases DECIMAL(12,2) DEFAULT 0,
  last_purchase_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, client_id)
);

CREATE INDEX idx_barsy_clients_location ON barsy_clients(barsy_location_id);
CREATE INDEX idx_barsy_clients_email ON barsy_clients(email);
CREATE INDEX idx_barsy_clients_phone ON barsy_clients(phone);

-- ============================================
-- CONFIGURATION DATA
-- ============================================

-- Barsy Locations Extended Info
CREATE TABLE IF NOT EXISTS barsy_location_details (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE UNIQUE,
  barsy_id INT NOT NULL,
  barsy_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  default_currency_id INT,
  timezone VARCHAR(50),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SYNC STATUS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS barsy_sync_status (
  id SERIAL PRIMARY KEY,
  barsy_location_id INT REFERENCES barsy_locations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'suppliers', 'store_loads', 'payments', etc.
  last_sync_at TIMESTAMP,
  last_sync_success BOOLEAN,
  records_synced INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(barsy_location_id, sync_type)
);

CREATE INDEX idx_barsy_sync_status_location ON barsy_sync_status(barsy_location_id);
CREATE INDEX idx_barsy_sync_status_type ON barsy_sync_status(sync_type);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE barsy_suppliers IS 'Supplier master data from Barsy';
COMMENT ON TABLE barsy_depots IS 'Warehouse/depot master data from Barsy';
COMMENT ON TABLE barsy_places IS 'Tables and service areas from Barsy';
COMMENT ON TABLE barsy_poses IS 'POS/cash register master data from Barsy';
COMMENT ON TABLE barsy_payment_methods IS 'Payment method master data from Barsy';
COMMENT ON TABLE barsy_tax_groups IS 'Tax/VAT groups from Barsy';
COMMENT ON TABLE barsy_store_loads IS 'Supplier purchases and invoices from Barsy';
COMMENT ON TABLE barsy_store_load_items IS 'Line items for supplier purchases';
COMMENT ON TABLE barsy_payments IS 'Payment transactions from Barsy';
COMMENT ON TABLE barsy_store_moves IS 'Internal inventory transfers from Barsy';
COMMENT ON TABLE barsy_store_productions IS 'Production/prep operations from Barsy';
COMMENT ON TABLE barsy_store_revisions IS 'Inventory audit operations from Barsy';
COMMENT ON TABLE barsy_clients IS 'Customer master data from Barsy';

