const fs = require('fs');
const path = require('path');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 8000;

function parseBoolean(value, defaultValue = true) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function normalizeText(value, maxLength = 3800) {
    const text = String(value || '').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizeTopicId(value) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatPercent(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
    return `${Math.round(value * 100)}%`;
}

function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (!Number.isFinite(date.getTime())) return 'n/a';
    return date.toLocaleString('vi-VN', { hour12: false });
}

function formatDurationMs(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 'n/a';
    return `${Math.round(parsed)}ms`;
}

function getAiProviderLabel(provider) {
    const normalized = String(provider || 'manual').toLowerCase();
    if (normalized === 'tool_pro') return 'Tool Pro';
    if (normalized === 'yolo') return 'AI YOLO';
    if (normalized === 'manual') return 'Manual / AI off';
    return provider || 'n/a';
}

function getAiStatusLabel(status) {
    const normalized = String(status || 'n/a').toLowerCase();
    const labels = {
        completed: 'Completed',
        success: 'Completed',
        failed: 'Failed',
        pending: 'Pending',
        skipped: 'Skipped',
        disabled: 'Disabled',
        tool_pro_off: 'Tool Pro off',
    };
    return labels[normalized] || status || 'n/a';
}

function summarizeAiRawResult(rawResult) {
    if (!rawResult) return '';
    let parsed = rawResult;
    if (typeof rawResult === 'string') {
        try {
            parsed = JSON.parse(rawResult);
        } catch (_err) {
            return normalizeText(rawResult, 180);
        }
    }
    if (!parsed || typeof parsed !== 'object') return normalizeText(String(parsed || ''), 180);

    const message = parsed.error || parsed.message || parsed.status_message || parsed.reason;
    const detections = Array.isArray(parsed.detections) ? parsed.detections.length : undefined;
    const labels = Array.isArray(parsed.labels) ? parsed.labels.slice(0, 4).join(', ') : '';
    return [
        message ? `Message: ${message}` : '',
        detections !== undefined ? `Detections: ${detections}` : '',
        labels ? `Labels: ${labels}` : '',
    ].filter(Boolean).join(' · ');
}

