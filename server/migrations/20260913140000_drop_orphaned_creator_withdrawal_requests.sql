-- Drop the orphaned creator_withdrawal_requests table.
--
-- This was the pre-unification creator payout table. 20260602120000
-- (unify_creator_withdrawals) backfilled its rows into the unified
-- withdrawal_requests table, after which nothing ever wrote to or read from it
-- again: a full-repo search (server + frontend + scripts) finds ZERO references
-- to creator_withdrawal_requests, and no other object depends on it (no foreign
-- keys point at it, no views or triggers reference it — only its own indexes,
-- sequence and constraints, which drop with the table). Production confirmed it
-- holds no rows. It is pure schema clutter that could mislead a contributor into
-- writing to the wrong table (the live one is withdrawal_requests).
--
-- DROP TABLE cascades to the objects the table owns (its id sequence via OWNED
-- BY, its indexes, and its CHECK/UNIQUE/PK constraints); nothing external
-- references it, so no CASCADE of other objects is involved. Idempotent via
-- IF EXISTS. The table has also been removed from the bootstrap snapshot
-- (test/schema.sql), so a fresh database never creates it in the first place.

DROP TABLE IF EXISTS public.creator_withdrawal_requests;
