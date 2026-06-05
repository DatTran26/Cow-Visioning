'use strict';

const {
    buildImageActionKeyboard,
    buildPublicUploadUrl,
    getTelegramConfig,
    sendTelegramMessage,
    sendTelegramPhoto,
} = require('./telegram-notifier');
const {
    getLinkedAccountByTelegramUser,
    linkTelegramAccount,
    setTelegramNotificationsEnabled,
    unlinkTelegramByTelegramUser,
} = require('./telegram-user-linking');

const VALID_BEHAVIORS = ['standing', 'lying', 'eating', 'drinking', 'walking', 'abnormal'];
const VALID_QA_MODES = ['abnormal', 'failed', 'review'];
const DEFAULT_LIMIT = 3;
const FALLBACK_MAX_LIMIT = 5;

function parseBoolean(value, defaultValue = true) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseTelegramUserIds(value) {
    return new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean));
}

function getCommandConfig(env = process.env) {
    const maxLimit = Number.parseInt(env.TELEGRAM_MAX_COMMAND_RESULTS || '', 10);
    return {
        enabled: parseBoolean(env.TELEGRAM_COMMANDS_ENABLED, true),
        adminUserIds: parseTelegramUserIds(env.TELEGRAM_ADMIN_USER_IDS),
        allowedUserIds: parseTelegramUserIds(env.TELEGRAM_ALLOWED_USER_IDS),
        maxResults: Number.isInteger(maxLimit) && maxLimit > 0 ? Math.min(maxLimit, 10) : FALLBACK_MAX_LIMIT,
        botUsername: String(env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').toLowerCase(),
    };
}

function getTelegramActor(update) {
    const source = update?.message || update?.callback_query?.message || {};
    const from = update?.message?.from || update?.callback_query?.from || {};
    return {
        userId: from.id ? String(from.id) : '',
        username: from.username ? `@${from.username}` : '',
        name: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || 'Telegram user',
        chatId: source.chat?.id,
        chatType: source.chat?.type || '',
        topicId: source.message_thread_id || null,
    };
}

function isPrivateChat(actor) {
    return actor?.chatType === 'private' || (actor?.chatId && actor?.userId && String(actor.chatId) === String(actor.userId));
}

function isTelegramAdmin(actor, commandConfig = getCommandConfig()) {
    return Boolean(actor?.userId && commandConfig.adminUserIds.has(String(actor.userId)));
}

async function isLinkedWebAdmin(pool, actor) {
    if (!actor?.userId) return false;
    const account = await getLinkedAccountByTelegramUser(pool, actor.userId);
    return account?.role === 'admin';
}

function isTelegramAllowed(actor, commandConfig = getCommandConfig(), telegramConfig = getTelegramConfig()) {
    if (isTelegramAdmin(actor, commandConfig)) return true;
    if (actor?.userId && commandConfig.allowedUserIds.has(String(actor.userId))) return true;
    return Boolean(actor?.chatId && String(actor.chatId) === String(telegramConfig.chatId));
}

function parseTelegramCommand(text, botUsername = '') {
    const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0 || !parts[0].startsWith('/')) return null;

    const [rawName, mention = ''] = parts[0].slice(1).split('@');
    const command = rawName.toLowerCase();
    const expectedBot = String(botUsername || '').replace(/^@/, '').toLowerCase();
    if (mention && expectedBot && mention.toLowerCase() !== expectedBot) return null;
    return { command, args: parts.slice(1), raw: parts[0].toLowerCase() };
}

function parseLimit(value, maxResults = FALLBACK_MAX_LIMIT) {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
    return Math.min(parsed, maxResults);
}

