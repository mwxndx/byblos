-- Migration: Add digital_category to products table
-- Categorizes digital products into audio, video, and document
ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_category VARCHAR(32) DEFAULT NULL;
