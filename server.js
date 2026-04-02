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
const isLocalDev = process.platform === 'win32';
const dbHost = process.env.DB_HOST || 'localhost';
const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';

// Determine the base URL for images
// On production VPS: Use empty string to support Relative Paths (Auto Domain/IP)
// On Local Dev with Remote DB: Use VPS_URL or fallback to http://dbHost (no port 3000 as per Nginx config)
const IMAGE_BASE_URL = (isLocalDev && isRemoteDb)
    ? (process.env.VPS_URL || `http://${dbHost}`).replace(/\/+$/, '')
    : (process.env.VPS_URL || '').replace(/\/+$/, '');

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
    connectionTimeoutMillis: 10000, // Tăng lên 10 giây cho kết nối từ xa
    idleTimeoutMillis: 30000,
    max: 10,
});

// Kiểm tra kết nối khi khởi động
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ LỖI KẾT NỐI DATABASE:', err.message);
        console.log('👉 Hãy kiểm tra IP:', process.env.DB_HOST, 'và Firewall của VPS.');
    } else {
        console.log('✅ Đã kết nối Database trên VPS thành công lúc:', res.rows[0].now);
    }
});

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const UPLOAD_ROOT = path.resolve(UPLOAD_DIR);
const AI_ENABLED = process.env.AI_ENABLED !== 'false';
const AI_DEFAULT_URL = (isLocalDev && isRemoteDb) ? `http://${dbHost}:8001` : 'http://127.0.0.1:8001';
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || AI_DEFAULT_URL).replace(/\/+$/, '');
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

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Khong co quyen admin' });
    }
    return next();
}

// Runtime AI settings (loaded from env, changeable by admin)
const aiSettings = {
    AI_DEVICE: process.env.AI_DEVICE || 'cpu',
    AI_CONF_THRESHOLD: parseFloat(process.env.AI_CONF_THRESHOLD || '0.25'),
    AI_IOU_THRESHOLD: parseFloat(process.env.AI_IOU_THRESHOLD || '0.45'),
    AI_MAX_DET: parseInt(process.env.AI_MAX_DET || '50', 10),
    AI_ENABLED: process.env.AI_ENABLED !== 'false',
};

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

function toFullUrl(url) {
    if (!url || url.startsWith('http') || !IMAGE_BASE_URL) return url;
    return `${IMAGE_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function normalizeImageRecord(record) {
    const displayImageUrl = record.annotated_image_url || record.image_url || record.original_image_url || null;
    return {
        ...record,
        image_url: toFullUrl(displayImageUrl),
        original_image_url: toFullUrl(record.original_image_url || record.image_url || null),
        annotated_image_url: toFullUrl(record.annotated_image_url || null),
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
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

app.get(['/', '/dashboard', '/quan-li-iot', '/ai-models', '/dataset-cow', '/tai-khoan', '/cai-dat'], (_req, res) => {
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

        // Try AI prediction, fallback to saving without AI if it fails
        let prediction = null;
        let aiStatus = 'skipped';
        if (aiSettings.AI_ENABLED) {
            try {
                prediction = await requestAiPrediction({
                    imagePath: req.file.path,
                    outputDir: getAnnotatedOutputDir(req.file.path),
                    requestId: path.parse(req.file.filename).name || crypto.randomUUID(),
                });
                aiStatus = 'completed';
            } catch (aiErr) {
                console.error('POST /api/images AI error (fallback to save without AI):', aiErr.message);
                aiStatus = 'failed';
            }
        }

        const behaviorValue = prediction ? prediction.predicted_behavior : (req.body.behavior || 'standing');
        const annotatedUrl = prediction ? prediction.annotated_image_url : null;

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
                behaviorValue,
                barnArea || null,
                capturedAt.toISOString(),
                notes || null,
                annotatedUrl || originalImageUrl,
                originalImageUrl,
                annotatedUrl,
                req.file.filename,
                req.file.size,
                prediction && typeof prediction.confidence === 'number' ? prediction.confidence : null,
                prediction ? (prediction.primary_bbox || null) : null,
                prediction && Number.isInteger(prediction.detection_count) ? prediction.detection_count : 0,
                prediction || null,
                prediction ? (normalizeText(prediction.model_name || process.env.AI_MODEL_NAME || '', 255) || null) : null,
                prediction && typeof prediction.inference_ms === 'number' ? prediction.inference_ms : null,
                aiStatus,
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
        // Show user's own images + legacy images (user_id IS NULL)
        const conditions = ['(user_id = $1 OR user_id IS NULL)'];
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
        console.error('GET /api/images error:', err.message);
        return res.status(500).json({ error: 'Khong the tai danh sach anh', details: err.message });
    }
});

app.put('/api/images/:id/label', authRequired, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const behavior = normalizeText(req.body.behavior, 50).toLowerCase();
        
        if (!id || !behavior) {
            return res.status(400).json({ error: 'Thieu ID hoac nhãn hanh vi' });
        }

        const result = await pool.query(
            'UPDATE cow_images SET behavior = $1 WHERE id = $2 AND (user_id = $3 OR (SELECT role FROM users WHERE id = $3) = \'admin\') RETURNING id',
            [behavior, id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay anh hoac khong co quyen' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/images/:id/label error:', err);
        return res.status(500).json({ error: 'Loi khi cap nhat nhan' });
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
            data: postsResult.rows.map(post => ({
                ...post,
                images: (Array.isArray(post.images) ? post.images : []).map(img => ({
                    ...img,
                    image_url: toFullUrl(img.image_url)
                }))
            })),
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

app.post('/api/blog/posts/:postId/images', authRequired, postWriteLimiter, blogUpload.single('image'), async (req, res) => {
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

        const imageUrl = toUploadUrl(req.file.path);
        if (!imageUrl) {
            return res.status(500).json({ error: 'Khong the luu duong dan anh bai viet' });
        }

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
        if (!toUploadAbsolutePath(imageUrl)) {
            return res.status(400).json({ error: 'Duong dan file khong hop le' });
        }
        deleteUploadFile(imageUrl, 'Blog image delete warning');

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

// ═══ ADMIN ROUTES ═══

app.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.email, u.role, u.created_at, u.updated_at,
                    COALESCE(img.image_count, 0)::int AS image_count,
                    COALESCE(bp.post_count, 0)::int AS post_count
             FROM users u
             LEFT JOIN (SELECT user_id, COUNT(*) AS image_count FROM cow_images GROUP BY user_id) img ON img.user_id = u.id
             LEFT JOIN (SELECT user_id, COUNT(*) AS post_count FROM blog_posts GROUP BY user_id) bp ON bp.user_id = u.id
             ORDER BY u.created_at DESC`
        );
        return res.json({ data: result.rows });
    } catch (err) {
        console.error('GET /admin/users error:', err.message);
        return res.status(500).json({ error: 'Khong the tai danh sach user', details: err.message });
    }
});