function parseImageId(value) {
    const id = Number.parseInt(value || '', 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function formatPercent(value) {
    return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'n/a';
}

function formatDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString('vi-VN', { hour12: false }) : 'n/a';
}

function buildHelpText() {
    return [
        '[BOT] Cow Visioning commands',
        '',
        '/start - Open bot menu',
        '/help - Show commands',
        '/whoami - Show your bot identity',
        '',
        'Admin/group commands:',
        '/status - Check server status',
        '/latest [limit] - Latest cow images',
        '/listcow <behavior> [limit] - Filter by behavior',
        '/cow <cow_id> [limit] - Cow image history',
        '/qa [abnormal|failed|review] [limit] - Admin QA queue',
        '/mark <image_id> <behavior> - Admin mark behavior',
        '/note <image_id> <text> - Admin add QA note',
        '/stats [today|week|month] - Upload stats',
        '',
        'Private user commands:',
        '/me - Linked web account summary',
        '/myalerts - Private alert status',
        '/mute - Mute private alerts',
        '/unmute - Enable private alerts',
        '/myimages [limit] - Your latest images',
        '/mycow <cow_id> [limit] - Your cow history',
        '/myabnormal [limit] - Your abnormal images',
    ].join('\n');
}

function buildImageCaption(title, image) {
    return [
        title,
        '',
        `Image ID: #${image.id}`,
        `Cow ID: ${image.cow_id || 'n/a'}`,
        `Area: ${image.barn_area || 'n/a'}`,
        `Behavior: ${image.behavior || 'n/a'}`,
        `Confidence: ${formatPercent(image.ai_confidence)}`,
        `AI: ${image.ai_provider || 'manual'} / ${image.ai_status || 'n/a'}`,
        `Uploaded by: ${image.username || 'unknown'}`,
        `Time: ${formatDate(image.captured_at || image.created_at)}`,
    ].join('\n');
}

function imageSelectSql(whereClause = '') {
    return `SELECT ci.id, ci.cow_id, ci.behavior, ci.barn_area, ci.image_url, ci.original_image_url,
                   ci.annotated_image_url, ci.ai_confidence, ci.ai_provider, ci.ai_status,
                   ci.captured_at, ci.created_at, ci.notes, u.username
            FROM cow_images ci
            LEFT JOIN users u ON u.id = ci.user_id
            ${whereClause}
            ORDER BY ci.id DESC
            LIMIT $1`;
}

async function sendImageCards({ rows, chatId, topicId, title, helpers, config }) {
    if (rows.length === 0) {
        await sendTelegramMessage({ chatId, topicId, config, text: `📭 No cow images found.\nQuery: ${title}` });
        return;
    }

    await sendTelegramMessage({
        chatId,
        topicId,
        config,
        text: `${title}\nFound: ${rows.length} result${rows.length > 1 ? 's' : ''}. Sending cards...`,
    }).catch(() => {});

    for (const row of rows) {
        const image = helpers.normalizeImageRecord(row);
        const imageUrl = image.image_url || image.original_image_url;
        const publicImageUrl = buildPublicUploadUrl(imageUrl, config) || imageUrl;
        const filePath = imageUrl ? helpers.toUploadAbsolutePath(imageUrl) : null;
        const caption = publicImageUrl ? `${buildImageCaption(title, image)}\n🔗 View: ${publicImageUrl}` : buildImageCaption(title, image);
        try {
            await sendTelegramPhoto({
                chatId,
                topicId,
                filePath,
                caption,
                replyMarkup: buildImageActionKeyboard({ imageId: image.id, publicImageUrl }),
                config,
            });
        } catch (_err) {
            await sendTelegramMessage({
                chatId,
                topicId,
                text: caption,
                replyMarkup: buildImageActionKeyboard({ imageId: image.id, publicImageUrl }),
                config,
            });
        }
    }
}

async function handleTelegramCommand({ update, pool, helpers, env = process.env }) {
    const telegramConfig = getTelegramConfig(env);
    const commandConfig = getCommandConfig(env);
    const actor = getTelegramActor(update);
    const parsed = parseTelegramCommand(update?.message?.text, commandConfig.botUsername);
    if (!parsed || !commandConfig.enabled) return { ignored: true };

    const context = { pool, helpers, telegramConfig, commandConfig, actor, parsed };
    const privateCommands = new Set(['me', 'myalerts', 'mute', 'unmute', 'unlink', 'myimages', 'mycow', 'myabnormal']);
    const publicCommands = new Set(['start', 'help', 'whoami']);
    const adminCommands = new Set(['status', 'latest', 'abnormal', 'listcow', 'cow', 'qa', 'mark', 'note', 'stats']);
    const privateChat = isPrivateChat(actor);
    const adminAllowed = isTelegramAdmin(actor, commandConfig) || await isLinkedWebAdmin(pool, actor);

    if (privateChat && adminCommands.has(parsed.command) && !adminAllowed) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: '🔒 Admin only command. Link a web admin account or ask system admin to allow your Telegram ID.' });
        return { command: parsed.command, denied: true };
    }
    if (!privateChat && adminCommands.has(parsed.command) && !adminAllowed) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: '🔒 Admin only command. Link this Telegram to a web admin account first.' });
        return { command: parsed.command, denied: true };
    }
    if (!privateChat && privateCommands.has(parsed.command)) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: '🔐 Please use this command in private chat with the bot.' });
        return { command: parsed.command, denied: true };
    }
    if (!privateChat && !publicCommands.has(parsed.command) && !privateCommands.has(parsed.command) && !adminCommands.has(parsed.command) && !isTelegramAllowed(actor, commandConfig, telegramConfig)) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: '⛔ You are not allowed to use this bot.' });
        return { command: parsed.command, denied: true };
    }

    const handlers = {
        start: () => handleStart(context),
        help: () => sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: buildHelpText() }),
        status: () => helpers.sendStatus({ chatId: actor.chatId, topicId: actor.topicId }),
        latest: () => handleLatest(context),
        abnormal: () => handleListCow({ ...context, forcedBehavior: 'abnormal' }),
        listcow: () => handleListCow(context),
        cow: () => handleCow(context),
        stats: () => handleStats(context),
        whoami: () => handleWhoami(context),
        qa: () => handleQa(context),
        mark: () => handleMark(context),
        note: () => handleNote(context),
        me: () => handleMe(context),
        myalerts: () => handleMyAlerts(context),
        mute: () => handleSetAlerts(context, false),
        unmute: () => handleSetAlerts(context, true),
        unlink: () => handleUnlink(context),
        myimages: () => handleMyImages(context),
        mycow: () => handleMyCow(context),
        myabnormal: () => handleMyAbnormal(context),
    };

    const handler = handlers[parsed.command];
    if (!handler) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: `Unknown command. Try /help` });
        return { command: parsed.command, unknown: true };
    }
    await handler();
    return { command: parsed.command, success: true };
}

