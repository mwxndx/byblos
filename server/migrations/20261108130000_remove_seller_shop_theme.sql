-- Remove theme column from sellers table
-- Seller shop theme customization has been deprecated in favor of clean unified theme styling.

ALTER TABLE sellers DROP COLUMN IF EXISTS theme;

