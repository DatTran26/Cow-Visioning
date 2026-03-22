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
const UPLOAD_ROOT = path.resolve(UPLOAD_DIR);
const AI_ENABLED = process.env.AI_ENABLED !== 'false';
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function buildDatedUploadDir(bucket) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return ensureDir(path.join(UPLOAD_ROOT, bucket, year, month));
}

function createImageUpload(bucket) {
    return multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => {
                cb(null, buildDatedUploadDir(bucket));
            },
            filename: (_req, file, cb) => {
                const ext = path.extname(file.originalname) || '.jpg';
                cb(null, `${crypto.randomUUID()}${ext}`);
            },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Chi chap nhan file anh'));
            }
        },
    });
}

const datasetUpload = createImageUpload('original');
const blogUpload = createImageUpload('blog');

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

ensureDir(UPLOAD_ROOT);

function toUploadUrl(filePath) {
    const resolved = path.resolve(filePath);
    const insideUploadRoot =
        resolved === UPLOAD_ROOT || resolved.startsWith(`${UPLOAD_ROOT}${path.sep}`);
    if (!insideUploadRoot) {
        return null;
    }
    return `/uploads/${path.relative(UPLOAD_ROOT, resolved).replace(/\\/g, '/')}`;
}

function toUploadAbsolutePath(uploadUrl) {
    const relativeFromUpload = String(uploadUrl || '').replace(/^\/uploads\/?/, '');
    if (!relativeFromUpload) {
        return null;
    }
    const filePath = path.resolve(UPLOAD_ROOT, relativeFromUpload);
    const insideUploadRoot =
        filePath === UPLOAD_ROOT || filePath.startsWith(`${UPLOAD_ROOT}${path.sep}`);
    return insideUploadRoot ? filePath : null;
}

function getAnnotatedOutputDir(originalFilePath) {
    const relativePathParts = path.relative(UPLOAD_ROOT, path.resolve(originalFilePath)).split(path.sep);
    const [, year = String(new Date().getFullYear()), month = String(new Date().getMonth() + 1).padStart(2, '0')] =
        relativePathParts;
    return ensureDir(path.join(UPLOAD_ROOT, 'annotated', year, month));
}

function deleteUploadFile(uploadUrl, warningPrefix) {
    const filePath = toUploadAbsolutePath(uploadUrl);
    if (!filePath) {
        return;
    }
    try {
        fs.unlinkSync(filePath);
    } catch (fsErr) {
        if (fsErr.code !== 'ENOENT') {
            console.warn(`${warningPrefix}:`, fsErr.message);
        }
    }
}

function normalizeImageRecord(record) {
    const displayImageUrl = record.annotated_image_url || record.image_url || record.original_image_url || null;
    return {
        ...record,
        image_url: displayImageUrl,
        original_image_url: record.original_image_url || record.image_url || null,
        annotated_image_url: record.annotated_image_url || null,
    };
}

