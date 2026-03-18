require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// --- PostgreSQL ---
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cow_visioning',
    user: process.env.DB_USER || 'cowapp',
    password: process.env.DB_PASSWORD || '',
});

// --- Multer storage ---
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const dir = path.join(UPLOAD_DIR, String(year), month);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chi chap nhan file anh'));
        }
    },
});

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));
app.use(express.json());

// --- API Routes ---

// POST /api/images - Upload image + metadata
app.post('/api/images', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Khong co file anh' });
        }

        const { cow_id, behavior, barn_area, captured_at, notes } = req.body;

        if (!cow_id || !behavior) {
            return res.status(400).json({ error: 'Thieu cow_id hoac behavior' });
        }

        // Build relative URL
        const relativePath = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');
        const imageUrl = `/uploads/${relativePath}`;

        const result = await pool.query(
            `INSERT INTO cow_images (cow_id, behavior, barn_area, captured_at, notes, image_url, file_name, file_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                cow_id,
                behavior,
                barn_area || null,
                captured_at ? new Date(captured_at).toISOString() : new Date().toISOString(),
                notes || null,
                imageUrl,
                req.file.filename,
                req.file.size,
            ]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('POST /api/images error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/images - List/filter images
app.get('/api/images', async (req, res) => {
    try {
        const { cow_id, behavior, barn_area } = req.query;
        const conditions = [];
        const params = [];
        let idx = 1;

        if (cow_id) {
            conditions.push(`cow_id ILIKE $${idx++}`);
            params.push(`%${cow_id}%`);
        }
        if (behavior) {
            conditions.push(`behavior = $${idx++}`);
            params.push(behavior);
        }
        if (barn_area) {
            conditions.push(`barn_area ILIKE $${idx++}`);
            params.push(`%${barn_area}%`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM cow_images ${where} ORDER BY created_at DESC`;

        const result = await pool.query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('GET /api/images error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/images/:id - Delete image + file
app.delete('/api/images/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get file info first
        const record = await pool.query('SELECT image_url FROM cow_images WHERE id = $1', [id]);
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay anh' });
        }

        // Delete file from disk
        const imageUrl = record.rows[0].image_url; // e.g. /uploads/2026/03/uuid.jpg
        const filePath = path.join(__dirname, imageUrl);
        try {
            fs.unlinkSync(filePath);
        } catch (fsErr) {
            console.warn('File delete warning:', fsErr.message);
        }

        // Delete from database
        await pool.query('DELETE FROM cow_images WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/images/:id error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Cow-Visioning server running at http://localhost:${PORT}`);
});