function getTelegramConfig(env = process.env) {
    const publicBaseUrl = String(env.TELEGRAM_PUBLIC_BASE_URL || env.PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
    return {
        enabled: parseBoolean(env.TELEGRAM_NOTIFICATIONS_ENABLED, true),
        botToken: String(env.TELEGRAM_BOT_TOKEN || '').trim(),
        chatId: String(env.TELEGRAM_CHAT_ID || '').trim(),
        publicBaseUrl,
        topics: {
            imageUploadAlerts: normalizeTopicId(env.TELEGRAM_TOPIC_IMAGE_UPLOAD_ALERTS),
            cowBehavior: normalizeTopicId(env.TELEGRAM_TOPIC_COW_BEHAVIOR),
            aiToolProLogs: normalizeTopicId(env.TELEGRAM_TOPIC_AI_TOOL_PRO_LOGS),
            userActivity: normalizeTopicId(env.TELEGRAM_TOPIC_USER_ACTIVITY),
            systemStatus: normalizeTopicId(env.TELEGRAM_TOPIC_SYSTEM_STATUS),
            abnormalDetection: normalizeTopicId(env.TELEGRAM_TOPIC_ABNORMAL_DETECTION),
        },
    };
}

function isTelegramConfigured(config = getTelegramConfig()) {
    return Boolean(config.enabled && config.botToken && config.chatId);
}

function buildPublicUploadUrl(uploadUrl, config = getTelegramConfig()) {
    const normalized = String(uploadUrl || '').trim();
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (!config.publicBaseUrl) return normalized;
    return `${config.publicBaseUrl}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function createTelegramUrl(method, config) {
    return `${TELEGRAM_API_BASE}/bot${config.botToken}/${method}`;
}

async function withTimeout(promiseFactory, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await promiseFactory(controller.signal);
    } finally {
        clearTimeout(timeout);
    }
}

async function sendTelegramMessage({ text, chatId, topicId, replyMarkup, config = getTelegramConfig(), timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (!isTelegramConfigured(config)) return { skipped: true, reason: 'not_configured' };

    const body = {
        chat_id: chatId || config.chatId,
        text: normalizeText(text),
        disable_web_page_preview: 'false',
    };
    if (topicId) body.message_thread_id = String(topicId);
    if (replyMarkup) body.reply_markup = replyMarkup;

    return withTimeout(async (signal) => {
        const response = await fetch(createTelegramUrl('sendMessage', config), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
            throw new Error(payload?.description || `Telegram sendMessage HTTP ${response.status}`);
        }
        return payload;
    }, timeoutMs);
}

async function sendTelegramPhoto({ filePath, caption, chatId, topicId, replyMarkup, config = getTelegramConfig(), timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (!isTelegramConfigured(config)) return { skipped: true, reason: 'not_configured' };
    if (!filePath || !fs.existsSync(filePath)) {
        return sendTelegramMessage({ text: caption, chatId, topicId, replyMarkup, config, timeoutMs });
    }

    const formData = new FormData();
    formData.append('chat_id', chatId || config.chatId);
    if (topicId) formData.append('message_thread_id', String(topicId));
    formData.append('caption', normalizeText(caption, 1000));
    if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));
    const buffer = await fs.promises.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const mimeType = extension === '.png' ? 'image/png' : 'image/jpeg';
    formData.append('photo', new Blob([buffer], { type: mimeType }), path.basename(filePath));

    return withTimeout(async (signal) => {
        const response = await fetch(createTelegramUrl('sendPhoto', config), {
            method: 'POST',
            body: formData,
            signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
            throw new Error(payload?.description || `Telegram sendPhoto HTTP ${response.status}`);
        }
        return payload;
    }, timeoutMs);
}

async function answerCallbackQuery({ callbackQueryId, text, config = getTelegramConfig(), timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (!isTelegramConfigured(config) || !callbackQueryId) return { skipped: true, reason: 'not_configured' };

    return withTimeout(async (signal) => {
        const response = await fetch(createTelegramUrl('answerCallbackQuery', config), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                callback_query_id: callbackQueryId,
                text: normalizeText(text, 180),
                show_alert: false,
            }),
            signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.ok === false) {
            throw new Error(payload?.description || `Telegram answerCallbackQuery HTTP ${response.status}`);
        }
        return payload;
    }, timeoutMs);
}

function buildImageActionKeyboard({ imageId, publicImageUrl }) {
    const id = String(imageId || '').replace(/[^0-9]/g, '');
    if (!id) return null;

    const firstRow = [];
    if (publicImageUrl) firstRow.push({ text: 'Open Image', url: publicImageUrl });
    firstRow.push({ text: 'Confirm OK', callback_data: `qa:confirm:${id}` });

    return {
        inline_keyboard: [
            firstRow,
            [
                { text: 'Mark Abnormal', callback_data: `qa:abnormal:${id}` },
                { text: 'Need Review', callback_data: `qa:review:${id}` },
            ],
        ],
    };
}

function buildStartMenuKeyboard(config = getTelegramConfig()) {
    const baseUrl = config.publicBaseUrl || 'https://pctsv.io.vn';
    return {
        inline_keyboard: [
            [{ text: 'Open Cow Visioning', web_app: { url: baseUrl } }],
            [
                { text: 'Gallery', url: `${baseUrl}/?tab=gallery` },
                { text: 'Collect Images', url: `${baseUrl}/?tab=thu-thap` },
            ],
            [
                { text: 'System Status', callback_data: 'menu:status' },
                { text: 'Latest Image', callback_data: 'menu:latest' },
            ],
            [
                { text: 'Upload Topic', callback_data: 'menu:uploads' },
                { text: 'Abnormal Topic', callback_data: 'menu:abnormal' },
            ],
        ],
    };
}

function buildStartMenuText({ userName = 'there', stats = {} } = {}) {
    return [
        '[BOT] COW VISIONING QA',
        '',
        `Hello: ${userName}`,
        `Website: ${stats.publicBaseUrl || 'https://pctsv.io.vn'}`,
        `Database: ${stats.database || 'Local PostgreSQL'}`,
        `Tunnel: ${stats.tunnel || 'Cloudflare Tunnel'}`,
        `Images: ${stats.totalImages ?? 'n/a'}`,
        `Users: ${stats.totalUsers ?? 'n/a'}`,
        `Status: ${stats.status || 'Online'}`,
        '',
        'Choose a quick action below:',
    ].join('\n');
}

function formatGroupUserIdentity(user = {}) {
    const webAccount = [
        user.username || user.email || 'unknown',
        user.id ? `web_id=${user.id}` : '',
        user.role ? `role=${user.role}` : '',
    ].filter(Boolean).join(' | ');
    const telegramAccount = user.telegram_user_id
        ? `${user.telegram_username || 'n/a'} | tg_id=${user.telegram_user_id}`
        : 'not linked';
    return [
        `Web account: ${webAccount}`,
        `Telegram: ${telegramAccount}`,
    ];
}

function buildUploadCaption({ image, user, publicImageUrl }) {
    return [
        '[UPLOAD] New cow image uploaded',
        '',
        ...formatGroupUserIdentity(user),
        `Image ID: #${image.id}`,
        `Cow ID: ${image.cow_id || 'n/a'}`,
        `Area: ${image.barn_area || 'n/a'}`,
        `Behavior: ${image.behavior || 'n/a'}`,
        `Confidence: ${formatPercent(image.ai_confidence)}`,
        `AI: ${image.ai_provider || 'manual'} / ${image.ai_status || 'n/a'}`,
        `Captured: ${formatDate(image.captured_at)}`,
        publicImageUrl ? `View: ${publicImageUrl}` : '',
        '',
        'Admin actions: Confirm OK | Mark Abnormal | Need Review',
    ].filter(Boolean).join('\n');
}

