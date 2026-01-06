-- SQL queries to explore Barsy inventory data structure
-- Run these in Supabase SQL Editor to see what data is available

-- 1. Inspect raw_data from barsy_store_amounts (current inventory)
-- This shows what fields Barsy API actually returns
SELECT
  id,
  barsy_article_id,
  article_name,
  quantity,
  unit,
  cost_price,
  total_value,
  depot_id,
  depot_name,
  raw_data,  -- Full JSONB response from Barsy
  synced_at
FROM barsy_store_amounts
LIMIT 5;

-- 2. Inspect raw_data from barsy_store_load_items (purchases)
-- Shows what purchase line items look like
SELECT
  bli.id,
  bli.barsy_article_id,
  bli.article_name,
  bli.quantity,
  bli.unit_price,
  bli.total_price,
  bli.raw_data,  -- Full JSONB response from Barsy
  bl.doc_date,
  bl.supplier_name,
  bl.depot_id
FROM barsy_store_load_items bli
JOIN barsy_store_loads bl ON bli.store_load_id = bl.id
LIMIT 5;

-- 3. Inspect raw_data from barsy_store_outs (write-offs)
SELECT
  id,
  barsy_article_id,
  article_name,
  quantity,
  unit,
  depot_id,
  depot_name,
  reason_name,
  store_out_date,
  raw_data,  -- Full JSONB response from Barsy
  synced_at
FROM barsy_store_outs
LIMIT 5;

-- 4. Check what fields exist in raw_data JSONB
-- This will show the actual field names Barsy uses
SELECT
  jsonb_object_keys(raw_data) as field_name,
  COUNT(*) as occurrences
FROM barsy_store_amounts
WHERE raw_data IS NOT NULL
GROUP BY jsonb_object_keys(raw_data)
ORDER BY occurrences DESC;

-- 5. Sample raw_data structure (pretty printed)
SELECT
  barsy_article_id,
  article_name,
  jsonb_pretty(raw_data) as raw_data_formatted
FROM barsy_store_amounts
WHERE raw_data IS NOT NULL
LIMIT 3;

-- 6. Check if cost_price and total_value are populated
SELECT
  COUNT(*) as total_records,
  COUNT(cost_price) as records_with_cost_price,
  COUNT(total_value) as records_with_total_value,
  COUNT(CASE WHEN cost_price IS NULL THEN 1 END) as null_cost_price,
  COUNT(CASE WHEN total_value IS NULL THEN 1 END) as null_total_value,
  AVG(cost_price) as avg_cost_price,
  AVG(total_value) as avg_total_value
FROM barsy_store_amounts;

-- 7. Check store load items for price fields
SELECT
  COUNT(*) as total_items,
  COUNT(unit_price) as items_with_unit_price,
  AVG(unit_price) as avg_unit_price,
  AVG(total_price) as avg_total_price,
  MIN(unit_price) as min_unit_price,
  MAX(unit_price) as max_unit_price
FROM barsy_store_load_items;

-- 8. Compare quantity field names across tables
-- Check if Barsy uses 'amount' vs 'quantity' consistently
SELECT
  'store_amounts' as table_name,
  jsonb_object_keys(raw_data) as field_name
FROM barsy_store_amounts
WHERE raw_data IS NOT NULL
GROUP BY jsonb_object_keys(raw_data)

UNION ALL

SELECT
  'store_load_items' as table_name,
  jsonb_object_keys(raw_data) as field_name
FROM barsy_store_load_items
WHERE raw_data IS NOT NULL
GROUP BY jsonb_object_keys(raw_data)

UNION ALL

SELECT
  'store_outs' as table_name,
  jsonb_object_keys(raw_data) as field_name
FROM barsy_store_outs
WHERE raw_data IS NOT NULL
GROUP BY jsonb_object_keys(raw_data)
ORDER BY table_name, field_name;