app.put('/admin/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID khong hop le' });

        const newRole = normalizeText(req.body.role, 20);
        if (!['admin', 'user'].includes(newRole)) {
            return res.status(400).json({ error: 'Role khong hop le. Chi chap nhan: admin, user' });
        }

        if (id === req.session.userId && newRole !== 'admin') {
            return res.status(400).json({ error: 'Khong the tu ha quyen cua chinh minh' });
        }

        const updated = await pool.query(
            `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
             RETURNING id, username, email, role, updated_at`,
            [newRole, id]
        );
        if (updated.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay user' });
        }

        return res.json({ success: true, data: updated.rows[0] });
    } catch (err) {
        console.error('PUT /admin/users/:id/role error:', err);
        return res.status(500).json({ error: 'Khong the cap nhat role' });
    }
});

app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID khong hop le' });

        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Khong the tu xoa chinh minh' });
        }

        const check = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Khong tim thay user' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.json({ success: true, deleted: check.rows[0].username });
    } catch (err) {
        console.error('DELETE /admin/users/:id error:', err);
        return res.status(500).json({ error: 'Khong the xoa user' });
    }
});

// Public read-only AI settings (for user-facing display)
app.get('/api/ai-settings', authRequired, (_req, res) => {
    return res.json({
        data: {
            AI_CONF_THRESHOLD: aiSettings.AI_CONF_THRESHOLD,
            AI_IOU_THRESHOLD: aiSettings.AI_IOU_THRESHOLD,
            AI_MAX_DET: aiSettings.AI_MAX_DET,
            AI_DEVICE: aiSettings.AI_DEVICE,
            AI_ENABLED: aiSettings.AI_ENABLED,
        }
    });
});

app.get('/admin/ai-settings', requireAdmin, (_req, res) => {
    return res.json({ data: aiSettings });
});

app.put('/admin/ai-settings', requireAdmin, (req, res) => {
    try {
        if (typeof req.body.AI_DEVICE === 'string') {
            const d = req.body.AI_DEVICE.trim();
            if (['cpu', '0', '1', 'cuda', 'cuda:0', 'cuda:1'].includes(d)) aiSettings.AI_DEVICE = d;
        }
        if (typeof req.body.AI_CONF_THRESHOLD === 'number') {
            aiSettings.AI_CONF_THRESHOLD = Math.max(0, Math.min(1, req.body.AI_CONF_THRESHOLD));
        }
        if (typeof req.body.AI_IOU_THRESHOLD === 'number') {
            aiSettings.AI_IOU_THRESHOLD = Math.max(0, Math.min(1, req.body.AI_IOU_THRESHOLD));
        }
        if (typeof req.body.AI_MAX_DET === 'number') {
            aiSettings.AI_MAX_DET = Math.max(1, Math.min(1000, Math.floor(req.body.AI_MAX_DET)));
        }
        if (typeof req.body.AI_ENABLED === 'boolean') {
            aiSettings.AI_ENABLED = req.body.AI_ENABLED;
        }
        return res.json({ success: true, data: aiSettings });
    } catch (err) {
        console.error('PUT /admin/ai-settings error:', err);
        return res.status(500).json({ error: 'Khong the cap nhat AI settings' });
    }
});

app.get('/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [users, images, posts] = await Promise.all([
            pool.query('SELECT COUNT(*)::int AS count FROM users'),
            pool.query('SELECT COUNT(*)::int AS count FROM cow_images'),
            pool.query('SELECT COUNT(*)::int AS count FROM blog_posts'),
        ]);
        return res.json({
            total_users: users.rows[0].count,
            total_images: images.rows[0].count,
            total_posts: posts.rows[0].count,
        });
    } catch (err) {
        console.error('GET /admin/stats error:', err);
        return res.status(500).json({ error: 'Khong the tai thong ke' });
    }
});

app.listen(PORT, () => {
    console.log(`Cow-Visioning server running at http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ LỖI: Port ${PORT} đang bị chiếm dụng.`);
        console.log(`👉 Cách sửa:`);
        console.log(`   1. Chạy: netstat -ano | findstr :${PORT}`);
        console.log(`   2. Tìm PID ở cột cuối cùng`);
        console.log(`   3. Chạy: taskkill /F /PID <PID_đã_tìm>`);
        process.exit(1);
    } else {
        throw err;
    }
});

