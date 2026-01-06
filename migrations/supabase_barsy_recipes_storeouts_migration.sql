-- Barsy Recipes and Store Outs Migration
-- Adds support for recipe tracking and inventory depletion

-- ============================================================================
-- BARSY RECIPES (Product Recipes/Bill of Materials)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_article_id INTEGER NOT NULL, -- The finished product
  barsy_ingredient_article_id INTEGER NOT NULL, -- The raw material/ingredient
  article_name TEXT,
  ingredient_name TEXT,
  quantity NUMERIC(10,4) NOT NULL, -- Amount of ingredient needed
  unit TEXT, -- Unit of measure (kg, l, pcs, etc.)
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_article_id, barsy_ingredient_article_id)
);

CREATE INDEX idx_barsy_recipes_location ON barsy_recipes(location_id);
CREATE INDEX idx_barsy_recipes_article ON barsy_recipes(barsy_article_id);
CREATE INDEX idx_barsy_recipes_ingredient ON barsy_recipes(barsy_ingredient_article_id);

-- ============================================================================
-- BARSY STORE OUTS (Inventory Write-offs and Depletion)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_store_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_store_out_id INTEGER NOT NULL,
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT,
  quantity NUMERIC(10,4),
  unit TEXT,
  depot_id INTEGER,
  depot_name TEXT,
  reason_id INTEGER,
  reason_name TEXT,
  store_out_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  user_id INTEGER,
  user_name TEXT,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_store_out_id)
);

CREATE INDEX idx_barsy_store_outs_location ON barsy_store_outs(location_id);
CREATE INDEX idx_barsy_store_outs_article ON barsy_store_outs(barsy_article_id);
CREATE INDEX idx_barsy_store_outs_date ON barsy_store_outs(store_out_date);
CREATE INDEX idx_barsy_store_outs_depot ON barsy_store_outs(depot_id);

-- ============================================================================
-- BARSY STORE AMOUNTS (Current Inventory Levels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_store_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT,
  depot_id INTEGER,
  depot_name TEXT,
  quantity NUMERIC(10,4),
  unit TEXT,
  cost_price NUMERIC(10,2),
  total_value NUMERIC(10,2),
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, barsy_article_id, depot_id)
);

CREATE INDEX idx_barsy_store_amounts_location ON barsy_store_amounts(location_id);
CREATE INDEX idx_barsy_store_amounts_article ON barsy_store_amounts(barsy_article_id);
CREATE INDEX idx_barsy_store_amounts_depot ON barsy_store_amounts(depot_id);

-- ============================================================================
-- INVENTORY DEPLETION LOG (Track automatic inventory adjustments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_inventory_depletion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  barsy_order_id INTEGER NOT NULL,
  barsy_article_id INTEGER NOT NULL, -- Sold product
  barsy_ingredient_article_id INTEGER NOT NULL, -- Depleted ingredient
  quantity_sold NUMERIC(10,4),
  quantity_depleted NUMERIC(10,4),
  unit TEXT,
  order_date TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_barsy_depletion_location ON barsy_inventory_depletion_log(location_id);
CREATE INDEX idx_barsy_depletion_order ON barsy_inventory_depletion_log(barsy_order_id);
CREATE INDEX idx_barsy_depletion_date ON barsy_inventory_depletion_log(order_date);

COMMENT ON TABLE barsy_recipes IS 'Stores recipe/BOM data from Barsy - maps finished products to ingredients';
COMMENT ON TABLE barsy_store_outs IS 'Stores manual inventory write-offs and depletion from Barsy';
COMMENT ON TABLE barsy_store_amounts IS 'Stores current inventory levels from Barsy';
COMMENT ON TABLE barsy_inventory_depletion_log IS 'Tracks automatic inventory depletion when sales are processed';