function buildAbnormalCaption({ image, user, publicImageUrl }) {
    return [
        '[ABNORMAL] Cow behavior needs attention',
        '',
        ...formatGroupUserIdentity(user),
        `Image ID: #${image.id}`,
        `Cow ID: ${image.cow_id || 'n/a'}`,
        `Area: ${image.barn_area || 'n/a'}`,
        `Behavior: ${image.behavior || 'abnormal'}`,
        `Confidence: ${formatPercent(image.ai_confidence)}`,
        `Captured: ${formatDate(image.captured_at || image.created_at)}`,
        publicImageUrl ? `View: ${publicImageUrl}` : '',
        '',
        'Recommended: open image, confirm if true abnormal, or mark Need Review.',
    ].filter(Boolean).join('\n');
}

function buildAiProcessingCaption({ image, user, publicImageUrl }) {
    const providerLabel = getAiProviderLabel(image.ai_provider);
    const statusLabel = getAiStatusLabel(image.ai_status);
    const rawSummary = summarizeAiRawResult(image.ai_raw_result);

    return [
        `[AI] ${providerLabel} status: ${statusLabel}`,
        '',
        ...formatGroupUserIdentity(user),
        `Image ID: #${image.id}`,
        `Cow ID: ${image.cow_id || 'n/a'}`,
        `Area: ${image.barn_area || 'n/a'}`,
        `Behavior: ${image.behavior || 'n/a'}`,
        `Confidence: ${formatPercent(image.ai_confidence)}`,
        `Provider: ${image.ai_provider || 'manual'}`,
        `Status: ${image.ai_status || 'n/a'}`,
        `Model: ${image.ai_model_name || 'n/a'}`,
        `Inference: ${formatDurationMs(image.ai_inference_ms)}`,
        `Source: ${image.capture_source || image.source || 'upload'}`,
        rawSummary ? `Detail: ${rawSummary}` : '',
        publicImageUrl ? `View: ${publicImageUrl}` : '',
    ].filter(Boolean).join('\n');
}

function buildToolProCaption({ image, user, publicImageUrl }) {
    return buildAiProcessingCaption({ image, user, publicImageUrl });
}

function shouldSendAiProcessingLog(image) {
    const provider = String(image.ai_provider || '').toLowerCase();
    const status = String(image.ai_status || '').toLowerCase();
    return Boolean(provider && provider !== 'manual') || ['failed', 'completed', 'disabled', 'tool_pro_off', 'skipped'].includes(status);
}

