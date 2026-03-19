require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { execSync } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

let APP_VERSION = Date.now().toString();
try {
    APP_VERSION = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cow_visioning',
    user: process.env.DB_USER || 'cowapp',
    password: process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 1000,
});

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
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chi chap nhan file anh'));
        }
    },
});

app.use(express.json());

app.use(
    session({
        store: new PgSession({
            pool,
            tableName: 'session',
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET || 'cow-visioning-default-secret-change-me',
        resave: false,
        saveUninitialized: false,
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
        },
    })
);

function authRequired(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
}

function requireAuthPage(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.redirect('/auth/login');
    }
    return next();
}

function normalizeText(input, maxLen) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const allowedBehaviors = new Set([
    'standing',
    'lying',
    'eating',
    'drinking',
    'walking',
    'abnormal',
]);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Qua nhieu yeu cau xac thuc. Vui long thu lai sau 15 phut.' },
});

const postWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Ban thao tac qua nhanh. Vui long thu lai sau.' },
});

const commentWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Ban dang gui binh luan qua nhanh. Vui long thu lai sau.' },
});

const likeLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Ban da thao tac like qua nhanh. Vui long thu lai sau.' },
});

app.get('/auth/status', (_req, res) => {
    res.json({ mode: 'multi-user-password' });
});

app.get('/auth/login', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    return res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get('/auth/register', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/');
    }
    return res.sendFile(path.join(__dirname, 'public', 'auth', 'register.html'));
});

app.post('/auth/register', authLimiter, async (req, res) => {
    try {
        const username = normalizeText(req.body.username, 30).toLowerCase();
        const email = normalizeText(req.body.email, 120).toLowerCase();
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        const passwordConfirm = typeof req.body.password_confirm === 'string' ? req.body.password_confirm : '';

        if (!username || username.length < 3 || username.length > 30) {
            return res.status(400).json({ error: 'Username phai tu 3 den 30 ky tu' });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Username chi gom chu, so, dau _' });
        }
        if (!validEmail(email)) {
            return res.status(400).json({ error: 'Email khong hop le' });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ error: 'Mat khau phai tu 8 den 72 ky tu' });
        }
        if (password !== passwordConfirm) {
            return res.status(400).json({ error: 'Xac nhan mat khau khong khop' });
        }

        const exists = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
            [username, email]
        );
        if (exists.rows.length > 0) {
            return res.status(400).json({ error: 'Username hoac email da ton tai' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const created = await pool.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, role, created_at`,
            [username, email, passwordHash]
        );

        return res.status(201).json({ success: true, user: created.rows[0] });
    } catch (err) {
        console.error('POST /auth/register error:', err);
        return res.status(500).json({ error: 'Khong the tao tai khoan' });
    }
});

app.post('/auth/login', authLimiter, async (req, res) => {
    try {
        const username = normalizeText(req.body.username, 30).toLowerCase();
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        if (!username || !password) {
            return res.status(400).json({ error: 'Thieu username hoac password' });
        }

        const result = await pool.query(
            'SELECT id, username, email, role, password_hash FROM users WHERE username = $1 LIMIT 1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Thong tin dang nhap khong dung' });
        }

        const user = result.rows[0];
        const matched = await bcrypt.compare(password, user.password_hash);
        if (!matched) {
            return res.status(401).json({ error: 'Thong tin dang nhap khong dung' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        return res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        console.error('POST /auth/login error:', err);
        return res.status(500).json({ error: 'Loi dang nhap' });
    }
});

app.get('/auth/me', authRequired, async (req, res) => {
    try {
        const me = await pool.query(
            'SELECT id, username, email, role, created_at FROM users WHERE id = $1 LIMIT 1',
            [req.session.userId]
        );
        if (me.rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.json({ user: me.rows[0] });
    } catch (err) {
        console.error('GET /auth/me error:', err);
        return res.status(500).json({ error: 'Khong the tai thong tin user' });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.get('/', requireAuthPage, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/version', (_req, res) => {
    res.json({ version: APP_VERSION });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.post('/api/images', authRequired, postWriteLimiter, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Khong co file anh' });
        }

        const cowId = normalizeText(req.body.cow_id, 100);
        const behavior = normalizeText(req.body.behavior, 50);
        const barnArea = normalizeText(req.body.barn_area, 200);
        const notes = normalizeText(req.body.notes, 4000);
        const capturedAt = req.body.captured_at ? new Date(req.body.captured_at) : new Date();

        if (!cowId || !behavior) {
            return res.status(400).json({ error: 'Thieu cow_id hoac behavior' });
        }
        if (!allowedBehaviors.has(behavior)) {
            return res.status(400).json({ error: 'Behavior khong hop le' });
        }
        if (!Number.isFinite(capturedAt.getTime())) {
            return res.status(400).json({ error: 'captured_at khong hop le' });
        }

        const relativePath = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');
        const imageUrl = `/uploads/${relativePath}`;

        const result = await pool.query(
            `INSERT INTO cow_images (user_id, cow_id, behavior, barn_area, captured_at, notes, image_url, file_name, file_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                req.session.userId,
                cowId,
                behavior,
                barnArea || null,
                capturedAt.toISOString(),
                notes || null,
                imageUrl,
                req.file.filename,
                req.file.size,
            ]
        );

        return res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('POST /api/images error:', err);
        return res.status(500).json({ error: 'Upload that bai' });
    }
});

