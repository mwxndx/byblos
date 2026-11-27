-- Add unique username to creators for clean creator storefront URLs (e.g. /eris/roynthiga)

ALTER TABLE creators
    ADD COLUMN IF NOT EXISTS username VARCHAR(64);

-- Backfill existing creators with unique lowercase alphanumeric usernames
WITH base_names AS (
    SELECT
        id,
        COALESCE(
            NULLIF(REGEXP_REPLACE(LOWER(CONCAT(COALESCE(first_name, ''), COALESCE(last_name, ''))), '[^a-z0-9]+', '', 'g'), ''),
            'creator' || id::text
        ) AS base_username
    FROM creators
    WHERE username IS NULL OR TRIM(username) = ''
),
ranked AS (
    SELECT
        id,
        base_username,
        ROW_NUMBER() OVER (PARTITION BY base_username ORDER BY id ASC) AS rn
    FROM base_names
)
UPDATE creators c
SET username = CASE
    WHEN r.rn = 1 AND NOT EXISTS (
        SELECT 1 FROM creators existing
        WHERE existing.id <> c.id AND LOWER(existing.username) = r.base_username
    ) THEN r.base_username
    ELSE r.base_username || c.id::text
END
FROM ranked r
WHERE c.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_username_lower
    ON creators (LOWER(username))
    WHERE username IS NOT NULL;

