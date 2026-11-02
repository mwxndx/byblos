-- Migration: Normalize seller shop names
-- 1. Replace underscores with spaces so underscores denote word separation and are never shown
-- 2. Capitalize first letter of every word (Title Case) so shop names always start with a capital letter
-- 3. Collapse multiple spaces into a single space and trim edges
-- 4. Synchronize slugs where missing

UPDATE sellers
SET shop_name = TRIM(INITCAP(REGEXP_REPLACE(REPLACE(shop_name, '_', ' '), '\s+', ' ', 'g')))
WHERE position('_' in shop_name) > 0
   OR shop_name ~ '^[a-z]'
   OR shop_name ~ '\s{2,}';

UPDATE sellers
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(shop_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
WHERE slug IS NULL OR slug = '';
