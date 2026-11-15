-- Migration: 20261115180000_create_cryptographic_financial_ledger.sql
-- Description: Creates append-only cryptographic financial ledger and epoch tables with immutability triggers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Immutable Financial Ledger Table
CREATE TABLE IF NOT EXISTS financial_ledger (
    sequence_number BIGSERIAL PRIMARY KEY,
    entry_id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(32) NOT NULL, -- 'seller', 'creator', 'buyer', 'platform'
    entity_id INTEGER NOT NULL,
    order_id INTEGER REFERENCES product_orders(id) ON DELETE RESTRICT,
    payout_id INTEGER REFERENCES payouts(id) ON DELETE RESTRICT,
    withdrawal_id INTEGER REFERENCES withdrawal_requests(id) ON DELETE RESTRICT,
    payment_reference VARCHAR(128),
    
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    balance_after NUMERIC(14, 2) NOT NULL,
    
    prev_hash VARCHAR(64) NOT NULL,
    row_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexing for rapid entity history verification and chain walks
CREATE INDEX IF NOT EXISTS idx_ledger_entity ON financial_ledger (entity_type, entity_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON financial_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_withdrawal ON financial_ledger (withdrawal_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_row_hash ON financial_ledger (row_hash);

-- 2. Periodic Merkle Tree Epochs Table (for S3 WORM Object Lock Anchoring)
CREATE TABLE IF NOT EXISTS ledger_epochs (
    epoch_id BIGSERIAL PRIMARY KEY,
    epoch_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
    start_sequence BIGINT NOT NULL,
    end_sequence BIGINT NOT NULL,
    entry_count INTEGER NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    anchor_type VARCHAR(32) NOT NULL DEFAULT 's3_worm',
    anchor_reference VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'anchored',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_ledger_epochs_sequence ON ledger_epochs (start_sequence, end_sequence);

-- 3. Immutability Trigger Enforcement
CREATE OR REPLACE FUNCTION enforce_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: financial_ledger is strictly append-only. UPDATE, DELETE, and TRUNCATE are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_ledger_immutable ON financial_ledger;
CREATE TRIGGER trg_financial_ledger_immutable
BEFORE UPDATE OR DELETE ON financial_ledger
FOR EACH ROW EXECUTE FUNCTION enforce_ledger_immutability();

