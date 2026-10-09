-- Drops redundant partial index product_orders_client_checkout_token_unique.
-- The column client_checkout_token is NOT NULL and is already indexed by product_orders_client_checkout_token_unique_all.
DROP INDEX IF EXISTS product_orders_client_checkout_token_unique;
