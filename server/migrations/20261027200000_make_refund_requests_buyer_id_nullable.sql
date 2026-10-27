-- Migration: Make buyer_id nullable in refund_requests and add order_status index
-- Reason: Allow recording authoritative refund ledger entries for guest orders and optimize balance lookups

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'refund_requests'
          AND column_name = 'buyer_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE refund_requests ALTER COLUMN buyer_id DROP NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_refund_requests_order_status ON refund_requests(order_id, status);
