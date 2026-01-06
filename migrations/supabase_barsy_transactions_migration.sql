-- Migration: Link products to Barsy articles for transaction sync
-- This allows direct transformation of barsy_orders to transactions

-- Add barsy_article_id to products for mapping line items
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barsy_article_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_products_barsy_article ON products(barsy_article_id);

COMMENT ON COLUMN products.barsy_article_id IS 'Reference to Barsy article ID for syncing transactions from barsy_orders';

