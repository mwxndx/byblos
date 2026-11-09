-- Migration: composite indexing for shop products and previews
-- Speeds up shop catalog loading and lateral product previews by (seller_id, status, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_products_seller_status_created 
  ON products (seller_id, status, created_at DESC);

-- Speeds up shop lookup by normalized shop name and slug
CREATE INDEX IF NOT EXISTS idx_sellers_shop_name_lower 
  ON sellers (LOWER(TRIM(shop_name)));

CREATE INDEX IF NOT EXISTS idx_sellers_slug_lower 
  ON sellers (LOWER(TRIM(slug))) WHERE slug IS NOT NULL;