async function handleStart(context) {
    const linkArg = String(context.parsed.args[0] || '');
    if (isPrivateChat(context.actor) && linkArg.startsWith('link_')) {
        const token = linkArg.slice('link_'.length);
        const linked = await linkTelegramAccount(context.pool, {
            token,
            telegramUserId: context.actor.userId,
            telegramUsername: context.actor.username,
            telegramChatId: context.actor.chatId,
        });
        if (!linked.success) {
            await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: '❌ Link is invalid, expired, or already used. Please create a new link from the web app.' });
            return;
        }
        const linkedRole = linked.user?.role || 'user';
        await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: `✅ Telegram linked to Cow Visioning\nAccount: ${linked.user?.username || 'your account'}\nRole: ${linkedRole}\nYou will receive private alerts for your own cow images.` });
        await sendTelegramMessage({ topicId: context.telegramConfig.topics.userActivity, config: context.telegramConfig, text: `🔗 Telegram linked\nUser: ${linked.user?.username || linked.account.user_id}\nRole: ${linkedRole}\nTelegram ID: ${context.actor.userId}` }).catch(() => {});
        return;
    }

    await context.helpers.sendStartMenu({ chatId: context.actor.chatId, topicId: context.actor.topicId, userName: context.actor.name });
}

async function handleLatest({ pool, helpers, telegramConfig, commandConfig, actor, parsed }) {
    const limit = parseLimit(parsed.args[0], commandConfig.maxResults);
    const result = await pool.query(imageSelectSql(), [limit]);
    await sendImageCards({ rows: result.rows, chatId: actor.chatId, topicId: actor.topicId, title: '📸 Latest Cow Image', helpers, config: telegramConfig });
}

