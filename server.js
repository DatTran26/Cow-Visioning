const dotenv = require('dotenv');
// In production this app is often started by PM2/systemd with inherited env vars.
// Force `.env` to win so blank/stale process-level values do not mask local config.
dotenv.config({ override: true });

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
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const isLocalDev = process.platform === 'win32';
const dbHost = process.env.DB_HOST || 'localhost';
const isRemoteDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';
const isSecureCookie = process.env.NODE_ENV === 'production';
const PUBLIC_API_BASE_URL = (process.env.PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '');

function parseBooleanEnv(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseCsvEnv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

function normalizeProcessingMode(value, fallback = 'manual') {
    const normalized = String(value || '').trim().toLowerCase();
    if (['yolo', 'tool_pro', 'manual'].includes(normalized)) {
        return normalized;
    }
    return fallback;
}

function normalizeOpenAiReasoningEffort(value, fallback = 'low') {
    const normalized = String(value || '').trim().toLowerCase();
    if (['minimal', 'low', 'medium', 'high'].includes(normalized)) {
        return normalized;
    }
    return fallback;
}

const configuredCorsOrigins = parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS);
const allowAnyCorsOrigin = configuredCorsOrigins.length === 0;
const crossOriginSessionMode = configuredCorsOrigins.length > 0;
const sessionCookieSameSite = String(
    process.env.SESSION_COOKIE_SAMESITE || (crossOriginSessionMode ? 'none' : 'lax')
).trim().toLowerCase();
const sessionCookieSecure = parseBooleanEnv(
    process.env.SESSION_COOKIE_SECURE,
    sessionCookieSameSite === 'none' ? true : isSecureCookie
);

// Keep image URLs relative by default so uploads, gallery, export, and delete flows
// use the same host that served the current app. Override explicitly only if needed.
const IMAGE_BASE_URL = (process.env.IMAGE_BASE_URL || '').replace(/\/+$/, '');

app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }

        if (allowAnyCorsOrigin || configuredCorsOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
}));

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
const AI_DEFAULT_URL = (isLocalDev && isRemoteDb) ? `http://${dbHost}:8001` : 'http://127.0.0.1:8001';
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || AI_DEFAULT_URL).replace(/\/+$/, '');
const AI_LOCAL_FALLBACK_URL = 'http://127.0.0.1:8001';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '20000', 10);
const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = (process.env.OPENAI_MODEL || 'gpt-5.1').trim();
const OPENAI_CHAT_MODEL = (process.env.OPENAI_CHAT_MODEL || 'gpt-5-chat-latest').trim();
const OPENAI_CHAT_REASONING_EFFORT = normalizeOpenAiReasoningEffort(
    process.env.OPENAI_CHAT_REASONING_EFFORT,
    'low'
);
const OPENAI_TIMEOUT_MS = parseInt(process.env.OPENAI_TIMEOUT_MS || '30000', 10);
const OPENAI_UPLOAD_ENABLED = parseBooleanEnv(process.env.OPENAI_UPLOAD_ENABLED, true);
const OPENAI_UPLOAD_REASONING_EFFORT = normalizeOpenAiReasoningEffort(
    process.env.OPENAI_UPLOAD_REASONING_EFFORT,
    'low'
);
const OPENAI_UPLOAD_MAX_OUTPUT_TOKENS = Math.max(
    200,
    Math.min(parseInt(process.env.OPENAI_UPLOAD_MAX_OUTPUT_TOKENS || '400', 10), 4000)
);
const OPENAI_CHAT_HISTORY_LIMIT = Math.max(
    1,
    Math.min(parseInt(process.env.OPENAI_CHAT_HISTORY_LIMIT || '8', 10), 20)
);
const OPENAI_CHAT_MAX_OUTPUT_TOKENS = Math.max(
    200,
    Math.min(parseInt(process.env.OPENAI_CHAT_MAX_OUTPUT_TOKENS || '700', 10), 4000)
);
const DEFAULT_OPENAI_CHAT_SYSTEM_PROMPT = [
    'Bạn là Cow Visioning Assistant, trợ lý AI cho nền tảng Cow Visioning.',
    'Ưu tiên trả lời bằng tiếng Việt nếu người dùng dùng tiếng Việt; nếu không thì trả lời theo ngôn ngữ của người dùng.',
    'Tập trung chủ yếu vào nông nghiệp, chăn nuôi bò, quản lý trang trại, dinh dưỡng, giống, môi trường chuồng trại, phúc lợi vật nuôi, năng suất, và vận hành thực tế.',
    'Chỉ hỗ trợ cách dùng hệ thống Cow Visioning khi người dùng hỏi trực tiếp về tính năng, thao tác, tab, màn hình, dữ liệu, upload, camera, hoặc export.',
    'Thông tin sản phẩm chỉ dùng khi thật sự liên quan: tab Upload Images hỗ trợ JPG/PNG/WebP tối đa 10MB; tab Camera có Burst Mode khoảng 1 ảnh mỗi 500ms; tab Export Data có thể xuất CSV hoặc JSON.',
    'Nếu câu hỏi là chuyên môn chăn nuôi/nông nghiệp, hãy trả lời trực tiếp đúng trọng tâm và không tự thêm mục gợi ý, giới thiệu, hay upsell về Cow Visioning ở cuối câu trả lời.',
    'Nếu câu hỏi nằm ngoài nông nghiệp và cũng không liên quan tới hệ thống, hãy trả lời ngắn gọn rằng bạn tập trung vào nông nghiệp/chăn nuôi bò và hướng dẫn sử dụng Cow Visioning.',
    'Không bịa số liệu, thuốc, phác đồ, hoặc chẩn đoán chắc chắn.',
    'Nếu câu hỏi liên quan bệnh lý nghiêm trọng, dịch bệnh, ngộ độc, hoặc cấp cứu thú y, hãy nói rõ cần liên hệ bác sĩ thú y/khuyến nông địa phương để xác nhận.',
    'Phong cách trả lời: ngắn gọn, thực tế, có cấu trúc rõ ràng, ưu tiên checklist hoặc bước hành động khi phù hợp.',
].join(' ');
const OPENAI_CHAT_SYSTEM_PROMPT = (
    process.env.OPENAI_CHAT_SYSTEM_PROMPT || DEFAULT_OPENAI_CHAT_SYSTEM_PROMPT
).trim();
const OPENAI_BLOG_DRAFT_MODEL = (process.env.OPENAI_BLOG_DRAFT_MODEL || OPENAI_CHAT_MODEL || 'gpt-5').trim();
const OPENAI_BLOG_DRAFT_REASONING_EFFORT = normalizeOpenAiReasoningEffort(
    process.env.OPENAI_BLOG_DRAFT_REASONING_EFFORT,
    'low'
);
const OPENAI_BLOG_DRAFT_MAX_OUTPUT_TOKENS = Math.max(
    500,
    Math.min(parseInt(process.env.OPENAI_BLOG_DRAFT_MAX_OUTPUT_TOKENS || '2200', 10), 5000)
);
const OPENAI_BLOG_IMAGE_MODEL = (process.env.OPENAI_BLOG_IMAGE_MODEL || 'gpt-image-1').trim();
const OPENAI_BLOG_IMAGE_SIZE = normalizeText(process.env.OPENAI_BLOG_IMAGE_SIZE || '1024x1024', 20) || '1024x1024';
const OPENAI_BLOG_MAX_DRAFTS = Math.max(1, Math.min(parseInt(process.env.OPENAI_BLOG_MAX_DRAFTS || '4', 10), 6));
const DEFAULT_OPENAI_BLOG_SYSTEM_PROMPT = [
    'You are an agriculture content strategist for Cow Visioning.',
    'Write practical blog drafts about cattle farming, livestock operations, AI monitoring, herd health, barn workflow, welfare, nutrition, heat stress, reproduction, and farm productivity.',
    'Match the language of the user prompt.',
    'Keep each draft useful, concrete, readable, and publication-ready.',
    'Avoid hype, fake claims, and unverifiable statistics.',
    'Return only the requested JSON object and nothing else.',
].join(' ');
const OPENAI_BLOG_SYSTEM_PROMPT = (
    process.env.OPENAI_BLOG_SYSTEM_PROMPT || DEFAULT_OPENAI_BLOG_SYSTEM_PROMPT
).trim();
const ENFORCE_EXCLUSIVE_AI_MODES = true;
const DOTENV_FILE_PATH = path.resolve(__dirname, '.env');
let dotenvFallbackCache = {
    mtimeMs: null,
    values: {},
};
const aiServiceHost = (() => {
    try {
        return new URL(AI_SERVICE_URL).hostname;
    } catch (_err) {
        return '';
    }
})();
const AI_EMBED_IMAGE_PAYLOAD = process.env.AI_EMBED_IMAGE_PAYLOAD === 'true'
    || !['localhost', '127.0.0.1', '::1'].includes(String(aiServiceHost).toLowerCase());

