const { Pool } = require('pg');
require('dotenv').config({ override: true });

async function migrate() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'cow_visioning',
        user: process.env.DB_USER || 'cowapp',
        password: process.env.DB_PASSWORD || 'cowpass123',
    });
    try {
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
        console.log('Successfully added is_active column to users table.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

migrate();
