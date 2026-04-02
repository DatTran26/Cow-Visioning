const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function checkCounts() {
    try {
        const res = await pool.query('SELECT cow_id, COUNT(*) FROM cow_images GROUP BY cow_id ORDER BY count DESC');
        console.log('Image counts by Cow ID:');
        res.rows.forEach(row => {
            console.log(`- ${row.cow_id}: ${row.count} images`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkCounts();