app.get('/api/images', authRequired, async (req, res) => {
    try {
        const cowId = normalizeText(req.query.cow_id || '', 100);
        const behavior = normalizeText(req.query.behavior || '', 50);
        const barnArea = normalizeText(req.query.barn_area || '', 200);
        const conditions = ['user_id = $1'];
        const params = [req.session.userId];
        let idx = 2;

        if (cowId) {
            conditions.push(`cow_id ILIKE $${idx++}`);
            params.push(`%${cowId}%`);
        }
        if (behavior) {
            conditions.push(`behavior = $${idx++}`);
            params.push(behavior);
        }
        if (barnArea) {
            conditions.push(`barn_area ILIKE $${idx++}`);
            params.push(`%${barnArea}%`);
        }

        const sql = `SELECT * FROM cow_images WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
        const result = await pool.query(sql, params);
        return res.json({ data: result.rows });
    } catch (err) {
        console.error('GET /api/images error:', err);
        return res.status(500).json({ error: 'Khong the tai danh sach anh' });
    }
});

app.delete('/api/images/:id', authRequired, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID khong hop le' });
        }

        const record = await pool.query(
            'SELECT image_url, user_id FROM cow_images WHERE id = $1 LIMIT 1',
            [id]
        );
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay anh' });
        }
        if (record.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen xoa anh nay' });
        }

        const imageUrl = record.rows[0].image_url;
        const uploadRoot = path.resolve(UPLOAD_DIR);
        const relativeFromUpload = String(imageUrl || '').replace(/^\/uploads\/?/, '');
        const filePath = path.resolve(uploadRoot, relativeFromUpload);
        const insideUploadRoot = filePath === uploadRoot || filePath.startsWith(`${uploadRoot}${path.sep}`);
        if (!insideUploadRoot) {
            return res.status(400).json({ error: 'Duong dan file khong hop le' });
        }
        try {
            fs.unlinkSync(filePath);
        } catch (fsErr) {
            console.warn('File delete warning:', fsErr.message);
        }

        await pool.query('DELETE FROM cow_images WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/images/:id error:', err);
        return res.status(500).json({ error: 'Xoa that bai' });
    }
});

app.get('/api/blog/posts', authRequired, async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10), 100));
        const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

        const totalResult = await pool.query('SELECT COUNT(*)::int AS total FROM blog_posts');
        const postsResult = await pool.query(
            `SELECT
                p.id,
                p.user_id,
                p.title,
                p.content,
                p.created_at,
                p.updated_at,
                u.username,
                COALESCE(l.like_count, 0)::int AS like_count,
                COALESCE(c.comment_count, 0)::int AS comment_count,
                     COALESCE(pi.images, '[]'::json) AS images,
                CASE WHEN ul.user_id IS NULL THEN false ELSE true END AS liked_by_me
             FROM blog_posts p
             INNER JOIN users u ON u.id = p.user_id
             LEFT JOIN (
                SELECT post_id, COUNT(*) AS like_count FROM blog_likes GROUP BY post_id
             ) l ON l.post_id = p.id
             LEFT JOIN (
                SELECT post_id, COUNT(*) AS comment_count FROM blog_comments GROUP BY post_id
             ) c ON c.post_id = p.id
                 LEFT JOIN (
                     SELECT
                          post_id,
                          json_agg(
                                json_build_object(
                                     'id', id,
                                     'image_url', image_url,
                                     'file_name', file_name,
                                     'file_size', file_size,
                                     'created_at', created_at
                                )
                                ORDER BY created_at DESC
                          ) AS images
                     FROM blog_post_images
                     GROUP BY post_id
                 ) pi ON pi.post_id = p.id
             LEFT JOIN blog_likes ul ON ul.post_id = p.id AND ul.user_id = $1
             ORDER BY p.created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.session.userId, limit, offset]
        );

        return res.json({
            data: postsResult.rows,
            meta: { total: totalResult.rows[0].total, limit, offset },
        });
    } catch (err) {
        console.error('GET /api/blog/posts error:', err);
        return res.status(500).json({ error: 'Khong the tai bai viet' });
    }
});

