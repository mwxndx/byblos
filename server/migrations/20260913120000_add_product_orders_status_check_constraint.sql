-- product_orders.status is the primary order-lifecycle field and gates escrow
-- release, seller payout eligibility, and settlement/financial analytics
-- (sellerAnalytics.repository.js and adminMetrics.repository.js filter on
-- `status IN (...)` / `status::text <> ALL(...)`). It was originally the
-- `order_status` ENUM (20250930150000_add_product_orders_tables.sql) but is now
-- a bare varchar(50) with NO CHECK constraint -- the only checks on this table
-- are the three money-amount non-negativity ones. So a typo or an
-- out-of-vocabulary literal from any write path is stored verbatim and silently
-- mis-classified by every status filter that drives money: the same failure
-- class as the legacy handle_order_completion_trigger incident
-- (20260905140000_drop_legacy_order_completion_payout_trigger.sql), but on a
-- column that directly moves funds.
--
-- Allowed set = the full 30-value `order_status` enum vocabulary (the type still
-- exists; the column just no longer uses it). It is a strict superset of what
-- the application writes today: the OrderStatus constant
-- (server/src/shared/constants/enums.js) is 27 values, all within this set, and
-- every product_orders.status string literal in the codebase is within it too.
-- The three extra values (CLIENT_PAYMENT_PENDING, DEBT_PENDING,
-- READY_FOR_PICKUP) are legacy enum members the code no longer writes but are
-- kept in-set so historical rows would never be rejected.
--
-- Added as a normal (validated) constraint: production product_orders was
-- confirmed empty when this migration was authored (SELECT COUNT(*) = 0), so
-- validation scans zero rows and takes no meaningful lock -- there is no legacy
-- data to grandfather, so NOT VALID would buy nothing. The full integration
-- suite (which drives real order-lifecycle transitions through the actual
-- services) passes with this constraint enforced, confirming the vocabulary is
-- complete for every status the code actually produces.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_orders_status_check'
    ) THEN
        ALTER TABLE product_orders
            ADD CONSTRAINT product_orders_status_check
            CHECK (status IN (
                'PENDING','RESERVED','HELD','PAID','PROCESSING','COMPLETED','CANCELLED',
                'FAILED','EXPIRED','COLLECTION_PENDING','DELIVERY_PENDING','SERVICE_PENDING',
                'CLIENT_PAYMENT_PENDING','DEBT_PENDING','DELIVERY_COMPLETE','CONFIRMED',
                'CREATED','PAYMENT_PENDING','FULFILLMENT_PENDING','FULFILLED','DELIVERED',
                'BOOKED','REFUND_PENDING','REFUNDED','COMPENSATION_REQUIRED',
                'AWAITING_SELLER_ACTION','FULFILLING','READY_FOR_BUYER','MANUAL_REVIEW',
                'READY_FOR_PICKUP'
            ));
    END IF;
END $$;
