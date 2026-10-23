-- Allow mobile_payment to be NULL on buyers table
-- Prevents not-null constraint violation when sellers or creators auto-provision
-- or switch to a buyer profile before completing a purchase or entering phone details.
ALTER TABLE buyers ALTER COLUMN mobile_payment DROP NOT NULL;
ALTER TABLE buyers ALTER COLUMN mobile_payment SET DEFAULT NULL;
