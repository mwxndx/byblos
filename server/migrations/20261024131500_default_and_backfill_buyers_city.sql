-- Migration: Set default for city and location in buyers, and backfill existing nulls
ALTER TABLE buyers ALTER COLUMN city SET DEFAULT 'Nairobi';
ALTER TABLE buyers ALTER COLUMN location SET DEFAULT 'Nairobi';

UPDATE buyers
SET city = 'Nairobi'
WHERE city IS NULL OR TRIM(city) = '' OR city = 'Unknown City';

UPDATE buyers
SET location = 'Nairobi'
WHERE location IS NULL OR TRIM(location) = '';
