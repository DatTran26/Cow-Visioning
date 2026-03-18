-- Cow-Visioning Database Schema
-- Run: psql -U cowapp -d cow_visioning -f schema.sql

CREATE TABLE IF NOT EXISTS cow_images (
    id SERIAL PRIMARY KEY,
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