app.post('/api/blog/posts', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const title = normalizeText(req.body.title, 255);
        const content = normalizeText(req.body.content, 10000);
        if (!title || !content) {
            return res.status(400).json({ error: 'Title va content la bat buoc' });
        }
        if (title.length < 3 || content.length < 10) {
            return res.status(400).json({ error: 'Noi dung bai viet qua ngan' });
        }

        const created = await pool.query(
            `INSERT INTO blog_posts (user_id, title, content)
             VALUES ($1, $2, $3)
             RETURNING id, user_id, title, content, created_at, updated_at`,
            [req.session.userId, title, content]
        );

        return res.status(201).json({ success: true, data: created.rows[0] });
    } catch (err) {
        console.error('POST /api/blog/posts error:', err);
        return res.status(500).json({ error: 'Khong the tao bai viet' });
    }
});

app.put('/api/blog/posts/:id', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID khong hop le' });
        }

        const title = normalizeText(req.body.title, 255);
        const content = normalizeText(req.body.content, 10000);
        if (!title || !content) {
            return res.status(400).json({ error: 'Title va content la bat buoc' });
        }
        if (title.length < 3 || content.length < 10) {
            return res.status(400).json({ error: 'Noi dung bai viet qua ngan' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_posts WHERE id = $1', [id]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay bai viet' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen sua bai viet nay' });
        }

        const updated = await pool.query(
            `UPDATE blog_posts
             SET title = $1, content = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING id, user_id, title, content, created_at, updated_at`,
            [title, content, id]
        );

        return res.json({ success: true, data: updated.rows[0] });
    } catch (err) {
        console.error('PUT /api/blog/posts/:id error:', err);
        return res.status(500).json({ error: 'Khong the cap nhat bai viet' });
    }
});

app.delete('/api/blog/posts/:id', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID khong hop le' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_posts WHERE id = $1', [id]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay bai viet' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen xoa bai viet nay' });
        }

        await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/blog/posts/:id error:', err);
        return res.status(500).json({ error: 'Khong the xoa bai viet' });
    }
});

app.post('/api/blog/posts/:postId/images', authRequired, postWriteLimiter, upload.single('image'), async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID khong hop le' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Khong co file anh' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_posts WHERE id = $1 LIMIT 1', [postId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay bai viet' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen them anh vao bai viet nay' });
        }

        const relativePath = path.relative(UPLOAD_DIR, req.file.path).replace(/\\/g, '/');
        const imageUrl = `/uploads/${relativePath}`;

        const inserted = await pool.query(
            `INSERT INTO blog_post_images (post_id, user_id, image_url, file_name, file_size)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, post_id, user_id, image_url, file_name, file_size, created_at`,
            [postId, req.session.userId, imageUrl, req.file.filename, req.file.size]
        );

        return res.status(201).json({ success: true, data: inserted.rows[0] });
    } catch (err) {
        console.error('POST /api/blog/posts/:postId/images error:', err);
        return res.status(500).json({ error: 'Khong the tai anh len bai viet' });
    }
});