function loadDotenvFallbackValues() {
    try {
        const stats = fs.statSync(DOTENV_FILE_PATH);
        if (dotenvFallbackCache.mtimeMs === stats.mtimeMs) {
            return dotenvFallbackCache.values;
        }

        const raw = fs.readFileSync(DOTENV_FILE_PATH, 'utf8');
        const values = dotenv.parse(raw);
        dotenvFallbackCache = {
            mtimeMs: stats.mtimeMs,
            values,
        };
        return values;
    } catch (_err) {
        dotenvFallbackCache = {
            mtimeMs: null,
            values: {},
        };
        return dotenvFallbackCache.values;
    }
}

function getRuntimeEnvValue(name, fallback = '') {
    const liveValue = String(process.env[name] || '').trim();
    if (liveValue) {
        return liveValue;
    }

    const dotenvValues = loadDotenvFallbackValues();
    const fileValue = String(dotenvValues[name] || '').trim();
    if (fileValue) {
        return fileValue;
    }

    return fallback;
}

function getOpenAiApiKey() {
    return getRuntimeEnvValue('OPENAI_API_KEY', OPENAI_API_KEY);
}

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
                cb(new Error('Chỉ chấp nhận file ảnh'));
            }
        },
    });
}

const datasetUpload = createImageUpload('original');
const blogUpload = createImageUpload('blog');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
            sameSite: sessionCookieSameSite,
            secure: sessionCookieSecure,
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
        const nextTarget = sanitizeNextTarget(req.originalUrl || req.url || '/');
        const loginUrl = nextTarget
            ? `/auth/login?next=${encodeURIComponent(nextTarget)}`
            : '/auth/login';
        return res.redirect(loginUrl);
    }
    return next();
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền admin' });
    }
    return next();
}

const AI_SETTING_KEYS = [
    'AI_ENABLED',
    'AI_TOOL_PRO_ENABLED',
    'AI_SERVICE_URL',
    'AI_TIMEOUT_MS',
    'AI_MODEL_NAME',
    'AI_MODEL_BACKEND',
    'AI_MODEL_PATH',
    'AI_BEHAVIOR_MAP_PATH',
    'AI_DEVICE',
    'AI_CONF_THRESHOLD',
    'AI_IOU_THRESHOLD',
    'AI_MAX_DET',
];

const DEFAULT_AI_SETTINGS = {
    AI_ENABLED: process.env.AI_ENABLED !== 'false',
    AI_TOOL_PRO_ENABLED: parseBooleanEnv(process.env.AI_TOOL_PRO_ENABLED, true),
    AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001',
    AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '20000', 10),
    AI_MODEL_NAME: process.env.AI_MODEL_NAME || 'cow-behavior-yolo',
    AI_MODEL_BACKEND: process.env.AI_MODEL_BACKEND || 'auto',
    AI_MODEL_PATH: process.env.AI_MODEL_PATH || './ai_service/models/boudding_catllte_v1_22es.pt',
    AI_BEHAVIOR_MAP_PATH: process.env.AI_BEHAVIOR_MAP_PATH || './ai_service/behavior_map.json',
    AI_DEVICE: process.env.AI_DEVICE || 'cpu',
    AI_CONF_THRESHOLD: parseFloat(process.env.AI_CONF_THRESHOLD || '0.25'),
    AI_IOU_THRESHOLD: parseFloat(process.env.AI_IOU_THRESHOLD || '0.45'),
    AI_MAX_DET: parseInt(process.env.AI_MAX_DET || '50', 10),
};

// Runtime AI settings (loaded from env, then optionally overridden from DB by admin)
const aiSettings = { ...DEFAULT_AI_SETTINGS };

function normalizeExclusiveAiModes(preferredMode = 'AI_ENABLED') {
    if (!ENFORCE_EXCLUSIVE_AI_MODES) {
        return false;
    }
    if (!aiSettings.AI_ENABLED || !aiSettings.AI_TOOL_PRO_ENABLED) {
        return false;
    }

    if (preferredMode === 'AI_TOOL_PRO_ENABLED') {
        aiSettings.AI_ENABLED = false;
    } else {
        aiSettings.AI_TOOL_PRO_ENABLED = false;
    }
    return true;
}

if (normalizeExclusiveAiModes('AI_ENABLED')) {
    console.warn('AI mode bootstrap: both AI_ENABLED and AI_TOOL_PRO_ENABLED were true in env. Tool Pro has been disabled to keep modes exclusive.');
}

function applyStoredAiSetting(key, rawValue) {
    if (rawValue === undefined || rawValue === null) {
        return;
    }

    switch (key) {
        case 'AI_DEVICE': {
            const nextValue = String(rawValue).trim();
            if (nextValue) {
                aiSettings.AI_DEVICE = nextValue;
            }
            break;
        }
        case 'AI_CONF_THRESHOLD': {
            const nextValue = Number(rawValue);
            if (Number.isFinite(nextValue)) {
                aiSettings.AI_CONF_THRESHOLD = Math.max(0, Math.min(1, nextValue));
            }
            break;
        }
        case 'AI_IOU_THRESHOLD': {
            const nextValue = Number(rawValue);
            if (Number.isFinite(nextValue)) {
                aiSettings.AI_IOU_THRESHOLD = Math.max(0, Math.min(1, nextValue));
            }
            break;
        }
        case 'AI_MAX_DET': {
            const nextValue = Number(rawValue);
            if (Number.isFinite(nextValue)) {
                aiSettings.AI_MAX_DET = Math.max(1, Math.min(1000, Math.floor(nextValue)));
            }
            break;
        }
        case 'AI_ENABLED': {
            const normalized = String(rawValue).trim().toLowerCase();
            aiSettings.AI_ENABLED = ['true', '1', 'yes', 'on'].includes(normalized);
            break;
        }
        case 'AI_TOOL_PRO_ENABLED': {
            const normalized = String(rawValue).trim().toLowerCase();
            aiSettings.AI_TOOL_PRO_ENABLED = ['true', '1', 'yes', 'on'].includes(normalized);
            break;
        }
        case 'AI_SERVICE_URL': {
            const nextValue = String(rawValue).trim().replace(/\/+$/, '');
            if (nextValue) aiSettings.AI_SERVICE_URL = nextValue;
            break;
        }
        case 'AI_TIMEOUT_MS': {
            const nextValue = Number(rawValue);
            if (Number.isFinite(nextValue)) aiSettings.AI_TIMEOUT_MS = Math.max(1000, Math.floor(nextValue));
            break;
        }
        case 'AI_MODEL_NAME': {
            aiSettings.AI_MODEL_NAME = String(rawValue).trim() || 'cow-behavior-yolo';
            break;
        }
        case 'AI_MODEL_BACKEND': {
            aiSettings.AI_MODEL_BACKEND = String(rawValue).trim() || 'auto';
            break;
        }
        case 'AI_MODEL_PATH': {
            aiSettings.AI_MODEL_PATH = String(rawValue).trim();
            break;
        }
        case 'AI_BEHAVIOR_MAP_PATH': {
            aiSettings.AI_BEHAVIOR_MAP_PATH = String(rawValue).trim();
            break;
        }
        default:
            break;
    }
}

