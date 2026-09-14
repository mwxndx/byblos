-- Migration: add created_at indexes for buyers and sellers.
-- Both admin directory listings (admin.service.js getAllSellers,
-- buyer.repository.js findAllForAdmin) sort by created_at DESC with no
-- supporting index today -- fine for a full unbounded scan, but now that
-- those endpoints are switching to real LIMIT/OFFSET pagination, an
-- unindexed sort forces a full table scan + sort on every page, not just
-- the first one.
--
-- Note on locking: this migration runs inside node-pg-migrate's default
-- transaction, so CREATE INDEX CONCURRENTLY is not used (see
-- 20260520120000_add_missing_fk_indexes.sql). Each CREATE INDEX takes a
-- brief ShareLock; run during a low-traffic window if these tables are
-- large by the time this deploys.

CREATE INDEX IF NOT EXISTS idx_buyers_created_at
    ON buyers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sellers_created_at
    ON sellers (created_at DESC);
