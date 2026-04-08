-- ═══════════════════════════════════════════════════════
-- Cow-Visioning Database Schema
-- Idempotent (safe to re-run): all statements use IF NOT EXISTS / ON CONFLICT
-- Run: psql -U cowapp -d cow_visioning -f schema.sql
-- ═══════════════════════════════════════════════════════

-- ─── users ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(50)  NOT NULL DEFAULT 'user',
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    farm_id         VARCHAR(100),                          -- Phase 2 multi-tenancy
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Backward-compat: add columns for databases created before this version
ALTER TABLE users ADD COLUMN IF NOT EXISTS role      VARCHAR(50)  NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN      NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_id   VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_farm_id ON users (farm_id);

COMMENT ON COLUMN users.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';


-- ─── cow_images ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cow_images (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    cow_id              VARCHAR(100)  NOT NULL,
    behavior            VARCHAR(50)   NOT NULL,
    barn_area           VARCHAR(200),
    captured_at         TIMESTAMP,
    notes               TEXT,
    -- image_url holds the "display" URL (annotated if available, else original)
    image_url           VARCHAR(500),
    original_image_url  VARCHAR(500),
    annotated_image_url VARCHAR(500),
    file_name           VARCHAR(255),
    file_size           INTEGER,
    -- AI metadata
    ai_confidence       DOUBLE PRECISION,
    primary_bbox        JSONB,
    detection_count     INTEGER,
    ai_raw_result       JSONB,
    ai_model_name       VARCHAR(255),
    ai_inference_ms     DOUBLE PRECISION,
    ai_provider         VARCHAR(50),
    ai_status           VARCHAR(50),
    -- Phase 2 multi-tenancy
    farm_id             VARCHAR(100),
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Backward-compat
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS user_id             INTEGER;
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS original_image_url  VARCHAR(500);
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS annotated_image_url VARCHAR(500);
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_confidence       DOUBLE PRECISION;
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS primary_bbox        JSONB;
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS detection_count     INTEGER;
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_raw_result       JSONB;
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_model_name       VARCHAR(255);
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_inference_ms     DOUBLE PRECISION;
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_provider         VARCHAR(50);
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_status           VARCHAR(50);
ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS farm_id             VARCHAR(100);

-- Add FK from user_id → users(id) only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cow_images_user'
    ) THEN
        ALTER TABLE cow_images
            ADD CONSTRAINT fk_cow_images_user
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- Migrate legacy rows: populate original_image_url from image_url if missing
UPDATE cow_images
   SET original_image_url = image_url
 WHERE original_image_url IS NULL
   AND image_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cow_images_cow_id     ON cow_images (cow_id);
CREATE INDEX IF NOT EXISTS idx_cow_images_behavior   ON cow_images (behavior);
CREATE INDEX IF NOT EXISTS idx_cow_images_created_at ON cow_images (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cow_images_user_id    ON cow_images (user_id);
CREATE INDEX IF NOT EXISTS idx_cow_images_farm_id    ON cow_images (farm_id);

COMMENT ON COLUMN cow_images.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';


-- ─── blog_posts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    content    TEXT         NOT NULL,
    farm_id    VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id    ON blog_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_farm_id    ON blog_posts (farm_id);

COMMENT ON COLUMN blog_posts.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';


-- ─── blog_comments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_comments (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id    ON blog_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_created_at ON blog_comments (created_at);


-- ─── blog_likes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_likes (
    id            SERIAL PRIMARY KEY,
    post_id       INTEGER      NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id       INTEGER      NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    reaction_type VARCHAR(20)  NOT NULL DEFAULT 'like',
    created_at    TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Backward-compat
ALTER TABLE blog_likes ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) NOT NULL DEFAULT 'like';
UPDATE blog_likes SET reaction_type = 'like' WHERE reaction_type IS NULL OR reaction_type = '';

CREATE INDEX IF NOT EXISTS idx_blog_likes_post_id       ON blog_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_likes_post_reaction ON blog_likes (post_id, reaction_type);


-- ─── blog_post_images ────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_post_images (
    id         SERIAL PRIMARY KEY,
    post_id    INTEGER      NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id    INTEGER      NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    image_url  VARCHAR(500) NOT NULL,
    file_name  VARCHAR(255) NOT NULL,
    file_size  INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_post_images_post_id ON blog_post_images (post_id);


-- ─── app_config ──────────────────────────────────────────
-- Stores runtime-editable settings (AI toggles, URLs, thresholds, etc.)
CREATE TABLE IF NOT EXISTS app_config (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT NOT NULL,
    farm_id    VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE app_config ADD COLUMN IF NOT EXISTS farm_id VARCHAR(100);

COMMENT ON COLUMN app_config.farm_id IS 'Farm identifier. Nullable in Phase 1. FK enforced in Phase 2.';


-- ─── session ─────────────────────────────────────────────
-- Used by connect-pg-simple for express-session storage
CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR NOT NULL COLLATE "default",
    "sess"   JSON    NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");


-- ═══ Seed: default user accounts ════════════════════════
-- Passwords (bcrypt $2a$10$):
--   admin    → admin123456
--   trandat  → hd123456
--   ngochieu → hd123456
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin') THEN
        INSERT INTO users (username, email, password_hash, role)
        VALUES (
            'admin',
            'admin@cowvisioning.local',
            '$2a$10$lPR5Ui0gRlJaE.ubyP50KuDsHF1/SQLkOkqevuYEYh654JGU53cXK',
            'admin'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'trandat') THEN
        INSERT INTO users (username, email, password_hash, role)
        VALUES (
            'trandat',
            'trandat@cowvisioning.local',
            '$2a$10$MBYZnV7UwRIaqoZSm5mgueHqsojaeKp5QIx48Qxmkn6j7wYTtfKaW',
            'user'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE username = 'ngochieu') THEN
        INSERT INTO users (username, email, password_hash, role)
        VALUES (
            'ngochieu',
            'ngochieu@cowvisioning.local',
            '$2a$10$MBYZnV7UwRIaqoZSm5mgueHqsojaeKp5QIx48Qxmkn6j7wYTtfKaW',
            'user'
        );
    END IF;
END $$;


-- ═══ Seed: default app configuration ════════════════════
INSERT INTO app_config (key, value) VALUES
    ('AI_ENABLED',            'true'),
    ('AI_TOOL_PRO_ENABLED',   'true'),
    ('AI_SERVICE_URL',        'http://180.93.2.32:8001'),
    ('AI_TIMEOUT_MS',         '20000'),
    ('AI_MODEL_NAME',         'cow-behavior-yolo'),
    ('AI_MODEL_BACKEND',      'auto'),
    ('AI_MODEL_PATH',         './ai_service/models/boudding_catllte_v1_22es.pt'),
    ('AI_BEHAVIOR_MAP_PATH',  './ai_service/behavior_map.json'),
    ('AI_DEVICE',             'cpu'),
    ('AI_CONF_THRESHOLD',     '0.25'),
    ('AI_IOU_THRESHOLD',      '0.45'),
    ('AI_MAX_DET',            '50')
ON CONFLICT (key) DO NOTHING;
