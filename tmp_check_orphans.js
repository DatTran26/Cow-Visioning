const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function findVpsOrphans() {
    try {
        const res = await pool.query('SELECT id, file_name, original_image_url FROM cow_images ORDER BY id DESC LIMIT 20');
        console.log('Recent 20 records (DB):');
        res.rows.forEach(row => {
            console.log(`- ${row.id}: ${row.file_name} (${row.original_image_url})`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

findVpsOrphans();
