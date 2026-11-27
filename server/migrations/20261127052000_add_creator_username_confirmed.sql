-- Track whether a creator has explicitly chosen/confirmed their unique username
-- (existing backfilled rows default to FALSE so they are prompted once to set one).

ALTER TABLE creators
    ADD COLUMN IF NOT EXISTS username_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

