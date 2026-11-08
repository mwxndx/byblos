-- Remove founder card and membership database artifacts
DROP INDEX IF EXISTS buyers_member_number_key;

ALTER TABLE buyers
  DROP COLUMN IF EXISTS is_member,
  DROP COLUMN IF EXISTS member_number,
  DROP COLUMN IF EXISTS membership_joined_at,
  DROP COLUMN IF EXISTS membership_tier;

DROP SEQUENCE IF EXISTS byblos_member_seq;
