require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// --- App version (git commit hash, set at startup) ---
let APP_VERSION = Date.now().toString();
try {
    APP_VERSION = execSync('git rev-parse --short HEAD').toString().trim();
} catch (e) {}

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

// --- Session middleware (BEFORE static files) ---
app.use(express.json());

app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'cow-visioning-default-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // set to true if using HTTPS only
    },
}));

// --- Auth Routes (BEFORE auth middleware) ---

// Check if TOTP is configured
app.get('/auth/status', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT value FROM app_config WHERE key = 'totp_configured'"
        );
        res.json({
            configured: result.rows.length > 0 && result.rows[0].value === 'true',
        });
    } catch (err) {
        res.json({ configured: false });
    }
});

// Login page
app.get('/auth/login', async (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    try {
        const result = await pool.query(
            "SELECT value FROM app_config WHERE key = 'totp_configured'"
        );
        if (result.rows.length === 0 || result.rows[0].value !== 'true') {
            return res.redirect('/auth/setup');
        }
    } catch (err) {
        // If table doesn't exist yet, go to setup
        return res.redirect('/auth/setup');
    }
    res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

// Setup page - first time TOTP configuration
app.get('/auth/setup', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT value FROM app_config WHERE key = 'totp_configured'"
        );
        if (result.rows.length > 0 && result.rows[0].value === 'true') {
            return res.redirect('/auth/login');
        }
    } catch (err) {
        // Table might not exist yet, continue to setup
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
        name: process.env.TOTP_APP_NAME || 'Cow-Visioning',
        issuer: 'Cow-Visioning',
    });

    // Store temp secret in session
    req.session.tempSecret = secret.base32;

    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Render setup page inline
    res.send(`<!doctype html>
<html lang="vi">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cow Visioning - Thiet lap xac thuc</title>
    <link rel="stylesheet" href="/css/auth.css" />
</head>
<body>
    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-logo">
                <span class="auth-logo-icon">🐄</span>
                <h1>Thiet lap xac thuc</h1>
            </div>
            <p class="auth-subtitle">Cai dat Google Authenticator de bao ve ung dung</p>

            <div class="setup-steps">
                <div class="setup-step">
                    <span class="step-num">1</span>
                    <span class="step-text">Tai app <strong>Google Authenticator</strong> tren dien thoai (iOS / Android)</span>
                </div>
                <div class="setup-step">
                    <span class="step-num">2</span>
                    <span class="step-text">Mo app va quet ma QR ben duoi</span>
                </div>
            </div>

            <div class="qr-wrapper">
                <img src="${qrDataUrl}" alt="QR Code" width="200" height="200" />
            </div>

            <p class="secret-label">Hoac nhap thu cong ma nay:</p>
            <div class="secret-text">${secret.base32}</div>

            <div class="setup-steps">
                <div class="setup-step">
                    <span class="step-num">3</span>
                    <span class="step-text">Nhap ma 6 so hien tren app de xac nhan</span>
                </div>
            </div>

            <form id="setup-form" class="auth-form">
                <div class="code-input-wrapper">
                    <input
                        type="text"
                        id="setup-code"
                        inputmode="numeric"
                        pattern="[0-9]{6}"
                        maxlength="6"
                        autocomplete="one-time-code"
                        placeholder="000000"
                        required
                    />
                </div>
                <div id="setup-error" class="auth-error" hidden></div>
                <button type="submit" class="auth-btn" id="setup-submit">
                    Xac nhan va Kich hoat
                </button>
            </form>
        </div>
    </div>

    <script src="/js/auth.js"></script>
</body>
</html>`);
});

// Verify setup code (first time)
app.post('/auth/setup/verify', async (req, res) => {
    const { code } = req.body;
    const tempSecret = req.session.tempSecret;

    if (!tempSecret) {
        return res.status(400).json({ error: 'Chua bat dau qua trinh thiet lap' });
    }

    const verified = speakeasy.totp.verify({
        secret: tempSecret,
        encoding: 'base32',
        token: code,
        window: 1,
    });

    if (!verified) {
        return res.status(400).json({ error: 'Ma khong hop le. Vui long thu lai.' });
    }

    try {
        // Save the secret permanently
        await pool.query(
            "INSERT INTO app_config (key, value) VALUES ('totp_secret', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
            [tempSecret]
        );
        await pool.query(
            "INSERT INTO app_config (key, value) VALUES ('totp_configured', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()"
        );

        delete req.session.tempSecret;
        req.session.authenticated = true;

        res.json({ success: true });
    } catch (err) {
        console.error('Setup verify error:', err);
        res.status(500).json({ error: 'Loi luu cau hinh' });
    }
});

// Verify login code
app.post('/auth/verify', async (req, res) => {
    const { code } = req.body;

    try {
        const result = await pool.query(
            "SELECT value FROM app_config WHERE key = 'totp_secret'"
        );
        if (result.rows.length === 0) {
            return res.status(500).json({ error: 'TOTP chua duoc thiet lap' });
        }

        const verified = speakeasy.totp.verify({
            secret: result.rows[0].value,
            encoding: 'base32',
            token: code,
            window: 1,
        });

        if (!verified) {
            return res.status(401).json({ error: 'Ma khong hop le' });
        }

        req.session.authenticated = true;
        res.json({ success: true });
    } catch (err) {
        console.error('Auth verify error:', err);
        res.status(500).json({ error: 'Loi xac thuc' });
    }
});

// Logout
app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// --- Version check endpoint (public, no auth needed) ---
app.get('/api/version', (req, res) => {
    res.json({ version: APP_VERSION });
});

// --- Auth Middleware (BEFORE static files & API) ---
app.use((req, res, next) => {
    // Allow auth-related paths
    if (req.path.startsWith('/auth/') || req.path === '/css/auth.css' || req.path === '/js/auth.js' || req.path === '/api/version') {
        return next();
    }

    // Check session
    if (req.session && req.session.authenticated) {
        return next();
    }

    // API requests get 401 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // All other requests redirect to login
    res.redirect('/auth/login');
});

// --- Static files (now protected by auth) ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

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
