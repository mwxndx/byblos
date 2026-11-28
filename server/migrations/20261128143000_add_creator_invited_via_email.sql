ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS invited_via_email BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing creators who signed up / accepted an email invite
UPDATE creators c
SET invited_via_email = TRUE
WHERE EXISTS (
  SELECT 1
  FROM seller_creator_invites sci
  WHERE sci.accepted_creator_id = c.id
    AND sci.status = 'accepted'
);

