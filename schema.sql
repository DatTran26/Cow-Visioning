-- Cow-Visioning Database Schema
-- Run: psql -U cowapp -d cow_visioning -f schema.sql

CREATE TABLE IF NOT EXISTS cow_images (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    cow_id VARCHAR(100) NOT NULL,
    behavior VARCHAR(50) NOT NULL,
    barn_area VARCHAR(200),
    captured_at TIMESTAMP,
    notes TEXT,
    image_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cow_images_cow_id ON cow_images (cow_id);
CREATE INDEX IF NOT EXISTS idx_cow_images_behavior ON cow_images (behavior);
CREATE INDEX IF NOT EXISTS idx_cow_images_created_at ON cow_images (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cow_images_user_id ON cow_images (user_id);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS blog_post_images (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON blog_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_created_at ON blog_comments (created_at);
CREATE INDEX IF NOT EXISTS idx_blog_likes_post_id ON blog_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_images_post_id ON blog_post_images (post_id);

-- App config (TOTP secret storage)
CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Session storage for express-session (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
