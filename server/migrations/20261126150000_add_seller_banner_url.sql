-- Add banner_url column to sellers table for shop hero banners.
-- Stored as a Cloudinary secure URL (or local /uploads/images path in dev/test),
-- matching avatar_url storage conventions.

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT NULL;