function buildPrivateUploadCaption({ image, publicImageUrl }) {
    return [
        'Your cow image was saved',
        '',
        `Image ID: #${image.id}`,
        `Cow ID: ${image.cow_id || 'n/a'}`,
        `Area: ${image.barn_area || 'n/a'}`,
        `Behavior: ${image.behavior || 'n/a'}`,
        `Confidence: ${formatPercent(image.ai_confidence)}`,
        `AI: ${image.ai_provider || 'manual'} / ${image.ai_status || 'n/a'}`,
        publicImageUrl ? `View: ${publicImageUrl}` : '',
    ].filter(Boolean).join('\n');
}

function notifyPrivateImageUpload({ image, account, filePath, logger = console }) {
    const config = getTelegramConfig();
    if (!isTelegramConfigured(config) || !account?.telegram_chat_id || !account.notifications_enabled) return;

    const publicImageUrl = buildPublicUploadUrl(image.image_url || image.original_image_url, config);
    const caption = buildPrivateUploadCaption({ image, publicImageUrl });
    const replyMarkup = publicImageUrl ? { inline_keyboard: [[{ text: 'View Image', url: publicImageUrl }]] } : undefined;

    sendTelegramPhoto({
        chatId: account.telegram_chat_id,
        filePath,
        caption,
        replyMarkup,
        config,
    }).catch((err) => logger.warn('Telegram private upload notification failed:', err.message));

    if (String(image.behavior || '').toLowerCase() === 'abnormal') {
        sendTelegramMessage({
            chatId: account.telegram_chat_id,
            text: `⚠️ Abnormal behavior detected in your image #${image.id}. Please review it when possible.`,
            config,
        }).catch((err) => logger.warn('Telegram private abnormal notification failed:', err.message));
    }
}

function notifyImageUpload({ image, user, filePath, logger = console }) {
    const config = getTelegramConfig();
    if (!isTelegramConfigured(config)) return;

    const publicImageUrl = buildPublicUploadUrl(image.image_url || image.original_image_url, config);
    const uploadCaption = buildUploadCaption({ image, user, publicImageUrl });
    const replyMarkup = buildImageActionKeyboard({ imageId: image.id, publicImageUrl });
    const jobs = [
        sendTelegramPhoto({ filePath, caption: uploadCaption, topicId: config.topics.imageUploadAlerts, replyMarkup, config }),
    ];

    if (String(image.behavior || '').toLowerCase() === 'abnormal') {
        jobs.push(sendTelegramMessage({
            text: buildAbnormalCaption({ image, user, publicImageUrl }),
            topicId: config.topics.abnormalDetection,
            config,
        }));
    }

    if (shouldSendAiProcessingLog(image)) {
        const aiCaption = buildAiProcessingCaption({ image, user, publicImageUrl });
        const aiReplyMarkup = publicImageUrl ? { inline_keyboard: [[{ text: 'View Image', url: publicImageUrl }]] } : undefined;
        jobs.push(sendTelegramPhoto({
            filePath,
            caption: aiCaption,
            topicId: config.topics.aiToolProLogs,
            replyMarkup: aiReplyMarkup,
            config,
        }));
    }

    Promise.allSettled(jobs).then((results) => {
        const rejected = results.filter((result) => result.status === 'rejected');
        if (rejected.length > 0) {
            logger.warn(`Telegram notification failed (${rejected.length}/${results.length}):`, rejected[0].reason?.message || rejected[0].reason);
        }
    });
}

module.exports = {
    getTelegramConfig,
    isTelegramConfigured,
    buildPublicUploadUrl,
    buildUploadCaption,
    buildAbnormalCaption,
    buildAiProcessingCaption,
    buildToolProCaption,
    buildPrivateUploadCaption,
    sendTelegramMessage,
    sendTelegramPhoto,
    answerCallbackQuery,
    buildImageActionKeyboard,
    buildStartMenuKeyboard,
    buildStartMenuText,
    notifyImageUpload,
    notifyPrivateImageUpload,
};
