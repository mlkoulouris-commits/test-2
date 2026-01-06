-- Barsy Locations Configuration
CREATE TABLE IF NOT EXISTS barsy_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barsy_url TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Barsy Articles (Products) - Location specific
CREATE TABLE IF NOT EXISTS barsy_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT NOT NULL,
  article_name_public TEXT,
  actual_price NUMERIC(10,2),
  current_price NUMERIC(10,2),
  article_type INTEGER,
  amount_type_id INTEGER,
  amount_unit TEXT,
  stream_id INTEGER,
  stream_name TEXT,
  category_id INTEGER,
  barcode TEXT,
  picture TEXT,
  is_for_sale BOOLEAN,
  delete_flag BOOLEAN DEFAULT false,
  tax NUMERIC(5,2),
  tax_code TEXT,
  last_update TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_article_id)
);

-- Barsy Users (Staff) - Location specific
CREATE TABLE IF NOT EXISTS barsy_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  fname TEXT,
  lname TEXT,
  role_name TEXT,
  delete_flag BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_user_id)
);

-- Barsy Categories - Location specific
CREATE TABLE IF NOT EXISTS barsy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_cat_id INTEGER NOT NULL,
  cat_name TEXT NOT NULL,
  cat_path TEXT,
  parent_id INTEGER,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_cat_id)
);

-- Barsy Orders (Sales) - Location specific
CREATE TABLE IF NOT EXISTS barsy_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_order_id INTEGER NOT NULL,
  order_date TIMESTAMPTZ NOT NULL,
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT,
  amount NUMERIC(10,3),
  amount_unit NUMERIC(10,3),
  current_price NUMERIC(10,2),
  actual_price NUMERIC(10,2),
  order_status INTEGER,
  order_status_title TEXT,
  barsy_user_id INTEGER,
  user_name TEXT,
  pos_id INTEGER,
  stream_id INTEGER,
  barsy_id INTEGER,
  served_date TIMESTAMPTZ,
  served_by INTEGER,
  amount_type_id INTEGER,
  amount_type_name_short TEXT,
  article_type INTEGER,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_order_id)
);

-- Barsy Sync Log
CREATE TABLE IF NOT EXISTS barsy_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES barsy_locations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'orders', 'articles', 'users', 'categories'
  date_from DATE,
  date_to DATE,
  records_synced INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'success', 'failed'
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_barsy_orders_location_date ON barsy_orders(location_id, order_date);
CREATE INDEX IF NOT EXISTS idx_barsy_orders_article ON barsy_orders(location_id, barsy_article_id);
CREATE INDEX IF NOT EXISTS idx_barsy_orders_user ON barsy_orders(location_id, barsy_user_id);
CREATE INDEX IF NOT EXISTS idx_barsy_articles_location ON barsy_articles(location_id, barsy_article_id);
CREATE INDEX IF NOT EXISTS idx_barsy_users_location ON barsy_users(location_id, barsy_user_id);
CREATE INDEX IF NOT EXISTS idx_barsy_sync_log_location ON barsy_sync_log(location_id, created_at);

COMMENT ON TABLE barsy_locations IS 'Stores Barsy location configurations (Vitosha, NDK, etc.)';
COMMENT ON TABLE barsy_orders IS 'Raw sales data from Barsy API, segregated by location';
COMMENT ON TABLE barsy_articles IS 'Product catalog from each Barsy location';
COMMENT ON TABLE barsy_users IS 'Staff/users from each Barsy location';
COMMENT ON TABLE barsy_sync_log IS 'Tracks sync operations for each location';
