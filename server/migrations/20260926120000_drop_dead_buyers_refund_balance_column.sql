-- Drop the dead buyers.refund_balance column.
--
-- This numeric(12,2) column is unused across the whole codebase: a full-repo
-- search (server + frontend + scripts + migrations) finds ZERO reads or writes
-- of it. The only textual match is an unrelated audit-metadata string literal
-- ('buyer_refund_balance') in orderDeadline.service.js, which never touches the
-- column. The live buyer refund ledger is the `refunds` column (which carries
-- its own CHECK (refunds >= 0)); refund_balance had no constraint and no code
-- path, so it was pure schema clutter a review kept re-flagging and a
-- contributor could mistake for the real balance. Nothing (foreign keys, views,
-- triggers, generated columns) depends on it.
--
-- Idempotent via IF EXISTS. The column is also removed from the bootstrap
-- snapshot (test/schema.sql), so a fresh database never creates it.

ALTER TABLE public.buyers DROP COLUMN IF EXISTS refund_balance;