app.delete('/api/blog/images/:id', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Image ID khong hop le' });
        }

        const record = await pool.query(
            `SELECT i.id, i.user_id, i.image_url
             FROM blog_post_images i
             WHERE i.id = $1
             LIMIT 1`,
            [id]
        );
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay anh bai viet' });
        }
        if (record.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen xoa anh nay' });
        }

        const imageUrl = record.rows[0].image_url;
        const uploadRoot = path.resolve(UPLOAD_DIR);
        const relativeFromUpload = String(imageUrl || '').replace(/^\/uploads\/?/, '');
        const filePath = path.resolve(uploadRoot, relativeFromUpload);
        const insideUploadRoot = filePath === uploadRoot || filePath.startsWith(`${uploadRoot}${path.sep}`);
        if (!insideUploadRoot) {
            return res.status(400).json({ error: 'Duong dan file khong hop le' });
        }
        try {
            fs.unlinkSync(filePath);
        } catch (fsErr) {
            console.warn('Blog image delete warning:', fsErr.message);
        }

        await pool.query('DELETE FROM blog_post_images WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/blog/images/:id error:', err);
        return res.status(500).json({ error: 'Khong the xoa anh bai viet' });
    }
});

app.get('/api/blog/posts/:postId/comments', authRequired, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID khong hop le' });
        }

        const comments = await pool.query(
            `SELECT c.id, c.post_id, c.user_id, c.content, c.created_at, u.username
             FROM blog_comments c
             INNER JOIN users u ON u.id = c.user_id
             WHERE c.post_id = $1
             ORDER BY c.created_at ASC`,
            [postId]
        );
        return res.json({ data: comments.rows });
    } catch (err) {
        console.error('GET /api/blog/posts/:postId/comments error:', err);
        return res.status(500).json({ error: 'Khong the tai comment' });
    }
});

app.post('/api/blog/posts/:postId/comments', authRequired, commentWriteLimiter, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID khong hop le' });
        }

        const content = normalizeText(req.body.content, 2000);
        if (!content) {
            return res.status(400).json({ error: 'Comment khong duoc de trong' });
        }
        if (content.length < 2) {
            return res.status(400).json({ error: 'Comment qua ngan' });
        }

        const exists = await pool.query('SELECT id FROM blog_posts WHERE id = $1', [postId]);
        if (exists.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay bai viet' });
        }

        const inserted = await pool.query(
            `INSERT INTO blog_comments (post_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING id, post_id, user_id, content, created_at`,
            [postId, req.session.userId, content]
        );

        return res.status(201).json({ success: true, data: inserted.rows[0] });
    } catch (err) {
        console.error('POST /api/blog/posts/:postId/comments error:', err);
        return res.status(500).json({ error: 'Khong the them comment' });
    }
});

app.delete('/api/blog/comments/:id', authRequired, commentWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Comment ID khong hop le' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_comments WHERE id = $1', [id]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay comment' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen xoa comment nay' });
        }

        await pool.query('DELETE FROM blog_comments WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/blog/comments/:id error:', err);
        return res.status(500).json({ error: 'Khong the xoa comment' });
    }
});

app.post('/api/blog/posts/:postId/likes', authRequired, likeLimiter, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID khong hop le' });
        }

        const postExists = await pool.query('SELECT id FROM blog_posts WHERE id = $1 LIMIT 1', [postId]);
        if (postExists.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay bai viet' });
        }

        const existing = await pool.query(
            'SELECT id FROM blog_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1',
            [postId, req.session.userId]
        );

        let liked = false;
        if (existing.rows.length > 0) {
            await pool.query('DELETE FROM blog_likes WHERE id = $1', [existing.rows[0].id]);
            liked = false;
        } else {
            await pool.query('INSERT INTO blog_likes (post_id, user_id) VALUES ($1, $2)', [
                postId,
                req.session.userId,
            ]);
            liked = true;
        }

        const countResult = await pool.query(
            'SELECT COUNT(*)::int AS count FROM blog_likes WHERE post_id = $1',
            [postId]
        );
        return res.json({ success: true, liked, like_count: countResult.rows[0].count });
    } catch (err) {
        console.error('POST /api/blog/posts/:postId/likes error:', err);
        return res.status(500).json({ error: 'Khong the xu ly like' });
    }
});

app.listen(PORT, () => {
    console.log(`Cow-Visioning server running at http://localhost:${PORT}`);
});