async function loadAiSettingsFromDb() {
    try {
        const result = await pool.query(
            'SELECT key, value FROM app_config WHERE key = ANY($1)',
            [AI_SETTING_KEYS]
        );

        result.rows.forEach(({ key, value }) => {
            applyStoredAiSetting(key, value);
        });

        if (normalizeExclusiveAiModes('AI_ENABLED')) {
            console.warn('AI mode bootstrap: both AI modes were enabled in DB. Tool Pro has been disabled to keep modes exclusive.');
        }
    } catch (err) {
        console.warn('AI settings bootstrap skipped:', err.message);
    }
}

async function persistAiSettingsToDb() {
    const upsertSql = `
        INSERT INTO app_config (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    await Promise.all(
        AI_SETTING_KEYS.map((key) => pool.query(upsertSql, [key, String(aiSettings[key])]))
    );
}

async function ensureRuntimeSchema() {
    try {
        await pool.query('ALTER TABLE cow_images ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50)');
        await pool.query("ALTER TABLE blog_likes ADD COLUMN IF NOT EXISTS reaction_type VARCHAR(20) DEFAULT 'like'");
        await pool.query("UPDATE blog_likes SET reaction_type = 'like' WHERE reaction_type IS NULL OR reaction_type = ''");
        await pool.query("ALTER TABLE blog_likes ALTER COLUMN reaction_type SET DEFAULT 'like'");
    } catch (err) {
        console.warn('Runtime schema bootstrap skipped:', err.message);
    }
}

function normalizeText(input, maxLen) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function sanitizeNextTarget(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return null;
    }

    return trimmed;
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

const allowedReactionTypes = new Set([
    'like',
    'love',
    'care',
    'haha',
    'wow',
    'sad',
    'angry',
]);

function normalizeReactionType(input, fallback = 'like') {
    const candidate = normalizeText(String(input || fallback), 20).toLowerCase();
    return allowedReactionTypes.has(candidate) ? candidate : null;
}

loadAiSettingsFromDb();
const runtimeSchemaReady = ensureRuntimeSchema();

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

function saveAnnotatedImageFromBase64({ annotatedImageBase64, outputDir, requestId, originalFilePath, fallbackExt }) {
    if (!annotatedImageBase64) {
        return null;
    }

    ensureDir(outputDir);
    const requestIdSafe = String(requestId || '').replace(/[^a-zA-Z0-9_-]/g, '') || crypto.randomUUID();
    const extension = fallbackExt || path.extname(originalFilePath) || '.jpg';
    const annotatedPath = path.join(outputDir, `${requestIdSafe}${extension}`);

    fs.writeFileSync(annotatedPath, Buffer.from(annotatedImageBase64, 'base64'));

    const annotatedUrl = toUploadUrl(annotatedPath);
    if (!annotatedUrl) {
        throw new Error('Annotated image path is outside the uploads directory');
    }

    return annotatedUrl;
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

function mimeTypeToExtension(mimeType) {
    const normalized = String(mimeType || '').trim().toLowerCase();
    if (normalized.includes('png')) return '.png';
    if (normalized.includes('webp')) return '.webp';
    if (normalized.includes('gif')) return '.gif';
    return '.jpg';
}

async function persistGeneratedBlogImage({ imageBuffer, mimeType, requestId }) {
    const outputDir = buildDatedUploadDir('blog');
    const safeId = String(requestId || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '') || crypto.randomUUID();
    const ext = mimeTypeToExtension(mimeType);
    const filePath = path.join(outputDir, `${safeId}-ai${ext}`);
    await fs.promises.writeFile(filePath, imageBuffer);

    const uploadUrl = toUploadUrl(filePath);
    if (!uploadUrl) {
        throw new Error('Generated blog image path is outside the uploads directory');
    }

    return {
        image_url: toFullUrl(uploadUrl),
        upload_url: uploadUrl,
        file_name: path.basename(filePath),
    };
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

function getAiServiceCandidates() {
    const candidates = [aiSettings.AI_SERVICE_URL, AI_LOCAL_FALLBACK_URL]
        .map((item) => String(item || '').trim().replace(/\/+$/, ''))
        .filter(Boolean);

    return [...new Set(candidates)];
}

function extractOpenAiTextPayload(payload) {
    if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
        return payload.output_text.trim();
    }

    const outputItems = Array.isArray(payload?.output) ? payload.output : [];
    const chunks = [];
    for (const item of outputItems) {
        const contentItems = Array.isArray(item?.content) ? item.content : [];
        for (const content of contentItems) {
            if (typeof content?.text === 'string' && content.text.trim()) {
                chunks.push(content.text.trim());
            }
        }
    }

    return chunks.join('\n').trim();
}

function extractOpenAiRefusalPayload(payload) {
    const outputItems = Array.isArray(payload?.output) ? payload.output : [];
    const chunks = [];
    for (const item of outputItems) {
        const contentItems = Array.isArray(item?.content) ? item.content : [];
        for (const content of contentItems) {
            if (typeof content?.refusal === 'string' && content.refusal.trim()) {
                chunks.push(content.refusal.trim());
            }
        }
    }

    return chunks.join('\n').trim();
}

function supportsReasoningControls(model) {
    const normalized = String(model || '').trim().toLowerCase();
    return (
        normalized.startsWith('gpt-5') ||
        normalized.startsWith('o1') ||
        normalized.startsWith('o3') ||
        normalized.startsWith('o4')
    );
}

function createOpenAiAssistantChatError(payload) {
    const status = normalizeText(payload?.status, 50).toLowerCase();
    const incompleteReason = normalizeText(payload?.incomplete_details?.reason, 100).toLowerCase();
    const refusalText = extractOpenAiRefusalPayload(payload);

    if (refusalText) {
        return new Error(refusalText);
    }

    if (status === 'incomplete' && incompleteReason === 'max_output_tokens') {
        return new Error(
            'OpenAI stopped before producing visible text because max_output_tokens was exhausted. Increase OPENAI_CHAT_MAX_OUTPUT_TOKENS or reduce reasoning effort.'
        );
    }

    if (status === 'incomplete' && incompleteReason) {
        return new Error(`OpenAI returned an incomplete assistant response (${incompleteReason}).`);
    }

    return new Error('OpenAI returned an empty assistant response');
}

function createOpenAiUploadPredictionError(payload) {
    const refusalText = extractOpenAiRefusalPayload(payload);
    if (refusalText) {
        return new Error(refusalText);
    }

    const status = normalizeText(payload?.status, 50).toLowerCase();
    const incompleteReason = normalizeText(payload?.incomplete_details?.reason, 100).toLowerCase();
    if (status === 'incomplete' && incompleteReason === 'max_output_tokens') {
        return new Error(
            'OpenAI stopped before producing visible JSON because max_output_tokens was exhausted during Tool Pro image analysis.'
        );
    }
    if (status === 'incomplete' && incompleteReason) {
        return new Error(`OpenAI returned an incomplete Tool Pro response (${incompleteReason}).`);
    }

    return new Error('OpenAI returned an empty response');
}

async function performOpenAiAssistantChatRequest({ message, history, requestId, maxOutputTokens, reasoningEffort, signal }) {
    const openAiApiKey = getOpenAiApiKey();
    const input = normalizeChatHistory(history).map((item) => ({
        role: item.role,
        content: item.content,
    }));

    input.push({
        role: 'user',
        content: normalizeText(message, 4000),
    });

    const body = {
        model: OPENAI_CHAT_MODEL,
        instructions: OPENAI_CHAT_SYSTEM_PROMPT,
        input,
        max_output_tokens: maxOutputTokens,
    };

    if (supportsReasoningControls(OPENAI_CHAT_MODEL)) {
        body.reasoning = { effort: reasoningEffort };
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
            'X-Client-Request-Id': requestId,
        },
        body: JSON.stringify(body),
        signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `OpenAI returned HTTP ${response.status}`;
        throw new Error(message);
    }

    return {
        payload,
        responseRequestId: response.headers.get('x-request-id') || null,
    };
}

function normalizeChatHistory(history) {
    if (!Array.isArray(history)) {
        return [];
    }

    return history
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
        .map((item) => ({
            role: item.role,
            content: normalizeText(item.content, 4000),
        }))
        .filter((item) => item.content)
        .slice(-OPENAI_CHAT_HISTORY_LIMIT);
}

async function requestOpenAiAssistantChat({ message, history = [], requestId }) {
    if (!getOpenAiApiKey()) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const normalizedMessage = normalizeText(message, 4000);
    if (!normalizedMessage) {
        throw new Error('Chat message is empty');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
        let attempt = await performOpenAiAssistantChatRequest({
            message: normalizedMessage,
            history,
            requestId,
            maxOutputTokens: OPENAI_CHAT_MAX_OUTPUT_TOKENS,
            reasoningEffort: OPENAI_CHAT_REASONING_EFFORT,
            signal: controller.signal,
        });

        let text = extractOpenAiTextPayload(attempt.payload);
        if (
            !text &&
            normalizeText(attempt.payload?.status, 50).toLowerCase() === 'incomplete' &&
            normalizeText(attempt.payload?.incomplete_details?.reason, 100).toLowerCase() === 'max_output_tokens'
        ) {
            attempt = await performOpenAiAssistantChatRequest({
                message: normalizedMessage,
                history,
                requestId,
                maxOutputTokens: Math.min(Math.max(OPENAI_CHAT_MAX_OUTPUT_TOKENS * 2, 1400), 4000),
                reasoningEffort: 'low',
                signal: controller.signal,
            });
            text = extractOpenAiTextPayload(attempt.payload);
        }

        if (!text) {
            throw createOpenAiAssistantChatError(attempt.payload);
        }

        return {
            answer: text,
            model: attempt.payload?.model || OPENAI_CHAT_MODEL,
            requestId: attempt.responseRequestId,
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`OpenAI chat request timed out after ${OPENAI_TIMEOUT_MS}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

function parseLooseJsonObject(text) {
    const raw = String(text || '').trim();
    if (!raw) {
        throw new Error('OpenAI returned an empty response');
    }

    const withoutFences = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        return JSON.parse(withoutFences);
    } catch (_err) {
        const start = withoutFences.indexOf('{');
        const end = withoutFences.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            return JSON.parse(withoutFences.slice(start, end + 1));
        }
        throw new Error('OpenAI response is not valid JSON');
    }
}

