const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkImages() {
    try {
        const res = await pool.query('SELECT id, cow_id, image_url, original_image_url, file_name, created_at FROM cow_images ORDER BY created_at DESC');
        console.log(`Total records: ${res.rows.length}`);
        console.log('Top 10 records:');
        res.rows.slice(0, 10).forEach(row => {
            console.log(`- ID: ${row.id}, Cow: ${row.cow_id}, File: ${row.file_name}, URL: ${row.image_url}`);
        });
    } catch (err) {
        console.error('Error querying DB:', err.message);
    } finally {
        await pool.end();
    }
}

checkImages();
