const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const filesOnVps = [
    '12772529-0578-42bf-bf4b-762bb0423df2.jpg',
    '4c25095e-986d-4d40-bb2c-9f82973a5a75.jpg',
    '609c3f32-f25d-43e3-a550-5ec1d09e9dea.jpg',
    '979ba54c-7591-45ba-ac29-9013cddbf7f2.jpg',
    'd1ef4900-c97a-425b-b82c-c630b3bbcc2b.jpg',
    'e0b535d7-8aa6-4bc3-957e-9255757c9670.jpg',
    'e55915e4-e1f3-439f-8c54-db00488c4e51.png'
];

async function checkSpecificFiles() {
    try {
        const res = await pool.query('SELECT id, file_name, created_at FROM cow_images WHERE file_name = ANY($1)', [filesOnVps]);
        console.log(`Matched records for VPS files: ${res.rows.length}`);
        res.rows.forEach(row => {
            console.log(`- ${row.file_name} (ID: ${row.id}, Created: ${row.created_at})`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkSpecificFiles();
