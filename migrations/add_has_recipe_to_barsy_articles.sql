-- Add has_recipe flag and recipe_description to barsy_articles
-- This enables efficient recipe syncing by only querying articles that have recipes
-- Applied: 2024-12-20

ALTER TABLE barsy_articles 
ADD COLUMN IF NOT EXISTS has_recipe boolean DEFAULT false;

ALTER TABLE barsy_articles 
ADD COLUMN IF NOT EXISTS recipe_description text;

-- Create index for efficient querying of articles with recipes
CREATE INDEX IF NOT EXISTS idx_barsy_articles_has_recipe 
ON barsy_articles (location_id, has_recipe) 
WHERE has_recipe = true;

-- Backfill from existing raw_data (if recipe_description was captured)
UPDATE barsy_articles 
SET 
  recipe_description = raw_data->>'recipe_description',
  has_recipe = COALESCE(raw_data->>'recipe_description', '') != ''
WHERE raw_data->>'recipe_description' IS NOT NULL 
  AND raw_data->>'recipe_description' != '';