function normalizeBlogDraft(draft, index = 0) {
    const fallbackNumber = index + 1;
    const title = normalizeText(draft?.title || '', 255) || `AI Draft ${fallbackNumber}`;
    const content = normalizeText(draft?.content || '', 10000);
    const imagePrompt = normalizeText(
        draft?.image_prompt || draft?.imagePrompt || `Editorial blog cover about ${title}`,
        1000
    );

    if (!content || content.length < 40) {
        throw new Error(`AI returned an incomplete draft for item ${fallbackNumber}`);
    }

    return {
        title,
        content,
        image_prompt: imagePrompt,
        excerpt: `${content.slice(0, 180)}${content.length > 180 ? '...' : ''}`,
    };
}

async function requestOpenAiBlogDrafts({ prompt, count, includeImages, requestId }) {
    const openAiApiKey = getOpenAiApiKey();
    if (!openAiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const normalizedPrompt = normalizeText(prompt, 2000);
    if (!normalizedPrompt) {
        throw new Error('Prompt is empty');
    }

    const safeCount = Math.max(1, Math.min(Number(count) || 1, OPENAI_BLOG_MAX_DRAFTS));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
        const body = {
            model: OPENAI_BLOG_DRAFT_MODEL,
            instructions: OPENAI_BLOG_SYSTEM_PROMPT,
            input: [
                {
                    role: 'user',
                    content: [
                        'Create blog post drafts for the Cow Visioning blog.',
                        `Generate exactly ${safeCount} distinct drafts from this prompt: ${normalizedPrompt}`,
                        'Return JSON only in this shape:',
                        '{"drafts":[{"title":"...","content":"...","image_prompt":"..."}]}',
                        'Each title should be concise and publishable.',
                        'Each content should be 2 to 5 short paragraphs, practical, and ready to post.',
                        'Each image_prompt should describe a realistic blog cover image that matches the article.',
                    ].join(' '),
                },
            ],
            max_output_tokens: OPENAI_BLOG_DRAFT_MAX_OUTPUT_TOKENS,
        };

        if (supportsReasoningControls(OPENAI_BLOG_DRAFT_MODEL)) {
            body.reasoning = { effort: OPENAI_BLOG_DRAFT_REASONING_EFFORT };
        }

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${openAiApiKey}`,
                'Content-Type': 'application/json',
                'X-Client-Request-Id': requestId,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = payload?.error?.message || payload?.message || `OpenAI returned HTTP ${response.status}`;
            throw new Error(message);
        }

        const rawText = extractOpenAiTextPayload(payload);
        if (!rawText) {
            throw createOpenAiAssistantChatError(payload);
        }

        const parsed = parseLooseJsonObject(rawText);
        const drafts = Array.isArray(parsed?.drafts) ? parsed.drafts : [];
        if (!drafts.length) {
            throw new Error('AI did not return any blog drafts');
        }

        const normalizedDrafts = [];
        for (let index = 0; index < drafts.length && normalizedDrafts.length < safeCount; index += 1) {
            normalizedDrafts.push({
                id: crypto.randomUUID(),
                ...normalizeBlogDraft(drafts[index], index),
            });
        }

        if (includeImages) {
            for (let index = 0; index < normalizedDrafts.length; index += 1) {
                try {
                    const imageResult = await requestOpenAiBlogImage({
                        prompt: normalizedDrafts[index].image_prompt,
                        requestId: `${requestId}-${index + 1}`,
                    });
                    normalizedDrafts[index].image = imageResult;
                } catch (imageErr) {
                    normalizedDrafts[index].image_error = imageErr.message;
                }
            }
        }

        return normalizedDrafts;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`OpenAI blog draft request timed out after ${OPENAI_TIMEOUT_MS}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

async function requestOpenAiBlogImage({ prompt, requestId }) {
    const openAiApiKey = getOpenAiApiKey();
    if (!openAiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const normalizedPrompt = normalizeText(prompt, 1000);
    if (!normalizedPrompt) {
        throw new Error('Image prompt is empty');
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
            'X-Client-Request-Id': requestId,
        },
        body: JSON.stringify({
            model: OPENAI_BLOG_IMAGE_MODEL,
            prompt: normalizedPrompt,
            size: OPENAI_BLOG_IMAGE_SIZE,
        }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `OpenAI image generation returned HTTP ${response.status}`;
        throw new Error(message);
    }

    const imageItem = Array.isArray(payload?.data) ? payload.data[0] : null;
    if (!imageItem) {
        throw new Error('OpenAI did not return any generated image');
    }

    if (imageItem.b64_json) {
        const mimeType = imageItem.mime_type || 'image/png';
        return persistGeneratedBlogImage({
            imageBuffer: Buffer.from(imageItem.b64_json, 'base64'),
            mimeType,
            requestId,
        });
    }

    if (imageItem.url) {
        const imageResponse = await fetch(imageItem.url);
        if (!imageResponse.ok) {
            throw new Error('Unable to download generated image');
        }
        const mimeType = imageResponse.headers.get('content-type') || 'image/png';
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        return persistGeneratedBlogImage({ imageBuffer, mimeType, requestId });
    }

    throw new Error('OpenAI image generation response did not contain usable image data');
}

function normalizeOpenAiClassification(payload) {
    const behavior = normalizeText(payload?.behavior || payload?.predicted_behavior, 50).toLowerCase();
    if (!allowedBehaviors.has(behavior)) {
        throw new Error(`OpenAI returned unsupported behavior: ${payload?.behavior || payload?.predicted_behavior || 'empty'}`);
    }

    const rawConfidence = Number(payload?.confidence);
    const confidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(1, rawConfidence))
        : 0.5;

    const summary = normalizeText(payload?.summary || payload?.reasoning || payload?.explanation || '', 500) || null;

    return { behavior, confidence, summary };
}

function normalizeBehaviorValue(value) {
    const behavior = normalizeText(value, 50).toLowerCase();
    return allowedBehaviors.has(behavior) ? behavior : '';
}

async function requestOpenAiUploadPrediction({ imagePath, requestId, imageMimeType }) {
    const openAiApiKey = getOpenAiApiKey();
    if (!openAiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
    }

    const safeMimeType = normalizeText(imageMimeType || '', 100) || 'image/jpeg';
    const imageBase64 = await fs.promises.readFile(imagePath, { encoding: 'base64' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
        const sendUploadPredictionRequest = async (maxOutputTokens, reasoningEffort) => {
            const body = {
                model: OPENAI_MODEL,
                input: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'input_text',
                                text: [
                                    'Classify the main visible cow behavior in this image.',
                                    'Return JSON only with keys: behavior, confidence, summary.',
                                    `behavior must be one of: ${Array.from(allowedBehaviors).join(', ')}.`,
                                    'confidence must be a number from 0 to 1.',
                                    'summary must be a short Vietnamese sentence.',
                                    'If the image is unclear, choose the closest behavior and reduce confidence.',
                                ].join(' '),
                            },
                            {
                                type: 'input_image',
                                image_url: `data:${safeMimeType};base64,${imageBase64}`,
                            },
                        ],
                    },
                ],
                max_output_tokens: maxOutputTokens,
            };

            if (supportsReasoningControls(OPENAI_MODEL)) {
                body.reasoning = { effort: reasoningEffort };
            }

            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${openAiApiKey}`,
                    'Content-Type': 'application/json',
                    'X-Client-Request-Id': requestId,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = payload?.error?.message || payload?.message || `OpenAI returned HTTP ${response.status}`;
                throw new Error(message);
            }

            return {
                payload,
                responseRequestId: response.headers.get('x-request-id') || null,
            };
        };

        let attempt = await sendUploadPredictionRequest(
            OPENAI_UPLOAD_MAX_OUTPUT_TOKENS,
            OPENAI_UPLOAD_REASONING_EFFORT
        );
        let rawText = extractOpenAiTextPayload(attempt.payload);

        if (
            !rawText &&
            normalizeText(attempt.payload?.status, 50).toLowerCase() === 'incomplete' &&
            normalizeText(attempt.payload?.incomplete_details?.reason, 100).toLowerCase() === 'max_output_tokens'
        ) {
            attempt = await sendUploadPredictionRequest(
                Math.min(Math.max(OPENAI_UPLOAD_MAX_OUTPUT_TOKENS * 2, 800), 4000),
                'low'
            );
            rawText = extractOpenAiTextPayload(attempt.payload);
        }

        if (!rawText) {
            throw createOpenAiUploadPredictionError(attempt.payload);
        }

        const parsed = parseLooseJsonObject(rawText);
        const normalized = normalizeOpenAiClassification(parsed);

        return {
            predicted_behavior: normalized.behavior,
            confidence: normalized.confidence,
            annotated_image_url: null,
            primary_bbox: null,
            detection_count: 1,
            detections: [],
            model_name: attempt.payload?.model || OPENAI_MODEL,
            inference_ms: null,
            provider: 'tool_pro',
            summary: normalized.summary,
            openai_request_id: attempt.responseRequestId,
            openai_output_text: rawText,
            raw_payload: attempt.payload,
        };
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`OpenAI request timed out after ${OPENAI_TIMEOUT_MS}ms`);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }
}

async function requestAiPrediction({ imagePath, outputDir, requestId }) {
    if (!aiSettings.AI_ENABLED) {
        throw new Error('AI service is disabled');
    }

    const useEmbeddedTransport = AI_EMBED_IMAGE_PAYLOAD;
    const imageBase64 = useEmbeddedTransport
        ? await fs.promises.readFile(imagePath, { encoding: 'base64' })
        : null;
    const requestBody = {
        image_path: imagePath,
        output_dir: outputDir,
        request_id: requestId,
        image_base64: imageBase64,
        return_annotated_image_base64: useEmbeddedTransport,
        device: aiSettings.AI_DEVICE,
        conf_threshold: aiSettings.AI_CONF_THRESHOLD,
        iou_threshold: aiSettings.AI_IOU_THRESHOLD,
        max_det: aiSettings.AI_MAX_DET,
    };
    const attempts = [];

    for (const serviceUrl of getAiServiceCandidates()) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), aiSettings.AI_TIMEOUT_MS);

        try {
            const response = await fetch(`${serviceUrl}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
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

            let annotatedImageUrl = null;
            if (payload.annotated_image_base64) {
                annotatedImageUrl = saveAnnotatedImageFromBase64({
                    annotatedImageBase64: payload.annotated_image_base64,
                    outputDir,
                    requestId,
                    originalFilePath: imagePath,
                    fallbackExt: normalizeText(payload.annotated_image_ext || '', 10) || '.jpg',
                });
            } else if (payload.annotated_image_path) {
                annotatedImageUrl = toUploadUrl(payload.annotated_image_path);
            }

            if (!annotatedImageUrl) {
                throw new Error('AI service did not return a usable annotated image');
            }

            const {
                annotated_image_base64: _annotatedImageBase64,
                ...sanitizedPayload
            } = payload;

        return {
            ...sanitizedPayload,
            predicted_behavior: behavior,
            annotated_image_url: annotatedImageUrl,
            ai_service_url: serviceUrl,
            provider: 'yolo',
        };
        } catch (err) {
            const reason = err.name === 'AbortError'
                ? `timed out after ${AI_TIMEOUT_MS}ms`
                : (err.message || 'unknown error');
            attempts.push(`${serviceUrl}: ${reason}`);
        } finally {
            clearTimeout(timeout);
        }
    }

    throw new Error(`AI request failed. Attempts: ${attempts.join(' | ')}`);
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu xác thực. Vui lòng thử lại sau 15 phút.' },
});

const postWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
});

const commentWriteLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Bạn đang gửi bình luận quá nhanh. Vui lòng thử lại sau.' },
});

const likeLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Bạn đã thao tác like quá nhanh. Vui lòng thử lại sau.' },
});

const assistantChatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Bạn đang hỏi quá nhanh. Vui lòng thử lại sau ít phút.' },
});

app.get('/auth/status', (_req, res) => {
    res.json({ mode: 'multi-user-password' });
});

app.get('/auth/login', (req, res) => {
    if (req.session && req.session.userId) {
        const nextTarget = sanitizeNextTarget(req.query.next);
        return res.redirect(nextTarget || '/?tab=thu-thap');
    }
    return res.sendFile(path.join(__dirname, 'public', 'auth', 'login.html'));
});

app.get('/auth/register', (req, res) => {
    if (req.session && req.session.userId) {
        const nextTarget = sanitizeNextTarget(req.query.next);
        return res.redirect(nextTarget || '/?tab=thu-thap');
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
            return res.status(400).json({ error: 'Username phải từ 3 đến 30 ký tự' });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Username chỉ gồm chữ, số, dấu _' });
        }
        if (!validEmail(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({ error: 'Mật khẩu phải từ 8 đến 72 ký tự' });
        }
        if (password !== passwordConfirm) {
            return res.status(400).json({ error: 'Xác nhận mật khẩu không khớp' });
        }

        const exists = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
            [username, email]
        );
        if (exists.rows.length > 0) {
            return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
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
        return res.status(500).json({ error: 'Không thể tạo tài khoản' });
    }
});

