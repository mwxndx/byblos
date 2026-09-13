-- withdrawal_requests.status gates the payout state machine (createWithdrawalRequest
-- seeds 'processing' / 'manual_review'; updateStatusWithSideEffects + markFinalized
-- drive the terminal 'completed' / 'failed' / 'compensation_required'; admin reject
-- sets 'rejected', which admin.service's pending-withdrawals count reads as
-- `status NOT IN ('completed','failed','rejected')`). Like product_orders.status it
-- was a bare varchar(30) with NO CHECK -- despite refund_requests already using this
-- exact pattern (refund_requests.valid_status). A typo or wrong status literal from
-- any payout/admin path would be stored verbatim on money-in-flight rows and
-- silently mis-drive the state machine, retry worker, and financial reporting.
--
-- Allowed set = every value the code writes to withdrawal_requests.status
-- (processing, manual_review, completed, failed, compensation_required, rejected)
-- plus 'success' and 'paid', which the service itself treats as valid completed
-- states (withdrawal.service.js: `status IN ('completed','success','paid')` when
-- looking up the last successful payout destination). Provider result codes
-- ('sent','delivered','cancelled','reversed', ...) are inputs the state machine
-- maps FROM, not stored values, and the intermediate 'provider_*' statuses live on
-- payout_provider_attempts, not here -- both are intentionally excluded.
--
-- creator_withdrawal_requests is the pre-unification table (rows backfilled into
-- withdrawal_requests by 20260602120000; no live writer). It is constrained with the
-- same set for completeness; if it is later dropped, the constraint goes with it.
--
-- Shipped validated (not NOT VALID): both tables were confirmed empty in production
-- (SELECT COUNT(*) = 0) when this was authored, so validation scans zero rows and
-- takes no meaningful lock, and there is no legacy data to grandfather.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_status_check'
    ) THEN
        ALTER TABLE withdrawal_requests
            ADD CONSTRAINT withdrawal_requests_status_check
            CHECK (status IN (
                'processing','manual_review','completed','failed',
                'compensation_required','rejected','success','paid'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'creator_withdrawal_requests_status_check'
    ) THEN
        ALTER TABLE creator_withdrawal_requests
            ADD CONSTRAINT creator_withdrawal_requests_status_check
            CHECK (status IN (
                'processing','manual_review','completed','failed',
                'compensation_required','rejected','success','paid'
            ));
    END IF;
END $$;
