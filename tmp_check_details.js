const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkDetails() {
    try {
        const res = await pool.query('SELECT id, cow_id, file_name, image_url, original_image_url FROM cow_images ORDER BY id DESC LIMIT 5');
        console.log('Last 5 records:');
        res.rows.forEach(row => {
            console.log(JSON.stringify(row, null, 2));
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkDetails();