async function requestAiPrediction({ imagePath, outputDir, requestId }) {
    if (!AI_ENABLED) {
        throw new Error('AI service is disabled');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
        const response = await fetch(`${AI_SERVICE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_path: imagePath,
                output_dir: outputDir,
                request_id: requestId,
            }),
            signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || `AI service returned HTTP ${response.status}`);
        }
        if (payload.status !== 'ok') {
            throw new Error(payload.error || 'AI service could not analyze the image');
        }

        const behavior = normalizeText(payload.predicted_behavior || '', 50).toLowerCase();
        if (!allowedBehaviors.has(behavior)) {
            throw new Error(`AI service returned unsupported behavior: ${payload.predicted_behavior || 'empty'}`);
        }

        if (!payload.annotated_image_path) {
            throw new Error('AI service did not return an annotated image path');
        }

        const annotatedImageUrl = toUploadUrl(payload.annotated_image_path);
        if (!annotatedImageUrl) {
            throw new Error('Annotated image path is outside the uploads directory');
        }

        return {
            ...payload,
            predicted_behavior: behavior,
            annotated_image_url: annotatedImageUrl,
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`AI service timed out after ${AI_TIMEOUT_MS}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

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

app.post('/api/images', authRequired, postWriteLimiter, datasetUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Khong co file anh' });
        }

        const cowId = normalizeText(req.body.cow_id, 100);
        const barnArea = normalizeText(req.body.barn_area, 200);
        const notes = normalizeText(req.body.notes, 4000);
        const capturedAt = req.body.captured_at ? new Date(req.body.captured_at) : new Date();

        if (!cowId) {
            return res.status(400).json({ error: 'Thieu cow_id' });
        }
        if (!Number.isFinite(capturedAt.getTime())) {
            return res.status(400).json({ error: 'captured_at khong hop le' });
        }

        const originalImageUrl = toUploadUrl(req.file.path);
        if (!originalImageUrl) {
            return res.status(500).json({ error: 'Khong the luu duong dan anh goc' });
        }

        let prediction;
        try {
            prediction = await requestAiPrediction({
                imagePath: req.file.path,
                outputDir: getAnnotatedOutputDir(req.file.path),
                requestId: path.parse(req.file.filename).name || crypto.randomUUID(),
            });
        } catch (aiErr) {
            console.error('POST /api/images AI error:', aiErr);
            return res.status(502).json({
                error: 'AI phan tich that bai',
                details: aiErr.message,
                original_image_url: originalImageUrl,
                ai_status: 'failed',
            });
        }

        const result = await pool.query(
            `INSERT INTO cow_images (
                user_id,
                cow_id,
                behavior,
                barn_area,
                captured_at,
                notes,
                image_url,
                original_image_url,
                annotated_image_url,
                file_name,
                file_size,
                ai_confidence,
                primary_bbox,
                detection_count,
                ai_raw_result,
                ai_model_name,
                ai_inference_ms,
                ai_status
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             RETURNING
                id,
                user_id,
                cow_id,
                behavior,
                barn_area,
                captured_at,
                notes,
                image_url,
                original_image_url,
                annotated_image_url,
                file_name,
                file_size,
                created_at,
                ai_confidence,
                primary_bbox,
                detection_count,
                ai_raw_result,
                ai_model_name,
                ai_inference_ms,
                ai_status`,
            [
                req.session.userId,
                cowId,
                prediction.predicted_behavior,
                barnArea || null,
                capturedAt.toISOString(),
                notes || null,
                prediction.annotated_image_url,
                originalImageUrl,
                prediction.annotated_image_url,
                req.file.filename,
                req.file.size,
                typeof prediction.confidence === 'number' ? prediction.confidence : null,
                prediction.primary_bbox || null,
                Number.isInteger(prediction.detection_count) ? prediction.detection_count : 0,
                prediction,
                normalizeText(prediction.model_name || process.env.AI_MODEL_NAME || '', 255) || null,
                typeof prediction.inference_ms === 'number' ? prediction.inference_ms : null,
                'completed',
            ]
        );

        const data = normalizeImageRecord(result.rows[0]);
        return res.json({
            success: true,
            data,
            ai: {
                predicted_behavior: data.behavior,
                confidence: data.ai_confidence,
                status: data.ai_status,
                inference_ms: data.ai_inference_ms,
                detection_count: data.detection_count,
                primary_bbox: data.primary_bbox,
            },
        });
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

        const sql = `
            SELECT
                id,
                user_id,
                cow_id,
                behavior,
                barn_area,
                captured_at,
                notes,
                COALESCE(annotated_image_url, image_url, original_image_url) AS image_url,
                original_image_url,
                annotated_image_url,
                file_name,
                file_size,
                created_at,
                ai_confidence,
                primary_bbox,
                detection_count,
                ai_raw_result,
                ai_model_name,
                ai_inference_ms,
                ai_status
            FROM cow_images
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC`;
        const result = await pool.query(sql, params);
        return res.json({ data: result.rows.map(normalizeImageRecord) });
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
            `SELECT image_url, original_image_url, annotated_image_url, user_id
             FROM cow_images
             WHERE id = $1
             LIMIT 1`,
            [id]
        );
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay anh' });
        }
        if (record.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Ban khong co quyen xoa anh nay' });
        }

        const fileUrls = [
            record.rows[0].image_url,
            record.rows[0].original_image_url,
            record.rows[0].annotated_image_url,
        ];

        for (const uploadUrl of [...new Set(fileUrls.filter(Boolean))]) {
            if (!toUploadAbsolutePath(uploadUrl)) {
                return res.status(400).json({ error: 'Duong dan file khong hop le' });
            }
            deleteUploadFile(uploadUrl, 'File delete warning');
        }

        await pool.query('DELETE FROM cow_images WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/images/:id error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Cow-Visioning server running at http://localhost:${PORT}`);
});