app.post('/auth/login', authLimiter, async (req, res) => {
    try {
        const username = normalizeText(req.body.username, 30).toLowerCase();
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        if (!username || !password) {
            return res.status(400).json({ error: 'Thiếu username hoặc password' });
        }

        const result = await pool.query(
            'SELECT id, username, email, role, password_hash FROM users WHERE username = $1 LIMIT 1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });
        }

        const user = result.rows[0];
        const matched = await bcrypt.compare(password, user.password_hash);
        if (!matched) {
            return res.status(401).json({ error: 'Thông tin đăng nhập không đúng' });
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
        return res.status(500).json({ error: 'Lỗi đăng nhập' });
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
        return res.status(500).json({ error: 'Không thể tải thông tin user' });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/dashboard', '/quan-li-iot', '/ai-models', '/dataset-cow', '/tai-khoan', '/cai-dat'], requireAuthPage, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/version', (_req, res) => {
    res.json({ version: APP_VERSION });
});

app.post('/api/assistant/chat', assistantChatLimiter, async (req, res) => {
    try {
        const message = normalizeText(req.body?.message, 4000);
        const history = normalizeChatHistory(req.body?.history);

        if (!message) {
            return res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
        }

        if (!getOpenAiApiKey()) {
            return res.status(503).json({
                error: 'OPENAI_API_KEY chưa được cấu hình trên server.',
            });
        }

        const result = await requestOpenAiAssistantChat({
            message,
            history,
            requestId: crypto.randomUUID(),
        });

        return res.json({
            success: true,
            data: result,
        });
    } catch (err) {
        console.error('POST /api/assistant/chat error:', err.message);
        return res.status(500).json({
            error: 'Không thể lấy phản hồi từ trợ lý lúc này.',
        });
    }
});

app.get('/js/runtime-config.js', (_req, res) => {
    res.type('application/javascript');
    res.send(
        `window.__APP_CONFIG__ = Object.assign({}, window.__APP_CONFIG__ || {}, ${JSON.stringify({
            apiBaseUrl: PUBLIC_API_BASE_URL,
        })});`
    );
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.post('/api/images', authRequired, postWriteLimiter, datasetUpload.single('image'), async (req, res) => {
    try {
        await runtimeSchemaReady;
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file ảnh' });
        }

        const cowId = normalizeText(req.body.cow_id, 100);
        const barnArea = normalizeText(req.body.barn_area, 200);
        const notes = normalizeText(req.body.notes, 4000);
        const captureSource = normalizeText(req.body.capture_source, 20).toLowerCase() || 'upload';
        const defaultProcessingMode = captureSource === 'camera' ? 'yolo' : 'manual';
        const processingMode = normalizeProcessingMode(req.body.processing_mode, defaultProcessingMode);
        const capturedAt = req.body.captured_at ? new Date(req.body.captured_at) : new Date();

        if (!cowId) {
            return res.status(400).json({ error: 'Thiếu cow_id' });
        }
        if (!Number.isFinite(capturedAt.getTime())) {
            return res.status(400).json({ error: 'captured_at không hợp lệ' });
        }

        const originalImageUrl = toUploadUrl(req.file.path);
        if (!originalImageUrl) {
            return res.status(500).json({ error: 'Không thể lưu đường dẫn ảnh gốc' });
        }

        // Keep YOLO and Tool Pro as fully separate flows.
        let prediction = null;
        let aiStatus = processingMode === 'manual' ? 'manual' : 'disabled';
        let aiProvider = processingMode === 'manual' ? null : processingMode;
        const requestId = path.parse(req.file.filename).name || crypto.randomUUID();

        if (processingMode === 'yolo') {
            try {
                if (aiSettings.AI_ENABLED) {
                    prediction = await requestAiPrediction({
                        imagePath: req.file.path,
                        outputDir: getAnnotatedOutputDir(req.file.path),
                        requestId,
                    });
                    aiStatus = 'completed';
                    aiProvider = prediction.provider || 'yolo';
                }
            } catch (aiErr) {
                console.error('POST /api/images YOLO error:', aiErr.message);
                aiStatus = 'failed';
            }
        } else if (processingMode === 'tool_pro') {
            try {
                if (captureSource !== 'upload') {
                    aiStatus = 'unsupported';
                } else if (!aiSettings.AI_TOOL_PRO_ENABLED || !OPENAI_UPLOAD_ENABLED || !getOpenAiApiKey()) {
                    aiStatus = 'tool_pro_off';
                } else {
                    prediction = await requestOpenAiUploadPrediction({
                        imagePath: req.file.path,
                        requestId,
                        imageMimeType: req.file.mimetype,
                    });
                    aiStatus = 'completed';
                    aiProvider = prediction.provider || 'tool_pro';
                }
            } catch (aiErr) {
                console.error('POST /api/images Tool Pro error:', aiErr.message);
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
                ai_provider,
                ai_status
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
                ai_provider,
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
                aiProvider,
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
        return res.status(500).json({ error: 'Upload thất bại' });
    }
});

app.get('/api/images', authRequired, async (req, res) => {
    try {
        await runtimeSchemaReady;
        const cowId = normalizeText(req.query.cow_id || '', 100);
        const behavior = normalizeText(req.query.behavior || '', 50);
        const barnArea = normalizeText(req.query.barn_area || '', 200);
        const toolProOnly = parseBooleanEnv(req.query.tool_pro, false);
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
        if (toolProOnly) {
            conditions.push(`ai_provider = $${idx++}`);
            params.push('tool_pro');
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
                ai_provider,
                ai_status
            FROM cow_images
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC`;
        const result = await pool.query(sql, params);
        return res.json({ data: result.rows.map(normalizeImageRecord) });
    } catch (err) {
        console.error('GET /api/images error:', err.message);
        return res.status(500).json({ error: 'Không thể tải danh sách ảnh', details: err.message });
    }
});

app.put('/api/images/:id', authRequired, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const cowId = normalizeText(req.body?.cow_id, 100);
        const behavior = normalizeBehaviorValue(req.body?.behavior);
        const barnArea = normalizeText(req.body?.barn_area, 200);
        const notes = normalizeText(req.body?.notes, 4000);
        const capturedAtRaw = typeof req.body?.captured_at === 'string' ? req.body.captured_at.trim() : '';
        const capturedAt = capturedAtRaw ? new Date(capturedAtRaw) : null;

        if (!cowId || !behavior) {
            return res.status(400).json({ error: 'Cow ID và behavior là bắt buộc' });
        }
        if (capturedAtRaw && Number.isNaN(capturedAt.getTime())) {
            return res.status(400).json({ error: 'Capture time không hợp lệ' });
        }

        const result = await pool.query(
            `UPDATE cow_images
             SET cow_id = $1,
                 behavior = $2,
                 barn_area = $3,
                 captured_at = COALESCE($4, captured_at),
                 notes = $5
             WHERE id = $6
               AND (user_id = $7 OR (SELECT role FROM users WHERE id = $7) = 'admin')
             RETURNING *`,
            [cowId, behavior, barnArea || null, capturedAt, notes || null, id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy ảnh hoặc không có quyền' });
        }

        return res.json({ success: true, data: normalizeImageRecord(result.rows[0]) });
    } catch (err) {
        console.error('PUT /api/images/:id error:', err);
        return res.status(500).json({ error: 'Lỗi khi cập nhật thông tin ảnh' });
    }
});

app.put('/api/images/:id/label', authRequired, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const behavior = normalizeBehaviorValue(req.body.behavior);
        
        if (!id || !behavior) {
            return res.status(400).json({ error: 'Thiếu ID hoặc nhãn hành vi' });
        }

        const result = await pool.query(
            'UPDATE cow_images SET behavior = $1 WHERE id = $2 AND (user_id = $3 OR (SELECT role FROM users WHERE id = $3) = \'admin\') RETURNING id',
            [behavior, id, req.session.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy ảnh hoặc không có quyền' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('PUT /api/images/:id/label error:', err);
        return res.status(500).json({ error: 'Lỗi khi cập nhật nhãn' });
    }
});

app.delete('/api/images/:id', authRequired, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const record = await pool.query(
            `SELECT image_url, original_image_url, annotated_image_url, user_id
             FROM cow_images
             WHERE id = $1
             LIMIT 1`,
            [id]
        );
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy ảnh' });
        }
        if (record.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền xoá ảnh này' });
        }

        const fileUrls = [
            record.rows[0].image_url,
            record.rows[0].original_image_url,
            record.rows[0].annotated_image_url,
        ];

        for (const uploadUrl of [...new Set(fileUrls.filter(Boolean))]) {
            if (!toUploadAbsolutePath(uploadUrl)) {
                return res.status(400).json({ error: 'Đường dẫn file không hợp lệ' });
            }
            deleteUploadFile(uploadUrl, 'File delete warning');
        }

        await pool.query('DELETE FROM cow_images WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/images/:id error:', err);
        return res.status(500).json({ error: 'Xoá thất bại' });
    }
});

app.post('/api/blog/ai/drafts', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const prompt = normalizeText(req.body.prompt, 2000);
        const requestedCount = Number(req.body.count);
        const count = Math.max(1, Math.min(Number.isFinite(requestedCount) ? requestedCount : 1, OPENAI_BLOG_MAX_DRAFTS));
        const includeImages = req.body.includeImages !== false;

        if (!prompt || prompt.length < 8) {
            return res.status(400).json({ error: 'Prompt must be at least 8 characters long' });
        }

        if (!getOpenAiApiKey()) {
            return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
        }

        const requestId = `blog_ai_${crypto.randomUUID()}`;
        const drafts = await requestOpenAiBlogDrafts({
            prompt,
            count,
            includeImages,
            requestId,
        });

        return res.json({
            success: true,
            data: {
                drafts,
                requestId,
            },
        });
    } catch (err) {
        console.error('POST /api/blog/ai/drafts error:', err.message);
        return res.status(500).json({ error: err.message || 'Unable to generate AI blog drafts' });
    }
});

app.get('/api/blog/posts', authRequired, async (req, res) => {
    try {
        await runtimeSchemaReady;
        const loadAll = req.query.all === '1';
        const limit = loadAll ? 10000 : Math.max(1, Math.min(parseInt(req.query.limit || '20', 10), 100));
        const offset = loadAll ? 0 : Math.max(0, parseInt(req.query.offset || '0', 10));
        const rawRequestedUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
        if (rawRequestedUserId && !/^\d+$/.test(rawRequestedUserId)) {
            return res.status(400).json({ error: 'Invalid userId filter' });
        }
        const requestedUserId = rawRequestedUserId ? Number(rawRequestedUserId) : null;

        const totalResult = await pool.query(
            'SELECT COUNT(*)::int AS total FROM blog_posts WHERE ($1::int IS NULL OR user_id = $1)',
            [requestedUserId]
        );
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
                COALESCE(r.reaction_summary, '{}'::json) AS reaction_summary,
                COALESCE(pi.images, '[]'::json) AS images,
                CASE WHEN ul.user_id IS NULL THEN false ELSE true END AS liked_by_me,
                COALESCE(ul.reaction_type, '') AS current_reaction
             FROM blog_posts p
             INNER JOIN users u ON u.id = p.user_id
             LEFT JOIN (
                SELECT post_id, COUNT(*)::int AS like_count FROM blog_likes GROUP BY post_id
             ) l ON l.post_id = p.id
             LEFT JOIN (
                SELECT
                    post_id,
                    json_object_agg(reaction_type, reaction_count) AS reaction_summary
                FROM (
                    SELECT post_id, reaction_type, COUNT(*)::int AS reaction_count
                    FROM blog_likes
                    GROUP BY post_id, reaction_type
                ) reaction_counts
                GROUP BY post_id
             ) r ON r.post_id = p.id
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
             WHERE ($4::int IS NULL OR p.user_id = $4)
             ORDER BY p.created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.session.userId, limit, offset, requestedUserId]
        );

        return res.json({
            data: postsResult.rows.map(post => ({
                ...post,
                images: (Array.isArray(post.images) ? post.images : []).map(img => ({
                    ...img,
                    image_url: toFullUrl(img.image_url)
                }))
            })),
            meta: { total: totalResult.rows[0].total, limit: loadAll ? totalResult.rows[0].total : limit, offset },
        });
    } catch (err) {
        console.error('GET /api/blog/posts error:', err);
        return res.status(500).json({ error: 'Không thể tải bài viết' });
    }
});

app.post('/api/blog/posts', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const title = normalizeText(req.body.title, 255);
        const content = normalizeText(req.body.content, 10000);
        if (!title || !content) {
            return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
        }
        if (title.length < 3 || content.length < 10) {
            return res.status(400).json({ error: 'Nội dung bài viết quá ngắn' });
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
        return res.status(500).json({ error: 'Không thể tạo bài viết' });
    }
});

app.put('/api/blog/posts/:id', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const title = normalizeText(req.body.title, 255);
        const content = normalizeText(req.body.content, 10000);
        if (!title || !content) {
            return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
        }
        if (title.length < 3 || content.length < 10) {
            return res.status(400).json({ error: 'Nội dung bài viết quá ngắn' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_posts WHERE id = $1', [id]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền sửa bài viết này' });
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
        return res.status(500).json({ error: 'Không thể cập nhật bài viết' });
    }
});

app.delete('/api/blog/posts/:id', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_posts WHERE id = $1', [id]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền xoá bài viết này' });
        }

        await pool.query('DELETE FROM blog_posts WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/blog/posts/:id error:', err);
        return res.status(500).json({ error: 'Không thể xoá bài viết' });
    }
});

app.post('/api/blog/posts/:postId/images', authRequired, postWriteLimiter, blogUpload.single('image'), async (req, res) => {
    try {
        await runtimeSchemaReady;
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID không hợp lệ' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Không có file ảnh' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_posts WHERE id = $1 LIMIT 1', [postId]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền thêm ảnh vào bài viết này' });
        }

        const imageUrl = toUploadUrl(req.file.path);
        if (!imageUrl) {
            return res.status(500).json({ error: 'Không thể lưu đường dẫn ảnh bài viết' });
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
        return res.status(500).json({ error: 'Không thể tải ảnh lên bài viết' });
    }
});

app.delete('/api/blog/images/:id', authRequired, postWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Image ID không hợp lệ' });
        }

        const record = await pool.query(
            `SELECT i.id, i.user_id, i.image_url
             FROM blog_post_images i
             WHERE i.id = $1
             LIMIT 1`,
            [id]
        );
        if (record.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy ảnh bài viết' });
        }
        if (record.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền xoá ảnh này' });
        }

        const imageUrl = record.rows[0].image_url;
        if (!toUploadAbsolutePath(imageUrl)) {
            return res.status(400).json({ error: 'Đường dẫn file không hợp lệ' });
        }
        deleteUploadFile(imageUrl, 'Blog image delete warning');

        await pool.query('DELETE FROM blog_post_images WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/blog/images/:id error:', err);
        return res.status(500).json({ error: 'Không thể xoá ảnh bai viet' });
    }
});

app.get('/api/blog/posts/:postId/comments', authRequired, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID không hợp lệ' });
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
        return res.status(500).json({ error: 'Không thể tải comment' });
    }
});

app.post('/api/blog/posts/:postId/comments', authRequired, commentWriteLimiter, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID không hợp lệ' });
        }

        const content = normalizeText(req.body.content, 2000);
        if (!content) {
            return res.status(400).json({ error: 'Comment không được để trống' });
        }
        if (content.length < 2) {
            return res.status(400).json({ error: 'Comment quá ngắn' });
        }

        const exists = await pool.query('SELECT id FROM blog_posts WHERE id = $1', [postId]);
        if (exists.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
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
        return res.status(500).json({ error: 'Không thể thêm comment' });
    }
});

app.delete('/api/blog/comments/:id', authRequired, commentWriteLimiter, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ error: 'Comment ID không hợp lệ' });
        }

        const ownerCheck = await pool.query('SELECT user_id FROM blog_comments WHERE id = $1', [id]);
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy comment' });
        }
        if (ownerCheck.rows[0].user_id !== req.session.userId) {
            return res.status(403).json({ error: 'Bạn không có quyền xoá comment này' });
        }

        await pool.query('DELETE FROM blog_comments WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/blog/comments/:id error:', err);
        return res.status(500).json({ error: 'Không thể xoá comment' });
    }
});

app.post('/api/blog/posts/:postId/likes', authRequired, likeLimiter, async (req, res) => {
    try {
        await runtimeSchemaReady;
        const postId = parseInt(req.params.postId, 10);
        if (!Number.isInteger(postId)) {
            return res.status(400).json({ error: 'Post ID không hợp lệ' });
        }

        const requestedReaction = normalizeReactionType(
            req.body?.reaction_type || req.body?.reactionType || 'like'
        );
        if (!requestedReaction) {
            return res.status(400).json({ error: 'Reaction khÃ´ng há»£p lá»‡' });
        }

        const postExists = await pool.query('SELECT id FROM blog_posts WHERE id = $1 LIMIT 1', [postId]);
        if (postExists.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy bài viết' });
        }

        const existing = await pool.query(
            'SELECT id, reaction_type FROM blog_likes WHERE post_id = $1 AND user_id = $2 LIMIT 1',
            [postId, req.session.userId]
        );

        let liked = false;
        let currentReaction = null;
        if (existing.rows.length > 0) {
            if (existing.rows[0].reaction_type === requestedReaction) {
                await pool.query('DELETE FROM blog_likes WHERE id = $1', [existing.rows[0].id]);
                liked = false;
            } else {
                await pool.query(
                    'UPDATE blog_likes SET reaction_type = $1, created_at = NOW() WHERE id = $2',
                    [requestedReaction, existing.rows[0].id]
                );
                liked = true;
                currentReaction = requestedReaction;
            }
        } else {
            await pool.query('INSERT INTO blog_likes (post_id, user_id, reaction_type) VALUES ($1, $2, $3)', [
                postId,
                req.session.userId,
                requestedReaction,
            ]);
            liked = true;
            currentReaction = requestedReaction;
        }

        const countResult = await pool.query(
            'SELECT COUNT(*)::int AS count FROM blog_likes WHERE post_id = $1',
            [postId]
        );
        const summaryResult = await pool.query(
            `SELECT COALESCE(json_object_agg(reaction_type, reaction_count), '{}'::json) AS reaction_summary
             FROM (
                SELECT reaction_type, COUNT(*)::int AS reaction_count
                FROM blog_likes
                WHERE post_id = $1
                GROUP BY reaction_type
             ) reaction_counts`,
            [postId]
        );
        return res.json({
            success: true,
            liked,
            like_count: countResult.rows[0].count,
            reaction_type: currentReaction,
            reaction_summary: summaryResult.rows[0]?.reaction_summary || {},
        });
    } catch (err) {
        console.error('POST /api/blog/posts/:postId/likes error:', err);
        return res.status(500).json({ error: 'Không thể xử lý like' });
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
        return res.status(500).json({ error: 'Không thể tải danh sách thành viên', details: err.message });
    }
});

app.put('/admin/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

        const newRole = normalizeText(req.body.role, 20);
        if (!['admin', 'user'].includes(newRole)) {
            return res.status(400).json({ error: 'Vai trò không hợp lệ. Chỉ chấp nhận: admin, user' });
        }

        if (id === req.session.userId && newRole !== 'admin') {
            return res.status(400).json({ error: 'Không thể tự hạ quyền của chính mình' });
        }

        const updated = await pool.query(
            `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
             RETURNING id, username, email, role, updated_at`,
            [newRole, id]
        );
        if (updated.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        return res.json({ success: true, data: updated.rows[0] });
    } catch (err) {
        console.error('PUT /admin/users/:id/role error:', err);
        return res.status(500).json({ error: 'Không thể cập nhật quyền' });
    }
});

app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

        if (id === req.session.userId) {
            return res.status(400).json({ error: 'Không thể tự xoá chính mình' });
        }

        const check = await pool.query('SELECT id, username FROM users WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return res.json({ success: true, deleted: check.rows[0].username });
    } catch (err) {
        console.error('DELETE /admin/users/:id error:', err);
        return res.status(500).json({ error: 'Không thể xoá người dùng' });
    }
});

// Public read-only AI settings (for user-facing display)
app.get('/api/ai-settings', (_req, res) => {
    return res.json({
        data: {
            AI_CONF_THRESHOLD: aiSettings.AI_CONF_THRESHOLD,
            AI_IOU_THRESHOLD: aiSettings.AI_IOU_THRESHOLD,
            AI_MAX_DET: aiSettings.AI_MAX_DET,
            AI_DEVICE: aiSettings.AI_DEVICE,
            AI_ENABLED: aiSettings.AI_ENABLED,
            AI_TOOL_PRO_ENABLED: aiSettings.AI_TOOL_PRO_ENABLED,
            AI_MODEL_NAME: aiSettings.AI_MODEL_NAME,
            AI_SERVICE_URL: aiSettings.AI_SERVICE_URL, // Publicly visible for status display
        }
    });
});

app.get('/admin/ai-settings', requireAdmin, (_req, res) => {
    return res.json({ data: aiSettings });
});

app.put('/admin/ai-settings', requireAdmin, async (req, res) => {
    try {
        if (typeof req.body.AI_DEVICE === 'string') {
            const d = req.body.AI_DEVICE.trim();
            if (['cpu', '0', '1', 'cuda', 'cuda:0', 'cuda:1'].includes(d)) aiSettings.AI_DEVICE = d;
        }
        if (typeof req.body.AI_SERVICE_URL === 'string') {
            const url = req.body.AI_SERVICE_URL.trim().replace(/\/+$/, '');
            if (url) aiSettings.AI_SERVICE_URL = url;
        }
        if (typeof req.body.AI_TIMEOUT_MS === 'number') {
            aiSettings.AI_TIMEOUT_MS = Math.max(1000, Math.floor(req.body.AI_TIMEOUT_MS));
        }
        if (typeof req.body.AI_MODEL_NAME === 'string') {
            aiSettings.AI_MODEL_NAME = req.body.AI_MODEL_NAME.trim() || 'cow-behavior-yolo';
        }
        if (typeof req.body.AI_MODEL_BACKEND === 'string') {
            aiSettings.AI_MODEL_BACKEND = req.body.AI_MODEL_BACKEND.trim() || 'auto';
        }
        if (typeof req.body.AI_MODEL_PATH === 'string') {
            aiSettings.AI_MODEL_PATH = req.body.AI_MODEL_PATH.trim();
        }
        if (typeof req.body.AI_BEHAVIOR_MAP_PATH === 'string') {
            aiSettings.AI_BEHAVIOR_MAP_PATH = req.body.AI_BEHAVIOR_MAP_PATH.trim();
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
        const hasAiEnabled = typeof req.body.AI_ENABLED === 'boolean';
        const hasToolProEnabled = typeof req.body.AI_TOOL_PRO_ENABLED === 'boolean';

        if (hasAiEnabled && hasToolProEnabled && req.body.AI_ENABLED && req.body.AI_TOOL_PRO_ENABLED) {
            return res.status(400).json({ error: 'AI Enabled và Tool PRO không thể được dùng cùng lúc. Vui lòng chỉ chọn 1 trong 2.' });
        }

        if (hasAiEnabled) {
            aiSettings.AI_ENABLED = req.body.AI_ENABLED;
            if (ENFORCE_EXCLUSIVE_AI_MODES && req.body.AI_ENABLED) {
                aiSettings.AI_TOOL_PRO_ENABLED = false;
            }
        }
        if (hasToolProEnabled) {
            aiSettings.AI_TOOL_PRO_ENABLED = req.body.AI_TOOL_PRO_ENABLED;
            if (ENFORCE_EXCLUSIVE_AI_MODES && req.body.AI_TOOL_PRO_ENABLED) {
                aiSettings.AI_ENABLED = false;
            }
        }

        await persistAiSettingsToDb();
        return res.json({ success: true, data: aiSettings });
    } catch (err) {
        console.error('PUT /admin/ai-settings error:', err);
        return res.status(500).json({ error: 'Không thể cập nhật cấu hình AI' });
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
        return res.status(500).json({ error: 'Không thể tải thống kê' });
    }
});
// Export app for testing (supertest can require without starting a server)
module.exports = { app, pool, requestOpenAiUploadPrediction };

// Only start the HTTP server when running directly (not when required by tests)
if (require.main === module) {
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
}