async function handleListCow(context) {
    const behavior = context.forcedBehavior || String(context.parsed.args[0] || '').toLowerCase();
    if (!VALID_BEHAVIORS.includes(behavior)) {
        await sendTelegramMessage({ chatId: context.actor.chatId, topicId: context.actor.topicId, config: context.telegramConfig, text: `Usage: /listcow <behavior> [limit]\nValid: ${VALID_BEHAVIORS.join(', ')}` });
        return;
    }
    const limitArg = context.forcedBehavior ? context.parsed.args[0] : context.parsed.args[1];
    const limit = parseLimit(limitArg, context.commandConfig.maxResults);
    const result = await context.pool.query(imageSelectSql('WHERE ci.behavior = $2'), [limit, behavior]);
    await sendImageCards({ rows: result.rows, chatId: context.actor.chatId, topicId: context.actor.topicId, title: `🐄 Cow behavior: ${behavior}`, helpers: context.helpers, config: context.telegramConfig });
}

async function handleCow({ pool, helpers, telegramConfig, commandConfig, actor, parsed }) {
    const cowId = String(parsed.args[0] || '').trim();
    if (!cowId) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: 'Usage: /cow <cow_id> [limit]' });
        return;
    }
    const limit = parseLimit(parsed.args[1], commandConfig.maxResults);
    const result = await pool.query(imageSelectSql('WHERE ci.cow_id = $2'), [limit, cowId]);
    await sendImageCards({ rows: result.rows, chatId: actor.chatId, topicId: actor.topicId, title: `🐄 Cow history: ${cowId}`, helpers, config: telegramConfig });
}

