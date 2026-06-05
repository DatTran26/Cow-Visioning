'use strict';

const crypto = require('crypto');

const LINK_TOKEN_BYTES = 24;
const DEFAULT_LINK_TTL_MINUTES = 20;

function getTelegramBotUsername(env = process.env) {
    return String(env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
}

function hashTelegramLinkToken(token) {
    return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function normalizeTelegramUsername(username) {
    return String(username || '').replace(/^@/, '').trim() || null;
}

function buildTelegramDeepLink(token, env = process.env) {
    const botUsername = getTelegramBotUsername(env);
    if (!botUsername) return null;
    return `https://t.me/${botUsername}?start=link_${token}`;
}

async function getTelegramLinkStatus(pool, userId) {
    const result = await pool.query(
        `SELECT telegram_user_id, telegram_username, telegram_chat_id, linked_at, notifications_enabled
         FROM user_telegram_accounts
         WHERE user_id = $1 AND unlinked_at IS NULL
         ORDER BY linked_at DESC
         LIMIT 1`,
        [userId]
    );
    const account = result.rows[0] || null;
    return {
        linked: Boolean(account),
        account,
    };
}

async function createTelegramLinkToken(pool, userId, env = process.env) {
    const token = crypto.randomBytes(LINK_TOKEN_BYTES).toString('base64url');
    const tokenHash = hashTelegramLinkToken(token);
    const ttlMinutes = Number.parseInt(env.TELEGRAM_LINK_TOKEN_TTL_MINUTES || '', 10) || DEFAULT_LINK_TTL_MINUTES;

    await pool.query(
        `INSERT INTO telegram_link_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, NOW() + ($3::int * INTERVAL '1 minute'))`,
        [tokenHash, userId, ttlMinutes]
    );

    return {
        token,
        deepLink: buildTelegramDeepLink(token, env),
        expiresInMinutes: ttlMinutes,
    };
}

async function linkTelegramAccount(pool, { token, telegramUserId, telegramUsername, telegramChatId }) {
    const tokenHash = hashTelegramLinkToken(token);
    const tokenResult = await pool.query(
        `UPDATE telegram_link_tokens
         SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
        return { success: false, reason: 'invalid_or_expired' };
    }

    const userId = tokenResult.rows[0].user_id;
    const username = normalizeTelegramUsername(telegramUsername);

    await pool.query('UPDATE user_telegram_accounts SET unlinked_at = NOW(), updated_at = NOW() WHERE user_id = $1 AND unlinked_at IS NULL', [userId]);
    await pool.query('UPDATE user_telegram_accounts SET unlinked_at = NOW(), updated_at = NOW() WHERE telegram_user_id = $1 AND unlinked_at IS NULL', [telegramUserId]);

    const linked = await pool.query(
        `INSERT INTO user_telegram_accounts (user_id, telegram_user_id, telegram_username, telegram_chat_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, telegram_user_id, telegram_username, telegram_chat_id, linked_at, notifications_enabled`,
        [userId, telegramUserId, username, telegramChatId]
    );
    const user = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1 LIMIT 1', [userId]);

    return { success: true, account: linked.rows[0], user: user.rows[0] || null };
}

async function unlinkTelegramForUser(pool, userId) {
    await pool.query(
        `UPDATE user_telegram_accounts
         SET unlinked_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND unlinked_at IS NULL`,
        [userId]
    );
}

async function unlinkTelegramByTelegramUser(pool, telegramUserId) {
    const result = await pool.query(
        `UPDATE user_telegram_accounts
         SET unlinked_at = NOW(), updated_at = NOW()
         WHERE telegram_user_id = $1 AND unlinked_at IS NULL
         RETURNING user_id`,
        [telegramUserId]
    );
    return result.rows[0] || null;
}

async function setTelegramNotificationsEnabled(pool, telegramUserId, enabled) {
    const result = await pool.query(
        `UPDATE user_telegram_accounts
         SET notifications_enabled = $2, updated_at = NOW()
         WHERE telegram_user_id = $1 AND unlinked_at IS NULL
         RETURNING user_id, notifications_enabled`,
        [telegramUserId, Boolean(enabled)]
    );
    return result.rows[0] || null;
}

async function getLinkedAccountByTelegramUser(pool, telegramUserId) {
    const result = await pool.query(
        `SELECT uta.user_id, uta.telegram_user_id, uta.telegram_username, uta.telegram_chat_id,
                uta.linked_at, uta.notifications_enabled, u.username, u.email, u.role
         FROM user_telegram_accounts uta
         JOIN users u ON u.id = uta.user_id
         WHERE uta.telegram_user_id = $1 AND uta.unlinked_at IS NULL
         LIMIT 1`,
        [telegramUserId]
    );
    return result.rows[0] || null;
}

async function getLinkedAccountByUserId(pool, userId) {
    const result = await pool.query(
        `SELECT uta.user_id, uta.telegram_user_id, uta.telegram_username, uta.telegram_chat_id,
                uta.linked_at, uta.notifications_enabled, u.username, u.email, u.role
         FROM user_telegram_accounts uta
         JOIN users u ON u.id = uta.user_id
         WHERE uta.user_id = $1 AND uta.unlinked_at IS NULL
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
}

module.exports = {
    buildTelegramDeepLink,
    createTelegramLinkToken,
    getLinkedAccountByTelegramUser,
    getLinkedAccountByUserId,
    getTelegramBotUsername,
    getTelegramLinkStatus,
    hashTelegramLinkToken,
    linkTelegramAccount,
    setTelegramNotificationsEnabled,
    unlinkTelegramByTelegramUser,
    unlinkTelegramForUser,
};
