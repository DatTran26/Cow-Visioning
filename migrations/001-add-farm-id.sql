-- Migration: Add farm_id to all relevant tables
-- Phase 1: nullable VARCHAR(100) column, no FK constraint
-- Phase 2: will add farms table + FK + NOT NULL enforcement
-- Safe to run multiple times (idempotent via ADD COLUMN IF NOT EXISTS)

ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_cow_images_farm_id ON cow_images (farm_id);
COMMENT ON COLUMN cow_images.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';

ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_users_farm_id ON users (farm_id);
COMMENT ON COLUMN users.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_blog_posts_farm_id ON blog_posts (farm_id);
COMMENT ON COLUMN blog_posts.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';

ALTER TABLE app_config ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);
COMMENT ON COLUMN app_config.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';