async function handleStats({ pool, telegramConfig, actor, parsed }) {
    const period = String(parsed.args[0] || 'today').toLowerCase();
    const intervals = { today: '1 day', week: '7 days', month: '30 days' };
    if (!intervals[period]) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: 'Usage: /stats [today|week|month]' });
        return;
    }
    const [summary, behaviors] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total,
                           COUNT(*) FILTER (WHERE behavior = 'abnormal')::int AS abnormal,
                           COUNT(*) FILTER (WHERE ai_status = 'completed')::int AS completed,
                           COUNT(*) FILTER (WHERE ai_status = 'failed')::int AS failed,
                           MAX(created_at) AS latest
                    FROM cow_images WHERE created_at >= NOW() - $1::interval`, [intervals[period]]),
        pool.query(`SELECT behavior, COUNT(*)::int AS count
                    FROM cow_images WHERE created_at >= NOW() - $1::interval
                    GROUP BY behavior ORDER BY count DESC`, [intervals[period]]),
    ]);
    const row = summary.rows[0];
    const behaviorText = behaviors.rows.map((item) => `- ${item.behavior || 'n/a'}: ${item.count}`).join('\n') || '- none';
    await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: `📊 Stats: ${period}\n\nImages: ${row.total}\nAbnormal: ${row.abnormal}\nAI completed: ${row.completed}\nAI failed: ${row.failed}\nLatest: ${formatDate(row.latest)}\n\nBehaviors:\n${behaviorText}` });
}

async function handleWhoami({ pool, telegramConfig, commandConfig, actor }) {
    const linkedAccount = actor.userId ? await getLinkedAccountByTelegramUser(pool, actor.userId) : null;
    const envAdmin = isTelegramAdmin(actor, commandConfig);
    const webAdmin = linkedAccount?.role === 'admin';
    const privateChat = isPrivateChat(actor);
    const text = privateChat ? [
        '[IDENTITY] Cow Visioning private chat',
        `Telegram: ${actor.username || actor.name || 'n/a'}`,
        `Linked account: ${linkedAccount?.username || 'not linked'}`,
        `Web role: ${linkedAccount?.role || 'n/a'}`,
        `Admin: ${envAdmin || webAdmin ? 'yes' : 'no'}`,
    ] : [
        '[IDENTITY] Telegram group actor',
        `Telegram user ID: ${actor.userId || 'n/a'}`,
        `Telegram username: ${actor.username || 'n/a'}`,
        `Telegram name: ${actor.name || 'n/a'}`,
        `Group chat ID: ${actor.chatId || 'n/a'}`,
        `Chat type: ${actor.chatType || 'n/a'}`,
        `Topic ID: ${actor.topicId || 'General'}`,
        `Web account: ${linkedAccount?.username || 'not linked'}`,
        `Web user ID: ${linkedAccount?.user_id || 'n/a'}`,
        `Web role: ${linkedAccount?.role || 'n/a'}`,
        `Private chat ID: ${linkedAccount?.telegram_chat_id || 'n/a'}`,
        `Env admin: ${envAdmin ? 'yes' : 'no'}`,
        `Web admin: ${webAdmin ? 'yes' : 'no'}`,
        `Admin: ${envAdmin || webAdmin ? 'yes' : 'no'}`,
    ];
    await sendTelegramMessage({
        chatId: actor.chatId,
        topicId: actor.topicId,
        config: telegramConfig,
        text: text.join('\n'),
    });
}

async function getRequiredLinkedAccount(context) {
    const account = await getLinkedAccountByTelegramUser(context.pool, context.actor.userId);
    if (!account) {
        await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: '🔗 Your Telegram is not linked yet. Open the connect link from Cow Visioning web account.' });
        return null;
    }
    return account;
}

async function handleMe(context) {
    const account = await getRequiredLinkedAccount(context);
    if (!account) return;
    await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: `👤 Cow Visioning account\nUsername: ${account.username}\nRole: ${account.role}\nAlerts: ${account.notifications_enabled ? 'enabled' : 'muted'}\nLinked: ${formatDate(account.linked_at)}` });
}

async function handleMyAlerts(context) {
    const account = await getRequiredLinkedAccount(context);
    if (!account) return;
    await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: `🔔 Private alerts are ${account.notifications_enabled ? 'enabled' : 'muted'} for ${account.username}.\nUse /mute or /unmute to change this.` });
}

async function handleMyImages(context) {
    const account = await getRequiredLinkedAccount(context);
    if (!account) return;
    const limit = parseLimit(context.parsed.args[0], context.commandConfig.maxResults);
    const result = await context.pool.query(imageSelectSql('WHERE ci.user_id = $2'), [limit, account.user_id]);
    await sendImageCards({
        rows: result.rows,
        chatId: context.actor.chatId,
        topicId: context.actor.topicId,
        title: '📸 Your latest cow images',
        helpers: context.helpers,
        config: context.telegramConfig,
    });
}

async function handleMyCow(context) {
    const account = await getRequiredLinkedAccount(context);
    if (!account) return;
    const cowId = String(context.parsed.args[0] || '').trim();
    if (!cowId) {
        await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: 'Usage: /mycow <cow_id> [limit]' });
        return;
    }
    const limit = parseLimit(context.parsed.args[1], context.commandConfig.maxResults);
    const result = await context.pool.query(imageSelectSql('WHERE ci.user_id = $2 AND ci.cow_id = $3'), [limit, account.user_id, cowId]);
    await sendImageCards({
        rows: result.rows,
        chatId: context.actor.chatId,
        topicId: context.actor.topicId,
        title: `🐄 Your cow history: ${cowId}`,
        helpers: context.helpers,
        config: context.telegramConfig,
    });
}

async function handleMyAbnormal(context) {
    const account = await getRequiredLinkedAccount(context);
    if (!account) return;
    const limit = parseLimit(context.parsed.args[0], context.commandConfig.maxResults);
    const result = await context.pool.query(imageSelectSql("WHERE ci.user_id = $2 AND ci.behavior = 'abnormal'"), [limit, account.user_id]);
    await sendImageCards({
        rows: result.rows,
        chatId: context.actor.chatId,
        topicId: context.actor.topicId,
        title: '⚠️ Your abnormal cow images',
        helpers: context.helpers,
        config: context.telegramConfig,
    });
}

async function handleSetAlerts(context, enabled) {
    const result = await setTelegramNotificationsEnabled(context.pool, context.actor.userId, enabled);
    if (!result) {
        await getRequiredLinkedAccount(context);
        return;
    }
    await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: enabled ? '🔔 Private alerts enabled.' : '🔕 Private alerts muted.' });
}

async function handleUnlink(context) {
    const result = await unlinkTelegramByTelegramUser(context.pool, context.actor.userId);
    if (!result) {
        await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: 'Telegram is not linked.' });
        return;
    }
    await sendTelegramMessage({ chatId: context.actor.chatId, config: context.telegramConfig, text: '✅ Telegram unlinked from Cow Visioning.' });
}

async function handleQa(context) {
    const mode = String(context.parsed.args[0] || 'abnormal').toLowerCase();
    if (!VALID_QA_MODES.includes(mode)) {
        await sendTelegramMessage({ chatId: context.actor.chatId, topicId: context.actor.topicId, config: context.telegramConfig, text: `Usage: /qa [${VALID_QA_MODES.join('|')}] [limit]` });
        return;
    }
    const limit = parseLimit(context.parsed.args[1], context.commandConfig.maxResults);
    const where = mode === 'failed' ? "WHERE ci.ai_status = 'failed'" : mode === 'review' ? "WHERE ci.notes ILIKE '%Needs review%'" : "WHERE ci.behavior = 'abnormal'";
    const result = await context.pool.query(imageSelectSql(where), [limit]);
    await sendImageCards({ rows: result.rows, chatId: context.actor.chatId, topicId: context.actor.topicId, title: `🚨 QA Queue: ${mode}`, helpers: context.helpers, config: context.telegramConfig });
}

async function handleMark({ pool, telegramConfig, actor, parsed }) {
    const imageId = parseImageId(parsed.args[0]);
    const behavior = String(parsed.args[1] || '').toLowerCase();
    if (!imageId || !VALID_BEHAVIORS.includes(behavior)) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: `Usage: /mark <image_id> <behavior>\nValid: ${VALID_BEHAVIORS.join(', ')}` });
        return;
    }
    await pool.query(`UPDATE cow_images SET behavior = $2, notes = CONCAT(COALESCE(notes, ''), $3) WHERE id = $1`, [imageId, behavior, `\n[Telegram QA] Marked ${behavior} by ${actor.name} at ${new Date().toISOString()}`]);
    await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: `✅ Marked image #${imageId} as ${behavior}` });
}

async function handleNote({ pool, telegramConfig, actor, parsed }) {
    const imageId = parseImageId(parsed.args[0]);
    const note = parsed.args.slice(1).join(' ').trim().slice(0, 500);
    if (!imageId || !note) {
        await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: 'Usage: /note <image_id> <text>' });
        return;
    }
    await pool.query(`UPDATE cow_images SET notes = CONCAT(COALESCE(notes, ''), $2) WHERE id = $1`, [imageId, `\n[Telegram QA] Note by ${actor.name} at ${new Date().toISOString()}: ${note}`]);
    await sendTelegramMessage({ chatId: actor.chatId, topicId: actor.topicId, config: telegramConfig, text: `📝 Added note to image #${imageId}` });
}

module.exports = {
    VALID_BEHAVIORS,
    getCommandConfig,
    getTelegramActor,
    handleTelegramCommand,
    isPrivateChat,
    isLinkedWebAdmin,
    isTelegramAdmin,
    isTelegramAllowed,
    parseLimit,
    parseTelegramCommand,
    parseTelegramUserIds,
};
