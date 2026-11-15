-- Migration: 20261115181000_seed_genesis_financial_ledger_balances.sql
-- Description: Establishes initial GENESIS_ROOT and cryptographically signs baseline balances for existing accounts.

DO $$
DECLARE
    v_last_hash VARCHAR(64) := '0000000000000000000000000000000000000000000000000000000000000000';
    v_curr_hash VARCHAR(64);
    v_seq BIGINT;
    v_rec RECORD;
BEGIN
    -- Idempotency check: if ledger is already initialized, do nothing
    IF EXISTS (SELECT 1 FROM financial_ledger LIMIT 1) THEN
        RETURN;
    END IF;

    -- 1. Insert Genesis Root
    INSERT INTO financial_ledger (
        event_type,
        entity_type,
        entity_id,
        amount,
        balance_after,
        prev_hash,
        row_hash,
        payload
    ) VALUES (
        'GENESIS_ROOT',
        'platform',
        0,
        0.00,
        0.00,
        v_last_hash,
        encode(digest(v_last_hash || ':1:platform:0:0.00:0.00:GENESIS_ROOT', 'sha256'), 'hex'),
        '{"description": "Genesis root of Byblos cryptographic financial ledger"}'::jsonb
    )
    RETURNING sequence_number, row_hash INTO v_seq, v_last_hash;

    -- 2. Seed active seller balances
    FOR v_rec IN 
        SELECT id, COALESCE(balance, 0) AS bal 
        FROM sellers 
        WHERE COALESCE(balance, 0) > 0 
        ORDER BY id ASC
    LOOP
        v_curr_hash := encode(digest(v_last_hash || ':' || (v_seq + 1) || ':seller:' || v_rec.id || ':' || v_rec.bal::text || ':' || v_rec.bal::text || ':GENESIS_BALANCE', 'sha256'), 'hex');
        
        INSERT INTO financial_ledger (
            event_type,
            entity_type,
            entity_id,
            amount,
            balance_after,
            prev_hash,
            row_hash,
            payload
        ) VALUES (
            'GENESIS_BALANCE',
            'seller',
            v_rec.id,
            v_rec.bal,
            v_rec.bal,
            v_last_hash,
            v_curr_hash,
            jsonb_build_object('genesis_seed_type', 'seller_active_balance', 'seeded_at', clock_timestamp())
        )
        RETURNING sequence_number, row_hash INTO v_seq, v_last_hash;
    END LOOP;

    -- 3. Seed active creator balances
    FOR v_rec IN 
        SELECT id, COALESCE(balance, 0) AS bal 
        FROM creators 
        WHERE COALESCE(balance, 0) > 0 
        ORDER BY id ASC
    LOOP
        v_curr_hash := encode(digest(v_last_hash || ':' || (v_seq + 1) || ':creator:' || v_rec.id || ':' || v_rec.bal::text || ':' || v_rec.bal::text || ':GENESIS_BALANCE', 'sha256'), 'hex');
        
        INSERT INTO financial_ledger (
            event_type,
            entity_type,
            entity_id,
            amount,
            balance_after,
            prev_hash,
            row_hash,
            payload
        ) VALUES (
            'GENESIS_BALANCE',
            'creator',
            v_rec.id,
            v_rec.bal,
            v_rec.bal,
            v_last_hash,
            v_curr_hash,
            jsonb_build_object('genesis_seed_type', 'creator_active_balance', 'seeded_at', clock_timestamp())
        )
        RETURNING sequence_number, row_hash INTO v_seq, v_last_hash;
    END LOOP;

    -- 4. Seed active buyer refund balances
    FOR v_rec IN 
        SELECT id, COALESCE(refunds, 0) AS bal 
        FROM buyers 
        WHERE COALESCE(refunds, 0) > 0 
        ORDER BY id ASC
    LOOP
        v_curr_hash := encode(digest(v_last_hash || ':' || (v_seq + 1) || ':buyer:' || v_rec.id || ':' || v_rec.bal::text || ':' || v_rec.bal::text || ':GENESIS_BALANCE', 'sha256'), 'hex');
        
        INSERT INTO financial_ledger (
            event_type,
            entity_type,
            entity_id,
            amount,
            balance_after,
            prev_hash,
            row_hash,
            payload
        ) VALUES (
            'GENESIS_BALANCE',
            'buyer',
            v_rec.id,
            v_rec.bal,
            v_rec.bal,
            v_last_hash,
            v_curr_hash,
            jsonb_build_object('genesis_seed_type', 'buyer_refund_balance', 'seeded_at', clock_timestamp())
        )
        RETURNING sequence_number, row_hash INTO v_seq, v_last_hash;
    END LOOP;
END $$;
