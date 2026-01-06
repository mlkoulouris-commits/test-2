-- Inventory Snapshots Migration
-- Adds support for storing baseline inventory snapshots for historical calculations

-- ============================================================================
-- BARSY INVENTORY SNAPSHOTS (Baseline inventory levels by date)
-- ============================================================================
CREATE TABLE IF NOT EXISTS barsy_inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES barsy_locations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  barsy_article_id INTEGER NOT NULL,
  article_name TEXT,
  depot_id INTEGER,
  depot_name TEXT,
  quantity NUMERIC(10,4),
  unit TEXT,
  cost_price NUMERIC(10,2),
  total_value NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, snapshot_date, barsy_article_id, depot_id)
);

CREATE INDEX idx_inventory_snapshots_location_date ON barsy_inventory_snapshots(location_id, snapshot_date);
CREATE INDEX idx_inventory_snapshots_article ON barsy_inventory_snapshots(barsy_article_id);
CREATE INDEX idx_inventory_snapshots_depot ON barsy_inventory_snapshots(depot_id);

COMMENT ON TABLE barsy_inventory_snapshots IS 'Stores baseline inventory snapshots from Barsy for historical inventory calculations';
COMMENT ON COLUMN barsy_inventory_snapshots.snapshot_date IS 'Date of the snapshot - used as baseline for calculations up to this date';









